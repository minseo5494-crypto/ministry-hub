'use client'

import { X } from 'lucide-react'
import { Song } from '../types'

type LyricsModalProps = {
  isOpen: boolean
  song: Song | null
  lyricsText: string
  onClose: () => void
}

export default function LyricsModal({
  isOpen,
  song,
  lyricsText,
  onClose
}: LyricsModalProps) {
  if (!isOpen || !song) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900">가사</h2>
            <p className="text-sm text-gray-600">{song.song_name} - {song.team_name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-2"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="w-full h-[400px] p-4 border border-gray-200 rounded-lg bg-gray-50 overflow-auto font-mono text-sm whitespace-pre-wrap">
            {lyricsText || '가사가 없습니다.'}
          </div>
        </div>

        <div className="flex items-center justify-end p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
