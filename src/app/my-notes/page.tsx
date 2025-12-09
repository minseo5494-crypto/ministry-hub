'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, Song, SheetMusicNote } from '@/lib/supabase'
import { useSheetMusicNotes } from '@/hooks/useSheetMusicNotes'
import SheetMusicEditor from '@/components/SheetMusicEditor'

export default function MyNotesPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [songs, setSongs] = useState<{ [key: string]: Song }>({})

  // 에디터 상태
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<SheetMusicNote | null>(null)
  const [editingSong, setEditingSong] = useState<Song | null>(null)

  const {
    notes,
    loading: notesLoading,
    error,
    fetchNotes,
    updateNote,
    deleteNote,
  } = useSheetMusicNotes()

  // 사용자 인증 확인
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)
      fetchNotes(user.id)
      setLoading(false)
    }

    checkUser()
  }, [router, fetchNotes])

  // 노트에 연결된 곡 정보 가져오기
  useEffect(() => {
    const fetchSongInfo = async () => {
      if (notes.length === 0) return

      const songIds = [...new Set(notes.map((n) => n.song_id))]

      const { data } = await supabase
        .from('songs')
        .select('*')
        .in('id', songIds)

      if (data) {
        const songMap: { [key: string]: Song } = {}
        data.forEach((song) => {
          songMap[song.id] = song
        })
        setSongs(songMap)
      }
    }

    fetchSongInfo()
  }, [notes])

  // 노트 열기
  const handleOpenNote = useCallback((note: SheetMusicNote) => {
    const song = songs[note.song_id]
    if (!song) {
      alert('곡 정보를 찾을 수 없습니다.')
      return
    }

    setEditingNote(note)
    setEditingSong(song)
    setEditorOpen(true)
  }, [songs])

  // 노트 저장
  const handleSaveNote = useCallback(async (annotations: any[]) => {
    if (!editingNote) return

    const success = await updateNote(editingNote.id, annotations)
    if (success) {
      alert('저장되었습니다!')
      setEditorOpen(false)
      setEditingNote(null)
      setEditingSong(null)
    }
  }, [editingNote, updateNote])

  // 노트 삭제
  const handleDeleteNote = useCallback(async (noteId: string) => {
    if (!confirm('이 필기 노트를 삭제하시겠습니까?')) return

    const success = await deleteNote(noteId)
    if (success) {
      alert('삭제되었습니다.')
    }
  }, [deleteNote])

  // 에디터 닫기
  const handleCloseEditor = useCallback(() => {
    setEditorOpen(false)
    setEditingNote(null)
    setEditingSong(null)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                ←
              </button>
              <h1 className="text-xl font-bold text-gray-900">내 필기 노트</h1>
            </div>
          </div>
        </div>
      </header>

      {/* 본문 */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {notesLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📝</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              아직 필기 노트가 없습니다
            </h2>
            <p className="text-gray-500 mb-6">
              악보에서 &apos;필기&apos; 버튼을 눌러 노트를 만들어보세요
            </p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              악보 보러가기
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {notes.map((note) => {
              const song = songs[note.song_id]
              return (
                <div
                  key={note.id}
                  className="bg-white rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* 썸네일 */}
                  <div
                    className="h-48 bg-gray-200 flex items-center justify-center cursor-pointer"
                    onClick={() => handleOpenNote(note)}
                  >
                    {note.thumbnail_url ? (
                      <img
                        src={note.thumbnail_url}
                        alt={note.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-gray-400 text-center">
                        <div className="text-4xl mb-2">📄</div>
                        <div className="text-sm">미리보기 없음</div>
                      </div>
                    )}
                  </div>

                  {/* 정보 */}
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {note.title}
                    </h3>
                    <p className="text-sm text-gray-500 truncate">
                      {song?.song_name || '알 수 없는 곡'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {note.updated_at
                        ? new Date(note.updated_at).toLocaleDateString('ko-KR')
                        : ''}
                    </p>

                    {/* 액션 버튼 */}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleOpenNote(note)}
                        className="flex-1 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        열기
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="px-3 py-2 bg-gray-100 text-gray-600 text-sm rounded hover:bg-red-100 hover:text-red-600"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* 에디터 모달 */}
      {editorOpen && editingSong && editingNote && (
        <SheetMusicEditor
          fileUrl={editingSong.file_url || ''}
          fileType={editingSong.file_type === 'pdf' ? 'pdf' : 'image'}
          songName={editingSong.song_name}
          initialAnnotations={editingNote.annotations}
          onSave={handleSaveNote}
          onClose={handleCloseEditor}
        />
      )}
    </div>
  )
}
