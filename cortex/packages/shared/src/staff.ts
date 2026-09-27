import { z } from "zod";
import { ActionSourceEnum, AttendanceActionEnum, AttendanceStatusEnum } from "./enums.js";

// AGENTS.md §5.10
export const WorkerSchema = z.object({
  worker_id: z.string(),
  name: z.string(),
  role: z.string(),
  check_in: z.string().nullable(),
  status: AttendanceStatusEnum,
  monthly_salary: z.number(),
  advance_balance: z.number(),
});
export type Worker = z.infer<typeof WorkerSchema>;

export const NextPaydaySchema = z.object({
  date: z.string(),
  decision_id: z.string().nullable(),
  estimated_total: z.number(),
});
export type NextPayday = z.infer<typeof NextPaydaySchema>;

export const StaffResponseSchema = z.object({
  date: z.string(),
  present: z.number().int(),
  total: z.number().int(),
  workers: z.array(WorkerSchema),
  next_payday: NextPaydaySchema,
});
export type StaffResponse = z.infer<typeof StaffResponseSchema>;

export const AttendancePostBodySchema = z.object({
  worker_id: z.string(),
  type: AttendanceActionEnum,
  source: ActionSourceEnum,
});
export type AttendancePostBody = z.infer<typeof AttendancePostBodySchema>;
