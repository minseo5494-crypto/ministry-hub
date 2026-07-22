'use client'

// src/components/ChordChartView.tsx
//
// ChordChart 렌더 — 가로 선 + 마디 구분선(barline) 레이아웃.
// 한 줄에 bars_per_line(기본 4) 마디: 선 위에 코드(마디 내 여러 코드는 가로 분산),
// 선 아래에 가사를 "마디별 셀에 정렬". 인쇄 섹션은 시작 마디 위에 라벨.
// highlightPos: 현재 재생 중인 마디(배열 인덱스)를 강조 + 자동 스크롤(연주 모드).

import { useEffect, useRef } from 'react'
import type { ChordChart, ChordMeasure } from '@/types/chordChart'
import { sectionStyle } from '@/lib/songSection'
import { parseBeatsPerBar } from '@/hooks/useClickTrack'

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export default function ChordChartView({
  chart,
  highlightPos,
}: {
  chart: ChordChart
  highlightPos?: number
}) {
  const measures = chart.measures || []
  const perLine = Math.max(1, chart.bars_per_line || 4)
  const beatsPerBar = parseBeatsPerBar(chart.time_signature)
  const rows = chunk(measures, perLine)
  const containerRef = useRef<HTMLDivElement>(null)

  // 하이라이트 마디로 자동 스크롤
  useEffect(() => {
    if (highlightPos == null || highlightPos < 0) return
    const el = containerRef.current?.querySelector<HTMLElement>(`[data-mpos="${highlightPos}"]`)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [highlightPos])

  return (
    <div className="w-full" ref={containerRef}>
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-3 text-sm text-gray-500">
        <span className="font-semibold text-gray-700">{chart.time_signature || '4/4'}</span>
        {chart.key && <span>Key: {chart.key}</span>}
        <span>{measures.length}마디</span>
      </div>

      <div className="space-y-4">
        {rows.map((row, r) => (
          <LineRow
            key={r}
            row={row}
            perLine={perLine}
            baseIndex={r * perLine}
            highlightPos={highlightPos}
            beatsPerBar={beatsPerBar}
          />
        ))}
      </div>
    </div>
  )
}

function LineRow({
  row,
  perLine,
  baseIndex,
  highlightPos,
  beatsPerBar,
}: {
  row: ChordMeasure[]
  perLine: number
  baseIndex: number
  highlightPos?: number
  beatsPerBar: number
}) {
  const cells: (ChordMeasure | null)[] = [...row]
  while (cells.length < perLine) cells.push(null)

  const hasSection = cells.some((m) => m?.section)

  return (
    <div>
      {/* 섹션 라벨 행 (인쇄된 섹션이 시작되는 마디 위) */}
      {hasSection && (
        <div className="flex mb-0.5">
          {cells.map((m, i) => (
            <div key={i} className="flex-1 min-w-0 px-1.5">
              {m?.section && (
                <span
                  className="inline-block text-[11px] font-bold px-1.5 py-0.5 rounded text-white truncate max-w-full"
                  style={{ backgroundColor: sectionStyle(m.section).hex }}
                >
                  {m.section}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 코드 행 (아래 테두리 = 가로 선, 좌/우 끝 barline) */}
      <div className="flex border-b-2 border-gray-500 border-r-2">
        {cells.map((m, i) => {
          const pos = baseIndex + i
          const active = m != null && highlightPos === pos
          const chords = m?.chords || []
          return (
            <div
              key={i}
              data-mpos={m != null ? pos : undefined}
              className={`flex-1 min-w-0 border-l-2 border-gray-500 px-1.5 pb-1 min-h-[1.75rem] flex items-end transition-colors ${
                active ? 'bg-yellow-200' : ''
              }`}
            >
              {chords.length > 0 &&
                (m?.beats && m.beats.length === chords.length ? (
                  // 박 위치로 표시
                  <div className="relative w-full h-5">
                    {chords.map((c, j) => (
                      <span
                        key={j}
                        className="absolute bottom-0 text-sm font-bold text-gray-900 whitespace-nowrap"
                        style={{ left: `${((Math.max(1, m.beats![j]) - 1) / beatsPerBar) * 100}%` }}
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                ) : (
                  // 박 정보 없으면 균등 분산
                  <div className="flex w-full items-end gap-1">
                    {chords.map((c, j) => (
                      <span
                        key={j}
                        className={`text-sm font-bold text-gray-900 truncate ${
                          chords.length > 1 ? 'flex-1' : ''
                        }`}
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                ))}
            </div>
          )
        })}
      </div>

      {/* 가사 행 — 각 마디 셀 아래에 정렬 */}
      <div className="flex">
        {cells.map((m, i) => {
          const pos = baseIndex + i
          const active = m != null && highlightPos === pos
          return (
            <div
              key={i}
              className={`flex-1 min-w-0 px-1.5 pt-1 text-[15px] leading-snug break-words transition-colors ${
                active ? 'bg-yellow-100 text-gray-900' : 'text-gray-700'
              }`}
            >
              {m?.lyric || ''}
            </div>
          )
        })}
      </div>
    </div>
  )
}
