// Store-level guardrail policy. Hardcoded constants for the single demo
// store — a real deployment would load these per-store from a policy row,
// but the guardrail *functions* themselves (packages/runtime/guardrails.ts)
// are already store-agnostic pure code.
export const POLICY = {
  MARGIN_FLOOR_PCT: 30,
  VOUCHER_DISCOUNT_PCT: 10,
  COST_PER_WHATSAPP_MESSAGE: 5, // ₹ — 28 regulars * ₹5 = ₹140 (AGENTS.md worked example)
  DIP_RECOVERY_FACTOR: 2 / 3, // projected recovery ≈ 2/3 of the detected deficit
  DAILY_WHATSAPP_SPEND_CAP: 1000,
  DAILY_MESSAGE_CAP: 200,
  DIP_THRESHOLD_PCT: 15, // flag a dip once actual is >=15% below baseline
  PRICE_VARIANCE_CAP_PCT: 8,
  PROCUREMENT_TOTAL_CAP: 10000,
  KHATA_BALANCE_THRESHOLD: 5000,
  KHATA_DAYS_THRESHOLD: 15,
  STORE_QUIET_HOURS: "20:00-10:00", // AGENTS.md §P4.3 — store-level khata reminders
  STUDIO_QUIET_HOURS: "20:00-08:00", // AGENTS.md §5.4 — default for compiled agents
} as const;
