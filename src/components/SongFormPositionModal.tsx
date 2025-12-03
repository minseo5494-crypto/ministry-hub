'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight, GripVertical, Trash2 } from 'lucide-react'

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

type PositionType = 'top-left' | 'top-center' | 'top-right'
type SizeType = 'small' | 'medium' | 'large'

interface SongFormPosition {
  x: number
  y: number
  size?: SizeType
}

// 🆕 파트 태그 타입 export
export interface PartTag {
  id: string
  label: string
  x: number  // 퍼센트 (0-100)
  y: number  // 퍼센트 (0-100)
}

interface Props {
  songs: Song[]
  songForms: { [key: string]: string[] }
  onConfirm: (
    positions: { [key: string]: SongFormPosition },
    partTags: { [songId: string]: PartTag[] }  // 🆕 추가
  ) => void
  onCancel: () => void
}

// 🆕 사용 가능한 파트 태그
const AVAILABLE_PARTS = [
  { key: 'I', label: 'Intro', color: 'bg-red-500' },
  { key: 'V', label: 'Verse', color: 'bg-blue-500' },
  { key: 'V1', label: 'Verse1', color: 'bg-blue-500' },
  { key: 'V2', label: 'Verse2', color: 'bg-blue-600' },
  { key: 'V3', label: 'Verse3', color: 'bg-blue-700' },
  { key: 'PC', label: 'PreChorus', color: 'bg-yellow-500' },
  { key: 'C', label: 'Chorus', color: 'bg-green-500' },
  { key: 'C1', label: 'Chorus1', color: 'bg-green-500' },
  { key: 'C2', label: 'Chorus2', color: 'bg-green-600' },
  { key: 'B', label: 'Bridge', color: 'bg-purple-500' },
  { key: '간주', label: 'Interlude', color: 'bg-orange-500' },
  { key: 'Out', label: 'Outro', color: 'bg-gray-500' },
]

export default function SongFormPositionModal({ songs, songForms, onConfirm, onCancel }: Props) {
  const songsWithForms = songs.filter(song => {
    const forms = songForms[song.id] || song.selectedForm || []
    return forms.length > 0
  })

  const [currentSongIndex, setCurrentSongIndex] = useState(0)
  const [positions, setPositions] = useState<{ [key: string]: SongFormPosition }>({})
  const [selectedPositions, setSelectedPositions] = useState<{ [key: string]: PositionType }>({})
  const [selectedSizes, setSelectedSizes] = useState<{ [key: string]: SizeType }>({})
  
  // 🆕 PDF.js 관련 상태
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLoadingFile, setIsLoadingFile] = useState(false)
  const [canvasReady, setCanvasReady] = useState(false)
  
  // 🆕 렌더링 작업 관리용 ref
  const renderTaskRef = useRef<any>(null)
  const isRenderingRef = useRef<boolean>(false)
  const currentFileUrlRef = useRef<string>('')
  
  // 🆕 원본 이미지 데이터 저장 (송폼 다시 그릴 때 사용)
  const originalImageDataRef = useRef<ImageData | null>(null)
  // 🆕 파트 태그 상태 (각 곡별로 저장)
  const [partTags, setPartTags] = useState<{ [songId: string]: PartTag[] }>({})
  const [draggingNewTag, setDraggingNewTag] = useState<string | null>(null)

  useEffect(() => {
    if (songsWithForms.length === 0) {
      onConfirm({}, {})  // 🆕 빈 partTags도 전달
    }
  }, [])

  if (songsWithForms.length === 0) {
    return null
  }

  const currentSong = songsWithForms[currentSongIndex]
  const currentForms = songForms[currentSong.id] || currentSong.selectedForm || []

  

  // 각 곡의 초기 위치 설정
  useEffect(() => {
    const initialPositions: { [key: string]: SongFormPosition } = {}
    const initialSelected: { [key: string]: PositionType } = {}
    const initialSizes: { [key: string]: SizeType } = {}
    songsWithForms.forEach(song => {
      if (!positions[song.id]) {
        initialPositions[song.id] = { x: 50, y: 95, size: 'medium' }
        initialSelected[song.id] = 'top-center'
        initialSizes[song.id] = 'medium'
      }
    })
    setPositions(prev => ({ ...initialPositions, ...prev }))
    setSelectedPositions(prev => ({ ...initialSelected, ...prev }))
    setSelectedSizes(prev => ({ ...initialSizes, ...prev }))
  }, [songsWithForms.length])

  // 🆕 PDF/이미지 렌더링 - 오프스크린 캔버스 사용
  useEffect(() => {
    let isCancelled = false
    
    const renderFile = async () => {
      const fileUrl = currentSong.file_url
      if (!fileUrl) return
      
      setIsLoadingFile(true)
      setCanvasReady(false)
      
      const maxWidth = 480
      const maxHeight = 680
      
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
          
          // 🆕 오프스크린 캔버스에 렌더링
          const loadingTask = pdfjsLib.getDocument(fileUrl)
          const pdf = await loadingTask.promise
          
          if (isCancelled) return
          
          const page = await pdf.getPage(1)
          
          if (isCancelled) return
          
          const originalViewport = page.getViewport({ scale: 1 })
          const scale = Math.min(
            maxWidth / originalViewport.width,
            maxHeight / originalViewport.height
          )
          const viewport = page.getViewport({ scale })
          
          // 오프스크린 캔버스 생성
          const offscreenCanvas = document.createElement('canvas')
          offscreenCanvas.width = viewport.width
          offscreenCanvas.height = viewport.height
          const offscreenCtx = offscreenCanvas.getContext('2d')
          
          if (!offscreenCtx) return
          
          await page.render({
            canvasContext: offscreenCtx,
            viewport: viewport
          }).promise
          
          if (isCancelled) return
          
          // 이미지 URL로 변환
          imageDataUrl = offscreenCanvas.toDataURL('image/png')
          
        } else {
          // 이미지는 그대로 사용
          imageDataUrl = fileUrl
        }
        
        if (isCancelled) return
        
        // 🆕 이미지를 캔버스에 그리기
        const img = new Image()
        img.crossOrigin = 'anonymous'
        
        img.onload = () => {
          if (isCancelled || !canvasRef.current) return
          
          const canvas = canvasRef.current
          const ctx = canvas.getContext('2d')
          if (!ctx) return
          
          const scale = Math.min(
            maxWidth / img.naturalWidth,
            maxHeight / img.naturalHeight
          )
          
          canvas.width = img.naturalWidth * scale
          canvas.height = img.naturalHeight * scale
          
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          
          // 원본 이미지 데이터 저장
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          originalImageDataRef.current = imageData
          
          setCanvasReady(true)
          setIsLoadingFile(false)
          
          // 🆕 송폼 그리기 (약간의 지연 후)
          setTimeout(() => {
            if (!isCancelled) {
              drawSongFormOnCanvas()
            }
          }, 50)
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
    
    renderFile()
    
    return () => {
      isCancelled = true
    }
  }, [currentSong.id])

  
  

  const currentPosition = positions[currentSong.id] || { x: 50, y: 95, size: 'medium' }
  const currentSelectedPosition = selectedPositions[currentSong.id] || 'top-center'
  const currentSelectedSize = selectedSizes[currentSong.id] || 'medium'
  const currentPartTags = partTags[currentSong.id] || []

  const handleNext = () => {
    if (currentSongIndex < songsWithForms.length - 1) {
      setCurrentSongIndex(currentSongIndex + 1)
    } else {
      console.log('🏷️ SongFormPositionModal - partTags 전달:', partTags)  // 🆕 디버깅
      console.log('🏷️ SongFormPositionModal - positions 전달:', positions)  // 🆕 디버깅
      onConfirm(positions, partTags)
    }
  }

  const handlePrev = () => {
    if (currentSongIndex > 0) {
      setCurrentSongIndex(currentSongIndex - 1)
    }
  }

  const setPosition = (positionType: PositionType) => {
    const presets: Record<PositionType, { x: number; y: number }> = {
      'top-left': { x: 10, y: 95 },
      'top-center': { x: 50, y: 95 },
      'top-right': { x: 90, y: 95 }
    }

    setPositions(prev => ({
      ...prev,
      [currentSong.id]: {
        ...presets[positionType],
        size: currentSelectedSize
      }
    }))

    setSelectedPositions(prev => ({
      ...prev,
      [currentSong.id]: positionType
    }))
  }

  const setSize = (sizeType: SizeType) => {
    setPositions(prev => ({
      ...prev,
      [currentSong.id]: {
        ...prev[currentSong.id],
        size: sizeType
      }
    }))

    setSelectedSizes(prev => ({
      ...prev,
      [currentSong.id]: sizeType
    }))
  }

  const getSizeStyles = (size: SizeType) => {
    const sizeMap = {
      small: { fontSize: '0.7rem', padding: '0.5rem 0.75rem' },
      medium: { fontSize: '1rem', padding: '0.625rem 1rem' },
      large: { fontSize: '1.3rem', padding: '0.875rem 1.25rem' }
    }
    return sizeMap[size]
  }

  const applyToAll = () => {
    const confirmed = window.confirm('현재 위치와 크기를 모든 곡에 적용하시겠습니까?')
    if (!confirmed) return

    const newPositions: { [key: string]: SongFormPosition } = {}
    const newSelectedPositions: { [key: string]: PositionType } = {}
    const newSelectedSizes: { [key: string]: SizeType } = {}

    songsWithForms.forEach(song => {
      newPositions[song.id] = { ...currentPosition }
      newSelectedPositions[song.id] = currentSelectedPosition
      newSelectedSizes[song.id] = currentSelectedSize
    })

    setPositions(newPositions)
    setSelectedPositions(newSelectedPositions)
    setSelectedSizes(newSelectedSizes)
    alert('✅ 모든 곡에 적용되었습니다!')
  }

  // 🆕 파트 태그 드래그 시작 (팔레트에서)
  const handleTagDragStart = (e: React.DragEvent, partKey: string) => {
    setDraggingNewTag(partKey)
    e.dataTransfer.setData('text/plain', partKey)
    e.dataTransfer.effectAllowed = 'copy'
  }

  // 🆕 악보 영역에 드롭
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (!draggingNewTag || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    const newTag: PartTag = {
      id: `${draggingNewTag}-${Date.now()}`,
      label: draggingNewTag,
      x: Math.max(5, Math.min(95, x)),
      y: Math.max(5, Math.min(95, y))
    }

    setPartTags(prev => ({
      ...prev,
      [currentSong.id]: [...(prev[currentSong.id] || []), newTag]
    }))

    setDraggingNewTag(null)
  }

  // 🆕 파트 태그 삭제
  const handleTagDelete = (tagId: string) => {
    setPartTags(prev => ({
      ...prev,
      [currentSong.id]: (prev[currentSong.id] || []).filter(tag => tag.id !== tagId)
    }))
  }

  // 🆕 파트 태그 드래그 이동 (악보 위에서)
  const handleTagMouseDown = (e: React.MouseEvent, tagId: string) => {
    e.preventDefault()
    if (!containerRef.current) return

    const container = containerRef.current
    const rect = container.getBoundingClientRect()

    const onMouseMove = (moveEvent: MouseEvent) => {
      const x = ((moveEvent.clientX - rect.left) / rect.width) * 100
      const y = ((moveEvent.clientY - rect.top) / rect.height) * 100

      setPartTags(prev => ({
        ...prev,
        [currentSong.id]: (prev[currentSong.id] || []).map(tag =>
          tag.id === tagId
            ? { ...tag, x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(95, y)) }
            : tag
        )
      }))
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  // 파트 태그 색상 찾기
  const getTagColor = (label: string) => {
    const part = AVAILABLE_PARTS.find(p => p.key === label)
    return part?.color || 'bg-gray-500'
  }

  // 🆕 캔버스에 송폼 박스 그리기 (실제 렌더링과 동일하게)
  const drawSongFormOnCanvas = useCallback(() => {
    if (!canvasRef.current || !canvasReady || currentForms.length === 0) return
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // 🆕 pdfGenerator.ts와 동일한 크기 설정
    const sizeMap = {
      small: { fontSize: 14, padding: 10 },
      medium: { fontSize: 18, padding: 12 },
      large: { fontSize: 24, padding: 16 }
    }
    const { fontSize, padding } = sizeMap[currentSelectedSize]
    
    const formText = currentForms.join(' - ')
    
    ctx.font = `bold ${fontSize}px Arial, sans-serif`
    const textWidth = ctx.measureText(formText).width
    const boxWidth = textWidth + padding * 2
    const boxHeight = fontSize + padding
    
    // 🆕 pdfGenerator.ts와 동일한 위치 계산 로직
    // currentPosition.x 값 사용 (10=왼쪽, 50=가운데, 90=오른쪽)
    const percentX = currentPosition.x
    
    let x: number
    if (percentX <= 20) {
      // 왼쪽: 캔버스 기준 왼쪽 여백
      x = 20
    } else if (percentX >= 80) {
      // 오른쪽: 캔버스 기준 오른쪽 여백
      x = canvas.width - boxWidth - 20
    } else {
      // 가운데
      x = (canvas.width - boxWidth) / 2
    }
    
    // 상단에서 15px 아래
    const y = 15
    
    // 배경 박스 그리기 (둥근 모서리)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.strokeStyle = 'rgba(147, 51, 234, 0.5)'
    ctx.lineWidth = 2
    
    const radius = 6
    ctx.beginPath()
    ctx.roundRect(x - padding, y, boxWidth, boxHeight, radius)
    ctx.fill()
    ctx.stroke()
    
    // 텍스트 그리기
    ctx.fillStyle = '#7C3AED'
    ctx.textBaseline = 'middle'
    ctx.fillText(formText, x, y + boxHeight / 2)
  }, [canvasReady, currentForms, currentPosition, currentSelectedSize, currentSong.id])

  
  // 🆕 위치/크기 변경 시 송폼 다시 그리기 (여기로 이동!)
  useEffect(() => {
    if (!canvasReady || !canvasRef.current || !originalImageDataRef.current) return
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // 원본 이미지 복원
    ctx.putImageData(originalImageDataRef.current, 0, 0)
    
    // 송폼 그리기
    drawSongFormOnCanvas()
  }, [canvasReady, currentPosition, currentSelectedSize, currentForms, drawSongFormOnCanvas, currentSong.id])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-7xl max-h-[95vh] flex flex-col shadow-2xl">
        {/* 헤더 */}
        <div className="p-4 border-b bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">송폼 위치 설정</h2>
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
          {/* 🆕 왼쪽: 파트 태그 팔레트 */}
          <div className="w-48 border-r bg-gray-50 p-4 overflow-y-auto flex-shrink-0">
            <h3 className="font-semibold text-gray-700 mb-2">파트 태그</h3>
            <p className="text-xs text-gray-500 mb-4">
              드래그해서 악보 위에 배치하세요
            </p>
            <div className="space-y-2">
              {AVAILABLE_PARTS.map(part => (
                <div
                  key={part.key}
                  draggable
                  onDragStart={(e) => handleTagDragStart(e, part.key)}
                  className={`flex items-center gap-2 p-2 ${part.color} text-white rounded cursor-move hover:opacity-80 transition-opacity`}
                >
                  <GripVertical size={14} className="opacity-70" />
                  <span className="font-bold text-sm">{part.key}</span>
                </div>
              ))}
            </div>
            
            {/* 배치된 태그 목록 */}
            {currentPartTags.length > 0 && (
              <div className="mt-6 pt-4 border-t">
                <h4 className="text-sm font-medium text-gray-600 mb-2">배치된 태그</h4>
                <div className="space-y-1">
                  {currentPartTags.map(tag => (
                    <div key={tag.id} className="flex items-center justify-between text-xs bg-white p-2 rounded">
                      <span className={`${getTagColor(tag.label)} text-white px-2 py-0.5 rounded font-bold`}>
                        {tag.label}
                      </span>
                      <button
                        onClick={() => handleTagDelete(tag.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 오른쪽: 미리보기 영역 */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* 위치/크기 선택 버튼 */}
            <div className="p-4 bg-white border-b space-y-3">
              {/* 위치 선택 */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700 w-20">송폼 위치:</span>
                <button
                  onClick={() => setPosition('top-left')}
                  className={`flex-1 px-3 py-2 rounded-lg font-medium transition-all text-sm ${
                    currentSelectedPosition === 'top-left'
                      ? 'bg-[#C4BEE2] text-white shadow-lg'
                      : 'bg-gray-100 hover:bg-purple-50 border border-gray-300'
                  }`}
                >
                  ↖️ 좌측
                </button>
                <button
                  onClick={() => setPosition('top-center')}
                  className={`flex-1 px-3 py-2 rounded-lg font-medium transition-all text-sm ${
                    currentSelectedPosition === 'top-center'
                      ? 'bg-[#C4BEE2] text-white shadow-lg'
                      : 'bg-gray-100 hover:bg-purple-50 border border-gray-300'
                  }`}
                >
                  ⬆️ 가운데
                </button>
                <button
                  onClick={() => setPosition('top-right')}
                  className={`flex-1 px-3 py-2 rounded-lg font-medium transition-all text-sm ${
                    currentSelectedPosition === 'top-right'
                      ? 'bg-[#C4BEE2] text-white shadow-lg'
                      : 'bg-gray-100 hover:bg-purple-50 border border-gray-300'
                  }`}
                >
                  ↗️ 우측
                </button>
                <button
                  onClick={applyToAll}
                  className="px-3 py-2 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8] transition-colors font-medium text-sm whitespace-nowrap"
                >
                  📋 모든 곡 적용
                </button>
              </div>

              {/* 크기 선택 */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700 w-20">송폼 크기:</span>
                <button
                  onClick={() => setSize('small')}
                  className={`flex-1 px-3 py-2 rounded-lg font-medium transition-all text-sm ${
                    currentSelectedSize === 'small'
                      ? 'bg-[#84B9C0] text-white shadow-lg'
                      : 'bg-gray-100 hover:bg-green-50 border border-gray-300'
                  }`}
                >
                  🔹 작게
                </button>
                <button
                  onClick={() => setSize('medium')}
                  className={`flex-1 px-3 py-2 rounded-lg font-medium transition-all text-sm ${
                    currentSelectedSize === 'medium'
                      ? 'bg-[#84B9C0] text-white shadow-lg'
                      : 'bg-gray-100 hover:bg-green-50 border border-gray-300'
                  }`}
                >
                  🔸 보통
                </button>
                <button
                  onClick={() => setSize('large')}
                  className={`flex-1 px-3 py-2 rounded-lg font-medium transition-all text-sm ${
                    currentSelectedSize === 'large'
                      ? 'bg-[#84B9C0] text-white shadow-lg'
                      : 'bg-gray-100 hover:bg-green-50 border border-gray-300'
                  }`}
                >
                  🔶 크게
                </button>
              </div>
            </div>

            {/* 🆕 악보 미리보기 (PDF.js 캔버스) */}
            <div className="flex-1 p-4 bg-gray-100 overflow-auto">
              <div
                ref={containerRef}
                className="relative mx-auto bg-white rounded-lg shadow-lg border-2 border-gray-300 overflow-hidden flex items-center justify-center"
                style={{
                  width: '520px',
                  height: '720px',
                  maxWidth: '100%'
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                {/* 로딩 표시 */}
                {isLoadingFile && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 z-20">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-2"></div>
                      <p className="text-sm text-gray-600">악보 로딩 중...</p>
                    </div>
                  </div>
                )}

                {/* 캔버스 (PDF/이미지 렌더링) */}
                <canvas
                  ref={canvasRef}
                  className="block"
                  style={{ maxWidth: '100%' }}
                />

                {/* 파일이 없는 경우 */}
                {!currentSong.file_url && (
                  <div className="w-full h-96 flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <div className="text-6xl mb-4">🎵</div>
                      <p>악보 파일이 없습니다</p>
                    </div>
                  </div>
                )}

                

                {/* 🆕 배치된 파트 태그들 */}
                {canvasReady && currentPartTags.map(tag => (
                  <div
                    key={tag.id}
                    className={`absolute ${getTagColor(tag.label)} text-white px-2 py-1 rounded text-sm font-bold cursor-move shadow-lg select-none`}
                    style={{
                      left: `${tag.x}%`,
                      top: `${tag.y}%`,
                      transform: 'translate(-50%, -50%)',
                      zIndex: 15
                    }}
                    onMouseDown={(e) => handleTagMouseDown(e, tag.id)}
                  >
                    {tag.label}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleTagDelete(tag.id) }}
                      className="ml-1 opacity-70 hover:opacity-100"
                    >
                      ×
                    </button>
                  </div>
                ))}
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
                  <>✓ 확정하고 다운로드</>
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
                      ? 'bg-[#C4BEE2]'
                      : index < currentSongIndex
                      ? 'bg-[#84B9C0]'
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