import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { PublicAppShell } from './PublicAppShell'

type Props = {
  permission: string
  redirectTo?: string
}

export function RequirePermission({ permission, redirectTo = '/card-trades' }: Props) {
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
    return <Navigate to={redirectTo} replace />
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

  return <Outlet context={{ user: auth.user, logout: auth.logout }} />
}

export type PermissionOutletContext = {
  user: { id: string; username: string; permissions: string[] }
  logout: () => Promise<void>
}
