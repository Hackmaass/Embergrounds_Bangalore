import { z } from "zod";
import { ComplianceStatusEnum } from "./enums.js";

// AGENTS.md §5.8
export const ComplianceItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  authority: z.string(),
  due_date: z.string(),
  days_left: z.number().int(),
  status: ComplianceStatusEnum,
});
export type ComplianceItem = z.infer<typeof ComplianceItemSchema>;

export const ComplianceCalendarResponseSchema = z.array(ComplianceItemSchema);
export type ComplianceCalendarResponse = z.infer<typeof ComplianceCalendarResponseSchema>;
