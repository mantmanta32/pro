// Tick-CVD — Cumulative Volume Delta from aggregate trades
//
// Binance aggTrade 'm' field semantics (verified live, 2026):
//   m = true  → buyer is the market maker → AGGRESSIVE SELLER → delta negative
//   m = false → buyer is the taker         → AGGRESSIVE BUYER  → delta positive
//
// This module is framework-agnostic (no React dependency).

import { parseAggTrade } from '../services/binance.js';

// ── Rolling-window CVD state ──────────────────────────────────

export class TickCVD {
  /**
   * @param {Object} opts
   * @param {number} opts.windowMs - rolling window in ms (default 60_000 = 1 min)
   */
  constructor(opts = {}) {
    this.windowMs = opts.windowMs || 60_000;
    this.ticks = [];          // { time: ms, delta: +/-qtyUsd }
    this.cumulative = 0;
  }

  /** Feed a parsed aggTrade object (from parseAggTrade) */
  ingest(trade) {
    const delta = trade.isTakerBuy ? trade.valueUSD : -trade.valueUSD;
    this.ticks.push({ time: trade.time, delta });
    this.cumulative += delta;
    this._prune(trade.time);
    return this;
  }

  /** Running CVD over the window */
  value() {
    return this.cumulative;
  }

  /** Number of ticks in window */
  count() {
    return this.ticks.length;
  }

  /** Net CVD direction: +1 bullish, -1 bearish, 0 neutral */
  direction() {
    if (this.cumulative > 0) return 1;
    if (this.cumulative < 0) return -1;
    return 0;
  }

  // ── internal ────────────────────────────────────────────────

  _prune(now) {
    const cutoff = now - this.windowMs;
    let i = 0;
    while (i < this.ticks.length && this.ticks[i].time < cutoff) {
      this.cumulative -= this.ticks[i].delta;
      i++;
    }
    if (i > 0) this.ticks = this.ticks.slice(i);
  }

  /** Full reset */
  reset() {
    this.ticks = [];
    this.cumulative = 0;
  }

  /** Snapshot for probe report */
  snapshot() {
    return {
      value: this.cumulative,
      count: this.ticks.length,
      direction: this.direction(),
      windowMs: this.windowMs,
    };
  }
}

/**
 * Standalone function: compute delta sign from a trade.
 * Returns +1 (buyer aggression) or -1 (seller aggression).
 * This is the function tested against the fixture.
 */
export function deltaSign(trade) {
  // isTakerBuy = JSON m !== true
  return trade.isTakerBuy ? 1 : -1;
}
