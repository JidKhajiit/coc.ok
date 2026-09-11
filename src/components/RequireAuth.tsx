import { Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useProfiles } from '../hooks/useProfiles'
import { AuthPage } from './AuthPage'
import { PublicAppShell } from './PublicAppShell'

export function RequireAuth() {
  const auth = useAuth()
  const profiles = useProfiles(auth.status === 'authenticated')

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
      <PublicAppShell>
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
      </PublicAppShell>
    )
  }

  return (
    <Outlet
      context={{
        user: auth.user,
        logout: auth.logout,
        uploadAvatar: auth.uploadAvatar,
        accounts: auth.accounts,
        switchAccount: auth.switchAccount,
        removeAccount: auth.removeAccount,
        addAccount: auth.login,
        profiles,
        patchActiveProfileId: auth.patchActiveProfileId,
        refreshAuth: auth.refresh,
      }}
    />
  )
}

export type AuthOutletContext = {
  user: import('../api/client').AuthUser
  logout: () => Promise<unknown>
  uploadAvatar: (file: File) => Promise<unknown>
  accounts: import('../api/client').DeviceAccount[]
  switchAccount: (userId: string) => Promise<unknown>
  removeAccount: (userId: string) => Promise<unknown>
  addAccount: (login: string, password: string) => Promise<unknown>
  profiles: ReturnType<typeof useProfiles>
  patchActiveProfileId: (activeProfileId: string | null) => void
  refreshAuth: () => Promise<unknown>
}
