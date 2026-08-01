// OBI engine tests — U/u continuity, gap detection, OBI computation

import { describe, it, expect, beforeEach } from 'vitest';
import { OBIEngine } from '../obi.js';

describe('OBIEngine', () => {
  let obi;

  beforeEach(() => {
    obi = new OBIEngine({ levels: 5, maxLevels: 10 });
  });

  it('initializes with snapshot data', () => {
    // Simulate post-init state
    obi.bids.set(50000, 2);
    obi.bids.set(49990, 5);
    obi.asks.set(50010, 3);
    obi.asks.set(50020, 4);
    obi.ready = true;

    const v = obi.compute();
    // bidVol = 50000*2 + 49990*5 = 100000 + 249950 = 349950
    // askVol = 50010*3 + 50020*4 = 150030 + 200080 = 350110
    // OBI = (349950 - 350110) / (349950 + 350110) = -160/700060 ≈ -0.00023
    expect(v).toBeCloseTo(-0.00023, 4);
  });

  it('skips stale updates (u <= lastU)', () => {
    obi.ready = true;
    obi.lastU = 100;

    const result = obi.apply({ U: 95, u: 99, b: [], a: [] });
    expect(result.applied).toBe(false);
    expect(result.gap).toBe(false);
  });

  it('detects gap (U > lastU + 1)', () => {
    obi.ready = true;
    obi.lastU = 100;

    const result = obi.apply({ U: 105, u: 110, b: [], a: [] });
    expect(result.applied).toBe(false);
    expect(result.gap).toBe(true);
    expect(obi.gapCount).toBe(1);
  });

  it('applies valid update', () => {
    obi.ready = true;
    obi.lastU = 100;
    obi.bids.set(50000, 2);
    obi.asks.set(50010, 3);

    // U=lastU+1=101 → valid
    const result = obi.apply({
      U: 101, u: 105,
      b: [['50100', '1.5'], ['50000', '0']],  // add 50100, remove 50000
      a: [['50015', '2.0']],
    });

    expect(result.applied).toBe(true);
    expect(result.gap).toBe(false);
    expect(obi.lastU).toBe(105);
    expect(obi.bids.get(50100)).toBe(1.5);
    expect(obi.bids.has(50000)).toBe(false); // qty=0 → removed
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
    expect(obi.gapCount).toBe(5); // gapCount intentionally not cleared (for probe)
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
});
