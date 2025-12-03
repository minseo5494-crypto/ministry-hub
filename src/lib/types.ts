// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Supabase 클라이언트
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

// ===== 타입 re-export (하위 호환성) =====
export * from './types'

// ===== 송폼 축약어 매핑 =====
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

// 축약어 → 전체 이름 역매핑
export const ABBREVIATION_TO_SECTION: { [key: string]: string } = 
  Object.fromEntries(
    Object.entries(SECTION_ABBREVIATIONS).map(([k, v]) => [v, k])
  )