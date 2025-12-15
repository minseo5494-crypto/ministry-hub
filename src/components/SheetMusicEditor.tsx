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
}

interface EditorProps {
  fileUrl: string
  fileType: 'pdf' | 'image'
  songName: string
  artistName?: string
  initialAnnotations?: PageAnnotation[]
  onSave?: (annotations: PageAnnotation[], extra?: { songFormEnabled: boolean, songFormStyle: SongFormStyle, partTags: PartTagStyle[] }) => void
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
  // 다중 곡 모드 (콘티 필기용)
  songs?: EditorSong[]
  setlistTitle?: string
  onSaveAll?: (data: { song: EditorSong, annotations: PageAnnotation[], extra?: { songFormEnabled: boolean, songFormStyle: SongFormStyle, partTags: PartTagStyle[] } }[]) => void
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
  const [isDrawing, setIsDrawing] = useState(false)

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
  const [draggingFormItem, setDraggingFormItem] = useState<{ type: 'songForm' | 'partTag', id?: string } | null>(null)
  const [draggingNewPartTag, setDraggingNewPartTag] = useState<string | null>(null)

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
      const isSelected = lassoSelection.selectedTextIds.includes(textEl.id)
      ctx.font = `${textEl.fontSize}px sans-serif`
      ctx.fillStyle = textEl.color
      if (isSelected) {
        ctx.save()
        ctx.shadowColor = '#0066FF'
        ctx.shadowBlur = 4
      }
      ctx.fillText(textEl.text, textEl.x, textEl.y)
      if (isSelected) {
        ctx.restore()
      }
    })
  }, [annotations, currentStroke, currentPage, tool, color, strokeSize, getCurrentPageAnnotation, lassoSelection, canvasReady])

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

  // ===== 포인터 이벤트 핸들러 =====
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      const pos = getPointerPosition(e)

      if (tool === 'pan') {
        isPanningRef.current = true
        lastPanPositionRef.current = { x: e.clientX, y: e.clientY }
        return
      }

      if (tool === 'text') {
        setTextPosition({ x: pos.x, y: pos.y })
        setIsAddingText(true)
        return
      }

      if (tool === 'eraser') {
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
        setIsDrawing(true)
        drawingToolRef.current = 'lasso'
        return
      }

      // 펜/형광펜 드로잉 시작 - 시작 시점의 도구를 저장
      drawingToolRef.current = tool
      setIsDrawing(true)
      setCurrentStroke([pos])
    },
    [tool, getPointerPosition, eraseAtPosition, lassoSelection.boundingBox]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const pos = getPointerPosition(e)

      // 지우개 커서 위치 업데이트
      if (tool === 'eraser') {
        setEraserPosition({ x: e.clientX, y: e.clientY })
        if (isDrawing) {
          eraseAtPosition(pos.x, pos.y)
        }
        return
      } else {
        setEraserPosition(null)
      }

      if (tool === 'pan' && isPanningRef.current) {
        const dx = e.clientX - lastPanPositionRef.current.x
        const dy = e.clientY - lastPanPositionRef.current.y
        setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
        lastPanPositionRef.current = { x: e.clientX, y: e.clientY }
        return
      }

      if (tool === 'lasso') {
        if (isMovingSelection && moveStartPos) {
          const dx = pos.x - moveStartPos.x
          const dy = pos.y - moveStartPos.y
          moveSelection(dx, dy)
          setMoveStartPos({ x: pos.x, y: pos.y })
          return
        }
        if (isDrawing) {
          setLassoSelection(prev => ({
            ...prev,
            points: [...prev.points, pos],
          }))
          return
        }
      }

      if (!isDrawing) return

      setCurrentStroke((prev) => [...prev, pos])
    },
    [isDrawing, tool, getPointerPosition, eraseAtPosition, isMovingSelection, moveStartPos, moveSelection]
  )

  const handlePointerUp = useCallback(() => {
    // 드로잉 시작 시 저장했던 도구 사용 (도구 전환 시에도 올바르게 저장)
    const usedTool = drawingToolRef.current || tool

    if (usedTool === 'pan' || tool === 'pan') {
      isPanningRef.current = false
      return
    }

    if (usedTool === 'eraser' || tool === 'eraser') {
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
      if (isDrawing) {
        setIsDrawing(false)
        finishLassoSelection()
        drawingToolRef.current = null
        return
      }
      drawingToolRef.current = null
      return
    }

    if (!isDrawing || currentStroke.length === 0) {
      setIsDrawing(false)
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
      points: currentStroke,
    }

    console.log('🖊️ 새 스트로크 저장:', {
      id: newStroke.id,
      pointsCount: newStroke.points.length,
      color: newStroke.color,
      currentPage
    })

    setAnnotations((prev) => {
      const existing = prev.find((a) => a.pageNumber === currentPage)
      let newAnnotations
      if (existing) {
        newAnnotations = prev.map((a) =>
          a.pageNumber === currentPage
            ? { ...a, strokes: [...a.strokes, newStroke] }
            : a
        )
      } else {
        newAnnotations = [
          ...prev,
          {
            pageNumber: currentPage,
            strokes: [newStroke],
            textElements: [],
          },
        ]
      }
      console.log('🖊️ 업데이트된 annotations:', newAnnotations.map(a => ({
        page: a.pageNumber,
        strokesCount: a.strokes.length
      })))
      return newAnnotations
    })

    setCurrentStroke([])
    setIsDrawing(false)
    drawingToolRef.current = null

    // 히스토리에 추가
    saveToHistory()
  }, [isDrawing, currentStroke, tool, color, strokeSize, currentPage, isMovingSelection, finishLassoSelection])

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
  const handleViewModeClick = useCallback((e: React.MouseEvent) => {
    if (!isViewMode) return

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
    }
  }, [draggingFormItem])

  const handleFormDragEnd = useCallback(() => {
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
    console.log('🔵 handleSave 호출됨, isMultiSongMode:', isMultiSongMode)
    console.log('🔵 현재 annotations (ref에서):', currentAnnotations)
    console.log('🔵 strokes 수:', currentAnnotations.reduce((sum, a) => sum + (a.strokes?.length || 0), 0))

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
            partTags: formState.partTags
          }
        }
      })

      console.log('📝 저장 데이터:', dataToSave.map(d => ({
        song: d.song.song_name,
        annotationCount: d.annotations.length,
        strokeCount: d.annotations.reduce((sum, a) => sum + (a.strokes?.length || 0), 0),
        songFormEnabled: d.extra?.songFormEnabled
      })))

      onSaveAll?.(dataToSave)
    } else {
      console.log('📝 단일 곡 모드 저장:', {
        annotationCount: currentAnnotations.length,
        strokeCount: currentAnnotations.reduce((sum, a) => sum + (a.strokes?.length || 0), 0),
        songFormEnabled,
        partTagsCount: partTags.length
      })
      // 송폼 정보도 함께 전달
      onSave?.(currentAnnotations, { songFormEnabled, songFormStyle, partTags })
    }
  }, [isMultiSongMode, onSave, songs, allAnnotations, onSaveAll, currentSong, songFormEnabled, songFormStyle, partTags])

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
        // 이미지: 여러 페이지면 ZIP으로, 단일 페이지면 바로 다운로드
        if (allPages.length === 1) {
          const link = document.createElement('a')
          link.download = `${baseName}.png`
          link.href = allPages[0].imageDataUrl
          link.click()
        } else {
          // 다중 페이지: JSZip 사용
          const JSZip = (await import('jszip')).default
          const zip = new JSZip()

          allPages.forEach((page, idx) => {
            const base64Data = page.imageDataUrl.split(',')[1]
            const fileName = allPages.length > 1 && songsToExport.length > 1
              ? `${page.songName}_p${page.pageNum}.png`
              : `${idx + 1}.png`
            zip.file(fileName, base64Data, { base64: true })
          })

          const zipBlob = await zip.generateAsync({ type: 'blob' })
          const link = document.createElement('a')
          link.download = `${baseName}.zip`
          link.href = URL.createObjectURL(zipBlob)
          link.click()
          URL.revokeObjectURL(link.href)
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
    // 현재 그리는 중인 스트로크가 있으면 먼저 저장
    if (isDrawing && currentStroke.length > 0 && drawingToolRef.current) {
      const usedTool = drawingToolRef.current
      const newStroke: Stroke = {
        id: `stroke-${Date.now()}`,
        tool: usedTool === 'highlighter' ? 'highlighter' : 'pen',
        color,
        size: strokeSize,
        opacity: usedTool === 'highlighter' ? 0.4 : 1,
        points: currentStroke,
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

      setCurrentStroke([])
      setIsDrawing(false)
      drawingToolRef.current = null
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
      </div>

      {/* 캔버스 영역 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex items-center justify-center bg-gray-400"
        onMouseMove={handleFormDragMove}
        onMouseUp={handleFormDragEnd}
        onMouseLeave={handleFormDragEnd}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handlePartTagDrop}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
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
            style={{ cursor: getCursorStyle(), touchAction: 'none' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />

          {/* 텍스트 입력 모달 */}
          {isAddingText && (
            <div
              className="absolute bg-white border-2 border-blue-500 rounded shadow-lg p-2"
              style={{ left: textPosition.x, top: textPosition.y }}
            >
              <input
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
            <p className={`text-gray-500 mb-2 ${isMobile ? 'text-sm' : 'text-xs'}`}>드래그해서 악보 위에 배치</p>
            <div className={`grid grid-cols-4 ${isMobile ? 'gap-2' : 'gap-1'}`}>
              {AVAILABLE_PARTS.map(part => (
                <div
                  key={part.key}
                  draggable
                  onDragStart={() => setDraggingNewPartTag(part.key)}
                  onDragEnd={() => setDraggingNewPartTag(null)}
                  className={`flex items-center justify-center text-white rounded cursor-move hover:opacity-80 transition-opacity font-bold ${
                    isMobile ? 'p-2.5 text-sm' : 'p-1.5 text-xs'
                  }`}
                  style={{ backgroundColor: PART_COLORS[part.key] }}
                  title={part.label}
                >
                  {part.key}
                </div>
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
    </div>
  )
}
