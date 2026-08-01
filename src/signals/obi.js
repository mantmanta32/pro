// Order Book Imbalance (OBI) — live depth tracker with U/u continuity
//
// Subscribes to <symbol>@depth@100ms (2026 /public stream).
// Maintains top-20 bids/asks; computes OBI in [−1,+1].
// On gap: resets + re-fetches REST snapshot.
// On REST fail: seeds from depth stream directly (geo-block resilient).
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
  constructor(opts = {}) {
    this.levels = opts.levels || 20;
    this.maxLevels = opts.maxLevels || 20;
    this.bids = new Map();
    this.asks = new Map();
    this.lastU = -1;
    this.lastUpdateId = -1;
    this.ready = false;
    this.gapCount = 0;
    this.resubscribeCount = 0;
    this.seeding = false;       // building book from stream (no REST)
    this.initError = null;
  }

  /** Initialize from REST snapshot */
  async init(symbol) {
    this.reset();
    this.initError = null;
    try {
      const snap = await fetchDepthSnapshot(symbol, this.maxLevels);
      this.lastUpdateId = snap.lastUpdateId;
      for (const [p, q] of snap.bids) this.bids.set(p, q);
      for (const [p, q] of snap.asks) this.asks.set(p, q);
      this.lastU = snap.lastUpdateId;
      this.ready = true;
      this.seeding = false;
    } catch (e) {
      // REST failed — seed from stream
      this.initError = e.message;
      this.ready = false;
      this.seeding = true;
      this.lastU = -1;  // accept first incoming update
    }
    return this;
  }

  /**
   * Apply a depth update event.
   * Returns: { applied: boolean, gap: boolean }
   */
  apply(event) {
    const { U, u, b, a } = event;
    if (typeof U !== 'number' || typeof u !== 'number') return { applied: false, gap: true };

    // ── Seeding mode: accept first update, then switch to ready ─
    if (this.seeding) {
      // First update received — seed the book from it
      this._applyLevels(b, a);
      this.lastU = u;
      this.seeding = false;
      this.ready = true;
      return { applied: true, gap: false };
    }

    // ── Normal continuity ─────────────────────────────────────
    if (!this.ready || u <= this.lastU) {
      return { applied: false, gap: false };
    }

    if (U > this.lastU + 1) {
      this.gapCount++;
      return { applied: false, gap: true };
    }

    this._applyLevels(b, a);
    this.lastU = u;
    this._trim();
    return { applied: true, gap: false };
  }

  /** Compute OBI: (ΣbidVol − ΣaskVol) / (ΣbidVol + ΣaskVol) */
  compute() {
    if (!this.ready) return 0;
    const sortedBids = [...this.bids.entries()].sort((a, b) => b[0] - a[0]);
    const sortedAsks = [...this.asks.entries()].sort((a, b) => a[0] - b[0]);
    let bidVol = 0, askVol = 0;
    for (let i = 0; i < Math.min(this.levels, sortedBids.length); i++)
      bidVol += sortedBids[i][0] * sortedBids[i][1];
    for (let i = 0; i < Math.min(this.levels, sortedAsks.length); i++)
      askVol += sortedAsks[i][0] * sortedAsks[i][1];
    const total = bidVol + askVol;
    if (total === 0) return 0;
    return (bidVol - askVol) / total;
  }

  /** Best bid/ask */
  bestBidAsk() {
    const bids = [...this.bids.entries()].sort((a, b) => b[0] - a[0]);
    const asks = [...this.asks.entries()].sort((a, b) => a[0] - b[0]);
    return {
      bestBid: bids.length > 0 ? bids[0][0] : null,
      bestAsk: asks.length > 0 ? asks[0][0] : null,
      spread: (bids.length > 0 && asks.length > 0) ? asks[0][0] - bids[0][0] : null,
    };
  }

  reset() {
    this.bids.clear();
    this.asks.clear();
    this.lastU = -1;
    this.lastUpdateId = -1;
    this.ready = false;
    this.seeding = false;
  }

  snapshot() {
    return {
      obi: this.compute(),
      bestBidAsk: this.bestBidAsk(),
      ready: this.ready,
      seeding: this.seeding,
      lastU: this.lastU,
      gapCount: this.gapCount,
      resubscribeCount: this.resubscribeCount,
      bidLevels: this.bids.size,
      askLevels: this.asks.size,
      initError: this.initError,
    };
  }

  // ── internal ────────────────────────────────────────────────
  _applyLevels(b, a) {
    if (b) for (const [ps, qs] of b) {
      const p = parseFloat(ps), q = parseFloat(qs);
      q === 0 ? this.bids.delete(p) : this.bids.set(p, q);
    }
    if (a) for (const [ps, qs] of a) {
      const p = parseFloat(ps), q = parseFloat(qs);
      q === 0 ? this.asks.delete(p) : this.asks.set(p, q);
    }
  }

  _trim() {
    if (this.bids.size <= this.maxLevels && this.asks.size <= this.maxLevels) return;
    const sB = [...this.bids.entries()].sort((a, b) => b[0] - a[0]);
    if (sB.length > this.maxLevels) {
      const keep = new Set(sB.slice(0, this.maxLevels).map(([p]) => p));
      for (const p of this.bids.keys()) { if (!keep.has(p)) this.bids.delete(p); }
    }
    const sA = [...this.asks.entries()].sort((a, b) => a[0] - b[0]);
    if (sA.length > this.maxLevels) {
      const keep = new Set(sA.slice(0, this.maxLevels).map(([p]) => p));
      for (const p of this.asks.keys()) { if (!keep.has(p)) this.asks.delete(p); }
    }
  }
}
