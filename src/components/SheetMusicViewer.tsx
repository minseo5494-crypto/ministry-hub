'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface SheetMusicViewerProps {
  fileUrl: string
  fileType: 'pdf' | 'image'
  songName?: string
  onClose: () => void
}

export default function SheetMusicViewer({
  fileUrl,
  fileType,
  songName,
  onClose
}: SheetMusicViewerProps) {
  // 줌/팬 상태
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })

  // 터치 관련
  const containerRef = useRef<HTMLDivElement>(null)
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const lastTapTime = useRef<number>(0)
  const lastTapX = useRef<number>(0)
  const lastTapY = useRef<number>(0)
  const initialPinchDistance = useRef<number | null>(null)
  const initialScale = useRef<number>(1)
  const isPinching = useRef<boolean>(false)
  const isSwiping = useRef<boolean>(false)

  // 화면에 맞추기
  const fitToScreen = useCallback(() => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }, [])

  // 터치 이벤트 핸들러
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // 핀치 줌 시작
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      const distance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY)
      initialPinchDistance.current = distance
      initialScale.current = scale
      isPinching.current = true
    } else if (e.touches.length === 1) {
      // 싱글 터치 시작
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now()
      }
      isSwiping.current = false
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistance.current) {
      // 핀치 줌
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      const distance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY)
      const newScale = Math.min(Math.max(initialScale.current * (distance / initialPinchDistance.current), 0.5), 4)
      setScale(newScale)
    } else if (e.touches.length === 1 && touchStartRef.current && !isPinching.current) {
      const deltaX = e.touches[0].clientX - touchStartRef.current.x
      const deltaY = e.touches[0].clientY - touchStartRef.current.y

      if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
        isSwiping.current = true
      }

      if (scale > 1) {
        // 확대 상태에서 팬
        setPosition(prev => ({
          x: prev.x + deltaX * 0.5,
          y: prev.y + deltaY * 0.5
        }))
        touchStartRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          time: touchStartRef.current.time
        }
      }
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isPinching.current) {
      isPinching.current = false
      initialPinchDistance.current = null
      return
    }

    if (!touchStartRef.current) return

    const endX = e.changedTouches[0].clientX
    const endY = e.changedTouches[0].clientY
    const deltaX = endX - touchStartRef.current.x
    const deltaY = endY - touchStartRef.current.y

    // 탭 감지 (스와이프 아닐 때)
    if (!isSwiping.current && Math.abs(deltaX) < 20 && Math.abs(deltaY) < 20) {
      const now = Date.now()
      const tapDistance = Math.sqrt(
        Math.pow(endX - lastTapX.current, 2) + Math.pow(endY - lastTapY.current, 2)
      )

      // 더블탭 감지
      if (now - lastTapTime.current < 300 && tapDistance < 50) {
        // 더블탭: 줌 토글
        if (scale > 1.2) {
          fitToScreen()
        } else {
          setScale(2.0)
        }
        lastTapTime.current = 0
      } else {
        lastTapTime.current = now
        lastTapX.current = endX
        lastTapY.current = endY
      }
    }

    touchStartRef.current = null
    isSwiping.current = false
  }

  // 마우스 더블클릭
  const handleDoubleClick = () => {
    if (scale > 1.2) {
      fitToScreen()
    } else {
      setScale(2.0)
    }
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* 닫기 버튼 */}
      <button
        onClick={onClose}
        className="fixed top-4 right-4 z-[60] p-3"
        style={{ touchAction: 'manipulation' }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      {/* 메인 컨텐츠 */}
      {fileType === 'pdf' ? (
        // PDF: 아이패드에서 스크롤 가능하도록 별도 처리
        <div
          ref={containerRef}
          className="flex-1 overflow-auto -webkit-overflow-scrolling-touch"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <iframe
            src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
            className="w-full border-0"
            style={{
              height: '100%',
              minHeight: '100vh'
            }}
          />
        </div>
      ) : (
        // 이미지: 기존 줌/팬 동작 유지
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden flex items-center justify-center"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onDoubleClick={handleDoubleClick}
          style={{ touchAction: scale > 1 ? 'none' : 'manipulation' }}
        >
          <div
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transformOrigin: 'center center',
              transition: isSwiping.current ? 'none' : 'transform 0.1s ease-out'
            }}
          >
            <img
              src={fileUrl}
              alt={songName || '악보'}
              className="max-w-full max-h-full object-contain"
              draggable={false}
              style={{ maxHeight: '100vh', maxWidth: '100vw' }}
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/placeholder-sheet.png'
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
