export const COZY_FARM_FRUITS = [
  'dragonfruit',
  'carrot',
  'bamboo',
  'phantom',
  'cranberry',
  'orange',
] as const

export type CozyFarmFruit = (typeof COZY_FARM_FRUITS)[number]

export type SlotSelection = {
  id: number
  fruit: CozyFarmFruit
  value: number
  /** Fertilizer already on the crop from previous stages (new farm: weight carries over). */
  fertilizer: number
}

export type SlotResult = SlotSelection & {
  fertilizerAdded: number
  weight: number
  coins: number
}

export type OptimizeInput = {
  /** New fertilizers available for this 12h stage. */
  totalFertilizers: number
  wateredTimes: number
  cropValues: Record<CozyFarmFruit, number>
  slots: CozyFarmFruit[]
  /** Fertilizer already applied per slot (continues across stages). */
  initialFertilizer?: number[]
}

export type OptimizeResult = {
  slots: SlotResult[]
  totalCoins: number
}

/** Continuous growth curve (ported formula mode). No table cap — suited to multi-stage farm. */
export function getCropWeight(fertilizer: number): number {
  const f = Math.max(0, fertilizer)
  return f > 0 ? 5 + 16 * Math.pow(f, 0.4246) : 5
}

/**
 * Greedy fertilizer allocation for the current stage.
 * Starts from `initialFertilizer` so later stages keep growing the same crops
 * while coin/bonus values can change every 12h.
 */
export function optimizeCozyFarm(input: OptimizeInput): OptimizeResult {
  const watered = Math.min(3, Math.max(0, Math.floor(input.wateredTimes)))
  const waterBonusWeight = watered * 2
  const totalF = Math.max(0, Math.floor(input.totalFertilizers))
  const initials = input.initialFertilizer ?? []

  const slotSelections: SlotSelection[] = input.slots.slice(0, 6).map((fruit, index) => ({
    id: index + 1,
    fruit,
    value: input.cropValues[fruit] ?? 0,
    fertilizer: Math.max(0, Math.floor(initials[index] ?? 0)),
  }))

  while (slotSelections.length < 6) {
    const fruit = COZY_FARM_FRUITS[0]!
    const index = slotSelections.length
    slotSelections.push({
      id: index + 1,
      fruit,
      value: input.cropValues[fruit] ?? 0,
      fertilizer: Math.max(0, Math.floor(initials[index] ?? 0)),
    })
  }

  const startFertilizer = slotSelections.map((s) => s.fertilizer)

  for (let step = 0; step < totalF; step++) {
    let bestGain = -Infinity
    let bestSlotIdx = -1

    for (let i = 0; i < slotSelections.length; i++) {
      const slot = slotSelections[i]!
      const currentF = slot.fertilizer

      const currentWeight = getCropWeight(currentF)
      const nextWeight = getCropWeight(currentF + 1)
      const marginalGain = slot.value * (nextWeight - currentWeight)

      const isSignificantlyBetter = marginalGain > bestGain + 0.00001
      const isRoughlyEqual = Math.abs(marginalGain - bestGain) < 0.00001
      const hasFewerFertilizers =
        bestSlotIdx !== -1 && slot.fertilizer < slotSelections[bestSlotIdx]!.fertilizer

      if (isSignificantlyBetter || (isRoughlyEqual && hasFewerFertilizers)) {
        bestGain = marginalGain
        bestSlotIdx = i
      }
    }

    if (bestSlotIdx !== -1 && bestGain >= 0) {
      slotSelections[bestSlotIdx]!.fertilizer += 1
    } else {
      break
    }
  }

  let totalCoins = 0
  const slots: SlotResult[] = slotSelections.map((slot, index) => {
    const weight = getCropWeight(slot.fertilizer) + waterBonusWeight
    const coins = Math.floor(weight * slot.value)
    totalCoins += coins
    return {
      ...slot,
      fertilizerAdded: slot.fertilizer - (startFertilizer[index] ?? 0),
      weight,
      coins,
    }
  })

  return { slots, totalCoins }
}
