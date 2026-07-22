// src/lib/chordChartExtract.ts
//
// 악보 이미지/PDF → ChordChart(JSON) 추출용 프롬프트 및 파서.
// 비전 모델(claude-sonnet-5)에 사용. 라우트/검증 스크립트 공용.

import type { ChordChart } from '@/types/chordChart'

export const CHORD_CHART_MODEL = 'claude-sonnet-5'
// 추론(thinking) 비활성화 → 출력은 JSON뿐이므로 토큰 여유 8000이면 충분(긴 곡도 커버).
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
    beats?: number[];       // 1-based beat position of each chord within the measure,
                            //   SAME length/order as chords (e.g. chords ["C","G"] beats [1,3]).
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
- Capture EVERY chord symbol. A single measure often has MULTIPLE chords (chord changes on different beats) — include all of them in "chords", left-to-right in the order they appear within that measure. Do not collapse them to one. Keep chord spelling exactly as printed.
- For each chord, also give its beat position within the measure in "beats" (1-based, same length and order as "chords"). Estimate the beat from where the chord sits horizontally over the bar: a chord at the start = beat 1; two chords splitting a 4/4 bar are usually beats 1 and 3. A single chord is beat 1.
- Put ONLY that measure's own lyric syllables into "lyric" — the words/syllables printed underneath that specific bar. Do not merge a whole phrase into one measure. Split the lyric across measures so each measure holds just the syllables sung during that bar (empty string if that bar has no lyric).
- If you cannot read something, make your best guess but never invent chords from melody notes.
- Return ONLY the JSON object.

Section rules (strict — printed labels only):
- Set "section" ONLY on a measure where a section label is actually PRINTED on the sheet — a visible text label or marker such as "Intro", "Verse", "Verse 1", "Pre-Chorus", "Chorus", "Bridge", "Tag", "Outro", "V1", "V2", "C", "B", or Korean 인트로/절/1절/2절/후렴/브릿지/간주/아웃트로. Put it on the measure where that printed label sits.
- You MAY normalize the label to a clean form (e.g. "1절" → "Verse 1", "후렴" → "Chorus", "V1" → "Verse 1").
- If the sheet does NOT print any section labels, leave "section" empty (omit the field) on EVERY measure. Do NOT infer, guess, or invent sections from musical structure, chord repetition, or lyrics. No printed label = no "section".`

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
  const measures = parsed.measures.map((m: Record<string, unknown>, i: number) => {
    const chords = Array.isArray(m.chords) ? m.chords.map((c) => String(c)) : []
    const beats =
      Array.isArray(m.beats) && m.beats.length === chords.length
        ? m.beats.map((b) => Number(b)).filter((b) => Number.isFinite(b))
        : undefined
    return {
    index: typeof m.index === 'number' ? m.index : i + 1,
    chords,
    ...(beats && beats.length === chords.length ? { beats } : {}),
    lyric: typeof m.lyric === 'string' ? m.lyric : '',
    ...(m.section ? { section: String(m.section) } : {}),
    ...(m.repeat_start ? { repeat_start: true } : {}),
    ...(m.repeat_end ? { repeat_end: true } : {}),
    ...(typeof m.ending === 'number' ? { ending: m.ending } : {}),
    }
  })
  return {
    time_signature: typeof parsed.time_signature === 'string' ? parsed.time_signature : '4/4',
    ...(parsed.key ? { key: String(parsed.key) } : {}),
    ...(typeof parsed.bars_per_line === 'number' ? { bars_per_line: parsed.bars_per_line } : {}),
    measures,
  }
}
