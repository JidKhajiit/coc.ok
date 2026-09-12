import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useProfiles } from '../hooks/useProfiles'
import { PublicAppShell } from './PublicAppShell'
import { loginPath } from '../lib/loginRedirect'

type Props = {
  permission: string
  redirectTo?: string
}

export function RequirePermission({ permission, redirectTo }: Props) {
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
    const to = redirectTo ?? loginPath(`${location.pathname}${location.search}`)
    return <Navigate to={to} replace />
  }

  if (!auth.user.permissions.includes(permission)) {
    return (
      <PublicAppShell>
        <div className="auth">
          <div className="atmosphere" aria-hidden />
          <div className="auth__box">
            <h1 className="auth__title">Доступ запрещён</h1>
            <p className="auth__text">У вас нет прав для просмотра этой страницы.</p>
            <a href="/card-trades" className="btn btn--primary">
              На главную
            </a>
          </div>
        </div>
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

export type PermissionOutletContext = {
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
