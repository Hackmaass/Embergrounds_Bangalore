import { z } from "zod";
import { AgentStatusEnum } from "./enums.js";

// Sandboxed tool catalogue the Studio compiler may grant (AGENTS.md §4 / PROPOSAL §4)
export const STUDIO_TOOLS = [
  "WHATSAPP_DRAFT",
  "PAYTM_UPI_LINK_GENERATOR",
  "POS_STOCK_READ",
  "KHATA_READ",
  "SUPPLIER_RFQ",
] as const;
export const StudioToolEnum = z.enum(STUDIO_TOOLS);
export type StudioTool = z.infer<typeof StudioToolEnum>;

// AGENTS.md §5.4 generate request
export const CustomAgentGenerateRequestSchema = z.object({
  prompt: z.string().min(1),
  template_id: z.string().nullable(),
});
export type CustomAgentGenerateRequest = z.infer<typeof CustomAgentGenerateRequestSchema>;

export const CustomAgentGuardrailsSchema = z.object({
  max_messages_per_day: z.number().int().positive(),
  restricted_hours: z.string(),
  require_merchant_approval: z.literal(true),
});
export type CustomAgentGuardrails = z.infer<typeof CustomAgentGuardrailsSchema>;

// AGENTS.md §5.4 generate response (status DRAFT until hired)
export const CustomAgentSpecSchema = z.object({
  agent_id: z.string(),
  name: z.string(),
  avatar: z.string(),
  role: z.string(),
  trigger: z.string(),
  tools: z.array(StudioToolEnum),
  guardrails: CustomAgentGuardrailsSchema,
  status: AgentStatusEnum,
});
export type CustomAgentSpec = z.infer<typeof CustomAgentSpecSchema>;

export const StudioTemplateSchema = z.object({
  template_id: z.string(),
  name: z.string(),
  avatar: z.string(),
  description: z.string(),
  prompt: z.string(),
});
export type StudioTemplate = z.infer<typeof StudioTemplateSchema>;
