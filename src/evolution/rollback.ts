/**
 * Rollback mekanizması: istatistiksel anlamlı kötüleşmede geri alma.
 * Kör kör kaydırma yok — Wilson score ve fitness karşılaştırmasıyla karar.
 */

import type { Generation } from './population'
import { shouldRollback } from './population'

export interface RollbackState {
  /** Önceki (kararlı) nesil */
  stableGeneration: Generation | null
  /** Son değerlendirilen nesil */
  currentGeneration: Generation | null
  /** Rollback sayacı (kaç kez geri alındı) */
  rollbackCount: number
  /** Son rollback zamanı */
  lastRollbackTime: number
}

export function createRollbackState(): RollbackState {
  return {
    stableGeneration: null,
    currentGeneration: null,
    rollbackCount: 0,
    lastRollbackTime: 0,
  }
}

/**
 * Yeni bir nesli değerlendir ve gerekirse rollback yap.
 * @returns güncel (kararlı) nesil ve rollback yapıldı mı bilgisi
 */
export function evaluateAndMaybeRollback(
  state: RollbackState,
  newGeneration: Generation,
): { generation: Generation; rolledBack: boolean } {
  // İlk nesil — doğrudan kabul
  if (!state.currentGeneration) {
    state.currentGeneration = newGeneration
    state.stableGeneration = newGeneration
    return { generation: newGeneration, rolledBack: false }
  }

  const prevGen = state.currentGeneration

  if (shouldRollback(prevGen, newGeneration)) {
    console.warn(
      `[Rollback] Nesil #${newGeneration.number} kötüleşti, ` +
      `önceki nesle (#${prevGen.number}) dönülüyor. ` +
      `Eski fitness: ${prevGen.best.fitness?.fitness?.toFixed(4)}, ` +
      `Yeni fitness: ${newGeneration.best.fitness?.fitness?.toFixed(4)}`
    )

    state.rollbackCount++
    state.lastRollbackTime = Date.now()
    state.currentGeneration = prevGen

    return { generation: prevGen, rolledBack: true }
  }

  // İyileşme var — yeni nesli kabul et
  state.currentGeneration = newGeneration
  state.stableGeneration = newGeneration

  return { generation: newGeneration, rolledBack: false }
}
