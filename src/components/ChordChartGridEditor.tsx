'use client'

// src/components/ChordChartGridEditor.tsx
//
// 코드악보 교정 편집 — "가로 선 + barline" 레이아웃 그대로 표시하고,
// 마디를 탭하면 그 마디 편집(박자별 코드 슬롯 1·2·3·4 / 가사 / 섹션 / 삭제·추가).
// 로컬 상태 유지 → 변경 시 onChange(ChordChart). 부모는 새 차트 로드/생성 시 key 로 remount.

import { useState } from 'react'
import { Plus, X, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import type { ChordChart, ChordMeasure } from '@/types/chordChart'
import { parseBeatsPerBar } from '@/hooks/useClickTrack'
import { sectionStyle } from '@/lib/songSection'

interface EMeasure {
  section: string
  lyric: string
  beatSlots: string[] // 길이 = beatsPerBar, index 0 = 1박
}
interface Meta {
  time_signature: string
  key: string
  barsPerLine: number
}

function resize(slots: string[], n: number): string[] {
  const out = slots.slice(0, n)
  while (out.length < n) out.push('')
  return out
}

function toEditable(chart: ChordChart, n: number): EMeasure[] {
  return (chart.measures || []).map((m) => {
    const slots = Array<string>(n).fill('')
    const chords = m.chords || []
    if (m.beats && m.beats.length === chords.length) {
      chords.forEach((c, i) => {
        const b = Math.max(1, Math.min(n, m.beats![i])) - 1
        slots[b] = slots[b] ? `${slots[b]} ${c}` : c
      })
    } else {
      // 박 정보 없으면 균등 분산 배치
      chords.forEach((c, i) => {
        const b = chords.length <= 1 ? 0 : Math.min(n - 1, Math.floor((i * n) / chords.length))
        slots[b] = slots[b] ? `${slots[b]} ${c}` : c
      })
    }
    return { section: m.section || '', lyric: m.lyric || '', beatSlots: slots }
  })
}

function toChart(rows: EMeasure[], meta: Meta): ChordChart {
  const measures: ChordMeasure[] = rows.map((r, i) => {
    const chords: string[] = []
    const beats: number[] = []
    r.beatSlots.forEach((slot, b) => {
      slot
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .forEach((c) => {
          chords.push(c)
          beats.push(b + 1)
        })
    })
    return {
      index: i + 1,
      chords,
      ...(chords.length ? { beats } : {}),
      lyric: r.lyric,
      ...(r.section.trim() ? { section: r.section.trim() } : {}),
    }
  })
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
  const initN = parseBeatsPerBar(chart.time_signature)
  const [meta, setMeta] = useState<Meta>(() => ({
    time_signature: chart.time_signature || '4/4',
    key: chart.key || '',
    barsPerLine: chart.bars_per_line || 4,
  }))
  const [rows, setRows] = useState<EMeasure[]>(() => toEditable(chart, initN))
  const [selected, setSelected] = useState<number | null>(null)

  const beatsPerBar = parseBeatsPerBar(meta.time_signature)

  const commit = (nextRows: EMeasure[], nextMeta: Meta) => {
    setRows(nextRows)
    setMeta(nextMeta)
    onChange(toChart(nextRows, nextMeta))
  }
  const setRow = (idx: number, patch: Partial<EMeasure>) =>
    commit(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)), meta)
  const setSlot = (idx: number, beat: number, val: string) =>
    setRow(idx, { beatSlots: rows[idx].beatSlots.map((s, b) => (b === beat ? val : s)) })
  const del = (idx: number) => {
    commit(rows.filter((_, i) => i !== idx), meta)
    setSelected(null)
  }
  const insertAfter = (idx: number) => {
    const c = [...rows]
    c.splice(idx + 1, 0, { section: '', lyric: '', beatSlots: Array<string>(beatsPerBar).fill('') })
    commit(c, meta)
    setSelected(idx + 1)
  }
  const addEnd = () => {
    commit([...rows, { section: '', lyric: '', beatSlots: Array<string>(beatsPerBar).fill('') }], meta)
    setSelected(rows.length)
  }
  const changeTimeSig = (ts: string) => {
    const n = parseBeatsPerBar(ts)
    commit(
      rows.map((r) => ({ ...r, beatSlots: resize(r.beatSlots, n) })),
      { ...meta, time_signature: ts }
    )
  }

  const perLine = Math.max(1, meta.barsPerLine || 4)
  const rowChunks = chunk(
    rows.map((_, i) => i),
    perLine
  )

  return (
    <div>
      {/* 곡 메타 */}
      <div className="flex flex-wrap gap-3 mb-3 text-sm">
        <label className="flex items-center gap-1">
          박자표
          <input
            value={meta.time_signature}
            onChange={(e) => changeTimeSig(e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded w-16"
            style={S16}
          />
        </label>
        <label className="flex items-center gap-1">
          Key
          <input
            value={meta.key}
            onChange={(e) => commit(rows, { ...meta, key: e.target.value })}
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
            onChange={(e) =>
              commit(rows, { ...meta, barsPerLine: Math.max(1, Math.min(8, Number(e.target.value) || 4)) })
            }
            className="px-2 py-1 border border-gray-300 rounded w-14"
            style={S16}
          />
        </label>
      </div>

      <p className="text-xs text-gray-400 mb-2">※ 마디를 탭하면 박자별 코드·가사를 수정할 수 있어요.</p>

      {/* 그리드(탭 → 편집) */}
      <div className="space-y-4">
        {rowChunks.map((cells, r) => (
          <div key={r}>
            {/* 섹션 라벨 */}
            {cells.some((idx) => rows[idx].section) && (
              <div className="flex mb-0.5">
                {cells.map((idx) => (
                  <div key={idx} className="flex-1 min-w-0 px-1.5">
                    {rows[idx].section && (
                      <span
                        className="inline-block text-[11px] font-bold px-1.5 py-0.5 rounded text-white truncate max-w-full"
                        style={{ backgroundColor: sectionStyle(rows[idx].section).hex }}
                      >
                        {rows[idx].section}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* 코드 행 */}
            <div className="flex border-b-2 border-gray-500 border-r-2">
              {cells.map((idx) => (
                <button
                  key={idx}
                  onClick={() => setSelected(idx)}
                  className={`flex-1 min-w-0 border-l-2 border-gray-500 px-1.5 pb-1 min-h-[1.75rem] text-left hover:bg-indigo-50 ${
                    selected === idx ? 'bg-indigo-100' : ''
                  }`}
                >
                  <div className="relative w-full h-5">
                    {rows[idx].beatSlots.map((slot, b) =>
                      slot.trim() ? (
                        <span
                          key={b}
                          className="absolute bottom-0 text-sm font-bold text-gray-900 whitespace-nowrap"
                          style={{ left: `${(b / beatsPerBar) * 100}%` }}
                        >
                          {slot.trim()}
                        </span>
                      ) : null
                    )}
                  </div>
                </button>
              ))}
            </div>
            {/* 가사 행 */}
            <div className="flex">
              {cells.map((idx) => (
                <button
                  key={idx}
                  onClick={() => setSelected(idx)}
                  className={`flex-1 min-w-0 px-1.5 pt-1 text-[15px] leading-snug break-words text-left text-gray-700 hover:bg-indigo-50 ${
                    selected === idx ? 'bg-indigo-50' : ''
                  }`}
                >
                  {rows[idx].lyric || <span className="text-gray-300">·</span>}
                </button>
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

      {/* 마디 편집 모달 */}
      {selected != null && rows[selected] && (
        <MeasureModal
          index={selected}
          total={rows.length}
          beatsPerBar={beatsPerBar}
          row={rows[selected]}
          onSlot={(b, v) => setSlot(selected, b, v)}
          onField={(patch) => setRow(selected, patch)}
          onDelete={() => del(selected)}
          onInsert={() => insertAfter(selected)}
          onPrev={() => setSelected(Math.max(0, selected - 1))}
          onNext={() => setSelected(Math.min(rows.length - 1, selected + 1))}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

function MeasureModal({
  index,
  total,
  beatsPerBar,
  row,
  onSlot,
  onField,
  onDelete,
  onInsert,
  onPrev,
  onNext,
  onClose,
}: {
  index: number
  total: number
  beatsPerBar: number
  row: EMeasure
  onSlot: (beat: number, val: string) => void
  onField: (patch: Partial<EMeasure>) => void
  onDelete: () => void
  onInsert: () => void
  onPrev: () => void
  onNext: () => void
  onClose: () => void
}) {
  const inp = 'w-full px-2 py-2 border border-gray-300 rounded-lg'
  return (
    <div className="fixed inset-0 bg-black/40 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5"
        style={{ touchAction: 'manipulation' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1">
            <button onClick={onPrev} disabled={index === 0} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="font-bold text-gray-900">마디 {index + 1} / {total}</span>
            <button onClick={onNext} disabled={index === total - 1} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100" aria-label="닫기">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 박자별 코드 슬롯 */}
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 mb-1.5">박자별 코드 (비워두면 없음)</p>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(beatsPerBar, 4)}, minmax(0, 1fr))` }}>
            {row.beatSlots.map((slot, b) => (
              <label key={b} className="block">
                <span className="text-[11px] text-gray-400">{b + 1}박</span>
                <input
                  value={slot}
                  onChange={(e) => onSlot(b, e.target.value)}
                  placeholder="—"
                  className={`${inp} font-bold text-center`}
                  style={S16}
                />
              </label>
            ))}
          </div>
        </div>

        {/* 가사 */}
        <label className="block mb-3">
          <span className="text-xs font-medium text-gray-500">가사</span>
          <input value={row.lyric} onChange={(e) => onField({ lyric: e.target.value })} className={inp} style={S16} />
        </label>

        {/* 섹션 */}
        <label className="block mb-4">
          <span className="text-xs font-medium text-gray-500">섹션 (비우면 없음)</span>
          <input
            value={row.section}
            onChange={(e) => onField({ section: e.target.value })}
            placeholder="예: Verse 1, Chorus"
            className={inp}
            style={S16}
          />
        </label>

        <div className="flex items-center gap-2">
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" /> 마디 삭제
          </button>
          <button
            onClick={onInsert}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 text-gray-700"
          >
            <Plus className="w-4 h-4" /> 다음에 마디 추가
          </button>
        </div>
      </div>
    </div>
  )
}
