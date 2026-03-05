'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight, Trash2, Download } from 'lucide-react'

// 전역 타입 선언
declare global {
  interface Window {
    pdfjsLib: any
  }
}

interface Song {
  id: string
  song_name: string
  file_url?: string
  file_type?: string
  selectedForm?: string[]
}

// 스타일 인터페이스
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

interface Props {
  songs: Song[]
  songForms: { [key: string]: string[] }
  onConfirm: (
    songFormStyles: { [key: string]: SongFormStyle },
    partTagStyles: { [songId: string]: PartTagStyle[] },
    canvasDataUrls: { [songId: string]: string[] }
  ) => void
  onCancel: () => void
}

// 색상 프리셋
const COLOR_PRESETS = [
  { name: '파랑', value: '#3B82F6' },
  { name: '인디고', value: '#6366F1' },
  { name: '보라', value: '#8B5CF6' },
  { name: '빨강', value: '#EF4444' },
  { name: '초록', value: '#22C55E' },
  { name: '검정', value: '#374151' },
]

// 파트 태그 색상 (부드러운 파스텔 톤)
const PART_COLORS: { [key: string]: string } = {
  'I': '#FDA4AF',      // 파스텔 핑크
  'V': '#93C5FD',      // 파스텔 블루
  'V1': '#A5B4FC',     // 파스텔 인디고
  'V2': '#93C5FD',     // 파스텔 블루
  'V3': '#C4B5FD',     // 파스텔 퍼플
  'PC': '#FDE68A',     // 파스텔 옐로우
  'C': '#86EFAC',      // 파스텔 그린
  'C1': '#A7F3D0',     // 파스텔 민트
  'C2': '#86EFAC',     // 파스텔 그린
  'B': '#DDD6FE',      // 파스텔 바이올렛
  '간주': '#FDBA74',   // 파스텔 오렌지
  'Out': '#D1D5DB',    // 파스텔 그레이
}

// 파트 태그 텍스트 색상 (어두운 버전)
const PART_TEXT_COLORS: { [key: string]: string } = {
  'I': '#9F1239',      // 다크 핑크
  'V': '#1E40AF',      // 다크 블루
  'V1': '#3730A3',     // 다크 인디고
  'V2': '#1E40AF',     // 다크 블루
  'V3': '#5B21B6',     // 다크 퍼플
  'PC': '#92400E',     // 다크 옐로우
  'C': '#166534',      // 다크 그린
  'C1': '#065F46',     // 다크 민트
  'C2': '#166534',     // 다크 그린
  'B': '#5B21B6',      // 다크 바이올렛
  '간주': '#9A3412',   // 다크 오렌지
  'Out': '#374151',    // 다크 그레이
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

// A4 크기 (2배 해상도)
const A4_WIDTH = 595.28 * 2
const A4_HEIGHT = 841.89 * 2

export default function SongFormPositionModal({ songs, songForms, onConfirm, onCancel }: Props) {
  const songsWithForms = songs.filter(song => {
    const forms = songForms[song.id] || song.selectedForm || []
    return forms.length > 0
  })

  const [currentSongIndex, setCurrentSongIndex] = useState(0)
  const [currentPageIndex, setCurrentPageIndex] = useState(0)

  // 스타일 상태
  const [songFormStyles, setSongFormStyles] = useState<{ [key: string]: SongFormStyle }>({})
  const [partTagStyles, setPartTagStyles] = useState<{ [songId: string]: PartTagStyle[] }>({})

  // 다중 페이지 캔버스 데이터 저장용 ref
  const canvasDataUrlsRef = useRef<{ [songId: string]: string[] }>({})

  // 캔버스 관련
  const mainCanvasRef = useRef<HTMLCanvasElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [isLoadingFile, setIsLoadingFile] = useState(false)
  // 다중 페이지 배경 이미지
  const [backgroundImages, setBackgroundImages] = useState<HTMLImageElement[]>([])
  const [totalPages, setTotalPages] = useState(1)

  // 드래그 상태
  const [draggingItem, setDraggingItem] = useState<{ type: 'songForm' | 'partTag', id?: string } | null>(null)
  const draggingItemRef = useRef<{ type: 'songForm' | 'partTag', id?: string } | null>(null)
  const [draggingNewTag, setDraggingNewTag] = useState<string | null>(null)

  // 스타일 refs (native touch handler에서 최신 상태 접근용)
  const songFormStylesRef = useRef(songFormStyles)
  const partTagStylesRef = useRef(partTagStyles)

  // 폰트 로드 상태
  const [fontLoaded, setFontLoaded] = useState(false)

  // 폰트 로드
  useEffect(() => {
    const loadFont = async () => {
      try {
        await document.fonts.load('bold 48px "Noto Sans KR"')
        await document.fonts.load('bold 48px Arial')
        setFontLoaded(true)
      } catch (e) {
        console.warn('폰트 로드 실패, 기본 폰트 사용')
        setFontLoaded(true)
      }
    }
    loadFont()
  }, [])

  // ref 동기화
  useEffect(() => { draggingItemRef.current = draggingItem }, [draggingItem])
  useEffect(() => { songFormStylesRef.current = songFormStyles }, [songFormStyles])
  useEffect(() => { partTagStylesRef.current = partTagStyles }, [partTagStyles])

  useEffect(() => {
    if (songsWithForms.length === 0) {
      onConfirm({}, {}, {})
    }
  }, [])

  if (songsWithForms.length === 0) {
    return null
  }

  const currentSong = songsWithForms[currentSongIndex]
  const currentForms = songForms[currentSong.id] || currentSong.selectedForm || []
  const formText = currentForms.join(' - ')

  // 현재 곡의 스타일 (기본값 포함)
  const currentFormStyle: SongFormStyle = songFormStyles[currentSong.id] || {
    x: 50,
    y: 5,
    fontSize: 36,
    color: '#3B82F6',
    opacity: 1
  }

  // 현재 페이지의 파트 태그만 필터링
  const currentPartTags: PartTagStyle[] = (partTagStyles[currentSong.id] || []).filter(
    tag => (tag.pageIndex || 0) === currentPageIndex
  )

  // 현재 페이지의 배경 이미지
  const currentBackgroundImage = backgroundImages[currentPageIndex] || null

  // 초기 스타일 설정
  useEffect(() => {
    songsWithForms.forEach(song => {
      if (!songFormStyles[song.id]) {
        setSongFormStyles(prev => ({
          ...prev,
          [song.id]: {
            x: 50,
            y: 5,
            fontSize: 36,
            color: '#3B82F6',
            opacity: 1
          }
        }))
      }
    })
  }, [songsWithForms.length])

  // 곡이 변경될 때 페이지 인덱스 리셋
  useEffect(() => {
    setCurrentPageIndex(0)
  }, [currentSongIndex])

  // 다중 페이지 악보 이미지 로드
  useEffect(() => {
    let isCancelled = false

    const loadFile = async () => {
      const fileUrl = currentSong.file_url
      if (!fileUrl) return

      setIsLoadingFile(true)
      setBackgroundImages([])
      setTotalPages(1)
      setCurrentPageIndex(0)

      const isPDF = currentSong.file_type === 'pdf' ||
                    fileUrl.toLowerCase().endsWith('.pdf')

      try {
        if (isPDF) {
          const pdfjsLib = window.pdfjsLib
          if (!pdfjsLib) {
            console.error('PDF.js가 로드되지 않았습니다')
            setIsLoadingFile(false)
            return
          }

          const loadingTask = pdfjsLib.getDocument({ url: fileUrl, cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/', cMapPacked: true, standardFontDataUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/' })
          const pdf = await loadingTask.promise

          if (isCancelled) return

          const pageCount = pdf.numPages
          setTotalPages(pageCount)
          console.log(`📄 PDF 페이지 수: ${pageCount}`)

          const loadedImages: HTMLImageElement[] = []

          // 모든 페이지 로드
          for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
            if (isCancelled) return

            const page = await pdf.getPage(pageNum)

            // 고해상도로 렌더링 (A4 2배)
            const originalViewport = page.getViewport({ scale: 1 })
            const scale = Math.min(
              A4_WIDTH / originalViewport.width,
              A4_HEIGHT / originalViewport.height
            ) * 0.95
            const viewport = page.getViewport({ scale })

            const offscreenCanvas = document.createElement('canvas')
            offscreenCanvas.width = A4_WIDTH
            offscreenCanvas.height = A4_HEIGHT
            const offscreenCtx = offscreenCanvas.getContext('2d')

            if (!offscreenCtx) continue

            // 흰색 배경
            offscreenCtx.fillStyle = '#FFFFFF'
            offscreenCtx.fillRect(0, 0, A4_WIDTH, A4_HEIGHT)

            // 중앙 정렬
            const offsetX = (A4_WIDTH - viewport.width) / 2
            const offsetY = (A4_HEIGHT - viewport.height) / 2

            offscreenCtx.save()
            offscreenCtx.translate(offsetX, offsetY)

            await page.render({
              canvasContext: offscreenCtx,
              viewport: viewport,
            }).promise

            offscreenCtx.restore()

            if (isCancelled) return

            const imageDataUrl = offscreenCanvas.toDataURL('image/png')

            // 이미지 객체로 변환
            const img = await new Promise<HTMLImageElement>((resolve, reject) => {
              const image = new Image()
              image.crossOrigin = 'anonymous'
              image.onload = () => resolve(image)
              image.onerror = reject
              image.src = imageDataUrl
            })

            loadedImages.push(img)
            console.log(`✅ 페이지 ${pageNum}/${pageCount} 로드 완료`)
          }

          if (!isCancelled) {
            setBackgroundImages(loadedImages)
            setIsLoadingFile(false)
          }

        } else {
          // 이미지 파일
          const img = new Image()
          img.crossOrigin = 'anonymous'

          img.onload = () => {
            if (isCancelled) return
            setBackgroundImages([img])
            setTotalPages(1)
            setIsLoadingFile(false)
          }

          img.onerror = () => {
            console.error('이미지 로드 실패')
            setIsLoadingFile(false)
          }

          img.src = fileUrl
        }

      } catch (error) {
        console.error('파일 렌더링 오류:', error)
        setIsLoadingFile(false)
      }
    }

    loadFile()

    return () => {
      isCancelled = true
    }
  }, [currentSong.id])

  // 메인 캔버스에 현재 페이지 렌더링
  const renderMainCanvas = useCallback(() => {
    if (!mainCanvasRef.current || !currentBackgroundImage || !fontLoaded) return

    const canvas = mainCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 캔버스 크기 설정 (A4 2배 해상도)
    canvas.width = A4_WIDTH
    canvas.height = A4_HEIGHT

    // 배경 이미지 그리기
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, A4_WIDTH, A4_HEIGHT)

    // 이미지를 A4 크기에 맞게 그리기
    const scale = Math.min(
      A4_WIDTH / currentBackgroundImage.naturalWidth,
      A4_HEIGHT / currentBackgroundImage.naturalHeight
    ) * 0.95

    const imgWidth = currentBackgroundImage.naturalWidth * scale
    const imgHeight = currentBackgroundImage.naturalHeight * scale
    const imgX = (A4_WIDTH - imgWidth) / 2
    const imgY = (A4_HEIGHT - imgHeight) / 2

    ctx.drawImage(currentBackgroundImage, imgX, imgY, imgWidth, imgHeight)

    // 송폼 텍스트 - 모든 페이지에 표시
    if (currentForms.length > 0) {
      const style = currentFormStyle
      const fontSize = style.fontSize * 2

      ctx.save()
      ctx.globalAlpha = style.opacity
      ctx.font = `bold ${fontSize}px Arial, "Noto Sans KR", sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'

      const x = (style.x / 100) * A4_WIDTH
      const y = (style.y / 100) * A4_HEIGHT

      // 흰색 외곽선
      ctx.strokeStyle = '#FFFFFF'
      ctx.lineWidth = fontSize * 0.15
      ctx.lineJoin = 'round'
      ctx.miterLimit = 2
      ctx.strokeText(formText, x, y)

      // 본문 텍스트
      ctx.fillStyle = style.color
      ctx.fillText(formText, x, y)

      ctx.restore()
    }

    // 현재 페이지의 파트 태그 그리기
    currentPartTags.forEach(tag => {
      const fontSize = tag.fontSize * 2

      ctx.save()
      ctx.globalAlpha = tag.opacity
      ctx.font = `bold ${fontSize}px Arial, "Noto Sans KR", sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      const x = (tag.x / 100) * A4_WIDTH
      const y = (tag.y / 100) * A4_HEIGHT

      // 흰색 외곽선
      ctx.strokeStyle = '#FFFFFF'
      ctx.lineWidth = fontSize * 0.15
      ctx.lineJoin = 'round'
      ctx.miterLimit = 2
      ctx.strokeText(tag.label, x, y)

      // 본문 텍스트
      ctx.fillStyle = tag.color
      ctx.fillText(tag.label, x, y)

      ctx.restore()
    })

    // 미리보기 캔버스에도 그리기
    if (previewCanvasRef.current) {
      const preview = previewCanvasRef.current
      const previewCtx = preview.getContext('2d')
      if (previewCtx) {
        preview.width = 480
        preview.height = 680
        previewCtx.drawImage(canvas, 0, 0, 480, 680)
      }
    }

  }, [currentBackgroundImage, currentForms, currentFormStyle, currentPartTags, fontLoaded, currentPageIndex, formText])

  // 배경 이미지나 스타일 변경 시 캔버스 다시 그리기
  useEffect(() => {
    renderMainCanvas()
  }, [renderMainCanvas])

  // 스타일 업데이트 함수들
  const updateFormStyle = (updates: Partial<SongFormStyle>) => {
    setSongFormStyles(prev => ({
      ...prev,
      [currentSong.id]: {
        ...currentFormStyle,
        ...updates
      }
    }))
  }

  const updatePartTag = (tagId: string, updates: Partial<PartTagStyle>) => {
    setPartTagStyles(prev => ({
      ...prev,
      [currentSong.id]: (prev[currentSong.id] || []).map(tag =>
        tag.id === tagId ? { ...tag, ...updates } : tag
      )
    }))
  }

  // 파트 태그 추가 - 현재 페이지에 추가
  const addPartTag = (key: string, x: number, y: number) => {
    const newTag: PartTagStyle = {
      id: `${key}-${Date.now()}`,
      label: key,
      x,
      y,
      fontSize: 28,
      color: PART_COLORS[key] || '#6B7280',
      opacity: 1,
      pageIndex: currentPageIndex
    }

    setPartTagStyles(prev => ({
      ...prev,
      [currentSong.id]: [...(prev[currentSong.id] || []), newTag]
    }))
  }

  // 파트 태그 삭제
  const deletePartTag = (tagId: string) => {
    setPartTagStyles(prev => ({
      ...prev,
      [currentSong.id]: (prev[currentSong.id] || []).filter(tag => tag.id !== tagId)
    }))
  }

  // 드래그 핸들러 - 마우스와 터치 모두 지원
  const getPositionFromEvent = (e: React.MouseEvent | React.TouchEvent | TouchEvent) => {
    if (!containerRef.current) return null

    const rect = containerRef.current.getBoundingClientRect()
    let clientX: number, clientY: number

    if ('touches' in e) {
      if (e.touches.length === 0) return null
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }

    const x = ((clientX - rect.left) / rect.width) * 100
    const y = ((clientY - rect.top) / rect.height) * 100

    return { x, y }
  }

  const handlePreviewMouseDown = (e: React.MouseEvent) => {
    const pos = getPositionFromEvent(e)
    if (!pos) return

    // 송폼 클릭 체크 - 모든 페이지에서
    if (currentForms.length > 0) {
      const formStyle = currentFormStyle
      const formX = formStyle.x
      const formY = formStyle.y
      const hitRadius = 10

      if (Math.abs(pos.x - formX) < hitRadius && Math.abs(pos.y - formY) < hitRadius) {
        setDraggingItem({ type: 'songForm' })
        return
      }
    }

    // 파트 태그 클릭 체크
    for (const tag of currentPartTags) {
      const hitRadius = 5
      if (Math.abs(pos.x - tag.x) < hitRadius && Math.abs(pos.y - tag.y) < hitRadius) {
        setDraggingItem({ type: 'partTag', id: tag.id })
        return
      }
    }
  }

  const handlePreviewMouseMove = (e: React.MouseEvent) => {
    if (!draggingItem) return

    const pos = getPositionFromEvent(e)
    if (!pos) return

    const x = Math.max(5, Math.min(95, pos.x))
    const y = Math.max(3, Math.min(97, pos.y))

    if (draggingItem.type === 'songForm') {
      updateFormStyle({ x, y })
    } else if (draggingItem.type === 'partTag' && draggingItem.id) {
      updatePartTag(draggingItem.id, { x, y })
    }
  }

  const handlePreviewMouseUp = () => {
    setDraggingItem(null)
  }

  // 📱 Native touch event listeners (passive: false로 등록하여 iOS Safari에서 실시간 드래그 지원)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const getTouchPos = (e: TouchEvent) => {
      const rect = container.getBoundingClientRect()
      if (e.touches.length === 0) return null
      const clientX = e.touches[0].clientX
      const clientY = e.touches[0].clientY
      const x = ((clientX - rect.left) / rect.width) * 100
      const y = ((clientY - rect.top) / rect.height) * 100
      return { x, y }
    }

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const pos = getTouchPos(e)
      if (!pos) return

      // 송폼 클릭 체크 - 히트 영역 확대
      const styles = songFormStylesRef.current
      const songId = currentSong.id
      const formStyle = styles[songId] || { x: 50, y: 5, fontSize: 36, color: '#3B82F6', opacity: 1 }

      if (currentForms.length > 0) {
        const hitRadiusX = 40
        const hitRadiusY = 8
        if (Math.abs(pos.x - formStyle.x) < hitRadiusX && Math.abs(pos.y - formStyle.y) < hitRadiusY) {
          const item = { type: 'songForm' as const }
          setDraggingItem(item)
          draggingItemRef.current = item
          return
        }
      }

      // 파트 태그 클릭 체크
      const tags = (partTagStylesRef.current[songId] || []).filter(
        t => (t.pageIndex || 0) === currentPageIndex
      )
      for (const tag of tags) {
        const hitRadius = 12
        if (Math.abs(pos.x - tag.x) < hitRadius && Math.abs(pos.y - tag.y) < hitRadius) {
          const item = { type: 'partTag' as const, id: tag.id }
          setDraggingItem(item)
          draggingItemRef.current = item
          return
        }
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      const item = draggingItemRef.current
      if (!item) return

      e.preventDefault()
      e.stopPropagation()

      const rect = container.getBoundingClientRect()
      if (e.touches.length === 0) return
      const clientX = e.touches[0].clientX
      const clientY = e.touches[0].clientY
      const x = Math.max(5, Math.min(95, ((clientX - rect.left) / rect.width) * 100))
      const y = Math.max(3, Math.min(97, ((clientY - rect.top) / rect.height) * 100))

      const songId = currentSong.id

      if (item.type === 'songForm') {
        setSongFormStyles(prev => ({
          ...prev,
          [songId]: {
            ...(prev[songId] || { x: 50, y: 5, fontSize: 36, color: '#3B82F6', opacity: 1 }),
            x, y
          }
        }))
      } else if (item.type === 'partTag' && item.id) {
        const tagId = item.id
        setPartTagStyles(prev => ({
          ...prev,
          [songId]: (prev[songId] || []).map(tag =>
            tag.id === tagId ? { ...tag, x, y } : tag
          )
        }))
      }
    }

    const handleTouchEnd = () => {
      setDraggingItem(null)
      draggingItemRef.current = null
    }

    container.addEventListener('touchstart', handleTouchStart, { passive: false })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd, { passive: false })

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [currentSong.id, currentForms.length, currentPageIndex])

  // 파트 태그 드롭 (마우스)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (!draggingNewTag || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const x = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100))
    const y = Math.max(5, Math.min(95, ((e.clientY - rect.top) / rect.height) * 100))

    addPartTag(draggingNewTag, x, y)
    setDraggingNewTag(null)
  }

  // 파트 태그 터치 드래그용 상태
  const [touchDraggingTag, setTouchDraggingTag] = useState<string | null>(null)
  const [touchPosition, setTouchPosition] = useState<{ x: number; y: number } | null>(null)

  // 📱 파트 태그 탭하면 바로 캔버스 중앙에 추가 (아이패드 터치 지원)
  const handlePartTagTap = (key: string) => {
    // 캔버스 중앙에 파트 태그 추가
    addPartTag(key, 50, 50)
  }

  const handlePartTagTouchStart = (key: string, e: React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setTouchDraggingTag(key)
    const touch = e.touches[0]
    setTouchPosition({ x: touch.clientX, y: touch.clientY })
  }

  const handlePartTagTouchMove = (e: React.TouchEvent) => {
    if (!touchDraggingTag) return
    e.preventDefault()
    const touch = e.touches[0]
    setTouchPosition({ x: touch.clientX, y: touch.clientY })
  }

  const handlePartTagTouchEnd = (e: React.TouchEvent) => {
    if (!touchDraggingTag || !containerRef.current) {
      // 드래그 없이 탭만 한 경우 - 바로 추가
      if (touchDraggingTag && !touchPosition) {
        handlePartTagTap(touchDraggingTag)
      }
      setTouchDraggingTag(null)
      setTouchPosition(null)
      return
    }

    // 드롭 위치 확인
    const rect = containerRef.current.getBoundingClientRect()
    const touch = e.changedTouches[0]

    if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
        touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
      const x = Math.max(5, Math.min(95, ((touch.clientX - rect.left) / rect.width) * 100))
      const y = Math.max(5, Math.min(95, ((touch.clientY - rect.top) / rect.height) * 100))
      addPartTag(touchDraggingTag, x, y)
    } else {
      // 캔버스 밖에 드롭하면 중앙에 추가
      addPartTag(touchDraggingTag, 50, 50)
    }

    setTouchDraggingTag(null)
    setTouchPosition(null)
  }

  // 모든 곡에 적용
  const applyToAll = () => {
    if (!confirm('현재 송폼 스타일을 모든 곡에 적용하시겠습니까?')) return

    const newStyles: { [key: string]: SongFormStyle } = {}
    songsWithForms.forEach(song => {
      newStyles[song.id] = { ...currentFormStyle }
    })
    setSongFormStyles(newStyles)
    alert('✅ 모든 곡에 적용되었습니다!')
  }

  // 현재 곡의 모든 페이지 캔버스 저장
  const saveAllPagesCanvas = () => {
    if (backgroundImages.length === 0) {
      console.warn('⚠️ backgroundImages가 없습니다!')
      return
    }

    const styleToSave = songFormStyles[currentSong.id] || {
      x: 50, y: 5, fontSize: 36, color: '#3B82F6', opacity: 1
    }
    const allTagsToSave = partTagStyles[currentSong.id] || []
    const forms = songForms[currentSong.id] || currentSong.selectedForm || []
    const songFormText = forms.join(' - ')

    const pageDataUrls: string[] = []

    // 모든 페이지에 대해 캔버스 생성
    for (let pageIdx = 0; pageIdx < backgroundImages.length; pageIdx++) {
      const bgImage = backgroundImages[pageIdx]

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) continue

      canvas.width = A4_WIDTH
      canvas.height = A4_HEIGHT

      // 배경
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, A4_WIDTH, A4_HEIGHT)

      // 이미지
      const scale = Math.min(
        A4_WIDTH / bgImage.naturalWidth,
        A4_HEIGHT / bgImage.naturalHeight
      ) * 0.95

      const imgWidth = bgImage.naturalWidth * scale
      const imgHeight = bgImage.naturalHeight * scale
      const imgX = (A4_WIDTH - imgWidth) / 2
      const imgY = (A4_HEIGHT - imgHeight) / 2

      ctx.drawImage(bgImage, imgX, imgY, imgWidth, imgHeight)

      // 송폼 - 모든 페이지에 표시
      if (forms.length > 0) {
        const fontSize = styleToSave.fontSize * 2

        ctx.save()
        ctx.globalAlpha = styleToSave.opacity
        ctx.font = `bold ${fontSize}px Arial, "Noto Sans KR", sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'

        const x = (styleToSave.x / 100) * A4_WIDTH
        const y = (styleToSave.y / 100) * A4_HEIGHT

        ctx.strokeStyle = '#FFFFFF'
        ctx.lineWidth = fontSize * 0.15
        ctx.lineJoin = 'round'
        ctx.miterLimit = 2
        ctx.strokeText(songFormText, x, y)

        ctx.fillStyle = styleToSave.color
        ctx.fillText(songFormText, x, y)

        ctx.restore()
      }

      // 해당 페이지의 파트 태그만
      const pageTags = allTagsToSave.filter(tag => (tag.pageIndex || 0) === pageIdx)

      pageTags.forEach(tag => {
        const fontSize = tag.fontSize * 2

        ctx.save()
        ctx.globalAlpha = tag.opacity
        ctx.font = `bold ${fontSize}px Arial, "Noto Sans KR", sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        const x = (tag.x / 100) * A4_WIDTH
        const y = (tag.y / 100) * A4_HEIGHT

        ctx.strokeStyle = '#FFFFFF'
        ctx.lineWidth = fontSize * 0.15
        ctx.lineJoin = 'round'
        ctx.miterLimit = 2
        ctx.strokeText(tag.label, x, y)

        ctx.fillStyle = tag.color
        ctx.fillText(tag.label, x, y)

        ctx.restore()
      })

      const dataUrl = canvas.toDataURL('image/png', 1.0)
      pageDataUrls.push(dataUrl)
    }

    canvasDataUrlsRef.current[currentSong.id] = pageDataUrls
    console.log(`✅ ${currentSong.song_name}: ${pageDataUrls.length}페이지 저장 완료`)
  }

  // 다음 곡 / 확정
  const handleNext = () => {
    // 현재 곡의 모든 페이지 저장
    saveAllPagesCanvas()

    if (currentSongIndex < songsWithForms.length - 1) {
      setCurrentSongIndex(currentSongIndex + 1)
    } else {
      // 마지막 곡 - 확정
      console.log('🎵 확정 - songFormStyles:', songFormStyles)
      console.log('🏷️ 확정 - partTagStyles:', partTagStyles)
      console.log('🖼️ 확정 - canvasDataUrls:', canvasDataUrlsRef.current)

      onConfirm(songFormStyles, partTagStyles, canvasDataUrlsRef.current)
    }
  }

  // 이전 곡
  const handlePrev = () => {
    if (currentSongIndex > 0) {
      saveAllPagesCanvas()
      setCurrentSongIndex(currentSongIndex - 1)
    }
  }

  // 페이지 네비게이션
  const handlePrevPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(currentPageIndex - 1)
    }
  }

  const handleNextPage = () => {
    if (currentPageIndex < totalPages - 1) {
      setCurrentPageIndex(currentPageIndex + 1)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white md:rounded-xl w-full max-w-7xl h-[100dvh] md:h-auto md:max-h-[95vh] flex flex-col shadow-2xl">
        {/* 헤더 */}
        <div className="p-3 md:p-4 border-b border-gray-200">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h2 className="text-base md:text-lg font-bold text-gray-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-lg md:text-xl text-blue-600">edit_note</span>
                송폼 & 파트 태그 편집
              </h2>
              <p className="text-xs md:text-sm text-gray-500 truncate mt-0.5">
                {currentSong.song_name}
                {totalPages > 1 && (
                  <span className="ml-2 text-blue-600 font-medium">
                    (페이지 {currentPageIndex + 1}/{totalPages})
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={onCancel}
              className="p-1.5 md:p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0 text-gray-500"
            >
              <X size={20} className="md:w-6 md:h-6" />
            </button>
          </div>
        </div>

        {/* 본문 - 모바일: 세로, 데스크톱: 좌우 분할 */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* 왼쪽: 파트 태그 팔레트 + 컨트롤 */}
          <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-gray-200 bg-gray-50 p-3 md:p-4 overflow-y-auto flex-shrink-0 max-h-[32vh] md:max-h-none">
            {/* 모바일: 가로 2컬럼 레이아웃 / 데스크톱: 세로 레이아웃 */}
            <div className="flex flex-col md:block gap-3">
              {/* 송폼 설정 + 파트 태그를 모바일에서 나란히 */}
              <div className="flex flex-row md:flex-col gap-3 md:gap-0">
                {/* 송폼 설정 */}
                <div className="flex-1 md:mb-6">
                  <h3 className="font-semibold text-gray-800 mb-2 md:mb-3 text-sm">송폼 설정</h3>
                  <p className="text-xs text-gray-500 mb-2 hidden md:block">※ 송폼은 모든 페이지에 표시됩니다</p>

                  {/* 텍스트 크기 슬라이더 */}
                  <div className="mb-3 md:mb-4">
                    <label className="text-xs text-gray-600 block mb-1 flex items-center justify-between">
                      <span>텍스트 크기</span>
                      <span className="font-medium text-gray-800">{currentFormStyle.fontSize}pt</span>
                    </label>
                    <input
                      type="range"
                      min="16"
                      max="72"
                      value={currentFormStyle.fontSize}
                      onChange={(e) => updateFormStyle({ fontSize: Number(e.target.value) })}
                      className="w-full h-1.5 bg-gray-300 rounded-full appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${((currentFormStyle.fontSize - 16) / (72 - 16)) * 100}%, #D1D5DB ${((currentFormStyle.fontSize - 16) / (72 - 16)) * 100}%, #D1D5DB 100%)`
                      }}
                    />
                    <div className="hidden md:flex justify-between text-xs text-gray-400 mt-1">
                      <span>16pt</span>
                      <span>72pt</span>
                    </div>
                  </div>

                  {/* 글자 색상 */}
                  <div className="mb-3 md:mb-4">
                    <label className="text-xs text-gray-600 block mb-1.5">글자 색상</label>
                    <div className="flex flex-wrap gap-1.5">
                      {COLOR_PRESETS.map(color => (
                        <button
                          key={color.value}
                          onClick={() => updateFormStyle({ color: color.value })}
                          className={`w-6 h-6 md:w-7 md:h-7 rounded-full transition-all ${
                            currentFormStyle.color === color.value
                              ? 'ring-2 ring-offset-1 ring-blue-500 scale-110'
                              : 'hover:scale-105'
                          }`}
                          style={{ backgroundColor: color.value }}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>

                  {/* 투명도 */}
                  <div className="mb-3 md:mb-4">
                    <label className="text-xs text-gray-600 block mb-1 flex items-center justify-between">
                      <span>투명도</span>
                      <span className="font-medium text-gray-800">{Math.round(currentFormStyle.opacity * 100)}%</span>
                    </label>
                    <input
                      type="range"
                      min="0.3"
                      max="1"
                      step="0.1"
                      value={currentFormStyle.opacity}
                      onChange={(e) => updateFormStyle({ opacity: Number(e.target.value) })}
                      className="w-full h-1.5 bg-gray-300 rounded-full appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${((currentFormStyle.opacity - 0.3) / 0.7) * 100}%, #D1D5DB ${((currentFormStyle.opacity - 0.3) / 0.7) * 100}%, #D1D5DB 100%)`
                      }}
                    />
                  </div>

                  {/* 모든 페이지에 동일 적용 */}
                  <button
                    onClick={applyToAll}
                    className="w-full px-2 md:px-3 py-2 text-gray-600 text-xs font-medium hover:bg-gray-100 rounded-lg transition-all flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">content_copy</span>
                    모든 페이지에 동일 적용
                  </button>
                </div>

                {/* 파트 태그 */}
                <div className="flex-1 md:mb-6">
                  <h3 className="font-semibold text-gray-800 mb-2 text-sm">파트 태그</h3>
                  <p className="text-xs text-gray-500 mb-2 md:mb-3 hidden md:block">
                    탭하거나 드래그해서 배치
                    {totalPages > 1 && <><br/>현재 <b className="text-blue-600">페이지 {currentPageIndex + 1}</b>에 배치됩니다</>}
                  </p>
                  <div
                    className="grid grid-cols-4 md:grid-cols-3 gap-1.5 md:gap-2"
                    onTouchMove={handlePartTagTouchMove}
                    onTouchEnd={handlePartTagTouchEnd}
                    style={{
                      WebkitTouchCallout: 'none',
                      WebkitUserSelect: 'none',
                      userSelect: 'none',
                      touchAction: 'none'
                    }}
                  >
                    {AVAILABLE_PARTS.map(part => (
                      <button
                        key={part.key}
                        type="button"
                        draggable
                        onDragStart={() => setDraggingNewTag(part.key)}
                        onDragEnd={() => setDraggingNewTag(null)}
                        onClick={() => handlePartTagTap(part.key)}
                        onTouchStart={(e) => handlePartTagTouchStart(part.key, e)}
                        className="flex items-center justify-center p-2 md:p-2.5 rounded-lg cursor-pointer hover:opacity-80 active:scale-95 transition-all text-xs md:text-sm font-semibold min-h-[36px] md:min-h-[40px]"
                        style={{
                          backgroundColor: PART_COLORS[part.key],
                          color: PART_TEXT_COLORS[part.key],
                          WebkitTouchCallout: 'none',
                          WebkitUserSelect: 'none',
                          userSelect: 'none',
                          touchAction: 'manipulation'
                        }}
                      >
                        {part.key}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 배치된 파트 태그 목록 (현재 페이지) */}
            {currentPartTags.length > 0 && (
              <div className="mt-4">
                <h4 className="text-xs font-medium text-gray-600 mb-2">
                  배치된 태그 (페이지 {currentPageIndex + 1})
                </h4>
                <div className="space-y-2">
                  {currentPartTags.map(tag => (
                    <div key={tag.id} className="bg-white p-2 rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className="px-2 py-0.5 rounded text-xs font-semibold"
                          style={{
                            backgroundColor: PART_COLORS[tag.label] || tag.color,
                            color: PART_TEXT_COLORS[tag.label] || '#fff'
                          }}
                        >
                          {tag.label}
                        </span>
                        <button
                          onClick={() => deletePartTag(tag.id)}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 min-w-[28px]">{tag.fontSize}pt</span>
                        <input
                          type="range"
                          min="12"
                          max="48"
                          value={tag.fontSize}
                          onChange={(e) => updatePartTag(tag.id, { fontSize: Number(e.target.value) })}
                          className="flex-1 h-1 bg-gray-200 rounded-full appearance-none cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${((tag.fontSize - 12) / (48 - 12)) * 100}%, #E5E7EB ${((tag.fontSize - 12) / (48 - 12)) * 100}%, #E5E7EB 100%)`
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 오른쪽: 미리보기 */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {/* 안내 메시지 */}
            <div className="p-2 md:p-3 bg-yellow-50 border-b border-yellow-100 text-xs md:text-sm text-yellow-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-yellow-600">warning</span>
              <span>
                <span className="hidden md:inline">태그를 탭/드래그한 후 악보 위치로 이동하세요 (수정됨)</span>
                <span className="md:hidden">태그를 드래그해서 위치 이동</span>
              </span>
            </div>

            {/* 페이지 네비게이션 */}
            {totalPages > 1 && (
              <div className="p-1.5 md:p-2 bg-gray-50 border-b border-gray-200 flex items-center justify-center gap-2 md:gap-4">
                <button
                  onClick={handlePrevPage}
                  disabled={currentPageIndex === 0}
                  className="px-2 md:px-3 py-1 bg-white border border-gray-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 flex items-center gap-1 text-xs md:text-sm"
                >
                  <ChevronLeft size={14} className="md:w-4 md:h-4" />
                  이전
                </button>
                <span className="text-xs md:text-sm font-medium text-gray-700">
                  PAGE {currentPageIndex + 1} / {totalPages}
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={currentPageIndex >= totalPages - 1}
                  className="px-2 md:px-3 py-1 bg-white border border-gray-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 flex items-center gap-1 text-xs md:text-sm"
                >
                  다음
                  <ChevronRight size={14} className="md:w-4 md:h-4" />
                </button>
              </div>
            )}

            {/* 미리보기 영역 */}
            <div className="flex-1 p-2 md:p-4 bg-gray-100 overflow-y-auto flex items-start justify-center min-h-0">
              <div
                ref={containerRef}
                className="relative bg-white rounded-lg shadow-lg border border-gray-300 overflow-hidden cursor-crosshair flex-shrink-0"
                style={{
                  width: '100%',
                  maxWidth: '480px',
                  aspectRatio: '210 / 297',
                  minHeight: '200px',
                  touchAction: 'none',
                  WebkitTouchCallout: 'none',
                  WebkitUserSelect: 'none',
                  userSelect: 'none'
                }}
                onMouseDown={handlePreviewMouseDown}
                onMouseMove={handlePreviewMouseMove}
                onMouseUp={handlePreviewMouseUp}
                onMouseLeave={handlePreviewMouseUp}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                {/* 로딩 */}
                {isLoadingFile && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/90 z-20">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-300 border-t-blue-500 mx-auto mb-2"></div>
                      <p className="text-sm text-gray-600">악보 로딩 중...</p>
                    </div>
                  </div>
                )}

                {/* 미리보기 캔버스 - 터치 이벤트가 컨테이너로 전달되도록 */}
                <canvas
                  ref={previewCanvasRef}
                  className="w-full h-full"
                  style={{ pointerEvents: 'none' }}
                />

                {/* 메인 캔버스 (숨김 - 고해상도 렌더링용) */}
                <canvas
                  ref={mainCanvasRef}
                  style={{ display: 'none' }}
                />

                {/* 파일이 없는 경우 */}
                {!currentSong.file_url && !isLoadingFile && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <span className="material-symbols-outlined text-5xl text-gray-300 mb-2 block">music_note</span>
                      <p>악보 파일이 없습니다</p>
                    </div>
                  </div>
                )}

                {/* 드래그 안내 오버레이 */}
                {(draggingNewTag || touchDraggingTag) && (
                  <div className="absolute inset-0 border-4 border-dashed border-blue-400 bg-blue-50/30 flex items-start justify-center pt-4 z-10 pointer-events-none">
                    <p className="bg-blue-500 text-white font-medium text-sm px-3 py-1.5 rounded-full shadow">
                      여기에 드롭하세요
                    </p>
                  </div>
                )}
              </div>

              {/* 터치 드래그 플로팅 인디케이터 */}
              {touchDraggingTag && touchPosition && (
                <div
                  className="fixed pointer-events-none z-[100] px-3 py-1.5 rounded-lg font-semibold shadow-lg"
                  style={{
                    left: touchPosition.x - 20,
                    top: touchPosition.y - 40,
                    backgroundColor: PART_COLORS[touchDraggingTag] || '#6B7280',
                    color: PART_TEXT_COLORS[touchDraggingTag] || '#fff',
                    transform: 'scale(1.1)'
                  }}
                >
                  {touchDraggingTag}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="p-3 md:p-4 border-t border-gray-200 bg-white">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={handlePrev}
              disabled={currentSongIndex === 0}
              className="px-3 md:px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 md:gap-2 font-medium text-xs md:text-sm"
            >
              <ChevronLeft size={16} className="md:w-5 md:h-5" />
              <span className="hidden md:inline">이전 곡으로 돌아가기</span>
              <span className="md:hidden">이전</span>
            </button>

            <div className="flex gap-2">
              <button
                onClick={onCancel}
                className="px-4 md:px-5 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-medium text-xs md:text-sm"
              >
                취소
              </button>
              <button
                onClick={handleNext}
                className="px-4 md:px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all font-medium flex items-center gap-1 md:gap-2 text-xs md:text-sm"
              >
                {currentSongIndex < songsWithForms.length - 1 ? (
                  <>
                    <span className="hidden md:inline">확정하고 넘어가기</span>
                    <span className="md:hidden">다음</span>
                    <ChevronRight size={16} className="md:w-5 md:h-5" />
                  </>
                ) : (
                  <>
                    <Download size={14} className="md:w-[18px] md:h-[18px]" />
                    <span className="hidden md:inline">확정하고 다운로드</span>
                    <span className="md:hidden">확정</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
