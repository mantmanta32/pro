// Engine tests — LONG/SHORT/EXIT rule evaluation

import { describe, it, expect, beforeEach } from 'vitest';
import { SignalEngine } from '../engine.js';
import { OBIEngine } from '../obi.js';
import { TickCVD } from '../cvd.js';
import { SignalTracker } from '../tracker.js';

describe('SignalEngine', () => {
  let obi, cvd, tracker, engine;

  beforeEach(() => {
    obi = new OBIEngine({ levels: 5 });
    cvd = new TickCVD({ windowMs: 60000 });
    tracker = new SignalTracker({ tpPct: 4, slPct: 2, timeoutMs: 300000 });
    engine = new SignalEngine({ obi, cvd, tracker, thresholds: { obiLong: 0.6, obiShort: 0.6, obiExit: 0.2 } });
  });

  it('produces LONG when OBI>0.6 and CVD>0', () => {
    // Simulate OBI high
    obi.ready = true;
    obi.bids.set(60000, 100);
    obi.asks.set(60100, 1);  // bids >> asks → OBI ≈ +1
    // Simulate positive CVD
    cvd.ingest({ isTakerBuy: true, valueUSD: 1000, time: Date.now() });

    const result = engine.evaluate(60050, Date.now());
    expect(result.signal).toBe('LONG');
    expect(tracker.isActive()).toBe(true);
    expect(tracker.direction()).toBe('LONG');
  });

  it('produces SHORT when OBI<-0.6 and CVD<0', () => {
    obi.ready = true;
    obi.bids.set(50000, 1);
    obi.asks.set(50100, 100); // asks >> bids → OBI ≈ -1
    cvd.ingest({ isTakerBuy: false, valueUSD: 1000, time: Date.now() }); // sell pressure

    const result = engine.evaluate(50050, Date.now());
    expect(result.signal).toBe('SHORT');
    expect(tracker.direction()).toBe('SHORT');
  });

  it('exits when |OBI| drops below exit threshold', () => {
    // First enter LONG
    obi.ready = true;
    obi.bids.set(60000, 100);
    obi.asks.set(60100, 1);
    cvd.ingest({ isTakerBuy: true, valueUSD: 1000, time: Date.now() });
    engine.evaluate(60050, Date.now());
    expect(tracker.isActive()).toBe(true);

    // Then OBI drops → exit
    obi.bids.clear();
    obi.asks.clear();
    obi.bids.set(60050, 1);
    obi.asks.set(60060, 1); // balanced → OBI ≈ 0

    const result = engine.evaluate(60055, Date.now());
    expect(result.signal).toBe('EXIT');
    expect(tracker.isActive()).toBe(false);
  });

  it('produces NONE when conditions not met', () => {
    obi.ready = true;
    obi.bids.set(50000, 2);
    obi.asks.set(50010, 2); // balanced
    cvd.reset(); // CVD=0

    const result = engine.evaluate(50005, Date.now());
    expect(result.signal).toBe('NONE');
    expect(tracker.isActive()).toBe(false);
  });

  it('no duplicate entry when already in position', () => {
    obi.ready = true;
    obi.bids.set(60000, 100);
    obi.asks.set(60100, 1);
    cvd.ingest({ isTakerBuy: true, valueUSD: 1000, time: Date.now() });

    engine.evaluate(60050, Date.now());
    expect(tracker.closed.length).toBe(0);

    // Second evaluation while still active
    const result = engine.evaluate(60051, Date.now());
    expect(result.signal).toBe('NONE');
    expect(tracker.closed.length).toBe(0);
  });
});
