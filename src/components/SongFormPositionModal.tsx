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
  { name: '보라', value: '#7C3AED' },
  { name: '파랑', value: '#2563EB' },
  { name: '빨강', value: '#DC2626' },
  { name: '초록', value: '#16A34A' },
  { name: '주황', value: '#EA580C' },
  { name: '검정', value: '#1F2937' },
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
  const [draggingNewTag, setDraggingNewTag] = useState<string | null>(null)

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
    color: '#7C3AED',
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
            color: '#7C3AED',
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

          const loadingTask = pdfjsLib.getDocument(fileUrl)
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
              viewport: viewport
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

  const handlePreviewTouchStart = (e: React.TouchEvent) => {
    e.preventDefault() // 기본 터치 동작 방지
    e.stopPropagation()

    const pos = getPositionFromEvent(e)
    if (!pos) return

    // 송폼 클릭 체크 - 히트 영역 대폭 확대
    if (currentForms.length > 0) {
      const formStyle = currentFormStyle
      const formX = formStyle.x
      const formY = formStyle.y
      const hitRadiusX = 40 // 가로 히트 영역 (송폼 텍스트가 가로로 길기 때문)
      const hitRadiusY = 8  // 세로 히트 영역

      if (Math.abs(pos.x - formX) < hitRadiusX && Math.abs(pos.y - formY) < hitRadiusY) {
        setDraggingItem({ type: 'songForm' })
        return
      }
    }

    // 파트 태그 클릭 체크 - 히트 영역 확대
    for (const tag of currentPartTags) {
      const hitRadius = 12 // 터치 히트 영역 확대
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

  const handlePreviewTouchMove = (e: React.TouchEvent) => {
    if (!draggingItem) return

    e.preventDefault()
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

  const handlePreviewTouchEnd = () => {
    setDraggingItem(null)
  }

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

  const handlePartTagTouchStart = (key: string, e: React.TouchEvent) => {
    e.preventDefault()
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
      x: 50, y: 5, fontSize: 36, color: '#7C3AED', opacity: 1
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
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-7xl max-h-[95vh] flex flex-col shadow-2xl">
        {/* 헤더 */}
        <div className="p-4 border-b bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">송폼 & 파트 태그 편집</h2>
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-purple-600">
                  곡 {currentSongIndex + 1} / {songsWithForms.length}
                </span>
                {' - '}
                <span className="font-medium">{currentSong.song_name}</span>
                {totalPages > 1 && (
                  <span className="ml-2 text-blue-600 font-semibold">
                    (페이지 {currentPageIndex + 1} / {totalPages})
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={onCancel}
              className="p-2 hover:bg-white rounded-lg transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* 본문 - 좌우 분할 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 왼쪽: 파트 태그 팔레트 + 컨트롤 */}
          <div className="w-64 border-r bg-gray-50 p-4 overflow-y-auto flex-shrink-0">
            {/* 송폼 설정 */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-700 mb-3">송폼 설정</h3>
              <p className="text-xs text-gray-500 mb-2">※ 송폼은 모든 페이지에 표시됩니다</p>

              {/* 크기 슬라이더 */}
              <div className="mb-4">
                <label className="text-sm text-gray-600 block mb-1">
                  크기: <span className="font-bold">{currentFormStyle.fontSize}pt</span>
                </label>
                <input
                  type="range"
                  min="16"
                  max="72"
                  value={currentFormStyle.fontSize}
                  onChange={(e) => updateFormStyle({ fontSize: Number(e.target.value) })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>16pt</span>
                  <span>72pt</span>
                </div>
              </div>

              {/* 색상 선택 */}
              <div className="mb-4">
                <label className="text-sm text-gray-600 block mb-2">색상</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PRESETS.map(color => (
                    <button
                      key={color.value}
                      onClick={() => updateFormStyle({ color: color.value })}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        currentFormStyle.color === color.value
                          ? 'border-gray-800 scale-110'
                          : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>

              {/* 투명도 */}
              <div className="mb-4">
                <label className="text-sm text-gray-600 block mb-1">
                  투명도: <span className="font-bold">{Math.round(currentFormStyle.opacity * 100)}%</span>
                </label>
                <input
                  type="range"
                  min="0.3"
                  max="1"
                  step="0.1"
                  value={currentFormStyle.opacity}
                  onChange={(e) => updateFormStyle({ opacity: Number(e.target.value) })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* 모든 곡에 적용 */}
              <button
                onClick={applyToAll}
                className="w-full px-3 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600"
              >
                📋 모든 곡에 적용
              </button>
            </div>

            {/* 파트 태그 팔레트 */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-700 mb-2">파트 태그</h3>
              <p className="text-xs text-gray-500 mb-3">
                드래그해서 악보 위에 배치하세요
                {totalPages > 1 && <><br/>현재 <b>페이지 {currentPageIndex + 1}</b>에 배치됩니다</>}
              </p>
              <div
                className="grid grid-cols-3 gap-2"
                onTouchMove={handlePartTagTouchMove}
                onTouchEnd={handlePartTagTouchEnd}
                style={{
                  WebkitTouchCallout: 'none',
                  WebkitUserSelect: 'none',
                  userSelect: 'none'
                }}
              >
                {AVAILABLE_PARTS.map(part => (
                  <div
                    key={part.key}
                    draggable
                    onDragStart={() => setDraggingNewTag(part.key)}
                    onDragEnd={() => setDraggingNewTag(null)}
                    onTouchStart={(e) => handlePartTagTouchStart(part.key, e)}
                    className="flex items-center justify-center p-3 text-white rounded cursor-move hover:opacity-80 active:opacity-60 transition-opacity text-sm font-bold"
                    style={{
                      backgroundColor: PART_COLORS[part.key],
                      WebkitTouchCallout: 'none',
                      WebkitUserSelect: 'none',
                      userSelect: 'none',
                      touchAction: 'none'
                    }}
                  >
                    {part.key}
                  </div>
                ))}
              </div>
            </div>

            {/* 배치된 파트 태그 목록 (현재 페이지) */}
            {currentPartTags.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-600 mb-2">
                  배치된 태그 (페이지 {currentPageIndex + 1})
                </h4>
                <div className="space-y-2">
                  {currentPartTags.map(tag => (
                    <div key={tag.id} className="bg-white p-2 rounded border">
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className="px-2 py-0.5 rounded text-white text-sm font-bold"
                          style={{ backgroundColor: tag.color }}
                        >
                          {tag.label}
                        </span>
                        <button
                          onClick={() => deletePartTag(tag.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{tag.fontSize}pt</span>
                        <input
                          type="range"
                          min="12"
                          max="48"
                          value={tag.fontSize}
                          onChange={(e) => updatePartTag(tag.id, { fontSize: Number(e.target.value) })}
                          className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 오른쪽: 미리보기 */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* 안내 메시지 */}
            <div className="p-3 bg-blue-50 border-b text-sm text-blue-700">
              💡 <strong>송폼과 파트 태그를 드래그</strong>해서 원하는 위치로 이동하세요.
              보이는 그대로 PDF로 저장됩니다!
            </div>

            {/* 페이지 네비게이션 */}
            {totalPages > 1 && (
              <div className="p-2 bg-gray-100 border-b flex items-center justify-center gap-4">
                <button
                  onClick={handlePrevPage}
                  disabled={currentPageIndex === 0}
                  className="px-3 py-1 bg-white border rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 flex items-center gap-1"
                >
                  <ChevronLeft size={16} />
                  이전
                </button>
                <span className="text-sm font-semibold text-gray-700">
                  페이지 {currentPageIndex + 1} / {totalPages}
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={currentPageIndex >= totalPages - 1}
                  className="px-3 py-1 bg-white border rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 flex items-center gap-1"
                >
                  다음
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            {/* 미리보기 영역 */}
            <div className="flex-1 p-4 bg-gray-100 overflow-auto flex items-center justify-center">
              <div
                ref={containerRef}
                className="relative bg-white rounded-lg shadow-lg border-2 border-gray-300 overflow-hidden cursor-crosshair"
                style={{
                  width: '480px',
                  aspectRatio: '210 / 297',
                  maxWidth: '100%',
                  maxHeight: 'calc(100vh - 350px)',
                  touchAction: 'none',
                  WebkitTouchCallout: 'none',
                  WebkitUserSelect: 'none',
                  userSelect: 'none'
                }}
                onMouseDown={handlePreviewMouseDown}
                onMouseMove={handlePreviewMouseMove}
                onMouseUp={handlePreviewMouseUp}
                onMouseLeave={handlePreviewMouseUp}
                onTouchStart={handlePreviewTouchStart}
                onTouchMove={handlePreviewTouchMove}
                onTouchEnd={handlePreviewTouchEnd}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                {/* 로딩 */}
                {isLoadingFile && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 z-20">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-2"></div>
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
                      <div className="text-6xl mb-4">🎵</div>
                      <p>악보 파일이 없습니다</p>
                    </div>
                  </div>
                )}

                {/* 드래그 안내 오버레이 */}
                {(draggingNewTag || touchDraggingTag) && (
                  <div className="absolute inset-0 border-4 border-dashed border-purple-500 flex items-start justify-center pt-4 z-10 pointer-events-none">
                    <p className="bg-purple-600 text-white font-bold text-sm px-3 py-1 rounded-full shadow-lg">
                      여기에 드롭하세요
                    </p>
                  </div>
                )}
              </div>

              {/* 터치 드래그 플로팅 인디케이터 */}
              {touchDraggingTag && touchPosition && (
                <div
                  className="fixed pointer-events-none z-[100] px-3 py-2 rounded font-bold text-white shadow-lg text-lg"
                  style={{
                    left: touchPosition.x - 20,
                    top: touchPosition.y - 40,
                    backgroundColor: PART_COLORS[touchDraggingTag] || '#6B7280',
                    transform: 'scale(1.2)'
                  }}
                >
                  {touchDraggingTag}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="p-4 border-t bg-gray-50">
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrev}
              disabled={currentSongIndex === 0}
              className="px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 font-medium"
            >
              <ChevronLeft size={20} />
              이전 곡
            </button>

            <div className="flex gap-2">
              <button
                onClick={onCancel}
                className="px-5 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-medium"
              >
                취소
              </button>
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all font-semibold shadow-lg flex items-center gap-2"
              >
                {currentSongIndex < songsWithForms.length - 1 ? (
                  <>
                    다음 곡
                    <ChevronRight size={20} />
                  </>
                ) : (
                  <>
                    <Download size={18} />
                    확정하고 다운로드
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 진행 상황 */}
          <div className="mt-3">
            <div className="flex gap-1">
              {songsWithForms.map((_, index) => (
                <div
                  key={index}
                  className={`flex-1 h-1.5 rounded-full transition-all ${
                    index === currentSongIndex
                      ? 'bg-purple-500'
                      : index < currentSongIndex
                      ? 'bg-green-500'
                      : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
