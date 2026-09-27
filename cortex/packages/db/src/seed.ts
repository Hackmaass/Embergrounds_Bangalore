import { randomUUID } from "node:crypto";
import { generateBaselineWithDip, paytmPgMock, mockUtr } from "@cortex/connectors";
import type { CortexDb } from "./client.js";
import { schema } from "./client.js";

export const DEMO_STORE_ID = "store-ramesh";

function id(prefix: string): string {
  return `${prefix}-${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

/** Deletes every row for the demo store — used by POST /api/demo/reset
 * before reseeding, so the wire format never depends on `TRUNCATE`
 * semantics that might differ between real Postgres and PGlite. */
export async function clearDemoStore(db: CortexDb, storeId = DEMO_STORE_ID): Promise<void> {
  const { eq } = await import("drizzle-orm");
  await db.delete(schema.stores).where(eq(schema.stores.id, storeId));

  const tables = [
    schema.agents,
    schema.routines,
    schema.tasks,
    schema.decisions,
    schema.activityEvents,
    schema.costEvents,
    schema.channelBindings,
    schema.customers,
    schema.sales,
    schema.inventory,
    schema.suppliers,
    schema.purchaseOrders,
    schema.khataEntries,
    schema.settlements,
    schema.complianceItems,
    schema.staff,
    schema.attendance,
    schema.payroll,
    schema.disputeResolutions,
  ];
  for (const table of tables) {
    await db.delete(table).where(eq(table.storeId, storeId));
  }
  paytmPgMock.reset();
}

export async function seedDemoStore(db: CortexDb, storeId = DEMO_STORE_ID): Promise<void> {
  // WhatsApp's real status comes from Baileys' live link state at request
  // time (apps/server overlays it onto GET /workforce — see
  // getWhatsAppLinkStatus in @cortex/channels), not from this seeded value,
  // since a QR-linked session can connect/disconnect independently of boot.
  const whatsappStatus = "SIMULATOR";
  const telegramStatus = process.env.TELEGRAM_BOT_TOKEN ? "CONNECTED" : "SIMULATOR";

  await db.insert(schema.stores).values({
    id: storeId,
    name: "Ramesh Sweets & Restaurant",
    gstin: "07AAAAA0000A1Z5",
    soundboxStatus: "ONLINE",
    soundboxBattery: 88,
    soundboxEdgeOverride: true,
    whatsappStatus,
    telegramStatus,
  });

  await db.insert(schema.agents).values([
    { id: "priya-sales", storeId, name: "Priya", role: "Sales & Win-back", avatar: "🎯", status: "MONITORING", metricLabel: "Recovered Revenue", metricValue: "₹14,800 (Wk)", isCustom: false },
    { id: "aman-support", storeId, name: "Aman", role: "Customer Support & UPI Disputes", avatar: "🛡️", status: "READY", metricLabel: "Disputes Resolved", metricValue: "18 UPI Holds", isCustom: false },
    { id: "vikram-procurement", storeId, name: "Vikram", role: "Stock & Procurement", avatar: "📦", status: "PO_PENDING", metricLabel: "Low Stock SKUs", metricValue: "2 SKUs", isCustom: false },
    { id: "munim-accounts", storeId, name: "Munim", role: "Accounts, Khata & GST", avatar: "📒", status: "RECONCILED", metricLabel: "Udhaar Recovered", metricValue: "₹9,200 (Mo)", isCustom: false },
    { id: "meera-staff", storeId, name: "Meera", role: "Staff & Payroll Desk", avatar: "👷", status: "ACTIVE", metricLabel: "Present Today", metricValue: "5 / 6 Staff", isCustom: false },
    { id: "custom-expiry", storeId, name: "Expiry Sentinel", role: "Batch Shelf-Life Auditor", avatar: "💊", status: "ACTIVE", metricLabel: "Monitored SKUs", metricValue: "420 SKUs", isCustom: true },
  ]);

  // --- Sales baseline + yesterday's evening dip (Priya) ---
  const buckets = generateBaselineWithDip({
    baselineHourlyAmount: 4210,
    dipHours: [18, 19, 20],
    dipFactor: 0.62,
    days: 30,
  });
  await db.insert(schema.sales).values(
    buckets.map((b) => ({
      id: id("sale"),
      storeId,
      sku: "MIXED",
      qty: b.qty,
      amount: b.amount,
      hourBucket: b.hourBucket,
    })),
  );

  // --- Inventory: Butter Paneer stockout that caused the dip ---
  const stockoutAt = new Date();
  stockoutAt.setUTCDate(stockoutAt.getUTCDate() - 1);
  stockoutAt.setUTCHours(12, 15, 0, 0); // 17:45 IST (UTC+5:30)
  const restockedAt = new Date();
  restockedAt.setUTCHours(7, 0, 0, 0);

  await db.insert(schema.inventory).values([
    {
      id: id("inv"),
      storeId,
      sku: "Butter Paneer",
      unit: "kg",
      qtyOnHand: 11,
      dailyVelocity: 12,
      reorderLevel: 15,
      lastPrice: 305,
      grossMarginPct: 45,
      outOfStockAt: stockoutAt,
      restockedAt,
    },
    // Deliberately below cover but priced so the reorder total (40 tins *
    // ~₹310 ≈ ₹12,400) breaches PROCUREMENT_TOTAL_CAP (₹10,000) — exercises
    // Vikram's GUARDRAIL_BLOCKED path with a realistic "large order needs
    // review" scenario, not contorted data. Left with no outOfStockAt so
    // Priya's root-cause lookup still resolves to Butter Paneer.
    {
      id: id("inv"),
      storeId,
      sku: "Ghee (tin)",
      unit: "tin",
      qtyOnHand: 2,
      dailyVelocity: 40,
      reorderLevel: 50,
      lastPrice: 305,
      grossMarginPct: 20,
      outOfStockAt: null,
      restockedAt: null,
    },
  ]);

  // --- Customers: 28 regulars for Priya's cohort + 3 khata debtors ---
  const regulars = Array.from({ length: 28 }, (_, i) => ({
    id: id("cus"),
    storeId,
    name: `Regular Customer ${i + 1}`,
    phone: `+91 90000${String(10000 + i).slice(-5)}`,
    isRegular: 1,
  }));

  const khataCustomers = [
    { id: "cus-17", name: "Gupta Caterers", phone: "+91 98xxxxxx21", balance: 8400, oldestDueDays: 22 },
    { id: "cus-09", name: "Verma Ji", phone: "+91 97xxxxxx08", balance: 5600, oldestDueDays: 17 },
    { id: "cus-22", name: "Rana Tent House", phone: "+91 99xxxxxx45", balance: 4600, oldestDueDays: 19 },
  ];

  await db.insert(schema.customers).values([
    ...regulars,
    ...khataCustomers.map((c) => ({ id: c.id, storeId, name: c.name, phone: c.phone, isRegular: 0 })),
  ]);

  await db.insert(schema.khataEntries).values(
    khataCustomers.map((c) => ({
      id: id("khata"),
      storeId,
      customerId: c.id,
      type: "CREDIT",
      amount: c.balance,
      note: "Opening balance",
      status: "REMINDER_DRAFTED",
      createdAt: daysAgo(c.oldestDueDays),
    })),
  );

  // --- Suppliers (Vikram's procurement RFQ targets) ---
  await db.insert(schema.suppliers).values([
    { id: "sup-sharma", storeId, name: "Sharma Dairy", phone: "+91 90000-11111" },
    { id: "sup-fresh", storeId, name: "Fresh Farms", phone: "+91 90000-22222" },
    { id: "sup-city", storeId, name: "City Wholesale", phone: "+91 90000-33333" },
  ]);

  // --- Today's settlement reconciliation (Munim) ---
  await db.insert(schema.settlements).values({
    id: id("settle"),
    storeId,
    date: new Date().toISOString().slice(0, 10),
    posSalesTotal: 21480,
    pgSettledTotal: 20860,
    cashTotal: 3200,
    mismatches: [{ txn_id: "TXN-9021-91", amount: 620, reason: "SETTLEMENT_PENDING", action: "Flagged to Aman" }],
  });

  // --- Compliance calendar ---
  await db.insert(schema.complianceItems).values([
    { id: "cmp-gstr1-sep", storeId, title: "GSTR-1 (September)", authority: "GST", dueDate: "2026-10-11", status: "DRAFT_READY" },
    { id: "cmp-fssai", storeId, title: "FSSAI Licence Renewal", authority: "FSSAI", dueDate: "2026-11-30", status: "UPCOMING" },
  ]);

  // --- Staff & today's attendance (Meera) ---
  await db.insert(schema.staff).values([
    { id: "wkr-01", storeId, name: "Raju", role: "Helper", phone: "+91 90000-44441", monthlySalary: 12000, advanceBalance: 2000 },
    { id: "wkr-02", storeId, name: "Sunita", role: "Cook", phone: "+91 90000-44442", monthlySalary: 18000, advanceBalance: 0 },
    { id: "wkr-03", storeId, name: "Imran", role: "Counter", phone: "+91 90000-44443", monthlySalary: 14000, advanceBalance: 1500 },
    { id: "wkr-04", storeId, name: "Priyanka", role: "Helper", phone: "+91 90000-44444", monthlySalary: 13000, advanceBalance: 0 },
    { id: "wkr-05", storeId, name: "Deepak", role: "Cook", phone: "+91 90000-44445", monthlySalary: 15000, advanceBalance: 500 },
    { id: "wkr-06", storeId, name: "Anita", role: "Counter", phone: "+91 90000-44446", monthlySalary: 13500, advanceBalance: 0 },
  ]);

  const today = new Date().toISOString().slice(0, 10);
  await db.insert(schema.attendance).values([
    { id: id("att"), storeId, workerId: "wkr-01", date: today, checkIn: null, checkOut: null, status: "ABSENT" },
    { id: id("att"), storeId, workerId: "wkr-02", date: today, checkIn: "08:52 AM", checkOut: null, status: "PRESENT" },
    { id: id("att"), storeId, workerId: "wkr-03", date: today, checkIn: "09:12 AM", checkOut: null, status: "LATE" },
    { id: id("att"), storeId, workerId: "wkr-04", date: today, checkIn: "08:45 AM", checkOut: null, status: "PRESENT" },
    { id: id("att"), storeId, workerId: "wkr-05", date: today, checkIn: "08:50 AM", checkOut: null, status: "PRESENT" },
    { id: id("att"), storeId, workerId: "wkr-06", date: today, checkIn: "08:55 AM", checkOut: null, status: "PRESENT" },
  ]);

  // --- Paytm PG mock transactions (Aman) — timestamped "now" so any
  // "last N minutes" lookup stays valid regardless of when the scenario
  // runs after a reset. ---
  paytmPgMock.seed({
    txn_id: "TXN-9021-88",
    amount: 350,
    timestamp: new Date(),
    status: "SUCCESS",
    utr: mockUtr(),
    payer: "rahul@paytm",
    soundboxLag: true,
    soundboxAnnounced: false,
  });
  // Historical resolved disputes so Aman's "18 UPI Holds" roster metric
  // starts at its documented baseline and accumulates from there, instead
  // of visibly dropping to "1" the first time a new dispute resolves.
  await db.insert(schema.disputeResolutions).values(
    Array.from({ length: 18 }, (_, i) => ({
      id: id("disp"),
      storeId,
      txnId: `TXN-HIST-${i}`,
      amount: 200 + i * 25,
      resolvedAt: daysAgo(i + 1),
    })),
  );

  paytmPgMock.seed({
    txn_id: "TXN-9021-90",
    amount: 500,
    timestamp: new Date(),
    status: "PENDING",
    utr: mockUtr(),
    payer: "sunita@paytm",
    soundboxLag: false,
    soundboxAnnounced: false,
  });
}
