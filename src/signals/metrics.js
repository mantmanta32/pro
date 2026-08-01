// Latency telemetry — rolling window percentile tracker
//
// Framework-agnostic. Tracks tick→signal latency:
//   latency = Date.now() − event.E (Binance event-time in ms)
//
// Keeps a rolling 5-minute window of values and provides p50/p99.

export class LatencyMetrics {
  /**
   * @param {Object} opts
   * @param {number} opts.windowMs - rolling window in ms (default 300_000 = 5 min)
   */
  constructor(opts = {}) {
    this.windowMs = opts.windowMs || 300_000;
    this.samples = [];   // [{ time: Date.now(), latency: ms }]
    this.maxLatency = 0;
  }

  /** Record a latency sample */
  record(eventTimeMs) {
    const now = Date.now();
    const latency = Math.max(0, now - eventTimeMs);
    this.samples.push({ time: now, latency });
    if (latency > this.maxLatency) this.maxLatency = latency;
    this._prune(now);
    return latency;
  }

  /** Current p50 (median) */
  p50() {
    if (this.samples.length === 0) return 0;
    const sorted = [...this.samples].map(s => s.latency).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted[mid];
  }

  /** Current p99 */
  p99() {
    if (this.samples.length === 0) return 0;
    const sorted = [...this.samples].map(s => s.latency).sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * 0.99);
    return sorted[Math.min(idx, sorted.length - 1)];
  }

  /** Sample count in window */
  count() {
    return this.samples.length;
  }

  /** Snapshot for probe report */
  snapshot() {
    return {
      p50: this.p50(),
      p99: this.p99(),
      max: this.maxLatency,
      count: this.samples.length,
      windowMs: this.windowMs,
    };
  }

  // ── internal ────────────────────────────────────────────────
  _prune(now) {
    const cutoff = now - this.windowMs;
    let i = 0;
    while (i < this.samples.length && this.samples[i].time < cutoff) i++;
    if (i > 0) this.samples = this.samples.slice(i);
  }

  reset() {
    this.samples = [];
    this.maxLatency = 0;
  }
}
