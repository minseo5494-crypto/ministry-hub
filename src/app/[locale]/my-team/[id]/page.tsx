'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { canEditSetlist } from '@/lib/teamOperations'
import TeamCalendar from './components/TeamCalendar'
import { logSetlistCreate, logSetlistView } from '@/lib/activityLogger'
import {
  ArrowLeft, Plus, Calendar, FileText, Settings,
  Users, Music, ChevronRight, Crown, Search, Edit, Trash2, Copy,
  Pin, Eye, Presentation, Youtube, Download, X, Check, Menu, Filter as FilterIcon, Pencil, Lock,
  MoreHorizontal, Home, Heart, StickyNote, LayoutDashboard, Library, LogOut
} from 'lucide-react'
import { useMobile } from '@/hooks/useMobile'
import { useSheetMusicNotes, LocalSheetMusicNote } from '@/hooks/useSheetMusicNotes'
import { useSetlistNotes, SetlistNoteData } from '@/hooks/useSetlistNotes'
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
  songs?: { song_id: string; song_name: string; team_name: string; order_number: number }[]
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
  const t = useTranslations('myTeam')
  const td = useTranslations('data')
  const translateService = (name: string) => {
    const key = `service_${name}` as any
    return td.has(key) ? td(key) : name
  }
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

  // 탭 상태
  const [activeTab, setActiveTab] = useState<'setlists' | 'songs' | 'calendar'>('setlists')

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
  const [noteEditorSetlistId, setNoteEditorSetlistId] = useState('')

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
        alert(t('loginRequired'))
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
      alert(t('leaveTeamFailed'))
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
        alert(t('noAccessToTeam'))
        router.push('/my-team')
        return
      }

      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single()

      if (teamError || !teamData) {
        alert(t('fetchTeamInfoFailed'))
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
      alert(t('fetchTeamInfoError'))
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
          users:created_by (name, email),
          team_setlist_songs (
            song_id,
            order_number,
            songs (id, song_name, team_name)
          )
        `)
        .eq('team_id', teamId)
        .order('service_date', { ascending: false })

      if (error) throw error

      const setlistsWithDetails = await Promise.all(
        (data || []).map(async (setlist: any) => {
          const canEdit = await canEditSetlist(teamId, setlist.id, user.id)

          const songs = (setlist.team_setlist_songs || []).map((s: any) => ({
            song_id: s.song_id,
            song_name: s.songs?.song_name || '',
            team_name: s.songs?.team_name || '',
            order_number: s.order_number
          }))

          return {
            id: setlist.id,
            title: setlist.title,
            service_date: setlist.service_date,
            service_type: setlist.service_type,
            song_count: songs.length,
            created_by: setlist.created_by,
            created_at: setlist.created_at,
            creator_name: setlist.users?.name,
            creator_email: setlist.users?.email,
            canEdit,
            songs
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
          song_name: t('unknownSong'),
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
      alert(t('categoryInputRequired'))
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
          alert(t('alreadyFixedSong'))
        } else {
          throw error
        }
        return
      }

      alert(`✅ ${t('fixedSongAdded')}`)
      setShowAddFixedSongModal(false)
      setFixedSongSearch('')
      fetchFixedSongs()
    } catch (error) {
      console.error('Error adding fixed song:', error)
      alert(t('fixedSongAddFailed'))
    }
  }

  const handleDeleteFixedSong = async (fixedSongId: string) => {
    if (!confirm(t('deleteFixedSongConfirm'))) return

    try {
      const { error } = await supabase
        .from('team_fixed_songs')
        .delete()
        .eq('id', fixedSongId)

      if (error) throw error

      alert(`✅ ${t('fixedSongDeleted')}`)
      fetchFixedSongs()
    } catch (error) {
      console.error('Error deleting fixed song:', error)
      alert(t('fixedSongDeleteFailed'))
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
      alert(t('selectDownloadSongs'))
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

      alert(`✅ ${t('downloadComplete', { count: selectedFixedSongs.length })}`)
      setSelectedFixedSongs([])
    } catch (error) {
      console.error('Download error:', error)
      alert(t('downloadError'))
    } finally {
      setDownloadingFixed(false)
    }
  }

  const openSelectedFixedSongsViewer = () => {
    if (selectedFixedSongs.length === 0) {
      alert(t('selectViewSongs'))
      return
    }

    const songsWithSheet = selectedFixedSongs.filter(fs => fs.song.file_url)

    if (songsWithSheet.length === 0) {
      alert(t('noSheetsInSelection'))
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
    setNoteEditorSetlistTitle(t('fixedSongSheetTitle'))
    setShowNoteEditor(true)
  }

  const handleCreateSetlist = async () => {
    if (!canCreateSetlist) {
      alert(t('setlistCreatePermDenied'))
      return
    }

    if (!newSetlist.title.trim()) {
      alert(t('setlistTitleRequired'))
      return
    }

    if (newSetlist.service_type === '직접입력' && !newSetlist.custom_service_type.trim()) {
      alert(t('serviceTypeRequired'))
      return
    }

    setCreating(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        alert(t('loginRequired'))
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
      if (!res.ok) throw new Error(result.error || t('setlistCreateFailed', { message: '' }))

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

      alert(`✅ ${t('setlistCreated')}`)
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
      alert(t('setlistCreateFailed', { message: error.message }))
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
      alert(t('setlistTitleRequired'))
      return
    }

    if (quickEditModal.type === '직접입력' && !quickEditModal.customType.trim()) {
      alert(t('serviceTypeRequired'))
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

      alert(`✅ ${t('setlistUpdated')}`)
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
      alert(t('setlistUpdateFailed', { message: error.message }))
    } finally {
      setQuickEditing(false)
    }
  }

  const handleCopySetlist = async (setlist: Setlist) => {
    if (!confirm(`"${setlist.title}" - ${t('copyConfirm')}`)) return

    setCopying(true)

    try {
      const { data: newSetlist, error: setlistError } = await supabase
        .from('team_setlists')
        .insert({
          team_id: teamId,
          title: t('copyTitle', { title: setlist.title }),
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
      alert(t('setlistCopyFailed', { message: error.message }))
    } finally {
      setCopying(false)
    }
  }

  const { saveNote } = useSheetMusicNotes()
  const { saveSetlistNote } = useSetlistNotes()

  const handleCopySetlistToNotes = async (setlist: Setlist) => {
    if (!user) {
      alert(t('loginRequired'))
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
        alert(t('noCopySongs'))
        return
      }

      const songsWithSheets = setlistSongs.filter(
        (item: any) => item.song?.file_url
      )

      if (songsWithSheets.length === 0) {
        alert(t('noSheetsForCopy'))
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
      setNoteEditorSetlistId(setlist.id)
      setShowNoteEditor(true)
    } catch (error: any) {
      console.error('Error copying to notes:', error)
      alert(t('copyFailed', { message: error.message }))
    } finally {
      setCopying(false)
    }
  }

  const handleSaveAllNotes = async (data: { song: any, annotations: PageAnnotation[], extra?: { songFormEnabled: boolean, songFormStyle: any, partTags: any[], pianoScores?: any[], drumScores?: any[] } }[]) => {
    if (!user) return

    // 다중 곡 + setlistId가 있으면 setlist_notes 테이블에 통합 저장
    if (data.length > 1 && noteEditorSetlistId) {
      const noteData: SetlistNoteData = {}
      data.forEach((item, index) => {
        noteData[item.song.song_id] = {
          order: index,
          song_name: item.song.song_name,
          file_url: item.song.file_url,
          file_type: item.song.file_type as 'pdf' | 'image',
          team_name: item.song.team_name || undefined,
          songForms: item.song.songForms || [],
          annotations: item.annotations || [],
          songFormEnabled: item.extra?.songFormEnabled ?? false,
          songFormStyle: item.extra?.songFormStyle || { x: 50, y: 10, fontSize: 24, color: '#000000', opacity: 1 },
          partTags: item.extra?.partTags || [],
          pianoScores: item.extra?.pianoScores,
          drumScores: item.extra?.drumScores,
        }
      })

      const result = await saveSetlistNote({
        user_id: user.id,
        setlist_id: noteEditorSetlistId,
        note_data: noteData,
        title: noteEditorSetlistTitle || `${t('setlistTab')} (${data.length})`,
      })

      setShowNoteEditor(false)
      setNoteEditorSongs([])
      setNoteEditorSetlistTitle('')
      setNoteEditorSetlistId('')

      if (result) {
        const savedCount = result.note_data ? Object.keys(result.note_data).length : 0
        alert(t('setlistNoteSaved', { count: savedCount }))
      } else {
        alert(t('setlistNoteSaveFailed'))
      }
      return
    }

    // 단일 곡이면 기존 sheet_music_notes에 개별 저장
    const item = data[0]
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
    setNoteEditorSetlistId('')

    if (result) {
      alert(t('noteSaved'))
    } else {
      alert(t('noteSaveFailed'))
    }
  }

  const handleCloseNoteEditor = () => {
    if (noteEditorSongs.length > 0) {
      if (!confirm(t('closeEditorConfirm'))) {
        return
      }
    }
    setShowNoteEditor(false)
    setNoteEditorSongs([])
    setNoteEditorSetlistTitle('')
    setNoteEditorSetlistId('')
  }

  const handleDeleteSetlist = async () => {
    if (!deleteConfirm.setlistId) return

    setDeleting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        alert(t('loginRequired'))
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
      if (!res.ok) throw new Error(result.error || t('setlistDeleteError', { message: '' }))

      alert(`✅ ${t('setlistDeleted')}`)
      setDeleteConfirm({ show: false, setlistId: '', title: '' })
      fetchSetlists()
    } catch (error: any) {
      console.error('Error deleting setlist:', error)
      alert(t('setlistDeleteError', { message: error.message }))
    } finally {
      setDeleting(false)
    }
  }

  const filteredSetlists = setlists
    .filter(setlist => {
      const normalizedSearch = searchTerm.replace(/\s/g, '').toLowerCase()
      const matchesSearch = searchTerm === '' ||
        setlist.title.replace(/\s/g, '').toLowerCase().includes(normalizedSearch) ||
        setlist.songs?.some(s => s.song_name.replace(/\s/g, '').toLowerCase().includes(normalizedSearch))

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

  const songUsageMap = useMemo(() => {
    const map = new Map<string, {
      song_name: string
      team_name: string
      setlists: { id: string; title: string; service_date: string }[]
    }>()

    setlists.forEach(setlist => {
      setlist.songs?.forEach(song => {
        if (!map.has(song.song_id)) {
          map.set(song.song_id, { song_name: song.song_name, team_name: song.team_name, setlists: [] })
        }
        map.get(song.song_id)!.setlists.push({
          id: setlist.id, title: setlist.title, service_date: setlist.service_date
        })
      })
    })

    return Array.from(map.entries())
      .sort((a, b) => b[1].setlists.length - a[1].setlists.length)
  }, [setlists])

  // 상대 날짜 계산
  const getRelativeDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return t('relativeToday')
    if (diffDays === 1) return t('relativeYesterday')
    if (diffDays < 7) return t('relativeDaysAgo', { count: diffDays })
    if (diffDays < 30) return t('relativeWeeksAgo', { count: Math.floor(diffDays / 7) })
    if (diffDays < 365) return t('relativeMonthsAgo', { count: Math.floor(diffDays / 30) })
    return t('relativeYearsAgo', { count: Math.floor(diffDays / 365) })
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
          <p className="mt-4 text-slate-600">{t('loading')}</p>
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
            <span className="text-sm font-bold uppercase tracking-widest text-slate-500">{t('pageTitle')}</span>
            <Link
              href="/my-team"
              className="text-xs font-medium text-blue-500 hover:text-blue-600"
            >
              {t('viewAll')}
            </Link>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {userTeams.map((team) => (
            <Link
              key={team.id}
              href={`/my-team/${team.id}`}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${
                team.id === teamId
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'text-slate-600 hover:bg-slate-200/50'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                team.id === teamId
                  ? 'bg-indigo-100 text-indigo-600'
                  : 'bg-slate-200 text-slate-600'
              }`}>
                {team.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate">{team.name}</p>
                {team.role === 'leader' && (
                  <span className="text-[10px] text-yellow-600 flex items-center gap-0.5">
                    <Crown size={10} />
                    {t('roleLeader')}
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
              <span>{t('createTeam')}</span>
            </Link>
            <Link
              href="/teams/join"
              className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all text-slate-500 hover:bg-slate-200/50"
            >
              <div className="w-8 h-8 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center">
                <Users size={16} />
              </div>
              <span>{t('joinTeam')}</span>
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
            {t('backToTeamList')}
          </button>
          <button
            onClick={() => router.push(`/my-team/${teamId}/settings`)}
            className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all text-slate-600 hover:bg-slate-200/50 w-full"
          >
            <Settings size={20} />
            {t('teamSettings')}
          </button>
          {team?.my_role !== 'leader' && (
            <button
              onClick={() => setShowLeaveConfirm(true)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all text-red-500 hover:bg-red-50 w-full"
            >
              <LogOut size={20} />
              {t('leaveTeam')}
            </button>
          )}
          {user && (
            <button
              onClick={() => router.push('/my-page/settings')}
              className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all w-full text-left"
              title={t('accountManage')}
            >
              <div className="w-10 h-10 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-600 font-bold">
                {user.email?.charAt(0).toUpperCase()}
              </div>
              <div className="overflow-hidden flex-1">
                <p className="text-xs font-bold text-slate-800 truncate">{user.user_metadata?.name || t('user')}</p>
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
                title={t('backToTeamList')}
              >
                <span className="material-symbols-outlined text-xl text-slate-600">arrow_back</span>
              </button>
              {/* 모바일: 로고 */}
              <Link href="/main" className="lg:hidden text-lg font-logo text-slate-700">
                WORSHEEP
              </Link>
              {/* 데스크톱: 페이지 제목 */}
              <span className="hidden lg:inline text-base font-semibold text-slate-700">{t('teamManagement')}</span>
            </div>
            <div className="flex items-center gap-2">
              {/* 모바일: 팀 나가기 */}
              {team?.my_role !== 'leader' && (
                <button
                  onClick={() => setShowLeaveConfirm(true)}
                  className="lg:hidden p-2 text-red-400 hover:bg-red-50 rounded-full transition"
                  title={t('leaveTeam')}
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
                    {t('roleLeader')}
                  </span>
                )}
                {team.my_role === 'admin' && (
                  <span className="text-xs font-semibold px-2 py-0.5 bg-purple-50 text-purple-600 rounded">
                    {t('roleAdmin')}
                  </span>
                )}
                {team.my_role === 'member' && (
                  <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                    {t('roleMember')}
                  </span>
                )}
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>{t('inviteCodeLabel')}: <span className="font-medium text-slate-700 font-mono">{team.invite_code}</span></span>
                  <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                  <span>{t('memberCount', { count: team.member_count })}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                  <span>{t('setlistCount', { count: setlists.length })}</span>
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
                <span>{t('newSetlist')}</span>
              </button>
            )}
          </header>

          {/* 고정곡 섹션 */}
          <section className="mb-12 lg:mb-16">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">{t('fixedSongs')}</h2>
                <span className="text-sm text-slate-400">{t('fixedSongsCount', { count: fixedSongs.length })}</span>
              </div>
              <div className="flex items-center gap-2">
                {selectedFixedSongs.length > 0 && (
                  <>
                    <button
                      onClick={openSelectedFixedSongsViewer}
                      className="text-xs font-medium text-blue-500 hover:text-blue-600 flex items-center gap-1"
                    >
                      <Presentation size={14} />
                      <span className="hidden sm:inline">{t('viewSheet')}</span>
                    </button>
                    <button
                      onClick={downloadSelectedFixedSongs}
                      disabled={downloadingFixed}
                      className="text-xs font-medium text-green-500 hover:text-green-600 flex items-center gap-1 disabled:opacity-50"
                    >
                      <Download size={14} />
                      <span className="hidden sm:inline">{downloadingFixed ? t('downloading') : t('downloadCount', { count: selectedFixedSongs.length })}</span>
                    </button>
                  </>
                )}
                {canAddFixedSong && (
                  <button
                    onClick={() => setShowAddFixedSongModal(true)}
                    className="text-xs font-medium text-blue-500 hover:underline flex items-center gap-1"
                  >
                    <Pin size={14} />
                    <span>{t('addFixedSong')}</span>
                  </button>
                )}
              </div>
            </div>

            {fixedSongs.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Pin className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">{t('noFixedSongs')}</p>
                {canAddFixedSong && (
                  <button
                    onClick={() => setShowAddFixedSongModal(true)}
                    className="mt-4 text-sm text-blue-500 hover:underline"
                  >
                    {t('addFirstFixedSong')}
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
                                  {t('preview')}
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
                                  {t('sheetNotes')}
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
                                {t('deleteLabel')}
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
                    <span className="text-xs font-bold">{t('addFixedSong')}</span>
                  </button>
                )}
              </div>
            )}
          </section>

          {/* 콘티 목록 섹션 */}
          <section>
            {/* 탭 UI */}
            <div className="flex gap-1 mb-6 p-1 bg-slate-100 rounded-xl w-fit">
              <button
                onClick={() => setActiveTab('setlists')}
                className={`min-h-[44px] px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === 'setlists'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t('setlistTab')}
              </button>
              <button
                onClick={() => setActiveTab('songs')}
                className={`min-h-[44px] px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === 'songs'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t('songUsageTab')}
              </button>
              <button
                onClick={() => setActiveTab('calendar')}
                className={`min-h-[44px] px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === 'calendar'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t('calendar.tab')}
              </button>
            </div>

            {activeTab === 'calendar' && (
              <TeamCalendar
                teamId={teamId}
                currentUserId={user?.id}
                isLeader={isTeamLeaderOrAdmin}
                memberCount={team?.member_count ?? 0}
              />
            )}

            {activeTab !== 'calendar' && (
            <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">
                {activeTab === 'setlists' ? t('setlistTab') : t('songUsageTab')}
              </h2>
              <div className="flex items-center gap-2 sm:gap-4">
                {/* 검색 */}
                <div className="relative flex-1 sm:flex-none">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={t('searchPlaceholder')}
                    className="w-full sm:w-48 pl-9 pr-4 py-2 text-sm border-none bg-slate-50 rounded-lg focus:ring-1 focus:ring-blue-100"
                  />
                </div>
                {/* 필터 버튼 - 콘티 탭에서만 표시 */}
                {activeTab === 'setlists' && (
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`p-2 rounded-lg transition ${showFilters ? 'bg-blue-50 text-blue-500' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <FilterIcon size={18} />
                  </button>
                )}
              </div>
            </div>

            {/* 필터 옵션 - 콘티 탭에서만 표시 */}
            {showFilters && activeTab === 'setlists' && (
              <div className="flex flex-wrap gap-3 mb-6 p-4 bg-slate-50 rounded-lg">
                <select
                  value={serviceTypeFilter}
                  onChange={(e) => setServiceTypeFilter(e.target.value)}
                  className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-blue-100"
                >
                  <option value="all">{t('allServices')}</option>
                  <option value="주일집회">{translateService('주일집회')}</option>
                  <option value="중보기도회">{translateService('중보기도회')}</option>
                  <option value="기도회">{translateService('기도회')}</option>
                </select>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-blue-100"
                >
                  <option value="date_desc">{t('sortDateDesc')}</option>
                  <option value="date_asc">{t('sortDateAsc')}</option>
                  <option value="created">{t('sortCreated')}</option>
                </select>
              </div>
            )}

            {activeTab === 'songs' ? (
              /* 곡별 사용 내역 탭 */
              <>
                {songUsageMap.filter(([, data]) =>
                  searchTerm === '' || data.song_name.replace(/\s/g, '').toLowerCase().includes(searchTerm.replace(/\s/g, '').toLowerCase())
                ).length === 0 ? (
                  <div className="text-center py-16">
                    <Music className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-500">{t('noSongData')}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {songUsageMap
                      .filter(([, data]) =>
                        searchTerm === '' || data.song_name.replace(/\s/g, '').toLowerCase().includes(searchTerm.replace(/\s/g, '').toLowerCase())
                      )
                      .map(([songId, data]) => (
                        <div key={songId} className="border border-slate-100 rounded-xl overflow-hidden">
                          <div className="flex items-center justify-between px-5 py-4 bg-white">
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 truncate">{data.song_name}</p>
                              {data.team_name && (
                                <p className="text-xs text-slate-400 mt-0.5 truncate">{data.team_name}</p>
                              )}
                            </div>
                            <span className="ml-4 flex-shrink-0 text-xs font-bold px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full">
                              {t('usageCount', { count: data.setlists.length })}
                            </span>
                          </div>
                          <div className="border-t border-slate-100 divide-y divide-slate-50">
                            {data.setlists.map(sl => (
                              <button
                                key={sl.id}
                                onClick={() => router.push(`/my-team/${teamId}/setlist/${sl.id}`)}
                                className="w-full flex items-center justify-between px-5 py-3 bg-slate-50 hover:bg-blue-50 transition-colors text-left"
                              >
                                <span className="text-sm text-slate-700 truncate">{sl.title}</span>
                                <span className="ml-4 flex-shrink-0 text-xs text-slate-400">
                                  {new Date(sl.service_date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}
              </>
            ) : filteredSetlists.length === 0 ? (
              <div className="text-center py-16">
                <FileText className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-500 mb-4">
                  {searchTerm || serviceTypeFilter !== 'all'
                    ? t('noSearchResults')
                    : t('noSetlists')}
                </p>
                {!searchTerm && serviceTypeFilter === 'all' && canCreateSetlist && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-6 py-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 text-sm font-semibold"
                  >
                    {t('createFirstSetlist')}
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* 데스크톱: 테이블 형태 */}
                <div className="hidden md:block">
                  {/* 테이블 헤더 */}
                  <div className="grid grid-cols-12 px-6 py-3 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <div className="col-span-2">{t('serviceDate')}</div>
                    <div className="col-span-4">{t('setlistTitle')}</div>
                    <div className="col-span-2">{t('serviceTypeLabel')}</div>
                    <div className="col-span-1 text-center">{t('songCount')}</div>
                    <div className="col-span-3 text-right">{t('actions')}</div>
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
                            by {setlist.creator_name || setlist.creator_email || (team?.is_demo ? 'Demo User' : '')}
                          </p>
                        )}
                        {setlist.songs && setlist.songs.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {setlist.songs
                              .slice()
                              .sort((a, b) => a.order_number - b.order_number)
                              .slice(0, 3)
                              .map((song) => (
                                <span
                                  key={song.song_id}
                                  className={`text-xs px-1.5 py-0.5 rounded truncate max-w-[120px] ${
                                    searchTerm && song.song_name.replace(/\s/g, '').toLowerCase().includes(searchTerm.replace(/\s/g, '').toLowerCase())
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : 'bg-slate-100 text-slate-500'
                                  }`}
                                >
                                  {song.song_name}
                                </span>
                              ))
                            }
                            {setlist.songs.length > 3 && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">
                                +{setlist.songs.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="col-span-2">
                        <span className="text-xs font-semibold px-2 py-1 bg-slate-100 text-slate-500 rounded">
                          {setlist.service_type}
                        </span>
                      </div>
                      <div className="col-span-1 text-center">
                        <span className="text-sm text-slate-500">{t('songCountUnit', { count: setlist.song_count })}</span>
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
                            title={t('sheetEditor')}
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
                                title={t('copySetlist')}
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
                                title={t('editLabel')}
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
                                title={t('deleteLabel')}
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
                              {t('songCountUnit', { count: setlist.song_count })}
                            </span>
                          </div>
                          <h3 className="font-semibold text-slate-800 line-clamp-2 mb-1">
                            {setlist.title}
                          </h3>
                          {setlist.songs && setlist.songs.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-1.5">
                              {setlist.songs
                                .slice()
                                .sort((a, b) => a.order_number - b.order_number)
                                .slice(0, 3)
                                .map((song) => (
                                  <span
                                    key={song.song_id}
                                    className={`text-xs px-1.5 py-0.5 rounded truncate max-w-[100px] ${
                                      searchTerm && song.song_name.replace(/\s/g, '').toLowerCase().includes(searchTerm.replace(/\s/g, '').toLowerCase())
                                        ? 'bg-yellow-100 text-yellow-700'
                                        : 'bg-slate-100 text-slate-500'
                                    }`}
                                  >
                                    {song.song_name}
                                  </span>
                                ))
                              }
                              {setlist.songs.length > 3 && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">
                                  +{setlist.songs.length - 3}
                                </span>
                              )}
                            </div>
                          )}
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
                          <span>{t('sheet')}</span>
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
                              <span>{t('copy')}</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                openQuickEditModal(setlist)
                              }}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-blue-600 hover:bg-blue-50 rounded-lg"
                            >
                              <Edit size={14} />
                              <span>{t('editLabel')}</span>
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
            </>
            )}
          </section>
        </main>
      </div>

      {/* 콘티 생성 모달 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-6 text-slate-800">{t('createSetlistModal')}</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('setlistTitleLabel')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newSetlist.title}
                  onChange={(e) => setNewSetlist({ ...newSetlist, title: e.target.value })}
                  placeholder={t('setlistTitlePlaceholder')}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('serviceDate')}
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
                  {t('serviceTypeLabel')}
                </label>
                <select
                  value={newSetlist.service_type}
                  onChange={(e) => setNewSetlist({ ...newSetlist, service_type: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                >
                  <option value="주일집회">{translateService('주일집회')}</option>
                  <option value="중보기도회">{translateService('중보기도회')}</option>
                  <option value="기도회">{translateService('기도회')}</option>
                  <option value="직접입력">{t('customInput')}</option>
                </select>
              </div>

              {newSetlist.service_type === '직접입력' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {t('serviceTypeInput')}
                  </label>
                  <input
                    type="text"
                    value={newSetlist.custom_service_type}
                    onChange={(e) => setNewSetlist({ ...newSetlist, custom_service_type: e.target.value })}
                    placeholder={t('serviceTypePlaceholder')}
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
                {t('cancel')}
              </button>
              <button
                onClick={handleCreateSetlist}
                disabled={creating}
                className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:bg-slate-300 font-medium"
              >
                {creating ? t('creating') : t('create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 빠른 편집 모달 */}
      {quickEditModal.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-6 text-slate-800">{t('editSetlist')}</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('setlistTitleLabel')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={quickEditModal.title}
                  onChange={(e) => setQuickEditModal({ ...quickEditModal, title: e.target.value })}
                  placeholder={t('setlistTitlePlaceholder')}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('serviceDate')}
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
                  {t('serviceTypeLabel')}
                </label>
                <select
                  value={quickEditModal.type}
                  onChange={(e) => setQuickEditModal({ ...quickEditModal, type: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100"
                >
                  <option value="주일집회">{translateService('주일집회')}</option>
                  <option value="중보기도회">{translateService('중보기도회')}</option>
                  <option value="기도회">{translateService('기도회')}</option>
                  <option value="직접입력">{t('customInput')}</option>
                </select>
              </div>

              {quickEditModal.type === '직접입력' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {t('serviceTypeInput')}
                  </label>
                  <input
                    type="text"
                    value={quickEditModal.customType}
                    onChange={(e) => setQuickEditModal({ ...quickEditModal, customType: e.target.value })}
                    placeholder={t('serviceTypePlaceholder')}
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
                {t('cancel')}
              </button>
              <button
                onClick={handleQuickEdit}
                disabled={quickEditing}
                className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:bg-slate-300 font-medium"
              >
                {quickEditing ? t('saving') : t('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 팀 나가기 확인 모달 */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4 text-red-600">{t('leaveTeamTitle')}</h2>
            <p className="text-slate-700 mb-6">
              {t('leaveTeamConfirm', { name: team?.name || '' })}
              <br />
              <span className="text-sm text-slate-500">
                {t('leaveTeamNote')}
              </span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 font-medium"
                disabled={leaving}
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleLeaveTeam}
                disabled={leaving}
                className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 disabled:bg-slate-300 font-medium"
              >
                {leaving ? t('leaving') : t('leave')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4 text-red-600">{t('deleteSetlistTitle')}</h2>
            <p className="text-slate-700 mb-6">
              {t('deleteSetlistConfirm', { title: deleteConfirm.title })}
              <br />
              <span className="text-sm text-red-500">
                {t('deleteSetlistWarning')}
              </span>
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm({ show: false, setlistId: '', title: '' })}
                className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 font-medium"
                disabled={deleting}
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleDeleteSetlist}
                disabled={deleting}
                className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 disabled:bg-slate-300 font-medium"
              >
                {deleting ? t('deleting') : t('delete')}
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
              <h3 className="text-xl font-bold text-slate-800">{t('addFixedSongModal')}</h3>
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
                <label className="block text-sm font-medium text-slate-700 mb-2">{t('category')}</label>
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
                  <label className="block text-sm font-medium text-slate-700 mb-2">{t('categoryCustomInput')}</label>
                  <input
                    type="text"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder={t('categoryCustomPlaceholder')}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              )}

              {/* 곡 검색 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">{t('songSearch')}</label>
                <input
                  type="text"
                  value={fixedSongSearch}
                  onChange={(e) => {
                    setFixedSongSearch(e.target.value)
                    searchSongsForFixed(e.target.value)
                  }}
                  placeholder={t('songSearchPlaceholder')}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* 검색 결과 */}
              <div className="max-h-60 overflow-y-auto">
                {availableSongs.length === 0 ? (
                  <p className="text-center text-slate-400 py-8">
                    {fixedSongSearch ? t('noSearchResultsModal') : t('searchSongsPrompt')}
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
                          {t('add')}
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
