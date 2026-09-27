import { doublePrecision, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// One row per auto-cleared UPI dispute (Aman's SUCCESS + Soundbox-lag
// override path) — backs the /metrics disputes_resolved_* fields.
export const disputeResolutions = pgTable("dispute_resolutions", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  txnId: text("txn_id").notNull(),
  amount: doublePrecision("amount").notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }).notNull().defaultNow(),
});

export const DISPUTE_RESOLUTIONS_DDL = `
CREATE TABLE IF NOT EXISTS dispute_resolutions (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  txn_id TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;
