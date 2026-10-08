export type ReputationTier = 'novice' | 'trader' | 'experienced' | 'veteran'

export type AchievementId = 'first_deal' | 'deals_5' | 'deals_15' | 'first_gift' | 'veteran'

export type ReputationStats = {
  dealsCompleted: number
  giftsParticipated: number
  tier: ReputationTier
  achievements: AchievementId[]
}

export type ReputationAggregates = {
  dealsCompleted: number
  giftsParticipated: number
}

export function reputationTier(dealsCompleted: number): ReputationTier {
  if (dealsCompleted >= 15) return 'veteran'
  if (dealsCompleted >= 5) return 'experienced'
  if (dealsCompleted >= 1) return 'trader'
  return 'novice'
}

export function reputationAchievements(stats: ReputationAggregates): AchievementId[] {
  const list: AchievementId[] = []
  if (stats.dealsCompleted >= 1) list.push('first_deal')
  if (stats.dealsCompleted >= 5) list.push('deals_5')
  if (stats.dealsCompleted >= 15) list.push('deals_15')
  if (stats.giftsParticipated >= 1) list.push('first_gift')
  if (stats.dealsCompleted >= 15) list.push('veteran')
  return list
}

export function buildReputation(stats: ReputationAggregates): ReputationStats {
  const dealsCompleted = Math.max(0, Math.floor(stats.dealsCompleted))
  const giftsParticipated = Math.max(0, Math.floor(stats.giftsParticipated))
  return {
    dealsCompleted,
    giftsParticipated,
    tier: reputationTier(dealsCompleted),
    achievements: reputationAchievements({ dealsCompleted, giftsParticipated }),
  }
}

export const EMPTY_REPUTATION: ReputationStats = buildReputation({
  dealsCompleted: 0,
  giftsParticipated: 0,
})
