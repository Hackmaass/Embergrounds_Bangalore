import type { SupplierQuote } from "@cortex/shared";

const SUPPLIERS = [
  { name: "Sharma Dairy", variancePct: 1.6, etaHours: 12 },
  { name: "Fresh Farms", variancePct: 6.6, etaHours: 14 },
  { name: "City Wholesale", variancePct: 11.5, etaHours: 4 },
] as const;

/**
 * Deterministic stand-in for "WhatsApp RFQ to 3 suppliers, parse free-text
 * replies into structured quotes" (AGENTS.md §P5). Ratios reproduce the
 * worked example exactly at lastPrice=305 (Sharma ₹310, Fresh Farms ₹325,
 * City Wholesale ₹340) and generalize to any SKU/last price.
 */
export function getSupplierQuotes(lastPrice: number, etaAnchor: Date = new Date()): SupplierQuote[] {
  const quotes = SUPPLIERS.map((s) => ({
    supplier: s.name,
    unit_price: Math.round(lastPrice * (1 + s.variancePct / 100)),
    eta: formatEta(new Date(etaAnchor.getTime() + s.etaHours * 3_600_000)),
    selected: false,
  }));

  const cheapest = quotes.reduce((min, q) => (q.unit_price < min.unit_price ? q : min), quotes[0]!);
  cheapest.selected = true;
  return quotes;
}

function formatEta(date: Date): string {
  const time = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
  return `Tomorrow ${time}`;
}
