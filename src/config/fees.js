// Fee configuration — Binance USDS-M Futures VIP0
// Updated: 2026-08

export const TAKER_BPS = 4;   // 0.04%
export const MAKER_BPS = 2;   // 0.02%

// Paper engine assumes taker entry + taker exit for simplicity.
// Real systems with limit orders can track maker side per-leg, but
// for signal evaluation we use the worst-case taker round-trip.
export const ROUND_TRIP_BPS = TAKER_BPS * 2; // 8 bps

/** Apply round-trip fee to gross PnL, return net */
export function applyFees(grossPnl, entryValue) {
  const fee = (entryValue * ROUND_TRIP_BPS) / 10000;
  return grossPnl - fee;
}

/** Format bps for display */
export function feeSummary() {
  return { TAKER_BPS, MAKER_BPS, ROUND_TRIP_BPS };
}
