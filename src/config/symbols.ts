/**
 * Sembol yönetimi — tüm USDT-M futures coinler.
 * `!ticker@arr` ve `!forceOrder@arr` global stream'ler ile
 * tüm coinler dinlenir. aggTrade/depth için dinamik abonelik yapılır.
 */
export const SYMBOL_POLL_INTERVAL_MS = 300_000 // 5dk — sembol listesini yenileme

/** Stream aboneliği için maksimum paralel sembol (aggTrade/depth) */
export const MAX_STREAMED_SYMBOLS = 40

/** Sembol başına ring buffer kapasitesi */
export const RING_BUFFER_CAPACITY = 300

/** Minimum günlük hacim (USDT) — altındaki coinler filtrelenir */
export const MIN_DAILY_VOLUME_USDT = 1_000_000

/** Binance Futures API taban URL */
export const BINANCE_FAPI_BASE = 'https://fapi.binance.com'

/** Binance WebSocket taban URL */
export const BINANCE_WS_BASE = 'wss://fstream.binance.com'

/** Dinamik sembol listesi için REST endpoint */
export const TICKER_24HR_URL = `${BINANCE_FAPI_BASE}/fapi/v1/ticker/24hr`

/** Funding rate REST endpoint (sembol bazlı) */
export const FUNDING_RATE_URL = `${BINANCE_FAPI_BASE}/fapi/v1/premiumIndex`

/** Funding rate poll aralığı (ms) */
export const FUNDING_POLL_INTERVAL_MS = 60_000
