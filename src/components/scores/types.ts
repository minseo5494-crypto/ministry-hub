// 악보 공통 타입 정의

// 드럼 파트 타입
export type DrumPart = 'HH' | 'SN' | 'KK' | 'TH' | 'TM' | 'TL' | 'CY' | 'RD'

// 드럼 음표 타입
export interface DrumNote {
  part: DrumPart  // 드럼 파트
  position: number    // 마디 내 위치 (0-100)
  duration?: 4 | 8 | 16  // 음표 길이
  noteType?: 'normal' | 'x' | 'ghost'  // 음표 타입
  beamGroup?: string  // 잇단음표 그룹 ID
}

// 드럼 악보 요소 타입
export interface DrumScoreElement {
  id: string
  x: number           // 0-100 (퍼센트)
  y: number           // 0-100 (퍼센트)
  pageIndex: number   // 페이지 인덱스
  measureCount: 1 | 2 | 3 | 4  // 마디 수
  measureWidths?: number[]  // 각 마디 너비
  notes: DrumNote[]   // 드럼 음표 배열
  scale?: number      // 크기 조절 (0.5-2.0, 기본값 1.0)
}

// 피아노 음표 타입
export interface PianoNote {
  pitch: string       // 음이름 (C4, D4, E4 등)
  position: number    // 마디 내 위치 (0부터 시작)
  duration?: 1 | 2 | 4 | 8 | 16  // 음표 길이
  beamGroup?: string  // 잇단음표 그룹 ID
}

// 피아노 코드 타입
export interface PianoChord {
  name: string        // 코드 이름 (예: "Bb7")
  position: number    // 마디 내 위치 (0-100)
}

// 피아노 악보 요소 타입
export interface PianoScoreElement {
  id: string
  x: number           // 0-100 (퍼센트)
  y: number           // 0-100 (퍼센트)
  pageIndex: number   // 페이지 인덱스
  measureCount: 1 | 2 | 3 | 4  // 마디 수
  measureWidths?: number[]  // 각 마디 너비
  chordName?: string  // 코드 이름 (deprecated)
  chords?: PianoChord[]  // 코드 배열
  notes: PianoNote[]  // 음표 배열
  scale?: number      // 크기 조절
}

// 드럼 파트별 Y 위치 (5선지 기준)
// 오선: 첫째줄 y=22, 줄 간격=10 (줄: 22, 32, 42, 52, 62)
// 참고: 드럼 악보 표기법 표준
export const DRUM_PART_Y: Record<DrumPart, number> = {
  'CY': 7,    // 크래쉬 심벌 - 오선 위 (가장 높음)
  'RD': 12,   // 라이드 - 오선 위
  'HH': 17,   // 하이햇 - 오선 위 (첫째 줄 바로 위)
  'TH': 22,   // 하이탐 - 첫째 줄 (탐1)
  'TM': 37,   // 미드탐 - 둘째-셋째 줄 사이 (탐2)
  'SN': 42,   // 스네어 - 셋째 줄 (가운데)
  'TL': 47,   // 플로어탐 - 셋째-넷째 줄 사이
  'KK': 67,   // 킥/베이스 - 다섯째 줄 아래
}

// 드럼 파트 정보 (5선지 위치 순서)
// noteStyle: 'x'=X표시(하이햇), 'x-circle'=동그라미X(심벌), 'x-ring'=원형X(라이드), 'normal'=일반음표
export type DrumNoteStyle = 'x' | 'x-circle' | 'x-ring' | 'normal' | 'ghost'

export const DRUM_PARTS: { value: DrumPart; label: string; emoji: string; noteType: 'x' | 'normal'; noteStyle: DrumNoteStyle }[] = [
  // 심벌/하이햇 (오선 위) - 각각 다른 스타일
  { value: 'CY', label: '심벌', emoji: '🔔', noteType: 'x', noteStyle: 'x-circle' },  // 동그라미 X
  { value: 'RD', label: '라이드', emoji: '🛎️', noteType: 'x', noteStyle: 'x-ring' }, // 원형 X
  { value: 'HH', label: '하이햇', emoji: '🎩', noteType: 'x', noteStyle: 'x' },       // 일반 X
  // 탐 (오선 내)
  { value: 'TH', label: '하이탐', emoji: '🪘', noteType: 'normal', noteStyle: 'normal' },
  { value: 'SN', label: '스네어', emoji: '🥁', noteType: 'normal', noteStyle: 'normal' },
  { value: 'TM', label: '미드탐', emoji: '🪘', noteType: 'normal', noteStyle: 'normal' },
  { value: 'TL', label: '로우탐', emoji: '🪘', noteType: 'normal', noteStyle: 'normal' },
  // 킥 (오선 아래)
  { value: 'KK', label: '킥', emoji: '👟', noteType: 'normal', noteStyle: 'normal' },
]

// 파트별 기둥 방향 (true=위로, false=아래로)
// 드럼 악보에서 상성부(하이햇/심벌)는 기둥 위로, 하성부(킥)는 기둥 아래로
export const DRUM_STEM_UP: Record<DrumPart, boolean> = {
  'CY': true,   // 심벌 - 위로
  'RD': true,   // 라이드 - 위로
  'HH': true,   // 하이햇 - 위로
  'TH': true,   // 하이탐 - 위로
  'TM': true,   // 미드탐 - 위로
  'SN': true,   // 스네어 - 위로
  'TL': true,   // 로우탐 - 위로
  'KK': false,  // 킥 - 아래로
}
