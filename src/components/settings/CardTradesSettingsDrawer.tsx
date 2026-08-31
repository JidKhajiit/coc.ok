import { useEffect, useRef, useState } from 'react'
import * as api from '../../api/client'
import type { Account } from '../../types'
import { useI18n } from '../../i18n'
import { BRAND_NAME } from '../../brand'
import { SettingsAccordion, SettingsDrawer } from './SettingsDrawer'

type Props = {
  open: boolean
  username: string
  onClose: () => void
  accounts: Account[]
  onAdd: () => void
  onRemove: (id: string) => void
  onRename: (id: string, name: string) => void
  onExport: () => void
  onCopyBackup: () => Promise<void>
  onImport: (file: File) => Promise<void>
  onImportText: (text: string) => Promise<void>
}

type AccordionId = 'accounts' | 'share' | 'backup' | null

export function CardTradesSettingsDrawer({
  open,
  username,
  onClose,
  accounts,
  onAdd,
  onRemove,
  onRename,
  onExport,
  onCopyBackup,
  onImport,
  onImportText,
}: Props) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState<AccordionId>('accounts')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [importMsg, setImportMsg] = useState('')
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [shareEnabled, setShareEnabled] = useState(false)
  const [shareSlug, setShareSlug] = useState(username)
  const [shareMsg, setShareMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setDrafts(Object.fromEntries(accounts.map((a) => [a.id, a.name])))
    setImportMsg('')
    setPasteOpen(false)
    setPasteText('')
    setShareMsg('')
    setExpanded('accounts')
    void api.getShareSettings().then((share) => {
      setShareEnabled(share.enabled)
      setShareSlug(share.slug)
    })
  }, [open, accounts, username])

  const toggle = (id: Exclude<AccordionId, null>) => {
    setExpanded((prev) => (prev === id ? null : id))
  }

  const shareUrl = `${window.location.origin}/card-trades/collections/${shareSlug}`

  return (
    <SettingsDrawer
      open={open}
      onClose={onClose}
      title={t('eventSettings.title')}
      subtitle={BRAND_NAME}
    >
      <SettingsAccordion
        id="accounts"
        title={t('settings.accounts')}
        hint={t('eventSettings.accountsHint')}
        open={expanded === 'accounts'}
        onToggle={() => toggle('accounts')}
      >
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
                onChange={(e) => setDrafts((prev) => ({ ...prev, [a.id]: e.target.value }))}
                onBlur={() => {
                  const name =
                    (drafts[a.id] ?? a.name).trim() ||
                    t('settings.accountPlaceholder', { n: i + 1 })
                  onRename(a.id, name)
                }}
                placeholder={t('settings.accountPlaceholder', { n: i + 1 })}
              />
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => onRemove(a.id)}>
                {t('common.delete')}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn--primary btn--sm" onClick={onAdd}>
          {t('settings.addAccount')}
        </button>
      </SettingsAccordion>

      <SettingsAccordion
        id="share"
        title={t('share.settingsTitle')}
        hint={t('eventSettings.shareHint')}
        open={expanded === 'share'}
        onToggle={() => toggle('share')}
      >
        <label className="settings-share__toggle">
          <input
            type="checkbox"
            checked={shareEnabled}
            onChange={async () => {
              try {
                const share = await api.updateShareSettings({
                  enabled: !shareEnabled,
                  slug: shareSlug,
                })
                setShareEnabled(share.enabled)
                setShareSlug(share.slug)
                setShareMsg(share.enabled ? t('share.enabledMsg') : t('share.disabledMsg'))
              } catch {
                setShareMsg(t('share.saveFail'))
              }
            }}
          />
          <span>{t('share.enablePublic')}</span>
        </label>
        {shareEnabled && (
          <div className="settings-share__link">
            <input className="input" readOnly value={shareUrl} />
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareUrl)
                  setShareMsg(t('share.linkCopied'))
                } catch {
                  setShareMsg(t('settings.msg.copyFail'))
                }
              }}
            >
              {t('share.copyLink')}
            </button>
          </div>
        )}
        {shareMsg && <p className="settings-feedback">{shareMsg}</p>}
      </SettingsAccordion>

      <SettingsAccordion
        id="backup"
        title={t('settings.backup')}
        hint={t('eventSettings.backupHint')}
        open={expanded === 'backup'}
        onToggle={() => toggle('backup')}
      >
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
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => fileRef.current?.click()}>
            {t('settings.upload')}
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPasteOpen((v) => !v)}>
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
              rows={5}
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
        {importMsg && <p className="settings-feedback">{importMsg}</p>}
      </SettingsAccordion>
    </SettingsDrawer>
  )
}
