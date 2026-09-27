import { z } from "zod";

// AGENTS.md §5.7
export const ReconciliationMismatchSchema = z.object({
  txn_id: z.string(),
  amount: z.number(),
  reason: z.string(),
  action: z.string(),
});
export type ReconciliationMismatch = z.infer<typeof ReconciliationMismatchSchema>;

export const Gstr1DraftSchema = z.object({
  period: z.string(),
  taxable_value: z.number(),
  tax: z.number(),
  export_url: z.string(),
});
export type Gstr1Draft = z.infer<typeof Gstr1DraftSchema>;

export const ReconciliationResponseSchema = z.object({
  date: z.string(),
  pos_sales_total: z.number(),
  pg_settled_total: z.number(),
  cash_total: z.number(),
  mismatches: z.array(ReconciliationMismatchSchema),
  gstr1_draft: Gstr1DraftSchema,
});
export type ReconciliationResponse = z.infer<typeof ReconciliationResponseSchema>;
