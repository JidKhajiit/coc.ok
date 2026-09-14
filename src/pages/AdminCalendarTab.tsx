import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { SiteEventScheduleEntry, SiteEventType } from '../api/client'
import * as api from '../api/client'

type CalendarAdminContext = {
  user: { permissions: string[] }
}

type TypeForm = {
  slug: string
  nameRu: string
  nameEn: string
  path: string
  color: string
  icon: string
}

type ScheduleForm = {
  eventTypeId: string
  startDate: string
  endDate: string
  hasRegistrationDay: boolean
  hasRewardDay: boolean
}

const EMPTY_TYPE: TypeForm = {
  slug: '',
  nameRu: '',
  nameEn: '',
  path: '',
  color: '',
  icon: '',
}

const EMPTY_SCHEDULE: ScheduleForm = {
  eventTypeId: '',
  startDate: '',
  endDate: '',
  hasRegistrationDay: false,
  hasRewardDay: false,
}

function normalizeOptional(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function AdminCalendarTab() {
  const { user } = useOutletContext<CalendarAdminContext>()
  const canManage = user.permissions.includes('calendar:manage')

  const [types, setTypes] = useState<SiteEventType[]>([])
  const [schedule, setSchedule] = useState<SiteEventScheduleEntry[]>([])
  const [upcomingLimit, setUpcomingLimit] = useState('5')
  const [savingSettings, setSavingSettings] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  const [typeForm, setTypeForm] = useState<TypeForm>(EMPTY_TYPE)
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null)
  const [savingType, setSavingType] = useState(false)

  const [scheduleForm, setScheduleForm] = useState<ScheduleForm>(EMPTY_SCHEDULE)
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null)
  const [savingSchedule, setSavingSchedule] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [nextTypes, nextSchedule, settings] = await Promise.all([
        api.listAdminCalendarTypes(),
        api.listAdminCalendarSchedule(),
        api.getAdminCalendarSettings(),
      ])
      setTypes(nextTypes)
      setSchedule(nextSchedule)
      setUpcomingLimit(String(settings.upcomingLimit))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки календаря')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const resetTypeForm = () => {
    setEditingTypeId(null)
    setTypeForm(EMPTY_TYPE)
  }

  const resetScheduleForm = () => {
    setEditingScheduleId(null)
    setScheduleForm(EMPTY_SCHEDULE)
  }

  const startEditType = (type: SiteEventType) => {
    setEditingTypeId(type.id)
    setTypeForm({
      slug: type.slug,
      nameRu: type.nameRu,
      nameEn: type.nameEn,
      path: type.path ?? '',
      color: type.color ?? '',
      icon: type.icon ?? '',
    })
    setResult(null)
    setError(null)
  }

  const startEditSchedule = (entry: SiteEventScheduleEntry) => {
    setEditingScheduleId(entry.id)
    setScheduleForm({
      eventTypeId: entry.eventTypeId,
      startDate: entry.startDate,
      endDate: entry.endDate,
      hasRegistrationDay: entry.registrationDays > 0,
      hasRewardDay: entry.rewardDays > 0,
    })
    setResult(null)
    setError(null)
  }

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    setError(null)
    setResult(null)
    try {
      const limit = Number.parseInt(upcomingLimit, 10)
      if (!Number.isFinite(limit) || limit < 1 || limit > 50) {
        setError('Лимит предстоящих событий: целое число от 1 до 50')
        return
      }
      const settings = await api.updateAdminCalendarSettings({ upcomingLimit: limit })
      setUpcomingLimit(String(settings.upcomingLimit))
      setResult('Настройки календаря сохранены')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить настройки')
    } finally {
      setSavingSettings(false)
    }
  }

  const handleSaveType = async () => {
    setSavingType(true)
    setError(null)
    setResult(null)
    try {
      const payload = {
        nameRu: typeForm.nameRu.trim(),
        nameEn: typeForm.nameEn.trim(),
        path: normalizeOptional(typeForm.path),
        color: normalizeOptional(typeForm.color),
        icon: normalizeOptional(typeForm.icon),
      }
      if (editingTypeId) {
        await api.updateAdminCalendarType(editingTypeId, payload)
        setResult('Тип эвента обновлён')
      } else {
        await api.createAdminCalendarType({
          slug: typeForm.slug.trim(),
          ...payload,
        })
        setResult('Тип эвента создан')
      }
      resetTypeForm()
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить тип эвента')
    } finally {
      setSavingType(false)
    }
  }

  const handleDeleteType = async (id: string) => {
    if (!window.confirm('Удалить тип эвента вместе со всеми записями в графике?')) return
    setError(null)
    setResult(null)
    try {
      await api.deleteAdminCalendarType(id)
      if (editingTypeId === id) resetTypeForm()
      setResult('Тип эвента удалён')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить тип эвента')
    }
  }

  const handleSaveSchedule = async () => {
    setSavingSchedule(true)
    setError(null)
    setResult(null)
    try {
      const payload = {
        eventTypeId: scheduleForm.eventTypeId,
        startDate: scheduleForm.startDate,
        endDate: scheduleForm.endDate,
        registrationDays: scheduleForm.hasRegistrationDay ? 1 : 0,
        rewardDays: scheduleForm.hasRewardDay ? 1 : 0,
      }
      if (editingScheduleId) {
        await api.updateAdminCalendarSchedule(editingScheduleId, payload)
        setResult('Запись графика обновлена')
      } else {
        await api.createAdminCalendarSchedule(payload)
        setResult('Эвент добавлен в график')
      }
      resetScheduleForm()
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить график')
    } finally {
      setSavingSchedule(false)
    }
  }

  const handleDeleteSchedule = async (id: string) => {
    if (!window.confirm('Убрать эвент из графика?')) return
    setError(null)
    setResult(null)
    try {
      await api.deleteAdminCalendarSchedule(id)
      if (editingScheduleId === id) resetScheduleForm()
      setResult('Запись графика удалена')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить запись')
    }
  }

  if (loading) return <div className="admin-loading">Загрузка…</div>

  return (
    <div className="admin-section">
      <div className="admin-section__header">
        <h2 className="admin-section__title">Календарь эвентов</h2>
      </div>

      <p className="admin-section__desc">
        Каталог типов эвентов (конечный набор) и график их проведения на сайте. Публичная страница:{' '}
        <code>/calendar</code>.
      </p>

      {error && <div className="admin-result admin-result--error">{error}</div>}
      {result && <div className="admin-result admin-result--success">{result}</div>}

      {!canManage && (
        <p className="admin-muted">Нет права <code>calendar:manage</code> для изменений.</p>
      )}

      {canManage && (
        <div className="admin-form">
          <h3 className="admin-form__title">Настройки главной</h3>
          <div className="admin-form__field">
            <label>Сколько предстоящих событий показывать</label>
            <input
              type="number"
              min={1}
              max={50}
              step={1}
              value={upcomingLimit}
              onChange={(e) => setUpcomingLimit(e.target.value)}
            />
            <small className="admin-muted">
              На главной в блоке «Предстоящие» — ближайшие по дате начала, не больше этого числа.
            </small>
          </div>
          <div className="admin-form__actions">
            <button
              type="button"
              className="btn btn--primary"
              disabled={savingSettings}
              onClick={() => void handleSaveSettings()}
            >
              {savingSettings ? 'Сохранение…' : 'Сохранить лимит'}
            </button>
          </div>
        </div>
      )}

      {canManage && (
        <div className="admin-form">
          <h3 className="admin-form__title">
            {editingTypeId ? 'Редактирование типа эвента' : 'Новый тип эвента'}
          </h3>

          <div className="admin-form__field">
            <label>Название (RU)</label>
            <input
              type="text"
              value={typeForm.nameRu}
              onChange={(e) => setTypeForm((prev) => ({ ...prev, nameRu: e.target.value }))}
              placeholder="Уютная ферма"
            />
          </div>

          <div className="admin-form__field">
            <label>Название (EN)</label>
            <input
              type="text"
              value={typeForm.nameEn}
              onChange={(e) => setTypeForm((prev) => ({ ...prev, nameEn: e.target.value }))}
              placeholder="Cozy Farm"
            />
          </div>

          <div className="admin-form__field">
            <label>Slug</label>
            <input
              type="text"
              value={typeForm.slug}
              onChange={(e) => setTypeForm((prev) => ({ ...prev, slug: e.target.value }))}
              placeholder="cozy-farm"
              disabled={Boolean(editingTypeId)}
            />
          </div>

          <div className="admin-form__field">
            <label>Путь на сайте (опционально)</label>
            <input
              type="text"
              value={typeForm.path}
              onChange={(e) => setTypeForm((prev) => ({ ...prev, path: e.target.value }))}
              placeholder="/cozy-farm"
            />
          </div>

          <div className="admin-form__field">
            <label>Цвет (hex, опционально)</label>
            <input
              type="text"
              value={typeForm.color}
              onChange={(e) => setTypeForm((prev) => ({ ...prev, color: e.target.value }))}
              placeholder="#2f7a55"
            />
            <small className="admin-muted">Подсветка блока на главной и полоски в календаре.</small>
          </div>

          <div className="admin-form__field">
            <label>Иконка (опционально)</label>
            <input
              type="text"
              value={typeForm.icon}
              onChange={(e) => setTypeForm((prev) => ({ ...prev, icon: e.target.value }))}
              placeholder="🎣"
              maxLength={16}
            />
            <small className="admin-muted">Эмодзи или короткий символ справа в блоке на главной.</small>
          </div>

          <div className="admin-form__actions">
            <button
              type="button"
              className="btn btn--primary"
              disabled={
                savingType ||
                !typeForm.nameRu.trim() ||
                !typeForm.nameEn.trim() ||
                (!editingTypeId && !typeForm.slug.trim())
              }
              onClick={() => void handleSaveType()}
            >
              {savingType ? 'Сохранение…' : editingTypeId ? 'Сохранить' : 'Создать тип'}
            </button>
            {editingTypeId && (
              <button type="button" className="btn btn--outline" onClick={resetTypeForm}>
                Отмена
              </button>
            )}
          </div>
        </div>
      )}

      <div className="admin-table-wrap">
        <h3 className="admin-form__title">Каталог типов</h3>
        {types.length === 0 ? (
          <p className="admin-muted">Типов пока нет</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Slug</th>
                <th>Иконка</th>
                <th>Путь</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {types.map((type) => (
                <tr key={type.id}>
                  <td>
                    <span
                      className="admin-calendar-swatch"
                      style={type.color ? { backgroundColor: type.color } : undefined}
                      aria-hidden
                    />
                    {type.nameRu}
                  </td>
                  <td>
                    <code>{type.slug}</code>
                  </td>
                  <td>{type.icon ?? '—'}</td>
                  <td>{type.path ?? '—'}</td>
                  <td className="admin-table__actions">
                    {canManage && (
                      <>
                        <button
                          type="button"
                          className="btn btn--sm btn--outline"
                          onClick={() => startEditType(type)}
                        >
                          Изменить
                        </button>
                        <button
                          type="button"
                          className="btn btn--sm btn--outline"
                          onClick={() => void handleDeleteType(type.id)}
                        >
                          Удалить
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {canManage && (
        <div className="admin-form">
          <h3 className="admin-form__title">
            {editingScheduleId ? 'Редактирование записи графика' : 'Добавить в график'}
          </h3>

          <div className="admin-form__field">
            <label>Тип эвента</label>
            <select
              value={scheduleForm.eventTypeId}
              onChange={(e) =>
                setScheduleForm((prev) => ({ ...prev, eventTypeId: e.target.value }))
              }
            >
              <option value="">Выберите тип…</option>
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.nameRu}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-form__field">
            <label>Дата начала</label>
            <input
              type="date"
              value={scheduleForm.startDate}
              onChange={(e) =>
                setScheduleForm((prev) => ({ ...prev, startDate: e.target.value }))
              }
            />
          </div>

          <div className="admin-form__field">
            <label>Дата окончания</label>
            <input
              type="date"
              value={scheduleForm.endDate}
              onChange={(e) => setScheduleForm((prev) => ({ ...prev, endDate: e.target.value }))}
            />
          </div>

          <div className="admin-form__field">
            <label className="admin-checkbox">
              <input
                type="checkbox"
                checked={scheduleForm.hasRegistrationDay}
                onChange={(e) =>
                  setScheduleForm((prev) => ({
                    ...prev,
                    hasRegistrationDay: e.target.checked,
                  }))
                }
              />
              День регистрации (первый день)
            </label>
          </div>

          <div className="admin-form__field">
            <label className="admin-checkbox">
              <input
                type="checkbox"
                checked={scheduleForm.hasRewardDay}
                onChange={(e) =>
                  setScheduleForm((prev) => ({
                    ...prev,
                    hasRewardDay: e.target.checked,
                  }))
                }
              />
              День сбора наград (последний день)
            </label>
          </div>

          <div className="admin-form__actions">
            <button
              type="button"
              className="btn btn--primary"
              disabled={
                savingSchedule ||
                !scheduleForm.eventTypeId ||
                !scheduleForm.startDate ||
                !scheduleForm.endDate
              }
              onClick={() => void handleSaveSchedule()}
            >
              {savingSchedule
                ? 'Сохранение…'
                : editingScheduleId
                  ? 'Сохранить'
                  : 'Добавить в график'}
            </button>
            {editingScheduleId && (
              <button type="button" className="btn btn--outline" onClick={resetScheduleForm}>
                Отмена
              </button>
            )}
          </div>
        </div>
      )}

      <div className="admin-table-wrap">
        <h3 className="admin-form__title">График</h3>
        {schedule.length === 0 ? (
          <p className="admin-muted">В графике пока пусто</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Эвент</th>
                <th>Начало</th>
                <th>Конец</th>
                <th>Рег.</th>
                <th>Награды</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {schedule.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <span
                      className="admin-calendar-swatch"
                      style={
                        entry.event.color
                          ? { backgroundColor: entry.event.color }
                          : undefined
                      }
                      aria-hidden
                    />
                    {entry.event.nameRu}
                  </td>
                  <td>{entry.startDate}</td>
                  <td>{entry.endDate}</td>
                  <td>{entry.registrationDays ? 'да' : '—'}</td>
                  <td>{entry.rewardDays ? 'да' : '—'}</td>
                  <td className="admin-table__actions">
                    {canManage && (
                      <>
                        <button
                          type="button"
                          className="btn btn--sm btn--outline"
                          onClick={() => startEditSchedule(entry)}
                        >
                          Изменить
                        </button>
                        <button
                          type="button"
                          className="btn btn--sm btn--outline"
                          onClick={() => void handleDeleteSchedule(entry.id)}
                        >
                          Удалить
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
