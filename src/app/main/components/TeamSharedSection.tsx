'use client'

import { useRef } from 'react'
import { ChevronLeft, ChevronRight, Music, Calendar } from 'lucide-react'
import { TeamSetlistCard } from '../types'

type TeamSharedSectionProps = {
  setlists: TeamSetlistCard[]
  loading: boolean
  onSetlistClick: (setlistId: string, teamId: string) => void
}

export default function TeamSharedSection({ setlists, loading, onSetlistClick }: TeamSharedSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-4">
          우리 팀 최근 콘티
        </h2>
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex-shrink-0 w-64 h-36 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (setlists.length === 0) return null

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return
    const scrollAmount = 280
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    })
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg md:text-xl font-bold text-gray-900">
          우리 팀 최근 콘티
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

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide"
        style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
      >
        {setlists.map(setlist => (
          <button
            key={setlist.id}
            onClick={() => onSetlistClick(setlist.id, setlist.team_id)}
            className="flex-shrink-0 w-64 md:w-72 snap-start text-left group"
          >
            <div className="relative bg-violet-300 rounded-xl p-4 h-36 flex flex-col justify-between
              shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
              {/* 팀명 배지 */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium bg-white/30 px-2 py-0.5 rounded-full truncate max-w-[140px]"
                  style={{ color: '#374151' }}>
                  {setlist.team_name}
                </span>
                <div className="flex items-center gap-1 text-xs" style={{ color: '#4B5563' }}>
                  <Calendar size={12} />
                  <span>{formatDate(setlist.service_date)}</span>
                </div>
              </div>

              {/* 제목 */}
              <div>
                <h3 className="font-semibold text-sm md:text-base line-clamp-2 mb-1"
                  style={{ color: '#111827' }}>
                  {setlist.title}
                </h3>
                <span className="text-xs" style={{ color: '#4B5563' }}>{setlist.service_type}</span>
              </div>

              {/* 하단 정보 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-xs" style={{ color: '#374151' }}>
                  <Music size={12} />
                  <span>{setlist.song_count}곡</span>
                </div>
                {setlist.songs.length > 0 && (
                  <span className="text-xs truncate max-w-[120px]" style={{ color: '#4B5563' }}>
                    {setlist.songs[0].song_name}{setlist.songs.length > 1 ? ` 외 ${setlist.songs.length - 1}곡` : ''}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
