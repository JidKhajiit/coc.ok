import { useState } from 'react'
import { useI18n, type Locale } from '../../i18n'
import { SiteSettingsDrawer } from './SiteSettingsDrawer'

type Props = {
  username?: string
  permissions?: string[]
  onLogout?: () => Promise<void>
  locale: Locale
  onLocaleChange: (locale: Locale) => void
  onEventSettings?: () => void
}

export function AppToolbar({ username, permissions, onLogout, locale, onLocaleChange, onEventSettings }: Props) {
  const { t } = useI18n()
  const [siteOpen, setSiteOpen] = useState(false)
  const signedIn = Boolean(username)

  return (
    <>
      <div className="app-toolbar">
        {onEventSettings && (
          <button
            type="button"
            className="app-toolbar__btn app-toolbar__btn--event"
            onClick={onEventSettings}
            aria-label={t('app.eventSettings')}
            title={t('app.eventSettings')}
          >
            <span className="app-toolbar__icon" aria-hidden>
              ⚙
            </span>
            <span className="app-toolbar__label">{t('app.eventSettingsShort')}</span>
          </button>
        )}

        <button
          type="button"
          className="app-toolbar__btn app-toolbar__btn--site"
          onClick={() => setSiteOpen(true)}
          aria-label={t('app.siteSettings')}
          title={t('app.siteSettings')}
        >
          {signedIn ? (
            <>
              <span className="app-toolbar__avatar" aria-hidden>
                {username!.slice(0, 1).toUpperCase()}
              </span>
              <span className="app-toolbar__label app-toolbar__label--user">{username}</span>
            </>
          ) : (
            <>
              <span className="app-toolbar__icon" aria-hidden>
                ◐
              </span>
              <span className="app-toolbar__label">{t('app.siteSettingsShort')}</span>
            </>
          )}
        </button>
      </div>

      <SiteSettingsDrawer
        open={siteOpen}
        onClose={() => setSiteOpen(false)}
        username={username}
        permissions={permissions}
        onLogout={onLogout}
        locale={locale}
        onLocaleChange={onLocaleChange}
      />
    </>
  )
}
