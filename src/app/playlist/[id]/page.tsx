'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Music, ChevronLeft, ChevronRight } from 'lucide-react'

interface Song {
  id: string
  song_name: string
  team_name?: string
  youtube_url?: string
  key?: string
}

interface SetlistSong {
  id: string
  order_number: number
  selected_form?: string[]
  songs: Song
}

interface SetlistInfo {
  id: string
  title: string
  service_date: string
  service_type?: string
}

export default function PlaylistPage() {
  const params = useParams()
  const playlistId = params.id as string
  
  const [songs, setSongs] = useState<SetlistSong[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [setlistInfo, setSetlistInfo] = useState<SetlistInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const playerRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    fetchPlaylist()
  }, [playlistId])

  const fetchPlaylist = async () => {
    try {
      // 콘티 정보
      const { data: setlist, error: setlistError } = await supabase
        .from('team_setlists')
        .select('*')
        .eq('id', playlistId)
        .single()

      if (setlistError) throw setlistError
      setSetlistInfo(setlist)

      // 곡 목록 (송폼 정보 포함) - 모든 곡 가져오기
    const { data: setlistSongs, error: songsError } = await supabase
      .from('team_setlist_songs')
      .select(`
        id,
        order_number,
        selected_form,
        songs (*)
      `)
      .eq('setlist_id', playlistId)
      .order('order_number')

    if (songsError) throw songsError

    // 🎵 필터링 제거 - 모든 곡 표시
    const allSongs: SetlistSong[] = (setlistSongs || [])
      .map((item: any) => ({
        id: item.id,
        order_number: item.order_number,
        selected_form: item.selected_form,
        songs: item.songs
      }))

    console.log('📊 전체 곡:', allSongs.length)
    const songsWithYoutube = allSongs.filter(s => s.songs.youtube_url && s.songs.youtube_url.trim() !== '')
    console.log('🎵 유튜브 있는 곡:', songsWithYoutube.length)

    setSongs(allSongs)  // 모든 곡 설정
  } catch (error) {
    console.error('Error fetching playlist:', error)
    alert('플레이리스트를 불러오는데 실패했습니다.')
  } finally {
    setLoading(false)
  }
}

  // YouTube 비디오 ID 추출
  const getVideoId = (url: string): string | null => {
    if (!url) return null
    const patterns = [
      /youtube\.com\/watch\?v=([^&]+)/,
      /youtu\.be\/([^?]+)/,
      /youtube\.com\/embed\/([^?]+)/
    ]
    
    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) return match[1]
    }
    return null
  }

  // 103-105번째 줄 - 이전 곡 버튼 수정 (유튜브 없는 곡 건너뛰기)
const handlePrevious = () => {
  let prevIndex = currentIndex - 1
  while (prevIndex >= 0) {
    if (songs[prevIndex].songs.youtube_url) {
      setCurrentIndex(prevIndex)
      break
    }
    prevIndex--
  }
}

  // 109-111번째 줄 - 다음 곡 버튼 수정 (유튜브 없는 곡 건너뛰기)
const handleNext = () => {
  let nextIndex = currentIndex + 1
  while (nextIndex < songs.length) {
    if (songs[nextIndex].songs.youtube_url) {
      setCurrentIndex(nextIndex)
      break
    }
    nextIndex++
  }
}

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-700">로딩 중...</p>
        </div>
      </div>
    )
  }

  if (songs.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <Music className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-xl text-gray-700 mb-2">유튜브 링크가 있는 곡이 없습니다</p>
          <p className="text-gray-500">콘티에 유튜브 링크를 추가해주세요.</p>
        </div>
      </div>
    )
  }

  const currentSong = songs[currentIndex]
  const currentVideoId = getVideoId(currentSong.songs.youtube_url || '')

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-5xl mx-auto p-4 md:p-6">
          <h1 className="text-xl md:text-2xl font-bold text-gray-800 mb-2">{setlistInfo?.title}</h1>
          <p className="text-sm md:text-base text-gray-600">
            {setlistInfo?.service_date && new Date(setlistInfo.service_date).toLocaleDateString('ko-KR')}
            {setlistInfo?.service_type && ` • ${setlistInfo.service_type}`}
            {` • ${songs.length}곡`}
          </p>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="max-w-5xl mx-auto p-4">
        {/* 비디오 플레이어 */}
        <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-2xl mb-6">
  {currentSong.songs.youtube_url ? (
    currentVideoId ? (
      <iframe
        ref={playerRef}
        key={currentVideoId}
        width="100%"
        height="100%"
        src={`https://www.youtube.com/embed/${currentVideoId}?autoplay=1&mute=1&rel=0&modestbranding=1`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="w-full h-full"
      />
    ) : (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-gray-400">비디오를 로드할 수 없습니다</p>
      </div>
    )
  ) : (
    <div className="w-full h-full flex items-center justify-center bg-gray-900">
      <div className="text-center">
        <Music className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-400 text-xl">유튜브 링크가 없습니다</p>
        <p className="text-gray-500 text-sm mt-2">이 곡은 유튜브 영상이 등록되지 않았습니다</p>
      </div>
    </div>
  )}
</div>

        {/* 현재 재생 중 */}
        <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 mb-6 border border-gray-200">
          <div className="mb-4">
            <p className="text-xs md:text-sm text-gray-500 mb-1">
              {currentIndex + 1} / {songs.length}
            </p>
            <h2 className="text-lg md:text-2xl font-bold text-gray-800 mb-1">
              {currentSong.songs.song_name}
            </h2>
            <p className="text-sm md:text-base text-gray-600 mb-2">
              {currentSong.songs.team_name}
              {currentSong.songs.key && ` • Key: ${currentSong.songs.key}`}
            </p>
            
            {/* 🎵 송폼 정보 표시 */}
            {currentSong.selected_form && currentSong.selected_form.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-600 font-medium">송폼:</span>
                {currentSong.selected_form.map((form, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-md"
                  >
                    {form}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 이전/다음 버튼 */}
          <div className="flex gap-2">
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={20} className="mr-1" />
              이전 곡
            </button>
            <button
              onClick={handleNext}
              disabled={currentIndex === songs.length - 1}
              className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              다음 곡
              <ChevronRight size={20} className="ml-1" />
            </button>
          </div>
        </div>

        {/* 곡 목록 */}
        <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4">전체 곡 목록</h3>
          <div className="space-y-2">
            {songs.map((song, index) => (
  <button
    key={song.id}
    onClick={() => {
      if (song.songs.youtube_url) {
        setCurrentIndex(index)
      } else {
        alert('이 곡은 유튜브 링크가 없습니다.')
      }
    }}
    className={`w-full p-3 md:p-4 rounded-lg text-left transition-all ${
      index === currentIndex
        ? 'bg-blue-100 border-2 border-blue-400 shadow-md'
        : !song.songs.youtube_url
        ? 'bg-gray-100 opacity-60 border border-gray-300'  // 유튜브 없는 곡 스타일
        : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
    }`}
  >
    <div className="flex items-start">
      <span className={`text-base md:text-lg font-bold w-8 md:w-10 mt-0.5 ${
        index === currentIndex ? 'text-blue-600' : 
        !song.songs.youtube_url ? 'text-gray-400' : 'text-gray-600'
      }`}>
        {index + 1}.
      </span>
      <div className="flex-1 min-w-0">
        <p className={`font-semibold truncate ${
          index === currentIndex ? 'text-blue-900' : 
          !song.songs.youtube_url ? 'text-gray-500' : 'text-gray-800'
        }`}>
          {song.songs.song_name}
          {!song.songs.youtube_url && ' (영상 없음)'}
        </p>
        {/* 나머지 내용 동일... */}
      </div>
    </div>
  </button>
))}
          </div>
        </div>
      </div>
    </div>
  )
}