import { boolean, integer, pgTable, text } from "drizzle-orm/pg-core";

export const stores = pgTable("stores", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  gstin: text("gstin").notNull(),
  soundboxStatus: text("soundbox_status").notNull().default("ONLINE"),
  soundboxBattery: integer("soundbox_battery").notNull().default(100),
  soundboxEdgeOverride: boolean("soundbox_edge_override").notNull().default(true),
  whatsappStatus: text("whatsapp_status").notNull().default("SIMULATOR"),
  telegramStatus: text("telegram_status").notNull().default("SIMULATOR"),
});

export const STORE_DDL = `
CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  gstin TEXT NOT NULL,
  soundbox_status TEXT NOT NULL DEFAULT 'ONLINE',
  soundbox_battery INTEGER NOT NULL DEFAULT 100,
  soundbox_edge_override BOOLEAN NOT NULL DEFAULT TRUE,
  whatsapp_status TEXT NOT NULL DEFAULT 'SIMULATOR',
  telegram_status TEXT NOT NULL DEFAULT 'SIMULATOR'
);
`;
