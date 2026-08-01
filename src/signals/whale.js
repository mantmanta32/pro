// Whale / Absorption Detector — trade size anomaly detection
//
// Uses the existing aggTrade stream (no new connection needed).
// Framework-agnostic.
//
// Levels:
//   WHALE  ≥ $100K     — large single trade
//   MEGA   ≥ $500K     — massive single trade
//   ABSORB ≥ $50K      — large volume but price barely moves (absorption)
//
// Absorption: detects when a big player accumulates/offloads without moving
// the price — a sign of hidden liquidity or iceberg orders.

// ── Thresholds ────────────────────────────────────────────────
const WHALE_VAL  = 100000;   // $100K
const MEGA_VAL   = 500000;   // $500K
const ABSORB_MIN = 50000;    // $50K minimum for absorption check
const ABSORB_WIN = 3000;     // 3s window
const ABSORB_PCT = 0.05;     // max 0.05% price movement = "absorption"

export class WhaleDetector {
  constructor(opts = {}) {
    this.whaleVal  = opts.whaleVal  || WHALE_VAL;
    this.megaVal   = opts.megaVal   || MEGA_VAL;
    this.absorbMin = opts.absorbMin || ABSORB_MIN;
    this.absorbWin = opts.absorbWin || ABSORB_WIN;
    this.absorbPct = opts.absorbPct || ABSORB_PCT;

    this.sightings = [];          // recent whale events
    this.recentTrades = [];       // for absorption window
    this.counts = { whale: 0, mega: 0, absorb: 0 };
    this.totalVol = 0;
  }

  /**
   * Feed a parsed aggTrade. Returns null or a sighting record:
   *   { level: 'whale'|'mega'|'absorb', ...tradeFields }
   */
  ingest(trade) {
    // Track recent trades for absorption detection
    this.recentTrades.push(trade);
    if (this.recentTrades.length > 100) this.recentTrades.shift();

    const val = trade.valueUSD;
    let level = null;

    // ── Size thresholds ──────────────────────────────────────
    if (val >= this.megaVal) {
      level = 'mega';
    } else if (val >= this.whaleVal) {
      level = 'whale';
    }

    // ── Absorption check (only if not already classified) ────
    if (!level && val >= this.absorbMin) {
      if (this._checkAbsorption(trade)) {
        level = 'absorb';
      }
    }

    if (level) {
      const sighting = {
        level,
        price: trade.price,
        valueUSD: val,
        quantity: trade.quantity,
        isTakerBuy: trade.isTakerBuy,
        time: trade.time,
      };

      this.sightings.push(sighting);
      if (this.sightings.length > 200) this.sightings = this.sightings.slice(-200);

      this.counts[level]++;
      this.totalVol += val;

      return sighting;
    }

    return null;
  }

  /** Check if a large trade is being absorbed (price not moving) */
  _checkAbsorption(trade) {
    const now = trade.time;
    const windowTrades = this.recentTrades.filter(t => now - t.time <= this.absorbWin);

    if (windowTrades.length < 3) return false;

    const prices = windowTrades.map(t => t.price);
    const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
    const pctChange = Math.abs((trade.price - avg) / avg) * 100;
    const totalVol = windowTrades.reduce((s, t) => s + t.valueUSD, 0);

    // Absorption: large cumulative vol, price barely moved
    return pctChange < this.absorbPct && totalVol > this.absorbMin * 2;
  }

  /** Snapshot for probe report */
  snapshot() {
    return {
      counts: { ...this.counts },
      totalVol: this.totalVol,
      last: this.sightings.slice(-5).reverse(),
    };
  }

  reset() {
    this.sightings = [];
    this.recentTrades = [];
    this.counts = { whale: 0, mega: 0, absorb: 0 };
    this.totalVol = 0;
  }
}
