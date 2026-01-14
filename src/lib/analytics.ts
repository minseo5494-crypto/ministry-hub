// Google Analytics 4 이벤트 트래킹 유틸리티

// GA4 Measurement ID
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || ''

// gtag 타입 선언
declare global {
  interface Window {
    gtag: (
      command: 'config' | 'event' | 'js',
      targetId: string | Date,
      config?: Record<string, unknown>
    ) => void
  }
}

// 페이지 조회 트래킹
export const pageview = (url: string) => {
  if (typeof window !== 'undefined' && window.gtag && GA_MEASUREMENT_ID) {
    window.gtag('config', GA_MEASUREMENT_ID, {
      page_path: url,
    })
  }
}

// 커스텀 이벤트 트래킹
export const event = (
  action: string,
  params?: Record<string, string | number | boolean>
) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, params)
  }
}

// ==========================================
// 미리 정의된 이벤트들
// ==========================================

// 회원가입
export const trackSignUp = (method: 'email' | 'google') => {
  event('sign_up', { method })
}

// 로그인
export const trackLogin = (method: 'email' | 'google') => {
  event('login', { method })
}

// 악보 조회
export const trackSongView = (songId: string, songName: string) => {
  event('song_view', {
    song_id: songId,
    song_name: songName,
  })
}

// 악보 다운로드
export const trackSongDownload = (songId: string, format: 'pdf' | 'image' | 'ppt') => {
  event('song_download', {
    song_id: songId,
    format,
  })
}

// 콘티 생성
export const trackSetlistCreate = (songCount: number) => {
  event('setlist_create', {
    song_count: songCount,
  })
}

// 팀 생성
export const trackTeamCreate = () => {
  event('team_create', {})
}

// 팀 참여
export const trackTeamJoin = () => {
  event('team_join', {})
}

// 필기 저장
export const trackAnnotationSave = (songId: string) => {
  event('annotation_save', {
    song_id: songId,
  })
}

// AI 검색 사용
export const trackAISearch = (query: string) => {
  event('ai_search', {
    query: query.substring(0, 100), // 최대 100자
  })
}

// 피드백 제출
export const trackFeedbackSubmit = (type: 'bug' | 'feature' | 'other') => {
  event('feedback_submit', {
    feedback_type: type,
  })
}

// 악보 에디터 열기
export const trackSheetEditorOpen = (songId: string) => {
  event('sheet_editor_open', {
    song_id: songId,
  })
}

// 좋아요
export const trackSongLike = (songId: string) => {
  event('song_like', {
    song_id: songId,
  })
}
