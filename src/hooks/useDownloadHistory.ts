'use client'

import { useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { DownloadHistory, DownloadSong, DownloadHistoryOptions } from '@/types/downloadHistory'

export function useDownloadHistory() {
  // 사용자의 다운로드 내역 목록 조회 (최신순)
  const fetchDownloadHistory = useCallback(async (userId: string): Promise<DownloadHistory[]> => {
    try {
      const { data, error } = await supabase
        .from('download_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('❌ 다운로드 내역 조회 실패:', error.message)
        return []
      }

      return (data as DownloadHistory[]) || []
    } catch (err) {
      console.error('❌ 다운로드 내역 조회 예외:', err)
      return []
    }
  }, [])

  // 다운로드 기록 저장
  const saveDownloadHistory = useCallback(async (params: {
    userId: string
    title: string
    format: 'pdf' | 'ppt' | 'image'
    songs: DownloadSong[]
    options?: DownloadHistoryOptions
  }): Promise<DownloadHistory | null> => {
    try {
      const { data, error } = await supabase
        .from('download_history')
        .insert({
          user_id: params.userId,
          title: params.title,
          format: params.format,
          songs: params.songs,
          options: params.options ?? null,
        })
        .select()
        .single()

      if (error) {
        console.error('❌ 다운로드 내역 저장 실패:', error.message)
        return null
      }

      console.log(`✅ 다운로드 내역 저장 완료: id=${data.id}`)
      return data as DownloadHistory
    } catch (err) {
      console.error('❌ 다운로드 내역 저장 예외:', err)
      return null
    }
  }, [])

  // 다운로드 기록 삭제
  const deleteDownloadHistory = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('download_history')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('❌ 다운로드 내역 삭제 실패:', error.message)
        return false
      }

      console.log(`✅ 다운로드 내역 삭제 완료: id=${id}`)
      return true
    } catch (err) {
      console.error('❌ 다운로드 내역 삭제 예외:', err)
      return false
    }
  }, [])

  return {
    fetchDownloadHistory,
    saveDownloadHistory,
    deleteDownloadHistory,
  }
}
