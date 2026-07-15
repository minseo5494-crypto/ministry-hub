// 팀 일정 캘린더 타입
// DB 테이블: team_events, team_event_attendance (20260715_team_events.sql)
// 컬럼명은 DB(snake_case)와 그대로 맞춘다.

// 일정 유형
export type EventType = 'practice' | 'serving' | 'worship' | 'etc'

// 참석 상태
export type AttendanceStatus = 'attending' | 'absent' | 'maybe' | 'no_response'

// 반복 유형 (생성 시에만 사용 — DB엔 개별 인스턴스로 저장됨)
export type RecurrenceType = 'none' | 'weekly_sat' | 'weekly_sun' | 'weekly_sat_sun'

// 반복 일정 수정/삭제 범위
export type RecurrenceScope = 'this' | 'future' | 'all'

// team_events 행
export type TeamEvent = {
  id: string
  team_id: string
  title: string
  event_type: EventType
  start_at: string              // ISO timestamptz
  end_at: string | null
  all_day: boolean
  location: string | null
  description: string | null
  setlist_id: string | null     // 예배 일정 ↔ team_setlists 연결
  recurrence_group_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// team_event_attendance 행
export type EventAttendance = {
  id: string
  event_id: string
  user_id: string
  status: AttendanceStatus
  note: string | null
  updated_at: string
}

// 일정 생성/수정 입력 (id·타임스탬프 제외)
export type TeamEventInput = {
  title: string
  event_type: EventType
  start_at: string
  end_at?: string | null
  all_day?: boolean
  location?: string | null
  description?: string | null
  setlist_id?: string | null
}

// 참석 요약 (한 일정에 대한 상태별 집계)
export type AttendanceSummary = {
  attending: number
  absent: number
  maybe: number
  no_response: number   // 팀 active 멤버 수 - 응답한 인원
  total_members: number
}

// UI 표시용 유형 메타 (라벨은 i18n에서 별도 처리, 여기선 색/키만)
export const EVENT_TYPE_META: Record<EventType, { colorClass: string }> = {
  practice: { colorClass: 'text-violet-600 bg-violet-50' },
  serving:  { colorClass: 'text-teal-600 bg-teal-50' },
  worship:  { colorClass: 'text-indigo-600 bg-indigo-50' },
  etc:      { colorClass: 'text-gray-600 bg-gray-100' },
}
