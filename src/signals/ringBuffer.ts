/**
 * Generic sabit boyutlu ring buffer.
 * Bellek sızıntısını önlemek için sınırsız büyüme yok.
 */
export class RingBuffer<T> {
  _buffer: (T | undefined)[]
  _head: number = 0
  _size: number = 0
  _capacity: number

  constructor(capacity: number) {
    this._capacity = capacity
    this._buffer = new Array(capacity)
  }

  push(item: T): void {
    this._buffer[this._head] = item
    this._head = (this._head + 1) % this._capacity
    if (this._size < this._capacity) this._size++
  }

  /** En son eklenen öğe (head'den bir önceki) */
  last(): T | undefined {
    if (this._size === 0) return undefined
    const idx = (this._head - 1 + this._capacity) % this._capacity
    return this._buffer[idx]
  }

  /** Son N öğeyi kronolojik sırada döndürür */
  lastN(n: number): T[] {
    const count = Math.min(n, this._size)
    const result: T[] = []
    for (let i = count - 1; i >= 0; i--) {
      const idx = (this._head - 1 - i + this._capacity) % this._capacity
      const item = this._buffer[idx]
      if (item !== undefined) result.push(item)
    }
    return result
  }

  /** Tüm öğeleri kronolojik sırada döndürür */
  toArray(): T[] {
    return this.lastN(this._size)
  }

  get size(): number {
    return this._size
  }

  get isFull(): boolean {
    return this._size >= this._capacity
  }

  clear(): void {
    this._buffer = new Array(this._capacity)
    this._head = 0
    this._size = 0
  }
}
