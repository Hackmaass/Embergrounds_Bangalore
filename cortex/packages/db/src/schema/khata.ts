import { doublePrecision, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Append-only ledger. Balance per customer = sum(CREDIT) - sum(PAYMENT).
export const khataEntries = pgTable("khata_entries", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  customerId: text("customer_id").notNull(),
  type: text("type").notNull(), // CREDIT | PAYMENT
  amount: doublePrecision("amount").notNull(),
  note: text("note"),
  status: text("status").notNull().default("OPEN"), // OPEN | REMINDER_DRAFTED | REMINDED | PAID
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const KHATA_ENTRIES_DDL = `
CREATE TABLE IF NOT EXISTS khata_entries (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  type TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;
