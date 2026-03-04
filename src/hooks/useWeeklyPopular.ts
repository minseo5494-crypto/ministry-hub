'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Song } from '@/lib/supabase'

export function useWeeklyPopular() {
  const [songs, setSongs] = useState<Song[]>([])
  const [likedSongs, setLikedSongs] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const fetchPopularSongs = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setLoading(false)
        return
      }

      // 인기 곡 ID 목록 가져오기
      const res = await fetch('/api/songs/weekly-popular', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json()
      const ranked: { id: string; rank: number }[] = json.data || []

      if (ranked.length === 0) {
        setSongs([])
        setLoading(false)
        return
      }

      const ids = ranked.slice(0, 30).map(r => r.id)

      // 곡 정보 조회
      const { data: songData } = await supabase
        .from('songs')
        .select('*')
        .in('id', ids)

      if (songData) {
        // rank 순서대로 정렬
        const idOrder = new Map(ids.map((id, idx) => [id, idx]))
        const sorted = [...songData].sort(
          (a, b) => (idOrder.get(a.id) ?? 99) - (idOrder.get(b.id) ?? 99)
        )
        setSongs(sorted as Song[])
      }

      // 좋아요 상태 조회
      if (session.user?.id) {
        const { data: likes } = await supabase
          .from('song_likes')
          .select('song_id')
          .eq('user_id', session.user.id)
          .in('song_id', ids)

        if (likes) {
          setLikedSongs(new Set(likes.map(l => l.song_id)))
        }
      }
    } catch (err) {
      console.error('Failed to fetch popular songs:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPopularSongs()
  }, [fetchPopularSongs])

  const toggleLike = useCallback(async (e: React.MouseEvent, songId: string) => {
    e.stopPropagation()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const isLiked = likedSongs.has(songId)

    // Optimistic update
    setLikedSongs(prev => {
      const next = new Set(prev)
      if (isLiked) next.delete(songId)
      else next.add(songId)
      return next
    })

    if (isLiked) {
      await supabase
        .from('song_likes')
        .delete()
        .eq('user_id', user.id)
        .eq('song_id', songId)
    } else {
      await supabase
        .from('song_likes')
        .insert({ user_id: user.id, song_id: songId })
    }
  }, [likedSongs])

  return { songs, likedSongs, loading, toggleLike, refresh: fetchPopularSongs }
}
