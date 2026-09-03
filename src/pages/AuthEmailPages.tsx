import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import * as api from '../api/client'
import { BRAND_NAME } from '../brand'
import { AuthMessage, PasswordField } from '../components/PasswordField'
import { useI18n } from '../i18n'
import { PublicAppShell } from '../components/PublicAppShell'
import '../App.css'

function VerifyEmailContent() {
  const { t } = useI18n()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') ?? ''
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const requestedRef = useRef(false)

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setError(t('auth.invalidToken'))
      return
    }

    // Avoid double-consume under React Strict Mode in development.
    if (requestedRef.current) return
    requestedRef.current = true

    let cancelled = false
    void api
      .verifyEmail(token)
      .then(() => {
        if (!cancelled) setStatus('ok')
      })
      .catch((err) => {
        if (!cancelled) {
          setStatus('error')
          setError(err instanceof api.ApiError ? err.message : t('auth.verifyFailed'))
        }
      })

    return () => {
      cancelled = true
    }
  }, [token, t])

  return (
    <div className="auth">
      <div className="atmosphere" aria-hidden />
      <div className="auth__card">
        <p className="auth__brand">{BRAND_NAME}</p>
        <h1 className="auth__title">{t('auth.verifyEmailTitle')}</h1>
        {status === 'loading' && <p className="auth__lead">{t('auth.loading')}</p>}
        {status === 'ok' && (
          <>
            <p className="auth__lead">{t('auth.verifyEmailSuccess')}</p>
            <button type="button" className="auth__submit" onClick={() => navigate('/card-trades')}>
              {t('auth.login')}
            </button>
          </>
        )}
        {status === 'error' && (
          <>
            <AuthMessage error={error} />
            <Link to="/card-trades" className="auth__link auth__link--block">
              {t('auth.backToLogin')}
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

function ResetPasswordContent() {
  const { t } = useI18n()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!token) {
      setError(t('auth.invalidToken'))
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await api.resetPassword(token, password)
      setDone(true)
    } catch (err) {
      setError(err instanceof api.ApiError ? err.message : t('auth.resetFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth">
      <div className="atmosphere" aria-hidden />
      <div className="auth__card">
        <p className="auth__brand">{BRAND_NAME}</p>
        <h1 className="auth__title">{t('auth.resetTitle')}</h1>
        {done ? (
          <>
            <p className="auth__lead">{t('auth.resetSuccess')}</p>
            <button type="button" className="auth__submit" onClick={() => navigate('/card-trades')}>
              {t('auth.login')}
            </button>
          </>
        ) : (
          <form className="auth__form" onSubmit={handleSubmit}>
            <p className="auth__lead">{t('auth.resetLead')}</p>
            <PasswordField
              label={t('auth.newPassword')}
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
            />
            <AuthMessage error={error} />
            <button type="submit" className="auth__submit" disabled={submitting || !token}>
              {submitting ? t('auth.submitting') : t('auth.resetPassword')}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export function VerifyEmailPage() {
  return (
    <PublicAppShell>
      <VerifyEmailContent />
    </PublicAppShell>
  )
}

export function ResetPasswordPage() {
  return (
    <PublicAppShell>
      <ResetPasswordContent />
    </PublicAppShell>
  )
}
