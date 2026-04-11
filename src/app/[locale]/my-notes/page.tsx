'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, Song, SheetMusicNote } from '@/lib/supabase'
import { useSheetMusicNotes, LocalSheetMusicNote } from '@/hooks/useSheetMusicNotes'
import SheetMusicEditor from '@/components/SheetMusicEditor'
import { Plus, X, Search } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

export default function MyNotesPage() {
  const router = useRouter()
  const t = useTranslations('myNotes')
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [songs, setSongs] = useState<{ [key: string]: Song }>({})

  // 에디터 상태
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<SheetMusicNote | null>(null)
  const [editingSong, setEditingSong] = useState<Song | null>(null)

  // 새 노트 만들기 모달 상태
  const [showNewNoteModal, setShowNewNoteModal] = useState(false)
  const [newNoteTitle, setNewNoteTitle] = useState('')
  const [newNoteType, setNewNoteType] = useState<'empty' | 'song'>('empty')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Song[]>([])
  const [selectedSong, setSelectedSong] = useState<Song | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [creatingNote, setCreatingNote] = useState(false)

  // 새로 생성된 노트를 위한 에디터 상태
  const [newNoteEditorOpen, setNewNoteEditorOpen] = useState(false)
  const [newNoteData, setNewNoteData] = useState<{
    song_id: string
    song_name: string
    team_name?: string
    file_url: string
    file_type: 'pdf' | 'image'
    title: string
  } | null>(null)

  const {
    notes,
    loading: notesLoading,
    error,
    fetchNotes,
    saveNote,
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

      // PostgREST max_rows=1000 제한 우회: 배치 조회
      let allData: any[] = []
      const BATCH_SIZE = 500
      for (let i = 0; i < songIds.length; i += BATCH_SIZE) {
        const batchIds = songIds.slice(i, i + BATCH_SIZE)
        const { data } = await supabase
          .from('songs')
          .select('*')
          .in('id', batchIds)
        if (data) allData = allData.concat(data)
      }

      if (allData.length > 0) {
        const songMap: { [key: string]: Song } = {}
        allData.forEach((song) => {
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
      alert(t('songNotFound'))
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
      alert(t('saved'))
      setEditorOpen(false)
      setEditingNote(null)
      setEditingSong(null)
    }
  }, [editingNote, updateNote])

  // 노트 삭제
  const handleDeleteNote = useCallback(async (noteId: string) => {
    if (!confirm(t('deleteConfirm'))) return

    const success = await deleteNote(noteId)
    if (success) {
      alert(t('deleted'))
    }
  }, [deleteNote])

  // 에디터 닫기
  const handleCloseEditor = useCallback(() => {
    setEditorOpen(false)
    setEditingNote(null)
    setEditingSong(null)
  }, [])

  // 곡 검색
  const handleSearchSongs = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    setSearchLoading(true)
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .or(`song_name.ilike.%${query}%,team_name.ilike.%${query}%`)
        .limit(20)
        .order('song_name')

      if (error) throw error
      setSearchResults(data || [])
    } catch (err) {
      console.error('곡 검색 오류:', err)
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }, [])

  // 새 노트 만들기 모달 초기화
  const openNewNoteModal = useCallback(() => {
    setNewNoteTitle('')
    setNewNoteType('empty')
    setSearchQuery('')
    setSearchResults([])
    setSelectedSong(null)
    setShowNewNoteModal(true)
  }, [])

  // 새 노트 생성
  const handleCreateNote = useCallback(async () => {
    if (!user) return
    if (!newNoteTitle.trim()) {
      alert(t('noteTitleRequired'))
      return
    }
    if (newNoteType === 'song' && !selectedSong) {
      alert(t('selectSongRequired'))
      return
    }

    setCreatingNote(true)
    try {
      if (newNoteType === 'empty') {
        // 빈 노트 생성 - 에디터 없이 바로 저장
        const newNote = await saveNote({
          user_id: user.id,
          song_id: '',
          song_name: newNoteTitle.trim(),
          team_name: '',
          file_url: '',
          file_type: 'image',
          title: newNoteTitle.trim(),
          annotations: [],
        })

        if (newNote) {
          alert(t('noteCreated'))
          setShowNewNoteModal(false)
          fetchNotes(user.id)
        }
      } else if (selectedSong) {
        // 곡 기반 노트 생성 - 에디터 열기
        setNewNoteData({
          song_id: selectedSong.id,
          song_name: selectedSong.song_name,
          team_name: selectedSong.team_name,
          file_url: selectedSong.file_url || '',
          file_type: (selectedSong.file_type as 'pdf' | 'image') || 'image',
          title: newNoteTitle.trim(),
        })
        setShowNewNoteModal(false)
        setNewNoteEditorOpen(true)
      }
    } catch (err) {
      console.error('노트 생성 오류:', err)
      alert(t('noteCreateFailed'))
    } finally {
      setCreatingNote(false)
    }
  }, [user, newNoteTitle, newNoteType, selectedSong, saveNote, fetchNotes])

  // 새 노트 에디터에서 저장
  const handleSaveNewNote = useCallback(async (annotations: any[]) => {
    if (!user || !newNoteData) return

    const savedNote = await saveNote({
      user_id: user.id,
      song_id: newNoteData.song_id,
      song_name: newNoteData.song_name,
      team_name: newNoteData.team_name,
      file_url: newNoteData.file_url,
      file_type: newNoteData.file_type,
      title: newNoteData.title,
      annotations,
    })

    if (savedNote) {
      alert(t('noteSaved'))
      setNewNoteEditorOpen(false)
      setNewNoteData(null)
      fetchNotes(user.id)
    }
  }, [user, newNoteData, saveNote, fetchNotes])

  // 새 노트 에디터 닫기
  const handleCloseNewNoteEditor = useCallback(() => {
    setNewNoteEditorOpen(false)
    setNewNoteData(null)
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
              {/* 뒤로가기 */}
              <button
                onClick={() => router.push('/main')}
                className="p-2 -ml-2 hover:bg-gray-100 rounded-lg"
                title={t('backToMain')}
              >
                <span className="material-symbols-outlined text-xl text-slate-600">arrow_back</span>
              </button>
              {/* 로고 */}
              <Link href="/main" className="text-lg font-logo text-slate-700 hover:text-indigo-600 transition-colors">
                WORSHEEP
              </Link>
              <span className="hidden sm:inline text-slate-300">|</span>
              <h1 className="hidden sm:inline text-lg font-bold text-gray-900">{t('pageTitle')}</h1>
            </div>
            <button
              onClick={openNewNoteModal}
              className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">{t('newNoteDesktop')}</span>
              <span className="sm:hidden">{t('newNoteMobile')}</span>
            </button>
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
              {t('noNotesTitle')}
            </h2>
            <p className="text-gray-500 mb-6">
              {t('noNotesDesc')}
            </p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
            >
              {t('goToSheets')}
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
                        <div className="text-sm">{t('noPreview')}</div>
                      </div>
                    )}
                  </div>

                  {/* 정보 */}
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {note.title}
                    </h3>
                    <p className="text-sm text-gray-500 truncate">
                      {song?.song_name || t('unknownSong')}
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
                        className="flex-1 py-2 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200"
                      >
                        {t('open')}
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="px-3 py-2 bg-gray-100 text-gray-600 text-sm rounded hover:bg-red-100 hover:text-red-600"
                      >
                        {t('delete')}
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

      {/* 새 노트 만들기 모달 */}
      {showNewNoteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">{t('newNoteModalTitle')}</h2>
              <button
                onClick={() => setShowNewNoteModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto">
              {/* 노트 제목 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('noteTitleLabel')}
                </label>
                <input
                  type="text"
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  placeholder={t('noteTitlePlaceholder')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* 노트 유형 선택 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  {t('baseSongLabel')}
                </label>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="noteType"
                      checked={newNoteType === 'empty'}
                      onChange={() => {
                        setNewNoteType('empty')
                        setSelectedSong(null)
                      }}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div>
                      <div className="font-medium">{t('emptyNoteTitle')}</div>
                      <div className="text-sm text-gray-500">{t('emptyNoteDesc')}</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="noteType"
                      checked={newNoteType === 'song'}
                      onChange={() => setNewNoteType('song')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div>
                      <div className="font-medium">{t('songBasedTitle')}</div>
                      <div className="text-sm text-gray-500">{t('songBasedDesc')}</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* 곡 검색 (곡 기반 선택시) */}
              {newNoteType === 'song' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('searchSongs')}
                  </label>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value)
                        handleSearchSongs(e.target.value)
                      }}
                      placeholder={t('searchPlaceholder')}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* 검색 결과 */}
                  {searchLoading ? (
                    <div className="text-center py-4 text-gray-500">{t('searching')}</div>
                  ) : searchResults.length > 0 ? (
                    <div className="max-h-48 overflow-y-auto border rounded-lg">
                      {searchResults.map((song) => (
                        <button
                          key={song.id}
                          onClick={() => setSelectedSong(song)}
                          className={`w-full p-3 text-left hover:bg-gray-50 border-b last:border-b-0 ${
                            selectedSong?.id === song.id ? 'bg-blue-50 border-blue-200' : ''
                          }`}
                        >
                          <div className="font-medium text-gray-900">{song.song_name}</div>
                          <div className="text-sm text-gray-500">
                            {song.team_name} • Key: {song.key || '-'}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : searchQuery ? (
                    <div className="text-center py-4 text-gray-500">{t('noSearchResults')}</div>
                  ) : null}

                  {/* 선택된 곡 표시 */}
                  {selectedSong && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-green-800">{selectedSong.song_name}</div>
                          <div className="text-sm text-green-600">{selectedSong.team_name}</div>
                        </div>
                        <button
                          onClick={() => setSelectedSong(null)}
                          className="text-green-600 hover:text-green-800"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 버튼 */}
            <div className="p-4 border-t flex gap-3 justify-end">
              <button
                onClick={() => setShowNewNoteModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleCreateNote}
                disabled={creatingNote || !newNoteTitle.trim() || (newNoteType === 'song' && !selectedSong)}
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingNote ? t('creating') : t('create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 새 노트 에디터 모달 */}
      {newNoteEditorOpen && newNoteData && (
        <SheetMusicEditor
          fileUrl={newNoteData.file_url}
          fileType={newNoteData.file_type}
          songName={newNoteData.song_name}
          onSave={handleSaveNewNote}
          onClose={handleCloseNewNoteEditor}
        />
      )}
    </div>
  )
}
