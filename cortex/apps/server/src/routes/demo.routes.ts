import { Router } from "express";
import type { CortexDb } from "@cortex/db";
import { DEMO_STORE_ID, clearDemoStore, seedDemoStore } from "@cortex/db";
import { simulatorTelegram, simulatorWhatsapp } from "@cortex/channels";

export function demoRouter(db: CortexDb): Router {
  const router = Router();
  const storeId = DEMO_STORE_ID;

  router.post("/reset", async (_req, res) => {
    await clearDemoStore(db, storeId);
    await seedDemoStore(db, storeId);
    simulatorWhatsapp.reset(storeId);
    simulatorTelegram.reset(storeId);

    res.json({ success: true, store_id: storeId, reset_at: new Date().toISOString() });
  });

  return router;
}
