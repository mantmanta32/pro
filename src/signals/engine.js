// Signal Engine — produces LONG/SHORT/NEUTRAL from OBI + CVD
// Framework-agnostic.

export class SignalEngine {
  /**
   * @param {Object} opts
   * @param {Object} opts.obi - OBIEngine instance
   * @param {Object} opts.cvd - TickCVD instance
   * @param {Object} opts.tracker - SignalTracker instance
   * @param {Object} opts.thresholds
   * @param {number} opts.thresholds.obiLong - OBI > this → LONG (default 0.6)
   * @param {number} opts.thresholds.obiShort - OBI < -this → SHORT (default 0.6)
   * @param {number} opts.thresholds.obiExit - |OBI| < this → exit (default 0.2)
   */
  constructor(opts = {}) {
    this.obi = opts.obi;
    this.cvd = opts.cvd;
    this.tracker = opts.tracker;
    this.obiLong = opts.thresholds?.obiLong ?? 0.6;
    this.obiShort = opts.thresholds?.obiShort ?? 0.6;
    this.obiExit = opts.thresholds?.obiExit ?? 0.2;
  }

  /**
   * Evaluate current state and produce a signal decision.
   * Called on each tick (aggTrade + depth update).
   * @param {number} currentPrice
   * @param {number} currentTime - ms
   * @returns {{ signal: 'LONG'|'SHORT'|'EXIT'|'NONE', reason: string }}
   */
  evaluate(currentPrice, currentTime) {
    const obi = this.obi.compute();
    const cvdDir = this.cvd.direction();
    const active = this.tracker.isActive();

    // ── Exit checks ──────────────────────────────────────────

    // Exit: |OBI| < threshold (momentum died)
    if (active && Math.abs(obi) < this.obiExit) {
      this.tracker.close(currentPrice, currentTime, 'OBI_EXIT');
      return { signal: 'EXIT', reason: 'OBI flatlined' };
    }

    // Exit: reversal
    const posDir = this.tracker.direction();
    if (active && posDir) {
      if (posDir === 'LONG' && obi < -this.obiShort && cvdDir < 0) {
        this.tracker.close(currentPrice, currentTime, 'REVERSE');
        return { signal: 'EXIT', reason: 'Reversal to SHORT' };
      }
      if (posDir === 'SHORT' && obi > this.obiLong && cvdDir > 0) {
        this.tracker.close(currentPrice, currentTime, 'REVERSE');
        return { signal: 'EXIT', reason: 'Reversal to LONG' };
      }
    }

    // ── Time check ───────────────────────────────────────────
    const timeResult = this.tracker.update(currentPrice, currentTime);
    if (timeResult.closed) {
      return { signal: 'EXIT', reason: timeResult.reason };
    }

    // ── Entry checks (only when flat) ─────────────────────────
    if (!active) {
      if (obi > this.obiLong && cvdDir > 0) {
        this.tracker.open('LONG', currentPrice, 1000, currentTime); // default $1k notional
        return { signal: 'LONG', reason: `OBI=${obi.toFixed(3)} CVD=+` };
      }
      if (obi < -this.obiShort && cvdDir < 0) {
        this.tracker.open('SHORT', currentPrice, 1000, currentTime);
        return { signal: 'SHORT', reason: `OBI=${obi.toFixed(3)} CVD=-` };
      }
    }

    return { signal: 'NONE', reason: 'No condition met' };
  }

  /** Snapshot for probe report */
  snapshot() {
    return {
      obi: this.obi?.snapshot() || null,
      cvd: this.cvd?.snapshot() || null,
      tracker: this.tracker?.snapshot() || null,
      config: {
        obiLong: this.obiLong,
        obiShort: this.obiShort,
        obiExit: this.obiExit,
      },
    };
  }
}
