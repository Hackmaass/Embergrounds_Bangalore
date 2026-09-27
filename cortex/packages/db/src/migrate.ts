import { sql } from "drizzle-orm";
import type { CortexDb } from "./client.js";
import { STORE_DDL } from "./schema/store.js";
import { AGENTS_DDL, ROUTINES_DDL } from "./schema/agents.js";
import { TASKS_DDL } from "./schema/tasks.js";
import { DECISIONS_DDL } from "./schema/decisions.js";
import { ACTIVITY_DDL } from "./schema/activity.js";
import { COST_EVENTS_DDL } from "./schema/cost.js";
import { CHANNEL_BINDINGS_DDL } from "./schema/channels.js";
import { SALES_DDL, CUSTOMERS_DDL, INVENTORY_DDL } from "./schema/sales.js";
import { SUPPLIERS_DDL, PURCHASE_ORDERS_DDL } from "./schema/procurement.js";
import { KHATA_ENTRIES_DDL } from "./schema/khata.js";
import { SETTLEMENTS_DDL, COMPLIANCE_ITEMS_DDL } from "./schema/accounts.js";
import { STAFF_DDL, ATTENDANCE_DDL, PAYROLL_DDL } from "./schema/staff.js";

// Idempotent DDL executed once at boot — no migration history. Order
// respects FK-shaped dependencies even though we don't declare real FKs
// (a demo store is reset wholesale, not migrated incrementally).
const DDL_IN_ORDER = [
  STORE_DDL,
  AGENTS_DDL,
  ROUTINES_DDL,
  TASKS_DDL,
  DECISIONS_DDL,
  ACTIVITY_DDL,
  COST_EVENTS_DDL,
  CHANNEL_BINDINGS_DDL,
  CUSTOMERS_DDL,
  SALES_DDL,
  INVENTORY_DDL,
  SUPPLIERS_DDL,
  PURCHASE_ORDERS_DDL,
  KHATA_ENTRIES_DDL,
  SETTLEMENTS_DDL,
  COMPLIANCE_ITEMS_DDL,
  STAFF_DDL,
  ATTENDANCE_DDL,
  PAYROLL_DDL,
];

export async function runMigrations(db: CortexDb): Promise<void> {
  for (const ddl of DDL_IN_ORDER) {
    await db.execute(sql.raw(ddl));
  }
}
