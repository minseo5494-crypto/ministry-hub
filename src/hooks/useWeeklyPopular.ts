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
      // 인기 곡 ID 목록 (인증 불필요)
      const res = await fetch('/api/songs/weekly-popular')
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
        const idOrder = new Map(ids.map((id, idx) => [id, idx]))
        const sorted = [...songData].sort(
          (a, b) => (idOrder.get(a.id) ?? 99) - (idOrder.get(b.id) ?? 99)
        )
        setSongs(sorted as Song[])
      }

      // 로그인한 경우에만 좋아요 상태 조회
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.id) {
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

  const toggleLike = useCallback(async (e: React.MouseEvent, songId: string): Promise<boolean> => {
    e.stopPropagation()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false // 미로그인

    const isLiked = likedSongs.has(songId)

    // Optimistic update (좋아요 상태 + 카운트)
    setLikedSongs(prev => {
      const next = new Set(prev)
      if (isLiked) next.delete(songId)
      else next.add(songId)
      return next
    })
    setSongs(prev => prev.map(s =>
      s.id === songId
        ? { ...s, like_count: isLiked ? Math.max(0, (s.like_count || 1) - 1) : (s.like_count || 0) + 1 }
        : s
    ))

    try {
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
    } catch {
      // Rollback on error
      setLikedSongs(prev => {
        const next = new Set(prev)
        if (isLiked) next.add(songId)
        else next.delete(songId)
        return next
      })
      setSongs(prev => prev.map(s =>
        s.id === songId
          ? { ...s, like_count: isLiked ? (s.like_count || 0) + 1 : Math.max(0, (s.like_count || 1) - 1) }
          : s
      ))
    }
    return true
  }, [likedSongs])

  return { songs, likedSongs, loading, toggleLike, refresh: fetchPopularSongs }
}
