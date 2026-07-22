'use client'

// src/components/ChordChartEditor.tsx
//
// 코드악보 교정 편집기. 마디별 코드/가사/섹션 수정 + 마디 추가/삭제 + 박자표/키/줄당마디.
// 로컬 편집 상태를 유지하며(코드 입력 중 공백 유지) 변경 시 onChange 로 상위에 반영.
// ※ 부모는 코드악보가 새로 로드/생성될 때 key 를 바꿔 이 컴포넌트를 remount 해야 초기값이 갱신됨.

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { ChordChart, ChordMeasure } from '@/types/chordChart'

interface EMeasure {
  section: string
  chordsText: string
  lyric: string
}

function toEditable(chart: ChordChart): EMeasure[] {
  return (chart.measures || []).map((m) => ({
    section: m.section || '',
    chordsText: (m.chords || []).join(' '),
    lyric: m.lyric || '',
  }))
}

function toChart(base: ChordChart, rows: EMeasure[], meta: Meta): ChordChart {
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

interface Meta {
  time_signature: string
  key: string
  barsPerLine: number
}

export default function ChordChartEditor({
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
    onChange(toChart(chart, nextRows, nextMeta))
  }

  const setRow = (idx: number, patch: Partial<EMeasure>) =>
    commit(
      rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
      meta
    )
  const del = (idx: number) => commit(rows.filter((_, i) => i !== idx), meta)
  const insertAfter = (idx: number) => {
    const c = [...rows]
    c.splice(idx + 1, 0, { section: '', chordsText: '', lyric: '' })
    commit(c, meta)
  }
  const addEnd = () => commit([...rows, { section: '', chordsText: '', lyric: '' }], meta)
  const setMetaField = (patch: Partial<Meta>) => commit(rows, { ...meta, ...patch })

  const inp = 'px-2 py-1.5 border border-gray-300 rounded'
  const style16 = { fontSize: 16 } as const

  return (
    <div>
      {/* 곡 메타 */}
      <div className="flex flex-wrap gap-3 mb-3 text-sm">
        <label className="flex items-center gap-1">
          박자표
          <input
            value={meta.time_signature}
            onChange={(e) => setMetaField({ time_signature: e.target.value })}
            className={`${inp} w-16`}
            style={style16}
          />
        </label>
        <label className="flex items-center gap-1">
          Key
          <input
            value={meta.key}
            onChange={(e) => setMetaField({ key: e.target.value })}
            className={`${inp} w-16`}
            style={style16}
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
            className={`${inp} w-14`}
            style={style16}
          />
        </label>
      </div>

      {/* 컬럼 헤더 */}
      <div className="hidden sm:flex items-center gap-2 px-1.5 mb-1 text-[11px] text-gray-400">
        <span className="w-6 text-center">#</span>
        <span className="w-20">섹션</span>
        <span className="w-44">코드 (공백 구분)</span>
        <span className="flex-1">가사</span>
        <span className="w-14" />
      </div>

      {/* 마디 행 */}
      <div className="space-y-1.5">
        {rows.map((r, idx) => (
          <div key={idx} className="flex items-center gap-2 p-1.5 border border-gray-200 rounded-lg">
            <span className="w-6 text-xs text-gray-400 text-center tabular-nums">{idx + 1}</span>
            <input
              placeholder="섹션"
              value={r.section}
              onChange={(e) => setRow(idx, { section: e.target.value })}
              className={`${inp} w-20`}
              style={style16}
            />
            <input
              placeholder="C  G7"
              value={r.chordsText}
              onChange={(e) => setRow(idx, { chordsText: e.target.value })}
              className={`${inp} w-44 font-bold`}
              style={style16}
            />
            <input
              placeholder="가사"
              value={r.lyric}
              onChange={(e) => setRow(idx, { lyric: e.target.value })}
              className={`${inp} flex-1 min-w-0`}
              style={style16}
            />
            <div className="flex items-center gap-0.5 w-14 justify-end">
              <button
                onClick={() => insertAfter(idx)}
                className="p-1.5 text-gray-400 hover:text-indigo-600"
                title="아래에 마디 추가"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={() => del(idx)}
                className="p-1.5 text-gray-400 hover:text-red-500"
                title="마디 삭제"
              >
                <Trash2 className="w-4 h-4" />
              </button>
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

      <p className="text-xs text-gray-400 mt-3">
        ※ 한 마디에 코드 여러 개는 공백으로 구분(예: <span className="font-mono">C G7</span>). 수정 후 상단 &quot;저장&quot;.
      </p>
    </div>
  )
}
