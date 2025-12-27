'use client'

import React, { useState, useCallback } from 'react'
import { DrumNote, DrumScoreElement, DrumPart, DRUM_PARTS, DRUM_STEM_UP } from './types'

interface DrumScoreEditorProps {
  isOpen: boolean
  editingScoreId: string | null
  existingScore?: DrumScoreElement
  currentPage: number
  isMobile: boolean
  onSave: (score: DrumScoreElement) => void
  onClose: () => void
}

interface EditingState {
  measureCount: 1 | 2 | 3 | 4
  measureWidths: number[]
  notes: DrumNote[]
  currentDuration: 4 | 8 | 16
}

interface DragSelection {
  startX: number
  startY: number
  endX: number
  endY: number
}

// 편집용 Y 위치 (5선: 50, 60, 70, 80, 90 / 칸: 55, 65, 75, 85)
// 표준 드럼 악보 기준으로 배치
const DRUM_PART_Y_EDIT: Record<DrumPart, number> = {
  'CY': 25,   // 심벌 - 오선 위 (하이햇보다 더 위)
  'RD': 35,   // 라이드 - 오선 위
  'HH': 45,   // 하이햇 - 오선 바로 위 (X)
  'TH': 55,   // 하이탐 - 첫째칸
  'TM': 65,   // 미드탐 - 둘째칸
  'SN': 75,   // 스네어 - 셋째칸
  'TL': 80,   // 플로어탐 - 넷째줄
  'KK': 85,   // 킥 - 넷째칸 (맨 아랫칸)
}

// 음표 최소 간격 (position 기준, 0-100 범위)
const MIN_NOTE_DISTANCE = 4

// Y 위치로 가장 가까운 파트 찾기
const findPartByY = (y: number): DrumPart => {
  const parts: DrumPart[] = ['CY', 'RD', 'HH', 'TH', 'SN', 'TM', 'TL', 'KK']
  let closest: DrumPart = 'SN'
  let minDist = Infinity

  for (const part of parts) {
    const dist = Math.abs(y - DRUM_PART_Y_EDIT[part])
    if (dist < minDist) {
      minDist = dist
      closest = part
    }
  }
  return closest
}

export default function DrumScoreEditor({
  isOpen,
  editingScoreId,
  existingScore,
  currentPage,
  isMobile,
  onSave,
  onClose,
}: DrumScoreEditorProps) {
  const [step, setStep] = useState<'measure' | 'edit'>('measure')
  const [editingState, setEditingState] = useState<EditingState | null>(null)

  // 음표 선택 (빔 연결용)
  const [selectedNotes, setSelectedNotes] = useState<number[]>([])

  // 드래그 선택
  const [dragSelection, setDragSelection] = useState<DragSelection | null>(null)

  // Undo/Redo 히스토리
  const [history, setHistory] = useState<{ notes: DrumNote[] }[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  const saveHistory = useCallback((notes: DrumNote[]) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1)
      return [...newHistory, { notes }]
    })
    setHistoryIndex(prev => prev + 1)
  }, [historyIndex])

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1]
      setEditingState(prev => prev ? { ...prev, notes: prevState.notes } : prev)
      setHistoryIndex(prev => prev - 1)
    }
  }, [history, historyIndex])

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1]
      setEditingState(prev => prev ? { ...prev, notes: nextState.notes } : prev)
      setHistoryIndex(prev => prev + 1)
    }
  }, [history, historyIndex])

  // 모달이 열릴 때 기존 악보 데이터로 초기화
  React.useEffect(() => {
    if (isOpen && editingScoreId && existingScore) {
      setEditingState({
        measureCount: existingScore.measureCount,
        measureWidths: existingScore.measureWidths || Array(existingScore.measureCount).fill(100),
        notes: existingScore.notes,
        currentDuration: 8
      })
      setStep('edit')
      setHistory([{ notes: existingScore.notes }])
      setHistoryIndex(0)
      setSelectedNotes([])
      setDragSelection(null)
    } else if (isOpen && !editingScoreId) {
      setStep('measure')
      setEditingState(null)
      setHistory([])
      setHistoryIndex(-1)
      setSelectedNotes([])
      setDragSelection(null)
    }
  }, [isOpen, editingScoreId, existingScore])

  const handleClose = () => {
    setStep('measure')
    setEditingState(null)
    setHistory([])
    setHistoryIndex(-1)
    setSelectedNotes([])
    setDragSelection(null)
    onClose()
  }

  const handleMeasureSelect = (count: 1 | 2 | 3 | 4) => {
    setEditingState({
      measureCount: count,
      measureWidths: Array(count).fill(100),
      notes: [],
      currentDuration: 8
    })
    setStep('edit')
    setHistory([{ notes: [] }])
    setHistoryIndex(0)
    setSelectedNotes([])
    setDragSelection(null)
  }

  // 8분 하이햇 기본 패턴 추가
  const addHiHatPattern = () => {
    if (!editingState) return

    const measureWidth = 100 / editingState.measureCount
    const newNotes: DrumNote[] = []

    for (let m = 0; m < editingState.measureCount; m++) {
      // 각 마디에 8분음표 8개
      for (let i = 0; i < 8; i++) {
        const position = m * measureWidth + (i / 8) * measureWidth
        // 이미 해당 위치에 하이햇이 있는지 확인
        const exists = editingState.notes.some(n =>
          n.part === 'HH' && Math.abs(n.position - position) < 1
        )
        if (!exists) {
          newNotes.push({
            part: 'HH',
            position,
            duration: 8,
            noteType: 'x'
          })
        }
      }
    }

    if (newNotes.length > 0) {
      const combined = [...editingState.notes, ...newNotes]
      saveHistory(combined)
      setEditingState(prev => prev ? { ...prev, notes: combined } : prev)
    }
  }

  // 기본 킥+스네어 패턴 (4분음표 기준)
  const addBasicPattern = () => {
    if (!editingState) return

    const measureWidth = 100 / editingState.measureCount
    const newNotes: DrumNote[] = []

    for (let m = 0; m < editingState.measureCount; m++) {
      // 킥: 1박, 3박
      const kick1Pos = m * measureWidth + 0
      const kick3Pos = m * measureWidth + measureWidth * 0.5
      // 스네어: 2박, 4박
      const snare2Pos = m * measureWidth + measureWidth * 0.25
      const snare4Pos = m * measureWidth + measureWidth * 0.75

      // 킥 추가 (없으면)
      if (!editingState.notes.some(n => n.part === 'KK' && Math.abs(n.position - kick1Pos) < 1)) {
        newNotes.push({ part: 'KK', position: kick1Pos, duration: 4, noteType: 'normal' })
      }
      if (!editingState.notes.some(n => n.part === 'KK' && Math.abs(n.position - kick3Pos) < 1)) {
        newNotes.push({ part: 'KK', position: kick3Pos, duration: 4, noteType: 'normal' })
      }
      // 스네어 추가 (없으면)
      if (!editingState.notes.some(n => n.part === 'SN' && Math.abs(n.position - snare2Pos) < 1)) {
        newNotes.push({ part: 'SN', position: snare2Pos, duration: 4, noteType: 'normal' })
      }
      if (!editingState.notes.some(n => n.part === 'SN' && Math.abs(n.position - snare4Pos) < 1)) {
        newNotes.push({ part: 'SN', position: snare4Pos, duration: 4, noteType: 'normal' })
      }
    }

    if (newNotes.length > 0) {
      const combined = [...editingState.notes, ...newNotes]
      saveHistory(combined)
      setEditingState(prev => prev ? { ...prev, notes: combined } : prev)
    }
  }

  // 선택된 음표들 빔으로 연결
  const connectSelectedNotes = () => {
    if (!editingState || selectedNotes.length < 2) return

    const beamGroupId = `beam-${Date.now()}`
    const newNotes = editingState.notes.map((note, idx) =>
      selectedNotes.includes(idx) ? { ...note, beamGroup: beamGroupId } : note
    )
    saveHistory(newNotes)
    setEditingState(prev => prev ? { ...prev, notes: newNotes } : prev)
    setSelectedNotes([])
  }

  // 선택된 음표들 빔 연결 해제
  const disconnectSelectedNotes = () => {
    if (!editingState || selectedNotes.length === 0) return

    const newNotes = editingState.notes.map((note, idx) =>
      selectedNotes.includes(idx) ? { ...note, beamGroup: undefined } : note
    )
    saveHistory(newNotes)
    setEditingState(prev => prev ? { ...prev, notes: newNotes } : prev)
    setSelectedNotes([])
  }

  // 선택된 음표들 삭제
  const deleteSelectedNotes = () => {
    if (!editingState || selectedNotes.length === 0) return

    const newNotes = editingState.notes.filter((_, idx) => !selectedNotes.includes(idx))
    saveHistory(newNotes)
    setEditingState(prev => prev ? { ...prev, notes: newNotes } : prev)
    setSelectedNotes([])
  }

  // SVG 마우스 이벤트 핸들러 (피아노 에디터와 동일한 방식)
  const handleSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!editingState) return
    if ((e.target as Element).closest('g.cursor-pointer')) return

    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setDragSelection({ startX: x, startY: y, endX: x, endY: y })
  }

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragSelection) return

    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setDragSelection(prev => prev ? { ...prev, endX: x, endY: y } : null)
  }

  const handleSvgMouseUp = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragSelection || !editingState) return

    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const svgWidth = editingState.measureWidths.reduce((sum, w) => sum + w, 0)

    const dragDistance = Math.sqrt(
      Math.pow(dragSelection.endX - dragSelection.startX, 2) +
      Math.pow(dragSelection.endY - dragSelection.startY, 2)
    )

    // 클릭 (드래그 거리가 작음) -> 음표 추가
    if (dragDistance < 10) {
      if (y >= 15) {
        // 이미 선택된 음표가 있으면 선택 해제
        if (selectedNotes.length > 0) {
          setSelectedNotes([])
        } else {
          // 클릭한 Y 위치에서 가장 가까운 파트 찾기
          const part = findPartByY(y)
          // position 계산 (0-100%)
          const position = Math.max(5, Math.min(95, (x / svgWidth) * 100))

          // 같은 파트에서 너무 가까운 위치에 이미 음표가 있는지 확인
          const tooClose = editingState.notes.some(note =>
            note.part === part && Math.abs(note.position - position) < MIN_NOTE_DISTANCE
          )

          // 심벌(CY)과 하이햇(HH)은 같은 위치에 겹칠 수 없음
          const cyHhConflict = (part === 'CY' || part === 'HH') && editingState.notes.some(note =>
            (note.part === 'CY' || note.part === 'HH') && Math.abs(note.position - position) < MIN_NOTE_DISTANCE
          )

          if (tooClose || cyHhConflict) {
            // 너무 가깝거나 CY/HH 충돌이면 추가하지 않음
            setDragSelection(null)
            return
          }

          // 파트별 음표 타입 결정
          const partInfo = DRUM_PARTS.find(p => p.value === part)
          const newNote: DrumNote = {
            part,
            position,
            duration: editingState.currentDuration,
            noteType: partInfo?.noteType || 'normal'
          }

          setEditingState(prev => {
            if (!prev) return prev
            const newNotes = [...prev.notes, newNote]
            saveHistory(newNotes)
            return { ...prev, notes: newNotes }
          })
        }
      }
    } else {
      // 드래그 -> 영역 선택
      const minX = Math.min(dragSelection.startX, dragSelection.endX)
      const maxX = Math.max(dragSelection.startX, dragSelection.endX)
      const minY = Math.min(dragSelection.startY, dragSelection.endY)
      const maxY = Math.max(dragSelection.startY, dragSelection.endY)

      const selectedIndices: number[] = []
      editingState.notes.forEach((note, idx) => {
        const noteX = (note.position / 100) * svgWidth
        const noteY = DRUM_PART_Y_EDIT[note.part] || 70
        if (noteX >= minX && noteX <= maxX && noteY >= minY && noteY <= maxY) {
          selectedIndices.push(idx)
        }
      })

      if (selectedIndices.length > 0) {
        setSelectedNotes(selectedIndices)
      }
    }

    setDragSelection(null)
  }

  // 음표 클릭 시 선택 토글
  const handleNoteClick = (noteIndex: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedNotes(prev => {
      if (prev.includes(noteIndex)) {
        return prev.filter(i => i !== noteIndex)
      } else {
        return [...prev, noteIndex]
      }
    })
  }

  const handleSave = () => {
    if (!editingState || editingState.notes.length === 0) return

    const score: DrumScoreElement = {
      id: editingScoreId || `drum-${Date.now()}`,
      x: existingScore?.x ?? 50,
      y: existingScore?.y ?? 50,
      pageIndex: existingScore?.pageIndex ?? currentPage - 1,
      measureCount: editingState.measureCount,
      measureWidths: editingState.measureWidths,
      notes: editingState.notes
    }

    onSave(score)
    handleClose()
  }

  if (!isOpen) return null

  const totalWidth = editingState?.measureWidths.reduce((sum, w) => sum + w, 0) || 100
  const margin = 3
  const contentWidth = totalWidth - margin * 2

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden ${isMobile ? 'mx-2' : ''}`}>
        {/* 헤더 */}
        <div className="bg-orange-600 text-white p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            드럼 악보 {step === 'measure' ? '- 마디 선택' : '- 음표 입력'}
          </h2>
          <button
            onClick={handleClose}
            className="text-white/80 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* 마디 선택 단계 */}
        {step === 'measure' && (
          <div className="p-6">
            <p className="text-gray-600 mb-4">악보 길이를 선택하세요</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 1 as const, label: '1마디', desc: '기본 패턴' },
                { value: 2 as const, label: '2마디', desc: '짧은 필인' },
                { value: 3 as const, label: '3마디', desc: '중간 길이' },
                { value: 4 as const, label: '4마디', desc: '긴 프레이즈' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleMeasureSelect(opt.value)}
                  className="p-4 border-2 border-gray-200 rounded-xl hover:border-orange-500 hover:bg-orange-50 transition-colors text-left"
                >
                  <div className="font-bold text-lg">{opt.label}</div>
                  <div className="text-sm text-gray-500">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 음표 입력 단계 */}
        {step === 'edit' && editingState && (
          <div className="p-4 overflow-y-auto max-h-[70vh]">
            {/* 기본 패턴 버튼 */}
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                onClick={addHiHatPattern}
                className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200"
              >
                🎩 8분 하이햇 채우기
              </button>
              <button
                onClick={addBasicPattern}
                className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200"
              >
                🥁 기본 킥+스네어
              </button>
            </div>

            {/* 음표 길이 선택 */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">음표 길이</label>
              <div className="flex gap-2">
                {[
                  { value: 4 as const, label: '4분' },
                  { value: 8 as const, label: '8분' },
                  { value: 16 as const, label: '16분' },
                ].map(dur => (
                  <button
                    key={dur.value}
                    onClick={() => setEditingState(prev => prev ? { ...prev, currentDuration: dur.value } : prev)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      editingState.currentDuration === dur.value
                        ? 'bg-orange-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {dur.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 선택된 음표가 있을 때 연결/삭제 버튼 */}
            {selectedNotes.length > 0 && (
              <div className="mb-3 p-3 bg-blue-50 rounded-lg">
                <div className="text-sm text-blue-700 mb-2">
                  {selectedNotes.length}개 음표 선택됨
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedNotes.length >= 2 && (
                    <button
                      onClick={connectSelectedNotes}
                      className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      연결
                    </button>
                  )}
                  {selectedNotes.some(idx => editingState.notes[idx]?.beamGroup) && (
                    <button
                      onClick={disconnectSelectedNotes}
                      className="px-3 py-1.5 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
                    >
                      연결 해제
                    </button>
                  )}
                  <button
                    onClick={deleteSelectedNotes}
                    className="px-3 py-1.5 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    삭제
                  </button>
                  <button
                    onClick={() => setSelectedNotes([])}
                    className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                  >
                    선택 해제
                  </button>
                </div>
              </div>
            )}

            {/* 오선 영역 (피아노와 동일한 방식) */}
            <div className="mb-3 bg-gray-50 rounded-lg p-3 overflow-x-auto">
              <div className="text-xs text-gray-500 mb-2">
                클릭 위치가 음표 위치 (위=심벌/하이햇, 가운데=스네어/탐, 아래=킥) | 드래그: 여러 음표 선택
              </div>
              <svg
                width={editingState.measureWidths.reduce((sum, w) => sum + w, 0)}
                height="110"
                className="cursor-crosshair select-none"
                onMouseDown={handleSvgMouseDown}
                onMouseMove={handleSvgMouseMove}
                onMouseUp={handleSvgMouseUp}
                onMouseLeave={() => setDragSelection(null)}
              >
                {(() => {
                  const svgWidth = editingState.measureWidths.reduce((sum, w) => sum + w, 0)

                  return (
                    <>
                      {/* 파트 레이블 (왼쪽) */}
                      <text x="2" y={DRUM_PART_Y_EDIT['CY'] + 3} fontSize="7" fill="#999">CY</text>
                      <text x="2" y={DRUM_PART_Y_EDIT['RD'] + 3} fontSize="7" fill="#999">RD</text>
                      <text x="2" y={DRUM_PART_Y_EDIT['HH'] + 3} fontSize="7" fill="#666">HH</text>
                      <text x="2" y={DRUM_PART_Y_EDIT['TH'] + 3} fontSize="7" fill="#999">TH</text>
                      <text x="2" y={DRUM_PART_Y_EDIT['TM'] + 3} fontSize="7" fill="#999">TM</text>
                      <text x="2" y={DRUM_PART_Y_EDIT['SN'] + 3} fontSize="7" fill="#666">SN</text>
                      <text x="2" y={DRUM_PART_Y_EDIT['TL'] + 3} fontSize="7" fill="#999">TL</text>
                      <text x="2" y={DRUM_PART_Y_EDIT['KK'] + 3} fontSize="7" fill="#666">KK</text>

                      {/* 5선 오선지 (Y: 50~90, 간격 10) */}
                      {[0, 1, 2, 3, 4].map(i => (
                        <line
                          key={i}
                          x1="20"
                          y1={50 + i * 10}
                          x2={svgWidth - 5}
                          y2={50 + i * 10}
                          stroke="#333"
                          strokeWidth="0.8"
                        />
                      ))}

                      {/* 마디 구분선 */}
                      <line x1="20" y1="50" x2="20" y2="90" stroke="#333" strokeWidth="1" />
                      {(() => {
                        const lines: React.ReactElement[] = []
                        let accX = 20
                        const measureWidth = (svgWidth - 25) / editingState.measureCount
                        for (let i = 0; i < editingState.measureCount - 1; i++) {
                          accX += measureWidth
                          lines.push(<line key={i} x1={accX} y1="50" x2={accX} y2="90" stroke="#666" strokeWidth="0.8" />)
                        }
                        return lines
                      })()}
                      <line x1={svgWidth - 5} y1="50" x2={svgWidth - 5} y2="90" stroke="#333" strokeWidth="1.5" />

                      {/* 드래그 선택 영역 표시 */}
                      {dragSelection && (
                        <rect
                          x={Math.min(dragSelection.startX, dragSelection.endX)}
                          y={Math.min(dragSelection.startY, dragSelection.endY)}
                          width={Math.abs(dragSelection.endX - dragSelection.startX)}
                          height={Math.abs(dragSelection.endY - dragSelection.startY)}
                          fill="rgba(59, 130, 246, 0.2)"
                          stroke="#3b82f6"
                          strokeWidth="1"
                          strokeDasharray="4,2"
                        />
                      )}

                      {/* Beam 렌더링 */}
                      {renderBeamsEdit(editingState.notes, svgWidth)}

                      {/* 음표 렌더링 */}
                      {editingState.notes.map((note, idx) => {
                        const x = (note.position / 100) * svgWidth
                        const y = DRUM_PART_Y_EDIT[note.part] || 70
                        const partInfo = DRUM_PARTS.find(p => p.value === note.part)
                        const noteStyle = partInfo?.noteStyle || 'normal'
                        const isSelected = selectedNotes.includes(idx)
                        const strokeColor = isSelected ? '#3b82f6' : '#000'

                        // 심벌류/하이햇 페어링 로직
                        const isHH = note.part === 'HH'
                        const isCymbal = ['CY', 'RD'].includes(note.part)

                        // HH+SN 페어링 제거 - 각각 독립적으로 기둥 렌더링
                        // 하이햇은 항상 위로, 스네어도 위로

                        // 심벌(CY/RD)과 HH 페어 - 심벌이 위에 있으므로 심벌에서 기둥 그림
                        const pairedHHForCymbal = isCymbal ? editingState.notes.find(n =>
                          n.part === 'HH' && Math.abs(n.position - note.position) < MIN_NOTE_DISTANCE
                        ) : null
                        const hasPairedCymbal = isHH && editingState.notes.some(n =>
                          ['CY', 'RD'].includes(n.part) && Math.abs(n.position - note.position) < MIN_NOTE_DISTANCE
                        )

                        return (
                          <g
                            key={idx}
                            className="cursor-pointer"
                            onClick={(e) => handleNoteClick(idx, e)}
                          >
                            {/* 선택 하이라이트 배경 */}
                            {isSelected && (
                              <circle cx={x} cy={y} r="10" fill="#3b82f6" opacity="0.2" />
                            )}

                            {/* 음표 머리 */}
                            {noteStyle === 'x' && (
                              <>
                                <line x1={x - 4} y1={y - 4} x2={x + 4} y2={y + 4} stroke={strokeColor} strokeWidth="2" />
                                <line x1={x + 4} y1={y - 4} x2={x - 4} y2={y + 4} stroke={strokeColor} strokeWidth="2" />
                              </>
                            )}
                            {noteStyle === 'x-circle' && (
                              <>
                                <circle cx={x} cy={y} r="6" fill="none" stroke={strokeColor} strokeWidth="1.5" />
                                <line x1={x - 3.5} y1={y - 3.5} x2={x + 3.5} y2={y + 3.5} stroke={strokeColor} strokeWidth="1.5" />
                                <line x1={x + 3.5} y1={y - 3.5} x2={x - 3.5} y2={y + 3.5} stroke={strokeColor} strokeWidth="1.5" />
                              </>
                            )}
                            {noteStyle === 'x-ring' && (
                              <>
                                <path
                                  d={`M${x} ${y - 5} L${x + 5} ${y} L${x} ${y + 5} L${x - 5} ${y} Z`}
                                  fill="none"
                                  stroke={strokeColor}
                                  strokeWidth="1.5"
                                />
                                <line x1={x - 3} y1={y - 3} x2={x + 3} y2={y + 3} stroke={strokeColor} strokeWidth="1.5" />
                                <line x1={x + 3} y1={y - 3} x2={x - 3} y2={y + 3} stroke={strokeColor} strokeWidth="1.5" />
                              </>
                            )}
                            {noteStyle === 'normal' && (
                              <ellipse cx={x} cy={y} rx="5" ry="4" fill={strokeColor} />
                            )}

                            {/* 기둥 렌더링 */}
                            {!note.beamGroup && (
                              <>
                                {/* 심벌(CY/RD) + HH 페어: 심벌에서 HH까지 기둥 연결 */}
                                {isCymbal && pairedHHForCymbal && (
                                  <line
                                    x1={x + 5}
                                    y1={y}
                                    x2={x + 5}
                                    y2={DRUM_PART_Y_EDIT[pairedHHForCymbal.part]}
                                    stroke={strokeColor}
                                    strokeWidth="1.2"
                                  />
                                )}
                                {/* 심벌 단독 기둥 (위로) */}
                                {isCymbal && !pairedHHForCymbal && (
                                  <line
                                    x1={x + 5}
                                    y1={y}
                                    x2={x + 5}
                                    y2={y - 25}
                                    stroke={strokeColor}
                                    strokeWidth="1.2"
                                  />
                                )}
                                {/* HH가 심벌과 페어되면 기둥 생략 (심벌에서 그림) */}
                                {/* HH 기둥 (심벌 페어 없을 때, 항상 위로) */}
                                {isHH && !hasPairedCymbal && (
                                  <line
                                    x1={x + 5}
                                    y1={y}
                                    x2={x + 5}
                                    y2={y - 25}
                                    stroke={strokeColor}
                                    strokeWidth="1.2"
                                  />
                                )}
                                {/* 그 외 파트 (SN, TH, TM, TL, KK) 기둥 */}
                                {!isCymbal && !isHH && (
                                  <line
                                    x1={DRUM_STEM_UP[note.part] ? x + 5 : x - 5}
                                    y1={y}
                                    x2={DRUM_STEM_UP[note.part] ? x + 5 : x - 5}
                                    y2={DRUM_STEM_UP[note.part] ? y - 25 : y + 25}
                                    stroke={strokeColor}
                                    strokeWidth="1.2"
                                  />
                                )}
                              </>
                            )}
                          </g>
                        )
                      })}
                    </>
                  )
                })()}
              </svg>
            </div>

            {/* Undo/Redo */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={undo}
                disabled={historyIndex <= 0}
                className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-30 text-sm"
              >
                취소
              </button>
              <button
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
                className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-30 text-sm"
              >
                다시
              </button>
              <button
                onClick={() => {
                  saveHistory([])
                  setEditingState(prev => prev ? { ...prev, notes: [] } : prev)
                  setSelectedNotes([])
                }}
                className="px-3 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 text-sm"
              >
                전체 삭제
              </button>
            </div>

            {/* 버튼 */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep('measure')
                  setEditingState(null)
                  setHistory([])
                  setHistoryIndex(-1)
                }}
                className="flex-1 py-2 px-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                뒤로
              </button>
              <button
                onClick={handleSave}
                disabled={!editingState || editingState.notes.length === 0}
                className="flex-1 py-2 px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {editingScoreId ? '수정' : '추가'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// 편집용 Beam 렌더링 함수 (DRUM_PART_Y_EDIT 사용)
function renderBeamsEdit(notes: DrumNote[], svgWidth: number): React.ReactElement[] {
  const beamGroups: { [key: string]: DrumNote[] } = {}

  notes.forEach(note => {
    if (note.beamGroup) {
      if (!beamGroups[note.beamGroup]) beamGroups[note.beamGroup] = []
      beamGroups[note.beamGroup].push(note)
    }
  })

  return Object.entries(beamGroups).map(([groupId, groupNotes]) => {
    if (groupNotes.length < 2) return null

    const sorted = [...groupNotes].sort((a, b) => a.position - b.position)
    const firstNote = sorted[0]
    const lastNote = sorted[sorted.length - 1]

    // 빔 그룹 내 킥(KK)이 있으면 아래로, 아니면 위로
    const hasKick = sorted.some(n => n.part === 'KK')
    const stemUp = !hasKick
    const stemLength = 28

    const firstX = (firstNote.position / 100) * svgWidth
    const lastX = (lastNote.position / 100) * svgWidth

    // 빔 높이: 그룹 내 가장 높은/낮은 음표 기준 (수평 빔)
    const allY = sorted.map(n => DRUM_PART_Y_EDIT[n.part] || 70)
    const beamBaseY = stemUp ? Math.min(...allY) - stemLength : Math.max(...allY) + stemLength

    return (
      <g key={`beam-${groupId}`}>
        {/* 각 음표의 기둥 */}
        {sorted.map((note, i) => {
          const x = (note.position / 100) * svgWidth
          const y = DRUM_PART_Y_EDIT[note.part] || 70

          return (
            <line
              key={`stem-${i}`}
              x1={stemUp ? x + 5 : x - 5}
              y1={y}
              x2={stemUp ? x + 5 : x - 5}
              y2={beamBaseY}
              stroke="#000"
              strokeWidth="1.2"
            />
          )
        })}

        {/* Beam 줄 (수평선) */}
        <line
          x1={stemUp ? firstX + 5 : firstX - 5}
          y1={beamBaseY}
          x2={stemUp ? lastX + 5 : lastX - 5}
          y2={beamBaseY}
          stroke="#000"
          strokeWidth="3"
        />
      </g>
    )
  }).filter(Boolean) as React.ReactElement[]
}
