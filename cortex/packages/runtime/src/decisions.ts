import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { CortexDb } from "@cortex/db";
import { schema } from "@cortex/db";
import type {
  ActionSource,
  DecisionActionResponse,
  DecisionKind,
  DecisionRejectResponse,
} from "@cortex/shared";
import { makeId } from "./ids.js";
import { now } from "./clock.js";
import { appendActivityEvent } from "./activity.js";
import { getAgentRow } from "./registry.js";

const SECRET = process.env.CORTEX_DECISION_SECRET ?? "cortex-dev-secret-change-me";

/** Deterministic key ordering: the JSONB column round-trips `payload`
 * through Postgres, which does not preserve insertion key order, so signing
 * with plain `JSON.stringify` would fail verification on every legitimate
 * decision (not just tampered ones). Sorting keys recursively makes the
 * signature stable across that round-trip. */
export function stableStringify(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value); // toISOString(), not enumerable-property object walk
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sign(payload: unknown): string {
  return crypto.createHmac("sha256", SECRET).update(stableStringify(payload)).digest("hex");
}

export interface ExecutorContext {
  db: CortexDb;
  decisionId: string;
  storeId: string;
  agentId: string;
  payload: Record<string, unknown>;
}

export interface ExecutorResult {
  result: Record<string, unknown>;
  soundboxTriggered: boolean;
  soundboxAnnouncement?: string;
}

export type DecisionExecutor = (ctx: ExecutorContext) => Promise<ExecutorResult>;

const executors = new Map<DecisionKind, DecisionExecutor>();

/** Each agent package registers its own executor at import time (e.g.
 * priya registers VOUCHER_CAMPAIGN). Keeps the generic action route
 * (AGENTS.md §5.3) decoupled from any one agent's business logic. */
export function registerDecisionExecutor(kind: DecisionKind, fn: DecisionExecutor): void {
  executors.set(kind, fn);
}

const DEFAULT_APPROVE_LABEL: Record<DecisionKind, string> = {
  VOUCHER_CAMPAIGN: "Approve & Send",
  KHATA_REMINDER_BATCH: "Send Reminders",
  PURCHASE_ORDER: "Place Order",
  PAYROLL_PAYOUT: "Pay All",
};

export interface StageDecisionInput {
  id?: string;
  storeId: string;
  agentId: string;
  agentName: string;
  agentAvatar: string;
  kind: DecisionKind;
  payload: Record<string, unknown>;
  message: string;
  idempotencyKey?: string;
  ttlMs?: number;
}

export type DecisionRow = typeof schema.decisions.$inferSelect;

/** Freezes a decision contract: immutable payload + HMAC signature + expiry
 * + idempotency key, and appends the DECISION_STAGED activity event with
 * 1-tap buttons. Re-staging the same `idempotencyKey` while a prior
 * decision is still AWAITING_APPROVAL returns the existing one instead of
 * creating a duplicate. */
export async function stageDecision(db: CortexDb, input: StageDecisionInput): Promise<DecisionRow> {
  const idempotencyKey = input.idempotencyKey ?? input.id ?? makeId("idem");

  // Re-running the same routine before its previous decision has moved on
  // (or after it's already been decided) must never attempt a second
  // insert under the same idempotency key — always hand back what's there.
  const [existing] = await db
    .select()
    .from(schema.decisions)
    .where(eq(schema.decisions.idempotencyKey, idempotencyKey));
  if (existing) return existing;

  const id = input.id ?? makeId("dec");
  const createdAt = now();
  const expiresAt = new Date(createdAt.getTime() + (input.ttlMs ?? 24 * 60 * 60 * 1000));
  const signature = sign({
    id,
    storeId: input.storeId,
    agentId: input.agentId,
    kind: input.kind,
    payload: input.payload,
    expiresAt: expiresAt.toISOString(),
  });

  await db.insert(schema.decisions).values({
    id,
    storeId: input.storeId,
    agentId: input.agentId,
    kind: input.kind,
    status: "AWAITING_APPROVAL",
    payload: input.payload,
    signature,
    idempotencyKey,
    expiresAt,
    createdAt,
  });

  await appendActivityEvent(db, {
    storeId: input.storeId,
    agentId: input.agentId,
    agentName: input.agentName,
    agentAvatar: input.agentAvatar,
    message: input.message,
    type: "DECISION_STAGED",
    severity: "WARNING",
    decisionId: id,
    decisionKind: input.kind,
    buttons: [
      { action: "APPROVE", label: DEFAULT_APPROVE_LABEL[input.kind] },
      { action: "REJECT", label: "Reject" },
    ],
  });

  const [row] = await db.select().from(schema.decisions).where(eq(schema.decisions.id, id));
  if (!row) throw new Error("Failed to read back staged decision");
  return row;
}

export interface DecideDecisionInput {
  decisionId: string;
  storeId: string;
  action: "APPROVE" | "REJECT";
  source: ActionSource;
}

export type DecideOutcome =
  | { ok: true; response: DecisionActionResponse | DecisionRejectResponse }
  | { ok: false; httpStatus: 404; error: "DECISION_NOT_FOUND" }
  | { ok: false; httpStatus: 409; error: "ALREADY_DECIDED" | "EXPIRED"; status: string };

/**
 * Idempotent by construction: the very first check is `status ===
 * AWAITING_APPROVAL`, so a repeat call on an already-decided decision
 * always short-circuits to 409 before any executor runs.
 */
export async function decideDecision(db: CortexDb, args: DecideDecisionInput): Promise<DecideOutcome> {
  const [row] = await db
    .select()
    .from(schema.decisions)
    .where(and(eq(schema.decisions.id, args.decisionId), eq(schema.decisions.storeId, args.storeId)));
  if (!row) return { ok: false, httpStatus: 404, error: "DECISION_NOT_FOUND" };

  if (row.status !== "AWAITING_APPROVAL") {
    return { ok: false, httpStatus: 409, error: "ALREADY_DECIDED", status: row.status };
  }

  if (now().getTime() > row.expiresAt.getTime()) {
    await db.update(schema.decisions).set({ status: "EXPIRED" }).where(eq(schema.decisions.id, row.id));
    return { ok: false, httpStatus: 409, error: "EXPIRED", status: "EXPIRED" };
  }

  const expectedSignature = sign({
    id: row.id,
    storeId: row.storeId,
    agentId: row.agentId,
    kind: row.kind,
    payload: row.payload,
    expiresAt: row.expiresAt.toISOString(),
  });
  if (row.signature !== expectedSignature) {
    throw new Error(`Decision ${row.id} failed signature verification — payload row does not match its signed contract`);
  }

  const kind = row.kind as DecisionKind;
  const agent = await getAgentRow(db, row.storeId, row.agentId);

  if (args.action === "REJECT") {
    await db
      .update(schema.decisions)
      .set({ status: "REJECTED", decidedAt: now(), decidedSource: args.source })
      .where(eq(schema.decisions.id, row.id));

    await appendActivityEvent(db, {
      storeId: row.storeId,
      agentId: row.agentId,
      agentName: agent.name,
      agentAvatar: agent.avatar,
      message: `Decision ${row.id} rejected via ${args.source}.`,
      type: "DECISION_REJECTED",
      severity: "INFO",
      decisionId: row.id,
      decisionKind: kind,
    });

    const response: DecisionRejectResponse = {
      success: true,
      decision_id: row.id,
      decision_kind: kind,
      status: "REJECTED",
    };
    return { ok: true, response };
  }

  const executor = executors.get(kind);
  if (!executor) throw new Error(`No executor registered for decision kind ${kind}`);

  const execResult = await executor({
    db,
    decisionId: row.id,
    storeId: row.storeId,
    agentId: row.agentId,
    payload: row.payload as Record<string, unknown>,
  });

  await db
    .update(schema.decisions)
    .set({ status: "EXECUTED", result: execResult.result, decidedAt: now(), decidedSource: args.source })
    .where(eq(schema.decisions.id, row.id));

  await appendActivityEvent(db, {
    storeId: row.storeId,
    agentId: row.agentId,
    agentName: agent.name,
    agentAvatar: agent.avatar,
    message: `Decision ${row.id} executed via ${args.source}.`,
    type: "ACTION_EXECUTED",
    severity: "SUCCESS",
    decisionId: row.id,
    decisionKind: kind,
  });

  if (execResult.soundboxTriggered && execResult.soundboxAnnouncement) {
    await appendActivityEvent(db, {
      storeId: row.storeId,
      agentId: row.agentId,
      agentName: "Soundbox",
      agentAvatar: "🔊",
      message: execResult.soundboxAnnouncement,
      type: "SOUNDBOX_ANNOUNCED",
      severity: "SUCCESS",
    });
  }

  const response = {
    success: true,
    decision_id: row.id,
    decision_kind: kind,
    status: "EXECUTED",
    result: execResult.result,
    soundbox_triggered: execResult.soundboxTriggered,
    ...(execResult.soundboxAnnouncement ? { soundbox_announcement: execResult.soundboxAnnouncement } : {}),
  } as DecisionActionResponse;

  return { ok: true, response };
}
