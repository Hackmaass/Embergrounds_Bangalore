import { EventEmitter } from "node:events";
import { eq, desc } from "drizzle-orm";
import type { CortexDb } from "@cortex/db";
import { schema } from "@cortex/db";
import type { ActivityEvent, DecisionButton, DecisionKind, EventType, Severity } from "@cortex/shared";
import { makeId } from "./ids.js";
import { now, timeLabel } from "./clock.js";

/** Process-wide bus the SSE route subscribes to. One "activity" event per append. */
export const activityBus = new EventEmitter();
activityBus.setMaxListeners(100);

export interface AppendActivityInput {
  storeId: string;
  agentId: string;
  agentName: string;
  agentAvatar: string;
  message: string;
  type: EventType;
  severity: Severity;
  decisionId?: string;
  decisionKind?: DecisionKind;
  buttons?: DecisionButton[];
}

export async function appendActivityEvent(
  db: CortexDb,
  input: AppendActivityInput,
): Promise<ActivityEvent> {
  const id = makeId("evt");
  const createdAt = now();
  const timestampLabel = timeLabel(createdAt);

  await db.insert(schema.activityEvents).values({
    id,
    storeId: input.storeId,
    agentId: input.agentId,
    agentName: input.agentName,
    agentAvatar: input.agentAvatar,
    message: input.message,
    type: input.type,
    severity: input.severity,
    decisionId: input.decisionId,
    decisionKind: input.decisionKind,
    buttons: input.buttons,
    timestampLabel,
    createdAt,
  });

  const event: ActivityEvent = {
    id,
    timestamp: timestampLabel,
    agent_id: input.agentId,
    agent_name: input.agentName,
    agent_avatar: input.agentAvatar,
    message: input.message,
    type: input.type,
    severity: input.severity,
    ...(input.decisionId ? { decision_id: input.decisionId } : {}),
    ...(input.decisionKind ? { decision_kind: input.decisionKind } : {}),
    ...(input.buttons ? { buttons: input.buttons } : {}),
  };

  activityBus.emit("activity", event);
  return event;
}

export async function getActivitySnapshot(
  db: CortexDb,
  storeId: string,
  limit = 100,
): Promise<ActivityEvent[]> {
  const rows = await db
    .select()
    .from(schema.activityEvents)
    .where(eq(schema.activityEvents.storeId, storeId))
    .orderBy(desc(schema.activityEvents.createdAt))
    .limit(limit);

  return rows
    .map(
      (r): ActivityEvent => ({
        id: r.id,
        timestamp: r.timestampLabel,
        agent_id: r.agentId,
        agent_name: r.agentName,
        agent_avatar: r.agentAvatar,
        message: r.message,
        type: r.type as EventType,
        severity: r.severity as Severity,
        ...(r.decisionId ? { decision_id: r.decisionId } : {}),
        ...(r.decisionKind ? { decision_kind: r.decisionKind as DecisionKind } : {}),
        ...(r.buttons ? { buttons: r.buttons as DecisionButton[] } : {}),
      }),
    )
    .reverse(); // oldest-first, matching AGENTS.md §5.2 example ordering
}
