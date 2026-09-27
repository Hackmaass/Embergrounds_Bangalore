/** Standalone seed check — boots an isolated in-memory DB and seeds it.
 * The running server seeds itself identically on boot and on
 * POST /api/demo/reset (packages/db/src/seed.ts); this script exists for
 * quick CLI inspection without starting the HTTP server. */
import { getDb, seedDemoStore, schema, DEMO_STORE_ID } from "@cortex/db";

async function main(): Promise<void> {
  const db = await getDb();
  await seedDemoStore(db);

  const [store] = await db.select().from(schema.stores);
  const agents = await db.select().from(schema.agents);
  const sales = await db.select().from(schema.sales);

  console.log(`Seeded store: ${store?.name} (${DEMO_STORE_ID})`);
  console.log(`Agents: ${agents.length}`);
  console.log(`Sales buckets: ${sales.length}`);
}

main().catch((err) => {
  console.error("seed-demo.ts failed:", err);
  process.exitCode = 1;
});
