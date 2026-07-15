'use client'

import { useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type {
  TeamEvent,
  TeamEventInput,
  EventAttendance,
  AttendanceStatus,
  AttendanceSummary,
  RecurrenceType,
  RecurrenceScope,
} from '@/types/teamEvent'

// 반복 유형별 요일 (0=일 … 6=토)
const RECURRENCE_WEEKDAYS: Record<Exclude<RecurrenceType, 'none'>, number[]> = {
  weekly_sat: [6],
  weekly_sun: [0],
  weekly_sat_sun: [6, 0],
}

// 기준 일정(start_at)을 받아 반복 유형·주 수만큼 시작 시각 목록을 생성.
// 시각(시/분)은 유지하고 날짜만 해당 요일로 이동시킨다.
function buildRecurringStarts(baseStartAt: string, recurrence: RecurrenceType, weeks: number): Date[] {
  if (recurrence === 'none') return [new Date(baseStartAt)]

  const base = new Date(baseStartAt)
  const weekdays = RECURRENCE_WEEKDAYS[recurrence]
  const results: Date[] = []

  // 기준 날짜가 속한 주의 일요일(주 시작)을 구한다
  const weekStart = new Date(base)
  weekStart.setDate(base.getDate() - base.getDay())

  for (let w = 0; w < weeks; w++) {
    for (const wd of weekdays) {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + w * 7 + wd)
      d.setHours(base.getHours(), base.getMinutes(), 0, 0)
      // 기준 시각보다 과거인 첫 주 회차는 제외 (예: 오늘이 일요일인데 토요일 반복이면 이번 주 토요일은 지남)
      if (d >= base) results.push(d)
    }
  }
  return results
}

export function useTeamEvents() {
  // ── 일정 조회 ───────────────────────────────────────────────

  // 기간 내 일정 (월 뷰용). rangeStart~rangeEnd는 ISO 문자열.
  const fetchEvents = useCallback(
    async (teamId: string, rangeStart: string, rangeEnd: string): Promise<TeamEvent[]> => {
      const { data, error } = await supabase
        .from('team_events')
        .select('*')
        .eq('team_id', teamId)
        .gte('start_at', rangeStart)
        .lte('start_at', rangeEnd)
        .order('start_at', { ascending: true })

      if (error) {
        console.error('fetchEvents error:', error)
        return []
      }
      return (data as TeamEvent[]) ?? []
    },
    []
  )

  // 다가오는 일정 (대시보드/아젠다용)
  const fetchUpcomingEvents = useCallback(
    async (teamId: string, limit = 10): Promise<TeamEvent[]> => {
      const nowIso = new Date().toISOString()
      const { data, error } = await supabase
        .from('team_events')
        .select('*')
        .eq('team_id', teamId)
        .gte('start_at', nowIso)
        .order('start_at', { ascending: true })
        .limit(limit)

      if (error) {
        console.error('fetchUpcomingEvents error:', error)
        return []
      }
      return (data as TeamEvent[]) ?? []
    },
    []
  )

  // ── 일정 생성 ───────────────────────────────────────────────

  // 단일 일정 생성
  const createEvent = useCallback(
    async (teamId: string, createdBy: string, input: TeamEventInput): Promise<TeamEvent | null> => {
      const { data, error } = await supabase
        .from('team_events')
        .insert({ team_id: teamId, created_by: createdBy, ...input })
        .select()
        .single()

      if (error) {
        console.error('createEvent error:', error)
        return null
      }
      return data as TeamEvent
    },
    []
  )

  // 반복 일정 생성 — 인스턴스 여러 개를 같은 recurrence_group_id로 저장
  const createRecurringEvents = useCallback(
    async (
      teamId: string,
      createdBy: string,
      input: TeamEventInput,
      recurrence: RecurrenceType,
      weeks: number
    ): Promise<TeamEvent[]> => {
      const starts = buildRecurringStarts(input.start_at, recurrence, weeks)
      if (starts.length === 0) return []

      // 종료 시각이 있으면 시작과의 간격을 유지해 각 회차에 적용
      const durationMs =
        input.end_at ? new Date(input.end_at).getTime() - new Date(input.start_at).getTime() : null

      const groupId = recurrence === 'none' ? null : crypto.randomUUID()

      const rows = starts.map((start) => ({
        team_id: teamId,
        created_by: createdBy,
        title: input.title,
        event_type: input.event_type,
        start_at: start.toISOString(),
        end_at: durationMs != null ? new Date(start.getTime() + durationMs).toISOString() : null,
        all_day: input.all_day ?? false,
        location: input.location ?? null,
        description: input.description ?? null,
        setlist_id: input.setlist_id ?? null,
        recurrence_group_id: groupId,
      }))

      const { data, error } = await supabase.from('team_events').insert(rows).select()
      if (error) {
        console.error('createRecurringEvents error:', error)
        return []
      }
      return (data as TeamEvent[]) ?? []
    },
    []
  )

  // ── 일정 수정/삭제 ─────────────────────────────────────────

  const updateEvent = useCallback(
    async (eventId: string, patch: Partial<TeamEventInput>): Promise<boolean> => {
      const { error } = await supabase.from('team_events').update(patch).eq('id', eventId)
      if (error) {
        console.error('updateEvent error:', error)
        return false
      }
      return true
    },
    []
  )

  // 반복 시리즈 수정 (이 회차만 / 이후 전체 / 전체)
  const updateEventSeries = useCallback(
    async (
      event: TeamEvent,
      patch: Partial<TeamEventInput>,
      scope: RecurrenceScope
    ): Promise<boolean> => {
      if (scope === 'this' || !event.recurrence_group_id) {
        return (async () => {
          const { error } = await supabase.from('team_events').update(patch).eq('id', event.id)
          if (error) { console.error('updateEventSeries(this) error:', error); return false }
          return true
        })()
      }

      let q = supabase.from('team_events').update(patch).eq('recurrence_group_id', event.recurrence_group_id)
      if (scope === 'future') q = q.gte('start_at', event.start_at)
      const { error } = await q
      if (error) {
        console.error('updateEventSeries error:', error)
        return false
      }
      return true
    },
    []
  )

  const deleteEvent = useCallback(async (eventId: string): Promise<boolean> => {
    const { error } = await supabase.from('team_events').delete().eq('id', eventId)
    if (error) {
      console.error('deleteEvent error:', error)
      return false
    }
    return true
  }, [])

  // 반복 시리즈 삭제 (이 회차만 / 이후 전체 / 전체)
  const deleteEventSeries = useCallback(
    async (event: TeamEvent, scope: RecurrenceScope): Promise<boolean> => {
      if (scope === 'this' || !event.recurrence_group_id) {
        const { error } = await supabase.from('team_events').delete().eq('id', event.id)
        if (error) { console.error('deleteEventSeries(this) error:', error); return false }
        return true
      }

      let q = supabase.from('team_events').delete().eq('recurrence_group_id', event.recurrence_group_id)
      if (scope === 'future') q = q.gte('start_at', event.start_at)
      const { error } = await q
      if (error) {
        console.error('deleteEventSeries error:', error)
        return false
      }
      return true
    },
    []
  )

  // ── 참석 ───────────────────────────────────────────────────

  const fetchAttendance = useCallback(async (eventId: string): Promise<EventAttendance[]> => {
    const { data, error } = await supabase
      .from('team_event_attendance')
      .select('*')
      .eq('event_id', eventId)

    if (error) {
      console.error('fetchAttendance error:', error)
      return []
    }
    return (data as EventAttendance[]) ?? []
  }, [])

  // 참석 상태 설정 (본인 또는 리더 대리). 일정별 1인 1행 upsert.
  const setAttendance = useCallback(
    async (
      eventId: string,
      userId: string,
      status: AttendanceStatus,
      note: string | null = null
    ): Promise<boolean> => {
      const { error } = await supabase
        .from('team_event_attendance')
        .upsert(
          { event_id: eventId, user_id: userId, status, note },
          { onConflict: 'event_id,user_id' }
        )

      if (error) {
        console.error('setAttendance error:', error)
        return false
      }
      return true
    },
    []
  )

  // 참석 요약 집계 (activeMemberCount = 팀 active 멤버 수)
  const summarizeAttendance = useCallback(
    (records: EventAttendance[], activeMemberCount: number): AttendanceSummary => {
      const counts = { attending: 0, absent: 0, maybe: 0, no_response: 0 }
      for (const r of records) {
        if (r.status === 'attending') counts.attending++
        else if (r.status === 'absent') counts.absent++
        else if (r.status === 'maybe') counts.maybe++
      }
      const responded = counts.attending + counts.absent + counts.maybe
      counts.no_response = Math.max(0, activeMemberCount - responded)
      return { ...counts, total_members: activeMemberCount }
    },
    []
  )

  return {
    fetchEvents,
    fetchUpcomingEvents,
    createEvent,
    createRecurringEvents,
    updateEvent,
    updateEventSeries,
    deleteEvent,
    deleteEventSeries,
    fetchAttendance,
    setAttendance,
    summarizeAttendance,
  }
}
