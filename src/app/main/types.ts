import { Song, User, ThemeCount, SeasonCount, PageAnnotation } from '@/lib/supabase'

export type Filters = {
  season: string
  themes: string[]
  theme: string
  key: string
  isMinor: boolean
  timeSignature: string
  tempo: string
  searchText: string
  bpmMin: string
  bpmMax: string
  includeMyNotes: boolean
  includeLyrics: boolean
}

export type SortBy = 'recent' | 'likes' | 'name' | 'weekly'
export type SongFilter = 'all' | 'official' | 'user' | 'team'
export type ViewMode = 'grid' | 'list'

export type NewSongForm = {
  song_name: string
  team_name: string
  key: string
  time_signature: string
  tempo: string
  bpm: string
  themes: string[]
  season: string
  youtube_url: string
  lyrics: string
  visibility: 'public' | 'teams' | 'private'
  shared_with_teams: string[]
}

export type UserTeam = {
  id: string
  name: string
}

export type LocalSheetMusicNote = {
  id: string
  user_id: string
  song_id: string
  song_name: string
  team_name?: string
  file_url: string
  file_type: 'pdf' | 'image'
  title: string
  annotations: PageAnnotation[]
  songForms?: string[]
}

// 내 필기 목록 표시용 확장 타입
export type SongWithNote = Song & {
  isNoteItem?: boolean
  noteId?: string
  noteAnnotations?: PageAnnotation[]
  noteSongForms?: string[]
  originalSongId?: string  // 원본 곡 ID (저장 시 사용)
}

export type TeamSetlistCard = {
  id: string
  title: string
  service_date: string
  service_type: string
  team_id: string
  team_name: string
  song_count: number
  songs: { id: string; song_name: string; team_name?: string }[]
}

export type MainPageProps = {
  // Props can be extended as needed
}

export type { Song, User, ThemeCount, SeasonCount }
