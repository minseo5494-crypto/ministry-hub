'use client'

import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { LocalSheetMusicNote } from './useSheetMusicNotes'

// 로컬 스토리지 키
const STORAGE_KEY = 'ministry_hub_personal_setlist_views'

// 커스터마이징 타입
export interface SetlistCustomization {
  type: 'replace' | 'insert'
  // replace: 원본 곡을 필기 노트로 대체
  originalSongId?: string  // replace 시 사용
  // insert: 특정 순서 뒤에 필기 노트 끼워넣기
  afterOrder?: number      // insert 시 사용
  // 공통
  noteId: string           // 대체하거나 끼워넣을 필기 노트 ID
  orderNumber?: number     // 계산된 순서 (UI용)
}

// 개인 콘티 뷰
export interface PersonalSetlistView {
  id: string
  user_id: string
  team_setlist_id: string
  customizations: SetlistCustomization[]
  created_at: string
  updated_at: string
}

// 콘티 곡 + 개인화 정보
export interface PersonalizedSetlistSong {
  id: string
  song_id: string
  song_name: string
  team_name?: string
  order_number: number
  key_transposed?: string
  notes?: string
  selected_form?: string[]
  file_url?: string
  file_type?: string
  // 개인화 정보
  isPersonalized: boolean       // 개인화된 항목인지
  personalNote?: LocalSheetMusicNote  // 대체된 필기 노트
  isInserted?: boolean          // 끼워넣은 항목인지
  originalSongId?: string       // 원본 곡 ID (대체된 경우)
}

interface UsePersonalSetlistViewReturn {
  personalView: PersonalSetlistView | null
  loading: boolean
  error: string | null

  // 개인 뷰 관리
  fetchPersonalView: (userId: string, setlistId: string) => Promise<PersonalSetlistView | null>
  savePersonalView: (view: Omit<PersonalSetlistView, 'id' | 'created_at' | 'updated_at'>) => Promise<boolean>

  // 커스터마이징 작업
  replaceSongWithNote: (userId: string, setlistId: string, originalSongId: string, noteId: string) => Promise<boolean>
  insertNoteAfter: (userId: string, setlistId: string, afterOrder: number, noteId: string) => Promise<boolean>
  removeCustomization: (userId: string, setlistId: string, noteId: string) => Promise<boolean>
  clearAllCustomizations: (userId: string, setlistId: string) => Promise<boolean>

  // 개인화된 콘티 곡 목록 생성
  getPersonalizedSongs: (
    userId: string,
    setlistId: string,
    originalSongs: Array<{ id: string; song_id: string; song_name: string; team_name?: string; order_number: number; file_url?: string; file_type?: string; key_transposed?: string; notes?: string; selected_form?: string[] }>,
    userNotes: LocalSheetMusicNote[]
  ) => PersonalizedSetlistSong[]
}

// 로컬 스토리지에서 뷰 가져오기
const getStoredViews = (): PersonalSetlistView[] => {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (e) {
    console.error('로컬 스토리지 읽기 오류:', e)
    return []
  }
}

// 로컬 스토리지에 뷰 저장
const setStoredViews = (views: PersonalSetlistView[]) => {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(views))
  } catch (e) {
    console.error('로컬 스토리지 저장 오류:', e)
  }
}

export function usePersonalSetlistView(): UsePersonalSetlistViewReturn {
  const [personalView, setPersonalView] = useState<PersonalSetlistView | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 개인 뷰 가져오기
  const fetchPersonalView = useCallback(async (userId: string, setlistId: string): Promise<PersonalSetlistView | null> => {
    setLoading(true)
    setError(null)

    try {
      // 로컬 스토리지에서 먼저 확인
      const allViews = getStoredViews()
      const localView = allViews.find(v => v.user_id === userId && v.team_setlist_id === setlistId)

      if (localView) {
        setPersonalView(localView)
        return localView
      }

      // Supabase에서 확인
      try {
        const { data, error: fetchError } = await supabase
          .from('personal_setlist_views')
          .select('*')
          .eq('user_id', userId)
          .eq('team_setlist_id', setlistId)
          .single()

        if (!fetchError && data) {
          const view: PersonalSetlistView = {
            id: data.id,
            user_id: data.user_id,
            team_setlist_id: data.team_setlist_id,
            customizations: data.customizations || [],
            created_at: data.created_at,
            updated_at: data.updated_at,
          }

          // 로컬에도 저장
          const updatedViews = [...allViews.filter(v => v.id !== view.id), view]
          setStoredViews(updatedViews)

          setPersonalView(view)
          return view
        }
      } catch {
        // Supabase 오류 무시 (테이블이 없을 수 있음)
      }

      setPersonalView(null)
      return null
    } catch (err) {
      console.error('개인 뷰 불러오기 오류:', err)
      setError('개인 뷰를 불러오는데 실패했습니다.')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  // 개인 뷰 저장
  const savePersonalView = useCallback(async (viewData: Omit<PersonalSetlistView, 'id' | 'created_at' | 'updated_at'>): Promise<boolean> => {
    setLoading(true)
    setError(null)

    try {
      const now = new Date().toISOString()
      const allViews = getStoredViews()

      // 기존 뷰 찾기
      const existingIndex = allViews.findIndex(
        v => v.user_id === viewData.user_id && v.team_setlist_id === viewData.team_setlist_id
      )

      let savedView: PersonalSetlistView

      if (existingIndex >= 0) {
        // 업데이트
        savedView = {
          ...allViews[existingIndex],
          customizations: viewData.customizations,
          updated_at: now,
        }
        allViews[existingIndex] = savedView
      } else {
        // 새로 생성
        savedView = {
          ...viewData,
          id: `view-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          created_at: now,
          updated_at: now,
        }
        allViews.push(savedView)
      }

      setStoredViews(allViews)
      setPersonalView(savedView)

      // Supabase에도 저장 (비동기)
      try {
        await supabase.from('personal_setlist_views').upsert({
          id: savedView.id,
          user_id: savedView.user_id,
          team_setlist_id: savedView.team_setlist_id,
          customizations: savedView.customizations,
          updated_at: now,
        })
      } catch (supabaseErr) {
        console.warn('Supabase 저장 실패 (로컬은 저장됨):', supabaseErr)
      }

      return true
    } catch (err) {
      console.error('개인 뷰 저장 오류:', err)
      setError('개인 뷰 저장에 실패했습니다.')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  // 곡을 필기 노트로 대체
  const replaceSongWithNote = useCallback(async (
    userId: string,
    setlistId: string,
    originalSongId: string,
    noteId: string
  ): Promise<boolean> => {
    const existingView = await fetchPersonalView(userId, setlistId)

    const customizations: SetlistCustomization[] = existingView?.customizations || []

    // 기존 대체 제거 후 새로 추가
    const filtered = customizations.filter(
      c => !(c.type === 'replace' && c.originalSongId === originalSongId)
    )

    filtered.push({
      type: 'replace',
      originalSongId,
      noteId,
    })

    return savePersonalView({
      user_id: userId,
      team_setlist_id: setlistId,
      customizations: filtered,
    })
  }, [fetchPersonalView, savePersonalView])

  // 특정 순서 뒤에 필기 노트 끼워넣기
  const insertNoteAfter = useCallback(async (
    userId: string,
    setlistId: string,
    afterOrder: number,
    noteId: string
  ): Promise<boolean> => {
    const existingView = await fetchPersonalView(userId, setlistId)

    const customizations: SetlistCustomization[] = existingView?.customizations || []

    // 같은 노트가 이미 끼워져 있으면 제거
    const filtered = customizations.filter(
      c => !(c.type === 'insert' && c.noteId === noteId)
    )

    filtered.push({
      type: 'insert',
      afterOrder,
      noteId,
    })

    return savePersonalView({
      user_id: userId,
      team_setlist_id: setlistId,
      customizations: filtered,
    })
  }, [fetchPersonalView, savePersonalView])

  // 커스터마이징 제거
  const removeCustomization = useCallback(async (
    userId: string,
    setlistId: string,
    noteId: string
  ): Promise<boolean> => {
    const existingView = await fetchPersonalView(userId, setlistId)

    if (!existingView) return true

    const filtered = existingView.customizations.filter(c => c.noteId !== noteId)

    return savePersonalView({
      user_id: userId,
      team_setlist_id: setlistId,
      customizations: filtered,
    })
  }, [fetchPersonalView, savePersonalView])

  // 모든 커스터마이징 제거
  const clearAllCustomizations = useCallback(async (
    userId: string,
    setlistId: string
  ): Promise<boolean> => {
    return savePersonalView({
      user_id: userId,
      team_setlist_id: setlistId,
      customizations: [],
    })
  }, [savePersonalView])

  // 개인화된 콘티 곡 목록 생성
  const getPersonalizedSongs = useCallback((
    userId: string,
    setlistId: string,
    originalSongs: Array<{
      id: string
      song_id: string
      song_name: string
      team_name?: string
      order_number: number
      file_url?: string
      file_type?: string
      key_transposed?: string
      notes?: string
      selected_form?: string[]
    }>,
    userNotes: LocalSheetMusicNote[]
  ): PersonalizedSetlistSong[] => {
    // 로컬 스토리지에서 개인 뷰 가져오기
    const allViews = getStoredViews()
    const view = allViews.find(v => v.user_id === userId && v.team_setlist_id === setlistId)

    const customizations = view?.customizations || []
    const result: PersonalizedSetlistSong[] = []

    // 원본 곡 순서대로 처리
    for (const song of originalSongs) {
      // 대체 커스터마이징 확인
      const replacement = customizations.find(
        c => c.type === 'replace' && c.originalSongId === song.song_id
      )

      if (replacement) {
        // 필기 노트로 대체
        const note = userNotes.find(n => n.id === replacement.noteId)
        if (note) {
          result.push({
            id: song.id,
            song_id: note.song_id,
            song_name: note.song_name,
            team_name: note.team_name,
            order_number: song.order_number,
            key_transposed: song.key_transposed,
            notes: song.notes,
            selected_form: song.selected_form,
            file_url: note.file_url,
            file_type: note.file_type,
            isPersonalized: true,
            personalNote: note,
            isInserted: false,
            originalSongId: song.song_id,
          })
        } else {
          // 노트를 찾을 수 없으면 원본 유지
          result.push({
            ...song,
            isPersonalized: false,
          })
        }
      } else {
        // 원본 유지
        result.push({
          ...song,
          isPersonalized: false,
        })
      }

      // 이 곡 뒤에 끼워넣을 노트 확인
      const insertions = customizations.filter(
        c => c.type === 'insert' && c.afterOrder === song.order_number
      )

      for (const insertion of insertions) {
        const note = userNotes.find(n => n.id === insertion.noteId)
        if (note) {
          result.push({
            id: `inserted-${insertion.noteId}`,
            song_id: note.song_id,
            song_name: note.song_name,
            team_name: note.team_name,
            order_number: song.order_number + 0.5,
            file_url: note.file_url,
            file_type: note.file_type,
            isPersonalized: true,
            personalNote: note,
            isInserted: true,
          })
        }
      }
    }

    // order_number로 정렬
    result.sort((a, b) => a.order_number - b.order_number)

    return result
  }, [])

  return {
    personalView,
    loading,
    error,
    fetchPersonalView,
    savePersonalView,
    replaceSongWithNote,
    insertNoteAfter,
    removeCustomization,
    clearAllCustomizations,
    getPersonalizedSongs,
  }
}
