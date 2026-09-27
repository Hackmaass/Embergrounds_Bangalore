import { and, eq } from "drizzle-orm";
import { schema } from "@cortex/db";
import type { CortexDb } from "@cortex/db";
import type { MetricsResponse } from "@cortex/shared";
import { daysBetween, isoDate, now } from "@cortex/runtime";

export async function computeMetrics(db: CortexDb, storeId: string): Promise<MetricsResponse> {
  const [settlement] = await db
    .select()
    .from(schema.settlements)
    .where(eq(schema.settlements.storeId, storeId));
  const todayUpiTotal = settlement?.posSalesTotal ?? 0;

  const executedDecisions = await db
    .select()
    .from(schema.decisions)
    .where(and(eq(schema.decisions.storeId, storeId), eq(schema.decisions.status, "EXECUTED")));

  const aiAttributedRevenue = executedDecisions
    .filter((d) => d.kind === "VOUCHER_CAMPAIGN")
    .reduce((sum, d) => sum + Number((d.result as Record<string, unknown> | null)?.attributed_projected_revenue ?? 0), 0);

  const vouchersRedeemedToday = executedDecisions
    .filter((d) => d.kind === "VOUCHER_CAMPAIGN")
    .reduce((sum, d) => sum + Number((d.result as Record<string, unknown> | null)?.dispatched_vouchers ?? 0), 0);

  const campaignsActive = executedDecisions.filter((d) => d.kind === "VOUCHER_CAMPAIGN").length;

  // ~15 minutes of owner/staff time saved per fully-automated decision.
  const hoursSavedWeek = Math.round(executedDecisions.length * 0.25 * 10) / 10;

  const disputes = await db
    .select()
    .from(schema.disputeResolutions)
    .where(eq(schema.disputeResolutions.storeId, storeId));
  const today = isoDate();
  const disputesToday = disputes.filter((d) => isoDate(d.resolvedAt) === today);
  const disputesResolvedCount = disputesToday.length;
  const disputesResolvedAmount = disputesToday.reduce((sum, d) => sum + d.amount, 0);

  const paymentEntries = await db
    .select()
    .from(schema.khataEntries)
    .where(and(eq(schema.khataEntries.storeId, storeId), eq(schema.khataEntries.type, "PAYMENT")));
  const thisMonth = isoDate().slice(0, 7);
  const udhaarRecoveredMonth = paymentEntries
    .filter((e) => isoDate(e.createdAt).slice(0, 7) === thisMonth)
    .reduce((sum, e) => sum + e.amount, 0);

  const complianceRows = await db
    .select()
    .from(schema.complianceItems)
    .where(eq(schema.complianceItems.storeId, storeId));
  const nowDate = now();
  const nextDue = complianceRows
    .map((c) => ({ ...c, daysLeft: daysBetween(nowDate, new Date(c.dueDate)) }))
    .filter((c) => c.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft)[0];

  return {
    today_upi_total: todayUpiTotal,
    ai_attributed_revenue: aiAttributedRevenue,
    ai_attributed_percentage: todayUpiTotal > 0 ? Math.round((aiAttributedRevenue / todayUpiTotal) * 1000) / 10 : 0,
    disputes_resolved_count: disputesResolvedCount,
    disputes_resolved_amount: disputesResolvedAmount,
    udhaar_recovered_month: udhaarRecoveredMonth,
    hours_saved_week: hoursSavedWeek,
    compliance_next_due: nextDue
      ? { title: nextDue.title, due_date: nextDue.dueDate, days_left: nextDue.daysLeft }
      : { title: "None scheduled", due_date: isoDate(), days_left: 0 },
    campaigns_active: campaignsActive,
    vouchers_redeemed_today: vouchersRedeemedToday,
  };
}
