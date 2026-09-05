import { useMemo, useState } from 'react'
import { rarityLabel } from '../data/cards'
import type { Card, Rarity } from '../types'
import { createTranslator, useI18n, type Locale, type MessageKey } from '../i18n'

interface Props {
  cards: Card[]
  owned: Record<string, number>
  neededBy: Record<string, string[]>
  reservedByCard: Record<string, number>
  tradeNeedCardIds: Set<string>
}

type TemplateId =
  | 'lf-needed-ft'
  | 'lf-missing-ft'
  | 'lf-needed'
  | 'lf-missing'
  | 'ft'

type Lists = {
  lfNeeded: string
  lfMissing: string
  ft: string
}

const TEMPLATE_META: {
  id: TemplateId
  titleKey: MessageKey
  hintKey: MessageKey
  parts: ('lfNeeded' | 'lfMissing' | 'ft')[]
}[] = [
  {
    id: 'lf-needed-ft',
    titleKey: 'templates.lfNeededFt',
    hintKey: 'templates.lfNeededFtHint',
    parts: ['lfNeeded', 'ft'],
  },
  {
    id: 'lf-missing-ft',
    titleKey: 'templates.lfMissingFt',
    hintKey: 'templates.lfMissingFtHint',
    parts: ['lfMissing', 'ft'],
  },
  {
    id: 'lf-needed',
    titleKey: 'templates.lfNeeded',
    hintKey: 'templates.lfNeededHint',
    parts: ['lfNeeded'],
  },
  {
    id: 'lf-missing',
    titleKey: 'templates.lfMissing',
    hintKey: 'templates.lfMissingHint',
    parts: ['lfMissing'],
  },
  {
    id: 'ft',
    titleKey: 'templates.ft',
    hintKey: 'templates.ftHint',
    parts: ['ft'],
  },
]

function formatFlat(cards: Card[]): string {
  return cards.map((c) => String(c.number)).join(', ')
}

function formatByStars(cards: Card[]): string {
  const groups = new Map<Rarity, number[]>()
  for (const c of cards) {
    const list = groups.get(c.rarity) ?? []
    list.push(c.number)
    groups.set(c.rarity, list)
  }

  const lines: string[] = []
  for (const rarity of [1, 2, 3, 4, 5] as Rarity[]) {
    const nums = groups.get(rarity)
    if (!nums?.length) continue
    lines.push(`${rarityLabel(rarity)}: ${nums.join(', ')}`)
  }
  return lines.join('\n')
}

function formatCards(cards: Card[], splitByStars: boolean): string {
  return splitByStars ? formatByStars(cards) : formatFlat(cards)
}

function buildTemplate(
  id: TemplateId,
  lists: Lists,
  lookingFor: string,
  forTrade: string,
  splitByStars: boolean,
): string {
  const meta = TEMPLATE_META.find((t) => t.id === id)!
  const lines: string[] = []

  for (const part of meta.parts) {
    const label = part === 'ft' ? forTrade : lookingFor
    const value = lists[part]
    if (!value) {
      lines.push(`${label}: —`)
      continue
    }
    if (splitByStars) {
      lines.push(`${label}:\n${value}`)
    } else {
      lines.push(`${label}: ${value}`)
    }
  }

  return lines.join('\n')
}

export function TradeTemplates({
  cards,
  owned,
  neededBy,
  reservedByCard,
  tradeNeedCardIds,
}: Props) {
  const { t, locale } = useI18n()
  const [copiedId, setCopiedId] = useState<TemplateId | null>(null)
  const [previewId, setPreviewId] = useState<TemplateId>('lf-needed-ft')
  const [splitByStars, setSplitByStars] = useState(false)
  const [excludeGold, setExcludeGold] = useState(true)
  const [templateUseEn, setTemplateUseEn] = useState(false)

  const templateLocale: Locale = templateUseEn ? 'en' : locale
  const tTemplate = useMemo(() => createTranslator(templateLocale), [templateLocale])
  const lookingFor = tTemplate('templates.lookingFor')
  const forTradeLabel = tTemplate('templates.forTrade')
  const uiLangLabel = locale.toUpperCase()

  const { neededCards, missingCards, forTrade } = useMemo(() => {
    const neededCards: Card[] = []
    const missingCards: Card[] = []
    const forTrade: Card[] = []

    for (const c of cards) {
      const qty = owned[c.id] ?? 0
      const reserved = reservedByCard[c.id] ?? 0
      const isMissing = qty === 0
      const isMarked = (neededBy[c.id] ?? []).length > 0
      const isTradeNeed = tradeNeedCardIds.has(c.id)

      if (isMissing || isMarked || isTradeNeed) neededCards.push(c)
      if (isMissing) missingCards.push(c)
      if (qty - 1 - reserved >= 1) forTrade.push(c)
    }

    neededCards.sort((a, b) => a.number - b.number)
    missingCards.sort((a, b) => a.number - b.number)
    forTrade.sort((a, b) => a.number - b.number)

    if (!excludeGold) {
      return { neededCards, missingCards, forTrade }
    }

    const noGold = (list: Card[]) => list.filter((c) => c.color !== 'gold')
    return {
      neededCards: noGold(neededCards),
      missingCards: noGold(missingCards),
      forTrade: noGold(forTrade),
    }
  }, [cards, owned, neededBy, reservedByCard, tradeNeedCardIds, excludeGold])

  const lists: Lists = useMemo(
    () => ({
      lfNeeded: formatCards(neededCards, splitByStars),
      lfMissing: formatCards(missingCards, splitByStars),
      ft: formatCards(forTrade, splitByStars),
    }),
    [neededCards, missingCards, forTrade, splitByStars],
  )

  const preview = buildTemplate(previewId, lists, lookingFor, forTradeLabel, splitByStars)

  async function copy(id: TemplateId) {
    const text = buildTemplate(id, lists, lookingFor, forTradeLabel, splitByStars)
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setPreviewId(id)
    window.setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1600)
  }

  return (
    <details className="trade-templates">
      <summary className="trade-templates__summary">
        {t('templates.summary')}
        <span className="trade-templates__counts">
          LF {neededCards.length}/{missingCards.length} · FT {forTrade.length}
        </span>
      </summary>

      <div className="trade-templates__body">
        <p className="trade-templates__hint">{t('templates.hint')}</p>

        <div className="trade-templates__opts">
          <div className="trade-templates__lang">
            <span className="trade-templates__lang-label">{t('templates.lang')}</span>
            <div className="seg" role="group" aria-label={t('templates.langAria')}>
              <button
                type="button"
                className={`seg__btn ${!templateUseEn ? 'is-active' : ''}`}
                onClick={() => setTemplateUseEn(false)}
              >
                {uiLangLabel}
              </button>
              <button
                type="button"
                className={`seg__btn ${templateUseEn ? 'is-active' : ''}`}
                onClick={() => setTemplateUseEn(true)}
              >
                EN
              </button>
            </div>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={excludeGold}
              onChange={(e) => setExcludeGold(e.target.checked)}
            />
            {t('templates.excludeGold')}
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={splitByStars}
              onChange={(e) => setSplitByStars(e.target.checked)}
            />
            {t('templates.splitByStars')}
          </label>
        </div>

        <ul className="trade-templates__list">
          {TEMPLATE_META.map((meta) => (
            <li key={meta.id} className="trade-templates__row">
              <div>
                <strong>{t(meta.titleKey)}</strong>
                <span className="muted">{t(meta.hintKey)}</span>
              </div>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => void copy(meta.id)}
              >
                {copiedId === meta.id ? t('common.copied') : t('common.copy')}
              </button>
            </li>
          ))}
        </ul>

        <label className="trade-templates__preview-label">
          {t('templates.preview')}
          <textarea
            className="trade-templates__preview"
            readOnly
            rows={splitByStars ? 8 : 4}
            value={preview}
          />
        </label>
      </div>
    </details>
  )
}
