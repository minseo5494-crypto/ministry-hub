'use client'

// src/components/GuideTrackModal.tsx
//
// 클릭(가이드) 트랙 모달. 선택된 송폼(섹션 배열)을 가로 색상 타임라인으로 보여주고,
// BPM·박자표에 맞춰 클릭 메트로놈을 재생한다. 섹션 진입 시 음성 큐, 재생 중 플레이헤드 이동.
//
// 섹션별 "마디 수"는 사용자가 편집한다. (후속: 코드악보 변환[기능1] 결과로 자동 채움 — 연동 지점)
// MVP: 앱 내 재생 + TTS 음성 큐. WAV 내보내기는 후속.

import { useMemo, useState } from 'react'
import { X, Play, Square, Volume2, VolumeX } from 'lucide-react'
import { useClickTrack, parseBeatsPerBar, GuideSection } from '@/hooks/useClickTrack'
import { sectionStyle, defaultBarsFor } from '@/lib/songSection'

interface GuideTrackSong {
  song_name?: string
  bpm?: number
  time_signature?: string
}

interface GuideTrackModalProps {
  isOpen: boolean
  onClose: () => void
  song: GuideTrackSong
  /** 선택된 송폼(섹션 약어 배열). 예: ["I","V1","Pc","C","B"] */
  form: string[]
}

const TIME_SIGNATURES = ['4/4', '3/4', '6/8', '2/4', '12/8']

function sectionsFromForm(form: string[]): GuideSection[] {
  return form.map((abbr) => ({ label: abbr, bars: defaultBarsFor(abbr) }))
}

export default function GuideTrackModal({ isOpen, onClose, song, form }: GuideTrackModalProps) {
  const [bpm, setBpm] = useState<number>(song.bpm && song.bpm > 0 ? song.bpm : 90)
  const [timeSignature, setTimeSignature] = useState<string>(song.time_signature || '4/4')
  const [sections, setSections] = useState<GuideSection[]>(() => sectionsFromForm(form))
  const [countInBars, setCountInBars] = useState<number>(1)
  const [voiceCue, setVoiceCue] = useState<boolean>(true)

  const beatsPerBar = useMemo(() => parseBeatsPerBar(timeSignature), [timeSignature])
  const totalBars = useMemo(
    () => sections.reduce((sum, s) => sum + Math.max(0, Math.floor(s.bars)), 0),
    [sections]
  )

  const { state, play, stop } = useClickTrack({
    bpm,
    beatsPerBar,
    sections,
    countInBars,
    voiceCue,
  })

  if (!isOpen) return null

  const disabled = state.isPlaying
  const currentSection = state.currentSectionIndex >= 0 ? sections[state.currentSectionIndex] : null

  const updateBars = (idx: number, bars: number) =>
    setSections((prev) => prev.map((s, i) => (i === idx ? { ...s, bars: Math.max(1, bars) } : s)))

  // 재생 진행률(마디 기준, 카운트인 제외)
  const playedBars =
    state.isPlaying && !state.inCountIn
      ? state.currentBar - countInBars - 1 + (state.currentBeat - 1) / beatsPerBar
      : 0
  const progressPct = totalBars > 0 ? Math.min(100, Math.max(0, (playedBars / totalBars) * 100)) : 0

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={() => {
        stop()
        onClose()
      }}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        style={{ touchAction: 'manipulation' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b px-5 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-gray-900">🎵 클릭 가이드 트랙</h3>
            {song.song_name && (
              <p className="text-sm text-gray-500 truncate max-w-[24rem]">{song.song_name}</p>
            )}
          </div>
          <button
            onClick={() => {
              stop()
              onClose()
            }}
            className="p-2 rounded-lg hover:bg-gray-100"
            style={{ minWidth: 44, minHeight: 44 }}
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* 가로 타임라인 (송폼 색상 블록 + 플레이헤드) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-semibold text-gray-700">송폼 타임라인</span>
              <span className="text-xs text-gray-400">
                {state.isPlaying
                  ? state.inCountIn
                    ? '카운트인…'
                    : `${currentSection?.label ?? ''} · ${Math.max(1, state.currentBar - countInBars)}/${totalBars}마디`
                  : `총 ${totalBars}마디`}
              </span>
            </div>
            <div className="relative w-full h-16 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex">
              {sections.map((sec, idx) => {
                const style = sectionStyle(sec.label)
                const widthPct = totalBars > 0 ? (Math.max(1, sec.bars) / totalBars) * 100 : 0
                const active = state.isPlaying && state.currentSectionIndex === idx
                return (
                  <div
                    key={idx}
                    className="relative h-full flex flex-col items-center justify-center overflow-hidden border-r border-white/40 last:border-r-0"
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: style.hex,
                      opacity: active ? 1 : 0.82,
                      boxShadow: active ? 'inset 0 0 0 2px rgba(255,255,255,0.9)' : 'none',
                    }}
                    title={`${sec.label} · ${sec.bars}마디`}
                  >
                    <span className="text-white text-xs font-bold drop-shadow truncate px-1 max-w-full">
                      {sec.label}
                    </span>
                    <span className="text-white/80 text-[10px] leading-none">{sec.bars}</span>
                  </div>
                )
              })}
              {/* 플레이헤드 */}
              {state.isPlaying && !state.inCountIn && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_4px_rgba(0,0,0,0.6)] pointer-events-none transition-[left] duration-75"
                  style={{ left: `${progressPct}%` }}
                />
              )}
            </div>
          </div>

          {/* 박 표시 */}
          {state.isPlaying && (
            <div className="flex items-center justify-center gap-2">
              {Array.from({ length: beatsPerBar }).map((_, i) => (
                <span
                  key={i}
                  className={`w-3 h-3 rounded-full transition-colors ${
                    state.currentBeat === i + 1
                      ? i === 0
                        ? 'bg-red-500'
                        : 'bg-green-500'
                      : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          )}

          {/* 재생/정지 */}
          <button
            onClick={() => (state.isPlaying ? stop() : play())}
            disabled={totalBars === 0}
            className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-white transition ${
              state.isPlaying ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-700'
            } disabled:bg-gray-300`}
            style={{ minHeight: 44 }}
          >
            {state.isPlaying ? (
              <>
                <Square className="w-5 h-5" /> 정지
              </>
            ) : (
              <>
                <Play className="w-5 h-5" /> 재생
              </>
            )}
          </button>

          {/* 기본 설정 */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-600">BPM</span>
              <input
                type="number"
                inputMode="numeric"
                min={20}
                max={300}
                value={bpm}
                disabled={disabled}
                onChange={(e) => setBpm(Math.max(20, Math.min(300, Number(e.target.value) || 0)))}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                style={{ fontSize: 16 }}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">박자표</span>
              <select
                value={timeSignature}
                disabled={disabled}
                onChange={(e) => setTimeSignature(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                style={{ fontSize: 16 }}
              >
                {TIME_SIGNATURES.map((ts) => (
                  <option key={ts} value={ts}>
                    {ts}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">카운트인 (마디)</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={4}
                value={countInBars}
                disabled={disabled}
                onChange={(e) => setCountInBars(Math.max(0, Math.min(4, Number(e.target.value) || 0)))}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                style={{ fontSize: 16 }}
              />
            </label>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setVoiceCue((v) => !v)}
              className={`mt-5 flex items-center justify-center gap-2 py-2 rounded-lg border transition ${
                voiceCue
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                  : 'bg-gray-50 border-gray-300 text-gray-500'
              } disabled:opacity-50`}
              style={{ minHeight: 44 }}
            >
              {voiceCue ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              음성 큐 {voiceCue ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* 섹션별 마디 수 편집 (송폼 순서) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">섹션별 마디 수</span>
              <span className="text-xs text-gray-400">송폼: {form.join('-')}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {sections.map((sec, idx) => {
                const style = sectionStyle(sec.label)
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-lg border border-gray-200"
                  >
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${style.chip}`}>
                      {sec.label}
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={64}
                      value={sec.bars}
                      disabled={disabled}
                      onChange={(e) => updateBars(idx, Number(e.target.value) || 1)}
                      className="w-12 px-1.5 py-1 border border-gray-300 rounded text-center disabled:bg-gray-100"
                      style={{ fontSize: 16 }}
                      aria-label={`${sec.label} 마디 수`}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          <p className="text-xs text-gray-400 leading-relaxed">
            ※ BPM·박자표는 곡 정보에서 자동으로 채워집니다. 섹션별 마디 수는 나중에 코드악보 변환
            기능과 연동되어 자동으로 채워질 예정입니다. (모바일은 재생 버튼을 눌러야 소리가 시작됩니다.)
          </p>
        </div>
      </div>
    </div>
  )
}
