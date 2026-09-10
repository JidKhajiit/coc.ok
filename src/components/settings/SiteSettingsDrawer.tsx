import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { LanguagePicker, SettingsDrawer, SettingsSection } from './SettingsDrawer'
import { useI18n, type Locale } from '../../i18n'
import { ApiError, type DeviceAccount } from '../../api/client'
import { PasswordField } from '../PasswordField'
import { UserAvatar } from '../UserAvatar'

type Props = {
  open: boolean
  onClose: () => void
  username?: string
  uid?: string | null
  avatarUrl?: string | null
  userId?: string
  permissions?: string[]
  accounts?: DeviceAccount[]
  onLogout?: () => Promise<unknown>
  onSetUid?: (uid: string) => Promise<unknown>
  onUploadAvatar?: (file: File) => Promise<unknown>
  onSwitchAccount?: (userId: string) => Promise<unknown>
  onRemoveAccount?: (userId: string) => Promise<unknown>
  onAddAccount?: (login: string, password: string) => Promise<unknown>
  locale: Locale
  onLocaleChange: (locale: Locale) => void
}

export function SiteSettingsDrawer({
  open,
  onClose,
  username,
  uid = null,
  avatarUrl = null,
  userId,
  permissions = [],
  accounts = [],
  onLogout,
  onSetUid,
  onUploadAvatar,
  onSwitchAccount,
  onRemoveAccount,
  onAddAccount,
  locale,
  onLocaleChange,
}: Props) {
  const { t } = useI18n()
  const signedIn = Boolean(username && onLogout)
  const isAdmin = permissions.includes('admin:access')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [draftUid, setDraftUid] = useState('')
  const [uidMsg, setUidMsg] = useState('')
  const [uidError, setUidError] = useState('')
  const [savingUid, setSavingUid] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [addLogin, setAddLogin] = useState('')
  const [addPassword, setAddPassword] = useState('')
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)
  const [accountBusyId, setAccountBusyId] = useState<string | null>(null)
  const [copiedUidId, setCopiedUidId] = useState<string | null>(null)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarError, setAvatarError] = useState('')

  useEffect(() => {
    if (!open) return
    setDraftUid('')
    setUidMsg('')
    setUidError('')
    setAddOpen(false)
    setAddLogin('')
    setAddPassword('')
    setAddError('')
    setAccountBusyId(null)
    setCopiedUidId(null)
    setAvatarBusy(false)
    setAvatarError('')
  }, [open])

  const copyUid = async (accountId: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedUidId(accountId)
      window.setTimeout(() => setCopiedUidId((prev) => (prev === accountId ? null : prev)), 1500)
    } catch {
      // ignore
    }
  }

  const handleSetUid = async (e: FormEvent) => {
    e.preventDefault()
    if (!onSetUid) return
    const value = draftUid.trim()
    if (!value) return
    setSavingUid(true)
    setUidMsg('')
    setUidError('')
    try {
      await onSetUid(value)
      setDraftUid('')
      setUidMsg(t('settings.uidSaved'))
    } catch (err) {
      setUidError(err instanceof ApiError || err instanceof Error ? err.message : t('settings.uidSaveFail'))
    } finally {
      setSavingUid(false)
    }
  }

  const handleAddAccount = async (e: FormEvent) => {
    e.preventDefault()
    if (!onAddAccount) return
    setAdding(true)
    setAddError('')
    try {
      await onAddAccount(addLogin.trim(), addPassword)
      setAddLogin('')
      setAddPassword('')
      setAddOpen(false)
      onClose()
      window.location.reload()
    } catch (err) {
      setAddError(err instanceof ApiError || err instanceof Error ? err.message : t('settings.accountAddFail'))
    } finally {
      setAdding(false)
    }
  }

  const handleSwitch = async (id: string) => {
    if (!onSwitchAccount || id === userId) return
    setAccountBusyId(id)
    try {
      await onSwitchAccount(id)
      onClose()
      window.location.reload()
    } catch {
      setAccountBusyId(null)
    }
  }

  const handleRemove = async (id: string) => {
    if (!onRemoveAccount) return
    const isCurrent = id === userId
    if (!window.confirm(isCurrent ? t('settings.accountLogoutConfirm') : t('settings.accountRemoveConfirm'))) {
      return
    }
    setAccountBusyId(id)
    try {
      const result = await onRemoveAccount(id)
      if (isCurrent) {
        onClose()
        window.location.reload()
        return
      }
      void result
      setAccountBusyId(null)
    } catch {
      setAccountBusyId(null)
    }
  }

  const handleAvatarPick = () => {
    if (!onUploadAvatar || avatarBusy) return
    fileInputRef.current?.click()
  }

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !onUploadAvatar) return
    setAvatarBusy(true)
    setAvatarError('')
    try {
      await onUploadAvatar(file)
    } catch (err) {
      const serverMsg = err instanceof ApiError || err instanceof Error ? err.message : ''
      const byServer: Record<string, Parameters<typeof t>[0]> = {
        'Avatar must be under 2 MB': 'settings.avatarTooLarge',
        'Only JPEG, PNG, WebP and GIF are allowed': 'settings.avatarBadType',
        'Avatar file is required': 'settings.avatarRequired',
        'Invalid avatar file': 'settings.avatarInvalid',
      }
      setAvatarError(serverMsg && byServer[serverMsg] ? t(byServer[serverMsg]) : t('settings.avatarFail'))
    } finally {
      setAvatarBusy(false)
    }
  }

  const showAccountSwitcher = signedIn
  const displayAccounts: DeviceAccount[] =
    accounts.length > 0
      ? accounts
      : username && userId
        ? [{ id: userId, username, uid, avatarUrl, active: true }]
        : []

  return (
    <SettingsDrawer
      open={open}
      onClose={onClose}
      title={t('siteSettings.title')}
      subtitle={signedIn ? undefined : t('siteSettings.guestSubtitle')}
      headerActions={
        <LanguagePicker locale={locale} onChange={onLocaleChange} compact />
      }
    >
      {showAccountSwitcher && (
        <SettingsSection
          title={t('settings.accountsTitle')}
          tip={t('settings.accountsDeviceHint')}
          tipAriaLabel={t('settings.accountsDeviceHintAria')}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="visually-hidden"
            tabIndex={-1}
            onChange={(e) => void handleAvatarChange(e)}
          />
          <ul className="settings-device-accounts">
            {displayAccounts.map((account) => {
              const active = account.active || account.id === userId
              const canChangeAvatar = active && Boolean(onUploadAvatar)
              return (
                <li
                  key={account.id}
                  className={`settings-device-accounts__row${active ? ' is-active' : ''}`}
                >
                  {canChangeAvatar ? (
                    <button
                      type="button"
                      className="settings-device-accounts__avatar-btn"
                      onClick={handleAvatarPick}
                      disabled={avatarBusy}
                      aria-label={t('settings.changeAvatar')}
                      title={t('settings.changeAvatar')}
                    >
                      <UserAvatar
                        username={account.username}
                        avatarUrl={account.avatarUrl}
                        className="settings-device-accounts__avatar"
                      />
                      <span className="settings-device-accounts__avatar-action" aria-hidden>
                        {account.avatarUrl ? '✎' : '+'}
                      </span>
                    </button>
                  ) : (
                    <UserAvatar
                      username={account.username}
                      avatarUrl={account.avatarUrl}
                      className="settings-device-accounts__avatar"
                    />
                  )}

                  <div className="settings-device-accounts__identity">
                    <div className="settings-device-accounts__text">
                      <div className="settings-device-accounts__name-row">
                        <button
                          type="button"
                          className="settings-device-accounts__name-btn"
                          disabled={active || accountBusyId === account.id || !onSwitchAccount}
                          onClick={() => void handleSwitch(account.id)}
                        >
                          <strong>{account.username}</strong>
                        </button>
                        {account.uid && (
                          <button
                            type="button"
                            className={`settings-device-accounts__uid${copiedUidId === account.id ? ' is-copied' : ''}`}
                            title={t('cozyFarm.copyUid')}
                            aria-label={t('cozyFarm.copyUid')}
                            onClick={() => void copyUid(account.id, account.uid!)}
                          >
                            {copiedUidId === account.id ? t('common.copied') : account.uid}
                          </button>
                        )}
                      </div>
                      {active && (
                        <span className="settings-device-accounts__badge">
                          {t('settings.accountActive')}
                        </span>
                      )}
                    </div>
                  </div>

                  {(onRemoveAccount || (active && onLogout)) && (
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      disabled={accountBusyId === account.id}
                      onClick={() => {
                        if (onRemoveAccount) void handleRemove(account.id)
                        else if (active && onLogout) void onLogout().then(() => { onClose(); window.location.reload() })
                      }}
                    >
                      {active ? t('auth.logout') : t('common.delete')}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
          {avatarError && <p className="settings-feedback settings-feedback--error">{avatarError}</p>}

          {onAddAccount && (
            addOpen ? (
              <form className="settings-add-account" onSubmit={(e) => void handleAddAccount(e)}>
                <label className="settings-add-account__field">
                  <span>{t('auth.loginField')}</span>
                  <input
                    className="input"
                    type="text"
                    autoComplete="username"
                    value={addLogin}
                    onChange={(e) => setAddLogin(e.target.value)}
                    required
                    maxLength={254}
                  />
                </label>
                <PasswordField
                  label={t('auth.password')}
                  value={addPassword}
                  onChange={setAddPassword}
                  autoComplete="current-password"
                />
                {addError && <p className="settings-feedback settings-feedback--error">{addError}</p>}
                <div className="settings-add-account__actions">
                  <button type="submit" className="btn btn--primary btn--sm" disabled={adding}>
                    {adding ? t('auth.submitting') : t('settings.accountAddSubmit')}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    disabled={adding}
                    onClick={() => {
                      setAddOpen(false)
                      setAddError('')
                    }}
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                className="btn btn--outline btn--sm settings-device-accounts__add"
                onClick={() => setAddOpen(true)}
              >
                {t('settings.accountAdd')}
              </button>
            )
          )}

          {isAdmin && (
            <Link
              to="/admin-panel"
              className="btn btn--outline settings-admin-link"
              onClick={onClose}
            >
              ⚙ Админ-панель
            </Link>
          )}
        </SettingsSection>
      )}

      {signedIn && !uid && onSetUid && (
        <SettingsSection title={t('settings.uidTitle')} hint={t('settings.uidHint')}>
          <form className="settings-uid-form" onSubmit={(e) => void handleSetUid(e)}>
            <div className="settings-uid-form__row">
              <input
                className="input settings-uid-form__input"
                type="text"
                value={draftUid}
                onChange={(e) => setDraftUid(e.target.value)}
                required
                minLength={1}
                maxLength={64}
                pattern="[a-zA-Z0-9_-]+"
                placeholder={t('auth.uidPlaceholder')}
                autoComplete="off"
                aria-label={t('auth.uid')}
              />
              <button
                type="submit"
                className="btn btn--primary btn--sm"
                disabled={savingUid || !draftUid.trim()}
              >
                {savingUid ? t('auth.submitting') : t('settings.uidSave')}
              </button>
            </div>
            {uidMsg && <p className="settings-feedback">{uidMsg}</p>}
            {uidError && <p className="settings-feedback settings-feedback--error">{uidError}</p>}
          </form>
        </SettingsSection>
      )}
    </SettingsDrawer>
  )
}
