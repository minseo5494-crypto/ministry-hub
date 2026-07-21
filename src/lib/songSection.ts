// src/lib/songSection.ts
//
// 송폼 섹션(약어) → 계열/색상/기본 마디 수 매핑.
// 클릭 가이드 트랙의 가로 타임라인, (후속) 코드악보 변환 등에서 공용으로 사용.

export type SectionFamily =
  | 'intro'
  | 'verse'
  | 'prechorus'
  | 'chorus'
  | 'bridge'
  | 'interlude'
  | 'tag'
  | 'outro'
  | 'default'

export interface SectionStyle {
  family: SectionFamily
  hex: string // 타임라인 블록 채움색(인라인 스타일용)
  chip: string // 칩용 tailwind 클래스(bg+text)
}

// 계열별 색상
const FAMILY_STYLE: Record<SectionFamily, { hex: string; chip: string }> = {
  intro: { hex: '#3b82f6', chip: 'bg-blue-100 text-blue-700' },
  verse: { hex: '#22c55e', chip: 'bg-green-100 text-green-700' },
  prechorus: { hex: '#f59e0b', chip: 'bg-amber-100 text-amber-700' },
  chorus: { hex: '#f97316', chip: 'bg-orange-100 text-orange-700' },
  bridge: { hex: '#a855f7', chip: 'bg-purple-100 text-purple-700' },
  interlude: { hex: '#14b8a6', chip: 'bg-teal-100 text-teal-700' },
  tag: { hex: '#ec4899', chip: 'bg-pink-100 text-pink-700' },
  outro: { hex: '#6b7280', chip: 'bg-gray-200 text-gray-700' },
  default: { hex: '#64748b', chip: 'bg-slate-100 text-slate-700' },
}

// 약어 → 계열. (순서 중요: pc/int/간주 를 c/i 보다 먼저 판정)
export function sectionFamily(abbr: string): SectionFamily {
  const s = (abbr || '').trim().toLowerCase()
  if (!s) return 'default'
  if (s.startsWith('pc') || s.startsWith('pre')) return 'prechorus'
  if (s === '간주' || s.startsWith('간') || s.startsWith('int')) return 'interlude'
  if (s.startsWith('i')) return 'intro'
  if (s.startsWith('v')) return 'verse'
  if (s.startsWith('c')) return 'chorus'
  if (s.startsWith('b')) return 'bridge'
  if (s.startsWith('t')) return 'tag'
  if (s.startsWith('o') || s === 'e') return 'outro'
  return 'default'
}

export function sectionStyle(abbr: string): SectionStyle {
  const family = sectionFamily(abbr)
  return { family, ...FAMILY_STYLE[family] }
}

// 계열별 기본 마디 수 (사용자가 수정 가능; 후속: 코드악보 변환 결과로 자동 채움)
const FAMILY_DEFAULT_BARS: Record<SectionFamily, number> = {
  intro: 4,
  verse: 8,
  prechorus: 4,
  chorus: 8,
  bridge: 8,
  interlude: 4,
  tag: 2,
  outro: 4,
  default: 4,
}

export function defaultBarsFor(abbr: string): number {
  return FAMILY_DEFAULT_BARS[sectionFamily(abbr)]
}
