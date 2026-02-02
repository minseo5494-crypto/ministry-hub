'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import getStroke from 'perfect-freehand'
import { PageAnnotation, Stroke, TextElement } from '@/lib/supabase'

interface AnnotatedPreviewProps {
  fileUrl: string
  fileType: 'pdf' | 'image'
  annotations: PageAnnotation[]
  maxHeight?: number
  className?: string
}

// SVG path 생성 함수 (SheetMusicEditor와 동일)
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

export default function AnnotatedPreview({
  fileUrl,
  fileType,
  annotations,
  maxHeight = 600,
  className = '',
}: AnnotatedPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imageCanvasRef = useRef<HTMLCanvasElement>(null)
  const annotationCanvasRef = useRef<HTMLCanvasElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalPages, setTotalPages] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const renderingRef = useRef(false)
  const pdfDocRef = useRef<any>(null)

  // 스트로크 그리기 함수
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

  // 텍스트 요소 그리기
  const drawText = useCallback((ctx: CanvasRenderingContext2D, text: TextElement) => {
    ctx.font = `${text.fontSize}px sans-serif`
    ctx.fillStyle = text.color
    ctx.fillText(text.text, text.x, text.y + text.fontSize)
  }, [])

  // 어노테이션 렌더링
  const renderAnnotations = useCallback((width: number, height: number) => {
    const canvas = annotationCanvasRef.current
    if (!canvas) return

    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, width, height)

    // 현재 페이지의 어노테이션 가져오기 (pageIndex는 0부터 시작)
    const pageAnnotation = annotations[currentPage - 1]
    if (!pageAnnotation) return

    // 스트로크 그리기
    if (pageAnnotation.strokes) {
      pageAnnotation.strokes.forEach(stroke => {
        drawStroke(ctx, stroke)
      })
    }

    // 텍스트 그리기
    if (pageAnnotation.textElements) {
      pageAnnotation.textElements.forEach(text => {
        drawText(ctx, text)
      })
    }
  }, [annotations, currentPage, drawStroke, drawText])

  // 이미지 렌더링 (scaleFactor: 2 적용 - 에디터와 동일)
  const renderImage = useCallback(async () => {
    if (fileType !== 'image') return
    if (renderingRef.current) return

    const imageCanvas = imageCanvasRef.current
    if (!imageCanvas) return

    const ctx = imageCanvas.getContext('2d')
    if (!ctx) return

    renderingRef.current = true

    try {
      setLoading(true)
      setError(null)

      const img = new Image()
      img.crossOrigin = 'anonymous'

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('이미지 로드 실패'))
        img.src = fileUrl
      })

      // 에디터와 동일한 scaleFactor: 2 적용
      const scaleFactor = 2
      const canvasWidth = img.naturalWidth * scaleFactor
      const canvasHeight = img.naturalHeight * scaleFactor

      imageCanvas.width = canvasWidth
      imageCanvas.height = canvasHeight
      ctx.scale(scaleFactor, scaleFactor)
      ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight)
      ctx.setTransform(1, 0, 0, 1, 0, 0) // 스케일 리셋

      setCanvasSize({ width: canvasWidth, height: canvasHeight })
      renderAnnotations(canvasWidth, canvasHeight)
      setLoading(false)
    } catch (err: any) {
      setError(err.message || '이미지를 불러올 수 없습니다')
      setLoading(false)
    } finally {
      renderingRef.current = false
    }
  }, [fileUrl, fileType, renderAnnotations])

  // PDF 렌더링 (scale: 2 - 에디터와 동일)
  const renderPDF = useCallback(async () => {
    if (fileType !== 'pdf') return
    if (renderingRef.current) return

    const imageCanvas = imageCanvasRef.current
    if (!imageCanvas) return

    const ctx = imageCanvas.getContext('2d')
    if (!ctx) return

    renderingRef.current = true

    try {
      setLoading(true)
      setError(null)

      const pdfjsLib = (window as any).pdfjsLib
      if (!pdfjsLib) {
        // PDF.js 로드 대기
        await new Promise(resolve => setTimeout(resolve, 500))
        const pdfjsLibRetry = (window as any).pdfjsLib
        if (!pdfjsLibRetry) {
          setError('PDF 뷰어를 불러올 수 없습니다')
          setLoading(false)
          renderingRef.current = false
          return
        }
      }

      // PDF 문서 캐싱
      if (!pdfDocRef.current) {
        const loadingTask = (window as any).pdfjsLib.getDocument(fileUrl)
        pdfDocRef.current = await loadingTask.promise
        setTotalPages(pdfDocRef.current.numPages)
      }

      const pdf = pdfDocRef.current
      const page = await pdf.getPage(currentPage)
      const viewport = page.getViewport({ scale: 2 }) // 에디터와 동일한 scale: 2

      // 캔버스 크기 설정 전 이전 내용 클리어
      imageCanvas.width = viewport.width
      imageCanvas.height = viewport.height

      const renderTask = page.render({
        canvasContext: ctx,
        viewport: viewport,
      })

      await renderTask.promise

      setCanvasSize({ width: viewport.width, height: viewport.height })
      renderAnnotations(viewport.width, viewport.height)
      setError(null)
      setLoading(false)
    } catch (err: any) {
      // 취소된 렌더링은 에러로 처리하지 않음
      if (err.name !== 'RenderingCancelledException') {
        console.error('PDF render error:', err)
        setError('PDF를 불러올 수 없습니다')
      }
      setLoading(false)
    } finally {
      renderingRef.current = false
    }
  }, [fileUrl, fileType, currentPage, renderAnnotations])

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      pdfDocRef.current = null
    }
  }, [])

  // fileUrl 변경 시 캐시 초기화
  useEffect(() => {
    pdfDocRef.current = null
    setCurrentPage(1)
  }, [fileUrl])

  // 파일 로드 및 렌더링
  useEffect(() => {
    const timer = setTimeout(() => {
      if (fileType === 'image') {
        renderImage()
      } else if (fileType === 'pdf') {
        renderPDF()
      }
    }, 100) // 약간의 딜레이로 중복 렌더링 방지

    return () => clearTimeout(timer)
  }, [fileType, renderImage, renderPDF])

  // 페이지 변경 시 어노테이션 다시 렌더링
  useEffect(() => {
    if (canvasSize.width > 0 && canvasSize.height > 0) {
      renderAnnotations(canvasSize.width, canvasSize.height)
    }
  }, [currentPage, canvasSize, renderAnnotations])

  // 이전/다음 페이지
  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
      if (fileType === 'pdf') {
        renderingRef.current = false
        renderPDF()
      }
    }
  }

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
      if (fileType === 'pdf') {
        renderingRef.current = false
        renderPDF()
      }
    }
  }

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {loading && (
        <div className="flex items-center justify-center p-8 bg-gray-100 rounded-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <span className="ml-2 text-gray-600">로딩 중...</span>
        </div>
      )}

      {error && !canvasSize.width && (
        <div className="flex items-center justify-center p-8 bg-red-50 rounded-lg">
          <span className="text-red-600">{error}</span>
        </div>
      )}

      <div
        className={`relative ${loading ? 'hidden' : ''}`}
        style={{ maxHeight: `${maxHeight}px`, overflow: 'auto' }}
      >
        {/* 이미지/PDF 레이어 */}
        <canvas
          ref={imageCanvasRef}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
          }}
        />

        {/* 어노테이션 레이어 */}
        <canvas
          ref={annotationCanvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: 'auto',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* PDF 페이지 네비게이션 */}
      {fileType === 'pdf' && totalPages > 1 && !loading && (
        <div className="flex items-center justify-center gap-4 mt-2 py-2 bg-gray-100 rounded-lg">
          <button
            onClick={goToPrevPage}
            disabled={currentPage <= 1}
            className="px-3 py-1 bg-white rounded border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            ◀ 이전
          </button>
          <span className="text-sm text-gray-600">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={goToNextPage}
            disabled={currentPage >= totalPages}
            className="px-3 py-1 bg-white rounded border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            다음 ▶
          </button>
        </div>
      )}
    </div>
  )
}
