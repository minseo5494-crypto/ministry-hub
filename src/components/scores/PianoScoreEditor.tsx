'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { PianoNote, PianoChord, PianoScoreElement } from './types'

// 편집 모드용 Y 위치 (오선 간격 14)
const PITCH_TO_Y_EDIT: { [key: string]: number } = {
  'A5': 21, 'G5': 28, 'F5': 35, 'E5': 42, 'D5': 49,
  'C5': 56, 'B4': 63, 'A4': 70, 'G4': 77, 'F4': 84,
  'E4': 91, 'D4': 98, 'C4': 105, 'B3': 112, 'A3': 119
}
const PITCH_ORDER = ['A5', 'G5', 'F5', 'E5', 'D5', 'C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4', 'B3', 'A3']

interface PianoScoreEditorProps {
  isOpen: boolean
  editingScoreId: string | null
  existingScore?: PianoScoreElement
  currentPage: number
  isMobile: boolean
  onSave: (score: PianoScoreElement) => void
  onClose: () => void
}

interface EditingState {
  measureCount: 1 | 2 | 3 | 4
  measureWidths: number[]
  chords: PianoChord[]
  notes: PianoNote[]
  currentDuration: 1 | 2 | 4 | 8 | 16
}

interface DragSelection {
  startX: number
  startY: number
  endX: number
  endY: number
}

export default function PianoScoreEditor({
  isOpen,
  editingScoreId,
  existingScore,
  currentPage,
  isMobile,
  onSave,
  onClose,
}: PianoScoreEditorProps) {
  const [step, setStep] = useState<'measure' | 'edit'>('measure')
  const [editingState, setEditingState] = useState<EditingState | null>(null)

  // UI States
  const [chordPickerIndex, setChordPickerIndex] = useState<number | null>(null)
  const [selectedNotesForBeam, setSelectedNotesForBeam] = useState<number[]>([])
  const [dragSelection, setDragSelection] = useState<DragSelection | null>(null)
  const [resizingMeasure, setResizingMeasure] = useState<{ index: number, startX: number, startWidths: number[] } | null>(null)

  // History
  const [history, setHistory] = useState<{ notes: PianoNote[], chords: PianoChord[] }[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  const saveHistory = useCallback((notes: PianoNote[], chords: PianoChord[]) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1)
      return [...newHistory, { notes: [...notes], chords: [...chords] }]
    })
    setHistoryIndex(prev => prev + 1)
  }, [historyIndex])

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1]
      setEditingState(prev => prev ? { ...prev, notes: [...prevState.notes], chords: [...prevState.chords] } : prev)
      setHistoryIndex(prev => prev - 1)
      setChordPickerIndex(null)
      setSelectedNotesForBeam([])
    }
  }, [history, historyIndex])

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1]
      setEditingState(prev => prev ? { ...prev, notes: [...nextState.notes], chords: [...nextState.chords] } : prev)
      setHistoryIndex(prev => prev + 1)
      setChordPickerIndex(null)
      setSelectedNotesForBeam([])
    }
  }, [history, historyIndex])

  // 모달 열릴 때 초기화
  useEffect(() => {
    if (isOpen && editingScoreId && existingScore) {
      const existingChords = existingScore.chords || (existingScore.chordName ? [{ name: existingScore.chordName, position: 50 }] : [])
      const defaultWidth = existingScore.measureCount === 1 ? 150 : 100
      setEditingState({
        measureCount: existingScore.measureCount,
        measureWidths: existingScore.measureWidths || Array(existingScore.measureCount).fill(defaultWidth),
        chords: [...existingChords],
        notes: [...existingScore.notes],
        currentDuration: 4
      })
      setStep('edit')
      setHistory([{ notes: [...existingScore.notes], chords: [...existingChords] }])
      setHistoryIndex(0)
    } else if (isOpen && !editingScoreId) {
      setStep('measure')
      setEditingState(null)
      setHistory([])
      setHistoryIndex(-1)
    }
    // Reset UI states
    setChordPickerIndex(null)
    setSelectedNotesForBeam([])
    setDragSelection(null)
    setResizingMeasure(null)
  }, [isOpen, editingScoreId, existingScore])

  // Delete 키 핸들러
  useEffect(() => {
    if (!isOpen || !editingState || selectedNotesForBeam.length === 0) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        if (chordPickerIndex !== null && selectedNotesForBeam.includes(chordPickerIndex)) {
          setChordPickerIndex(null)
        }
        setEditingState(prev => {
          if (!prev) return prev
          const newNotes = prev.notes.filter((_, idx) => !selectedNotesForBeam.includes(idx))
          saveHistory(newNotes, prev.chords)
          return { ...prev, notes: newNotes }
        })
        setSelectedNotesForBeam([])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, editingState, selectedNotesForBeam, chordPickerIndex, saveHistory])

  // 마디 너비 조절 마우스 이벤트
  // 중간 마디선: 인접한 두 마디 비율 조절 (전체 크기 유지)
  // 마지막 마디선: 마지막 마디 크기 조절 (전체 악보 크기 변경)
  useEffect(() => {
    if (!resizingMeasure || !editingState) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizingMeasure.startX
      const newWidths = [...resizingMeasure.startWidths]
      const idx = resizingMeasure.index
      const isLast = idx === editingState.measureCount - 1

      if (isLast) {
        // 마지막 마디선: 마지막 마디 크기만 조절 (전체 악보 크기 변경)
        const currentWidth = resizingMeasure.startWidths[idx]
        const newWidth = Math.max(60, Math.min(200, currentWidth + deltaX))
        newWidths[idx] = newWidth
      } else {
        // 중간 마디선: 인접한 두 마디 비율만 조절 (전체 크기 유지)
        const currentWidth = resizingMeasure.startWidths[idx]
        const nextWidth = resizingMeasure.startWidths[idx + 1]

        // 최소 너비 60, 두 마디 합계는 유지
        const totalWidth = currentWidth + nextWidth
        const newCurrentWidth = Math.max(60, Math.min(totalWidth - 60, currentWidth + deltaX))
        const newNextWidth = totalWidth - newCurrentWidth

        newWidths[idx] = newCurrentWidth
        newWidths[idx + 1] = newNextWidth
      }

      setEditingState(prev => prev ? { ...prev, measureWidths: newWidths } : prev)
    }

    const handleMouseUp = () => setResizingMeasure(null)

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizingMeasure, editingState])

  const handleClose = () => {
    setStep('measure')
    setEditingState(null)
    setHistory([])
    setHistoryIndex(-1)
    setChordPickerIndex(null)
    setSelectedNotesForBeam([])
    onClose()
  }

  const handleMeasureSelect = (count: 1 | 2 | 3 | 4) => {
    const defaultWidth = count === 1 ? 150 : 100
    setEditingState({
      measureCount: count,
      measureWidths: Array(count).fill(defaultWidth),
      chords: [],
      notes: [],
      currentDuration: 4
    })
    setStep('edit')
    setHistory([{ notes: [], chords: [] }])
    setHistoryIndex(0)
  }

  const handleSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!editingState) return
    if ((e.target as Element).closest('g.cursor-pointer')) return

    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (y < 25) return
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

    if (dragDistance < 10) {
      if (y >= 25) {
        if (selectedNotesForBeam.length > 0) {
          setSelectedNotesForBeam([])
        } else {
          const pitchIndex = Math.max(0, Math.min(14, Math.round((y - 21) / 7)))
          const pitch = PITCH_ORDER[pitchIndex] || 'A4'
          const position = Math.max(5, Math.min(95, (x / svgWidth) * 100))

          setEditingState(prev => {
            if (!prev) return prev
            const newNotes = [...prev.notes, { pitch, position, duration: prev.currentDuration }]
            saveHistory(newNotes, prev.chords)
            return { ...prev, notes: newNotes }
          })
        }
      }
    } else {
      const minX = Math.min(dragSelection.startX, dragSelection.endX)
      const maxX = Math.max(dragSelection.startX, dragSelection.endX)
      const minY = Math.min(dragSelection.startY, dragSelection.endY)
      const maxY = Math.max(dragSelection.startY, dragSelection.endY)

      const selectedIndices: number[] = []
      editingState.notes.forEach((note, idx) => {
        const noteX = (note.position / 100) * svgWidth
        const noteY = PITCH_TO_Y_EDIT[note.pitch] || 70
        if (noteX >= minX && noteX <= maxX && noteY >= minY && noteY <= maxY) {
          selectedIndices.push(idx)
        }
      })

      if (selectedIndices.length > 0) {
        setSelectedNotesForBeam(selectedIndices)
      }
    }
    setDragSelection(null)
  }

  const handleSave = () => {
    if (!editingState || editingState.notes.length === 0) return

    const score: PianoScoreElement = {
      id: editingScoreId || `piano-${Date.now()}`,
      x: existingScore?.x ?? 50,
      y: existingScore?.y ?? 50,
      pageIndex: existingScore?.pageIndex ?? currentPage - 1,
      measureCount: editingState.measureCount,
      measureWidths: editingState.measureWidths,
      chords: editingState.chords,
      notes: editingState.notes
    }

    onSave(score)
    handleClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden ${isMobile ? 'mx-2' : ''}`}>
        {/* 헤더 */}
        <div className="bg-blue-100 text-blue-700 p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            피아노 악보 {step === 'measure' ? '- 마디 선택' : '- 음표 입력'}
          </h2>
          <button onClick={handleClose} className="text-white/80 hover:text-white text-2xl leading-none">
            ×
          </button>
        </div>

        {/* 마디 선택 */}
        {step === 'measure' && (
          <div className="p-6">
            <p className="text-gray-600 mb-4">악보 길이를 선택하세요</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 1 as const, label: '코드 하나', desc: '단일 코드 표시' },
                { value: 2 as const, label: '2마디', desc: '짧은 프레이즈' },
                { value: 3 as const, label: '3마디', desc: '중간 길이' },
                { value: 4 as const, label: '4마디', desc: '긴 프레이즈' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleMeasureSelect(opt.value)}
                  className="p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
                >
                  <div className="font-bold text-lg">{opt.label}</div>
                  <div className="text-sm text-gray-500">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 음표 입력 */}
        {step === 'edit' && editingState && (
          <div className="p-4 overflow-y-auto max-h-[70vh]">
            {/* 코드 피커 */}
            {chordPickerIndex !== null && editingState.notes[chordPickerIndex] && (
              <ChordPicker
                selectedNote={editingState.notes[chordPickerIndex]}
                chords={editingState.chords}
                onChordChange={(newChords) => {
                  saveHistory(editingState.notes, newChords)
                  setEditingState(prev => prev ? { ...prev, chords: newChords } : prev)
                }}
                onClose={() => setChordPickerIndex(null)}
              />
            )}

            {/* 오선지 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                오선지 (클릭: 음표 추가 / 드래그: 선택 / Delete: 삭제)
              </label>
              <div className="border rounded-lg p-2 bg-white overflow-x-auto">
                <svg
                  width={editingState.measureWidths.reduce((sum, w) => sum + w, 0)}
                  height="130"
                  className="cursor-crosshair select-none"
                  onMouseDown={handleSvgMouseDown}
                  onMouseMove={handleSvgMouseMove}
                  onMouseUp={handleSvgMouseUp}
                  onMouseLeave={() => setDragSelection(null)}
                  onTouchStart={(e) => {
                    if ((e.target as Element).closest('g.cursor-pointer')) return
                    const rect = e.currentTarget.getBoundingClientRect()
                    const touch = e.touches[0]
                    const x = touch.clientX - rect.left
                    const y = touch.clientY - rect.top
                    if (y < 25) return
                    setDragSelection({ startX: x, startY: y, endX: x, endY: y })
                  }}
                  onTouchMove={(e) => {
                    if (!dragSelection) return
                    const rect = e.currentTarget.getBoundingClientRect()
                    const touch = e.touches[0]
                    setDragSelection(prev => prev ? { ...prev, endX: touch.clientX - rect.left, endY: touch.clientY - rect.top } : null)
                  }}
                  onTouchEnd={() => {
                    if (!dragSelection) return
                    const svgWidth = editingState.measureWidths.reduce((sum, w) => sum + w, 0)
                    const dragDistance = Math.sqrt(Math.pow(dragSelection.endX - dragSelection.startX, 2) + Math.pow(dragSelection.endY - dragSelection.startY, 2))
                    if (dragDistance < 10 && dragSelection.startY >= 25) {
                      if (selectedNotesForBeam.length > 0) {
                        setSelectedNotesForBeam([])
                      } else {
                        const pitchIndex = Math.max(0, Math.min(14, Math.round((dragSelection.startY - 21) / 7)))
                        const pitch = PITCH_ORDER[pitchIndex] || 'A4'
                        const position = Math.max(5, Math.min(95, (dragSelection.startX / svgWidth) * 100))
                        setEditingState(prev => {
                          if (!prev) return prev
                          const newNotes = [...prev.notes, { pitch, position, duration: prev.currentDuration }]
                          saveHistory(newNotes, prev.chords)
                          return { ...prev, notes: newNotes }
                        })
                      }
                    } else {
                      const minX = Math.min(dragSelection.startX, dragSelection.endX)
                      const maxX = Math.max(dragSelection.startX, dragSelection.endX)
                      const minY = Math.min(dragSelection.startY, dragSelection.endY)
                      const maxY = Math.max(dragSelection.startY, dragSelection.endY)
                      const selectedIndices: number[] = []
                      editingState.notes.forEach((note, idx) => {
                        const noteX = (note.position / 100) * svgWidth
                        const noteY = PITCH_TO_Y_EDIT[note.pitch] || 70
                        if (noteX >= minX && noteX <= maxX && noteY >= minY && noteY <= maxY) {
                          selectedIndices.push(idx)
                        }
                      })
                      if (selectedIndices.length > 0) setSelectedNotesForBeam(selectedIndices)
                    }
                    setDragSelection(null)
                  }}
                >
                  {/* 코드 슬롯 */}
                  <ChordSlots
                    notes={editingState.notes}
                    chords={editingState.chords}
                    measureWidths={editingState.measureWidths}
                    chordPickerIndex={chordPickerIndex}
                    onChordClick={(idx) => setChordPickerIndex(idx)}
                  />

                  {/* 오선 */}
                  {[0, 1, 2, 3, 4].map(i => (
                    <line
                      key={i}
                      x1="5"
                      y1={35 + i * 14}
                      x2={editingState.measureWidths.reduce((sum, w) => sum + w, 0) - 5}
                      y2={35 + i * 14}
                      stroke="#333"
                      strokeWidth="1"
                    />
                  ))}

                  {/* 마디 구분선 */}
                  <line x1="5" y1="35" x2="5" y2="91" stroke="#333" strokeWidth="1" />
                  {editingState.measureWidths.map((_, i) => {
                    const endX = editingState.measureWidths.slice(0, i + 1).reduce((sum, w) => sum + w, 0)
                    const isLast = i === editingState.measureCount - 1
                    return (
                      <g key={i}>
                        <line x1={endX - 5} y1="35" x2={endX - 5} y2="91" stroke="#333" strokeWidth={isLast ? 2 : 1} />
                        {/* 마디 너비 조절 핸들 */}
                        <rect
                          x={endX - 12}
                          y="25"
                          width="14"
                          height="80"
                          fill="transparent"
                          className="cursor-ew-resize"
                          onMouseDown={(e) => {
                            e.stopPropagation()
                            setResizingMeasure({ index: i, startX: e.clientX, startWidths: [...editingState.measureWidths] })
                          }}
                          onTouchStart={(e) => {
                            e.stopPropagation()
                            setResizingMeasure({ index: i, startX: e.touches[0].clientX, startWidths: [...editingState.measureWidths] })
                          }}
                        />
                      </g>
                    )
                  })}

                  {/* Beam 연결선 */}
                  <EditorBeams notes={editingState.notes} measureWidths={editingState.measureWidths} />

                  {/* 음표 */}
                  <EditorNotes
                    notes={editingState.notes}
                    measureWidths={editingState.measureWidths}
                    selectedNotesForBeam={selectedNotesForBeam}
                    onNoteClick={(idx) => setSelectedNotesForBeam(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx])}
                  />

                  {/* 드래그 선택 영역 */}
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
                </svg>
              </div>
            </div>

            {/* 음표 길이 선택 + Undo/Redo */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">음표 길이</label>
                <div className="flex gap-1">
                  <button
                    onClick={undo}
                    disabled={historyIndex <= 0}
                    className={`px-2 py-1 rounded text-sm ${historyIndex <= 0 ? 'bg-gray-100 text-gray-400' : 'bg-gray-200 hover:bg-gray-300'}`}
                  >
                    뒤로
                  </button>
                  <button
                    onClick={redo}
                    disabled={historyIndex >= history.length - 1}
                    className={`px-2 py-1 rounded text-sm ${historyIndex >= history.length - 1 ? 'bg-gray-100 text-gray-400' : 'bg-gray-200 hover:bg-gray-300'}`}
                  >
                    앞으로
                  </button>
                </div>
              </div>
              <div className="flex gap-1">
                {[
                  { value: 1 as const, label: '온', icon: '' },
                  { value: 2 as const, label: '2분', icon: '' },
                  { value: 4 as const, label: '4분', icon: '' },
                  { value: 8 as const, label: '8분', icon: '' },
                  { value: 16 as const, label: '16분', icon: '' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setEditingState(prev => prev ? { ...prev, currentDuration: opt.value } : prev)}
                    className={`px-2 py-1.5 rounded text-sm font-medium ${
                      editingState.currentDuration === opt.value ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 선택된 음표 액션 */}
            {selectedNotesForBeam.length > 0 && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-700">{selectedNotesForBeam.length}개 음표 선택됨</span>
                  <button onClick={() => setSelectedNotesForBeam([])} className="text-xs text-gray-500 hover:text-gray-700">선택 해제</button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {/* 점음표 토글 버튼 */}
                  <button
                    onClick={() => {
                      setEditingState(prev => {
                        if (!prev) return prev
                        const newNotes = prev.notes.map((note, idx) =>
                          selectedNotesForBeam.includes(idx) ? { ...note, dotted: !note.dotted } : note
                        )
                        saveHistory(newNotes, prev.chords)
                        return { ...prev, notes: newNotes }
                      })
                    }}
                    className={`px-3 py-1.5 text-sm rounded ${
                      selectedNotesForBeam.some(idx => editingState.notes[idx]?.dotted)
                        ? 'bg-purple-100 text-purple-700 hover:bg-purple-100'
                        : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                    }`}
                  >
                    점 {selectedNotesForBeam.some(idx => editingState.notes[idx]?.dotted) ? '제거' : '추가'}
                  </button>
                  {selectedNotesForBeam.length >= 2 && (
                    <button
                      onClick={() => {
                        const beamGroupId = `beam-${Date.now()}`
                        setEditingState(prev => {
                          if (!prev) return prev
                          const newNotes = prev.notes.map((note, idx) => selectedNotesForBeam.includes(idx) ? { ...note, beamGroup: beamGroupId } : note)
                          saveHistory(newNotes, prev.chords)
                          return { ...prev, notes: newNotes }
                        })
                        setSelectedNotesForBeam([])
                      }}
                      className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-100"
                    >
                      연결
                    </button>
                  )}
                  {selectedNotesForBeam.some(idx => editingState.notes[idx]?.beamGroup) && (
                    <button
                      onClick={() => {
                        setEditingState(prev => {
                          if (!prev) return prev
                          const newNotes = prev.notes.map((note, idx) => selectedNotesForBeam.includes(idx) ? { ...note, beamGroup: undefined } : note)
                          saveHistory(newNotes, prev.chords)
                          return { ...prev, notes: newNotes }
                        })
                        setSelectedNotesForBeam([])
                      }}
                      className="px-3 py-1.5 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
                    >
                      연결 해제
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (chordPickerIndex !== null && selectedNotesForBeam.includes(chordPickerIndex)) setChordPickerIndex(null)
                      setEditingState(prev => {
                        if (!prev) return prev
                        const newNotes = prev.notes.filter((_, idx) => !selectedNotesForBeam.includes(idx))
                        saveHistory(newNotes, prev.chords)
                        return { ...prev, notes: newNotes }
                      })
                      setSelectedNotesForBeam([])
                    }}
                    className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded hover:bg-red-100"
                  >
                    삭제
                  </button>
                </div>
              </div>
            )}

            {/* 전체 삭제 */}
            {editingState.notes.length > 0 && selectedNotesForBeam.length === 0 && (
              <div className="mb-4">
                <button
                  onClick={() => {
                    setChordPickerIndex(null)
                    setSelectedNotesForBeam([])
                    setEditingState(prev => {
                      if (!prev) return prev
                      saveHistory([], prev.chords)
                      return { ...prev, notes: [] }
                    })
                  }}
                  className="px-3 py-2 text-xs bg-red-100 text-red-600 hover:bg-red-200 rounded-lg"
                >
                  음표 전체 삭제
                </button>
              </div>
            )}

            {/* 버튼 */}
            <div className="flex gap-3 pt-4 border-t">
              <button
                onClick={() => {
                  if (editingScoreId) {
                    handleClose()
                  } else {
                    setStep('measure')
                    setEditingState(null)
                    setChordPickerIndex(null)
                    setSelectedNotesForBeam([])
                  }
                }}
                className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                {editingScoreId ? '취소' : '뒤로'}
              </button>
              <button
                onClick={handleSave}
                disabled={!editingState || editingState.notes.length === 0}
                className="flex-1 py-2 px-4 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:bg-gray-300 disabled:cursor-not-allowed"
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

// 코드 피커 컴포넌트
function ChordPicker({
  selectedNote,
  chords,
  onChordChange,
  onClose
}: {
  selectedNote: PianoNote
  chords: PianoChord[]
  onChordChange: (chords: PianoChord[]) => void
  onClose: () => void
}) {
  const existingChord = chords.find(c => c && Math.abs(c.position - selectedNote.position) < 5)
  const currentChordName = existingChord?.name || 'C'

  const updateChord = (newName: string) => {
    const newChords = chords.filter(c => !c || Math.abs(c.position - selectedNote.position) >= 5)
    newChords.push({ name: newName, position: selectedNote.position })
    onChordChange(newChords)
  }

  return (
    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-blue-700">코드 선택</span>
        <div className="flex gap-2">
          {existingChord && (
            <button
              onClick={() => {
                const newChords = chords.filter(c => !c || Math.abs(c.position - selectedNote.position) >= 5)
                onChordChange(newChords)
                onClose()
              }}
              className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200"
            >
              삭제
            </button>
          )}
          <button onClick={onClose} className="px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded hover:bg-gray-300">
            닫기
          </button>
        </div>
      </div>
      {/* 루트 음 */}
      <div className="flex flex-wrap gap-1 mb-2">
        {['C', 'D', 'E', 'F', 'G', 'A', 'B'].map(note => (
          <button
            key={note}
            onClick={() => {
              const currentType = currentChordName.replace(/^[A-G][#b]?/, '')
              updateChord(note + currentType)
            }}
            className={`px-3 py-1.5 rounded font-bold text-sm ${currentChordName.startsWith(note) ? 'bg-blue-100 text-blue-700' : 'bg-white hover:bg-gray-100'}`}
          >
            {note}
          </button>
        ))}
      </div>
      {/* 변화 기호 */}
      <div className="flex flex-wrap gap-1 mb-2">
        {[{ symbol: '', label: '' }, { symbol: 'b', label: 'b' }, { symbol: '#', label: '#' }].map(mod => {
          const hasSymbol = mod.symbol ? currentChordName.includes(mod.symbol) : !currentChordName.match(/^[A-G][#b]/)
          return (
            <button
              key={mod.symbol}
              onClick={() => {
                const root = currentChordName.match(/^[A-G]/)?.[0] || 'C'
                const chordType = currentChordName.replace(/^[A-G][#b]?/, '')
                updateChord(root + mod.symbol + chordType)
              }}
              className={`px-3 py-1.5 rounded text-sm ${hasSymbol ? 'bg-blue-100 text-blue-700' : 'bg-white hover:bg-gray-100'}`}
            >
              {mod.label || 'N'}
            </button>
          )
        })}
      </div>
      {/* 코드 타입 */}
      <div className="flex flex-wrap gap-1">
        {[
          { type: '', label: 'Maj' },
          { type: 'm', label: 'min' },
          { type: '7', label: '7' },
          { type: 'maj7', label: 'M7' },
          { type: 'm7', label: 'm7' },
          { type: 'dim', label: 'dim' },
          { type: 'aug', label: 'aug' },
          { type: 'sus4', label: 'sus4' },
        ].map(chord => {
          const currentType = currentChordName.replace(/^[A-G][#b]?/, '')
          return (
            <button
              key={chord.type}
              onClick={() => {
                const rootWithMod = currentChordName.match(/^[A-G][#b]?/)?.[0] || 'C'
                updateChord(rootWithMod + chord.type)
              }}
              className={`px-2 py-1 rounded text-xs ${currentType === chord.type ? 'bg-blue-100 text-blue-700' : 'bg-white hover:bg-gray-100'}`}
            >
              {chord.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// 코드 슬롯 컴포넌트
function ChordSlots({
  notes,
  chords,
  measureWidths,
  chordPickerIndex,
  onChordClick
}: {
  notes: PianoNote[]
  chords: PianoChord[]
  measureWidths: number[]
  chordPickerIndex: number | null
  onChordClick: (idx: number) => void
}) {
  const svgWidth = measureWidths.reduce((sum, w) => sum + w, 0)
  const CHORD_THRESHOLD = 5

  const chordSlotGroups: { notes: { note: PianoNote, idx: number }[], avgPosition: number }[] = []
  const notesWithIdx = notes.map((note, idx) => ({ note, idx }))
  notesWithIdx.sort((a, b) => a.note.position - b.note.position)

  notesWithIdx.forEach(item => {
    const foundGroup = chordSlotGroups.find(group => Math.abs(group.avgPosition - item.note.position) < CHORD_THRESHOLD)
    if (foundGroup) {
      foundGroup.notes.push(item)
      foundGroup.avgPosition = foundGroup.notes.reduce((sum, n) => sum + n.note.position, 0) / foundGroup.notes.length
    } else {
      chordSlotGroups.push({ notes: [item], avgPosition: item.note.position })
    }
  })

  return (
    <>
      {chordSlotGroups.map((group, groupIdx) => {
        const slotX = (group.avgPosition / 100) * svgWidth
        const chord = chords.find(c => c && Math.abs(c.position - group.avgPosition) < CHORD_THRESHOLD)
        const firstNoteIdx = group.notes[0].idx
        const isSelected = chordPickerIndex !== null && group.notes.some(n => n.idx === chordPickerIndex)

        return (
          <g key={`chord-slot-${groupIdx}`} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); onChordClick(firstNoteIdx) }}>
            <rect
              x={slotX - 18}
              y="2"
              width="36"
              height="22"
              fill={isSelected ? '#dbeafe' : 'transparent'}
              stroke={chord ? '#3b82f6' : '#9ca3af'}
              strokeWidth="1"
              strokeDasharray={chord ? 'none' : '3,2'}
              rx="3"
              className="hover:fill-blue-50"
            />
            <text x={slotX} y="17" fontSize="11" fontWeight={chord ? 'bold' : 'normal'} textAnchor="middle" fill={chord ? '#1d4ed8' : '#9ca3af'}>
              {chord?.name || '+'}
            </text>
          </g>
        )
      })}
    </>
  )
}

// Beam 연결선 컴포넌트
function EditorBeams({ notes, measureWidths }: { notes: PianoNote[], measureWidths: number[] }) {
  const svgWidth = measureWidths.reduce((sum, w) => sum + w, 0)
  const stemLength = 28

  const beamGroups: { [key: string]: { note: PianoNote, idx: number }[] } = {}
  notes.forEach((note, idx) => {
    if (note.beamGroup) {
      if (!beamGroups[note.beamGroup]) beamGroups[note.beamGroup] = []
      beamGroups[note.beamGroup].push({ note, idx })
    }
  })

  return (
    <>
      {Object.entries(beamGroups).map(([groupId, notesInGroup]) => {
        if (notesInGroup.length < 2) return null
        notesInGroup.sort((a, b) => a.note.position - b.note.position)

        const firstNote = notesInGroup[0].note
        const lastNote = notesInGroup[notesInGroup.length - 1].note
        const firstY = PITCH_TO_Y_EDIT[firstNote.pitch] || 70
        const lastY = PITCH_TO_Y_EDIT[lastNote.pitch] || 70
        const avgY = (firstY + lastY) / 2
        const stemUp = avgY >= 63

        const firstX = (firstNote.position / 100) * svgWidth
        const lastX = (lastNote.position / 100) * svgWidth
        const firstBeamY = stemUp ? firstY - stemLength : firstY + stemLength
        const lastBeamY = stemUp ? lastY - stemLength : lastY + stemLength

        const hasEighth = notesInGroup.some(n => (n.note.duration || 4) >= 8)
        const hasSixteenth = notesInGroup.some(n => (n.note.duration || 4) >= 16)

        // 점8분음표 + 16분음표 패턴 감지
        const isDottedEighthPattern = notesInGroup.length === 2 &&
          ((firstNote.duration === 8 && firstNote.dotted && lastNote.duration === 16) ||
           (lastNote.duration === 8 && lastNote.dotted && firstNote.duration === 16))

        const stemX1 = stemUp ? firstX + 6 : firstX - 6
        const stemX2 = stemUp ? lastX + 6 : lastX - 6

        return (
          <g key={`beam-${groupId}`}>
            {/* 메인 빔 (8분음표 빔) */}
            {hasEighth && (
              <line x1={stemX1} y1={firstBeamY} x2={stemX2} y2={lastBeamY} stroke="#1d4ed8" strokeWidth="4" />
            )}
            {/* 16분음표 빔 - 점8분음표 패턴이면 부분 빔만 */}
            {hasSixteenth && !isDottedEighthPattern && (
              <line x1={stemX1} y1={stemUp ? firstBeamY + 6 : firstBeamY - 6} x2={stemX2} y2={stemUp ? lastBeamY + 6 : lastBeamY - 6} stroke="#1d4ed8" strokeWidth="4" />
            )}
            {/* 점8분음표 + 16분음표: 16분음표 쪽에만 부분 빔 */}
            {isDottedEighthPattern && (
              <line
                x1={firstNote.duration === 16
                  ? stemX1
                  : stemX2 - (stemX2 - stemX1) * 0.4}
                y1={firstNote.duration === 16
                  ? (stemUp ? firstBeamY + 6 : firstBeamY - 6)
                  : (stemUp ? lastBeamY + 6 - (lastBeamY - firstBeamY) * 0.4 : lastBeamY - 6 - (lastBeamY - firstBeamY) * 0.4)}
                x2={lastNote.duration === 16
                  ? stemX2
                  : stemX1 + (stemX2 - stemX1) * 0.4}
                y2={lastNote.duration === 16
                  ? (stemUp ? lastBeamY + 6 : lastBeamY - 6)
                  : (stemUp ? firstBeamY + 6 + (lastBeamY - firstBeamY) * 0.4 : firstBeamY - 6 + (lastBeamY - firstBeamY) * 0.4)}
                stroke="#1d4ed8"
                strokeWidth="4"
              />
            )}
          </g>
        )
      })}
    </>
  )
}

// 음표 렌더링 컴포넌트
function EditorNotes({
  notes,
  measureWidths,
  selectedNotesForBeam,
  onNoteClick
}: {
  notes: PianoNote[]
  measureWidths: number[]
  selectedNotesForBeam: number[]
  onNoteClick: (idx: number) => void
}) {
  const svgWidth = measureWidths.reduce((sum, w) => sum + w, 0)
  const CHORD_THRESHOLD = 5
  const stemLength = 28

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

  return (
    <>
      {chordGroups.map((notesInChord, groupIdx) => {
        notesInChord.sort((a, b) => PITCH_ORDER.indexOf(a.note.pitch) - PITCH_ORDER.indexOf(b.note.pitch))

        const avgPosition = notesInChord.reduce((sum, n) => sum + n.note.position, 0) / notesInChord.length
        const baseX = (avgPosition / 100) * svgWidth
        const firstNote = notesInChord[0].note

        const avgY = notesInChord.reduce((sum, n) => sum + (PITCH_TO_Y_EDIT[n.note.pitch] || 70), 0) / notesInChord.length
        const hasBeam = notesInChord.some(n => n.note.beamGroup)
        let stemUp = avgY >= 63
        if (hasBeam) {
          const beamGroup = notesInChord.find(n => n.note.beamGroup)?.note.beamGroup
          if (beamGroup) {
            const beamNotes = notes.filter(n => n.beamGroup === beamGroup)
            const beamAvgY = beamNotes.reduce((sum, n) => sum + (PITCH_TO_Y_EDIT[n.pitch] || 70), 0) / beamNotes.length
            stemUp = beamAvgY >= 63
          }
        }

        const noteOffsets: number[] = []
        for (let i = 0; i < notesInChord.length; i++) {
          const currentPitchIdx = PITCH_ORDER.indexOf(notesInChord[i].note.pitch)
          let needsOffset = false
          if (i > 0) {
            const prevPitchIdx = PITCH_ORDER.indexOf(notesInChord[i - 1].note.pitch)
            if (Math.abs(currentPitchIdx - prevPitchIdx) === 1 && noteOffsets[i - 1] === 0) {
              needsOffset = true
            }
          }
          noteOffsets.push(needsOffset ? (stemUp ? -12 : 12) : 0)
        }

        const highestY = Math.min(...notesInChord.map(n => PITCH_TO_Y_EDIT[n.note.pitch] || 70))
        const lowestY = Math.max(...notesInChord.map(n => PITCH_TO_Y_EDIT[n.note.pitch] || 70))

        const duration = firstNote.duration || 4
        const isFilled = duration >= 4
        const hasStem = duration >= 2
        const isBeamed = notesInChord.some(n => n.note.beamGroup)
        const showFlag = !isBeamed && duration >= 8

        const stemX = stemUp ? baseX + 6 : baseX - 6

        return (
          <g key={groupIdx}>
            {notesInChord.map(({ note, idx }, i) => {
              const y = PITCH_TO_Y_EDIT[note.pitch] || 70
              const xOffset = noteOffsets[i]
              const noteX = baseX + xOffset
              const needsLedgerLine = ['C4', 'D4', 'A5', 'B3', 'A3'].includes(note.pitch)
              const isSelected = selectedNotesForBeam.includes(idx)
              const noteIsBeamed = !!note.beamGroup

              // 점음표의 점 위치 계산 (선 위에 있으면 살짝 위로)
              const isOnLine = ['A5', 'F5', 'D5', 'B4', 'G4', 'E4', 'C4', 'A3'].includes(note.pitch)
              const dotY = isOnLine ? y - 3.5 : y

              return (
                <g key={idx} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); onNoteClick(idx) }}>
                  {isSelected && <circle cx={noteX} cy={y} r="12" fill="rgba(59, 130, 246, 0.3)" stroke="#3b82f6" strokeWidth="2" />}
                  {needsLedgerLine && <line x1={noteX - 15} y1={y} x2={noteX + 15} y2={y} stroke="#333" strokeWidth="1" />}
                  <ellipse cx={noteX} cy={y} rx="7" ry="5" fill={isFilled ? (noteIsBeamed ? '#1d4ed8' : '#000') : 'none'} stroke={noteIsBeamed ? '#1d4ed8' : '#000'} strokeWidth="1.5" />
                  {/* 점음표 점 */}
                  {note.dotted && (
                    <circle cx={noteX + 11} cy={dotY} r="2" fill={noteIsBeamed ? '#1d4ed8' : '#000'} />
                  )}
                </g>
              )
            })}

            {hasStem && (
              <line x1={stemX} y1={stemUp ? lowestY : highestY} x2={stemX} y2={stemUp ? highestY - stemLength : lowestY + stemLength} stroke={isBeamed ? '#1d4ed8' : '#000'} strokeWidth="1.5" />
            )}

            {/* 깃발 - 항상 오른쪽으로 */}
            {showFlag && (
              <path
                d={stemUp
                  ? `M${stemX},${highestY - stemLength} Q${stemX + 12},${highestY - stemLength + 10} ${stemX + 4},${highestY - stemLength + 18}`
                  : `M${stemX},${lowestY + stemLength} Q${stemX + 12},${lowestY + stemLength - 10} ${stemX + 4},${lowestY + stemLength - 18}`}
                stroke="#000"
                strokeWidth="2"
                fill="none"
              />
            )}
            {showFlag && duration >= 16 && (
              <path
                d={stemUp
                  ? `M${stemX},${highestY - stemLength + 8} Q${stemX + 12},${highestY - stemLength + 18} ${stemX + 4},${highestY - stemLength + 26}`
                  : `M${stemX},${lowestY + stemLength - 8} Q${stemX + 12},${lowestY + stemLength - 18} ${stemX + 4},${lowestY + stemLength - 26}`}
                stroke="#000"
                strokeWidth="2"
                fill="none"
              />
            )}
          </g>
        )
      })}
    </>
  )
}
