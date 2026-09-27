import { z } from "zod";
import { AgentStatusEnum, ChannelStatusEnum, SoundboxStatusEnum } from "./enums.js";

export const SoundboxInfoSchema = z.object({
  status: SoundboxStatusEnum,
  battery: z.number().int().min(0).max(100),
  edge_override: z.boolean(),
});
export type SoundboxInfo = z.infer<typeof SoundboxInfoSchema>;

export const StoreChannelsSchema = z.object({
  whatsapp: ChannelStatusEnum,
  telegram: ChannelStatusEnum,
});
export type StoreChannels = z.infer<typeof StoreChannelsSchema>;

export const StoreSchema = z.object({
  id: z.string(),
  name: z.string(),
  gstin: z.string(),
  soundbox: SoundboxInfoSchema,
  channels: StoreChannelsSchema,
});
export type Store = z.infer<typeof StoreSchema>;

export const AgentSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  avatar: z.string(),
  status: AgentStatusEnum,
  metric_label: z.string(),
  metric_value: z.string(),
  is_custom: z.boolean(),
});
export type AgentSummary = z.infer<typeof AgentSummarySchema>;

export const WorkforceResponseSchema = z.object({
  store: StoreSchema,
  agents: z.array(AgentSummarySchema),
});
export type WorkforceResponse = z.infer<typeof WorkforceResponseSchema>;

export const AgentRunResponseSchema = z.object({
  run_id: z.string(),
  agent_id: z.string(),
  status: z.literal("STARTED"),
});
export type AgentRunResponse = z.infer<typeof AgentRunResponseSchema>;
