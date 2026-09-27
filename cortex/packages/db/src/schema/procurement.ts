import { doublePrecision, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const suppliers = pgTable("suppliers", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
});

export const SUPPLIERS_DDL = `
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL
);
`;

export const purchaseOrders = pgTable("purchase_orders", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  decisionId: text("decision_id").notNull(),
  sku: text("sku").notNull(),
  qty: doublePrecision("qty").notNull(),
  status: text("status").notNull().default("AWAITING_APPROVAL"),
  quotes: jsonb("quotes").notNull(), // SupplierQuote[]
  total: doublePrecision("total").notNull(),
  lastPrice: doublePrecision("last_price").notNull(),
  guardrailNote: text("guardrail_note").notNull(),
  supplierId: text("supplier_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const PURCHASE_ORDERS_DDL = `
CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  decision_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  qty DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL DEFAULT 'AWAITING_APPROVAL',
  quotes JSONB NOT NULL,
  total DOUBLE PRECISION NOT NULL,
  last_price DOUBLE PRECISION NOT NULL,
  guardrail_note TEXT NOT NULL,
  supplier_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;
