'use client'

import { useRef, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight, Music, Maximize2 } from 'lucide-react'
import { Song } from '../types'

type PreviewModalProps = {
  song: Song | null
  filteredSongs: Song[]
  onClose: () => void
  onPrevious: () => void
  onNext: () => void
  onOpenFullScreen?: (song: Song) => void
}

export default function PreviewModal({
  song,
  filteredSongs,
  onClose,
  onPrevious,
  onNext,
  onOpenFullScreen
}: PreviewModalProps) {
  const lastTapRef = useRef<number>(0)

  // 모바일 더블탭 감지 (touchEnd 기반)
  const handleTouchEnd = useCallback(() => {
    if (!song || !onOpenFullScreen) return
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      onOpenFullScreen(song)
      lastTapRef.current = 0
    } else {
      lastTapRef.current = now
    }
  }, [song, onOpenFullScreen])

  // 데스크톱 더블클릭
  const handleDoubleClick = useCallback(() => {
    if (!song || !onOpenFullScreen) return
    onOpenFullScreen(song)
  }, [song, onOpenFullScreen])

  if (!song) return null

  const currentIndex = filteredSongs.findIndex(s => s.id === song.id)
  const hasFullScreen = !!onOpenFullScreen && !!song.file_url

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{song.song_name}</h2>
            <p className="text-sm text-gray-600">
              {song.team_name} | Key: {song.key || '-'}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {hasFullScreen && (
              <button
                onClick={() => onOpenFullScreen!(song)}
                className="text-gray-500 hover:text-violet-600 p-2 rounded-lg hover:bg-violet-50 transition-colors"
                title="전체화면 보기"
              >
                <Maximize2 size={20} />
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 p-2"
              title="닫기 (ESC)"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-gray-100 relative">
          {song.file_url ? (
            <>
              {/* 더블클릭/더블탭 감지 오버레이 (전체화면 기능 있을 때만) */}
              {hasFullScreen && (
                <div
                  className="absolute inset-0 z-10 cursor-pointer"
                  onDoubleClick={handleDoubleClick}
                  onTouchEnd={handleTouchEnd}
                />
              )}
              <div className="p-4">
                {song.file_type === 'pdf' ? (
                  <iframe
                    src={`${song.file_url}#toolbar=0`}
                    className="w-full h-full min-h-[600px] border-0"
                    title={song.song_name}
                  />
                ) : (
                  <img
                    src={song.file_url}
                    alt={song.song_name}
                    className="max-w-full h-auto mx-auto"
                  />
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Music size={48} className="mx-auto mb-4 text-gray-300" />
              <p>악보가 없습니다.</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <button
            onClick={onPrevious}
            disabled={currentIndex === 0}
            className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={20} className="mr-1" />
            이전 곡
          </button>

          {hasFullScreen ? (
            <p className="text-xs text-gray-400">더블클릭으로 전체화면</p>
          ) : (
            <div className="text-sm text-gray-600 hidden md:block">
              <kbd className="px-2 py-1 bg-white rounded border">←</kbd> 이전 |
              <kbd className="px-2 py-1 bg-white rounded border ml-2">→</kbd> 다음 |
              <kbd className="px-2 py-1 bg-white rounded border ml-2">ESC</kbd> 닫기
            </div>
          )}

          <button
            onClick={onNext}
            disabled={currentIndex === filteredSongs.length - 1}
            className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            다음 곡
            <ChevronRight size={20} className="ml-1" />
          </button>
        </div>
      </div>
    </div>
  )
}
