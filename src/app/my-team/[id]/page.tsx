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
  Pin, Eye, Presentation, Youtube, Download, X, Check, Menu, Filter as FilterIcon, Pencil, Lock,
  MoreHorizontal, Home, Heart, StickyNote, LayoutDashboard, Library, LogOut
} from 'lucide-react'
import { useMobile } from '@/hooks/useMobile'
import { useSheetMusicNotes, LocalSheetMusicNote } from '@/hooks/useSheetMusicNotes'
import SheetMusicEditor from '@/components/SheetMusicEditor'
import { PageAnnotation } from '@/lib/supabase'
import { useTeamPermissions } from '@/hooks/useTeamPermissions'
import Link from 'next/link'

interface TeamInfo {
  id: string
  name: string
  type: string
  church_name: string | null
  invite_code: string
  member_count: number
  my_role: string
  is_demo?: boolean
}

interface Setlist {
  id: string
  title: string
  service_date: string
  service_type: string
  song_count: number
  created_by: string
  created_at: string
  creator_name?: string
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

  // 빠른 편집 모달
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

  // 복사 중 상태
  const [copying, setCopying] = useState(false)

  // 고정곡 관련 상태
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

  // 필기 노트 에디터 상태
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

  // 팀 나가기
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [leaving, setLeaving] = useState(false)

  // 모바일 상태
  const [showFilters, setShowFilters] = useState(false)
  const [activeFixedSongMenu, setActiveFixedSongMenu] = useState<string | null>(null)

  // 사이드바용 팀 목록
  const [userTeams, setUserTeams] = useState<{id: string, name: string, role: string}[]>([])

  const isMobile = useMobile()

  // 권한 훅 사용
  const {
    hasPermission,
    isLeader,
    isAdmin,
    role: userTeamRole,
    loading: permissionsLoading
  } = useTeamPermissions(teamId, user?.id)

  // 권한 체크 (권한 로딩 중에는 최소 권한만 허용)
  const isTeamLeaderOrAdmin = team?.my_role === 'leader' || team?.my_role === 'admin'
  const canCreateSetlist = !permissionsLoading && (hasPermission('create_setlist') || isTeamLeaderOrAdmin)
  const canEditSetlistPerm = !permissionsLoading && (hasPermission('edit_setlist') || isTeamLeaderOrAdmin)
  const canDeleteSetlist = !permissionsLoading && (hasPermission('delete_setlist') || isTeamLeaderOrAdmin)
  const canCopySetlist = hasPermission('copy_setlist') || true
  const canAddFixedSong = !permissionsLoading && (hasPermission('add_fixed_song') || isTeamLeaderOrAdmin)
  const canEditFixedSong = !permissionsLoading && (hasPermission('edit_fixed_song') || isTeamLeaderOrAdmin)
  const canDeleteFixedSong = !permissionsLoading && (hasPermission('delete_fixed_song') || isTeamLeaderOrAdmin)
  const canViewSheet = hasPermission('view_sheet') || true
  const canDownloadSheet = hasPermission('download_sheet') || true
  const canManageMembers = !permissionsLoading && (hasPermission('manage_members') || team?.my_role === 'leader')
  const canEditTeamSettings = !permissionsLoading && (hasPermission('edit_team_settings') || isTeamLeaderOrAdmin)

  // 디버그 로그 (권한 확인용)
  useEffect(() => {
    if (!permissionsLoading && team) {
      console.log('🔐 권한 상태:', {
        my_role: team.my_role,
        isTeamLeaderOrAdmin,
        isLeader,
        isAdmin,
        permissionsLoading,
        canCreateSetlist,
        hasCreatePerm: hasPermission('create_setlist'),
      })
    }
  }, [permissionsLoading, team, isLeader, isAdmin, canCreateSetlist])

  const fixedSongCategories = ['여는찬양', '축복송', '마침찬양', '봉헌찬양', '직접입력']

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (user && teamId) {
      fetchTeamInfo()
      fetchSetlists()
      fetchFixedSongs()
      fetchUserTeams()
    }
  }, [user, teamId])

  // 사용자의 모든 팀 목록 가져오기 (사이드바용)
  const fetchUserTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          role,
          teams (
            id,
            name
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')

      if (error) throw error

      const teamsList = (data || []).map((tm: any) => ({
        id: tm.teams.id,
        name: tm.teams.name,
        role: tm.role
      }))

      setUserTeams(teamsList)
    } catch (error) {
      console.error('Error fetching user teams:', error)
    }
  }

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

  const handleLeaveTeam = async () => {
    if (!user || !teamId) return
    setLeaving(true)
    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', teamId)
        .eq('user_id', user.id)

      if (error) throw error
      router.push('/my-team')
    } catch (error) {
      console.error('Error leaving team:', error)
      alert('팀 나가기에 실패했습니다.')
    } finally {
      setLeaving(false)
      setShowLeaveConfirm(false)
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
        my_role: memberData.role,
        is_demo: teamData.is_demo || false
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

  const fetchFixedSongs = async () => {
    try {
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

      const songIds = fixedData.map(f => f.song_id)
      const { data: songsData, error: songsError } = await supabase
        .from('songs')
        .select('id, song_name, team_name, key, file_url, file_type, youtube_url')
        .in('id', songIds)

      if (songsError) throw songsError

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

  const handleAddFixedSong = async (song: any) => {
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

  const toggleFixedSongSelection = (fixedSong: FixedSong) => {
    if (selectedFixedSongs.find(s => s.id === fixedSong.id)) {
      setSelectedFixedSongs(selectedFixedSongs.filter(s => s.id !== fixedSong.id))
    } else {
      setSelectedFixedSongs([...selectedFixedSongs, fixedSong])
    }
  }

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

  const openSelectedFixedSongsViewer = () => {
    if (selectedFixedSongs.length === 0) {
      alert('악보를 볼 곡을 선택하세요.')
      return
    }

    const songsWithSheet = selectedFixedSongs.filter(fs => fs.song.file_url)

    if (songsWithSheet.length === 0) {
      alert('선택된 곡 중 악보가 있는 곡이 없습니다.')
      return
    }

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
    if (!canCreateSetlist) {
      alert('콘티 생성 권한이 없습니다.')
      return
    }

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
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        alert('로그인이 필요합니다.')
        return
      }

      const serviceType = newSetlist.service_type === '직접입력'
        ? newSetlist.custom_service_type.trim()
        : newSetlist.service_type

      const res = await fetch('/api/setlists/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          teamId,
          title: newSetlist.title.trim(),
          serviceDate: newSetlist.service_date,
          serviceType,
        }),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || '콘티 생성에 실패했습니다.')

      const data = result.setlist

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
      fetchSetlists()
    } catch (error: any) {
      console.error('Error updating setlist:', error)
      alert(`수정 실패: ${error.message}`)
    } finally {
      setQuickEditing(false)
    }
  }

  const handleCopySetlist = async (setlist: Setlist) => {
    if (!confirm(`"${setlist.title}" 콘티를 복사하시겠습니까?`)) return

    setCopying(true)

    try {
      const { data: newSetlist, error: setlistError } = await supabase
        .from('team_setlists')
        .insert({
          team_id: teamId,
          title: `${setlist.title} (복사본)`,
          service_date: new Date().toISOString().split('T')[0],
          service_type: setlist.service_type,
          created_by: user.id
        })
        .select()
        .single()

      if (setlistError) throw setlistError

      const { data: songs, error: songsError } = await supabase
        .from('team_setlist_songs')
        .select('*')
        .eq('setlist_id', setlist.id)
        .order('order_number', { ascending: true })

      if (songsError) throw songsError

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

      setQuickEditModal({
        show: true,
        setlistId: newSetlist.id,
        title: newSetlist.title,
        date: newSetlist.service_date,
        type: newSetlist.service_type,
        customType: ''
      })

      fetchSetlists()
    } catch (error: any) {
      console.error('Error copying setlist:', error)
      alert(`콘티 복사 실패: ${error.message}`)
    } finally {
      setCopying(false)
    }
  }

  const { saveNote } = useSheetMusicNotes()

  const handleCopySetlistToNotes = async (setlist: Setlist) => {
    if (!user) {
      alert('로그인이 필요합니다.')
      return
    }

    setCopying(true)

    try {
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

      const songsWithSheets = setlistSongs.filter(
        (item: any) => item.song?.file_url
      )

      if (songsWithSheets.length === 0) {
        alert('악보가 있는 곡이 없습니다.')
        return
      }

      const songsForEditor = songsWithSheets.map((item: any) => ({
        song_id: item.song.id,
        song_name: item.song.song_name,
        team_name: item.song.team_name || '',
        file_url: item.song.file_url,
        file_type: item.song.file_type === 'pdf' ? 'pdf' as const : 'image' as const,
        songForms: item.selected_form || []
      }))

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

  const handleSaveAllNotes = async (data: { song: any, annotations: PageAnnotation[], extra?: { songFormEnabled: boolean, songFormStyle: any, partTags: any[] } }[]) => {
    if (!user) return

    if (data.length > 1) {
      let allAnnotations: PageAnnotation[] = []
      let pageOffset = 0
      const songsInfo = data.map(item => {
        const maxPage = item.annotations.length > 0
          ? Math.max(...item.annotations.map(a => a.pageNumber)) + 1
          : 1

        const offsetAnnotations = item.annotations.map(ann => ({
          ...ann,
          pageNumber: ann.pageNumber + pageOffset
        }))
        allAnnotations = [...allAnnotations, ...offsetAnnotations]

        const songInfo = {
          song_id: item.song.song_id,
          song_name: item.song.song_name,
          team_name: item.song.team_name || undefined,
          file_url: item.song.file_url,
          file_type: item.song.file_type as 'pdf' | 'image',
          songForms: item.song.songForms || [],
          pageCount: maxPage,
        }

        pageOffset += maxPage
        return songInfo
      })

      const songNames = songsInfo.map(s => s.song_name).join(', ')

      const result = await saveNote({
        user_id: user.id,
        song_id: songsInfo[0].song_id,
        song_name: songNames.length > 30 ? songNames.substring(0, 30) + '...' : songNames,
        team_name: songsInfo[0].team_name,
        file_url: songsInfo[0].file_url,
        file_type: songsInfo[0].file_type,
        title: noteEditorSetlistTitle || `콘티 (${songsInfo.length}곡)`,
        annotations: allAnnotations,
        songForms: [],
        songFormEnabled: false,
        songs: songsInfo,
      })

      setShowNoteEditor(false)
      setNoteEditorSongs([])
      setNoteEditorSetlistTitle('')

      if (result) {
        alert(`✅ 콘티가 저장되었습니다! (${songsInfo.length}곡)\nmy-page > 내 필기 노트에서 확인하세요.`)
      } else {
        alert('저장에 실패했습니다.')
      }
      return
    }

    const item = data[0]
    const hasContent = item.annotations.some(
      ann => (ann.strokes?.length || 0) > 0 || (ann.textElements?.length || 0) > 0
    )

    if (hasContent || data.length === 1) {
      const result = await saveNote({
        user_id: user.id,
        song_id: item.song.song_id,
        song_name: item.song.song_name,
        team_name: item.song.team_name || undefined,
        file_url: item.song.file_url,
        file_type: item.song.file_type,
        title: noteEditorSetlistTitle ? `${noteEditorSetlistTitle} - ${item.song.song_name}` : item.song.song_name,
        annotations: item.annotations,
        songForms: item.song.songForms || [],
        songFormEnabled: item.extra?.songFormEnabled ?? ((item.song.songForms?.length || 0) > 0),
        songFormStyle: item.extra?.songFormStyle,
        partTags: item.extra?.partTags,
      })

      setShowNoteEditor(false)
      setNoteEditorSongs([])
      setNoteEditorSetlistTitle('')

      if (result) {
        alert(`✅ 필기가 저장되었습니다!\nmy-page > 내 필기 노트에서 확인하세요.`)
      } else {
        alert('저장에 실패했습니다.')
      }
    } else {
      setShowNoteEditor(false)
      setNoteEditorSongs([])
      setNoteEditorSetlistTitle('')
      alert('저장할 필기가 없습니다.')
    }
  }

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
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        alert('로그인이 필요합니다.')
        return
      }

      const res = await fetch('/api/setlists/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          setlistId: deleteConfirm.setlistId,
          teamId,
        }),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || '콘티 삭제에 실패했습니다.')

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

  // 상대 날짜 계산
  const getRelativeDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return '오늘'
    if (diffDays === 1) return '어제'
    if (diffDays < 7) return `${diffDays}일 전`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}개월 전`
    return `${Math.floor(diffDays / 365)}년 전`
  }

  // 카테고리별 색상
  const getCategoryColor = (category: string) => {
    switch (category) {
      case '여는찬양': return 'text-orange-500'
      case '축복송': return 'text-blue-500'
      case '마침찬양': return 'text-green-500'
      case '봉헌찬양': return 'text-purple-500'
      default: return 'text-slate-500'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-slate-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  if (!team) {
    return null
  }

  return (
    <div className="my-team-container min-h-screen flex bg-white">
      {/* 사이드바 - 데스크톱 전용 */}
      <aside className="hidden lg:flex w-[260px] h-screen sticky top-0 bg-slate-50 border-r border-slate-200 flex-col shrink-0">
        <div className="p-6 pb-4">
          <Link href="/main" className="text-xl font-logo text-slate-700">
            WORSHEEP
          </Link>
        </div>

        {/* 팀 목록 섹션 */}
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold uppercase tracking-widest text-slate-500">내 팀</span>
            <Link
              href="/my-team"
              className="text-xs font-medium text-blue-500 hover:text-blue-600"
            >
              전체보기
            </Link>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {userTeams.map((t) => (
            <Link
              key={t.id}
              href={`/my-team/${t.id}`}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${
                t.id === teamId
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'text-slate-600 hover:bg-slate-200/50'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                t.id === teamId
                  ? 'bg-indigo-100 text-indigo-600'
                  : 'bg-slate-200 text-slate-600'
              }`}>
                {t.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate">{t.name}</p>
                {t.role === 'leader' && (
                  <span className="text-[10px] text-yellow-600 flex items-center gap-0.5">
                    <Crown size={10} />
                    리더
                  </span>
                )}
              </div>
            </Link>
          ))}

          {/* 팀 추가 버튼들 */}
          <div className="pt-2 space-y-1">
            <Link
              href="/teams/create"
              className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all text-slate-500 hover:bg-slate-200/50"
            >
              <div className="w-8 h-8 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center">
                <Plus size={16} />
              </div>
              <span>팀 만들기</span>
            </Link>
            <Link
              href="/teams/join"
              className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all text-slate-500 hover:bg-slate-200/50"
            >
              <div className="w-8 h-8 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center">
                <Users size={16} />
              </div>
              <span>팀 참여하기</span>
            </Link>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-3">
          {/* 뒤로가기 버튼 */}
          <button
            onClick={() => router.push('/my-team')}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all text-slate-600 hover:bg-slate-200/50 w-full"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            뒤로가기 (팀 목록)
          </button>
          <button
            onClick={() => router.push(`/my-team/${teamId}/settings`)}
            className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all text-slate-600 hover:bg-slate-200/50 w-full"
          >
            <Settings size={20} />
            팀 설정
          </button>
          {team?.my_role !== 'leader' && (
            <button
              onClick={() => setShowLeaveConfirm(true)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all text-red-500 hover:bg-red-50 w-full"
            >
              <LogOut size={20} />
              팀 나가기
            </button>
          )}
          {user && (
            <button
              onClick={() => router.push('/my-page/settings')}
              className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all w-full text-left"
              title="내 계정 관리"
            >
              <div className="w-10 h-10 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-600 font-bold">
                {user.email?.charAt(0).toUpperCase()}
              </div>
              <div className="overflow-hidden flex-1">
                <p className="text-xs font-bold text-slate-800 truncate">{user.user_metadata?.name || '사용자'}</p>
                <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
              </div>
            </button>
          )}
        </div>
      </aside>

      {/* 메인 콘텐츠 영역 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 상단 네비게이션 바 */}
        <nav className="border-b border-slate-200 px-4 lg:px-8 py-4 sticky top-0 bg-white/80 backdrop-blur-sm z-40">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* 모바일: 뒤로가기 */}
              <button
                onClick={() => router.push('/my-team')}
                className="lg:hidden p-2 -ml-2 hover:bg-slate-100 rounded-lg transition"
                title="뒤로가기 (팀 목록)"
              >
                <span className="material-symbols-outlined text-xl text-slate-600">arrow_back</span>
              </button>
              {/* 모바일: 로고 */}
              <Link href="/main" className="lg:hidden text-lg font-logo text-slate-700">
                WORSHEEP
              </Link>
              {/* 데스크톱: 페이지 제목 */}
              <span className="hidden lg:inline text-base font-semibold text-slate-700">팀 관리</span>
            </div>
            <div className="flex items-center gap-2">
              {/* 모바일: 팀 나가기 */}
              {team?.my_role !== 'leader' && (
                <button
                  onClick={() => setShowLeaveConfirm(true)}
                  className="lg:hidden p-2 text-red-400 hover:bg-red-50 rounded-full transition"
                  title="팀 나가기"
                >
                  <LogOut size={20} />
                </button>
              )}
              {/* 모바일: 설정 버튼 */}
              <button
                onClick={() => router.push(`/my-team/${teamId}/settings`)}
                className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-full transition"
              >
                <Settings size={20} />
              </button>
            </div>
          </div>
        </nav>

        {/* 메인 콘텐츠 */}
        <main className="max-w-5xl w-full mx-auto px-4 lg:px-8 pt-8 lg:pt-12 pb-24">
          {/* 헤더 */}
          <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12 lg:mb-16">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {team.church_name && (
                  <span className="text-xs font-semibold px-2 py-0.5 bg-blue-50 text-blue-500 rounded">
                    {team.church_name}
                  </span>
                )}
                {/* 역할 배지 */}
                {team.my_role === 'leader' && (
                  <span className="text-xs font-semibold px-2 py-0.5 bg-yellow-50 text-yellow-600 rounded flex items-center gap-1">
                    <Crown size={12} />
                    리더
                  </span>
                )}
                {team.my_role === 'admin' && (
                  <span className="text-xs font-semibold px-2 py-0.5 bg-purple-50 text-purple-600 rounded">
                    관리자
                  </span>
                )}
                {team.my_role === 'member' && (
                  <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                    멤버
                  </span>
                )}
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>코드: <span className="font-medium text-slate-700 font-mono">{team.invite_code}</span></span>
                  <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                  <span>{team.member_count}명</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                  <span>{setlists.length}개 콘티</span>
                </div>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-700 tracking-tight">
                {team.name}
              </h1>
            </div>
            {canCreateSetlist && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center justify-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 bg-blue-500 text-white text-sm font-semibold rounded-full shadow-lg shadow-blue-100 hover:bg-blue-600 transition-all active:scale-95"
              >
                <Plus size={18} />
                <span>새 콘티</span>
              </button>
            )}
          </header>

          {/* 고정곡 섹션 */}
          <section className="mb-12 lg:mb-16">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">고정곡</h2>
                <span className="text-sm text-slate-400">({fixedSongs.length}곡)</span>
              </div>
              <div className="flex items-center gap-2">
                {selectedFixedSongs.length > 0 && (
                  <>
                    <button
                      onClick={openSelectedFixedSongsViewer}
                      className="text-xs font-medium text-blue-500 hover:text-blue-600 flex items-center gap-1"
                    >
                      <Presentation size={14} />
                      <span className="hidden sm:inline">악보 보기</span>
                    </button>
                    <button
                      onClick={downloadSelectedFixedSongs}
                      disabled={downloadingFixed}
                      className="text-xs font-medium text-green-500 hover:text-green-600 flex items-center gap-1 disabled:opacity-50"
                    >
                      <Download size={14} />
                      <span className="hidden sm:inline">{downloadingFixed ? '다운로드 중...' : `${selectedFixedSongs.length}곡 다운로드`}</span>
                    </button>
                  </>
                )}
                {canAddFixedSong && (
                  <button
                    onClick={() => setShowAddFixedSongModal(true)}
                    className="text-xs font-medium text-blue-500 hover:underline flex items-center gap-1"
                  >
                    <Pin size={14} />
                    <span>고정곡 추가</span>
                  </button>
                )}
              </div>
            </div>

            {fixedSongs.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Pin className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">아직 등록된 고정곡이 없습니다.</p>
                {canAddFixedSong && (
                  <button
                    onClick={() => setShowAddFixedSongModal(true)}
                    className="mt-4 text-sm text-blue-500 hover:underline"
                  >
                    첫 고정곡 추가하기
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {fixedSongs.map(fixedSong => (
                  <div
                    key={fixedSong.id}
                    className={`p-5 rounded-xl border transition-all cursor-pointer group bg-white relative ${
                      selectedFixedSongs.find(s => s.id === fixedSong.id)
                        ? 'border-blue-300 shadow-sm bg-blue-50/30'
                        : 'border-slate-200 hover:border-blue-200 hover:shadow-sm'
                    }`}
                    onClick={() => toggleFixedSongSelection(fixedSong)}
                  >
                    {/* 선택 체크박스 */}
                    <div className={`absolute top-3 left-3 w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                      selectedFixedSongs.find(s => s.id === fixedSong.id)
                        ? 'border-blue-500 bg-blue-500 text-white'
                        : 'border-slate-300 group-hover:border-blue-300'
                    }`}>
                      {selectedFixedSongs.find(s => s.id === fixedSong.id) && <Check size={12} />}
                    </div>

                    <div className="flex justify-between items-start mb-4 pl-6">
                      <span className={`text-xs font-bold uppercase tracking-tighter ${getCategoryColor(fixedSong.category)}`}>
                        {fixedSong.category}
                      </span>
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setActiveFixedSongMenu(activeFixedSongMenu === fixedSong.id ? null : fixedSong.id)
                          }}
                          className="p-1 text-slate-300 hover:text-blue-400 transition-colors"
                        >
                          <MoreHorizontal size={18} />
                        </button>
                        {/* 드롭다운 메뉴 */}
                        {activeFixedSongMenu === fixedSong.id && (
                          <div className="absolute right-0 top-8 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-20 min-w-[140px]">
                            {fixedSong.song.file_url && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setPreviewFixedSong(fixedSong)
                                    setActiveFixedSongMenu(null)
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                >
                                  <Eye size={14} />
                                  미리보기
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
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
                                    setActiveFixedSongMenu(null)
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                >
                                  <Presentation size={14} />
                                  악보/필기
                                </button>
                              </>
                            )}
                            {fixedSong.song.youtube_url && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setYoutubeModalSong(fixedSong.song)
                                  setActiveFixedSongMenu(null)
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                              >
                                <Youtube size={14} className="text-red-500" />
                                YouTube
                              </button>
                            )}
                            {canDeleteFixedSong && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteFixedSong(fixedSong.id)
                                  setActiveFixedSongMenu(null)
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-red-50 flex items-center gap-2"
                              >
                                <Trash2 size={14} />
                                삭제
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="font-semibold text-sm mb-1 line-clamp-1 text-slate-800">{fixedSong.song.song_name}</p>
                    <p className="text-xs text-slate-500">
                      {fixedSong.song.team_name}
                      {fixedSong.song.key && ` · Key: ${fixedSong.song.key}`}
                    </p>
                  </div>
                ))}

                {/* 고정곡 추가 카드 */}
                {canAddFixedSong && (
                  <button
                    onClick={() => setShowAddFixedSongModal(true)}
                    className="p-5 rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-blue-500 hover:border-blue-300 transition-all min-h-[120px]"
                  >
                    <Plus size={24} />
                    <span className="text-xs font-bold">고정곡 추가</span>
                  </button>
                )}
              </div>
            )}
          </section>

          {/* 콘티 목록 섹션 */}
          <section>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">콘티 목록</h2>
              <div className="flex items-center gap-2 sm:gap-4">
                {/* 검색 */}
                <div className="relative flex-1 sm:flex-none">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="검색..."
                    className="w-full sm:w-48 pl-9 pr-4 py-2 text-sm border-none bg-slate-50 rounded-lg focus:ring-1 focus:ring-blue-100"
                  />
                </div>
                {/* 필터 버튼 */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`p-2 rounded-lg transition ${showFilters ? 'bg-blue-50 text-blue-500' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <FilterIcon size={18} />
                </button>
              </div>
            </div>

            {/* 필터 옵션 */}
            {showFilters && (
              <div className="flex flex-wrap gap-3 mb-6 p-4 bg-slate-50 rounded-lg">
                <select
                  value={serviceTypeFilter}
                  onChange={(e) => setServiceTypeFilter(e.target.value)}
                  className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-blue-100"
                >
                  <option value="all">모든 예배</option>
                  <option value="주일집회">주일집회</option>
                  <option value="중보기도회">중보기도회</option>
                  <option value="기도회">기도회</option>
                </select>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-blue-100"
                >
                  <option value="date_desc">최신순</option>
                  <option value="date_asc">오래된순</option>
                  <option value="created">생성일순</option>
                </select>
              </div>
            )}

            {filteredSetlists.length === 0 ? (
              <div className="text-center py-16">
                <FileText className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-500 mb-4">
                  {searchTerm || serviceTypeFilter !== 'all'
                    ? '검색 결과가 없습니다.'
                    : '아직 생성된 콘티가 없습니다.'}
                </p>
                {!searchTerm && serviceTypeFilter === 'all' && canCreateSetlist && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-6 py-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 text-sm font-semibold"
                  >
                    첫 콘티 만들기
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* 데스크톱: 테이블 형태 */}
                <div className="hidden md:block">
                  {/* 테이블 헤더 */}
                  <div className="grid grid-cols-12 px-6 py-3 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <div className="col-span-2">예배 날짜</div>
                    <div className="col-span-4">콘티 제목</div>
                    <div className="col-span-2">예배 유형</div>
                    <div className="col-span-1 text-center">곡 수</div>
                    <div className="col-span-3 text-right">액션</div>
                  </div>

                  {/* 테이블 내용 */}
                  {filteredSetlists.map((setlist) => (
                    <div
                      key={setlist.id}
                      className="grid grid-cols-12 px-6 py-6 border-b border-slate-200 items-center group hover:bg-slate-50/50 transition-colors cursor-pointer"
                      onClick={() => {
                        if (user) {
                          logSetlistView(setlist.id, teamId, user.id).catch(console.error)
                        }
                        router.push(`/my-team/${teamId}/setlist/${setlist.id}`)
                      }}
                    >
                      <div className="col-span-2">
                        <p className="text-sm font-medium text-slate-700">
                          {new Date(setlist.service_date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {getRelativeDate(setlist.service_date)}
                        </p>
                      </div>
                      <div className="col-span-4 pr-8">
                        <h3 className="text-sm font-semibold text-slate-800 group-hover:text-blue-500 transition-colors line-clamp-1">
                          {setlist.title}
                        </h3>
                        {(setlist.creator_name || setlist.creator_email || team?.is_demo) && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            by {setlist.creator_name || setlist.creator_email || (team?.is_demo ? '홍길동' : '')}
                          </p>
                        )}
                      </div>
                      <div className="col-span-2">
                        <span className="text-xs font-semibold px-2 py-1 bg-slate-100 text-slate-500 rounded">
                          {setlist.service_type}
                        </span>
                      </div>
                      <div className="col-span-1 text-center">
                        <span className="text-sm text-slate-500">{setlist.song_count}곡</span>
                      </div>
                      <div className="col-span-3 flex justify-end items-center gap-2">
                        <div className="flex gap-1">
                          {/* 악보 에디터 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCopySetlistToNotes(setlist)
                            }}
                            disabled={copying}
                            className="p-1.5 hover:bg-white rounded-lg border border-transparent hover:border-slate-100 text-slate-400 hover:text-indigo-500 disabled:opacity-50"
                            title="악보 에디터"
                          >
                            <Presentation size={16} />
                          </button>
                          {setlist.canEdit && (
                            <>
                              {/* 복사 */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleCopySetlist(setlist)
                                }}
                                disabled={copying}
                                className="p-1.5 hover:bg-white rounded-lg border border-transparent hover:border-slate-100 text-slate-400 hover:text-green-500 disabled:opacity-50"
                                title="콘티 복사"
                              >
                                <Copy size={16} />
                              </button>
                              {/* 편집 */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openQuickEditModal(setlist)
                                }}
                                className="p-1.5 hover:bg-white rounded-lg border border-transparent hover:border-slate-100 text-slate-400 hover:text-blue-500"
                                title="편집"
                              >
                                <Edit size={16} />
                              </button>
                              {/* 삭제 */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDeleteConfirm({
                                    show: true,
                                    setlistId: setlist.id,
                                    title: setlist.title
                                  })
                                }}
                                className="p-1.5 hover:bg-white rounded-lg border border-transparent hover:border-slate-100 text-slate-400 hover:text-red-400"
                                title="삭제"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition" />
                      </div>
                    </div>
                  ))}
                </div>

                {/* 모바일: 카드 형태 */}
                <div className="md:hidden space-y-3">
                  {filteredSetlists.map((setlist) => (
                    <div
                      key={setlist.id}
                      className="p-4 bg-white border border-slate-100 rounded-xl hover:shadow-sm transition group"
                      onClick={() => {
                        if (user) {
                          logSetlistView(setlist.id, teamId, user.id).catch(console.error)
                        }
                        router.push(`/my-team/${teamId}/setlist/${setlist.id}`)
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded">
                              {setlist.service_type}
                            </span>
                            <span className="text-xs text-slate-400">
                              {setlist.song_count}곡
                            </span>
                          </div>
                          <h3 className="font-semibold text-slate-800 line-clamp-2 mb-1">
                            {setlist.title}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Calendar size={12} />
                            <span>
                              {new Date(setlist.service_date).toLocaleDateString('ko-KR')}
                            </span>
                            <span className="text-slate-300">·</span>
                            <span>{getRelativeDate(setlist.service_date)}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" />
                      </div>

                      {/* 모바일 액션 버튼 */}
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCopySetlistToNotes(setlist)
                          }}
                          disabled={copying}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-50"
                        >
                          <Presentation size={14} />
                          <span>악보</span>
                        </button>
                        {setlist.canEdit && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCopySetlist(setlist)
                              }}
                              disabled={copying}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-green-600 hover:bg-green-50 rounded-lg disabled:opacity-50"
                            >
                              <Copy size={14} />
                              <span>복사</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                openQuickEditModal(setlist)
                              }}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-blue-600 hover:bg-blue-50 rounded-lg"
                            >
                              <Edit size={14} />
                              <span>편집</span>
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
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </main>
      </div>

      {/* 콘티 생성 모달 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-6 text-slate-800">새 콘티 만들기</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  콘티 제목 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newSetlist.title}
                  onChange={(e) => setNewSetlist({ ...newSetlist, title: e.target.value })}
                  placeholder="예: 아버지의 마음"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  예배 날짜
                </label>
                <input
                  type="date"
                  value={newSetlist.service_date}
                  onChange={(e) => setNewSetlist({ ...newSetlist, service_date: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  예배 유형
                </label>
                <select
                  value={newSetlist.service_type}
                  onChange={(e) => setNewSetlist({ ...newSetlist, service_type: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                >
                  <option value="주일집회">주일집회</option>
                  <option value="중보기도회">중보기도회</option>
                  <option value="기도회">기도회</option>
                  <option value="직접입력">직접입력</option>
                </select>
              </div>

              {newSetlist.service_type === '직접입력' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    예배 유형 입력
                  </label>
                  <input
                    type="text"
                    value={newSetlist.custom_service_type}
                    onChange={(e) => setNewSetlist({ ...newSetlist, custom_service_type: e.target.value })}
                    placeholder="예: 또래 기도회"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-8">
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
                className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 font-medium"
                disabled={creating}
              >
                취소
              </button>
              <button
                onClick={handleCreateSetlist}
                disabled={creating}
                className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:bg-slate-300 font-medium"
              >
                {creating ? '생성 중...' : '생성'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 빠른 편집 모달 */}
      {quickEditModal.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-6 text-slate-800">콘티 편집</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  콘티 제목 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={quickEditModal.title}
                  onChange={(e) => setQuickEditModal({ ...quickEditModal, title: e.target.value })}
                  placeholder="예: 아버지의 마음"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  예배 날짜
                </label>
                <input
                  type="date"
                  value={quickEditModal.date}
                  onChange={(e) => setQuickEditModal({ ...quickEditModal, date: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  예배 유형
                </label>
                <select
                  value={quickEditModal.type}
                  onChange={(e) => setQuickEditModal({ ...quickEditModal, type: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100"
                >
                  <option value="주일집회">주일집회</option>
                  <option value="중보기도회">중보기도회</option>
                  <option value="기도회">기도회</option>
                  <option value="직접입력">직접입력</option>
                </select>
              </div>

              {quickEditModal.type === '직접입력' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    예배 유형 입력
                  </label>
                  <input
                    type="text"
                    value={quickEditModal.customType}
                    onChange={(e) => setQuickEditModal({ ...quickEditModal, customType: e.target.value })}
                    placeholder="예: 또래 기도회"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-8">
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
                className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 font-medium"
                disabled={quickEditing}
              >
                취소
              </button>
              <button
                onClick={handleQuickEdit}
                disabled={quickEditing}
                className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:bg-slate-300 font-medium"
              >
                {quickEditing ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 팀 나가기 확인 모달 */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4 text-red-600">팀 나가기</h2>
            <p className="text-slate-700 mb-6">
              정말로 <strong>"{team?.name}"</strong> 팀에서 나가시겠습니까?
              <br />
              <span className="text-sm text-slate-500">
                나간 후에도 초대 코드로 다시 가입할 수 있습니다.
              </span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 font-medium"
                disabled={leaving}
              >
                취소
              </button>
              <button
                onClick={handleLeaveTeam}
                disabled={leaving}
                className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 disabled:bg-slate-300 font-medium"
              >
                {leaving ? '나가는 중...' : '나가기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4 text-red-600">콘티 삭제</h2>
            <p className="text-slate-700 mb-6">
              정말로 <strong>"{deleteConfirm.title}"</strong> 콘티를 삭제하시겠습니까?
              <br />
              <span className="text-sm text-red-500">
                이 작업은 되돌릴 수 없으며, 포함된 모든 곡이 함께 삭제됩니다.
              </span>
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm({ show: false, setlistId: '', title: '' })}
                className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 font-medium"
                disabled={deleting}
              >
                취소
              </button>
              <button
                onClick={handleDeleteSetlist}
                disabled={deleting}
                className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 disabled:bg-slate-300 font-medium"
              >
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 고정곡 추가 모달 */}
      {showAddFixedSongModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-800">고정곡 추가</h3>
              <button
                onClick={() => {
                  setShowAddFixedSongModal(false)
                  setFixedSongSearch('')
                  setAvailableSongs([])
                  setCustomCategory('')
                }}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              {/* 카테고리 선택 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">카테고리</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100"
                >
                  {fixedSongCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {selectedCategory === '직접입력' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">카테고리 직접입력</label>
                  <input
                    type="text"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="예: 특송, 헌금찬양 등"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              )}

              {/* 곡 검색 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">곡 검색</label>
                <input
                  type="text"
                  value={fixedSongSearch}
                  onChange={(e) => {
                    setFixedSongSearch(e.target.value)
                    searchSongsForFixed(e.target.value)
                  }}
                  placeholder="곡 이름 또는 아티스트 검색..."
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* 검색 결과 */}
              <div className="max-h-60 overflow-y-auto">
                {availableSongs.length === 0 ? (
                  <p className="text-center text-slate-400 py-8">
                    {fixedSongSearch ? '검색 결과가 없습니다.' : '곡 이름을 검색하세요.'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {availableSongs.map(song => (
                      <div
                        key={song.id}
                        className="flex items-center justify-between p-4 border border-slate-100 rounded-xl hover:bg-slate-50"
                      >
                        <div>
                          <h4 className="font-medium text-slate-800">{song.song_name}</h4>
                          <p className="text-sm text-slate-500">{song.team_name}</p>
                        </div>
                        <button
                          onClick={() => handleAddFixedSong(song)}
                          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium"
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

      {/* 고정곡 미리보기 모달 */}
      {previewFixedSong && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800">{previewFixedSong.song.song_name}</h3>
                <p className="text-sm text-slate-500">{previewFixedSong.song.team_name}</p>
              </div>
              <button
                onClick={() => setPreviewFixedSong(null)}
                className="p-2 hover:bg-slate-100 rounded-lg"
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

      {/* 유튜브 모달 */}
      {youtubeModalSong && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800">{youtubeModalSong.song_name}</h3>
                <p className="text-sm text-slate-500">{youtubeModalSong.team_name}</p>
              </div>
              <button
                onClick={() => setYoutubeModalSong(null)}
                className="p-2 hover:bg-slate-100 rounded-lg"
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

      {/* 필기 노트 에디터 모달 */}
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

      {/* 고정곡 메뉴 외부 클릭 시 닫기 */}
      {activeFixedSongMenu && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setActiveFixedSongMenu(null)}
        />
      )}
    </div>
  )
}
