// src/lib/chordChartSections.ts
//
// 코드악보(ChordChart) + 송폼(진행 순서) → 클릭 섹션 + 마디 재생 시퀀스.
// - 클릭 섹션: useClickTrack 이 쓰는 {label, bars}[] (송폼 순서, 실제 마디 수)
// - measureSequence: 재생 순서대로의 "코드악보 마디 배열 인덱스"(하이라이트용, -1=매칭없음)

import type { ChordChart } from '@/types/chordChart'
import type { GuideSection } from '@/hooks/useClickTrack'
import { sectionFamily, defaultBarsFor } from '@/lib/songSection'

// 인쇄 섹션(carry-forward) 기준으로 계열 → 코드악보 마디 배열 인덱스들
export function measuresByFamily(chart: ChordChart): Map<string, number[]> {
  const map = new Map<string, number[]>()
  let carry = ''
  chart.measures.forEach((m, i) => {
    if (m.section) carry = m.section
    if (!carry) return
    const fam = sectionFamily(carry)
    if (!map.has(fam)) map.set(fam, [])
    map.get(fam)!.push(i)
  })
  return map
}

export interface PlayPlan {
  sections: GuideSection[]
  /** 재생 순서(카운트인 제외) 각 마디에 대응하는 코드악보 마디 인덱스. -1 = 하이라이트 없음 */
  measureSequence: number[]
  /** 하이라이트 가능한 마디가 하나라도 있는지 */
  hasHighlight: boolean
}

// 송폼 배열이 있으면 그 진행대로, 없으면 코드악보 전체를 선형 재생.
export function buildPlayPlan(form: string[] | undefined, chart: ChordChart | null): PlayPlan {
  const measures = chart?.measures || []
  const famMap = chart ? measuresByFamily(chart) : new Map<string, number[]>()

  // 송폼이 있고, 코드악보에 인쇄 섹션이 있어 매칭 가능하면 → 송폼 진행대로
  if (form && form.length > 0 && famMap.size > 0) {
    const sections: GuideSection[] = []
    const measureSequence: number[] = []
    let matched = false
    for (const abbr of form) {
      const idxs = famMap.get(sectionFamily(abbr))
      if (idxs && idxs.length > 0) {
        sections.push({ label: abbr, bars: idxs.length })
        measureSequence.push(...idxs)
        matched = true
      } else {
        const bars = defaultBarsFor(abbr)
        sections.push({ label: abbr, bars })
        for (let k = 0; k < bars; k++) measureSequence.push(-1)
      }
    }
    if (matched) return { sections, measureSequence, hasHighlight: true }
  }

  // 폴백: 코드악보 전체를 선형 재생(인쇄 섹션이 있으면 섹션 라벨로 묶고, 없으면 통짜)
  if (measures.length > 0) {
    // 인쇄 섹션 그룹으로 섹션 구성(라벨/카운트), measureSequence 는 0..N-1
    const sections: GuideSection[] = []
    let carry = ''
    let curLabel = '·'
    let curBars = 0
    const flush = () => {
      if (curBars > 0) sections.push({ label: curLabel, bars: curBars })
    }
    measures.forEach((m) => {
      if (m.section) {
        flush()
        carry = m.section
        curLabel = carry
        curBars = 1
      } else {
        if (curBars === 0) curLabel = carry || '·'
        curBars++
      }
    })
    flush()
    if (sections.length === 0) sections.push({ label: '·', bars: measures.length })
    return {
      sections,
      measureSequence: measures.map((_, i) => i),
      hasHighlight: true,
    }
  }

  // 코드악보 없음 → 송폼 기본 마디로 클릭만(하이라이트 없음)
  if (form && form.length > 0) {
    return {
      sections: form.map((abbr) => ({ label: abbr, bars: defaultBarsFor(abbr) })),
      measureSequence: form.flatMap((abbr) => Array(defaultBarsFor(abbr)).fill(-1)),
      hasHighlight: false,
    }
  }

  return { sections: [], measureSequence: [], hasHighlight: false }
}

// 클릭 현재 위치(섹션 index, 섹션 내 마디) → measureSequence 전역 인덱스
export function globalBarIndex(sections: GuideSection[], sectionIndex: number, barInSection: number): number {
  if (sectionIndex < 0) return -1
  let acc = 0
  for (let i = 0; i < sectionIndex && i < sections.length; i++) acc += Math.max(0, Math.floor(sections[i].bars))
  return acc + Math.max(0, barInSection - 1)
}
