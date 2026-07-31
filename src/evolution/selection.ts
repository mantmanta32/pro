/**
 * Seçilim + mutasyon: elitizm + turnuva seçimi + mutasyon.
 * Her evrim döngüsünde en kötü performanslı bireyler elenir,
 * en iyilerin mutasyonlarıyla değiştirilir.
 */

import { evolutionConfig } from '../config/evolutionConfig'
import type { Individual } from './population'
import { mutateIndividual } from './population'

/**
 * Seçilim + evrim:
 * - En iyi N bireyi doğrudan aktar (elitizm)
 * - Kalanları, en iyilerin mutasyonuyla doldur
 */
export function selectAndEvolve(
  ranked: Individual[], // fitness'a göre azalan sıralı
  _coin: string,
  nextGeneration: number,
): Individual[] {
  const popSize = evolutionConfig.populationSize
  const eliteCount = evolutionConfig.elitismCount

  const nextPop: Individual[] = []

  // Elitizm: en iyileri doğrudan aktar
  for (let i = 0; i < Math.min(eliteCount, ranked.length); i++) {
    nextPop.push({
      ...ranked[i],
      generation: nextGeneration,
      id: `${ranked[i].id}-e`, // elit olarak işaretle
    })
  }

  // Kalanları turnuva seçimi + mutasyon ile doldur
  while (nextPop.length < popSize) {
    const parent = tournamentSelect(ranked)
    const child = mutateIndividual(parent)
    nextPop.push(child)
  }

  // Fitness'ları sıfırla (yeni nesil)
  return nextPop.map(ind => ({ ...ind, fitness: undefined }))
}

/**
 * Turnuva seçimi: rastgele 3 birey seç, en iyisini döndür.
 */
function tournamentSelect(ranked: Individual[], tournamentSize = 3): Individual {
  let best: Individual | null = null

  for (let i = 0; i < tournamentSize; i++) {
    const idx = Math.floor(Math.random() * ranked.length)
    const candidate = ranked[idx]
    if (!best || (candidate.fitness?.fitness ?? 0) > (best.fitness?.fitness ?? 0)) {
      best = candidate
    }
  }

  return best!
}

/**
 * Rulet çarkı seçimi (fitness-orantılı).
 * Alternatif seçim yöntemi, şimdilik turnuva kullanılıyor.
 */
export function rouletteSelect(ranked: Individual[]): Individual {
  const totalFitness = ranked.reduce((sum, ind) => sum + (ind.fitness?.fitness ?? 0.01), 0)
  let r = Math.random() * totalFitness

  for (const ind of ranked) {
    r -= (ind.fitness?.fitness ?? 0.01)
    if (r <= 0) return ind
  }

  return ranked[ranked.length - 1]
}
