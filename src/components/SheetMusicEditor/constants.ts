// ===== 펜 색상 프리셋 =====
export const COLORS = [
  '#000000', // 검정
  '#FF0000', // 빨강
  '#0066FF', // 파랑
  '#00AA00', // 초록
  '#FF6600', // 주황
  '#9900FF', // 보라
  '#666666', // 회색
  '#8B4513', // 갈색
  '#FF1493', // 핫핑크
  '#00CED1', // 다크터콰이즈
]

// ===== 형광펜 색상 프리셋 =====
export const HIGHLIGHTER_COLORS = [
  '#FFFF00', // 노랑
  '#00FF00', // 연두
  '#00FFFF', // 하늘
  '#FF00FF', // 분홍
  '#FFA500', // 주황
  '#90EE90', // 연초록
  '#FFB6C1', // 연분홍
  '#87CEEB', // 하늘색
]

// ===== 파트 태그 색상 (부드러운 파스텔 톤) =====
export const PART_COLORS: { [key: string]: string } = {
  'I': '#F87171',      // 부드러운 코랄
  'V': '#60A5FA',      // 부드러운 파랑
  'V1': '#7DD3FC',     // 연한 스카이블루
  'V2': '#60A5FA',     // 부드러운 파랑
  'V3': '#818CF8',     // 연한 인디고
  'PC': '#FBBF24',     // 부드러운 앰버
  'C': '#4ADE80',      // 부드러운 초록
  'C1': '#86EFAC',     // 연한 민트
  'C2': '#4ADE80',     // 부드러운 초록
  'B': '#C084FC',      // 부드러운 보라
  '간주': '#FB923C',   // 부드러운 주황
  'Out': '#9CA3AF',    // 부드러운 회색
}

// ===== 사용 가능한 파트 태그 =====
export const AVAILABLE_PARTS = [
  { key: 'I', label: 'Intro' },
  { key: 'V', label: 'Verse' },
  { key: 'V1', label: 'Verse1' },
  { key: 'V2', label: 'Verse2' },
  { key: 'V3', label: 'Verse3' },
  { key: 'PC', label: 'PreChorus' },
  { key: 'C', label: 'Chorus' },
  { key: 'C1', label: 'Chorus1' },
  { key: 'C2', label: 'Chorus2' },
  { key: 'B', label: 'Bridge' },
  { key: '간주', label: 'Interlude' },
  { key: 'Out', label: 'Outro' },
]

// ===== 송폼 색상 프리셋 =====
export const FORM_COLOR_PRESETS = [
  { name: '보라', value: '#7C3AED' },
  { name: '파랑', value: '#2563EB' },
  { name: '빨강', value: '#DC2626' },
  { name: '초록', value: '#16A34A' },
  { name: '주황', value: '#EA580C' },
  { name: '검정', value: '#1F2937' },
]

// ===== 기본 송폼 스타일 =====
export const DEFAULT_SONG_FORM_STYLE = {
  x: 85,
  y: 5,
  fontSize: 36,
  color: '#7C3AED',
  opacity: 0.85,
}

// ===== 기본 파트 태그 스타일 =====
export const DEFAULT_PART_TAG_STYLE = {
  fontSize: 20,
  color: '#3B82F6',
  opacity: 0.9,
}

// ===== 줌 설정 =====
export const ZOOM_CONFIG = {
  MIN: 0.25,
  MAX: 3,
  STEP: 0.1,
  DEFAULT: 0.5,
}

// ===== 스트로크 크기 설정 =====
export const STROKE_SIZE_CONFIG = {
  PEN_DEFAULT: 3,
  PEN_MIN: 1,
  PEN_MAX: 10,
  ERASER_DEFAULT: 20,
  ERASER_MIN: 10,
  ERASER_MAX: 50,
  TEXT_DEFAULT: 24,
  TEXT_MIN: 12,
  TEXT_MAX: 72,
}
