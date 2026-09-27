import { Router } from "express";
import { eq } from "drizzle-orm";
import type { CortexDb } from "@cortex/db";
import { DEMO_STORE_ID, schema } from "@cortex/db";
import type { SupplierQuote } from "@cortex/shared";

export function procurementRouter(db: CortexDb): Router {
  const router = Router();
  const storeId = DEMO_STORE_ID;

  router.get("/procurement/purchase-orders", async (_req, res) => {
    const [pos, decisions] = await Promise.all([
      db.select().from(schema.purchaseOrders).where(eq(schema.purchaseOrders.storeId, storeId)),
      db.select().from(schema.decisions).where(eq(schema.decisions.storeId, storeId)),
    ]);
    const decisionById = new Map(decisions.map((d) => [d.id, d]));

    res.json(
      pos.map((po) => ({
        po_id: po.id,
        decision_id: po.decisionId,
        sku: po.sku,
        qty: po.qty,
        status: decisionById.get(po.decisionId)?.status ?? po.status,
        quotes: po.quotes as SupplierQuote[],
        total: po.total,
        last_price: po.lastPrice,
        guardrail: po.guardrailNote,
      })),
    );
  });

  return router;
}
