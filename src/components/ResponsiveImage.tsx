'use client'

import { useState, useRef, useEffect } from 'react'

interface ResponsiveImageProps {
  src: string
  alt: string
  className?: string
  onDoubleClick?: (e: React.MouseEvent) => void
  onTouchEnd?: (e: React.TouchEvent) => void
}

// Supabase Storage URL에 리사이즈 파라미터 추가
function getResizedImageUrl(src: string, width: number): string {
  // Supabase Storage URL인지 확인
  if (src.includes('supabase.co/storage')) {
    // 이미 transform 파라미터가 있으면 그대로 반환
    if (src.includes('/render/image') || src.includes('?width=')) {
      return src
    }
    // /object/public/ 을 /render/image/public/ 으로 변경하고 리사이즈 파라미터 추가
    const resizedUrl = src.replace('/object/public/', '/render/image/public/')
    return `${resizedUrl}?width=${width}&resize=contain`
  }
  return src
}

export default function ResponsiveImage({
  src,
  alt,
  className = '',
  onDoubleClick,
  onTouchEnd
}: ResponsiveImageProps) {
  const [imageError, setImageError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [pixelWidth, setPixelWidth] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const calculateWidth = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        // 모바일 화면에 맞게 최대 800px로 제한
        setPixelWidth(Math.min(Math.floor(rect.width), 800))
      }
    }

    calculateWidth()
    window.addEventListener('resize', calculateWidth)
    window.addEventListener('orientationchange', calculateWidth)

    // 약간의 딜레이 후 다시 계산 (iOS Safari 대응)
    setTimeout(calculateWidth, 100)
    setTimeout(calculateWidth, 500)

    return () => {
      window.removeEventListener('resize', calculateWidth)
      window.removeEventListener('orientationchange', calculateWidth)
    }
  }, [])

  // 리사이즈된 이미지 URL
  const imageSrc = pixelWidth ? getResizedImageUrl(src, pixelWidth * 2) : src

  return (
    <div
      ref={containerRef}
      className={`${className}`}
      style={{ width: '100%' }}
      onDoubleClick={onDoubleClick}
      onTouchEnd={onTouchEnd}
    >
      {!imageLoaded && !imageError && (
        <div
          style={{
            width: '100%',
            paddingTop: '141%',
            backgroundColor: '#f0f0f0',
            borderRadius: '8px'
          }}
        />
      )}
      <img
        src={imageSrc}
        alt={alt}
        loading="eager"
        decoding="async"
        onLoad={() => setImageLoaded(true)}
        onError={() => setImageError(true)}
        style={{
          display: imageLoaded ? 'block' : 'none',
          width: pixelWidth ? `${pixelWidth}px` : '100%',
          height: 'auto'
        }}
      />
      {imageError && (
        <div
          style={{
            width: '100%',
            padding: '20px',
            backgroundColor: '#fee',
            borderRadius: '8px',
            textAlign: 'center',
            color: '#c00'
          }}
        >
          이미지를 불러올 수 없습니다
        </div>
      )}
    </div>
  )
}
