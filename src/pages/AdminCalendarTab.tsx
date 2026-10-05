import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useOutletContext } from 'react-router-dom'
import type { SiteEventScheduleEntry, SiteEventType } from '../api/client'
import { AdminDateRangeField } from '../components/AdminDateRangeField'
import * as api from '../api/client'
import {
  addIsoDays,
  calendarSpanFromEventDates,
  eventDateWindow,
} from '../lib/calendarPhases'

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
  const [typeModalOpen, setTypeModalOpen] = useState(false)
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

  const closeTypeModal = () => {
    setTypeModalOpen(false)
    resetTypeForm()
  }

  const openCreateType = () => {
    resetTypeForm()
    setTypeModalOpen(true)
    setResult(null)
    setError(null)
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
    setTypeModalOpen(true)
    setResult(null)
    setError(null)
  }

  const startEditSchedule = (entry: SiteEventScheduleEntry) => {
    const window = eventDateWindow(entry)
    const eventDates =
      window.eventStart <= window.eventEnd
        ? { startDate: window.eventStart, endDate: window.eventEnd }
        : { startDate: entry.startDate, endDate: entry.endDate }
    setEditingScheduleId(entry.id)
    setScheduleForm({
      eventTypeId: entry.eventTypeId,
      startDate: eventDates.startDate,
      endDate: eventDates.endDate,
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
      closeTypeModal()
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
      if (editingTypeId === id) closeTypeModal()
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
      const registrationDays = scheduleForm.hasRegistrationDay ? 1 : 0
      const rewardDays = scheduleForm.hasRewardDay ? 1 : 0
      const span = calendarSpanFromEventDates({
        eventStart: scheduleForm.startDate,
        eventEnd: scheduleForm.endDate,
        registrationDays,
        rewardDays,
      })
      const payload = {
        eventTypeId: scheduleForm.eventTypeId,
        startDate: span.startDate,
        endDate: span.endDate,
        registrationDays,
        rewardDays,
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

  useEffect(() => {
    if (!typeModalOpen) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') closeTypeModal()
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [typeModalOpen])

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

      <div className="admin-table-wrap">
        <div className="admin-section__header">
          <h3 className="admin-form__title">Каталог типов</h3>
          {canManage && (
            <button type="button" className="btn btn--outline" onClick={openCreateType}>
              Новый тип
            </button>
          )}
        </div>
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

      {canManage &&
        typeModalOpen &&
        createPortal(
          <div className="admin-modal-root">
            <button
              type="button"
              className="admin-modal__backdrop"
              aria-label="Закрыть"
              onClick={closeTypeModal}
            />
            <div
              className="admin-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="event-type-modal-title"
            >
              <div className="admin-modal__head">
                <h3 id="event-type-modal-title" className="admin-form__title">
                  {editingTypeId ? 'Редактирование типа эвента' : 'Новый тип эвента'}
                </h3>
                <button
                  type="button"
                  className="admin-modal__close"
                  aria-label="Закрыть"
                  onClick={closeTypeModal}
                >
                  ×
                </button>
              </div>

              {error && <div className="admin-result admin-result--error">{error}</div>}

              <div className="admin-form admin-form--plain">
                <div className="admin-form__field">
                  <label htmlFor="event-type-name-ru">Название (RU)</label>
                  <input
                    id="event-type-name-ru"
                    type="text"
                    value={typeForm.nameRu}
                    onChange={(e) => setTypeForm((prev) => ({ ...prev, nameRu: e.target.value }))}
                    placeholder="Уютная ферма"
                    autoFocus
                  />
                </div>

                <div className="admin-form__field">
                  <label htmlFor="event-type-name-en">Название (EN)</label>
                  <input
                    id="event-type-name-en"
                    type="text"
                    value={typeForm.nameEn}
                    onChange={(e) => setTypeForm((prev) => ({ ...prev, nameEn: e.target.value }))}
                    placeholder="Cozy Farm"
                  />
                </div>

                <div className="admin-form__field">
                  <label htmlFor="event-type-slug">Slug</label>
                  <input
                    id="event-type-slug"
                    type="text"
                    value={typeForm.slug}
                    onChange={(e) => setTypeForm((prev) => ({ ...prev, slug: e.target.value }))}
                    placeholder="cozy-farm"
                    disabled={Boolean(editingTypeId)}
                  />
                </div>

                <div className="admin-form__field">
                  <label htmlFor="event-type-path">Путь на сайте (опционально)</label>
                  <input
                    id="event-type-path"
                    type="text"
                    value={typeForm.path}
                    onChange={(e) => setTypeForm((prev) => ({ ...prev, path: e.target.value }))}
                    placeholder="/cozy-farm"
                  />
                </div>

                <div className="admin-form__field">
                  <label htmlFor="event-type-color">Цвет (hex, опционально)</label>
                  <input
                    id="event-type-color"
                    type="text"
                    value={typeForm.color}
                    onChange={(e) => setTypeForm((prev) => ({ ...prev, color: e.target.value }))}
                    placeholder="#2f7a55"
                  />
                  <small className="admin-muted">
                    Подсветка блока на главной и полоски в календаре.
                  </small>
                </div>

                <div className="admin-form__field">
                  <label htmlFor="event-type-icon">Иконка (опционально)</label>
                  <input
                    id="event-type-icon"
                    type="text"
                    value={typeForm.icon}
                    onChange={(e) => setTypeForm((prev) => ({ ...prev, icon: e.target.value }))}
                    placeholder="🎣"
                    maxLength={16}
                  />
                  <small className="admin-muted">
                    Эмодзи или короткий символ справа в блоке на главной.
                  </small>
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
                  <button type="button" className="btn btn--outline" onClick={closeTypeModal}>
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

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
            <label>Дни ивента</label>
            <AdminDateRangeField
              startDate={scheduleForm.startDate}
              endDate={scheduleForm.endDate}
              onChange={(startDate, endDate) =>
                setScheduleForm((prev) => ({ ...prev, startDate, endDate }))
              }
            />
            <p className="admin-muted">
              Указывайте только дни самого ивента. Регистрация и сбор наград в эти даты не входят.
            </p>
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
              День регистрации (день перед началом)
            </label>
            {scheduleForm.hasRegistrationDay && scheduleForm.startDate && (
              <p className="admin-muted">
                Регистрация: {addIsoDays(scheduleForm.startDate, -1)}
              </p>
            )}
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
              День сбора наград (день после окончания)
            </label>
            {scheduleForm.hasRewardDay && scheduleForm.endDate && (
              <p className="admin-muted">Сбор наград: {addIsoDays(scheduleForm.endDate, 1)}</p>
            )}
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
              {schedule.map((entry) => {
                const dates = eventDateWindow(entry)
                const showEventDates = dates.eventStart <= dates.eventEnd
                return (
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
                  <td>{showEventDates ? dates.eventStart : entry.startDate}</td>
                  <td>{showEventDates ? dates.eventEnd : entry.endDate}</td>
                  <td>{dates.registrationDate ?? '—'}</td>
                  <td>{dates.rewardDate ?? '—'}</td>
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
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
