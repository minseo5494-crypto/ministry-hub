// src/hooks/useClickTrack.ts
//
// Web Audio 기반 클릭(메트로놈) 가이드 트랙 엔진.
// BPM·박자표·섹션(수동 입력)·카운트인을 받아 look-ahead 스케줄러로 정확히 클릭을 재생하고,
// 섹션 진입 직전 음성 큐(브라우저 TTS)를 낸다. 현재 마디/박/섹션 상태를 노출한다.
//
// 외부 라이브러리 없음. iOS 대응: AudioContext 는 재생(사용자 제스처) 시점에 생성/resume.

import { useCallback, useEffect, useRef, useState } from 'react'
import { sectionEnglishName } from '@/lib/songSection'

const NUM_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven',
  'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
]
function numberWord(n: number): string {
  return NUM_WORDS[n] || String(n)
}

export interface GuideSection {
  label: string
  bars: number
}

export interface UseClickTrackOptions {
  bpm: number
  beatsPerBar: number
  sections: GuideSection[]
  countInBars: number
  voiceCue: boolean
  /** 음성 큐 언어 (기본 ko) */
  lang?: string
}

export interface ClickTrackState {
  isPlaying: boolean
  /** 카운트인 포함 전체 진행 마디(1-based). 0 = 정지 */
  currentBar: number
  /** 현재 마디 내 박(1-based) */
  currentBeat: number
  /** 카운트인 중 여부 */
  inCountIn: boolean
  /** 현재 섹션 인덱스(-1 = 카운트인/없음) */
  currentSectionIndex: number
  totalBars: number
}

// 한 마디의 스케줄 정보
interface BarPlan {
  sectionIndex: number // -1 = 카운트인
  isSectionStart: boolean
  label: string // 섹션 라벨(섹션 시작 마디에만 의미)
  inCountIn: boolean
}

const LOOKAHEAD_MS = 25 // 스케줄러 폴링 간격
const SCHEDULE_AHEAD = 0.18 // 미리 스케줄할 시간(초)
const SPEECH_LEAD = 0.12 // TTS 시작 지연 보정(초) — 음성 큐를 살짝 앞당김

function parseBeatsPerBar(timeSignature: string | undefined, fallback = 4): number {
  if (!timeSignature) return fallback
  const num = parseInt(String(timeSignature).split('/')[0], 10)
  return Number.isFinite(num) && num > 0 && num <= 16 ? num : fallback
}

function speak(text: string, lang: string) {
  try {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang
    u.rate = 1.05
    u.volume = 1
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
  } catch {
    /* TTS 미지원 무시 */
  }
}

export function useClickTrack(options: UseClickTrackOptions) {
  const { bpm, beatsPerBar, sections, countInBars, voiceCue, lang = 'en-US' } = options

  const [state, setState] = useState<ClickTrackState>({
    isPlaying: false,
    currentBar: 0,
    currentBeat: 0,
    inCountIn: false,
    currentSectionIndex: -1,
    totalBars: 0,
  })

  const audioCtxRef = useRef<AudioContext | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // 다음에 스케줄할 전역 박 인덱스(카운트인 포함, 0-based)
  const nextBeatIndexRef = useRef(0)
  // 다음 박의 audioCtx 시각
  const nextNoteTimeRef = useRef(0)
  // 전체 마디 계획
  const barPlanRef = useRef<BarPlan[]>([])
  const totalBeatsRef = useRef(0)

  // 전체 마디 계획 구성
  const buildBarPlan = useCallback((): BarPlan[] => {
    const plan: BarPlan[] = []
    for (let i = 0; i < countInBars; i++) {
      plan.push({ sectionIndex: -1, isSectionStart: false, label: '', inCountIn: true })
    }
    sections.forEach((sec, sIdx) => {
      const bars = Math.max(0, Math.floor(sec.bars))
      for (let b = 0; b < bars; b++) {
        plan.push({
          sectionIndex: sIdx,
          isSectionStart: b === 0,
          label: sec.label,
          inCountIn: false,
        })
      }
    })
    return plan
  }, [sections, countInBars])

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    try {
      window.speechSynthesis?.cancel()
    } catch {
      /* noop */
    }
    setState((s) => ({
      ...s,
      isPlaying: false,
      currentBar: 0,
      currentBeat: 0,
      inCountIn: false,
      currentSectionIndex: -1,
    }))
  }, [])

  // 클릭음 스케줄 (강박/약박)
  const scheduleClick = useCallback((time: number, accent: boolean) => {
    const ctx = audioCtxRef.current
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = accent ? 1600 : 1000
    gain.gain.setValueAtTime(0.0001, time)
    gain.gain.exponentialRampToValueAtTime(accent ? 0.9 : 0.5, time + 0.001)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(time)
    osc.stop(time + 0.06)
  }, [])

  // look-ahead 스케줄러 tick
  const scheduler = useCallback(() => {
    const ctx = audioCtxRef.current
    if (!ctx) return
    const secondsPerBeat = 60.0 / Math.max(1, bpm)
    const plan = barPlanRef.current
    const totalBeats = totalBeatsRef.current

    while (nextNoteTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD) {
      const beatIndex = nextBeatIndexRef.current
      if (beatIndex >= totalBeats) {
        // 종료 예약
        const endTime = nextNoteTimeRef.current
        const delay = Math.max(0, (endTime - ctx.currentTime) * 1000)
        setTimeout(() => stop(), delay + 150)
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
        return
      }

      const barIndex = Math.floor(beatIndex / beatsPerBar)
      const beatInBar = beatIndex % beatsPerBar
      const bar = plan[barIndex]
      const noteTime = nextNoteTimeRef.current
      const accent = beatInBar === 0

      scheduleClick(noteTime, accent)

      // UI 상태 업데이트를 노트 시각에 맞춰 예약
      const uiDelay = Math.max(0, (noteTime - ctx.currentTime) * 1000)
      const snapshot = {
        currentBar: barIndex + 1,
        currentBeat: beatInBar + 1,
        inCountIn: bar?.inCountIn ?? false,
        currentSectionIndex: bar?.sectionIndex ?? -1,
      }
      setTimeout(() => {
        setState((s) => (s.isPlaying ? { ...s, ...snapshot } : s))
      }, uiDelay)

      // 음성 큐 (TTS 지연 보정 위해 SPEECH_LEAD 만큼 앞당겨 스케줄)
      if (voiceCue) {
        const speechDelay = Math.max(0, (noteTime - ctx.currentTime - SPEECH_LEAD) * 1000)

        // (1) 카운트인: 다음 마디가 섹션 시작이면 이 마디에서 one, two, three, four
        const countBar = plan[barIndex + 1]
        if (countBar && countBar.isSectionStart) {
          const word = numberWord(beatInBar + 1)
          setTimeout(() => speak(word, lang), speechDelay)
        }

        // (2) 섹션명: 카운트 "one"보다 한 박 먼저(= 카운트 마디 직전 마디의 마지막 박)에 announce
        const sectionBar = plan[barIndex + 2]
        if (sectionBar && sectionBar.isSectionStart && beatInBar === beatsPerBar - 1) {
          const name = sectionEnglishName(sectionBar.label)
          if (name) setTimeout(() => speak(name, lang), speechDelay)
        }
      }

      nextNoteTimeRef.current += secondsPerBeat
      nextBeatIndexRef.current += 1
    }
  }, [bpm, beatsPerBar, voiceCue, lang, scheduleClick, stop])

  const play = useCallback(() => {
    // 이미 재생 중이면 무시
    if (timerRef.current) return

    const plan = buildBarPlan()
    if (plan.length === 0) return
    barPlanRef.current = plan
    totalBeatsRef.current = plan.length * beatsPerBar

    // AudioContext 생성/resume (사용자 제스처 컨텍스트)
    if (!audioCtxRef.current) {
      const Ctor =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      audioCtxRef.current = new Ctor()
    }
    const ctx = audioCtxRef.current
    if (ctx.state === 'suspended') ctx.resume()

    // 첫 발화 준비(iOS: 제스처 내 speechSynthesis 활성화)
    if (voiceCue) {
      try {
        window.speechSynthesis?.cancel()
      } catch {
        /* noop */
      }
    }

    nextBeatIndexRef.current = 0
    nextNoteTimeRef.current = ctx.currentTime + 0.1

    setState({
      isPlaying: true,
      currentBar: 0,
      currentBeat: 0,
      inCountIn: countInBars > 0,
      currentSectionIndex: -1,
      totalBars: plan.length,
    })

    timerRef.current = setInterval(scheduler, LOOKAHEAD_MS)
  }, [buildBarPlan, beatsPerBar, countInBars, voiceCue, scheduler])

  // 언마운트 정리
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      try {
        window.speechSynthesis?.cancel()
      } catch {
        /* noop */
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {})
      }
    }
  }, [])

  return { state, play, stop }
}

export { parseBeatsPerBar }
