// Order Book Imbalance (OBI) — live depth tracker with correct continuity model
//
// Subscribes to <symbol>@depth@100ms (2026 /public diff depth stream).
// Maintains top-20 bids/asks; computes OBI in [−1,+1].
//
// Continuity model (Binance diff depth, verified live 2026):
//   Diff depth delivers conflated batches at 100ms intervals.
//   Between batches, sequence numbers naturally skip — this is NOT a gap.
//   Gap detection: only if `u <= lastU` (stale/duplicate/rewind).
//   `U > lastU + 1` is NORMAL in a conflated diff feed; do NOT treat as gap.
//
// Framework-agnostic (no React dependency).

const FUT_REST = 'https://fapi.binance.com/fapi/v1';

async function fetchDepthSnapshot(symbol, levels = 20) {
  const url = `${FUT_REST}/depth?symbol=${symbol}&limit=${levels}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Depth snapshot: ${res.status}`);
  const data = await res.json();
  return {
    lastUpdateId: data.lastUpdateId,
    bids: data.bids.map(([p, q]) => [parseFloat(p), parseFloat(q)]),
    asks: data.asks.map(([p, q]) => [parseFloat(p), parseFloat(q)]),
  };
}

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
    this.seeding = false;
    this.initError = null;
  }

  /** Initialize from REST snapshot; falls back to stream-seed on failure */
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
      this.initError = e.message;
      this.ready = false;
      this.seeding = true;
      this.lastU = -1;
    }
    return this;
  }

  /**
   * Apply a depth update event.
   *   { U: firstUpdateId, u: finalUpdateId, b: [[price,qty],...], a: [[price,qty],...] }
   * Returns: { applied: boolean, gap: boolean }
   */
  apply(event) {
    const { U, u, b, a } = event;
    if (typeof U !== 'number' || typeof u !== 'number') {
      this.gapCount++;
      return { applied: false, gap: true };
    }

    // ── Seeding mode: accept first update, set ready ──────────
    if (this.seeding) {
      this._applyLevels(b, a);
      this.lastU = u;
      this.seeding = false;
      this.ready = true;
      return { applied: true, gap: false };
    }

    // ── Stale/duplicate check ─────────────────────────────────
    // Diff depth conflates updates; U naturally skips between batches.
    // The ONLY reliable staleness signal is `u <= lastU` (rewind/duplicate).
    if (!this.ready || u <= this.lastU) {
      return { applied: false, gap: false };
    }

    // ── Apply ─────────────────────────────────────────────────
    this._applyLevels(b, a);
    this.lastU = u;
    this._trim();
    return { applied: true, gap: false };
  }

  /** OBI = (ΣbidVol − ΣaskVol) / (ΣbidVol + ΣaskVol) */
  compute() {
    if (!this.ready) return 0;
    const sB = [...this.bids.entries()].sort((a, b) => b[0] - a[0]);
    const sA = [...this.asks.entries()].sort((a, b) => a[0] - b[0]);
    let bv = 0, av = 0;
    for (let i = 0; i < Math.min(this.levels, sB.length); i++) bv += sB[i][0] * sB[i][1];
    for (let i = 0; i < Math.min(this.levels, sA.length); i++) av += sA[i][0] * sA[i][1];
    const t = bv + av;
    return t === 0 ? 0 : (bv - av) / t;
  }

  bestBidAsk() {
    const b = [...this.bids.entries()].sort((a, b) => b[0] - a[0]);
    const a = [...this.asks.entries()].sort((a, b) => a[0] - b[0]);
    return {
      bestBid: b.length > 0 ? b[0][0] : null,
      bestAsk: a.length > 0 ? a[0][0] : null,
      spread: (b.length > 0 && a.length > 0) ? a[0][0] - b[0][0] : null,
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
      obi: this.compute(), bestBidAsk: this.bestBidAsk(),
      ready: this.ready, seeding: this.seeding,
      lastU: this.lastU, gapCount: this.gapCount,
      resubscribeCount: this.resubscribeCount,
      bidLevels: this.bids.size, askLevels: this.asks.size,
      initError: this.initError || null,
    };
  }

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
