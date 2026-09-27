import { z } from "zod";

// AGENTS.md §5.5
export const ComplianceNextDueSchema = z.object({
  title: z.string(),
  due_date: z.string(),
  days_left: z.number().int(),
});
export type ComplianceNextDue = z.infer<typeof ComplianceNextDueSchema>;

export const MetricsResponseSchema = z.object({
  today_upi_total: z.number(),
  ai_attributed_revenue: z.number(),
  ai_attributed_percentage: z.number(),
  disputes_resolved_count: z.number().int(),
  disputes_resolved_amount: z.number(),
  udhaar_recovered_month: z.number(),
  hours_saved_week: z.number(),
  compliance_next_due: ComplianceNextDueSchema,
  campaigns_active: z.number().int(),
  vouchers_redeemed_today: z.number().int(),
});
export type MetricsResponse = z.infer<typeof MetricsResponseSchema>;
