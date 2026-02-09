'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import getStroke from 'perfect-freehand'
import { PageAnnotation, Stroke, TextElement } from '@/lib/supabase'

interface SheetMusicViewerProps {
  fileUrl: string
  fileType: 'pdf' | 'image'
  songName?: string
  annotations?: PageAnnotation[]  // 필기 데이터 (선택적)
  onClose: () => void
}

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

export default function SheetMusicViewer({
  fileUrl,
  fileType,
  songName,
  annotations = [],
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
  const annotationCanvasRef = useRef<HTMLCanvasElement>(null)
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
  const touchTapHandled = useRef<boolean>(false)

  // 스트로크 그리기
  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    if (!stroke.points || stroke.points.length === 0) return

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

    if (!pathData) return

    const path = new Path2D(pathData)
    ctx.globalAlpha = stroke.opacity
    ctx.fillStyle = stroke.color
    ctx.fill(path)
    ctx.globalAlpha = 1
  }, [])

  // 텍스트 그리기
  const drawText = useCallback((ctx: CanvasRenderingContext2D, text: TextElement) => {
    ctx.font = `${text.fontSize}px sans-serif`
    ctx.fillStyle = text.color
    ctx.fillText(text.text, text.x, text.y + text.fontSize)
  }, [])

  // 어노테이션 렌더링
  const renderAnnotations = useCallback((width: number, height: number) => {
    const canvas = annotationCanvasRef.current
    if (!canvas || annotations.length === 0) return

    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, width, height)

    const pageAnnotation = annotations[currentPage - 1]
    if (!pageAnnotation) return

    if (pageAnnotation.strokes) {
      pageAnnotation.strokes.forEach(stroke => {
        drawStroke(ctx, stroke)
      })
    }

    if (pageAnnotation.textElements) {
      pageAnnotation.textElements.forEach(text => {
        drawText(ctx, text)
      })
    }
  }, [annotations, currentPage, drawStroke, drawText])

  // 화면에 맞추기
  const fitToScreen = useCallback((cWidth: number, cHeight: number) => {
    const container = containerRef.current
    if (!container || cWidth === 0 || cHeight === 0) return

    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight

    const scaleX = containerWidth / cWidth
    const scaleY = containerHeight / cHeight
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

        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel()
          } catch (e) {}
          renderTaskRef.current = null
        }

        if (!pdfDocRef.current) {
          const loadingTask = pdfjsLib.getDocument(fileUrl)
          pdfDocRef.current = await loadingTask.promise
          if (isCancelled) return
          setTotalPages(pdfDocRef.current.numPages)
        }

        const pdf = pdfDocRef.current
        const page = await pdf.getPage(currentPage)
        if (isCancelled) return

        const viewport = page.getViewport({ scale: 2 })

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

        // 어노테이션 렌더링
        renderAnnotations(viewport.width, viewport.height)

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
  }, [fileUrl, fileType, currentPage, fitToScreen, renderAnnotations])

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

      // 브라우저 캔버스 최대 크기 제한 (iOS Safari 등)
      const MAX_DIM = 16384
      const MAX_AREA = 268435456
      let scaleFactor = 2
      if (img.width * scaleFactor > MAX_DIM || img.height * scaleFactor > MAX_DIM) {
        scaleFactor = Math.min(MAX_DIM / img.width, MAX_DIM / img.height, 2)
      }
      if (img.width * scaleFactor * img.height * scaleFactor > MAX_AREA) {
        scaleFactor = Math.min(Math.sqrt(MAX_AREA / (img.width * img.height)), scaleFactor)
      }
      scaleFactor = Math.max(1, scaleFactor)

      canvas.width = img.width * scaleFactor
      canvas.height = img.height * scaleFactor
      context.scale(scaleFactor, scaleFactor)
      context.drawImage(img, 0, 0)

      setCanvasSize({ width: canvas.width, height: canvas.height })
      setTotalPages(1)

      // 어노테이션 렌더링
      renderAnnotations(canvas.width, canvas.height)

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
  }, [fileUrl, fileType, fitToScreen, renderAnnotations])

  // 페이지 변경 시 초기화
  useEffect(() => {
    hasInitializedScale.current = false
  }, [currentPage])

  // 페이지 변경 시 어노테이션 다시 렌더링
  useEffect(() => {
    if (canvasSize.width > 0 && canvasSize.height > 0) {
      renderAnnotations(canvasSize.width, canvasSize.height)
    }
  }, [currentPage, canvasSize, renderAnnotations])

  // 줌 핸들러
  const handleZoom = useCallback((delta: number) => {
    setScale(prev => Math.max(minScale, Math.min(4, prev + delta)))
  }, [minScale])

  // 터치 시작
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
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

      const isSwipe = Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50

      if (isSwipe && scale <= minScale + 0.01) {
        if (deltaX > 0 && currentPage > 1) {
          setCurrentPage(p => p - 1)
        } else if (deltaX < 0 && currentPage < totalPages) {
          setCurrentPage(p => p + 1)
        }
      } else if (Math.abs(deltaX) < 15 && Math.abs(deltaY) < 15) {
        const now = Date.now()
        const tapDistance = Math.sqrt(
          Math.pow(endX - lastTapX.current, 2) +
          Math.pow(endY - lastTapY.current, 2)
        )

        if (now - lastTapTime.current < 300 && tapDistance < 50) {
          if (scale > minScale + 0.1) {
            fitToScreen(canvasSize.width, canvasSize.height)
          } else {
            setScale(2.0)
          }
          lastTapTime.current = 0
        } else {
          lastTapTime.current = now
          lastTapX.current = endX
          lastTapY.current = endY

          const container = containerRef.current
          if (container) {
            const rect = container.getBoundingClientRect()
            const tapX = endX - rect.left
            const containerWidth = rect.width

            const leftZone = containerWidth * 0.25
            const rightZone = containerWidth * 0.75

            touchTapHandled.current = true

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

  // 마우스 클릭
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (touchTapHandled.current) {
      touchTapHandled.current = false
      return
    }

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

  // 마우스 더블클릭
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

      {/* 필기 표시 안내 */}
      {annotations.length > 0 && (
        <div className="fixed top-4 left-4 z-[60] bg-amber-500/80 text-white px-3 py-1 rounded-full text-sm">
          내 필기 포함
        </div>
      )}

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
            transition: 'transform 0.1s ease-out',
            position: 'relative'
          }}
        >
          {/* 악보 캔버스 */}
          <canvas
            ref={canvasRef}
            style={{
              maxWidth: 'none',
              maxHeight: 'none'
            }}
          />
          {/* 어노테이션 캔버스 */}
          <canvas
            ref={annotationCanvasRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              maxWidth: 'none',
              maxHeight: 'none',
              pointerEvents: 'none'
            }}
          />
        </div>
      </div>
    </div>
  )
}
