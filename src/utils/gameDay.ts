/** Смена игрового дня в Clash of Critters — 03:00 по локальному времени */
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
