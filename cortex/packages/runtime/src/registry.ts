import { eq, and } from "drizzle-orm";
import type { CortexDb } from "@cortex/db";
import { schema } from "@cortex/db";
import type {
  AgentStatus,
  AgentSummary,
  ChannelStatus,
  SoundboxStatus,
  Store,
  WorkforceResponse,
} from "@cortex/shared";

export async function getStore(db: CortexDb, storeId: string): Promise<Store> {
  const [row] = await db.select().from(schema.stores).where(eq(schema.stores.id, storeId));
  if (!row) throw new Error(`Store not found: ${storeId}`);
  return {
    id: row.id,
    name: row.name,
    gstin: row.gstin,
    soundbox: {
      status: row.soundboxStatus as SoundboxStatus,
      battery: row.soundboxBattery,
      edge_override: row.soundboxEdgeOverride,
    },
    channels: {
      whatsapp: row.whatsappStatus as ChannelStatus,
      telegram: row.telegramStatus as ChannelStatus,
    },
  };
}

// Fixed roster order (AGENTS.md §5.1 / FRONTEND_SPEC §2 "6-slot grid").
// Postgres gives no ordering guarantee on plain SELECTs, and UPDATEs can
// shuffle physical row order — without this the roster cards visibly
// reorder mid-demo every time an agent's metric changes.
const CORE_AGENT_ORDER = ["priya-sales", "aman-support", "vikram-procurement", "munim-accounts", "meera-staff"];

export async function listAgents(db: CortexDb, storeId: string): Promise<AgentSummary[]> {
  const rows = await db.select().from(schema.agents).where(eq(schema.agents.storeId, storeId));
  rows.sort((a, b) => {
    const ai = CORE_AGENT_ORDER.indexOf(a.id);
    const bi = CORE_AGENT_ORDER.indexOf(b.id);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  return rows.map(
    (r): AgentSummary => ({
      id: r.id,
      name: r.name,
      role: r.role,
      avatar: r.avatar,
      status: r.status as AgentStatus,
      metric_label: r.metricLabel,
      metric_value: r.metricValue,
      is_custom: r.isCustom,
    }),
  );
}

export async function getWorkforce(db: CortexDb, storeId: string): Promise<WorkforceResponse> {
  const [store, agents] = await Promise.all([getStore(db, storeId), listAgents(db, storeId)]);
  return { store, agents };
}

export async function getAgentRow(db: CortexDb, storeId: string, agentId: string) {
  const [row] = await db
    .select()
    .from(schema.agents)
    .where(and(eq(schema.agents.storeId, storeId), eq(schema.agents.id, agentId)));
  if (!row) throw new Error(`Agent not found: ${agentId}`);
  return row;
}

export async function setAgentStatus(
  db: CortexDb,
  storeId: string,
  agentId: string,
  status: AgentStatus,
): Promise<void> {
  await db
    .update(schema.agents)
    .set({ status })
    .where(and(eq(schema.agents.storeId, storeId), eq(schema.agents.id, agentId)));
}

/** Adds `deltaRupees` to whatever ₹ figure is already in the agent's
 * metric_value (e.g. "₹14,800 (Wk)" + 3200 -> "₹18,000 (Wk)") instead of
 * clobbering the running total — a metric that visibly drops every time
 * the AI succeeds would read as a bug during the demo. */
export async function bumpRupeeMetric(
  db: CortexDb,
  storeId: string,
  agentId: string,
  metricLabel: string,
  deltaRupees: number,
  suffix: string,
): Promise<void> {
  const row = await getAgentRow(db, storeId, agentId);
  const current = Number(row.metricValue.replace(/[^\d.]/g, "")) || 0;
  const next = current + deltaRupees;
  await setAgentMetric(db, storeId, agentId, metricLabel, `₹${next.toLocaleString("en-IN")} ${suffix}`.trim());
}

export async function setAgentMetric(
  db: CortexDb,
  storeId: string,
  agentId: string,
  metricLabel: string,
  metricValue: string,
): Promise<void> {
  await db
    .update(schema.agents)
    .set({ metricLabel, metricValue })
    .where(and(eq(schema.agents.storeId, storeId), eq(schema.agents.id, agentId)));
}
