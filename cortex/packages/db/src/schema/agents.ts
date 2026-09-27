import { boolean, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const agents = pgTable("agents", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  avatar: text("avatar").notNull(),
  status: text("status").notNull(),
  metricLabel: text("metric_label").notNull(),
  metricValue: text("metric_value").notNull(),
  isCustom: boolean("is_custom").notNull().default(false),
  spec: jsonb("spec"),
  maxMessagesPerDay: integer("max_messages_per_day").notNull().default(50),
  restrictedHours: text("restricted_hours").notNull().default("20:00-08:00"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const AGENTS_DDL = `
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  avatar TEXT NOT NULL,
  status TEXT NOT NULL,
  metric_label TEXT NOT NULL,
  metric_value TEXT NOT NULL,
  is_custom BOOLEAN NOT NULL DEFAULT FALSE,
  spec JSONB,
  max_messages_per_day INTEGER NOT NULL DEFAULT 50,
  restricted_hours TEXT NOT NULL DEFAULT '20:00-08:00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

export const routines = pgTable("routines", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  agentId: text("agent_id").notNull(),
  label: text("label").notNull(),
  cronExpr: text("cron_expr").notNull(),
  status: text("status").notNull().default("SCHEDULED"),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
});

export const ROUTINES_DDL = `
CREATE TABLE IF NOT EXISTS routines (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  label TEXT NOT NULL,
  cron_expr TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SCHEDULED',
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ
);
`;
