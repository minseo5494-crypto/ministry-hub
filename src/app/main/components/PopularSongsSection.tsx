'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Flame, ChevronDown, ChevronUp, TrendingUp, ChevronRight } from 'lucide-react'
import { Song } from '@/lib/supabase'

type PopularSong = {
  song: Song
  usage_count: number
  download_count: number
}

type Props = {
  popularSongs: PopularSong[]
  loading: boolean
  onSongClick: (song: Song) => void
  selectedSongIds: string[]
}

export default function PopularSongsSection({
  popularSongs,
  loading,
  onSongClick,
  selectedSongIds
}: Props) {
  const router = useRouter()
  const [isExpanded, setIsExpanded] = useState(true)

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-5 h-5 text-orange-500" />
            <span className="font-semibold text-gray-800">이번 주 많이 찾은 곡</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex-shrink-0 w-40 h-20 bg-white/50 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  const isEmpty = popularSongs.length === 0

  return (
    <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
      <div className="max-w-7xl mx-auto px-4 py-3">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2"
          >
            <Flame className="w-5 h-5 text-orange-500" />
            <span className="font-semibold text-gray-800">이번 주 많이 찾은 곡</span>
            <span className="text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
              TOP 5
            </span>
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>

          <button
            onClick={() => router.push('/charts')}
            className="flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 font-medium transition"
          >
            전체 보기
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 인기곡 목록 */}
        {isExpanded && isEmpty && (
          <div className="py-4 text-center text-gray-500 text-sm">
            아직 이번 주 데이터가 없습니다. 곡을 사용하면 여기에 표시됩니다!
          </div>
        )}
        {isExpanded && !isEmpty && (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {popularSongs.slice(0, 5).map((item, index) => {
              const isSelected = selectedSongIds.includes(item.song.id)
              return (
                <button
                  key={item.song.id}
                  onClick={() => onSongClick(item.song)}
                  className={`flex-shrink-0 w-44 p-3 rounded-xl transition-all ${
                    isSelected
                      ? 'bg-[#84B9C0] text-white shadow-md'
                      : 'bg-white hover:bg-white/80 shadow-sm hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {/* 순위 */}
                    <div
                      className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0
                          ? 'bg-yellow-400 text-yellow-900'
                          : index === 1
                            ? 'bg-gray-300 text-gray-700'
                            : index === 2
                              ? 'bg-orange-400 text-orange-900'
                              : isSelected
                                ? 'bg-white/20 text-white'
                                : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {index + 1}
                    </div>
                    {/* 곡 정보 */}
                    <div className="flex-1 min-w-0 text-left">
                      <p
                        className={`font-medium text-sm truncate ${
                          isSelected ? 'text-white' : 'text-gray-900'
                        }`}
                      >
                        {item.song.song_name}
                      </p>
                      <p
                        className={`text-xs truncate ${
                          isSelected ? 'text-white/80' : 'text-gray-500'
                        }`}
                      >
                        {item.song.team_name || '알 수 없음'}
                      </p>
                      <div
                        className={`flex items-center gap-2 mt-1 text-xs ${
                          isSelected ? 'text-white/70' : 'text-gray-400'
                        }`}
                      >
                        <span className="flex items-center gap-0.5">
                          <TrendingUp className="w-3 h-3" />
                          {item.usage_count}회
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
