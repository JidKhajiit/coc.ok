import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useOutletContext } from 'react-router-dom'
import type { PermissionOutletContext } from '../components/RequirePermission'
import type {
  AdminUser,
  AdminRole,
  AdminPermission,
  CardTradeEvent,
  CardTradeEventSummary,
  DatabaseBackup,
} from '../api/client'
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

  const canViewRoles = user.permissions.includes('roles:view')
  const canManageBackup = user.permissions.includes('roles:manage')
  const canManageEvents = user.permissions.includes('events:manage')

  return (
    <div className="app admin-app">
      <div className="atmosphere" aria-hidden />

      <header className="admin-header">
        <div className="admin-header__left">
          <Link to="/" className="admin-header__back">
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
        {canViewRoles && (
          <NavLink
            to="/admin-panel/roles"
            className={({ isActive }) => `tabs__btn ${isActive ? 'is-active' : ''}`}
          >
            Роли
          </NavLink>
        )}
        {canManageBackup && (
          <NavLink
            to="/admin-panel/backup"
            className={({ isActive }) => `tabs__btn ${isActive ? 'is-active' : ''}`}
          >
            Бэкап БД
          </NavLink>
        )}
        {canManageEvents && (
          <NavLink
            to="/admin-panel/events"
            className={({ isActive }) => `tabs__btn ${isActive ? 'is-active' : ''}`}
          >
            Карточные эвенты
          </NavLink>
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
// Card Trade Events Tab
// ─────────────────────────────────────────────────────────────────────────────

type EventFormState = {
  slug: string
  name: string
  startDate: string
  endDate: string
  setsText: string
  cardsText: string
}

const DEFAULT_EVENT_FORM: EventFormState = {
  slug: '',
  name: '',
  startDate: '',
  endDate: '',
  setsText: 'shellshy|Shellshy Set|1-9',
  cardsText: '1|Water Shy|1|blue',
}

function parseSetsText(text: string) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [id, name, range] = line.split('|').map((part) => part?.trim() ?? '')
      if (!id || !name || !range) {
        throw new Error(`Строка набора ${index + 1}: нужен формат id|Название|1-9`)
      }
      const match = /^(\d+)\s*-\s*(\d+)$/.exec(range)
      if (!match) {
        throw new Error(`Строка набора ${index + 1}: диапазон должен быть в формате 1-9`)
      }
      return {
        id,
        name,
        from: Number(match[1]),
        to: Number(match[2]),
      }
    })
}

function parseCardsText(text: string) {
  type ParsedCard = {
    number: number
    name: string
    rarity: 1 | 2 | 3 | 4 | 5
    color: 'blue' | 'gold'
    unknownName?: boolean
  }

  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map<ParsedCard>((line, index) => {
      const [numberRaw, name, rarityRaw, colorRaw, unknownRaw] = line.split('|').map((part) => part?.trim() ?? '')
      if (!numberRaw || !name || !rarityRaw || !colorRaw) {
        throw new Error(`Строка карты ${index + 1}: нужен формат №|Название|Редкость|blue|[unknown]`)
      }
      const number = Number(numberRaw)
      const rarity = Number(rarityRaw) as 1 | 2 | 3 | 4 | 5
      let color: 'blue' | 'gold'
      if (!Number.isInteger(number) || number <= 0) {
        throw new Error(`Строка карты ${index + 1}: номер должен быть положительным числом`)
      }
      if (![1, 2, 3, 4, 5].includes(rarity)) {
        throw new Error(`Строка карты ${index + 1}: редкость должна быть от 1 до 5`)
      }
      if (colorRaw === 'blue' || colorRaw === 'gold') {
        color = colorRaw
      } else {
        throw new Error(`Строка карты ${index + 1}: цвет должен быть blue или gold`)
      }
      return {
        number,
        name,
        rarity,
        color,
        unknownName: unknownRaw.toLowerCase() === 'unknown',
      }
    })
}

function formatSetsText(event: CardTradeEvent) {
  return event.sets.map((set) => `${set.id}|${set.name}|${set.from}-${set.to}`).join('\n')
}

function formatCardsText(event: CardTradeEvent) {
  return event.cards
    .map((card) =>
      [
        card.number,
        card.name,
        card.rarity,
        card.color,
        card.unknownName ? 'unknown' : '',
      ]
        .filter(Boolean)
        .join('|'),
    )
    .join('\n')
}

export function AdminEventsTab() {
  const { user } = useOutletContext<AdminOutletContext>()
  const [events, setEvents] = useState<CardTradeEventSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [editingSlug, setEditingSlug] = useState<string>('')
  const [loadingEventId, setLoadingEventId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [form, setForm] = useState<EventFormState>(DEFAULT_EVENT_FORM)

  const canManage = user.permissions.includes('events:manage')

  const refreshEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setEvents(await api.listCardTradeEvents())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки эвентов')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshEvents()
  }, [refreshEvents])

  const resetForm = () => {
    setEditingEventId(null)
    setEditingSlug('')
    setForm(DEFAULT_EVENT_FORM)
  }

  const startEdit = async (event: CardTradeEventSummary) => {
    setLoadingEventId(event.id)
    setError(null)
    setResult(null)
    try {
      const full = await api.getCardTradeEvent(event.slug)
      setEditingEventId(full.id)
      setEditingSlug(full.slug)
      setForm({
        slug: full.slug,
        name: full.name,
        startDate: full.startDate,
        endDate: full.endDate,
        setsText: formatSetsText(full),
        cardsText: formatCardsText(full),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить эвент')
    } finally {
      setLoadingEventId(null)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setResult(null)
    setError(null)
    try {
      const payload = {
        name: form.name.trim(),
        startDate: form.startDate,
        endDate: form.endDate,
        sets: parseSetsText(form.setsText),
        cards: parseCardsText(form.cardsText),
      }
      const event = editingEventId
        ? await api.updateAdminCardTradeEvent(editingEventId, payload)
        : await api.createAdminCardTradeEvent({
            slug: form.slug.trim(),
            ...payload,
          })
      setResult(
        editingEventId
          ? `Эвент обновлён: /card-trades/${event.slug}`
          : `Эвент создан: /card-trades/${event.slug}`,
      )
      resetForm()
      await refreshEvents()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения эвента')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-section">
      <div className="admin-section__header">
        <h2 className="admin-section__title">Карточные эвенты</h2>
      </div>

      <p className="admin-section__desc">
        Создаёт новый трекер вида `card-trades/:slug` с отдельной коллекцией, вишлистом, обменами и публичными коллекциями.
      </p>

      {error && <div className="admin-result admin-result--error">{error}</div>}
      {result && <div className="admin-result admin-result--success">{result}</div>}

      {canManage && (
        <div className="admin-form">
          <h3 className="admin-form__title">
            {editingEventId ? `Редактирование: ${editingSlug}` : 'Новый карточный эвент'}
          </h3>

          <div className="admin-form__field">
            <label>Название</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Harvest Hunt"
            />
          </div>

          <div className="admin-form__field">
            <label>Slug / URL</label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
              placeholder="harvest-hunt"
              disabled={Boolean(editingEventId)}
            />
          </div>

          <div className="admin-form__field">
            <label>Дата начала</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
            />
          </div>

          <div className="admin-form__field">
            <label>Дата окончания</label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
            />
          </div>

          <div className="admin-form__field">
            <label>Наборы</label>
            <textarea
              className="admin-backup-textarea"
              rows={6}
              value={form.setsText}
              onChange={(e) => setForm((prev) => ({ ...prev, setsText: e.target.value }))}
              placeholder={'shellshy|Shellshy Set|1-9\nwobbler|Wobbler Set|10-18'}
            />
            <small className="admin-muted">Формат: `id|Название|1-9`, по одному набору на строку.</small>
          </div>

          <div className="admin-form__field">
            <label>Карты</label>
            <textarea
              className="admin-backup-textarea"
              rows={10}
              value={form.cardsText}
              onChange={(e) => setForm((prev) => ({ ...prev, cardsText: e.target.value }))}
              placeholder={'1|Water Shy|1|blue\n2|Shining Prize|2|gold\n3|Unknown Card|4|blue|unknown'}
            />
            <small className="admin-muted">
              Формат: `номер|Название|редкость|blue|[unknown]`. Карта автоматически попадёт в набор по диапазону номера.
            </small>
          </div>

          <div className="admin-form__actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void handleSave()}
              disabled={
                saving ||
                (!editingEventId && !form.slug.trim()) ||
                !form.name.trim() ||
                !form.startDate ||
                !form.endDate ||
                !form.setsText.trim() ||
                !form.cardsText.trim()
              }
            >
              {saving ? 'Сохранение…' : editingEventId ? 'Сохранить изменения' : 'Создать эвент'}
            </button>
            {editingEventId && (
              <button
                type="button"
                className="btn btn--outline"
                onClick={resetForm}
                disabled={saving}
              >
                Отмена
              </button>
            )}
          </div>
        </div>
      )}

      <div className="admin-roles-list">
        {loading ? (
          <p className="admin-loading">Загрузка…</p>
        ) : (
          events.map((event) => (
            <div key={event.id} className="admin-role-card">
              <div className="admin-role-card__header">
                <h4 className="admin-role-card__name">
                  {event.name}
                  {!event.active && <span className="admin-badge admin-badge--warn">архив</span>}
                </h4>
                {canManage && (
                  <div className="admin-role-card__actions">
                    <button
                      type="button"
                      className="btn btn--sm btn--outline"
                      onClick={() => void startEdit(event)}
                      disabled={loadingEventId === event.id}
                    >
                      {loadingEventId === event.id ? 'Загрузка…' : 'Редактировать'}
                    </button>
                  </div>
                )}
              </div>
              <p className="admin-role-card__desc">
                `/card-trades/{event.slug}` · {event.startDate} - {event.endDate}
              </p>
              <div className="admin-role-card__perms">
                <span className="admin-perm-tag">{event.setCount} сетов</span>
                <span className="admin-perm-tag">{event.cardCount} карт</span>
              </div>
            </div>
          ))
        )}
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
        Импорт полностью заменяет текущую БД содержимым бэкапа (не merge).
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
