import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Account } from '../types'
import { useI18n, type Locale } from '../i18n'

interface Props {
  open: boolean
  accounts: Account[]
  locale: Locale
  onLocaleChange: (locale: Locale) => void
  onClose: () => void
  onAdd: () => void
  onRemove: (id: string) => void
  onRename: (id: string, name: string) => void
  onExport: () => void
  onCopyBackup: () => Promise<void>
  onImport: (file: File) => Promise<void>
  onImportText: (text: string) => Promise<void>
}

export function SettingsModal({
  open,
  accounts,
  locale,
  onLocaleChange,
  onClose,
  onAdd,
  onRemove,
  onRename,
  onExport,
  onCopyBackup,
  onImport,
  onImportText,
}: Props) {
  const { t } = useI18n()
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [importMsg, setImportMsg] = useState('')
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setDrafts(Object.fromEntries(accounts.map((a) => [a.id, a.name])))
    setImportMsg('')
    setPasteOpen(false)
    setPasteText('')
  }, [open, accounts])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="settings-overlay" onClick={onClose} role="presentation">
      <div
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="settings-modal__head">
          <h2 id="settings-title">{t('settings.title')}</h2>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
            {t('common.close')}
          </button>
        </header>

        <section className="settings-block">
          <h3>{t('settings.language')}</h3>
          <p className="settings-block__hint">{t('settings.languageHint')}</p>
          <div className="seg" role="group" aria-label={t('settings.language')}>
            <button
              type="button"
              className={`seg__btn ${locale === 'ru' ? 'is-active' : ''}`}
              onClick={() => onLocaleChange('ru')}
            >
              RU
            </button>
            <button
              type="button"
              className={`seg__btn ${locale === 'en' ? 'is-active' : ''}`}
              onClick={() => onLocaleChange('en')}
            >
              EN
            </button>
          </div>
        </section>

        <section className="settings-block">
          <div className="settings-block__title">
            <h3>{t('settings.accounts')}</h3>
            <span className="help-tip">
              <button
                type="button"
                className="help-tip__btn"
                aria-label={t('settings.accountsHelpAria')}
              >
                ?
              </button>
              <span className="help-tip__popup" role="tooltip">
                {t('settings.accountsHelp')}
              </span>
            </span>
          </div>

          <ul className="settings-accounts">
            {accounts.length === 0 && (
              <li className="settings-accounts__empty">{t('settings.accountsEmpty')}</li>
            )}
            {accounts.map((a, i) => (
              <li key={a.id} className="settings-accounts__row">
                <span className="settings-accounts__idx">{i + 1}</span>
                <input
                  className="input"
                  value={drafts[a.id] ?? a.name}
                  onChange={(e) =>
                    setDrafts((prev) => ({ ...prev, [a.id]: e.target.value }))
                  }
                  onBlur={() => {
                    const name =
                      (drafts[a.id] ?? a.name).trim() ||
                      t('settings.accountPlaceholder', { n: i + 1 })
                    onRename(a.id, name)
                  }}
                  placeholder={t('settings.accountPlaceholder', { n: i + 1 })}
                />
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => onRemove(a.id)}
                >
                  {t('common.delete')}
                </button>
              </li>
            ))}
          </ul>

          <button type="button" className="btn btn--primary btn--sm" onClick={onAdd}>
            {t('settings.addAccount')}
          </button>
        </section>

        <section className="settings-block settings-block--backup">
          <h3>{t('settings.backup')}</h3>
          <p className="settings-block__hint">{t('settings.backupHint')}</p>
          <div className="settings-backup__actions">
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={async () => {
                try {
                  await onCopyBackup()
                  setImportMsg(t('settings.msg.copied'))
                } catch {
                  setImportMsg(t('settings.msg.copyFail'))
                }
              }}
            >
              {t('settings.copyBackup')}
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={onExport}>
              {t('settings.download')}
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => fileRef.current?.click()}
            >
              {t('settings.upload')}
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setPasteOpen((v) => !v)}
            >
              {t('settings.pasteJson')}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                if (!window.confirm(t('settings.importConfirm'))) return
                try {
                  await onImport(file)
                  setImportMsg(t('settings.msg.imported'))
                } catch {
                  setImportMsg(t('settings.msg.fileFail'))
                }
              }}
            />
          </div>
          {pasteOpen && (
            <div className="settings-backup__paste">
              <textarea
                className="settings-backup__textarea"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={t('settings.pastePlaceholder')}
                rows={6}
              />
              <button
                type="button"
                className="btn btn--primary btn--sm"
                disabled={!pasteText.trim()}
                onClick={async () => {
                  if (!window.confirm(t('settings.importConfirm'))) return
                  try {
                    await onImportText(pasteText)
                    setPasteText('')
                    setPasteOpen(false)
                    setImportMsg(t('settings.msg.imported'))
                  } catch {
                    setImportMsg(t('settings.msg.badJson'))
                  }
                }}
              >
                {t('settings.import')}
              </button>
            </div>
          )}
          {importMsg && <p className="settings-backup__msg">{importMsg}</p>}
        </section>
      </div>
    </div>,
    document.body,
  )
}
