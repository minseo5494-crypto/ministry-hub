// src/types/chordChart.ts
//
// 코드악보(마디별 코드+가사) 데이터 모델. 악보 이미지/PDF에서 비전 LLM 으로 추출한다.
// 참고 레이아웃: "싱잉기타" 스타일 — 마디선 + 마디 위 코드 + 마디 아래 가사.

export interface ChordMeasure {
  /** 1부터 시작하는 마디 번호 */
  index: number
  /** 그 마디의 코드들. 한 마디에 여러 코드 가능(["Am7","G","FM7"]). 없으면 [] */
  chords: string[]
  /** 각 코드의 박 위치(1-based, chords 와 같은 순서/길이). 없으면 균등 분산으로 표시 */
  beats?: number[]
  /** 그 마디에 해당하는 가사 조각. 없으면 "" */
  lyric: string
  /** 이 마디에서 새 섹션이 시작되면 섹션 라벨(예: "Verse 1", "Chorus"). 아니면 생략 */
  section?: string
  /** 반복 시작 ｜: */
  repeat_start?: boolean
  /** 반복 끝 :｜ */
  repeat_end?: boolean
  /** 엔딩 번호(1., 2.) */
  ending?: number
}

export interface ChordChart {
  /** 박자표. 예: "4/4" */
  time_signature: string
  /** 키(선택). 예: "C" */
  key?: string
  /** 한 줄에 표시할 마디 수(기본 4) */
  bars_per_line?: number
  measures: ChordMeasure[]
}

/** song_chord_charts 레코드 */
export interface SongChordChart {
  id: string
  song_id: string
  data: ChordChart
  status: 'draft' | 'confirmed'
  generated_by: 'ai' | 'manual'
  created_by?: string
  created_at?: string
  updated_at?: string
}
