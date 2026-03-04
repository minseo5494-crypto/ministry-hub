// 콘티 커뮤니티 기능 타입 정의
// 관련 테이블: shared_setlists, shared_setlist_likes, shared_setlist_comments,
//             shared_setlist_bookmarks, shared_setlist_reports

// 공유 콘티 내 개별 곡 스냅샷
type SharedSetlistSong = {
  order: number           // 곡 순서 (1부터 시작)
  song_id: string         // songs 테이블 참조 (비워도 됨 - 원본 삭제 대비)
  song_title: string      // 곡 제목 (스냅샷)
  artist: string          // 아티스트 (스냅샷)
  key: string             // 연주 키
  selected_form: string[] // 송폼 (예: ["V1", "C", "B", "C"])
  notes: string           // 곡별 메모/설명
}

// 공유 콘티 (shared_setlists 테이블)
type SharedSetlist = {
  id: string
  source_setlist_id: string    // 원본 team_setlists.id (참조용, FK 제약 없음)
  source_team_id: string       // 원본 팀 ID
  shared_by: string            // 공유한 사용자 ID (auth.users.id)
  title: string
  description: string | null
  tags: string[]
  service_type: string | null  // 예배 유형 (주일, 수요, 금요 등)
  songs: SharedSetlistSong[]   // JSONB 스냅샷
  devotional_guide: string | null
  author_name: string
  author_church: string | null
  like_count: number
  comment_count: number
  bookmark_count: number
  copy_count: number
  status: 'active' | 'hidden' | 'reported'
  created_at: string
  updated_at: string
  // 클라이언트 전용 (조회 시 현재 유저 상태 반영)
  is_liked?: boolean
  is_bookmarked?: boolean
}

// 댓글 (shared_setlist_comments 테이블)
type SharedSetlistComment = {
  id: string
  shared_setlist_id: string
  user_id: string
  content: string
  author_name: string
  author_church: string | null
  created_at: string
  updated_at: string
}

// 좋아요 (shared_setlist_likes 테이블)
type SharedSetlistLike = {
  id: string
  shared_setlist_id: string
  user_id: string
  created_at: string
}

// 북마크 (shared_setlist_bookmarks 테이블)
type SharedSetlistBookmark = {
  id: string
  shared_setlist_id: string
  user_id: string
  created_at: string
}

// 신고 (shared_setlist_reports 테이블)
type SharedSetlistReport = {
  id: string
  shared_setlist_id: string
  reporter_id: string
  reason: string
  status: 'pending' | 'reviewed' | 'resolved'
  created_at: string
}

// 커뮤니티 필터/정렬 옵션
type CommunityFilters = {
  sortBy: 'latest' | 'popular' | 'most_copied'
  serviceType: string | null  // 예배 유형 필터
  tags: string[]              // 태그 필터 (AND 조건)
  searchText: string          // 제목, 작성자, 태그 텍스트 검색
}

// 공유하기 입력 데이터
type ShareSetlistInput = {
  source_setlist_id: string
  source_team_id: string
  title: string
  description?: string
  tags?: string[]
  service_type?: string
  devotional_guide?: string
}

// 내 팀으로 복사 입력 데이터
type CopyToTeamInput = {
  shared_setlist_id: string
  team_id: string
  service_date: string  // YYYY-MM-DD
  service_type?: string
}

// 페이지네이션 커서 기반
type CommunityPage = {
  items: SharedSetlist[]
  nextCursor: string | null  // 다음 페이지 조회용 created_at 값
  hasMore: boolean
}

export type {
  SharedSetlistSong,
  SharedSetlist,
  SharedSetlistComment,
  SharedSetlistLike,
  SharedSetlistBookmark,
  SharedSetlistReport,
  CommunityFilters,
  ShareSetlistInput,
  CopyToTeamInput,
  CommunityPage,
}
