'use client'

import { X, Youtube } from 'lucide-react'
import { Song } from '../types'

type YoutubeModalProps = {
  song: Song | null
  getYoutubeEmbedUrl: (url: string) => string | null
  onClose: () => void
}

export default function YoutubeModal({
  song,
  getYoutubeEmbedUrl,
  onClose
}: YoutubeModalProps) {
  if (!song) return null

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
            title="닫기"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 bg-gray-100">
          {getYoutubeEmbedUrl(song.youtube_url || '') ? (
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
              <iframe
                src={getYoutubeEmbedUrl(song.youtube_url || '') || ''}
                className="absolute top-0 left-0 w-full h-full rounded-lg"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Youtube size={48} className="mx-auto mb-4 text-gray-300" />
              <p>유효하지 않은 유튜브 링크입니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
