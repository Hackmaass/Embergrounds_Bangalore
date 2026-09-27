import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Immutable, HMAC-signed decision contracts. `payload` freezes the spec at
// stage time (amounts, targets, coupon codes, quote selection, etc).
export const decisions = pgTable("decisions", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  agentId: text("agent_id").notNull(),
  kind: text("kind").notNull(),
  status: text("status").notNull().default("AWAITING_APPROVAL"),
  payload: jsonb("payload").notNull(),
  result: jsonb("result"),
  signature: text("signature").notNull(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  decidedSource: text("decided_source"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const DECISIONS_DDL = `
CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'AWAITING_APPROVAL',
  payload JSONB NOT NULL,
  result JSONB,
  signature TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  decided_at TIMESTAMPTZ,
  decided_source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;
