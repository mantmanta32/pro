// Order Book Imbalance (OBI) — live depth tracker with U/u continuity
//
// Subscribes to <symbol>@depth@100ms (2026 /public stream).
// Maintains top-20 bids/asks; computes OBI in [−1,+1].
// On gap (missing sequence): resets + re-fetches REST snapshot.
//
// Framework-agnostic (no React dependency).

// ── Snapshot fetch ────────────────────────────────────────────

const FUT_REST = 'https://fapi.binance.com/fapi/v1';

async function fetchDepthSnapshot(symbol, levels = 20) {
  const url = `${FUT_REST}/depth?symbol=${symbol}&limit=${levels}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Depth snapshot error: ${res.status}`);
  const data = await res.json();
  return {
    lastUpdateId: data.lastUpdateId,
    bids: data.bids.map(([p, q]) => [parseFloat(p), parseFloat(q)]),
    asks: data.asks.map(([p, q]) => [parseFloat(p), parseFloat(q)]),
  };
}

// ── OBI engine ────────────────────────────────────────────────

export class OBIEngine {
  /**
   * @param {Object} opts
   * @param {number} opts.levels - book depth (default 20)
   * @param {number} opts.maxLevels - max stored levels (default 20)
   */
  constructor(opts = {}) {
    this.levels = opts.levels || 20;
    this.maxLevels = opts.maxLevels || 20;
    this.bids = new Map();   // price → qty
    this.asks = new Map();
    this.lastU = -1;          // last applied update-id
    this.lastUpdateId = -1;   // from snapshot
    this.ready = false;
    this.gapCount = 0;        // number of gaps detected (for probe)
    this.resubscribeCount = 0;
  }

  /** Initialize from snapshot */
  async init(symbol) {
    this.reset();
    const snap = await fetchDepthSnapshot(symbol, this.maxLevels);
    this.lastUpdateId = snap.lastUpdateId;

    this.bids.clear();
    for (const [p, q] of snap.bids) this.bids.set(p, q);

    this.asks.clear();
    for (const [p, q] of snap.asks) this.asks.set(p, q);

    this.lastU = snap.lastUpdateId;
    this.ready = true;
    return this;
  }

  /**
   * Apply a depth update event.
   * Event shape from 2026 /public stream:
   *   { e: "depthUpdate", E: eventTime, s: symbol,
   *     U: firstUpdateId, u: finalUpdateId,
   *     b: [[price, qty], ...], a: [[price, qty], ...] }
   *
   * Returns: { applied: boolean, gap: boolean }
   */
  apply(event) {
    const { U, u, b, a } = event;
    if (typeof U !== 'number' || typeof u !== 'number') return { applied: false, gap: true };

    // ── Continuity check ──────────────────────────────────────
    // Normal case:   U <= lastU+1 <= u  (stream is continuous)
    // Gap case:      U > lastU+1         (missed updates)
    if (!this.ready || u <= this.lastU) {
      // Duplicate or stale — skip
      return { applied: false, gap: false };
    }

    if (U > this.lastU + 1) {
      // Gap detected — needs resubscribe
      this.gapCount++;
      return { applied: false, gap: true };
    }

    // ── Apply bids ────────────────────────────────────────────
    if (b) {
      for (const [priceStr, qtyStr] of b) {
        const price = parseFloat(priceStr);
        const qty = parseFloat(qtyStr);
        if (qty === 0) {
          this.bids.delete(price);
        } else {
          this.bids.set(price, qty);
        }
      }
    }

    // ── Apply asks ────────────────────────────────────────────
    if (a) {
      for (const [priceStr, qtyStr] of a) {
        const price = parseFloat(priceStr);
        const qty = parseFloat(qtyStr);
        if (qty === 0) {
          this.asks.delete(price);
        } else {
          this.asks.set(price, qty);
        }
      }
    }

    this.lastU = u;

    // Trim to maxLevels
    this._trim();

    return { applied: true, gap: false };
  }

  /** Compute current OBI: (ΣbidVol − ΣaskVol) / (ΣbidVol + ΣaskVol) */
  compute() {
    if (!this.ready) return 0;

    const sortedBids = [...this.bids.entries()].sort((a, b) => b[0] - a[0]);
    const sortedAsks = [...this.asks.entries()].sort((a, b) => a[0] - b[0]);

    let bidVol = 0;
    for (let i = 0; i < Math.min(this.levels, sortedBids.length); i++) {
      bidVol += sortedBids[i][0] * sortedBids[i][1];
    }

    let askVol = 0;
    for (let i = 0; i < Math.min(this.levels, sortedAsks.length); i++) {
      askVol += sortedAsks[i][0] * sortedAsks[i][1];
    }

    const total = bidVol + askVol;
    if (total === 0) return 0;
    return (bidVol - askVol) / total;
  }

  /** Get best bid/ask for cross-check purposes */
  bestBidAsk() {
    const bids = [...this.bids.entries()].sort((a, b) => b[0] - a[0]);
    const asks = [...this.asks.entries()].sort((a, b) => a[0] - b[0]);
    return {
      bestBid: bids.length > 0 ? bids[0][0] : null,
      bestAsk: asks.length > 0 ? asks[0][0] : null,
      spread: (bids.length > 0 && asks.length > 0) ? asks[0][0] - bids[0][0] : null,
    };
  }

  /** Reset state (used after gap) */
  reset() {
    this.bids.clear();
    this.asks.clear();
    this.lastU = -1;
    this.lastUpdateId = -1;
    this.ready = false;
  }

  /** Snapshot for probe report */
  snapshot() {
    return {
      obi: this.compute(),
      bestBidAsk: this.bestBidAsk(),
      ready: this.ready,
      lastU: this.lastU,
      gapCount: this.gapCount,
      resubscribeCount: this.resubscribeCount,
      bidLevels: this.bids.size,
      askLevels: this.asks.size,
    };
  }

  // ── internal ────────────────────────────────────────────────
  _trim() {
    if (this.bids.size <= this.maxLevels && this.asks.size <= this.maxLevels) return;

    const sortedBids = [...this.bids.entries()].sort((a, b) => b[0] - a[0]);
    if (sortedBids.length > this.maxLevels) {
      const keep = new Set(sortedBids.slice(0, this.maxLevels).map(([p]) => p));
      for (const p of this.bids.keys()) { if (!keep.has(p)) this.bids.delete(p); }
    }

    const sortedAsks = [...this.asks.entries()].sort((a, b) => a[0] - b[0]);
    if (sortedAsks.length > this.maxLevels) {
      const keep = new Set(sortedAsks.slice(0, this.maxLevels).map(([p]) => p));
      for (const p of this.asks.keys()) { if (!keep.has(p)) this.asks.delete(p); }
    }
  }
}
