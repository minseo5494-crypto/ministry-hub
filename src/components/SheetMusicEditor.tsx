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
import DrumScoreRenderer from './scores/DrumScoreRenderer'
import DrumScoreEditor from './scores/DrumScoreEditor'
import PianoScoreRenderer from './scores/PianoScoreRenderer'
import PianoScoreEditor from './scores/PianoScoreEditor'

// ===== 분리된 파일에서 import =====
import {
  Tool,
  SongFormStyle,
  PartTagStyle,
  PianoNote,
  PianoScoreElement,
  DrumNote,
  DrumScoreElement,
  EditorSong,
  EditorProps,
  LassoSelection,
  SongFormState,
  DraggingFormItem,
} from './SheetMusicEditor/types'

import {
  COLORS,
  HIGHLIGHTER_COLORS,
  PART_COLORS,
  AVAILABLE_PARTS,
  FORM_COLOR_PRESETS,
  DEFAULT_SONG_FORM_STYLE,
} from './SheetMusicEditor/constants'

import {
  getSvgPathFromStroke,
  isPointInPolygon,
  isStrokeInSelection,
} from './SheetMusicEditor/utils'

// ===== 타입 재export (하위 호환성) =====
export type {
  SongFormStyle,
  PartTagStyle,
  PianoScoreElement,
  DrumScoreElement,
  EditorSong,
}
export type { PianoNote, PianoChord, DrumNote, SavedNoteData } from './SheetMusicEditor/types'

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
  initialDrumScores = [],  // 초기 드럼 악보
  // 다중 곡 모드
  songs = [],
  setlistTitle,
  initialSongIndex = 0,
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

  // ===== 모드 전환 토스트 =====
  const [modeToast, setModeToast] = useState<{ show: boolean, mode: 'view' | 'edit' }>({ show: false, mode: 'view' })
  const modeToastTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // ===== 다중 곡 모드 지원 =====
  const isMultiSongMode = songs.length > 0
  const [currentSongIndex, setCurrentSongIndex] = useState(initialSongIndex)

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
  const [showColorPicker, setShowColorPicker] = useState(false) // 색상 선택 팝업
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
  // + 모드 전환 토스트 표시
  const prevModeRef = useRef<'view' | 'edit'>(initialMode)
  useEffect(() => {
    if (isViewMode) {
      prevToolRef.current = tool
      setTool('pan')
    } else if (prevToolRef.current !== 'pan') {
      // edit 모드로 전환 시 이전 도구 복원 (pan이 아닌 경우에만)
      setTool(prevToolRef.current)
    }

    // 모드 전환 토스트 표시 (첫 렌더링 제외)
    if (prevModeRef.current !== editorMode) {
      prevModeRef.current = editorMode
      setModeToast({ show: true, mode: editorMode })

      // 이전 타이머 정리
      if (modeToastTimeoutRef.current) {
        clearTimeout(modeToastTimeoutRef.current)
      }

      // 1.5초 후 토스트 숨김
      modeToastTimeoutRef.current = setTimeout(() => {
        setModeToast(prev => ({ ...prev, show: false }))
      }, 1500)
    }

    return () => {
      if (modeToastTimeoutRef.current) {
        clearTimeout(modeToastTimeoutRef.current)
      }
    }
  }, [isViewMode, editorMode])

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
  const [textFontSize, setTextFontSize] = useState(24) // 텍스트 크기
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
  const [draggingFormItem, setDraggingFormItem] = useState<{ type: 'songForm' | 'partTag' | 'pianoScore' | 'drumScore', id?: string } | null>(null)
  const [draggingNewPartTag, setDraggingNewPartTag] = useState<string | null>(null)

  // 피아노 악보 상태
  const [pianoScores, setPianoScores] = useState<PianoScoreElement[]>(initialPianoScores)
  const [showPianoModal, setShowPianoModal] = useState(false)
  const [editingPianoScoreId, setEditingPianoScoreId] = useState<string | null>(null) // 편집 중인 기존 악보 ID
  const [resizingPianoScore, setResizingPianoScore] = useState<{ id: string, startX: number, startScale: number } | null>(null) // 크기 조절 중인 악보
  const [selectedPianoScoreId, setSelectedPianoScoreId] = useState<string | null>(null) // 선택된 피아노 악보 ID

  // 드럼 악보 상태
  const [drumScores, setDrumScores] = useState<DrumScoreElement[]>(initialDrumScores)
  const [showDrumModal, setShowDrumModal] = useState(false)
  const [editingDrumScoreId, setEditingDrumScoreId] = useState<string | null>(null)
  const [selectedDrumScoreId, setSelectedDrumScoreId] = useState<string | null>(null)

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
    // 여백 없이 악보가 화면에 꽉 차게 표시 (이미지 다운로드 화면과 동일)
    const scaleX = containerWidth / canvasWidth
    const scaleY = containerHeight / canvasHeight

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
      e.stopPropagation()

      // 대기 중인 렌더링 취소 (이전 획 잔여 작업 정리)
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }

      // 이전 드로잉 상태 강제 정리 (연속 필기 시 끊김 방지)
      isDrawingRef.current = false
      currentStrokeRef.current = []
      drawingToolRef.current = null
      needsRenderRef.current = false

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
        setSelectedPianoScoreId(null)
        setSelectedDrumScoreId(null)
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

  // ===== 히스토리 관리 (handlePointerUp보다 먼저 정의) =====
  const saveToHistory = useCallback(() => {
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1)
      newHistory.push([...annotations])
      return newHistory
    })
    setHistoryIndex((prev) => prev + 1)
  }, [annotations, historyIndex])

  const handlePointerUp = useCallback((_e?: React.PointerEvent) => {
    // 포인터 캡처는 브라우저가 자동으로 해제함 - 명시적 해제 제거
    // (명시적 해제가 다음 pointerdown을 방해할 수 있음)
    void _e // unused

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

    // ref를 사용해서 동기적으로 체크 - 먼저 데이터 복사!
    const wasDrawing = isDrawingRef.current
    const strokePoints = [...currentStrokeRef.current] // 먼저 복사
    const savedTool = usedTool

    // refs 즉시 리셋 (동기적) - 다음 획 시작을 위해 가장 먼저!
    isDrawingRef.current = false
    currentStrokeRef.current = []
    drawingToolRef.current = null
    needsRenderRef.current = false

    // 대기 중인 렌더링 취소
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }

    // 드로잉이 없었거나 포인트가 없으면 여기서 종료
    if (!wasDrawing || strokePoints.length === 0) {
      setIsDrawing(false)
      setCurrentStroke([])
      return
    }

    // 스트로크 저장 - 드로잉 시작 시점의 도구 사용
    const newStroke: Stroke = {
      id: `stroke-${Date.now()}`,
      tool: savedTool === 'highlighter' ? 'highlighter' : 'pen',
      color,
      size: strokeSize,
      opacity: savedTool === 'highlighter' ? 0.4 : 1,
      points: strokePoints, // 복사된 데이터 사용
    }

    // state 업데이트 (비동기)
    setCurrentStroke([])
    setIsDrawing(false)

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

    // 히스토리는 나중에 저장 (다음 획 시작을 막지 않도록)
    setTimeout(() => {
      saveToHistory()
    }, 100)
  }, [tool, color, strokeSize, currentPage, isMovingSelection, finishLassoSelection, isDraggingText, saveToHistory])

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
      fontSize: textFontSize,
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
  }, [textInput, textPosition, color, currentPage, saveToHistory])

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
  }, [isDraggingText, saveToHistory])

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
  }, [editingTextId, textInput, currentPage, saveToHistory])

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

  // 너비에 맞추기
  const handleFitToWidth = useCallback(() => {
    if (!containerRef.current || canvasSize.width === 0) return

    const containerWidth = containerRef.current.clientWidth
    const fitScale = containerWidth / canvasSize.width
    setScale(fitScale)
    setOffset({ x: 0, y: 0 })
  }, [canvasSize.width])

  // 100%로 리셋
  const handleResetZoom = useCallback(() => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }, [])

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
  const swipeStartTime = useRef<number>(0) // 스와이프 시작 시간 (속도 계산용)
  const isSwiping = useRef<boolean>(false)
  const touchTapHandled = useRef<boolean>(false) // 터치 탭 처리 후 클릭 이벤트 방지용

  // 더블탭 줌 감지용
  const lastTapTime = useRef<number>(0)
  const lastTapX = useRef<number>(0)
  const lastTapY = useRef<number>(0)
  const DOUBLE_TAP_DELAY = 300 // ms
  const DOUBLE_TAP_DISTANCE = 50 // px

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
      swipeStartTime.current = Date.now()
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
      const swipeDuration = Date.now() - swipeStartTime.current
      const velocity = Math.abs(deltaX) / swipeDuration // px/ms

      // 스와이프 감지: 거리 30px 이상 또는 빠른 스와이프 (속도 0.3px/ms 이상)
      const isSwipe = Math.abs(deltaX) > Math.abs(deltaY) &&
                      (Math.abs(deltaX) > 30 || (velocity > 0.3 && Math.abs(deltaX) > 15))

      if (isSwipe) {
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
      } else if (Math.abs(deltaX) < 15 && Math.abs(deltaY) < 15) {
        // 탭 감지 (거의 움직이지 않음)
        const now = Date.now()
        const tapDistance = Math.sqrt(
          Math.pow(endX - lastTapX.current, 2) +
          Math.pow(endY - lastTapY.current, 2)
        )

        // 더블탭 감지: 300ms 이내, 50px 이내 위치
        if (now - lastTapTime.current < DOUBLE_TAP_DELAY && tapDistance < DOUBLE_TAP_DISTANCE) {
          // 더블탭 줌 토글 (100% <-> 화면 맞춤)
          if (scale > 1.2) {
            // 줌인 상태면 화면에 맞추기
            fitToScreen(canvasSize.width, canvasSize.height)
          } else {
            // 줌아웃 상태면 200%로 확대 (탭 위치 기준)
            setScale(2.0)
          }
          lastTapTime.current = 0 // 더블탭 처리 후 초기화
        } else {
          // 싱글탭: 영역별 동작
          lastTapTime.current = now
          lastTapX.current = endX
          lastTapY.current = endY

          const container = containerRef.current
          if (container) {
            const rect = container.getBoundingClientRect()
            const tapX = endX - rect.left
            const containerWidth = rect.width

            // 화면을 3등분: 왼쪽 25% / 중앙 50% / 오른쪽 25%
            const leftZone = containerWidth * 0.25
            const rightZone = containerWidth * 0.75

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
    }

    // 스와이프 상태 초기화
    swipeStartX.current = null
    swipeStartY.current = null
    isSwiping.current = false
  }, [totalPages, currentPage, isMultiSongMode, currentSongIndex, songs.length, scale, canvasSize, fitToScreen])

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
    } else if (draggingFormItem.type === 'drumScore' && draggingFormItem.id) {
      setDrumScores(prev =>
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
    } else if (draggingFormItem.type === 'drumScore' && draggingFormItem.id) {
      setDrumScores(prev =>
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
            pianoScores: pianoScores.filter(s => s.pageIndex >= 0),
            drumScores: drumScores.filter(s => s.pageIndex >= 0)
          }
        }
      })

      onSaveAll?.(dataToSave)
    } else {
      // 송폼 정보와 피아노/드럼 악보도 함께 전달
      onSave?.(currentAnnotations, { songFormEnabled, songFormStyle, partTags, pianoScores, drumScores })
    }
  }, [isMultiSongMode, onSave, songs, allAnnotations, onSaveAll, currentSong, songFormEnabled, songFormStyle, partTags, pianoScores, drumScores])

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

          // 3.6. 드럼 악보 렌더링 (해당 페이지의 악보만)
          const pageDrumScores = drumScores.filter(score => score.pageIndex === pageNum - 1)
          pageDrumScores.forEach(score => {
            const defaultWidth = 100
            const measureWidths = score.measureWidths || Array(score.measureCount).fill(defaultWidth)
            const scoreWidth = measureWidths.reduce((sum, w) => sum + w * 0.7, 0)
            const scoreHeight = 85
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

            // 5선 (오선)
            ctx.strokeStyle = '#333333'
            ctx.lineWidth = 0.8 * scaleFactor
            for (let i = 0; i < 5; i++) {
              const lineY = offsetY + (22 + i * 10) * scaleFactor
              ctx.beginPath()
              ctx.moveTo(offsetX + 3 * scaleFactor, lineY)
              ctx.lineTo(offsetX + (scoreWidth - 3) * scaleFactor, lineY)
              ctx.stroke()
            }

            // 세로줄 (마디 구분)
            ctx.beginPath()
            ctx.moveTo(offsetX + 3 * scaleFactor, offsetY + 22 * scaleFactor)
            ctx.lineTo(offsetX + 3 * scaleFactor, offsetY + 62 * scaleFactor)
            ctx.stroke()

            // 중간 마디선
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

            // 드럼 파트별 Y 위치
            const DRUM_PART_Y: Record<string, number> = {
              'CY': 7, 'RD': 12, 'HH': 17, 'TH': 22, 'TM': 37, 'SN': 42, 'TL': 47, 'KK': 67
            }
            const DRUM_STEM_UP: Record<string, boolean> = {
              'CY': true, 'RD': true, 'HH': true, 'TH': true, 'TM': true, 'SN': true, 'TL': true, 'KK': false
            }
            const stemLength = 20

            // Beam 그룹 처리
            const beamGroups: { [key: string]: DrumNote[] } = {}
            score.notes.forEach(note => {
              if (note.beamGroup && ['HH', 'SN'].includes(note.part)) {
                if (!beamGroups[note.beamGroup]) beamGroups[note.beamGroup] = []
                beamGroups[note.beamGroup].push(note)
              }
            })

            // Beam 렌더링
            Object.values(beamGroups).forEach(notesInGroup => {
              if (notesInGroup.length < 2) return
              notesInGroup.sort((a, b) => a.position - b.position)

              const firstNote = notesInGroup[0]
              const lastNote = notesInGroup[notesInGroup.length - 1]
              const allY = notesInGroup.map(n => DRUM_PART_Y[n.part] || 42)
              const beamBaseY = Math.min(...allY) - 22

              const firstX = (firstNote.position / 100) * scoreWidth
              const lastX = (lastNote.position / 100) * scoreWidth

              // 각 음표의 기둥
              notesInGroup.forEach(note => {
                const x = (note.position / 100) * scoreWidth
                const y = DRUM_PART_Y[note.part] || 42
                ctx.strokeStyle = '#000000'
                ctx.lineWidth = 1 * scaleFactor
                ctx.beginPath()
                ctx.moveTo(offsetX + (x + 4) * scaleFactor, offsetY + y * scaleFactor)
                ctx.lineTo(offsetX + (x + 4) * scaleFactor, offsetY + beamBaseY * scaleFactor)
                ctx.stroke()
              })

              const hasEighth = notesInGroup.some(n => (n.duration || 8) >= 8)
              const hasSixteenth = notesInGroup.some(n => (n.duration || 8) >= 16)

              ctx.strokeStyle = '#000000'
              ctx.lineWidth = 3 * scaleFactor

              if (hasEighth) {
                ctx.beginPath()
                ctx.moveTo(offsetX + (firstX + 4) * scaleFactor, offsetY + beamBaseY * scaleFactor)
                ctx.lineTo(offsetX + (lastX + 4) * scaleFactor, offsetY + beamBaseY * scaleFactor)
                ctx.stroke()
              }
              if (hasSixteenth) {
                ctx.beginPath()
                ctx.moveTo(offsetX + (firstX + 4) * scaleFactor, offsetY + (beamBaseY + 4) * scaleFactor)
                ctx.lineTo(offsetX + (lastX + 4) * scaleFactor, offsetY + (beamBaseY + 4) * scaleFactor)
                ctx.stroke()
              }
            })

            // 각 드럼 음표 렌더링
            score.notes.forEach(note => {
              const x = (note.position / 100) * scoreWidth
              const y = DRUM_PART_Y[note.part] || 42
              const duration = note.duration || 8
              const stemUp = DRUM_STEM_UP[note.part]
              const isXType = ['HH', 'CY', 'RD'].includes(note.part)
              const isBeamed = note.beamGroup && ['HH', 'SN'].includes(note.part)

              // 보조선 (오선 밖 - 심벌류는 제외)
              ctx.strokeStyle = '#333333'
              ctx.lineWidth = 0.8 * scaleFactor
              if (!isXType && y <= 17) {
                ctx.beginPath()
                ctx.moveTo(offsetX + (x - 6) * scaleFactor, offsetY + 12 * scaleFactor)
                ctx.lineTo(offsetX + (x + 6) * scaleFactor, offsetY + 12 * scaleFactor)
                ctx.stroke()
              }
              if (y >= 67) {
                ctx.beginPath()
                ctx.moveTo(offsetX + (x - 6) * scaleFactor, offsetY + 67 * scaleFactor)
                ctx.lineTo(offsetX + (x + 6) * scaleFactor, offsetY + 67 * scaleFactor)
                ctx.stroke()
              }

              // 음표 머리 렌더링
              ctx.fillStyle = '#000000'
              ctx.strokeStyle = '#000000'
              ctx.lineWidth = 1.5 * scaleFactor

              if (note.part === 'HH') {
                // 하이햇: X
                ctx.beginPath()
                ctx.moveTo(offsetX + (x - 3.5) * scaleFactor, offsetY + (y - 3.5) * scaleFactor)
                ctx.lineTo(offsetX + (x + 3.5) * scaleFactor, offsetY + (y + 3.5) * scaleFactor)
                ctx.stroke()
                ctx.beginPath()
                ctx.moveTo(offsetX + (x + 3.5) * scaleFactor, offsetY + (y - 3.5) * scaleFactor)
                ctx.lineTo(offsetX + (x - 3.5) * scaleFactor, offsetY + (y + 3.5) * scaleFactor)
                ctx.stroke()
              } else if (note.part === 'CY') {
                // 심벌: X + 동그라미
                ctx.beginPath()
                ctx.arc(offsetX + x * scaleFactor, offsetY + y * scaleFactor, 5 * scaleFactor, 0, Math.PI * 2)
                ctx.stroke()
                ctx.lineWidth = 1.2 * scaleFactor
                ctx.beginPath()
                ctx.moveTo(offsetX + (x - 3) * scaleFactor, offsetY + (y - 3) * scaleFactor)
                ctx.lineTo(offsetX + (x + 3) * scaleFactor, offsetY + (y + 3) * scaleFactor)
                ctx.stroke()
                ctx.beginPath()
                ctx.moveTo(offsetX + (x + 3) * scaleFactor, offsetY + (y - 3) * scaleFactor)
                ctx.lineTo(offsetX + (x - 3) * scaleFactor, offsetY + (y + 3) * scaleFactor)
                ctx.stroke()
              } else if (note.part === 'RD') {
                // 라이드: 다이아몬드 + X
                ctx.lineWidth = 1.2 * scaleFactor
                ctx.beginPath()
                ctx.moveTo(offsetX + x * scaleFactor, offsetY + (y - 4) * scaleFactor)
                ctx.lineTo(offsetX + (x + 4) * scaleFactor, offsetY + y * scaleFactor)
                ctx.lineTo(offsetX + x * scaleFactor, offsetY + (y + 4) * scaleFactor)
                ctx.lineTo(offsetX + (x - 4) * scaleFactor, offsetY + y * scaleFactor)
                ctx.closePath()
                ctx.stroke()
                ctx.beginPath()
                ctx.moveTo(offsetX + (x - 2.5) * scaleFactor, offsetY + (y - 2.5) * scaleFactor)
                ctx.lineTo(offsetX + (x + 2.5) * scaleFactor, offsetY + (y + 2.5) * scaleFactor)
                ctx.stroke()
                ctx.beginPath()
                ctx.moveTo(offsetX + (x + 2.5) * scaleFactor, offsetY + (y - 2.5) * scaleFactor)
                ctx.lineTo(offsetX + (x - 2.5) * scaleFactor, offsetY + (y + 2.5) * scaleFactor)
                ctx.stroke()
              } else {
                // 일반 음표 (채워진 타원)
                ctx.beginPath()
                ctx.ellipse(offsetX + x * scaleFactor, offsetY + y * scaleFactor, 4 * scaleFactor, 3 * scaleFactor, 0, 0, Math.PI * 2)
                ctx.fill()
              }

              // 기둥 렌더링 (beam이 없는 경우만)
              if (duration >= 4 && !isBeamed) {
                ctx.strokeStyle = '#000000'
                ctx.lineWidth = 1 * scaleFactor
                const stemX = stemUp ? x + 4 : x - 4
                const stemEndY = stemUp ? y - stemLength : y + stemLength
                ctx.beginPath()
                ctx.moveTo(offsetX + stemX * scaleFactor, offsetY + y * scaleFactor)
                ctx.lineTo(offsetX + stemX * scaleFactor, offsetY + stemEndY * scaleFactor)
                ctx.stroke()

                // 깃발 (8분음표 이상, beam 없을 때)
                if (duration >= 8) {
                  ctx.lineWidth = 1.5 * scaleFactor
                  ctx.beginPath()
                  if (stemUp) {
                    ctx.moveTo(offsetX + stemX * scaleFactor, offsetY + stemEndY * scaleFactor)
                    ctx.quadraticCurveTo(
                      offsetX + (stemX + 8) * scaleFactor, offsetY + (stemEndY + 6) * scaleFactor,
                      offsetX + (stemX + 3) * scaleFactor, offsetY + (stemEndY + 12) * scaleFactor
                    )
                  } else {
                    ctx.moveTo(offsetX + stemX * scaleFactor, offsetY + stemEndY * scaleFactor)
                    ctx.quadraticCurveTo(
                      offsetX + (stemX - 8) * scaleFactor, offsetY + (stemEndY - 6) * scaleFactor,
                      offsetX + (stemX - 3) * scaleFactor, offsetY + (stemEndY - 12) * scaleFactor
                    )
                  }
                  ctx.stroke()
                }
                if (duration >= 16) {
                  ctx.beginPath()
                  if (stemUp) {
                    ctx.moveTo(offsetX + stemX * scaleFactor, offsetY + (stemEndY + 5) * scaleFactor)
                    ctx.quadraticCurveTo(
                      offsetX + (stemX + 8) * scaleFactor, offsetY + (stemEndY + 11) * scaleFactor,
                      offsetX + (stemX + 3) * scaleFactor, offsetY + (stemEndY + 17) * scaleFactor
                    )
                  } else {
                    ctx.moveTo(offsetX + stemX * scaleFactor, offsetY + (stemEndY - 5) * scaleFactor)
                    ctx.quadraticCurveTo(
                      offsetX + (stemX - 8) * scaleFactor, offsetY + (stemEndY - 11) * scaleFactor,
                      offsetX + (stemX - 3) * scaleFactor, offsetY + (stemEndY - 17) * scaleFactor
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
                size: stroke.size * (stroke.tool === 'highlighter' ? 8 : 1),
                thinning: stroke.tool === 'highlighter' ? 0 : 0.5,
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

  // ===== 키보드 단축키 =====
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 텍스트 입력 중에는 무시
      if (isAddingText || editingTextId) return
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return

      const isCmd = e.metaKey || e.ctrlKey

      // Cmd/Ctrl + Z: 실행 취소
      if (isCmd && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }

      // Cmd/Ctrl + Shift + Z 또는 Cmd/Ctrl + Y: 다시 실행
      if ((isCmd && e.shiftKey && e.key === 'z') || (isCmd && e.key === 'y')) {
        e.preventDefault()
        redo()
        return
      }

      // 편집 모드에서만 도구 단축키 적용
      if (!isViewMode) {
        switch (e.key.toLowerCase()) {
          case 'p':
            switchTool('pen')
            break
          case 'h':
            switchTool('highlighter')
            break
          case 'e':
            switchTool('eraser')
            break
          case 't':
            if (!isMobile) switchTool('text')
            break
          case 'v':
          case ' ':  // 스페이스바도 이동 모드로
            e.preventDefault()
            switchTool('pan')
            break
        }
      }

      // 페이지 네비게이션 (화살표 키)
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        if (currentPage > 1) {
          setCurrentPage(prev => prev - 1)
        } else if (isMultiSongMode && currentSongIndex > 0) {
          setCurrentSongIndex(prev => prev - 1)
        }
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        if (currentPage < totalPages) {
          setCurrentPage(prev => prev + 1)
        } else if (isMultiSongMode && currentSongIndex < songs.length - 1) {
          setCurrentSongIndex(prev => prev + 1)
        }
      }

      // 모드 전환 (Escape)
      if (e.key === 'Escape') {
        if (isViewMode) {
          setEditorMode('edit')
        } else {
          setEditorMode('view')
        }
      }

      // 줌 단축키
      if (isCmd && (e.key === '+' || e.key === '=')) {
        e.preventDefault()
        handleZoom(0.1)
      }
      if (isCmd && e.key === '-') {
        e.preventDefault()
        handleZoom(-0.1)
      }
      if (isCmd && e.key === '0') {
        e.preventDefault()
        handleFitToScreen()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isViewMode, isAddingText, editingTextId, currentPage, totalPages, isMultiSongMode, currentSongIndex, songs.length, isMobile, undo, redo, switchTool, handleZoom, handleFitToScreen])

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
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
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

            {/* 페이지 네비게이션 - 항상 제목 옆에 표시 */}
            {totalPages > 1 && (
              <div className={`flex items-center text-gray-700 bg-gray-100 rounded-lg ${isMobile ? 'gap-0.5 px-1.5 py-0.5 ml-1' : 'gap-1 px-2 py-1 ml-2'}`}>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={`hover:bg-gray-200 rounded disabled:opacity-50 ${isMobile ? 'p-1 text-sm' : 'p-1'}`}
                >
                  ◀
                </button>
                <span className={`font-medium min-w-[35px] text-center ${isMobile ? 'text-xs' : 'text-sm'}`}>
                  {currentPage}/{totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className={`hover:bg-gray-200 rounded disabled:opacity-50 ${isMobile ? 'p-1 text-sm' : 'p-1'}`}
                >
                  ▶
                </button>
              </div>
            )}
          </div>

          {/* 중앙: 곡 네비게이션 (다중 곡 모드, 데스크톱) */}
          {!isMobile && isMultiSongMode && songs.length > 1 && (
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

          {/* 오른쪽: 모드 전환 + 저장/내보내기 버튼 */}
          <div className={`flex items-center gap-1.5 ${isMobile ? '' : 'gap-2 flex-shrink-0'}`}>
            {!isMultiSongMode && queueInfo && queueInfo.nextSongName && !isMobile && (
              <span className="text-xs text-gray-500">
                다음: {queueInfo.nextSongName}
              </span>
            )}

            {/* 모드 전환 버튼 - 더 명확한 시각적 구분 */}
            <div className={`flex items-center rounded-lg p-0.5 transition-colors ${
              isViewMode ? 'bg-blue-100' : 'bg-orange-100'
            }`}>
              <button
                onClick={() => setEditorMode('view')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                  isViewMode
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'text-blue-600 hover:bg-blue-200'
                }`}
                title="악보 보기 (스와이프로 페이지 넘기기)"
              >
                {isMobile ? '👁' : '👁 보기'}
              </button>
              <button
                onClick={() => setEditorMode('edit')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                  !isViewMode
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'text-orange-600 hover:bg-orange-200'
                }`}
                title="필기 모드 (Apple Pencil/펜으로 필기)"
              >
                {isMobile ? '✏️' : '✏️ 필기'}
              </button>
            </div>

            {/* 줌 컨트롤 - 뷰 모드에서 표시 */}
            {isViewMode && (
              <div className={`flex items-center ${isMobile ? 'gap-0.5' : 'gap-1'} bg-gray-100 rounded-lg px-2 py-1`}>
                <button
                  onClick={() => handleZoom(-0.1)}
                  className={`hover:bg-gray-200 rounded ${isMobile ? 'p-1.5 text-sm' : 'p-1'}`}
                  title="축소 (Cmd+-)"
                >
                  ➖
                </button>
                <div className="relative group">
                  <button
                    onClick={handleFitToScreen}
                    className={`hover:bg-gray-200 rounded text-xs font-medium ${isMobile ? 'px-1 py-1' : 'px-2 py-1'}`}
                    title="화면에 맞추기 (Cmd+0)"
                  >
                    {Math.round(scale * 100)}%
                  </button>
                  {/* 줌 옵션 드롭다운 (데스크탑 호버시) */}
                  {!isMobile && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 py-1 min-w-[100px]">
                      <button
                        onClick={() => { handleResetZoom(); }}
                        className="w-full px-3 py-1.5 text-xs hover:bg-gray-100 text-left"
                      >
                        100%
                      </button>
                      <button
                        onClick={() => { handleFitToWidth(); }}
                        className="w-full px-3 py-1.5 text-xs hover:bg-gray-100 text-left"
                      >
                        너비에 맞추기
                      </button>
                      <button
                        onClick={() => { handleFitToScreen(); }}
                        className="w-full px-3 py-1.5 text-xs hover:bg-gray-100 text-left"
                      >
                        화면에 맞추기
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleZoom(0.1)}
                  className={`hover:bg-gray-200 rounded ${isMobile ? 'p-1.5 text-sm' : 'p-1'}`}
                  title="확대 (Cmd++)"
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

        {/* 모바일에서 곡 네비게이션 (다중 곡 모드) 두 번째 줄에 표시 */}
        {isMobile && isMultiSongMode && songs.length > 1 && (
          <div className="flex items-center justify-center gap-4 mt-1.5 pt-1.5 border-t border-gray-100">
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
          </div>
        )}
      </div>

      {/* 도구 모음 - 밝은 테마 (모바일 최적화) - 편집 모드에서만 표시 */}
      <div className={`bg-gray-50 border-b border-gray-200 flex items-center flex-wrap transition-all duration-300 ${
        isViewMode ? 'max-h-0 overflow-hidden opacity-0 p-0 border-b-0' : `${isMobile ? 'p-1.5 gap-1.5 gap-y-1 opacity-100' : 'p-2 gap-3 gap-y-1.5 opacity-100'}`
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
            <div className={`flex items-center ${isMobile ? 'gap-1' : 'gap-1'} relative`}>
              {/* 모바일: 4개 색상 + 더보기 버튼, 데스크탑: 모든 색상 */}
              {(tool === 'highlighter' ? HIGHLIGHTER_COLORS : COLORS).slice(0, isMobile ? 4 : undefined).map((c) => (
                <button
                  key={c}
                  onClick={() => { setColor(c); setShowColorPicker(false) }}
                  className={`rounded-full border-2 aspect-square flex-shrink-0 ${
                    color === c ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300'
                  } ${isMobile ? 'w-6 h-6 min-w-[24px]' : 'w-7 h-7 min-w-[28px]'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
              {/* 모바일에서 더보기 버튼 */}
              {isMobile && (
                <button
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className={`rounded-full border-2 aspect-square flex-shrink-0 w-6 h-6 min-w-[24px] flex items-center justify-center text-xs ${
                    showColorPicker ? 'border-blue-500 bg-blue-100' : 'border-gray-300 bg-gray-100'
                  }`}
                  title="더 많은 색상"
                >
                  +
                </button>
              )}
              {/* 색상 선택 팝업 (모바일) */}
              {isMobile && showColorPicker && (
                <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 p-3 z-50">
                  <div className="grid grid-cols-5 gap-2">
                    {(tool === 'highlighter' ? HIGHLIGHTER_COLORS : COLORS).map((c) => (
                      <button
                        key={c}
                        onClick={() => { setColor(c); setShowColorPicker(false) }}
                        className={`rounded-full border-2 aspect-square w-8 h-8 ${
                          color === c ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className={`bg-gray-300 ${isMobile ? 'w-px h-5' : 'w-px h-6'}`} />
          </>
        )}

        {/* 텍스트 크기 조절 */}
        {tool === 'text' && (
          <>
            <div className="flex items-center gap-1.5">
              {/* 텍스트 크기 미리보기 */}
              <span
                className="font-bold text-gray-700"
                style={{ fontSize: Math.min(textFontSize / 2, 16) + 'px' }}
              >
                A
              </span>
              <select
                value={textFontSize}
                onChange={(e) => setTextFontSize(Number(e.target.value))}
                className="text-sm border border-gray-300 rounded px-1 py-0.5 bg-white"
              >
                <option value={12}>12</option>
                <option value={16}>16</option>
                <option value={20}>20</option>
                <option value={24}>24</option>
                <option value={32}>32</option>
                <option value={40}>40</option>
                <option value={48}>48</option>
                <option value={64}>64</option>
              </select>
              <span className="text-xs text-gray-500">pt</span>
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
            <div className="flex items-center gap-1.5">
              {/* 굵기 미리보기 */}
              <div
                className="flex items-center justify-center"
                style={{ width: isMobile ? 20 : 24, height: isMobile ? 20 : 24 }}
              >
                <div
                  className="rounded-full"
                  style={{
                    width: tool === 'highlighter' ? strokeSize * 3 : strokeSize + 2,
                    height: tool === 'highlighter' ? strokeSize * 1.5 : strokeSize + 2,
                    backgroundColor: color,
                    opacity: tool === 'highlighter' ? 0.4 : 1,
                    borderRadius: tool === 'highlighter' ? '20%' : '50%',
                    maxWidth: isMobile ? 18 : 22,
                    maxHeight: isMobile ? 16 : 20,
                  }}
                />
              </div>
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
            title="축소 (Cmd+-)"
          >
            ➖
          </button>
          <div className="relative group">
            <button
              onClick={handleFitToScreen}
              className={`hover:bg-gray-200 rounded text-gray-700 ${isMobile ? 'text-xs w-10 py-1' : 'text-sm w-12 py-1'}`}
              title="화면에 맞추기 (Cmd+0)"
            >
              {Math.round(scale * 100)}%
            </button>
            {/* 줌 옵션 드롭다운 */}
            {!isMobile && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 py-1 min-w-[100px]">
                <button
                  onClick={() => { handleResetZoom(); }}
                  className="w-full px-3 py-1.5 text-xs hover:bg-gray-100 text-left text-gray-700"
                >
                  100%
                </button>
                <button
                  onClick={() => { handleFitToWidth(); }}
                  className="w-full px-3 py-1.5 text-xs hover:bg-gray-100 text-left text-gray-700"
                >
                  너비에 맞추기
                </button>
                <button
                  onClick={() => { handleFitToScreen(); }}
                  className="w-full px-3 py-1.5 text-xs hover:bg-gray-100 text-left text-gray-700"
                >
                  화면에 맞추기
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => handleZoom(0.1)}
            className={`hover:bg-gray-200 rounded text-gray-700 ${isMobile ? 'p-2 text-lg' : 'p-2'}`}
            title="확대 (Cmd++)"
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

        {/* 구분선 */}
        <div className={`bg-gray-300 ${isMobile ? 'w-px h-5' : 'w-px h-6'}`} />

        {/* 송폼 버튼 - songForms가 있을 때만 표시 */}
        {effectiveSongForms.length > 0 && (
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
            className={`rounded font-medium flex items-center gap-1 flex-shrink-0 ${
              songFormEnabled
                ? 'bg-purple-100 text-purple-700 border border-purple-300'
                : 'bg-purple-50 text-purple-600 hover:bg-purple-100'
            } ${isMobile ? 'px-2 py-1.5 text-xs' : 'px-3 py-1.5 text-sm'}`}
            title="송폼 & 파트 태그"
          >
            🎵 {isMobile ? '' : '송폼'} {songFormEnabled ? '✓' : ''}
          </button>
        )}

        {/* 피아노 악보 버튼 */}
        <button
          onClick={() => {
            setEditingPianoScoreId(null)
            setShowPianoModal(true)
          }}
          className={`rounded font-medium flex items-center gap-1 flex-shrink-0 bg-blue-50 text-blue-600 hover:bg-blue-100 ${isMobile ? 'px-2 py-1.5 text-xs' : 'px-3 py-1.5 text-sm'}`}
          title="피아노 악보 추가"
        >
          🎹 {isMobile ? '' : '피아노'}
        </button>

        {/* 드럼 악보 버튼 */}
        <button
          onClick={() => {
            setEditingDrumScoreId(null)
            setShowDrumModal(true)
          }}
          className={`rounded font-medium flex items-center gap-1 flex-shrink-0 bg-orange-50 text-orange-600 hover:bg-orange-100 ${isMobile ? 'px-2 py-1.5 text-xs' : 'px-3 py-1.5 text-sm'}`}
          title="드럼 악보 추가"
        >
          🥁 {isMobile ? '' : '드럼'}
        </button>
      </div>

      {/* 캔버스 영역 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex items-center justify-center bg-black select-none"
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
        {/* 모드 전환 토스트 */}
        {modeToast.show && (
          <div className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 px-6 py-3 rounded-xl shadow-2xl text-white font-medium text-lg transition-all duration-300 ${
            modeToast.mode === 'view'
              ? 'bg-blue-500'
              : 'bg-orange-500'
          }`}
          style={{
            animation: 'fadeInScale 0.2s ease-out',
          }}
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl">{modeToast.mode === 'view' ? '👁' : '✏️'}</span>
              <span>{modeToast.mode === 'view' ? '보기 모드' : '필기 모드'}</span>
            </div>
          </div>
        )}

        <div
          style={{
            transform: `scale(${scale}) translate(${offset.x}px, ${offset.y}px)`,
            transformOrigin: 'center center',
            touchAction: 'none',
          }}
          className="relative"
        >
          {/* 내보내기용 영역 (캔버스 + 오버레이 포함) */}
          <div ref={exportAreaRef} className="relative" style={{ touchAction: 'none' }}>
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
            onPointerCancel={handlePointerUp}
            onPointerLeave={(e) => {
              // 포인터 캡처 중에는 leave 이벤트 무시 (연속 필기 보호)
              if (!isDrawingRef.current) {
                handlePointerUp(e)
              }
            }}
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
            const baseScaleFactor = canvasSize.height * 0.001
            const userScale = score.scale || 1.0
            const scaleFactor = baseScaleFactor * userScale
            const isSelected = selectedPianoScoreId === score.id

            return (
              <PianoScoreRenderer
                key={score.id}
                score={score}
                scaleFactor={scaleFactor}
                isSelected={isSelected}
                isViewMode={isViewMode}
                onSelect={() => setSelectedPianoScoreId(score.id)}
                onEdit={() => {
                  setEditingPianoScoreId(score.id)
                  setShowPianoModal(true)
                }}
                onDelete={() => {
                  setPianoScores(prev => prev.filter(s => s.id !== score.id))
                  setSelectedPianoScoreId(null)
                }}
                onDragStart={() => setDraggingFormItem({ type: 'pianoScore', id: score.id })}
                onResizeStart={(startX, startScale) => setResizingPianoScore({ id: score.id, startX, startScale })}
                onTouchMove={handleFormTouchMove}
                onTouchEnd={handleFormTouchEnd}
                lastTapTimeRef={lastTapTimeRef}
              />
            )
          })}

          {/* 드럼 악보 렌더링 */}
          {drumScores.filter(score => score.pageIndex === currentPage - 1).map(score => {
            const baseScaleFactor = canvasSize.height * 0.001
            const userScale = score.scale || 1.0
            const scaleFactor = baseScaleFactor * userScale
            const isSelected = selectedDrumScoreId === score.id

            return (
              <DrumScoreRenderer
                key={score.id}
                score={score}
                scaleFactor={scaleFactor}
                isSelected={isSelected}
                isViewMode={isViewMode}
                onSelect={() => setSelectedDrumScoreId(score.id)}
                onEdit={() => {
                  setEditingDrumScoreId(score.id)
                  setShowDrumModal(true)
                }}
                onDelete={() => {
                  setDrumScores(prev => prev.filter(s => s.id !== score.id))
                  setSelectedDrumScoreId(null)
                }}
                onDragStart={() => setDraggingFormItem({ type: 'drumScore', id: score.id })}
                onTouchMove={handleFormTouchMove}
                onTouchEnd={handleFormTouchEnd}
                lastTapTimeRef={lastTapTimeRef}
              />
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
                    className={`rounded-full border-2 aspect-square flex-shrink-0 ${
                      isMobile ? 'w-9 h-9 min-w-[36px]' : 'w-6 h-6 min-w-[24px]'
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
      <PianoScoreEditor
        isOpen={showPianoModal}
        editingScoreId={editingPianoScoreId}
        existingScore={editingPianoScoreId ? pianoScores.find(s => s.id === editingPianoScoreId) : undefined}
        currentPage={currentPage}
        isMobile={isMobile}
        onSave={(score) => {
          if (editingPianoScoreId) {
            setPianoScores(prev => prev.map(s => s.id === editingPianoScoreId ? score : s))
          } else {
            setPianoScores(prev => [...prev, score])
          }
          setEditingPianoScoreId(null)
        }}
        onClose={() => {
          setShowPianoModal(false)
          setEditingPianoScoreId(null)
        }}
      />

      {/* 드럼 악보 모달 */}
      <DrumScoreEditor
        isOpen={showDrumModal}
        editingScoreId={editingDrumScoreId}
        existingScore={editingDrumScoreId ? drumScores.find(s => s.id === editingDrumScoreId) : undefined}
        currentPage={currentPage}
        isMobile={isMobile}
        onSave={(score) => {
          if (editingDrumScoreId) {
            // 기존 악보 수정
            setDrumScores(prev => prev.map(s =>
              s.id === editingDrumScoreId ? score : s
            ))
          } else {
            // 새 악보 추가
            setDrumScores(prev => [...prev, score])
          }
          setEditingDrumScoreId(null)
        }}
        onClose={() => {
          setShowDrumModal(false)
          setEditingDrumScoreId(null)
        }}
      />
    </div>
  )
}
