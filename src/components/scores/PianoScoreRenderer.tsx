'use client'

import React from 'react'
import { PianoScoreElement, PianoNote, PianoChord } from './types'

// 음높이별 Y 위치 (렌더링용)
const PITCH_TO_Y: { [key: string]: number } = {
  'A5': 12, 'G5': 17, 'F5': 22, 'E5': 27, 'D5': 32,
  'C5': 37, 'B4': 42, 'A4': 47, 'G4': 52, 'F4': 57,
  'E4': 62, 'D4': 67, 'C4': 72, 'B3': 77, 'A3': 82
}

const PITCH_ORDER = ['A5', 'G5', 'F5', 'E5', 'D5', 'C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4', 'B3', 'A3']

interface PianoScoreRendererProps {
  score: PianoScoreElement
  scaleFactor: number
  isSelected: boolean
  isViewMode: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
  onDragStart: () => void
  onResizeStart: (startX: number, startScale: number) => void
  onTouchMove: (e: React.TouchEvent) => void
  onTouchEnd: () => void
  lastTapTimeRef: React.MutableRefObject<number>
}

export default function PianoScoreRenderer({
  score,
  scaleFactor,
  isSelected,
  isViewMode,
  onSelect,
  onEdit,
  onDelete,
  onDragStart,
  onResizeStart,
  onTouchMove,
  onTouchEnd,
  lastTapTimeRef,
}: PianoScoreRendererProps) {
  const defaultWidth = score.measureCount === 1 ? 100 : 70
  const measureWidths = score.measureWidths || Array(score.measureCount).fill(defaultWidth)
  const scoreWidth = measureWidths.reduce((sum, w) => sum + w * 0.7, 0)
  const scoreHeight = 80

  return (
    <div
      className={`absolute select-none rounded bg-white/90 ${
        isSelected && !isViewMode
          ? 'ring-2 ring-blue-500 cursor-move'
          : 'cursor-pointer'
      }`}
      style={{
        left: `${score.x}%`,
        top: `${score.y}%`,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'auto',
        touchAction: 'none',
        padding: '4px',
        boxShadow: isSelected && !isViewMode ? '0 4px 12px rgba(59,130,246,0.3)' : '0 2px 8px rgba(0,0,0,0.15)',
      }}
      onMouseDown={(e) => {
        e.stopPropagation()
        if (!isViewMode && isSelected) {
          onDragStart()
        }
      }}
      onClick={(e) => {
        e.stopPropagation()
        if (!isViewMode) {
          onSelect()
        }
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        if (!isViewMode) {
          onEdit()
        }
      }}
      onTouchStart={(e) => {
        e.stopPropagation()
        if (!isViewMode) {
          e.preventDefault()
          const now = Date.now()
          const timeSinceLastTap = now - lastTapTimeRef.current
          lastTapTimeRef.current = now

          if (timeSinceLastTap < 300 && isSelected) {
            onEdit()
          } else if (isSelected) {
            onDragStart()
          } else {
            onSelect()
          }
        }
      }}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <svg
        width={scoreWidth * scaleFactor}
        height={scoreHeight * scaleFactor}
        viewBox={`0 0 ${scoreWidth} ${scoreHeight}`}
      >
        {/* 코드 이름 (여러 개 지원) */}
        {renderChords(score.chords, score.chordName, scoreWidth)}

        {/* 오선 (5줄) */}
        {[0, 1, 2, 3, 4].map(i => (
          <line
            key={i}
            x1="3"
            y1={22 + i * 10}
            x2={scoreWidth - 3}
            y2={22 + i * 10}
            stroke="#333"
            strokeWidth="0.8"
          />
        ))}

        {/* 세로줄 (마디 구분) */}
        <line x1="3" y1="22" x2="3" y2="62" stroke="#333" strokeWidth="0.8" />
        {score.measureCount > 1 && renderBarLines(measureWidths, score.measureCount)}
        <line x1={scoreWidth - 3} y1="22" x2={scoreWidth - 3} y2="62" stroke="#333" strokeWidth="1.5" />

        {/* Beam 연결선 */}
        {renderBeams(score.notes, scoreWidth)}

        {/* 음표 렌더링 */}
        {renderNotes(score.notes, scoreWidth)}
      </svg>

      {/* 삭제 버튼 (선택된 상태에서만) */}
      {!isViewMode && isSelected && (
        <button
          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          ×
        </button>
      )}

      {/* 크기 조절 핸들 (선택된 상태에서만) */}
      {!isViewMode && isSelected && (
        <div
          className="absolute -bottom-2 -right-2 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center cursor-nwse-resize hover:bg-blue-600 shadow-md"
          onMouseDown={(e) => {
            e.stopPropagation()
            e.preventDefault()
            onResizeStart(e.clientX, score.scale || 1.0)
          }}
          onTouchStart={(e) => {
            e.stopPropagation()
            e.preventDefault()
            const touch = e.touches[0]
            onResizeStart(touch.clientX, score.scale || 1.0)
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M11 1L1 11M11 5L5 11M11 9L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
          </svg>
        </div>
      )}
    </div>
  )
}

// 코드 렌더링
function renderChords(chords: PianoChord[] | undefined, chordName: string | undefined, scoreWidth: number): React.ReactNode {
  if (chords && chords.length > 0) {
    return chords.map((chord, idx) => {
      const x = (chord.position / 100) * scoreWidth
      return (
        <text key={idx} x={x} y="12" fontSize="10" fontWeight="bold" textAnchor="middle">
          {chord.name}
        </text>
      )
    })
  } else if (chordName) {
    return (
      <text x="5" y="12" fontSize="10" fontWeight="bold">
        {chordName}
      </text>
    )
  }
  return null
}

// 마디 구분선 렌더링
function renderBarLines(measureWidths: number[], measureCount: number): React.ReactElement[] {
  const lines: React.ReactElement[] = []
  let accumulatedWidth = 0
  for (let i = 0; i < measureCount - 1; i++) {
    accumulatedWidth += measureWidths[i] * 0.7
    lines.push(
      <line
        key={`bar-${i}`}
        x1={accumulatedWidth}
        y1="22"
        x2={accumulatedWidth}
        y2="62"
        stroke="#333"
        strokeWidth="0.8"
      />
    )
  }
  return lines
}

// Beam 연결선 렌더링
function renderBeams(notes: PianoNote[], scoreWidth: number): React.ReactNode {
  const stemLength = 20
  const beamGroups: { [key: string]: { note: PianoNote, idx: number }[] } = {}

  notes.forEach((note, idx) => {
    if (note.beamGroup) {
      if (!beamGroups[note.beamGroup]) beamGroups[note.beamGroup] = []
      beamGroups[note.beamGroup].push({ note, idx })
    }
  })

  return Object.entries(beamGroups).map(([groupId, notesInGroup]) => {
    if (notesInGroup.length < 2) return null

    notesInGroup.sort((a, b) => a.note.position - b.note.position)

    const firstNote = notesInGroup[0].note
    const lastNote = notesInGroup[notesInGroup.length - 1].note

    const firstY = PITCH_TO_Y[firstNote.pitch] || 47
    const lastY = PITCH_TO_Y[lastNote.pitch] || 47
    const avgY = (firstY + lastY) / 2
    const stemUp = avgY >= 42

    const firstX = (firstNote.position / 100) * scoreWidth
    const lastX = (lastNote.position / 100) * scoreWidth

    const firstBeamY = stemUp ? firstY - stemLength : firstY + stemLength
    const lastBeamY = stemUp ? lastY - stemLength : lastY + stemLength

    const hasEighth = notesInGroup.some(n => (n.note.duration || 4) >= 8)
    const hasSixteenth = notesInGroup.some(n => (n.note.duration || 4) >= 16)

    return (
      <g key={`beam-${groupId}`}>
        {hasEighth && (
          <line
            x1={stemUp ? firstX + 4 : firstX - 4}
            y1={firstBeamY}
            x2={stemUp ? lastX + 4 : lastX - 4}
            y2={lastBeamY}
            stroke="#000"
            strokeWidth="3"
          />
        )}
        {hasSixteenth && (
          <line
            x1={stemUp ? firstX + 4 : firstX - 4}
            y1={stemUp ? firstBeamY + 4 : firstBeamY - 4}
            x2={stemUp ? lastX + 4 : lastX - 4}
            y2={stemUp ? lastBeamY + 4 : lastBeamY - 4}
            stroke="#000"
            strokeWidth="3"
          />
        )}
      </g>
    )
  })
}

// 음표 렌더링 (화음 처리 포함)
function renderNotes(notes: PianoNote[], scoreWidth: number): React.ReactNode {
  const CHORD_THRESHOLD = 5
  const stemLength = 20

  // 비슷한 position의 음표들을 화음으로 그룹화
  const chordGroups: { note: PianoNote, idx: number }[][] = []
  const notesWithIdx = notes.map((note, idx) => ({ note, idx }))
  notesWithIdx.sort((a, b) => a.note.position - b.note.position)

  notesWithIdx.forEach(item => {
    const foundGroup = chordGroups.find(group => {
      const groupAvgPos = group.reduce((sum, g) => sum + g.note.position, 0) / group.length
      return Math.abs(groupAvgPos - item.note.position) < CHORD_THRESHOLD
    })
    if (foundGroup) {
      foundGroup.push(item)
    } else {
      chordGroups.push([item])
    }
  })

  return chordGroups.map((notesInChord, groupIdx) => {
    // 화음 내 음표들을 높이순으로 정렬 (높은 음 -> 낮은 음)
    notesInChord.sort((a, b) => {
      const aIdx = PITCH_ORDER.indexOf(a.note.pitch)
      const bIdx = PITCH_ORDER.indexOf(b.note.pitch)
      return aIdx - bIdx
    })

    // 화음의 평균 position으로 baseX 계산
    const avgPosition = notesInChord.reduce((sum, n) => sum + n.note.position, 0) / notesInChord.length
    const baseX = (avgPosition / 100) * scoreWidth
    const firstNote = notesInChord[0].note

    // 화음 전체의 평균 Y로 기둥 방향 결정
    const avgY = notesInChord.reduce((sum, n) => sum + (PITCH_TO_Y[n.note.pitch] || 47), 0) / notesInChord.length

    // beam 그룹이 있는 경우 beam 그룹 전체의 평균으로 결정
    const hasBeam = notesInChord.some(n => n.note.beamGroup)
    let stemUp = avgY >= 42
    if (hasBeam) {
      const beamGroup = notesInChord.find(n => n.note.beamGroup)?.note.beamGroup
      if (beamGroup) {
        const beamNotes = notes.filter(n => n.beamGroup === beamGroup)
        const beamAvgY = beamNotes.reduce((sum, n) => sum + (PITCH_TO_Y[n.pitch] || 47), 0) / beamNotes.length
        stemUp = beamAvgY >= 42
      }
    }

    // 인접한 음표(2도 간격) 체크 및 x 오프셋 계산
    const noteOffsets: number[] = []
    for (let i = 0; i < notesInChord.length; i++) {
      const currentPitchIdx = PITCH_ORDER.indexOf(notesInChord[i].note.pitch)
      let needsOffset = false

      if (i > 0) {
        const prevPitchIdx = PITCH_ORDER.indexOf(notesInChord[i - 1].note.pitch)
        if (Math.abs(currentPitchIdx - prevPitchIdx) === 1) {
          if (noteOffsets[i - 1] === 0) {
            needsOffset = true
          }
        }
      }
      noteOffsets.push(needsOffset ? (stemUp ? -8 : 8) : 0)
    }

    // 화음의 최고음, 최저음 찾기
    const highestY = Math.min(...notesInChord.map(n => PITCH_TO_Y[n.note.pitch] || 47))
    const lowestY = Math.max(...notesInChord.map(n => PITCH_TO_Y[n.note.pitch] || 47))

    const duration = firstNote.duration || 4
    const isFilled = duration >= 4
    const hasStem = duration >= 2
    const isBeamed = notesInChord.some(n => n.note.beamGroup)
    const showFlag = !isBeamed && duration >= 8

    const stemX = stemUp ? baseX + 4 : baseX - 4

    return (
      <g key={groupIdx}>
        {/* 각 음표 머리 렌더링 */}
        {notesInChord.map(({ note, idx }, i) => {
          const y = PITCH_TO_Y[note.pitch] || 47
          const xOffset = noteOffsets[i]
          const noteX = baseX + xOffset
          const needsLedgerLine = ['C4', 'D4', 'A5', 'B3', 'A3'].includes(note.pitch)
          const ledgerLineY = note.pitch === 'C4' || note.pitch === 'D4' ? 72
            : note.pitch === 'A5' ? 12
            : note.pitch === 'B3' ? 77
            : note.pitch === 'A3' ? 82 : y

          return (
            <g key={idx}>
              {needsLedgerLine && (
                <line x1={noteX - 8} y1={ledgerLineY} x2={noteX + 8} y2={ledgerLineY} stroke="#333" strokeWidth="0.8" />
              )}
              <ellipse cx={noteX} cy={y} rx="5" ry="3.5" fill={isFilled ? '#000' : 'none'} stroke="#000" strokeWidth="1" />
            </g>
          )
        })}

        {/* 기둥 - 화음 전체에 하나만 */}
        {hasStem && (
          <line
            x1={stemX}
            y1={stemUp ? lowestY : highestY}
            x2={stemX}
            y2={stemUp ? highestY - stemLength : lowestY + stemLength}
            stroke="#000"
            strokeWidth="1"
          />
        )}

        {/* 깃발 */}
        {showFlag && (
          <path
            d={stemUp
              ? `M${stemX},${highestY - stemLength} Q${stemX + 8},${highestY - stemLength + 6} ${stemX + 3},${highestY - stemLength + 12}`
              : `M${stemX},${lowestY + stemLength} Q${stemX - 8},${lowestY + stemLength - 6} ${stemX - 3},${lowestY + stemLength - 12}`}
            stroke="#000"
            strokeWidth="1.5"
            fill="none"
          />
        )}
        {showFlag && duration >= 16 && (
          <path
            d={stemUp
              ? `M${stemX},${highestY - stemLength + 5} Q${stemX + 8},${highestY - stemLength + 11} ${stemX + 3},${highestY - stemLength + 17}`
              : `M${stemX},${lowestY + stemLength - 5} Q${stemX - 8},${lowestY + stemLength - 11} ${stemX - 3},${lowestY + stemLength - 17}`}
            stroke="#000"
            strokeWidth="1.5"
            fill="none"
          />
        )}
      </g>
    )
  })
}
