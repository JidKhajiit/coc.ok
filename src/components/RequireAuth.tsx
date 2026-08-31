import { Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { AuthPage } from './AuthPage'
import { I18nProvider } from '../i18n'

export function RequireAuth() {
  const auth = useAuth()

  if (auth.status === 'loading') {
    return (
      <div className="auth auth--loading">
        <div className="atmosphere" aria-hidden />
        <p className="auth__loading">…</p>
      </div>
    )
  }

  if (!auth.user) {
    return (
      <I18nProvider locale="ru" setLocale={() => {}}>
        <AuthPage
          onLogin={auth.login}
          onRegister={auth.register}
          onForgotPassword={auth.forgotPassword}
          onResendVerification={auth.resendVerification}
          error={auth.error}
          info={auth.info}
          onClearError={() => auth.setError(null)}
          onClearInfo={() => auth.setInfo(null)}
        />
      </I18nProvider>
    )
  }

  return <Outlet context={{ user: auth.user, logout: auth.logout }} />
}

export type AuthOutletContext = {
  user: { id: string; username: string }
  logout: () => Promise<void>
}
