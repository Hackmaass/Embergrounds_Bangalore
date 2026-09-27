// Deterministic, pure-function money guardrails. The LLM never does this
// math — every voucher, PO, khata batch and payout is checked here before a
// decision contract can be staged, and the same checks that pass at stage
// time are what the API returns as the human-readable "guardrail" string.

export interface GuardrailResult {
  passed: boolean;
  code: string;
  reason: string;
}

export function checkMarginFloor(args: {
  grossMarginPct: number;
  discountPct: number;
  floorPct: number;
}): GuardrailResult {
  const netMarginPct = args.grossMarginPct - args.discountPct;
  const passed = netMarginPct >= args.floorPct;
  return {
    passed,
    code: "MARGIN_FLOOR",
    reason: `${args.grossMarginPct}% - ${args.discountPct}% = ${netMarginPct}% net margin ${
      passed ? ">=" : "<"
    } floor ${args.floorPct}%`,
  };
}

export function checkPriceVarianceCap(args: {
  quotedPrice: number;
  lastPrice: number;
  maxVariancePct: number;
}): GuardrailResult {
  const variancePct = args.lastPrice === 0 ? 0 : ((args.quotedPrice - args.lastPrice) / args.lastPrice) * 100;
  const passed = variancePct <= args.maxVariancePct;
  const sign = variancePct >= 0 ? "+" : "";
  return {
    passed,
    code: "PRICE_VARIANCE_CAP",
    reason: `${sign}${variancePct.toFixed(1)}% vs last price ${
      passed ? "<=" : ">"
    } cap ${args.maxVariancePct}%`,
  };
}

export function checkPayoutCeiling(args: { payout: number; netPay: number }): GuardrailResult {
  const passed = args.payout <= args.netPay;
  return {
    passed,
    code: "PAYOUT_CEILING",
    reason: `payout ₹${args.payout} ${passed ? "<=" : ">"} net pay ₹${args.netPay}`,
  };
}

export function checkSpendCap(args: {
  amountRupees: number;
  spentTodayRupees: number;
  dailyCapRupees: number;
}): GuardrailResult {
  const projected = args.spentTodayRupees + args.amountRupees;
  const passed = projected <= args.dailyCapRupees;
  return {
    passed,
    code: "SPEND_CAP",
    reason: `₹${projected} projected daily spend ${passed ? "<=" : ">"} cap ₹${args.dailyCapRupees}`,
  };
}

export function checkMessageCap(args: {
  count: number;
  sentTodayCount: number;
  dailyCapCount: number;
}): GuardrailResult {
  const projected = args.sentTodayCount + args.count;
  const passed = projected <= args.dailyCapCount;
  return {
    passed,
    code: "MESSAGE_CAP",
    reason: `${projected} messages today ${passed ? "<=" : ">"} cap ${args.dailyCapCount}`,
  };
}

export function checkTotalCap(args: { totalRupees: number; capRupees: number }): GuardrailResult {
  const passed = args.totalRupees <= args.capRupees;
  return {
    passed,
    code: "TOTAL_CAP",
    reason: `total ₹${args.totalRupees} ${passed ? "<=" : ">"} cap ₹${args.capRupees}`,
  };
}

/** `range` is "HH:MM-HH:MM" in 24h IST, e.g. "20:00-08:00" (wraps midnight). */
export function checkQuietHours(args: { nowHHMM: string; range: string }): GuardrailResult {
  const [startStr, endStr] = args.range.split("-");
  const start = toMinutes(startStr ?? "00:00");
  const end = toMinutes(endStr ?? "00:00");
  const nowMin = toMinutes(args.nowHHMM);

  const inQuietHours = start <= end
    ? nowMin >= start && nowMin < end // same-day window
    : nowMin >= start || nowMin < end; // overnight wrap

  return {
    passed: !inQuietHours,
    code: "QUIET_HOURS",
    reason: inQuietHours
      ? `${args.nowHHMM} is inside quiet hours ${args.range}`
      : `${args.nowHHMM} is outside quiet hours ${args.range}`,
  };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export interface CombinedGuardrailResult {
  passed: boolean;
  checks: GuardrailResult[];
  summary: string;
}

export function combineGuardrails(checks: GuardrailResult[]): CombinedGuardrailResult {
  const passed = checks.every((c) => c.passed);
  const failed = checks.find((c) => !c.passed);
  return {
    passed,
    checks,
    summary: passed
      ? checks.map((c) => c.reason).join("; ")
      : `BLOCKED (${failed?.code}): ${failed?.reason}`,
  };
}
