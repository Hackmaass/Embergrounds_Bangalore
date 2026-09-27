import { z } from "zod";
import { DecisionActionEnum, DecisionKindEnum, EventTypeEnum, SeverityEnum } from "./enums.js";

export const DecisionButtonSchema = z.object({
  action: DecisionActionEnum,
  label: z.string(),
});
export type DecisionButton = z.infer<typeof DecisionButtonSchema>;

// AGENTS.md §5.2
export const ActivityEventSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  agent_id: z.string(),
  agent_name: z.string(),
  agent_avatar: z.string(),
  message: z.string(),
  type: EventTypeEnum,
  severity: SeverityEnum,
  decision_id: z.string().optional(),
  decision_kind: DecisionKindEnum.optional(),
  buttons: z.array(DecisionButtonSchema).optional(),
});
export type ActivityEvent = z.infer<typeof ActivityEventSchema>;

export const StreamSnapshotSchema = z.array(ActivityEventSchema);
export type StreamSnapshot = z.infer<typeof StreamSnapshotSchema>;
