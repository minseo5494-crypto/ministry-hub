'use client'

import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { SharedSetlistComment } from '@/types/community'

export function useCommunityComments() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 댓글 목록 조회
  const fetchComments = useCallback(async (
    sharedSetlistId: string
  ): Promise<SharedSetlistComment[]> => {
    const { data, error: fetchError } = await supabase
      .from('shared_setlist_comments')
      .select('*')
      .eq('shared_setlist_id', sharedSetlistId)
      .order('created_at', { ascending: true })

    if (fetchError) {
      return []
    }

    return (data || []) as SharedSetlistComment[]
  }, [])

  // 댓글 작성
  const addComment = useCallback(async (
    sharedSetlistId: string,
    content: string,
    userId: string
  ): Promise<SharedSetlistComment | null> => {
    if (!content.trim()) return null
    if (content.length > 500) {
      setError('댓글은 500자 이내로 작성해주세요.')
      return null
    }

    setLoading(true)
    setError(null)

    try {
      // 작성자 정보 조회 (비정규화)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('name, church_name')
        .eq('id', userId)
        .single()

      if (userError || !userData) {
        setError('사용자 정보를 불러올 수 없습니다.')
        return null
      }

      const { data, error: insertError } = await supabase
        .from('shared_setlist_comments')
        .insert({
          shared_setlist_id: sharedSetlistId,
          user_id: userId,
          content: content.trim(),
          author_name: userData.name ?? '알 수 없음',
          author_church: userData.church_name ?? null,
        })
        .select()
        .single()

      if (insertError) {
        setError(insertError.message)
        return null
      }

      return data as SharedSetlistComment
    } finally {
      setLoading(false)
    }
  }, [])

  // 댓글 삭제
  const deleteComment = useCallback(async (commentId: string): Promise<boolean> => {
    setLoading(true)
    setError(null)

    try {
      const { error: deleteError } = await supabase
        .from('shared_setlist_comments')
        .delete()
        .eq('id', commentId)

      if (deleteError) {
        setError(deleteError.message)
        return false
      }

      return true
    } finally {
      setLoading(false)
    }
  }, [])

  // 콘티 신고 (댓글 신고가 아닌 공유 콘티 전체 신고)
  const reportSetlist = useCallback(async (
    sharedSetlistId: string,
    reporterId: string,
    reason: string
  ): Promise<boolean> => {
    if (!reason.trim()) return false

    setLoading(true)
    setError(null)

    try {
      const { error: reportError } = await supabase
        .from('shared_setlist_reports')
        .insert({
          shared_setlist_id: sharedSetlistId,
          reporter_id: reporterId,
          reason: reason.trim(),
        })

      if (reportError) {
        // 이미 신고한 경우 (unique constraint)
        if (reportError.code === '23505') {
          setError('이미 신고한 콘티입니다.')
        } else {
          setError(reportError.message)
        }
        return false
      }

      return true
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    loading,
    error,
    fetchComments,
    addComment,
    deleteComment,
    reportSetlist,
  }
}
