/** Moscow wall-clock calendar date as YYYY-MM-DD (no DST). */
function moscowIsoDate(now = new Date()): string {
  const shifted = new Date(now.getTime() + 3 * 60 * 60 * 1000)
  const y = shifted.getUTCFullYear()
  const m = shifted.getUTCMonth() + 1
  const d = shifted.getUTCDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export type CardTradeEventAccess = {
  active: boolean
  endDate: string
}

/** Event calendar ended after its last day (endDate inclusive). */
export function isCardTradeEventEnded(
  event: Pick<CardTradeEventAccess, 'endDate'>,
  now = new Date(),
): boolean {
  return moscowIsoDate(now) > event.endDate
}

/**
 * Mutations (state, share, proposals) are allowed only while the event is active
 * and today (Moscow) is on or before endDate.
 */
export function isCardTradeEventWritable(
  event: CardTradeEventAccess,
  now = new Date(),
): boolean {
  return event.active && !isCardTradeEventEnded(event, now)
}
