'use client'

import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type {
  SharedSetlist,
  CommunityFilters,
  CommunityPage,
  ShareSetlistInput,
  CopyToTeamInput,
} from '@/types/community'

const PAGE_SIZE = 12

// team_setlists + team_setlist_songs JOIN하여 스냅샷 생성용 타입
// Supabase PostgREST는 1:1 관계도 배열로 반환하므로 배열 타입 사용
type SetlistSongRow = {
  order_number: number
  song_id: string
  key_transposed: string | null
  notes: string | null
  selected_form: string[] | null
  songs: {
    song_name: string
    team_name: string | null
  }[] | null
}

export function useCommunity() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 공유 콘티 목록 조회 (커서 기반 페이지네이션)
  const fetchSharedSetlists = useCallback(async (
    filters: CommunityFilters,
    cursor?: string  // 이전 페이지의 마지막 created_at 값
  ): Promise<CommunityPage> => {
    setError(null)

    let query = supabase
      .from('shared_setlists')
      .select('*')
      .eq('status', 'active')

    // 정렬
    if (filters.sortBy === 'popular') {
      query = query.order('like_count', { ascending: false }).order('created_at', { ascending: false })
    } else if (filters.sortBy === 'most_copied') {
      query = query.order('copy_count', { ascending: false }).order('created_at', { ascending: false })
    } else {
      // latest (기본)
      query = query.order('created_at', { ascending: false })
    }

    // 커서 페이지네이션 (latest 정렬만)
    if (cursor && filters.sortBy === 'latest') {
      query = query.lt('created_at', cursor)
    }

    // 예배 유형 필터
    if (filters.serviceType) {
      query = query.eq('service_type', filters.serviceType)
    }

    // 태그 필터 (배열 포함 검사 - @> 연산자)
    if (filters.tags.length > 0) {
      query = query.contains('tags', filters.tags)
    }

    // 텍스트 검색 (제목, 작성자 이름, 교회)
    if (filters.searchText.trim()) {
      const searchTerm = filters.searchText.trim()
      query = query.or(
        `title.ilike.%${searchTerm}%,author_name.ilike.%${searchTerm}%,author_church.ilike.%${searchTerm}%`
      )
    }

    query = query.limit(PAGE_SIZE + 1)

    const { data, error: fetchError } = await query

    if (fetchError) {
      setError(fetchError.message)
      return { items: [], nextCursor: null, hasMore: false }
    }

    const items = (data || []) as SharedSetlist[]
    const hasMore = items.length > PAGE_SIZE
    const pageItems = hasMore ? items.slice(0, PAGE_SIZE) : items
    const nextCursor = hasMore ? pageItems[pageItems.length - 1].created_at : null

    return { items: pageItems, nextCursor, hasMore }
  }, [])

  // 공유 콘티 상세 조회 (좋아요/북마크 상태 포함)
  const fetchSharedSetlist = useCallback(async (
    id: string,
    userId?: string
  ): Promise<SharedSetlist | null> => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('shared_setlists')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchError || !data) {
        setError(fetchError?.message || '콘티를 찾을 수 없습니다.')
        return null
      }

      const setlist = data as SharedSetlist

      // 현재 유저의 좋아요/북마크 상태 확인
      if (userId) {
        const [likeResult, bookmarkResult] = await Promise.all([
          supabase
            .from('shared_setlist_likes')
            .select('id')
            .eq('shared_setlist_id', id)
            .eq('user_id', userId)
            .maybeSingle(),
          supabase
            .from('shared_setlist_bookmarks')
            .select('id')
            .eq('shared_setlist_id', id)
            .eq('user_id', userId)
            .maybeSingle(),
        ])

        setlist.is_liked = !!likeResult.data
        setlist.is_bookmarked = !!bookmarkResult.data
      }

      return setlist
    } finally {
      setLoading(false)
    }
  }, [])

  // 내 팀 셋리스트를 커뮤니티에 공유
  const shareSetlist = useCallback(async (
    input: ShareSetlistInput,
    userId: string
  ): Promise<SharedSetlist | null> => {
    setLoading(true)
    setError(null)

    try {
      // 1. 현재 유저 정보 조회 (작성자 비정규화 저장용)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('name, church_name')
        .eq('id', userId)
        .single()

      if (userError || !userData) {
        setError('사용자 정보를 불러올 수 없습니다.')
        return null
      }

      // 2. 원본 셋리스트의 곡 목록 조회 (스냅샷 생성)
      const { data: songsData, error: songsError } = await supabase
        .from('team_setlist_songs')
        .select(`
          order_number,
          song_id,
          key_transposed,
          notes,
          selected_form,
          songs (
            song_name,
            team_name
          )
        `)
        .eq('setlist_id', input.source_setlist_id)
        .order('order_number')

      if (songsError) {
        setError('셋리스트 곡 목록을 불러올 수 없습니다.')
        return null
      }

      // 3. JSONB 스냅샷 생성
      // Supabase PostgREST는 1:1 관계도 배열로 반환
      const songSnapshot = (songsData || []).map((row: SetlistSongRow, idx: number) => {
        const song = Array.isArray(row.songs) ? row.songs[0] : row.songs
        return {
          order: idx + 1,
          song_id: row.song_id,
          song_title: song?.song_name ?? '',
          artist: song?.team_name ?? '',
          key: row.key_transposed ?? '',
          selected_form: row.selected_form ?? [],
          notes: row.notes ?? '',
        }
      })

      // 4. shared_setlists에 저장
      const { data: created, error: insertError } = await supabase
        .from('shared_setlists')
        .insert({
          source_setlist_id: input.source_setlist_id,
          source_team_id: input.source_team_id,
          shared_by: userId,
          title: input.title,
          description: input.description ?? null,
          tags: input.tags ?? [],
          service_type: input.service_type ?? null,
          songs: songSnapshot,
          devotional_guide: input.devotional_guide ?? null,
          author_name: userData.name ?? '알 수 없음',
          author_church: userData.church_name ?? null,
        })
        .select()
        .single()

      if (insertError) {
        setError(insertError.message)
        return null
      }

      return created as SharedSetlist
    } finally {
      setLoading(false)
    }
  }, [])

  // 공유 취소 (삭제)
  const deleteSharedSetlist = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true)
    setError(null)

    try {
      const { error: deleteError } = await supabase
        .from('shared_setlists')
        .delete()
        .eq('id', id)

      if (deleteError) {
        setError(deleteError.message)
        return false
      }

      return true
    } finally {
      setLoading(false)
    }
  }, [])

  // 좋아요 토글 (Optimistic UI는 컴포넌트에서 처리)
  const toggleLike = useCallback(async (
    sharedSetlistId: string,
    userId: string,
    isCurrentlyLiked: boolean
  ): Promise<boolean> => {
    if (isCurrentlyLiked) {
      const { error } = await supabase
        .from('shared_setlist_likes')
        .delete()
        .eq('shared_setlist_id', sharedSetlistId)
        .eq('user_id', userId)

      if (error) {
        setError(error.message)
        return false
      }
    } else {
      const { error } = await supabase
        .from('shared_setlist_likes')
        .insert({ shared_setlist_id: sharedSetlistId, user_id: userId })

      if (error) {
        setError(error.message)
        return false
      }
    }

    return true
  }, [])

  // 북마크 토글
  const toggleBookmark = useCallback(async (
    sharedSetlistId: string,
    userId: string,
    isCurrentlyBookmarked: boolean
  ): Promise<boolean> => {
    if (isCurrentlyBookmarked) {
      const { error } = await supabase
        .from('shared_setlist_bookmarks')
        .delete()
        .eq('shared_setlist_id', sharedSetlistId)
        .eq('user_id', userId)

      if (error) {
        setError(error.message)
        return false
      }
    } else {
      const { error } = await supabase
        .from('shared_setlist_bookmarks')
        .insert({ shared_setlist_id: sharedSetlistId, user_id: userId })

      if (error) {
        setError(error.message)
        return false
      }
    }

    return true
  }, [])

  // 내 팀으로 복사
  const copyToTeam = useCallback(async (
    input: CopyToTeamInput,
    userId: string
  ): Promise<boolean> => {
    setLoading(true)
    setError(null)

    try {
      // 1. 공유 콘티 데이터 조회
      const { data: sharedData, error: fetchError } = await supabase
        .from('shared_setlists')
        .select('songs, title, devotional_guide, copy_count')
        .eq('id', input.shared_setlist_id)
        .single()

      if (fetchError || !sharedData) {
        setError('공유 콘티를 찾을 수 없습니다.')
        return false
      }

      // 2. 새 셋리스트 생성
      const { data: newSetlist, error: setlistError } = await supabase
        .from('team_setlists')
        .insert({
          team_id: input.team_id,
          created_by: userId,
          title: sharedData.title,
          service_date: input.service_date,
          service_type: input.service_type ?? null,
          devotional_guide: sharedData.devotional_guide ?? null,
        })
        .select('id')
        .single()

      if (setlistError || !newSetlist) {
        setError('셋리스트 생성에 실패했습니다.')
        return false
      }

      // 3. 곡 목록 복사 (스냅샷에서 복원)
      const songRows = (sharedData.songs as Array<{
        order: number
        song_id: string
        key: string
        selected_form: string[]
        notes: string
      }>).map((song) => ({
        setlist_id: newSetlist.id,
        song_id: song.song_id,
        order_number: song.order,
        key_transposed: song.key || null,
        selected_form: song.selected_form,
        notes: song.notes || null,
      }))

      if (songRows.length > 0) {
        const { error: songsError } = await supabase
          .from('team_setlist_songs')
          .insert(songRows)

        if (songsError) {
          // 셋리스트 롤백
          await supabase.from('team_setlists').delete().eq('id', newSetlist.id)
          setError('곡 복사에 실패했습니다.')
          return false
        }
      }

      // 4. copy_count 수동 업데이트 (트리거 없음, 계획서 명시사항)
      await supabase
        .from('shared_setlists')
        .update({ copy_count: (sharedData as any).copy_count + 1 })
        .eq('id', input.shared_setlist_id)

      return true
    } finally {
      setLoading(false)
    }
  }, [])

  // 내가 북마크한 콘티 목록
  const fetchBookmarkedSetlists = useCallback(async (
    userId: string
  ): Promise<SharedSetlist[]> => {
    const { data, error: fetchError } = await supabase
      .from('shared_setlist_bookmarks')
      .select(`
        shared_setlists (*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (fetchError || !data) return []

    return data
      .map((row: any) => row.shared_setlists)
      .filter(Boolean) as SharedSetlist[]
  }, [])

  // 내가 공유한 콘티 목록
  const fetchMySharedSetlists = useCallback(async (
    userId: string
  ): Promise<SharedSetlist[]> => {
    const { data, error: fetchError } = await supabase
      .from('shared_setlists')
      .select('*')
      .eq('shared_by', userId)
      .order('created_at', { ascending: false })

    if (fetchError || !data) return []

    return data as SharedSetlist[]
  }, [])

  return {
    loading,
    error,
    fetchSharedSetlists,
    fetchSharedSetlist,
    shareSetlist,
    deleteSharedSetlist,
    toggleLike,
    toggleBookmark,
    copyToTeam,
    fetchBookmarkedSetlists,
    fetchMySharedSetlists,
  }
}
