/** Shared calendar phase helpers (no server deps). */

export type EventPhase = 'registration' | 'active' | 'rewards'

export function addIsoDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function daysBetweenIso(fromIso: string, toIso: string): number {
  const [ys, ms, ds] = fromIso.split('-').map(Number)
  const [ye, me, de] = toIso.split('-').map(Number)
  const start = Date.UTC(ys, ms - 1, ds)
  const end = Date.UTC(ye, me - 1, de)
  return Math.round((end - start) / 86_400_000)
}

export function inclusiveDayCount(startDate: string, endDate: string): number {
  return daysBetweenIso(startDate, endDate) + 1
}

/**
 * Stored `startDate`/`endDate` are the calendar span: registration is the first
 * day when `registrationDays` is 1, reward collection is the last day when
 * `rewardDays` is 1. The event itself sits between those days.
 */
export type EventDateWindow = {
  eventStart: string
  eventEnd: string
  registrationDate: string | null
  rewardDate: string | null
}

export function eventDateWindow(input: {
  startDate: string
  endDate: string
  registrationDays?: number
  rewardDays?: number
}): EventDateWindow {
  const registrationDays = input.registrationDays ?? 0
  const rewardDays = input.rewardDays ?? 0
  return {
    eventStart:
      registrationDays > 0 ? addIsoDays(input.startDate, registrationDays) : input.startDate,
    eventEnd: rewardDays > 0 ? addIsoDays(input.endDate, -rewardDays) : input.endDate,
    registrationDate: registrationDays > 0 ? input.startDate : null,
    rewardDate: rewardDays > 0 ? input.endDate : null,
  }
}

/** Event dates from the admin form → stored calendar span. */
export function calendarSpanFromEventDates(input: {
  eventStart: string
  eventEnd: string
  registrationDays: number
  rewardDays: number
}): { startDate: string; endDate: string } {
  return {
    startDate:
      input.registrationDays > 0
        ? addIsoDays(input.eventStart, -input.registrationDays)
        : input.eventStart,
    endDate:
      input.rewardDays > 0 ? addIsoDays(input.eventEnd, input.rewardDays) : input.eventEnd,
  }
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
