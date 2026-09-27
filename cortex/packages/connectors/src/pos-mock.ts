export interface HourlySalesBucket {
  hourBucket: Date;
  qty: number;
  amount: number;
}

/**
 * Generates a 30-day hourly baseline for one SKU/store plus a deliberate
 * evening dip "yesterday" (AGENTS.md §P1: 6–9 PM, -38%, ₹4,800 deficit) —
 * used only by scripts/seed-demo.ts to make Priya's dip-detection routine
 * demonstrable without a live POS feed.
 */
export function generateBaselineWithDip(args: {
  baselineHourlyAmount: number;
  dipHours: number[]; // 24h clock hours, e.g. [18, 19, 20]
  dipFactor: number; // 0.62 => -38%
  days?: number;
}): HourlySalesBucket[] {
  const days = args.days ?? 30;
  const buckets: HourlySalesBucket[] = [];
  const now = new Date();

  for (let d = days; d >= 1; d--) {
    for (let h = 8; h <= 22; h++) {
      const bucketDate = new Date(now);
      bucketDate.setUTCDate(bucketDate.getUTCDate() - d);
      bucketDate.setUTCHours(h, 0, 0, 0);

      const isYesterday = d === 1;
      const isDipHour = args.dipHours.includes(h);
      const amount =
        isYesterday && isDipHour
          ? Math.round(args.baselineHourlyAmount * args.dipFactor)
          : args.baselineHourlyAmount;

      buckets.push({ hourBucket: bucketDate, qty: Math.round(amount / 120), amount });
    }
  }
  return buckets;
}

export interface StockEvent {
  sku: string;
  outOfStockAt: Date | null;
  restockedAt: Date | null;
}

export function stockout(sku: string, at: Date): StockEvent {
  return { sku, outOfStockAt: at, restockedAt: null };
}
