// src/lib/chordChartExtract.ts
//
// 악보 이미지/PDF → ChordChart(JSON) 추출용 프롬프트 및 파서.
// 비전 모델(claude-sonnet-5)에 사용. 라우트/검증 스크립트 공용.

import type { ChordChart } from '@/types/chordChart'

export const CHORD_CHART_MODEL = 'claude-sonnet-5'
export const CHORD_CHART_MAX_TOKENS = 8000

export const CHORD_CHART_SYSTEM_PROMPT = `You transcribe sheet music into a simplified chord chart.

You are given an image (or PDF) of sheet music. Extract ONLY the chords and lyrics, organized measure by measure. IGNORE the musical staff, note heads, rhythms, and melody — do NOT infer chords from notes. Only read printed chord symbols (e.g. "C", "Am7", "F", "G", "CM7", "D/F#") and printed lyrics.

Output STRICT JSON ONLY (no markdown, no code fences, no commentary) matching this TypeScript type:

interface ChordChart {
  time_signature: string;   // e.g. "4/4". If not visible, use "4/4".
  key?: string;             // e.g. "C". Omit if unknown.
  bars_per_line?: number;   // measures shown per line/row, if discernible (usually 4).
  measures: {
    index: number;          // 1-based, in reading order (left→right, top→bottom).
    chords: string[];       // chord symbols in this measure, in order. [] if none.
    lyric: string;          // lyrics under this measure, "" if none.
    section?: string;       // section name if a NEW section starts at this measure
                            //   (e.g. "Intro", "Verse 1", "Pre-Chorus", "Chorus", "Bridge", "Tag", "Outro").
    repeat_start?: boolean; // true if a repeat-start barline ||: begins here.
    repeat_end?: boolean;   // true if a repeat-end barline :|| ends here.
    ending?: number;        // 1 or 2 for 1st/2nd ending brackets.
  }[];
}

Rules:
- One entry per measure (bar). Preserve left-to-right, top-to-bottom order.
- A measure may have 0, 1, or multiple chords. Keep chord spelling exactly as printed.
- Put the lyric syllables/words that sit under that measure into "lyric". If a word spans measures, place it where it starts.
- Only set "section" on the measure where the section label appears / where it clearly begins.
- If you cannot read something, make your best guess but never invent chords from melody notes.
- Return ONLY the JSON object.`

/** 모델 응답 텍스트에서 ChordChart JSON 을 파싱한다(코드펜스/앞뒤 텍스트 방어). */
export function parseChordChart(text: string): ChordChart {
  let s = (text || '').trim()
  // 코드펜스 제거
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  }
  // 첫 { ~ 마지막 } 구간만 취함
  const first = s.indexOf('{')
  const last = s.lastIndexOf('}')
  if (first !== -1 && last !== -1 && last > first) {
    s = s.slice(first, last + 1)
  }
  const parsed = JSON.parse(s)
  if (!parsed || !Array.isArray(parsed.measures)) {
    throw new Error('ChordChart 형식이 아님(measures 없음)')
  }
  // 최소 정규화
  const measures = parsed.measures.map((m: Record<string, unknown>, i: number) => ({
    index: typeof m.index === 'number' ? m.index : i + 1,
    chords: Array.isArray(m.chords) ? m.chords.map((c) => String(c)) : [],
    lyric: typeof m.lyric === 'string' ? m.lyric : '',
    ...(m.section ? { section: String(m.section) } : {}),
    ...(m.repeat_start ? { repeat_start: true } : {}),
    ...(m.repeat_end ? { repeat_end: true } : {}),
    ...(typeof m.ending === 'number' ? { ending: m.ending } : {}),
  }))
  return {
    time_signature: typeof parsed.time_signature === 'string' ? parsed.time_signature : '4/4',
    ...(parsed.key ? { key: String(parsed.key) } : {}),
    ...(typeof parsed.bars_per_line === 'number' ? { bars_per_line: parsed.bars_per_line } : {}),
    measures,
  }
}
