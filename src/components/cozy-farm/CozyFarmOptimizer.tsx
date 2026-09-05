import { useEffect, useMemo, useState } from 'react'
import {
  COZY_FARM_FRUITS,
  optimizeCozyFarm,
  type CozyFarmFruit,
} from '../../lib/cozyFarmOptimizer'
import { useI18n, type MessageKey } from '../../i18n'

const FRUIT_LABEL_KEY: Record<CozyFarmFruit, MessageKey> = {
  dragonfruit: 'cozyFarm.fruit.dragonfruit',
  carrot: 'cozyFarm.fruit.carrot',
  bamboo: 'cozyFarm.fruit.bamboo',
  phantom: 'cozyFarm.fruit.phantom',
  cranberry: 'cozyFarm.fruit.cranberry',
  orange: 'cozyFarm.fruit.orange',
}

function emptyValues(): Record<CozyFarmFruit, number> {
  return {
    dragonfruit: 0,
    carrot: 0,
    bamboo: 0,
    phantom: 0,
    cranberry: 0,
    orange: 0,
  }
}

function zeroFertilizer(): number[] {
  return [0, 0, 0, 0, 0, 0]
}

export type CozyFarmCropInject = {
  fruit: CozyFarmFruit
  value: number
  nonce: number
}

type Props = {
  injectCropValue?: CozyFarmCropInject | null
}

export function CozyFarmOptimizer({ injectCropValue = null }: Props) {
  const { t } = useI18n()
  const [totalFertilizers, setTotalFertilizers] = useState(100)
  const [wateredTimes, setWateredTimes] = useState(0)
  const [cropValues, setCropValues] = useState(emptyValues)
  const [initialFertilizer, setInitialFertilizer] = useState(zeroFertilizer)
  const [ran, setRan] = useState(false)

  useEffect(() => {
    if (!injectCropValue) return
    setCropValues((prev) => ({
      ...prev,
      [injectCropValue.fruit]: injectCropValue.value,
    }))
  }, [injectCropValue])

  const result = useMemo(() => {
    if (!ran) return null
    return optimizeCozyFarm({
      totalFertilizers,
      wateredTimes,
      cropValues,
      slots: [...COZY_FARM_FRUITS],
      initialFertilizer,
    })
  }, [ran, totalFertilizers, wateredTimes, cropValues, initialFertilizer])

  return (
    <div className="cozy-optimizer">
      <p className="cozy-section__hint">{t('cozyFarm.optimizerHint')}</p>
      <p className="cozy-section__hint">{t('cozyFarm.optimizerContinuous')}</p>

      <div className="cozy-optimizer__grid">
        <label className="cozy-field">
          <span>{t('cozyFarm.totalFertilizers')}</span>
          <input
            type="number"
            min={0}
            value={totalFertilizers}
            onChange={(e) => setTotalFertilizers(Number(e.target.value) || 0)}
          />
        </label>
        <label className="cozy-field">
          <span>{t('cozyFarm.wateredTimes')}</span>
          <input
            type="number"
            min={0}
            max={3}
            value={wateredTimes}
            onChange={(e) => setWateredTimes(Math.min(3, Math.max(0, Number(e.target.value) || 0)))}
          />
        </label>
      </div>

      <h3>{t('cozyFarm.fruitsTitle')}</h3>
      <p className="cozy-section__hint">{t('cozyFarm.fruitsHint')}</p>
      <div className="cozy-optimizer__crops">
        {COZY_FARM_FRUITS.map((fruit, index) => (
          <div key={fruit} className="cozy-fruit-card">
            <span className="cozy-fruit-card__title">{t(FRUIT_LABEL_KEY[fruit])}</span>
            <div className="cozy-fruit-card__fields">
              <label className="cozy-field cozy-field--compact">
                <span>{t('cozyFarm.cropValues')}</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={cropValues[fruit]}
                  onChange={(e) =>
                    setCropValues((prev) => ({
                      ...prev,
                      [fruit]: Number(e.target.value) || 0,
                    }))
                  }
                />
              </label>
              <label className="cozy-field cozy-field--compact">
                <span>{t('cozyFarm.initialFertilizer')}</span>
                <input
                  type="number"
                  min={0}
                  value={initialFertilizer[index] ?? 0}
                  onChange={(e) => {
                    const next = [...initialFertilizer]
                    next[index] = Math.max(0, Math.floor(Number(e.target.value) || 0))
                    setInitialFertilizer(next)
                  }}
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <button type="button" className="btn btn--primary" onClick={() => setRan(true)}>
        {t('cozyFarm.calculate')}
      </button>

      {result && (
        <pre className="cozy-optimizer__results" aria-live="polite">
          {result.slots
            .map((slot) => {
              const start = slot.fertilizer - slot.fertilizerAdded
              return `${t(FRUIT_LABEL_KEY[slot.fruit])}: ${t('cozyFarm.fertWas')} ${start} → +${slot.fertilizerAdded} → ${slot.fertilizer} ${t('cozyFarm.fertilizers')} · ${slot.weight.toFixed(2)} kg · ${slot.coins} ${t('cozyFarm.coins')}`
            })
            .join('\n')}
          {`\n${t('cozyFarm.totalCoins')}: ${result.totalCoins}`}
        </pre>
      )}
    </div>
  )
}
