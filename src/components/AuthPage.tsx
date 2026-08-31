import { useState, type FormEvent } from 'react'
import { useI18n } from '../i18n'
import { BRAND_NAME } from '../brand'
import { AuthMessage, PasswordField } from './PasswordField'

type Mode = 'login' | 'register' | 'forgot' | 'verify-sent'

type Props = {
  onLogin: (login: string, password: string) => Promise<unknown>
  onRegister: (username: string, email: string, password: string) => Promise<unknown>
  onForgotPassword: (email: string) => Promise<unknown>
  onResendVerification: (email: string) => Promise<unknown>
  error: string | null
  info: string | null
  onClearError: () => void
  onClearInfo: () => void
}

export function AuthPage({
  onLogin,
  onRegister,
  onForgotPassword,
  onResendVerification,
  error,
  info,
  onClearError,
  onClearInfo,
}: Props) {
  const { t } = useI18n()
  const [mode, setMode] = useState<Mode>('login')
  const [login, setLogin] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pendingEmail, setPendingEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const switchMode = (next: Mode) => {
    setMode(next)
    onClearError()
    onClearInfo()
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (mode === 'login') {
        await onLogin(login.trim(), password)
      } else if (mode === 'register') {
        const normalizedEmail = email.trim()
        await onRegister(username.trim(), normalizedEmail, password)
        setPendingEmail(normalizedEmail)
        setMode('verify-sent')
        setPassword('')
      } else if (mode === 'forgot') {
        await onForgotPassword(email.trim())
      }
    } catch {
      // error handled by parent
    } finally {
      setSubmitting(false)
    }
  }

  const title =
    mode === 'login'
      ? t('auth.loginTitle')
      : mode === 'register'
        ? t('auth.registerTitle')
        : mode === 'forgot'
          ? t('auth.forgotTitle')
          : t('auth.verifySentTitle')

  const lead =
    mode === 'login'
      ? t('auth.loginLead')
      : mode === 'register'
        ? t('auth.registerLead')
        : mode === 'forgot'
          ? t('auth.forgotLead')
          : t('auth.verifySentLead', { email: pendingEmail })

  return (
    <div className="auth">
      <div className="atmosphere" aria-hidden />
      <div className="auth__card">
        <p className="auth__brand">{BRAND_NAME}</p>
        <h1 className="auth__title">{title}</h1>
        <p className="auth__lead">{lead}</p>

        {mode === 'verify-sent' ? (
          <>
            <AuthMessage error={error} info={info} />
            <div className="auth__actions">
              <button
                type="button"
                className="auth__submit"
                disabled={submitting}
                onClick={async () => {
                  setSubmitting(true)
                  try {
                    await onResendVerification(pendingEmail)
                  } catch {
                    // handled by parent
                  } finally {
                    setSubmitting(false)
                  }
                }}
              >
                {submitting ? t('auth.submitting') : t('auth.resendVerification')}
              </button>
              <button type="button" className="auth__link auth__link--block" onClick={() => switchMode('login')}>
                {t('auth.backToLogin')}
              </button>
            </div>
          </>
        ) : (
          <form className="auth__form" onSubmit={handleSubmit}>
            {mode === 'login' && (
              <label className="auth__field">
                <span>{t('auth.loginField')}</span>
                <input
                  type="text"
                  autoComplete="username"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  required
                  maxLength={254}
                />
              </label>
            )}

            {mode === 'register' && (
              <>
                <label className="auth__field">
                  <span>{t('auth.username')}</span>
                  <input
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    minLength={3}
                    maxLength={32}
                    pattern="[a-zA-Z0-9_-]+"
                  />
                </label>
                <label className="auth__field">
                  <span>{t('auth.email')}</span>
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    maxLength={254}
                  />
                </label>
              </>
            )}

            {mode === 'forgot' && (
              <label className="auth__field">
                <span>{t('auth.email')}</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={254}
                />
              </label>
            )}

            {(mode === 'login' || mode === 'register') && (
              <PasswordField
                label={t('auth.password')}
                value={password}
                onChange={setPassword}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            )}

            {mode === 'login' && (
              <p className="auth__helper">
                <button type="button" className="auth__link" onClick={() => switchMode('forgot')}>
                  {t('auth.forgotPassword')}
                </button>
              </p>
            )}

            <AuthMessage error={error} info={info} />

            <button type="submit" className="auth__submit" disabled={submitting}>
              {submitting
                ? t('auth.submitting')
                : mode === 'login'
                  ? t('auth.login')
                  : mode === 'register'
                    ? t('auth.register')
                    : t('auth.sendResetLink')}
            </button>
          </form>
        )}

        {mode !== 'verify-sent' && (
          <p className="auth__switch">
            {mode === 'login' && (
              <>
                {t('auth.noAccount')}{' '}
                <button type="button" className="auth__link" onClick={() => switchMode('register')}>
                  {t('auth.register')}
                </button>
              </>
            )}
            {mode === 'register' && (
              <>
                {t('auth.hasAccount')}{' '}
                <button type="button" className="auth__link" onClick={() => switchMode('login')}>
                  {t('auth.login')}
                </button>
              </>
            )}
            {mode === 'forgot' && (
              <>
                <button type="button" className="auth__link" onClick={() => switchMode('login')}>
                  {t('auth.backToLogin')}
                </button>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  )
}
