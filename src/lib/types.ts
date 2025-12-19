// src/lib/types.ts

// 사용자
export interface User {
  id: string
  email: string
  name?: string
  is_admin?: boolean
  created_at?: string
  last_login?: string
}

// 팀
export interface Team {
  id: string
  name: string
  type?: string
  church_name?: string
  description?: string
  invite_code?: string
  member_count?: number
  created_by?: string
  created_at?: string
  updated_at?: string
}

// 팀 멤버
export interface TeamMember {
  id: string
  team_id: string
  user_id: string
  role: 'admin' | 'leader' | 'member'
  parts?: string[]
  status: 'active' | 'pending' | 'inactive'
  joined_at?: string
}

// 팀 정보 (확장)
export interface TeamInfo extends Team {
  my_role?: 'admin' | 'leader' | 'member'
}

// 공식 업로더
export interface OfficialUploader {
  id: string
  email: string
  name?: string
  description?: string
  created_at?: string
  created_by?: string
}

// 공식 퍼블리셔 (팀 계정)
export interface VerifiedPublisher {
  id: string
  name: string
  description?: string
  contact_email?: string
  website_url?: string
  logo_url?: string
  is_active: boolean
  created_at?: string
  created_by?: string
  updated_at?: string
  // 조인된 데이터
  accounts?: PublisherAccount[]
  account_count?: number
}

// 퍼블리셔 소속 계정
export interface PublisherAccount {
  id: string
  publisher_id: string
  user_id?: string
  email: string
  role: 'admin' | 'member'
  created_at?: string
  created_by?: string
  // 조인된 데이터
  publisher?: VerifiedPublisher
}

// 송폼 구조
export interface SongStructure {
  [key: string]: string
}

// 곡
export interface Song {
  id: string
  song_name: string
  team_name?: string
  key?: string
  time_signature?: string
  tempo?: string
  bpm?: number | string
  theme1?: string
  theme2?: string
  themes?: string[]
  season?: string
  lyrics?: string
  youtube_url?: string
  song_structure?: SongStructure
  file_url?: string
  file_type?: string
  file_hash?: string
  file_size?: number
  created_at?: string
  updated_at?: string
  uploaded_by?: string
  owner_type?: string
  owner_id?: string
  source_context?: string
  is_part_specific?: boolean
  part?: string
  version_info?: string
  visibility?: 'public' | 'teams' | 'private'
  shared_with_teams?: string[]
  upload_status?: string
  is_user_uploaded?: boolean
  is_official?: boolean
  publisher_id?: string
  // 조인된 데이터
  publisher?: VerifiedPublisher
}

// 송폼 위치 (PDF 생성용)
export interface SongFormPosition {
  x: number
  y: number
  size: 'small' | 'medium' | 'large'
}

// 폴더
export interface Folder {
  id: string
  user_id: string
  name: string
  type?: string
  parent_id?: string
  color?: string
  order_number?: number
  created_at?: string
  updated_at?: string
}

// 콘티
export interface Setlist {
  id: string
  user_id?: string
  team_id?: string
  folder_id?: string
  title: string
  service_date?: string
  service_type?: string
  theme?: string
  notes?: string
  created_by?: string
  created_at?: string
  updated_at?: string
}

// 콘티 (곡 포함)
export interface SetlistWithSongs extends Setlist {
  folder?: Folder
  song_count?: number
  creator_email?: string
  canEdit?: boolean
}

// 콘티 내 곡
export interface SetlistSong {
  id: string
  setlist_id: string
  song_id: string
  order_number: number
  key_transposed?: string
  notes?: string
  selected_form?: string[]
  created_at?: string
  updated_at?: string
  songs?: Song
}

// 송폼 섹션 타입
export type SongSection = 
  | 'Intro' | 'Verse' | 'Verse1' | 'Verse2' | 'Verse3' | 'Verse4'
  | 'PreChorus' | 'PreChorus1' | 'PreChorus2'
  | 'Chorus' | 'Chorus1' | 'Chorus2'
  | 'Interlude' | 'Bridge' | 'Outro'

// 고정곡
export interface FixedSong {
  id: string
  song_id: string
  category?: string
  order_number?: number
  song?: Song
}

// 활동 로그
export interface ActivityLog {
  id: string
  user_id: string
  action_type: string
  target_type?: string
  target_id?: string
  metadata?: any
  created_at?: string
}

// 다운로드 옵션
export interface DownloadOptions {
  title: string
  date: string
  songs: any[]
  songForms: { [songId: string]: string[] }
  songFormPositions?: { [songId: string]: SongFormPosition }
}

// 다운로드 형식
export type DownloadFormat = 'pdf' | 'ppt' | 'image'