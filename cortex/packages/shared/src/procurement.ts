import { z } from "zod";
import { DecisionStatusEnum } from "./enums.js";

// AGENTS.md §5.9
export const SupplierQuoteSchema = z.object({
  supplier: z.string(),
  unit_price: z.number(),
  eta: z.string(),
  selected: z.boolean(),
});
export type SupplierQuote = z.infer<typeof SupplierQuoteSchema>;

export const PurchaseOrderSchema = z.object({
  po_id: z.string(),
  decision_id: z.string(),
  sku: z.string(),
  qty: z.number(),
  status: DecisionStatusEnum,
  quotes: z.array(SupplierQuoteSchema),
  total: z.number(),
  last_price: z.number(),
  guardrail: z.string(),
});
export type PurchaseOrder = z.infer<typeof PurchaseOrderSchema>;

export const PurchaseOrdersResponseSchema = z.array(PurchaseOrderSchema);
export type PurchaseOrdersResponse = z.infer<typeof PurchaseOrdersResponseSchema>;
