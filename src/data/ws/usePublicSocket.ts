/**
 * /public WebSocket yönetimi:
 * depth@100ms (seçili semboller için OBI hesaplama)
 *
 * Connection-ID guard + exponential backoff + watchdog entegre.
 */

import { BINANCE_WS_BASE } from '../../config/symbols'
import { generateConnId, createConnectionGuard, type ConnectionGuard } from './connectionGuard'
import { createBackoff, type Backoff } from './backoff'
import { createWatchdog, type Watchdog } from './watchdog'

export interface DepthData {
  e: 'depthUpdate'
  s: string           // symbol
  U: number           // first update id
  u: number           // final update id
  b: [string, string][]  // bids [price, qty]
  a: [string, string][]  // asks [price, qty]
}

export type DepthMessageHandler = (data: DepthData) => void

export interface PublicSocketCallbacks {
  onDepth: (data: DepthData) => void
  onStatusChange: (status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting') => void
  onError: (error: string) => void
}

export interface PublicSocketController {
  connect: (symbols: string[]) => void
  disconnect: () => void
  addSymbols: (symbols: string[]) => void
  removeSymbols: (symbols: string[]) => void
  getStatus: () => 'idle' | 'connecting' | 'connected' | 'disconnected' | 'reconnecting'
}

const WATCHDOG_SILENCE_MS = 15_000
const PUBLIC_WS_URL = `${BINANCE_WS_BASE}/stream?streams=`

export function createPublicSocket(callbacks: PublicSocketCallbacks): PublicSocketController {
  let ws: WebSocket | null = null
  let connId = ''
  let guard: ConnectionGuard = () => false
  const backoff: Backoff = createBackoff()
  let watchdog: Watchdog | null = null
  let status: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'reconnecting' = 'idle'
  let activeSymbols: string[] = []
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  function setStatus(s: 'connecting' | 'connected' | 'disconnected' | 'reconnecting') {
    status = s
    callbacks.onStatusChange(s)
  }

  function buildUrl(symbols: string[]): string {
    const streams = symbols.map(s => `${s.toLowerCase()}@depth@100ms`)
    return PUBLIC_WS_URL + streams.join('/')
  }

  function doConnect(symbols: string[]) {
    if (ws) {
      ws.onclose = null
      ws.close()
    }

    if (symbols.length === 0) {
      setStatus('disconnected')
      return
    }

    connId = generateConnId()
    guard = createConnectionGuard(connId)
    activeSymbols = symbols
    setStatus('connecting')

    const url = buildUrl(symbols)
    ws = new WebSocket(url)

    ws.onopen = () => {
      if (!guard(connId)) return
      backoff.reset()
      setStatus('connected')

      watchdog = createWatchdog({
        silenceThresholdMs: WATCHDOG_SILENCE_MS,
        onTimeout: () => {
          console.warn('[PublicSocket] Watchdog tetiklendi, reconnect...')
          doReconnect()
        },
      })
      watchdog.feed()
    }

    ws.onmessage = (event) => {
      if (!guard(connId)) return
      try {
        const msg = JSON.parse(event.data as string)
        if (msg.data && msg.data.e === 'depthUpdate') {
          callbacks.onDepth(msg.data as DepthData)
        }
        watchdog?.feed()
      } catch { /* ignore */ }
    }

    ws.onerror = () => callbacks.onError('Public WebSocket hatası')

    ws.onclose = () => {
      watchdog?.destroy()
      if (guard(connId)) doReconnect()
    }
  }

  function doReconnect() {
    if (status === 'reconnecting') return
    setStatus('reconnecting')
    const { delayMs } = backoff.next()
    reconnectTimer = setTimeout(() => doConnect(activeSymbols), delayMs)
  }

  function connect(symbols: string[]) {
    doConnect(symbols)
  }

  function disconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    watchdog?.destroy()
    if (ws) { ws.onclose = null; ws.close(); ws = null }
    setStatus('disconnected')
  }

  function addSymbols(symbols: string[]) {
    const merged = [...new Set([...activeSymbols, ...symbols])]
    if (merged.length !== activeSymbols.length) doConnect(merged)
  }

  function removeSymbols(symbols: string[]) {
    const set = new Set(symbols.map(s => s.toLowerCase()))
    const filtered = activeSymbols.filter(s => !set.has(s.toLowerCase()))
    if (filtered.length !== activeSymbols.length) doConnect(filtered)
  }

  function getStatus() { return status }

  return { connect, disconnect, addSymbols, removeSymbols, getStatus }
}
