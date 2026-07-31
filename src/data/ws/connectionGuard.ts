/**
 * Connection-ID guard: her connect() çağrısı yeni bir connId üretir.
 * onmessage içinde gelen paket geçerli connId'ye ait değilse
 * (eski/zombi soket) işlenmez.
 */

let _nextId = 0

/** Yeni bir connection ID üretir */
export function generateConnId(): string {
  return `conn-${Date.now()}-${++_nextId}`
}

/**
 * Zombi paket filtresi: paket geçerli bağlantıya ait mi kontrol eder.
 * Her connect()'te yeni bir guard oluşturulur.
 */
export function createConnectionGuard(expectedConnId: string) {
  return function isCurrentConnection(connId: string): boolean {
    return connId === expectedConnId
  }
}

export type ConnectionGuard = ReturnType<typeof createConnectionGuard>
