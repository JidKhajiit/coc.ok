import { LanguagePicker, SettingsDrawer, SettingsSection } from './SettingsDrawer'
import { useI18n, type Locale } from '../../i18n'

type Props = {
  open: boolean
  onClose: () => void
  username?: string
  onLogout?: () => Promise<void>
  locale: Locale
  onLocaleChange: (locale: Locale) => void
}

export function SiteSettingsDrawer({
  open,
  onClose,
  username,
  onLogout,
  locale,
  onLocaleChange,
}: Props) {
  const { t } = useI18n()
  const signedIn = Boolean(username && onLogout)

  return (
    <SettingsDrawer
      open={open}
      onClose={onClose}
      title={t('siteSettings.title')}
      subtitle={signedIn ? undefined : t('siteSettings.guestSubtitle')}
    >
      {signedIn && (
        <SettingsSection title={t('settings.signedInAs')}>
          <div className="settings-user">
            <span className="settings-user__avatar" aria-hidden>
              {username!.slice(0, 1).toUpperCase()}
            </span>
            <div className="settings-user__meta">
              <strong className="settings-user__name">{username}</strong>
              <button
                type="button"
                className="btn btn--ghost btn--sm settings-user__logout"
                onClick={() => void onLogout!()}
              >
                {t('auth.logout')}
              </button>
            </div>
          </div>
        </SettingsSection>
      )}

      <SettingsSection title={t('settings.language')} hint={t('settings.languageHint')}>
        <LanguagePicker locale={locale} onChange={onLocaleChange} />
      </SettingsSection>
    </SettingsDrawer>
  )
}
