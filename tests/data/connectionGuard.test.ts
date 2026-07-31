import { describe, it, expect } from 'vitest'
import { generateConnId, createConnectionGuard } from '../../src/data/ws/connectionGuard'

describe('generateConnId', () => {
  it('generates unique IDs', () => {
    const id1 = generateConnId()
    const id2 = generateConnId()
    expect(id1).not.toBe(id2)
  })

  it('includes conn- prefix', () => {
    const id = generateConnId()
    expect(id).toMatch(/^conn-/)
  })
})

describe('createConnectionGuard', () => {
  it('returns true for matching connId', () => {
    const id = generateConnId()
    const guard = createConnectionGuard(id)
    expect(guard(id)).toBe(true)
  })

  it('returns false for different connId', () => {
    const id = generateConnId()
    const guard = createConnectionGuard(id)
    expect(guard('conn-old-123')).toBe(false)
  })

  it('filters zombie packets', () => {
    const oldId = 'conn-old'
    const newId = 'conn-new'
    const guard = createConnectionGuard(newId)

    // Eski bağlantıdan gelen paket filtrelenmeli
    expect(guard(oldId)).toBe(false)
    // Yeni bağlantıdan gelen paket geçmeli
    expect(guard(newId)).toBe(true)
  })
})
