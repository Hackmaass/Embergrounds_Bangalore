import { z } from "zod";
import { KhataEntryStatusEnum, KhataTxnTypeEnum } from "./enums.js";

// AGENTS.md §5.6
export const KhataEntrySchema = z.object({
  customer_id: z.string(),
  name: z.string(),
  phone: z.string(),
  balance: z.number(),
  oldest_due_days: z.number().int(),
  status: KhataEntryStatusEnum,
});
export type KhataEntry = z.infer<typeof KhataEntrySchema>;

export const KhataResponseSchema = z.object({
  total_outstanding: z.number(),
  entries: z.array(KhataEntrySchema),
});
export type KhataResponse = z.infer<typeof KhataResponseSchema>;

export const KhataPostBodySchema = z.object({
  customer_id: z.string(),
  type: KhataTxnTypeEnum,
  amount: z.number().positive(),
  note: z.string().optional(),
});
export type KhataPostBody = z.infer<typeof KhataPostBodySchema>;
