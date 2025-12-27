'use client'

import React from 'react'
import { DrumScoreElement, DrumNote, DRUM_PART_Y, DRUM_PARTS, DRUM_STEM_UP } from './types'

interface DrumScoreRendererProps {
  score: DrumScoreElement
  scaleFactor: number
  isSelected: boolean
  isViewMode: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
  onDragStart: () => void
  onTouchMove: (e: React.TouchEvent) => void
  onTouchEnd: () => void
  lastTapTimeRef: React.MutableRefObject<number>
}

export default function DrumScoreRenderer({
  score,
  scaleFactor,
  isSelected,
  isViewMode,
  onSelect,
  onEdit,
  onDelete,
  onDragStart,
  onTouchMove,
  onTouchEnd,
  lastTapTimeRef,
}: DrumScoreRendererProps) {
  const defaultWidth = 100
  const measureWidths = score.measureWidths || Array(score.measureCount).fill(defaultWidth)
  const scoreWidth = measureWidths.reduce((sum, w) => sum + w * 0.7, 0)
  const scoreHeight = 85 // 5선지 높이

  return (
    <div
      className={`absolute select-none rounded bg-white/90 ${
        isSelected && !isViewMode
          ? 'ring-2 ring-orange-500 cursor-move'
          : 'cursor-pointer'
      }`}
      style={{
        left: `${score.x}%`,
        top: `${score.y}%`,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'auto',
        touchAction: 'none',
        padding: '4px',
        boxShadow: isSelected && !isViewMode ? '0 4px 12px rgba(249,115,22,0.3)' : '0 2px 8px rgba(0,0,0,0.15)',
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
        {/* 5선 (오선) */}
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
        {score.measureCount > 1 && (() => {
          const lines: React.ReactElement[] = []
          let accumulatedWidth = 0
          for (let i = 0; i < score.measureCount - 1; i++) {
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
        })()}
        <line x1={scoreWidth - 3} y1="22" x2={scoreWidth - 3} y2="62" stroke="#333" strokeWidth="1.5" />

        {/* Beam 연결선 렌더링 */}
        {renderBeams(score.notes, scoreWidth)}

        {/* 드럼 음표 렌더링 */}
        {score.notes.map((note, idx) => (
          <DrumNoteElement
            key={idx}
            note={note}
            x={(note.position / 100) * scoreWidth}
            scoreWidth={scoreWidth}
            allNotes={score.notes}
          />
        ))}
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
    </div>
  )
}

// 파트에 따른 음표 스타일 가져오기
function getNoteStyle(part: DrumNote['part']): string {
  const partInfo = DRUM_PARTS.find(p => p.value === part)
  return partInfo?.noteStyle || 'normal'
}

// Beam 연결 가능한 파트 (하이햇과 스네어만)
const BEAMABLE_PARTS: DrumNote['part'][] = ['HH', 'SN']

// 음표 위치 근접 판단 거리
const MIN_NOTE_DISTANCE = 3

// 개별 드럼 음표 렌더링
function DrumNoteElement({ note, x, allNotes }: { note: DrumNote; x: number; scoreWidth: number; allNotes: DrumNote[] }) {
  const y = DRUM_PART_Y[note.part] || 42
  const duration = note.duration || 8

  // 파트에 따른 음표 스타일 결정
  const noteStyle = getNoteStyle(note.part)
  const isXType = ['HH', 'CY', 'RD'].includes(note.part)

  // 기둥 방향: 파트별 설정에 따라 (킥은 아래로, 나머지는 위로)
  const stemUp = DRUM_STEM_UP[note.part]
  const stemLength = 20

  // HH와 SN만 beam 연결 가능, 다른 파트는 beamGroup 무시
  const canBeam = BEAMABLE_PARTS.includes(note.part)
  const isBeamed = canBeam && !!note.beamGroup

  // 페어링 로직 (심벌/하이햇/스네어)
  const isHH = note.part === 'HH'
  const isCymbal = ['CY', 'RD'].includes(note.part)

  // HH+SN 페어링 제거 - 각각 독립적으로 기둥 렌더링
  // 하이햇은 항상 위로, 스네어도 위로

  // 심벌(CY/RD)과 HH 페어 - 심벌이 위에 있으므로 심벌에서 기둥 그림
  const pairedHHForCymbal = isCymbal ? allNotes.find(n =>
    n.part === 'HH' && Math.abs(n.position - note.position) < MIN_NOTE_DISTANCE
  ) : null
  const hasPairedCymbal = isHH && allNotes.some(n =>
    ['CY', 'RD'].includes(n.part) && Math.abs(n.position - note.position) < MIN_NOTE_DISTANCE
  )

  return (
    <g>
      {/* 보조선 (오선 밖 일반 음표만) - 심벌류(X)는 보조선 없음 */}
      {!isXType && y <= 17 && (
        <line x1={x - 6} y1={12} x2={x + 6} y2={12} stroke="#333" strokeWidth="0.8" />
      )}
      {y >= 67 && (
        <line x1={x - 6} y1={67} x2={x + 6} y2={67} stroke="#333" strokeWidth="0.8" />
      )}

      {/* 음표 머리 - 파트별 스타일 */}
      {noteStyle === 'x' && (
        // 하이햇: 일반 X
        <>
          <line x1={x - 3.5} y1={y - 3.5} x2={x + 3.5} y2={y + 3.5} stroke="#000" strokeWidth="1.8" />
          <line x1={x + 3.5} y1={y - 3.5} x2={x - 3.5} y2={y + 3.5} stroke="#000" strokeWidth="1.8" />
        </>
      )}
      {noteStyle === 'x-circle' && (
        // 심벌(CY): X + 동그라미 (더 두껍고 큰 표시)
        <>
          <circle cx={x} cy={y} r="5" fill="none" stroke="#000" strokeWidth="1.2" />
          <line x1={x - 3} y1={y - 3} x2={x + 3} y2={y + 3} stroke="#000" strokeWidth="1.5" />
          <line x1={x + 3} y1={y - 3} x2={x - 3} y2={y + 3} stroke="#000" strokeWidth="1.5" />
        </>
      )}
      {noteStyle === 'x-ring' && (
        // 라이드(RD): X + 삼각형 표시 (다이아몬드 형태)
        <>
          <path
            d={`M${x} ${y - 4} L${x + 4} ${y} L${x} ${y + 4} L${x - 4} ${y} Z`}
            fill="none"
            stroke="#000"
            strokeWidth="1.2"
          />
          <line x1={x - 2.5} y1={y - 2.5} x2={x + 2.5} y2={y + 2.5} stroke="#000" strokeWidth="1.2" />
          <line x1={x + 2.5} y1={y - 2.5} x2={x - 2.5} y2={y + 2.5} stroke="#000" strokeWidth="1.2" />
        </>
      )}
      {noteStyle === 'ghost' && (
        // 고스트 노트 (괄호 안 작은 원)
        <>
          <circle cx={x} cy={y} r="3" fill="none" stroke="#000" strokeWidth="0.8" />
          <text x={x - 6} y={y + 3} fontSize="10" fill="#000">(</text>
          <text x={x + 3} y={y + 3} fontSize="10" fill="#000">)</text>
        </>
      )}
      {noteStyle === 'normal' && (
        // 일반 음표 (채워진 타원)
        <ellipse cx={x} cy={y} rx="4" ry="3" fill="#000" />
      )}

      {/* 기둥 렌더링 (페어링 로직 적용) */}
      {duration >= 4 && !isBeamed && (
        <>
          {/* 심벌(CY/RD) + HH 페어: 심벌에서 위로 기둥 (HH는 기둥 없음) */}
          {isCymbal && pairedHHForCymbal && (
            <line
              x1={x + 4}
              y1={y}
              x2={x + 4}
              y2={y - stemLength}
              stroke="#000"
              strokeWidth="1"
            />
          )}
          {/* 심벌 단독 기둥 (위로) */}
          {isCymbal && !pairedHHForCymbal && (
            <line
              x1={x + 4}
              y1={y}
              x2={x + 4}
              y2={y - stemLength}
              stroke="#000"
              strokeWidth="1"
            />
          )}
          {/* HH가 심벌과 페어되면 기둥 생략 */}
          {/* HH 기둥 (심벌 페어 없을 때, 항상 위로) */}
          {isHH && !hasPairedCymbal && (
            <line
              x1={x + 4}
              y1={y}
              x2={x + 4}
              y2={y - stemLength}
              stroke="#000"
              strokeWidth="1"
            />
          )}
          {/* 그 외 파트 (SN, TH, TM, TL, KK) 기둥 */}
          {!isCymbal && !isHH && (
            <line
              x1={stemUp ? x + 4 : x - 4}
              y1={y}
              x2={stemUp ? x + 4 : x - 4}
              y2={stemUp ? y - stemLength : y + stemLength}
              stroke="#000"
              strokeWidth="1"
            />
          )}
        </>
      )}

      {/* 깃발 (8분음표 이상, beam이 없을 때) */}
      {duration >= 8 && !isBeamed && !hasPairedCymbal && (
        <path
          d={stemUp
            ? `M${x + 4},${y - stemLength} Q${x + 12},${y - stemLength + 6} ${x + 7},${y - stemLength + 12}`
            : `M${x - 4},${y + stemLength} Q${x - 12},${y + stemLength - 6} ${x - 7},${y + stemLength - 12}`
          }
          stroke="#000"
          strokeWidth="1.5"
          fill="none"
        />
      )}
      {duration >= 16 && !isBeamed && !hasPairedCymbal && (
        <path
          d={stemUp
            ? `M${x + 4},${y - stemLength + 5} Q${x + 12},${y - stemLength + 11} ${x + 7},${y - stemLength + 17}`
            : `M${x - 4},${y + stemLength - 5} Q${x - 12},${y + stemLength - 11} ${x - 7},${y + stemLength - 17}`
          }
          stroke="#000"
          strokeWidth="1.5"
          fill="none"
        />
      )}
    </g>
  )
}

// Beam 연결선 렌더링
function renderBeams(notes: DrumNote[], scoreWidth: number): React.ReactElement[] {
  const beamGroups: { [key: string]: { note: DrumNote; idx: number }[] } = {}

  notes.forEach((note, idx) => {
    // HH와 SN만 beam 연결 가능
    if (note.beamGroup && BEAMABLE_PARTS.includes(note.part)) {
      if (!beamGroups[note.beamGroup]) beamGroups[note.beamGroup] = []
      beamGroups[note.beamGroup].push({ note, idx })
    }
  })

  return Object.entries(beamGroups).map(([groupId, notesInGroup]) => {
    if (notesInGroup.length < 2) return null

    notesInGroup.sort((a, b) => a.note.position - b.note.position)

    const firstNote = notesInGroup[0].note
    const lastNote = notesInGroup[notesInGroup.length - 1].note

    // HH와 SN만 beam 연결되므로 항상 stemUp = true (위로)
    const stemUp = true
    const stemLength = 22  // 빔 연결을 위해 약간 더 길게

    const firstX = (firstNote.position / 100) * scoreWidth
    const lastX = (lastNote.position / 100) * scoreWidth

    // 빔 높이: 그룹 내 가장 높은/낮은 음표 기준
    const allY = notesInGroup.map(n => DRUM_PART_Y[n.note.part] || 42)
    const beamBaseY = stemUp ? Math.min(...allY) - stemLength : Math.max(...allY) + stemLength

    const hasEighth = notesInGroup.some(n => (n.note.duration || 8) >= 8)
    const hasSixteenth = notesInGroup.some(n => (n.note.duration || 8) >= 16)

    return (
      <g key={`beam-${groupId}`}>
        {/* 각 음표의 기둥 */}
        {notesInGroup.map(({ note }, i) => {
          const x = (note.position / 100) * scoreWidth
          const y = DRUM_PART_Y[note.part] || 42

          return (
            <line
              key={`stem-${i}`}
              x1={stemUp ? x + 4 : x - 4}
              y1={y}
              x2={stemUp ? x + 4 : x - 4}
              y2={beamBaseY}
              stroke="#000"
              strokeWidth="1"
            />
          )
        })}

        {/* Beam 줄 (수평선) */}
        {hasEighth && (
          <line
            x1={stemUp ? firstX + 4 : firstX - 4}
            y1={beamBaseY}
            x2={stemUp ? lastX + 4 : lastX - 4}
            y2={beamBaseY}
            stroke="#000"
            strokeWidth="3"
          />
        )}
        {hasSixteenth && (
          <line
            x1={stemUp ? firstX + 4 : firstX - 4}
            y1={stemUp ? beamBaseY + 4 : beamBaseY - 4}
            x2={stemUp ? lastX + 4 : lastX - 4}
            y2={stemUp ? beamBaseY + 4 : beamBaseY - 4}
            stroke="#000"
            strokeWidth="3"
          />
        )}
      </g>
    )
  }).filter(Boolean) as React.ReactElement[]
}
