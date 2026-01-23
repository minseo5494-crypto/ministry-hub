'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { Song } from '@/lib/supabase'
import {
  ArrowLeft, Music, CheckCircle, Shield, Tag,
  Search, Check, X, ChevronLeft, ChevronRight,
  FileText, Eye, Edit2, User, Calendar, Lock, Globe, Users,
  Save, Trash2, ExternalLink, Filter
} from 'lucide-react'

// 사용자 정보가 포함된 확장 Song 타입
interface SongWithUploader extends Song {
  uploader?: {
    id: string
    email: string
    name?: string
  }
  shared_with_teams?: string[]
}

type TabType = 'approvals' | 'all-songs' | 'official-songs' | 'song-editor'

const TABS: { id: TabType; label: string; icon: any }[] = [
  { id: 'approvals', label: '곡 승인', icon: CheckCircle },
  { id: 'all-songs', label: '전체 곡', icon: FileText },
  { id: 'official-songs', label: '공식 악보', icon: Shield },
  { id: 'song-editor', label: '곡 데이터 편집', icon: Tag },
]

// 🔍 텍스트 정규화 함수 (띄어쓰기, 특수문자 제거, 소문자 변환)
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/\([a-g][#b]?m?\)/gi, '')  // 키 표시 제거 (C), (D#), (Am), (Bb) 등
    .replace(/\s+/g, '')  // 모든 공백 제거
    .replace(/[^\w가-힣]/g, '')  // 특수문자 제거 (한글, 영문, 숫자만 유지)
}

export default function ContentManagementPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('all-songs')

  // 공통 상태
  const [songs, setSongs] = useState<SongWithUploader[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const pageSize = 20

  // 필터 상태 (전체 곡 탭용)
  const [songTypeFilter, setSongTypeFilter] = useState<'all' | 'official' | 'user'>('all')
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'teams' | 'private'>('all')
  const [hiddenFilter, setHiddenFilter] = useState<'all' | 'hidden' | 'visible'>('all')
  const [uploaderFilter, setUploaderFilter] = useState<string>('all')
  const [uploaders, setUploaders] = useState<{ id: string; email: string }[]>([])
  const [showFilters, setShowFilters] = useState(false)

  // 처리 중 상태
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())

  // 편집 모달 상태
  const [editingSong, setEditingSong] = useState<SongWithUploader | null>(null)
  const [editForm, setEditForm] = useState({
    song_name: '',
    team_name: '',
    key: '',
    bpm: '',
    themes: '',
    visibility: 'public' as 'private' | 'teams' | 'public',
    is_official: false,
  })
  const [saving, setSaving] = useState(false)

  // 삭제 확인 모달
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // 다중 선택 상태
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false)

  // 토스트
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // 곡 데이터 편집 탭 상태
  const [editorSongs, setEditorSongs] = useState<Song[]>([])
  const [editorSearchQuery, setEditorSearchQuery] = useState('')
  const [editorPage, setEditorPage] = useState(1)
  const [selectedSongId, setSelectedSongId] = useState<string>('')
  const [selectedSong, setSelectedSong] = useState<Song | null>(null)
  const [fullLyrics, setFullLyrics] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [editorSaving, setEditorSaving] = useState(false)
  const [editorFilter, setEditorFilter] = useState<'all' | 'no-lyrics' | 'no-youtube'>('all')
  const editorItemsPerPage = 15

  useEffect(() => {
    checkAdminAndLoad()
  }, [])

  // 탭이나 검색어 변경 시 페이지 리셋 및 데이터 로드
  useEffect(() => {
    if (!loading) {
      setPage(1)
      loadData()
    }
  }, [activeTab, searchQuery, loading])

  // 필터 변경 시 페이지 리셋 및 데이터 로드
  useEffect(() => {
    if (!loading && activeTab === 'all-songs') {
      setPage(1)
      loadData()
    }
  }, [songTypeFilter, visibilityFilter, hiddenFilter, uploaderFilter])

  // 업로더 목록 로드
  useEffect(() => {
    if (!loading) {
      loadUploaders()
    }
  }, [loading])

  // 페이지 변경 시 데이터만 로드 (리셋 없이)
  useEffect(() => {
    if (!loading && page > 1) {
      loadData()
    }
  }, [page])

  const loadUploaders = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email')
        .order('email')
      if (!error && data) {
        setUploaders(data)
      }
    } catch (err) {
      console.error('Failed to load uploaders:', err)
    }
  }

  const checkAdminAndLoad = async () => {
    try {
      const user = await getCurrentUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: userData, error } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (error || !userData?.is_admin) {
        router.push('/')
        return
      }
    } catch (error) {
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  const loadData = async () => {
    switch (activeTab) {
      case 'approvals':
        await loadPendingSongs()
        break
      case 'all-songs':
        await loadAllSongs()
        break
      case 'official-songs':
        await loadOfficialSongs()
        break
      case 'song-editor':
        await loadEditorSongs()
        break
    }
  }

  // 클라이언트 측 검색 필터 함수
  const filterBySearch = (data: SongWithUploader[], query: string): SongWithUploader[] => {
    if (!query.trim()) return data

    const normalizedQuery = normalizeText(query)
    const queryLower = query.toLowerCase()

    return data.filter(song => {
      const normalizedSongName = normalizeText(song.song_name || '')
      const normalizedTeamName = normalizeText(song.team_name || '')
      const songNameLower = (song.song_name || '').toLowerCase()
      const teamNameLower = (song.team_name || '').toLowerCase()

      // 정규화된 검색 (띄어쓰기 무시)
      const normalizedMatch = normalizedSongName.includes(normalizedQuery) ||
                              normalizedTeamName.includes(normalizedQuery)

      // 일반 검색 (원본 텍스트)
      const regularMatch = songNameLower.includes(queryLower) ||
                           teamNameLower.includes(queryLower)

      return normalizedMatch || regularMatch
    })
  }

  const loadPendingSongs = async () => {
    // 검색어가 있을 때는 전체를 가져와서 클라이언트에서 필터링
    if (searchQuery.trim()) {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('upload_status', 'pending')
        .order('created_at', { ascending: false })
        .limit(500)

      if (!error && data) {
        const filtered = filterBySearch(data, searchQuery)
        const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)
        setSongs(paginated)
        setTotalCount(filtered.length)
      }
    } else {
      // 검색어가 없을 때는 기존 방식
      const { data, count, error } = await supabase
        .from('songs')
        .select('*', { count: 'exact' })
        .eq('upload_status', 'pending')
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1)

      if (!error) {
        setSongs(data || [])
        setTotalCount(count || 0)
      }
    }
  }

  const loadAllSongs = async () => {
    // 필터 적용 함수
    const applyFilters = (data: Song[]): Song[] => {
      let result = data

      // 곡 유형 필터
      if (songTypeFilter === 'official') {
        result = result.filter(s => s.is_official === true)
      } else if (songTypeFilter === 'user') {
        result = result.filter(s => s.is_user_uploaded === true)
      }

      // 공개 범위 필터
      if (visibilityFilter !== 'all') {
        result = result.filter(s => s.visibility === visibilityFilter)
      }

      // 숨김 상태 필터
      if (hiddenFilter === 'hidden') {
        result = result.filter(s => s.is_hidden === true)
      } else if (hiddenFilter === 'visible') {
        result = result.filter(s => !s.is_hidden)
      }

      // 업로더 필터
      if (uploaderFilter !== 'all') {
        result = result.filter(s => s.uploaded_by === uploaderFilter)
      }

      return result
    }

    // 검색어 또는 필터가 있을 때는 전체를 가져와서 클라이언트에서 필터링
    const hasFilters = songTypeFilter !== 'all' || visibilityFilter !== 'all' || hiddenFilter !== 'all' || uploaderFilter !== 'all'

    if (searchQuery.trim() || hasFilters) {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(2000)

      if (!error && data) {
        let filtered = applyFilters(data)
        if (searchQuery.trim()) {
          filtered = filterBySearch(filtered, searchQuery)
        }
        const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

        // 업로더 정보 가져오기
        const uploaderIds = [...new Set(paginated.map(s => s.uploaded_by).filter(Boolean))]

        if (uploaderIds.length > 0) {
          const { data: users } = await supabase
            .from('users')
            .select('id, email, name')
            .in('id', uploaderIds)

          const userMap = new Map(users?.map(u => [u.id, u]) || [])

          const songsWithUploader = paginated.map(song => ({
            ...song,
            uploader: song.uploaded_by ? userMap.get(song.uploaded_by) : undefined
          }))

          setSongs(songsWithUploader)
        } else {
          setSongs(paginated)
        }
        setTotalCount(filtered.length)
      }
    } else {
      // 검색어/필터가 없을 때는 기존 방식
      const { data, count, error } = await supabase
        .from('songs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1)

      if (!error && data) {
        // 업로더 정보 가져오기
        const uploaderIds = [...new Set(data.map(s => s.uploaded_by).filter(Boolean))]

        if (uploaderIds.length > 0) {
          const { data: users } = await supabase
            .from('users')
            .select('id, email, name')
            .in('id', uploaderIds)

          const userMap = new Map(users?.map(u => [u.id, u]) || [])

          const songsWithUploader = data.map(song => ({
            ...song,
            uploader: song.uploaded_by ? userMap.get(song.uploaded_by) : undefined
          }))

          setSongs(songsWithUploader)
        } else {
          setSongs(data)
        }
        setTotalCount(count || 0)
      }
    }
  }

  const loadOfficialSongs = async () => {
    // 검색어가 있을 때는 전체를 가져와서 클라이언트에서 필터링
    if (searchQuery.trim()) {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('is_official', true)
        .order('created_at', { ascending: false })
        .limit(500)

      if (!error && data) {
        const filtered = filterBySearch(data, searchQuery)
        const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)
        setSongs(paginated)
        setTotalCount(filtered.length)
      }
    } else {
      const { data, count, error } = await supabase
        .from('songs')
        .select('*', { count: 'exact' })
        .eq('is_official', true)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1)

      if (!error) {
        setSongs(data || [])
        setTotalCount(count || 0)
      }
    }
  }

  // 곡 데이터 편집 - 전체 곡 로드
  const loadEditorSongs = async () => {
    const allSongs: Song[] = []
    let offset = 0
    const batchSize = 1000

    while (true) {
      const { data, error } = await supabase
        .from('songs')
        .select('id, song_name, team_name, lyrics, themes, youtube_url')
        .order('song_name', { ascending: true })
        .range(offset, offset + batchSize - 1)

      if (error) break
      if (!data || data.length === 0) break

      allSongs.push(...data)
      if (data.length < batchSize) break
      offset += batchSize
    }

    setEditorSongs(allSongs)

    // 첫 번째 곡 자동 선택
    if (allSongs.length > 0 && !selectedSongId) {
      setSelectedSongId(allSongs[0].id)
      loadSongDetails(allSongs[0])
    }
  }

  // 곡 상세 정보 로드
  const loadSongDetails = (song: Song) => {
    setSelectedSong(song)
    setFullLyrics(song.lyrics || '')
    setYoutubeUrl((song as any).youtube_url || '')
  }

  // 곡 데이터 저장
  const handleEditorSave = async () => {
    if (!selectedSongId || editorSaving) return

    setEditorSaving(true)

    try {
      const { error } = await supabase
        .from('songs')
        .update({
          lyrics: fullLyrics.trim() || null,
          youtube_url: youtubeUrl.trim() || null
        })
        .eq('id', selectedSongId)

      if (error) throw error

      showToast('저장되었습니다!', 'success')

      // 목록 새로고침 및 다음 곡으로 이동
      setTimeout(() => {
        goToNextEditorSong()
        loadEditorSongs()
      }, 500)

    } catch (error) {
      console.error('Error saving:', error)
      showToast('저장 중 오류가 발생했습니다.', 'error')
    } finally {
      setEditorSaving(false)
    }
  }

  // 곡 선택
  const handleEditorSongSelect = (songId: string) => {
    const song = editorSongs.find(s => s.id === songId)
    if (song) {
      setSelectedSongId(songId)
      loadSongDetails(song)
    }
  }

  // 필터링된 에디터 곡 목록
  const filteredEditorSongs = editorSongs.filter(song => {
    // 필터 적용
    if (editorFilter === 'no-lyrics' && song.lyrics) return false
    if (editorFilter === 'no-youtube' && (song as any).youtube_url) return false

    // 검색어 적용
    if (!editorSearchQuery.trim()) return true
    const query = editorSearchQuery.replace(/\s/g, '').toLowerCase()
    const songName = (song.song_name || '').replace(/\s/g, '').toLowerCase()
    const teamName = (song.team_name || '').replace(/\s/g, '').toLowerCase()
    return songName.includes(query) || teamName.includes(query)
  })

  // 에디터 페이지네이션
  const editorTotalPages = Math.ceil(filteredEditorSongs.length / editorItemsPerPage)
  const editorStartIndex = (editorPage - 1) * editorItemsPerPage
  const paginatedEditorSongs = filteredEditorSongs.slice(editorStartIndex, editorStartIndex + editorItemsPerPage)

  // 현재 곡 인덱스
  const currentEditorIndex = filteredEditorSongs.findIndex(s => s.id === selectedSongId)

  // 이전/다음 곡
  const goToPrevEditorSong = () => {
    if (currentEditorIndex > 0) {
      const prevSong = filteredEditorSongs[currentEditorIndex - 1]
      setSelectedSongId(prevSong.id)
      loadSongDetails(prevSong)
    }
  }

  const goToNextEditorSong = () => {
    if (currentEditorIndex < filteredEditorSongs.length - 1) {
      const nextSong = filteredEditorSongs[currentEditorIndex + 1]
      setSelectedSongId(nextSong.id)
      loadSongDetails(nextSong)
    }
  }

  // 곡 승인
  const approveSong = async (songId: string) => {
    setProcessingIds(prev => new Set(prev).add(songId))

    const { error } = await supabase
      .from('songs')
      .update({ upload_status: 'completed' })
      .eq('id', songId)

    if (!error) {
      showToast('곡이 승인되었습니다.', 'success')
      loadData()
    } else {
      showToast('승인 중 오류가 발생했습니다.', 'error')
    }

    setProcessingIds(prev => {
      const next = new Set(prev)
      next.delete(songId)
      return next
    })
  }

  // 곡 거절
  const rejectSong = async (songId: string) => {
    setProcessingIds(prev => new Set(prev).add(songId))

    const { error } = await supabase
      .from('songs')
      .delete()
      .eq('id', songId)

    if (!error) {
      showToast('곡이 거절/삭제되었습니다.', 'success')
      loadData()
    } else {
      showToast('처리 중 오류가 발생했습니다.', 'error')
    }

    setProcessingIds(prev => {
      const next = new Set(prev)
      next.delete(songId)
      return next
    })
  }

  // 공식곡 지정/해제
  const toggleOfficial = async (song: Song) => {
    setProcessingIds(prev => new Set(prev).add(song.id))

    const { error } = await supabase
      .from('songs')
      .update({ is_official: !song.is_official })
      .eq('id', song.id)

    if (!error) {
      showToast(song.is_official ? '공식곡 해제됨' : '공식곡으로 지정됨', 'success')
      loadData()
    }

    setProcessingIds(prev => {
      const next = new Set(prev)
      next.delete(song.id)
      return next
    })
  }

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // 다중 선택 토글
  const toggleSelection = (songId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(songId)) {
        next.delete(songId)
      } else {
        next.add(songId)
      }
      return next
    })
  }

  // 전체 선택/해제
  const toggleSelectAll = () => {
    if (selectedIds.size === songs.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(songs.map(s => s.id)))
    }
  }

  // 일괄 공식 악보로 변경
  const bulkSetOfficial = async () => {
    if (selectedIds.size === 0) return

    const ids = Array.from(selectedIds)
    const { error } = await supabase
      .from('songs')
      .update({ is_official: true })
      .in('id', ids)

    if (!error) {
      showToast(`${ids.length}개 곡이 공식 악보로 변경되었습니다.`, 'success')
      setSelectedIds(new Set())
      loadData()
    } else {
      showToast('변경 중 오류가 발생했습니다.', 'error')
    }
  }

  // 일괄 사용자 곡으로 변경
  const bulkSetUser = async () => {
    if (selectedIds.size === 0) return

    const ids = Array.from(selectedIds)
    const { error } = await supabase
      .from('songs')
      .update({ is_official: false, is_user_uploaded: true })
      .in('id', ids)

    if (!error) {
      showToast(`${ids.length}개 곡이 사용자 곡으로 변경되었습니다.`, 'success')
      setSelectedIds(new Set())
      loadData()
    } else {
      showToast('변경 중 오류가 발생했습니다.', 'error')
    }
  }

  // 일괄 삭제
  const bulkDelete = async () => {
    if (selectedIds.size === 0) return

    const ids = Array.from(selectedIds)
    const { error } = await supabase
      .from('songs')
      .delete()
      .in('id', ids)

    if (!error) {
      showToast(`${ids.length}개 곡이 삭제되었습니다.`, 'success')
      setSelectedIds(new Set())
      setShowBulkDeleteModal(false)
      loadData()
    } else {
      showToast('삭제 중 오류가 발생했습니다.', 'error')
    }
  }

  // 일괄 숨김처리
  const bulkHide = async () => {
    if (selectedIds.size === 0) return

    const ids = Array.from(selectedIds)
    const { error } = await supabase
      .from('songs')
      .update({ is_hidden: true })
      .in('id', ids)

    if (!error) {
      showToast(`${ids.length}개 곡이 숨김 처리되었습니다.`, 'success')
      setSelectedIds(new Set())
      loadData()
    } else {
      showToast('숨김 처리 중 오류가 발생했습니다.', 'error')
    }
  }

  // 일괄 숨김해제
  const bulkUnhide = async () => {
    if (selectedIds.size === 0) return

    const ids = Array.from(selectedIds)
    const { error } = await supabase
      .from('songs')
      .update({ is_hidden: false })
      .in('id', ids)

    if (!error) {
      showToast(`${ids.length}개 곡의 숨김이 해제되었습니다.`, 'success')
      setSelectedIds(new Set())
      loadData()
    } else {
      showToast('숨김 해제 중 오류가 발생했습니다.', 'error')
    }
  }

  // 편집 모달 열기
  const openEditModal = (song: SongWithUploader) => {
    setEditingSong(song)
    setEditForm({
      song_name: song.song_name || '',
      team_name: song.team_name || '',
      key: song.key || '',
      bpm: song.bpm?.toString() || '',
      themes: Array.isArray(song.themes) ? song.themes.join(', ') : (song.themes || ''),
      visibility: song.visibility || 'public',
      is_official: song.is_official || false,
    })
  }

  // 편집 저장
  const saveEdit = async () => {
    if (!editingSong) return

    setSaving(true)

    const { error } = await supabase
      .from('songs')
      .update({
        song_name: editForm.song_name.trim(),
        team_name: editForm.team_name.trim() || null,
        key: editForm.key.trim() || null,
        bpm: editForm.bpm.trim() || null,
        themes: editForm.themes.trim() || null,
        visibility: editForm.visibility,
        is_official: editForm.is_official,
      })
      .eq('id', editingSong.id)

    setSaving(false)

    if (!error) {
      showToast('곡 정보가 수정되었습니다.', 'success')
      setEditingSong(null)
      loadData()
    } else {
      console.error('Song update error:', error)
      showToast(`수정 오류: ${error.message}`, 'error')
    }
  }

  // 삭제 확인
  const confirmDelete = async () => {
    if (!deletingId) return

    setProcessingIds(prev => new Set(prev).add(deletingId))

    const { error } = await supabase
      .from('songs')
      .delete()
      .eq('id', deletingId)

    if (!error) {
      showToast('곡이 삭제되었습니다.', 'success')
      loadData()
    } else {
      showToast('삭제 중 오류가 발생했습니다.', 'error')
    }

    setProcessingIds(prev => {
      const next = new Set(prev)
      next.delete(deletingId)
      return next
    })
    setDeletingId(null)
  }

  // 날짜 포맷
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  // 공개 범위 라벨
  const getVisibilityLabel = (visibility?: string) => {
    switch (visibility) {
      case 'public': return { label: '전체 공개', icon: Globe, color: 'text-blue-600 bg-blue-50' }
      case 'teams': return { label: '팀 공개', icon: Users, color: 'text-violet-600 bg-violet-50' }
      case 'private': return { label: '비공개', icon: Lock, color: 'text-gray-600 bg-gray-100' }
      default: return { label: '전체 공개', icon: Globe, color: 'text-blue-600 bg-blue-50' }
    }
  }

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    setSearchQuery('')
    setPage(1)
    setSelectedIds(new Set()) // 탭 변경 시 선택 초기화
    router.push(`/admin/content-management?tab=${tab}`, { scroll: false })
  }

  const totalPages = Math.ceil(totalCount / pageSize)

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
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">콘텐츠 관리</h1>
              <p className="text-sm text-gray-500">곡 승인, 관리 및 메타데이터 편집</p>
            </div>
          </div>
        </div>

        {/* 탭 네비게이션 */}
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto pb-px">
            {TABS.map(tab => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition ${
                    isActive
                      ? 'border-violet-600 text-violet-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* 곡 데이터 편집 탭 UI */}
        {activeTab === 'song-editor' ? (
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
                    placeholder="곡 또는 팀명 검색..."
                    value={editorSearchQuery}
                    onChange={(e) => {
                      setEditorSearchQuery(e.target.value)
                      setEditorPage(1)
                    }}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                  />
                </div>

                {/* 필터 버튼 */}
                <div className="flex gap-1 mb-4">
                  <button
                    onClick={() => { setEditorFilter('all'); setEditorPage(1) }}
                    className={`flex-1 px-2 py-1.5 text-xs rounded-lg transition ${
                      editorFilter === 'all'
                        ? 'bg-violet-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    전체
                  </button>
                  <button
                    onClick={() => { setEditorFilter('no-lyrics'); setEditorPage(1) }}
                    className={`flex-1 px-2 py-1.5 text-xs rounded-lg transition ${
                      editorFilter === 'no-lyrics'
                        ? 'bg-violet-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    가사 없음
                  </button>
                  <button
                    onClick={() => { setEditorFilter('no-youtube'); setEditorPage(1) }}
                    className={`flex-1 px-2 py-1.5 text-xs rounded-lg transition ${
                      editorFilter === 'no-youtube'
                        ? 'bg-violet-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    유튜브 없음
                  </button>
                </div>

                <p className="text-xs text-gray-500 mb-2">
                  {editorFilter === 'all' ? '전체' : editorFilter === 'no-lyrics' ? '가사 없는 곡' : '유튜브 없는 곡'}: {filteredEditorSongs.length}곡
                </p>

                {/* 곡 목록 */}
                <div className="max-h-[calc(100vh-400px)] overflow-y-auto space-y-1">
                  {paginatedEditorSongs.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-4">
                      {editorSongs.length === 0 ? '곡이 없습니다.' : '검색 결과가 없습니다.'}
                    </p>
                  ) : (
                    paginatedEditorSongs.map((song) => (
                      <button
                        key={song.id}
                        onClick={() => handleEditorSongSelect(song.id)}
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

                {/* 페이지네이션 */}
                {editorTotalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <button
                      onClick={() => setEditorPage(p => Math.max(1, p - 1))}
                      disabled={editorPage <= 1}
                      className="flex items-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition text-sm"
                    >
                      <ChevronLeft size={16} />
                      이전
                    </button>
                    <span className="text-sm text-gray-600">
                      {editorPage} / {editorTotalPages}
                    </span>
                    <button
                      onClick={() => setEditorPage(p => Math.min(editorTotalPages, p + 1))}
                      disabled={editorPage >= editorTotalPages}
                      className="flex items-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition text-sm"
                    >
                      다음
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 오른쪽: 입력 영역 */}
            <div className="lg:col-span-2 space-y-4">
              {selectedSong ? (
                <>
                  {/* 선택된 곡 정보 */}
                  <div className="bg-white rounded-xl shadow-sm border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-bold text-gray-900 truncate">{selectedSong.song_name}</h2>
                        {selectedSong.team_name && (
                          <p className="text-gray-500 truncate">{selectedSong.team_name}</p>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          const query = encodeURIComponent(`${selectedSong.song_name} ${selectedSong.team_name || ''} 가사`)
                          window.open(`https://www.google.com/search?q=${query}`, '_blank')
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition shrink-0"
                      >
                        <Search size={18} />
                        가사 검색
                        <ExternalLink size={14} />
                      </button>
                    </div>
                  </div>

                  {/* 가사 입력 */}
                  <div className="bg-white rounded-xl shadow-sm border p-4">
                    <h3 className="font-semibold text-gray-900 mb-4">가사</h3>
                    <textarea
                      value={fullLyrics}
                      onChange={(e) => setFullLyrics(e.target.value)}
                      placeholder="가사를 입력하세요..."
                      className="w-full h-[450px] p-4 border rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 resize-none font-mono text-sm"
                    />
                  </div>

                  {/* 유튜브 링크 */}
                  <div className="bg-white rounded-xl shadow-sm border p-4">
                    <h3 className="font-semibold text-gray-900 mb-4">유튜브 링크</h3>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        placeholder="https://youtube.com/watch?v=..."
                        className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                      />
                      <button
                        onClick={() => {
                          const query = encodeURIComponent(`${selectedSong?.song_name} ${selectedSong?.team_name || ''}`)
                          window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank')
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition shrink-0"
                      >
                        <Search size={18} />
                        검색
                        <ExternalLink size={14} />
                      </button>
                    </div>
                    {youtubeUrl && (
                      <a
                        href={youtubeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-2 text-sm text-blue-600 hover:underline"
                      >
                        <ExternalLink size={14} />
                        링크 확인
                      </a>
                    )}
                  </div>

                  {/* 저장 버튼 */}
                  <button
                    onClick={handleEditorSave}
                    disabled={editorSaving}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white font-medium rounded-xl transition shadow-lg"
                  >
                    {editorSaving ? (
                      <>저장 중...</>
                    ) : (
                      <>
                        <Save size={20} />
                        저장
                      </>
                    )}
                  </button>
                </>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border p-8 text-center text-gray-500">
                  왼쪽에서 곡을 선택하세요.
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* 다른 탭들 UI */}
            {/* 검색 & 필터 & 정보 */}
            <div className="flex flex-col gap-4 mb-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="곡명 또는 아티스트 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                {activeTab === 'all-songs' && (
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition ${
                      showFilters || songTypeFilter !== 'all' || visibilityFilter !== 'all' || hiddenFilter !== 'all' || uploaderFilter !== 'all'
                        ? 'bg-violet-50 border-violet-300 text-violet-700'
                        : 'bg-white hover:bg-gray-50'
                    }`}
                  >
                    <Filter size={18} />
                    <span>필터</span>
                    {(songTypeFilter !== 'all' || visibilityFilter !== 'all' || hiddenFilter !== 'all' || uploaderFilter !== 'all') && (
                      <span className="ml-1 px-1.5 py-0.5 text-xs bg-violet-600 text-white rounded-full">
                        {[songTypeFilter !== 'all', visibilityFilter !== 'all', hiddenFilter !== 'all', uploaderFilter !== 'all'].filter(Boolean).length}
                      </span>
                    )}
                  </button>
                )}
                <div className="text-sm text-gray-500 self-center">
                  총 {totalCount}곡
                </div>
              </div>

              {/* 필터 패널 (전체 곡 탭에서만) */}
              {activeTab === 'all-songs' && showFilters && (
                <div className="p-4 bg-gray-50 rounded-lg border space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* 곡 유형 필터 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">곡 유형</label>
                      <select
                        value={songTypeFilter}
                        onChange={(e) => setSongTypeFilter(e.target.value as 'all' | 'official' | 'user')}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500 text-base"
                      >
                        <option value="all">전체</option>
                        <option value="official">공식 악보</option>
                        <option value="user">사용자 곡</option>
                      </select>
                    </div>

                    {/* 공개 범위 필터 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">공개 범위</label>
                      <select
                        value={visibilityFilter}
                        onChange={(e) => setVisibilityFilter(e.target.value as 'all' | 'public' | 'teams' | 'private')}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500 text-base"
                      >
                        <option value="all">전체</option>
                        <option value="public">전체 공개</option>
                        <option value="teams">팀 공개</option>
                        <option value="private">나만 보기</option>
                      </select>
                    </div>

                    {/* 숨김 상태 필터 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">숨김 상태</label>
                      <select
                        value={hiddenFilter}
                        onChange={(e) => setHiddenFilter(e.target.value as 'all' | 'hidden' | 'visible')}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500 text-base"
                      >
                        <option value="all">전체</option>
                        <option value="visible">공개 중</option>
                        <option value="hidden">숨겨짐</option>
                      </select>
                    </div>

                    {/* 업로더 필터 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">업로더</label>
                      <select
                        value={uploaderFilter}
                        onChange={(e) => setUploaderFilter(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500 text-base"
                      >
                        <option value="all">전체</option>
                        {uploaders.map(u => (
                          <option key={u.id} value={u.id}>{u.email}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 필터 초기화 버튼 */}
                  {(songTypeFilter !== 'all' || visibilityFilter !== 'all' || hiddenFilter !== 'all' || uploaderFilter !== 'all') && (
                    <div className="flex justify-end">
                      <button
                        onClick={() => {
                          setSongTypeFilter('all')
                          setVisibilityFilter('all')
                          setHiddenFilter('all')
                          setUploaderFilter('all')
                        }}
                        className="text-sm text-violet-600 hover:text-violet-800"
                      >
                        필터 초기화
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 일괄 작업 바 (선택된 항목이 있을 때 표시) */}
        {selectedIds.size > 0 && (
          <div className="mb-4 p-3 bg-violet-50 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-violet-900">
                {selectedIds.size}개 선택됨
              </span>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-sm text-violet-600 hover:text-violet-800"
              >
                선택 해제
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={bulkSetOfficial}
                className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition"
              >
                공식 악보로
              </button>
              <button
                onClick={bulkSetUser}
                className="px-3 py-1.5 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 transition"
              >
                사용자 곡으로
              </button>
              <button
                onClick={bulkHide}
                className="px-3 py-1.5 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600 transition"
              >
                숨김처리
              </button>
              <button
                onClick={bulkUnhide}
                className="px-3 py-1.5 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600 transition"
              >
                숨김해제
              </button>
              <button
                onClick={() => setShowBulkDeleteModal(true)}
                className="px-3 py-1.5 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition"
              >
                삭제
              </button>
            </div>
          </div>
        )}

        {/* 곡 목록 */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {songs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {activeTab === 'approvals' && '승인 대기 중인 곡이 없습니다.'}
              {activeTab === 'all-songs' && '등록된 곡이 없습니다.'}
              {activeTab === 'official-songs' && '공식 곡이 없습니다.'}
            </div>
          ) : activeTab === 'all-songs' ? (
            /* 전체 곡 - 컴팩트 상세 정보 표시 */
            <div className="divide-y">
              {/* 전체 선택 헤더 */}
              <div className="px-3 py-2 bg-violet-100 border-b flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === songs.length && songs.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-violet-700">전체 선택 ({songs.length}곡)</span>
                </label>
              </div>
              {songs.map(song => {
                const visInfo = getVisibilityLabel(song.visibility)
                const VisIcon = visInfo.icon
                return (
                  <div key={song.id} className={`p-3 hover:bg-gray-50 transition ${selectedIds.has(song.id) ? 'bg-violet-50' : ''}`}>
                    <div className="flex items-start gap-3">
                      {/* 체크박스 */}
                      <input
                        type="checkbox"
                        checked={selectedIds.has(song.id)}
                        onChange={() => toggleSelection(song.id)}
                        className="w-4 h-4 mt-1 flex-shrink-0 cursor-pointer"
                      />
                      {/* 곡 정보 */}
                      <div className="flex-1 min-w-0">
                        {/* 첫째 줄: 곡명 + 배지들 */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-medium text-gray-900">{song.song_name}</h3>
                          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] rounded ${visInfo.color}`}>
                            <VisIcon size={10} />
                            {visInfo.label}
                          </span>
                          {song.is_official && (
                            <span className="px-1.5 py-0.5 text-[11px] bg-blue-100 text-blue-700 rounded font-medium">공식</span>
                          )}
                          {song.upload_status && (
                            <span className={`px-1.5 py-0.5 text-[11px] rounded ${
                              song.upload_status === 'completed' ? 'bg-green-100 text-green-700' :
                              song.upload_status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {song.upload_status === 'completed' ? '승인됨' :
                               song.upload_status === 'pending' ? '대기중' : '실패'}
                            </span>
                          )}
                          {song.is_hidden && (
                            <span className="px-1.5 py-0.5 text-[11px] bg-amber-100 text-amber-700 rounded font-medium">숨겨짐</span>
                          )}
                        </div>

                        {/* 둘째 줄: 아티스트 */}
                        <p className="text-sm text-gray-600">{song.team_name || '아티스트 미입력'}</p>

                        {/* 셋째 줄: 업로더, 날짜, 키, BPM, 테마 - 모두 한 줄에 */}
                        <div className="mt-1 flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-gray-500">
                          <span className="inline-flex items-center gap-1">
                            <User size={11} />
                            {song.uploader?.email || '알 수 없음'}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Calendar size={11} />
                            {formatDate(song.created_at)}
                          </span>
                          {song.key && (
                            <span>키: <span className="text-gray-700">{song.key}</span></span>
                          )}
                          {song.bpm && (
                            <span>BPM: <span className="text-gray-700">{song.bpm}</span></span>
                          )}
                          {/* 테마 태그들 */}
                          {song.themes && (Array.isArray(song.themes) ? song.themes : [song.themes]).map((theme, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded text-[11px]">
                              {theme}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* 액션 버튼 */}
                      <div className="flex items-center gap-1 shrink-0">
                        {song.file_url && (
                          <a
                            href={song.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition"
                            title="악보 보기"
                          >
                            <Eye size={16} />
                          </a>
                        )}
                        <button
                          onClick={() => openEditModal(song)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="수정"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => setDeletingId(song.id)}
                          disabled={processingIds.has(song.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                          title="삭제"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* 기본 곡 목록 (다른 탭들) */
            <div className="divide-y">
              {/* 공식 악보 탭에서 전체 선택 헤더 */}
              {activeTab === 'official-songs' && songs.length > 0 && (
                <div className="px-4 py-2 bg-gray-50 border-b flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === songs.length && songs.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 accent-violet-600"
                  />
                  <span className="text-xs text-gray-500">전체 선택</span>
                </div>
              )}
              {songs.map(song => (
                <div key={song.id} className={`p-4 hover:bg-gray-50 transition ${selectedIds.has(song.id) ? 'bg-violet-50' : ''}`}>
                  <div className="flex items-center justify-between gap-4">
                    {/* 공식 악보 탭에서 체크박스 */}
                    {activeTab === 'official-songs' && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(song.id)}
                        onChange={() => toggleSelection(song.id)}
                        className="w-4 h-4 accent-violet-600 flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 truncate">{song.song_name}</h3>
                        {song.is_official && (
                          <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">공식</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 truncate">{song.team_name || '-'}</p>
                      {song.themes && (
                        <p className="text-xs text-violet-600 mt-1">
                          테마: {Array.isArray(song.themes) ? song.themes.join(', ') : song.themes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* 악보 보기 */}
                      {song.file_url && (
                        <a
                          href={song.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition"
                          title="악보 보기"
                        >
                          <Eye size={18} />
                        </a>
                      )}

                      {/* 탭별 액션 버튼 */}
                      {activeTab === 'approvals' && (
                        <>
                          <button
                            onClick={() => approveSong(song.id)}
                            disabled={processingIds.has(song.id)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition disabled:opacity-50"
                            title="승인"
                          >
                            <Check size={18} />
                          </button>
                          <button
                            onClick={() => rejectSong(song.id)}
                            disabled={processingIds.has(song.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                            title="거절"
                          >
                            <X size={18} />
                          </button>
                        </>
                      )}

                      {activeTab === 'official-songs' && (
                        <button
                          onClick={() => toggleOfficial(song)}
                          disabled={processingIds.has(song.id)}
                          className={`px-3 py-1 text-sm rounded-lg transition disabled:opacity-50 ${
                            song.is_official
                              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                          }`}
                        >
                          {song.is_official ? '공식 해제' : '공식 지정'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-sm text-gray-600">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
          </>
        )}
      </div>

      {/* 편집 모달 */}
      {editingSong && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-lg font-bold text-gray-900">곡 정보 수정</h2>
              <p className="text-sm text-gray-500 mt-1">관리자 권한으로 곡 정보를 수정합니다.</p>
            </div>

            <div className="p-6 space-y-4">
              {/* 곡명 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  곡명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editForm.song_name}
                  onChange={(e) => setEditForm({ ...editForm, song_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {/* 아티스트 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">아티스트</label>
                <input
                  type="text"
                  value={editForm.team_name}
                  onChange={(e) => setEditForm({ ...editForm, team_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {/* 키 & BPM */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">키</label>
                  <input
                    type="text"
                    value={editForm.key}
                    onChange={(e) => setEditForm({ ...editForm, key: e.target.value })}
                    placeholder="예: C, G, Em"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">BPM</label>
                  <input
                    type="number"
                    value={editForm.bpm}
                    onChange={(e) => setEditForm({ ...editForm, bpm: e.target.value })}
                    placeholder="예: 120"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>

              {/* 테마 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">테마</label>
                <input
                  type="text"
                  value={editForm.themes}
                  onChange={(e) => setEditForm({ ...editForm, themes: e.target.value })}
                  placeholder="쉼표로 구분 (예: 찬양, 경배, 감사)"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {/* 공개 범위 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">공개 범위</label>
                <div className="flex gap-2">
                  {[
                    { value: 'public', label: '전체 공개', icon: Globe },
                    { value: 'teams', label: '팀 공개', icon: Users },
                    { value: 'private', label: '비공개', icon: Lock },
                  ].map(opt => {
                    const Icon = opt.icon
                    const isSelected = editForm.visibility === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setEditForm({ ...editForm, visibility: opt.value as any })}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border-2 transition ${
                          isSelected
                            ? opt.value === 'public' ? 'border-blue-500 bg-blue-50 text-blue-700' :
                              opt.value === 'teams' ? 'border-violet-500 bg-violet-50 text-violet-700' :
                              'border-gray-500 bg-gray-100 text-gray-700'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <Icon size={16} />
                        <span className="text-sm">{opt.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 공식곡 지정 */}
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                <input
                  type="checkbox"
                  id="is_official"
                  checked={editForm.is_official}
                  onChange={(e) => setEditForm({ ...editForm, is_official: e.target.checked })}
                  className="w-5 h-5 accent-blue-600"
                />
                <label htmlFor="is_official" className="text-sm text-blue-900">
                  <span className="font-medium">공식곡으로 지정</span>
                  <span className="block text-xs text-blue-700">공식곡은 모든 사용자에게 표시됩니다.</span>
                </label>
              </div>

              {/* 업로더 정보 (읽기 전용) */}
              {editingSong.uploader && (
                <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                  <p className="flex items-center gap-2">
                    <User size={14} />
                    업로더: {editingSong.uploader.email}
                  </p>
                  <p className="flex items-center gap-2 mt-1">
                    <Calendar size={14} />
                    업로드: {formatDate(editingSong.created_at)}
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t flex gap-3">
              <button
                onClick={() => setEditingSong(null)}
                className="flex-1 px-4 py-2.5 border rounded-lg hover:bg-gray-50 transition"
              >
                취소
              </button>
              <button
                onClick={saveEdit}
                disabled={saving || !editForm.song_name.trim()}
                className="flex-1 px-4 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:bg-gray-400 transition flex items-center justify-center gap-2"
              >
                {saving ? '저장 중...' : (
                  <>
                    <Save size={18} />
                    저장
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {deletingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="text-red-600" size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">곡 삭제</h3>
              <p className="text-sm text-gray-600 mb-6">
                이 곡을 삭제하시겠습니까?<br />
                삭제된 곡은 복구할 수 없습니다.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 px-4 py-2.5 border rounded-lg hover:bg-gray-50 transition"
              >
                취소
              </button>
              <button
                onClick={confirmDelete}
                disabled={processingIds.has(deletingId)}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition"
              >
                {processingIds.has(deletingId) ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 일괄 삭제 확인 모달 */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="text-red-600" size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">일괄 삭제</h3>
              <p className="text-sm text-gray-600 mb-6">
                선택한 <span className="font-bold text-red-600">{selectedIds.size}개</span> 곡을 삭제하시겠습니까?<br />
                삭제된 곡은 복구할 수 없습니다.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBulkDeleteModal(false)}
                className="flex-1 px-4 py-2.5 border rounded-lg hover:bg-gray-50 transition"
              >
                취소
              </button>
              <button
                onClick={bulkDelete}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 토스트 */}
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
