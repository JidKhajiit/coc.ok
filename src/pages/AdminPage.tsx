import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useOutletContext } from 'react-router-dom'
import type { PermissionOutletContext } from '../components/RequirePermission'
import type { AdminUser, AdminRole, AdminPermission, DatabaseBackup } from '../api/client'
import * as api from '../api/client'
import { BRAND_NAME } from '../brand'
import '../App.css'

type AdminData = {
  users: AdminUser[]
  roles: AdminRole[]
  permissions: AdminPermission[]
}

function AdminShell() {
  const { user, logout } = useOutletContext<PermissionOutletContext>()
  const [data, setData] = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [users, roles, permissions] = await Promise.all([
        api.getAdminUsers(),
        user.permissions.includes('roles:view') ? api.getAdminRoles() : Promise.resolve([]),
        user.permissions.includes('roles:view') ? api.getAdminPermissions() : Promise.resolve([]),
      ])
      setData({ users, roles, permissions })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [user.permissions])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const canManageRoles = user.permissions.includes('roles:view')

  return (
    <div className="app admin-app">
      <div className="atmosphere" aria-hidden />

      <header className="admin-header">
        <div className="admin-header__left">
          <Link to="/card-trades" className="admin-header__back">
            ← {BRAND_NAME}
          </Link>
          <h1 className="admin-header__title">Админ-панель</h1>
        </div>
        <div className="admin-header__right">
          <span className="admin-header__user">{user.username}</span>
          <button type="button" className="btn btn--sm btn--outline" onClick={logout}>
            Выход
          </button>
        </div>
      </header>

      <nav className="tabs admin-tabs" aria-label="Админ-панель">
        <NavLink
          to="/admin-panel"
          end
          className={({ isActive }) => `tabs__btn ${isActive ? 'is-active' : ''}`}
        >
          Пользователи
        </NavLink>
        {canManageRoles && (
          <>
            <NavLink
              to="/admin-panel/roles"
              className={({ isActive }) => `tabs__btn ${isActive ? 'is-active' : ''}`}
            >
              Роли
            </NavLink>
            <NavLink
              to="/admin-panel/backup"
              className={({ isActive }) => `tabs__btn ${isActive ? 'is-active' : ''}`}
            >
              Бэкап БД
            </NavLink>
          </>
        )}
      </nav>

      <main className="main admin-main">
        {loading ? (
          <div className="admin-loading">Загрузка…</div>
        ) : error ? (
          <div className="admin-error">
            <p>{error}</p>
            <button type="button" className="btn btn--primary" onClick={refresh}>
              Повторить
            </button>
          </div>
        ) : data ? (
          <Outlet context={{ user, data, refresh }} />
        ) : null}
      </main>
    </div>
  )
}

export type AdminOutletContext = {
  user: PermissionOutletContext['user']
  data: AdminData
  refresh: () => Promise<void>
}

// ─────────────────────────────────────────────────────────────────────────────
// Users Tab
// ─────────────────────────────────────────────────────────────────────────────

export function AdminUsersTab() {
  const { user: currentUser, data, refresh } = useOutletContext<AdminOutletContext>()
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const canEdit = currentUser.permissions.includes('users:edit')
  const canDelete = currentUser.permissions.includes('users:delete')

  const startEdit = (u: AdminUser) => {
    setEditingUserId(u.id)
    setSelectedRoleIds(u.roles.map((r) => r.id))
  }

  const cancelEdit = () => {
    setEditingUserId(null)
    setSelectedRoleIds([])
  }

  const saveRoles = async () => {
    if (!editingUserId) return
    setSaving(true)
    try {
      await api.updateUserRoles(editingUserId, selectedRoleIds)
      await refresh()
      setEditingUserId(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (userId: string) => {
    if (!confirm('Удалить пользователя? Это действие нельзя отменить.')) return
    setDeleting(userId)
    try {
      await api.deleteUser(userId)
      await refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setDeleting(null)
    }
  }

  const toggleRole = (roleId: string) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId],
    )
  }

  return (
    <div className="admin-section">
      <h2 className="admin-section__title">Пользователи ({data.users.length})</h2>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Имя</th>
              <th>Email</th>
              <th>Роли</th>
              <th>Дата</th>
              {(canEdit || canDelete) && <th>Действия</th>}
            </tr>
          </thead>
          <tbody>
            {data.users.map((u) => (
              <tr key={u.id} className={u.id === currentUser.id ? 'is-current' : ''}>
                <td>
                  <strong>{u.username}</strong>
                  {u.id === currentUser.id && <span className="admin-badge admin-badge--you">вы</span>}
                </td>
                <td>
                  {u.email ?? '—'}
                  {u.email && !u.emailVerified && (
                    <span className="admin-badge admin-badge--warn">не подтв.</span>
                  )}
                </td>
                <td>
                  {editingUserId === u.id ? (
                    <div className="admin-role-editor">
                      {data.roles.map((role) => (
                        <label key={role.id} className="admin-checkbox">
                          <input
                            type="checkbox"
                            checked={selectedRoleIds.includes(role.id)}
                            onChange={() => toggleRole(role.id)}
                          />
                          {role.name}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <span className="admin-roles">
                      {u.roles.map((r) => (
                        <span key={r.id} className="admin-role-tag">
                          {r.name}
                        </span>
                      ))}
                      {u.roles.length === 0 && <span className="admin-muted">—</span>}
                    </span>
                  )}
                </td>
                <td className="admin-date">
                  {new Date(u.createdAt).toLocaleDateString('ru-RU')}
                </td>
                {(canEdit || canDelete) && (
                  <td className="admin-actions">
                    {editingUserId === u.id ? (
                      <>
                        <button
                          type="button"
                          className="btn btn--sm btn--primary"
                          onClick={saveRoles}
                          disabled={saving}
                        >
                          {saving ? '…' : 'Сохранить'}
                        </button>
                        <button
                          type="button"
                          className="btn btn--sm btn--outline"
                          onClick={cancelEdit}
                          disabled={saving}
                        >
                          Отмена
                        </button>
                      </>
                    ) : (
                      <>
                        {canEdit && (
                          <button
                            type="button"
                            className="btn btn--sm btn--outline"
                            onClick={() => startEdit(u)}
                          >
                            Роли
                          </button>
                        )}
                        {canDelete && u.id !== currentUser.id && (
                          <button
                            type="button"
                            className="btn btn--sm btn--danger"
                            onClick={() => handleDelete(u.id)}
                            disabled={deleting === u.id}
                          >
                            {deleting === u.id ? '…' : 'Удалить'}
                          </button>
                        )}
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Roles Tab
// ─────────────────────────────────────────────────────────────────────────────

export function AdminRolesTab() {
  const { user: currentUser, data, refresh } = useOutletContext<AdminOutletContext>()
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', description: '', permissionIds: [] as string[] })
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)

  const canManage = currentUser.permissions.includes('roles:manage')

  const startEdit = (role: AdminRole) => {
    setEditingRoleId(role.id)
    setForm({
      name: role.name,
      description: role.description ?? '',
      permissionIds: role.permissions.map((p) => p.id),
    })
  }

  const startCreate = () => {
    setCreating(true)
    setForm({ name: '', description: '', permissionIds: [] })
  }

  const cancelEdit = () => {
    setEditingRoleId(null)
    setCreating(false)
    setForm({ name: '', description: '', permissionIds: [] })
  }

  const togglePermission = (permId: string) => {
    setForm((prev) => ({
      ...prev,
      permissionIds: prev.permissionIds.includes(permId)
        ? prev.permissionIds.filter((id) => id !== permId)
        : [...prev.permissionIds, permId],
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (creating) {
        await api.createRole({
          name: form.name,
          description: form.description || undefined,
          permissionIds: form.permissionIds,
        })
      } else if (editingRoleId) {
        await api.updateRole(editingRoleId, {
          name: form.name,
          description: form.description || undefined,
          permissionIds: form.permissionIds,
        })
      }
      await refresh()
      cancelEdit()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (roleId: string) => {
    if (!confirm('Удалить роль?')) return
    try {
      await api.deleteRole(roleId)
      await refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка')
    }
  }

  return (
    <div className="admin-section">
      <div className="admin-section__header">
        <h2 className="admin-section__title">Роли ({data.roles.length})</h2>
        {canManage && !creating && !editingRoleId && (
          <button type="button" className="btn btn--sm btn--primary" onClick={startCreate}>
            + Новая роль
          </button>
        )}
      </div>

      {(creating || editingRoleId) && (
        <div className="admin-form">
          <h3 className="admin-form__title">{creating ? 'Новая роль' : 'Редактировать роль'}</h3>
          <div className="admin-form__field">
            <label>Название</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              disabled={editingRoleId ? data.roles.find((r) => r.id === editingRoleId)?.isSystem : false}
            />
          </div>
          <div className="admin-form__field">
            <label>Описание</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="admin-form__field">
            <label>Разрешения</label>
            <div className="admin-perm-grid">
              {data.permissions.map((perm) => (
                <label key={perm.id} className="admin-checkbox">
                  <input
                    type="checkbox"
                    checked={form.permissionIds.includes(perm.id)}
                    onChange={() => togglePermission(perm.id)}
                  />
                  <span className="admin-perm-name">{perm.name}</span>
                  {perm.description && (
                    <span className="admin-perm-desc">{perm.description}</span>
                  )}
                </label>
              ))}
            </div>
          </div>
          <div className="admin-form__actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
            >
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
            <button type="button" className="btn btn--outline" onClick={cancelEdit} disabled={saving}>
              Отмена
            </button>
          </div>
        </div>
      )}

      <div className="admin-roles-list">
        {data.roles.map((role) => (
          <div
            key={role.id}
            className={`admin-role-card ${editingRoleId === role.id ? 'is-editing' : ''}`}
          >
            <div className="admin-role-card__header">
              <h4 className="admin-role-card__name">
                {role.name}
                {role.isSystem && <span className="admin-badge admin-badge--system">системная</span>}
              </h4>
              {canManage && !editingRoleId && !creating && (
                <div className="admin-role-card__actions">
                  <button
                    type="button"
                    className="btn btn--sm btn--outline"
                    onClick={() => startEdit(role)}
                  >
                    Изменить
                  </button>
                  {!role.isSystem && (
                    <button
                      type="button"
                      className="btn btn--sm btn--danger"
                      onClick={() => handleDelete(role.id)}
                    >
                      Удалить
                    </button>
                  )}
                </div>
              )}
            </div>
            {role.description && <p className="admin-role-card__desc">{role.description}</p>}
            <div className="admin-role-card__perms">
              {role.permissions.length > 0 ? (
                role.permissions.map((p) => (
                  <span key={p.id} className="admin-perm-tag">
                    {p.name}
                  </span>
                ))
              ) : (
                <span className="admin-muted">Нет разрешений</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Backup Tab
// ─────────────────────────────────────────────────────────────────────────────

export function AdminBackupTab() {
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importText, setImportText] = useState('')
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const handleExport = async () => {
    setExporting(true)
    setResult(null)
    try {
      const backup = await api.exportDatabaseBackup()
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const stamp = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `card-trades-db-backup-${stamp}.json`
      a.click()
      URL.revokeObjectURL(url)
      setResult({ type: 'success', message: 'Бэкап скачан' })
    } catch (err) {
      setResult({ type: 'error', message: err instanceof Error ? err.message : 'Ошибка экспорта' })
    } finally {
      setExporting(false)
    }
  }

  const handleCopyBackup = async () => {
    setExporting(true)
    setResult(null)
    try {
      const backup = await api.exportDatabaseBackup()
      await navigator.clipboard.writeText(JSON.stringify(backup, null, 2))
      setResult({ type: 'success', message: 'Бэкап скопирован в буфер обмена' })
    } catch (err) {
      setResult({ type: 'error', message: err instanceof Error ? err.message : 'Ошибка' })
    } finally {
      setExporting(false)
    }
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    setResult(null)
    try {
      const text = await file.text()
      const backup = JSON.parse(text) as DatabaseBackup
      const res = await api.importDatabaseBackup(backup)
      const counts = Object.entries(res.imported)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')
      setResult({ type: 'success', message: `Импортировано: ${counts}` })
    } catch (err) {
      setResult({ type: 'error', message: err instanceof Error ? err.message : 'Ошибка импорта' })
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  const handleImportText = async () => {
    if (!importText.trim()) return

    setImporting(true)
    setResult(null)
    try {
      const backup = JSON.parse(importText) as DatabaseBackup
      const res = await api.importDatabaseBackup(backup)
      const counts = Object.entries(res.imported)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')
      setResult({ type: 'success', message: `Импортировано: ${counts}` })
      setImportText('')
    } catch (err) {
      setResult({ type: 'error', message: err instanceof Error ? err.message : 'Ошибка импорта' })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="admin-section">
      <h2 className="admin-section__title">Бэкап базы данных</h2>
      <p className="admin-section__desc">
        Экспорт и импорт всех данных: пользователи, коллекции, роли, разрешения.
        Используйте для переноса данных на другой сервер.
      </p>

      {result && (
        <div className={`admin-result admin-result--${result.type}`}>
          {result.message}
        </div>
      )}

      <div className="admin-backup-section">
        <h3>Экспорт</h3>
        <div className="admin-backup-actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? 'Экспорт…' : '📥 Скачать бэкап'}
          </button>
          <button
            type="button"
            className="btn btn--outline"
            onClick={handleCopyBackup}
            disabled={exporting}
          >
            📋 Копировать в буфер
          </button>
        </div>
      </div>

      <div className="admin-backup-section">
        <h3>Импорт</h3>
        <div className="admin-backup-actions">
          <label className="btn btn--outline admin-backup-file-label">
            📤 Загрузить файл
            <input
              type="file"
              accept=".json"
              onChange={handleImportFile}
              disabled={importing}
              style={{ display: 'none' }}
            />
          </label>
        </div>
        <div className="admin-backup-paste">
          <textarea
            className="admin-backup-textarea"
            placeholder="Или вставьте JSON бэкапа сюда…"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={6}
          />
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleImportText}
            disabled={importing || !importText.trim()}
          >
            {importing ? 'Импорт…' : 'Импортировать'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function AdminPage() {
  return <AdminShell />
}
