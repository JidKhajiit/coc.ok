/** Clash of Critters game-day reset — 03:00 Europe/Moscow (UTC+3, no DST). */
export const GAME_DAY_RESET_HOUR = 3

/** Fixed offset so server public stats and client tracker use the same calendar day. */
const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000

function moscowWallParts(date: Date): { year: number; month: number; day: number; hour: number } {
  const shifted = new Date(date.getTime() + MOSCOW_OFFSET_MS)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
  }
}

function getGameDayKey(date: Date): string {
  const parts = moscowWallParts(date)
  let { year, month, day, hour } = parts
  if (hour < GAME_DAY_RESET_HOUR) {
    const prev = new Date(Date.UTC(year, month, day - 1))
    year = prev.getUTCFullYear()
    month = prev.getUTCMonth()
    day = prev.getUTCDate()
  }
  return `${year}-${month}-${day}`
}

export function isSameGameDay(iso: string, now = new Date()): boolean {
  return getGameDayKey(new Date(iso)) === getGameDayKey(now)
}

export function countCompletedTradesToday(
  trades: Array<{ createdAt: string; source?: string }>,
  now = new Date(),
): number {
  let count = 0
  for (const trade of trades) {
    const source = trade.source === 'observed' || trade.source === 'cancelled' ? trade.source : 'completed'
    if (source === 'completed' && isSameGameDay(trade.createdAt, now)) count += 1
  }
  return count
}
