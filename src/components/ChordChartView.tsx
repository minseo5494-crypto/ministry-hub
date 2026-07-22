'use client'

// src/components/ChordChartView.tsx
//
// ChordChart 렌더 — 가로 선 + 마디 구분선(barline) 레이아웃(모든 곡 공통).
// 한 줄에 bars_per_line(기본 4) 마디: 선 위에 코드 / 선 아래에 가사(마디 순서대로).
// (섹션 라벨은 데이터엔 남지만 화면에는 표시하지 않음 — 추론 섹션이 원본에 없을 수 있으므로.)

import type { ChordChart, ChordMeasure } from '@/types/chordChart'

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export default function ChordChartView({ chart }: { chart: ChordChart }) {
  const measures = chart.measures || []
  const perLine = Math.max(1, chart.bars_per_line || 4)
  const rows = chunk(measures, perLine)

  return (
    <div className="w-full">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-3 text-sm text-gray-500">
        <span className="font-semibold text-gray-700">{chart.time_signature || '4/4'}</span>
        {chart.key && <span>Key: {chart.key}</span>}
        <span>{measures.length}마디</span>
      </div>

      <div className="space-y-5">
        {rows.map((row, r) => (
          <LineRow key={r} row={row} perLine={perLine} />
        ))}
      </div>
    </div>
  )
}

function LineRow({ row, perLine }: { row: ChordMeasure[]; perLine: number }) {
  return (
    <div>
      {/* 코드 행 (아래 테두리 = 가로 선, 좌/우 끝 barline) */}
      <div className="flex border-b-2 border-gray-500 border-r-2">
        {row.map((m, i) => (
          <div
            key={i}
            className="flex-1 min-w-0 border-l-2 border-gray-500 px-2 pb-1 min-h-[1.75rem] flex items-end"
          >
            <span className="text-sm font-bold text-gray-900 truncate">
              {(m.chords || []).join('  ')}
            </span>
          </div>
        ))}
        {/* 마지막 줄 빈 칸 채우기(선 유지) */}
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
  )
}
