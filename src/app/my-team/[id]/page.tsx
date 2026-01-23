'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { canEditSetlist } from '@/lib/teamOperations'
import { logSetlistCreate, logSetlistView } from '@/lib/activityLogger'
import {
  ArrowLeft, Plus, Calendar, FileText, Settings,
  Users, Music, ChevronRight, Crown, Search, Edit, Trash2, Copy,
  Pin, Eye, Presentation, Youtube, Download, X, Check, Menu, Filter as FilterIcon, Pencil, Lock
} from 'lucide-react'
import { useMobile } from '@/hooks/useMobile'
import { useSheetMusicNotes, LocalSheetMusicNote } from '@/hooks/useSheetMusicNotes'
import SheetMusicEditor from '@/components/SheetMusicEditor'
import { PageAnnotation } from '@/lib/supabase'
import { useTeamPermissions } from '@/hooks/useTeamPermissions'

interface TeamInfo {
  id: string
  name: string
  type: string
  church_name: string | null
  invite_code: string
  member_count: number
  my_role: string
}

interface Setlist {
  id: string
  title: string
  service_date: string
  service_type: string
  song_count: number
  created_by: string
  created_at: string
  creator_name?: string  // 이름 (우선 표시)
  creator_email?: string
  canEdit?: boolean
}

interface FixedSong {
  id: string
  song_id: string
  category: string
  order_number: number
  song: {
    id: string
    song_name: string
    team_name: string
    key: string
    file_url: string
    file_type: string
    youtube_url?: string
  }
}

export default function TeamDetailPage() {
  const router = useRouter()
  const params = useParams()
  const teamId = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : ''

  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [team, setTeam] = useState<TeamInfo | null>(null)
  const [setlists, setSetlists] = useState<Setlist[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newSetlist, setNewSetlist] = useState({
    title: '',
    service_date: new Date().toISOString().split('T')[0],
    service_type: '주일집회',
    custom_service_type: ''
  })
  const [creating, setCreating] = useState(false)

  // 검색 및 필터 상태
  const [searchTerm, setSearchTerm] = useState('')
  const [serviceTypeFilter, setServiceTypeFilter] = useState('all')
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'created'>('date_desc')

  // 삭제 확인 모달
  const [deleteConfirm, setDeleteConfirm] = useState<{show: boolean, setlistId: string, title: string}>({
    show: false,
    setlistId: '',
    title: ''
  })
  const [deleting, setDeleting] = useState(false)

  // ✅ 빠른 편집 모달
  const [quickEditModal, setQuickEditModal] = useState<{
    show: boolean
    setlistId: string
    title: string
    date: string
    type: string
    customType: string
  }>({
    show: false,
    setlistId: '',
    title: '',
    date: '',
    type: '',
    customType: ''
  })
  const [quickEditing, setQuickEditing] = useState(false)

  // ✅ 복사 중 상태
  const [copying, setCopying] = useState(false)

  // ✅ 고정곡 관련 상태
const [fixedSongs, setFixedSongs] = useState<FixedSong[]>([])
const [selectedFixedSongs, setSelectedFixedSongs] = useState<FixedSong[]>([])
const [showAddFixedSongModal, setShowAddFixedSongModal] = useState(false)
const [fixedSongSearch, setFixedSongSearch] = useState('')
const [availableSongs, setAvailableSongs] = useState<any[]>([])
const [selectedCategory, setSelectedCategory] = useState('여는찬양')
const [customCategory, setCustomCategory] = useState('')
const [previewFixedSong, setPreviewFixedSong] = useState<FixedSong | null>(null)
const [showFixedSongSheet, setShowFixedSongSheet] = useState(false)
const [currentSheetSong, setCurrentSheetSong] = useState<any>(null)
const [youtubeModalSong, setYoutubeModalSong] = useState<any>(null)
const [downloadingFixed, setDownloadingFixed] = useState(false)

// 🆕 필기 노트 에디터 상태 (다중 곡 모드)
const [showNoteEditor, setShowNoteEditor] = useState(false)
const [noteEditorSongs, setNoteEditorSongs] = useState<{
  song_id: string
  song_name: string
  team_name?: string
  file_url: string
  file_type: 'pdf' | 'image'
  songForms?: string[]
}[]>([])
const [noteEditorSetlistTitle, setNoteEditorSetlistTitle] = useState('')

// 🆕 모바일 상태 추가
const [showFilters, setShowFilters] = useState(true)

const isMobile = useMobile()

// 권한 훅 사용
const {
  hasPermission,
  isLeader,
  isAdmin,
  role: userTeamRole,
  loading: permissionsLoading
} = useTeamPermissions(teamId, user?.id)

// 권한 체크 (DB 마이그레이션 전에는 기존 role 기반으로 폴백)
const canCreateSetlist = hasPermission('create_setlist') || team?.my_role === 'leader' || team?.my_role === 'admin'
const canEditSetlistPerm = hasPermission('edit_setlist') || team?.my_role === 'leader' || team?.my_role === 'admin'
const canDeleteSetlist = hasPermission('delete_setlist') || team?.my_role === 'leader' || team?.my_role === 'admin'
const canCopySetlist = hasPermission('copy_setlist') || true  // 복사는 기본 허용
const canAddFixedSong = hasPermission('add_fixed_song') || team?.my_role === 'leader' || team?.my_role === 'admin'
const canEditFixedSong = hasPermission('edit_fixed_song') || team?.my_role === 'leader' || team?.my_role === 'admin'
const canDeleteFixedSong = hasPermission('delete_fixed_song') || team?.my_role === 'leader' || team?.my_role === 'admin'
const canViewSheet = hasPermission('view_sheet') || true  // 악보 보기는 기본 허용
const canDownloadSheet = hasPermission('download_sheet') || true  // 다운로드는 기본 허용
const canManageMembers = hasPermission('manage_members') || team?.my_role === 'leader'
const canEditTeamSettings = hasPermission('edit_team_settings') || team?.my_role === 'leader' || team?.my_role === 'admin'

// 모바일일 때 필터 기본 숨김
useEffect(() => {
  if (isMobile) {
    setShowFilters(false)
  }
}, [isMobile])

const fixedSongCategories = ['여는찬양', '축복송', '마침찬양', '봉헌찬양', '직접입력']

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
  if (user && teamId) {
    fetchTeamInfo()
    fetchSetlists()
    fetchFixedSongs()
  }
  }, [user, teamId])

  const checkUser = async () => {
    try {
      const currentUser = await getCurrentUser()
      if (!currentUser) {
        alert('로그인이 필요합니다.')
        router.push('/login')
        return
      }
      setUser(currentUser)
    } catch (error) {
      console.error('Error checking user:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const fetchTeamInfo = async () => {
    if (!teamId || teamId === 'undefined') {
      console.error('Invalid teamId:', teamId)
      router.push('/my-team')
      return
    }

    try {
      const { data: memberData, error: memberError } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single()

      if (memberError || !memberData) {
        alert('이 팀에 접근 권한이 없습니다.')
        router.push('/my-team')
        return
      }

      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single()

      if (teamError || !teamData) {
        alert('팀 정보를 불러올 수 없습니다.')
        router.push('/my-team')
        return
      }

      setTeam({
        id: teamData.id,
        name: teamData.name,
        type: teamData.type,
        church_name: teamData.church_name,
        invite_code: teamData.invite_code,
        member_count: teamData.member_count || 0,
        my_role: memberData.role
      })
    } catch (error) {
      console.error('Error fetching team info:', error)
      alert('팀 정보를 불러오는데 실패했습니다.')
    }
  }

  const fetchSetlists = async () => {
    if (!teamId || teamId === 'undefined') {
      console.error('Invalid teamId:', teamId)
      return
    }

    try {
      const { data, error } = await supabase
        .from('team_setlists')
        .select(`
          id,
          title,
          service_date,
          service_type,
          created_by,
          created_at,
          users:created_by (name, email)
        `)
        .eq('team_id', teamId)
        .order('service_date', { ascending: false })

      if (error) throw error

      const setlistsWithDetails = await Promise.all(
        (data || []).map(async (setlist: any) => {
          const { count } = await supabase
            .from('team_setlist_songs')
            .select('*', { count: 'exact', head: true })
            .eq('setlist_id', setlist.id)

          const canEdit = await canEditSetlist(teamId, setlist.id, user.id)

          return {
            id: setlist.id,
            title: setlist.title,
            service_date: setlist.service_date,
            service_type: setlist.service_type,
            song_count: count || 0,
            created_by: setlist.created_by,
            created_at: setlist.created_at,
            creator_name: setlist.users?.name,
            creator_email: setlist.users?.email,
            canEdit
          }
        })
      )

      setSetlists(setlistsWithDetails)
    } catch (error) {
      console.error('Error fetching setlists:', error)
    }
  }

  // ✅ 고정곡 가져오기
const fetchFixedSongs = async () => {
  try {
    // 1. 고정곡 목록 가져오기
    const { data: fixedData, error: fixedError } = await supabase
      .from('team_fixed_songs')
      .select('id, song_id, category, order_number')
      .eq('team_id', teamId)
      .order('category')
      .order('order_number')

    if (fixedError) throw fixedError
    if (!fixedData || fixedData.length === 0) {
      setFixedSongs([])
      return
    }

    // 2. 곡 정보 별도로 가져오기
    const songIds = fixedData.map(f => f.song_id)
    const { data: songsData, error: songsError } = await supabase
      .from('songs')
      .select('id, song_name, team_name, key, file_url, file_type, youtube_url')
      .in('id', songIds)

    if (songsError) throw songsError

    // 3. 데이터 합치기
    const combined = fixedData.map(fixed => ({
      ...fixed,
      song: songsData?.find(s => s.id === fixed.song_id) || {
        id: fixed.song_id,
        song_name: '알 수 없는 곡',
        team_name: '',
        key: '',
        file_url: '',
        file_type: '',
        youtube_url: ''
      }
    }))

    setFixedSongs(combined as any)
  } catch (error) {
    console.error('Error fetching fixed songs:', error)
  }
}

// ✅ 고정곡 추가
const handleAddFixedSong = async (song: any) => {
  // 직접입력인 경우 검증
  if (selectedCategory === '직접입력' && !customCategory.trim()) {
    alert('카테고리를 입력하세요.')
    return
  }

  const finalCategory = selectedCategory === '직접입력' ? customCategory.trim() : selectedCategory

  try {
    const { error } = await supabase
      .from('team_fixed_songs')
      .insert({
        team_id: teamId,
        song_id: song.id,
        category: finalCategory,
        created_by: user.id
      })

    if (error) {
      if (error.code === '23505') {
        alert('이미 추가된 고정곡입니다.')
      } else {
        throw error
      }
      return
    }

    alert('✅ 고정곡이 추가되었습니다!')
    setShowAddFixedSongModal(false)
    setFixedSongSearch('')
    fetchFixedSongs()
  } catch (error) {
    console.error('Error adding fixed song:', error)
    alert('고정곡 추가에 실패했습니다.')
  }
}

// ✅ 고정곡 삭제
const handleDeleteFixedSong = async (fixedSongId: string) => {
  if (!confirm('이 고정곡을 삭제하시겠습니까?')) return

  try {
    const { error } = await supabase
      .from('team_fixed_songs')
      .delete()
      .eq('id', fixedSongId)

    if (error) throw error

    alert('✅ 고정곡이 삭제되었습니다.')
    fetchFixedSongs()
  } catch (error) {
    console.error('Error deleting fixed song:', error)
    alert('고정곡 삭제에 실패했습니다.')
  }
}

// ✅ 고정곡 선택 토글
const toggleFixedSongSelection = (fixedSong: FixedSong) => {
  if (selectedFixedSongs.find(s => s.id === fixedSong.id)) {
    setSelectedFixedSongs(selectedFixedSongs.filter(s => s.id !== fixedSong.id))
  } else {
    setSelectedFixedSongs([...selectedFixedSongs, fixedSong])
  }
}

// ✅ 고정곡 검색용 곡 목록 가져오기
const searchSongsForFixed = async (query: string) => {
  if (!query.trim()) {
    setAvailableSongs([])
    return
  }

  try {
    const { data, error } = await supabase
      .from('songs')
      .select('id, song_name, team_name, key, file_url, file_type, youtube_url')
      .or(`song_name.ilike.%${query}%,team_name.ilike.%${query}%`)
      .limit(20)

    if (error) throw error
    setAvailableSongs(data || [])
  } catch (error) {
    console.error('Error searching songs:', error)
  }
}

// ✅ 고정곡 다운로드 (선택된 곡들)
const downloadSelectedFixedSongs = async () => {
  if (selectedFixedSongs.length === 0) {
    alert('다운로드할 곡을 선택하세요.')
    return
  }

  setDownloadingFixed(true)

  try {
    for (const fixedSong of selectedFixedSongs) {
      const song = fixedSong.song
      if (!song.file_url) continue

      const response = await fetch(song.file_url)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${song.song_name}.${song.file_type || 'pdf'}`
      link.click()
      URL.revokeObjectURL(url)

      // 다음 파일 다운로드 전 0.3초 대기
      await new Promise(resolve => setTimeout(resolve, 300))
    }

    alert(`✅ ${selectedFixedSongs.length}개 곡이 다운로드되었습니다!`)
    setSelectedFixedSongs([])
  } catch (error) {
    console.error('Download error:', error)
    alert('다운로드 중 오류가 발생했습니다.')
  } finally {
    setDownloadingFixed(false)
  }
}

// ✅ 선택된 고정곡들 악보 뷰어로 열기
const openSelectedFixedSongsViewer = () => {
  if (selectedFixedSongs.length === 0) {
    alert('악보를 볼 곡을 선택하세요.')
    return
  }

  // 악보가 있는 곡만 필터링
  const songsWithSheet = selectedFixedSongs.filter(fs => fs.song.file_url)

  if (songsWithSheet.length === 0) {
    alert('선택된 곡 중 악보가 있는 곡이 없습니다.')
    return
  }

  // SheetMusicEditor용 형식으로 변환
  const editorSongs = songsWithSheet.map(fs => ({
    song_id: fs.song.id,
    song_name: fs.song.song_name,
    team_name: fs.song.team_name,
    file_url: fs.song.file_url,
    file_type: (fs.song.file_type === 'pdf' ? 'pdf' : 'image') as 'pdf' | 'image',
    songForms: []
  }))

  setNoteEditorSongs(editorSongs)
  setNoteEditorSetlistTitle('고정곡 악보')
  setShowNoteEditor(true)
}

  const handleCreateSetlist = async () => {
    if (!newSetlist.title.trim()) {
      alert('콘티 제목을 입력하세요.')
      return
    }

    if (newSetlist.service_type === '직접입력' && !newSetlist.custom_service_type.trim()) {
      alert('예배 유형을 입력하세요.')
      return
    }

    setCreating(true)

    try {
      const { data, error } = await supabase
        .from('team_setlists')
        .insert({
          team_id: teamId,
          title: newSetlist.title.trim(),
          service_date: newSetlist.service_date,
          service_type: newSetlist.service_type === '직접입력'
            ? newSetlist.custom_service_type.trim()
            : newSetlist.service_type,
          created_by: user.id
        })
        .select()
        .single()

      if (error) throw error

      if (user && data) {
        await logSetlistCreate(
          data.id,
          [],
          teamId,
          user.id
        ).catch(error => {
          console.error('Error logging setlist create:', error)
        })
      }

      alert('✅ 콘티가 생성되었습니다!')
      setShowCreateModal(false)
      setNewSetlist({
        title: '',
        service_date: new Date().toISOString().split('T')[0],
        service_type: '주일집회',
        custom_service_type: ''
      })

      router.push(`/my-team/${teamId}/setlist/${data.id}`)
    } catch (error: any) {
      console.error('Error creating setlist:', error)
      alert(`콘티 생성 실패: ${error.message}`)
    } finally {
      setCreating(false)
    }
  }

  // ✅ 빠른 편집 모달 열기
  const openQuickEditModal = (setlist: Setlist) => {
    setQuickEditModal({
      show: true,
      setlistId: setlist.id,
      title: setlist.title,
      date: setlist.service_date,
      type: setlist.service_type,
      customType: ''
    })
  }

  // ✅ 빠른 편집 저장
  const handleQuickEdit = async () => {
    if (!quickEditModal.title.trim()) {
      alert('콘티 제목을 입력하세요.')
      return
    }

    if (quickEditModal.type === '직접입력' && !quickEditModal.customType.trim()) {
      alert('예배 유형을 입력하세요.')
      return
    }

    setQuickEditing(true)

    try {
      const { error } = await supabase
        .from('team_setlists')
        .update({
          title: quickEditModal.title.trim(),
          service_date: quickEditModal.date,
          service_type: quickEditModal.type === '직접입력'
            ? quickEditModal.customType.trim()
            : quickEditModal.type,
          updated_at: new Date().toISOString()
        })
        .eq('id', quickEditModal.setlistId)

      if (error) throw error

      alert('✅ 수정되었습니다!')
      setQuickEditModal({
        show: false,
        setlistId: '',
        title: '',
        date: '',
        type: '',
        customType: ''
      })
      fetchSetlists() // 목록 새로고침
    } catch (error: any) {
      console.error('Error updating setlist:', error)
      alert(`수정 실패: ${error.message}`)
    } finally {
      setQuickEditing(false)
    }
  }

  // ✅ 콘티 복사 기능 (인도자/관리자용 - 팀 콘티로 복사)
  const handleCopySetlist = async (setlist: Setlist) => {
    if (!confirm(`"${setlist.title}" 콘티를 복사하시겠습니까?`)) return

    setCopying(true)

    try {
      // 1. 새 콘티 생성
      const { data: newSetlist, error: setlistError } = await supabase
        .from('team_setlists')
        .insert({
          team_id: teamId,
          title: `${setlist.title} (복사본)`,
          service_date: new Date().toISOString().split('T')[0], // 오늘 날짜
          service_type: setlist.service_type,
          created_by: user.id
        })
        .select()
        .single()

      if (setlistError) throw setlistError

      // 2. 기존 콘티의 곡들 가져오기
      const { data: songs, error: songsError } = await supabase
        .from('team_setlist_songs')
        .select('*')
        .eq('setlist_id', setlist.id)
        .order('order_number', { ascending: true })

      if (songsError) throw songsError

      // 3. 곡들을 새 콘티에 복사
      if (songs && songs.length > 0) {
        const newSongs = songs.map(song => ({
          setlist_id: newSetlist.id,
          song_id: song.song_id,
          order_number: song.order_number,
          key_transposed: song.key_transposed,
          notes: song.notes,
          selected_form: song.selected_form
        }))

        const { error: insertError } = await supabase
          .from('team_setlist_songs')
          .insert(newSongs)

        if (insertError) throw insertError
      }

      // 4. 로깅
      if (user) {
        await logSetlistCreate(
          newSetlist.id,
          songs?.map(s => s.song_id) || [],
          teamId,
          user.id
        ).catch(error => {
          console.error('Error logging setlist create:', error)
        })
      }

      // alert 제거 - 바로 편집 모달로 이동

      // 5. 복사된 콘티를 바로 편집 모달로 열기 (제목 수정하도록)
      setQuickEditModal({
        show: true,
        setlistId: newSetlist.id,
        title: newSetlist.title,
        date: newSetlist.service_date,
        type: newSetlist.service_type,
        customType: ''
      })

      fetchSetlists() // 목록 새로고침
    } catch (error: any) {
      console.error('Error copying setlist:', error)
      alert(`콘티 복사 실패: ${error.message}`)
    } finally {
      setCopying(false)
    }
  }

  // ✅ 콘티를 내 필기 노트에 복사 (모든 팀원용) - 에디터로 열기
  const { saveNote } = useSheetMusicNotes()

  const handleCopySetlistToNotes = async (setlist: Setlist) => {
    if (!user) {
      alert('로그인이 필요합니다.')
      return
    }

    setCopying(true)

    try {
      // 1. 콘티의 곡들과 악보 정보 가져오기 (selected_form 포함)
      const { data: setlistSongs, error: songsError } = await supabase
        .from('team_setlist_songs')
        .select(`
          *,
          selected_form,
          song:song_id (
            id,
            song_name,
            team_name,
            file_url,
            file_type
          )
        `)
        .eq('setlist_id', setlist.id)
        .order('order_number', { ascending: true })

      if (songsError) throw songsError

      if (!setlistSongs || setlistSongs.length === 0) {
        alert('복사할 곡이 없습니다.')
        return
      }

      // 2. 악보가 있는 곡들만 필터링
      const songsWithSheets = setlistSongs.filter(
        (item: any) => item.song?.file_url
      )

      if (songsWithSheets.length === 0) {
        alert('악보가 있는 곡이 없습니다.')
        return
      }

      // 3. 에디터에 모든 곡을 한번에 전달 (다중 곡 모드)
      const songsForEditor = songsWithSheets.map((item: any) => ({
        song_id: item.song.id,
        song_name: item.song.song_name,
        team_name: item.song.team_name || '',
        file_url: item.song.file_url,
        file_type: item.song.file_type === 'pdf' ? 'pdf' as const : 'image' as const,
        songForms: item.selected_form || []  // 송폼 데이터 포함
      }))

      // 다중 곡 모드로 에디터 열기
      setNoteEditorSongs(songsForEditor)
      setNoteEditorSetlistTitle(setlist.title)
      setShowNoteEditor(true)
    } catch (error: any) {
      console.error('Error copying to notes:', error)
      alert(`복사 실패: ${error.message}`)
    } finally {
      setCopying(false)
    }
  }

  // ✅ 필기 노트 전체 저장 핸들러 (다중 곡 모드)
  const handleSaveAllNotes = async (data: { song: any, annotations: PageAnnotation[], extra?: { songFormEnabled: boolean, songFormStyle: any, partTags: any[] } }[]) => {
    if (!user) return

    console.log('💾 handleSaveAllNotes 호출됨:', data.map(d => ({
      song: d.song.song_name,
      annotationsLength: d.annotations.length,
      strokes: d.annotations.reduce((sum, a) => sum + (a.strokes?.length || 0), 0),
      hasExtra: !!d.extra
    })))

    let savedCount = 0
    for (const item of data) {
      // 실제 필기(strokes) 또는 텍스트가 있는지 체크
      const hasContent = item.annotations.some(
        ann => (ann.strokes?.length || 0) > 0 || (ann.textElements?.length || 0) > 0
      )

      // 필기가 있거나, 단일 곡 모드이면 저장
      if (hasContent || data.length === 1) {
        console.log(`📝 저장 중: ${item.song.song_name}`, item.annotations, item.extra)
        const result = await saveNote({
          user_id: user.id,
          song_id: item.song.song_id,
          song_name: item.song.song_name,
          team_name: item.song.team_name || undefined,
          file_url: item.song.file_url,
          file_type: item.song.file_type,
          title: `${noteEditorSetlistTitle} - ${item.song.song_name}`,
          annotations: item.annotations,
          // 메인 페이지와 동일하게 송폼 관련 데이터 저장
          songForms: item.song.songForms || [],
          songFormEnabled: item.extra?.songFormEnabled ?? ((item.song.songForms?.length || 0) > 0),
          songFormStyle: item.extra?.songFormStyle,
          partTags: item.extra?.partTags,
        })
        if (result) {
          console.log(`✅ 저장 성공: ${item.song.song_name}`)
          savedCount++
        } else {
          console.error(`❌ 저장 실패: ${item.song.song_name}`)
        }
      }
    }

    setShowNoteEditor(false)
    setNoteEditorSongs([])
    setNoteEditorSetlistTitle('')

    if (savedCount > 0) {
      alert(`✅ ${savedCount}개의 필기가 저장되었습니다!\nmy-page > 내 필기 노트에서 확인하세요.`)
    } else {
      alert('저장할 필기가 없습니다.')
    }
  }

  // ✅ 필기 노트 에디터 닫기 핸들러
  const handleCloseNoteEditor = () => {
    if (noteEditorSongs.length > 0) {
      if (!confirm('필기 내용이 저장되지 않습니다. 정말 닫으시겠습니까?')) {
        return
      }
    }
    setShowNoteEditor(false)
    setNoteEditorSongs([])
    setNoteEditorSetlistTitle('')
  }

  const handleDeleteSetlist = async () => {
    if (!deleteConfirm.setlistId) return

    setDeleting(true)
    try {
      const { error: songsError } = await supabase
        .from('team_setlist_songs')
        .delete()
        .eq('setlist_id', deleteConfirm.setlistId)

      if (songsError) throw songsError

      const { error: setlistError } = await supabase
        .from('team_setlists')
        .delete()
        .eq('id', deleteConfirm.setlistId)

      if (setlistError) throw setlistError

      alert('✅ 콘티가 삭제되었습니다.')
      setDeleteConfirm({ show: false, setlistId: '', title: '' })
      fetchSetlists()
    } catch (error: any) {
      console.error('Error deleting setlist:', error)
      alert(`콘티 삭제 실패: ${error.message}`)
    } finally {
      setDeleting(false)
    }
  }

  const filteredSetlists = setlists
    .filter(setlist => {
      const matchesSearch = searchTerm === '' ||
        setlist.title.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesServiceType = serviceTypeFilter === 'all' ||
        setlist.service_type === serviceTypeFilter

      return matchesSearch && matchesServiceType
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'date_desc':
          return new Date(b.service_date).getTime() - new Date(a.service_date).getTime()
        case 'date_asc':
          return new Date(a.service_date).getTime() - new Date(b.service_date).getTime()
        case 'created':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        default:
          return 0
      }
    })

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  if (!team) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          {/* 상단: 뒤로가기 + 팀명 + 햄버거 */}
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <button
                onClick={() => router.push('/my-team')}
                className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition flex-shrink-0"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
                  {team.name}
                </h1>
                {team.church_name && (
                  <p className="text-xs sm:text-sm text-gray-600 truncate">
                    {team.church_name}
                  </p>
                )}
              </div>
            </div>

            {/* 데스크톱: 설정 버튼 */}
            <button
              onClick={() => router.push(`/my-team/${teamId}/settings`)}
              className="hidden md:block p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition flex-shrink-0"
              title="팀 설정"
            >
              <Settings size={20} />
            </button>

            {/* 모바일: 햄버거 메뉴 */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition flex-shrink-0"
              title="메뉴"
            >
              <Menu size={20} />
            </button>
          </div>

          {/* 통계 정보 */}
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 rounded-full">
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="font-medium">{team.member_count}명</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 rounded-full">
              <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="font-medium">{setlists.length}개 콘티</span>
            </div>
            {team.my_role === 'leader' && (
              <div className="flex items-center gap-1 px-2.5 py-1 bg-yellow-50 rounded-full">
                <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-600" />
                <span className="font-medium text-yellow-700">리더</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 rounded-full">
              <span className="text-gray-600">코드:</span>
              <span className="font-mono font-bold">{team.invite_code}</span>
            </div>
          </div>

          {/* 모바일: 설정 버튼 */}
          <div className="md:hidden mt-3">
            <button
              onClick={() => router.push(`/my-team/${teamId}/settings`)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm"
            >
              <Settings size={18} />
              <span>팀 설정</span>
            </button>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* ✅ 고정곡 섹션 */}
<div className="bg-white rounded-lg shadow-md mb-4 sm:mb-6">
  <div className="p-4 sm:p-6 border-b">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-center gap-2">
        <Pin className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500 flex-shrink-0" />
        <h2 className="text-lg sm:text-xl font-bold text-gray-900">고정곡</h2>
        <span className="text-xs sm:text-sm text-gray-500">({fixedSongs.length}곡)</span>
      </div>
      <div className="flex items-center gap-2">
        {selectedFixedSongs.length > 0 && (
          <>
            <button
              onClick={openSelectedFixedSongsViewer}
              className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 flex items-center justify-center gap-2 text-sm"
            >
              <Presentation size={16} className="flex-shrink-0" />
              <span className="hidden sm:inline">악보 뷰어</span>
            </button>
            <button
              onClick={downloadSelectedFixedSongs}
              disabled={downloadingFixed}
              className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 flex items-center justify-center gap-2 disabled:bg-gray-400 text-sm"
            >
              <Download size={16} className="flex-shrink-0" />
              <span className="hidden sm:inline">{downloadingFixed ? '다운로드 중...' : `${selectedFixedSongs.length}곡 다운로드`}</span>
              <span className="sm:hidden">{selectedFixedSongs.length}</span>
            </button>
          </>
        )}
        {canAddFixedSong && (
          <button
            onClick={() => setShowAddFixedSongModal(true)}
            className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8] flex items-center justify-center gap-2 text-sm"
          >
            <Plus size={16} className="flex-shrink-0" />
            <span className="hidden sm:inline">고정곡 추가</span>
            <span className="sm:hidden">추가</span>
          </button>
        )}
      </div>
    </div>
  </div>

  <div className="p-6">
    {fixedSongs.length === 0 ? (
      <p className="text-center text-gray-500 py-8">
        아직 등록된 고정곡이 없습니다.
        {canAddFixedSong && (
          <><br /><span className="text-sm">위의 "고정곡 추가" 버튼을 눌러 추가하세요.</span></>
        )}
      </p>
    ) : (
      <div className="space-y-3">
        {/* 카테고리별로 그룹화 */}
        {fixedSongCategories.map(category => {
          const songsInCategory = fixedSongs.filter(fs => fs.category === category)
          if (songsInCategory.length === 0) return null

          return (
            <div key={category} className="mb-4">
              <h3 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded">{category}</span>
              </h3>
              <div className="space-y-2">
                {songsInCategory.map(fixedSong => (
                  <div
                    key={fixedSong.id}
                    className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 sm:p-4 rounded-lg border transition ${
                      selectedFixedSongs.find(s => s.id === fixedSong.id)
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-3 sm:gap-4 flex-1">
                      {/* 선택 체크박스 */}
                      <button
                        onClick={() => toggleFixedSongSelection(fixedSong)}
                        className={`rounded border-2 flex items-center justify-center transition flex-shrink-0 ${
                          selectedFixedSongs.find(s => s.id === fixedSong.id)
                            ? 'border-orange-500 bg-[#C5D7F2] text-white'
                            : 'border-gray-300 hover:border-orange-400'
                        }`}
                        style={{ width: '20px', height: '20px', minWidth: '20px', minHeight: '20px', maxWidth: '20px', maxHeight: '20px' }}
                      >
                        {selectedFixedSongs.find(s => s.id === fixedSong.id) && (
                          <Check size={12} />
                        )}
                      </button>

                      {/* 곡 정보 */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 text-sm sm:text-base truncate">{fixedSong.song.song_name}</h4>
                        <p className="text-xs sm:text-sm text-gray-600 truncate">
                          {fixedSong.song.team_name} {fixedSong.song.key && `| Key: ${fixedSong.song.key}`}
                        </p>
                      </div>
                    </div>

                    {/* 액션 버튼들 */}
                    <div className="flex items-center gap-1 sm:gap-2 ml-8 sm:ml-0">
                      {/* 데스크톱 버튼 */}
                      <div className="hidden sm:flex items-center gap-2">
                        {fixedSong.song.file_url && (
                          <>
                            <button
                              onClick={() => setPreviewFixedSong(fixedSong)}
                              className="p-2 hover:bg-gray-100 rounded-lg"
                              title="악보 미리보기"
                            >
                              <Eye size={20} className="text-gray-600" />
                            </button>
                            <button
                              onClick={() => {
                                // 단일 곡도 SheetMusicEditor로 열기
                                setNoteEditorSongs([{
                                  song_id: fixedSong.song.id,
                                  song_name: fixedSong.song.song_name,
                                  team_name: fixedSong.song.team_name,
                                  file_url: fixedSong.song.file_url,
                                  file_type: (fixedSong.song.file_type === 'pdf' ? 'pdf' : 'image') as 'pdf' | 'image',
                                  songForms: []
                                }])
                                setNoteEditorSetlistTitle(fixedSong.song.song_name)
                                setShowNoteEditor(true)
                              }}
                              className="p-2 hover:bg-gray-100 rounded-lg"
                              title="악보 보기/필기 모드"
                            >
                              <Presentation size={20} className="text-gray-600" />
                            </button>
                          </>
                        )}
                        {fixedSong.song.youtube_url && (
                          <button
                            onClick={() => setYoutubeModalSong(fixedSong.song)}
                            className="p-2 hover:bg-gray-100 rounded-lg"
                            title="YouTube"
                          >
                            <Youtube size={20} className="text-red-500" />
                          </button>
                        )}
                        {(team?.my_role === 'leader' || team?.my_role === 'admin') && (
                          <button
                            onClick={() => handleDeleteFixedSong(fixedSong.id)}
                            className="p-2 hover:bg-red-100 rounded-lg"
                            title="삭제"
                          >
                            <Trash2 size={20} className="text-red-500" />
                          </button>
                        )}
                      </div>

                      {/* 모바일 버튼 (아이콘만) */}
                      <div className="flex sm:hidden items-center gap-1">
                        {fixedSong.song.file_url && (
                          <>
                            <button
                              onClick={() => setPreviewFixedSong(fixedSong)}
                              className="p-2 hover:bg-gray-100 rounded-lg"
                              title="미리보기"
                            >
                              <Eye size={18} className="text-gray-600" />
                            </button>
                            <button
                              onClick={() => {
                                setNoteEditorSongs([{
                                  song_id: fixedSong.song.id,
                                  song_name: fixedSong.song.song_name,
                                  team_name: fixedSong.song.team_name,
                                  file_url: fixedSong.song.file_url,
                                  file_type: (fixedSong.song.file_type === 'pdf' ? 'pdf' : 'image') as 'pdf' | 'image',
                                  songForms: []
                                }])
                                setNoteEditorSetlistTitle(fixedSong.song.song_name)
                                setShowNoteEditor(true)
                              }}
                              className="p-2 hover:bg-gray-100 rounded-lg"
                              title="악보 보기/필기"
                            >
                              <Presentation size={18} className="text-gray-600" />
                            </button>
                          </>
                        )}
                        {fixedSong.song.youtube_url && (
                          <button
                            onClick={() => setYoutubeModalSong(fixedSong.song)}
                            className="p-2 hover:bg-gray-100 rounded-lg"
                            title="YouTube"
                          >
                            <Youtube size={18} className="text-red-500" />
                          </button>
                        )}
                        {(team?.my_role === 'leader' || team?.my_role === 'admin') && (
                          <button
                            onClick={() => handleDeleteFixedSong(fixedSong.id)}
                            className="p-2 hover:bg-red-100 rounded-lg"
                            title="삭제"
                          >
                            <Trash2 size={18} className="text-red-500" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    )}
  </div>
</div>

        {/* 콘티 목록 */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-4 sm:p-6 border-b">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">콘티 목록</h2>
              {canCreateSetlist ? (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="w-full sm:w-auto px-4 py-2 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8] flex items-center justify-center gap-2 text-sm"
                >
                  <Plus size={18} className="flex-shrink-0" />
                  <span>새 콘티 만들기</span>
                </button>
              ) : (
                <div className="text-xs text-gray-400 flex items-center gap-1">
                  <Lock size={14} />
                  <span>콘티 생성 권한 없음</span>
                </div>
              )}
            </div>

            {/* 필터 토글 버튼 (모바일) */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="md:hidden w-full flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg mb-3 text-sm"
            >
              <div className="flex items-center gap-2">
                <FilterIcon size={18} />
                <span className="font-medium">필터 및 검색</span>
                <span className="text-gray-500">({filteredSetlists.length}개)</span>
              </div>
              <ChevronRight
                className={`w-5 h-5 transition-transform ${showFilters ? 'rotate-90' : ''}`}
              />
            </button>

            {/* 검색 및 필터 */}
            <div className="flex flex-col md:flex-row gap-3 mt-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="콘티 제목 검색..."
                    className="w-full pl-9 sm:pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <select
                value={serviceTypeFilter}
                onChange={(e) => setServiceTypeFilter(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">모든 예배</option>
                <option value="주일집회">주일집회</option>
                <option value="중보기도회">중보기도회</option>
                <option value="기도회">기도회</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full sm:w-auto px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="date_desc">최신순</option>
                <option value="date_asc">오래된순</option>
                <option value="created">생성일순</option>
              </select>
            </div>
          </div>

          {filteredSetlists.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">
                {searchTerm || serviceTypeFilter !== 'all'
                  ? '검색 결과가 없습니다.'
                  : '아직 생성된 콘티가 없습니다.'}
              </p>
              {!searchTerm && serviceTypeFilter === 'all' && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-6 py-3 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8]"
                >
                  첫 콘티 만들기
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {filteredSetlists.map((setlist) => (
                <div
                  key={setlist.id}
                  className="p-4 sm:p-6 hover:bg-gray-50 transition group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* ✅ 클릭 가능한 영역 - 콘티 상세 페이지로 이동 */}
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => {
                        if (user) {
                          logSetlistView(setlist.id, teamId, user.id).catch(error => {
                            console.error('Error logging setlist view:', error)
                          })
                        }
                        router.push(`/my-team/${teamId}/setlist/${setlist.id}`)
                      }}
                    >
                      <h3 className="text-base sm:text-lg font-bold text-gray-900 group-hover:text-blue-600 transition">
                        {setlist.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-xs sm:text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                          {new Date(setlist.service_date).toLocaleDateString('ko-KR')}
                        </span>
                        <span>{setlist.service_type}</span>
                        <span className="flex items-center gap-1">
                          <Music className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                          {setlist.song_count}곡
                        </span>
                        {(setlist.creator_name || setlist.creator_email) && (
                          <span className="hidden sm:inline text-gray-500">
                            by {setlist.creator_name || setlist.creator_email}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ✅ 버튼 영역 */}
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      {setlist.canEdit && (
                        <>
                          {/* 데스크톱: 텍스트 포함 버튼 */}
                          <div className="hidden sm:flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                openQuickEditModal(setlist)
                              }}
                              className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition flex items-center gap-1"
                              title="빠른 편집"
                            >
                              <Edit size={16} />
                              <span>편집</span>
                            </button>
                            
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCopySetlist(setlist)
                              }}
                              disabled={copying}
                              className="px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 rounded-lg transition flex items-center gap-1 disabled:opacity-50"
                              title="콘티 복사"
                            >
                              <Copy size={16} />
                              <span>복사</span>
                            </button>
                            
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeleteConfirm({
                                  show: true,
                                  setlistId: setlist.id,
                                  title: setlist.title
                                })
                              }}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="삭제"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>

                          {/* 모바일: 아이콘만 */}
                          <div className="flex sm:hidden items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                openQuickEditModal(setlist)
                              }}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="편집"
                            >
                              <Edit size={18} />
                            </button>
                            
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCopySetlist(setlist)
                              }}
                              disabled={copying}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition disabled:opacity-50"
                              title="복사"
                            >
                              <Copy size={18} />
                            </button>
                            
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeleteConfirm({
                                  show: true,
                                  setlistId: setlist.id,
                                  title: setlist.title
                                })
                              }}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="삭제"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </>
                      )}

                      {/* ✅ 모든 팀원용: 내 필기에 복사 버튼 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCopySetlistToNotes(setlist)
                        }}
                        disabled={copying}
                        className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
                        title="내 필기 노트에 복사"
                      >
                        <Pencil size={18} />
                      </button>

                      <button
                        onClick={() => {
                          if (user) {
                            logSetlistView(setlist.id, teamId, user.id).catch(error => {
                              console.error('Error logging setlist view:', error)
                            })
                          }
                          router.push(`/my-team/${teamId}/setlist/${setlist.id}`)
                        }}
                        className="p-2 hover:bg-gray-100 rounded-lg transition"
                        title="콘티 열기"
                      >
                        <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400 group-hover:text-blue-600 transition flex-shrink-0" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 콘티 생성 모달 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">새 콘티 만들기</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  콘티 제목 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newSetlist.title}
                  onChange={(e) => setNewSetlist({ ...newSetlist, title: e.target.value })}
                  placeholder="예: 아버지의 마음"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  예배 날짜
                </label>
                <input
                  type="date"
                  value={newSetlist.service_date}
                  onChange={(e) => setNewSetlist({ ...newSetlist, service_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  예배 유형
                </label>
                <select
                  value={newSetlist.service_type}
                  onChange={(e) => setNewSetlist({ ...newSetlist, service_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="주일집회">주일집회</option>
                  <option value="중보기도회">중보기도회</option>
                  <option value="기도회">기도회</option>
                  <option value="직접입력">직접입력</option>
                </select>
              </div>

              {newSetlist.service_type === '직접입력' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    예배 유형 입력
                  </label>
                  <input
                    type="text"
                    value={newSetlist.custom_service_type}
                    onChange={(e) => setNewSetlist({ ...newSetlist, custom_service_type: e.target.value })}
                    placeholder="예: 또래 기도회"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setNewSetlist({
                    title: '',
                    service_date: new Date().toISOString().split('T')[0],
                    service_type: '주일집회',
                    custom_service_type: ''
                  })
                }}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                disabled={creating}
              >
                취소
              </button>
              <button
                onClick={handleCreateSetlist}
                disabled={creating}
                className="flex-1 px-4 py-2 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8] disabled:bg-gray-400"
              >
                {creating ? '생성 중...' : '생성'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ 빠른 편집 모달 */}
      {quickEditModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">콘티 편집</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  콘티 제목 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={quickEditModal.title}
                  onChange={(e) => setQuickEditModal({ ...quickEditModal, title: e.target.value })}
                  placeholder="예: 아버지의 마음"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  예배 날짜
                </label>
                <input
                  type="date"
                  value={quickEditModal.date}
                  onChange={(e) => setQuickEditModal({ ...quickEditModal, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  예배 유형
                </label>
                <select
                  value={quickEditModal.type}
                  onChange={(e) => setQuickEditModal({ ...quickEditModal, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="주일집회">주일집회</option>
                  <option value="중보기도회">중보기도회</option>
                  <option value="기도회">기도회</option>
                  <option value="직접입력">직접입력</option>
                </select>
              </div>

              {quickEditModal.type === '직접입력' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    예배 유형 입력
                  </label>
                  <input
                    type="text"
                    value={quickEditModal.customType}
                    onChange={(e) => setQuickEditModal({ ...quickEditModal, customType: e.target.value })}
                    placeholder="예: 또래 기도회"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setQuickEditModal({
                    show: false,
                    setlistId: '',
                    title: '',
                    date: '',
                    type: '',
                    customType: ''
                  })
                }}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                disabled={quickEditing}
              >
                취소
              </button>
              <button
                onClick={handleQuickEdit}
                disabled={quickEditing}
                className="flex-1 px-4 py-2 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8] disabled:bg-gray-400"
              >
                {quickEditing ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4 text-red-600">콘티 삭제</h2>
            <p className="text-gray-700 mb-6">
              정말로 <strong>"{deleteConfirm.title}"</strong> 콘티를 삭제하시겠습니까?
              <br />
              <span className="text-sm text-red-500">
                이 작업은 되돌릴 수 없으며, 포함된 모든 곡이 함께 삭제됩니다.
              </span>
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirm({ show: false, setlistId: '', title: '' })}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                disabled={deleting}
              >
                취소
              </button>
              <button
                onClick={handleDeleteSetlist}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-[#E26559] text-white rounded-lg hover:bg-[#D14E42] disabled:bg-gray-400"
              >
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ 고정곡 추가 모달 */}
{showAddFixedSongModal && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden">
      <div className="p-6 border-b flex items-center justify-between">
        <h3 className="text-xl font-bold">고정곡 추가</h3>
        <button
          onClick={() => {
  setShowAddFixedSongModal(false)
  setFixedSongSearch('')
  setAvailableSongs([])
  setCustomCategory('')
}}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <X size={20} />
        </button>
      </div>

      <div className="p-6">
        {/* 카테고리 선택 */}
<div className="mb-4">
  <label className="block text-sm font-medium text-gray-700 mb-2">카테고리</label>
  <select
    value={selectedCategory}
    onChange={(e) => setSelectedCategory(e.target.value)}
    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
  >
    {fixedSongCategories.map(cat => (
      <option key={cat} value={cat}>{cat}</option>
    ))}
  </select>
</div>

{/* 직접입력 필드 */}
{selectedCategory === '직접입력' && (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-2">카테고리 직접입력</label>
    <input
      type="text"
      value={customCategory}
      onChange={(e) => setCustomCategory(e.target.value)}
      placeholder="예: 특송, 헌금찬양 등"
      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
    />
  </div>
)}

        {/* 곡 검색 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">곡 검색</label>
          <input
            type="text"
            value={fixedSongSearch}
            onChange={(e) => {
              setFixedSongSearch(e.target.value)
              searchSongsForFixed(e.target.value)
            }}
            placeholder="곡 이름 또는 아티스트 검색..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          />
        </div>

        {/* 검색 결과 */}
        <div className="max-h-60 overflow-y-auto">
          {availableSongs.length === 0 ? (
            <p className="text-center text-gray-500 py-4">
              {fixedSongSearch ? '검색 결과가 없습니다.' : '곡 이름을 검색하세요.'}
            </p>
          ) : (
            <div className="space-y-2">
              {availableSongs.map(song => (
                <div
                  key={song.id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div>
                    <h4 className="font-medium text-gray-900">{song.song_name}</h4>
                    <p className="text-sm text-gray-600">{song.team_name}</p>
                  </div>
                  <button
                    onClick={() => handleAddFixedSong(song)}
                    className="px-3 py-1 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#C5D7F2] text-sm"
                  >
                    추가
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
)}

{/* ✅ 고정곡 미리보기 모달 */}
{previewFixedSong && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">{previewFixedSong.song.song_name}</h3>
          <p className="text-sm text-gray-600">{previewFixedSong.song.team_name}</p>
        </div>
        <button
          onClick={() => setPreviewFixedSong(null)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <X size={20} />
        </button>
      </div>
      <div className="p-4 overflow-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>
        {previewFixedSong.song.file_type === 'pdf' ? (
<iframe
src={`${previewFixedSong.song.file_url}#toolbar=0&navpanes=0&scrollbar=1`}
className="w-full h-[70vh]"
title={previewFixedSong.song.song_name}
/>
        ) : (
          <img
            src={previewFixedSong.song.file_url}
            alt={previewFixedSong.song.song_name}
            className="max-w-full mx-auto"
          />
        )}
      </div>
    </div>
  </div>
)}

{/* ✅ 악보보기 전용모드 모달 */}
{showFixedSongSheet && currentSheetSong && (
  <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
    <div className="absolute top-4 right-4 z-10">
      <button
        onClick={() => {
          setShowFixedSongSheet(false)
          setCurrentSheetSong(null)
        }}
        className="p-3 bg-white/20 hover:bg-white/30 rounded-full text-white"
      >
        <X size={24} />
      </button>
    </div>
    <div className="absolute top-4 left-4 z-10 text-white">
      <h3 className="text-xl font-bold">{currentSheetSong.song_name}</h3>
      <p className="text-sm text-gray-300">{currentSheetSong.team_name}</p>
    </div>
    <div className="w-full h-full flex items-center justify-center p-8">
      {currentSheetSong.file_type === 'pdf' ? (
<iframe
src={`${currentSheetSong.file_url}#toolbar=0&navpanes=0&scrollbar=1`}
className="w-full h-full bg-white"
title={currentSheetSong.song_name}
/>
      ) : (
        <img
          src={currentSheetSong.file_url}
          alt={currentSheetSong.song_name}
          className="max-w-full max-h-full object-contain"
        />
      )}
    </div>
  </div>
)}

{/* ✅ 유튜브 모달 */}
{youtubeModalSong && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl overflow-hidden">
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">{youtubeModalSong.song_name}</h3>
          <p className="text-sm text-gray-600">{youtubeModalSong.team_name}</p>
        </div>
        <button
          onClick={() => setYoutubeModalSong(null)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <X size={20} />
        </button>
      </div>
      <div className="aspect-video">
        <iframe
          src={youtubeModalSong.youtube_url?.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={youtubeModalSong.song_name}
        />
      </div>
    </div>
  </div>
)}

{/* ✅ 필기 노트 에디터 모달 (다중 곡 모드) */}
{showNoteEditor && noteEditorSongs.length > 0 && (
  <SheetMusicEditor
    fileUrl=""
    fileType="image"
    songName=""
    songs={noteEditorSongs}
    setlistTitle={noteEditorSetlistTitle}
    initialMode="view"
    onSaveAll={handleSaveAllNotes}
    onClose={handleCloseNoteEditor}
  />
)}
    </div>
  )
}