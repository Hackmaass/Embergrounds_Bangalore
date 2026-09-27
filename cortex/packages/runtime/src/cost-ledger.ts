import { and, eq, gte, sum } from "drizzle-orm";
import type { CortexDb } from "@cortex/db";
import { schema } from "@cortex/db";
import { makeId } from "./ids.js";
import { now } from "./clock.js";

export type CostKind = "LLM_TOKENS" | "WHATSAPP_MESSAGE";

export async function recordCost(
  db: CortexDb,
  args: { storeId: string; agentId: string; kind: CostKind; amount: number; units: number },
): Promise<void> {
  await db.insert(schema.costEvents).values({
    id: makeId("cost"),
    storeId: args.storeId,
    agentId: args.agentId,
    kind: args.kind,
    amount: args.amount,
    units: args.units,
    createdAt: now(),
  });
}

/** Sum of `amount` for an agent's cost events today (used by spend-cap guardrails). */
export async function getSpentToday(
  db: CortexDb,
  storeId: string,
  agentId: string,
  kind?: CostKind,
): Promise<number> {
  const startOfDay = new Date(now());
  startOfDay.setUTCHours(0, 0, 0, 0);

  const conditions = [
    eq(schema.costEvents.storeId, storeId),
    eq(schema.costEvents.agentId, agentId),
    gte(schema.costEvents.createdAt, startOfDay),
  ];
  if (kind) conditions.push(eq(schema.costEvents.kind, kind));

  const [row] = await db
    .select({ total: sum(schema.costEvents.amount) })
    .from(schema.costEvents)
    .where(and(...conditions));

  return Number(row?.total ?? 0);
}

/** Hard-stop check: is the agent already at/over its daily ₹ cap? */
export async function isHardStopped(
  db: CortexDb,
  storeId: string,
  agentId: string,
  dailyCapRupees: number,
): Promise<boolean> {
  const spent = await getSpentToday(db, storeId, agentId);
  return spent >= dailyCapRupees;
}
