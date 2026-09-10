import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n, type Locale } from '../../i18n'
import { BRAND_NAME } from '../../brand'
import { SiteSettingsDrawer } from './SiteSettingsDrawer'
import { UserAvatar } from '../UserAvatar'
import type { DeviceAccount } from '../../api/client'

type Props = {
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
  /** Page-specific settings (event drawer, etc.). Gear is always shown. */
  onPageSettings?: () => void
  /** @deprecated use onPageSettings */
  onEventSettings?: () => void
  /** Коллекции игроков — только в контексте card-trades, не на других эвентах */
  showCollectionNav?: boolean
  collectionPath?: string
}

export function AppToolbar({
  username,
  uid = null,
  avatarUrl = null,
  userId,
  permissions,
  accounts,
  onLogout,
  onSetUid,
  onUploadAvatar,
  onSwitchAccount,
  onRemoveAccount,
  onAddAccount,
  locale,
  onLocaleChange,
  onPageSettings,
  onEventSettings,
  showCollectionNav = false,
  collectionPath = '/summer-party/collections',
}: Props) {
  const { t } = useI18n()
  const [siteOpen, setSiteOpen] = useState(false)
  const signedIn = Boolean(username)
  const openPageSettings = onPageSettings ?? onEventSettings

  return (
    <>
      <div className="app-toolbar">
        <nav className="app-toolbar__nav" aria-label={t('nav.public')}>
          <Link to="/" className="app-toolbar__brand">
            {BRAND_NAME}
          </Link>
          {showCollectionNav && (
            <Link to={collectionPath} className="app-toolbar__link">
              {t('share.browseCollections')}
            </Link>
          )}
        </nav>

        <div className="app-toolbar__actions">
          <button
            type="button"
            className="app-toolbar__btn app-toolbar__btn--icon"
            onClick={openPageSettings}
            disabled={!openPageSettings}
            aria-label={t('app.pageSettings')}
            title={t('app.pageSettings')}
          >
            <span className="app-toolbar__icon" aria-hidden>
              ⚙
            </span>
          </button>

          <button
            type="button"
            className="app-toolbar__btn app-toolbar__btn--site"
            onClick={() => setSiteOpen(true)}
            aria-label={t('app.personalization')}
            title={t('app.personalization')}
          >
            {signedIn ? (
              <>
                <UserAvatar
                  username={username!}
                  avatarUrl={avatarUrl}
                  className="app-toolbar__avatar"
                />
                <span className="app-toolbar__label app-toolbar__label--user">{username}</span>
              </>
            ) : (
              <>
                <span className="app-toolbar__icon" aria-hidden>
                  ◐
                </span>
                <span className="app-toolbar__label">{t('app.personalization')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      <SiteSettingsDrawer
        open={siteOpen}
        onClose={() => setSiteOpen(false)}
        username={username}
        uid={uid}
        avatarUrl={avatarUrl}
        userId={userId}
        permissions={permissions}
        accounts={accounts}
        onLogout={onLogout}
        onSetUid={onSetUid}
        onUploadAvatar={onUploadAvatar}
        onSwitchAccount={onSwitchAccount}
        onRemoveAccount={onRemoveAccount}
        onAddAccount={onAddAccount}
        locale={locale}
        onLocaleChange={onLocaleChange}
      />
    </>
  )
}
