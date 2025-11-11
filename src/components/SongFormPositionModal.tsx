'use client'

import { useState, useRef, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

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

interface Props {
  songs: Song[]
  songForms: { [key: string]: string[] }
  onConfirm: (positions: { [key: string]: SongFormPosition }) => void
  onCancel: () => void
}

export default function SongFormPositionModal({ songs, songForms, onConfirm, onCancel }: Props) {
  const songsWithForms = songs.filter(song => {
    const forms = songForms[song.id] || song.selectedForm || []
    return forms.length > 0
  })

  const [currentSongIndex, setCurrentSongIndex] = useState(0)
  const [positions, setPositions] = useState<{ [key: string]: SongFormPosition }>({})
  const [selectedPositions, setSelectedPositions] = useState<{ [key: string]: PositionType }>({})
  const [selectedSizes, setSelectedSizes] = useState<{ [key: string]: SizeType }>({})
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 })
  const [imageDisplaySize, setImageDisplaySize] = useState({ width: 0, height: 0 })
  const [pdfLoading, setPdfLoading] = useState(false)
  
  // 🆕 렌더링 작업 추적을 위한 ref
  const renderTaskRef = useRef<any>(null)
  const isRenderingRef = useRef(false)

  useEffect(() => {
    if (songsWithForms.length === 0) {
      onConfirm({})
    }
  }, [])

  if (songsWithForms.length === 0) {
    return null
  }

  const currentSong = songsWithForms[currentSongIndex]
  const currentForms = songForms[currentSong.id] || currentSong.selectedForm || []

  // 각 곡의 초기 위치
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

  // 🆕 PDF 파일의 첫 페이지를 canvas에 렌더링 (중복 방지)
  useEffect(() => {
    let isMounted = true
    
    const renderPDF = async () => {
      if (!currentSong.file_url || !canvasRef.current) return
      
      const isPDF = currentSong.file_type === 'pdf' || currentSong.file_url.toLowerCase().endsWith('.pdf')
      
      if (!isPDF) return
      
      // 🔧 이미 렌더링 중이면 취소
      if (isRenderingRef.current) {
        console.log('⚠️ 렌더링 중... 대기')
        return
      }
      
      // 🔧 이전 렌더링 작업이 있으면 취소
      if (renderTaskRef.current) {
        try {
          await renderTaskRef.current.cancel()
          console.log('✅ 이전 렌더링 작업 취소됨')
        } catch (e) {
          // 이미 완료된 작업은 무시
        }
        renderTaskRef.current = null
      }

      isRenderingRef.current = true
      setPdfLoading(true)
      
      try {
        // pdfjs-dist 동적 import
        const pdfjsLib = await import('pdfjs-dist')
        
        if (!isMounted) return
        
        // PDF.js worker 설정
        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = 
            `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
        }
        
        console.log('📄 PDF.js 버전:', pdfjsLib.version)
        console.log('🔧 Worker URL:', pdfjsLib.GlobalWorkerOptions.workerSrc)
        console.log('🎵 렌더링 시작:', currentSong.song_name)
        
        // PDF 로드
        const loadingTask = pdfjsLib.getDocument(currentSong.file_url)
        const pdf = await loadingTask.promise
        
        if (!isMounted) return
        
        // 첫 페이지 가져오기
        const page = await pdf.getPage(1)
        
        if (!isMounted || !canvasRef.current) return
        
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')
        
        if (!context || !containerRef.current) return
        
        // 🔧 Canvas 초기화
        context.clearRect(0, 0, canvas.width, canvas.height)
        
        // 컨테이너 크기에 맞춰 scale 계산
        const containerWidth = containerRef.current.clientWidth
        const containerHeight = containerRef.current.clientHeight
        
        const viewport = page.getViewport({ scale: 1 })
        
        // 🔧 적절한 스케일 계산 (여백 포함)
        const scale = Math.min(
          (containerWidth * 0.85) / viewport.width,
          (containerHeight * 0.85) / viewport.height
        )
        
        const scaledViewport = page.getViewport({ scale })
        
        // Canvas 크기 설정
        canvas.width = scaledViewport.width
        canvas.height = scaledViewport.height
        
        console.log(`📐 Canvas 크기: ${canvas.width} x ${canvas.height}`)
        console.log(`📐 Scale: ${scale}`)
        
        // 실제 표시 크기 저장
        setImageDisplaySize({
          width: scaledViewport.width,
          height: scaledViewport.height
        })
        
        setImageNaturalSize({
          width: viewport.width,
          height: viewport.height
        })
        
        // PDF 페이지 렌더링
        const renderTask = page.render({
          canvasContext: context as any,
          viewport: scaledViewport
        } as any)
        
        // 🔧 렌더링 작업 저장
        renderTaskRef.current = renderTask
        
        await renderTask.promise
        
        if (!isMounted) return
        
        console.log('✅ PDF 렌더링 완료:', currentSong.song_name)
        setPdfLoading(false)
        isRenderingRef.current = false
        renderTaskRef.current = null
        
      } catch (error: any) {
        if (error?.name === 'RenderingCancelledException') {
          console.log('ℹ️ 렌더링이 취소되었습니다.')
        } else {
          console.error('❌ PDF 렌더링 오류:', error)
        }
        if (isMounted) {
          setPdfLoading(false)
          isRenderingRef.current = false
          renderTaskRef.current = null
        }
      }
    }
    
    renderPDF()
    
    // 🔧 Cleanup: 컴포넌트 언마운트 또는 곡 변경 시 렌더링 취소
    return () => {
      isMounted = false
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel().catch(() => {})
        renderTaskRef.current = null
      }
      isRenderingRef.current = false
    }
  }, [currentSong.file_url, currentSong.file_type, currentSong.id])

  // 이미지 로드 시 실제 크기 계산 (이미지 파일용)
  useEffect(() => {
    if (imageRef.current && currentSong.file_url) {
      const isPDF = currentSong.file_type === 'pdf' || currentSong.file_url.toLowerCase().endsWith('.pdf')
      
      if (!isPDF) {
        const img = new Image()
        img.onload = () => {
          setImageNaturalSize({ width: img.width, height: img.height })
          
          if (containerRef.current) {
            const containerWidth = containerRef.current.clientWidth
            const containerHeight = containerRef.current.clientHeight
            
            const scale = Math.min(
              containerWidth / img.width,
              containerHeight / img.height
            ) * 0.9
            
            setImageDisplaySize({
              width: img.width * scale,
              height: img.height * scale
            })
          }
        }
        img.src = currentSong.file_url
      }
    }
  }, [currentSong.file_url, currentSong.id, currentSong.file_type])

  const currentPosition = positions[currentSong.id] || { x: 50, y: 95, size: 'medium' }
  const currentSelectedPosition = selectedPositions[currentSong.id] || 'top-center'
  const currentSelectedSize = selectedSizes[currentSong.id] || 'medium'

  const handleNext = () => {
    if (currentSongIndex < songsWithForms.length - 1) {
      setCurrentSongIndex(currentSongIndex + 1)
    } else {
      onConfirm(positions)
    }
  }

  const handlePrev = () => {
    if (currentSongIndex > 0) {
      setCurrentSongIndex(currentSongIndex - 1)
    }
  }

  const setPosition = (positionType: PositionType) => {
    const presets: Record<PositionType, { x: number; y: number }> = {
      'top-left': { x: 15, y: 95 },
      'top-center': { x: 50, y: 95 },
      'top-right': { x: 85, y: 95 }
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
    // 🔧 실제 PDF 크기와 비율 맞춤 (더 작게 표시)
    const sizeMap = {
      small: { fontSize: '0.7rem', padding: '0.5rem 0.75rem' },      // 16pt → 약 11px
      medium: { fontSize: '1rem', padding: '0.625rem 1rem' },        // 22pt → 약 16px
      large: { fontSize: '1.3rem', padding: '0.875rem 1.25rem' }     // 28pt → 약 21px
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

  const isPDF = currentSong.file_type === 'pdf' || currentSong.file_url?.toLowerCase().endsWith('.pdf')

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[95vh] flex flex-col shadow-2xl">
        {/* 헤더 */}
        <div className="p-6 border-b bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                🎵 송폼 위치 설정
              </h2>
              <p className="text-sm text-gray-600 mt-1">
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

          {/* 안내 메시지 */}
          <div className="p-4 bg-white border-2 border-purple-200 rounded-lg shadow-sm">
            <div className="flex items-start gap-3">
              <div className="text-2xl">💡</div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800 mb-1">
                  송폼이 표시될 위치와 크기를 선택하세요
                </p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 악보 상단의 왼쪽, 가운데, 오른쪽 중 선택할 수 있습니다</li>
                  <li>• 송폼 박스의 크기를 작게/보통/크게 조절할 수 있습니다</li>
                  <li>• 미리보기는 실제 PDF와 동일한 비율로 표시됩니다</li>
                  <li>• "모든 곡에 적용" 버튼으로 한 번에 설정할 수 있습니다</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* 미리보기 영역 */}
        <div className="flex-1 overflow-auto p-6 bg-gray-50">
          {/* 위치 선택 버튼 */}
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 mr-2">송폼 위치:</span>
            <button
              onClick={() => setPosition('top-left')}
              className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
                currentSelectedPosition === 'top-left'
                  ? 'bg-purple-600 text-white shadow-lg scale-105'
                  : 'bg-white border-2 border-gray-300 hover:border-purple-400 hover:bg-purple-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-lg">↖️</span>
                <span>좌측 상단</span>
              </div>
            </button>
            <button
              onClick={() => setPosition('top-center')}
              className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
                currentSelectedPosition === 'top-center'
                  ? 'bg-purple-600 text-white shadow-lg scale-105'
                  : 'bg-white border-2 border-gray-300 hover:border-purple-400 hover:bg-purple-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-lg">⬆️</span>
                <span>가운데 상단</span>
              </div>
            </button>
            <button
              onClick={() => setPosition('top-right')}
              className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
                currentSelectedPosition === 'top-right'
                  ? 'bg-purple-600 text-white shadow-lg scale-105'
                  : 'bg-white border-2 border-gray-300 hover:border-purple-400 hover:bg-purple-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-lg">↗️</span>
                <span>우측 상단</span>
              </div>
            </button>
            <div className="ml-2">
              <button
                onClick={applyToAll}
                className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium whitespace-nowrap shadow-md"
              >
                📋 모든 곡에 적용
              </button>
            </div>
          </div>

          {/* 크기 선택 버튼 */}
          <div className="mb-4 flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 mr-2">송폼 크기:</span>
            <button
              onClick={() => setSize('small')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                currentSelectedSize === 'small'
                  ? 'bg-green-600 text-white shadow-lg scale-105'
                  : 'bg-white border-2 border-gray-300 hover:border-green-400 hover:bg-green-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-xs">📏</span>
                <span>작게</span>
              </div>
            </button>
            <button
              onClick={() => setSize('medium')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                currentSelectedSize === 'medium'
                  ? 'bg-green-600 text-white shadow-lg scale-105'
                  : 'bg-white border-2 border-gray-300 hover:border-green-400 hover:bg-green-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm">📏</span>
                <span>보통</span>
              </div>
            </button>
            <button
              onClick={() => setSize('large')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                currentSelectedSize === 'large'
                  ? 'bg-green-600 text-white shadow-lg scale-105'
                  : 'bg-white border-2 border-gray-300 hover:border-green-400 hover:bg-green-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-lg">📏</span>
                <span>크게</span>
              </div>
            </button>
          </div>

          {/* 악보 미리보기 */}
          <div
            ref={containerRef}
            className="relative w-full bg-white rounded-lg shadow-lg border-2 border-gray-200 overflow-hidden"
            style={{
              aspectRatio: '210 / 297',
              maxHeight: '650px',
              margin: '0 auto'
            }}
          >
            {currentSong.file_url ? (
              <div 
                className="absolute inset-0 flex items-center justify-center bg-gray-100"
                style={{ padding: '5%' }}
              >
                {isPDF ? (
                  <div className="relative flex items-center justify-center w-full h-full">
                    {pdfLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 z-10">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-2"></div>
                          <p className="text-sm text-gray-600">PDF 로딩 중...</p>
                        </div>
                      </div>
                    )}
                    <canvas
                      ref={canvasRef}
                      className="max-w-full max-h-full object-contain"
                      style={{ 
                        userSelect: 'none'
                      }}
                    />
                  </div>
                ) : (
                  <img
                    ref={imageRef}
                    src={currentSong.file_url}
                    alt={currentSong.song_name}
                    className="max-w-full max-h-full object-contain"
                    draggable={false}
                    style={{ 
                      userSelect: 'none',
                      maxWidth: '90%',
                      maxHeight: '90%'
                    }}
                  />
                )}
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <div className="text-6xl mb-4">📄</div>
                  <p>악보 미리보기</p>
                </div>
              </div>
            )}

            {/* 송폼 박스 */}
            {!pdfLoading && imageDisplaySize.width > 0 && (
              <div
                className="absolute bg-white border-3 rounded-lg shadow-xl border-purple-600 transition-all"
                style={{
                  // 🔧 실제 이미지/PDF 표시 영역 내로 위치 제한
                  left: `calc(50% + ${((currentPosition.x - 50) / 100) * imageDisplaySize.width}px)`,
                  bottom: `calc(50% + ${((currentPosition.y - 50) / 100) * imageDisplaySize.height}px)`,  // 🔧 부호 수정!
                  transform: 'translate(-50%, 50%)',
                  userSelect: 'none',
                  borderWidth: '3px',
                  pointerEvents: 'none',
                  ...getSizeStyles(currentSelectedSize)
                }}
              >
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {/* 🔧 점 크기를 더 작게 조정 */}
                    <div 
                      className="bg-purple-600 rounded-full"
                      style={{
                        width: currentSelectedSize === 'small' ? '0.25rem' : currentSelectedSize === 'medium' ? '0.375rem' : '0.5rem',
                        height: currentSelectedSize === 'small' ? '0.25rem' : currentSelectedSize === 'medium' ? '0.375rem' : '0.5rem'
                      }}
                    ></div>
                    <div 
                      className="bg-purple-600 rounded-full"
                      style={{
                        width: currentSelectedSize === 'small' ? '0.25rem' : currentSelectedSize === 'medium' ? '0.375rem' : '0.5rem',
                        height: currentSelectedSize === 'small' ? '0.25rem' : currentSelectedSize === 'medium' ? '0.375rem' : '0.5rem'
                      }}
                    ></div>
                    <div 
                      className="bg-purple-600 rounded-full"
                      style={{
                        width: currentSelectedSize === 'small' ? '0.25rem' : currentSelectedSize === 'medium' ? '0.375rem' : '0.5rem',
                        height: currentSelectedSize === 'small' ? '0.25rem' : currentSelectedSize === 'medium' ? '0.375rem' : '0.5rem'
                      }}
                    ></div>
                  </div>
                  <span className="font-bold text-purple-900 whitespace-nowrap">
                    {currentForms.join(' - ')}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 좌표 정보 */}
          <div className="mt-4 text-center">
            <div className="inline-flex gap-3">
              <div className="px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm">
                <span className="text-sm text-gray-600">
                  선택한 위치: <span className="font-semibold text-purple-600">
                    {currentSelectedPosition === 'top-left' && '좌측 상단'}
                    {currentSelectedPosition === 'top-center' && '가운데 상단'}
                    {currentSelectedPosition === 'top-right' && '우측 상단'}
                  </span>
                </span>
              </div>
              <div className="px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm">
                <span className="text-sm text-gray-600">
                  선택한 크기: <span className="font-semibold text-green-600">
                    {currentSelectedSize === 'small' && '작게'}
                    {currentSelectedSize === 'medium' && '보통'}
                    {currentSelectedSize === 'large' && '크게'}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="p-6 border-t bg-gray-50">
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrev}
              disabled={currentSongIndex === 0}
              className="px-5 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 font-medium"
            >
              <ChevronLeft size={20} />
              이전 곡
            </button>

            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all font-medium"
              >
                취소
              </button>
              <button
                onClick={handleNext}
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all font-semibold shadow-lg hover:shadow-xl flex items-center gap-2"
              >
                {currentSongIndex < songsWithForms.length - 1 ? (
                  <>
                    다음 곡
                    <ChevronRight size={20} />
                  </>
                ) : (
                  <>
                    ✓ 확정하고 PDF 생성
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 진행 상황 */}
          <div className="mt-4">
            <div className="flex gap-1">
              {songsWithForms.map((_, index) => (
                <div
                  key={index}
                  className={`flex-1 h-1.5 rounded-full transition-all ${
                    index === currentSongIndex
                      ? 'bg-purple-600'
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