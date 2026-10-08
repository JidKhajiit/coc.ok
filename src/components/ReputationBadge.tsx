import type { ReputationStats } from '../../shared/reputation'
import { useI18n, type MessageKey } from '../i18n'

type Props = {
  reputation: ReputationStats
  className?: string
}

export function ReputationBadge({ reputation, className }: Props) {
  const { t } = useI18n()
  const tipId = `rep-tip-${reputation.tier}-${reputation.dealsCompleted}`
  const achievements =
    reputation.achievements.length > 0
      ? reputation.achievements
          .map((id) => t(`reputation.achievement.${id}` as MessageKey))
          .join(' · ')
      : t('reputation.achievementsNone')

  return (
    <span
      className={['reputation-badge', `reputation-badge--${reputation.tier}`, className]
        .filter(Boolean)
        .join(' ')}
      tabIndex={0}
      aria-describedby={tipId}
    >
      {t(`reputation.tier.${reputation.tier}` as MessageKey)}
      <span className="reputation-badge__count">
        {t('reputation.deals', { n: reputation.dealsCompleted })}
      </span>
      <span id={tipId} className="reputation-badge__tip" role="tooltip">
        {achievements}
      </span>
    </span>
  )
}
