'use client'

import { Heart, MessageCircle, Copy, Bookmark } from 'lucide-react'
import type { SharedSetlist } from '@/types/community'

type CommunitySetlistCardProps = {
  setlist: SharedSetlist
  onClick: () => void
}

export default function CommunitySetlistCard({ setlist, onClick }: CommunitySetlistCardProps) {
  const previewSongs = setlist.songs.slice(0, 3)
  const remainingSongs = setlist.songs.length - 3

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
  }

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-violet-200 transition-all duration-200 p-5 group"
      style={{ touchAction: 'manipulation' }}
    >
      {/* 헤더: 제목 + 날짜 */}
      <div className="mb-3">
        <h3 className="font-semibold text-gray-900 text-base group-hover:text-violet-700 transition-colors line-clamp-1">
          {setlist.title}
        </h3>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-sm text-gray-600">{setlist.author_name} 님</span>
          {setlist.author_church && (
            <>
              <span className="text-gray-300">·</span>
              <span className="text-sm text-gray-500">{setlist.author_church}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs text-gray-400">{formatDate(setlist.created_at)}</span>
          {setlist.service_type && (
            <>
              <span className="text-gray-300">·</span>
              <span className="text-xs text-gray-400">{setlist.service_type}</span>
            </>
          )}
        </div>
      </div>

      {/* 곡 목록 미리보기 */}
      {setlist.songs.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {previewSongs.map((song, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <span className="text-xs text-gray-400 w-4 shrink-0 mt-0.5">{idx + 1}.</span>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-gray-700 font-medium">{song.song_title}</span>
                {song.key && (
                  <span className="ml-1.5 text-xs text-gray-400">({song.key})</span>
                )}
                {song.selected_form.length > 0 && (
                  <span className="ml-1.5 text-xs text-violet-500">
                    {song.selected_form.join(' → ')}
                  </span>
                )}
              </div>
            </div>
          ))}
          {remainingSongs > 0 && (
            <p className="text-xs text-gray-400 pl-6">+{remainingSongs}곡 더보기</p>
          )}
        </div>
      )}

      {/* 태그 */}
      {setlist.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {setlist.tags.slice(0, 4).map((tag, idx) => (
            <span
              key={idx}
              className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-100"
            >
              #{tag}
            </span>
          ))}
          {setlist.tags.length > 4 && (
            <span className="text-xs text-gray-400">+{setlist.tags.length - 4}</span>
          )}
        </div>
      )}

      {/* 통계 */}
      <div className="flex items-center gap-4 pt-2 border-t border-gray-50">
        <span className="flex items-center gap-1 text-sm text-gray-500">
          <Heart size={14} className={setlist.is_liked ? 'fill-red-500 text-red-500' : ''} />
          <span>{setlist.like_count}</span>
        </span>
        <span className="flex items-center gap-1 text-sm text-gray-500">
          <MessageCircle size={14} />
          <span>{setlist.comment_count}</span>
        </span>
        <span className="flex items-center gap-1 text-sm text-gray-500">
          <Copy size={14} />
          <span>{setlist.copy_count}</span>
        </span>
        {setlist.is_bookmarked && (
          <span className="flex items-center gap-1 text-sm text-violet-500 ml-auto">
            <Bookmark size={14} className="fill-violet-500" />
          </span>
        )}
      </div>
    </button>
  )
}
