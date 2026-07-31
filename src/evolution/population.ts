/**
 * N bireylik parametre popülasyonu.
 * Her birey bir parametre seti = bir sinyal stratejisi.
 * Anlık evrim: her sinyal kapandığında tetiklenir.
 */

import { evolutionConfig } from '../config/evolutionConfig'
import type { ClosedSignal, FitnessResult } from './fitness'
import { computeFitness } from './fitness'
import { selectAndEvolve } from './selection'

/**
 * Bir bireyin parametreleri (sinyal stratejisi).
 * Her biri, evrimle optimize edilebilen sürekli bir değer.
 */
export interface Individual {
  /** Benzersiz birey ID'si */
  id: string
  /** Oluşturulduğu nesil */
  generation: number
  /** CVD ağırlığı (0..1) */
  weightCvd: number
  /** OBI ağırlığı (0..1) */
  weightObi: number
  /** Likidasyon ağırlığı (0..1) */
  weightLiquidation: number
  /** Funding ağırlığı (0..1) */
  weightFunding: number
  /** Momentum ağırlığı (0..1) */
  weightMomentum: number
  /** Hacim ağırlığı (0..1) */
  weightVolume: number
  /** Sinyal tetikleme eşiği (10..60) */
  signalThreshold: number
  /** Histerezis teyit sayısı (1..4) */
  hysteresisConfirmations: number
  /** Fitness sonucu (undefined = henüz değerlendirilmedi) */
  fitness?: FitnessResult
  /** Kapanmış sinyaller (bu bireyin ürettiği) */
  closedSignals: ClosedSignal[]
  /** Coin (hangi coin için optimize edildiği) */
  coin: string
}

export interface Generation {
  /** Nesil numarası */
  number: number
  /** Bu nesildeki bireyler */
  individuals: Individual[]
  /** En iyi birey */
  best: Individual
  /** Oluşturulma zamanı */
  timestamp: number
  /** Nesil fitness ortalaması */
  avgFitness: number
}

let nextId = 1

function generateId(): string {
  return `ind-${Date.now()}-${nextId++}`
}

/** Normal dağılımdan rastgele sayı (Box-Muller) */
function randomNormal(mean = 0, stdDev = 1): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return mean + stdDev * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

/** Rastgele bir birey oluştur */
export function createRandomIndividual(coin: string, generation: number): Individual {
  return {
    id: generateId(),
    generation,
    weightCvd: Math.random(),
    weightObi: Math.random(),
    weightLiquidation: Math.random(),
    weightFunding: Math.random(),
    weightMomentum: Math.random(),
    weightVolume: Math.random(),
    signalThreshold: 15 + Math.random() * 35,  // 15..50
    hysteresisConfirmations: 1 + Math.floor(Math.random() * 3),  // 1..3
    closedSignals: [],
    coin,
  }
}

/** İlk popülasyonu oluştur */
export function createInitialPopulation(coin: string): Generation {
  const individuals: Individual[] = []
  for (let i = 0; i < evolutionConfig.populationSize; i++) {
    individuals.push(createRandomIndividual(coin, 0))
  }
  // İlk nesilde best yok, boş fitness
  return {
    number: 0,
    individuals,
    best: individuals[0],
    timestamp: Date.now(),
    avgFitness: 0,
  }
}

/** Bireyi mutasyona uğrat */
export function mutateIndividual(parent: Individual): Individual {
  const child: Individual = {
    ...parent,
    id: generateId(),
    generation: parent.generation + 1,
    closedSignals: [],
    fitness: undefined,
  }

  const mutationRate = evolutionConfig.mutationRate
  const scale = evolutionConfig.mutationScale

  const mutate = (value: number, min: number, max: number): number => {
    if (Math.random() < mutationRate) {
      const delta = randomNormal(0, scale * (max - min))
      return Math.max(min, Math.min(max, value + delta))
    }
    return value
  }

  child.weightCvd = mutate(child.weightCvd, 0, 1)
  child.weightObi = mutate(child.weightObi, 0, 1)
  child.weightLiquidation = mutate(child.weightLiquidation, 0, 1)
  child.weightFunding = mutate(child.weightFunding, 0, 1)
  child.weightMomentum = mutate(child.weightMomentum, 0, 1)
  child.weightVolume = mutate(child.weightVolume, 0, 1)
  child.signalThreshold = mutate(child.signalThreshold, 10, 60)
  child.hysteresisConfirmations = Math.round(mutate(child.hysteresisConfirmations, 1, 4))

  return child
}

/** Tüm popülasyonu fitness'a göre sırala (azalan) */
export function rankPopulation(individuals: Individual[]): Individual[] {
  return [...individuals].sort((a, b) => {
    const fa = a.fitness?.fitness ?? 0
    const fb = b.fitness?.fitness ?? 0
    return fb - fa
  })
}

/** Popülasyonu değerlendir (tüm bireylerin fitness'ını hesapla) */
export function evaluatePopulation(individuals: Individual[]): Individual[] {
  return individuals.map(ind => ({
    ...ind,
    fitness: computeFitness(ind.closedSignals),
  }))
}

/** Rollback kontrolü: yeni nesil istatistiksel olarak kötü mü? */
export function shouldRollback(
  prevGen: Generation,
  newGen: Generation,
): boolean {
  if (prevGen.individuals.length === 0) return false

  const prevBestFitness = prevGen.best.fitness?.fitness ?? 0
  const newBestFitness = newGen.best.fitness?.fitness ?? 0

  const prevWil = prevGen.best.fitness?.wilsonAdjustedRate ?? 0
  const newWil = newGen.best.fitness?.wilsonAdjustedRate ?? 0

  // Wilson alt sınırında anlamlı düşüş
  if (newWil < prevWil - 0.1) return true

  // Fitness'ta anlamlı düşüş
  if (newBestFitness < prevBestFitness - evolutionConfig.rollbackThreshold) return true

  return false
}

/**
 * Anlık evrim döngüsü:
 * - Bir sinyal kapandığında, onu üreten bireye kaydet
 * - Tüm bireyler için değerlendir
 * - Popülasyonu sırala, en kötüleri ele, en iyileri mutasyona uğrat
 * - Yeni nesil oluştur
 */
export function evolveGeneration(
  prevGen: Generation,
  newSignal: ClosedSignal,
  targetCoin: string,
): { generation: Generation; rolledBack: boolean } {
  // Yeni sinyali tüm bireylerin listesine ekle (paper-trade simülasyonu için)
  const updatedIndividuals = prevGen.individuals.map(ind => ({
    ...ind,
    closedSignals: [...ind.closedSignals, newSignal],
  }))

  // Fitness hesapla
  const evaluated = evaluatePopulation(updatedIndividuals)
  const ranked = rankPopulation(evaluated)

  // Yeni nesil oluştur
  const newIndividuals = selectAndEvolve(ranked, targetCoin, prevGen.number + 1)

  const best = newIndividuals[0]
  const avgFitness = newIndividuals.reduce((sum, ind) => sum + (ind.fitness?.fitness ?? 0), 0) / newIndividuals.length

  const newGen: Generation = {
    number: prevGen.number + 1,
    individuals: newIndividuals,
    best,
    timestamp: Date.now(),
    avgFitness,
  }

  return { generation: newGen, rolledBack: false }
}

/** Belirli bir coin için popülasyonu sıfırla */
export function resetPopulation(coin: string): Generation {
  return createInitialPopulation(coin)
}
