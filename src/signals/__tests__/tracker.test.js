// Tracker tests — TP/SL/timeout + fee-correct net PnL

import { describe, it, expect, beforeEach } from 'vitest';
import { SignalTracker } from '../tracker.js';
import { ROUND_TRIP_BPS } from '../../config/fees.js';

describe('SignalTracker', () => {
  let tracker;

  beforeEach(() => { tracker = new SignalTracker({ tpPct: 4, slPct: 2, timeoutMs: 300000 }); });

  it('opens LONG position', () => {
    tracker.open('LONG', 50000, 1000, 1700000000000);
    expect(tracker.isActive()).toBe(true);
    expect(tracker.direction()).toBe('LONG');
  });

  it('closes on TP (LONG)', () => {
    tracker.open('LONG', 50000, 1000, 1700000000000);
    const result = tracker.update(52010, 1700000001000); // ~4.02% gain
    expect(result.closed).toBe(true);
    expect(result.reason).toBe('TP');
  });

  it('closes on SL (LONG)', () => {
    tracker.open('LONG', 50000, 1000, 1700000000000);
    const result = tracker.update(48990, 1700000001000); // ~2.02% loss
    expect(result.closed).toBe(true);
    expect(result.reason).toBe('SL');
  });

  it('closes on SL (SHORT)', () => {
    tracker.open('SHORT', 50000, 1000, 1700000000000);
    const result = tracker.update(51010, 1700000001000); // ~2.02% against → SL
    expect(result.closed).toBe(true);
    expect(result.reason).toBe('SL');
  });

  it('closes on timeout', () => {
    tracker.open('LONG', 50000, 1000, 1700000000000);
    const result = tracker.update(50100, 1700000300001); // 300001ms later
    expect(result.closed).toBe(true);
    expect(result.reason).toBe('TIME');
  });

  it('does not close within normal range', () => {
    tracker.open('LONG', 50000, 1000, 1700000000000);
    const result = tracker.update(50500, 1700000001000); // +1%, within range
    expect(result.closed).toBe(false);
  });

  it('fee reduces net PnL (use close for controlled test)', () => {
    tracker.open('LONG', 50000, 1000, 1700000000000);
    // Force close with small profit: 0.5% move = $5 gross
    const result = tracker.close(50250, 1700000001000, 'MANUAL');
    // Gross = (50250-50000)/50000 * 1000 = 5.0
    expect(result.trade.grossPnl).toBeCloseTo(5, 3);
    // Net = 5.0 - ($1000 * 8bps) = 5.0 - 0.80 = 4.20
    expect(result.trade.netPnl).toBeCloseTo(4.20, 2);
    expect(result.trade.netPnl).toBeLessThan(result.trade.grossPnl);
    expect(result.trade.feeBps).toBe(ROUND_TRIP_BPS);
  });

  it('net PnL negative when gross < fee (use close)', () => {
    tracker.open('LONG', 50000, 500, 1700000000000);
    // 0.05% move = $0.25 gross, fee = 8bps * $500 = $0.40, net = -$0.15
    const result = tracker.close(50025, 1700000001000, 'MANUAL');
    expect(result.trade.netPnl).toBeLessThan(0);
    expect(result.trade.grossPnl).toBeGreaterThan(0);
  });

  it('tracks multiple closed trades', () => {
    // Trade 1: LONG, hit SL
    tracker.open('LONG', 50000, 1000, 1700000000000);
    tracker.update(48990, 1700000100000);
    expect(tracker.closed.length).toBe(1);

    // Trade 2: SHORT, hit TP (price drops 4% from 48000 = 46080)
    tracker.open('SHORT', 48000, 1000, 1700000100001);
    tracker.update(46070, 1700000200000); // ~4.02% for short
    expect(tracker.closed.length).toBe(2);

    const snap = tracker.snapshot();
    expect(snap.closedCount).toBe(2);
    expect(typeof snap.winRate).toBe('string');
  });

  it('win rate computes correctly', () => {
    // Win
    tracker.open('LONG', 50000, 1000, 1700000000000);
    tracker.update(52010, 1700000100000); // TP → win (gross +4%, net positive after fee)
    // Since near Tp (4.02%): gross ~$40.20, fee=$0.80, net ~$39.40 → net positive
    expect(tracker.closed.length).toBe(1);
    // The net should still be positive even after fee at 4%+
    const snap = tracker.snapshot();
    expect(snap.totalNetPnl).toBeGreaterThan(0);
  });
});
