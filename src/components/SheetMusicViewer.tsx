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
  // 페이지 상태
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // 줌/팬 상태
  const [scale, setScale] = useState(1)
  const [minScale, setMinScale] = useState(0.5)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })

  // refs
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pdfDocRef = useRef<any>(null)
  const renderTaskRef = useRef<any>(null)
  const hasInitializedScale = useRef(false)

  // 터치 관련
  const lastTouchDistance = useRef<number | null>(null)
  const swipeStartX = useRef<number | null>(null)
  const swipeStartY = useRef<number | null>(null)
  const isSwiping = useRef<boolean>(false)
  const lastTapTime = useRef<number>(0)
  const lastTapX = useRef<number>(0)
  const lastTapY = useRef<number>(0)

  // 화면에 맞추기
  const fitToScreen = useCallback((cWidth: number, cHeight: number) => {
    const container = containerRef.current
    if (!container || cWidth === 0 || cHeight === 0) return

    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight
    const padding = 20

    const scaleX = (containerWidth - padding * 2) / cWidth
    const scaleY = (containerHeight - padding * 2) / cHeight
    const newScale = Math.min(scaleX, scaleY)

    setMinScale(newScale)
    setScale(newScale)
    setOffset({ x: 0, y: 0 })
  }, [])

  // PDF 렌더링
  useEffect(() => {
    if (fileType !== 'pdf') return

    let isCancelled = false

    const renderPDF = async () => {
      try {
        const pdfjsLib = (window as any).pdfjsLib
        if (!pdfjsLib) {
          console.error('PDF.js not loaded')
          return
        }

        // 이전 렌더링 취소
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel()
          } catch (e) {}
          renderTaskRef.current = null
        }

        // PDF 문서 로드
        if (!pdfDocRef.current) {
          const loadingTask = pdfjsLib.getDocument(fileUrl)
          pdfDocRef.current = await loadingTask.promise
          if (isCancelled) return
          setTotalPages(pdfDocRef.current.numPages)
        }

        const pdf = pdfDocRef.current
        const page = await pdf.getPage(currentPage)
        if (isCancelled) return

        const viewport = page.getViewport({ scale: 2 }) // 고해상도

        const canvas = canvasRef.current
        if (!canvas) return
        const context = canvas.getContext('2d')
        if (!context) return

        canvas.width = viewport.width
        canvas.height = viewport.height

        const renderTask = page.render({
          canvasContext: context,
          viewport: viewport,
        })
        renderTaskRef.current = renderTask

        await renderTask.promise
        if (isCancelled) return

        setCanvasSize({ width: viewport.width, height: viewport.height })

        // 초기 로드 시 화면에 맞추기
        if (!hasInitializedScale.current) {
          hasInitializedScale.current = true
          requestAnimationFrame(() => {
            setTimeout(() => {
              fitToScreen(viewport.width, viewport.height)
            }, 50)
          })
        }
      } catch (error: any) {
        if (error?.name === 'RenderingCancelledException') return
        console.error('PDF 렌더링 오류:', error)
      }
    }

    renderPDF()

    return () => {
      isCancelled = true
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel()
        } catch (e) {}
      }
    }
  }, [fileUrl, fileType, currentPage, fitToScreen])

  // 이미지 렌더링
  useEffect(() => {
    if (fileType !== 'image') return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const context = canvas.getContext('2d')
      if (!context) return

      // 고해상도 렌더링
      const scale = 2
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      context.scale(scale, scale)
      context.drawImage(img, 0, 0)

      setCanvasSize({ width: canvas.width, height: canvas.height })
      setTotalPages(1)

      if (!hasInitializedScale.current) {
        hasInitializedScale.current = true
        requestAnimationFrame(() => {
          setTimeout(() => {
            fitToScreen(canvas.width, canvas.height)
          }, 50)
        })
      }
    }
    img.src = fileUrl
  }, [fileUrl, fileType, fitToScreen])

  // 페이지 변경 시 초기화
  useEffect(() => {
    hasInitializedScale.current = false
  }, [currentPage])

  // 줌 핸들러
  const handleZoom = useCallback((delta: number) => {
    setScale(prev => Math.max(minScale, Math.min(4, prev + delta)))
  }, [minScale])

  // 터치 시작
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // 핀치 줌 시작
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      lastTouchDistance.current = Math.sqrt(dx * dx + dy * dy)
      isSwiping.current = false
    } else if (e.touches.length === 1) {
      swipeStartX.current = e.touches[0].clientX
      swipeStartY.current = e.touches[0].clientY
      isSwiping.current = true
    }
  }, [])

  // 터치 이동
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

  // 터치 종료
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    lastTouchDistance.current = null

    if (isSwiping.current && swipeStartX.current !== null && swipeStartY.current !== null && e.changedTouches.length > 0) {
      const endX = e.changedTouches[0].clientX
      const endY = e.changedTouches[0].clientY
      const deltaX = endX - swipeStartX.current
      const deltaY = endY - swipeStartY.current

      // 스와이프 감지
      const isSwipe = Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50

      if (isSwipe && scale <= minScale + 0.01) {
        // 스와이프로 페이지 변경 (확대 안된 상태에서만)
        if (deltaX > 0 && currentPage > 1) {
          setCurrentPage(p => p - 1)
        } else if (deltaX < 0 && currentPage < totalPages) {
          setCurrentPage(p => p + 1)
        }
      } else if (Math.abs(deltaX) < 15 && Math.abs(deltaY) < 15) {
        // 탭 감지
        const now = Date.now()
        const tapDistance = Math.sqrt(
          Math.pow(endX - lastTapX.current, 2) +
          Math.pow(endY - lastTapY.current, 2)
        )

        // 더블탭 감지
        if (now - lastTapTime.current < 300 && tapDistance < 50) {
          if (scale > minScale + 0.1) {
            fitToScreen(canvasSize.width, canvasSize.height)
          } else {
            setScale(2.0)
          }
          lastTapTime.current = 0
        } else {
          // 싱글 탭: 영역별 동작
          lastTapTime.current = now
          lastTapX.current = endX
          lastTapY.current = endY

          const container = containerRef.current
          if (container) {
            const rect = container.getBoundingClientRect()
            const tapX = endX - rect.left
            const containerWidth = rect.width

            // 화면을 3등분
            const leftZone = containerWidth * 0.25
            const rightZone = containerWidth * 0.75

            if (tapX < leftZone && currentPage > 1) {
              setCurrentPage(p => p - 1)
            } else if (tapX > rightZone && currentPage < totalPages) {
              setCurrentPage(p => p + 1)
            }
          }
        }
      }
    }

    swipeStartX.current = null
    swipeStartY.current = null
    isSwiping.current = false
  }, [scale, minScale, currentPage, totalPages, canvasSize, fitToScreen])

  // 마우스 클릭 (데스크톱)
  const handleClick = useCallback((e: React.MouseEvent) => {
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const containerWidth = rect.width

    const leftZone = containerWidth * 0.25
    const rightZone = containerWidth * 0.75

    if (clickX < leftZone && currentPage > 1) {
      setCurrentPage(p => p - 1)
    } else if (clickX > rightZone && currentPage < totalPages) {
      setCurrentPage(p => p + 1)
    }
  }, [currentPage, totalPages])

  // 마우스 더블클릭 (데스크톱 줌)
  const handleDoubleClick = useCallback(() => {
    if (scale > minScale + 0.1) {
      fitToScreen(canvasSize.width, canvasSize.height)
    } else {
      setScale(2.0)
    }
  }, [scale, minScale, canvasSize, fitToScreen])

  // 마우스 휠 줌
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      handleZoom(delta)
    }
  }, [handleZoom])

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

      {/* 페이지 인디케이터 */}
      {totalPages > 1 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] bg-black/50 text-white px-3 py-1 rounded-full text-sm">
          {currentPage} / {totalPages}
        </div>
      )}

      {/* 메인 컨텐츠 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden flex items-center justify-center"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        style={{ touchAction: 'none' }}
      >
        <div
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: 'transform 0.1s ease-out'
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              maxWidth: 'none',
              maxHeight: 'none'
            }}
          />
        </div>
      </div>
    </div>
  )
}
