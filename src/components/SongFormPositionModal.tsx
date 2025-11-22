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
  
  const [imageDisplaySize, setImageDisplaySize] = useState({ width: 0, height: 0 })
  const [isLoading, setIsLoading] = useState(false)

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

  // 각 곡의 초기 위치 설정
  useEffect(() => {
    const initialPositions: { [key: string]: SongFormPosition } = {}
    const initialSelected: { [key: string]: PositionType } = {}
    const initialSizes: { [key: string]: SizeType } = {}
    songsWithForms.forEach(song => {
      if (!positions[song.id]) {
        initialPositions[song.id] = { x: 50, y: 95, size: 'medium' } // Y값 95로 유지 (상단)
        initialSelected[song.id] = 'top-center'
        initialSizes[song.id] = 'medium'
      }
    })
    setPositions(prev => ({ ...initialPositions, ...prev }))
    setSelectedPositions(prev => ({ ...initialSelected, ...prev }))
    setSelectedSizes(prev => ({ ...initialSizes, ...prev }))
  }, [songsWithForms.length])

  // 컨테이너 크기 계산
  useEffect(() => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth
      const containerHeight = containerRef.current.clientHeight
      
      // A4 비율로 표시 크기 계산
      const scale = Math.min(
        containerWidth * 0.9 / 210,
        containerHeight * 0.9 / 297
      )
      
      setImageDisplaySize({
        width: 210 * scale,
        height: 297 * scale
      })
    }
  }, [currentSong.id])

  // 파일 로드 상태 관리
  useEffect(() => {
    setIsLoading(true)
    // iframe이나 이미지가 로드되면 로딩 상태 해제
    const timer = setTimeout(() => setIsLoading(false), 1500)
    return () => clearTimeout(timer)
  }, [currentSong.id])

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
    // X 좌표를 더 넓게 분포시킴 (전체 페이지 기준)
    const presets: Record<PositionType, { x: number; y: number }> = {
      'top-left': { x: 10, y: 95 },    // 왼쪽
      'top-center': { x: 50, y: 95 },  // 가운데
      'top-right': { x: 90, y: 95 }    // 오른쪽
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

  // 파일 타입 확인
  const isPDF = currentSong.file_type === 'pdf' || currentSong.file_url?.toLowerCase().endsWith('.pdf')
  const isImage = currentSong.file_type === 'image' || 
    currentSong.file_url?.match(/\.(jpg|jpeg|png|gif|webp)$/i)

  // PDF Viewer 렌더링 함수 - A4 크기로 표준화
  const renderFileViewer = () => {
    if (!currentSong.file_url) {
      return (
        <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-50">
          <div className="text-center">
            <div className="text-6xl mb-4">📄</div>
            <p>악보 미리보기</p>
          </div>
        </div>
      )
    }

    if (isPDF || isImage) {
      // 모든 파일을 A4 크기의 컨테이너 안에 표시
      return (
        <div className="w-full h-full flex items-center justify-center p-4 bg-gray-50">
          {isPDF ? (
            // PDF는 Google Docs Viewer 사용
            <iframe
              src={`https://docs.google.com/viewer?url=${encodeURIComponent(currentSong.file_url)}&embedded=true`}
              className="w-full h-full bg-white shadow-inner"
              title={`${currentSong.song_name} PDF`}
              onLoad={() => setIsLoading(false)}
              style={{ 
                border: '1px solid #e5e7eb',
                maxWidth: '100%',
                maxHeight: '100%'
              }}
            />
          ) : (
            // 이미지는 A4 비율에 맞게 표시
            <div 
              className="bg-white shadow-inner flex items-center justify-center"
              style={{
                width: '100%',
                height: '100%',
                border: '1px solid #e5e7eb'
              }}
            >
              <img
                src={currentSong.file_url}
                alt={currentSong.song_name}
                className="object-contain"
                onLoad={() => setIsLoading(false)}
                draggable={false}
                style={{ 
                  maxWidth: '95%',
                  maxHeight: '95%',
                  userSelect: 'none'
                }}
              />
            </div>
          )}
        </div>
      )
    }

    // 지원하지 않는 파일 형식
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <div className="text-6xl mb-4">⚠️</div>
          <p className="text-gray-600 mb-4">미리보기를 지원하지 않는 파일 형식입니다</p>
          <a
            href={currentSong.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            파일 열기
          </a>
        </div>
      </div>
    )
  }

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
                  <li>• 모든 악보가 A4 크기로 표준화되어 표시됩니다</li>
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

          {/* 악보 미리보기 컨테이너 - A4 크기로 표준화 */}
          <div
            ref={containerRef}
            className="relative w-full bg-white rounded-lg shadow-lg border-2 border-gray-300 overflow-hidden"
            style={{
              aspectRatio: '210 / 297', // A4 비율
              maxHeight: '650px',
              margin: '0 auto'
            }}
          >
            {/* 로딩 표시 */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 z-20">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">파일 로딩 중...</p>
                </div>
              </div>
            )}

            {/* 파일 뷰어 - A4 크기로 표준화 */}
            {renderFileViewer()}

            {/* 송폼 박스 오버레이 - 전체 페이지 기준 위치 */}
            {!isLoading && imageDisplaySize.width > 0 && currentForms.length > 0 && (
              <div
                className="absolute bg-white bg-opacity-95 text-purple-700 rounded-lg shadow-xl font-bold transition-all duration-200"
                style={{
                  // 위치를 정확하게 계산
                  left: currentSelectedPosition === 'top-left' 
                    ? '5%' 
                    : currentSelectedPosition === 'top-center'
                    ? '50%'
                    : '95%', // 우측은 95%
                  top: '5%', // 상단 5%
                  transform: currentSelectedPosition === 'top-center' 
                    ? 'translateX(-50%)' 
                    : currentSelectedPosition === 'top-right'
                    ? 'translateX(-100%)' // 우측은 박스 너비만큼 왼쪽으로 이동
                    : 'translateX(0)',
                  border: '2px solid rgba(147, 51, 234, 0.5)',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                  zIndex: 10,
                  pointerEvents: 'none',
                  whiteSpace: 'nowrap', // 텍스트 줄바꿈 방지 - 가로로 한 줄 표시
                  ...getSizeStyles(currentSelectedSize)
                }}
              >
                {currentForms.join(' - ')}
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