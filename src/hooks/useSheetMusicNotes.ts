'use client'

import { useState, useCallback, useEffect } from 'react'
import { PageAnnotation } from '@/lib/supabase'

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
  duration?: 1 | 2 | 4 | 8 | 16  // 음표 길이 (1=온음표, 2=2분음표, 4=4분음표, 8=8분음표, 16=16분음표)
  beamGroup?: string  // 잇단음표 그룹 ID (같은 ID를 가진 음표끼리 연결)
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
  measureWidths?: number[]  // 각 마디 너비 (없으면 균등 분배)
  chordName?: string  // 호환성용, deprecated
  chords?: SavedPianoChord[]  // 코드 배열 (마디당 최대 3개)
  notes: SavedPianoNote[]
  scale?: number  // 크기 조절 (0.5-2.0)
}

// 노트 타입 정의
export interface LocalSheetMusicNote {
  id: string
  user_id: string
  song_id: string
  song_name: string  // 곡 이름 저장
  team_name?: string // 아티스트 이름
  file_url: string   // 원본 파일 URL
  file_type: 'pdf' | 'image'
  title: string
  annotations: PageAnnotation[]
  thumbnail_url?: string
  created_at: string
  updated_at: string
  // 송폼 관련 필드
  songForms?: string[]  // 송폼 배열 (예: ['I', 'V', 'C', 'B'])
  songFormEnabled?: boolean
  songFormStyle?: SavedSongFormStyle
  partTags?: SavedPartTagStyle[]
  // 피아노 악보 필드
  pianoScores?: SavedPianoScoreElement[]
}

interface UseSheetMusicNotesReturn {
  notes: LocalSheetMusicNote[]
  loading: boolean
  error: string | null

  // CRUD 작업
  fetchNotes: (userId: string) => Promise<void>
  fetchNotesBySong: (userId: string, songId: string) => Promise<LocalSheetMusicNote[]>
  saveNote: (note: Omit<LocalSheetMusicNote, 'id' | 'created_at' | 'updated_at'>) => Promise<LocalSheetMusicNote | null>
  updateNote: (id: string, annotations: PageAnnotation[], title?: string, extra?: { songFormEnabled?: boolean, songFormStyle?: SavedSongFormStyle, partTags?: SavedPartTagStyle[], pianoScores?: SavedPianoScoreElement[] }) => Promise<boolean>
  updateNoteTitle: (id: string, title: string) => Promise<boolean>
  deleteNote: (id: string) => Promise<boolean>
  getNoteById: (id: string) => LocalSheetMusicNote | undefined
}

// 로컬 스토리지에서 노트 가져오기
const getStoredNotes = (): LocalSheetMusicNote[] => {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
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

export function useSheetMusicNotes(): UseSheetMusicNotesReturn {
  const [notes, setNotes] = useState<LocalSheetMusicNote[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 컴포넌트 마운트 시 로컬 스토리지에서 로드
  useEffect(() => {
    const stored = getStoredNotes()
    setNotes(stored)
  }, [])

  // 사용자의 모든 노트 가져오기
  const fetchNotes = useCallback(async (userId: string) => {
    setLoading(true)
    setError(null)

    try {
      const allNotes = getStoredNotes()
      const userNotes = allNotes
        .filter(note => note.user_id === userId)
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

      setNotes(userNotes)
    } catch (err) {
      console.error('노트 불러오기 오류:', err)
      setError('노트를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  // 특정 곡의 노트 가져오기
  const fetchNotesBySong = useCallback(async (userId: string, songId: string): Promise<LocalSheetMusicNote[]> => {
    try {
      const allNotes = getStoredNotes()
      return allNotes
        .filter(note => note.user_id === userId && note.song_id === songId)
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    } catch (err) {
      console.error('노트 불러오기 오류:', err)
      return []
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
        id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        created_at: now,
        updated_at: now,
      }

      console.log('🟡 저장할 newNote:', {
        id: newNote.id,
        song_name: newNote.song_name,
        annotationsLength: newNote.annotations?.length
      })

      const allNotes = getStoredNotes()
      console.log('🟡 기존 노트 수:', allNotes.length)

      const updatedNotes = [newNote, ...allNotes]
      setStoredNotes(updatedNotes)
      console.log('🟡 로컬 스토리지에 저장 완료, 총 노트 수:', updatedNotes.length)

      // 현재 사용자의 노트만 상태에 반영
      const userNotes = updatedNotes
        .filter(n => n.user_id === noteData.user_id)
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      setNotes(userNotes)

      console.log('🟡 saveNote 성공, 반환할 newNote:', newNote)
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
    extra?: { songFormEnabled?: boolean, songFormStyle?: SavedSongFormStyle, partTags?: SavedPartTagStyle[], pianoScores?: SavedPianoScoreElement[] }
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
        updated_at: now,
      }

      setStoredNotes(allNotes)

      // 상태 업데이트
      setNotes(prev =>
        prev.map(n => n.id === id ? allNotes[noteIndex] : n)
      )

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

      // 상태 업데이트
      setNotes(prev =>
        prev.map(n => n.id === id ? allNotes[noteIndex] : n)
      )

      return true
    } catch (err) {
      console.error('노트 제목 업데이트 오류:', err)
      setError('노트 제목 업데이트에 실패했습니다.')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  // 노트 삭제
  const deleteNote = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true)
    setError(null)

    try {
      const allNotes = getStoredNotes()
      const updatedNotes = allNotes.filter(n => n.id !== id)
      setStoredNotes(updatedNotes)

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

  return {
    notes,
    loading,
    error,
    fetchNotes,
    fetchNotesBySong,
    saveNote,
    updateNote,
    updateNoteTitle,
    deleteNote,
    getNoteById,
  }
}
