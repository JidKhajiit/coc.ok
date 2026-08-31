import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../i18n'

type Props = {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
}

export function SettingsDrawer({ open, title, subtitle, onClose, children }: Props) {
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
          <button type="button" className="settings-drawer__close" onClick={onClose} aria-label={t('common.close')}>
            ×
          </button>
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
  children: ReactNode
}

export function SettingsSection({ title, hint, children }: SectionProps) {
  return (
    <section className="settings-section">
      <div className="settings-section__head">
        <h3>{title}</h3>
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
}: {
  locale: 'ru' | 'en'
  onChange: (locale: 'ru' | 'en') => void
}) {
  const { t } = useI18n()

  return (
    <div className="seg" role="group" aria-label={t('settings.language')}>
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
