import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../i18n'

type Props = {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  headerActions?: ReactNode
  children: ReactNode
}

export function SettingsDrawer({ open, title, subtitle, onClose, headerActions, children }: Props) {
  const { t } = useI18n()

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="settings-drawer-root" role="presentation">
      <button type="button" className="settings-drawer__backdrop" onClick={onClose} aria-label={t('common.close')} />
      <aside
        className="settings-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-drawer-title"
      >
        <header className="settings-drawer__head">
          <div className="settings-drawer__titles">
            <h2 id="settings-drawer-title">{title}</h2>
            {subtitle && <p className="settings-drawer__subtitle">{subtitle}</p>}
          </div>
          <div className="settings-drawer__actions">
            {headerActions}
            <button type="button" className="settings-drawer__close" onClick={onClose} aria-label={t('common.close')}>
              ×
            </button>
          </div>
        </header>
        <div className="settings-drawer__body">{children}</div>
      </aside>
    </div>,
    document.body,
  )
}

type SectionProps = {
  title: string
  hint?: string
  /** Shown as a "?" tooltip next to the title */
  tip?: string
  tipAriaLabel?: string
  /** Extra controls next to the title (e.g. "+" to add) */
  titleActions?: ReactNode
  children: ReactNode
}

function SettingsHelpTip({ tip, tipAriaLabel }: { tip: string; tipAriaLabel?: string }) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const tipId = useId()

  const updatePosition = () => {
    const btn = btnRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const width = Math.min(280, window.innerWidth - 24)
    let left = rect.right - width
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12))
    setCoords({ top: rect.bottom + 8, left })
  }

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null)
      return
    }
    updatePosition()
    const onReposition = () => updatePosition()
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open])

  return (
    <span
      className="help-tip help-tip--settings"
      onMouseEnter={() => {
        updatePosition()
        setOpen(true)
      }}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => {
        updatePosition()
        setOpen(true)
      }}
      onBlur={() => setOpen(false)}
    >
      <button
        ref={btnRef}
        type="button"
        className="help-tip__btn"
        aria-label={tipAriaLabel ?? tip}
        aria-describedby={open ? tipId : undefined}
      >
        ?
      </button>
      {open &&
        coords &&
        createPortal(
          <span
            id={tipId}
            className="help-tip__popup help-tip__popup--portal"
            role="tooltip"
            style={{ top: coords.top, left: coords.left }}
          >
            {tip}
          </span>,
          document.body,
        )}
    </span>
  )
}

export function SettingsSection({
  title,
  hint,
  tip,
  tipAriaLabel,
  titleActions,
  children,
}: SectionProps) {
  return (
    <section className="settings-section">
      <div className="settings-section__head">
        <div className="settings-section__title-row">
          <h3>{title}</h3>
          {tip && <SettingsHelpTip tip={tip} tipAriaLabel={tipAriaLabel} />}
          {titleActions && <div className="settings-section__title-actions">{titleActions}</div>}
        </div>
        {hint && <p className="settings-section__hint">{hint}</p>}
      </div>
      <div className="settings-section__body">{children}</div>
    </section>
  )
}

type AccordionProps = {
  id: string
  title: string
  hint?: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}

export function SettingsAccordion({ id, title, hint, open, onToggle, children }: AccordionProps) {
  const panelId = `settings-accordion-${id}`

  return (
    <section className={`settings-accordion ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="settings-accordion__trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <span className="settings-accordion__label">
          <span className="settings-accordion__title">{title}</span>
          {hint && !open && <span className="settings-accordion__hint">{hint}</span>}
        </span>
        <span className="settings-accordion__chevron" aria-hidden />
      </button>
      {open && (
        <div id={panelId} className="settings-accordion__panel">
          {hint && <p className="settings-section__hint">{hint}</p>}
          {children}
        </div>
      )}
    </section>
  )
}

export function LanguagePicker({
  locale,
  onChange,
  compact = false,
}: {
  locale: 'ru' | 'en'
  onChange: (locale: 'ru' | 'en') => void
  compact?: boolean
}) {
  const { t } = useI18n()

  return (
    <div
      className={`seg${compact ? ' seg--compact' : ''}`}
      role="group"
      aria-label={t('settings.language')}
    >
      <button
        type="button"
        className={`seg__btn ${locale === 'ru' ? 'is-active' : ''}`}
        onClick={() => onChange('ru')}
      >
        RU
      </button>
      <button
        type="button"
        className={`seg__btn ${locale === 'en' ? 'is-active' : ''}`}
        onClick={() => onChange('en')}
      >
        EN
      </button>
    </div>
  )
}
