'use client'

import { useState } from 'react'

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
  const [imageError, setImageError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  return (
    <div
      className={`${className}`}
      style={{
        width: '100%',
        overflow: 'visible',
        minHeight: 0
      }}
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
        src={src}
        alt={alt}
        loading="eager"
        decoding="async"
        onLoad={() => setImageLoaded(true)}
        onError={() => setImageError(true)}
        style={{
          display: imageLoaded ? 'block' : 'none',
          width: '100%',
          maxWidth: '100%',
          height: 'auto',
          minHeight: 0,
          flexShrink: 0
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
