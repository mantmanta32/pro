// Binance API Service - Modular API calls

const BASE_URL = 'https://api.binance.com/api/v3';
const WS_BASE = 'wss://stream.binance.com:9443/ws';

export const fetchKlines = async (symbol, interval, limit = 200) => {
  const url = `${BASE_URL}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
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

export const fetch24hTicker = async (symbol) => {
  const url = `${BASE_URL}/ticker/24hr?symbol=${symbol}`;
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

export const getWebSocketUrl = (symbol, interval) => {
  const lowerSymbol = symbol.toLowerCase();
  return `${WS_BASE}/${lowerSymbol}@kline_${interval}`;
};

export const formatSymbol = (input) => {
  let sym = input.trim().toUpperCase();
  if (!sym.endsWith('USDT')) sym += 'USDT';
  return sym;
};
