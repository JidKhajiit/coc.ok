import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { LanguagePicker, SettingsDrawer, SettingsSection } from './SettingsDrawer'
import { useI18n, type Locale } from '../../i18n'
import { ApiError, type DeviceAccount, type GameProfile, type ProfileMember } from '../../api/client'
import { PasswordField } from '../PasswordField'
import { UserAvatar } from '../UserAvatar'
import type { useProfiles } from '../../hooks/useProfiles'

type ProfilesApi = ReturnType<typeof useProfiles>

type Props = {
  open: boolean
  onClose: () => void
  username?: string
  avatarUrl?: string | null
  userId?: string
  permissions?: string[]
  accounts?: DeviceAccount[]
  profiles?: ProfilesApi
  onLogout?: () => Promise<unknown>
  onUploadAvatar?: (file: File) => Promise<unknown>
  onSwitchAccount?: (userId: string) => Promise<unknown>
  onRemoveAccount?: (userId: string) => Promise<unknown>
  onAddAccount?: (login: string, password: string) => Promise<unknown>
  onActiveProfileChange?: (activeProfileId: string | null) => void
  locale: Locale
  onLocaleChange: (locale: Locale) => void
}

export function SiteSettingsDrawer({
  open,
  onClose,
  username,
  avatarUrl = null,
  userId,
  permissions = [],
  accounts = [],
  profiles,
  onLogout,
  onUploadAvatar,
  onSwitchAccount,
  onRemoveAccount,
  onAddAccount,
  onActiveProfileChange,
  locale,
  onLocaleChange,
}: Props) {
  const { t } = useI18n()
  const signedIn = Boolean(username && onLogout)
  const isAdmin = permissions.includes('admin:access')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const claimFileRef = useRef<HTMLInputElement>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addLogin, setAddLogin] = useState('')
  const [addPassword, setAddPassword] = useState('')
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)
  const [accountBusyId, setAccountBusyId] = useState<string | null>(null)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarError, setAvatarError] = useState('')

  const [newGameUid, setNewGameUid] = useState('')
  const [newNickname, setNewNickname] = useState('')
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileMsg, setProfileMsg] = useState('')
  const [nicknameDrafts, setNicknameDrafts] = useState<Record<string, string>>({})
  const [adminsFor, setAdminsFor] = useState<string | null>(null)
  const [members, setMembers] = useState<ProfileMember[]>([])
  const [adminUsername, setAdminUsername] = useState('')
  const [claimTarget, setClaimTarget] = useState<{ profileId: string; gameUid: string } | null>(null)
  const [claimMessage, setClaimMessage] = useState('')
  const [claimFile, setClaimFile] = useState<File | null>(null)

  useEffect(() => {
    if (!open) return
    setAddOpen(false)
    setAddLogin('')
    setAddPassword('')
    setAddError('')
    setAccountBusyId(null)
    setAvatarBusy(false)
    setAvatarError('')
    setNewGameUid('')
    setNewNickname('')
    setProfileError('')
    setProfileMsg('')
    setAdminsFor(null)
    setMembers([])
    setAdminUsername('')
    setClaimTarget(null)
    setClaimMessage('')
    setClaimFile(null)
    if (profiles) {
      setNicknameDrafts(Object.fromEntries(profiles.profiles.map((p) => [p.id, p.nickname])))
    }
  }, [open, profiles?.profiles])

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

  const syncActive = (activeProfileId: string | null) => {
    onActiveProfileChange?.(activeProfileId)
  }

  const handleCreateProfile = async (e: FormEvent) => {
    e.preventDefault()
    if (!profiles) return
    setProfileBusy(true)
    setProfileError('')
    setProfileMsg('')
    setClaimTarget(null)
    try {
      const result = await profiles.create(newGameUid.trim(), newNickname.trim())
      setNewGameUid('')
      setNewNickname('')
      setProfileMsg(t('profiles.created'))
      syncActive(result.activeProfileId)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const body = err.body as { claimable?: boolean; profileId?: string } | null
        if (body?.claimable && body.profileId) {
          setClaimTarget({ profileId: body.profileId, gameUid: newGameUid.trim() })
          setProfileError(t('profiles.claimable'))
          return
        }
      }
      setProfileError(err instanceof Error ? err.message : t('profiles.saveFail'))
    } finally {
      setProfileBusy(false)
    }
  }

  const handleRenameProfile = async (profile: GameProfile) => {
    if (!profiles) return
    const nickname = (nicknameDrafts[profile.id] ?? profile.nickname).trim()
    if (!nickname || nickname === profile.nickname) return
    setProfileBusy(true)
    setProfileError('')
    try {
      await profiles.update(profile.id, nickname)
      setProfileMsg(t('profiles.renamed'))
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : t('profiles.saveFail'))
    } finally {
      setProfileBusy(false)
    }
  }

  const handleDeleteProfile = async (profile: GameProfile) => {
    if (!profiles) return
    if (!window.confirm(t('profiles.deleteConfirm', { nickname: profile.nickname }))) return
    setProfileBusy(true)
    setProfileError('')
    try {
      const result = await profiles.remove(profile.id)
      syncActive(result.activeProfileId)
      setProfileMsg(t('profiles.deleted'))
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : t('profiles.saveFail'))
    } finally {
      setProfileBusy(false)
    }
  }

  const handleSetActive = async (profileId: string) => {
    if (!profiles || profileId === profiles.activeProfileId) return
    setProfileBusy(true)
    setProfileError('')
    try {
      const result = await profiles.setActive(profileId)
      syncActive(result.activeProfileId)
      onClose()
      window.location.reload()
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : t('profiles.saveFail'))
      setProfileBusy(false)
    }
  }

  const openAdmins = async (profileId: string) => {
    if (!profiles) return
    setAdminsFor(profileId)
    setAdminUsername('')
    setProfileError('')
    try {
      setMembers(await profiles.listAdmins(profileId))
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : t('profiles.saveFail'))
    }
  }

  const handleAddAdmin = async (e: FormEvent) => {
    e.preventDefault()
    if (!profiles || !adminsFor) return
    setProfileBusy(true)
    setProfileError('')
    try {
      await profiles.addAdmin(adminsFor, adminUsername.trim())
      setAdminUsername('')
      setMembers(await profiles.listAdmins(adminsFor))
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : t('profiles.saveFail'))
    } finally {
      setProfileBusy(false)
    }
  }

  const handleRemoveAdmin = async (userIdToRemove: string) => {
    if (!profiles || !adminsFor) return
    setProfileBusy(true)
    try {
      await profiles.removeAdmin(adminsFor, userIdToRemove)
      setMembers(await profiles.listAdmins(adminsFor))
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : t('profiles.saveFail'))
    } finally {
      setProfileBusy(false)
    }
  }

  const handleClaim = async (e: FormEvent) => {
    e.preventDefault()
    if (!profiles || !claimTarget || !claimFile) return
    setProfileBusy(true)
    setProfileError('')
    try {
      await profiles.claim(claimTarget.profileId, claimFile, claimMessage)
      setClaimTarget(null)
      setClaimFile(null)
      setClaimMessage('')
      setProfileMsg(t('profiles.claimSubmitted'))
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : t('profiles.saveFail'))
    } finally {
      setProfileBusy(false)
    }
  }

  const showAccountSwitcher = signedIn
  const displayAccounts: DeviceAccount[] =
    accounts.length > 0
      ? accounts
      : username && userId
        ? [{ id: userId, username, avatarUrl, active: true }]
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

      {signedIn && profiles && (
        <SettingsSection title={t('profiles.title')} tip={t('profiles.hint')} tipAriaLabel={t('profiles.hintAria')}>
          <ul className="settings-profiles">
            {profiles.profiles.length === 0 && (
              <li className="settings-profiles__empty">{t('profiles.empty')}</li>
            )}
            {profiles.profiles.map((profile) => {
              const active = profile.id === profiles.activeProfileId
              return (
                <li key={profile.id} className={`settings-profiles__row${active ? ' is-active' : ''}`}>
                  <div className="settings-profiles__main">
                    <input
                      className="input"
                      value={nicknameDrafts[profile.id] ?? profile.nickname}
                      onChange={(e) =>
                        setNicknameDrafts((prev) => ({ ...prev, [profile.id]: e.target.value }))
                      }
                      onBlur={() => void handleRenameProfile(profile)}
                      aria-label={t('profiles.nickname')}
                    />
                    <span className="settings-profiles__uid">{profile.gameUid}</span>
                    {active && (
                      <span className="settings-device-accounts__badge">{t('profiles.active')}</span>
                    )}
                  </div>
                  <div className="settings-profiles__actions">
                    {!active && (
                      <button
                        type="button"
                        className="btn btn--outline btn--sm"
                        disabled={profileBusy}
                        onClick={() => void handleSetActive(profile.id)}
                      >
                        {t('profiles.setActive')}
                      </button>
                    )}
                    {(profile.role === 'owner' || profile.role === 'admin') && (
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        disabled={profileBusy}
                        onClick={() => void openAdmins(profile.id)}
                      >
                        {t('profiles.admins')}
                      </button>
                    )}
                    {profile.role === 'owner' && (
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        disabled={profileBusy}
                        onClick={() => void handleDeleteProfile(profile)}
                      >
                        {t('common.delete')}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>

          <form className="settings-profiles__create" onSubmit={(e) => void handleCreateProfile(e)}>
            <label className="settings-add-account__field">
              <span>{t('profiles.gameUid')}</span>
              <input
                className="input"
                value={newGameUid}
                onChange={(e) => setNewGameUid(e.target.value)}
                required
                minLength={1}
                maxLength={64}
                pattern="[a-zA-Z0-9_-]+"
                autoComplete="off"
              />
            </label>
            <label className="settings-add-account__field">
              <span>{t('profiles.nickname')}</span>
              <input
                className="input"
                value={newNickname}
                onChange={(e) => setNewNickname(e.target.value)}
                required
                minLength={1}
                maxLength={64}
                autoComplete="off"
              />
            </label>
            <button
              type="submit"
              className="btn btn--primary btn--sm"
              disabled={profileBusy || !newGameUid.trim() || !newNickname.trim()}
            >
              {profileBusy ? t('auth.submitting') : t('profiles.add')}
            </button>
          </form>

          {claimTarget && (
            <form className="settings-profiles__claim" onSubmit={(e) => void handleClaim(e)}>
              <p className="settings-feedback">{t('profiles.claimHint', { uid: claimTarget.gameUid })}</p>
              <label className="settings-add-account__field">
                <span>{t('profiles.claimScreenshot')}</span>
                <input
                  ref={claimFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  required
                  onChange={(e) => setClaimFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <label className="settings-add-account__field">
                <span>{t('profiles.claimMessage')}</span>
                <textarea
                  className="input"
                  value={claimMessage}
                  onChange={(e) => setClaimMessage(e.target.value)}
                  rows={3}
                  maxLength={2000}
                />
              </label>
              <button type="submit" className="btn btn--primary btn--sm" disabled={profileBusy || !claimFile}>
                {t('profiles.submitClaim')}
              </button>
            </form>
          )}

          {adminsFor && (
            <div className="settings-profiles__admins">
              <h4>{t('profiles.adminsTitle')}</h4>
              <ul className="settings-profiles__admin-list">
                {members.map((m) => (
                  <li key={m.userId}>
                    <span>
                      {m.username} ({m.role})
                    </span>
                    {m.role !== 'owner' && (
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        disabled={profileBusy}
                        onClick={() => void handleRemoveAdmin(m.userId)}
                      >
                        {t('common.delete')}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <form className="settings-profiles__admin-add" onSubmit={(e) => void handleAddAdmin(e)}>
                <input
                  className="input"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder={t('profiles.adminUsername')}
                  required
                  minLength={3}
                  maxLength={32}
                  pattern="[a-zA-Z0-9_-]+"
                />
                <button type="submit" className="btn btn--primary btn--sm" disabled={profileBusy}>
                  {t('profiles.addAdmin')}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => setAdminsFor(null)}
                >
                  {t('common.cancel')}
                </button>
              </form>
            </div>
          )}

          {profileMsg && <p className="settings-feedback">{profileMsg}</p>}
          {profileError && <p className="settings-feedback settings-feedback--error">{profileError}</p>}
        </SettingsSection>
      )}
    </SettingsDrawer>
  )
}
