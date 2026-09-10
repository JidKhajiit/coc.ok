/** Clash of Critters game-day reset — 03:00 local time */
export const GAME_DAY_RESET_HOUR = 3

function getGameDayKey(date: Date): string {
  const d = new Date(date.getTime())
  if (d.getHours() < GAME_DAY_RESET_HOUR) {
    d.setDate(d.getDate() - 1)
  }
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
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
