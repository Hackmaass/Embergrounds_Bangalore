import { randomUUID } from "node:crypto";

/** Mock Paytm UPI deep link — used in khata reminders and voucher slips. */
export function generateUpiLink(args: { payeeVpa: string; payeeName: string; amount: number; note: string }): string {
  const params = new URLSearchParams({
    pa: args.payeeVpa,
    pn: args.payeeName,
    am: String(args.amount),
    tn: args.note,
    tr: randomUUID().slice(0, 12),
  });
  return `upi://pay?${params.toString()}`;
}

export interface MockPayoutResult {
  status: "SUCCESS";
  utr: string;
}

/** Mock UPI payout (payroll, supplier settlement) — always succeeds in the demo. */
export function mockUpiPayout(_args: { toVpaOrPhone: string; amount: number }): MockPayoutResult {
  return { status: "SUCCESS", utr: randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase() };
}

/** Unique per-customer coupon code for a voucher campaign. */
export function generateCouponCode(prefix: string): string {
  return `${prefix}-${randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}
