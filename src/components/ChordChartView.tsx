'use client'

// src/components/ChordChartView.tsx
//
// ChordChart 렌더 — 가로 선 + 마디 구분선(barline) 레이아웃.
// 한 줄에 bars_per_line(기본 4) 마디: 선 위에 코드(마디 내 여러 코드는 가로 분산),
// 선 아래에 가사를 "마디별 셀에 정렬". (섹션 라벨은 데이터엔 남지만 화면 미표시.)

import type { ChordChart, ChordMeasure } from '@/types/chordChart'
import { sectionStyle } from '@/lib/songSection'

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

      <div className="space-y-4">
        {rows.map((row, r) => (
          <LineRow key={r} row={row} perLine={perLine} />
        ))}
      </div>
    </div>
  )
}

function LineRow({ row, perLine }: { row: ChordMeasure[]; perLine: number }) {
  // 열 정렬을 위해 빈 칸으로 채움
  const cells: (ChordMeasure | null)[] = [...row]
  while (cells.length < perLine) cells.push(null)

  // 이 줄에서 인쇄 섹션이 시작되는 마디가 있으면 라벨 행 표시
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
          const chords = m?.chords || []
          return (
            <div
              key={i}
              className="flex-1 min-w-0 border-l-2 border-gray-500 px-1.5 pb-1 min-h-[1.75rem] flex items-end"
            >
              {chords.length > 0 && (
                // 마디 내 여러 코드는 균등 분산(박자 위치 근사)
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
              )}
            </div>
          )
        })}
      </div>

      {/* 가사 행 — 각 마디 셀 아래에 정렬 */}
      <div className="flex">
        {cells.map((m, i) => (
          <div
            key={i}
            className="flex-1 min-w-0 px-1.5 pt-1 text-[15px] text-gray-700 leading-snug break-words"
          >
            {m?.lyric || ''}
          </div>
        ))}
      </div>
    </div>
  )
}
