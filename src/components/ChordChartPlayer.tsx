'use client'

// src/components/ChordChartPlayer.tsx
//
// 연주 모드: 코드악보를 보여주며 송폼(진행)대로 클릭을 재생하고,
// 현재 연주 중인 마디를 실시간 하이라이트한다. (섹션 전환 시 영어 음성 카운트인)

import { useMemo, useState } from 'react'
import { Play, Square, Volume2, VolumeX } from 'lucide-react'
import type { ChordChart } from '@/types/chordChart'
import { useClickTrack, parseBeatsPerBar } from '@/hooks/useClickTrack'
import { buildPlayPlan, globalBarIndex } from '@/lib/chordChartSections'
import ChordChartView from '@/components/ChordChartView'

interface ChordChartPlayerProps {
  chart: ChordChart
  form: string[]
  bpm?: number
  timeSignature?: string
}

export default function ChordChartPlayer({ chart, form, bpm: bpmProp, timeSignature }: ChordChartPlayerProps) {
  const [bpm, setBpm] = useState<number>(bpmProp && bpmProp > 0 ? bpmProp : 90)
  const [voiceCue, setVoiceCue] = useState(true)

  const beatsPerBar = useMemo(
    () => parseBeatsPerBar(timeSignature || chart.time_signature),
    [timeSignature, chart.time_signature]
  )
  const plan = useMemo(() => buildPlayPlan(form, chart), [form, chart])

  const { state, play, stop } = useClickTrack({ bpm, beatsPerBar, sections: plan.sections, voiceCue })

  // 현재 재생 마디 → 코드악보 마디 인덱스
  const gbar =
    state.isPlaying && !state.inLead
      ? globalBarIndex(plan.sections, state.currentSectionIndex, state.barInSection)
      : -1
  const highlightPos =
    gbar >= 0 && gbar < plan.measureSequence.length ? plan.measureSequence[gbar] : -1

  const disabled = state.isPlaying
  const arrangement = form && form.length > 0 ? form.join('-') : '(송폼 없음 · 전체 재생)'

  return (
    <div>
      {/* 컨트롤 바 */}
      <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-gray-50 rounded-xl">
        <button
          onClick={() => (state.isPlaying ? stop() : play(0))}
          disabled={plan.sections.length === 0}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-white ${
            state.isPlaying ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-700'
          } disabled:bg-gray-300`}
          style={{ minHeight: 44 }}
        >
          {state.isPlaying ? (
            <>
              <Square className="w-4 h-4" /> 정지
            </>
          ) : (
            <>
              <Play className="w-4 h-4" /> 재생
            </>
          )}
        </button>

        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          BPM
          <input
            type="number"
            inputMode="numeric"
            min={20}
            max={300}
            value={bpm}
            disabled={disabled}
            onChange={(e) => setBpm(Math.max(20, Math.min(300, Number(e.target.value) || 0)))}
            className="w-16 px-2 py-1 border border-gray-300 rounded disabled:bg-gray-100"
            style={{ fontSize: 16 }}
          />
        </label>

        <button
          type="button"
          disabled={disabled}
          onClick={() => setVoiceCue((v) => !v)}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm ${
            voiceCue ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-gray-300 text-gray-500'
          } disabled:opacity-50`}
        >
          {voiceCue ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          음성 카운트인
        </button>

        {/* 상태 */}
        <div className="ml-auto text-sm text-gray-500 tabular-nums">
          {state.isPlaying ? (
            state.inLead ? (
              '카운트인…'
            ) : (
              <span className="text-gray-700 font-medium">
                {form[state.currentSectionIndex] ?? ''} · {beatDots(beatsPerBar, state.currentBeat)}
              </span>
            )
          ) : (
            <span className="truncate max-w-[16rem] inline-block align-bottom">{arrangement}</span>
          )}
        </div>
      </div>

      {!plan.hasHighlight && form.length > 0 && (
        <p className="text-xs text-amber-600 mb-2">
          ※ 이 코드악보엔 인쇄 섹션이 없어 하이라이트가 제한됩니다(클릭은 송폼대로 재생).
        </p>
      )}

      {/* 코드악보 + 하이라이트 */}
      <ChordChartView chart={chart} highlightPos={highlightPos >= 0 ? highlightPos : undefined} />
    </div>
  )
}

// 박 표시 텍스트 (● ○ ○ ○)
function beatDots(beats: number, current: number): string {
  return Array.from({ length: beats })
    .map((_, i) => (i + 1 === current ? '●' : '○'))
    .join(' ')
}
