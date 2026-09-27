import { eq } from "drizzle-orm";
import type { CortexDb } from "@cortex/db";
import { schema } from "@cortex/db";
import { daysBetween, now } from "@cortex/runtime";
import type { KhataEntryStatus } from "@cortex/shared";

export interface CustomerKhataSummary {
  customerId: string;
  name: string;
  phone: string;
  balance: number;
  oldestDueDays: number;
  status: KhataEntryStatus;
}

const STATUS_RANK: Record<string, number> = { OPEN: 0, REMINDER_DRAFTED: 1, REMINDED: 2, PAID: 3 };

/** Balance = sum(CREDIT) - sum(PAYMENT) per customer, derived fresh from
 * the append-only ledger every time (no cached running balance to drift). */
export async function getKhataSummary(db: CortexDb, storeId: string): Promise<CustomerKhataSummary[]> {
  const [entries, customers] = await Promise.all([
    db.select().from(schema.khataEntries).where(eq(schema.khataEntries.storeId, storeId)),
    db.select().from(schema.customers).where(eq(schema.customers.storeId, storeId)),
  ]);

  const byCustomer = new Map<string, typeof entries>();
  for (const e of entries) {
    const list = byCustomer.get(e.customerId) ?? [];
    list.push(e);
    byCustomer.set(e.customerId, list);
  }

  const summaries: CustomerKhataSummary[] = [];
  for (const [customerId, list] of byCustomer) {
    const balance = list.reduce((sum, e) => sum + (e.type === "CREDIT" ? e.amount : -e.amount), 0);
    if (balance <= 0) continue;

    const oldestCredit = list
      .filter((e) => e.type === "CREDIT")
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    const oldestDueDays = oldestCredit ? daysBetween(oldestCredit.createdAt, now()) : 0;

    const status = list.reduce<string>((acc, e) => ((STATUS_RANK[e.status] ?? 0) > (STATUS_RANK[acc] ?? 0) ? e.status : acc), "OPEN");
    const customer = customers.find((c) => c.id === customerId);

    summaries.push({
      customerId,
      name: customer?.name ?? customerId,
      phone: customer?.phone ?? "",
      balance,
      oldestDueDays,
      status: (status === "OPEN" ? "REMINDER_DRAFTED" : status) as KhataEntryStatus,
    });
  }

  return summaries.sort((a, b) => b.oldestDueDays - a.oldestDueDays);
}
