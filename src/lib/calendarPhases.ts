/** Shared calendar phase helpers (no server deps). */

export type EventPhase = 'registration' | 'active' | 'rewards'

export function inclusiveDayCount(startDate: string, endDate: string): number {
  const [ys, ms, ds] = startDate.split('-').map(Number)
  const [ye, me, de] = endDate.split('-').map(Number)
  const start = Date.UTC(ys, ms - 1, ds)
  const end = Date.UTC(ye, me - 1, de)
  return Math.round((end - start) / 86_400_000) + 1
}

/** 1-based day index within the event → phase. */
export function phaseForEventDay(
  dayNumber: number,
  totalDays: number,
  registrationDays: number,
  rewardDays: number,
): EventPhase {
  if (dayNumber <= registrationDays) return 'registration'
  if (dayNumber > totalDays - rewardDays) return 'rewards'
  return 'active'
}
