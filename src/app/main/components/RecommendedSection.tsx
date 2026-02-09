'use client'

import { useRef } from 'react'
import { ChevronLeft, ChevronRight, Eye, Heart, Youtube } from 'lucide-react'
import { Song } from '../types'

type RecommendedSectionProps = {
  songs: Song[]
  userName: string
  likedSongs: Set<string>
  onToggleLike: (e: React.MouseEvent, songId: string) => void
  onSongSelect: (song: Song) => void
  onYoutubeClick?: (song: Song) => void
}

export default function RecommendedSection({
  songs,
  userName,
  likedSongs,
  onToggleLike,
  onSongSelect,
  onYoutubeClick
}: RecommendedSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  if (songs.length === 0) return null

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return
    const scrollAmount = 300
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    })
  }

  const sectionTitle = userName
    ? `${userName}님의 맞춤 추천 악보`
    : '이번 주 인기 악보'

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg md:text-xl font-bold text-gray-900">
          {sectionTitle}
        </h2>
        <div className="hidden md:flex items-center gap-1">
          <button
            onClick={() => scroll('left')}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => scroll('right')}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* 가로 스크롤 */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide"
        style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
      >
        {songs.map(song => {
          const isLiked = likedSongs.has(song.id)
          return (
            <div
              key={song.id}
              className="flex-shrink-0 w-56 md:w-60 snap-start bg-white border border-gray-200 rounded-xl p-3 hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => onSongSelect(song)}
            >
              {/* 곡 정보 */}
              <h3 className="font-semibold text-gray-900 text-sm line-clamp-1 mb-0.5">
                {song.song_name}
              </h3>
              <p className="text-xs text-gray-500 line-clamp-1 mb-2">
                {song.team_name || '-'}
              </p>

              {/* Key & 템포 */}
              <div className="flex items-center gap-2 mb-3">
                {song.key && (
                  <span className="text-[10px] font-medium text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">
                    {song.key}
                  </span>
                )}
                {song.tempo && (
                  <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                    {song.tempo}
                  </span>
                )}
                {song.bpm && (
                  <span className="text-[10px] text-gray-400">
                    {song.bpm}bpm
                  </span>
                )}
              </div>

              {/* 액션 버튼 */}
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onSongSelect(song)
                  }}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                  title="보기"
                >
                  <Eye size={16} />
                </button>
                <button
                  onClick={(e) => onToggleLike(e, song.id)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isLiked
                      ? 'text-red-500 hover:bg-red-50'
                      : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                  }`}
                  title="좋아요"
                >
                  <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
                </button>
                {song.youtube_url && onYoutubeClick && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onYoutubeClick(song)
                    }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="YouTube"
                  >
                    <Youtube size={16} />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
