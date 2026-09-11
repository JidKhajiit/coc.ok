import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useProfiles } from '../hooks/useProfiles'
import { useI18n, type Locale } from '../i18n'
import { BRAND_NAME } from '../brand'
import { SiteSettingsDrawer } from './settings/SiteSettingsDrawer'
import { UserAvatar } from './UserAvatar'

type Props = {
  locale: Locale
  onLocaleChange: (locale: Locale) => void
  /** Ссылки на коллекции уместны только в контексте трекера, не на главной сайта */
  showCollectionNav?: boolean
  collectionPath?: string
  onPageSettings?: () => void
}

export function PublicChrome({
  locale,
  onLocaleChange,
  showCollectionNav = true,
  collectionPath = '/summer-party/collections',
  onPageSettings,
}: Props) {
  const { t } = useI18n()
  const location = useLocation()
  const auth = useAuth()
  const profiles = useProfiles(auth.status === 'authenticated')
  const [siteOpen, setSiteOpen] = useState(false)

  const onLoginPage = location.pathname === '/card-trades' && auth.status === 'unauthenticated'
  const showAppCta = showCollectionNav && auth.status !== 'loading' && !onLoginPage

  return (
    <>
      <header className="public-chrome">
        <nav className="public-chrome__nav" aria-label={t('nav.public')}>
          <Link to="/" className="public-chrome__brand">
            {BRAND_NAME}
          </Link>
          {showCollectionNav && (
            <Link to={collectionPath} className="public-chrome__link">
              {t('share.browseCollections')}
            </Link>
          )}
        </nav>

        <div className="public-chrome__actions">
          {showAppCta &&
            (auth.user ? (
              <Link to="/card-trades" className="public-chrome__app-link">
                <UserAvatar
                  username={auth.user.username}
                  avatarUrl={auth.user.avatarUrl}
                  className="public-chrome__avatar"
                />
                <span className="public-chrome__app-label">{t('share.backToApp')}</span>
              </Link>
            ) : (
              <Link to="/card-trades" className="btn btn--primary btn--sm public-chrome__cta">
                {t('auth.login')}
              </Link>
            ))}

          <button
            type="button"
            className="public-chrome__btn public-chrome__btn--icon"
            onClick={onPageSettings}
            disabled={!onPageSettings}
            aria-label={t('app.pageSettings')}
            title={t('app.pageSettings')}
          >
            <span aria-hidden>⚙</span>
          </button>

          <button
            type="button"
            className="public-chrome__btn public-chrome__btn--personal"
            onClick={() => setSiteOpen(true)}
            aria-label={t('app.personalization')}
            title={t('app.personalization')}
          >
            {auth.user ? (
              <>
                <UserAvatar
                  username={auth.user.username}
                  avatarUrl={auth.user.avatarUrl}
                  className="public-chrome__avatar"
                />
                <span className="public-chrome__btn-label">{auth.user.username}</span>
              </>
            ) : (
              <>
                <span aria-hidden>◐</span>
                <span className="public-chrome__btn-label">{t('app.personalization')}</span>
              </>
            )}
          </button>
        </div>
      </header>

      <SiteSettingsDrawer
        open={siteOpen}
        onClose={() => setSiteOpen(false)}
        username={auth.user?.username}
        avatarUrl={auth.user?.avatarUrl}
        userId={auth.user?.id}
        permissions={auth.user?.permissions}
        accounts={auth.accounts}
        profiles={auth.user ? profiles : undefined}
        onLogout={auth.user ? auth.logout : undefined}
        onUploadAvatar={auth.user ? auth.uploadAvatar : undefined}
        onSwitchAccount={auth.user ? auth.switchAccount : undefined}
        onRemoveAccount={auth.user ? auth.removeAccount : undefined}
        onAddAccount={auth.user ? auth.login : undefined}
        onActiveProfileChange={auth.user ? auth.patchActiveProfileId : undefined}
        locale={locale}
        onLocaleChange={onLocaleChange}
      />
    </>
  )
}
