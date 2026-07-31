// Binance API Service - Updated for 2026 WebSocket URL migration
//
// After 2026-04-23 legacy URLs decommissioned:
//   Public (high-freq): wss://fstream.binance.com/public/ws/...
//   Market (regular):   wss://fstream.binance.com/market/ws/...
//   Private (user):     wss://fstream.binance.com/private/ws...
//
// Stream mapping:
//   Kline/Candlestick → Market
//   Liquidations      → Market
//   Book Ticker       → Public
//   Depth             → Public

// ── REST endpoints ────────────────────────────────────────────
const SPOT_REST  = 'https://api.binance.com/api/v3';
const FUT_REST   = 'https://fapi.binance.com/fapi/v1';

// ── WebSocket endpoints (2026 new structure) ──────────────────
const WS_MARKET  = 'wss://fstream.binance.com/market';   // kline, liquidations, aggTrade, ticker...
const WS_PUBLIC  = 'wss://fstream.binance.com/public';   // depth, bookTicker...

// ── Klines (spot REST, futures WS for real-time) ──────────────
export const fetchKlines = async (symbol, interval, limit = 200) => {
  // Spot REST for initial history (still works fine)
  const url = `${SPOT_REST}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Kline API error: ${res.status}`);
  const data = await res.json();
  return data.map((d) => ({
    time: d[0] / 1000,
    open: parseFloat(d[1]),
    high: parseFloat(d[2]),
    low: parseFloat(d[3]),
    close: parseFloat(d[4]),
    volume: parseFloat(d[5]),
  }));
};

// ── 24h Ticker (spot REST) ────────────────────────────────────
export const fetch24hTicker = async (symbol) => {
  const url = `${SPOT_REST}/ticker/24hr?symbol=${symbol}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Ticker API error');
  const data = await res.json();
  return {
    price: parseFloat(data.lastPrice),
    change: parseFloat(data.priceChangePercent),
    high: parseFloat(data.highPrice),
    low: parseFloat(data.lowPrice),
    volume: parseFloat(data.volume),
  };
};

// ── Futures Open Interest ─────────────────────────────────────
export const fetchOpenInterest = async (symbol) => {
  const url = `${FUT_REST}/openInterest?symbol=${symbol}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return {
    openInterest: parseFloat(data.openInterest),
    timestamp: data.time,
  };
};

// ── Kline WebSocket URL (futures → Market category) ────────────
export const getWebSocketUrl = (symbol, interval) => {
  const lowerSymbol = symbol.toLowerCase();
  // Raw stream mode → 2026 /market path
  return `${WS_MARKET}/ws/${lowerSymbol}@kline_${interval}`;
};

// ── Liquidation WebSocket URL (all symbols) ───────────────────
export const getLiquidationWsUrl = () => {
  // All-market liquidation stream → /market
  // Raw stream: wss://fstream.binance.com/market/ws/!forceOrder@arr
  return `${WS_MARKET}/ws/!forceOrder@arr`;
};

// ── Symbol formatter ──────────────────────────────────────────
export const formatSymbol = (input) => {
  let sym = input.trim().toUpperCase();
  if (!sym.endsWith('USDT')) sym += 'USDT';
  return sym;
};

// ── Liquidation event parser ──────────────────────────────────
// Field reference (official 2026 docs):
//   e  → "forceOrder"
//   E  → event time (ms)
//   o  → { s: symbol, S: side, o: orderType, f: timeInForce,
//          q: origQty, p: price, ap: avgPrice, X: status,
//          l: lastFilledQty, z: accumFilledQty, T: tradeTime }
//   st → symbol type (1=USDS-M, 2=COIN-M) — new after CM migration
//   ps → pair symbol — new after CM migration
//
// Side mapping:
//   SELL → Long position liquidated (trader was long, forced to sell)
//   BUY  → Short position liquidated (trader was short, forced to buy)
export const parseLiquidationEvent = (data) => {
  try {
    const json = typeof data === 'string' ? JSON.parse(data) : data;
    if (json.e !== 'forceOrder') return null;

    const o = json.o;
    const price = parseFloat(o.ap) || parseFloat(o.p);
    const qty = parseFloat(o.q);
    const valueUSD = price * qty;

    return {
      symbol: o.s,
      side: o.S,                                        // SELL=long liq, BUY=short liq
      price,
      quantity: qty,
      valueUSD,
      time: json.E,
      orderType: o.o,                                   // LIMIT
      timeInForce: o.f,                                 // IOC
      status: o.X,                                      // FILLED
      symbolType: json.st || null,                      // 1=USDS-M, 2=COIN-M (2026 new)
      pairSymbol: json.ps || o.s,                       // (2026 new)
    };
  } catch (e) {
    console.error('Liquidation parse error:', e);
    return null;
  }
};
