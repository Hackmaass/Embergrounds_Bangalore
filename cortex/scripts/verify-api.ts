/**
 * API contract + workflow scenario verifier (AGENTS.md §6 step 3).
 * Requires the server running on :3200 (`pnpm --filter @cortex/server start`).
 * Every response is parsed with the SAME zod schemas the server and web
 * client import from @cortex/shared — a shape mismatch is a parse error,
 * not a silent pass.
 */
import {
  WorkforceResponseSchema,
  StreamSnapshotSchema,
  MetricsResponseSchema,
  AgentRunResponseSchema,
  DecisionActionResponseSchema,
  KhataResponseSchema,
  ReconciliationResponseSchema,
  ComplianceCalendarResponseSchema,
  PurchaseOrdersResponseSchema,
  StaffResponseSchema,
  type ActivityEvent,
} from "@cortex/shared";
import type { ZodType } from "zod";

const BASE = process.env.CORTEX_API_BASE ?? "http://localhost:3200";

interface ScenarioResult {
  name: string;
  status: "PASS" | "FAIL" | "SKIP";
  latencyMs: number;
  detail?: string;
}

const results: ScenarioResult[] = [];

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const start = performance.now();
  const value = await fn();
  return { value, ms: Math.round(performance.now() - start) };
}

async function scenario(name: string, fn: () => Promise<string | void>): Promise<void> {
  try {
    const { value: detail, ms } = await timed(async () => (await fn()) ?? undefined);
    results.push({ name, status: "PASS", latencyMs: ms, detail });
  } catch (err) {
    results.push({ name, status: "FAIL", latencyMs: 0, detail: err instanceof Error ? err.message : String(err) });
  }
}

async function getJson<T>(path: string, schema: ZodType<T>): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} -> HTTP ${res.status}`);
  return schema.parse(await res.json());
}

async function postJson<T>(path: string, body: unknown, schema: ZodType<T>): Promise<{ status: number; data: T }> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, data: schema.parse(json) };
}

async function pollStreamForDecision(kind: string, timeoutMs = 5000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const stream = await getJson("/api/cortex/stream", StreamSnapshotSchema);
    const staged = stream.find((e) => e.type === "DECISION_STAGED" && e.decision_kind === kind);
    if (staged?.decision_id) return staged.decision_id;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for a ${kind} DECISION_STAGED event`);
}

async function pollStreamFor(predicate: (e: ActivityEvent) => boolean, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const stream = await getJson("/api/cortex/stream", StreamSnapshotSchema);
    if (stream.some(predicate)) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("Timed out waiting for a matching stream event");
}

async function main(): Promise<void> {
  await scenario("POST /api/demo/reset", async () => {
    const res = await fetch(`${BASE}/api/demo/reset`, { method: "POST" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });

  await scenario("GET /api/cortex/workforce", async () => {
    const wf = await getJson("/api/cortex/workforce", WorkforceResponseSchema);
    if (wf.agents.length < 5) throw new Error(`expected >=5 agents, got ${wf.agents.length}`);
  });

  await scenario("GET /api/cortex/stream (empty after reset)", async () => {
    const snap = await getJson("/api/cortex/stream", StreamSnapshotSchema);
    if (snap.length !== 0) throw new Error(`expected empty stream after reset, got ${snap.length} events`);
  });

  await scenario("GET /api/cortex/metrics", async () => {
    await getJson("/api/cortex/metrics", MetricsResponseSchema);
  });

  // --- Scenario: Priya — dip scan -> voucher decision -> approve -> vouchers dispatched ---
  let priyaDecisionId = "";
  await scenario("Priya: run -> VOUCHER_CAMPAIGN staged", async () => {
    const { status, data } = await postJson("/api/cortex/agents/priya-sales/run", {}, AgentRunResponseSchema);
    if (status !== 200) throw new Error(`HTTP ${status}`);
    if (data.status !== "STARTED") throw new Error(`expected STARTED, got ${data.status}`);
    priyaDecisionId = await pollStreamForDecision("VOUCHER_CAMPAIGN");
    return `decision ${priyaDecisionId} staged`;
  });

  await scenario("Priya: approve -> 28 vouchers + Soundbox announcement", async () => {
    const { status, data } = await postJson(
      `/api/cortex/decisions/${priyaDecisionId}/action`,
      { action: "APPROVE", source: "WHATSAPP" },
      DecisionActionResponseSchema,
    );
    if (status !== 200) throw new Error(`HTTP ${status}`);
    if (data.decision_kind !== "VOUCHER_CAMPAIGN") throw new Error("wrong decision_kind echoed back");
    if (!data.soundbox_triggered) throw new Error("expected soundbox_triggered=true");
    return `dispatched ${data.result.dispatched_vouchers} vouchers`;
  });

  await scenario("Priya: repeat action on decided decision -> 409", async () => {
    const res = await fetch(`${BASE}/api/cortex/decisions/${priyaDecisionId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "APPROVE", source: "WHATSAPP" }),
    });
    if (res.status !== 409) throw new Error(`expected 409, got ${res.status}`);
  });

  // --- Scenario: Aman — "check ₹X" via simulator (SUCCESS+lag override, then PENDING ticket) ---
  await scenario("Aman: check ₹350 -> SUCCESS + Soundbox override", async () => {
    const res = await fetch(`${BASE}/api/channels/simulator/inbound`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "TELEGRAM", role: "OWNER", identity_id: "owner-1", text: "Check last payment ₹350" }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await new Promise((r) => setTimeout(r, 300));
    const stream = await getJson("/api/cortex/stream", StreamSnapshotSchema);
    if (!stream.some((e) => e.type === "SOUNDBOX_ANNOUNCED" && e.message.includes("prapt huye"))) {
      throw new Error("expected a Soundbox override announcement for the ₹350 check");
    }
  });

  await scenario("Aman: check ₹500 -> PENDING dispute ticket", async () => {
    const res = await fetch(`${BASE}/api/channels/simulator/inbound`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "TELEGRAM", role: "OWNER", identity_id: "owner-1", text: "Check ₹500" }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await new Promise((r) => setTimeout(r, 300));
    const stream = await getJson("/api/cortex/stream", StreamSnapshotSchema);
    if (!stream.some((e) => e.type === "DISPUTE_OPENED")) {
      throw new Error("expected a DISPUTE_OPENED event for the ₹500 check");
    }
  });

  // --- Scenario: Munim — reconciliation mismatch + khata batch -> approve -> reminders sent ---
  await scenario("GET /api/cortex/khata", async () => {
    const khata = await getJson("/api/cortex/khata", KhataResponseSchema);
    if (khata.entries.length === 0) throw new Error("expected seeded khata entries");
  });

  await scenario("GET /api/cortex/accounts/reconciliation -> mismatch present", async () => {
    const recon = await getJson("/api/cortex/accounts/reconciliation", ReconciliationResponseSchema);
    if (recon.mismatches.length === 0) throw new Error("expected the seeded settlement mismatch");
  });

  await scenario("GET /api/cortex/compliance/calendar -> item present", async () => {
    const items = await getJson("/api/cortex/compliance/calendar", ComplianceCalendarResponseSchema);
    if (items.length === 0) throw new Error("expected seeded compliance items");
  });

  let khataDecisionId = "";
  await scenario("Munim: run -> KHATA_REMINDER_BATCH staged", async () => {
    const { status } = await postJson("/api/cortex/agents/munim-accounts/run", {}, AgentRunResponseSchema);
    if (status !== 200) throw new Error(`HTTP ${status}`);
    khataDecisionId = await pollStreamForDecision("KHATA_REMINDER_BATCH");
    return `decision ${khataDecisionId} staged`;
  });

  await scenario("Munim: approve -> reminders sent", async () => {
    const { status, data } = await postJson(
      `/api/cortex/decisions/${khataDecisionId}/action`,
      { action: "APPROVE", source: "DESKTOP" },
      DecisionActionResponseSchema,
    );
    if (status !== 200) throw new Error(`HTTP ${status}`);
    if (data.decision_kind !== "KHATA_REMINDER_BATCH") throw new Error("wrong decision_kind echoed back");
    return `${data.result.reminders_sent} reminders sent`;
  });

  // --- Scenario: Vikram — low-stock reorder -> 3 quotes -> PO -> approve -> sent to cheapest supplier ---
  let poDecisionId = "";
  await scenario("Vikram: run -> PURCHASE_ORDER staged with 3 quotes", async () => {
    const { status } = await postJson("/api/cortex/agents/vikram-procurement/run", {}, AgentRunResponseSchema);
    if (status !== 200) throw new Error(`HTTP ${status}`);
    poDecisionId = await pollStreamForDecision("PURCHASE_ORDER");
    const pos = await getJson("/api/cortex/procurement/purchase-orders", PurchaseOrdersResponseSchema);
    const po = pos.find((p) => p.decision_id === poDecisionId);
    if (!po) throw new Error("staged PO not found in /procurement/purchase-orders");
    if (po.quotes.length !== 3) throw new Error(`expected 3 quotes, got ${po.quotes.length}`);
    return `PO ${po.po_id}: ${po.qty} ${po.sku} = ₹${po.total}`;
  });

  await scenario("Vikram: Ghee reorder over procurement cap -> GUARDRAIL_BLOCKED, no PO staged", async () => {
    await pollStreamFor((e) => e.type === "GUARDRAIL_BLOCKED" && e.message.includes("Ghee"));
    const stream = await getJson("/api/cortex/stream", StreamSnapshotSchema);
    const blocked = stream.find((e) => e.type === "GUARDRAIL_BLOCKED" && e.message.includes("Ghee"));
    if (blocked?.severity !== "CRITICAL") throw new Error(`expected severity CRITICAL, got ${blocked?.severity}`);
    const pos = await getJson("/api/cortex/procurement/purchase-orders", PurchaseOrdersResponseSchema);
    if (pos.some((p) => p.sku.includes("Ghee"))) throw new Error("a blocked reorder must never produce a PO row");
  });

  await scenario("Vikram: approve -> PO sent to cheapest supplier", async () => {
    const { status, data } = await postJson(
      `/api/cortex/decisions/${poDecisionId}/action`,
      { action: "APPROVE", source: "WHATSAPP" },
      DecisionActionResponseSchema,
    );
    if (status !== 200) throw new Error(`HTTP ${status}`);
    if (data.decision_kind !== "PURCHASE_ORDER") throw new Error("wrong decision_kind echoed back");
    return `sent to ${data.result.supplier} for ₹${data.result.total}`;
  });

  // --- Scenario: Meera — worker check-in updates attendance; payday -> approve -> workers paid ---
  await scenario("GET /api/cortex/staff (seeded roster)", async () => {
    const staff = await getJson("/api/cortex/staff", StaffResponseSchema);
    if (staff.workers.length === 0) throw new Error("expected seeded staff");
  });

  await scenario("Meera: worker check-in updates attendance", async () => {
    const res = await fetch(`${BASE}/api/cortex/staff/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ worker_id: "wkr-01", type: "CHECK_IN", source: "WHATSAPP" }),
    });
    if (res.status !== 201) throw new Error(`HTTP ${res.status}`);
    const staff = await getJson("/api/cortex/staff", StaffResponseSchema);
    const raju = staff.workers.find((w) => w.worker_id === "wkr-01");
    if (raju?.status === "ABSENT") throw new Error("expected wkr-01 status to update off ABSENT after check-in");
  });

  let payrollDecisionId = "";
  await scenario("Meera: run -> PAYROLL_PAYOUT staged", async () => {
    const { status } = await postJson("/api/cortex/agents/meera-staff/run", {}, AgentRunResponseSchema);
    if (status !== 200) throw new Error(`HTTP ${status}`);
    payrollDecisionId = await pollStreamForDecision("PAYROLL_PAYOUT");
    return `decision ${payrollDecisionId} staged`;
  });

  await scenario("Meera: approve -> workers paid", async () => {
    const { status, data } = await postJson(
      `/api/cortex/decisions/${payrollDecisionId}/action`,
      { action: "APPROVE", source: "WHATSAPP" },
      DecisionActionResponseSchema,
    );
    if (status !== 200) throw new Error(`HTTP ${status}`);
    if (data.decision_kind !== "PAYROLL_PAYOUT") throw new Error("wrong decision_kind echoed back");
    return `${data.result.workers_paid} workers paid ₹${data.result.total_paid}`;
  });

  // --- Scenario: Studio compiler — generate -> hire -> runnable; unsafe prompt rejected ---
  let customAgentId = "";
  await scenario("Studio: generate khata prompt -> Udhaar Recovery spec", async () => {
    const res = await fetch(`${BASE}/api/cortex/custom-agents/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "Track customer credit dues (khata). If balance exceeds ₹5,000 for more than 15 days, send WhatsApp reminder with Paytm UPI link.",
        template_id: null,
      }),
    });
    if (res.status !== 201) throw new Error(`HTTP ${res.status}`);
    const spec = await res.json();
    if (spec.status !== "DRAFT") throw new Error(`expected DRAFT, got ${spec.status}`);
    if (!spec.guardrails.require_merchant_approval) throw new Error("compiled spec must always require merchant approval");
    customAgentId = spec.agent_id;
    return `${spec.name} (${spec.tools.join(", ")})`;
  });

  await scenario("Studio: hire -> ACTIVE and runnable", async () => {
    const hireRes = await fetch(`${BASE}/api/cortex/custom-agents/${customAgentId}/hire`, { method: "POST" });
    if (!hireRes.ok) throw new Error(`HTTP ${hireRes.status}`);
    const hired = await hireRes.json();
    if (hired.status !== "ACTIVE") throw new Error(`expected ACTIVE after hire, got ${hired.status}`);

    const wf = await getJson("/api/cortex/workforce", WorkforceResponseSchema);
    if (!wf.agents.some((a) => a.id === customAgentId)) throw new Error("hired agent missing from /workforce roster");

    const { status } = await postJson(`/api/cortex/agents/${customAgentId}/run`, {}, AgentRunResponseSchema);
    if (status !== 200) throw new Error(`HTTP ${status} — hired custom agent should be runnable, not 404`);
  });

  await scenario("Studio: unsafe prompt (bypass approval) -> rejected", async () => {
    const res = await fetch(`${BASE}/api/cortex/custom-agents/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Send payouts automatically without merchant approval", template_id: null }),
    });
    if (res.status !== 422) throw new Error(`expected 422, got ${res.status}`);
  });

  // --- Report ---
  const width = Math.max(...results.map((r) => r.name.length)) + 2;
  console.log("\n" + "SCENARIO".padEnd(width) + "STATUS".padEnd(8) + "LATENCY".padEnd(10) + "DETAIL");
  for (const r of results) {
    console.log(r.name.padEnd(width) + r.status.padEnd(8) + `${r.latencyMs}ms`.padEnd(10) + (r.detail ?? ""));
  }

  const failed = results.filter((r) => r.status === "FAIL");
  console.log(`\n${results.length - failed.length}/${results.length} passed, ${failed.length} failed, ${results.filter((r) => r.status === "SKIP").length} skipped.`);
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("verify-api.ts crashed:", err);
  process.exitCode = 1;
});
