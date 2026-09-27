import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import type { CortexDb } from "@cortex/db";
import { DEMO_STORE_ID, schema } from "@cortex/db";
import { isoDate, makeId } from "@cortex/runtime";
import { meera } from "@cortex/agents";
import { AttendancePostBodySchema } from "@cortex/shared";

export function staffRouter(db: CortexDb): Router {
  const router = Router();
  const storeId = DEMO_STORE_ID;

  router.get("/staff", async (_req, res) => {
    const today = isoDate();
    const [staff, attendance, pendingPayroll] = await Promise.all([
      db.select().from(schema.staff).where(eq(schema.staff.storeId, storeId)),
      db.select().from(schema.attendance).where(and(eq(schema.attendance.storeId, storeId), eq(schema.attendance.date, today))),
      db
        .select()
        .from(schema.decisions)
        .where(and(eq(schema.decisions.storeId, storeId), eq(schema.decisions.kind, "PAYROLL_PAYOUT")))
        .orderBy(desc(schema.decisions.createdAt))
        .limit(1),
    ]);

    const workers = staff.map((s) => {
      const a = attendance.find((x) => x.workerId === s.id);
      return {
        worker_id: s.id,
        name: s.name,
        role: s.role,
        check_in: a?.checkIn ?? null,
        status: a?.status ?? "ABSENT",
        monthly_salary: s.monthlySalary,
        advance_balance: s.advanceBalance,
      };
    });

    const nextPayday = new Date();
    nextPayday.setUTCMonth(nextPayday.getUTCMonth() + 1, 1);
    const estimatedTotal = staff.reduce((sum, s) => sum + Math.max(0, s.monthlySalary - s.advanceBalance), 0);
    const latestPayrollDecision = pendingPayroll[0];

    res.json({
      date: today,
      present: workers.filter((w) => w.status !== "ABSENT").length,
      total: workers.length,
      workers,
      next_payday: {
        date: nextPayday.toISOString().slice(0, 10),
        decision_id: latestPayrollDecision?.status === "AWAITING_APPROVAL" ? latestPayrollDecision.id : null,
        estimated_total: estimatedTotal,
      },
    });
  });

  router.post("/staff/attendance", async (req, res) => {
    const parsed = AttendancePostBodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "INVALID_BODY", details: parsed.error.flatten() });

    if (parsed.data.type === "CHECK_IN") {
      await meera.checkIn(db, storeId, parsed.data.worker_id, parsed.data.source);
    } else {
      const today = isoDate();
      const [existing] = await db
        .select()
        .from(schema.attendance)
        .where(and(eq(schema.attendance.storeId, storeId), eq(schema.attendance.workerId, parsed.data.worker_id), eq(schema.attendance.date, today)));
      const checkOutLabel = new Date().toISOString();
      if (existing) {
        await db.update(schema.attendance).set({ checkOut: checkOutLabel }).where(eq(schema.attendance.id, existing.id));
      } else {
        await db.insert(schema.attendance).values({
          id: makeId("att"),
          storeId,
          workerId: parsed.data.worker_id,
          date: today,
          status: "PRESENT",
          checkOut: checkOutLabel,
        });
      }
    }
    res.status(201).json({ success: true });
  });

  return router;
}
