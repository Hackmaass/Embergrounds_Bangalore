import { doublePrecision, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const staff = pgTable("staff", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  phone: text("phone").notNull(),
  monthlySalary: doublePrecision("monthly_salary").notNull(),
  advanceBalance: doublePrecision("advance_balance").notNull().default(0),
});

export const STAFF_DDL = `
CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  phone TEXT NOT NULL,
  monthly_salary DOUBLE PRECISION NOT NULL,
  advance_balance DOUBLE PRECISION NOT NULL DEFAULT 0
);
`;

export const attendance = pgTable("attendance", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  workerId: text("worker_id").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  checkIn: text("check_in"), // "08:52 AM"
  checkOut: text("check_out"),
  status: text("status").notNull().default("ABSENT"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ATTENDANCE_DDL = `
CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  date TEXT NOT NULL,
  check_in TEXT,
  check_out TEXT,
  status TEXT NOT NULL DEFAULT 'ABSENT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

export const payroll = pgTable("payroll", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  decisionId: text("decision_id"),
  period: text("period").notNull(), // YYYY-MM
  workersPaid: doublePrecision("workers_paid").notNull().default(0),
  totalPaid: doublePrecision("total_paid").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const PAYROLL_DDL = `
CREATE TABLE IF NOT EXISTS payroll (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  decision_id TEXT,
  period TEXT NOT NULL,
  workers_paid DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_paid DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;
