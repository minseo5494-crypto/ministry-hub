'use client'

// src/components/GuideTrackModal.tsx
//
// 클릭(가이드) 트랙 모달. 곡의 BPM·박자표를 받아 클릭 메트로놈을 재생하고,
// 섹션(수동 입력) 진입 시 음성 큐를 낸다. 현재 마디/섹션을 표시한다.
// (MVP: 앱 내 재생 + TTS 음성 큐. WAV 내보내기는 후속.)

import { useMemo, useState } from 'react'
import { X, Play, Square, Plus, Trash2, ChevronUp, ChevronDown, Volume2, VolumeX } from 'lucide-react'
import { useClickTrack, parseBeatsPerBar, GuideSection } from '@/hooks/useClickTrack'

interface GuideTrackSong {
  song_name?: string
  bpm?: number
  time_signature?: string
  song_structure?: { [key: string]: string }
}

interface GuideTrackModalProps {
  isOpen: boolean
  onClose: () => void
  song: GuideTrackSong
}

const TIME_SIGNATURES = ['4/4', '3/4', '6/8', '2/4', '12/8']
const PRESET_SECTIONS = ['인트로', '벌스', '프리코러스', '코러스', '브릿지', '간주', '아웃트로']

function initialSections(song: GuideTrackSong): GuideSection[] {
  const keys = song.song_structure ? Object.keys(song.song_structure) : []
  if (keys.length > 0) {
    return keys.map((k) => ({ label: k, bars: 8 }))
  }
  return [{ label: '벌스', bars: 8 }]
}

export default function GuideTrackModal({ isOpen, onClose, song }: GuideTrackModalProps) {
  const [bpm, setBpm] = useState<number>(song.bpm && song.bpm > 0 ? song.bpm : 90)
  const [timeSignature, setTimeSignature] = useState<string>(song.time_signature || '4/4')
  const [sections, setSections] = useState<GuideSection[]>(() => initialSections(song))
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

  // 재생 중 설정 변경 방지용
  const disabled = state.isPlaying

  const updateSection = (idx: number, patch: Partial<GuideSection>) => {
    setSections((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  }
  const removeSection = (idx: number) => setSections((prev) => prev.filter((_, i) => i !== idx))
  const addSection = (label = '') =>
    setSections((prev) => [...prev, { label: label || '섹션', bars: 8 }])
  const moveSection = (idx: number, dir: -1 | 1) => {
    setSections((prev) => {
      const next = [...prev]
      const j = idx + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[idx], next[j]] = [next[j], next[idx]]
      return next
    })
  }

  const currentSection =
    state.currentSectionIndex >= 0 ? sections[state.currentSectionIndex] : null

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={() => {
        stop()
        onClose()
      }}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        style={{ touchAction: 'manipulation' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b px-5 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h3 className="text-lg font-bold text-gray-900">🎵 클릭 가이드 트랙</h3>
            {song.song_name && (
              <p className="text-sm text-gray-500 truncate max-w-[20rem]">{song.song_name}</p>
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
          {/* 재생 상태 표시 */}
          <div className="rounded-xl bg-gray-900 text-white p-4 text-center">
            {state.isPlaying ? (
              <>
                <div className="text-xs text-gray-400 mb-1">
                  {state.inCountIn ? '카운트인' : currentSection?.label || '재생 중'}
                </div>
                <div className="text-3xl font-bold tabular-nums">
                  {state.inCountIn ? '·' : `${state.currentBar - countInBars} / ${totalBars}`}
                  <span className="text-base text-gray-400"> 마디</span>
                </div>
                {/* 박 표시 */}
                <div className="flex items-center justify-center gap-2 mt-3">
                  {Array.from({ length: beatsPerBar }).map((_, i) => (
                    <span
                      key={i}
                      className={`w-3 h-3 rounded-full transition-colors ${
                        state.currentBeat === i + 1
                          ? i === 0
                            ? 'bg-red-400'
                            : 'bg-green-400'
                          : 'bg-gray-600'
                      }`}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-300 py-2">
                {bpm} BPM · {timeSignature} · 총 {totalBars}마디
              </div>
            )}
          </div>

          {/* 재생/정지 버튼 */}
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
                voiceCue ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-gray-50 border-gray-300 text-gray-500'
              } disabled:opacity-50`}
              style={{ minHeight: 44 }}
            >
              {voiceCue ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              음성 큐 {voiceCue ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* 섹션 편집 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">섹션 구성</span>
              <span className="text-xs text-gray-400">총 {totalBars}마디</span>
            </div>

            <div className="space-y-2">
              {sections.map((sec, idx) => {
                const active = state.isPlaying && state.currentSectionIndex === idx
                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 p-2 rounded-lg border ${
                      active ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200'
                    }`}
                  >
                    <input
                      type="text"
                      value={sec.label}
                      disabled={disabled}
                      onChange={(e) => updateSection(idx, { label: e.target.value })}
                      placeholder="섹션 이름"
                      className="flex-1 min-w-0 px-2 py-1.5 border border-gray-300 rounded disabled:bg-gray-100"
                      style={{ fontSize: 16 }}
                    />
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={64}
                      value={sec.bars}
                      disabled={disabled}
                      onChange={(e) => updateSection(idx, { bars: Math.max(1, Number(e.target.value) || 1) })}
                      className="w-16 px-2 py-1.5 border border-gray-300 rounded text-center disabled:bg-gray-100"
                      style={{ fontSize: 16 }}
                      aria-label="마디 수"
                    />
                    <span className="text-xs text-gray-400">마디</span>
                    <div className="flex flex-col">
                      <button
                        onClick={() => moveSection(idx, -1)}
                        disabled={disabled || idx === 0}
                        className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                        aria-label="위로"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => moveSection(idx, 1)}
                        disabled={disabled || idx === sections.length - 1}
                        className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                        aria-label="아래로"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                    <button
                      onClick={() => removeSection(idx)}
                      disabled={disabled}
                      className="p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-30"
                      aria-label="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              })}
            </div>

            {/* 프리셋 빠른 추가 */}
            {!disabled && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {PRESET_SECTIONS.map((label) => (
                  <button
                    key={label}
                    onClick={() => addSection(label)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full bg-gray-100 hover:bg-indigo-100 text-gray-600 hover:text-indigo-700"
                  >
                    <Plus className="w-3 h-3" />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <p className="text-xs text-gray-400 leading-relaxed">
            ※ BPM·박자표는 곡 정보에서 자동으로 채워집니다. 섹션별 마디 수를 입력하면 해당 지점에서
            음성으로 안내합니다. (모바일은 재생 버튼을 눌러야 소리가 시작됩니다.)
          </p>
        </div>
      </div>
    </div>
  )
}
