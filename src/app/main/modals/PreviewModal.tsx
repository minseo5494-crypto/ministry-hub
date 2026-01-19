'use client'

import { X, ChevronLeft, ChevronRight, Music } from 'lucide-react'
import { Song } from '../types'

type PreviewModalProps = {
  song: Song | null
  filteredSongs: Song[]
  onClose: () => void
  onPrevious: () => void
  onNext: () => void
}

export default function PreviewModal({
  song,
  filteredSongs,
  onClose,
  onPrevious,
  onNext
}: PreviewModalProps) {
  if (!song) return null

  const currentIndex = filteredSongs.findIndex(s => s.id === song.id)

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
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-2"
            title="닫기 (ESC)"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 bg-gray-100">
          {song.file_url ? (
            song.file_type === 'pdf' ? (
              <iframe
                src={song.file_url}
                className="w-full h-full min-h-[600px] border-0"
                title={song.song_name}
              />
            ) : (
              <img
                src={song.file_url}
                alt={song.song_name}
                className="max-w-full h-auto mx-auto"
              />
            )
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

          <div className="text-sm text-gray-600">
            <kbd className="px-2 py-1 bg-white rounded border">←</kbd> 이전 |
            <kbd className="px-2 py-1 bg-white rounded border ml-2">→</kbd> 다음 |
            <kbd className="px-2 py-1 bg-white rounded border ml-2">ESC</kbd> 닫기
          </div>

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
