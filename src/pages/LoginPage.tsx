import { useEffect } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthPage } from '../components/AuthPage'
import { PublicAppShell } from '../components/PublicAppShell'
import { useAuth } from '../hooks/useAuth'
import { DEFAULT_POST_LOGIN_PATH, safeNextPath } from '../lib/loginRedirect'

export function LoginPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNextPath(params.get('next')) ?? DEFAULT_POST_LOGIN_PATH

  useEffect(() => {
    if (auth.status === 'authenticated') {
      navigate(next, { replace: true })
    }
  }, [auth.status, navigate, next])

  if (auth.status === 'loading') {
    return (
      <div className="auth auth--loading">
        <div className="atmosphere" aria-hidden />
        <p className="auth__loading">…</p>
      </div>
    )
  }

  if (auth.status === 'authenticated') {
    return <Navigate to={next} replace />
  }

  return (
    <PublicAppShell hideAuthCta showCollectionNav={false}>
      <AuthPage
        onLogin={async (login, password) => {
          await auth.login(login, password)
          navigate(next, { replace: true })
        }}
        onRegister={auth.register}
        onForgotPassword={auth.forgotPassword}
        onResendVerification={auth.resendVerification}
        error={auth.error}
        info={auth.info}
        onClearError={() => auth.setError(null)}
        onClearInfo={() => auth.setInfo(null)}
      />
    </PublicAppShell>
  )
}
