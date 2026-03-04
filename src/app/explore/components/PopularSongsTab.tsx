'use client'

import { useRouter } from 'next/navigation'
import { Loader2, TrendingUp, Heart, Youtube, Eye, EyeOff } from 'lucide-react'
import { useWeeklyPopular } from '@/hooks/useWeeklyPopular'
import { useState, useRef, useCallback } from 'react'
import type { Song } from '@/lib/supabase'
import ResponsiveImage from '@/components/ResponsiveImage'
import SheetMusicViewer from '@/components/SheetMusicViewer'

export default function PopularSongsTab() {
  const router = useRouter()
  const { songs, likedSongs, loading, toggleLike } = useWeeklyPopular()
  // 인라인 미리보기 상태
  const [previewStates, setPreviewStates] = useState<Record<string, boolean>>({})
  // 유튜브 토글 상태
  const [youtubeStates, setYoutubeStates] = useState<Record<string, boolean>>({})
  // 전체화면 뷰어
  const [viewerSong, setViewerSong] = useState<Song | null>(null)

  // 더블탭 감지용
  const lastTapTimeRef = useRef(0)
  const lastTapSongIdRef = useRef<string | null>(null)

  const togglePreview = useCallback((songId: string) => {
    setPreviewStates(prev => ({ ...prev, [songId]: !prev[songId] }))
  }, [])

  const toggleYoutube = useCallback((songId: string) => {
    setYoutubeStates(prev => ({ ...prev, [songId]: !prev[songId] }))
  }, [])

  const getYoutubeEmbedUrl = (url: string) => {
    if (!url) return null
    const watchMatch = url.match(/[?&]v=([^&]+)/)
    if (watchMatch) return `https://www.youtube.com/embed/${watchMatch[1]}`
    const shortMatch = url.match(/youtu\.be\/([^?]+)/)
    if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}`
    if (url.includes('/embed/')) return url
    return null
  }

  const openSimpleViewer = useCallback((song: Song) => {
    if (song.file_url) setViewerSong(song)
  }, [])

  const handleDoubleTap = useCallback((song: Song) => {
    const now = Date.now()
    const DOUBLE_TAP_DELAY = 300
    if (lastTapSongIdRef.current === song.id && now - lastTapTimeRef.current < DOUBLE_TAP_DELAY) {
      openSimpleViewer(song)
      lastTapSongIdRef.current = null
    } else {
      lastTapSongIdRef.current = song.id
      lastTapTimeRef.current = now
    }
  }, [openSimpleViewer])

  const handleLike = useCallback(async (e: React.MouseEvent, songId: string) => {
    const ok = await toggleLike(e, songId)
    if (!ok) {
      router.push('/login')
    }
  }, [toggleLike, router])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 size={28} className="text-violet-500 animate-spin" />
        <p className="text-sm text-gray-400">인기 악보를 불러오는 중...</p>
      </div>
    )
  }

  if (songs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <TrendingUp size={40} className="text-gray-300" />
        <p className="text-gray-500 font-medium">이번 주 인기 악보가 없습니다</p>
        <p className="text-sm text-gray-400">악보를 검색하고 사용하면 여기에 표시됩니다</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={18} className="text-violet-600" />
        <p className="text-sm text-gray-500">최근 7일간 가장 많이 조회된 악보</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {songs.map((song, idx) => {
          const isLiked = likedSongs.has(song.id)
          const isPreviewOpen = previewStates[song.id]
          return (
            <div key={song.id} className="transition-colors">
              {/* 리스트 행 */}
              <div
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer group"
                onClick={() => router.push(`/songs/${song.id}`)}
                style={{ touchAction: 'manipulation', minHeight: '44px' }}
              >
                {/* 순위 */}
                <span className="text-base font-bold text-violet-400 w-6 text-center shrink-0">
                  {idx + 1}
                </span>

                {/* 곡 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 text-sm truncate group-hover:text-violet-700 transition-colors">
                      {song.song_name}
                    </h3>
                    {song.key && (
                      <span className="text-[10px] font-medium text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded shrink-0">
                        {song.key}
                      </span>
                    )}
                    {song.tempo && (
                      <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
                        {song.tempo}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {song.team_name || '-'}
                  </p>
                </div>

                {/* 액션 버튼 - 세로 정렬 */}
                <div className="flex items-start gap-1 shrink-0">
                  {/* 미리보기 토글 (가사 또는 악보) */}
                  <div className="w-8 flex flex-col items-center">
                    {(song.file_url || song.lyrics) ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          togglePreview(song.id)
                        }}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isPreviewOpen
                            ? 'text-sky-600 bg-sky-100'
                            : 'text-sky-500 hover:bg-sky-100'
                        }`}
                        title={isPreviewOpen ? '접기' : '펼치기'}
                        style={{ touchAction: 'manipulation' }}
                      >
                        {isPreviewOpen ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    ) : <div className="w-7 h-7" />}
                  </div>

                  {/* 좋아요 */}
                  <div className="w-8 flex flex-col items-center">
                    <button
                      onClick={(e) => handleLike(e, song.id)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        isLiked
                          ? 'text-red-500 hover:bg-red-50'
                          : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                      }`}
                      title="좋아요"
                      style={{ touchAction: 'manipulation' }}
                    >
                      <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
                    </button>
                    {(song.like_count || 0) > 0 && (
                      <span className={`text-[10px] leading-none ${isLiked ? 'text-red-500' : 'text-gray-400'}`}>
                        {song.like_count}
                      </span>
                    )}
                  </div>

                  {/* YouTube */}
                  <div className="w-8 flex flex-col items-center">
                    {song.youtube_url ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleYoutube(song.id)
                        }}
                        className={`p-1.5 rounded-lg transition-colors ${
                          youtubeStates[song.id]
                            ? 'text-red-600 bg-red-50'
                            : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                        }`}
                        title={youtubeStates[song.id] ? '유튜브 닫기' : '유튜브 열기'}
                        style={{ touchAction: 'manipulation' }}
                      >
                        <Youtube size={16} />
                      </button>
                    ) : <div className="w-7 h-7" />}
                  </div>
                </div>
              </div>

              {/* 유튜브 인라인 */}
              {youtubeStates[song.id] && song.youtube_url && (
                <div className="px-4 pb-4 border-t border-gray-100 pt-3 ml-9">
                  {getYoutubeEmbedUrl(song.youtube_url) ? (
                    <div className="relative w-full max-w-2xl" style={{ paddingBottom: '56.25%' }}>
                      <iframe
                        src={getYoutubeEmbedUrl(song.youtube_url) || ''}
                        className="absolute top-0 left-0 w-full h-full rounded-lg"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">유효하지 않은 유튜브 링크입니다.</p>
                  )}
                </div>
              )}

              {/* 인라인 미리보기 (가사 + 악보) */}
              {isPreviewOpen && (song.file_url || song.lyrics) && (
                <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                  {/* 가사 */}
                  {song.lyrics && (
                    <div className="mb-4">
                      <h4 className="font-semibold text-gray-700 mb-2 text-sm">가사</h4>
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans bg-gray-50 p-3 rounded max-h-60 overflow-y-auto">
                        {song.lyrics}
                      </pre>
                    </div>
                  )}
                  {/* 악보 */}
                  {song.file_url && (
                  <>
                  <h4 className="font-semibold text-gray-700 mb-2 text-sm">
                    악보
                    <span className="text-xs text-gray-400 ml-1">(더블탭하여 전체화면)</span>
                  </h4>
                  {song.file_type === 'pdf' ? (
                    <div
                      className="relative w-full h-[80vh] sm:h-[600px] cursor-pointer"
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        openSimpleViewer(song)
                      }}
                      onTouchEnd={(e) => {
                        e.stopPropagation()
                        handleDoubleTap(song)
                      }}
                    >
                      <iframe
                        src={`${song.file_url}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
                        className="w-full h-full border sm:rounded pointer-events-none"
                      />
                      <div className="absolute inset-0" />
                    </div>
                  ) : (
                    <ResponsiveImage
                      src={song.file_url}
                      alt={`${song.song_name} 악보`}
                      className="rounded shadow-sm cursor-pointer"
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        openSimpleViewer(song)
                      }}
                      onTouchEnd={(e) => {
                        e.stopPropagation()
                        handleDoubleTap(song)
                      }}
                    />
                  )}
                  </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-center text-xs text-gray-400 mt-6">
        총 {songs.length}개의 인기 악보
      </p>

      {/* 전체화면 악보 뷰어 */}
      {viewerSong && viewerSong.file_url && (
        <SheetMusicViewer
          fileUrl={viewerSong.file_url}
          fileType={viewerSong.file_type === 'pdf' ? 'pdf' : 'image'}
          songName={viewerSong.song_name}
          onClose={() => setViewerSong(null)}
        />
      )}
    </div>
  )
}
