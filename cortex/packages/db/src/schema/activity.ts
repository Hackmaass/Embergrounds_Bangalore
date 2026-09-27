import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const activityEvents = pgTable("activity_events", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  agentId: text("agent_id").notNull(),
  agentName: text("agent_name").notNull(),
  agentAvatar: text("agent_avatar").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(),
  severity: text("severity").notNull(),
  decisionId: text("decision_id"),
  decisionKind: text("decision_kind"),
  buttons: jsonb("buttons"),
  timestampLabel: text("timestamp_label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ACTIVITY_DDL = `
CREATE TABLE IF NOT EXISTS activity_events (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  agent_avatar TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  decision_id TEXT,
  decision_kind TEXT,
  buttons JSONB,
  timestamp_label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;
