'use client'

import { Eye, Pencil, Youtube, Shield, UserPlus } from 'lucide-react'
import ResponsiveImage from '@/components/ResponsiveImage'
import { Song, ViewMode } from '../types'

type SongGridItemProps = {
  song: Song
  index: number
  isSelected: boolean
  previewState: boolean
  onSelect: () => void
  onPreviewClick: () => void
  onEditClick: () => void
  onYoutubeClick: () => void
  onDoubleClick: () => void
  onDoubleTap: () => void
}

export default function SongGridItem({
  song,
  index,
  isSelected,
  previewState,
  onSelect,
  onPreviewClick,
  onEditClick,
  onYoutubeClick,
  onDoubleClick,
  onDoubleTap
}: SongGridItemProps) {
  return (
    <div
      onClick={onSelect}
      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${isSelected
        ? 'border-blue-500 bg-blue-50'
        : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
        }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 truncate">{song.song_name}</h3>
          {song.is_official ? (
            <span className="flex-shrink-0 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full flex items-center gap-1" title="공식 악보">
              <Shield size={12} />
            </span>
          ) : song.is_user_uploaded && (
            <span className="flex-shrink-0 px-1.5 py-0.5 bg-purple-100 text-purple-600 text-xs rounded-full flex items-center gap-0.5" title="사용자 추가">
              <UserPlus size={10} />
            </span>
          )}
        </div>
        <div className="flex gap-1 ml-2">
          {song.file_url && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onPreviewClick()
                }}
                className="p-1 text-sky-500 hover:bg-sky-100 rounded"
                title="악보 보기"
              >
                <Eye size={18} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onEditClick()
                }}
                className="p-1 text-purple-500 hover:bg-purple-100 rounded"
                title="필기하기"
              >
                <Pencil size={18} />
              </button>
            </>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (song.youtube_url) {
                onYoutubeClick()
              }
            }}
            disabled={!song.youtube_url}
            className="p-1 rounded"
            style={{
              color: song.youtube_url ? '#dc2626' : '#d1d5db',
              cursor: song.youtube_url ? 'pointer' : 'not-allowed',
              opacity: song.youtube_url ? 1 : 0.5
            }}
            title={song.youtube_url ? '유튜브' : '유튜브 링크 없음'}
          >
            <Youtube size={18} />
          </button>
        </div>
      </div>

      {song.team_name && (
        <p className="text-sm text-gray-600 mb-2">{song.team_name}</p>
      )}

      {/* 미리보기 */}
      {previewState && (
        <div className="mt-3 border-t pt-3">
          {song.lyrics && (
            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans max-h-40 overflow-y-auto bg-gray-50 p-2 rounded">
              {song.lyrics}
            </pre>
          )}
          {song.file_url && (
            <ResponsiveImage
              src={song.file_url}
              alt={song.song_name}
              className="mt-2 rounded cursor-pointer"
              onDoubleClick={(e) => {
                e.stopPropagation()
                onDoubleClick()
              }}
              onTouchEnd={(e) => {
                e.stopPropagation()
                onDoubleTap()
              }}
            />
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 text-xs mt-2">
        {song.key && (
          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">
            Key: {song.key}
          </span>
        )}
        {song.time_signature && (
          <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
            {song.time_signature}
          </span>
        )}
        {song.tempo && (
          <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded">
            {song.tempo}
          </span>
        )}
      </div>
      {(song.theme1 || song.theme2) && (
        <div className="flex flex-wrap gap-1 mt-2">
          {song.theme1 && (
            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
              {song.theme1}
            </span>
          )}
          {song.theme2 && (
            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
              {song.theme2}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
