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
  role: 'admin' | 'leader' | 'member';  // 기존 호환성 유지
  role_id?: string;  // 새로운 직책 시스템
  parts?: string[];
  status: 'pending' | 'active' | 'inactive';
  joined_at?: string;
  // 조인된 데이터
  team_role?: TeamRole;
  user?: User;
}

// ===== 권한 시스템 타입 =====

// 권한 종류
export type Permission =
  | 'view_setlist'      // 콘티 보기
  | 'create_setlist'    // 새 콘티 만들기
  | 'edit_setlist'      // 콘티 편집
  | 'delete_setlist'    // 콘티 삭제
  | 'copy_setlist'      // 콘티 복사
  | 'view_sheet'        // 악보 뷰어
  | 'download_sheet'    // 악보 다운로드
  | 'add_fixed_song'    // 고정곡 추가
  | 'edit_fixed_song'   // 고정곡 편집
  | 'delete_fixed_song' // 고정곡 삭제
  | 'manage_members'    // 팀원 관리
  | 'manage_roles'      // 직책/권한 설정
  | 'edit_team_settings'; // 팀 설정 변경

// 권한 라벨 (UI 표시용)
export const PERMISSION_LABELS: { [key in Permission]: string } = {
  'view_setlist': '콘티 보기',
  'create_setlist': '새 콘티 만들기',
  'edit_setlist': '콘티 편집',
  'delete_setlist': '콘티 삭제',
  'copy_setlist': '콘티 복사',
  'view_sheet': '악보 뷰어',
  'download_sheet': '악보 다운로드',
  'add_fixed_song': '고정곡 추가',
  'edit_fixed_song': '고정곡 편집',
  'delete_fixed_song': '고정곡 삭제',
  'manage_members': '팀원 관리',
  'manage_roles': '직책/권한 설정',
  'edit_team_settings': '팀 설정 변경',
};

// 권한 카테고리 (UI 그룹핑용)
export const PERMISSION_CATEGORIES = {
  '콘티': ['view_setlist', 'create_setlist', 'edit_setlist', 'delete_setlist', 'copy_setlist'] as Permission[],
  '악보': ['view_sheet', 'download_sheet'] as Permission[],
  '고정곡': ['add_fixed_song', 'edit_fixed_song', 'delete_fixed_song'] as Permission[],
  '팀 관리': ['manage_members', 'manage_roles', 'edit_team_settings'] as Permission[],
};

// 팀 직책
export interface TeamRole {
  id: string;
  team_id: string;
  name: string;
  description?: string;
  is_default: boolean;
  is_leader: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
  // 조인된 권한 목록
  permissions?: Permission[];
}

// 직책별 권한
export interface RolePermission {
  id: string;
  role_id: string;
  permission: Permission;
  created_at?: string;
}

// 송폼 구조 타입
export interface SongStructure {
  [key: string]: string
  // 예: { "Verse1": "가사...", "Chorus": "가사..." }
}

// SongSheet 타입 정의 (악보 버전 관리)
export interface SongSheet {
  id: string
  song_id: string
  file_url: string
  file_type: 'pdf' | 'image' | string
  file_hash?: string
  file_size?: number
  label?: string  // 예: "원본", "E키 편곡", "간단 버전"
  uploaded_by?: string
  visibility: 'public' | 'team' | 'private'
  team_id?: string
  is_primary: boolean
  likes_count: number
  created_at?: string
  updated_at?: string
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
  like_count?: number
  is_official?: boolean
  is_user_uploaded?: boolean
  // 악보 버전 관리
  primary_sheet_id?: string
  sheets?: SongSheet[]  // 연결된 악보들
  sheets_count?: number  // 악보 개수
  // 퍼블리셔 관련
  publisher_id?: string
  publisher?: VerifiedPublisher
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

// ===== 테마 집계 타입 =====
export interface ThemeCount {
  theme: string
  count: number
}

// ===== 절기 타입 =====
export interface SeasonCount {
  name: string
  count: number
}

// songs 테이블에서 사용된 절기 목록과 곡 개수 가져오기
export async function fetchSeasons(): Promise<SeasonCount[]> {
  try {
    const { data, error } = await supabase
      .from('songs')
      .select('season')
      .not('season', 'is', null)

    if (error) {
      return []
    }

    // 절기별 카운트 집계
    const seasonCounts: { [key: string]: number } = {}
    data?.forEach(song => {
      if (song.season && song.season.trim()) {
        const season = song.season.trim()
        seasonCounts[season] = (seasonCounts[season] || 0) + 1
      }
    })

    // 배열로 변환하고 카운트 내림차순 정렬
    return Object.entries(seasonCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  } catch {
    return []
  }
}

// themes 값을 배열로 파싱하는 헬퍼 함수
// 배열, 쉼표 구분 텍스트, 단일 텍스트 모두 지원
export function parseThemes(themes: unknown): string[] {
  if (!themes) return []

  // 이미 배열인 경우
  if (Array.isArray(themes)) {
    return themes.map(t => String(t).trim()).filter(t => t)
  }

  // 문자열인 경우
  if (typeof themes === 'string') {
    const trimmed = themes.trim()

    // JSON 배열 형식인 경우 (예: '["찬양","감사"]')
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) {
          return parsed.map(t => String(t).trim()).filter(t => t)
        }
      } catch (e) {
        // JSON 파싱 실패 시 아래 로직으로 진행
      }
    }

    // 쉼표로 구분된 문자열인 경우
    return trimmed.split(',').map(t => t.trim()).filter(t => t)
  }

  return []
}

// 곡들의 테마를 집계하는 함수
export async function fetchThemeCounts(): Promise<ThemeCount[]> {
  const { data, error } = await supabase
    .from('songs')
    .select('themes')
    .not('themes', 'is', null)

  if (error) {
    console.error('Error fetching themes:', error)
    return []
  }

  // 테마별 카운트 집계
  const themeCounts: { [key: string]: number } = {}

  data?.forEach(song => {
    const themeList = parseThemes(song.themes)
    themeList.forEach((theme: string) => {
      themeCounts[theme] = (themeCounts[theme] || 0) + 1
    })
  })

  // 배열로 변환하고 카운트 내림차순 정렬
  return Object.entries(themeCounts)
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => b.count - a.count)
}

