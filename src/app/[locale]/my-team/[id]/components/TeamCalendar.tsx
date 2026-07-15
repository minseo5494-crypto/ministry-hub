'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Plus, MapPin, Clock, ChevronLeft, ChevronRight, FileText, Trash2, Edit } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTeamEvents } from '@/hooks/useTeamEvents'
import { EVENT_TYPE_META } from '@/types/teamEvent'
import type { TeamEvent, EventAttendance, AttendanceStatus, EventType } from '@/types/teamEvent'
import TeamEventModal from './TeamEventModal'

type Props = {
  teamId: string
  currentUserId: string
  isLeader: boolean
  memberCount: number
}

type Member = { user_id: string; name: string }
type SetlistOption = { id: string; title: string; service_date: string | null }
type AgendaItem =
  | { kind: 'event'; event: TeamEvent }
  | { kind: 'setlist'; setlist: SetlistOption }

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export default function TeamCalendar({ teamId, currentUserId, isLeader, memberCount }: Props) {
  const t = useTranslations('myTeam.calendar')
  const router = useRouter()
  const { fetchEvents, deleteEvent, fetchAttendance, setAttendance, summarizeAttendance } = useTeamEvents()

  const [view, setView] = useState<'agenda' | 'month'>('agenda')
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } })
  const [events, setEvents] = useState<TeamEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState<Member[]>([])
  const [setlists, setSetlists] = useState<SetlistOption[]>([])

  const [showModal, setShowModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<TeamEvent | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<TeamEvent | null>(null)
  const [attendance, setAttendanceRecords] = useState<EventAttendance[]>([])

  // 조회 범위: 월 뷰는 해당 월(앞뒤 1주 여유), 목록 뷰는 3개월 전 ~ 6개월 후
  const range = useMemo(() => {
    if (view === 'month') {
      const start = new Date(cursor.y, cursor.m, 1)
      start.setDate(start.getDate() - 7)
      const end = new Date(cursor.y, cursor.m + 1, 0)
      end.setDate(end.getDate() + 7)
      return { start: start.toISOString(), end: end.toISOString() }
    }
    const start = new Date(); start.setMonth(start.getMonth() - 3)
    const end = new Date(); end.setMonth(end.getMonth() + 6)
    return { start: start.toISOString(), end: end.toISOString() }
  }, [view, cursor])

  const loadEvents = useCallback(async () => {
    setLoading(true)
    const data = await fetchEvents(teamId, range.start, range.end)
    setEvents(data)
    setLoading(false)
  }, [teamId, range.start, range.end, fetchEvents])

  useEffect(() => { loadEvents() }, [loadEvents])

  // 팀 멤버(참석 표시용) + 콘티(연결용) 로드
  useEffect(() => {
    (async () => {
      const { data: mem } = await supabase
        .from('team_members')
        .select('user_id, users(name)')
        .eq('team_id', teamId)
        .eq('status', 'active')
      setMembers(((mem as any[]) ?? []).map((r) => ({ user_id: r.user_id, name: r.users?.name ?? '—' })))

      const { data: sl } = await supabase
        .from('team_setlists')
        .select('id, title, service_date')
        .eq('team_id', teamId)
        .order('service_date', { ascending: false })
        .limit(200)
      setSetlists(((sl as any[]) ?? []).map((r) => ({ id: r.id, title: r.title, service_date: r.service_date })))
    })()
  }, [teamId])

  const openDetail = useCallback(async (ev: TeamEvent) => {
    setSelectedEvent(ev)
    setAttendanceRecords(await fetchAttendance(ev.id))
  }, [fetchAttendance])

  const handleSetAttendance = async (userId: string, status: AttendanceStatus) => {
    if (!selectedEvent) return
    const ok = await setAttendance(selectedEvent.id, userId, status)
    if (ok) setAttendanceRecords(await fetchAttendance(selectedEvent.id))
  }

  const handleDelete = async (ev: TeamEvent) => {
    if (!confirm(t('confirmDelete'))) return
    if (await deleteEvent(ev.id)) {
      setSelectedEvent(null)
      loadEvents()
    }
  }

  const typeLabel = (tp: EventType) =>
    t(`type${tp.charAt(0).toUpperCase() + tp.slice(1)}` as 'typePractice')

  const fmtTime = (ev: TeamEvent) => {
    if (ev.all_day) return t('fieldAllDay')
    const s = new Date(ev.start_at)
    const st = `${pad(s.getHours())}:${pad(s.getMinutes())}`
    if (ev.end_at) { const e = new Date(ev.end_at); return `${st} – ${pad(e.getHours())}:${pad(e.getMinutes())}` }
    return st
  }

  const openSetlist = useCallback((setlistId: string) => {
    router.push(`/my-team/${teamId}/setlist/${setlistId}`)
  }, [router, teamId])

  // 이미 일정에 연결된 콘티는 캘린더에 중복 표시하지 않는다
  const linkedSetlistIds = useMemo(
    () => new Set(events.filter((e) => e.setlist_id).map((e) => e.setlist_id as string)),
    [events]
  )

  // service_date가 현재 조회 범위 안이고, 아직 일정에 연결 안 된 콘티
  const setlistItems = useMemo(() => {
    const lo = range.start.slice(0, 10)
    const hi = range.end.slice(0, 10)
    return setlists.filter(
      (s) => s.service_date && s.service_date >= lo && s.service_date <= hi && !linkedSetlistIds.has(s.id)
    )
  }, [setlists, range, linkedSetlistIds])

  // 목록 뷰용: 날짜별 그룹 (일정 + 콘티 병합)
  const grouped = useMemo(() => {
    const map = new Map<string, AgendaItem[]>()
    const add = (key: string, item: AgendaItem) => {
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    for (const ev of events) add(ymd(new Date(ev.start_at)), { kind: 'event', event: ev })
    for (const s of setlistItems) add(s.service_date as string, { kind: 'setlist', setlist: s })
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [events, setlistItems])

  const myStatus: AttendanceStatus =
    attendance.find((a) => a.user_id === currentUserId)?.status ?? 'no_response'
  const summary = selectedEvent ? summarizeAttendance(attendance, memberCount) : null

  const STATUS_STYLE: Record<AttendanceStatus, string> = {
    attending: 'bg-emerald-100 text-emerald-700',
    absent: 'bg-rose-100 text-rose-700',
    maybe: 'bg-amber-100 text-amber-700',
    no_response: 'bg-gray-100 text-gray-500',
  }

  return (
    <div>
      {/* 상단 바 */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
          {(['agenda', 'month'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`min-h-[40px] px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
                view === v ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {v === 'agenda' ? t('viewAgenda') : t('viewMonth')}
            </button>
          ))}
        </div>
        <button
          onClick={() => { setEditingEvent(null); setShowModal(true) }}
          className="flex items-center gap-1.5 min-h-[44px] px-4 py-2 bg-violet-500 text-white rounded-lg text-sm font-semibold hover:bg-violet-600"
        >
          <Plus size={18} /> {t('addEvent')}
        </button>
      </div>

      {/* 월 네비게이션 */}
      {view === 'month' && (
        <div className="flex items-center justify-center gap-4 mb-4">
          <button onClick={() => setCursor((c) => ({ y: c.m === 0 ? c.y - 1 : c.y, m: c.m === 0 ? 11 : c.m - 1 }))} className="p-2 text-slate-400 hover:text-slate-700"><ChevronLeft size={20} /></button>
          <span className="font-bold text-slate-800">{cursor.y}. {pad(cursor.m + 1)}</span>
          <button onClick={() => setCursor((c) => ({ y: c.m === 11 ? c.y + 1 : c.y, m: c.m === 11 ? 0 : c.m + 1 }))} className="p-2 text-slate-400 hover:text-slate-700"><ChevronRight size={20} /></button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-400">···</div>
      ) : grouped.length === 0 && view === 'agenda' ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4"><Clock className="text-slate-300" /></div>
          <p className="text-slate-500 font-medium">{t('noEvents')}</p>
          <p className="text-slate-400 text-sm mt-1">{t('noEventsDesc')}</p>
        </div>
      ) : view === 'agenda' ? (
        /* ── 목록(아젠다) 뷰 ── */
        <div className="space-y-6">
          {grouped.map(([dateKey, items]) => {
            const d = new Date(dateKey + 'T00:00:00')
            const isToday = dateKey === ymd(new Date())
            return (
              <div key={dateKey}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-sm font-bold ${isToday ? 'text-violet-600' : 'text-slate-700'}`}>
                    {d.getMonth() + 1}/{d.getDate()} ({['일','월','화','수','목','금','토'][d.getDay()]})
                  </span>
                  {isToday && <span className="text-xs px-2 py-0.5 bg-violet-100 text-violet-600 rounded-full">{t('today')}</span>}
                </div>
                <div className="space-y-2">
                  {items.map((item) =>
                    item.kind === 'event' ? (
                      <button key={`e-${item.event.id}`} onClick={() => openDetail(item.event)} className="w-full text-left p-4 rounded-xl border border-slate-100 hover:border-violet-200 hover:bg-violet-50/30 transition">
                        <div className="flex items-start gap-3">
                          <span className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-lg ${EVENT_TYPE_META[item.event.event_type].colorClass}`}>{typeLabel(item.event.event_type)}</span>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-800 truncate">{item.event.title}</p>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-slate-500">
                              <span className="flex items-center gap-1"><Clock size={13} /> {fmtTime(item.event)}</span>
                              {item.event.location && <span className="flex items-center gap-1"><MapPin size={13} /> {item.event.location}</span>}
                              {item.event.setlist_id && <span className="flex items-center gap-1 text-indigo-500"><FileText size={13} /> {t('linkedSetlist')}</span>}
                            </div>
                          </div>
                        </div>
                      </button>
                    ) : (
                      <button key={`s-${item.setlist.id}`} onClick={() => openSetlist(item.setlist.id)} className="w-full text-left p-4 rounded-xl border border-indigo-100 bg-indigo-50/40 hover:bg-indigo-50 transition">
                        <div className="flex items-center gap-3">
                          <span className="shrink-0 text-xs font-semibold px-2 py-1 rounded-lg bg-indigo-100 text-indigo-600 flex items-center gap-1"><FileText size={13} /> {t('setlistBadge')}</span>
                          <p className="font-semibold text-slate-800 truncate flex-1">{item.setlist.title}</p>
                          <ChevronRight size={16} className="text-indigo-400 shrink-0" />
                        </div>
                      </button>
                    )
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ── 월 그리드 뷰 ── */
        <MonthGrid year={cursor.y} month={cursor.m} events={events} setlists={setlistItems} onSelect={openDetail} onOpenSetlist={openSetlist} />
      )}

      {/* 생성/수정 모달 */}
      {showModal && (
        <TeamEventModal
          teamId={teamId}
          currentUserId={currentUserId}
          event={editingEvent}
          setlists={setlists}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); loadEvents() }}
        />
      )}

      {/* 상세 + 참석 모달 */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={() => setSelectedEvent(null)}>
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${EVENT_TYPE_META[selectedEvent.event_type].colorClass}`}>{typeLabel(selectedEvent.event_type)}</span>
                  <h3 className="font-bold text-xl text-slate-900 mt-2">{selectedEvent.title}</h3>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditingEvent(selectedEvent); setSelectedEvent(null); setShowModal(true) }} className="p-2 text-slate-400 hover:text-slate-700"><Edit size={18} /></button>
                  <button onClick={() => handleDelete(selectedEvent)} className="p-2 text-slate-400 hover:text-rose-600"><Trash2 size={18} /></button>
                </div>
              </div>

              <div className="space-y-2 text-sm text-slate-600 mb-5">
                <p className="flex items-center gap-2"><Clock size={15} /> {new Date(selectedEvent.start_at).toLocaleDateString()} · {fmtTime(selectedEvent)}</p>
                {selectedEvent.location && <p className="flex items-center gap-2"><MapPin size={15} /> {selectedEvent.location}</p>}
                {selectedEvent.description && <p className="text-slate-500 whitespace-pre-wrap pt-1">{selectedEvent.description}</p>}
                {selectedEvent.setlist_id && (
                  <button onClick={() => router.push(`/my-team/${teamId}/setlist/${selectedEvent.setlist_id}`)} className="flex items-center gap-2 text-indigo-600 font-medium">
                    <FileText size={15} /> {t('openSetlist')}
                  </button>
                )}
              </div>

              {/* 내 참석 */}
              <div className="mb-5">
                <p className="text-sm font-semibold text-slate-700 mb-2">{t('myAttendance')}</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['attending', 'absent', 'maybe'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSetAttendance(currentUserId, s)}
                      className={`min-h-[44px] py-2 rounded-lg text-sm font-medium transition ${myStatus === s ? STATUS_STYLE[s] + ' ring-2 ring-offset-1 ring-current' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    >
                      {t(s)}
                    </button>
                  ))}
                </div>
              </div>

              {/* 참석 현황 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-slate-700">{t('attendees')}</p>
                  {summary && (
                    <p className="text-xs text-slate-500">
                      {t('attending')} {summary.attending} · {t('absent')} {summary.absent} · {t('maybe')} {summary.maybe} · {t('noResponse')} {summary.no_response}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  {members.map((m) => {
                    const rec = attendance.find((a) => a.user_id === m.user_id)
                    const st: AttendanceStatus = rec?.status ?? 'no_response'
                    return (
                      <div key={m.user_id} className="flex items-center justify-between py-1.5">
                        <span className="text-sm text-slate-700">{m.name}</span>
                        {isLeader ? (
                          <select
                            value={st}
                            onChange={(e) => handleSetAttendance(m.user_id, e.target.value as AttendanceStatus)}
                            className={`text-xs px-2 py-1 rounded-md border-none ${STATUS_STYLE[st]}`}
                            style={{ fontSize: '13px' }}
                          >
                            <option value="attending">{t('attending')}</option>
                            <option value="absent">{t('absent')}</option>
                            <option value="maybe">{t('maybe')}</option>
                            <option value="no_response">{t('noResponse')}</option>
                          </select>
                        ) : (
                          <span className={`text-xs px-2 py-1 rounded-md ${STATUS_STYLE[st]}`}>{t(st === 'no_response' ? 'noResponse' : st)}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 월 그리드 — 일정 + 콘티 병합 표시
type DayItem =
  | { kind: 'event'; ev: TeamEvent }
  | { kind: 'setlist'; id: string; title: string }

function MonthGrid({
  year, month, events, setlists, onSelect, onOpenSetlist,
}: {
  year: number; month: number
  events: TeamEvent[]
  setlists: { id: string; title: string; service_date: string | null }[]
  onSelect: (ev: TeamEvent) => void
  onOpenSetlist: (id: string) => void
}) {
  const first = new Date(year, month, 1)
  const startOffset = first.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)

  const byDay = new Map<string, DayItem[]>()
  const add = (key: string, item: DayItem) => {
    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key)!.push(item)
  }
  for (const ev of events) add(ymd(new Date(ev.start_at)), { kind: 'event', ev })
  for (const s of setlists) if (s.service_date) add(s.service_date, { kind: 'setlist', id: s.id, title: s.title })
  const todayKey = ymd(new Date())

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {['일','월','화','수','목','금','토'].map((w, i) => (
          <div key={w} className={`text-center text-xs font-semibold py-1 ${i === 0 ? 'text-rose-400' : i === 6 ? 'text-blue-400' : 'text-slate-400'}`}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-slate-100 rounded-lg overflow-hidden">
        {cells.map((date, i) => {
          const key = date ? ymd(date) : `e${i}`
          const dayItems = date ? (byDay.get(key) ?? []) : []
          return (
            <div key={key} className={`min-h-[76px] bg-white p-1 ${date && key === todayKey ? 'ring-1 ring-inset ring-violet-300' : ''}`}>
              {date && (
                <>
                  <div className={`text-xs mb-1 ${key === todayKey ? 'font-bold text-violet-600' : 'text-slate-400'}`}>{date.getDate()}</div>
                  <div className="space-y-0.5">
                    {dayItems.slice(0, 3).map((item) =>
                      item.kind === 'event' ? (
                        <button key={`e-${item.ev.id}`} onClick={() => onSelect(item.ev)} className={`w-full truncate text-left text-[10px] px-1 py-0.5 rounded ${EVENT_TYPE_META[item.ev.event_type].colorClass}`}>
                          {item.ev.title}
                        </button>
                      ) : (
                        <button key={`s-${item.id}`} onClick={() => onOpenSetlist(item.id)} className="w-full truncate text-left text-[10px] px-1 py-0.5 rounded bg-indigo-100 text-indigo-600">
                          📋 {item.title}
                        </button>
                      )
                    )}
                    {dayItems.length > 3 && <div className="text-[10px] text-slate-400 px-1">+{dayItems.length - 3}</div>}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
