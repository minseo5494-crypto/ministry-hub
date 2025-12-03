// src/lib/constants.ts
// 🎵 음악 관련 상수 (ZOOM 제외 - 각 페이지에서 개별 관리)

// 절기 상수
export const SEASONS = [
  '전체', '크리스마스', '부활절', '고난주간', 
  '추수감사절', '신년', '종교개혁주일'
] as const;

// 테마 상수
export const THEMES = [
  '경배', '찬양', '회개', '감사', '헌신', 
  '선교', '구원', '사랑', '소망', '믿음', 
  '은혜', '성령', '치유', '회복', '십자가'
] as const;

// BPM 템포 범위
export const TEMPO_RANGES: { [key: string]: { min: number; max: number } } = {
  '느림': { min: 0, max: 65 },
  '조금느림': { min: 66, max: 79 },
  '보통': { min: 80, max: 100 },
  '조금빠름': { min: 101, max: 120 },
  '빠름': { min: 121, max: 150 },
  '매우빠름': { min: 151, max: 200 },
};

// 키 목록
export const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

// 박자 목록
export const TIME_SIGNATURES = ['3/4', '4/4', '6/8', '12/8'] as const;

// 템포 목록
export const TEMPOS = ['느림', '조금느림', '보통', '조금빠름', '빠름', '매우빠름'] as const;

// 송폼 섹션
export const SONG_FORM_SECTIONS = [
  'Intro', 'Verse1', 'Verse2', 'Verse3', 'Verse4',
  'PreChorus', 'PreChorus1', 'PreChorus2',
  'Chorus', 'Chorus1', 'Chorus2',
  'Interlude', 'Bridge', 'Outro'
] as const;

// 예배 유형
export const SERVICE_TYPES = [
  '주일집회', '수요집회', '금요집회', '새벽집회',
  '청년예배', '주일학교', '찬양예배', '특별집회', '중보기도회', '기도회'
] as const;