import { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

export default function Chart({ candles, onChartReady }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candlestickSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);

  // Create chart instance
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight || 420,
      layout: {
        background: { color: '#14141c' },
        textColor: '#c9d1d9',
      },
      grid: {
        vertLines: { color: '#2a2a35' },
        horzLines: { color: '#2a2a35' },
      },
      crosshair: {
        mode: 0, // Normal
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

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    const volumeSeries = chart.addHistogramSeries({
      color: '#3b82f6',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;

    // Resize handler
    const handleResize = () => {
      if (chart && container.clientWidth > 0) {
        const newHeight = container.clientHeight || 420;
        chart.resize(container.clientWidth, newHeight);
      }
    };

    window.addEventListener('resize', handleResize);

    // Initial fit
    setTimeout(() => {
      if (chart) chart.timeScale().fitContent();
    }, 100);

    // Expose for parent if needed
    if (onChartReady) {
      onChartReady({ chart, candlestickSeries, volumeSeries });
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [onChartReady]);

  // Update data when candles change
  useEffect(() => {
    if (!candles.length || !candlestickSeriesRef.current || !volumeSeriesRef.current) return;

    const cSeries = candlestickSeriesRef.current;
    const vSeries = volumeSeriesRef.current;

    cSeries.setData(candles);

    const volumeData = candles.map((c) => ({
      time: c.time,
      value: c.volume,
      color: c.close >= c.open 
        ? 'rgba(34, 197, 94, 0.5)' 
        : 'rgba(239, 68, 68, 0.5)',
    }));

    vSeries.setData(volumeData);

    // Fit content on initial load
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [candles]);

  return (
    <div 
      ref={chartContainerRef} 
      className="chart-container"
      style={{ width: '100%', height: '100%', minHeight: '420px' }}
    />
  );
}
