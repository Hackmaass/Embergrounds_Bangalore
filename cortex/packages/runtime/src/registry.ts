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

export async function listAgents(db: CortexDb, storeId: string): Promise<AgentSummary[]> {
  const rows = await db.select().from(schema.agents).where(eq(schema.agents.storeId, storeId));
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
