// Technical Indicators & Signal Engine

/**
 * Compute Exponential Moving Average (EMA)
 */
export function computeEMA(data, period) {
  const result = new Array(data.length).fill(null);
  if (data.length < period) return result;

  // Start with SMA for the first EMA value
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i];
  }
  const multiplier = 2 / (period + 1);
  result[period - 1] = sum / period;

  for (let i = period; i < data.length; i++) {
    result[i] = (data[i] - result[i - 1]) * multiplier + result[i - 1];
  }

  return result;
}

/**
 * Calculate Cumulative Volume Delta (CVD)
 * Buy volume: close > open, Sell volume: close < open
 * Delta = buyVol - sellVol, CVD = running sum of delta
 */
export function computeCVD(candles) {
  const cvd = [];
  let cumulative = 0;

  for (const c of candles) {
    if (c.close >= c.open) {
      cumulative += c.volume;
    } else {
      cumulative -= c.volume;
    }
    cvd.push(cumulative);
  }

  return cvd;
}

/**
 * Find local peaks/troughs for divergence detection
 * Returns { peaks: [{index, price, cvd}], troughs: [{index, price, cvd}] }
 */
function findSwingPoints(candles, cvd, lookback = 5) {
  const peaks = [];
  const troughs = [];

  for (let i = lookback; i < candles.length - lookback; i++) {
    const price = candles[i].close;
    const cv = cvd[i];

    // Check if local high (peak)
    let isPeak = true;
    for (let j = 1; j <= lookback; j++) {
      if (candles[i - j].close >= price || candles[i + j].close >= price) {
        isPeak = false;
        break;
      }
    }

    if (isPeak) {
      peaks.push({ index: i, price, cvd: cv });
    }

    // Check if local low (trough)
    let isTrough = true;
    for (let j = 1; j <= lookback; j++) {
      if (candles[i - j].close <= price || candles[i + j].close <= price) {
        isTrough = false;
        break;
      }
    }

    if (isTrough) {
      troughs.push({ index: i, price, cvd: cv });
    }
  }

  return { peaks, troughs };
}

/**
 * Detect CVD divergence
 * - Bearish divergence: price higher high, CVD lower high → sell signal
 * - Bullish divergence: price lower low, CVD higher low → buy signal
 */
function detectDivergence(candles, cvd, lookback = 7) {
  const { peaks, troughs } = findSwingPoints(candles, cvd, lookback);
  const signals = [];

  // Bearish divergence: last 2 peaks, price up but CVD down
  if (peaks.length >= 2) {
    const p1 = peaks[peaks.length - 2];
    const p2 = peaks[peaks.length - 1];
    if (p2.price > p1.price && p2.cvd < p1.cvd) {
      signals.push({
        time: candles[p2.index].time,
        position: 'aboveBar',
        color: '#ef4444',
        shape: 'arrowDown',
        text: 'CVDS',
        size: 3,
      });
    }
  }

  // Bullish divergence: last 2 troughs, price down but CVD up
  if (troughs.length >= 2) {
    const t1 = troughs[troughs.length - 2];
    const t2 = troughs[troughs.length - 1];
    if (t2.price < t1.price && t2.cvd > t1.cvd) {
      signals.push({
        time: candles[t2.index].time,
        position: 'belowBar',
        color: '#22c55e',
        shape: 'arrowUp',
        text: 'CVDB',
        size: 3,
      });
    }
  }

  return signals;
}

/**
 * Generate EMA crossover signals
 */
function detectEMACross(candles, emaFast, emaSlow) {
  const signals = [];

  for (let i = 1; i < candles.length; i++) {
    const prevFast = emaFast[i - 1];
    const prevSlow = emaSlow[i - 1];
    const currFast = emaFast[i];
    const currSlow = emaSlow[i];

    if (prevFast == null || prevSlow == null || currFast == null || currSlow == null) continue;

    // Golden cross: fast crosses above slow → BUY
    if (prevFast <= prevSlow && currFast > currSlow) {
      signals.push({
        time: candles[i].time,
        position: 'belowBar',
        color: '#22c55e',
        shape: 'arrowUp',
        text: 'AL',
        size: 3,
      });
    }

    // Death cross: fast crosses below slow → SELL
    if (prevFast >= prevSlow && currFast < currSlow) {
      signals.push({
        time: candles[i].time,
        position: 'aboveBar',
        color: '#ef4444',
        shape: 'arrowDown',
        text: 'SAT',
        size: 3,
      });
    }
  }

  return signals;
}

/**
 * Detect volume-confirmed strong signals
 * Strong buy: EMA crossover up + volume spike + CVD rising
 * Strong sell: EMA crossover down + volume spike + CVD falling
 */
function detectStrongSignals(candles, cvd, emaFast, emaSlow) {
  const signals = [];
  const avgVol = candles.reduce((s, c) => s + c.volume, 0) / Math.max(candles.length, 1);

  for (let i = 3; i < candles.length; i++) {
    const prevFast = emaFast[i - 1];
    const prevSlow = emaSlow[i - 1];
    const currFast = emaFast[i];
    const currSlow = emaSlow[i];

    if (prevFast == null || prevSlow == null || currFast == null || currSlow == null) continue;

    const volSpike = candles[i].volume > avgVol * 1.5;
    const cvdRising = i >= 3 && cvd[i] > cvd[i - 3];
    const cvdFalling = i >= 3 && cvd[i] < cvd[i - 3];

    // Strong BUY
    if (prevFast <= prevSlow && currFast > currSlow && volSpike && cvdRising) {
      signals.push({
        time: candles[i].time,
        position: 'belowBar',
        color: '#00ff88',
        shape: 'arrowUp',
        text: '💪 AL',
        size: 4,
      });
    }

    // Strong SELL
    if (prevFast >= prevSlow && currFast < currSlow && volSpike && cvdFalling) {
      signals.push({
        time: candles[i].time,
        position: 'aboveBar',
        color: '#ff4444',
        shape: 'arrowDown',
        text: '💪 SAT',
        size: 4,
      });
    }
  }

  return signals;
}

/**
 * Main signal generator — combines all strategies
 * Returns an array of marker objects for Lightweight Charts
 */
export function generateSignals(candles) {
  if (candles.length < 30) return { markers: [], cvd: [], ema9: [], ema21: [] };

  const closes = candles.map((c) => c.close);
  const cvd = computeCVD(candles);
  const ema9 = computeEMA(closes, 9);
  const ema21 = computeEMA(closes, 21);

  const emaSignals = detectEMACross(candles, ema9, ema21);
  const cvdSignals = detectDivergence(candles, cvd);
  const strongSignals = detectStrongSignals(candles, cvd, ema9, ema21);

  // Merge all signals, deduplicate by time+position
  const allSignals = [...strongSignals, ...cvdSignals, ...emaSignals];
  const seen = new Set();
  const markers = [];

  for (const s of allSignals) {
    const key = `${s.time}-${s.position}`;
    if (!seen.has(key)) {
      seen.add(key);
      markers.push(s);
    }
  }

  // Sort by time
  markers.sort((a, b) => a.time - b.time);

  return {
    markers,
    cvd,
    ema9,
    ema21,
  };
}
