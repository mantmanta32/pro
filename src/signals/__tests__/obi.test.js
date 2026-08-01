// OBI engine tests — correct diff-depth continuity model
//
// Live-verified (2026): depth@100ms delivers conflated batches.
// Between batches, sequence numbers skip — U > lastU+1 is NORMAL, NOT a gap.
// Only stale check: u <= lastU (duplicate/rewind).
// True gaps are extremely rare (only when sequence actually rewinds).

import { describe, it, expect, beforeEach } from 'vitest';
import { OBIEngine } from '../obi.js';

describe('OBIEngine', () => {
  let obi;
  beforeEach(() => { obi = new OBIEngine({ levels: 5, maxLevels: 10 }); });

  it('initializes with snapshot data', () => {
    obi.bids.set(50000, 2);
    obi.bids.set(49990, 5);
    obi.asks.set(50010, 3);
    obi.asks.set(50020, 4);
    obi.ready = true;
    const v = obi.compute();
    expect(v).toBeCloseTo(-0.00023, 4);
  });

  it('skips stale updates (u <= lastU)', () => {
    obi.ready = true;
    obi.lastU = 100;
    const r = obi.apply({ U: 95, u: 99 });
    expect(r.applied).toBe(false);
    expect(r.gap).toBe(false);
  });

  it('skips duplicate (u == lastU)', () => {
    obi.ready = true;
    obi.lastU = 100;
    const r = obi.apply({ U: 98, u: 100 });
    expect(r.applied).toBe(false);
    expect(r.gap).toBe(false);
  });

  it('accepts U skip (conflated diff normal behavior)', () => {
    // In conflated diff depth, next event can have U = lastU+40
    // because 100ms batches skip intermediate updates. This is NORMAL.
    obi.ready = true;
    obi.lastU = 100;
    obi.bids.set(50000, 2);
    obi.asks.set(50010, 3);

    const r = obi.apply({
      U: 140, u: 180,
      b: [['50100', '1.5']],
      a: [],
    });

    expect(r.applied).toBe(true);
    expect(r.gap).toBe(false);
    expect(obi.lastU).toBe(180);
    expect(obi.bids.get(50100)).toBe(1.5);
  });

  it('accepts multiple U-skips (simulated live stream)', () => {
    obi.ready = true;
    obi.lastU = 500;

    // First update: U jumps +62
    let r = obi.apply({ U: 562, u: 600, b: [['49000', '1']], a: [] });
    expect(r.applied).toBe(true);
    expect(obi.lastU).toBe(600);

    // Second: U jumps +113 (normal conflated diff)
    r = obi.apply({ U: 713, u: 750, b: [['49100', '2']], a: [] });
    expect(r.applied).toBe(true);
    expect(obi.lastU).toBe(750);

    // Third: U jumps +154
    r = obi.apply({ U: 904, u: 920, b: [], a: [['51000', '1']] });
    expect(r.applied).toBe(true);
    expect(obi.lastU).toBe(920);

    // 3 updates applied, 0 gaps
    expect(obi.gapCount).toBe(0);
  });

  it('applies valid update with exact U continuity', () => {
    obi.ready = true;
    obi.lastU = 100;
    obi.bids.set(50000, 2);
    obi.asks.set(50010, 3);

    const r = obi.apply({
      U: 101, u: 105,
      b: [['50100', '1.5'], ['50000', '0']],
      a: [['50015', '2.0']],
    });

    expect(r.applied).toBe(true);
    expect(r.gap).toBe(false);
    expect(obi.lastU).toBe(105);
    expect(obi.bids.get(50100)).toBe(1.5);
    expect(obi.bids.has(50000)).toBe(false);
    expect(obi.asks.get(50015)).toBe(2.0);
  });

  it('computes OBI=0 when empty', () => {
    obi.ready = true;
    expect(obi.compute()).toBe(0);
  });

  it('reset clears all state', () => {
    obi.ready = true;
    obi.bids.set(50000, 1);
    obi.lastU = 999;
    obi.gapCount = 5;
    obi.reset();
    expect(obi.ready).toBe(false);
    expect(obi.bids.size).toBe(0);
    expect(obi.lastU).toBe(-1);
    expect(obi.gapCount).toBe(5);
  });

  it('bestBidAsk returns correct values', () => {
    obi.bids.set(50000, 2);
    obi.bids.set(49990, 5);
    obi.asks.set(50010, 3);
    obi.asks.set(50020, 1);
    obi.ready = true;
    const bb = obi.bestBidAsk();
    expect(bb.bestBid).toBe(50000);
    expect(bb.bestAsk).toBe(50010);
    expect(bb.spread).toBe(10);
  });

  it('seeding mode: first depth update seeds book', () => {
    obi.seeding = true;
    obi.lastU = -1;
    obi.ready = false;
    const r = obi.apply({
      U: 1, u: 5,
      b: [['50000', '2.0'], ['49980', '1.5']],
      a: [['50010', '3.0']],
    });
    expect(r.applied).toBe(true);
    expect(r.gap).toBe(false);
    expect(obi.ready).toBe(true);
    expect(obi.seeding).toBe(false);
    expect(obi.lastU).toBe(5);
    expect(obi.bids.get(50000)).toBe(2);
    expect(obi.asks.get(50010)).toBe(3);
  });

  it('gap is false for normal U-skips (not gapCount++)', () => {
    // The ONLY condition that returns gap=true is missing/invalid U/u
    obi.ready = true;
    obi.lastU = 1000;
    // U=1040 (skip normal), valid u — not a gap
    let r = obi.apply({ U: 1040, u: 1080, b: [], a: [] });
    expect(r.applied).toBe(true);
    expect(r.gap).toBe(false);
    expect(obi.gapCount).toBe(0);

    // Bad: U and u missing
    r = obi.apply({});
    expect(r.applied).toBe(false);
    expect(r.gap).toBe(true);
    expect(obi.gapCount).toBe(1);
  });
});
