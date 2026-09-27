import { doublePrecision, integer, jsonb, pgTable, text } from "drizzle-orm/pg-core";

export const settlements = pgTable("settlements", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  posSalesTotal: doublePrecision("pos_sales_total").notNull(),
  pgSettledTotal: doublePrecision("pg_settled_total").notNull(),
  cashTotal: doublePrecision("cash_total").notNull(),
  mismatches: jsonb("mismatches").notNull(), // ReconciliationMismatch[]
});

export const SETTLEMENTS_DDL = `
CREATE TABLE IF NOT EXISTS settlements (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  date TEXT NOT NULL,
  pos_sales_total DOUBLE PRECISION NOT NULL,
  pg_settled_total DOUBLE PRECISION NOT NULL,
  cash_total DOUBLE PRECISION NOT NULL,
  mismatches JSONB NOT NULL
);
`;

export const complianceItems = pgTable("compliance_items", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  title: text("title").notNull(),
  authority: text("authority").notNull(),
  dueDate: text("due_date").notNull(), // YYYY-MM-DD
  status: text("status").notNull().default("UPCOMING"),
});

export const COMPLIANCE_ITEMS_DDL = `
CREATE TABLE IF NOT EXISTS compliance_items (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  title TEXT NOT NULL,
  authority TEXT NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'UPCOMING'
);
`;
