/** tatary.xyz snapshot (`targets` + `pets`) → our cozy-farm support import format. */

export const TATARY_PID_TO_BONUS = {
  13: 'bonusDragonfruit',
  28: 'bonusBamboo',
  55: 'bonusCranberry',
  21: 'bonusCarrot',
  56: 'bonusPhantom',
  58: 'bonusOrange',
} as const

/** tatary.xyz 100% equals our 263%. */
export const TATARY_RATE_SCALE = 263 / 100

export type CozyFarmSupportListing = {
  gameUid: string
  bonusDragonfruit?: number | null
  bonusCarrot?: number | null
  bonusBamboo?: number | null
  bonusPhantom?: number | null
  bonusCranberry?: number | null
  bonusOrange?: number | null
}

export type CozyFarmSupportBackup = {
  version: number
  exportedAt?: string
  listings: CozyFarmSupportListing[]
}

type ForeignPet = { pid?: unknown; rate?: unknown }
type ForeignTarget = { gid?: unknown; pets?: unknown }

function isForeignSnapshot(value: unknown): value is { targets: ForeignTarget[] } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const targets = (value as { targets?: unknown }).targets
  return Array.isArray(targets)
}

function scaleRate(rate: number): number {
  return Math.floor((rate * 263) / 100)
}

export function fromTatarySnapshot(raw: unknown): CozyFarmSupportBackup | null {
  if (!isForeignSnapshot(raw)) return null

  const listings: CozyFarmSupportListing[] = []
  const seen = new Set<string>()

  for (const target of raw.targets) {
    const gameUid =
      typeof target.gid === 'string' || typeof target.gid === 'number'
        ? String(target.gid).trim()
        : ''
    if (!gameUid || seen.has(gameUid)) continue
    seen.add(gameUid)

    const listing: CozyFarmSupportListing = { gameUid }
    const pets = Array.isArray(target.pets) ? (target.pets as ForeignPet[]) : []
    for (const pet of pets) {
      const pid = typeof pet.pid === 'number' ? pet.pid : Number(pet.pid)
      const rate = typeof pet.rate === 'number' ? pet.rate : Number(pet.rate)
      const field = TATARY_PID_TO_BONUS[pid as keyof typeof TATARY_PID_TO_BONUS]
      if (!field || !Number.isFinite(rate)) continue
      listing[field] = scaleRate(rate)
    }
    listings.push(listing)
  }

  return {
    version: 1,
    listings,
  }
}
