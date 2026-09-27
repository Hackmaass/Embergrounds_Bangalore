import { useMemo } from "react";
import type { ActivityEvent } from "@cortex/shared";

export interface PendingDecision {
  decision_id: string;
  decision_kind: NonNullable<ActivityEvent["decision_kind"]>;
  message: string;
  agent_name: string;
  agent_avatar: string;
  buttons: NonNullable<ActivityEvent["buttons"]>;
  staged_at: string;
}

/** Derives "still awaiting approval" decisions from the activity stream:
 * every DECISION_STAGED whose decision_id has no later terminal event
 * (ACTION_EXECUTED / DECISION_REJECTED) in the same stream. */
export function usePendingDecisions(events: ActivityEvent[]): PendingDecision[] {
  return useMemo(() => {
    const decided = new Set(
      events.filter((e) => e.type === "ACTION_EXECUTED" || e.type === "DECISION_REJECTED").map((e) => e.decision_id),
    );
    return events
      .filter((e) => e.type === "DECISION_STAGED" && e.decision_id && !decided.has(e.decision_id))
      .map(
        (e): PendingDecision => ({
          decision_id: e.decision_id!,
          decision_kind: e.decision_kind!,
          message: e.message,
          agent_name: e.agent_name,
          agent_avatar: e.agent_avatar,
          buttons: e.buttons ?? [],
          staged_at: e.timestamp,
        }),
      );
  }, [events]);
}
