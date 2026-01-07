'use client'

import { useState } from 'react'
import { X, Share, ChevronLeft, ChevronRight } from 'lucide-react'

interface ImagePreviewModalProps {
  images: { url: string; filename: string }[]
  onClose: () => void
  onSave: (index: number) => void
}

export default function ImagePreviewModal({
  images,
  onClose,
  onSave
}: ImagePreviewModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  if (images.length === 0) return null

  const currentImage = images[currentIndex]
  const hasMultiple = images.length > 1

  const goNext = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length)
  }

  const goPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex flex-col z-[100]">
      {/* 헤더 */}
      <div className="flex items-center justify-between p-4 bg-black">
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/20 rounded-full"
          style={{ color: '#FFFFFF' }}
        >
          <X size={24} strokeWidth={2.5} />
        </button>
        <span
          className="font-semibold text-base"
          style={{ color: '#FFFFFF' }}
        >
          {hasMultiple ? `${currentIndex + 1} / ${images.length}` : currentImage.filename}
        </span>
        <div className="w-10" /> {/* 균형을 위한 빈 공간 */}
      </div>

      {/* 이미지 영역 */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {/* 이전 버튼 */}
        {hasMultiple && (
          <button
            onClick={goPrev}
            className="absolute left-2 z-10 p-3 bg-black/50 text-white rounded-full hover:bg-black/70"
          >
            <ChevronLeft size={28} />
          </button>
        )}

        {/* 이미지 */}
        <img
          src={currentImage.url}
          alt={currentImage.filename}
          className="max-w-full max-h-full object-contain"
          style={{ touchAction: 'pinch-zoom' }}
        />

        {/* 다음 버튼 */}
        {hasMultiple && (
          <button
            onClick={goNext}
            className="absolute right-2 z-10 p-3 bg-black/50 text-white rounded-full hover:bg-black/70"
          >
            <ChevronRight size={28} />
          </button>
        )}
      </div>

      {/* 파일명 */}
      {hasMultiple && (
        <div className="text-center py-2 text-white text-sm bg-black/50">
          {currentImage.filename}
        </div>
      )}

      {/* 하단 버튼 */}
      <div className="p-4 bg-black flex justify-center">
        <button
          onClick={() => onSave(currentIndex)}
          className="flex items-center gap-2 px-8 py-3 rounded-xl font-medium active:scale-95 transition"
          style={{
            color: '#FFFFFF',
            border: '2px solid #FFFFFF',
            backgroundColor: 'transparent'
          }}
        >
          <Share size={20} />
          저장 / 공유
        </button>
      </div>

      {/* 페이지 인디케이터 */}
      {hasMultiple && (
        <div className="pb-4 flex justify-center gap-1.5 bg-black bg-opacity-50">
          {images.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`w-2 h-2 rounded-full transition ${
                idx === currentIndex ? 'bg-white' : 'bg-white/40'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
