import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Supabase 클라이언트에 추가 옵션 설정
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    headers: {
      'x-my-custom-header': 'ministry-hub'
    },
  },
})

// ===== 타입 정의 =====
export interface User {
  id: string;
  email: string;
  name: string;
  created_at?: string;
  last_login?: string;
}

export interface Team {
  id: string;
  name: string;
  type: 'church_internal' | 'external';
  church_name?: string;
  description?: string;
  invite_code: string;
  created_by: string;
  created_at?: string;
  updated_at?: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: 'admin' | 'leader' | 'member';
  parts?: string[];
  status: 'pending' | 'active' | 'inactive';
  joined_at?: string;
}

// 송폼 구조 타입
export interface SongStructure {
  [key: string]: string
  // 예: { "Verse1": "가사...", "Chorus": "가사..." }
}

// Song 타입 정의
export interface Song {
  id: string
  song_name: string
  team_name?: string
  key?: string
  time_signature?: string
  tempo?: string
  bpm?: number
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
  owner_type?: 'personal' | 'team'
  owner_id?: string
  source_context?: string
  is_part_specific?: boolean
  part?: string
  version_info?: string
  visibility?: 'private' | 'teams' | 'public'
  upload_status?: 'pending' | 'completed' | 'failed'
  like_count?: number  // 🎵 좋아요 수 추가
}

// Folder 타입 정의
export interface Folder {
  id: string
  user_id: string
  name: string
  type: 'church' | 'department'
  parent_id?: string
  color?: string
  order_number: number
  created_at?: string
  updated_at?: string
}

// Setlist 타입 정의
export interface Setlist {
  id: string
  user_id: string
  folder_id?: string
  title: string
  service_date: string
  service_type?: string
  theme?: string
  notes?: string
  created_at?: string
  updated_at?: string
}

// SetlistWithSongs 타입 정의
export interface SetlistWithSongs extends Setlist {
  folder?: Folder
}

// SetlistSong 타입 정의
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
}

// 송폼 섹션 타입 (10개로 단순화)
export type SongSection =
  | 'Intro'
  | 'Verse'
  | 'Verse1'
  | 'Verse2'
  | 'PreChorus'
  | 'Chorus'
  | 'Interlude'
  | 'Bridge'
  | 'Tag'
  | 'Outro'

// 송폼 축약어 매핑
export const SECTION_ABBREVIATIONS: { [key: string]: string } = {
  'Intro': 'I',
  'Verse': 'V',
  'Verse1': 'V1',
  'Verse2': 'V2',
  'PreChorus': 'Pc',
  'Chorus': 'C',
  'Interlude': '간주',
  'Bridge': 'B',
  'Tag': 'T',
  'Outro': 'Out'
}

// 축약어 → 전체 이름 역매핑
export const ABBREVIATION_TO_SECTION: { [key: string]: string } =
  Object.fromEntries(
    Object.entries(SECTION_ABBREVIATIONS).map(([k, v]) => [v, k])
  )

// ===== 필기 노트 타입 정의 =====

// 필기 스트로크 포인트
export interface StrokePoint {
  x: number
  y: number
  pressure?: number  // Apple Pencil 압력 감지 (0~1)
}

// 필기 스트로크
export interface Stroke {
  id: string
  tool: 'pen' | 'highlighter' | 'eraser'
  color: string
  size: number
  opacity: number
  points: StrokePoint[]
}

// 텍스트 요소
export interface TextElement {
  id: string
  x: number
  y: number
  text: string
  fontSize: number
  color: string
  fontFamily?: string
}

// 페이지별 필기 데이터
export interface PageAnnotation {
  pageNumber: number
  strokes: Stroke[]
  textElements: TextElement[]
}

// 악보 필기 노트 (Supabase 테이블)
export interface SheetMusicNote {
  id: string
  user_id: string
  song_id: string
  title: string
  annotations: PageAnnotation[]  // JSON으로 저장
  thumbnail_url?: string  // 미리보기 이미지
  created_at?: string
  updated_at?: string
}

