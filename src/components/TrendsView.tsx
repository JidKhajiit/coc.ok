import { CARD_BY_ID } from '../data/cards'
import type { TrendItem } from '../types'
import { useI18n } from '../i18n'
import { CardItem } from './CardItem'

interface Props {
  owned: Record<string, number>
  mostGiven: TrendItem[]
  mostRequested: TrendItem[]
  tradeCount: number
}

function TrendList({
  title,
  hint,
  items,
  owned,
}: {
  title: string
  hint: string
  items: TrendItem[]
  owned: Record<string, number>
}) {
  const { t } = useI18n()
  return (
    <div className="trend-col">
      <h3>{title}</h3>
      <p className="muted">{hint}</p>
      {items.length === 0 ? (
        <p className="empty">{t('trends.empty')}</p>
      ) : (
        <ol className="trend-list">
          {items.slice(0, 15).map((item, i) => {
            const card = CARD_BY_ID[item.cardId]
            if (!card) return null
            return (
              <li key={item.cardId} className="trend-list__row">
                <span className="trend-list__rank">{i + 1}</span>
                <CardItem card={card} compact qty={owned[card.id] ?? 0} qtyInline />
                <span className="trend-list__count">×{item.count}</span>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

export function TrendsView({ owned, mostGiven, mostRequested, tradeCount }: Props) {
  const { t } = useI18n()
  return (
    <section className="panel">
      <header className="panel__head">
        <div>
          <h2>{t('trends.title')}</h2>
          <p>
            {t('trends.lead', {
              count: tradeCount > 0 ? t('trends.leadCount', { n: tradeCount }) : '',
            })}
          </p>
        </div>
      </header>

      <div className="trend-grid">
        <TrendList
          title={t('trends.givenTitle')}
          hint={t('trends.givenHint')}
          items={mostGiven}
          owned={owned}
        />
        <TrendList
          title={t('trends.receivedTitle')}
          hint={t('trends.receivedHint')}
          items={mostRequested}
          owned={owned}
        />
      </div>
    </section>
  )
}
