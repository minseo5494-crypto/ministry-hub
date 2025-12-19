// src/lib/types.ts
// 타입 정의 통합 파일 - supabase.ts에서 re-export

// supabase.ts에서 공통 타입 re-export
export type {
  User,
  Team,
  TeamMember,
  TeamRole,
  Permission,
  RolePermission,
  Song,
  SongStructure,
  SongSheet,
  Folder,
  Setlist,
  SetlistWithSongs,
  SetlistSong,
  SongSection,
  OfficialUploader,
  VerifiedPublisher,
  PublisherAccount,
  StrokePoint,
  Stroke,
  TextElement,
  PageAnnotation,
  SheetMusicNote,
  ThemeCount,
  SeasonCount,
} from './supabase'

// types.ts 고유 타입들

// 팀 정보 (확장) - 사용자의 역할 포함
export interface TeamInfo {
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
  my_role?: 'admin' | 'leader' | 'member'
}

// 송폼 위치 (PDF 생성용)
export interface SongFormPosition {
  x: number
  y: number
  size: 'small' | 'medium' | 'large'
}

// 고정곡
export interface FixedSong {
  id: string
  song_id: string
  category?: string
  order_number?: number
  song?: import('./supabase').Song
}

// 활동 로그
export interface ActivityLog {
  id: string
  user_id: string
  action_type: string
  target_type?: string
  target_id?: string
  metadata?: Record<string, unknown>
  created_at?: string
}

// 다운로드 옵션
export interface DownloadOptions {
  title: string
  date: string
  songs: import('./supabase').Song[]
  songForms: { [songId: string]: string[] }
  songFormPositions?: { [songId: string]: SongFormPosition }
}

// 다운로드 형식
export type DownloadFormat = 'pdf' | 'ppt' | 'image'
