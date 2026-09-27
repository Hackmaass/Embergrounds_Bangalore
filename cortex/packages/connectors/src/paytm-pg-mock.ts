export interface MockTxn {
  txn_id: string;
  amount: number;
  timestamp: Date;
  status: "SUCCESS" | "PENDING";
  utr: string;
  payer: string;
  /** Soundbox failed to announce this txn within its normal window
   * (cellular lag) — Aman's edge-override path. */
  soundboxLag: boolean;
  soundboxAnnounced: boolean;
}

/** In-memory PG ledger. Re-seeded by scripts/seed-demo.ts and demo/reset. */
export class PaytmPgMock {
  private txns: MockTxn[] = [];

  reset(): void {
    this.txns = [];
  }

  seed(txn: MockTxn): void {
    this.txns.push(txn);
  }

  /** Aman's lookup: transactions of `amount` within `windowMinutes` of now. */
  findRecentByAmount(amount: number, windowMinutes: number, now: Date = new Date()): MockTxn[] {
    const windowMs = windowMinutes * 60_000;
    return this.txns.filter(
      (t) => t.amount === amount && now.getTime() - t.timestamp.getTime() <= windowMs,
    );
  }

  markSoundboxAnnounced(txnId: string): void {
    const txn = this.txns.find((t) => t.txn_id === txnId);
    if (txn) txn.soundboxAnnounced = true;
  }

  getSettlementTotal(): number {
    return this.txns.filter((t) => t.status === "SUCCESS").reduce((sum, t) => sum + t.amount, 0);
  }
}

export const paytmPgMock = new PaytmPgMock();

export function mockUtr(): string {
  return String(Math.floor(1_000_000_0000 + Math.random() * 9_000_000_0000));
}
