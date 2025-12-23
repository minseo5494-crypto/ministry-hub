'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import getStroke from 'perfect-freehand'
import {
  Stroke,
  StrokePoint,
  TextElement,
  PageAnnotation,
} from '@/lib/supabase'
import { useMobile } from '@/hooks/useMobile'

// ===== 타입 정의 =====
type Tool = 'pen' | 'highlighter' | 'eraser' | 'text' | 'pan' | 'lasso'

// 송폼 스타일 (SongFormPositionModal에서 가져옴)
export interface SongFormStyle {
  x: number           // 0-100 (퍼센트)
  y: number           // 0-100 (퍼센트)
  fontSize: number    // 10-80 (pt)
  color: string       // hex 색상
  opacity: number     // 0-1
}

export interface PartTagStyle {
  id: string
  label: string
  x: number           // 0-100 (퍼센트)
  y: number           // 0-100 (퍼센트)
  fontSize: number    // 10-60 (pt)
  color: string       // hex 색상
  opacity: number     // 0-1
  pageIndex?: number  // 페이지 인덱스 (0부터 시작)
}

// 피아노 악보 음표 타입
export interface PianoNote {
  pitch: string       // 음이름 (C4, D4, E4 등)
  position: number    // 마디 내 위치 (0부터 시작)
  duration?: 1 | 2 | 4 | 8 | 16  // 음표 길이 (1=온음표, 2=2분음표, 4=4분음표, 8=8분음표, 16=16분음표, 기본값 4)
  beamGroup?: string  // 잇단음표 그룹 ID (같은 ID를 가진 음표끼리 연결)
}

// 피아노 악보 코드 타입
export interface PianoChord {
  name: string        // 코드 이름 (예: "Bb7")
  position: number    // 마디 내 위치 (0-100, 자동 계산됨)
}

// 피아노 악보 요소 타입
export interface PianoScoreElement {
  id: string
  x: number           // 0-100 (퍼센트)
  y: number           // 0-100 (퍼센트)
  pageIndex: number   // 페이지 인덱스
  measureCount: 1 | 2 | 3 | 4  // 마디 수 (1=코드 하나)
  measureWidths?: number[]  // 각 마디 너비 (없으면 균등 분배)
  chordName?: string  // 코드 이름 (예: "Bb7") - 호환성용, deprecated
  chords?: PianoChord[]  // 코드 배열 (마디당 최대 3개)
  notes: PianoNote[]  // 음표 배열
  scale?: number      // 크기 조절 (0.5-2.0, 기본값 1.0)
}

// 다중 곡 지원을 위한 곡 정보 타입
export interface EditorSong {
  song_id: string
  song_name: string
  team_name?: string
  file_url: string
  file_type: 'pdf' | 'image'
  songForms?: string[]
}

// 저장 시 전달되는 데이터 타입
export interface SavedNoteData {
  annotations: PageAnnotation[]
  songFormEnabled: boolean
  songFormStyle: SongFormStyle
  partTags: PartTagStyle[]
  pianoScores?: PianoScoreElement[]
}

interface EditorProps {
  fileUrl: string
  fileType: 'pdf' | 'image'
  songName: string
  artistName?: string
  initialAnnotations?: PageAnnotation[]
  onSave?: (annotations: PageAnnotation[], extra?: { songFormEnabled: boolean, songFormStyle: SongFormStyle, partTags: PartTagStyle[], pianoScores?: PianoScoreElement[] }) => void
  onClose?: () => void
  queueInfo?: {
    current: number
    total: number
    nextSongName?: string
  }
  // 송폼 관련 props (선택적)
  songForms?: string[]  // 선택된 송폼 배열 (예: ['I', 'V', 'C', 'B'])
  initialSongFormStyle?: SongFormStyle
  initialSongFormEnabled?: boolean  // 초기 송폼 활성화 상태
  initialPartTags?: PartTagStyle[]
  initialPianoScores?: PianoScoreElement[]  // 초기 피아노 악보
  // 다중 곡 모드 (콘티 필기용)
  songs?: EditorSong[]
  setlistTitle?: string
  onSaveAll?: (data: { song: EditorSong, annotations: PageAnnotation[], extra?: { songFormEnabled: boolean, songFormStyle: SongFormStyle, partTags: PartTagStyle[], pianoScores?: PianoScoreElement[] } }[]) => void
  // 보기/편집 모드 통합
  initialMode?: 'view' | 'edit'  // 초기 모드 (기본: edit)
}

// 올가미 선택 영역 타입
interface LassoSelection {
  points: StrokePoint[]
  boundingBox: { x: number; y: number; width: number; height: number } | null
  selectedStrokeIds: string[]
  selectedTextIds: string[]
}

// 색상 프리셋
const COLORS = [
  '#000000', // 검정
  '#FF0000', // 빨강
  '#0066FF', // 파랑
  '#00AA00', // 초록
  '#FF6600', // 주황
  '#9900FF', // 보라
]

const HIGHLIGHTER_COLORS = [
  '#FFFF00', // 노랑
  '#00FF00', // 연두
  '#00FFFF', // 하늘
  '#FF00FF', // 분홍
  '#FFA500', // 주황
]

// 파트 태그 색상
const PART_COLORS: { [key: string]: string } = {
  'I': '#EF4444',
  'V': '#3B82F6',
  'V1': '#3B82F6',
  'V2': '#2563EB',
  'V3': '#1D4ED8',
  'PC': '#EAB308',
  'C': '#22C55E',
  'C1': '#22C55E',
  'C2': '#16A34A',
  'B': '#A855F7',
  '간주': '#F97316',
  'Out': '#6B7280',
}

// 사용 가능한 파트 태그
const AVAILABLE_PARTS = [
  { key: 'I', label: 'Intro' },
  { key: 'V', label: 'Verse' },
  { key: 'V1', label: 'Verse1' },
  { key: 'V2', label: 'Verse2' },
  { key: 'V3', label: 'Verse3' },
  { key: 'PC', label: 'PreChorus' },
  { key: 'C', label: 'Chorus' },
  { key: 'C1', label: 'Chorus1' },
  { key: 'C2', label: 'Chorus2' },
  { key: 'B', label: 'Bridge' },
  { key: '간주', label: 'Interlude' },
  { key: 'Out', label: 'Outro' },
]

// 송폼 색상 프리셋
const FORM_COLOR_PRESETS = [
  { name: '보라', value: '#7C3AED' },
  { name: '파랑', value: '#2563EB' },
  { name: '빨강', value: '#DC2626' },
  { name: '초록', value: '#16A34A' },
  { name: '주황', value: '#EA580C' },
  { name: '검정', value: '#1F2937' },
]

// SVG path 생성 함수
const getSvgPathFromStroke = (stroke: number[][]) => {
  if (!stroke.length) return ''

  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length]
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
      return acc
    },
    ['M', ...stroke[0], 'Q']
  )

  d.push('Z')
  return d.join(' ')
}

// 점이 다각형 내부에 있는지 확인 (Ray casting algorithm)
const isPointInPolygon = (point: StrokePoint, polygon: StrokePoint[]): boolean => {
  if (polygon.length < 3) return false

  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y
    const xj = polygon[j].x, yj = polygon[j].y

    if (((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
      inside = !inside
    }
  }
  return inside
}

// 스트로크가 선택 영역에 포함되는지 확인
const isStrokeInSelection = (stroke: Stroke, polygon: StrokePoint[]): boolean => {
  // 스트로크의 점 중 하나라도 선택 영역 안에 있으면 선택됨
  return stroke.points.some(point => isPointInPolygon(point, polygon))
}

export default function SheetMusicEditor({
  fileUrl,
  fileType,
  songName,
  artistName,
  initialAnnotations = [],
  onSave,
  onClose,
  queueInfo,
  songForms = [],
  initialSongFormStyle,
  initialSongFormEnabled = false,  // 초기 송폼 활성화 상태
  initialPartTags = [],
  initialPianoScores = [],  // 초기 피아노 악보
  // 다중 곡 모드
  songs = [],
  setlistTitle,
  onSaveAll,
  // 보기/편집 모드
  initialMode = 'edit',
}: EditorProps) {
  // ===== 모바일 감지 =====
  const isMobile = useMobile()

  // ===== 보기/편집 모드 상태 =====
  const [editorMode, setEditorMode] = useState<'view' | 'edit'>(initialMode)
  const isViewMode = editorMode === 'view'
  const prevToolRef = useRef<Tool>('pan')  // 모드 전환 시 이전 도구 저장

  // ===== 보기 모드 전용: 툴바 숨기기 =====
  const [hideToolbar, setHideToolbar] = useState(false)

  // ===== 다중 곡 모드 지원 =====
  const isMultiSongMode = songs.length > 0
  const [currentSongIndex, setCurrentSongIndex] = useState(0)

  // 다중 곡 모드에서의 현재 곡 정보
  const currentSong = isMultiSongMode ? songs[currentSongIndex] : null
  const effectiveFileUrl = isMultiSongMode ? currentSong?.file_url || '' : fileUrl
  const effectiveFileType = isMultiSongMode ? (currentSong?.file_type || 'image') : fileType
  const effectiveSongName = isMultiSongMode ? currentSong?.song_name || '' : songName
  const effectiveArtistName = isMultiSongMode ? currentSong?.team_name : artistName
  const effectiveSongForms = isMultiSongMode ? (currentSong?.songForms || []) : songForms

  // 각 곡별 annotations 저장 (다중 곡 모드)
  const [allAnnotations, setAllAnnotations] = useState<{ [songId: string]: PageAnnotation[] }>(() => {
    if (isMultiSongMode) {
      const initial: { [songId: string]: PageAnnotation[] } = {}
      songs.forEach(s => { initial[s.song_id] = [] })
      return initial
    }
    return {}
  })

  // 각 곡별 songForm 상태 저장 (다중 곡 모드)
  const [allSongFormStates, setAllSongFormStates] = useState<{ [songId: string]: { enabled: boolean, style: SongFormStyle, partTags: PartTagStyle[] } }>(() => {
    if (isMultiSongMode) {
      const initial: { [songId: string]: { enabled: boolean, style: SongFormStyle, partTags: PartTagStyle[] } } = {}
      songs.forEach(s => {
        initial[s.song_id] = {
          enabled: (s.songForms?.length || 0) > 0,
          style: { x: 50, y: 5, fontSize: 36, color: '#7C3AED', opacity: 1 },
          partTags: []
        }
      })
      return initial
    }
    return {}
  })

  // ===== 상태 관리 =====
  const [tool, setTool] = useState<Tool>('pan') // 기본: 손 모드 (화면 이동)
  const [color, setColor] = useState('#000000')
  const [strokeSize, setStrokeSize] = useState(3)
  const [eraserSize, setEraserSize] = useState(20) // 지우개 크기
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [scale, setScale] = useState(0.5)  // 초기값을 작게 설정
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [canvasReady, setCanvasReady] = useState(false) // 캔버스가 렌더링 완료되었는지 추적
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 }) // 캔버스 크기 추적

  // 필기 데이터
  const [annotations, setAnnotations] = useState<PageAnnotation[]>(initialAnnotations)
  const annotationsRef = useRef<PageAnnotation[]>(annotations) // 최신 annotations를 추적하기 위한 ref
  const [currentStroke, setCurrentStroke] = useState<StrokePoint[]>([])
  const currentStrokeRef = useRef<StrokePoint[]>([]) // 동기적 스트로크 추적
  const [isDrawing, setIsDrawing] = useState(false)
  const isDrawingRef = useRef(false) // 동기적 드로잉 상태 추적
  const rafIdRef = useRef<number | null>(null) // requestAnimationFrame ID
  const needsRenderRef = useRef(false) // 렌더링 필요 여부

  // annotations가 변경될 때마다 ref 업데이트
  useEffect(() => {
    annotationsRef.current = annotations
  }, [annotations])

  // 모바일에서 기본 선 두께와 지우개 크기 조절
  useEffect(() => {
    if (isMobile) {
      setStrokeSize(prev => prev < 4 ? 4 : prev)  // 모바일: 최소 4
      setEraserSize(prev => prev < 30 ? 30 : prev)  // 모바일: 최소 30
    }
  }, [isMobile])

  // view 모드에서는 pan 도구로 자동 전환, edit 모드로 돌아오면 이전 도구 복원
  useEffect(() => {
    if (isViewMode) {
      prevToolRef.current = tool
      setTool('pan')
    } else if (prevToolRef.current !== 'pan') {
      // edit 모드로 전환 시 이전 도구 복원 (pan이 아닌 경우에만)
      setTool(prevToolRef.current)
    }
  }, [isViewMode])

  // 지우개 커서 위치
  const [eraserPosition, setEraserPosition] = useState<{ x: number; y: number } | null>(null)

  // 올가미 선택
  const [lassoSelection, setLassoSelection] = useState<LassoSelection>({
    points: [],
    boundingBox: null,
    selectedStrokeIds: [],
    selectedTextIds: [],
  })
  const [isMovingSelection, setIsMovingSelection] = useState(false)
  const [moveStartPos, setMoveStartPos] = useState<{ x: number; y: number } | null>(null)

  // 텍스트 입력
  const [isAddingText, setIsAddingText] = useState(false)
  const [textPosition, setTextPosition] = useState({ x: 0, y: 0 })
  const [textInput, setTextInput] = useState('')
  const textInputRef = useRef<HTMLInputElement>(null)

  // 텍스트 선택 및 드래그 (텍스트 모드에서)
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [isDraggingText, setIsDraggingText] = useState(false)
  const textDragStartRef = useRef<{ x: number; y: number } | null>(null)
  const lastTapTimeRef = useRef<number>(0) // 더블 탭 감지용

  // 텍스트 입력창 자동 포커스 (키보드 표시)
  useEffect(() => {
    if ((isAddingText || editingTextId) && textInputRef.current) {
      // 약간의 지연 후 포커스 (iOS 호환성)
      setTimeout(() => {
        textInputRef.current?.focus()
      }, 100)
    }
  }, [isAddingText, editingTextId])

  // ===== 송폼 & 파트 태그 상태 =====
  const [showSongFormPanel, setShowSongFormPanel] = useState(false) // 설정 패널 표시
  // 송폼 활성화: initialSongFormEnabled가 true이거나, songForms가 있으면 자동 활성화
  const [songFormEnabled, setSongFormEnabled] = useState(initialSongFormEnabled || (songForms && songForms.length > 0))
  const [songFormStyle, setSongFormStyle] = useState<SongFormStyle>(
    initialSongFormStyle || {
      x: 50,
      y: 5,
      fontSize: 36,
      color: '#7C3AED',
      opacity: 1
    }
  )
  const [partTags, setPartTags] = useState<PartTagStyle[]>(initialPartTags)
  const [draggingFormItem, setDraggingFormItem] = useState<{ type: 'songForm' | 'partTag' | 'pianoScore', id?: string } | null>(null)
  const [draggingNewPartTag, setDraggingNewPartTag] = useState<string | null>(null)

  // 피아노 악보 상태
  const [pianoScores, setPianoScores] = useState<PianoScoreElement[]>(initialPianoScores)
  const [showPianoModal, setShowPianoModal] = useState(false)
  const [pianoModalStep, setPianoModalStep] = useState<'measure' | 'edit'>('measure')
  const [editingPianoScore, setEditingPianoScore] = useState<{
    measureCount: 1 | 2 | 3 | 4
    measureWidths: number[]  // 각 마디 너비
    chordName: string  // 현재 편집 중인 코드
    chords: PianoChord[]  // 입력된 코드 배열
    notes: PianoNote[]
    currentDuration: 1 | 2 | 4 | 8 | 16  // 현재 선택된 음표 길이
  } | null>(null)
  const [editingPianoScoreId, setEditingPianoScoreId] = useState<string | null>(null) // 편집 중인 기존 악보 ID
  const [chordPickerIndex, setChordPickerIndex] = useState<number | null>(null) // 코드 선택 팝업이 열린 슬롯 인덱스
  const [selectedNotesForBeam, setSelectedNotesForBeam] = useState<number[]>([]) // beam 연결할 음표 인덱스들
  const [resizingPianoScore, setResizingPianoScore] = useState<{ id: string, startX: number, startScale: number } | null>(null) // 크기 조절 중인 악보
  const [dragSelection, setDragSelection] = useState<{ startX: number, startY: number, endX: number, endY: number } | null>(null) // 드래그 선택 영역
  const [resizingMeasure, setResizingMeasure] = useState<{ index: number, startX: number, startWidths: number[] } | null>(null) // 마디 너비 조절 중

  // 피아노 악보 히스토리 (undo/redo)
  const [pianoHistory, setPianoHistory] = useState<{ notes: PianoNote[], chords: PianoChord[] }[]>([])
  const [pianoHistoryIndex, setPianoHistoryIndex] = useState(-1)

  // 피아노 악보 히스토리에 현재 상태 저장
  const savePianoHistory = useCallback((notes: PianoNote[], chords: PianoChord[]) => {
    setPianoHistory(prev => {
      // 현재 인덱스 이후의 히스토리는 삭제 (새로운 액션 후에는 redo 불가)
      const newHistory = prev.slice(0, pianoHistoryIndex + 1)
      return [...newHistory, { notes: [...notes], chords: [...chords] }]
    })
    setPianoHistoryIndex(prev => prev + 1)
  }, [pianoHistoryIndex])

  // 피아노 악보 undo
  const undoPiano = useCallback(() => {
    if (pianoHistoryIndex > 0) {
      const prevState = pianoHistory[pianoHistoryIndex - 1]
      setEditingPianoScore(prev => prev ? { ...prev, notes: [...prevState.notes], chords: [...prevState.chords] } : prev)
      setPianoHistoryIndex(prev => prev - 1)
      setSelectedNotesForBeam([])
      setChordPickerIndex(null)
    }
  }, [pianoHistory, pianoHistoryIndex])

  // 피아노 악보 redo
  const redoPiano = useCallback(() => {
    if (pianoHistoryIndex < pianoHistory.length - 1) {
      const nextState = pianoHistory[pianoHistoryIndex + 1]
      setEditingPianoScore(prev => prev ? { ...prev, notes: [...nextState.notes], chords: [...nextState.chords] } : prev)
      setPianoHistoryIndex(prev => prev + 1)
      setSelectedNotesForBeam([])
      setChordPickerIndex(null)
    }
  }, [pianoHistory, pianoHistoryIndex])

  // Delete 키로 선택된 음표 삭제
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 피아노 모달이 열려 있고 선택된 음표가 있을 때만
      if (!showPianoModal || !editingPianoScore || selectedNotesForBeam.length === 0) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        // 코드 피커 상태 처리
        if (chordPickerIndex !== null && selectedNotesForBeam.includes(chordPickerIndex)) {
          setChordPickerIndex(null)
        }
        setEditingPianoScore(prev => {
          if (!prev) return prev
          const newNotes = prev.notes.filter((_, idx) => !selectedNotesForBeam.includes(idx))
          // 히스토리에 저장
          savePianoHistory(newNotes, prev.chords)
          return { ...prev, notes: newNotes }
        })
        setSelectedNotesForBeam([])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showPianoModal, editingPianoScore, selectedNotesForBeam, chordPickerIndex, savePianoHistory])

  // 마디 너비 리사이즈 핸들러
  useEffect(() => {
    if (!resizingMeasure) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizingMeasure.startX
      const newWidths = [...resizingMeasure.startWidths]
      const minWidth = 50 // 최소 마디 너비
      const idx = resizingMeasure.index

      // 마지막 마디가 아닌 경우: 현재 마디와 다음 마디 너비를 서로 조절 (전체 너비 유지)
      if (idx < newWidths.length - 1) {
        const currentOriginal = resizingMeasure.startWidths[idx]
        const nextOriginal = resizingMeasure.startWidths[idx + 1]

        // 최소 너비를 고려한 delta 제한
        const maxIncrease = nextOriginal - minWidth // 다음 마디가 최소가 될 때까지
        const maxDecrease = currentOriginal - minWidth // 현재 마디가 최소가 될 때까지
        const clampedDelta = Math.max(-maxDecrease, Math.min(maxIncrease, deltaX))

        newWidths[idx] = currentOriginal + clampedDelta
        newWidths[idx + 1] = nextOriginal - clampedDelta
      } else {
        // 마지막 마디인 경우: 마지막 마디만 조절 (전체 너비 변경)
        newWidths[idx] = Math.max(minWidth, resizingMeasure.startWidths[idx] + deltaX)
      }

      setEditingPianoScore(prev => prev ? { ...prev, measureWidths: newWidths } : prev)
    }

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0]
      const deltaX = touch.clientX - resizingMeasure.startX
      const newWidths = [...resizingMeasure.startWidths]
      const minWidth = 50
      const idx = resizingMeasure.index

      // 마지막 마디가 아닌 경우: 현재 마디와 다음 마디 너비를 서로 조절 (전체 너비 유지)
      if (idx < newWidths.length - 1) {
        const currentOriginal = resizingMeasure.startWidths[idx]
        const nextOriginal = resizingMeasure.startWidths[idx + 1]

        const maxIncrease = nextOriginal - minWidth
        const maxDecrease = currentOriginal - minWidth
        const clampedDelta = Math.max(-maxDecrease, Math.min(maxIncrease, deltaX))

        newWidths[idx] = currentOriginal + clampedDelta
        newWidths[idx + 1] = nextOriginal - clampedDelta
      } else {
        newWidths[idx] = Math.max(minWidth, resizingMeasure.startWidths[idx] + deltaX)
      }

      setEditingPianoScore(prev => prev ? { ...prev, measureWidths: newWidths } : prev)
    }

    const handleEnd = () => {
      setResizingMeasure(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleEnd)
    window.addEventListener('touchmove', handleTouchMove)
    window.addEventListener('touchend', handleEnd)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleEnd)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleEnd)
    }
  }, [resizingMeasure])

  // 히스토리 (undo/redo)
  const [history, setHistory] = useState<PageAnnotation[][]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  // 내보내기 상태
  const [showExportModal, setShowExportModal] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Refs
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null)
  const exportAreaRef = useRef<HTMLDivElement>(null) // 내보내기용 영역 ref
  const isPanningRef = useRef(false)
  const lastPanPositionRef = useRef({ x: 0, y: 0 })
  const hasInitializedScale = useRef(false) // 초기 스케일 설정 여부
  const currentToolRef = useRef<Tool>(tool) // 도구 변경 추적용
  const drawingToolRef = useRef<Tool | null>(null) // 드로잉 시작 시점의 도구 저장

  // ===== 현재 페이지의 필기 데이터 =====
  const getCurrentPageAnnotation = useCallback((): PageAnnotation => {
    return annotations.find(a => a.pageNumber === currentPage) || {
      pageNumber: currentPage,
      strokes: [],
      textElements: [],
    }
  }, [annotations, currentPage])

  // ===== 화면에 맞추기 (fit to screen) =====
  const fitToScreen = useCallback((canvasWidth: number, canvasHeight: number) => {
    if (!containerRef.current) return

    const container = containerRef.current
    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight

    // 컨테이너 크기가 아직 확정되지 않은 경우 재시도
    if (containerHeight < 100) {
      setTimeout(() => fitToScreen(canvasWidth, canvasHeight), 50)
      return
    }

    // 캔버스는 2배 크기로 렌더링됨 (고해상도)
    // CSS transform scale은 캔버스 픽셀 크기에 적용되므로
    // 컨테이너에 맞추려면 캔버스 전체 크기 기준으로 계산
    const padding = 40 // 상하좌우 여백
    const scaleX = (containerWidth - padding * 2) / canvasWidth
    const scaleY = (containerHeight - padding * 2) / canvasHeight

    // 둘 중 작은 값을 사용하여 전체가 보이도록
    const fitScale = Math.min(scaleX, scaleY)

    setScale(fitScale)
    setOffset({ x: 0, y: 0 }) // 중앙 정렬
  }, [])

  // ===== PDF 렌더링 =====
  const renderTaskRef = useRef<any>(null)
  const pdfDocRef = useRef<any>(null)

  // ===== fileUrl 변경 시 초기화 =====
  useEffect(() => {
    hasInitializedScale.current = false
    pdfDocRef.current = null
    setCanvasReady(false) // 파일 변경 시 canvasReady 리셋
  }, [effectiveFileUrl])

  // ===== 다중 곡 모드: 곡 전환 시 annotations 및 songForm 상태 저장/불러오기 =====
  const prevSongIndexRef = useRef<number>(-1)

  useEffect(() => {
    if (!isMultiSongMode || !currentSong) return

    // 이전 곡의 songForm 상태 저장 (첫 번째 로드 제외)
    if (prevSongIndexRef.current >= 0 && prevSongIndexRef.current !== currentSongIndex) {
      const prevSong = songs[prevSongIndexRef.current]
      if (prevSong) {
        setAllSongFormStates(prev => ({
          ...prev,
          [prevSong.song_id]: {
            enabled: songFormEnabled,
            style: songFormStyle,
            partTags: partTags
          }
        }))
      }
    }
    prevSongIndexRef.current = currentSongIndex

    // 현재 곡의 annotations 불러오기
    const savedAnnotations = allAnnotations[currentSong.song_id] || []
    setAnnotations(savedAnnotations)

    // 현재 곡의 songForm 상태 불러오기
    const savedFormState = allSongFormStates[currentSong.song_id]
    if (savedFormState) {
      setSongFormEnabled(savedFormState.enabled)
      setSongFormStyle(savedFormState.style)
      setPartTags(savedFormState.partTags)
    } else {
      // 저장된 상태가 없으면 기본값 사용
      const hasSongForms = currentSong.songForms && currentSong.songForms.length > 0
      setSongFormEnabled(hasSongForms)
      setSongFormStyle({ x: 50, y: 5, fontSize: 36, color: '#7C3AED', opacity: 1 })
      setPartTags([])
    }

    setCurrentPage(1)
    hasInitializedScale.current = false
    pdfDocRef.current = null  // PDF 캐시 초기화
    // 곡 전환 시 송폼 패널 닫기
    setShowSongFormPanel(false)
  }, [currentSongIndex, isMultiSongMode, currentSong])

  // ===== 다중 곡 모드: 초기 로드 시 첫 번째 곡의 송폼 활성화 =====
  useEffect(() => {
    if (!isMultiSongMode || songs.length === 0) return
    const firstSong = songs[0]
    if (firstSong.songForms && firstSong.songForms.length > 0) {
      setSongFormEnabled(true)
    }
  }, [isMultiSongMode, songs])

  // 다중 곡 모드에서 annotations 변경 시 allAnnotations에 저장
  useEffect(() => {
    if (!isMultiSongMode || !currentSong) return

    setAllAnnotations(prev => ({
      ...prev,
      [currentSong.song_id]: annotations
    }))
  }, [annotations, currentSong?.song_id, isMultiSongMode])

  // 다중 곡 모드에서 songForm 상태 변경 시 allSongFormStates에 저장
  useEffect(() => {
    if (!isMultiSongMode || !currentSong) return

    setAllSongFormStates(prev => ({
      ...prev,
      [currentSong.song_id]: {
        enabled: songFormEnabled,
        style: songFormStyle,
        partTags: partTags
      }
    }))
  }, [songFormEnabled, songFormStyle, partTags, currentSong?.song_id, isMultiSongMode])

  useEffect(() => {
    let isCancelled = false

    const renderPDF = async () => {
      if (effectiveFileType !== 'pdf' || !pdfCanvasRef.current || !effectiveFileUrl) return

      try {
        const pdfjsLib = (window as any).pdfjsLib
        if (!pdfjsLib) {
          console.error('PDF.js not loaded')
          return
        }

        // 이전 렌더링 작업 취소
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel()
          } catch (e) {
            // 이미 완료된 작업은 무시
          }
          renderTaskRef.current = null
        }

        // PDF 문서 로드 (캐싱)
        if (!pdfDocRef.current) {
          const loadingTask = pdfjsLib.getDocument(effectiveFileUrl)
          pdfDocRef.current = await loadingTask.promise
          if (isCancelled) return
          setTotalPages(pdfDocRef.current.numPages)
        }

        const pdf = pdfDocRef.current
        const page = await pdf.getPage(currentPage)
        if (isCancelled) return

        const viewport = page.getViewport({ scale: 2 }) // 고해상도

        const canvas = pdfCanvasRef.current
        if (!canvas) return
        const context = canvas.getContext('2d')
        if (!context) return

        canvas.width = viewport.width
        canvas.height = viewport.height

        // 렌더링 작업 시작
        const renderTask = page.render({
          canvasContext: context,
          viewport: viewport,
        })
        renderTaskRef.current = renderTask

        await renderTask.promise
        if (isCancelled) return

        // 드로잉 캔버스도 같은 크기로
        if (canvasRef.current) {
          canvasRef.current.width = viewport.width
          canvasRef.current.height = viewport.height
        }

        // 캔버스 크기 저장
        setCanvasSize({ width: viewport.width, height: viewport.height })

        // 초기 로드 시 화면에 맞추기
        if (!hasInitializedScale.current) {
          hasInitializedScale.current = true
          // requestAnimationFrame 후 fitToScreen 호출 (DOM 렌더링 완료 후)
          requestAnimationFrame(() => {
            setTimeout(() => {
              fitToScreen(viewport.width, viewport.height)
              setCanvasReady(true) // 캔버스 렌더링 완료
            }, 50)
          })
        } else {
          setCanvasReady(true) // 이미 초기화된 경우에도 canvasReady 설정
        }
      } catch (error: any) {
        if (error?.name === 'RenderingCancelledException') {
          // 취소된 렌더링은 무시
          return
        }
        console.error('PDF 렌더링 오류:', error)
      }
    }

    renderPDF()

    return () => {
      isCancelled = true
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel()
        } catch (e) {
          // 무시
        }
      }
    }
  }, [effectiveFileUrl, effectiveFileType, currentPage, fitToScreen])

  // ===== 이미지 렌더링 =====
  useEffect(() => {
    if (effectiveFileType !== 'image' || !pdfCanvasRef.current || !effectiveFileUrl) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = pdfCanvasRef.current!
      const context = canvas.getContext('2d')
      if (!context) return

      // PDF와 동일하게 2배 크기로 캔버스 설정 (고해상도)
      const scaleFactor = 2
      canvas.width = img.naturalWidth * scaleFactor
      canvas.height = img.naturalHeight * scaleFactor
      context.scale(scaleFactor, scaleFactor)
      context.drawImage(img, 0, 0)

      // 드로잉 캔버스도 같은 크기로
      if (canvasRef.current) {
        canvasRef.current.width = img.naturalWidth * scaleFactor
        canvasRef.current.height = img.naturalHeight * scaleFactor
      }

      setTotalPages(1)

      // 캔버스 크기 저장
      setCanvasSize({ width: canvas.width, height: canvas.height })

      // 초기 로드 시 화면에 맞추기 (PDF와 동일하게 처리)
      if (!hasInitializedScale.current) {
        hasInitializedScale.current = true
        requestAnimationFrame(() => {
          setTimeout(() => {
            fitToScreen(canvas.width, canvas.height)
            setCanvasReady(true) // 캔버스 렌더링 완료
          }, 50)
        })
      } else {
        setCanvasReady(true) // 이미 초기화된 경우에도 canvasReady 설정
      }
    }
    img.src = effectiveFileUrl
  }, [effectiveFileUrl, effectiveFileType, fitToScreen])

  // ===== 피아노 악보 크기 조절 핸들러 =====
  useEffect(() => {
    if (!resizingPianoScore) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizingPianoScore.startX
      const scaleDelta = deltaX / 100 // 100px 이동 = 1.0 스케일 변화
      const newScale = Math.max(0.5, Math.min(2.0, resizingPianoScore.startScale + scaleDelta))

      setPianoScores(prev => prev.map(score =>
        score.id === resizingPianoScore.id
          ? { ...score, scale: newScale }
          : score
      ))
    }

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0]
      const deltaX = touch.clientX - resizingPianoScore.startX
      const scaleDelta = deltaX / 100
      const newScale = Math.max(0.5, Math.min(2.0, resizingPianoScore.startScale + scaleDelta))

      setPianoScores(prev => prev.map(score =>
        score.id === resizingPianoScore.id
          ? { ...score, scale: newScale }
          : score
      ))
    }

    const handleEnd = () => {
      setResizingPianoScore(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleEnd)
    document.addEventListener('touchmove', handleTouchMove)
    document.addEventListener('touchend', handleEnd)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleEnd)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleEnd)
    }
  }, [resizingPianoScore])

  // ===== 필기 렌더링 =====
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 캔버스 클리어
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const pageAnnotation = getCurrentPageAnnotation()

    // 저장된 스트로크 렌더링
    pageAnnotation.strokes.forEach((stroke) => {
      const isSelected = lassoSelection.selectedStrokeIds.includes(stroke.id)
      renderStroke(ctx, stroke, isSelected)
    })

    // 현재 그리는 중인 스트로크
    if (currentStroke.length > 0 && tool !== 'lasso') {
      const tempStroke: Stroke = {
        id: 'temp',
        tool: tool === 'highlighter' ? 'highlighter' : 'pen',
        color,
        size: strokeSize,
        opacity: tool === 'highlighter' ? 0.4 : 1,
        points: currentStroke,
      }
      renderStroke(ctx, tempStroke, false)
    }

    // 올가미 선택 영역 렌더링
    if (lassoSelection.points.length > 2) {
      ctx.save()
      ctx.strokeStyle = '#0066FF'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(lassoSelection.points[0].x, lassoSelection.points[0].y)
      lassoSelection.points.forEach((p, i) => {
        if (i > 0) ctx.lineTo(p.x, p.y)
      })
      ctx.closePath()
      ctx.stroke()
      ctx.restore()
    }

    // 선택된 영역 바운딩 박스
    if (lassoSelection.boundingBox) {
      const bb = lassoSelection.boundingBox
      ctx.save()
      ctx.strokeStyle = '#0066FF'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.strokeRect(bb.x, bb.y, bb.width, bb.height)
      ctx.restore()
    }

    // 텍스트 렌더링
    pageAnnotation.textElements.forEach((textEl) => {
      const isLassoSelected = lassoSelection.selectedTextIds.includes(textEl.id)
      const isTextToolSelected = (tool === 'text' || tool === 'pan') && selectedTextId === textEl.id
      const isSelected = isLassoSelected || isTextToolSelected

      ctx.font = `${textEl.fontSize}px sans-serif`
      ctx.fillStyle = textEl.color

      if (isSelected) {
        ctx.save()
        // 선택된 텍스트에 배경 및 테두리 표시
        const metrics = ctx.measureText(textEl.text)
        const textWidth = metrics.width
        const textHeight = textEl.fontSize
        const padding = 4

        // 선택 배경
        ctx.fillStyle = 'rgba(59, 130, 246, 0.2)' // blue-500 with opacity
        ctx.fillRect(
          textEl.x - padding,
          textEl.y - textHeight - padding,
          textWidth + padding * 2,
          textHeight + padding * 2
        )

        // 선택 테두리
        ctx.strokeStyle = '#3B82F6' // blue-500
        ctx.lineWidth = 2
        ctx.strokeRect(
          textEl.x - padding,
          textEl.y - textHeight - padding,
          textWidth + padding * 2,
          textHeight + padding * 2
        )

        ctx.restore()
      }

      // 텍스트 그리기
      ctx.font = `${textEl.fontSize}px sans-serif`
      ctx.fillStyle = textEl.color
      ctx.fillText(textEl.text, textEl.x, textEl.y)
    })
  }, [annotations, currentStroke, currentPage, tool, color, strokeSize, getCurrentPageAnnotation, lassoSelection, canvasReady, selectedTextId])

  // 스트로크 렌더링 함수
  const renderStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke, isSelected: boolean) => {
    if (stroke.points.length === 0) return

    const points = stroke.points.map((p) => [p.x, p.y, p.pressure || 0.5])

    const strokeOptions = {
      size: stroke.size * (stroke.tool === 'highlighter' ? 8 : 1),
      thinning: stroke.tool === 'highlighter' ? 0 : 0.5,
      smoothing: 0.5,
      streamline: 0.5,
      simulatePressure: !stroke.points[0]?.pressure,
    }

    const outlinePoints = getStroke(points, strokeOptions)
    const pathData = getSvgPathFromStroke(outlinePoints)

    const path = new Path2D(pathData)

    if (isSelected) {
      ctx.save()
      ctx.shadowColor = '#0066FF'
      ctx.shadowBlur = 6
    }

    ctx.globalAlpha = stroke.opacity
    ctx.fillStyle = stroke.color
    ctx.fill(path)
    ctx.globalAlpha = 1

    if (isSelected) {
      ctx.restore()
    }
  }

  // ===== 포인터 좌표 변환 =====
  const getPointerPosition = useCallback(
    (e: React.PointerEvent): StrokePoint => {
      const canvas = canvasRef.current
      if (!canvas) return { x: 0, y: 0, pressure: 0.5 }

      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height

      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
        pressure: e.pressure || 0.5,
      }
    },
    [scale]
  )

  // ===== 지우개 기능 =====
  const eraseAtPosition = useCallback((x: number, y: number) => {
    const eraserRadius = eraserSize * 2 // 캔버스 스케일 고려

    setAnnotations((prev) => {
      return prev.map((pageAnn) => {
        if (pageAnn.pageNumber !== currentPage) return pageAnn

        // 지우개 원 안에 있는 스트로크 찾아서 제거
        const newStrokes = pageAnn.strokes.filter((stroke) => {
          // 스트로크의 점 중 하나라도 지우개 범위 안에 있으면 삭제
          return !stroke.points.some((point) => {
            const dx = point.x - x
            const dy = point.y - y
            return Math.sqrt(dx * dx + dy * dy) < eraserRadius
          })
        })

        return { ...pageAnn, strokes: newStrokes }
      })
    })
  }, [currentPage, eraserSize])

  // ===== 올가미 선택 완료 =====
  const finishLassoSelection = useCallback(() => {
    if (lassoSelection.points.length < 3) {
      setLassoSelection({
        points: [],
        boundingBox: null,
        selectedStrokeIds: [],
        selectedTextIds: [],
      })
      return
    }

    const pageAnnotation = getCurrentPageAnnotation()

    // 선택 영역 안에 있는 스트로크 찾기
    const selectedStrokeIds = pageAnnotation.strokes
      .filter(stroke => isStrokeInSelection(stroke, lassoSelection.points))
      .map(stroke => stroke.id)

    // 선택 영역 안에 있는 텍스트 찾기
    const selectedTextIds = pageAnnotation.textElements
      .filter(text => isPointInPolygon({ x: text.x, y: text.y, pressure: 0.5 }, lassoSelection.points))
      .map(text => text.id)

    if (selectedStrokeIds.length === 0 && selectedTextIds.length === 0) {
      setLassoSelection({
        points: [],
        boundingBox: null,
        selectedStrokeIds: [],
        selectedTextIds: [],
      })
      return
    }

    // 바운딩 박스 계산
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

    pageAnnotation.strokes
      .filter(s => selectedStrokeIds.includes(s.id))
      .forEach(stroke => {
        stroke.points.forEach(p => {
          minX = Math.min(minX, p.x)
          minY = Math.min(minY, p.y)
          maxX = Math.max(maxX, p.x)
          maxY = Math.max(maxY, p.y)
        })
      })

    pageAnnotation.textElements
      .filter(t => selectedTextIds.includes(t.id))
      .forEach(text => {
        minX = Math.min(minX, text.x)
        minY = Math.min(minY, text.y)
        maxX = Math.max(maxX, text.x + 100) // 대략적인 텍스트 너비
        maxY = Math.max(maxY, text.y + text.fontSize)
      })

    setLassoSelection({
      points: [],
      boundingBox: { x: minX - 10, y: minY - 10, width: maxX - minX + 20, height: maxY - minY + 20 },
      selectedStrokeIds,
      selectedTextIds,
    })
  }, [lassoSelection.points, getCurrentPageAnnotation])

  // ===== 선택 영역 이동 =====
  const moveSelection = useCallback((dx: number, dy: number) => {
    setAnnotations((prev) => {
      return prev.map((pageAnn) => {
        if (pageAnn.pageNumber !== currentPage) return pageAnn

        const newStrokes = pageAnn.strokes.map((stroke) => {
          if (!lassoSelection.selectedStrokeIds.includes(stroke.id)) return stroke
          return {
            ...stroke,
            points: stroke.points.map(p => ({
              ...p,
              x: p.x + dx,
              y: p.y + dy,
            })),
          }
        })

        const newTextElements = pageAnn.textElements.map((text) => {
          if (!lassoSelection.selectedTextIds.includes(text.id)) return text
          return {
            ...text,
            x: text.x + dx,
            y: text.y + dy,
          }
        })

        return { ...pageAnn, strokes: newStrokes, textElements: newTextElements }
      })
    })

    // 바운딩 박스도 이동
    if (lassoSelection.boundingBox) {
      setLassoSelection(prev => ({
        ...prev,
        boundingBox: prev.boundingBox ? {
          ...prev.boundingBox,
          x: prev.boundingBox.x + dx,
          y: prev.boundingBox.y + dy,
        } : null,
      }))
    }
  }, [currentPage, lassoSelection.selectedStrokeIds, lassoSelection.selectedTextIds, lassoSelection.boundingBox])

  // 현재 포인터 타입 추적 (pen, touch, mouse)
  const currentPointerTypeRef = useRef<string | null>(null)

  // ===== 포인터 이벤트 핸들러 =====
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      const pos = getPointerPosition(e)
      const pointerType = e.pointerType // 'pen', 'touch', 'mouse'

      // 포인터 타입 저장
      currentPointerTypeRef.current = pointerType

      // 손가락 터치(touch)의 경우: 필기 도구에서는 팬 모드로 동작
      // 펜(Apple Pencil) 또는 마우스는 정상 동작
      const isFingerTouch = pointerType === 'touch'
      const isDrawingTool = tool === 'pen' || tool === 'highlighter' || tool === 'eraser' || tool === 'lasso'

      // 손가락으로 필기 도구 선택 상태에서 터치하면 팬 모드로 전환
      if (isFingerTouch && isDrawingTool) {
        isPanningRef.current = true
        lastPanPositionRef.current = { x: e.clientX, y: e.clientY }
        return
      }

      if (tool === 'pan' || tool === 'text') {
        // 텍스트 도구는 펜/마우스만 허용
        if (isFingerTouch) {
          isPanningRef.current = true
          lastPanPositionRef.current = { x: e.clientX, y: e.clientY }
          return
        }

        // 클릭한 위치에 기존 텍스트가 있는지 확인
        const pageAnnotation = getCurrentPageAnnotation()
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')

        const clickedText = pageAnnotation?.textElements.find(textEl => {
          // 캔버스 measureText로 정확한 텍스트 너비 계산
          let textWidth = textEl.text.length * textEl.fontSize * 0.6 // 기본값
          if (ctx) {
            ctx.font = `${textEl.fontSize}px sans-serif`
            textWidth = ctx.measureText(textEl.text).width
          }
          const textHeight = textEl.fontSize
          const padding = 10

          // 텍스트 박스 영역: (x - padding) ~ (x + width + padding), (y - height - padding) ~ (y + padding)
          const inX = pos.x >= textEl.x - padding && pos.x <= textEl.x + textWidth + padding
          const inY = pos.y >= textEl.y - textHeight - padding && pos.y <= textEl.y + padding

          return inX && inY
        })

        if (clickedText) {
          // 기존 텍스트 클릭
          const now = Date.now()
          const timeSinceLastTap = now - lastTapTimeRef.current
          lastTapTimeRef.current = now

          if (timeSinceLastTap < 300 && selectedTextId === clickedText.id) {
            // 더블클릭 - 편집 모드
            setIsDraggingText(false)
            textDragStartRef.current = null
            setEditingTextId(clickedText.id)
            setTextInput(clickedText.text)
            setTextPosition({ x: clickedText.x, y: clickedText.y })
          } else {
            // 클릭 - 선택 + 드래그 준비 (마우스 누른 상태로 움직이면 드래그)
            setSelectedTextId(clickedText.id)
            setEditingTextId(null)
            setIsDraggingText(true)
            textDragStartRef.current = { x: e.clientX, y: e.clientY }
          }
          return
        }

        // 빈 공간 클릭
        setSelectedTextId(null)
        if (tool === 'text') {
          // text 도구: 새 텍스트 추가
          setTextPosition({ x: pos.x, y: pos.y })
          setIsAddingText(true)
        } else {
          // pan 도구: panning 시작
          isPanningRef.current = true
          lastPanPositionRef.current = { x: e.clientX, y: e.clientY }
        }
        return
      }

      if (tool === 'eraser') {
        isDrawingRef.current = true
        setIsDrawing(true)
        eraseAtPosition(pos.x, pos.y)
        return
      }

      if (tool === 'lasso') {
        // 바운딩 박스 안을 클릭하면 이동 모드
        if (lassoSelection.boundingBox) {
          const bb = lassoSelection.boundingBox
          if (pos.x >= bb.x && pos.x <= bb.x + bb.width &&
              pos.y >= bb.y && pos.y <= bb.y + bb.height) {
            setIsMovingSelection(true)
            setMoveStartPos({ x: pos.x, y: pos.y })
            return
          }
        }
        // 새 선택 시작
        setLassoSelection({
          points: [pos],
          boundingBox: null,
          selectedStrokeIds: [],
          selectedTextIds: [],
        })
        isDrawingRef.current = true
        setIsDrawing(true)
        drawingToolRef.current = 'lasso'
        return
      }

      // 펜/형광펜 드로잉 시작 - 시작 시점의 도구를 저장
      drawingToolRef.current = tool
      isDrawingRef.current = true
      currentStrokeRef.current = [pos]
      setIsDrawing(true)
      setCurrentStroke([pos])
    },
    [tool, getPointerPosition, eraseAtPosition, lassoSelection.boundingBox, getCurrentPageAnnotation, selectedTextId]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const pos = getPointerPosition(e)

      // 손가락 터치로 팬 모드가 활성화된 경우 (도구에 관계없이)
      if (isPanningRef.current) {
        const dx = e.clientX - lastPanPositionRef.current.x
        const dy = e.clientY - lastPanPositionRef.current.y
        setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
        lastPanPositionRef.current = { x: e.clientX, y: e.clientY }
        return
      }

      // 지우개 커서 위치 업데이트
      if (tool === 'eraser') {
        setEraserPosition({ x: e.clientX, y: e.clientY })
        if (isDrawingRef.current) {
          eraseAtPosition(pos.x, pos.y)
        }
        return
      } else {
        setEraserPosition(null)
      }

      if (tool === 'lasso') {
        if (isMovingSelection && moveStartPos) {
          const dx = pos.x - moveStartPos.x
          const dy = pos.y - moveStartPos.y
          moveSelection(dx, dy)
          setMoveStartPos({ x: pos.x, y: pos.y })
          return
        }
        if (isDrawingRef.current) {
          setLassoSelection(prev => ({
            ...prev,
            points: [...prev.points, pos],
          }))
          return
        }
      }

      // 텍스트 드래그 처리 (text 또는 pan 모드)
      if ((tool === 'text' || tool === 'pan') && isDraggingText && selectedTextId && textDragStartRef.current) {
        const dx = (e.clientX - textDragStartRef.current.x) / scale
        const dy = (e.clientY - textDragStartRef.current.y) / scale
        textDragStartRef.current = { x: e.clientX, y: e.clientY }

        setAnnotations(prev => prev.map(a => {
          if (a.pageNumber !== currentPage) return a
          return {
            ...a,
            textElements: a.textElements.map(t => {
              if (t.id !== selectedTextId) return t
              return { ...t, x: t.x + dx, y: t.y + dy }
            })
          }
        }))
        return
      }

      if (!isDrawingRef.current) return

      // ref에만 즉시 추가 (동기적)
      currentStrokeRef.current.push(pos)

      // requestAnimationFrame으로 렌더링 최적화 (프레임당 한번만)
      if (!needsRenderRef.current) {
        needsRenderRef.current = true
        rafIdRef.current = requestAnimationFrame(() => {
          if (isDrawingRef.current) {
            setCurrentStroke([...currentStrokeRef.current])
          }
          needsRenderRef.current = false
        })
      }
    },
    [tool, getPointerPosition, eraseAtPosition, isMovingSelection, moveStartPos, moveSelection, isDraggingText, selectedTextId, scale, currentPage]
  )

  const handlePointerUp = useCallback(() => {
    // 손가락 터치 팬 모드 종료 (도구에 관계없이)
    if (isPanningRef.current) {
      isPanningRef.current = false
      currentPointerTypeRef.current = null
      return
    }

    // 드로잉 시작 시 저장했던 도구 사용 (도구 전환 시에도 올바르게 저장)
    const usedTool = drawingToolRef.current || tool

    if (usedTool === 'pan' || tool === 'pan') {
      isPanningRef.current = false
      // 텍스트 드래그 중이면 드래그 종료 처리
      if (isDraggingText) {
        setIsDraggingText(false)
        textDragStartRef.current = null
        saveToHistory()
      }
      return
    }

    if (usedTool === 'eraser' || tool === 'eraser') {
      isDrawingRef.current = false
      setIsDrawing(false)
      drawingToolRef.current = null
      saveToHistory()
      return
    }

    if (usedTool === 'lasso') {
      if (isMovingSelection) {
        setIsMovingSelection(false)
        setMoveStartPos(null)
        saveToHistory()
        drawingToolRef.current = null
        return
      }
      if (isDrawingRef.current) {
        isDrawingRef.current = false
        setIsDrawing(false)
        finishLassoSelection()
        drawingToolRef.current = null
        return
      }
      drawingToolRef.current = null
      return
    }

    // 텍스트 도구 - 드래그 종료
    if (tool === 'text') {
      if (isDraggingText) {
        setIsDraggingText(false)
        textDragStartRef.current = null
        saveToHistory()
      }
      return
    }

    // ref를 사용해서 동기적으로 체크
    if (!isDrawingRef.current || currentStrokeRef.current.length === 0) {
      isDrawingRef.current = false
      currentStrokeRef.current = []
      setIsDrawing(false)
      setCurrentStroke([])
      drawingToolRef.current = null
      return
    }

    // 스트로크 저장 - 드로잉 시작 시점의 도구 사용
    const newStroke: Stroke = {
      id: `stroke-${Date.now()}`,
      tool: usedTool === 'highlighter' ? 'highlighter' : 'pen',
      color,
      size: strokeSize,
      opacity: usedTool === 'highlighter' ? 0.4 : 1,
      points: currentStrokeRef.current, // ref 사용
    }

    setAnnotations((prev) => {
      const existing = prev.find((a) => a.pageNumber === currentPage)
      if (existing) {
        return prev.map((a) =>
          a.pageNumber === currentPage
            ? { ...a, strokes: [...a.strokes, newStroke] }
            : a
        )
      } else {
        return [
          ...prev,
          {
            pageNumber: currentPage,
            strokes: [newStroke],
            textElements: [],
          },
        ]
      }
    })

    // 대기 중인 렌더링 취소
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
    needsRenderRef.current = false

    // refs 먼저 리셋 (동기적)
    isDrawingRef.current = false
    currentStrokeRef.current = []
    drawingToolRef.current = null

    // state도 업데이트 (비동기)
    setCurrentStroke([])
    setIsDrawing(false)

    // 히스토리에 추가
    saveToHistory()
  }, [tool, color, strokeSize, currentPage, isMovingSelection, finishLassoSelection, isDraggingText])

  // ===== 텍스트 추가 =====
  const addTextElement = useCallback(() => {
    if (!textInput.trim()) {
      setIsAddingText(false)
      return
    }

    const newText: TextElement = {
      id: `text-${Date.now()}`,
      x: textPosition.x,
      y: textPosition.y,
      text: textInput,
      fontSize: 24,
      color,
    }

    setAnnotations((prev) => {
      const existing = prev.find((a) => a.pageNumber === currentPage)
      if (existing) {
        return prev.map((a) =>
          a.pageNumber === currentPage
            ? { ...a, textElements: [...a.textElements, newText] }
            : a
        )
      } else {
        return [
          ...prev,
          {
            pageNumber: currentPage,
            strokes: [],
            textElements: [newText],
          },
        ]
      }
    })

    setTextInput('')
    setIsAddingText(false)
    saveToHistory()
  }, [textInput, textPosition, color, currentPage])

  const handleTextDragMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDraggingText || !selectedTextId || !textDragStartRef.current) return

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    const dx = (clientX - textDragStartRef.current.x) / scale
    const dy = (clientY - textDragStartRef.current.y) / scale

    textDragStartRef.current = { x: clientX, y: clientY }

    setAnnotations(prev => prev.map(a => {
      if (a.pageNumber !== currentPage) return a
      return {
        ...a,
        textElements: a.textElements.map(t => {
          if (t.id !== selectedTextId) return t
          return { ...t, x: t.x + dx, y: t.y + dy }
        })
      }
    }))
  }, [isDraggingText, selectedTextId, scale, currentPage])

  const handleTextDragEnd = useCallback(() => {
    if (isDraggingText) {
      setIsDraggingText(false)
      textDragStartRef.current = null
      saveToHistory()
    }
  }, [isDraggingText])

  // 편집 완료 시 텍스트 업데이트
  const updateTextElement = useCallback(() => {
    if (!editingTextId || !textInput.trim()) {
      setEditingTextId(null)
      setTextInput('')
      return
    }

    setAnnotations(prev => prev.map(a => {
      if (a.pageNumber !== currentPage) return a
      return {
        ...a,
        textElements: a.textElements.map(t => {
          if (t.id !== editingTextId) return t
          return { ...t, text: textInput }
        })
      }
    }))

    setEditingTextId(null)
    setTextInput('')
    saveToHistory()
  }, [editingTextId, textInput, currentPage])

  // ===== 히스토리 관리 =====
  const saveToHistory = useCallback(() => {
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1)
      newHistory.push([...annotations])
      return newHistory
    })
    setHistoryIndex((prev) => prev + 1)
  }, [annotations, historyIndex])

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex((prev) => prev - 1)
      setAnnotations(history[historyIndex - 1])
    }
  }, [history, historyIndex])

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex((prev) => prev + 1)
      setAnnotations(history[historyIndex + 1])
    }
  }, [history, historyIndex])

  // ===== 줌 컨트롤 =====
  const handleZoom = useCallback((delta: number) => {
    setScale((prev) => Math.max(0.2, Math.min(3, prev + delta)))
  }, [])

  // 화면에 맞추기 버튼용
  const handleFitToScreen = useCallback(() => {
    if (canvasSize.width > 0 && canvasSize.height > 0) {
      fitToScreen(canvasSize.width, canvasSize.height)
    }
  }, [canvasSize, fitToScreen])

  // 보기 모드에서 화면 클릭 핸들러 (페이지 넘기기 + 상단바 토글)
  // 터치 디바이스에서는 handleTouchEnd에서 처리하므로 여기서는 마우스만 처리
  const handleViewModeClick = useCallback((e: React.MouseEvent) => {
    if (!isViewMode) return

    // 터치 탭이 이미 처리되었으면 클릭 이벤트 무시 (중복 방지)
    if (touchTapHandled.current) {
      touchTapHandled.current = false
      return
    }

    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const containerWidth = rect.width

    // 화면을 3등분: 왼쪽 30% / 중앙 40% / 오른쪽 30%
    const leftZone = containerWidth * 0.3
    const rightZone = containerWidth * 0.7

    if (clickX < leftZone) {
      // 왼쪽 클릭: 이전 페이지/이전 곡
      if (totalPages > 1 && currentPage > 1) {
        setCurrentPage(p => p - 1)
      } else if (isMultiSongMode && currentSongIndex > 0) {
        setCurrentSongIndex(i => i - 1)
        // 이전 곡의 마지막 페이지로 이동
        setCurrentPage(1) // 실제로는 이전 곡의 totalPages를 알아야 하지만 일단 1페이지로
      }
    } else if (clickX > rightZone) {
      // 오른쪽 클릭: 다음 페이지/다음 곡
      if (totalPages > 1 && currentPage < totalPages) {
        setCurrentPage(p => p + 1)
      } else if (isMultiSongMode && currentSongIndex < songs.length - 1) {
        setCurrentSongIndex(i => i + 1)
        setCurrentPage(1)
      }
    } else {
      // 중앙 클릭: 상단바 토글
      setHideToolbar(prev => !prev)
    }
  }, [isViewMode, totalPages, currentPage, isMultiSongMode, currentSongIndex, songs.length])

  // 마우스 휠로 줌 (데스크톱)
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      handleZoom(delta)
    }
  }, [handleZoom])

  // 핀치 투 줌 & 스와이프 페이지 넘기기 (모바일/태블릿)
  const lastTouchDistance = useRef<number | null>(null)
  const swipeStartX = useRef<number | null>(null)
  const swipeStartY = useRef<number | null>(null)
  const isSwiping = useRef<boolean>(false)
  const touchTapHandled = useRef<boolean>(false) // 터치 탭 처리 후 클릭 이벤트 방지용

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // 핀치 줌 시작
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      lastTouchDistance.current = Math.sqrt(dx * dx + dy * dy)
      isSwiping.current = false
    } else if (e.touches.length === 1 && isViewMode) {
      // 스와이프 시작 (보기 모드에서만)
      swipeStartX.current = e.touches[0].clientX
      swipeStartY.current = e.touches[0].clientY
      isSwiping.current = true
    }
  }, [isViewMode])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDistance.current !== null) {
      // 핀치 줌
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const distance = Math.sqrt(dx * dx + dy * dy)
      const delta = (distance - lastTouchDistance.current) * 0.005
      handleZoom(delta)
      lastTouchDistance.current = distance
      isSwiping.current = false
    }
  }, [handleZoom])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    // 핀치 줌 종료
    lastTouchDistance.current = null

    // 스와이프/탭 감지 (보기 모드에서만)
    if (isSwiping.current && swipeStartX.current !== null && swipeStartY.current !== null && e.changedTouches.length > 0) {
      const endX = e.changedTouches[0].clientX
      const endY = e.changedTouches[0].clientY
      const deltaX = endX - swipeStartX.current
      const deltaY = endY - swipeStartY.current

      // 수평 스와이프가 수직보다 크고, 최소 50px 이상 이동했을 때
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
        if (deltaX > 0) {
          // 오른쪽 스와이프 -> 이전 페이지/이전 곡
          if (totalPages > 1 && currentPage > 1) {
            setCurrentPage(p => p - 1)
          } else if (isMultiSongMode && currentSongIndex > 0) {
            setCurrentSongIndex(i => i - 1)
          }
        } else {
          // 왼쪽 스와이프 -> 다음 페이지/다음 곡
          if (totalPages > 1 && currentPage < totalPages) {
            setCurrentPage(p => p + 1)
          } else if (isMultiSongMode && currentSongIndex < songs.length - 1) {
            setCurrentSongIndex(i => i + 1)
          }
        }
      } else if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
        // 탭 감지 (거의 움직이지 않음) - 영역별 동작
        const container = containerRef.current
        if (container) {
          const rect = container.getBoundingClientRect()
          const tapX = endX - rect.left
          const containerWidth = rect.width

          // 화면을 3등분: 왼쪽 30% / 중앙 40% / 오른쪽 30%
          const leftZone = containerWidth * 0.3
          const rightZone = containerWidth * 0.7

          // 터치 탭 처리 플래그 설정 (onClick 중복 방지)
          touchTapHandled.current = true

          if (tapX < leftZone) {
            // 왼쪽 탭: 이전 페이지/이전 곡
            if (totalPages > 1 && currentPage > 1) {
              setCurrentPage(p => p - 1)
            } else if (isMultiSongMode && currentSongIndex > 0) {
              setCurrentSongIndex(i => i - 1)
            }
          } else if (tapX > rightZone) {
            // 오른쪽 탭: 다음 페이지/다음 곡
            if (totalPages > 1 && currentPage < totalPages) {
              setCurrentPage(p => p + 1)
            } else if (isMultiSongMode && currentSongIndex < songs.length - 1) {
              setCurrentSongIndex(i => i + 1)
            }
          } else {
            // 중앙 탭: 상단바 토글
            setHideToolbar(prev => !prev)
          }
        }
      }
    }

    // 스와이프 상태 초기화
    swipeStartX.current = null
    swipeStartY.current = null
    isSwiping.current = false
  }, [totalPages, currentPage, isMultiSongMode, currentSongIndex, songs.length])

  // 뷰 모드일 때 캔버스 로드 완료시 자동으로 화면에 맞추기
  // hideToolbar 변경 시에도 화면에 맞추기 (상단바 숨김/표시 시 레이아웃 변경)
  useEffect(() => {
    if (isViewMode && canvasReady && canvasSize.width > 0 && canvasSize.height > 0) {
      // 레이아웃 변경 후 DOM 업데이트를 기다린 후 fitToScreen 호출
      const timer = setTimeout(() => {
        fitToScreen(canvasSize.width, canvasSize.height)
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [isViewMode, canvasReady, canvasSize.width, canvasSize.height, fitToScreen, hideToolbar])

  // ===== 송폼/파트 태그 드래그 핸들러 =====
  const handleFormDragMove = useCallback((e: React.MouseEvent) => {
    if (!draggingFormItem || !pdfCanvasRef.current) return

    const canvas = pdfCanvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100))
    const y = Math.max(3, Math.min(97, ((e.clientY - rect.top) / rect.height) * 100))

    if (draggingFormItem.type === 'songForm') {
      setSongFormStyle(prev => ({ ...prev, x, y }))
    } else if (draggingFormItem.type === 'partTag' && draggingFormItem.id) {
      setPartTags(prev =>
        prev.map(tag =>
          tag.id === draggingFormItem.id ? { ...tag, x, y } : tag
        )
      )
    } else if (draggingFormItem.type === 'pianoScore' && draggingFormItem.id) {
      setPianoScores(prev =>
        prev.map(score =>
          score.id === draggingFormItem.id ? { ...score, x, y } : score
        )
      )
    }
  }, [draggingFormItem])

  const handleFormDragEnd = useCallback(() => {
    setDraggingFormItem(null)
  }, [])

  // 📱 터치용 송폼/파트 태그 드래그 핸들러 (아이패드 지원)
  const handleFormTouchMove = useCallback((e: React.TouchEvent) => {
    if (!draggingFormItem || !pdfCanvasRef.current) return
    e.preventDefault()

    const touch = e.touches[0]
    const canvas = pdfCanvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = Math.max(5, Math.min(95, ((touch.clientX - rect.left) / rect.width) * 100))
    const y = Math.max(3, Math.min(97, ((touch.clientY - rect.top) / rect.height) * 100))

    if (draggingFormItem.type === 'songForm') {
      setSongFormStyle(prev => ({ ...prev, x, y }))
    } else if (draggingFormItem.type === 'partTag' && draggingFormItem.id) {
      setPartTags(prev =>
        prev.map(tag =>
          tag.id === draggingFormItem.id ? { ...tag, x, y } : tag
        )
      )
    } else if (draggingFormItem.type === 'pianoScore' && draggingFormItem.id) {
      setPianoScores(prev =>
        prev.map(score =>
          score.id === draggingFormItem.id ? { ...score, x, y } : score
        )
      )
    }
  }, [draggingFormItem])

  const handleFormTouchEnd = useCallback(() => {
    setDraggingFormItem(null)
  }, [])

  const handlePartTagDrop = useCallback((e: React.DragEvent) => {
    if (!draggingNewPartTag || !pdfCanvasRef.current) return
    e.preventDefault()

    const canvas = pdfCanvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100))
    const y = Math.max(5, Math.min(95, ((e.clientY - rect.top) / rect.height) * 100))

    const newTag: PartTagStyle = {
      id: `${draggingNewPartTag}-${Date.now()}`,
      label: draggingNewPartTag,
      x,
      y,
      fontSize: 28,
      color: PART_COLORS[draggingNewPartTag] || '#6B7280',
      opacity: 1,
      pageIndex: currentPage - 1
    }

    setPartTags(prev => [...prev, newTag])
    setDraggingNewPartTag(null)
  }, [draggingNewPartTag, currentPage])

  // ===== 저장 =====
  const handleSave = useCallback(() => {
    // annotationsRef.current를 사용하여 항상 최신 상태를 가져옴
    const currentAnnotations = annotationsRef.current

    if (isMultiSongMode) {
      // 다중 곡 모드: 모든 곡의 annotations 및 songForm 상태 저장
      // 현재 곡의 annotations와 songForm 상태를 최신 상태로 반영
      const updatedAllAnnotations = {
        ...allAnnotations,
        ...(currentSong ? { [currentSong.song_id]: currentAnnotations } : {})
      }

      const updatedAllSongFormStates = {
        ...allSongFormStates,
        ...(currentSong ? {
          [currentSong.song_id]: {
            enabled: songFormEnabled,
            style: songFormStyle,
            partTags: partTags
          }
        } : {})
      }

      const dataToSave = songs.map(song => {
        const formState = updatedAllSongFormStates[song.song_id] || {
          enabled: (song.songForms?.length || 0) > 0,
          style: { x: 50, y: 5, fontSize: 36, color: '#7C3AED', opacity: 1 },
          partTags: []
        }
        return {
          song,
          annotations: updatedAllAnnotations[song.song_id] || [],
          extra: {
            songFormEnabled: formState.enabled,
            songFormStyle: formState.style,
            partTags: formState.partTags,
            pianoScores: pianoScores.filter(s => s.pageIndex >= 0) // 다중 곡 모드에서도 피아노 악보 포함
          }
        }
      })

      onSaveAll?.(dataToSave)
    } else {
      // 송폼 정보와 피아노 악보도 함께 전달
      onSave?.(currentAnnotations, { songFormEnabled, songFormStyle, partTags, pianoScores })
    }
  }, [isMultiSongMode, onSave, songs, allAnnotations, onSaveAll, currentSong, songFormEnabled, songFormStyle, partTags, pianoScores])

  // ===== 내보내기 (PDF/이미지) - 캔버스 기반으로 화면 그대로 렌더링 =====
  const handleExport = useCallback(async (format: 'pdf' | 'image') => {
    setExporting(true)
    setShowExportModal(false)

    try {
      const { jsPDF } = await import('jspdf')

      // 내보낼 곡 목록 결정 (다중 곡 모드면 모든 곡, 단일 곡이면 현재 곡만)
      const songsToExport = isMultiSongMode ? songs : [{
        song_id: 'single',
        song_name: songName,
        team_name: artistName,
        file_url: fileUrl,
        file_type: fileType,
        songForms: songForms,
      }]

      // 렌더링할 페이지 데이터 수집
      type PageExportData = {
        songName: string
        pageNum: number
        imageDataUrl: string
        width: number
        height: number
      }
      const allPages: PageExportData[] = []

      for (const song of songsToExport) {
        // 각 곡의 어노테이션 가져오기
        const songAnnotations = isMultiSongMode
          ? (allAnnotations[song.song_id] || [])
          : annotationsRef.current

        // PDF인 경우 페이지 수 계산 필요
        let songTotalPages = 1
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let pdfDoc: any = null

        if (song.file_type === 'pdf') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pdfjsLib = (window as any).pdfjsLib
          if (pdfjsLib) {
            pdfDoc = await pdfjsLib.getDocument(song.file_url).promise
            songTotalPages = pdfDoc.numPages
          }
        }

        // 각 페이지 렌더링
        for (let pageNum = 1; pageNum <= songTotalPages; pageNum++) {
          const exportCanvas = document.createElement('canvas')
          const ctx = exportCanvas.getContext('2d')
          if (!ctx) continue

          let baseWidth = 0
          let baseHeight = 0

          // 1. 원본 이미지/PDF 렌더링
          if (song.file_type === 'pdf' && pdfDoc) {
            const page = await pdfDoc.getPage(pageNum)
            const viewport = page.getViewport({ scale: 2 })
            baseWidth = viewport.width
            baseHeight = viewport.height
            exportCanvas.width = baseWidth
            exportCanvas.height = baseHeight

            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, baseWidth, baseHeight)

            await page.render({
              canvasContext: ctx,
              viewport: viewport
            }).promise
          } else {
            // 이미지인 경우
            const img = new Image()
            img.crossOrigin = 'anonymous'
            await new Promise<void>((resolve, reject) => {
              img.onload = () => resolve()
              img.onerror = reject
              img.src = song.file_url
            })
            baseWidth = img.width * 2
            baseHeight = img.height * 2
            exportCanvas.width = baseWidth
            exportCanvas.height = baseHeight

            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, baseWidth, baseHeight)
            ctx.drawImage(img, 0, 0, baseWidth, baseHeight)
          }

          // 2. 송폼 렌더링 (활성화된 경우, 첫 페이지에만)
          if (pageNum === 1 && songFormEnabled && song.songForms && song.songForms.length > 0) {
            const songFormText = song.songForms.join(' - ')
            const adjustedFontSize = (songFormStyle.fontSize / 36) * (baseHeight * 0.025)
            ctx.font = `900 ${adjustedFontSize}px Arial, sans-serif`
            ctx.fillStyle = songFormStyle.color
            ctx.globalAlpha = songFormStyle.opacity
            ctx.textAlign = 'center'
            ctx.textBaseline = 'top'

            const formX = (songFormStyle.x / 100) * baseWidth
            const formY = (songFormStyle.y / 100) * baseHeight
            ctx.fillText(songFormText, formX, formY)
            ctx.globalAlpha = 1
          }

          // 3. 파트 태그 렌더링 (해당 페이지의 태그만)
          const pageTags = partTags.filter(tag =>
            tag.pageIndex === undefined || tag.pageIndex === pageNum - 1
          )
          pageTags.forEach(tag => {
            const adjustedFontSize = (tag.fontSize / 36) * (baseHeight * 0.025)
            ctx.font = `bold ${adjustedFontSize}px Arial, sans-serif`
            ctx.fillStyle = tag.color
            ctx.globalAlpha = tag.opacity
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'

            const tagX = (tag.x / 100) * baseWidth
            const tagY = (tag.y / 100) * baseHeight
            ctx.fillText(tag.label, tagX, tagY)
            ctx.globalAlpha = 1
          })

          // 3.5. 피아노 악보 렌더링 (해당 페이지의 악보만)
          const pageScores = pianoScores.filter(score => score.pageIndex === pageNum - 1)
          pageScores.forEach(score => {
            // measureWidths가 있으면 합산, 없으면 기본값 사용
            const defaultWidth = score.measureCount === 1 ? 100 : 70
            const measureWidths = score.measureWidths || Array(score.measureCount).fill(defaultWidth)
            const scoreWidth = measureWidths.reduce((sum, w) => sum + w * 0.7, 0) // 0.7은 편집 화면 대비 비율
            const scoreHeight = 80
            const baseScaleFactor = baseHeight * 0.001
            const userScale = score.scale || 1.0
            const scaleFactor = baseScaleFactor * userScale

            const scoreX = (score.x / 100) * baseWidth
            const scoreY = (score.y / 100) * baseHeight

            // 배경
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
            const bgWidth = scoreWidth * scaleFactor + 8
            const bgHeight = scoreHeight * scaleFactor + 8
            ctx.fillRect(scoreX - bgWidth / 2, scoreY - bgHeight / 2, bgWidth, bgHeight)

            // 오프셋 계산 (중앙 정렬)
            const offsetX = scoreX - (scoreWidth * scaleFactor) / 2
            const offsetY = scoreY - (scoreHeight * scaleFactor) / 2

            // 코드 이름 (여러 개 지원)
            ctx.font = `bold ${10 * scaleFactor}px Arial, sans-serif`
            ctx.fillStyle = '#000000'
            ctx.textBaseline = 'top'

            if (score.chords && score.chords.length > 0) {
              ctx.textAlign = 'center'
              score.chords.forEach(chord => {
                const chordX = offsetX + (chord.position / 100) * scoreWidth * scaleFactor
                ctx.fillText(chord.name, chordX, offsetY + 2 * scaleFactor)
              })
            } else if (score.chordName) {
              ctx.textAlign = 'left'
              ctx.fillText(score.chordName, offsetX + 5 * scaleFactor, offsetY + 2 * scaleFactor)
            }

            // 오선 (5줄)
            ctx.strokeStyle = '#333333'
            ctx.lineWidth = 0.8 * scaleFactor
            for (let i = 0; i < 5; i++) {
              const lineY = offsetY + (22 + i * 10) * scaleFactor
              ctx.beginPath()
              ctx.moveTo(offsetX + 3 * scaleFactor, lineY)
              ctx.lineTo(offsetX + (scoreWidth - 3) * scaleFactor, lineY)
              ctx.stroke()
            }

            // 세로줄 (마디 구분) - measureWidths 기반
            ctx.beginPath()
            ctx.moveTo(offsetX + 3 * scaleFactor, offsetY + 22 * scaleFactor)
            ctx.lineTo(offsetX + 3 * scaleFactor, offsetY + 62 * scaleFactor)
            ctx.stroke()

            // 중간 마디선 - measureWidths 기반
            if (score.measureCount > 1) {
              let accumulatedWidth = 0
              for (let i = 0; i < score.measureCount - 1; i++) {
                accumulatedWidth += measureWidths[i] * 0.7
                const barX = offsetX + accumulatedWidth * scaleFactor
                ctx.beginPath()
                ctx.moveTo(barX, offsetY + 22 * scaleFactor)
                ctx.lineTo(barX, offsetY + 62 * scaleFactor)
                ctx.stroke()
              }
            }

            ctx.lineWidth = 1.5 * scaleFactor
            ctx.beginPath()
            ctx.moveTo(offsetX + (scoreWidth - 3) * scaleFactor, offsetY + 22 * scaleFactor)
            ctx.lineTo(offsetX + (scoreWidth - 3) * scaleFactor, offsetY + 62 * scaleFactor)
            ctx.stroke()

            // 음표 - 오선 기준 (첫째 줄 22, 간격 10, 음표 간격 5)
            const pitchToY: { [key: string]: number } = {
              'A5': 12, 'G5': 17, 'F5': 22, 'E5': 27, 'D5': 32,
              'C5': 37, 'B4': 42, 'A4': 47, 'G4': 52, 'F4': 57,
              'E4': 62, 'D4': 67, 'C4': 72, 'B3': 77, 'A3': 82
            }
            const stemLength = 20

            // Beam 연결선 먼저 그리기 (대각선)
            const beamGroups: { [key: string]: PianoNote[] } = {}
            score.notes.forEach(note => {
              if (note.beamGroup) {
                if (!beamGroups[note.beamGroup]) beamGroups[note.beamGroup] = []
                beamGroups[note.beamGroup].push(note)
              }
            })

            Object.values(beamGroups).forEach(notesInGroup => {
              if (notesInGroup.length < 2) return

              notesInGroup.sort((a, b) => a.position - b.position)

              const firstNote = notesInGroup[0]
              const lastNote = notesInGroup[notesInGroup.length - 1]

              const firstY = pitchToY[firstNote.pitch] || 47
              const lastY = pitchToY[lastNote.pitch] || 47
              const avgY = (firstY + lastY) / 2
              const stemUp = avgY >= 42

              const firstX = (firstNote.position / 100) * scoreWidth
              const lastX = (lastNote.position / 100) * scoreWidth

              // 각 음표의 기둥 끝 위치 계산 (대각선 beam)
              const firstBeamY = stemUp ? firstY - stemLength : firstY + stemLength
              const lastBeamY = stemUp ? lastY - stemLength : lastY + stemLength

              const hasEighth = notesInGroup.some(n => (n.duration || 4) >= 8)
              const hasSixteenth = notesInGroup.some(n => (n.duration || 4) >= 16)

              ctx.strokeStyle = '#000000'
              ctx.lineWidth = 3 * scaleFactor

              // 첫 번째 beam (8분음표) - 대각선
              if (hasEighth) {
                ctx.beginPath()
                const stemOffsetX = stemUp ? 4 : -4
                ctx.moveTo(offsetX + (firstX + stemOffsetX) * scaleFactor, offsetY + firstBeamY * scaleFactor)
                ctx.lineTo(offsetX + (lastX + stemOffsetX) * scaleFactor, offsetY + lastBeamY * scaleFactor)
                ctx.stroke()
              }

              // 두 번째 beam (16분음표) - 대각선
              if (hasSixteenth) {
                ctx.beginPath()
                const stemOffsetX = stemUp ? 4 : -4
                const beamOffset = stemUp ? 4 : -4
                ctx.moveTo(offsetX + (firstX + stemOffsetX) * scaleFactor, offsetY + (firstBeamY + beamOffset) * scaleFactor)
                ctx.lineTo(offsetX + (lastX + stemOffsetX) * scaleFactor, offsetY + (lastBeamY + beamOffset) * scaleFactor)
                ctx.stroke()
              }
            })

            // 화음 처리: 비슷한 position의 음표들을 그룹화하여 렌더링
            const pitchOrder = ['A5', 'G5', 'F5', 'E5', 'D5', 'C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4', 'B3', 'A3']
            const CHORD_THRESHOLD = 5
            const chordGroups: PianoNote[][] = []
            const sortedNotes = [...score.notes].sort((a, b) => a.position - b.position)

            sortedNotes.forEach(note => {
              const foundGroup = chordGroups.find(group => {
                const groupAvgPos = group.reduce((sum, n) => sum + n.position, 0) / group.length
                return Math.abs(groupAvgPos - note.position) < CHORD_THRESHOLD
              })
              if (foundGroup) {
                foundGroup.push(note)
              } else {
                chordGroups.push([note])
              }
            })

            chordGroups.forEach(notesInChord => {
              // 화음 내 음표들을 높이순으로 정렬
              notesInChord.sort((a, b) => pitchOrder.indexOf(a.pitch) - pitchOrder.indexOf(b.pitch))

              // 화음의 평균 position으로 baseX 계산
              const avgPosition = notesInChord.reduce((sum, n) => sum + n.position, 0) / notesInChord.length
              const baseX = (avgPosition / 100) * scoreWidth
              const firstNote = notesInChord[0]

              // 화음 전체의 평균 Y로 기둥 방향 결정
              const avgY = notesInChord.reduce((sum, n) => sum + (pitchToY[n.pitch] || 47), 0) / notesInChord.length
              const hasBeam = notesInChord.some(n => n.beamGroup)
              let stemUp = avgY >= 42
              if (hasBeam) {
                const beamGroup = notesInChord.find(n => n.beamGroup)?.beamGroup
                if (beamGroup) {
                  const beamNotes = score.notes.filter(n => n.beamGroup === beamGroup)
                  const beamAvgY = beamNotes.reduce((sum, n) => sum + (pitchToY[n.pitch] || 47), 0) / beamNotes.length
                  stemUp = beamAvgY >= 42
                }
              }

              // 인접한 음표 x 오프셋 계산
              const noteOffsets: number[] = []
              for (let i = 0; i < notesInChord.length; i++) {
                const currentPitchIdx = pitchOrder.indexOf(notesInChord[i].pitch)
                let needsOffset = false
                if (i > 0) {
                  const prevPitchIdx = pitchOrder.indexOf(notesInChord[i - 1].pitch)
                  if (Math.abs(currentPitchIdx - prevPitchIdx) === 1 && noteOffsets[i - 1] === 0) {
                    needsOffset = true
                  }
                }
                noteOffsets.push(needsOffset ? (stemUp ? -8 : 8) : 0)
              }

              const highestY = Math.min(...notesInChord.map(n => pitchToY[n.pitch] || 47))
              const lowestY = Math.max(...notesInChord.map(n => pitchToY[n.pitch] || 47))

              const duration = firstNote.duration || 4
              const isFilled = duration >= 4
              const hasStem = duration >= 2
              const isBeamed = notesInChord.some(n => n.beamGroup)
              const showFlag = !isBeamed && duration >= 8
              const stemX = stemUp ? baseX + 4 : baseX - 4

              // 각 음표 머리 렌더링
              notesInChord.forEach((note, i) => {
                const noteY = pitchToY[note.pitch] || 47
                const xOffset = noteOffsets[i]
                const noteXRatio = baseX + xOffset
                const needsLedgerLine = ['C4', 'D4', 'A5', 'B3', 'A3'].includes(note.pitch)
                const ledgerLineY = note.pitch === 'C4' || note.pitch === 'D4' ? 72
                  : note.pitch === 'A5' ? 12
                  : note.pitch === 'B3' ? 77
                  : note.pitch === 'A3' ? 82 : noteY

                // 보조선
                if (needsLedgerLine) {
                  ctx.strokeStyle = '#333333'
                  ctx.lineWidth = 0.8 * scaleFactor
                  ctx.beginPath()
                  ctx.moveTo(offsetX + (noteXRatio - 8) * scaleFactor, offsetY + ledgerLineY * scaleFactor)
                  ctx.lineTo(offsetX + (noteXRatio + 8) * scaleFactor, offsetY + ledgerLineY * scaleFactor)
                  ctx.stroke()
                }

                // 음표 머리
                ctx.beginPath()
                ctx.ellipse(
                  offsetX + noteXRatio * scaleFactor,
                  offsetY + noteY * scaleFactor,
                  5 * scaleFactor,
                  3.5 * scaleFactor,
                  0, 0, Math.PI * 2
                )
                if (isFilled) {
                  ctx.fillStyle = '#000000'
                  ctx.fill()
                } else {
                  ctx.strokeStyle = '#000000'
                  ctx.lineWidth = 1 * scaleFactor
                  ctx.stroke()
                }
              })

              // 기둥 - 화음 전체에 하나만
              if (hasStem) {
                ctx.strokeStyle = '#000000'
                ctx.lineWidth = 1 * scaleFactor
                ctx.beginPath()
                ctx.moveTo(offsetX + stemX * scaleFactor, offsetY + (stemUp ? lowestY : highestY) * scaleFactor)
                ctx.lineTo(offsetX + stemX * scaleFactor, offsetY + (stemUp ? highestY - stemLength : lowestY + stemLength) * scaleFactor)
                ctx.stroke()

                // 깃발
                if (showFlag) {
                  ctx.lineWidth = 1.5 * scaleFactor
                  ctx.beginPath()
                  if (stemUp) {
                    ctx.moveTo(offsetX + stemX * scaleFactor, offsetY + (highestY - stemLength) * scaleFactor)
                    ctx.quadraticCurveTo(
                      offsetX + (stemX + 8) * scaleFactor, offsetY + (highestY - stemLength + 6) * scaleFactor,
                      offsetX + (stemX + 3) * scaleFactor, offsetY + (highestY - stemLength + 12) * scaleFactor
                    )
                  } else {
                    ctx.moveTo(offsetX + stemX * scaleFactor, offsetY + (lowestY + stemLength) * scaleFactor)
                    ctx.quadraticCurveTo(
                      offsetX + (stemX - 8) * scaleFactor, offsetY + (lowestY + stemLength - 6) * scaleFactor,
                      offsetX + (stemX - 3) * scaleFactor, offsetY + (lowestY + stemLength - 12) * scaleFactor
                    )
                  }
                  ctx.stroke()
                }

                // 두 번째 깃발 - 16분음표
                if (showFlag && duration >= 16) {
                  ctx.beginPath()
                  if (stemUp) {
                    ctx.moveTo(offsetX + stemX * scaleFactor, offsetY + (highestY - stemLength + 5) * scaleFactor)
                    ctx.quadraticCurveTo(
                      offsetX + (stemX + 8) * scaleFactor, offsetY + (highestY - stemLength + 11) * scaleFactor,
                      offsetX + (stemX + 3) * scaleFactor, offsetY + (highestY - stemLength + 17) * scaleFactor
                    )
                  } else {
                    ctx.moveTo(offsetX + stemX * scaleFactor, offsetY + (lowestY + stemLength - 5) * scaleFactor)
                    ctx.quadraticCurveTo(
                      offsetX + (stemX - 8) * scaleFactor, offsetY + (lowestY + stemLength - 11) * scaleFactor,
                      offsetX + (stemX - 3) * scaleFactor, offsetY + (lowestY + stemLength - 17) * scaleFactor
                    )
                  }
                  ctx.stroke()
                }
              }
            })
          })

          // 4. 필기(스트로크) 렌더링
          const pageAnnotation = songAnnotations.find(a => a.pageNumber === pageNum)
          if (pageAnnotation) {
            pageAnnotation.strokes.forEach(stroke => {
              if (stroke.points.length < 2) return

              const strokeOutline = getStroke(stroke.points, {
                size: stroke.size,
                thinning: 0.5,
                smoothing: 0.5,
                streamline: 0.5,
              })

              if (strokeOutline.length < 2) return

              ctx.fillStyle = stroke.color
              ctx.globalAlpha = stroke.opacity
              ctx.beginPath()
              ctx.moveTo(strokeOutline[0][0], strokeOutline[0][1])
              for (let i = 1; i < strokeOutline.length; i++) {
                ctx.lineTo(strokeOutline[i][0], strokeOutline[i][1])
              }
              ctx.closePath()
              ctx.fill()
              ctx.globalAlpha = 1
            })

            // 텍스트 요소 렌더링
            pageAnnotation.textElements.forEach(text => {
              ctx.font = `${text.fontSize}px ${text.fontFamily || 'sans-serif'}`
              ctx.fillStyle = text.color
              ctx.textAlign = 'left'
              ctx.textBaseline = 'top'
              ctx.fillText(text.text, text.x, text.y)
            })
          }

          allPages.push({
            songName: song.song_name,
            pageNum,
            imageDataUrl: exportCanvas.toDataURL('image/png'),
            width: baseWidth,
            height: baseHeight,
          })
        }
      }

      // 파일명 생성
      const dateStr = new Date().toLocaleDateString('ko-KR').replace(/\. /g, '-').replace('.', '')
      const baseName = isMultiSongMode && setlistTitle
        ? `${setlistTitle}_필기_${dateStr}`
        : `${effectiveSongName}_필기_${dateStr}`

      if (format === 'image') {
        // 이미지: 각 페이지를 순차적으로 개별 PNG 파일로 다운로드
        for (let idx = 0; idx < allPages.length; idx++) {
          const page = allPages[idx]
          const link = document.createElement('a')

          // 파일명 생성
          const fileName = allPages.length === 1
            ? `${baseName}.png`
            : songsToExport.length > 1
              ? `${baseName}_${page.songName}_p${page.pageNum}.png`
              : `${baseName}_${idx + 1}.png`

          link.download = fileName
          link.href = page.imageDataUrl
          link.click()

          // 다음 다운로드 전 약간의 딜레이 (브라우저가 연속 다운로드를 처리할 수 있도록)
          if (idx < allPages.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300))
          }
        }
      } else {
        // PDF: 모든 페이지를 하나의 PDF로
        let pdf: import('jspdf').jsPDF | null = null

        allPages.forEach((page, idx) => {
          const imgWidth = page.width
          const imgHeight = page.height
          const orientation = imgWidth > imgHeight ? 'landscape' : 'portrait'

          const pdfWidth = orientation === 'landscape' ? 297 : 210
          const pdfHeight = orientation === 'landscape' ? 210 : 297

          const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight)
          const scaledWidth = imgWidth * ratio
          const scaledHeight = imgHeight * ratio
          const offsetX = (pdfWidth - scaledWidth) / 2
          const offsetY = (pdfHeight - scaledHeight) / 2

          if (idx === 0) {
            pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' })
          } else if (pdf) {
            pdf.addPage([pdfWidth, pdfHeight], orientation)
          }

          if (pdf) {
            pdf.addImage(page.imageDataUrl, 'PNG', offsetX, offsetY, scaledWidth, scaledHeight)
          }
        })

        if (pdf) {
          (pdf as import('jspdf').jsPDF).save(`${baseName}.pdf`)
        }
      }
    } catch (error) {
      console.error('내보내기 실패:', error)
      alert('내보내기에 실패했습니다.')
    } finally {
      setExporting(false)
    }
  }, [isMultiSongMode, songs, songName, artistName, fileUrl, fileType, songForms, allAnnotations, songFormEnabled, songFormStyle, partTags, effectiveSongName, setlistTitle])

  // ===== 전체 지우기 =====
  const clearCurrentPage = useCallback(() => {
    if (!confirm('현재 페이지의 모든 필기를 지우시겠습니까?')) return

    setAnnotations((prev) =>
      prev.map((a) =>
        a.pageNumber === currentPage
          ? { ...a, strokes: [], textElements: [] }
          : a
      )
    )
    saveToHistory()
  }, [currentPage, saveToHistory])

  // 올가미 선택 해제
  const clearLassoSelection = useCallback(() => {
    setLassoSelection({
      points: [],
      boundingBox: null,
      selectedStrokeIds: [],
      selectedTextIds: [],
    })
  }, [])

  // 도구 전환 시 진행 중인 스트로크 저장 후 도구 변경
  const switchTool = useCallback((newTool: Tool) => {
    // 현재 그리는 중인 스트로크가 있으면 먼저 저장 (ref 사용)
    if (isDrawingRef.current && currentStrokeRef.current.length > 0 && drawingToolRef.current) {
      const usedTool = drawingToolRef.current
      const newStroke: Stroke = {
        id: `stroke-${Date.now()}`,
        tool: usedTool === 'highlighter' ? 'highlighter' : 'pen',
        color,
        size: strokeSize,
        opacity: usedTool === 'highlighter' ? 0.4 : 1,
        points: currentStrokeRef.current,
      }

      setAnnotations((prev) => {
        const existing = prev.find((a) => a.pageNumber === currentPage)
        if (existing) {
          return prev.map((a) =>
            a.pageNumber === currentPage
              ? { ...a, strokes: [...a.strokes, newStroke] }
              : a
          )
        } else {
          return [
            ...prev,
            {
              pageNumber: currentPage,
              strokes: [newStroke],
              textElements: [],
            },
          ]
        }
      })

      // refs 먼저 리셋
      isDrawingRef.current = false
      currentStrokeRef.current = []
      drawingToolRef.current = null

      setCurrentStroke([])
      setIsDrawing(false)
    }

    // 도구 변경
    setTool(newTool)
    if (newTool !== 'lasso') {
      clearLassoSelection()
    }
  }, [isDrawing, currentStroke, color, strokeSize, currentPage, clearLassoSelection])

  // 커서 스타일 결정
  const getCursorStyle = () => {
    switch (tool) {
      case 'pan':
        return 'grab'
      case 'eraser':
        return 'none' // 커스텀 커서 사용
      case 'lasso':
        return 'crosshair'
      case 'text':
        return 'text'
      default:
        return 'crosshair'
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-100 z-50 flex flex-col">
      {/* 상단 툴바 - 밝은 테마 (모바일 최적화) */}
      {/* 보기 모드에서 hideToolbar가 true면 숨김 */}
      <div className={`bg-white border-b border-gray-200 shadow-sm ${isMobile ? 'p-1.5' : 'p-2'} ${isViewMode && hideToolbar ? 'hidden' : ''}`}>
        {/* 1줄 레이아웃: 왼쪽(닫기+곡정보) | 중앙(네비게이션) | 오른쪽(모드+버튼) */}
        <div className={`flex items-center ${isMobile ? 'flex-wrap gap-2' : 'justify-between gap-4'}`}>
          {/* 왼쪽: 닫기 + 곡 정보 */}
          <div className={`flex items-center gap-2 ${isMobile ? 'flex-1 min-w-0' : 'flex-shrink-0'}`}>
            <button
              onClick={onClose}
              className={`hover:bg-gray-100 rounded text-gray-700 ${isMobile ? 'p-2.5 text-lg' : 'p-2'}`}
            >
              ✕
            </button>
            <div className="flex flex-col min-w-0">
              {isMultiSongMode && setlistTitle && (
                <span className="text-xs text-purple-600 font-medium truncate">{setlistTitle}</span>
              )}
              <span className={`font-medium truncate text-gray-800 ${isMobile ? 'max-w-[120px] text-sm' : 'max-w-[200px]'}`}>
                {effectiveSongName}
              </span>
              {effectiveArtistName && !isMobile && (
                <span className="text-xs text-gray-500 truncate max-w-[200px]">{effectiveArtistName}</span>
              )}
            </div>
            {isMultiSongMode && (
              <span className={`px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full whitespace-nowrap ${isMobile ? 'ml-1' : 'ml-2'}`}>
                {currentSongIndex + 1}/{songs.length}
              </span>
            )}
            {!isMultiSongMode && queueInfo && (
              <span className="ml-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full whitespace-nowrap">
                {queueInfo.current}/{queueInfo.total}
              </span>
            )}
          </div>

          {/* 중앙: 네비게이션 (데스크톱에서만 첫 번째 줄에 표시) */}
          {!isMobile && (isMultiSongMode || totalPages > 1) && (
            <div className="flex items-center gap-3 flex-1 justify-center">
              {/* 곡 네비게이션 (다중 곡 모드) */}
              {isMultiSongMode && songs.length > 1 && (
                <div className="flex items-center gap-1.5 text-gray-700 bg-purple-50 rounded-lg px-2 py-1">
                  <button
                    onClick={() => setCurrentSongIndex(i => Math.max(0, i - 1))}
                    disabled={currentSongIndex === 0}
                    className="p-1 hover:bg-purple-100 rounded disabled:opacity-30"
                    title="이전 곡"
                  >
                    ⏮
                  </button>
                  <span className="text-sm font-medium text-purple-700 text-center min-w-[70px]">
                    {effectiveSongName.length > 8 ? effectiveSongName.slice(0, 8) + '..' : effectiveSongName}
                  </span>
                  <button
                    onClick={() => setCurrentSongIndex(i => Math.min(songs.length - 1, i + 1))}
                    disabled={currentSongIndex === songs.length - 1}
                    className="p-1 hover:bg-purple-100 rounded disabled:opacity-30"
                    title="다음 곡"
                  >
                    ⏭
                  </button>
                </div>
              )}

              {/* 페이지 네비게이션 (PDF 다중 페이지) */}
              {totalPages > 1 && (
                <div className="flex items-center gap-1.5 text-gray-700 bg-gray-100 rounded-lg px-2 py-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1 hover:bg-gray-200 rounded disabled:opacity-50"
                  >
                    ◀
                  </button>
                  <span className="text-sm font-medium min-w-[40px] text-center">
                    {currentPage}/{totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1 hover:bg-gray-200 rounded disabled:opacity-50"
                  >
                    ▶
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 오른쪽: 모드 전환 + 저장/내보내기 버튼 */}
          <div className={`flex items-center gap-1.5 ${isMobile ? '' : 'gap-2 flex-shrink-0'}`}>
            {!isMultiSongMode && queueInfo && queueInfo.nextSongName && !isMobile && (
              <span className="text-xs text-gray-500">
                다음: {queueInfo.nextSongName}
              </span>
            )}

            {/* 모드 전환 버튼 */}
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setEditorMode('view')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  isViewMode
                    ? 'bg-white shadow text-gray-800'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                title="악보 보기"
              >
                {isMobile ? '👁' : '👁 보기'}
              </button>
              <button
                onClick={() => setEditorMode('edit')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  !isViewMode
                    ? 'bg-white shadow text-gray-800'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                title="필기 모드"
              >
                {isMobile ? '✏️' : '✏️ 필기'}
              </button>
            </div>

            {/* 줌 컨트롤 - 뷰 모드에서 표시 */}
            {isViewMode && (
              <div className={`flex items-center ${isMobile ? 'gap-1' : 'gap-1'} bg-gray-100 rounded-lg px-2 py-1`}>
                <button
                  onClick={() => handleZoom(-0.1)}
                  className={`hover:bg-gray-200 rounded ${isMobile ? 'p-1.5 text-sm' : 'p-1'}`}
                  title="축소"
                >
                  ➖
                </button>
                <button
                  onClick={handleFitToScreen}
                  className={`hover:bg-gray-200 rounded text-xs font-medium ${isMobile ? 'px-1.5 py-1' : 'px-2 py-1'}`}
                  title="화면에 맞추기"
                >
                  {Math.round(scale * 100)}%
                </button>
                <button
                  onClick={() => handleZoom(0.1)}
                  className={`hover:bg-gray-200 rounded ${isMobile ? 'p-1.5 text-sm' : 'p-1'}`}
                  title="확대"
                >
                  ➕
                </button>
              </div>
            )}

            {/* 내보내기/저장 버튼 - 편집 모드에서만 표시 */}
            {!isViewMode && (
              <>
                <button
                  onClick={() => setShowExportModal(true)}
                  className={`bg-green-50 hover:bg-green-100 border border-green-200 rounded font-medium text-green-700 ${
                    isMobile ? 'px-2.5 py-1.5 text-sm' : 'px-4 py-2'
                  }`}
                  disabled={exporting}
                >
                  {exporting ? '...' : (isMobile ? '📤' : '내보내기')}
                </button>
                <button
                  onClick={handleSave}
                  className={`bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded font-medium text-blue-700 ${
                    isMobile ? 'px-2.5 py-1.5 text-sm' : 'px-4 py-2'
                  }`}
                >
                  {isMobile ? '💾' : (isMultiSongMode ? '전체 저장' : (queueInfo && queueInfo.current < queueInfo.total ? '저장 & 다음' : '저장'))}
                </button>
              </>
            )}
          </div>
        </div>

        {/* 모바일에서만 네비게이션 두 번째 줄에 표시 */}
        {isMobile && (isMultiSongMode || totalPages > 1) && (
          <div className="flex items-center justify-center gap-4 mt-1.5 pt-1.5 border-t border-gray-100">
            {/* 곡 네비게이션 (다중 곡 모드) */}
            {isMultiSongMode && songs.length > 1 && (
              <div className="flex items-center gap-2 text-gray-700 bg-purple-50 rounded-lg px-2 py-1">
                <button
                  onClick={() => setCurrentSongIndex(i => Math.max(0, i - 1))}
                  disabled={currentSongIndex === 0}
                  className="p-1.5 hover:bg-purple-100 rounded disabled:opacity-30"
                  title="이전 곡"
                >
                  ⏮
                </button>
                <span className="text-xs font-medium text-purple-700 text-center min-w-[50px]">
                  {effectiveSongName.length > 6 ? effectiveSongName.slice(0, 6) + '..' : effectiveSongName}
                </span>
                <button
                  onClick={() => setCurrentSongIndex(i => Math.min(songs.length - 1, i + 1))}
                  disabled={currentSongIndex === songs.length - 1}
                  className="p-1.5 hover:bg-purple-100 rounded disabled:opacity-30"
                  title="다음 곡"
                >
                  ⏭
                </button>
              </div>
            )}

            {/* 페이지 네비게이션 (PDF 다중 페이지) */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1 text-gray-700 bg-gray-100 rounded-lg px-2 py-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 hover:bg-gray-200 rounded disabled:opacity-50"
                >
                  ◀
                </button>
                <span className="text-sm min-w-[40px] text-center">
                  {currentPage}/{totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 hover:bg-gray-200 rounded disabled:opacity-50"
                >
                  ▶
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 도구 모음 - 밝은 테마 (모바일 최적화) - 편집 모드에서만 표시 */}
      <div className={`bg-gray-50 border-b border-gray-200 flex items-center overflow-x-auto transition-all duration-300 ${
        isViewMode ? 'max-h-0 overflow-hidden opacity-0 p-0 border-b-0' : `${isMobile ? 'p-1.5 gap-2 max-h-20 opacity-100' : 'p-2 gap-4 max-h-20 opacity-100'}`
      }`}>
        {/* 도구 선택 - 굿노트 스타일 순서 */}
        <div className={`flex items-center ${isMobile ? 'gap-0.5' : 'gap-1'}`}>
          {/* 손 모드 (기본) - 화면 이동 */}
          <button
            onClick={() => switchTool('pan')}
            className={`rounded ${tool === 'pan' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200 text-gray-700'} ${isMobile ? 'p-2.5 text-lg' : 'p-2'}`}
            title="이동 (기본)"
          >
            ✋
          </button>

          {/* 올가미 - 모바일에서는 숨김 */}
          {!isMobile && (
            <button
              onClick={() => switchTool('lasso')}
              className={`p-2 rounded ${tool === 'lasso' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200 text-gray-700'}`}
              title="올가미 선택"
            >
              ⭕
            </button>
          )}

          {/* 구분선 */}
          <div className={`bg-gray-300 mx-0.5 ${isMobile ? 'w-px h-5' : 'w-px h-6 mx-1'}`} />

          {/* 펜 */}
          <button
            onClick={() => switchTool('pen')}
            className={`rounded ${tool === 'pen' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200 text-gray-700'} ${isMobile ? 'p-2.5 text-lg' : 'p-2'}`}
            title="펜"
          >
            ✏️
          </button>

          {/* 형광펜 */}
          <button
            onClick={() => switchTool('highlighter')}
            className={`rounded ${tool === 'highlighter' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200 text-gray-700'} ${isMobile ? 'p-2.5 text-lg' : 'p-2'}`}
            title="형광펜"
          >
            🖍️
          </button>

          {/* 지우개 */}
          <button
            onClick={() => switchTool('eraser')}
            className={`rounded ${tool === 'eraser' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200 text-gray-700'} ${isMobile ? 'p-2.5 text-lg' : 'p-2'}`}
            title="지우개"
          >
            🧽
          </button>

          {/* 텍스트 - 모바일에서는 숨김 */}
          {!isMobile && (
            <button
              onClick={() => switchTool('text')}
              className={`p-2 rounded ${tool === 'text' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200 text-gray-700'}`}
              title="텍스트"
            >
              <span className="font-bold">T</span>
            </button>
          )}
        </div>

        {/* 구분선 */}
        <div className={`bg-gray-300 ${isMobile ? 'w-px h-5' : 'w-px h-6'}`} />

        {/* 색상 선택 */}
        {(tool === 'pen' || tool === 'highlighter' || tool === 'text') && (
          <>
            <div className={`flex items-center ${isMobile ? 'gap-1' : 'gap-1'}`}>
              {(tool === 'highlighter' ? HIGHLIGHTER_COLORS : COLORS).slice(0, isMobile ? 4 : undefined).map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`rounded-full border-2 ${
                    color === c ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300'
                  } ${isMobile ? 'w-6 h-6' : 'w-7 h-7'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className={`bg-gray-300 ${isMobile ? 'w-px h-5' : 'w-px h-6'}`} />
          </>
        )}

        {/* 지우개 크기 조절 */}
        {tool === 'eraser' && (
          <>
            <div className="flex items-center gap-1">
              {!isMobile && <span className="text-sm text-gray-600">크기:</span>}
              <input
                type="range"
                min="10"
                max="50"
                value={eraserSize}
                onChange={(e) => setEraserSize(Number(e.target.value))}
                className={isMobile ? 'w-16' : 'w-24'}
              />
              {!isMobile && <span className="text-sm text-gray-500 w-8">{eraserSize}</span>}
            </div>
            <div className={`bg-gray-300 ${isMobile ? 'w-px h-5' : 'w-px h-6'}`} />
          </>
        )}

        {/* 굵기 조절 */}
        {(tool === 'pen' || tool === 'highlighter') && (
          <>
            <div className="flex items-center gap-1">
              {!isMobile && <span className="text-sm text-gray-600">굵기:</span>}
              <input
                type="range"
                min="1"
                max="10"
                value={strokeSize}
                onChange={(e) => setStrokeSize(Number(e.target.value))}
                className={isMobile ? 'w-12' : 'w-20'}
              />
              {!isMobile && <span className="text-sm text-gray-500 w-6">{strokeSize}</span>}
            </div>
            <div className={`bg-gray-300 ${isMobile ? 'w-px h-5' : 'w-px h-6'}`} />
          </>
        )}

        {/* 실행 취소/다시 실행 */}
        <div className={`flex items-center ${isMobile ? 'gap-0' : 'gap-1'}`}>
          <button
            onClick={undo}
            disabled={historyIndex <= 0}
            className={`hover:bg-gray-200 rounded disabled:opacity-30 text-gray-700 ${isMobile ? 'p-2 text-lg' : 'p-2'}`}
            title="실행 취소"
          >
            ↩️
          </button>
          <button
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className={`hover:bg-gray-200 rounded disabled:opacity-30 text-gray-700 ${isMobile ? 'p-2 text-lg' : 'p-2'}`}
            title="다시 실행"
          >
            ↪️
          </button>
        </div>

        {/* 구분선 */}
        <div className={`bg-gray-300 ${isMobile ? 'w-px h-5' : 'w-px h-6'}`} />

        {/* 줌 컨트롤 */}
        <div className={`flex items-center ${isMobile ? 'gap-0' : 'gap-1'}`}>
          <button
            onClick={() => handleZoom(-0.1)}
            className={`hover:bg-gray-200 rounded text-gray-700 ${isMobile ? 'p-2 text-lg' : 'p-2'}`}
            title="축소"
          >
            ➖
          </button>
          <span className={`text-center text-gray-700 ${isMobile ? 'text-xs w-10' : 'text-sm w-12'}`}>
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => handleZoom(0.1)}
            className={`hover:bg-gray-200 rounded text-gray-700 ${isMobile ? 'p-2 text-lg' : 'p-2'}`}
            title="확대"
          >
            ➕
          </button>
        </div>

        {/* 구분선 */}
        <div className={`bg-gray-300 ${isMobile ? 'w-px h-5' : 'w-px h-6'}`} />

        {/* 전체 지우기 */}
        <button
          onClick={clearCurrentPage}
          className={`hover:bg-red-100 rounded text-red-500 ${isMobile ? 'p-2 text-lg' : 'p-2'}`}
          title="전체 지우기"
        >
          🗑️
        </button>

        {/* 송폼 버튼 - songForms가 있을 때만 표시 */}
        {effectiveSongForms.length > 0 && (
          <>
            <div className={`bg-gray-300 ${isMobile ? 'w-px h-5' : 'w-px h-6'}`} />
            <button
              onClick={() => {
                // 송폼이 비활성화 상태면 활성화하고 패널 열기
                if (!songFormEnabled) {
                  setSongFormEnabled(true)
                  setShowSongFormPanel(true)
                } else {
                  // 이미 활성화 상태면 패널만 토글
                  setShowSongFormPanel(!showSongFormPanel)
                }
              }}
              className={`rounded font-medium flex items-center gap-1 ${
                songFormEnabled
                  ? 'bg-purple-100 text-purple-700 border border-purple-300'
                  : 'bg-purple-50 text-purple-600 hover:bg-purple-100'
              } ${isMobile ? 'px-2 py-1.5 text-xs' : 'px-3 py-1.5 text-sm'}`}
              title="송폼 & 파트 태그"
            >
              🎵 {isMobile ? '' : '송폼'} {songFormEnabled ? '✓' : ''}
            </button>
          </>
        )}

        {/* 피아노 악보 버튼 */}
        <>
          <div className={`bg-gray-300 ${isMobile ? 'w-px h-5' : 'w-px h-6'}`} />
          <button
            onClick={() => {
              setShowPianoModal(true)
              setPianoModalStep('measure')
              setEditingPianoScore(null)
              setEditingPianoScoreId(null)
            }}
            className={`rounded font-medium flex items-center gap-1 bg-blue-50 text-blue-600 hover:bg-blue-100 ${isMobile ? 'px-2 py-1.5 text-xs' : 'px-3 py-1.5 text-sm'}`}
            title="피아노 악보 추가"
          >
            🎹 {isMobile ? '' : '피아노'}
          </button>
        </>
      </div>

      {/* 캔버스 영역 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex items-center justify-center bg-gray-400 select-none"
        style={{
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
        }}
        onMouseMove={(e) => {
          if (isDraggingText) {
            handleTextDragMove(e)
          } else {
            handleFormDragMove(e)
          }
        }}
        onMouseUp={() => {
          if (isDraggingText) {
            handleTextDragEnd()
          }
          handleFormDragEnd()
        }}
        onMouseLeave={() => {
          if (isDraggingText) {
            handleTextDragEnd()
          }
          handleFormDragEnd()
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handlePartTagDrop}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={(e) => {
          if (isDraggingText) {
            handleTextDragMove(e)
          }
          handleTouchMove(e)
        }}
        onTouchEnd={(e) => {
          if (isDraggingText) {
            handleTextDragEnd()
          }
          handleTouchEnd(e)
        }}
        onClick={handleViewModeClick}
      >
        <div
          style={{
            transform: `scale(${scale}) translate(${offset.x}px, ${offset.y}px)`,
            transformOrigin: 'center center',
          }}
          className="relative"
        >
          {/* 내보내기용 영역 (캔버스 + 오버레이 포함) */}
          <div ref={exportAreaRef} className="relative">
          {/* PDF/이미지 캔버스 */}
          <canvas
            ref={pdfCanvasRef}
            className="bg-white shadow-2xl"
          />

          {/* 드로잉 캔버스 (오버레이) */}
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0"
            style={{
              cursor: getCursorStyle(),
              touchAction: 'none',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none',
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />

          {/* 텍스트 입력 모달 */}
          {isAddingText && (
            <div
              className="absolute bg-white border-2 border-blue-500 rounded shadow-lg p-2"
              style={{ left: textPosition.x, top: textPosition.y, zIndex: 200 }}
            >
              <input
                ref={textInputRef}
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addTextElement()
                  if (e.key === 'Escape') setIsAddingText(false)
                }}
                placeholder="텍스트 입력..."
                className="border-none outline-none text-black"
                autoFocus
              />
              <button
                onClick={addTextElement}
                className="ml-2 px-2 py-1 bg-blue-500 text-white rounded text-sm"
              >
                확인
              </button>
            </div>
          )}

          {/* 텍스트 편집 모달 (더블 클릭으로 진입) */}
          {editingTextId && (
            <div
              className="absolute bg-white border-2 border-green-500 rounded shadow-lg p-2"
              style={{ left: textPosition.x, top: textPosition.y, zIndex: 200 }}
            >
              <input
                ref={textInputRef}
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') updateTextElement()
                  if (e.key === 'Escape') {
                    setEditingTextId(null)
                    setTextInput('')
                  }
                }}
                placeholder="텍스트 수정..."
                className="border-none outline-none text-black"
                autoFocus
              />
              <button
                onClick={updateTextElement}
                className="ml-2 px-2 py-1 bg-green-500 text-white rounded text-sm"
              >
                완료
              </button>
            </div>
          )}

          {/* 텍스트 요소 선택은 캔버스에서 직접 처리 (handlePointerDown) */}
          {/* 선택된 텍스트는 캔버스에서 파란 테두리로 표시됨 */}

          {/* 송폼 & 파트 태그 오버레이 - songFormEnabled일 때 항상 표시, 캔버스가 렌더링된 후에만 */}
          {effectiveSongForms.length > 0 && songFormEnabled && canvasReady && canvasSize.height > 0 && (
            <>
              {/* 송폼 텍스트 - fontSize를 캔버스 높이 기준 퍼센트로 계산 */}
              <div
                className="absolute cursor-pointer select-none hover:ring-2 hover:ring-purple-400 hover:ring-offset-2 rounded"
                style={{
                  left: `${songFormStyle.x}%`,
                  top: `${songFormStyle.y}%`,
                  transform: 'translateX(-50%)',
                  // fontSize를 캔버스 높이의 퍼센트로 계산 (36pt = 약 2.5% 기준)
                  fontSize: `${(songFormStyle.fontSize / 36) * (canvasSize.height * 0.025)}px`,
                  color: songFormStyle.color,
                  opacity: songFormStyle.opacity,
                  fontWeight: 'bold',
                  textShadow: '2px 2px 4px rgba(255,255,255,0.9), -1px -1px 2px rgba(255,255,255,0.9)',
                  pointerEvents: 'auto',
                  whiteSpace: 'nowrap',  // 한 줄로 표시
                  touchAction: 'none',
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  if (showSongFormPanel) {
                    setDraggingFormItem({ type: 'songForm' })
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  if (!showSongFormPanel) {
                    setShowSongFormPanel(true)
                  }
                }}
                onTouchStart={(e) => {
                  e.stopPropagation()
                  if (showSongFormPanel) {
                    e.preventDefault()
                    setDraggingFormItem({ type: 'songForm' })
                  } else {
                    // 패널이 닫혀있으면 열기
                    setShowSongFormPanel(true)
                  }
                }}
                onTouchMove={handleFormTouchMove}
                onTouchEnd={handleFormTouchEnd}
                title="클릭하여 설정 열기"
              >
                {effectiveSongForms.join(' - ')}
              </div>

              {/* 파트 태그들 - fontSize도 캔버스 높이 기준으로 계산 */}
              {partTags
                .filter(tag => (tag.pageIndex || 0) === currentPage - 1)
                .map(tag => (
                  <div
                    key={tag.id}
                    className="absolute cursor-pointer select-none hover:ring-2 hover:ring-purple-400 hover:ring-offset-2 rounded"
                    style={{
                      left: `${tag.x}%`,
                      top: `${tag.y}%`,
                      transform: 'translate(-50%, -50%)',
                      fontSize: `${(tag.fontSize / 36) * (canvasSize.height * 0.025)}px`,
                      color: tag.color,
                      opacity: tag.opacity,
                      fontWeight: 'bold',
                      textShadow: '2px 2px 4px rgba(255,255,255,0.9), -1px -1px 2px rgba(255,255,255,0.9)',
                      pointerEvents: 'auto',
                      touchAction: 'none',
                      WebkitUserSelect: 'none',
                      userSelect: 'none',
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      if (showSongFormPanel) {
                        setDraggingFormItem({ type: 'partTag', id: tag.id })
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!showSongFormPanel) {
                        setShowSongFormPanel(true)
                      }
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation()
                      if (showSongFormPanel) {
                        e.preventDefault()
                        setDraggingFormItem({ type: 'partTag', id: tag.id })
                      } else {
                        setShowSongFormPanel(true)
                      }
                    }}
                    onTouchMove={handleFormTouchMove}
                    onTouchEnd={handleFormTouchEnd}
                    title="클릭하여 설정 열기"
                  >
                    {tag.label}
                  </div>
                ))}

              {/* 드롭 영역 (파트 태그 추가용) - 설정 패널이 열려있을 때만 */}
              {showSongFormPanel && draggingNewPartTag && (
                <div
                  className="absolute inset-0 border-4 border-dashed border-purple-500 flex items-center justify-center pointer-events-none z-10"
                >
                  <span className="bg-purple-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                    여기에 드롭
                  </span>
                </div>
              )}
            </>
          )}

          {/* 피아노 악보 렌더링 */}
          {pianoScores.filter(score => score.pageIndex === currentPage - 1).map(score => {
            // measureWidths가 있으면 합산, 없으면 기본값 사용
            const defaultWidth = score.measureCount === 1 ? 100 : 70
            const measureWidths = score.measureWidths || Array(score.measureCount).fill(defaultWidth)
            const scoreWidth = measureWidths.reduce((sum, w) => sum + w * 0.7, 0) // 0.7은 편집 화면 대비 비율
            const scoreHeight = 80
            const baseScaleFactor = canvasSize.height * 0.001
            const userScale = score.scale || 1.0
            const scaleFactor = baseScaleFactor * userScale

            return (
              <div
                key={score.id}
                className="absolute cursor-move select-none hover:ring-2 hover:ring-blue-400 rounded bg-white/90"
                style={{
                  left: `${score.x}%`,
                  top: `${score.y}%`,
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'auto',
                  touchAction: 'none',
                  padding: '4px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  if (!isViewMode) {
                    setDraggingFormItem({ type: 'pianoScore', id: score.id })
                  }
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  if (!isViewMode) {
                    // 더블 클릭 시 편집 모달 열기
                    // 기존 chords가 있으면 사용, 없으면 chordName에서 변환
                    const existingChords = score.chords || (score.chordName ? [{ name: score.chordName, position: 50 }] : [])
                    const defaultWidth = score.measureCount === 1 ? 150 : 100
                    setEditingPianoScore({
                      measureCount: score.measureCount,
                      measureWidths: score.measureWidths ? [...score.measureWidths] : Array(score.measureCount).fill(defaultWidth),
                      chordName: '',
                      chords: [...existingChords],
                      notes: [...score.notes],
                      currentDuration: 4
                    })
                    setEditingPianoScoreId(score.id)
                    setPianoModalStep('edit')
                    setShowPianoModal(true)
                    // 히스토리 초기화
                    setPianoHistory([{ notes: [...score.notes], chords: [...existingChords] }])
                    setPianoHistoryIndex(0)
                  }
                }}
                onTouchStart={(e) => {
                  e.stopPropagation()
                  if (!isViewMode) {
                    e.preventDefault()
                    // 더블 탭 감지
                    const now = Date.now()
                    const timeSinceLastTap = now - lastTapTimeRef.current
                    lastTapTimeRef.current = now

                    if (timeSinceLastTap < 300) {
                      // 더블 탭 - 편집 모달 열기
                      const existingChords = score.chords || (score.chordName ? [{ name: score.chordName, position: 50 }] : [])
                      const defaultWidth = score.measureCount === 1 ? 150 : 100
                      setEditingPianoScore({
                        measureCount: score.measureCount,
                        measureWidths: score.measureWidths ? [...score.measureWidths] : Array(score.measureCount).fill(defaultWidth),
                        chordName: '',
                        chords: [...existingChords],
                        notes: [...score.notes],
                        currentDuration: 4
                      })
                      setEditingPianoScoreId(score.id)
                      setPianoModalStep('edit')
                      setShowPianoModal(true)
                      // 히스토리 초기화
                      setPianoHistory([{ notes: [...score.notes], chords: [...existingChords] }])
                      setPianoHistoryIndex(0)
                    } else {
                      // 단일 탭 - 드래그 준비
                      setDraggingFormItem({ type: 'pianoScore', id: score.id })
                    }
                  }
                }}
                onTouchMove={handleFormTouchMove}
                onTouchEnd={handleFormTouchEnd}
              >
                <svg
                  width={scoreWidth * scaleFactor}
                  height={scoreHeight * scaleFactor}
                  viewBox={`0 0 ${scoreWidth} ${scoreHeight}`}
                >
                  {/* 코드 이름 (여러 개 지원) */}
                  {(score.chords && score.chords.length > 0) ? (
                    score.chords.map((chord, idx) => {
                      const x = (chord.position / 100) * scoreWidth
                      return (
                        <text key={idx} x={x} y="12" fontSize="10" fontWeight="bold" textAnchor="middle">
                          {chord.name}
                        </text>
                      )
                    })
                  ) : score.chordName && (
                    <text x="5" y="12" fontSize="10" fontWeight="bold">
                      {score.chordName}
                    </text>
                  )}

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

                  {/* 세로줄 (마디 구분) - measureWidths 기반 */}
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

                  {/* Beam 연결선 (오버레이) - 대각선 */}
                  {(() => {
                    const pitchToY: { [key: string]: number } = {
                      'A5': 12, 'G5': 17, 'F5': 22, 'E5': 27, 'D5': 32,
                      'C5': 37, 'B4': 42, 'A4': 47, 'G4': 52, 'F4': 57,
                      'E4': 62, 'D4': 67, 'C4': 72, 'B3': 77, 'A3': 82
                    }
                    const stemLength = 20

                    const beamGroups: { [key: string]: { note: PianoNote, idx: number }[] } = {}
                    score.notes.forEach((note, idx) => {
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

                      const firstY = pitchToY[firstNote.pitch] || 47
                      const lastY = pitchToY[lastNote.pitch] || 47
                      const avgY = (firstY + lastY) / 2
                      const stemUp = avgY >= 42

                      const firstX = (firstNote.position / 100) * scoreWidth
                      const lastX = (lastNote.position / 100) * scoreWidth

                      // 각 음표의 기둥 끝 위치 계산 (대각선 beam)
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
                  })()}

                  {/* 음표 - 오선 기준 (첫째 줄 22, 간격 10, 음표 간격 5) */}
                  {/* 화음 처리: 비슷한 position의 음표들을 그룹화하여 렌더링 */}
                  {(() => {
                    const pitchToY: { [key: string]: number } = {
                      'A5': 12, 'G5': 17, 'F5': 22, 'E5': 27, 'D5': 32,
                      'C5': 37, 'B4': 42, 'A4': 47, 'G4': 52, 'F4': 57,
                      'E4': 62, 'D4': 67, 'C4': 72, 'B3': 77, 'A3': 82
                    }
                    const pitchOrder = ['A5', 'G5', 'F5', 'E5', 'D5', 'C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4', 'B3', 'A3']

                    // 비슷한 position의 음표들을 화음으로 그룹화 (차이 5 이내)
                    const CHORD_THRESHOLD = 5
                    const chordGroups: { note: PianoNote, idx: number }[][] = []
                    const notesWithIdx = score.notes.map((note, idx) => ({ note, idx }))
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
                        const aIdx = pitchOrder.indexOf(a.note.pitch)
                        const bIdx = pitchOrder.indexOf(b.note.pitch)
                        return aIdx - bIdx
                      })

                      // 화음의 평균 position으로 baseX 계산
                      const avgPosition = notesInChord.reduce((sum, n) => sum + n.note.position, 0) / notesInChord.length
                      const baseX = (avgPosition / 100) * scoreWidth
                      const firstNote = notesInChord[0].note

                      // 화음 전체의 평균 Y로 기둥 방향 결정
                      const avgY = notesInChord.reduce((sum, n) => sum + (pitchToY[n.note.pitch] || 47), 0) / notesInChord.length

                      // beam 그룹이 있는 경우 beam 그룹 전체의 평균으로 결정
                      const hasBeam = notesInChord.some(n => n.note.beamGroup)
                      let stemUp = avgY >= 42
                      if (hasBeam) {
                        const beamGroup = notesInChord.find(n => n.note.beamGroup)?.note.beamGroup
                        if (beamGroup) {
                          const beamNotes = score.notes.filter(n => n.beamGroup === beamGroup)
                          const beamAvgY = beamNotes.reduce((sum, n) => sum + (pitchToY[n.pitch] || 47), 0) / beamNotes.length
                          stemUp = beamAvgY >= 42
                        }
                      }

                      // 인접한 음표(2도 간격) 체크 및 x 오프셋 계산
                      const noteOffsets: number[] = []
                      for (let i = 0; i < notesInChord.length; i++) {
                        const currentPitchIdx = pitchOrder.indexOf(notesInChord[i].note.pitch)
                        let needsOffset = false

                        if (i > 0) {
                          const prevPitchIdx = pitchOrder.indexOf(notesInChord[i - 1].note.pitch)
                          if (Math.abs(currentPitchIdx - prevPitchIdx) === 1) {
                            if (noteOffsets[i - 1] === 0) {
                              needsOffset = true
                            }
                          }
                        }
                        noteOffsets.push(needsOffset ? (stemUp ? -8 : 8) : 0)
                      }

                      // 화음의 최고음, 최저음 찾기
                      const highestY = Math.min(...notesInChord.map(n => pitchToY[n.note.pitch] || 47))
                      const lowestY = Math.max(...notesInChord.map(n => pitchToY[n.note.pitch] || 47))
                      const stemLength = 20

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
                            const y = pitchToY[note.pitch] || 47
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
                  })()}
                </svg>

                {/* 삭제 버튼 (편집 모드에서만) */}
                {!isViewMode && (
                  <button
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
                    onClick={(e) => {
                      e.stopPropagation()
                      setPianoScores(prev => prev.filter(s => s.id !== score.id))
                    }}
                  >
                    ×
                  </button>
                )}

                {/* 크기 조절 핸들 (편집 모드에서만) */}
                {!isViewMode && (
                  <div
                    className="absolute -bottom-2 -right-2 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center cursor-nwse-resize hover:bg-blue-600 shadow-md"
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      setResizingPianoScore({
                        id: score.id,
                        startX: e.clientX,
                        startScale: score.scale || 1.0
                      })
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      const touch = e.touches[0]
                      setResizingPianoScore({
                        id: score.id,
                        startX: touch.clientX,
                        startScale: score.scale || 1.0
                      })
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                      <path d="M11 1L1 11M11 5L5 11M11 9L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                    </svg>
                  </div>
                )}
              </div>
            )
          })}
          </div> {/* exportAreaRef div 닫기 */}
        </div>
      </div>

      {/* 지우개 커서 (동그란 원) */}
      {tool === 'eraser' && eraserPosition && (
        <div
          className="fixed pointer-events-none border-2 border-gray-600 rounded-full bg-white/30"
          style={{
            left: eraserPosition.x - eraserSize,
            top: eraserPosition.y - eraserSize,
            width: eraserSize * 2,
            height: eraserSize * 2,
          }}
        />
      )}

      {/* 송폼 설정 사이드 패널 (모바일: 바닥 시트 스타일) - 편집 모드에서만 */}
      {effectiveSongForms.length > 0 && showSongFormPanel && !isViewMode && (
        <div className={`bg-white shadow-xl border border-gray-200 overflow-y-auto z-30 ${
          isMobile
            ? 'fixed bottom-0 left-0 right-0 max-h-[60vh] rounded-t-2xl'
            : 'absolute top-24 right-4 w-64 rounded-lg max-h-[70vh]'
        }`}>
          {/* 모바일 드래그 핸들 */}
          {isMobile && (
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
          )}
          <div className={`border-b bg-purple-50 ${isMobile ? 'p-4' : 'p-3'}`}>
            <div className="flex items-center justify-between">
              <h3 className={`font-bold text-purple-700 ${isMobile ? 'text-lg' : ''}`}>🎵 송폼 설정</h3>
              <button
                onClick={() => setShowSongFormPanel(false)}
                className={`text-gray-500 hover:text-gray-700 ${isMobile ? 'p-2 -m-2' : ''}`}
              >
                ✕
              </button>
            </div>
            <p className={`text-purple-600 mt-1 ${isMobile ? 'text-sm' : 'text-xs'}`}>{effectiveSongForms.join(' - ')}</p>
            {/* 송폼 켜기/끄기 토글 */}
            <button
              onClick={() => setSongFormEnabled(!songFormEnabled)}
              className={`mt-2 w-full rounded font-medium transition-colors ${
                isMobile ? 'py-3 text-base' : 'py-1.5 text-sm'
              } ${
                songFormEnabled
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              {songFormEnabled ? '송폼 표시 중 (클릭하여 숨김)' : '송폼 숨김 (클릭하여 표시)'}
            </button>
          </div>

          {/* 송폼 스타일 설정 */}
          <div className={`border-b ${isMobile ? 'p-4' : 'p-3'}`}>
            <h4 className={`font-semibold text-gray-700 mb-2 ${isMobile ? 'text-base' : 'text-sm'}`}>송폼 스타일</h4>

            {/* 크기 */}
            <div className={isMobile ? 'mb-4' : 'mb-3'}>
              <label className={`text-gray-600 block mb-1 ${isMobile ? 'text-sm' : 'text-xs'}`}>
                크기: <span className="font-bold">{songFormStyle.fontSize}pt</span>
              </label>
              <input
                type="range"
                min="12"
                max="96"
                value={songFormStyle.fontSize}
                onChange={(e) => setSongFormStyle(prev => ({ ...prev, fontSize: Number(e.target.value) }))}
                className={`w-full bg-gray-200 rounded-lg appearance-none cursor-pointer ${isMobile ? 'h-3' : 'h-2'}`}
              />
            </div>

            {/* 색상 */}
            <div className={isMobile ? 'mb-4' : 'mb-3'}>
              <label className={`text-gray-600 block mb-1 ${isMobile ? 'text-sm' : 'text-xs'}`}>색상</label>
              <div className={`flex flex-wrap ${isMobile ? 'gap-2' : 'gap-1'}`}>
                {FORM_COLOR_PRESETS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setSongFormStyle(prev => ({ ...prev, color: c.value }))}
                    className={`rounded-full border-2 ${
                      isMobile ? 'w-9 h-9' : 'w-6 h-6'
                    } ${
                      songFormStyle.color === c.value ? 'border-gray-800 scale-110' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>

            {/* 투명도 */}
            <div>
              <label className={`text-gray-600 block mb-1 ${isMobile ? 'text-sm' : 'text-xs'}`}>
                투명도: <span className="font-bold">{Math.round(songFormStyle.opacity * 100)}%</span>
              </label>
              <input
                type="range"
                min="0.3"
                max="1"
                step="0.1"
                value={songFormStyle.opacity}
                onChange={(e) => setSongFormStyle(prev => ({ ...prev, opacity: Number(e.target.value) }))}
                className={`w-full bg-gray-200 rounded-lg appearance-none cursor-pointer ${isMobile ? 'h-3' : 'h-2'}`}
              />
            </div>
          </div>

          {/* 파트 태그 팔레트 */}
          <div className={`border-b ${isMobile ? 'p-4' : 'p-3'}`}>
            <h4 className={`font-semibold text-gray-700 mb-2 ${isMobile ? 'text-base' : 'text-sm'}`}>파트 태그 추가</h4>
            <p className={`text-gray-500 mb-2 ${isMobile ? 'text-sm' : 'text-xs'}`}>
              {isMobile ? '📱 탭하면 중앙에 추가됩니다' : '드래그해서 악보 위에 배치'}
            </p>
            <div className={`grid grid-cols-4 ${isMobile ? 'gap-2' : 'gap-1'}`}>
              {AVAILABLE_PARTS.map(part => (
                <button
                  key={part.key}
                  type="button"
                  draggable={!isMobile}
                  onDragStart={() => setDraggingNewPartTag(part.key)}
                  onDragEnd={() => setDraggingNewPartTag(null)}
                  onClick={() => {
                    // 탭하면 캔버스 중앙에 추가
                    const newTag: PartTagStyle = {
                      id: `${part.key}-${Date.now()}`,
                      label: part.key,
                      x: 50,
                      y: 50,
                      fontSize: 28,
                      color: PART_COLORS[part.key] || '#6B7280',
                      opacity: 1,
                      pageIndex: currentPage - 1
                    }
                    setPartTags(prev => [...prev, newTag])
                  }}
                  className={`flex items-center justify-center text-white rounded cursor-pointer hover:opacity-80 active:opacity-60 transition-opacity font-bold ${
                    isMobile ? 'p-2.5 text-sm min-h-[44px]' : 'p-1.5 text-xs'
                  }`}
                  style={{
                    backgroundColor: PART_COLORS[part.key],
                    touchAction: 'manipulation',
                    WebkitTouchCallout: 'none',
                    WebkitUserSelect: 'none',
                    userSelect: 'none',
                  }}
                  title={part.label}
                >
                  {part.key}
                </button>
              ))}
            </div>
          </div>

          {/* 배치된 파트 태그 목록 */}
          {partTags.filter(tag => (tag.pageIndex || 0) === currentPage - 1).length > 0 && (
            <div className={isMobile ? 'p-4' : 'p-3'}>
              <h4 className={`font-semibold text-gray-700 mb-2 ${isMobile ? 'text-base' : 'text-sm'}`}>
                배치된 태그 (페이지 {currentPage})
              </h4>
              <div className="space-y-2">
                {partTags
                  .filter(tag => (tag.pageIndex || 0) === currentPage - 1)
                  .map(tag => (
                    <div key={tag.id} className="bg-gray-50 p-2 rounded border">
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className="px-2 py-0.5 rounded text-white text-xs font-bold"
                          style={{ backgroundColor: tag.color }}
                        >
                          {tag.label}
                        </span>
                        <button
                          onClick={() => setPartTags(prev => prev.filter(t => t.id !== tag.id))}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          🗑️
                        </button>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">{tag.fontSize}pt</span>
                        <input
                          type="range"
                          min="12"
                          max="72"
                          value={tag.fontSize}
                          onChange={(e) => setPartTags(prev =>
                            prev.map(t => t.id === tag.id ? { ...t, fontSize: Number(e.target.value) } : t)
                          )}
                          className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 내보내기 모달 (모바일: 바닥 시트 스타일) */}
      {showExportModal && (
        <div className={`fixed inset-0 bg-black/30 z-50 ${isMobile ? 'flex items-end' : 'flex items-center justify-center'}`}>
          <div className={`bg-white shadow-xl overflow-hidden border border-gray-200 ${
            isMobile
              ? 'w-full rounded-t-2xl'
              : 'rounded-xl max-w-md w-full mx-4'
          }`}>
            {/* 모바일 드래그 핸들 */}
            {isMobile && (
              <div className="flex justify-center pt-2 pb-1">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>
            )}
            <div className={`border-b bg-gray-50 ${isMobile ? 'p-5' : 'p-4'}`}>
              <h3 className={`font-bold text-gray-800 ${isMobile ? 'text-xl' : 'text-lg'}`}>내보내기</h3>
              <p className={`text-gray-500 mt-1 ${isMobile ? 'text-base' : 'text-sm'}`}>필기가 포함된 악보를 저장하세요</p>
            </div>

            <div className={`space-y-3 ${isMobile ? 'p-5' : 'p-4'}`}>
              <p className={`text-gray-600 mb-4 ${isMobile ? 'text-base' : 'text-sm'}`}>
                현재 페이지의 악보와 필기를 함께 내보냅니다.
                {effectiveSongForms.length > 0 && showSongFormPanel && (
                  <span className="block mt-1 text-purple-600">
                    * 송폼 & 파트 태그도 함께 포함됩니다.
                  </span>
                )}
              </p>

              <button
                onClick={() => handleExport('image')}
                className={`w-full bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg flex items-center gap-3 transition-all ${
                  isMobile ? 'p-5' : 'p-4'
                }`}
              >
                <span className={isMobile ? 'text-3xl' : 'text-2xl'}>🖼️</span>
                <div className="text-left">
                  <div className={`font-semibold ${isMobile ? 'text-lg' : ''}`}>이미지로 저장 (PNG)</div>
                  <div className={`text-blue-500 ${isMobile ? 'text-base' : 'text-sm'}`}>고화질 이미지로 저장합니다</div>
                </div>
              </button>

              <button
                onClick={() => handleExport('pdf')}
                className={`w-full bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-lg flex items-center gap-3 transition-all ${
                  isMobile ? 'p-5' : 'p-4'
                }`}
              >
                <span className={isMobile ? 'text-3xl' : 'text-2xl'}>📄</span>
                <div className="text-left">
                  <div className={`font-semibold ${isMobile ? 'text-lg' : ''}`}>PDF로 저장</div>
                  <div className={`text-red-500 ${isMobile ? 'text-base' : 'text-sm'}`}>인쇄용 PDF 문서로 저장합니다</div>
                </div>
              </button>
            </div>

            <div className={`bg-gray-50 border-t flex justify-end ${isMobile ? 'p-5 pb-8' : 'p-4'}`}>
              <button
                onClick={() => setShowExportModal(false)}
                className={`text-gray-600 hover:bg-gray-200 rounded-lg transition-colors ${
                  isMobile ? 'px-6 py-3 text-lg' : 'px-4 py-2'
                }`}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 피아노 악보 모달 */}
      {showPianoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden ${isMobile ? 'mx-2' : ''}`}>
            {/* 헤더 */}
            <div className="bg-blue-600 text-white p-4 flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                🎹 피아노 악보 {pianoModalStep === 'measure' ? '- 마디 선택' : '- 음표 입력'}
              </h2>
              <button
                onClick={() => {
                  setShowPianoModal(false)
                  setChordPickerIndex(null)
                  setSelectedNotesForBeam([])
                }}
                className="text-white/80 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* 마디 선택 단계 */}
            {pianoModalStep === 'measure' && (
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
                      onClick={() => {
                        // 기본 마디 너비: 1마디=150, 나머지=100씩
                        const defaultWidth = opt.value === 1 ? 150 : 100
                        setEditingPianoScore({
                          measureCount: opt.value,
                          measureWidths: Array(opt.value).fill(defaultWidth),
                          chordName: '',
                          chords: [],
                          notes: [],
                          currentDuration: 4
                        })
                        setPianoModalStep('edit')
                        // 히스토리 초기화
                        setPianoHistory([{ notes: [], chords: [] }])
                        setPianoHistoryIndex(0)
                      }}
                      className="p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
                    >
                      <div className="font-bold text-lg">{opt.label}</div>
                      <div className="text-sm text-gray-500">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 음표 입력 단계 */}
            {pianoModalStep === 'edit' && editingPianoScore && (
              <div className="p-4 overflow-y-auto max-h-[70vh]">

                {/* 코드 선택 팝업 (음표 기반) */}
                {chordPickerIndex !== null && editingPianoScore.notes[chordPickerIndex] && (() => {
                  const selectedNote = editingPianoScore.notes[chordPickerIndex]
                  const existingChord = editingPianoScore.chords.find(c => c && Math.abs(c.position - selectedNote.position) < 5)
                  const currentChordName = existingChord?.name || 'C'

                  return (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-blue-700">
                          코드 선택 (음표 {chordPickerIndex + 1}: {selectedNote.pitch})
                        </span>
                        <div className="flex gap-2">
                          {existingChord && (
                            <button
                              onClick={() => {
                                setEditingPianoScore(prev => {
                                  if (!prev) return prev
                                  const newChords = prev.chords.filter(c => !c || Math.abs(c.position - selectedNote.position) >= 5)
                                  // 히스토리에 저장
                                  savePianoHistory(prev.notes, newChords)
                                  return { ...prev, chords: newChords }
                                })
                                setChordPickerIndex(null)
                              }}
                              className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200"
                            >
                              삭제
                            </button>
                          )}
                          <button
                            onClick={() => setChordPickerIndex(null)}
                            className="px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                          >
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
                              const newChordName = note + currentType
                              setEditingPianoScore(prev => {
                                if (!prev) return prev
                                // 같은 위치에 기존 코드가 있으면 업데이트, 없으면 추가
                                const newChords = prev.chords.filter(c => !c || Math.abs(c.position - selectedNote.position) >= 5)
                                newChords.push({ name: newChordName, position: selectedNote.position })
                                // 히스토리에 저장
                                savePianoHistory(prev.notes, newChords)
                                return { ...prev, chords: newChords }
                              })
                            }}
                            className={`px-3 py-1.5 rounded font-bold text-sm ${
                              currentChordName.startsWith(note)
                                ? 'bg-blue-600 text-white'
                                : 'bg-white hover:bg-gray-100'
                            }`}
                          >
                            {note}
                          </button>
                        ))}
                      </div>
                      {/* 변환 기호 */}
                      <div className="flex flex-wrap gap-1 mb-2">
                        {[
                          { symbol: '', label: '♮' },
                          { symbol: 'b', label: '♭' },
                          { symbol: '#', label: '♯' },
                        ].map(mod => {
                          const hasSymbol = mod.symbol ? currentChordName.includes(mod.symbol) : !currentChordName.match(/^[A-G][#b]/)
                          return (
                            <button
                              key={mod.symbol}
                              onClick={() => {
                                const root = currentChordName.match(/^[A-G]/)?.[0] || 'C'
                                const chordType = currentChordName.replace(/^[A-G][#b]?/, '')
                                const newChordName = root + mod.symbol + chordType
                                setEditingPianoScore(prev => {
                                  if (!prev) return prev
                                  const newChords = prev.chords.filter(c => !c || Math.abs(c.position - selectedNote.position) >= 5)
                                  newChords.push({ name: newChordName, position: selectedNote.position })
                                  // 히스토리에 저장
                                  savePianoHistory(prev.notes, newChords)
                                  return { ...prev, chords: newChords }
                                })
                              }}
                              className={`px-3 py-1.5 rounded text-sm ${
                                hasSymbol ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-100'
                              }`}
                            >
                              {mod.label}
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
                                const newChordName = rootWithMod + chord.type
                                setEditingPianoScore(prev => {
                                  if (!prev) return prev
                                  const newChords = prev.chords.filter(c => !c || Math.abs(c.position - selectedNote.position) >= 5)
                                  newChords.push({ name: newChordName, position: selectedNote.position })
                                  // 히스토리에 저장
                                  savePianoHistory(prev.notes, newChords)
                                  return { ...prev, chords: newChords }
                                })
                              }}
                              className={`px-2 py-1 rounded text-xs ${
                                currentType === chord.type ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-100'
                              }`}
                            >
                              {chord.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                {/* 오선지 (SVG) */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    오선지 (클릭: 음표 추가 / 드래그: 여러 음표 선택 / Delete: 삭제 / 마디 끝 드래그: 너비 조절)
                  </label>
                  <div className="border rounded-lg p-2 bg-white overflow-x-auto">
                    <svg
                      width={editingPianoScore.measureWidths.reduce((sum, w) => sum + w, 0)}
                      height="130"
                      className="cursor-crosshair select-none"
                      onMouseDown={(e) => {
                        // 음표 위 클릭은 무시 (음표 선택 이벤트가 처리함)
                        if ((e.target as Element).closest('g.cursor-pointer')) return

                        const svg = e.currentTarget
                        const rect = svg.getBoundingClientRect()
                        const x = e.clientX - rect.left
                        const y = e.clientY - rect.top

                        // 코드 영역 클릭은 무시 (y < 25)
                        if (y < 25) return

                        // 드래그 선택 시작
                        setDragSelection({ startX: x, startY: y, endX: x, endY: y })
                      }}
                      onMouseMove={(e) => {
                        if (!dragSelection) return

                        const svg = e.currentTarget
                        const rect = svg.getBoundingClientRect()
                        const x = e.clientX - rect.left
                        const y = e.clientY - rect.top

                        setDragSelection(prev => prev ? { ...prev, endX: x, endY: y } : null)
                      }}
                      onMouseUp={(e) => {
                        if (!dragSelection) return

                        const svg = e.currentTarget
                        const rect = svg.getBoundingClientRect()
                        const x = e.clientX - rect.left
                        const y = e.clientY - rect.top

                        // 드래그 거리 계산
                        const dragDistance = Math.sqrt(
                          Math.pow(dragSelection.endX - dragSelection.startX, 2) +
                          Math.pow(dragSelection.endY - dragSelection.startY, 2)
                        )

                        // 드래그 거리가 작으면 클릭으로 처리
                        if (dragDistance < 10) {
                          // 코드 영역 클릭은 무시 (y < 25)
                          if (y >= 25) {
                            // 선택된 음표가 있으면 선택 해제만
                            if (selectedNotesForBeam.length > 0) {
                              setSelectedNotesForBeam([])
                            } else {
                              // 선택된 음표가 없으면 새 음표 추가
                              // y 좌표를 음높이로 변환 (A5=21부터 시작, 간격 7)
                              const pitches = ['A5', 'G5', 'F5', 'E5', 'D5', 'C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4', 'B3', 'A3']
                              const pitchIndex = Math.max(0, Math.min(14, Math.round((y - 21) / 7)))
                              const pitch = pitches[pitchIndex] || 'A4'

                              // x 좌표를 0-100 비율로 변환
                              const svgWidth = editingPianoScore.measureWidths.reduce((sum, w) => sum + w, 0)
                              const position = Math.max(5, Math.min(95, (x / svgWidth) * 100))

                              setEditingPianoScore(prev => {
                                if (!prev) return prev
                                const newNotes = [...prev.notes, { pitch, position, duration: prev.currentDuration }]
                                // 히스토리에 저장
                                savePianoHistory(newNotes, prev.chords)
                                return { ...prev, notes: newNotes }
                              })
                            }
                          }
                        } else {
                          // 드래그 선택: 영역 내 음표 선택
                          const svgWidth = editingPianoScore.measureWidths.reduce((sum, w) => sum + w, 0)
                          const pitchToY: { [key: string]: number } = {
                            'A5': 21, 'G5': 28, 'F5': 35, 'E5': 42, 'D5': 49,
                            'C5': 56, 'B4': 63, 'A4': 70, 'G4': 77, 'F4': 84,
                            'E4': 91, 'D4': 98, 'C4': 105, 'B3': 112, 'A3': 119
                          }

                          const minX = Math.min(dragSelection.startX, dragSelection.endX)
                          const maxX = Math.max(dragSelection.startX, dragSelection.endX)
                          const minY = Math.min(dragSelection.startY, dragSelection.endY)
                          const maxY = Math.max(dragSelection.startY, dragSelection.endY)

                          const selectedIndices: number[] = []
                          editingPianoScore.notes.forEach((note, idx) => {
                            const noteX = (note.position / 100) * svgWidth
                            const noteY = pitchToY[note.pitch] || 70

                            if (noteX >= minX && noteX <= maxX && noteY >= minY && noteY <= maxY) {
                              selectedIndices.push(idx)
                            }
                          })

                          if (selectedIndices.length > 0) {
                            setSelectedNotesForBeam(selectedIndices)
                          }
                        }

                        setDragSelection(null)
                      }}
                      onMouseLeave={() => {
                        // 마우스가 SVG를 벗어나면 드래그 취소
                        setDragSelection(null)
                      }}
                      onTouchStart={(e) => {
                        // 음표 위 터치는 무시 (음표 선택 이벤트가 처리함)
                        if ((e.target as Element).closest('g.cursor-pointer')) return

                        const svg = e.currentTarget
                        const rect = svg.getBoundingClientRect()
                        const touch = e.touches[0]
                        const x = touch.clientX - rect.left
                        const y = touch.clientY - rect.top

                        // 코드 영역 터치는 무시 (y < 25)
                        if (y < 25) return

                        // 드래그 선택 시작
                        setDragSelection({ startX: x, startY: y, endX: x, endY: y })
                      }}
                      onTouchMove={(e) => {
                        if (!dragSelection) return

                        const svg = e.currentTarget
                        const rect = svg.getBoundingClientRect()
                        const touch = e.touches[0]
                        const x = touch.clientX - rect.left
                        const y = touch.clientY - rect.top

                        setDragSelection(prev => prev ? { ...prev, endX: x, endY: y } : null)
                      }}
                      onTouchEnd={(e) => {
                        if (!dragSelection) return

                        // 드래그 거리 계산
                        const dragDistance = Math.sqrt(
                          Math.pow(dragSelection.endX - dragSelection.startX, 2) +
                          Math.pow(dragSelection.endY - dragSelection.startY, 2)
                        )

                        // 드래그 거리가 작으면 클릭으로 처리
                        if (dragDistance < 10) {
                          const y = dragSelection.startY
                          const x = dragSelection.startX

                          // 코드 영역 터치는 무시 (y < 25)
                          if (y >= 25) {
                            // 선택된 음표가 있으면 선택 해제만
                            if (selectedNotesForBeam.length > 0) {
                              setSelectedNotesForBeam([])
                            } else {
                              // 선택된 음표가 없으면 새 음표 추가
                              // y 좌표를 음높이로 변환 (A5=21부터 시작, 간격 7)
                              const pitches = ['A5', 'G5', 'F5', 'E5', 'D5', 'C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4', 'B3', 'A3']
                              const pitchIndex = Math.max(0, Math.min(14, Math.round((y - 21) / 7)))
                              const pitch = pitches[pitchIndex] || 'A4'

                              // x 좌표를 0-100 비율로 변환
                              const svgWidth = editingPianoScore.measureWidths.reduce((sum, w) => sum + w, 0)
                              const position = Math.max(5, Math.min(95, (x / svgWidth) * 100))

                              setEditingPianoScore(prev => {
                                if (!prev) return prev
                                const newNotes = [...prev.notes, { pitch, position, duration: prev.currentDuration }]
                                // 히스토리에 저장
                                savePianoHistory(newNotes, prev.chords)
                                return { ...prev, notes: newNotes }
                              })
                            }
                          }
                        } else {
                          // 드래그 선택: 영역 내 음표 선택
                          const svgWidth = editingPianoScore.measureWidths.reduce((sum, w) => sum + w, 0)
                          const pitchToY: { [key: string]: number } = {
                            'A5': 21, 'G5': 28, 'F5': 35, 'E5': 42, 'D5': 49,
                            'C5': 56, 'B4': 63, 'A4': 70, 'G4': 77, 'F4': 84,
                            'E4': 91, 'D4': 98, 'C4': 105, 'B3': 112, 'A3': 119
                          }

                          const minX = Math.min(dragSelection.startX, dragSelection.endX)
                          const maxX = Math.max(dragSelection.startX, dragSelection.endX)
                          const minY = Math.min(dragSelection.startY, dragSelection.endY)
                          const maxY = Math.max(dragSelection.startY, dragSelection.endY)

                          const selectedIndices: number[] = []
                          editingPianoScore.notes.forEach((note, idx) => {
                            const noteX = (note.position / 100) * svgWidth
                            const noteY = pitchToY[note.pitch] || 70

                            if (noteX >= minX && noteX <= maxX && noteY >= minY && noteY <= maxY) {
                              selectedIndices.push(idx)
                            }
                          })

                          if (selectedIndices.length > 0) {
                            setSelectedNotesForBeam(selectedIndices)
                          }
                        }

                        setDragSelection(null)
                      }}
                    >
                      {/* 화음 그룹당 코드 슬롯 하나만 표시 */}
                      {(() => {
                        const svgWidth = editingPianoScore.measureWidths.reduce((sum, w) => sum + w, 0)
                        const CHORD_THRESHOLD = 5

                        // 화음 그룹화
                        const chordSlotGroups: { notes: { note: PianoNote, idx: number }[], avgPosition: number }[] = []
                        const notesWithIdx = editingPianoScore.notes.map((note, idx) => ({ note, idx }))
                        notesWithIdx.sort((a, b) => a.note.position - b.note.position)

                        notesWithIdx.forEach(item => {
                          const foundGroup = chordSlotGroups.find(group =>
                            Math.abs(group.avgPosition - item.note.position) < CHORD_THRESHOLD
                          )
                          if (foundGroup) {
                            foundGroup.notes.push(item)
                            foundGroup.avgPosition = foundGroup.notes.reduce((sum, n) => sum + n.note.position, 0) / foundGroup.notes.length
                          } else {
                            chordSlotGroups.push({ notes: [item], avgPosition: item.note.position })
                          }
                        })

                        return chordSlotGroups.map((group, groupIdx) => {
                          const slotX = (group.avgPosition / 100) * svgWidth
                          const chord = editingPianoScore.chords.find(c => c && Math.abs(c.position - group.avgPosition) < CHORD_THRESHOLD)
                          const firstNoteIdx = group.notes[0].idx
                          const isSelected = chordPickerIndex !== null && group.notes.some(n => n.idx === chordPickerIndex)

                          return (
                            <g key={`chord-slot-${groupIdx}`} className="cursor-pointer" onClick={(e) => {
                              e.stopPropagation()
                              setChordPickerIndex(firstNoteIdx)
                            }}>
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
                              <text
                                x={slotX}
                                y="17"
                                fontSize="11"
                                fontWeight={chord ? 'bold' : 'normal'}
                                textAnchor="middle"
                                fill={chord ? '#1d4ed8' : '#9ca3af'}
                              >
                                {chord?.name || '+'}
                              </text>
                            </g>
                          )
                        })
                      })()}

                      {/* 오선 (5줄) */}
                      {[0, 1, 2, 3, 4].map(i => {
                        const totalWidth = editingPianoScore.measureWidths.reduce((sum, w) => sum + w, 0)
                        return (
                          <line
                            key={i}
                            x1="5"
                            y1={35 + i * 14}
                            x2={totalWidth - 5}
                            y2={35 + i * 14}
                            stroke="#333"
                            strokeWidth="1"
                          />
                        )
                      })}

                      {/* 세로줄 (마디 구분) + 드래그 핸들 */}
                      <line x1="5" y1="35" x2="5" y2="91" stroke="#333" strokeWidth="1" />
                      {editingPianoScore.measureWidths.map((_, i) => {
                        // 각 마디의 끝 x 좌표 계산
                        const endX = editingPianoScore.measureWidths.slice(0, i + 1).reduce((sum, w) => sum + w, 0)
                        const isLast = i === editingPianoScore.measureCount - 1

                        return (
                          <g key={i}>
                            {/* 마디 구분선 */}
                            <line
                              x1={endX - 5}
                              y1="35"
                              x2={endX - 5}
                              y2="91"
                              stroke="#333"
                              strokeWidth={isLast ? 2 : 1}
                            />
                            {/* 드래그 핸들 (투명한 넓은 영역) */}
                            <rect
                              x={endX - 12}
                              y="25"
                              width="14"
                              height="80"
                              fill="transparent"
                              className="cursor-ew-resize"
                              onMouseDown={(e) => {
                                e.stopPropagation()
                                setResizingMeasure({
                                  index: i,
                                  startX: e.clientX,
                                  startWidths: [...editingPianoScore.measureWidths]
                                })
                              }}
                              onTouchStart={(e) => {
                                e.stopPropagation()
                                const touch = e.touches[0]
                                setResizingMeasure({
                                  index: i,
                                  startX: touch.clientX,
                                  startWidths: [...editingPianoScore.measureWidths]
                                })
                              }}
                            />
                            {/* 시각적 핸들 표시 (호버 시) */}
                            <rect
                              x={endX - 8}
                              y="40"
                              width="6"
                              height="30"
                              rx="2"
                              fill={resizingMeasure?.index === i ? '#3b82f6' : '#d1d5db'}
                              className="pointer-events-none opacity-0 hover:opacity-100"
                              style={{ opacity: resizingMeasure?.index === i ? 1 : undefined }}
                            />
                          </g>
                        )
                      })}

                      {/* Beam 연결선 그리기 (8분음표/16분음표 연결) - 대각선 */}
                      {(() => {
                        const pitchToY: { [key: string]: number } = {
                          'A5': 21, 'G5': 28, 'F5': 35, 'E5': 42, 'D5': 49,
                          'C5': 56, 'B4': 63, 'A4': 70, 'G4': 77, 'F4': 84,
                          'E4': 91, 'D4': 98, 'C4': 105, 'B3': 112, 'A3': 119
                        }
                        const svgWidth = editingPianoScore.measureWidths.reduce((sum, w) => sum + w, 0)
                        const stemLength = 28

                        // beamGroup별로 묶기
                        const beamGroups: { [key: string]: { note: PianoNote, idx: number }[] } = {}
                        editingPianoScore.notes.forEach((note, idx) => {
                          if (note.beamGroup) {
                            if (!beamGroups[note.beamGroup]) beamGroups[note.beamGroup] = []
                            beamGroups[note.beamGroup].push({ note, idx })
                          }
                        })

                        return Object.entries(beamGroups).map(([groupId, notesInGroup]) => {
                          if (notesInGroup.length < 2) return null

                          // position 순으로 정렬
                          notesInGroup.sort((a, b) => a.note.position - b.note.position)

                          const firstNote = notesInGroup[0].note
                          const lastNote = notesInGroup[notesInGroup.length - 1].note

                          const firstY = pitchToY[firstNote.pitch] || 70
                          const lastY = pitchToY[lastNote.pitch] || 70
                          const avgY = (firstY + lastY) / 2
                          const stemUp = avgY >= 63

                          const firstX = (firstNote.position / 100) * svgWidth
                          const lastX = (lastNote.position / 100) * svgWidth

                          // 각 음표의 기둥 끝 위치 계산 (대각선 beam)
                          const firstBeamY = stemUp ? firstY - stemLength : firstY + stemLength
                          const lastBeamY = stemUp ? lastY - stemLength : lastY + stemLength

                          // 8분음표용 beam
                          const hasEighth = notesInGroup.some(n => (n.note.duration || 4) >= 8)

                          // 16분음표 부분 beam 계산 (연속된 16분음표 구간만)
                          const sixteenthSegments: { startIdx: number, endIdx: number }[] = []
                          let segmentStart: number | null = null
                          for (let i = 0; i < notesInGroup.length; i++) {
                            const isSixteenth = (notesInGroup[i].note.duration || 4) >= 16
                            if (isSixteenth && segmentStart === null) {
                              segmentStart = i
                            } else if (!isSixteenth && segmentStart !== null) {
                              if (i - 1 > segmentStart) {
                                sixteenthSegments.push({ startIdx: segmentStart, endIdx: i - 1 })
                              }
                              segmentStart = null
                            }
                          }
                          if (segmentStart !== null && notesInGroup.length - 1 > segmentStart) {
                            sixteenthSegments.push({ startIdx: segmentStart, endIdx: notesInGroup.length - 1 })
                          }

                          // 위치와 Y 값을 계산하는 헬퍼 함수
                          const getBeamPosition = (note: PianoNote) => {
                            const nY = pitchToY[note.pitch] || 70
                            const nX = (note.position / 100) * svgWidth
                            const nBeamY = stemUp ? nY - stemLength : nY + stemLength
                            return { x: nX, beamY: nBeamY }
                          }

                          return (
                            <g key={`beam-${groupId}`}>
                              {/* 첫 번째 beam (8분음표) - 대각선 */}
                              {hasEighth && (
                                <line
                                  x1={stemUp ? firstX + 6 : firstX - 6}
                                  y1={firstBeamY}
                                  x2={stemUp ? lastX + 6 : lastX - 6}
                                  y2={lastBeamY}
                                  stroke="#000"
                                  strokeWidth="4"
                                />
                              )}
                              {/* 두 번째 beam (16분음표) - 연속된 16분음표 구간만 */}
                              {sixteenthSegments.map((seg, segIdx) => {
                                const startNote = notesInGroup[seg.startIdx].note
                                const endNote = notesInGroup[seg.endIdx].note
                                const startPos = getBeamPosition(startNote)
                                const endPos = getBeamPosition(endNote)
                                return (
                                  <line
                                    key={`16th-beam-${segIdx}`}
                                    x1={stemUp ? startPos.x + 6 : startPos.x - 6}
                                    y1={stemUp ? startPos.beamY + 6 : startPos.beamY - 6}
                                    x2={stemUp ? endPos.x + 6 : endPos.x - 6}
                                    y2={stemUp ? endPos.beamY + 6 : endPos.beamY - 6}
                                    stroke="#000"
                                    strokeWidth="4"
                                  />
                                )
                              })}
                            </g>
                          )
                        })
                      })()}

                      {/* 음표 표시 - 오선 기준 (첫째 줄 35, 간격 14, 음표 간격 7) */}
                      {/* 화음 처리: 비슷한 position의 음표들을 그룹화하여 렌더링 */}
                      {(() => {
                        const pitchToY: { [key: string]: number } = {
                          'A5': 21, 'G5': 28, 'F5': 35, 'E5': 42, 'D5': 49,
                          'C5': 56, 'B4': 63, 'A4': 70, 'G4': 77, 'F4': 84,
                          'E4': 91, 'D4': 98, 'C4': 105, 'B3': 112, 'A3': 119
                        }
                        const pitchOrder = ['A5', 'G5', 'F5', 'E5', 'D5', 'C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4', 'B3', 'A3']
                        const svgWidth = editingPianoScore.measureWidths.reduce((sum, w) => sum + w, 0)

                        // 비슷한 position의 음표들을 화음으로 그룹화 (차이 5 이내)
                        const CHORD_THRESHOLD = 5
                        const chordGroups: { note: PianoNote, idx: number }[][] = []
                        const notesWithIdx = editingPianoScore.notes.map((note, idx) => ({ note, idx }))
                        // position 순으로 정렬
                        notesWithIdx.sort((a, b) => a.note.position - b.note.position)

                        notesWithIdx.forEach(item => {
                          // 기존 그룹 중 비슷한 position을 가진 그룹 찾기
                          let foundGroup = chordGroups.find(group => {
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
                            const aIdx = pitchOrder.indexOf(a.note.pitch)
                            const bIdx = pitchOrder.indexOf(b.note.pitch)
                            return aIdx - bIdx
                          })

                          // 화음의 평균 position으로 baseX 계산
                          const avgPosition = notesInChord.reduce((sum, n) => sum + n.note.position, 0) / notesInChord.length
                          const baseX = (avgPosition / 100) * svgWidth
                          const firstNote = notesInChord[0].note

                          // 화음 전체의 평균 Y로 기둥 방향 결정
                          const avgY = notesInChord.reduce((sum, n) => sum + (pitchToY[n.note.pitch] || 70), 0) / notesInChord.length

                          // beam 그룹이 있는 경우 beam 그룹 전체의 평균으로 결정
                          const hasBeam = notesInChord.some(n => n.note.beamGroup)
                          let stemUp = avgY >= 63
                          if (hasBeam) {
                            const beamGroup = notesInChord.find(n => n.note.beamGroup)?.note.beamGroup
                            if (beamGroup) {
                              const beamNotes = editingPianoScore.notes.filter(n => n.beamGroup === beamGroup)
                              const beamAvgY = beamNotes.reduce((sum, n) => sum + (pitchToY[n.pitch] || 70), 0) / beamNotes.length
                              stemUp = beamAvgY >= 63
                            }
                          }

                          // 인접한 음표(2도 간격) 체크 및 x 오프셋 계산
                          const noteOffsets: number[] = []
                          for (let i = 0; i < notesInChord.length; i++) {
                            const currentPitchIdx = pitchOrder.indexOf(notesInChord[i].note.pitch)
                            let needsOffset = false

                            // 바로 위 음표와 2도 간격인지 체크
                            if (i > 0) {
                              const prevPitchIdx = pitchOrder.indexOf(notesInChord[i - 1].note.pitch)
                              if (Math.abs(currentPitchIdx - prevPitchIdx) === 1) {
                                // 이전 음표가 오프셋이 없으면 이 음표에 오프셋
                                if (noteOffsets[i - 1] === 0) {
                                  needsOffset = true
                                }
                              }
                            }
                            noteOffsets.push(needsOffset ? (stemUp ? -12 : 12) : 0)
                          }

                          // 화음의 최고음, 최저음 찾기 (기둥 길이 계산용)
                          const highestY = Math.min(...notesInChord.map(n => pitchToY[n.note.pitch] || 70))
                          const lowestY = Math.max(...notesInChord.map(n => pitchToY[n.note.pitch] || 70))
                          const stemLength = 28

                          // 대표 음표의 duration 사용 (화음은 보통 같은 duration)
                          const duration = firstNote.duration || 4
                          const isFilled = duration >= 4
                          const hasStem = duration >= 2
                          const isBeamed = notesInChord.some(n => n.note.beamGroup)
                          const showFlag = !isBeamed && duration >= 8

                          // 기둥 위치 계산 (화음일 때는 오프셋 없는 음표 기준)
                          const stemX = stemUp ? baseX + 6 : baseX - 6

                          return (
                            <g key={groupIdx}>
                              {/* 각 음표 머리 렌더링 */}
                              {notesInChord.map(({ note, idx }, i) => {
                                const y = pitchToY[note.pitch] || 70
                                const xOffset = noteOffsets[i]
                                const noteX = baseX + xOffset
                                const needsLedgerLine = ['C4', 'D4', 'A5', 'B3', 'A3'].includes(note.pitch)
                                const isSelected = selectedNotesForBeam.includes(idx)
                                const noteIsBeamed = !!note.beamGroup

                                return (
                                  <g key={idx} className="cursor-pointer" onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedNotesForBeam(prev =>
                                      prev.includes(idx)
                                        ? prev.filter(i => i !== idx)
                                        : [...prev, idx]
                                    )
                                  }}>
                                    {/* 선택 표시 */}
                                    {isSelected && (
                                      <circle cx={noteX} cy={y} r="12" fill="rgba(59, 130, 246, 0.3)" stroke="#3b82f6" strokeWidth="2" />
                                    )}
                                    {/* 보조선 */}
                                    {needsLedgerLine && (
                                      <line x1={noteX - 15} y1={y} x2={noteX + 15} y2={y} stroke="#333" strokeWidth="1" />
                                    )}
                                    {/* 음표 머리 */}
                                    <ellipse
                                      cx={noteX}
                                      cy={y}
                                      rx="7"
                                      ry="5"
                                      fill={isFilled ? (noteIsBeamed ? '#1d4ed8' : '#000') : 'none'}
                                      stroke={noteIsBeamed ? '#1d4ed8' : '#000'}
                                      strokeWidth="1.5"
                                    />
                                  </g>
                                )
                              })}

                              {/* 기둥 (stem) - 화음 전체에 하나만 */}
                              {hasStem && (
                                <line
                                  x1={stemX}
                                  y1={stemUp ? lowestY : highestY}
                                  x2={stemX}
                                  y2={stemUp ? highestY - stemLength : lowestY + stemLength}
                                  stroke={isBeamed ? '#1d4ed8' : '#000'}
                                  strokeWidth="1.5"
                                />
                              )}

                              {/* 깃발 - 화음에 하나만 */}
                              {showFlag && (
                                <path
                                  d={stemUp
                                    ? `M${stemX},${highestY - stemLength} Q${stemX + 12},${highestY - stemLength + 10} ${stemX + 4},${highestY - stemLength + 18}`
                                    : `M${stemX},${lowestY + stemLength} Q${stemX - 12},${lowestY + stemLength - 10} ${stemX - 4},${lowestY + stemLength - 18}`}
                                  stroke="#000"
                                  strokeWidth="2"
                                  fill="none"
                                />
                              )}
                              {/* 두 번째 깃발 - 16분음표 */}
                              {showFlag && duration >= 16 && (
                                <path
                                  d={stemUp
                                    ? `M${stemX},${highestY - stemLength + 8} Q${stemX + 12},${highestY - stemLength + 18} ${stemX + 4},${highestY - stemLength + 26}`
                                    : `M${stemX},${lowestY + stemLength - 8} Q${stemX - 12},${lowestY + stemLength - 18} ${stemX - 4},${lowestY + stemLength - 26}`}
                                  stroke="#000"
                                  strokeWidth="2"
                                  fill="none"
                                />
                              )}
                            </g>
                          )
                        })
                      })()}

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
                    </svg>
                  </div>
                </div>

                {/* 음표 길이 선택 및 실행취소/다시실행 */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      음표 길이 선택
                    </label>
                    {/* 실행취소/다시실행 버튼 */}
                    <div className="flex gap-1">
                      <button
                        onClick={undoPiano}
                        disabled={pianoHistoryIndex <= 0}
                        className={`px-2 py-1 rounded text-sm transition-colors flex items-center gap-1 ${
                          pianoHistoryIndex <= 0
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                        }`}
                        title="실행취소"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a4 4 0 014 4v2M3 10l4-4m-4 4l4 4" />
                        </svg>
                        <span className="hidden sm:inline">뒤로</span>
                      </button>
                      <button
                        onClick={redoPiano}
                        disabled={pianoHistoryIndex >= pianoHistory.length - 1}
                        className={`px-2 py-1 rounded text-sm transition-colors flex items-center gap-1 ${
                          pianoHistoryIndex >= pianoHistory.length - 1
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                        }`}
                        title="다시실행"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a4 4 0 00-4 4v2M21 10l-4-4m4 4l-4 4" />
                        </svg>
                        <span className="hidden sm:inline">앞으로</span>
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {[
                      { value: 1 as const, label: '온', icon: '𝅝' },
                      { value: 2 as const, label: '2분', icon: '𝅗𝅥' },
                      { value: 4 as const, label: '4분', icon: '♩' },
                      { value: 8 as const, label: '8분', icon: '♪' },
                      { value: 16 as const, label: '16분', icon: '♬' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setEditingPianoScore(prev => prev ? { ...prev, currentDuration: opt.value } : prev)}
                        className={`px-2 py-1.5 rounded text-sm font-medium transition-colors ${
                          editingPianoScore.currentDuration === opt.value
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                      >
                        <span className="text-base">{opt.icon}</span>
                        <span className="block text-[10px]">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 선택된 음표 액션 (beam/삭제) */}
                {selectedNotesForBeam.length > 0 && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-blue-700">
                        {selectedNotesForBeam.length}개 음표 선택됨
                      </span>
                      <button
                        onClick={() => setSelectedNotesForBeam([])}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        선택 해제
                      </button>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {/* 연결 버튼 (2개 이상 선택 시) */}
                      {selectedNotesForBeam.length >= 2 && (
                        <button
                          onClick={() => {
                            const beamGroupId = `beam-${Date.now()}`
                            setEditingPianoScore(prev => {
                              if (!prev) return prev
                              const newNotes = prev.notes.map((note, idx) =>
                                selectedNotesForBeam.includes(idx)
                                  ? { ...note, beamGroup: beamGroupId }
                                  : note
                              )
                              // 히스토리에 저장
                              savePianoHistory(newNotes, prev.chords)
                              return { ...prev, notes: newNotes }
                            })
                            setSelectedNotesForBeam([])
                          }}
                          className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-1"
                        >
                          🔗 연결
                        </button>
                      )}
                      {/* 연결 해제 버튼 (beam이 있는 음표 선택 시) */}
                      {selectedNotesForBeam.some(idx => editingPianoScore.notes[idx]?.beamGroup) && (
                        <button
                          onClick={() => {
                            setEditingPianoScore(prev => {
                              if (!prev) return prev
                              const newNotes = prev.notes.map((note, idx) =>
                                selectedNotesForBeam.includes(idx)
                                  ? { ...note, beamGroup: undefined }
                                  : note
                              )
                              // 히스토리에 저장
                              savePianoHistory(newNotes, prev.chords)
                              return { ...prev, notes: newNotes }
                            })
                            setSelectedNotesForBeam([])
                          }}
                          className="px-3 py-1.5 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 flex items-center gap-1"
                        >
                          ✂️ 연결 해제
                        </button>
                      )}
                      {/* 삭제 버튼 */}
                      <button
                        onClick={() => {
                          // 코드 피커 상태 처리
                          if (chordPickerIndex !== null && selectedNotesForBeam.includes(chordPickerIndex)) {
                            setChordPickerIndex(null)
                          }
                          setEditingPianoScore(prev => {
                            if (!prev) return prev
                            const newNotes = prev.notes.filter((_, idx) => !selectedNotesForBeam.includes(idx))
                            // 히스토리에 저장
                            savePianoHistory(newNotes, prev.chords)
                            return { ...prev, notes: newNotes }
                          })
                          setSelectedNotesForBeam([])
                        }}
                        className="px-3 py-1.5 text-sm bg-red-500 text-white rounded hover:bg-red-600 flex items-center gap-1"
                      >
                        🗑️ 삭제
                      </button>
                    </div>
                  </div>
                )}

                {/* 음표 전체 삭제 */}
                {editingPianoScore.notes.length > 0 && selectedNotesForBeam.length === 0 && (
                  <div className="mb-4">
                    <button
                      onClick={() => {
                        setChordPickerIndex(null)
                        setSelectedNotesForBeam([])
                        setEditingPianoScore(prev => {
                          if (!prev) return prev
                          // 히스토리에 저장
                          savePianoHistory([], prev.chords)
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
                      if (editingPianoScoreId) {
                        // 기존 악보 편집 취소 시 모달 닫기
                        setShowPianoModal(false)
                      }
                      setPianoModalStep('measure')
                      setEditingPianoScore(null)
                      setEditingPianoScoreId(null)
                      setChordPickerIndex(null)
                      setSelectedNotesForBeam([])
                    }}
                    className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 rounded-lg"
                  >
                    {editingPianoScoreId ? '취소' : '뒤로'}
                  </button>
                  <button
                    onClick={() => {
                      if (editingPianoScore && editingPianoScore.notes.length > 0) {
                        if (editingPianoScoreId) {
                          // 기존 악보 수정
                          setPianoScores(prev => prev.map(score =>
                            score.id === editingPianoScoreId
                              ? {
                                  ...score,
                                  measureCount: editingPianoScore.measureCount,
                                  measureWidths: editingPianoScore.measureWidths,
                                  chords: editingPianoScore.chords,
                                  chordName: undefined, // 호환성용 필드는 제거
                                  notes: editingPianoScore.notes
                                }
                              : score
                          ))
                        } else {
                          // 새 악보 추가
                          const newScore: PianoScoreElement = {
                            id: `piano-${Date.now()}`,
                            x: 50,
                            y: 50,
                            pageIndex: currentPage - 1,
                            measureCount: editingPianoScore.measureCount,
                            measureWidths: editingPianoScore.measureWidths,
                            chords: editingPianoScore.chords,
                            notes: editingPianoScore.notes
                          }
                          setPianoScores(prev => [...prev, newScore])
                        }
                        setShowPianoModal(false)
                        setPianoModalStep('measure')
                        setEditingPianoScore(null)
                        setEditingPianoScoreId(null)
                        setChordPickerIndex(null)
                        setSelectedNotesForBeam([])
                      }
                    }}
                    disabled={!editingPianoScore || editingPianoScore.notes.length === 0}
                    className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {editingPianoScoreId ? '수정' : '추가'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
