import { and, eq } from "drizzle-orm";
import type { CortexDb } from "@cortex/db";
import { schema } from "@cortex/db";
import {
  appendActivityEvent,
  combineGuardrails,
  checkPriceVarianceCap,
  checkTotalCap,
  registerDecisionExecutor,
  stageDecision,
  startRun,
  addSubTask,
  completeTask,
  makeId,
  isoDate,
  setAgentMetric,
} from "@cortex/runtime";
import { getSupplierQuotes } from "@cortex/connectors";
import { simulatorWhatsapp } from "@cortex/channels";
import type { SupplierQuote } from "@cortex/shared";
import { POLICY } from "../policy.js";

export const AGENT_ID = "vikram-procurement";
const AGENT_NAME = "Vikram";
const AGENT_AVATAR = "📦";
const COVER_DAYS_THRESHOLD = 1;

export async function run(db: CortexDb, storeId: string): Promise<{ runId: string }> {
  const { runId, taskId } = await startRun(db, { storeId, agentId: AGENT_ID, label: "Stock cover & reorder scan" });
  void execute(db, storeId, runId, taskId).catch((err) => {
    console.error(`[vikram] stock scan failed for run ${runId}:`, err);
  });
  return { runId };
}

async function execute(db: CortexDb, storeId: string, runId: string, taskId: string): Promise<void> {
  const items = await db.select().from(schema.inventory).where(eq(schema.inventory.storeId, storeId));
  const lowStock = items.filter((i) => i.dailyVelocity > 0 && i.qtyOnHand / i.dailyVelocity < COVER_DAYS_THRESHOLD);

  await setAgentMetric(db, storeId, AGENT_ID, "Low Stock SKUs", `${lowStock.length} SKU${lowStock.length === 1 ? "" : "s"}`);

  if (lowStock.length === 0) {
    await completeTask(db, taskId, "DONE");
    return;
  }

  for (const item of lowStock) {
    await reorderSku(db, storeId, runId, taskId, item);
  }

  await completeTask(db, taskId, "DONE");
}

async function reorderSku(
  db: CortexDb,
  storeId: string,
  runId: string,
  parentTaskId: string,
  item: typeof schema.inventory.$inferSelect,
): Promise<void> {
  const coverDays = item.qtyOnHand / item.dailyVelocity;
  const reorderQty = Math.max(1, Math.round(item.dailyVelocity));

  const subTaskId = await addSubTask(db, { storeId, agentId: AGENT_ID, runId, parentTaskId, label: `Reorder ${item.sku}` });
  await appendActivityEvent(db, {
    storeId,
    agentId: AGENT_ID,
    agentName: AGENT_NAME,
    agentAvatar: AGENT_AVATAR,
    message: `${item.sku} cover < ${COVER_DAYS_THRESHOLD} day (${coverDays.toFixed(2)}d). Requesting quotes from 3 suppliers for ${reorderQty} ${item.unit}.`,
    type: "ANOMALY_DETECTED",
    severity: "WARNING",
  });

  const quotes = getSupplierQuotes(item.lastPrice);
  const selected = quotes.find((q) => q.selected) ?? quotes[0]!;
  const total = Math.round(selected.unit_price * reorderQty);

  const guardrail = combineGuardrails([
    checkPriceVarianceCap({ quotedPrice: selected.unit_price, lastPrice: item.lastPrice, maxVariancePct: POLICY.PRICE_VARIANCE_CAP_PCT }),
    checkTotalCap({ totalRupees: total, capRupees: POLICY.PROCUREMENT_TOTAL_CAP }),
  ]);

  await appendActivityEvent(db, {
    storeId,
    agentId: AGENT_ID,
    agentName: "Guardrail",
    agentAvatar: "🛡️",
    message: `${item.sku} — best of 3 supplier quotes: ${selected.supplier} ₹${selected.unit_price}/${item.unit} × ${reorderQty} ${item.unit} = ₹${total}. ${guardrail.summary}.`,
    type: guardrail.passed ? "GUARDRAIL_PASSED" : "GUARDRAIL_BLOCKED",
    severity: guardrail.passed ? "SUCCESS" : "CRITICAL",
  });

  if (!guardrail.passed) {
    await completeTask(db, subTaskId, "FAILED");
    return;
  }

  const decisionId = makeId("dec");
  const poId = makeId("PO");
  await db.insert(schema.purchaseOrders).values({
    id: poId,
    storeId,
    decisionId,
    sku: item.sku,
    qty: reorderQty,
    status: "AWAITING_APPROVAL",
    quotes,
    total,
    lastPrice: item.lastPrice,
    guardrailNote: guardrail.summary,
  });

  await stageDecision(db, {
    id: decisionId,
    storeId,
    agentId: AGENT_ID,
    agentName: AGENT_NAME,
    agentAvatar: AGENT_AVATAR,
    kind: "PURCHASE_ORDER",
    payload: { poId, sku: item.sku, qty: reorderQty, unit: item.unit, total, supplier: selected.supplier, quotes },
    message: `${item.sku} cover < ${COVER_DAYS_THRESHOLD} day. Best rate: ${selected.supplier} ₹${selected.unit_price}/${item.unit} × ${reorderQty} ${item.unit} = ₹${total}. PO bhej du?`,
    idempotencyKey: `po:${storeId}:${item.sku}:${isoDate()}`,
  });

  await completeTask(db, subTaskId, "DONE");
}

registerDecisionExecutor("PURCHASE_ORDER", async ({ db, storeId, decisionId, payload }) => {
  const poId = payload.poId as string;
  const sku = payload.sku as string;
  const qty = payload.qty as number;
  const total = payload.total as number;
  const supplier = payload.supplier as string;
  const quotes = payload.quotes as SupplierQuote[];

  await db
    .update(schema.purchaseOrders)
    .set({ status: "EXECUTED", quotes, supplierId: supplier })
    .where(eq(schema.purchaseOrders.decisionId, decisionId));

  const [item] = await db
    .select()
    .from(schema.inventory)
    .where(and(eq(schema.inventory.storeId, storeId), eq(schema.inventory.sku, sku)));
  if (item) {
    await db
      .update(schema.inventory)
      .set({ qtyOnHand: item.qtyOnHand + qty, lastPrice: quotes.find((q) => q.selected)?.unit_price ?? item.lastPrice })
      .where(eq(schema.inventory.id, item.id));
  }

  await simulatorWhatsapp.sendText({
    storeId,
    toIdentityId: supplier,
    text: `✅ PO confirmed: ${qty} ${sku} @ ₹${total}. Please deliver as quoted.`,
  });

  return {
    result: { po_id: poId, supplier, total },
    soundboxTriggered: false,
  };
});
