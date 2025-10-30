import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 👇 새로 추가: 송폼 구조 타입
export interface SongStructure {
  [key: string]: string
  // 예: { "Verse1": "가사...", "Chorus": "가사..." }
}

// Song 타입 정의 (기존 유지 + song_structure 추가)
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
  lyrics?: string
  song_structure?: SongStructure  // 👈 새로 추가!
  file_url?: string
  file_type?: string
  created_at?: string
  updated_at?: string
}

// Folder 타입 정의 (기존 유지)
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

// Setlist 타입 정의 (기존 유지)
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

// SetlistWithSongs 타입 정의 (기존 유지)
export interface SetlistWithSongs extends Setlist {
  folder?: Folder
}

// SetlistSong 타입 정의 (기존 유지 + selected_form 추가)
export interface SetlistSong {
  id: string
  setlist_id: string
  song_id: string
  order_number: number
  key_transposed?: string
  notes?: string
  selected_form?: string[]  // 👈 새로 추가! ['C1', 'C2', 'V1', ...]
  created_at?: string
  updated_at?: string
}

// 👇 새로 추가: 송폼 섹션 타입
export type SongSection = 
  | 'Intro' 
  | 'Verse'
  | 'Verse1' 
  | 'Verse2' 
  | 'Verse3'
  | 'Verse4'
  | 'PreChorus'
  | 'PreChorus1' 
  | 'PreChorus2'
  | 'Chorus'
  | 'Chorus1'
  | 'Chorus2'
  | 'Interlude' 
  | 'Bridge' 
  | 'Outro'

// 👇 새로 추가: 송폼 축약어 매핑
export const SECTION_ABBREVIATIONS: { [key: string]: string } = {
  'Intro': 'I',
  'Verse': 'V',
  'Verse1': 'V1',
  'Verse2': 'V2',
  'Verse3': 'V3',
  'Verse4': 'V4',
  'PreChorus': 'Pc',
  'PreChorus1': 'Pc1',
  'PreChorus2': 'Pc2',
  'Chorus': 'C',
  'Chorus1': 'C1',
  'Chorus2': 'C2',
  'Interlude': '간주',
  'Bridge': 'B',
  'Outro': 'Out'
}

// 👇 새로 추가: 축약어 → 전체 이름 역매핑
export const ABBREVIATION_TO_SECTION: { [key: string]: string } = 
  Object.fromEntries(
    Object.entries(SECTION_ABBREVIATIONS).map(([k, v]) => [v, k])
  )