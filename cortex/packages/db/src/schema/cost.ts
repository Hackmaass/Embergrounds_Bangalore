import { doublePrecision, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const costEvents = pgTable("cost_events", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  agentId: text("agent_id").notNull(),
  kind: text("kind").notNull(), // LLM_TOKENS | WHATSAPP_MESSAGE
  amount: doublePrecision("amount").notNull(), // in ₹
  units: doublePrecision("units").notNull(), // tokens or message count
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const COST_EVENTS_DDL = `
CREATE TABLE IF NOT EXISTS cost_events (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  units DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;
