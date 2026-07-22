'use client'

// src/components/ChordChartView.tsx
//
// ChordChart(마디별 코드+가사)를 "싱잉기타" 스타일 마디 그리드로 렌더.
// 한 줄에 bars_per_line(기본 4) 마디, 마디 위 코드 / 아래 가사 / 줄 시작에 마디번호 / 섹션 색상 tint.

import type { ChordChart, ChordMeasure } from '@/types/chordChart'
import { sectionStyle } from '@/lib/songSection'

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export default function ChordChartView({ chart }: { chart: ChordChart }) {
  const perLine = Math.max(1, chart.bars_per_line || 4)
  const rows = chunk(chart.measures, perLine)

  // 섹션 carry-forward (라벨은 시작 마디에만 있으므로 이전 섹션을 이어받음)
  let carry = ''
  const effSection = new Map<number, string>()
  for (const m of chart.measures) {
    if (m.section) carry = m.section
    effSection.set(m.index, carry)
  }

  return (
    <div className="w-full">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-3 text-sm text-gray-500">
        <span className="font-semibold text-gray-700">{chart.time_signature || '4/4'}</span>
        {chart.key && <span>Key: {chart.key}</span>}
        <span>{chart.measures.length}마디</span>
      </div>

      <div className="border-t border-gray-300">
        {rows.map((row, r) => (
          <div key={r} className="flex border-b border-gray-300">
            {row.map((m) => (
              <MeasureCell key={m.index} m={m} section={effSection.get(m.index) || ''} />
            ))}
            {/* 마지막 줄이 덜 찼으면 빈 칸으로 균형 */}
            {row.length < perLine &&
              Array.from({ length: perLine - row.length }).map((_, i) => (
                <div key={`pad-${i}`} className="flex-1 border-l border-gray-200" />
              ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function MeasureCell({ m, section }: { m: ChordMeasure; section: string }) {
  const style = sectionStyle(section)
  const isSectionStart = !!m.section
  return (
    <div
      className="flex-1 min-w-0 border-l border-gray-300 px-1.5 pt-5 pb-2 relative"
      style={{ backgroundColor: section ? `${style.hex}14` : undefined }}
    >
      {/* 마디 번호 */}
      <span className="absolute top-0.5 left-1 text-[10px] text-gray-400 tabular-nums">{m.index}</span>

      {/* 섹션 라벨(시작 마디에만) */}
      {isSectionStart && (
        <span
          className={`absolute -top-0.5 right-1 text-[10px] font-bold px-1 rounded ${style.chip}`}
        >
          {m.section}
        </span>
      )}

      {/* 반복/엔딩 표시 */}
      {(m.repeat_start || m.repeat_end || m.ending) && (
        <span className="absolute bottom-0.5 right-1 text-[10px] text-gray-500">
          {m.repeat_start ? '‖:' : ''}
          {m.ending ? ` ${m.ending}.` : ''}
          {m.repeat_end ? ' :‖' : ''}
        </span>
      )}

      {/* 코드 */}
      <div className="min-h-[1.25rem] font-bold text-gray-900 text-sm leading-tight truncate">
        {(m.chords || []).join('  ')}
      </div>
      {/* 가사 */}
      <div className="min-h-[1rem] text-xs text-gray-600 leading-tight break-words">{m.lyric}</div>
    </div>
  )
}
