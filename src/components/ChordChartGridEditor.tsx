'use client'

// src/components/ChordChartGridEditor.tsx
//
// 코드악보 교정 편집 — "가로 선 + barline" 레이아웃 그대로, 마디 셀에서 인라인 수정.
// 각 마디: 섹션 입력(위) / 코드 입력(선 위) / 가사 입력(선 아래) / 마디 추가·삭제(하단).
// 로컬 편집 상태 유지(코드 입력 중 공백 유지) → 변경 시 onChange 로 상위 반영.
// ※ 부모는 코드악보가 새로 로드/생성될 때 key 를 바꿔 remount 해야 초기값 갱신.

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { ChordChart, ChordMeasure } from '@/types/chordChart'

interface EMeasure {
  section: string
  chordsText: string
  lyric: string
}
interface Meta {
  time_signature: string
  key: string
  barsPerLine: number
}

function toEditable(chart: ChordChart): EMeasure[] {
  return (chart.measures || []).map((m) => ({
    section: m.section || '',
    chordsText: (m.chords || []).join(' '),
    lyric: m.lyric || '',
  }))
}
function toChart(rows: EMeasure[], meta: Meta): ChordChart {
  const measures: ChordMeasure[] = rows.map((r, i) => ({
    index: i + 1,
    chords: r.chordsText.trim().split(/\s+/).filter(Boolean),
    lyric: r.lyric,
    ...(r.section.trim() ? { section: r.section.trim() } : {}),
  }))
  return {
    time_signature: meta.time_signature || '4/4',
    ...(meta.key.trim() ? { key: meta.key.trim() } : {}),
    ...(meta.barsPerLine ? { bars_per_line: meta.barsPerLine } : {}),
    measures,
  }
}
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const S16 = { fontSize: 16 } as const

export default function ChordChartGridEditor({
  chart,
  onChange,
}: {
  chart: ChordChart
  onChange: (c: ChordChart) => void
}) {
  const [rows, setRows] = useState<EMeasure[]>(() => toEditable(chart))
  const [meta, setMeta] = useState<Meta>(() => ({
    time_signature: chart.time_signature || '4/4',
    key: chart.key || '',
    barsPerLine: chart.bars_per_line || 4,
  }))

  const commit = (nextRows: EMeasure[], nextMeta: Meta) => {
    setRows(nextRows)
    setMeta(nextMeta)
    onChange(toChart(nextRows, nextMeta))
  }
  const setRow = (idx: number, patch: Partial<EMeasure>) =>
    commit(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)), meta)
  const del = (idx: number) => commit(rows.filter((_, i) => i !== idx), meta)
  const insertAfter = (idx: number) => {
    const c = [...rows]
    c.splice(idx + 1, 0, { section: '', chordsText: '', lyric: '' })
    commit(c, meta)
  }
  const addEnd = () => commit([...rows, { section: '', chordsText: '', lyric: '' }], meta)
  const setMetaField = (patch: Partial<Meta>) => commit(rows, { ...meta, ...patch })

  const perLine = Math.max(1, meta.barsPerLine || 4)
  // 배열 인덱스를 유지한 채 줄로 나눔
  const indices = rows.map((_, i) => i)
  const rowChunks = chunk(indices, perLine)

  const inpBase = 'w-full min-w-0 bg-transparent focus:bg-yellow-50 rounded outline-none'

  return (
    <div>
      {/* 곡 메타 */}
      <div className="flex flex-wrap gap-3 mb-3 text-sm">
        <label className="flex items-center gap-1">
          박자표
          <input
            value={meta.time_signature}
            onChange={(e) => setMetaField({ time_signature: e.target.value })}
            className="px-2 py-1 border border-gray-300 rounded w-16"
            style={S16}
          />
        </label>
        <label className="flex items-center gap-1">
          Key
          <input
            value={meta.key}
            onChange={(e) => setMetaField({ key: e.target.value })}
            className="px-2 py-1 border border-gray-300 rounded w-16"
            style={S16}
          />
        </label>
        <label className="flex items-center gap-1">
          줄당 마디
          <input
            type="number"
            min={1}
            max={8}
            value={meta.barsPerLine}
            onChange={(e) => setMetaField({ barsPerLine: Math.max(1, Math.min(8, Number(e.target.value) || 4)) })}
            className="px-2 py-1 border border-gray-300 rounded w-14"
            style={S16}
          />
        </label>
      </div>

      <div className="space-y-4">
        {rowChunks.map((cells, r) => (
          <div key={r}>
            {/* 섹션 입력 행 */}
            <div className="flex">
              {cells.map((idx) => (
                <div key={idx} className="flex-1 min-w-0 px-1">
                  <input
                    placeholder="섹션"
                    value={rows[idx].section}
                    onChange={(e) => setRow(idx, { section: e.target.value })}
                    className={`${inpBase} text-[11px] font-bold text-indigo-600 placeholder:text-gray-300`}
                    style={S16}
                  />
                </div>
              ))}
            </div>

            {/* 코드 입력 행 (아래 테두리 = 선) */}
            <div className="flex border-b-2 border-gray-500 border-r-2">
              {cells.map((idx) => (
                <div key={idx} className="flex-1 min-w-0 border-l-2 border-gray-500 px-1 pb-0.5">
                  <input
                    placeholder="코드"
                    value={rows[idx].chordsText}
                    onChange={(e) => setRow(idx, { chordsText: e.target.value })}
                    className={`${inpBase} text-sm font-bold text-gray-900 placeholder:text-gray-300 placeholder:font-normal`}
                    style={S16}
                  />
                </div>
              ))}
            </div>

            {/* 가사 입력 행 */}
            <div className="flex">
              {cells.map((idx) => (
                <div key={idx} className="flex-1 min-w-0 px-1 pt-0.5">
                  <input
                    placeholder="가사"
                    value={rows[idx].lyric}
                    onChange={(e) => setRow(idx, { lyric: e.target.value })}
                    className={`${inpBase} text-[15px] text-gray-700 placeholder:text-gray-300`}
                    style={S16}
                  />
                </div>
              ))}
            </div>

            {/* 마디별 추가/삭제 */}
            <div className="flex">
              {cells.map((idx) => (
                <div key={idx} className="flex-1 min-w-0 flex items-center justify-center gap-1 pt-0.5">
                  <span className="text-[10px] text-gray-300 tabular-nums mr-auto pl-1">{idx + 1}</span>
                  <button
                    onClick={() => insertAfter(idx)}
                    className="p-0.5 text-gray-300 hover:text-indigo-600"
                    title="오른쪽에 마디 추가"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => del(idx)}
                    className="p-0.5 text-gray-300 hover:text-red-500 mr-1"
                    title="마디 삭제"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addEnd}
        className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600"
      >
        <Plus className="w-4 h-4" /> 마디 추가
      </button>

      <p className="text-xs text-gray-400 mt-2">
        ※ 한 마디에 코드 여러 개는 공백 구분(예: <span className="font-mono">C G7</span>). 수정 후 상단 &quot;저장&quot;.
      </p>
    </div>
  )
}
