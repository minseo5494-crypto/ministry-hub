'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight, GripVertical, Trash2, Download } from 'lucide-react'

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

// 🆕 새로운 스타일 인터페이스
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
}

interface Props {
  songs: Song[]
  songForms: { [key: string]: string[] }
  onConfirm: (
    songFormStyles: { [key: string]: SongFormStyle },
    partTagStyles: { [songId: string]: PartTagStyle[] },
    canvasDataUrls: { [songId: string]: string }  // 🆕 캔버스 이미지 데이터
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
  'I': '#EF4444',      // 빨강
  'V': '#3B82F6',      // 파랑
  'V1': '#3B82F6',
  'V2': '#2563EB',
  'V3': '#1D4ED8',
  'PC': '#EAB308',     // 노랑
  'C': '#22C55E',      // 초록
  'C1': '#22C55E',
  'C2': '#16A34A',
  'B': '#A855F7',      // 보라
  '간주': '#F97316',   // 주황
  'Out': '#6B7280',    // 회색
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
const A4_WIDTH = 595.28 * 2   // 1190.56
const A4_HEIGHT = 841.89 * 2  // 1683.78

export default function SongFormPositionModal({ songs, songForms, onConfirm, onCancel }: Props) {
  const songsWithForms = songs.filter(song => {
    const forms = songForms[song.id] || song.selectedForm || []
    return forms.length > 0
  })

  const [currentSongIndex, setCurrentSongIndex] = useState(0)
  
  // 🆕 새로운 스타일 상태
  const [songFormStyles, setSongFormStyles] = useState<{ [key: string]: SongFormStyle }>({})
  const [partTagStyles, setPartTagStyles] = useState<{ [songId: string]: PartTagStyle[] }>({})
  
  // 캔버스 데이터 저장용 ref (렌더링에 영향 없음)
  const canvasDataUrlsRef = useRef<{ [songId: string]: string }>({})
  
  // 캔버스 관련
  const mainCanvasRef = useRef<HTMLCanvasElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const [isLoadingFile, setIsLoadingFile] = useState(false)
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null)
  
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

  // ❌ ref 동기화 useEffect 제거됨 - 더 이상 필요 없음

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
  
  const currentPartTags: PartTagStyle[] = partTagStyles[currentSong.id] || []

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

  // 악보 이미지 로드
  useEffect(() => {
    let isCancelled = false
    
    const loadFile = async () => {
      const fileUrl = currentSong.file_url
      if (!fileUrl) return
      
      setIsLoadingFile(true)
      setBackgroundImage(null)
      
      const isPDF = currentSong.file_type === 'pdf' || 
                    fileUrl.toLowerCase().endsWith('.pdf')
      
      try {
        let imageDataUrl: string
        
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
          
          const page = await pdf.getPage(1)
          
          if (isCancelled) return
          
          // 🆕 고해상도로 렌더링 (A4 2배)
          const originalViewport = page.getViewport({ scale: 1 })
          const scale = Math.min(
            A4_WIDTH / originalViewport.width,
            A4_HEIGHT / originalViewport.height
          ) * 0.95  // 여백
          const viewport = page.getViewport({ scale })
          
          const offscreenCanvas = document.createElement('canvas')
          offscreenCanvas.width = A4_WIDTH
          offscreenCanvas.height = A4_HEIGHT
          const offscreenCtx = offscreenCanvas.getContext('2d')
          
          if (!offscreenCtx) return
          
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
          
          imageDataUrl = offscreenCanvas.toDataURL('image/png')
          
        } else {
          // 이미지 파일
          imageDataUrl = fileUrl
        }
        
        if (isCancelled) return
        
        // 이미지 로드
        const img = new Image()
        img.crossOrigin = 'anonymous'
        
        img.onload = () => {
          if (isCancelled) return
          setBackgroundImage(img)
          setIsLoadingFile(false)
        }
        
        img.onerror = () => {
          console.error('이미지 로드 실패')
          setIsLoadingFile(false)
        }
        
        img.src = imageDataUrl
        
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

  // 🆕 메인 캔버스에 모든 요소 렌더링
  const renderMainCanvas = useCallback(() => {
    if (!mainCanvasRef.current || !backgroundImage || !fontLoaded) return
    
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
      A4_WIDTH / backgroundImage.naturalWidth,
      A4_HEIGHT / backgroundImage.naturalHeight
    ) * 0.95
    
    const imgWidth = backgroundImage.naturalWidth * scale
    const imgHeight = backgroundImage.naturalHeight * scale
    const imgX = (A4_WIDTH - imgWidth) / 2
    const imgY = (A4_HEIGHT - imgHeight) / 2
    
    ctx.drawImage(backgroundImage, imgX, imgY, imgWidth, imgHeight)
    
    // 🆕 송폼 텍스트 그리기
    if (currentForms.length > 0) {
      const style = currentFormStyle
      const fontSize = style.fontSize * 2  // 2배 해상도
      
      ctx.save()
      ctx.globalAlpha = style.opacity
      ctx.font = `bold ${fontSize}px Arial, "Noto Sans KR", sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      
      const x = (style.x / 100) * A4_WIDTH
      const y = (style.y / 100) * A4_HEIGHT
      
      // 흰색 외곽선 (두께 증가)
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
    
    // 🆕 파트 태그 그리기
    currentPartTags.forEach(tag => {
      const fontSize = tag.fontSize * 2  // 2배 해상도
      
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
    
    // 🆕 미리보기 캔버스에도 그리기
    if (previewCanvasRef.current) {
      const preview = previewCanvasRef.current
      const previewCtx = preview.getContext('2d')
      if (previewCtx) {
        preview.width = 480
        preview.height = 680
        previewCtx.drawImage(canvas, 0, 0, 480, 680)
      }
    }
    
  }, [backgroundImage, currentForms, currentFormStyle, currentPartTags, fontLoaded, currentSong.id, formText])

  // 배경 이미지나 스타일 변경 시 캔버스 다시 그리기
  useEffect(() => {
    renderMainCanvas()
  }, [renderMainCanvas])

  // 🆕 미리보기 캔버스 (축소 버전)
  const renderPreviewCanvas = useCallback(() => {
    if (!previewCanvasRef.current || !mainCanvasRef.current) return
    
    const preview = previewCanvasRef.current
    const main = mainCanvasRef.current
    const ctx = preview.getContext('2d')
    if (!ctx) return
    
    // 미리보기 크기 (원본의 1/4)
    const previewWidth = 480
    const previewHeight = 680
    
    preview.width = previewWidth
    preview.height = previewHeight
    
    // 메인 캔버스를 축소해서 그리기
    ctx.drawImage(main, 0, 0, previewWidth, previewHeight)
    
  }, [])

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

  // 파트 태그 추가
  const addPartTag = (key: string, x: number, y: number) => {
    const newTag: PartTagStyle = {
      id: `${key}-${Date.now()}`,
      label: key,
      x,
      y,
      fontSize: 28,
      color: PART_COLORS[key] || '#6B7280',
      opacity: 1
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

  // 드래그 핸들러
  const handlePreviewMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return
    
    const rect = containerRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    
    // 송폼 클릭 체크
    const formStyle = currentFormStyle
    if (currentForms.length > 0) {
      const formX = formStyle.x
      const formY = formStyle.y
      const hitRadius = 10  // 클릭 영역
      
      if (Math.abs(x - formX) < hitRadius && Math.abs(y - formY) < hitRadius) {
        setDraggingItem({ type: 'songForm' })
        return
      }
    }
    
    // 파트 태그 클릭 체크
    for (const tag of currentPartTags) {
      const hitRadius = 5
      if (Math.abs(x - tag.x) < hitRadius && Math.abs(y - tag.y) < hitRadius) {
        setDraggingItem({ type: 'partTag', id: tag.id })
        return
      }
    }
  }

  const handlePreviewMouseMove = (e: React.MouseEvent) => {
    if (!draggingItem || !containerRef.current) return
    
    const rect = containerRef.current.getBoundingClientRect()
    const x = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100))
    const y = Math.max(3, Math.min(97, ((e.clientY - rect.top) / rect.height) * 100))
    
    if (draggingItem.type === 'songForm') {
      updateFormStyle({ x, y })
    } else if (draggingItem.type === 'partTag' && draggingItem.id) {
      updatePartTag(draggingItem.id, { x, y })
    }
  }

  const handlePreviewMouseUp = () => {
    setDraggingItem(null)
  }

  // 파트 태그 드롭
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (!draggingNewTag || !containerRef.current) return
    
    const rect = containerRef.current.getBoundingClientRect()
    const x = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100))
    const y = Math.max(5, Math.min(95, ((e.clientY - rect.top) / rect.height) * 100))
    
    addPartTag(draggingNewTag, x, y)
    setDraggingNewTag(null)
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

  // ✅ 수정된 handleNext - 상태 값을 직접 사용
  const handleNext = () => {
    // 🔥 핵심 수정: 현재 렌더 시점의 상태 값을 직접 캡처
    const styleToSave = songFormStyles[currentSong.id] || {
      x: 50, y: 5, fontSize: 36, color: '#7C3AED', opacity: 1
    }
    const tagsToSave = partTagStyles[currentSong.id] || []
    
    console.log('💾 저장할 스타일:', styleToSave)
    console.log('💾 저장할 태그:', tagsToSave)
    
    // 🆕 현재 곡의 캔버스를 직접 생성해서 저장
    const saveCurrentCanvas = () => {
      if (!backgroundImage) {
        console.warn('⚠️ backgroundImage가 없습니다!')
        return
      }
      
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        console.warn('⚠️ canvas context를 가져올 수 없습니다!')
        return
      }
      
      // A4 2배 해상도
      canvas.width = A4_WIDTH
      canvas.height = A4_HEIGHT
      
      // 배경 이미지 그리기
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, A4_WIDTH, A4_HEIGHT)
      
      // 이미지를 A4 크기에 맞게 그리기
      const scale = Math.min(
        A4_WIDTH / backgroundImage.naturalWidth,
        A4_HEIGHT / backgroundImage.naturalHeight
      ) * 0.95
      
      const imgWidth = backgroundImage.naturalWidth * scale
      const imgHeight = backgroundImage.naturalHeight * scale
      const imgX = (A4_WIDTH - imgWidth) / 2
      const imgY = (A4_HEIGHT - imgHeight) / 2
      
      ctx.drawImage(backgroundImage, imgX, imgY, imgWidth, imgHeight)
      
      // ✅ 수정: 상태 값을 직접 사용 (ref가 아닌 캡처된 값)
      const forms = songForms[currentSong.id] || currentSong.selectedForm || []
      
      if (forms.length > 0) {
        const songFormText = forms.join(' - ')
        const fontSize = styleToSave.fontSize * 2  // 2배 해상도
        
        console.log('📝 송폼 그리기:', songFormText, 'fontSize:', fontSize)
        
        ctx.save()
        ctx.globalAlpha = styleToSave.opacity
        ctx.font = `bold ${fontSize}px Arial, "Noto Sans KR", sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        
        const x = (styleToSave.x / 100) * A4_WIDTH
        const y = (styleToSave.y / 100) * A4_HEIGHT
        
        // 흰색 외곽선
        ctx.strokeStyle = '#FFFFFF'
        ctx.lineWidth = fontSize * 0.15
        ctx.lineJoin = 'round'
        ctx.miterLimit = 2
        ctx.strokeText(songFormText, x, y)
        
        // 본문 텍스트
        ctx.fillStyle = styleToSave.color
        ctx.fillText(songFormText, x, y)
        
        ctx.restore()
      }
      
      // ✅ 수정: 파트 태그도 캡처된 값 사용
      if (tagsToSave.length > 0) {
        console.log('🏷️ 파트 태그 그리기:', tagsToSave.length, '개')
        
        tagsToSave.forEach(tag => {
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
      }
      
      // PNG로 저장
      const dataUrl = canvas.toDataURL('image/png', 1.0)
      canvasDataUrlsRef.current[currentSong.id] = dataUrl
      console.log(`✅ 캔버스 저장 완료: ${currentSong.song_name}`)
    }
    
    // 현재 곡 저장
    saveCurrentCanvas()

    if (currentSongIndex < songsWithForms.length - 1) {
      // 다음 곡으로
      setCurrentSongIndex(currentSongIndex + 1)
    } else {
      // 마지막 곡 - 확정
      console.log('🎵 확정 - songFormStyles:', songFormStyles)
      console.log('🏷️ 확정 - partTagStyles:', partTagStyles)
      console.log('🖼️ 확정 - canvasDataUrls 개수:', Object.keys(canvasDataUrlsRef.current).length)
      
      onConfirm(songFormStyles, partTagStyles, canvasDataUrlsRef.current)
    }
  }

  // ✅ 수정된 handlePrev - 상태 값을 직접 사용
  const handlePrev = () => {
    if (currentSongIndex > 0) {
      // 🔥 현재 렌더 시점의 상태 값을 직접 캡처
      const styleToSave = songFormStyles[currentSong.id] || {
        x: 50, y: 5, fontSize: 36, color: '#7C3AED', opacity: 1
      }
      const tagsToSave = partTagStyles[currentSong.id] || []
      
      // 🆕 현재 곡의 캔버스를 직접 생성해서 저장
      if (backgroundImage) {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        if (ctx) {
          canvas.width = A4_WIDTH
          canvas.height = A4_HEIGHT
          
          ctx.fillStyle = '#FFFFFF'
          ctx.fillRect(0, 0, A4_WIDTH, A4_HEIGHT)
          
          const scale = Math.min(
            A4_WIDTH / backgroundImage.naturalWidth,
            A4_HEIGHT / backgroundImage.naturalHeight
          ) * 0.95
          
          const imgWidth = backgroundImage.naturalWidth * scale
          const imgHeight = backgroundImage.naturalHeight * scale
          const imgX = (A4_WIDTH - imgWidth) / 2
          const imgY = (A4_HEIGHT - imgHeight) / 2
          
          ctx.drawImage(backgroundImage, imgX, imgY, imgWidth, imgHeight)
          
          // ✅ 수정: 상태 값 직접 사용
          const forms = songForms[currentSong.id] || currentSong.selectedForm || []
          
          if (forms.length > 0) {
            const songFormText = forms.join(' - ')
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
          
          // ✅ 수정: 파트 태그도 상태 값 직접 사용
          tagsToSave.forEach(tag => {
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
          canvasDataUrlsRef.current[currentSong.id] = dataUrl
        }
      }
      
      setCurrentSongIndex(currentSongIndex - 1)
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
                  {currentSongIndex + 1} / {songsWithForms.length}
                </span>
                {' - '}
                <span className="font-medium">{currentSong.song_name}</span>
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
              </p>
              <div className="grid grid-cols-3 gap-2">
                {AVAILABLE_PARTS.map(part => (
                  <div
                    key={part.key}
                    draggable
                    onDragStart={() => setDraggingNewTag(part.key)}
                    onDragEnd={() => setDraggingNewTag(null)}
                    className="flex items-center justify-center p-2 text-white rounded cursor-move hover:opacity-80 transition-opacity text-sm font-bold"
                    style={{ backgroundColor: PART_COLORS[part.key] }}
                  >
                    {part.key}
                  </div>
                ))}
              </div>
            </div>

            {/* 배치된 파트 태그 목록 */}
            {currentPartTags.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-600 mb-2">배치된 태그</h4>
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
                      {/* 개별 태그 크기 조절 */}
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

            {/* 미리보기 영역 */}
            <div className="flex-1 p-4 bg-gray-100 overflow-auto flex items-center justify-center">
              <div
                ref={containerRef}
                className="relative bg-white rounded-lg shadow-lg border-2 border-gray-300 overflow-hidden cursor-crosshair"
                style={{
                  width: '480px',
                  height: '680px',
                  maxWidth: '100%'
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
                  <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 z-20">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-2"></div>
                      <p className="text-sm text-gray-600">악보 로딩 중...</p>
                    </div>
                  </div>
                )}

                {/* 미리보기 캔버스 */}
                <canvas
                  ref={previewCanvasRef}
                  className="w-full h-full"
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
                {draggingNewTag && (
                  <div className="absolute inset-0 bg-purple-500 bg-opacity-10 border-4 border-dashed border-purple-400 flex items-center justify-center z-10 pointer-events-none">
                    <p className="text-purple-600 font-bold text-lg">여기에 드롭하세요</p>
                  </div>
                )}
              </div>
            </div>

            {/* 현재 송폼 미리보기 텍스트 */}
            <div className="p-3 bg-gray-50 border-t">
              <div className="flex items-center justify-center gap-4">
                <span className="text-sm text-gray-600">송폼:</span>
                <span 
                  className="font-bold px-3 py-1 rounded"
                  style={{ 
                    color: currentFormStyle.color,
                    fontSize: `${Math.min(currentFormStyle.fontSize * 0.6, 24)}px`,
                    opacity: currentFormStyle.opacity
                  }}
                >
                  {formText || '(없음)'}
                </span>
              </div>
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