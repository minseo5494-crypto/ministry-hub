'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { Song } from '@/lib/supabase'
import {
  ArrowLeft, Search, Save, ChevronLeft, ChevronRight,
  ToggleLeft, ToggleRight, Plus, X, GripVertical, Check
} from 'lucide-react'

// 섹션 타입 정의
type SectionType =
  | 'Intro' | 'Verse 1' | 'Verse 2' | 'Verse 3' | 'Verse 4'
  | 'Pre-Chorus 1' | 'Pre-Chorus 2' | 'Chorus 1' | 'Chorus 2'
  | 'Bridge' | 'Interlude' | 'Outro'

// 사용 가능한 모든 섹션
const ALL_SECTIONS: SectionType[] = [
  'Intro', 'Verse 1', 'Verse 2', 'Verse 3', 'Verse 4',
  'Pre-Chorus 1', 'Pre-Chorus 2', 'Chorus 1', 'Chorus 2',
  'Bridge', 'Interlude', 'Outro'
]

// 섹션 태그 형식
const SECTION_TAGS: { [key in SectionType]: string } = {
  'Intro': '[Intro]',
  'Verse 1': '[Verse 1]',
  'Verse 2': '[Verse 2]',
  'Verse 3': '[Verse 3]',
  'Verse 4': '[Verse 4]',
  'Pre-Chorus 1': '[Pre-Chorus]',
  'Pre-Chorus 2': '[Pre-Chorus 2]',
  'Chorus 1': '[Chorus]',
  'Chorus 2': '[Chorus 2]',
  'Bridge': '[Bridge]',
  'Interlude': '[Interlude]',
  'Outro': '[Outro]'
}

// 자주 사용하는 테마들
const COMMON_THEMES = [
  '예배', '찬양', '경배', '헌신', '사랑', '은혜', '감사', '신뢰', '소망',
  '위로', '치유', '회개', '성령', '임재', '동행', '연합', '선교', '승리',
  '십자가', '보혈', '정체성', '자녀', '기쁨', '평안', '순종', '겸손', '섬김'
]

// 섹션 데이터 타입
interface SectionData {
  id: string
  type: SectionType
  content: string
}

export default function ThemeEditorPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [songs, setSongs] = useState<Song[]>([])
  const [completedCount, setCompletedCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)

  // 현재 선택된 곡
  const [selectedSongId, setSelectedSongId] = useState<string>('')
  const [selectedSong, setSelectedSong] = useState<Song | null>(null)

  // 검색
  const [searchQuery, setSearchQuery] = useState('')

  // 입력 모드: 'full' | 'parts'
  const [inputMode, setInputMode] = useState<'full' | 'parts'>('full')

  // 전체 입력 모드 가사
  const [fullLyrics, setFullLyrics] = useState('')

  // 파트별 입력 모드 섹션들
  const [sections, setSections] = useState<SectionData[]>([])

  // 테마
  const [themes, setThemes] = useState('')

  // 토스트 메시지
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // 드래그 상태
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  // 섹션 추가 드롭다운
  const [showSectionDropdown, setShowSectionDropdown] = useState(false)

  const dropdownRef = useRef<HTMLDivElement>(null)

  // 관리자 체크 및 데이터 로드
  useEffect(() => {
    checkAdminAndLoad()
  }, [])

  // 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S: 저장
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
      // Ctrl+→: 다음 곡
      if (e.ctrlKey && e.key === 'ArrowRight') {
        e.preventDefault()
        goToNextSong()
      }
      // Ctrl+←: 이전 곡
      if (e.ctrlKey && e.key === 'ArrowLeft') {
        e.preventDefault()
        goToPrevSong()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedSongId, songs, fullLyrics, sections, themes])

  // 드롭다운 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSectionDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const checkAdminAndLoad = async () => {
    try {
      const currentUser = await getCurrentUser()
      if (!currentUser) {
        alert('로그인이 필요합니다.')
        router.push('/login')
        return
      }

      const { data: userData, error } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', currentUser.id)
        .single()

      if (error || !userData?.is_admin) {
        alert('관리자 권한이 필요합니다.')
        router.push('/')
        return
      }

      await loadSongs()
    } catch (error) {
      console.error('Error checking admin:', error)
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  const loadSongs = async () => {
    // themes가 NULL인 곡들 로드
    const { data: nullThemeSongs, error: nullError } = await supabase
      .from('songs')
      .select('id, song_name, team_name, lyrics, themes')
      .is('themes', null)
      .order('song_name', { ascending: true })

    if (nullError) {
      console.error('Error loading songs:', nullError)
      return
    }

    // 전체 곡 수 (themes가 NULL이 아닌 곡)
    const { count: completedCnt } = await supabase
      .from('songs')
      .select('id', { count: 'exact', head: true })
      .not('themes', 'is', null)

    setSongs(nullThemeSongs || [])
    setTotalCount((nullThemeSongs?.length || 0) + (completedCnt || 0))
    setCompletedCount(completedCnt || 0)

    // 첫 번째 곡 자동 선택
    if (nullThemeSongs && nullThemeSongs.length > 0) {
      setSelectedSongId(nullThemeSongs[0].id)
      loadSongDetails(nullThemeSongs[0])
    }
  }

  const loadSongDetails = (song: Song) => {
    setSelectedSong(song)

    // 기존 가사가 있으면 로드
    const existingLyrics = song.lyrics || ''
    setFullLyrics(existingLyrics)

    // 파트별 파싱
    const parsedSections = parseLyricsToSections(existingLyrics)
    setSections(parsedSections)

    // 기존 테마가 있으면 로드
    setThemes(song.themes || '')
  }

  // 가사를 섹션별로 파싱
  const parseLyricsToSections = (lyrics: string): SectionData[] => {
    if (!lyrics.trim()) return []

    const result: SectionData[] = []
    // 모든 섹션 태그 패턴
    const tagPattern = /\[(Intro|Verse \d|Pre-Chorus\s?\d?|Chorus\s?\d?|Bridge|Interlude|Outro)\]/gi

    const parts = lyrics.split(tagPattern)

    let currentSection: SectionType | null = null

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim()
      if (!part) continue

      // 섹션 태그인지 확인
      const matchedSection = ALL_SECTIONS.find(s =>
        s.toLowerCase() === part.toLowerCase() ||
        SECTION_TAGS[s].toLowerCase() === `[${part.toLowerCase()}]`
      )

      if (matchedSection) {
        currentSection = matchedSection
      } else if (currentSection) {
        result.push({
          id: `${currentSection}-${Date.now()}-${Math.random()}`,
          type: currentSection,
          content: part
        })
        currentSection = null
      } else if (part) {
        // 태그 없이 시작하는 가사는 Verse 1으로
        result.push({
          id: `verse1-${Date.now()}-${Math.random()}`,
          type: 'Verse 1',
          content: part
        })
      }
    }

    return result
  }

  // 섹션들을 하나의 문자열로 합치기
  const combineSectionsToLyrics = (sectionList: SectionData[]): string => {
    return sectionList
      .filter(s => s.content.trim())
      .map(s => `${SECTION_TAGS[s.type]}\n${s.content.trim()}`)
      .join('\n\n')
  }

  // 모드 전환
  const handleModeToggle = () => {
    if (inputMode === 'full') {
      // 전체 → 파트별: 파싱
      const parsed = parseLyricsToSections(fullLyrics)
      setSections(parsed.length > 0 ? parsed : [])
      setInputMode('parts')
    } else {
      // 파트별 → 전체: 합치기
      const combined = combineSectionsToLyrics(sections)
      setFullLyrics(combined)
      setInputMode('full')
    }
  }

  // 섹션 추가
  const addSection = (type: SectionType) => {
    setSections([...sections, {
      id: `${type}-${Date.now()}`,
      type,
      content: ''
    }])
    setShowSectionDropdown(false)
  }

  // 섹션 삭제
  const removeSection = (id: string) => {
    setSections(sections.filter(s => s.id !== id))
  }

  // 섹션 내용 변경
  const updateSectionContent = (id: string, content: string) => {
    setSections(sections.map(s => s.id === id ? { ...s, content } : s))
  }

  // 드래그 앤 드롭
  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newSections = [...sections]
    const draggedSection = newSections[draggedIndex]
    newSections.splice(draggedIndex, 1)
    newSections.splice(index, 0, draggedSection)

    setSections(newSections)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  // 테마 버튼 클릭
  const addTheme = (theme: string) => {
    const currentThemes = themes.split(',').map(t => t.trim()).filter(t => t)
    if (!currentThemes.includes(theme)) {
      setThemes(currentThemes.length > 0 ? `${themes}, ${theme}` : theme)
    }
  }

  // 저장
  const handleSave = async () => {
    if (!selectedSongId || saving) return

    setSaving(true)

    try {
      // 가사 결정
      const finalLyrics = inputMode === 'full'
        ? fullLyrics.trim()
        : combineSectionsToLyrics(sections)

      // 테마 정리
      const finalThemes = themes.trim() || null

      const { error } = await supabase
        .from('songs')
        .update({
          lyrics: finalLyrics || null,
          themes: finalThemes
        })
        .eq('id', selectedSongId)

      if (error) throw error

      showToast('저장되었습니다!', 'success')

      // 다음 곡으로 자동 이동
      setTimeout(() => {
        goToNextSong()
        loadSongs() // 목록 새로고침
      }, 500)

    } catch (error) {
      console.error('Error saving:', error)
      showToast('저장 중 오류가 발생했습니다.', 'error')
    } finally {
      setSaving(false)
    }
  }

  // 토스트 표시
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // 이전/다음 곡
  const goToPrevSong = () => {
    const currentIndex = songs.findIndex(s => s.id === selectedSongId)
    if (currentIndex > 0) {
      const prevSong = songs[currentIndex - 1]
      setSelectedSongId(prevSong.id)
      loadSongDetails(prevSong)
    }
  }

  const goToNextSong = () => {
    const currentIndex = songs.findIndex(s => s.id === selectedSongId)
    if (currentIndex < songs.length - 1) {
      const nextSong = songs[currentIndex + 1]
      setSelectedSongId(nextSong.id)
      loadSongDetails(nextSong)
    }
  }

  // 곡 선택
  const handleSongSelect = (songId: string) => {
    const song = songs.find(s => s.id === songId)
    if (song) {
      setSelectedSongId(songId)
      loadSongDetails(song)
    }
  }

  // 필터링된 곡 목록
  const filteredSongs = songs.filter(song => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return (
      song.song_name?.toLowerCase().includes(query) ||
      song.team_name?.toLowerCase().includes(query)
    )
  })

  // 현재 곡 인덱스
  const currentIndex = songs.findIndex(s => s.id === selectedSongId)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/admin/dashboard')}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">가사/테마 편집</h1>
                <p className="text-sm text-gray-500">
                  진행률: {completedCount}/{totalCount} 완료 ({songs.length}곡 남음)
                </p>
              </div>
            </div>

            {/* 단축키 안내 */}
            <div className="hidden md:flex items-center gap-4 text-xs text-gray-400">
              <span>Ctrl+S: 저장</span>
              <span>Ctrl+←/→: 이전/다음</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 왼쪽: 곡 선택 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <h2 className="font-semibold text-gray-900 mb-4">곡 선택</h2>

              {/* 검색 */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="곡 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                />
              </div>

              {/* 곡 목록 */}
              <div className="max-h-[calc(100vh-350px)] overflow-y-auto space-y-1">
                {filteredSongs.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">
                    {songs.length === 0 ? '모든 곡에 테마가 입력되었습니다!' : '검색 결과가 없습니다.'}
                  </p>
                ) : (
                  filteredSongs.map((song, index) => (
                    <button
                      key={song.id}
                      onClick={() => handleSongSelect(song.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition text-sm ${
                        selectedSongId === song.id
                          ? 'bg-violet-100 text-violet-700 font-medium'
                          : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <div className="font-medium truncate">{song.song_name}</div>
                      {song.team_name && (
                        <div className="text-xs text-gray-500 truncate">{song.team_name}</div>
                      )}
                    </button>
                  ))
                )}
              </div>

              {/* 이전/다음 버튼 */}
              <div className="flex gap-2 mt-4 pt-4 border-t">
                <button
                  onClick={goToPrevSong}
                  disabled={currentIndex <= 0}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition text-sm"
                >
                  <ChevronLeft size={16} />
                  이전
                </button>
                <button
                  onClick={goToNextSong}
                  disabled={currentIndex >= songs.length - 1}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition text-sm"
                >
                  다음
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* 오른쪽: 입력 영역 */}
          <div className="lg:col-span-2 space-y-6">
            {selectedSong ? (
              <>
                {/* 선택된 곡 정보 */}
                <div className="bg-white rounded-xl shadow-sm border p-4">
                  <h2 className="text-lg font-bold text-gray-900">{selectedSong.song_name}</h2>
                  {selectedSong.team_name && (
                    <p className="text-gray-500">{selectedSong.team_name}</p>
                  )}
                </div>

                {/* 가사 입력 */}
                <div className="bg-white rounded-xl shadow-sm border p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">가사 입력</h3>

                    {/* 모드 토글 */}
                    <button
                      onClick={handleModeToggle}
                      className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition text-sm"
                    >
                      {inputMode === 'full' ? (
                        <>
                          <ToggleLeft size={18} className="text-gray-500" />
                          <span>전체 입력</span>
                        </>
                      ) : (
                        <>
                          <ToggleRight size={18} className="text-violet-600" />
                          <span className="text-violet-600 font-medium">파트별 입력</span>
                        </>
                      )}
                    </button>
                  </div>

                  {inputMode === 'full' ? (
                    /* 전체 입력 모드 */
                    <textarea
                      value={fullLyrics}
                      onChange={(e) => setFullLyrics(e.target.value)}
                      placeholder="가사를 붙여넣으세요. 섹션 구분이 필요하면 [Verse 1], [Chorus] 등을 직접 입력하세요."
                      className="w-full h-[400px] p-4 border rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 resize-none font-mono text-sm"
                    />
                  ) : (
                    /* 파트별 입력 모드 */
                    <div className="space-y-3">
                      {sections.map((section, index) => (
                        <div
                          key={section.id}
                          draggable
                          onDragStart={() => handleDragStart(index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragEnd={handleDragEnd}
                          className={`border rounded-lg overflow-hidden ${
                            draggedIndex === index ? 'opacity-50' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b">
                            <GripVertical size={16} className="text-gray-400 cursor-grab" />
                            <span className="font-medium text-sm text-gray-700">
                              {SECTION_TAGS[section.type]}
                            </span>
                            <div className="flex-1" />
                            <button
                              onClick={() => removeSection(section.id)}
                              className="p-1 hover:bg-gray-200 rounded transition"
                            >
                              <X size={14} className="text-gray-500" />
                            </button>
                          </div>
                          <textarea
                            value={section.content}
                            onChange={(e) => updateSectionContent(section.id, e.target.value)}
                            placeholder={`${section.type} 가사 입력...`}
                            className="w-full p-3 min-h-[100px] resize-none focus:outline-none text-sm"
                          />
                        </div>
                      ))}

                      {/* 섹션 추가 버튼 */}
                      <div className="relative" ref={dropdownRef}>
                        <button
                          onClick={() => setShowSectionDropdown(!showSectionDropdown)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 hover:border-violet-400 hover:bg-violet-50 rounded-lg transition text-gray-500 hover:text-violet-600"
                        >
                          <Plus size={18} />
                          섹션 추가
                        </button>

                        {showSectionDropdown && (
                          <div className="absolute top-full left-0 right-0 mt-2 bg-white border rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                            {ALL_SECTIONS.map(section => (
                              <button
                                key={section}
                                onClick={() => addSection(section)}
                                className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
                              >
                                {SECTION_TAGS[section]} {section}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 테마 입력 */}
                <div className="bg-white rounded-xl shadow-sm border p-4">
                  <h3 className="font-semibold text-gray-900 mb-4">테마</h3>

                  <input
                    type="text"
                    value={themes}
                    onChange={(e) => setThemes(e.target.value)}
                    placeholder="쉼표로 구분 (예: 사랑, 헌신, 감사)"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 mb-4"
                  />

                  {/* 자주 사용하는 테마 버튼들 */}
                  <div className="flex flex-wrap gap-2">
                    {COMMON_THEMES.map(theme => {
                      const isSelected = themes.split(',').map(t => t.trim()).includes(theme)
                      return (
                        <button
                          key={theme}
                          onClick={() => addTheme(theme)}
                          className={`px-3 py-1 text-sm rounded-full transition ${
                            isSelected
                              ? 'bg-violet-100 text-violet-700 font-medium'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                          }`}
                        >
                          {isSelected && <Check size={12} className="inline mr-1" />}
                          {theme}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 저장 버튼 */}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white font-medium rounded-xl transition shadow-lg"
                >
                  {saving ? (
                    <>저장 중...</>
                  ) : (
                    <>
                      <Save size={20} />
                      저장 (Ctrl+S)
                    </>
                  )}
                </button>
              </>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border p-8 text-center text-gray-500">
                {songs.length === 0
                  ? '🎉 모든 곡에 테마가 입력되었습니다!'
                  : '왼쪽에서 곡을 선택하세요.'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 토스트 메시지 */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-6 py-3 rounded-xl shadow-lg text-white font-medium z-50 ${
          toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
