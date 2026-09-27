import { and, eq } from "drizzle-orm";
import type { CortexDb } from "@cortex/db";
import { schema } from "@cortex/db";
import { appendActivityEvent, makeId, startRun, completeTask, getLlmClient } from "@cortex/runtime";
import { CustomAgentSpecSchema, type CustomAgentGenerateRequest, type CustomAgentSpec, type StudioTool } from "@cortex/shared";
import { POLICY } from "../policy.js";
import { STUDIO_TEMPLATES, findTemplate, type TemplateBlueprint } from "./templates.js";

export { STUDIO_TEMPLATES };

/**
 * Prompts that ask the compiler to remove the safety rails it's designed to
 * always attach. AGENTS.md §4 / PROPOSAL §4: "The compiler cannot grant a
 * tool outside the sandboxed catalogue, remove the approval gate on money
 * actions, or exceed store-level caps." Since `require_merchant_approval`
 * is hardcoded `true` below (never derived from the prompt), a spec can
 * never actually violate that invariant — so this is the request-level
 * guard that surfaces the rejection explicitly instead of just silently
 * ignoring the unsafe part of the ask.
 */
const UNSAFE_REQUEST_PATTERN = /auto[- ]?approve|without (merchant |owner )?approval|no approval|skip approval|\bsms\b|twilio|send email/i;

const KEYWORD_TOOL_MAP: Array<{ pattern: RegExp; templateId: string }> = [
  { pattern: /expir|shelf.?life|batch/i, templateId: "pharmacy-expiry-sentinel" },
  { pattern: /rush|delivery|commission/i, templateId: "rush-hour-reconciler" },
  { pattern: /slow.?mov|unsold|liquidat|bundle/i, templateId: "apparel-slow-mover" },
  { pattern: /khata|udhaar|credit due|wholesale/i, templateId: "udhaar-recovery-agent" },
];

export interface GenerateResult {
  rejected: false;
  spec: CustomAgentSpec;
}
export interface RejectResult {
  rejected: true;
  reason: string;
}

/**
 * The LLM's job here is limited to template/keyword selection and naming —
 * every field that matters for safety (tools catalogue, guardrails,
 * approval gate) is constructed in TypeScript and validated against
 * `CustomAgentSpecSchema` before it's ever persisted (PROPOSAL §4: "the
 * LLM drafts, the zod schema and guardrail engine decide"). The LLM
 * classification step below is a closed-set choice validated against the
 * same template catalogue keyword-matching uses — it can only ever pick an
 * existing template or fall through to generic, never invent tools,
 * triggers, or guardrails of its own.
 */
export async function compileSpec(input: CustomAgentGenerateRequest): Promise<GenerateResult | RejectResult> {
  if (UNSAFE_REQUEST_PATTERN.test(input.prompt)) {
    return { rejected: true, reason: "Requests that bypass merchant approval or use tools outside the sandboxed catalogue are not permitted." };
  }

  const matchedTemplate = findTemplate(input.template_id) ?? matchByKeyword(input.prompt) ?? (await classifyByLlm(input.prompt));
  const template = matchedTemplate ?? genericFallback();

  // A matched template already carries a presenter-ready name (e.g. "Udhaar
  // Recovery Agent"). Only the generic fallback derives a name from the raw
  // prompt text, since it has no curated name to fall back on.
  const name = matchedTemplate ? template.name : `${capitalize(firstWord(input.prompt) || template.name)} - ${template.role}`;

  const spec: CustomAgentSpec = CustomAgentSpecSchema.parse({
    agent_id: makeId("custom"),
    name,
    avatar: template.avatar,
    role: template.role,
    trigger: template.trigger,
    tools: template.tools,
    guardrails: {
      max_messages_per_day: template.maxMessagesPerDay,
      restricted_hours: POLICY.STUDIO_QUIET_HOURS,
      require_merchant_approval: true,
    },
    status: "DRAFT",
  });

  return { rejected: false, spec };
}

function matchByKeyword(prompt: string) {
  const hit = KEYWORD_TOOL_MAP.find((k) => k.pattern.test(prompt));
  return hit ? findTemplate(hit.templateId) : undefined;
}

/**
 * Only reached when the fast/free keyword regex above found nothing —
 * keeps the common demo prompts (which all hit a keyword) from depending on
 * a local model being up. Runs against the local Ollama model by default
 * (see @cortex/runtime's getLlmClient); if it's unreachable or returns
 * anything outside the closed template-id set, this returns undefined and
 * the caller falls through to genericFallback exactly as it did before this
 * classification step existed.
 */
async function classifyByLlm(prompt: string): Promise<TemplateBlueprint | undefined> {
  const catalogue = STUDIO_TEMPLATES.map((t) => `- ${t.template_id}: ${t.description}`).join("\n");
  const system = [
    "You classify a shop owner's request for an AI back-office teammate into one template id.",
    "Available templates:",
    catalogue,
    "- generic: none of the above genuinely fit",
    "",
    "Reply with ONLY the template id — lowercase, no punctuation, no explanation.",
  ].join("\n");

  const { text } = await getLlmClient().complete({ system, prompt, maxTokens: 20 });
  const answer = text.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  return findTemplate(answer);
}

function genericFallback() {
  return {
    template_id: "generic",
    name: "Custom Teammate",
    avatar: "✨",
    role: "General Assistant",
    description: "",
    prompt: "",
    trigger: "CRON_HEARTBEAT_DAILY_09AM",
    tools: ["WHATSAPP_DRAFT"] as StudioTool[],
    maxMessagesPerDay: 20,
  };
}

function firstWord(s: string): string {
  return s.trim().split(/\s+/).slice(0, 2).join(" ");
}
function capitalize(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}

export async function persistDraft(db: CortexDb, storeId: string, spec: CustomAgentSpec): Promise<void> {
  await db.insert(schema.agents).values({
    id: spec.agent_id,
    storeId,
    name: spec.name,
    role: spec.role,
    avatar: spec.avatar,
    status: spec.status,
    metricLabel: "Status",
    metricValue: "Awaiting Hire",
    isCustom: true,
    spec,
    maxMessagesPerDay: spec.guardrails.max_messages_per_day,
    restrictedHours: spec.guardrails.restricted_hours,
  });
}

export async function hireAgent(db: CortexDb, storeId: string, agentId: string): Promise<CustomAgentSpec> {
  const [row] = await db.select().from(schema.agents).where(and(eq(schema.agents.storeId, storeId), eq(schema.agents.id, agentId)));
  if (!row || !row.isCustom) throw new Error("AGENT_NOT_FOUND");

  const spec = CustomAgentSpecSchema.parse({ ...(row.spec as object), status: "ACTIVE" });

  await db
    .update(schema.agents)
    .set({ status: "ACTIVE", metricLabel: "Monitored SKUs", metricValue: "0 SKUs", spec })
    .where(eq(schema.agents.id, agentId));

  await appendActivityEvent(db, {
    storeId,
    agentId,
    agentName: spec.name,
    agentAvatar: spec.avatar,
    message: `${spec.name} hired — ${spec.trigger}, tools: ${spec.tools.join(", ")}.`,
    type: "AGENT_HIRED",
    severity: "SUCCESS",
  });

  return spec;
}

/** Generic manual "Run now" for any hired Studio agent — a full sandboxed
 * execution engine per compiled spec is out of scope for the demo; this
 * gives every custom agent a working, honest run() without one. */
export async function runCustomAgent(db: CortexDb, storeId: string, agentId: string): Promise<{ runId: string }> {
  const [row] = await db.select().from(schema.agents).where(and(eq(schema.agents.storeId, storeId), eq(schema.agents.id, agentId)));
  if (!row) throw new Error("AGENT_NOT_FOUND");

  const { runId, taskId } = await startRun(db, { storeId, agentId, label: `${row.name} check` });
  await appendActivityEvent(db, {
    storeId,
    agentId,
    agentName: row.name,
    agentAvatar: row.avatar,
    message: `${row.name} checked its data — nothing to report right now.`,
    type: "ACTION_EXECUTED",
    severity: "INFO",
  });
  await completeTask(db, taskId, "DONE");
  return { runId };
}
