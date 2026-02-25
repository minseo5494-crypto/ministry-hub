'use client'

import { useCallback } from 'react'
import { supabase, PageAnnotation } from '@/lib/supabase'
import {
  SongFormStyle,
  PartTagStyle,
  PianoScoreElement,
  DrumScoreElement,
} from '@/components/SheetMusicEditor/types'

// ===== 타입 정의 =====

// 곡별 필기 데이터 (메타데이터 포함 - 뷰어에서 바로 열기 위해)
export interface SetlistSongNoteData {
  // 곡 메타데이터
  order: number             // 콘티 내 곡 순서 (0부터)
  song_name: string
  file_url: string
  file_type: 'pdf' | 'image'
  team_name?: string
  songForms?: string[]
  // 필기 데이터
  annotations: PageAnnotation[]
  songFormEnabled: boolean
  songFormStyle: SongFormStyle
  partTags: PartTagStyle[]
  pianoScores?: PianoScoreElement[]
  drumScores?: DrumScoreElement[]
}

// note_data 전체 구조: { [songId]: SetlistSongNoteData }
export type SetlistNoteData = Record<string, SetlistSongNoteData>

// setlist_notes 테이블 레코드
export interface SetlistNote {
  id: string
  user_id: string
  setlist_id: string
  note_data: SetlistNoteData
  title: string
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

// 저장 시 사용할 입력 타입
export interface SaveSetlistNoteInput {
  user_id: string
  setlist_id: string
  note_data: SetlistNoteData
  title: string
}

// ===== 훅 =====

export function useSetlistNotes() {
  // 단일 콘티 노트 조회
  const fetchSetlistNote = useCallback(async (
    userId: string,
    setlistId: string
  ): Promise<SetlistNote | null> => {
    try {
      const { data, error } = await supabase
        .from('setlist_notes')
        .select('*')
        .eq('user_id', userId)
        .eq('setlist_id', setlistId)
        .is('deleted_at', null)
        .maybeSingle()

      if (error) {
        console.error('❌ 콘티 노트 조회 실패:', error.message)
        return null
      }

      return data as SetlistNote | null
    } catch (err) {
      console.error('❌ 콘티 노트 조회 예외:', err)
      return null
    }
  }, [])

  // 콘티 노트 저장 (SELECT → INSERT or UPDATE 패턴)
  const saveSetlistNote = useCallback(async (
    input: SaveSetlistNoteInput
  ): Promise<SetlistNote | null> => {
    try {
      const now = new Date().toISOString()
      const songCount = Object.keys(input.note_data).length
      console.log(`💾 콘티 노트 저장 시작: setlist=${input.setlist_id}, user=${input.user_id}, 곡 수=${songCount}`)

      // 인증 상태 확인
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        const errMsg = '콘티 노트 저장 실패: 로그인 세션이 만료되었습니다. 다시 로그인해주세요.'
        console.error('❌', errMsg)
        alert(errMsg)
        return null
      }
      console.log(`🔑 인증 확인: uid=${session.user.id}, input.user_id=${input.user_id}`)

      // 1. 기존 레코드 조회
      const { data: existing, error: selectError } = await supabase
        .from('setlist_notes')
        .select('id')
        .eq('user_id', input.user_id)
        .eq('setlist_id', input.setlist_id)
        .is('deleted_at', null)
        .maybeSingle()

      if (selectError) {
        const errMsg = `콘티 노트 조회 실패: ${selectError.message} (code=${selectError.code})`
        console.error('❌', errMsg, selectError.details, selectError.hint)
        alert(errMsg)
        return null
      }

      let data: any
      let error: any

      if (existing) {
        // 2a. UPDATE 기존 레코드
        console.log(`📝 기존 콘티 노트 업데이트: id=${existing.id}`)
        const result = await supabase
          .from('setlist_notes')
          .update({
            note_data: input.note_data,
            title: input.title,
            updated_at: now,
            deleted_at: null,
          })
          .eq('id', existing.id)
          .select()
          .single()

        data = result.data
        error = result.error
      } else {
        // 2b. INSERT 새 레코드
        const newId = crypto.randomUUID()
        console.log(`📝 새 콘티 노트 생성: id=${newId}, setlist_id=${input.setlist_id}`)
        const result = await supabase
          .from('setlist_notes')
          .insert({
            id: newId,
            user_id: input.user_id,
            setlist_id: input.setlist_id,
            note_data: input.note_data,
            title: input.title,
            updated_at: now,
          })
          .select()
          .single()

        data = result.data
        error = result.error
      }

      if (error) {
        const errMsg = `콘티 노트 저장 실패: ${error.message} (code=${error.code}, hint=${error.hint})`
        console.error('❌', errMsg, error.details)
        alert(errMsg)
        return null
      }

      console.log(`✅ 콘티 노트 저장 완료: id=${data.id}, 곡 수=${songCount}`)
      return data as SetlistNote
    } catch (err: any) {
      const errMsg = `콘티 노트 저장 예외: ${err?.message || err}`
      console.error('❌', errMsg, err)
      alert(errMsg)
      return null
    }
  }, [])

  // 사용자의 모든 콘티 노트 목록 조회 (my-page용)
  const fetchAllSetlistNotes = useCallback(async (
    userId: string
  ): Promise<SetlistNote[]> => {
    try {
      const { data, error } = await supabase
        .from('setlist_notes')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('❌ 콘티 노트 목록 조회 실패:', error.message)
        return []
      }

      return (data as SetlistNote[]) || []
    } catch (err) {
      console.error('❌ 콘티 노트 목록 조회 예외:', err)
      return []
    }
  }, [])

  // 콘티 노트 삭제 (soft delete)
  const deleteSetlistNote = useCallback(async (
    userId: string,
    setlistId: string
  ): Promise<boolean> => {
    try {
      const now = new Date().toISOString()

      const { error } = await supabase
        .from('setlist_notes')
        .update({ deleted_at: now })
        .eq('user_id', userId)
        .eq('setlist_id', setlistId)

      if (error) {
        console.error('❌ 콘티 노트 삭제 실패:', error.message)
        return false
      }

      console.log('✅ 콘티 노트 soft delete 완료')
      return true
    } catch (err) {
      console.error('❌ 콘티 노트 삭제 예외:', err)
      return false
    }
  }, [])

  return {
    fetchSetlistNote,
    saveSetlistNote,
    fetchAllSetlistNotes,
    deleteSetlistNote,
  }
}
