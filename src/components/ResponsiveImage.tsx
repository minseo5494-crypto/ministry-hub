'use client'

import { useRef, useEffect, useState } from 'react'

interface ResponsiveImageProps {
  src: string
  alt: string
  className?: string
  onDoubleClick?: (e: React.MouseEvent) => void
  onTouchEnd?: (e: React.TouchEvent) => void
}

export default function ResponsiveImage({
  src,
  alt,
  className = '',
  onDoubleClick,
  onTouchEnd
}: ResponsiveImageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState<number>(0)

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth)
      }
    }

    // 초기 너비 설정
    updateWidth()

    // ResizeObserver로 컨테이너 크기 변화 감지
    const resizeObserver = new ResizeObserver(updateWidth)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    // 화면 회전/리사이즈 대응
    window.addEventListener('resize', updateWidth)
    window.addEventListener('orientationchange', updateWidth)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateWidth)
      window.removeEventListener('orientationchange', updateWidth)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={`w-full overflow-hidden ${className}`}
      onDoubleClick={onDoubleClick}
      onTouchEnd={onTouchEnd}
    >
      {containerWidth > 0 && (
        <img
          src={src}
          alt={alt}
          style={{
            width: `${containerWidth}px`,
            height: 'auto',
            display: 'block'
          }}
        />
      )}
    </div>
  )
}
