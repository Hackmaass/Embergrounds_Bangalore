import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkMarginFloor,
  checkPriceVarianceCap,
  checkPayoutCeiling,
  checkSpendCap,
  checkMessageCap,
  checkQuietHours,
  checkTotalCap,
  combineGuardrails,
} from "./guardrails.js";

// --- Positive cases (AGENTS.md worked examples) ---

test("margin floor: Priya's 10% voucher on 45% gross margin passes a 30% floor", () => {
  const r = checkMarginFloor({ grossMarginPct: 45, discountPct: 10, floorPct: 30 });
  assert.equal(r.passed, true);
});

test("price variance: Vikram's Sharma Dairy quote (+1.6%) passes an 8% cap", () => {
  const r = checkPriceVarianceCap({ quotedPrice: 310, lastPrice: 305, maxVariancePct: 8 });
  assert.equal(r.passed, true);
});

test("payout ceiling: payout equal to net pay passes", () => {
  const r = checkPayoutCeiling({ payout: 18000, netPay: 18000 });
  assert.equal(r.passed, true);
});

test("quiet hours: 11:00 AM is outside the 20:00-10:00 store window (wraps midnight)", () => {
  const r = checkQuietHours({ nowHHMM: "11:00", range: "20:00-10:00" });
  assert.equal(r.passed, true);
});

test("quiet hours: 21:30 is inside the 20:00-10:00 window", () => {
  const r = checkQuietHours({ nowHHMM: "21:30", range: "20:00-10:00" });
  assert.equal(r.passed, false);
});

test("quiet hours: 05:00 is inside the overnight-wrapped 20:00-08:00 studio agent window", () => {
  const r = checkQuietHours({ nowHHMM: "05:00", range: "20:00-08:00" });
  assert.equal(r.passed, false);
});

// --- Guardrail negatives explicitly required by verifier-sonnet §2 ---

test("BLOCKED: discount breaching the margin floor", () => {
  // 25% gross margin - 20% discount = 5% net, floor is 30% -> must block
  const r = checkMarginFloor({ grossMarginPct: 25, discountPct: 20, floorPct: 30 });
  assert.equal(r.passed, false);
});

test("BLOCKED: PO price over the price-variance cap", () => {
  // City Wholesale ₹340 vs last price ₹305 = +11.5%, over an 8% cap -> must block
  const r = checkPriceVarianceCap({ quotedPrice: 340, lastPrice: 305, maxVariancePct: 8 });
  assert.equal(r.passed, false);
});

test("BLOCKED: payout above computed net pay", () => {
  const r = checkPayoutCeiling({ payout: 20000, netPay: 18000 });
  assert.equal(r.passed, false);
});

test("BLOCKED: WhatsApp spend cap exceeded", () => {
  const r = checkSpendCap({ amountRupees: 140, spentTodayRupees: 900, dailyCapRupees: 1000 });
  assert.equal(r.passed, false);
});

test("BLOCKED: daily message cap exceeded", () => {
  const r = checkMessageCap({ count: 28, sentTodayCount: 30, dailyCapCount: 50 });
  assert.equal(r.passed, false);
});

test("BLOCKED: PO total over procurement cap", () => {
  const r = checkTotalCap({ totalRupees: 5000, capRupees: 4000 });
  assert.equal(r.passed, false);
});

// --- combineGuardrails ---

test("combineGuardrails: all pass -> overall passed", () => {
  const combined = combineGuardrails([
    checkMarginFloor({ grossMarginPct: 45, discountPct: 10, floorPct: 30 }),
    checkSpendCap({ amountRupees: 140, spentTodayRupees: 0, dailyCapRupees: 1000 }),
  ]);
  assert.equal(combined.passed, true);
});

test("combineGuardrails: one failure -> overall blocked with reason naming the failed check", () => {
  const combined = combineGuardrails([
    checkMarginFloor({ grossMarginPct: 45, discountPct: 10, floorPct: 30 }),
    checkPayoutCeiling({ payout: 20000, netPay: 18000 }),
  ]);
  assert.equal(combined.passed, false);
  assert.match(combined.summary, /PAYOUT_CEILING/);
});
