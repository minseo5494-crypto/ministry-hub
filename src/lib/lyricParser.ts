import type { SongStructure } from './supabase'

export interface ParsedLyrics {
  structure: SongStructure
  fullText: string
  sections: string[]
}

/**
 * 가사를 파싱하여 송폼 구조로 변환
 * @param lyrics - 원본 가사 텍스트
 * @returns 파싱된 가사 구조
 */
export function parseLyrics(lyrics: string): ParsedLyrics {
  const structure: SongStructure = {}
  const sections: string[] = []
  
  // [섹션명] 패턴으로 분리
  // 정규식: [로 시작하고 ]로 끝나는 부분
  const sectionPattern = /\[([^\]]+)\]/g
  
  // 전체 가사를 섹션별로 분리
  const parts = lyrics.split(sectionPattern)
  
  // parts 배열 구조:
  // [0]: 첫 섹션 이전 텍스트 (보통 빈 문자열)
  // [1]: 첫 섹션 이름 (예: "Intro")
  // [2]: 첫 섹션 가사
  // [3]: 두 번째 섹션 이름 (예: "Verse1")
  // [4]: 두 번째 섹션 가사
  // ...
  
  for (let i = 1; i < parts.length; i += 2) {
    const sectionName = parts[i].trim()
    const sectionLyrics = parts[i + 1]?.trim() || ''
    
    if (sectionLyrics) {
      // 섹션 이름 정규화 (대소문자 무시, 공백 제거)
      const normalizedName = normalizeSectionName(sectionName)
      
      structure[normalizedName] = sectionLyrics
      sections.push(normalizedName)
    }
  }
  
  return {
    structure,
    fullText: lyrics,
    sections
  }
}

/**
 * 섹션 이름 정규화
 * 예: "verse 1", "Verse1", "VERSE1" → "Verse1"
 */
function normalizeSectionName(name: string): string {
  const normalized = name.toLowerCase().replace(/\s+/g, '')
  
  // 매핑 테이블
  const mappings: { [key: string]: string } = {
    'intro': 'Intro',
    'verse': 'Verse',
    'verse1': 'Verse1',
    'verse2': 'Verse2',
    'verse3': 'Verse3',
    'verse4': 'Verse4',
    'prechorus': 'PreChorus',
    'prechorus1': 'PreChorus1',
    'prechorus2': 'PreChorus2',
    'pre-chorus': 'PreChorus',
    'chorus': 'Chorus',
    'chorus1': 'Chorus1',
    'chorus2': 'Chorus2',
    'interlude': 'Interlude',
    'bridge': 'Bridge',
    'outro': 'Outro',
    'ending': 'Outro',
    // 한글 지원
    '인트로': 'Intro',
    '절': 'Verse',
    '1절': 'Verse1',
    '2절': 'Verse2',
    '3절': 'Verse3',
    '4절': 'Verse4',
    '전주': 'Intro',
    '간주': 'Interlude',
    '브릿지': 'Bridge',
    '브릿지1': 'Bridge',
    '후렴': 'Chorus',
    '후렴1': 'Chorus1',
    '후렴2': 'Chorus2',
    '코러스': 'Chorus',
    '코러스1': 'Chorus1',
    '코러스2': 'Chorus2',
    '엔딩': 'Outro',
    '아웃트로': 'Outro'
  }
  
  return mappings[normalized] || name
}

/**
 * 가사가 송폼 구조를 포함하는지 확인
 */
export function hasStructure(lyrics: string): boolean {
  const sectionPattern = /\[([^\]]+)\]/
  return sectionPattern.test(lyrics)
}

/**
 * 송폼 구조를 가사 텍스트로 변환 (저장된 구조 → 표시용)
 */
export function structureToLyrics(structure: SongStructure): string {
  return Object.entries(structure)
    .map(([section, lyrics]) => `[${section}]\n${lyrics}`)
    .join('\n\n')
}

/**
 * 선택된 송폼 순서대로 가사 조합
 */
export function assembleLyrics(
  structure: SongStructure,
  selectedSections: string[]
): string[] {
  return selectedSections
    .map(section => {
      // 축약어를 전체 이름으로 변환할 필요가 있을 수 있음
      return structure[section] || ''
    })
    .filter(Boolean)
}
