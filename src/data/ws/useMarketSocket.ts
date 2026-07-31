/**
 * /market WebSocket yönetimi:
 * aggTrade (seçili semboller), kline_1m, !ticker@arr, !forceOrder@arr
 *
 * Connection-ID guard + exponential backoff + watchdog entegre.
 * React hook değil, saf TS modülü — Zustand store'a yazılacak callback'ler alır.
 */

import { BINANCE_WS_BASE } from '../../config/symbols'
import { generateConnId, createConnectionGuard, type ConnectionGuard } from './connectionGuard'
import { createBackoff, type Backoff } from './backoff'
import { createWatchdog, type Watchdog } from './watchdog'

/** Binance WebSocket stream mesaj tipi */
export interface MarketStreamMessage {
  stream: string
  data: TickerData | AggTradeData | KlineData | ForceOrderData
}

export interface TickerData {
  e: '24hrTicker'
  s: string      // symbol
  c: string      // last price
  h: string      // high
  l: string      // low
  v: string      // volume
  q: string      // quote volume
  P: string      // price change percent
  E: number      // event time
}

export interface AggTradeData {
  e: 'aggTrade'
  s: string      // symbol
  p: string      // price
  q: string      // quantity
  m: boolean     // maker/taker (true = market buy)
  T: number      // trade time
}

export interface KlineData {
  e: 'kline'
  s: string      // symbol
  k: {
    t: number    // kline start time
    o: string    // open
    c: string    // close
    h: string    // high
    l: string    // low
    v: string    // volume
    x: boolean   // is closed
  }
}

export interface ForceOrderData {
  e: 'forceOrder'
  o: {
    s: string    // symbol
    S: 'BUY' | 'SELL'  // side
    v: string    // quantity
    p: string    // price
    T: number    // time
  }
}

export type MarketMessageHandler = (msg: MarketStreamMessage) => void

export interface MarketSocketCallbacks {
  onTicker: (data: TickerData) => void
  onAggTrade: (data: AggTradeData) => void
  onKline: (data: KlineData) => void
  onForceOrder: (data: ForceOrderData) => void
  onStatusChange: (status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting') => void
  onError: (error: string) => void
}

export interface MarketSocketController {
  connect: (extraStreams?: string[]) => void
  disconnect: () => void
  subscribe: (streams: string[]) => void
  unsubscribe: (streams: string[]) => void
  getStatus: () => 'idle' | 'connecting' | 'connected' | 'disconnected' | 'reconnecting'
}

const WATCHDOG_SILENCE_MS = 15_000 // 15sn sessizlik → reconnect
const MARKET_WS_URL = `${BINANCE_WS_BASE}/stream?streams=`

export function createMarketSocket(callbacks: MarketSocketCallbacks): MarketSocketController {
  let ws: WebSocket | null = null
  let connId = ''
  let guard: ConnectionGuard = () => false
  const backoff: Backoff = createBackoff()
  let watchdog: Watchdog | null = null
  let status: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'reconnecting' = 'idle'
  let activeStreams: string[] = []
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  function setStatus(s: 'connecting' | 'connected' | 'disconnected' | 'reconnecting') {
    status = s
    callbacks.onStatusChange(s)
  }

  function dispatchMessage(msg: MarketStreamMessage) {
    const { data } = msg
    if (!data || !data.e) return

    switch (data.e) {
      case '24hrTicker': callbacks.onTicker(data as TickerData); break
      case 'aggTrade': callbacks.onAggTrade(data as AggTradeData); break
      case 'kline': callbacks.onKline(data as KlineData); break
      case 'forceOrder': callbacks.onForceOrder(data as ForceOrderData); break
    }
  }

  function buildUrl(streams: string[]): string {
    return MARKET_WS_URL + streams.join('/')
  }

  function doConnect(streams: string[]) {
    if (ws) {
      ws.onclose = null
      ws.close()
    }

    connId = generateConnId()
    guard = createConnectionGuard(connId)
    activeStreams = streams
    setStatus('connecting')

    const url = buildUrl(streams)
    ws = new WebSocket(url)

    ws.onopen = () => {
      if (!guard(connId)) return
      backoff.reset()
      setStatus('connected')

      watchdog = createWatchdog({
        silenceThresholdMs: WATCHDOG_SILENCE_MS,
        onTimeout: () => {
          console.warn('[MarketSocket] Watchdog tetiklendi, reconnect...')
          doReconnect()
        },
      })
      watchdog.feed()
    }

    ws.onmessage = (event) => {
      if (!guard(connId)) {
        console.debug('[MarketSocket] Zombi paket atlandı')
        return
      }
      try {
        const msg: MarketStreamMessage = JSON.parse(event.data as string)
        dispatchMessage(msg)
        watchdog?.feed()
      } catch (err) {
        // ignore parse errors
      }
    }

    ws.onerror = () => {
      callbacks.onError('Market WebSocket hatası')
    }

    ws.onclose = () => {
      watchdog?.destroy()
      if (guard(connId)) {
        doReconnect()
      }
    }
  }

  function doReconnect() {
    if (status === 'reconnecting') return
    setStatus('reconnecting')
    const { delayMs } = backoff.next()
    console.log(`[MarketSocket] ${delayMs}ms sonra yeniden bağlanıyor (deneme #${backoff.getAttempt()})...`)
    reconnectTimer = setTimeout(() => {
      doConnect(activeStreams)
    }, delayMs)
  }

  function connect(extraStreams?: string[]) {
    const base = ['!ticker@arr', '!forceOrder@arr']
    const all = extraStreams ? [...base, ...extraStreams] : base
    doConnect(all)
  }

  function disconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    watchdog?.destroy()
    if (ws) {
      ws.onclose = null // prevent reconnect
      ws.close()
      ws = null
    }
    setStatus('disconnected')
  }

  function subscribe(streams: string[]) {
    const newStreams = [...new Set([...activeStreams, ...streams])]
    if (newStreams.length !== activeStreams.length) {
      activeStreams = newStreams
      doConnect(activeStreams)
    }
  }

  function unsubscribe(streams: string[]) {
    const set = new Set(streams)
    const newStreams = activeStreams.filter(s => !set.has(s))
    if (newStreams.length !== activeStreams.length) {
      activeStreams = newStreams
      doConnect(activeStreams)
    }
  }

  function getStatus() {
    return status
  }

  return { connect, disconnect, subscribe, unsubscribe, getStatus }
}
