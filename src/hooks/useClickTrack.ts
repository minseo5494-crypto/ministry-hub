// src/hooks/useClickTrack.ts
//
// Web Audio 기반 클릭(메트로놈) 가이드 트랙 엔진.
// 선택된 송폼 섹션(라벨+마디)을 받아 look-ahead 스케줄러로 클릭을 재생하고,
// 섹션 진입 직전 음성 큐(영어 섹션명 + "one,two,three,four" 카운트인)를 낸다.
//
// - 시작 시 2마디 리드인: 1마디째 섹션명 announce, 2마디째 카운트, 그다음 섹션 진입.
// - play(startIndex)로 특정 섹션부터 시작 가능(타임라인 클릭 시크). 재생 중 호출 시 그 지점으로 점프.
// - iOS: AudioContext 는 재생(사용자 제스처) 시점에 생성/resume.

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
  voiceCue: boolean
  /** 음성 큐 언어 (기본 en-US) */
  lang?: string
  /** 한 박 세분: 1=4분음표, 2=8분음표(박 사이 서브 클릭) (기본 1) */
  subdivision?: number
  /** 강세 줄 박(1-based). 기본 [1] (첫 박만 강세) */
  accentBeats?: number[]
}

type ClickLevel = 'strong' | 'normal' | 'weak'

export interface ClickTrackState {
  isPlaying: boolean
  /** 시작 2마디 리드인(섹션명/카운트) 중 */
  inLead: boolean
  /** 현재 마디 내 박(1-based) */
  currentBeat: number
  /** 현재 섹션 인덱스(-1 = 리드인) */
  currentSectionIndex: number
  /** 현재 섹션 내 마디(1-based, 리드인 중 0) */
  barInSection: number
  totalBars: number
}

type BarKind = 'lead-name' | 'lead-count' | 'section'
interface BarPlan {
  kind: BarKind
  sectionIndex: number
  isSectionStart: boolean
  label: string
  barInSection: number // 1-based (section 만 유효)
}

const LOOKAHEAD_MS = 25
const SCHEDULE_AHEAD = 0.18
const SPEECH_LEAD = 0.12 // TTS 시작 지연 보정(초)

function parseBeatsPerBar(timeSignature: string | undefined, fallback = 4): number {
  if (!timeSignature) return fallback
  const num = parseInt(String(timeSignature).split('/')[0], 10)
  return Number.isFinite(num) && num > 0 && num <= 16 ? num : fallback
}

function speak(text: string, lang: string) {
  try {
    if (typeof window === 'undefined' || !window.speechSynthesis || !text) return
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang
    u.rate = 1.1
    u.volume = 1
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
  } catch {
    /* TTS 미지원 무시 */
  }
}

export function useClickTrack(options: UseClickTrackOptions) {
  const { bpm, beatsPerBar, sections, voiceCue, lang = 'en-US', subdivision = 1, accentBeats = [1] } = options

  const [state, setState] = useState<ClickTrackState>({
    isPlaying: false,
    inLead: false,
    currentBeat: 0,
    currentSectionIndex: -1,
    barInSection: 0,
    totalBars: 0,
  })

  const audioCtxRef = useRef<AudioContext | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const nextBeatIndexRef = useRef(0)
  const nextNoteTimeRef = useRef(0)
  const barPlanRef = useRef<BarPlan[]>([])
  const totalBeatsRef = useRef(0)

  // startIndex 섹션부터 시작하는 마디 계획(앞에 2마디 리드인 포함)
  const buildBarPlan = useCallback(
    (startIndex: number): BarPlan[] => {
      const start = Math.max(0, Math.min(startIndex, sections.length - 1))
      const startLabel = sections[start]?.label ?? ''
      const plan: BarPlan[] = [
        { kind: 'lead-name', sectionIndex: start, isSectionStart: false, label: startLabel, barInSection: 0 },
        { kind: 'lead-count', sectionIndex: start, isSectionStart: false, label: startLabel, barInSection: 0 },
      ]
      for (let s = start; s < sections.length; s++) {
        const bars = Math.max(0, Math.floor(sections[s].bars))
        for (let b = 0; b < bars; b++) {
          plan.push({
            kind: 'section',
            sectionIndex: s,
            isSectionStart: b === 0,
            label: sections[s].label,
            barInSection: b + 1,
          })
        }
      }
      return plan
    },
    [sections]
  )

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    try {
      window.speechSynthesis?.cancel()
    } catch {
      /* noop */
    }
  }, [])

  const stop = useCallback(() => {
    clearTimers()
    setState((s) => ({
      ...s,
      isPlaying: false,
      inLead: false,
      currentBeat: 0,
      currentSectionIndex: -1,
      barInSection: 0,
    }))
  }, [clearTimers])

  const scheduleClick = useCallback((time: number, level: ClickLevel) => {
    const ctx = audioCtxRef.current
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const freq = level === 'strong' ? 1600 : level === 'normal' ? 1000 : 800
    const peak = level === 'strong' ? 0.9 : level === 'normal' ? 0.5 : 0.22
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, time)
    gain.gain.exponentialRampToValueAtTime(peak, time + 0.001)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(time)
    osc.stop(time + 0.06)
  }, [])

  const scheduler = useCallback(() => {
    const ctx = audioCtxRef.current
    if (!ctx) return
    const secondsPerBeat = 60.0 / Math.max(1, bpm)
    const plan = barPlanRef.current
    const totalBeats = totalBeatsRef.current

    while (nextNoteTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD) {
      const beatIndex = nextBeatIndexRef.current
      if (beatIndex >= totalBeats) {
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
      const level: ClickLevel = accentBeats.includes(beatInBar + 1) ? 'strong' : 'normal'

      scheduleClick(noteTime, level)
      // 8분음표 세분: 박 사이(반 박)에 약한 서브 클릭
      if (subdivision >= 2) {
        scheduleClick(noteTime + secondsPerBeat / 2, 'weak')
      }

      // UI 상태 업데이트
      const uiDelay = Math.max(0, (noteTime - ctx.currentTime) * 1000)
      const snapshot = {
        inLead: bar.kind !== 'section',
        currentBeat: beatInBar + 1,
        currentSectionIndex: bar.kind === 'section' ? bar.sectionIndex : -1,
        barInSection: bar.kind === 'section' ? bar.barInSection : 0,
      }
      setTimeout(() => {
        setState((s) => (s.isPlaying ? { ...s, ...snapshot } : s))
      }, uiDelay)

      // 음성 큐 (SPEECH_LEAD 만큼 앞당겨 스케줄)
      if (voiceCue) {
        const speechDelay = Math.max(0, (noteTime - ctx.currentTime - SPEECH_LEAD) * 1000)
        if (bar.kind === 'lead-name') {
          // 리드인 1마디: 섹션명 (1박에)
          if (beatInBar === 0) {
            const name = sectionEnglishName(bar.label)
            setTimeout(() => speak(name, lang), speechDelay)
          }
        } else if (bar.kind === 'lead-count') {
          // 리드인 2마디: one, two, three, four
          setTimeout(() => speak(numberWord(beatInBar + 1), lang), speechDelay)
        } else {
          // 섹션 사이 전환: 다음 마디가 섹션 시작이면 이 마디에서 카운트,
          // 섹션명은 카운트 "one" 한 박 전(= 카운트 마디 직전 마디 마지막 박)에 announce
          const countBar = plan[barIndex + 1]
          if (countBar && countBar.kind === 'section' && countBar.isSectionStart) {
            setTimeout(() => speak(numberWord(beatInBar + 1), lang), speechDelay)
          }
          const sectionBar = plan[barIndex + 2]
          if (
            sectionBar &&
            sectionBar.kind === 'section' &&
            sectionBar.isSectionStart &&
            beatInBar === beatsPerBar - 1
          ) {
            const name = sectionEnglishName(sectionBar.label)
            if (name) setTimeout(() => speak(name, lang), speechDelay)
          }
        }
      }

      nextNoteTimeRef.current += secondsPerBeat
      nextBeatIndexRef.current += 1
    }
  }, [bpm, beatsPerBar, voiceCue, lang, subdivision, accentBeats, scheduleClick, stop])

  const play = useCallback(
    (startIndex = 0) => {
      // 재생 중이면 정지 후 재시작(시크)
      clearTimers()

      const plan = buildBarPlan(startIndex)
      if (plan.length <= 2) return // 리드인만 있고 섹션 없음
      barPlanRef.current = plan
      totalBeatsRef.current = plan.length * beatsPerBar

      if (!audioCtxRef.current) {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        audioCtxRef.current = new Ctor()
      }
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') ctx.resume()

      nextBeatIndexRef.current = 0
      nextNoteTimeRef.current = ctx.currentTime + 0.1

      setState({
        isPlaying: true,
        inLead: true,
        currentBeat: 0,
        currentSectionIndex: -1,
        barInSection: 0,
        totalBars: plan.filter((b) => b.kind === 'section').length,
      })

      timerRef.current = setInterval(scheduler, LOOKAHEAD_MS)
    },
    [buildBarPlan, beatsPerBar, clearTimers, scheduler]
  )

  useEffect(() => {
    return () => {
      clearTimers()
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {})
      }
    }
  }, [clearTimers])

  return { state, play, stop }
}

export { parseBeatsPerBar }
