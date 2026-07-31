import { useEffect, useRef } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  createSeriesMarkers,
} from 'lightweight-charts';

export default function Chart({ candles, signals }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candlestickSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const cvdSeriesRef = useRef(null);
  const ema9SeriesRef = useRef(null);
  const ema21SeriesRef = useRef(null);
  const markersRef = useRef(null);

  const seriesReady = useRef(false);

  // Create chart instance — only once on mount
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight || 520,
      layout: {
        background: { color: '#14141c' },
        textColor: '#c9d1d9',
      },
      grid: {
        vertLines: { color: '#2a2a35' },
        horzLines: { color: '#2a2a35' },
      },
      crosshair: {
        mode: 0,
      },
      rightPriceScale: {
        borderColor: '#2a2a35',
      },
      timeScale: {
        borderColor: '#2a2a35',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    // --- Candlestick series ---
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    // --- Volume histogram ---
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#3b82f6',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.84, bottom: 0 },
    });

    // --- CVD line ---
    const cvdSeries = chart.addSeries(LineSeries, {
      color: '#f59e0b',
      lineWidth: 2,
      priceScaleId: 'cvd',
    });
    chart.priceScale('cvd').applyOptions({
      scaleMargins: { top: 0.75, bottom: 0.14 },
    });

    // --- EMA 9 line ---
    const ema9Series = chart.addSeries(LineSeries, {
      color: '#a78bfa',
      lineWidth: 1.5,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    // --- EMA 21 line ---
    const ema21Series = chart.addSeries(LineSeries, {
      color: '#60a5fa',
      lineWidth: 1.5,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    // --- Signal markers (v5 API: createSeriesMarkers) ---
    const markers = createSeriesMarkers(candlestickSeries, []);

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;
    cvdSeriesRef.current = cvdSeries;
    ema9SeriesRef.current = ema9Series;
    ema21SeriesRef.current = ema21Series;
    markersRef.current = markers;
    seriesReady.current = true;

    // Resize handler
    const handleResize = () => {
      if (chart && container.clientWidth > 0) {
        const newHeight = container.clientHeight || 520;
        chart.resize(container.clientWidth, newHeight);
      }
    };

    window.addEventListener('resize', handleResize);

    setTimeout(() => {
      if (chart) chart.timeScale().fitContent();
    }, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      seriesReady.current = false;
    };
  }, []); // ⬅️ empty deps: runs once, never re-creates

  // Update candlestick + volume
  useEffect(() => {
    if (!candles.length || !seriesReady.current) return;

    const cSeries = candlestickSeriesRef.current;
    const vSeries = volumeSeriesRef.current;

    if (!cSeries || !vSeries) return;

    cSeries.setData(candles);

    const volumeData = candles.map((c) => ({
      time: c.time,
      value: c.volume,
      color: c.close >= c.open
        ? 'rgba(34, 197, 94, 0.5)'
        : 'rgba(239, 68, 68, 0.5)',
    }));

    vSeries.setData(volumeData);
  }, [candles]);

  // Update CVD + EMAs + Markers when signals change
  useEffect(() => {
    if (!signals || !candles.length || !seriesReady.current) return;

    const cSeries = candlestickSeriesRef.current;
    const cvdS = cvdSeriesRef.current;
    const e9S = ema9SeriesRef.current;
    const e21S = ema21SeriesRef.current;

    if (!cSeries || !cvdS || !e9S || !e21S) return;

    // CVD data
    if (signals.cvd && signals.cvd.length > 0) {
      const cvdData = signals.cvd.map((val, i) => ({
        time: candles[i].time,
        value: val,
      }));
      cvdS.setData(cvdData);
    } else {
      cvdS.setData([]);
    }

    // EMA 9
    if (signals.ema9 && signals.ema9.length > 0) {
      const ema9Data = signals.ema9
        .map((val, i) => (val != null ? { time: candles[i].time, value: val } : null))
        .filter(Boolean);
      e9S.setData(ema9Data);
    } else {
      e9S.setData([]);
    }

    // EMA 21
    if (signals.ema21 && signals.ema21.length > 0) {
      const ema21Data = signals.ema21
        .map((val, i) => (val != null ? { time: candles[i].time, value: val } : null))
        .filter(Boolean);
      e21S.setData(ema21Data);
    } else {
      e21S.setData([]);
    }

    // Signal markers
    if (markersRef.current) {
      markersRef.current.setMarkers(
        signals.markers && signals.markers.length > 0 ? signals.markers : []
      );
    }

    // Fit
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [signals, candles]);

  return (
    <div
      ref={chartContainerRef}
      className="chart-container"
      style={{ width: '100%', height: '100%', minHeight: '520px' }}
    />
  );
}
