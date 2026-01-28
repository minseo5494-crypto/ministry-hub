'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, Song } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { ArrowLeft, Flame, TrendingUp, Download, Music, Calendar, ChevronDown } from 'lucide-react'

type PopularSong = {
  song: Song
  usage_count: number
  download_count: number
  rank: number
}

type TimeRange = 7 | 30

export default function ChartsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [songs, setSongs] = useState<Song[]>([])
  const [popularSongs, setPopularSongs] = useState<PopularSong[]>([])
  const [timeRange, setTimeRange] = useState<TimeRange>(7)
  const [showTimeDropdown, setShowTimeDropdown] = useState(false)

  useEffect(() => {
    loadSongs()
  }, [])

  useEffect(() => {
    if (songs.length > 0) {
      loadPopularSongs()
    }
  }, [songs, timeRange])

  const loadSongs = async () => {
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .or('is_hidden.is.null,is_hidden.eq.false')

      if (error) throw error
      setSongs(data || [])
    } catch (error) {
      console.error('Error loading songs:', error)
    }
  }

  const loadPopularSongs = async () => {
    setLoading(true)
    try {
      const daysAgo = new Date()
      daysAgo.setDate(daysAgo.getDate() - timeRange)

      // 활동 로그에서 곡 사용량 집계
      const { data: activityData } = await supabase
        .from('activity_logs')
        .select('song_id, action_type')
        .not('song_id', 'is', null)
        .gte('created_at', daysAgo.toISOString())

      const songUsageMap = new Map<string, { usage: number; downloads: number }>()

      activityData?.forEach(log => {
          if (log.song_id) {
            const existing = songUsageMap.get(log.song_id) || { usage: 0, downloads: 0 }
            existing.usage += 1
            if (log.action_type === 'ppt_download' || log.action_type === 'pdf_download') {
              existing.downloads += 1
            }
            songUsageMap.set(log.song_id, existing)
          }
        })

      // songs 배열과 매칭하여 인기곡 배열 생성
      const popularArray: PopularSong[] = []
      songUsageMap.forEach((data, songId) => {
        const song = songs.find(s => s.id === songId)
        if (song) {
          popularArray.push({
            song,
            usage_count: data.usage,
            download_count: data.downloads,
            rank: 0
          })
        }
      })

      // 사용량 순으로 정렬하고 순위 부여
      popularArray.sort((a, b) => b.usage_count - a.usage_count)
      popularArray.forEach((item, index) => {
        item.rank = index + 1
      })

      setPopularSongs(popularArray.slice(0, 20))
    } catch (error) {
      console.error('Error loading popular songs:', error)
    } finally {
      setLoading(false)
    }
  }

  const getRankStyle = (rank: number) => {
    if (rank === 1) return 'bg-yellow-400 text-yellow-900'
    if (rank === 2) return 'bg-gray-300 text-gray-700'
    if (rank === 3) return 'bg-orange-400 text-orange-900'
    return 'bg-gray-100 text-gray-600'
  }

  const getRankChange = (rank: number) => {
    // 실제로는 이전 기간과 비교해야 하지만, 여기서는 placeholder
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => router.push('/main')}
              className="p-2 hover:bg-white/20 rounded-lg transition"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Flame className="w-7 h-7" />
                많이 찾은 곡
              </h1>
              <p className="text-orange-100 text-sm mt-1">
                WORSHEEP에서 가장 많이 찾은 찬양
              </p>
            </div>
          </div>

          {/* 기간 선택 */}
          <div className="relative inline-block">
            <button
              onClick={() => setShowTimeDropdown(!showTimeDropdown)}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition"
            >
              <Calendar className="w-4 h-4" />
              <span>{timeRange === 7 ? '이번 주' : '이번 달'}</span>
              <ChevronDown className={`w-4 h-4 transition ${showTimeDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showTimeDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowTimeDropdown(false)} />
                <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-lg py-1 z-20 min-w-[120px]">
                  <button
                    onClick={() => { setTimeRange(7); setShowTimeDropdown(false) }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${timeRange === 7 ? 'text-orange-600 font-medium' : 'text-gray-700'}`}
                  >
                    이번 주 (7일)
                  </button>
                  <button
                    onClick={() => { setTimeRange(30); setShowTimeDropdown(false) }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${timeRange === 30 ? 'text-orange-600 font-medium' : 'text-gray-700'}`}
                  >
                    이번 달 (30일)
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 차트 목록 */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
              <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-full" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                    <div className="h-3 bg-gray-100 rounded w-1/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : popularSongs.length === 0 ? (
          <div className="text-center py-16">
            <Music className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600">아직 데이터가 없습니다</h3>
            <p className="text-gray-400 mt-1">곡을 사용하면 여기에 반영됩니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {popularSongs.map((item) => (
              <div
                key={item.song.id}
                className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition cursor-pointer"
                onClick={() => router.push(`/main?song=${item.song.id}`)}
              >
                <div className="flex items-center gap-4">
                  {/* 순위 */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${getRankStyle(item.rank)}`}
                  >
                    {item.rank}
                  </div>

                  {/* 곡 정보 */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {item.song.song_name}
                    </h3>
                    <p className="text-sm text-gray-500 truncate">
                      {item.song.team_name || '알 수 없음'}
                    </p>
                  </div>

                  {/* 통계 */}
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1 text-gray-500">
                      <TrendingUp className="w-4 h-4" />
                      <span>{item.usage_count}회</span>
                    </div>
                    <div className="flex items-center gap-1 text-green-600">
                      <Download className="w-4 h-4" />
                      <span>{item.download_count}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 하단 안내 */}
        {popularSongs.length > 0 && (
          <div className="mt-8 text-center text-sm text-gray-400">
            <p>최근 {timeRange}일간 콘티 추가, 다운로드 기준</p>
            <p className="mt-1">매일 업데이트됩니다</p>
          </div>
        )}
      </div>
    </div>
  )
}
