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
}

export type SortBy = 'recent' | 'likes' | 'name'
export type SongFilter = 'all' | 'official' | 'user'
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

export type MainPageProps = {
  // Props can be extended as needed
}

export type { Song, User, ThemeCount, SeasonCount }
