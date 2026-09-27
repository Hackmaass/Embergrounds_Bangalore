import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Task DAG: one row per run, optional parent for sub-steps.
export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  agentId: text("agent_id").notNull(),
  runId: text("run_id").notNull(),
  parentTaskId: text("parent_task_id"),
  label: text("label").notNull(),
  status: text("status").notNull().default("RUNNING"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const TASKS_DDL = `
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  parent_task_id TEXT,
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'RUNNING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;
