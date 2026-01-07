'use client'

interface ResponsiveImageProps {
  src: string
  alt: string
  className?: string
  maxHeight?: string
  onDoubleClick?: (e: React.MouseEvent) => void
  onTouchEnd?: (e: React.TouchEvent) => void
}

export default function ResponsiveImage({
  src,
  alt,
  className = '',
  maxHeight = '400px',
  onDoubleClick,
  onTouchEnd
}: ResponsiveImageProps) {
  return (
    <div
      className={`w-full ${className}`}
      style={{
        maxHeight,
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch'
      }}
      onDoubleClick={onDoubleClick}
      onTouchEnd={onTouchEnd}
    >
      <img
        src={src}
        alt={alt}
        style={{
          width: '100%',
          height: 'auto',
          display: 'block'
        }}
      />
    </div>
  )
}
