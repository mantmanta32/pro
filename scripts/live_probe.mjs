#!/usr/bin/env node
// live_probe.mjs — Headless flow signal probe
// Run: node scripts/live_probe.mjs [--symbol BTCUSDT] [--duration 600]

import WebSocket from 'ws';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAggTrade, parseDepthUpdate, parseBookTicker, formatSymbol } from '../src/services/binance.js';
import { TickCVD } from '../src/signals/cvd.js';
import { OBIEngine } from '../src/signals/obi.js';
import { SignalTracker } from '../src/signals/tracker.js';
import { SignalEngine } from '../src/signals/engine.js';
import { LatencyMetrics } from '../src/signals/metrics.js';
import { WhaleDetector } from '../src/signals/whale.js';
import { ROUND_TRIP_BPS } from '../src/config/fees.js';

const args = process.argv.slice(2);
const getArg = (flag, def) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : def; };
const SYMBOL = formatSymbol(getArg('--symbol', 'BTCUSDT'));
const DURATION_SEC = parseInt(getArg('--duration', '600'), 10);
const REPORT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'reports');

const WS_BASE = 'wss://fstream.binance.com';
const S = SYMBOL.toLowerCase();
const MARKET_URL = `${WS_BASE}/market/stream?streams=${S}@aggTrade`;
const PUBLIC_URL = `${WS_BASE}/public/stream?streams=${S}@depth@100ms/${S}@bookTicker`;

const obi = new OBIEngine({ levels: 20 });
const cvd = new TickCVD({ windowMs: 60000 });
const tracker = new SignalTracker({ tpPct: 4, slPct: 2, timeoutMs: 300000 });
const engine = new SignalEngine({ obi, cvd, tracker, thresholds: { obiLong: 0.6, obiShort: 0.6, obiExit: 0.2 } });
const latency = new LatencyMetrics({ windowMs: 300000 });
const whale = new WhaleDetector();

const counters = { aggTrade: 0, depthUpdate: 0, bookTicker: 0 };
const signals = [];
const crossCheck = { total: 0, correct: 0, skipped: 0 };
let startTime = Date.now();

function log(...a) { console.log(`[${new Date().toISOString()}]`, ...a); }

function writeReport() {
  const dur = Math.round((Date.now() - startTime) / 1000);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(REPORT_DIR, `probe_${SYMBOL}_${ts}.json`);
  const report = {
    probe: { symbol: SYMBOL, durationSec: dur, startedAt: new Date(startTime).toISOString(),
      feeModel: { roundTripBps: ROUND_TRIP_BPS, takerBps: 4, makerBps: 2 } },
    counters,
    obiReady: obi.ready,
    obiSnapshot: obi.snapshot(),
    engine: engine.snapshot(),
    latency: latency.snapshot(),
    whale: whale.snapshot(),
    cvdCrossCheck: { ...crossCheck,
      pct: crossCheck.total > 0 ? ((crossCheck.correct / crossCheck.total) * 100).toFixed(1) + '%' : 'N/A' },
    signals,
    lastObi: obi.compute(),
    lastCvd: cvd.value(),
  };
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  log(`✅ Report: ${file}`);
  return report;
}

function cvdCrossCheck(trade) {
  if (!obi.ready) return;
  const bb = obi.bestBidAsk();
  if (bb.bestBid == null || bb.bestAsk == null) return;
  const distBid = Math.abs(trade.price - bb.bestBid);
  const distAsk = Math.abs(trade.price - bb.bestAsk);
  const spread = bb.spread;
  if (spread && spread > 0) {
    const ambiguity = Math.abs(distBid - distAsk) / spread;
    if (ambiguity < 0.1) { crossCheck.skipped++; return; }
  }
  crossCheck.total++;
  if ((distBid <= distAsk && !trade.isTakerBuy) || (distBid > distAsk && trade.isTakerBuy))
    crossCheck.correct++;
}

function handleMessage(raw) {
  const data = raw.toString();
  let obj;
  try { obj = JSON.parse(data); } catch { return; }
  if (!obj || !obj.stream) return;

  if (obj.stream.endsWith('@aggTrade')) {
    const trade = parseAggTrade({ ...obj.data, e: 'aggTrade' });
    if (!trade) return;
    counters.aggTrade++;
    if (obj.data.E) latency.record(obj.data.E);
    cvd.ingest(trade);
    cvdCrossCheck(trade);
    const sighting = whale.ingest(trade);

    const result = engine.evaluate(trade.price, obj.data.E || Date.now());
    if (result.signal !== 'NONE')
      signals.push({
        time: new Date().toISOString(), signal: result.signal,
        reason: result.reason, price: trade.price,
        whaleSighted: sighting ? sighting.level : false,
      });
    return;
  }

  if (obj.stream.endsWith('@depth@100ms')) {
    const depth = parseDepthUpdate({ ...obj.data, e: 'depthUpdate' });
    if (!depth) return;
    counters.depthUpdate++;
    if (obj.data.E) latency.record(obj.data.E);
    const applied = obi.apply(depth);
    if (applied.gap) {
      log('⚠️ Depth gap — re-initializing...');
      obi.reset();
      obi.resubscribeCount++;
      obi.init(SYMBOL).then(() => log('📊 OBI re-initialized'))
        .catch((e) => log('⚠️ OBI re-init fail:', e.message));
    }
    return;
  }

  if (obj.stream.endsWith('@bookTicker')) {
    const bt = parseBookTicker({ ...obj.data, e: 'bookTicker' });
    if (!bt) return;
    counters.bookTicker++;
    return;
  }
}

function connect(url, label) {
  const ws = new WebSocket(url);
  let silentTries = 0;
  let lastMsg = Date.now();
  let connected = false;
  ws.on('open', () => { connected = true; log(`✅ ${label}`); silentTries = 0; lastMsg = Date.now(); });
  ws.on('message', (data) => { handleMessage(data); lastMsg = Date.now(); });
  ws.on('error', (e) => log(`❌ ${label}:`, e.message));
  ws.on('close', () => {
    connected = false; log(`🔌 ${label}`);
    const delay = Math.min(30000, 1000 * Math.pow(2, silentTries) + Math.random() * 1000);
    silentTries++;
    setTimeout(() => connect(url, label), delay);
  });
  const wd = setInterval(() => {
    if (connected && Date.now() - lastMsg > 45000) { ws.close(); clearInterval(wd); }
  }, 15000);
  return ws;
}

async function main() {
  log(`🚀 Probe: ${SYMBOL}, ${DURATION_SEC}s`);
  try { await obi.init(SYMBOL); } catch (e) { log(`⚠️ OBI init threw: ${e.message}`); }
  log(`📊 OBI: ${obi.ready ? 'ready' : 'seeding'} (err=${obi.initError || 'none'})`);

  const ws1 = connect(MARKET_URL, 'market');
  const ws2 = connect(PUBLIC_URL, 'public');

  const progress = setInterval(() => {
    const el = Math.round((Date.now() - startTime) / 1000);
    const o = obi.ready ? obi.compute().toFixed(4) : (obi.seeding ? 'seeding' : 'init...');
    const ws = whale.snapshot();
    log(`⏱ ${el}s | agg:${counters.aggTrade} depth:${counters.depthUpdate} bt:${counters.bookTicker} | OBI:${o} CVD:${cvd.value().toFixed(0)} | whale:${ws.counts.whale}/${ws.counts.mega}/${ws.counts.absorb} | sig:${signals.length} | xck:${crossCheck.correct}/${crossCheck.total}`);
  }, 30000);

  setTimeout(() => {
    clearInterval(progress);
    log('⏰ Done');
    ws1.close(); ws2.close();
    const r = writeReport();
    log(`📋 agg:${counters.aggTrade} depth:${counters.depthUpdate} bt:${counters.bookTicker}`);
    log(`   cross-check: ${crossCheck.correct}/${crossCheck.total} (${r.cvdCrossCheck.pct}) skipped:${crossCheck.skipped}`);
    log(`   latency p50:${r.latency.p50}ms p99:${r.latency.p99}ms`);
    log(`   whale: w=${r.whale.counts.whale} m=${r.whale.counts.mega} a=${r.whale.counts.absorb} vol=${(r.whale.totalVol/1e6).toFixed(1)}M`);
    log(`   obiReady:${obi.ready} trades:${r.engine.tracker?.closedCount || 0} netPnL:$${(r.engine.tracker?.totalNetPnl || 0).toFixed(4)}`);
    process.exit(0);
  }, DURATION_SEC * 1000);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
