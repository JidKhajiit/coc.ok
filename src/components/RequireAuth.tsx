import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useProfiles } from '../hooks/useProfiles'
import { loginPath } from '../lib/loginRedirect'

export function RequireAuth() {
  const auth = useAuth()
  const profiles = useProfiles(auth.status === 'authenticated')
  const location = useLocation()

  if (auth.status === 'loading') {
    return (
      <div className="auth auth--loading">
        <div className="atmosphere" aria-hidden />
        <p className="auth__loading">…</p>
      </div>
    )
  }

  if (!auth.user) {
    return <Navigate to={loginPath(`${location.pathname}${location.search}`)} replace />
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
