import { z } from "zod";
import { ActionSourceEnum, DecisionActionEnum, DecisionKindEnum, DecisionStatusEnum } from "./enums.js";

// AGENTS.md §5.3 request
export const DecisionActionRequestSchema = z.object({
  action: DecisionActionEnum,
  source: ActionSourceEnum,
});
export type DecisionActionRequest = z.infer<typeof DecisionActionRequestSchema>;

export const VoucherCampaignResultSchema = z.object({
  dispatched_vouchers: z.number().int(),
  attributed_projected_revenue: z.number(),
});

export const PurchaseOrderResultSchema = z.object({
  po_id: z.string(),
  supplier: z.string(),
  total: z.number(),
});

export const PayrollPayoutResultSchema = z.object({
  workers_paid: z.number().int(),
  total_paid: z.number(),
});

export const KhataReminderBatchResultSchema = z.object({
  reminders_sent: z.number().int(),
  amount_outstanding: z.number(),
});

// AGENTS.md §5.3 response — result shape discriminated by decision_kind
export const DecisionActionResponseSchema = z.discriminatedUnion("decision_kind", [
  z.object({
    success: z.boolean(),
    decision_id: z.string(),
    decision_kind: z.literal("VOUCHER_CAMPAIGN"),
    status: DecisionStatusEnum,
    result: VoucherCampaignResultSchema,
    soundbox_triggered: z.boolean(),
    soundbox_announcement: z.string().optional(),
  }),
  z.object({
    success: z.boolean(),
    decision_id: z.string(),
    decision_kind: z.literal("PURCHASE_ORDER"),
    status: DecisionStatusEnum,
    result: PurchaseOrderResultSchema,
    soundbox_triggered: z.boolean(),
    soundbox_announcement: z.string().optional(),
  }),
  z.object({
    success: z.boolean(),
    decision_id: z.string(),
    decision_kind: z.literal("PAYROLL_PAYOUT"),
    status: DecisionStatusEnum,
    result: PayrollPayoutResultSchema,
    soundbox_triggered: z.boolean(),
    soundbox_announcement: z.string().optional(),
  }),
  z.object({
    success: z.boolean(),
    decision_id: z.string(),
    decision_kind: z.literal("KHATA_REMINDER_BATCH"),
    status: DecisionStatusEnum,
    result: KhataReminderBatchResultSchema,
    soundbox_triggered: z.boolean(),
    soundbox_announcement: z.string().optional(),
  }),
]);
export type DecisionActionResponse = z.infer<typeof DecisionActionResponseSchema>;

// Reject response — no `result`/soundbox fields since nothing executed.
export const DecisionRejectResponseSchema = z.object({
  success: z.literal(true),
  decision_id: z.string(),
  decision_kind: DecisionKindEnum,
  status: z.literal("REJECTED"),
});
export type DecisionRejectResponse = z.infer<typeof DecisionRejectResponseSchema>;

// Error body returned on 409 (repeat action) or 422 (guardrail blocked)
export const DecisionErrorResponseSchema = z.object({
  success: z.literal(false),
  decision_id: z.string(),
  error: z.string(),
  status: DecisionStatusEnum,
});
export type DecisionErrorResponse = z.infer<typeof DecisionErrorResponseSchema>;

export { DecisionKindEnum };
