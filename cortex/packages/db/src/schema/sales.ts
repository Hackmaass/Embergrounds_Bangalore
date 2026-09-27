import { doublePrecision, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Hourly sales buckets, used for dip detection vs 30-day baseline.
export const sales = pgTable("sales", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  sku: text("sku").notNull(),
  qty: integer("qty").notNull(),
  amount: doublePrecision("amount").notNull(),
  hourBucket: timestamp("hour_bucket", { withTimezone: true }).notNull(),
});

export const SALES_DDL = `
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  qty INTEGER NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  hour_bucket TIMESTAMPTZ NOT NULL
);
`;

export const customers = pgTable("customers", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  isRegular: integer("is_regular").notNull().default(0), // 1 = repeat/regular customer
});

export const CUSTOMERS_DDL = `
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  is_regular INTEGER NOT NULL DEFAULT 0
);
`;

export const inventory = pgTable("inventory", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  sku: text("sku").notNull(),
  unit: text("unit").notNull(),
  qtyOnHand: doublePrecision("qty_on_hand").notNull(),
  dailyVelocity: doublePrecision("daily_velocity").notNull().default(0),
  reorderLevel: doublePrecision("reorder_level").notNull().default(0),
  lastPrice: doublePrecision("last_price").notNull().default(0),
  grossMarginPct: doublePrecision("gross_margin_pct").notNull().default(0),
  outOfStockAt: timestamp("out_of_stock_at", { withTimezone: true }),
  restockedAt: timestamp("restocked_at", { withTimezone: true }),
});

export const INVENTORY_DDL = `
CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  unit TEXT NOT NULL,
  qty_on_hand DOUBLE PRECISION NOT NULL,
  daily_velocity DOUBLE PRECISION NOT NULL DEFAULT 0,
  reorder_level DOUBLE PRECISION NOT NULL DEFAULT 0,
  last_price DOUBLE PRECISION NOT NULL DEFAULT 0,
  gross_margin_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
  out_of_stock_at TIMESTAMPTZ,
  restocked_at TIMESTAMPTZ
);
`;
