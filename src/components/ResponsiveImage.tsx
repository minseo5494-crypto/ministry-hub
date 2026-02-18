'use client'

import { useState, useEffect } from 'react'

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
  const [aspectRatio, setAspectRatio] = useState<number | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    // 이미지 실제 비율 계산
    const img = new Image()
    img.onload = () => {
      setAspectRatio(img.height / img.width)
    }
    img.onerror = () => {
      setError(true)
    }
    img.src = src
  }, [src])

  if (error) {
    return (
      <div
        className={className}
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
    )
  }

  // 비율이 계산되기 전 로딩 상태
  if (!aspectRatio) {
    return (
      <div
        className={className}
        style={{
          width: '100%',
          paddingTop: '141%',
          backgroundColor: '#f0f0f0',
          borderRadius: '8px'
        }}
      />
    )
  }

  // CSS background-image 사용 (iOS Safari 호환성)
  return (
    <div
      className={className}
      onDoubleClick={onDoubleClick}
      onTouchEnd={onTouchEnd}
      style={{
        width: '100%',
        paddingTop: `${aspectRatio * 100}%`,
        backgroundImage: `url(${src})`,
        backgroundSize: 'contain',
        backgroundPosition: 'center top',
        backgroundRepeat: 'no-repeat',
        borderRadius: '8px'
      }}
      role="img"
      aria-label={alt}
    />
  )
}
