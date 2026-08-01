// Signal Tracker — paper trade tracking with fees
// Framework-agnostic.
import { applyFees, ROUND_TRIP_BPS } from '../config/fees.js';

/** @typedef {'LONG'|'SHORT'|null} Direction */

export class SignalTracker {
  /**
   * @param {Object} opts
   * @param {number} opts.tpPct - take profit % (default 4)
   * @param {number} opts.slPct - stop loss % (default 2)
   * @param {number} opts.timeoutMs - max signal duration in ms (default 300_000 = 5 min)
   */
  constructor(opts = {}) {
    this.tpPct = opts.tpPct || 4;
    this.slPct = opts.slPct || 2;
    this.timeoutMs = opts.timeoutMs || 300_000;

    /** @type {Object|null} current open position */
    this.position = null;

    /** @type {Object[]} closed trades */
    this.closed = [];
  }

  /**
   * Open a position.
   * @param {'LONG'|'SHORT'} direction
   * @param {number} entryPrice
   * @param {number} entryValue - notional value in USD (for fee calc)
   * @param {number} entryTime - ms timestamp (Binance E)
   */
  open(direction, entryPrice, entryValue, entryTime) {
    // Close existing if any
    if (this.position) this._closeInternal(entryPrice, entryTime);

    const entryFee = (entryValue * ROUND_TRIP_BPS / 2) / 10000; // half now

    this.position = {
      direction,
      entryPrice,
      entryValue,
      entryTime,
      entryFee,
    };
  }

  /**
   * Check exit conditions against current price.
   * Returns: { closed: boolean, reason?: 'TP'|'SL'|'TIME'|'REVERSE'|'EXIT_SIGNAL',
   *            trade?: Object, resultPct?: number, netPnl?: number }
   */
  update(currentPrice, currentTime) {
    if (!this.position) return { closed: false };

    const p = this.position;

    // Price change since entry
    const change = (currentPrice - p.entryPrice) / p.entryPrice;
    const dirMultiplier = p.direction === 'LONG' ? 1 : -1;
    const directionalChange = change * dirMultiplier * 100; // in %

    // TP / SL
    if (directionalChange >= this.tpPct)
      return this._closeInternal(currentPrice, currentTime, 'TP');

    if (directionalChange <= -this.slPct)
      return this._closeInternal(currentPrice, currentTime, 'SL');

    // Timeout
    if (currentTime - p.entryTime >= this.timeoutMs)
      return this._closeInternal(currentPrice, currentTime, 'TIME');

    return { closed: false };
  }

  /** Force close (reverse signal, exit signal, manual) */
  close(currentPrice, currentTime, reason = 'MANUAL') {
    return this._closeInternal(currentPrice, currentTime, reason);
  }

  /** Check if position is active */
  isActive() {
    return this.position !== null;
  }

  /** Get current position direction */
  direction() {
    return this.position ? this.position.direction : null;
  }

  // ── internal ────────────────────────────────────────────────
  _closeInternal(currentPrice, currentTime, reason) {
    if (!this.position) return { closed: false };

    const p = this.position;
    const dirM = p.direction === 'LONG' ? 1 : -1;
    const grossPnl = (currentPrice - p.entryPrice) / p.entryPrice * p.entryValue * dirM;
    const exitFee = (p.entryValue * ROUND_TRIP_BPS / 2) / 10000;
    const netPnl = applyFees(grossPnl, p.entryValue);
    const resultPct = (netPnl / p.entryValue) * 100;
    const durationMs = currentTime - p.entryTime;

    const trade = {
      direction: p.direction,
      entryPrice: p.entryPrice,
      exitPrice: currentPrice,
      entryTime: p.entryTime,
      exitTime: currentTime,
      durationMs,
      entryValue: p.entryValue,
      grossPnl,
      netPnl,
      resultPct,
      reason,
      feeBps: ROUND_TRIP_BPS,
    };

    this.closed.push(trade);
    this.position = null;

    return { closed: true, reason, trade, resultPct, netPnl };
  }

  /** Snapshot for probe report */
  snapshot() {
    return {
      active: this.position,
      closedCount: this.closed.length,
      closed: this.closed,
      winRate: this.closed.length
        ? (this.closed.filter(t => t.netPnl > 0).length / this.closed.length * 100).toFixed(1) + '%'
        : 'N/A',
      totalNetPnl: this.closed.reduce((s, t) => s + t.netPnl, 0),
    };
  }

  reset() {
    this.position = null;
    this.closed = [];
  }
}
