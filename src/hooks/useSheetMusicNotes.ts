'use client'

import { useState, useCallback, useEffect } from 'react'
import { PageAnnotation, supabase } from '@/lib/supabase'

// 로컬 스토리지 키
const STORAGE_KEY = 'ministry_hub_sheet_music_notes'

// 송폼 스타일 타입
export interface SavedSongFormStyle {
  x: number
  y: number
  fontSize: number
  color: string
  opacity: number
}

// 파트 태그 스타일 타입
export interface SavedPartTagStyle {
  id: string
  label: string
  x: number
  y: number
  fontSize: number
  color: string
  opacity: number
  pageIndex?: number
}

// 피아노 악보 타입
export interface SavedPianoNote {
  pitch: string
  position: number
  duration?: 1 | 2 | 4 | 8 | 16
  beamGroup?: string
}

export interface SavedPianoChord {
  name: string
  position: number
}

export interface SavedPianoScoreElement {
  id: string
  x: number
  y: number
  pageIndex: number
  measureCount: 1 | 2 | 3 | 4
  measureWidths?: number[]
  chordName?: string
  chords?: SavedPianoChord[]
  notes: SavedPianoNote[]
  scale?: number
}

// 드럼 악보 타입
export interface SavedDrumNote {
  instrument: string
  position: number
  duration?: 1 | 2 | 4 | 8 | 16
}

export interface SavedDrumScoreElement {
  id: string
  x: number
  y: number
  pageIndex: number
  measureCount: 1 | 2 | 3 | 4
  measureWidths?: number[]
  notes: SavedDrumNote[]
  scale?: number
}

// 노트 타입 정의
export interface LocalSheetMusicNote {
  id: string
  user_id: string
  song_id: string
  song_name: string
  team_name?: string
  file_url: string
  file_type: 'pdf' | 'image'
  title: string
  annotations: PageAnnotation[]
  thumbnail_url?: string
  created_at: string
  updated_at: string
  deleted_at?: string | null  // Soft delete 지원
  // 송폼 관련 필드
  songForms?: string[]
  songFormEnabled?: boolean
  songFormStyle?: SavedSongFormStyle
  partTags?: SavedPartTagStyle[]
  // 피아노/드럼 악보 필드
  pianoScores?: SavedPianoScoreElement[]
  drumScores?: SavedDrumScoreElement[]
}

interface UseSheetMusicNotesReturn {
  notes: LocalSheetMusicNote[]
  loading: boolean
  error: string | null

  // CRUD 작업
  fetchNotes: (userId: string) => Promise<void>
  saveNote: (note: Omit<LocalSheetMusicNote, 'id' | 'created_at' | 'updated_at'>) => Promise<LocalSheetMusicNote | null>
  updateNote: (id: string, annotations: PageAnnotation[], title?: string, extra?: { songFormEnabled?: boolean, songFormStyle?: SavedSongFormStyle, partTags?: SavedPartTagStyle[], pianoScores?: SavedPianoScoreElement[], drumScores?: SavedDrumScoreElement[] }) => Promise<boolean>
  updateNoteTitle: (id: string, title: string) => Promise<boolean>
  deleteNote: (id: string) => Promise<boolean>
  getNoteById: (id: string) => LocalSheetMusicNote | undefined

  // 검색 기능 (새로 추가)
  searchNotes: (userId: string, searchText: string) => Promise<LocalSheetMusicNote[]>

  // Supabase 동기화
  syncToSupabase: (userId: string) => Promise<void>
  syncFromSupabase: (userId: string) => Promise<void>
}

// UUID 형식인지 확인
const isValidUUID = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(id)
}

// 로컬 스토리지에서 노트 가져오기 (오래된 id 형식 자동 마이그레이션)
const getStoredNotes = (): LocalSheetMusicNote[] => {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []

    const notes: LocalSheetMusicNote[] = JSON.parse(stored)
    let needsMigration = false

    // 오래된 id 형식이 있는지 확인하고 마이그레이션
    const migratedNotes = notes.map(note => {
      if (!isValidUUID(note.id)) {
        needsMigration = true
        return { ...note, id: crypto.randomUUID() }
      }
      return note
    })

    // 마이그레이션이 필요했다면 로컬 스토리지 업데이트
    if (needsMigration) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migratedNotes))
      console.log('✅ 로컬 노트 ID 형식 마이그레이션 완료')
    }

    return migratedNotes
  } catch (e) {
    console.error('로컬 스토리지 읽기 오류:', e)
    return []
  }
}

// 로컬 스토리지에 노트 저장
const setStoredNotes = (notes: LocalSheetMusicNote[]) => {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
  } catch (e) {
    console.error('로컬 스토리지 저장 오류:', e)
  }
}

// Supabase 데이터를 LocalSheetMusicNote 형식으로 변환
const convertFromSupabase = (data: Record<string, unknown>): LocalSheetMusicNote => ({
  id: data.id as string,
  user_id: data.user_id as string,
  song_id: data.song_id as string,
  song_name: (data.song_name as string) || '',
  team_name: data.team_name as string | undefined,
  file_url: (data.file_url as string) || '',
  file_type: (data.file_type as 'pdf' | 'image') || 'image',
  title: (data.title as string) || '',
  annotations: (data.annotations as PageAnnotation[]) || [],
  thumbnail_url: data.thumbnail_url as string | undefined,
  created_at: data.created_at as string,
  updated_at: data.updated_at as string,
  deleted_at: data.deleted_at as string | null | undefined,
  songForms: (data.song_forms as string[]) || undefined,
  songFormEnabled: data.song_form_enabled as boolean | undefined,
  songFormStyle: data.song_form_style as SavedSongFormStyle | undefined,
  partTags: (data.part_tags as SavedPartTagStyle[]) || undefined,
  pianoScores: (data.piano_scores as SavedPianoScoreElement[]) || undefined,
  drumScores: (data.drum_scores as SavedDrumScoreElement[]) || undefined,
})

// LocalSheetMusicNote를 Supabase 형식으로 변환
const convertToSupabase = (note: LocalSheetMusicNote) => ({
  id: note.id,
  user_id: note.user_id,
  song_id: note.song_id,
  song_name: note.song_name,
  team_name: note.team_name,
  file_url: note.file_url,
  file_type: note.file_type,
  title: note.title,
  annotations: note.annotations,
  thumbnail_url: note.thumbnail_url,
  deleted_at: note.deleted_at,
  song_forms: note.songForms,
  song_form_enabled: note.songFormEnabled,
  song_form_style: note.songFormStyle,
  part_tags: note.partTags,
  piano_scores: note.pianoScores,
  drum_scores: note.drumScores,
})

export function useSheetMusicNotes(): UseSheetMusicNotesReturn {
  const [notes, setNotes] = useState<LocalSheetMusicNote[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 컴포넌트 마운트 시 로컬 스토리지에서 로드하지 않음
  // fetchNotes 호출 시에만 Supabase에서 가져옴 (Supabase가 source of truth)

  // 사용자의 모든 노트 가져오기 (Supabase 동기화 포함, Soft Delete 지원)
  const fetchNotes = useCallback(async (userId: string) => {
    setLoading(true)
    setError(null)

    try {
      // 1. 먼저 Supabase에서 최신 데이터 가져와서 로컬과 병합
      try {
        console.log('🔄 Supabase에서 노트 조회 중... userId:', userId)
        const { data, error: fetchError } = await supabase
          .from('sheet_music_notes')
          .select('*')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })

        console.log('📥 Supabase 조회 결과:', { count: data?.length || 0, error: fetchError?.message })

        if (fetchError) {
          console.error('❌ Supabase 조회 실패:', fetchError.message, fetchError.details, fetchError.hint)
        }

        if (!fetchError && data) {
          const supabaseNotes = data.map(convertFromSupabase)
          const localNotes = getStoredNotes()
          const otherUserNotes = localNotes.filter(n => n.user_id !== userId)

          // 삭제된 노트 ID 수집 (다른 기기에서 삭제된 것들)
          const deletedNoteIds = new Set(
            supabaseNotes.filter(n => n.deleted_at).map(n => n.id)
          )

          // 활성 노트만 필터링 (deleted_at이 null인 것)
          const activeSupabaseNotes = supabaseNotes.filter(n => !n.deleted_at)

          console.log(`📊 활성 노트: ${activeSupabaseNotes.length}개, 삭제된 노트: ${deletedNoteIds.size}개`)

          const mergedNotes = [...otherUserNotes]
          const processedIds = new Set<string>()

          // Supabase 활성 노트와 로컬 노트 병합 (최신 버전 유지)
          for (const supabaseNote of activeSupabaseNotes) {
            const localNote = localNotes.find(n => n.id === supabaseNote.id)

            if (!localNote || new Date(supabaseNote.updated_at) >= new Date(localNote.updated_at)) {
              mergedNotes.push(supabaseNote)
            } else {
              mergedNotes.push(localNote)
            }
            processedIds.add(supabaseNote.id)
          }

          // 로컬에만 있는 노트 처리
          for (const localNote of localNotes.filter(n => n.user_id === userId)) {
            // Supabase에서 삭제된 노트면 로컬에서도 제거
            if (deletedNoteIds.has(localNote.id)) {
              console.log(`🗑️ 다른 기기에서 삭제된 노트 로컬에서 제거: ${localNote.id}`)
              continue
            }
            // 이미 처리된 노트는 스킵
            if (processedIds.has(localNote.id)) {
              continue
            }
            // Supabase에 없는 로컬 노트는 삭제된 것으로 간주 (source of truth)
          }

          setStoredNotes(mergedNotes)
          console.log(`✅ Supabase에서 ${activeSupabaseNotes.length}개 활성 노트 동기화 완료`)
        }
      } catch (syncErr) {
        console.warn('Supabase 동기화 실패, 로컬 데이터 사용:', syncErr)
      }

      // 2. 병합된 로컬 데이터에서 사용자 노트 반환 (deleted_at이 없는 것만)
      const allNotes = getStoredNotes()
      const userNotes = allNotes
        .filter(note => note.user_id === userId && !note.deleted_at)
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

      setNotes(userNotes)
    } catch (err) {
      console.error('노트 불러오기 오류:', err)
      setError('노트를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  // ID로 노트 가져오기
  const getNoteById = useCallback((id: string): LocalSheetMusicNote | undefined => {
    const allNotes = getStoredNotes()
    return allNotes.find(note => note.id === id)
  }, [])

  // 새 노트 저장
  const saveNote = useCallback(async (
    noteData: Omit<LocalSheetMusicNote, 'id' | 'created_at' | 'updated_at'>
  ): Promise<LocalSheetMusicNote | null> => {
    console.log('🟡 useSheetMusicNotes.saveNote 호출됨:', {
      song_name: noteData.song_name,
      annotationsLength: noteData.annotations?.length,
      strokes: noteData.annotations?.reduce((sum, a) => sum + (a.strokes?.length || 0), 0)
    })

    setLoading(true)
    setError(null)

    try {
      const now = new Date().toISOString()
      const newNote: LocalSheetMusicNote = {
        ...noteData,
        id: crypto.randomUUID(),
        created_at: now,
        updated_at: now,
      }

      // 로컬 스토리지에 저장
      const allNotes = getStoredNotes()
      const updatedNotes = [newNote, ...allNotes]
      setStoredNotes(updatedNotes)

      // 상태 업데이트
      const userNotes = updatedNotes
        .filter(n => n.user_id === noteData.user_id)
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      setNotes(userNotes)

      // Supabase에도 저장 (기기 간 동기화를 위해 필수)
      try {
        const supabaseData = convertToSupabase(newNote)
        console.log('🔄 Supabase 저장 시도:', { id: supabaseData.id, user_id: supabaseData.user_id, song_id: supabaseData.song_id })

        const { data: upsertData, error: upsertError } = await supabase
          .from('sheet_music_notes')
          .upsert(supabaseData)
          .select()

        if (upsertError) {
          console.error('❌ Supabase 저장 실패:', upsertError.message, upsertError.details, upsertError.hint)
        } else {
          console.log('✅ Supabase에 노트 저장 완료:', upsertData)
        }
      } catch (supabaseErr) {
        console.error('❌ Supabase 저장 예외:', supabaseErr)
      }

      return newNote
    } catch (err) {
      console.error('❌ 노트 저장 오류:', err)
      setError('노트 저장에 실패했습니다.')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  // 노트 업데이트
  const updateNote = useCallback(async (
    id: string,
    annotations: PageAnnotation[],
    title?: string,
    extra?: {
      songFormEnabled?: boolean,
      songFormStyle?: SavedSongFormStyle,
      partTags?: SavedPartTagStyle[],
      pianoScores?: SavedPianoScoreElement[],
      drumScores?: SavedDrumScoreElement[]
    }
  ): Promise<boolean> => {
    setLoading(true)
    setError(null)

    try {
      const allNotes = getStoredNotes()
      const noteIndex = allNotes.findIndex(n => n.id === id)

      if (noteIndex === -1) {
        throw new Error('노트를 찾을 수 없습니다.')
      }

      const now = new Date().toISOString()
      allNotes[noteIndex] = {
        ...allNotes[noteIndex],
        annotations,
        ...(title && { title }),
        ...(extra?.songFormEnabled !== undefined && { songFormEnabled: extra.songFormEnabled }),
        ...(extra?.songFormStyle && { songFormStyle: extra.songFormStyle }),
        ...(extra?.partTags && { partTags: extra.partTags }),
        ...(extra?.pianoScores && { pianoScores: extra.pianoScores }),
        ...(extra?.drumScores && { drumScores: extra.drumScores }),
        updated_at: now,
      }

      setStoredNotes(allNotes)
      setNotes(prev => prev.map(n => n.id === id ? allNotes[noteIndex] : n))

      // Supabase에도 업데이트
      try {
        const supabaseData = convertToSupabase(allNotes[noteIndex])
        console.log('🔄 Supabase 업데이트 시도:', { id: supabaseData.id, user_id: supabaseData.user_id })

        const { data: upsertData, error: upsertError } = await supabase
          .from('sheet_music_notes')
          .upsert(supabaseData)
          .select()

        if (upsertError) {
          console.error('❌ Supabase 업데이트 실패:', upsertError.message, upsertError.details, upsertError.hint)
        } else {
          console.log('✅ Supabase에 노트 업데이트 완료:', upsertData)
        }
      } catch (supabaseErr) {
        console.error('❌ Supabase 업데이트 예외:', supabaseErr)
      }

      return true
    } catch (err) {
      console.error('노트 업데이트 오류:', err)
      setError('노트 업데이트에 실패했습니다.')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  // 노트 제목만 업데이트
  const updateNoteTitle = useCallback(async (id: string, title: string): Promise<boolean> => {
    setLoading(true)
    setError(null)

    try {
      const allNotes = getStoredNotes()
      const noteIndex = allNotes.findIndex(n => n.id === id)

      if (noteIndex === -1) {
        throw new Error('노트를 찾을 수 없습니다.')
      }

      const now = new Date().toISOString()
      allNotes[noteIndex] = {
        ...allNotes[noteIndex],
        title,
        updated_at: now,
      }

      setStoredNotes(allNotes)
      setNotes(prev => prev.map(n => n.id === id ? allNotes[noteIndex] : n))

      // Supabase에도 업데이트
      try {
        await supabase.from('sheet_music_notes')
          .update({ title, updated_at: now })
          .eq('id', id)
      } catch (supabaseErr) {
        console.warn('Supabase 업데이트 실패:', supabaseErr)
      }

      return true
    } catch (err) {
      console.error('노트 제목 업데이트 오류:', err)
      setError('노트 제목 업데이트에 실패했습니다.')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  // 노트 삭제 (Soft Delete - 다중 기기 동기화 지원)
  const deleteNote = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true)
    setError(null)

    try {
      const now = new Date().toISOString()

      // 1. Supabase에서 soft delete (deleted_at 업데이트)
      console.log('🗑️ Supabase에서 노트 soft delete 시도:', id)
      const { error: updateError, status } = await supabase
        .from('sheet_music_notes')
        .update({ deleted_at: now })
        .eq('id', id)

      console.log('🗑️ Supabase soft delete 응답:', { status, error: updateError?.message })

      if (updateError) {
        console.error('❌ Supabase soft delete 실패:', updateError.message, updateError.details, updateError.code)
      } else {
        console.log('✅ Supabase에서 노트 soft delete 완료')
      }

      // 2. 로컬 스토리지에서도 삭제 (UI에서 즉시 사라지도록)
      const allNotes = getStoredNotes()
      const updatedNotes = allNotes.filter(n => n.id !== id)
      setStoredNotes(updatedNotes)

      // 3. React 상태 업데이트
      setNotes(prev => prev.filter(n => n.id !== id))

      return true
    } catch (err) {
      console.error('노트 삭제 오류:', err)
      setError('노트 삭제에 실패했습니다.')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  // 검색 기능 (새로 추가)
  const searchNotes = useCallback(async (userId: string, searchText: string): Promise<LocalSheetMusicNote[]> => {
    try {
      const allNotes = getStoredNotes()
      const normalizedSearch = searchText.toLowerCase().replace(/\s+/g, '')

      return allNotes
        .filter(note => {
          if (note.user_id !== userId) return false

          const normalizedSongName = (note.song_name || '').toLowerCase().replace(/\s+/g, '')
          const normalizedTeamName = (note.team_name || '').toLowerCase().replace(/\s+/g, '')
          const normalizedTitle = (note.title || '').toLowerCase().replace(/\s+/g, '')

          return normalizedSongName.includes(normalizedSearch) ||
                 normalizedTeamName.includes(normalizedSearch) ||
                 normalizedTitle.includes(normalizedSearch)
        })
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    } catch (err) {
      console.error('노트 검색 오류:', err)
      return []
    }
  }, [])

  // Supabase로 동기화 (로컬 → Supabase, 활성 노트만)
  const syncToSupabase = useCallback(async (userId: string) => {
    setLoading(true)
    try {
      const allNotes = getStoredNotes()
      // 활성 노트만 동기화 (deleted_at이 없는 것)
      const userNotes = allNotes.filter(n => n.user_id === userId && !n.deleted_at)

      for (const note of userNotes) {
        await supabase.from('sheet_music_notes').upsert(convertToSupabase(note))
      }

      console.log(`✅ ${userNotes.length}개 활성 노트를 Supabase에 동기화했습니다.`)
    } catch (err) {
      console.error('Supabase 동기화 오류:', err)
      setError('Supabase 동기화에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Supabase에서 동기화 (Supabase → 로컬, Soft Delete 지원)
  const syncFromSupabase = useCallback(async (userId: string) => {
    setLoading(true)
    try {
      const { data, error: fetchError } = await supabase
        .from('sheet_music_notes')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })

      if (fetchError) throw fetchError

      if (data) {
        const supabaseNotes = data.map(convertFromSupabase)

        // 삭제된 노트 ID 수집
        const deletedNoteIds = new Set(
          supabaseNotes.filter(n => n.deleted_at).map(n => n.id)
        )

        // 활성 노트만 필터링
        const activeSupabaseNotes = supabaseNotes.filter(n => !n.deleted_at)

        // 로컬 노트와 병합 (Supabase가 source of truth)
        const localNotes = getStoredNotes()
        const otherUserNotes = localNotes.filter(n => n.user_id !== userId)

        const mergedNotes = [...otherUserNotes]

        for (const supabaseNote of activeSupabaseNotes) {
          const localNote = localNotes.find(n => n.id === supabaseNote.id)

          if (!localNote || new Date(supabaseNote.updated_at) > new Date(localNote.updated_at)) {
            mergedNotes.push(supabaseNote)
          } else {
            mergedNotes.push(localNote)
          }
        }

        // Supabase가 source of truth이므로 로컬에만 있는 노트는 삭제된 것으로 간주
        // 삭제된 노트(deleted_at이 있는 것)는 로컬에서도 제거됨

        setStoredNotes(mergedNotes)
        setNotes(mergedNotes.filter(n => n.user_id === userId && !n.deleted_at))

        console.log(`✅ Supabase에서 ${activeSupabaseNotes.length}개 활성 노트를 동기화했습니다.`)
      }
    } catch (err) {
      console.error('Supabase에서 동기화 오류:', err)
      setError('Supabase에서 동기화에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    notes,
    loading,
    error,
    fetchNotes,
    saveNote,
    updateNote,
    updateNoteTitle,
    deleteNote,
    getNoteById,
    searchNotes,
    syncToSupabase,
    syncFromSupabase,
  }
}
