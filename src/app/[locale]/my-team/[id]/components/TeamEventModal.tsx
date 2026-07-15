'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTeamEvents } from '@/hooks/useTeamEvents'
import type { TeamEvent, TeamEventInput, EventType, RecurrenceType } from '@/types/teamEvent'

type SetlistOption = { id: string; title: string }

type Props = {
  teamId: string
  currentUserId: string
  event?: TeamEvent | null          // 있으면 수정 모드
  setlists: SetlistOption[]         // 예배 일정 콘티 연결용
  onClose: () => void
  onSaved: () => void
}

// ISO(timestamptz) → 로컬 date/time 문자열
function isoToLocalParts(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

// 로컬 date(YYYY-MM-DD) + time(HH:mm) → ISO
function localPartsToIso(date: string, time: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = (time || '00:00').split(':').map(Number)
  return new Date(y, m - 1, d, hh, mm, 0, 0).toISOString()
}

const EVENT_TYPES: EventType[] = ['practice', 'serving', 'worship', 'etc']

export default function TeamEventModal({
  teamId,
  currentUserId,
  event,
  setlists,
  onClose,
  onSaved,
}: Props) {
  const t = useTranslations('myTeam.calendar')
  const { createEvent, createRecurringEvents, updateEvent } = useTeamEvents()
  const isEdit = !!event

  const initStart = event ? isoToLocalParts(event.start_at) : null
  const initEnd = event?.end_at ? isoToLocalParts(event.end_at) : null

  const [title, setTitle] = useState(event?.title ?? '')
  const [eventType, setEventType] = useState<EventType>(event?.event_type ?? 'practice')
  const [date, setDate] = useState(initStart?.date ?? isoToLocalParts(new Date().toISOString()).date)
  const [startTime, setStartTime] = useState(initStart?.time ?? '19:00')
  const [endTime, setEndTime] = useState(initEnd?.time ?? '')
  const [allDay, setAllDay] = useState(event?.all_day ?? false)
  const [location, setLocation] = useState(event?.location ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [setlistId, setSetlistId] = useState<string>(event?.setlist_id ?? '')
  const [recurrence, setRecurrence] = useState<RecurrenceType>('none')
  const [weeks, setWeeks] = useState(12)
  const [saving, setSaving] = useState(false)

  const buildInput = (): TeamEventInput => ({
    title: title.trim(),
    event_type: eventType,
    start_at: localPartsToIso(date, allDay ? '00:00' : startTime),
    end_at: !allDay && endTime ? localPartsToIso(date, endTime) : null,
    all_day: allDay,
    location: location.trim() || null,
    description: description.trim() || null,
    setlist_id: eventType === 'worship' && setlistId ? setlistId : null,
  })

  const handleSave = async () => {
    if (!title.trim()) {
      alert(t('titleRequired'))
      return
    }
    setSaving(true)
    const input = buildInput()
    let ok = false

    if (isEdit && event) {
      ok = await updateEvent(event.id, input)
    } else if (recurrence === 'none') {
      ok = !!(await createEvent(teamId, currentUserId, input))
    } else {
      const created = await createRecurringEvents(teamId, currentUserId, input, recurrence, weeks)
      ok = created.length > 0
    }

    setSaving(false)
    if (ok) onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="font-bold text-lg text-gray-900">{isEdit ? t('editEvent') : t('addEvent')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* 유형 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('fieldType')}</label>
            <div className="grid grid-cols-4 gap-2">
              {EVENT_TYPES.map((tp) => (
                <button
                  key={tp}
                  type="button"
                  onClick={() => setEventType(tp)}
                  className={`min-h-[44px] px-2 py-2 rounded-lg text-sm font-medium transition ${
                    eventType === tp ? 'bg-violet-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t(`type${tp.charAt(0).toUpperCase() + tp.slice(1)}` as 'typePractice')}
                </button>
              ))}
            </div>
          </div>

          {/* 제목 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('fieldTitle')}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-400 focus:outline-none"
              style={{ fontSize: '16px' }}
            />
          </div>

          {/* 날짜 + 시간 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('fieldDate')}</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-400 focus:outline-none"
                style={{ fontSize: '16px' }}
              />
            </div>
            <label className="flex items-end gap-2 pb-2.5">
              <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="w-4 h-4 accent-violet-500" />
              <span className="text-sm text-gray-700">{t('fieldAllDay')}</span>
            </label>
          </div>

          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('fieldStart')}</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-400 focus:outline-none"
                  style={{ fontSize: '16px' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('fieldEnd')}</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-400 focus:outline-none"
                  style={{ fontSize: '16px' }}
                />
              </div>
            </div>
          )}

          {/* 장소 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('fieldLocation')}</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t('fieldLocationPlaceholder')}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-400 focus:outline-none"
              style={{ fontSize: '16px' }}
            />
          </div>

          {/* 콘티 연결 (예배 유형만) */}
          {eventType === 'worship' && setlists.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('fieldSetlist')}</label>
              <select
                value={setlistId}
                onChange={(e) => setSetlistId(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-400 focus:outline-none bg-white"
                style={{ fontSize: '16px' }}
              >
                <option value="">{t('setlistNone')}</option>
                {setlists.map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </div>
          )}

          {/* 메모 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('fieldDescription')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-400 focus:outline-none resize-none"
              style={{ fontSize: '16px' }}
            />
          </div>

          {/* 반복 (생성 모드만) */}
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('recurrence')}</label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as RecurrenceType)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-400 focus:outline-none bg-white"
                style={{ fontSize: '16px' }}
              >
                <option value="none">{t('recurNone')}</option>
                <option value="weekly_sat">{t('recurSat')}</option>
                <option value="weekly_sun">{t('recurSun')}</option>
                <option value="weekly_sat_sun">{t('recurSatSun')}</option>
              </select>
              {recurrence !== 'none' && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-sm text-gray-600">{t('recurWeeks')}</span>
                  <input
                    type="number"
                    min={1}
                    max={52}
                    value={weeks}
                    onChange={(e) => setWeeks(Math.max(1, Math.min(52, Number(e.target.value) || 1)))}
                    className="w-20 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-400 focus:outline-none"
                    style={{ fontSize: '16px' }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="flex-1 min-h-[44px] py-2.5 rounded-lg border border-gray-200 text-gray-600 font-medium hover:bg-gray-50"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 min-h-[44px] py-2.5 rounded-lg bg-violet-500 text-white font-semibold hover:bg-violet-600 disabled:opacity-50"
          >
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  )
}
