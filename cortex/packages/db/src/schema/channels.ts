import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Binds a chat identity (WhatsApp/Telegram) to a role in the store.
export const channelBindings = pgTable("channel_bindings", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  channel: text("channel").notNull(), // WHATSAPP | TELEGRAM
  role: text("role").notNull(), // OWNER | STAFF | SUPPLIER | CUSTOMER
  identityId: text("identity_id").notNull(), // internal id: worker_id, customer_id, supplier id
  externalId: text("external_id").notNull(), // phone number or chat id
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const CHANNEL_BINDINGS_DDL = `
CREATE TABLE IF NOT EXISTS channel_bindings (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  role TEXT NOT NULL,
  identity_id TEXT NOT NULL,
  external_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;
