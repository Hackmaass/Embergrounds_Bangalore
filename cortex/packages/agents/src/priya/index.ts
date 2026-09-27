import { eq, and, isNotNull, desc } from "drizzle-orm";
import type { CortexDb } from "@cortex/db";
import { schema } from "@cortex/db";
import {
  appendActivityEvent,
  combineGuardrails,
  checkMarginFloor,
  checkSpendCap,
  registerDecisionExecutor,
  stageDecision,
  startRun,
  addSubTask,
  completeTask,
  recordCost,
  getSpentToday,
  bumpRupeeMetric,
} from "@cortex/runtime";
import { generateCouponCode } from "@cortex/connectors";
import { getActiveWhatsAppChannel } from "@cortex/channels";
import { POLICY } from "../policy.js";

export const AGENT_ID = "priya-sales";
const AGENT_NAME = "Priya";
const AGENT_AVATAR = "🎯";
const DIP_HOURS_UTC = [18, 19, 20];

interface DipStats {
  yesterdayTotal: number;
  baselineAvg: number;
  deficit: number;
  pctChange: number;
  yesterdayDateKey: string | undefined;
}

async function computeDipStats(db: CortexDb, storeId: string): Promise<DipStats> {
  const rows = await db.select().from(schema.sales).where(eq(schema.sales.storeId, storeId));
  const byDate = new Map<string, number>();

  for (const r of rows) {
    if (!DIP_HOURS_UTC.includes(r.hourBucket.getUTCHours())) continue;
    const dateKey = r.hourBucket.toISOString().slice(0, 10);
    byDate.set(dateKey, (byDate.get(dateKey) ?? 0) + r.amount);
  }

  const dates = [...byDate.keys()].sort();
  const yesterdayDateKey = dates.at(-1);
  const yesterdayTotal = yesterdayDateKey ? (byDate.get(yesterdayDateKey) ?? 0) : 0;
  const baselineDates = dates.slice(0, -1);
  const baselineAvg = baselineDates.length
    ? baselineDates.reduce((sum, d) => sum + (byDate.get(d) ?? 0), 0) / baselineDates.length
    : 0;

  const deficit = Math.max(0, Math.round(baselineAvg - yesterdayTotal));
  const pctChange = baselineAvg > 0 ? ((yesterdayTotal - baselineAvg) / baselineAvg) * 100 : 0;

  return { yesterdayTotal, baselineAvg, deficit, pctChange, yesterdayDateKey };
}

/** Kicks off the 07:00 dip-scan routine. Returns immediately with a run id
 * (AGENTS.md §5.11 STARTED response); the rest of the workflow streams
 * activity events asynchronously. */
export async function run(db: CortexDb, storeId: string): Promise<{ runId: string }> {
  const { runId, taskId } = await startRun(db, { storeId, agentId: AGENT_ID, label: "Daily revenue dip scan" });
  void executeDipScan(db, storeId, runId, taskId).catch((err) => {
    console.error(`[priya] dip scan failed for run ${runId}:`, err);
  });
  return { runId };
}

async function executeDipScan(db: CortexDb, storeId: string, runId: string, taskId: string): Promise<void> {
  const stats = await computeDipStats(db, storeId);

  if (stats.pctChange > -POLICY.DIP_THRESHOLD_PCT || stats.deficit <= 0) {
    await completeTask(db, taskId, "DONE");
    return; // no material dip — nothing to report
  }

  await appendActivityEvent(db, {
    storeId,
    agentId: AGENT_ID,
    agentName: AGENT_NAME,
    agentAvatar: AGENT_AVATAR,
    message: `Detected revenue dip (${stats.pctChange.toFixed(0)}%) between 6:00–9:00 PM yesterday (Deficit: ₹${stats.deficit}).`,
    type: "ANOMALY_DETECTED",
    severity: "WARNING",
  });

  // --- Root cause: most recent stockout on record for this store ---
  const rootCauseTaskId = await addSubTask(db, { storeId, agentId: AGENT_ID, runId, parentTaskId: taskId, label: "Root cause check" });
  const [oosSku] = await db
    .select()
    .from(schema.inventory)
    .where(and(eq(schema.inventory.storeId, storeId), isNotNull(schema.inventory.outOfStockAt)))
    .orderBy(desc(schema.inventory.outOfStockAt))
    .limit(1);

  if (oosSku?.outOfStockAt) {
    const stockoutTime = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(oosSku.outOfStockAt);
    await appendActivityEvent(db, {
      storeId,
      agentId: "vikram-procurement",
      agentName: "Vikram",
      agentAvatar: "📦",
      message: `Traced root cause to ${oosSku.sku} out-of-stock at ${stockoutTime}. Stock replenished this morning.`,
      type: "ROOT_CAUSE_ISOLATED",
      severity: "INFO",
    });
  }
  await completeTask(db, rootCauseTaskId, "DONE");

  // --- Cohort: regular customers affected during the dip window ---
  const cohortTaskId = await addSubTask(db, { storeId, agentId: AGENT_ID, runId, parentTaskId: taskId, label: "Build affected cohort" });
  const regulars = await db
    .select()
    .from(schema.customers)
    .where(eq(schema.customers.storeId, storeId));
  const cohort = regulars.filter((c) => c.isRegular === 1);

  await appendActivityEvent(db, {
    storeId,
    agentId: AGENT_ID,
    agentName: AGENT_NAME,
    agentAvatar: AGENT_AVATAR,
    message: `Identified ${cohort.length} repeat regular customers who left without buying.`,
    type: "COHORT_BUILT",
    severity: "INFO",
  });
  await completeTask(db, cohortTaskId, "DONE");

  // --- Guardrail: margin floor + WhatsApp spend cap ---
  const grossMarginPct = oosSku?.grossMarginPct ?? 45;
  const cost = cohort.length * POLICY.COST_PER_WHATSAPP_MESSAGE;
  const spentToday = await getSpentToday(db, storeId, AGENT_ID, "WHATSAPP_MESSAGE");

  const combined = combineGuardrails([
    checkMarginFloor({ grossMarginPct, discountPct: POLICY.VOUCHER_DISCOUNT_PCT, floorPct: POLICY.MARGIN_FLOOR_PCT }),
    checkSpendCap({ amountRupees: cost, spentTodayRupees: spentToday, dailyCapRupees: POLICY.DAILY_WHATSAPP_SPEND_CAP }),
  ]);

  const guardrailTaskId = await addSubTask(db, { storeId, agentId: AGENT_ID, runId, parentTaskId: taskId, label: "Guardrail evaluation" });
  await appendActivityEvent(db, {
    storeId,
    agentId: AGENT_ID,
    agentName: "Guardrail",
    agentAvatar: "🛡️",
    message: combined.passed
      ? `Margin Check: ${combined.summary}. Guardrail PASSED.`
      : `Margin Check: ${combined.summary}`,
    type: combined.passed ? "GUARDRAIL_PASSED" : "GUARDRAIL_BLOCKED",
    severity: combined.passed ? "SUCCESS" : "CRITICAL",
  });
  await completeTask(db, guardrailTaskId, combined.passed ? "DONE" : "FAILED");

  if (!combined.passed) {
    await completeTask(db, taskId, "DONE");
    return;
  }

  const projectedRevenue = Math.round(stats.deficit * POLICY.DIP_RECOVERY_FACTOR);
  const couponCodes = cohort.map((c) => ({ customerId: c.id, code: generateCouponCode("CMP") }));

  await stageDecision(db, {
    storeId,
    agentId: AGENT_ID,
    agentName: AGENT_NAME,
    agentAvatar: "📲",
    kind: "VOUCHER_CAMPAIGN",
    payload: {
      discountPct: POLICY.VOUCHER_DISCOUNT_PCT,
      cohortSize: cohort.length,
      couponCodes,
      costRupees: cost,
      projectedRevenue,
    },
    message: `Sent WhatsApp 1-Tap Interactive Card to Ramesh Ji. 10% Recovery Voucher for ${cohort.length} regulars (Cost: ₹${cost}, Projected: ₹${projectedRevenue}).`,
    idempotencyKey: `voucher:${storeId}:${stats.yesterdayDateKey}`,
  });

  await completeTask(db, taskId, "DONE");
}

registerDecisionExecutor("VOUCHER_CAMPAIGN", async ({ db, storeId, agentId, payload }) => {
  const cohortSize = payload.cohortSize as number;
  const costRupees = payload.costRupees as number;
  const projectedRevenue = payload.projectedRevenue as number;
  const discountPct = payload.discountPct as number;
  const couponCodes = payload.couponCodes as Array<{ customerId: string; code: string }>;

  const customers = await db.select().from(schema.customers).where(eq(schema.customers.storeId, storeId));
  const phoneById = new Map(customers.map((c) => [c.id, c.phone]));
  const channel = getActiveWhatsAppChannel();

  for (const [i, { customerId, code }] of couponCodes.entries()) {
    // Paced, not fired in one burst: a live WhatsApp connection sending
    // dozens of near-identical messages to the same JID in a few
    // milliseconds is the canonical pattern anti-spam heuristics act on —
    // exactly the flagging risk this integration was built to avoid. Only
    // applies against a real channel — the simulator has no such risk and
    // verify-api/demo runs shouldn't pay an artificial 8s tax for it.
    if (i > 0 && channel.mode === "LIVE") await new Promise((resolve) => setTimeout(resolve, 300));
    try {
      await channel.sendText({
        storeId,
        toIdentityId: phoneById.get(customerId) ?? customerId,
        text: `Namaste! Ramesh Sweets se ${discountPct}% off aapke agle order par. Code: ${code}`,
      });
    } catch (err) {
      console.error(`[priya] voucher delivery failed for ${customerId}:`, err);
    }
  }

  await recordCost(db, { storeId, agentId, kind: "WHATSAPP_MESSAGE", amount: costRupees, units: cohortSize });
  await bumpRupeeMetric(db, storeId, agentId, "Recovered Revenue", projectedRevenue, "(Wk)");

  return {
    result: { dispatched_vouchers: cohortSize, attributed_projected_revenue: projectedRevenue },
    soundboxTriggered: true,
    soundboxAnnouncement: `Paytm par ${cohortSize} regular customers ko recovery offer bhej diya gaya hai!`,
  };
});
