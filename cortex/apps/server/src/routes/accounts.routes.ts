import { Router } from "express";
import { eq } from "drizzle-orm";
import type { CortexDb } from "@cortex/db";
import { DEMO_STORE_ID, schema } from "@cortex/db";
import { daysBetween, now, makeId } from "@cortex/runtime";
import { buildGstr1Draft } from "@cortex/connectors";
import { KhataPostBodySchema } from "@cortex/shared";
import { munim } from "@cortex/agents";

const { getKhataSummary } = munim;

const GSTR1_TAXABLE_VALUE = 412000; // AGENTS.md §5.7 worked example (monthly UPI+POS aggregate)

export function accountsRouter(db: CortexDb): Router {
  const router = Router();
  const storeId = DEMO_STORE_ID;

  router.get("/khata", async (_req, res) => {
    const summary = await getKhataSummary(db, storeId);
    res.json({
      total_outstanding: summary.reduce((sum, c) => sum + c.balance, 0),
      entries: summary.map((c) => ({
        customer_id: c.customerId,
        name: c.name,
        phone: c.phone,
        balance: c.balance,
        oldest_due_days: c.oldestDueDays,
        status: c.status,
      })),
    });
  });

  router.post("/khata", async (req, res) => {
    const parsed = KhataPostBodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "INVALID_BODY", details: parsed.error.flatten() });

    await db.insert(schema.khataEntries).values({
      id: makeId("khata"),
      storeId,
      customerId: parsed.data.customer_id,
      type: parsed.data.type,
      amount: parsed.data.amount,
      note: parsed.data.note,
      status: "OPEN",
    });
    res.status(201).json({ success: true });
  });

  router.get("/accounts/reconciliation", async (req, res) => {
    const date = typeof req.query.date === "string" ? req.query.date : undefined;
    const rows = await db.select().from(schema.settlements).where(eq(schema.settlements.storeId, storeId));
    const settlement = (date ? rows.find((r) => r.date === date) : rows[0]) ?? rows[0];
    if (!settlement) return res.status(404).json({ error: "NO_SETTLEMENT_DATA" });

    const period = settlement.date.slice(0, 7);
    res.json({
      date: settlement.date,
      pos_sales_total: settlement.posSalesTotal,
      pg_settled_total: settlement.pgSettledTotal,
      cash_total: settlement.cashTotal,
      mismatches: settlement.mismatches,
      gstr1_draft: buildGstr1Draft({ period, taxableValue: GSTR1_TAXABLE_VALUE }),
    });
  });

  router.get("/accounts/gstr1/:file", (req, res) => {
    const period = (req.params.file as string).replace(/\.json$/, "");
    res.json(buildGstr1Draft({ period, taxableValue: GSTR1_TAXABLE_VALUE }));
  });

  router.get("/compliance/calendar", async (_req, res) => {
    const items = await db.select().from(schema.complianceItems).where(eq(schema.complianceItems.storeId, storeId));
    res.json(
      items.map((c) => ({
        id: c.id,
        title: c.title,
        authority: c.authority,
        due_date: c.dueDate,
        days_left: daysBetween(now(), new Date(c.dueDate)),
        status: c.status,
      })),
    );
  });

  return router;
}
