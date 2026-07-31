import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchKlines, fetch24hTicker, getWebSocketUrl, formatSymbol } from '../services/binance';

const DEFAULT_SYMBOL = 'BTCUSDT';
const DEFAULT_TIMEFRAME = '1d';

export function useCryptoChart() {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [timeframe, setTimeframe] = useState(DEFAULT_TIMEFRAME);
  const [candles, setCandles] = useState([]);
  const [ticker, setTicker] = useState({
    price: null,
    change: null,
    high: null,
    low: null,
    volume: null,
  });
  const [isConnected, setIsConnected] = useState(false);
  const [statusText, setStatusText] = useState('YÜKLENİYOR...');
  const [error, setError] = useState(null);

  const wsRef = useRef(null);
  const lastUpdateRef = useRef(0);
  const isMountedRef = useRef(true);

  // Format symbol helper
  const normalizeSymbol = useCallback((input) => formatSymbol(input), []);

  // Fetch historical data
  const loadHistoricalData = useCallback(async (sym, tf) => {
    try {
      setStatusText('VERİ ÇEKİLİYOR...');
      setError(null);

      const historical = await fetchKlines(sym, tf, 200);
      setCandles(historical);

      const tickerData = await fetch24hTicker(sym);
      setTicker(tickerData);

      setStatusText('BAĞLI');
      setIsConnected(true);

      return historical;
    } catch (err) {
      console.error('Historical data error:', err);
      setError(err.message);
      setStatusText('HATA');
      setIsConnected(false);
      setCandles([]);
      return [];
    }
  }, []);

  // Connect WebSocket
  const connectWebSocket = useCallback((sym, tf) => {
    // Cleanup previous
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const wsUrl = getWebSocketUrl(sym, tf);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (isMountedRef.current) {
        setIsConnected(true);
        setStatusText('BAĞLI');
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (!data.k) return;

        const k = data.k;
        const candleTime = k.t / 1000;

        const newCandle = {
          time: candleTime,
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
          volume: parseFloat(k.v),
        };

        const isFinal = k.x;

        setCandles((prevCandles) => {
          if (prevCandles.length === 0) return [newCandle];

          const last = prevCandles[prevCandles.length - 1];

          if (last.time === candleTime) {
            // Update current candle
            const updated = [...prevCandles];
            updated[updated.length - 1] = newCandle;
            return updated;
          } else if (isFinal || (last && last.time < candleTime)) {
            // New candle
            let updated = [...prevCandles, newCandle];
            if (updated.length > 400) {
              updated = updated.slice(-400);
            }
            return updated;
          }
          return prevCandles;
        });

        // Update live price
        const currentPrice = parseFloat(k.c);
        setTicker((prev) => ({
          ...prev,
          price: currentPrice,
        }));

        // Refresh 24h ticker every 30s
        const now = Date.now();
        if (now - lastUpdateRef.current > 30000) {
          lastUpdateRef.current = now;
          fetch24hTicker(sym)
            .then((t) => {
              if (isMountedRef.current) setTicker(t);
            })
            .catch(console.error);
        }
      } catch (e) {
        console.error('WS message error:', e);
      }
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      if (isMountedRef.current) {
        setIsConnected(false);
        setStatusText('SORUN');
      }
    };

    ws.onclose = () => {
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
      if (isMountedRef.current && isConnected) {
        setStatusText('YENİDEN BAĞLANIYOR...');
        setTimeout(() => {
          if (isMountedRef.current) {
            connectWebSocket(sym, tf);
          }
        }, 3000);
      }
    };
  }, [isConnected]);

  // Disconnect WS
  const disconnectWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Reconnect with new params
  const reconnect = useCallback(async (newSymbol, newTimeframe) => {
    disconnectWebSocket();
    setStatusText('BAĞLANILIYOR...');
    setIsConnected(false);

    const targetSymbol = newSymbol || symbol;
    const targetTf = newTimeframe || timeframe;

    await loadHistoricalData(targetSymbol, targetTf);
    connectWebSocket(targetSymbol, targetTf);
  }, [symbol, timeframe, loadHistoricalData, connectWebSocket, disconnectWebSocket]);

  // Public: change symbol
  const changeSymbol = useCallback(async (newInput) => {
    const newSym = normalizeSymbol(newInput);
    if (newSym === symbol) return;

    setSymbol(newSym);
    await reconnect(newSym, timeframe);
  }, [symbol, timeframe, reconnect, normalizeSymbol]);

  // Public: change timeframe
  const changeTimeframe = useCallback(async (newTf) => {
    if (newTf === timeframe) return;

    setTimeframe(newTf);
    await reconnect(symbol, newTf);
  }, [symbol, timeframe, reconnect]);

  // Initial load
  useEffect(() => {
    isMountedRef.current = true;

    const init = async () => {
      await loadHistoricalData(symbol, timeframe);
      connectWebSocket(symbol, timeframe);
    };

    init();

    return () => {
      isMountedRef.current = false;
      disconnectWebSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    // State
    symbol,
    timeframe,
    candles,
    ticker,
    isConnected,
    statusText,
    error,

    // Actions
    changeSymbol,
    changeTimeframe,
    reconnect: () => reconnect(symbol, timeframe),

    // Helpers
    normalizeSymbol,
  };
}
