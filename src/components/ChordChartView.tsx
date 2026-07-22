'use client'

// src/components/ChordChartView.tsx
//
// ChordChart 렌더 — 두 가지 레이아웃 자동 선택:
//  1) 섹션이 있는 곡(섹션 라벨 2개 이상): 섹션별 카드 + "코드 위/가사 아래" (가사 읽기 쉬움)
//  2) 섹션이 없는 곡: 가로 선 + 마디 구분선(barline), 선 위 코드 / 선 아래 가사

import type { ChordChart, ChordMeasure } from '@/types/chordChart'
import { sectionStyle, sectionFamily } from '@/lib/songSection'

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// 섹션명 → 짧은 배지 라벨 (Intro→I, Verse 1→V1, Pre-Chorus→Pc, Chorus→C …)
function sectionAbbr(name: string): string {
  const fam = sectionFamily(name)
  const base: Record<string, string> = {
    intro: 'I',
    verse: 'V',
    prechorus: 'Pc',
    chorus: 'C',
    bridge: 'B',
    interlude: '간주',
    tag: 'T',
    outro: 'O',
    default: '·',
  }
  const num = name.match(/(\d+)/)?.[1] || ''
  return (base[fam] || '·') + num
}

interface Grouped {
  section: string
  measures: ChordMeasure[]
}

export default function ChordChartView({ chart }: { chart: ChordChart }) {
  const measures = chart.measures || []

  // 섹션 carry-forward
  let carry = ''
  const withSec = measures.map((m) => {
    if (m.section) carry = m.section
    return { m, sec: carry }
  })
  const distinct = Array.from(new Set(withSec.map((x) => x.sec).filter(Boolean)))
  const sectioned = distinct.length >= 2

  return (
    <div className="w-full">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-3 text-sm text-gray-500">
        <span className="font-semibold text-gray-700">{chart.time_signature || '4/4'}</span>
        {chart.key && <span>Key: {chart.key}</span>}
        <span>{measures.length}마디</span>
      </div>

      {sectioned ? <SectionedView withSec={withSec} /> : <LineView measures={measures} perLine={chart.bars_per_line || 4} />}
    </div>
  )
}

// ── 섹션 있는 곡: 섹션 카드 + 코드 위/가사 아래 ──────────────────────────
function SectionedView({ withSec }: { withSec: { m: ChordMeasure; sec: string }[] }) {
  // 연속 구간을 섹션 그룹으로 묶기
  const groups: Grouped[] = []
  for (const { m, sec } of withSec) {
    const last = groups[groups.length - 1]
    if (!last || last.section !== sec) {
      groups.push({ section: sec, measures: [m] })
    } else {
      last.measures.push(m)
    }
  }

  return (
    <div>
      {/* 섹션 순서 배지 */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {groups.map((g, i) => {
          const style = sectionStyle(g.section)
          return (
            <span
              key={i}
              className="inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold border"
              style={{ color: style.hex, borderColor: style.hex }}
              title={g.section}
            >
              {sectionAbbr(g.section)}
            </span>
          )
        })}
      </div>

      {/* 섹션 카드 (2열) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {groups.map((g, i) => {
          const style = sectionStyle(g.section)
          return (
            <div key={i} className="rounded-xl border border-gray-200 overflow-hidden">
              <div
                className="flex items-center gap-2 px-3 py-2 border-b"
                style={{ borderColor: `${style.hex}33`, backgroundColor: `${style.hex}0f` }}
              >
                <span
                  className="inline-flex items-center justify-center min-w-6 h-6 px-1 rounded-full text-[11px] font-bold text-white"
                  style={{ backgroundColor: style.hex }}
                >
                  {sectionAbbr(g.section)}
                </span>
                <span className="font-bold text-gray-800 text-sm">{g.section}</span>
              </div>
              <div className="p-3">
                <div className="flex flex-wrap gap-x-3 gap-y-2">
                  {g.measures.map((m, j) => (
                    <div key={j} className="align-top">
                      <div className="text-sm font-bold text-gray-900 leading-tight min-h-[1.1rem] whitespace-nowrap">
                        {(m.chords || []).join('  ')}
                      </div>
                      <div className="text-[15px] text-gray-700 leading-snug whitespace-nowrap">
                        {m.lyric || ' '}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 섹션 없는 곡: 가로 선 + barline, 선 위 코드 / 선 아래 가사 ────────────
function LineView({ measures, perLine }: { measures: ChordMeasure[]; perLine: number }) {
  const rows = chunk(measures, Math.max(1, perLine))
  return (
    <div className="space-y-5">
      {rows.map((row, r) => (
        <div key={r}>
          {/* 코드 행 (아래 테두리 = 가로 선) */}
          <div className="flex border-b-2 border-gray-500 border-r-2">
            {row.map((m, i) => (
              <div
                key={i}
                className="flex-1 min-w-0 border-l-2 border-gray-500 px-2 pb-1 min-h-[1.75rem] flex items-end"
              >
                <span className="text-sm font-bold text-gray-900 truncate">
                  {(m.chords || []).join('  ')}
                </span>
              </div>
            ))}
            {/* 빈 칸 채우기 */}
            {row.length < perLine &&
              Array.from({ length: perLine - row.length }).map((_, i) => (
                <div key={`p-${i}`} className="flex-1 border-l-2 border-gray-500" />
              ))}
          </div>
          {/* 가사 행 */}
          <div className="text-[15px] text-gray-700 leading-relaxed pl-2 pt-1 break-words">
            {row.map((m) => m.lyric).filter(Boolean).join(' ') || ' '}
          </div>
        </div>
      ))}
    </div>
  )
}
