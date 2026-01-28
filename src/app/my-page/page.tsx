'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, User, parseThemes, ThemeCount, fetchThemeCounts } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import {
  Music, Settings, Edit, Trash2, Eye, EyeOff, Globe,
  Lock, Users, Share2, Upload, ChevronRight, X, Save, Search, Filter, Plus, Heart, FileText, Pencil, Image, Download,
  Grid, List, CheckSquare, Square
} from 'lucide-react'
import { SEASONS, KEYS, TIME_SIGNATURES, TEMPOS } from '@/lib/constants'
import { getTempoFromBPM, getBPMRangeFromTempo } from '@/lib/musicUtils'
import { useMobile } from '@/hooks/useMobile'
import { useTeamNameSearch } from '@/hooks/useTeamNameSearch'
import { useSheetMusicNotes, LocalSheetMusicNote } from '@/hooks/useSheetMusicNotes'
import SheetMusicEditor from '@/components/SheetMusicEditor'
import SheetMusicViewer from '@/components/SheetMusicViewer'

interface UploadedSong {
  id: string
  song_name: string
  team_name?: string
  key?: string
  time_signature?: string
  tempo?: string
  bpm?: number
  themes?: string[]
  season?: string
  youtube_url?: string
  lyrics?: string
  file_url?: string
  file_type?: string
  visibility: 'public' | 'private' | 'teams'
  shared_with_teams?: string[]
  uploaded_by: string
  created_at: string
  // 사용 통계
  usage_count?: number
  usage_count_last_30_days?: number
  last_used_date?: string
}

interface Team {
  id: string
  name: string
  church_name?: string
}

// ===== 스팸 방지 유틸리티 =====

// 무의미한 한글 문자열 감지 (랜덤 조합 스팸)
const isSpamContent = (text: string): boolean => {
  if (!text || text.length < 3) return false

  const cleaned = text.replace(/\s/g, '')
  if (cleaned.length < 3) return false

  if (/^[a-zA-Z0-9\s\-_.,:!?]+$/.test(text)) return false

  const koreanChars = cleaned.match(/[가-힣]/g) || []
  if (koreanChars.length < 3) return false

  // ㅏ,ㅓ,ㅗ,ㅜ,ㅡ,ㅣ 모음 조합 + 조사/어미 + 흔한 받침 글자
  const commonSyllables = /[가나다라마바사아자차카타파하거너더러머버서어저처커터퍼허고노도로모보소오조초코토포호구누두루무부수우주추쿠투푸후그느드르므브스으즈츠크트프흐기니디리미비시이지치키티피히은는이가를의에서로와과도면만요네데게세레케테페헤한글음절상중하인신문원선전정명성현진영민준빛곡팀힘찬양배워러브제이어]/g
  const commonCount = (cleaned.match(commonSyllables) || []).length
  const koreanRatio = commonCount / koreanChars.length

  if (koreanRatio < 0.3 && koreanChars.length >= 4) {
    return true
  }

  const rareInitials = /[꺼-껴|떠-뗘|뻐-뼈|써-쎼|쩌-쪄]{2,}/
  if (rareInitials.test(cleaned)) return true

  return false
}

// 업로드 속도 제한 체크
const checkUploadRateLimit = async (
  supabaseClient: typeof supabase,
  userId: string,
  isAdmin?: boolean
): Promise<{ allowed: boolean; message?: string }> => {
  // 관리자는 제한 없음
  if (isAdmin) {
    return { allowed: true }
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { count: hourlyCount } = await supabaseClient
    .from('songs')
    .select('*', { count: 'exact', head: true })
    .eq('uploaded_by', userId)
    .gte('created_at', oneHourAgo)

  const { count: dailyCount } = await supabaseClient
    .from('songs')
    .select('*', { count: 'exact', head: true })
    .eq('uploaded_by', userId)
    .gte('created_at', oneDayAgo)

  if ((hourlyCount || 0) >= 5) {
    return { allowed: false, message: '업로드 제한: 시간당 최대 5곡까지 업로드 가능합니다. 잠시 후 다시 시도해주세요.' }
  }
  if ((dailyCount || 0) >= 20) {
    return { allowed: false, message: '업로드 제한: 일일 최대 20곡까지 업로드 가능합니다. 내일 다시 시도해주세요.' }
  }

  return { allowed: true }
}

export default function MyPagePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [songs, setSongs] = useState<UploadedSong[]>([])
const [userTeams, setUserTeams] = useState<Team[]>([])
const [activeTab, setActiveTab] = useState<'uploaded' | 'liked' | 'notes'>('uploaded')

// 🎵 좋아요한 곡 관련 상태
const [likedSongs, setLikedSongs] = useState<UploadedSong[]>([])
const [loadingLiked, setLoadingLiked] = useState(false)

// 📝 필기 노트 관련 상태
const {
  notes: sheetMusicNotes,
  loading: notesLoading,
  fetchNotes: fetchSheetMusicNotes,
  updateNote: updateSheetMusicNote,
  updateNoteTitle: updateSheetMusicNoteTitle,
  deleteNote: deleteSheetMusicNote,
} = useSheetMusicNotes()
const [editingNote, setEditingNote] = useState<LocalSheetMusicNote | null>(null)
const [showNoteEditor, setShowNoteEditor] = useState(false)

// 📝 필기 노트 뷰 및 선택 상태
const [notesViewMode, setNotesViewMode] = useState<'grid' | 'list'>('grid')
const [notesSelectMode, setNotesSelectMode] = useState(false)
const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set())
const [deletingNotes, setDeletingNotes] = useState(false)

// 📝 파일명 수정 및 공유 모달 상태
const [showRenameModal, setShowRenameModal] = useState(false)
const [renameNote, setRenameNote] = useState<LocalSheetMusicNote | null>(null)
const [newTitle, setNewTitle] = useState('')
const [showShareModal2, setShowShareModal2] = useState(false)
const [shareNote, setShareNote] = useState<LocalSheetMusicNote | null>(null)
const [shareFileName, setShareFileName] = useState('')
const [sharing, setSharing] = useState(false)

  
  // 공유 설정 모달
  const [showShareModal, setShowShareModal] = useState(false)
  const [selectedSong, setSelectedSong] = useState<UploadedSong | null>(null)
  const [shareSettings, setShareSettings] = useState({
    visibility: 'public' as 'public' | 'private' | 'teams',
    selected_teams: [] as string[]
  })
  const [saving, setSaving] = useState(false)

  // 곡 수정 모달
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingSongId, setEditingSongId] = useState<string | null>(null)
  const [editSong, setEditSong] = useState({
    song_name: '',
    team_name: '',
    key: '',
    time_signature: '',
    tempo: '',
    bpm: '',
    themes: [] as string[],
    season: '',
    youtube_url: '',
    lyrics: '',
    visibility: 'teams' as 'public' | 'teams' | 'private',
    shared_with_teams: [] as string[]
  })
  const [updating, setUpdating] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [editCustomTheme, setEditCustomTheme] = useState('')  // 수정 모달 사용자 정의 테마

  // 곡 미리보기 (인라인)
  const [previewStates, setPreviewStates] = useState<{ [key: string]: boolean }>({})

  // 📷 악보 뷰어 상태
  const [viewerSong, setViewerSong] = useState<UploadedSong | null>(null)
  const lastTapTimeRef = useRef<number>(0)
  const lastTapSongIdRef = useRef<string | null>(null)

  // 검색 및 필터
  const [searchText, setSearchText] = useState('')
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private' | 'teams'>('all')
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'usage'>('recent')

  // 곡 추가 모달 (메인페이지와 동일하게)
  const [showAddSongModal, setShowAddSongModal] = useState(false)
  const [newSong, setNewSong] = useState({
    song_name: '',
    team_name: '',
    key: '',
    time_signature: '',
    tempo: '',
    bpm: '',
    themes: [] as string[],
    season: '',
    youtube_url: '',
    lyrics: '',
    visibility: 'teams' as 'public' | 'teams' | 'private',
    shared_with_teams: [] as string[]
  })
  const [uploadingFile, setUploadingFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 수정 모달용 파일 상태
  const [editFile, setEditFile] = useState<File | null>(null)
  const [editCurrentFileUrl, setEditCurrentFileUrl] = useState<string | null>(null)
  const editFileInputRef = useRef<HTMLInputElement>(null)

  // 🔍 중복 체크 관련 상태
  const [duplicateSongs, setDuplicateSongs] = useState<UploadedSong[]>([])
  const [checkingDuplicate, setCheckingDuplicate] = useState(false)
  const duplicateCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // 🎨 동적 테마 목록 상태
  const [themeCounts, setThemeCounts] = useState<ThemeCount[]>([])
  const [themesLoading, setThemesLoading] = useState(true)
  const [newThemeInput, setNewThemeInput] = useState('')  // 새 테마 입력용
  

// ✅ 모바일 감지
const isMobile = useMobile()

// ✅ 팀명 자동완성 훅
const {
  suggestions: teamNameSuggestions,
  showSuggestions: showTeamSuggestions,
  searchTeamNames,
  setShowSuggestions: setShowTeamSuggestions
} = useTeamNameSearch()

// 🔍 텍스트 정규화 함수 (띄어쓰기, 특수문자 제거, 소문자 변환)
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/\([a-g][#b]?m?\)/gi, '')  // 키 표시 제거 (C), (D#), (Am), (Bb) 등
    .replace(/\s+/g, '')  // 모든 공백 제거
    .replace(/[^\w가-힣]/g, '')  // 특수문자 제거 (영문, 숫자, 한글만 유지)
}

// 🔍 중복 곡 체크 함수 (DB 전체에서 검색)
const checkDuplicateSong = async (songName: string, teamName: string) => {
  if (!songName.trim()) {
    setDuplicateSongs([])
    return
  }

  setCheckingDuplicate(true)

  try {
    const normalizedInput = normalizeText(songName)
    const normalizedTeam = normalizeText(teamName)

    // DB에서 비슷한 제목의 곡 검색 (ilike로 대소문자 무시)
    const { data, error } = await supabase
      .from('songs')
      .select('id, song_name, team_name, is_official, visibility, uploaded_by')
      .ilike('song_name', `%${songName.trim()}%`)
      .limit(50)

    if (error) throw error

    // 클라이언트에서 정규화하여 비교 (포함 관계도 체크)
    const duplicates = (data || []).filter(song => {
      const normalizedSongName = normalizeText(song.song_name || '')
      const normalizedSongTeam = normalizeText(song.team_name || '')

      // 정규화된 제목이 같거나 포함 관계인 경우
      const isSimilar = normalizedSongName === normalizedInput ||
                        normalizedSongName.includes(normalizedInput) ||
                        normalizedInput.includes(normalizedSongName)

      if (isSimilar) {
        // 아티스트도 입력된 경우 아티스트도 비교
        if (normalizedTeam && normalizedSongTeam) {
          return normalizedSongTeam === normalizedTeam ||
                 normalizedSongTeam.includes(normalizedTeam) ||
                 normalizedTeam.includes(normalizedSongTeam)
        }
        // 아티스트 미입력 시 제목만 비슷해도 중복 후보
        return true
      }
      return false
    })

    setDuplicateSongs(duplicates as unknown as UploadedSong[])
  } catch (error) {
    console.error('중복 체크 오류:', error)
  } finally {
    setCheckingDuplicate(false)
  }
}

// 🔍 제목 변경 시 디바운스로 중복 체크
const handleSongNameChange = (value: string) => {
  setNewSong({ ...newSong, song_name: value })

  // 기존 타이머 취소
  if (duplicateCheckTimeoutRef.current) {
    clearTimeout(duplicateCheckTimeoutRef.current)
  }

  // 500ms 후 중복 체크 실행
  duplicateCheckTimeoutRef.current = setTimeout(() => {
    checkDuplicateSong(value, newSong.team_name)
  }, 500)
}

// 🔍 아티스트 변경 시 디바운스로 중복 체크
const handleTeamNameChange = (value: string) => {
  setNewSong({ ...newSong, team_name: value })
  searchTeamNames(value)  // 기존 자동완성

  // 기존 타이머 취소
  if (duplicateCheckTimeoutRef.current) {
    clearTimeout(duplicateCheckTimeoutRef.current)
  }

  // 500ms 후 중복 체크 실행
  duplicateCheckTimeoutRef.current = setTimeout(() => {
    checkDuplicateSong(newSong.song_name, value)
  }, 500)
}

// ✅ 곡 삭제
  const handleDeleteSong = async (song: any) => {
  if (!confirm(`"${song.song_name}" 곡을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
    return
  }

  setDeleting(song.id)

  try {
    // 1. Storage에서 파일 삭제 (있는 경우)
    if (song.file_url) {
      const filePath = song.file_url.split('/song-sheets/')[1]
      if (filePath) {
        const { error: storageError } = await supabase.storage
          .from('song-sheets')
          .remove([filePath])

        if (storageError) {
          console.warn('파일 삭제 실패:', storageError)
        }
      }
    }

    // 2. DB에서 곡 삭제
    const { error: deleteError } = await supabase
      .from('songs')
      .delete()
      .eq('id', song.id)
      .eq('uploaded_by', user.id)  // 본인이 업로드한 곡만 삭제 가능

    if (deleteError) throw deleteError

    alert(`✅ "${song.song_name}"이(가) 삭제되었습니다.`)
    fetchUploadedSongs()  // 목록 새로고침
  } catch (error: any) {
    console.error('Error deleting song:', error)
    alert(`삭제 실패: ${error.message}`)
  } finally {
    setDeleting(null)
  }
}

  // 미리보기 토글
  const togglePreview = (songId: string) => {
    setPreviewStates(prev => ({
      ...prev,
      [songId]: !prev[songId]
    }))
  }

  // 📷 악보 뷰어 열기
  const openViewer = useCallback((song: UploadedSong) => {
    if (!song.file_url) return
    setViewerSong(song)
  }, [])

  // 📱 더블탭 핸들러 (터치 디바이스 지원)
  const handleDoubleTap = useCallback((song: UploadedSong) => {
    const now = Date.now()
    const DOUBLE_TAP_DELAY = 300

    if (lastTapSongIdRef.current === song.id && now - lastTapTimeRef.current < DOUBLE_TAP_DELAY) {
      openViewer(song)
      lastTapTimeRef.current = 0
      lastTapSongIdRef.current = null
    } else {
      lastTapTimeRef.current = now
      lastTapSongIdRef.current = song.id
    }
  }, [openViewer])

  // ✏️ 곡 수정 모달 열기
  const openEditModal = (song: UploadedSong) => {
    setEditingSongId(song.id)
    setEditSong({
      song_name: song.song_name || '',
      team_name: song.team_name || '',
      key: song.key || '',
      time_signature: song.time_signature || '',
      tempo: song.tempo || '',
      bpm: song.bpm?.toString() || '',
      themes: parseThemes(song.themes),
      season: song.season || '',
      youtube_url: song.youtube_url || '',
      lyrics: song.lyrics || '',
      visibility: song.visibility || 'teams',
      shared_with_teams: song.shared_with_teams || []
    })
    setEditCustomTheme('')  // 사용자 정의 테마 입력 초기화
    setEditFile(null)  // 새 파일 상태 초기화
    setEditCurrentFileUrl(song.file_url || null)  // 현재 파일 URL 설정
    setShowEditModal(true)
  }

  // ✏️ 곡 수정 저장
  const updateSong = async () => {
    if (!editingSongId || !user) return
    if (!editSong.song_name.trim()) {
      alert('곡 제목을 입력하세요.')
      return
    }

    // 팀 공유 시 팀 선택 확인
    if (editSong.visibility === 'teams' && editSong.shared_with_teams.length === 0) {
      alert('공유할 팀을 최소 1개 선택해주세요')
      return
    }

    setUpdating(true)

    try {
      let fileUrl = editCurrentFileUrl
      let fileType = editCurrentFileUrl ? editCurrentFileUrl.split('.').pop()?.toLowerCase() : null

      // 새 파일이 선택된 경우 업로드
      if (editFile) {
        const fileExt = editFile.name.split('.').pop()?.toLowerCase() || 'pdf'
        const timestamp = Date.now()
        const randomStr = Math.random().toString(36).substring(2, 8)
        const safeFileName = `${timestamp}_${randomStr}.${fileExt}`
        const filePath = `${user.id}/${safeFileName}`

        const { error: uploadError } = await supabase.storage
          .from('song-sheets')
          .upload(filePath, editFile, {
            cacheControl: '3600',
            upsert: false,
            contentType: editFile.type
          })

        if (uploadError) {
          throw new Error(`파일 업로드 실패: ${uploadError.message}`)
        }

        const { data: urlData } = supabase.storage
          .from('song-sheets')
          .getPublicUrl(filePath)

        fileUrl = urlData.publicUrl
        fileType = fileExt
      }

      const { error } = await supabase
        .from('songs')
        .update({
          song_name: editSong.song_name.trim(),
          team_name: editSong.team_name.trim() || null,
          key: editSong.key || null,
          time_signature: editSong.time_signature || null,
          tempo: editSong.tempo || null,
          bpm: editSong.bpm ? parseInt(editSong.bpm) : null,
          themes: editSong.themes.length > 0 ? editSong.themes : null,
          season: editSong.season || null,
          youtube_url: editSong.youtube_url.trim() || null,
          lyrics: editSong.lyrics.trim() || null,
          visibility: editSong.visibility,
          shared_with_teams: editSong.visibility === 'teams'
            ? editSong.shared_with_teams
            : null,
          file_url: fileUrl,
          file_type: fileType
        })
        .eq('id', editingSongId)

      if (error) throw error

      alert('✅ 곡 정보가 수정되었습니다!')
      setShowEditModal(false)
      setEditingSongId(null)
      setEditFile(null)
      setEditCurrentFileUrl(null)
      fetchUploadedSongs()  // 목록 새로고침
    } catch (error: any) {
      console.error('Error updating song:', error)
      alert(`수정 실패: ${error.message}`)
    } finally {
      setUpdating(false)
    }
  }

  // BPM 입력 시 템포 자동 선택 (수정용)
  const handleEditBPMChange = (bpmValue: string) => {
    const bpm = parseInt(bpmValue)
    if (!isNaN(bpm) && bpm > 0) {
      const autoTempo = getTempoFromBPM(bpm)
      setEditSong({ ...editSong, bpm: bpmValue, tempo: autoTempo })
    } else {
      setEditSong({ ...editSong, bpm: bpmValue })
    }
  }

  // 템포 선택 시 BPM 범위 검증 (수정용)
  const handleEditTempoChange = (tempoValue: string) => {
    const range = getBPMRangeFromTempo(tempoValue)
    const currentBPM = parseInt(editSong.bpm)

    if (range && !isNaN(currentBPM)) {
      if (currentBPM < range.min || currentBPM > range.max) {
        setEditSong({ ...editSong, tempo: tempoValue, bpm: '' })
        return
      }
    }
    setEditSong({ ...editSong, tempo: tempoValue })
  }

  useEffect(() => {
    checkUser()
  }, [])

  // 🎨 테마 목록 로드
  useEffect(() => {
    const loadThemes = async () => {
      setThemesLoading(true)
      const counts = await fetchThemeCounts()
      setThemeCounts(counts)
      setThemesLoading(false)
    }
    loadThemes()
  }, [])

  useEffect(() => {
    if (user) {
      fetchUploadedSongs()
      fetchUserTeams()
      fetchLikedSongs()  // 🎵 추가
      fetchSheetMusicNotes(user.id)  // 📝 필기 노트 불러오기
    }
  }, [user, fetchSheetMusicNotes])

  const checkUser = async () => {
    try {
      const currentUser = await getCurrentUser()
      if (!currentUser) {
        alert('로그인이 필요합니다.')
        router.push('/login')
        return
      }
      setUser(currentUser)

      // 관리자 여부 확인
      const { data: userData } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', currentUser.id)
        .single()

      setIsAdmin(userData?.is_admin || false)
    } catch (error) {
      console.error('Error checking user:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const fetchUploadedSongs = async () => {
    try {
      // 1. 곡 데이터 가져오기
      const { data: songsData, error: songsError } = await supabase
        .from('songs')
        .select('*')
        .eq('uploaded_by', user.id)
        .order('created_at', { ascending: false })

      if (songsError) throw songsError

      // 2. 사용 통계 가져오기
      const songIds = (songsData || []).map(s => s.id)
      
      if (songIds.length === 0) {
        setSongs([])
        return
      }

      const { data: statsData, error: statsError } = await supabase
        .from('song_usage_stats')
        .select('*')
        .in('song_id', songIds)

      if (statsError) {
        console.warn('통계 조회 실패:', statsError)
        // 통계 없이 곡만 표시
        setSongs(songsData || [])
        return
      }

      // 3. 데이터 병합
      const songsWithStats = (songsData || []).map(song => {
        const stats = statsData?.find(s => s.song_id === song.id)
        return {
          ...song,
          usage_count: stats?.usage_count || 0,
          usage_count_last_30_days: stats?.usage_count_last_30_days || 0,
          last_used_date: stats?.last_used_date || null
        }
      })

      setSongs(songsWithStats)
      console.log('곡 로드 완료:', songsWithStats.length)
    } catch (error) {
      console.error('Error fetching songs:', error)
    }
  }

  const fetchUserTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          teams:team_id (
            id,
            name,
            church_name
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')

      if (error) throw error

      const teams = (data || [])
        .map((item: any) => item.teams)
        .filter((team: any) => team !== null)

      setUserTeams(teams)
      console.log('팀 로드 완료:', teams.length)
    } catch (error) {
      console.error('Error fetching teams:', error)
    }
  }

  // 🎵 좋아요한 곡 불러오기
  const fetchLikedSongs = async () => {
    if (!user) return
    
    setLoadingLiked(true)
    try {
      // 1. 사용자의 좋아요 목록 가져오기
      const { data: likes, error: likesError } = await supabase
        .from('song_likes')
        .select('song_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      
      if (likesError) throw likesError
      
      if (!likes || likes.length === 0) {
        setLikedSongs([])
        return
      }
      
      // 2. 좋아요한 곡들의 상세 정보 가져오기
      const songIds = likes.map(l => l.song_id)
      const { data: songsData, error: songsError } = await supabase
        .from('songs')
        .select('*')
        .in('id', songIds)
      
      if (songsError) throw songsError
      
      // 3. 좋아요 순서대로 정렬
      const orderedSongs = songIds
        .map(id => songsData?.find(s => s.id === id))
        .filter(Boolean) as UploadedSong[]
      
      setLikedSongs(orderedSongs)
      console.log(`✅ 좋아요한 곡 ${orderedSongs.length}개 로드`)
    } catch (error) {
      console.error('좋아요한 곡 로드 실패:', error)
      setLikedSongs([])
    } finally {
      setLoadingLiked(false)
    }
  }

  // 파일 선택 핸들러
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('파일 크기는 10MB를 초과할 수 없습니다.')
        return
      }
      setUploadingFile(file)
    }
  }

  // 수정 모달용 파일 선택 핸들러
  const handleEditFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('파일 크기는 10MB를 초과할 수 없습니다.')
        return
      }
      setEditFile(file)
    }
  }

  // BPM 입력 시 템포 자동 선택
const handleBPMChange = (bpmValue: string) => {
const bpm = parseInt(bpmValue)
if (!isNaN(bpm) && bpm > 0) {
const autoTempo = getTempoFromBPM(bpm)
setNewSong({ ...newSong, bpm: bpmValue, tempo: autoTempo })
} else {
setNewSong({ ...newSong, bpm: bpmValue })
}
}

// 템포 선택 시 BPM 범위 검증
const handleTempoChange = (tempoValue: string) => {
const range = getBPMRangeFromTempo(tempoValue)
const currentBPM = parseInt(newSong.bpm)

if (range && !isNaN(currentBPM)) {
if (currentBPM < range.min || currentBPM > range.max) {
setNewSong({ ...newSong, tempo: tempoValue, bpm: '' })
return
}
}
setNewSong({ ...newSong, tempo: tempoValue })
}

  const addNewSong = async () => {
  if (!newSong.song_name.trim()) {
    alert('곡 제목을 입력하세요.')
    return
  }

  // 팀 공유 시 팀 선택 확인
  if (newSong.visibility === 'teams' && newSong.shared_with_teams.length === 0) {
    alert('공유할 팀을 최소 1개 선택해주세요')
    return
  }

  // 🔍 중복 곡 확인 (저장 전 최종 체크)
  if (duplicateSongs.length > 0) {
    const duplicateInfo = duplicateSongs.map(s =>
      `• "${s.song_name}"${s.team_name ? ` - ${s.team_name}` : ''}`
    ).join('\n')

    const confirmed = confirm(
      `⚠️ 비슷한 곡이 이미 존재합니다!\n\n${duplicateInfo}\n\n그래도 추가하시겠습니까?`
    )

    if (!confirmed) {
      return
    }
  }

  // 스팸 방지: 콘텐츠 검증
  if (isSpamContent(newSong.song_name.trim()) || isSpamContent(newSong.team_name.trim())) {
    alert('⚠️ 곡 제목 또는 아티스트명이 유효하지 않습니다.\n올바른 정보를 입력해주세요.')
    return
  }

  // 스팸 방지: 업로드 속도 제한 (관리자는 제한 없음)
  const rateLimit = await checkUploadRateLimit(supabase, user.id, user.is_admin)
  if (!rateLimit.allowed) {
    alert(`⚠️ ${rateLimit.message}`)
    return
  }

  setUploading(true)

  try {
    let fileUrl = ''
    let fileType = ''

    // 파일 업로드 (기존 로직 유지)
    if (uploadingFile) {
      const fileExt = uploadingFile.name.split('.').pop()?.toLowerCase() || 'pdf'
      const timestamp = Date.now()
      const randomStr = Math.random().toString(36).substring(2, 8)
      const safeFileName = `${timestamp}_${randomStr}.${fileExt}`
      const filePath = `${user.id}/${safeFileName}`

      console.log('📤 파일 업로드 시작:', filePath)

      const { error: uploadError } = await supabase.storage
        .from('song-sheets')
        .upload(filePath, uploadingFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: uploadingFile.type
        })

      if (uploadError) {
        console.error('❌ 업로드 오류:', uploadError)
        throw new Error(`파일 업로드 실패: ${uploadError.message}`)
      }

      console.log('✅ 파일 업로드 성공')

      const { data: urlData } = supabase.storage
        .from('song-sheets')
        .getPublicUrl(filePath)

      fileUrl = urlData.publicUrl
      fileType = fileExt

      console.log('🔗 Public URL:', fileUrl)
    }

    console.log('💾 DB에 곡 정보 저장 중...')

    // 🔍 공식 업로더 여부 확인
    const { data: officialUploader } = await supabase
      .from('official_uploaders')
      .select('id')
      .eq('email', user.email.toLowerCase())
      .single()

    const isOfficial = !!officialUploader

    // ✨ 모든 곡을 바로 songs 테이블에 저장 (메인페이지와 동일)
    const { error: insertError } = await supabase
      .from('songs')
      .insert({
        song_name: newSong.song_name.trim().normalize('NFC'),
        team_name: newSong.team_name.trim().normalize('NFC') || null,
        key: newSong.key || null,
        time_signature: newSong.time_signature || null,
        tempo: newSong.tempo || null,
        bpm: newSong.bpm ? parseInt(newSong.bpm) : null,
        themes: newSong.themes.length > 0 ? newSong.themes : null,
        season: newSong.season || null,
        youtube_url: newSong.youtube_url.trim() || null,
        lyrics: newSong.lyrics.trim() || null,
        file_url: fileUrl || null,
        file_type: fileType || null,
        uploaded_by: user.id,
        visibility: newSong.visibility,
        shared_with_teams: newSong.visibility === 'teams'
          ? newSong.shared_with_teams
          : null,
        is_user_uploaded: true,
        is_official: isOfficial
      })

    if (insertError) throw insertError

    alert('✅ 곡이 추가되었습니다!')

    console.log('✅ 곡 저장 완료')

    // 초기화
    setShowAddSongModal(false)
    setNewSong({
      song_name: '',
      team_name: '',
      key: '',
      time_signature: '',
      tempo: '',
      bpm: '',
      themes: [],
      season: '',
      youtube_url: '',
      lyrics: '',
      visibility: 'public',
      shared_with_teams: []
    })
    setUploadingFile(null)
    setDuplicateSongs([])  // 🔍 중복 체크 상태 초기화

    fetchUploadedSongs()  // ✅ 이게 맞음

  } catch (error: any) {
    console.error('❌ 곡 추가 오류:', error)
    alert(`❌ 곡 추가에 실패했습니다.\n\n오류: ${error.message}`)
  } finally {
    setUploading(false)
  }
}

  // 필터링된 곡 목록
  const filteredSongs = songs
    .filter(song => {
      // 검색어 필터
      const matchesSearch = 
        song.song_name.toLowerCase().includes(searchText.toLowerCase()) ||
        song.team_name?.toLowerCase().includes(searchText.toLowerCase())
      
      // 공유 상태 필터
      const matchesVisibility = 
        visibilityFilter === 'all' || 
        song.visibility === visibilityFilter
      
      return matchesSearch && matchesVisibility
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'name':
          return a.song_name.localeCompare(b.song_name, 'ko')
        case 'usage':
          return (b.usage_count || 0) - (a.usage_count || 0)
        default:
          return 0
      }
    })

  // 공유 범위 배지 렌더링
  const renderVisibilityBadge = (song: UploadedSong) => {
    if (song.visibility === 'private') {
      return (
        <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
          <Lock className="w-3 h-3 mr-1" />
          나만 보기
        </span>
      )
    } else if (song.visibility === 'public') {
      return (
        <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
          <Globe className="w-3 h-3 mr-1" />
          전체 공유
        </span>
      )
    } else if (song.visibility === 'teams') {
      return (
        <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
          <Users className="w-3 h-3 mr-1" />
          팀 공유 ({song.shared_with_teams?.length || 0}개)
        </span>
      )
    }
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <Music className="w-8 h-8 text-blue-600 flex-shrink-0" />
              <h1 className="text-xl sm:text-2xl font-bold whitespace-nowrap">My Page</h1>
              <span className="text-xs sm:text-sm text-gray-600 truncate max-w-[120px] sm:max-w-none">{user?.email}</span>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => router.push('/my-page/settings')}
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition whitespace-nowrap text-sm"
              >
                <Settings size={16} className="flex-shrink-0" />
                <span className="hidden sm:inline">계정 설정</span>
                <span className="sm:hidden">설정</span>
              </button>

              <button
                onClick={() => router.push('/')}
                className="px-3 sm:px-4 py-2 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8] touch-manipulation whitespace-nowrap text-sm"
              >
                메인으로
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">업로드한 곡</p>
                <p className="text-3xl font-bold text-blue-600">{songs.length}</p>
              </div>
              <Music className="w-12 h-12 text-blue-600 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">전체 공개</p>
                <p className="text-3xl font-bold text-green-600">
                  {songs.filter(s => s.visibility === 'public').length}
                </p>
              </div>
              <Globe className="w-12 h-12 text-green-600 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">팀 공유</p>
                <p className="text-3xl font-bold text-purple-600">
                  {songs.filter(s => s.visibility === 'teams').length}
                </p>
              </div>
              <Users className="w-12 h-12 text-purple-600 opacity-20" />
            </div>
          </div>
        </div>

        {/* 검색 및 필터 */}
        <div className="bg-white rounded-lg shadow p-3 md:p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-2 md:gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="곡명 또는 아티스트 검색..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm md:text-base"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <select
                value={visibilityFilter}
                onChange={(e) => setVisibilityFilter(e.target.value as any)}
                className="flex-1 md:flex-none px-3 md:px-4 py-2 border rounded-lg text-sm md:text-base"
              >
                <option value="all">모든 공유 상태</option>
                <option value="public">전체 공유</option>
                <option value="teams">팀 공유</option>
                <option value="private">나만 보기</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="flex-1 md:flex-none px-3 md:px-4 py-2 border rounded-lg text-sm md:text-base"
              >
                <option value="recent">최근순</option>
                <option value="name">이름순</option>
                <option value="usage">사용빈도순</option>
              </select>
            </div>

            <button
              onClick={() => setShowAddSongModal(true)}
              className="px-4 md:px-6 py-2 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8] flex items-center justify-center whitespace-nowrap text-sm md:text-base"
            >
              <Plus className="mr-1 md:mr-2" size={16} />
              곡 추가
            </button>
          </div>
        </div>

        {/* 곡 목록 */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            {/* 🎵 탭 전환 */}
            <div className="flex gap-2 md:gap-4 overflow-x-auto pb-1 -mb-1">
              <button
                onClick={() => setActiveTab('uploaded')}
                className={`text-sm md:text-lg font-bold pb-2 border-b-2 transition whitespace-nowrap flex-shrink-0 ${
                  activeTab === 'uploaded'
                    ? 'text-gray-900 border-blue-500'
                    : 'text-gray-400 border-transparent hover:text-gray-600'
                }`}
              >
                내가 추가한 곡 <span className="text-xs md:text-base">({filteredSongs.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('liked')}
                className={`text-sm md:text-lg font-bold pb-2 border-b-2 transition whitespace-nowrap flex-shrink-0 ${
                  activeTab === 'liked'
                    ? 'text-gray-900 border-red-500'
                    : 'text-gray-400 border-transparent hover:text-gray-600'
                }`}
              >
                <span className="hidden sm:inline">❤️ </span>좋아요 <span className="text-xs md:text-base">({likedSongs.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('notes')}
                className={`text-sm md:text-lg font-bold pb-2 border-b-2 transition whitespace-nowrap flex-shrink-0 ${
                  activeTab === 'notes'
                    ? 'text-gray-900 border-green-500'
                    : 'text-gray-400 border-transparent hover:text-gray-600'
                }`}
              >
                <span className="hidden sm:inline">📝 </span>필기 <span className="text-xs md:text-base">({sheetMusicNotes.length})</span>
              </button>
            </div>
          </div>

          {/* 🎵 내가 추가한 곡 탭 */}
          {activeTab === 'uploaded' && (
            <>
              {filteredSongs.length === 0 ? (
                <div className="text-center py-12">
                  <Music className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">
                    {searchText || visibilityFilter !== 'all'
                      ? '검색 결과가 없습니다' 
                      : '아직 추가한 곡이 없습니다'}
                  </p>
                  {!searchText && visibilityFilter === 'all' && (
                    <button
                      onClick={() => setShowAddSongModal(true)}
                      className="mt-4 px-6 py-3 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8] inline-flex items-center"
                    >
                      <Plus className="mr-2" size={18} />
                      첫 곡 업로드하기
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredSongs.map((song) => (
                    <div key={song.id} className="p-3 md:p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-base md:text-lg text-gray-900 truncate">{song.song_name}</h3>
                          <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-1 text-xs md:text-sm text-gray-600">
                            {song.team_name && <span className="truncate max-w-[100px] md:max-w-none">{song.team_name}</span>}
                            {song.key && <span>Key: {song.key}</span>}
                            {song.time_signature && <span>{song.time_signature}</span>}
                            {song.tempo && <span className="hidden md:inline">{song.tempo}</span>}
                            {song.bpm && <span>{song.bpm}BPM</span>}
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {renderVisibilityBadge(song)}
                            {parseThemes(song.themes).map(theme => (
                              <span key={theme} className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                                {theme}
                              </span>
                            ))}
                            {song.season && (
                              <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded">
                                {song.season}
                              </span>
                            )}
                          </div>
                          {song.usage_count !== undefined && song.usage_count > 0 && (
                            <div className="mt-2 text-xs text-gray-500">
                              사용 횟수: {song.usage_count}회
                              {song.usage_count_last_30_days !== undefined && song.usage_count_last_30_days > 0 && (
                                <span className="ml-2">(최근 30일: {song.usage_count_last_30_days}회)</span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex gap-1 md:gap-2 ml-2 md:ml-4 flex-shrink-0">
                          {/* 미리보기 토글 버튼 */}
                          {song.file_url && (
                            <button
                              onClick={() => togglePreview(song.id)}
                              className={`p-1.5 md:p-2 rounded-lg ${
                                previewStates[song.id]
                                  ? 'text-blue-600 bg-blue-100'
                                  : 'text-blue-600 hover:bg-blue-100'
                              }`}
                              title={previewStates[song.id] ? '접기' : '미리보기'}
                            >
                              {previewStates[song.id] ? <EyeOff size={18} className="md:w-5 md:h-5" /> : <Eye size={18} className="md:w-5 md:h-5" />}
                            </button>
                          )}
                          <button
                            onClick={() => openEditModal(song)}
                            className="p-1.5 md:p-2 text-green-600 hover:bg-green-100 rounded-lg"
                            title="수정"
                          >
                            <Edit size={18} className="md:w-5 md:h-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteSong(song)}
                            disabled={deleting === song.id}
                            className="p-1.5 md:p-2 text-red-600 hover:bg-red-100 rounded-lg disabled:opacity-50"
                            title="삭제"
                          >
                            {deleting === song.id ? (
                              <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Trash2 size={18} className="md:w-5 md:h-5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* 인라인 미리보기 */}
                      {previewStates[song.id] && song.file_url && (
                        <div className="mt-4 border-t pt-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-gray-700 text-sm">악보</h4>
                            <span className="text-xs text-gray-400">더블클릭하여 확대</span>
                          </div>
                          {song.file_type === 'pdf' ? (
                            <iframe
                              src={`${song.file_url}#toolbar=0&navpanes=0&scrollbar=1`}
                              className="w-full h-[500px] border rounded cursor-pointer"
                              onDoubleClick={(e) => {
                                e.stopPropagation()
                                openViewer(song)
                              }}
                            />
                          ) : (
                            <img
                              src={song.file_url}
                              alt={`${song.song_name} 악보`}
                              className="max-w-full h-auto rounded shadow-sm cursor-pointer"
                              onDoubleClick={(e) => {
                                e.stopPropagation()
                                openViewer(song)
                              }}
                              onTouchEnd={(e) => {
                                e.stopPropagation()
                                handleDoubleTap(song)
                              }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* 🎵 좋아요한 곡 탭 */}
          {activeTab === 'liked' && (
            <>
              {loadingLiked ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  <p className="mt-4 text-gray-600">불러오는 중...</p>
                </div>
              ) : likedSongs.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Heart size={48} className="mx-auto mb-4 text-gray-300" />
                  <p className="text-lg">좋아요한 곡이 없습니다</p>
                  <p className="text-sm mt-2">메인 페이지에서 마음에 드는 곡에 ❤️를 눌러보세요!</p>
                </div>
              ) : (
                <div className="divide-y">
                  {likedSongs.map((song) => (
                    <div key={song.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-bold text-lg text-gray-900">{song.song_name}</h3>
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                            {song.team_name && <span>{song.team_name}</span>}
                            {song.key && <span>Key: {song.key}</span>}
                            {song.time_signature && <span>{song.time_signature}</span>}
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {parseThemes(song.themes).map(theme => (
                              <span key={theme} className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                                {theme}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {song.file_url && (
                            <button
                              onClick={() => togglePreview(song.id)}
                              className={`p-2 rounded-lg ${
                                previewStates[song.id]
                                  ? 'text-blue-600 bg-blue-100'
                                  : 'text-blue-600 hover:bg-blue-100'
                              }`}
                              title={previewStates[song.id] ? '접기' : '미리보기'}
                            >
                              {previewStates[song.id] ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                          )}
                          <span className="text-xs px-2 py-1 bg-red-100 text-red-500 rounded flex items-center gap-1">
                            <Heart size={12} fill="currentColor" />
                          </span>
                        </div>
                      </div>

                      {/* 인라인 미리보기 */}
                      {previewStates[song.id] && song.file_url && (
                        <div className="mt-4 border-t pt-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-gray-700 text-sm">악보</h4>
                            <span className="text-xs text-gray-400">더블클릭하여 확대</span>
                          </div>
                          {song.file_type === 'pdf' ? (
                            <iframe
                              src={`${song.file_url}#toolbar=0&navpanes=0&scrollbar=1`}
                              className="w-full h-[500px] border rounded cursor-pointer"
                              onDoubleClick={(e) => {
                                e.stopPropagation()
                                openViewer(song)
                              }}
                            />
                          ) : (
                            <img
                              src={song.file_url}
                              alt={`${song.song_name} 악보`}
                              className="max-w-full h-auto rounded shadow-sm cursor-pointer"
                              onDoubleClick={(e) => {
                                e.stopPropagation()
                                openViewer(song)
                              }}
                              onTouchEnd={(e) => {
                                e.stopPropagation()
                                handleDoubleTap(song)
                              }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* 📝 내 필기 노트 탭 */}
          {activeTab === 'notes' && (
            <>
              {notesLoading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
                  <p className="mt-4 text-gray-600">불러오는 중...</p>
                </div>
              ) : sheetMusicNotes.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FileText size={48} className="mx-auto mb-4 text-gray-300" />
                  <p className="text-lg">필기 노트가 없습니다</p>
                  <p className="text-sm mt-2">메인 페이지에서 악보의 ✏️ 버튼을 눌러 필기해보세요!</p>
                  <button
                    onClick={() => router.push('/')}
                    className="mt-4 px-6 py-3 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                  >
                    악보 보러가기
                  </button>
                </div>
              ) : (
                <>
                  {/* 🆕 상단 툴바 */}
                  <div className="flex items-center justify-between p-4 border-b bg-gray-50">
                    <div className="flex items-center gap-2">
                      {/* 뷰 전환 버튼 */}
                      <div className="flex border rounded-lg overflow-hidden">
                        <button
                          onClick={() => setNotesViewMode('grid')}
                          className={`p-2 ${notesViewMode === 'grid' ? 'bg-green-100 text-green-700' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                          title="그리드 뷰"
                        >
                          <Grid size={18} />
                        </button>
                        <button
                          onClick={() => setNotesViewMode('list')}
                          className={`p-2 ${notesViewMode === 'list' ? 'bg-green-100 text-green-700' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                          title="리스트 뷰"
                        >
                          <List size={18} />
                        </button>
                      </div>

                      {/* 선택 모드 토글 */}
                      <button
                        onClick={() => {
                          setNotesSelectMode(!notesSelectMode)
                          if (notesSelectMode) {
                            setSelectedNoteIds(new Set())
                          }
                        }}
                        className={`px-3 py-2 rounded-lg text-sm font-medium ${
                          notesSelectMode
                            ? 'bg-green-100 text-green-700'
                            : 'bg-white border text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {notesSelectMode ? '선택 취소' : '선택'}
                      </button>
                    </div>

                    {/* 선택 모드일 때 표시 */}
                    {notesSelectMode && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">
                          {selectedNoteIds.size}개 선택됨
                        </span>
                        <button
                          onClick={() => {
                            if (selectedNoteIds.size === sheetMusicNotes.length) {
                              setSelectedNoteIds(new Set())
                            } else {
                              setSelectedNoteIds(new Set(sheetMusicNotes.map(n => n.id)))
                            }
                          }}
                          className="px-3 py-1 text-sm border rounded hover:bg-gray-100"
                        >
                          {selectedNoteIds.size === sheetMusicNotes.length ? '전체 해제' : '전체 선택'}
                        </button>
                        <button
                          onClick={async () => {
                            if (selectedNoteIds.size === 0) {
                              alert('삭제할 노트를 선택해주세요.')
                              return
                            }
                            if (!confirm(`선택한 ${selectedNoteIds.size}개의 노트를 삭제하시겠습니까?`)) return

                            setDeletingNotes(true)
                            let successCount = 0
                            for (const noteId of selectedNoteIds) {
                              const success = await deleteSheetMusicNote(noteId)
                              if (success) successCount++
                            }
                            setDeletingNotes(false)
                            setSelectedNoteIds(new Set())
                            setNotesSelectMode(false)
                            alert(`${successCount}개의 노트가 삭제되었습니다.`)
                          }}
                          disabled={selectedNoteIds.size === 0 || deletingNotes}
                          className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                        >
                          {deletingNotes ? '삭제 중...' : `삭제 (${selectedNoteIds.size})`}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 🆕 그리드 뷰 - 컴팩트한 파일 브라우저 스타일 */}
                  {notesViewMode === 'grid' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 p-4">
                      {sheetMusicNotes.map((note) => (
                        <div
                          key={note.id}
                          className={`bg-white border rounded-lg shadow-sm hover:shadow-md transition overflow-hidden relative ${
                            selectedNoteIds.has(note.id) ? 'ring-2 ring-green-500' : ''
                          }`}
                        >
                          {/* 선택 체크박스 */}
                          {notesSelectMode && (
                            <button
                              onClick={() => {
                                const newSet = new Set(selectedNoteIds)
                                if (newSet.has(note.id)) {
                                  newSet.delete(note.id)
                                } else {
                                  newSet.add(note.id)
                                }
                                setSelectedNoteIds(newSet)
                              }}
                              className="absolute top-1 left-1 z-10 p-0.5 bg-white rounded shadow"
                            >
                              {selectedNoteIds.has(note.id) ? (
                                <CheckSquare size={16} className="text-green-600" />
                              ) : (
                                <Square size={16} className="text-gray-400" />
                              )}
                            </button>
                          )}

                          {/* 썸네일 영역 - 더 작게 */}
                          <div
                            className="h-24 bg-gray-100 flex items-center justify-center cursor-pointer relative"
                            onClick={() => {
                              if (notesSelectMode) {
                                const newSet = new Set(selectedNoteIds)
                                if (newSet.has(note.id)) {
                                  newSet.delete(note.id)
                                } else {
                                  newSet.add(note.id)
                                }
                                setSelectedNoteIds(newSet)
                              } else {
                                setEditingNote(note)
                                setShowNoteEditor(true)
                              }
                            }}
                          >
                            {note.thumbnail_url ? (
                              <img
                                src={note.thumbnail_url}
                                alt={note.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="text-gray-400 text-center">
                                <FileText size={28} className="mx-auto" />
                              </div>
                            )}
                            {/* 파일 타입 배지 - 더 작게 */}
                            <span className={`absolute top-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              note.file_type === 'pdf'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {note.file_type === 'pdf' ? 'PDF' : 'IMG'}
                            </span>
                          </div>

                          {/* 정보 영역 - 더 컴팩트하게 */}
                          <div className="px-2 pt-2">
                            <h3 className="font-medium text-xs text-gray-900 truncate" title={note.title}>{note.title}</h3>
                            <p className="text-[10px] text-gray-500 truncate" title={note.song_name}>{note.song_name}</p>
                            <p className="text-[10px] text-gray-400 mt-1">
                              {new Date(note.updated_at).toLocaleDateString('ko-KR')}
                            </p>

                            {/* 버튼 영역 - 4등분 균등 배치 */}
                            {!notesSelectMode && (
                              <div className="flex mt-1 border-t pt-1 pb-0.5">
                                <button
                                  onClick={() => {
                                    setEditingNote(note)
                                    setShowNoteEditor(true)
                                  }}
                                  className="flex-1 flex justify-center text-green-600 hover:text-green-700"
                                  title="편집"
                                >
                                  <Edit size={15} />
                                </button>
                                <button
                                  onClick={() => {
                                    setRenameNote(note)
                                    setNewTitle(note.title)
                                    setShowRenameModal(true)
                                  }}
                                  className="flex-1 flex justify-center text-gray-400 hover:text-blue-600"
                                  title="파일명 변경"
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  onClick={() => {
                                    setShareNote(note)
                                    setShareFileName(note.title)
                                    setShowShareModal2(true)
                                  }}
                                  className="flex-1 flex justify-center text-gray-400 hover:text-blue-600"
                                  title="내보내기"
                                >
                                  <Upload size={15} />
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!confirm(`"${note.title}"을(를) 삭제하시겠습니까?`)) return
                                    const success = await deleteSheetMusicNote(note.id)
                                    if (success) {
                                      alert('삭제되었습니다.')
                                    }
                                  }}
                                  className="flex-1 flex justify-center text-gray-400 hover:text-red-600"
                                  title="삭제"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 🆕 리스트 뷰 */}
                  {notesViewMode === 'list' && (
                    <div className="divide-y">
                      {sheetMusicNotes.map((note) => (
                        <div
                          key={note.id}
                          className={`flex items-center gap-4 p-4 hover:bg-gray-50 ${
                            selectedNoteIds.has(note.id) ? 'bg-green-50' : ''
                          }`}
                        >
                          {/* 선택 체크박스 */}
                          {notesSelectMode && (
                            <button
                              onClick={() => {
                                const newSet = new Set(selectedNoteIds)
                                if (newSet.has(note.id)) {
                                  newSet.delete(note.id)
                                } else {
                                  newSet.add(note.id)
                                }
                                setSelectedNoteIds(newSet)
                              }}
                              className="flex-shrink-0"
                            >
                              {selectedNoteIds.has(note.id) ? (
                                <CheckSquare size={24} className="text-green-600" />
                              ) : (
                                <Square size={24} className="text-gray-400" />
                              )}
                            </button>
                          )}

                          {/* 썸네일 */}
                          <div
                            className="w-16 h-16 bg-gray-100 rounded flex-shrink-0 flex items-center justify-center cursor-pointer overflow-hidden"
                            onClick={() => {
                              if (notesSelectMode) {
                                const newSet = new Set(selectedNoteIds)
                                if (newSet.has(note.id)) {
                                  newSet.delete(note.id)
                                } else {
                                  newSet.add(note.id)
                                }
                                setSelectedNoteIds(newSet)
                              } else {
                                setEditingNote(note)
                                setShowNoteEditor(true)
                              }
                            }}
                          >
                            {note.thumbnail_url ? (
                              <img
                                src={note.thumbnail_url}
                                alt={note.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <FileText size={24} className="text-gray-400" />
                            )}
                          </div>

                          {/* 정보 */}
                          <div
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => {
                              if (notesSelectMode) {
                                const newSet = new Set(selectedNoteIds)
                                if (newSet.has(note.id)) {
                                  newSet.delete(note.id)
                                } else {
                                  newSet.add(note.id)
                                }
                                setSelectedNoteIds(newSet)
                              } else {
                                setEditingNote(note)
                                setShowNoteEditor(true)
                              }
                            }}
                          >
                            <h3 className="font-bold text-gray-900 truncate">{note.title}</h3>
                            <p className="text-sm text-gray-600 truncate">
                              {note.song_name} {note.team_name && `· ${note.team_name}`}
                            </p>
                            <p className="text-xs text-gray-400">
                              {new Date(note.updated_at).toLocaleDateString('ko-KR')}
                            </p>
                          </div>

                          {/* 타입 배지 */}
                          <span className={`px-2 py-1 rounded text-xs font-medium flex-shrink-0 ${
                            note.file_type === 'pdf'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {note.file_type === 'pdf' ? 'PDF' : 'IMG'}
                          </span>

                          {/* 버튼 - 선택 모드가 아닐 때만 표시 */}
                          {!notesSelectMode && (
                            <div className="flex gap-1 flex-shrink-0">
                              <button
                                onClick={() => {
                                  setEditingNote(note)
                                  setShowNoteEditor(true)
                                }}
                                className="p-2 text-green-600 hover:bg-green-100 rounded"
                                title="편집"
                              >
                                <Edit size={18} />
                              </button>
                              <button
                                onClick={() => {
                                  setRenameNote(note)
                                  setNewTitle(note.title)
                                  setShowRenameModal(true)
                                }}
                                className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                                title="이름 변경"
                              >
                                <Pencil size={18} />
                              </button>
                              <button
                                onClick={async () => {
                                  if (!confirm(`"${note.title}"을(를) 삭제하시겠습니까?`)) return
                                  const success = await deleteSheetMusicNote(note.id)
                                  if (success) {
                                    alert('삭제되었습니다.')
                                  }
                                }}
                                className="p-2 text-gray-600 hover:bg-red-100 hover:text-red-600 rounded"
                                title="삭제"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* 📝 필기 에디터 모달 */}
      {showNoteEditor && editingNote && (
        <SheetMusicEditor
          fileUrl={editingNote.file_url}
          fileType={editingNote.file_type}
          songName={editingNote.song_name}
          initialAnnotations={editingNote.annotations}
          songForms={editingNote.songForms}
          initialSongFormEnabled={editingNote.songFormEnabled}
          initialSongFormStyle={editingNote.songFormStyle}
          initialPartTags={editingNote.partTags}
          initialPianoScores={editingNote.pianoScores}
          onSave={async (annotations, extra) => {
            // Type assertion needed due to identical but separately declared types
            const success = await updateSheetMusicNote(editingNote.id, annotations, undefined, extra as unknown as Parameters<typeof updateSheetMusicNote>[3])
            if (success) {
              alert('저장되었습니다!')
              setShowNoteEditor(false)
              setEditingNote(null)
              // 노트 목록 새로고침
              if (user) {
                fetchSheetMusicNotes(user.id)
              }
            }
          }}
          onClose={() => {
            setShowNoteEditor(false)
            setEditingNote(null)
          }}
        />
      )}

      {/* 곡 추가 모달 (메인페이지와 동일) */}
      {showAddSongModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-2xl p-6 my-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">새 곡 추가</h2>
              <button
                onClick={() => {
                  setShowAddSongModal(false)
                  setNewSong({
                    song_name: '',
                    team_name: '',
                    key: '',
                    time_signature: '',
                    tempo: '',
                    bpm: '',
                    themes: [],
                    season: '',
                    youtube_url: '',
                    lyrics: '',
                    visibility: 'public',
                    shared_with_teams: []
                  })
                  setUploadingFile(null)
                  setDuplicateSongs([])  // 🔍 중복 체크 상태 초기화
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  곡 제목 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newSong.song_name}
                  onChange={(e) => handleSongNameChange(e.target.value)}
                  placeholder="예: 주의 이름 높이며"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    duplicateSongs.length > 0 ? 'border-orange-400 bg-orange-50' : 'border-gray-300'
                  }`}
                />
                {/* 🔍 중복 경고 표시 */}
                {checkingDuplicate && (
                  <p className="mt-1 text-sm text-gray-500">중복 확인 중...</p>
                )}
                {!checkingDuplicate && duplicateSongs.length > 0 && (
                  <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-sm font-medium text-orange-800 mb-1">
                      ⚠️ 비슷한 곡이 {duplicateSongs.length}개 있습니다:
                    </p>
                    <ul className="text-sm text-orange-700 space-y-1">
                      {duplicateSongs.slice(0, 5).map((song, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <span>• {song.song_name}</span>
                          {song.team_name && (
                            <span className="text-orange-600">- {song.team_name}</span>
                          )}
                        </li>
                      ))}
                      {duplicateSongs.length > 5 && (
                        <li className="text-orange-600">...외 {duplicateSongs.length - 5}곡</li>
                      )}
                    </ul>
                    <p className="text-xs text-orange-600 mt-2">
                      * 띄어쓰기와 특수문자는 무시하고 비교합니다
                    </p>
                  </div>
                )}
              </div>

              <div className="relative">
<label className="block text-sm font-medium text-gray-700 mb-1">
팀명 / 아티스트
</label>
<input
type="text"
value={newSong.team_name}
onChange={(e) => handleTeamNameChange(e.target.value)}
onFocus={() => {
  if (teamNameSuggestions.length > 0) setShowTeamSuggestions(true)
}}
onBlur={() => {
  // 약간의 딜레이를 줘서 클릭 이벤트가 먼저 처리되도록
  setTimeout(() => setShowTeamSuggestions(false), 200)
}}
placeholder="예: 위러브(Welove)"
className="w-full px-3 py-2 border border-gray-300 rounded-lg"
autoComplete="off"
/>
{/* 자동완성 드롭다운 */}
{showTeamSuggestions && teamNameSuggestions.length > 0 && (
  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
    {teamNameSuggestions.map((team, index) => (
      <button
        key={index}
        type="button"
        onClick={() => {
          setNewSong({ ...newSong, team_name: team })
          setShowTeamSuggestions(false)
        }}
        className="w-full px-4 py-2 text-left hover:bg-blue-50 text-gray-900 text-sm"
      >
        {team}
      </button>
    ))}
  </div>
)}
</div>


              {/* 🆕 공유 범위 선택 */}
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  공유 범위 <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  <label className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
                    newSong.visibility === 'public'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                    <input
                      type="radio"
                      name="visibility"
                      value="public"
                      checked={newSong.visibility === 'public'}
                      onChange={(e) => {
                        setNewSong({ ...newSong, visibility: 'public', shared_with_teams: [] })
                        // ✨ 경고문 추가
                        alert('⚠️ 전체 공개로 선택하시면 관리자 승인 후 공개됩니다.\n\n바로 사용하시려면 "팀 공유" 또는 "나만 보기"를 선택해주세요.')
                      }}
                      className="mr-3 accent-blue-500"
                    />
                    <div className="flex-1">
                      <div className={`font-medium ${newSong.visibility === 'public' ? 'text-blue-700' : 'text-gray-900'}`}>전체 공개</div>
                      <div className="text-sm text-gray-500">모든 사용자가 이 곡을 볼 수 있습니다</div>
                    </div>
                    {newSong.visibility === 'public' && (
                      <span className="text-blue-500 text-xl">✓</span>
                    )}
                  </label>

                  <label className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
                    newSong.visibility === 'teams'
                      ? 'border-violet-500 bg-violet-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                    <input
                      type="radio"
                      name="visibility"
                      value="teams"
                      checked={newSong.visibility === 'teams'}
                      onChange={(e) => setNewSong({ ...newSong, visibility: 'teams' })}
                      className="mr-3 accent-violet-500"
                    />
                    <div className="flex-1">
                      <div className={`font-medium ${newSong.visibility === 'teams' ? 'text-violet-700' : 'text-gray-900'}`}>팀 공개</div>
                      <div className="text-sm text-gray-500">선택한 팀만 이 곡을 볼 수 있습니다</div>
                    </div>
                    {newSong.visibility === 'teams' && (
                      <span className="text-violet-500 text-xl">✓</span>
                    )}
                  </label>

                  <label className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
                    newSong.visibility === 'private'
                      ? 'border-gray-500 bg-gray-100'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                    <input
                      type="radio"
                      name="visibility"
                      value="private"
                      checked={newSong.visibility === 'private'}
                      onChange={(e) => setNewSong({ ...newSong, visibility: 'private', shared_with_teams: [] })}
                      className="mr-3 accent-gray-500"
                    />
                    <div className="flex-1">
                      <div className={`font-medium ${newSong.visibility === 'private' ? 'text-gray-700' : 'text-gray-900'}`}>비공개</div>
                      <div className="text-sm text-gray-500">나만 이 곡을 볼 수 있습니다</div>
                    </div>
                    {newSong.visibility === 'private' && (
                      <span className="text-gray-500 text-xl">✓</span>
                    )}
                  </label>
                </div>

                {/* 🆕 팀 선택 (팀 공개 선택 시에만 표시) */}
                {newSong.visibility === 'teams' && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      공유할 팀 선택 <span className="text-red-500">*</span>
                    </label>
                    {userTeams.length > 0 ? (
                      <div className="space-y-2 max-h-40 overflow-y-auto border rounded-lg p-2">
                        {userTeams.map(team => {
                          const isSelected = newSong.shared_with_teams.includes(team.id)
                          return (
                            <label
                              key={team.id}
                              className={`flex items-center p-2 rounded cursor-pointer transition ${
                                isSelected
                                  ? 'bg-violet-100 border border-violet-300'
                                  : 'hover:bg-gray-50 border border-transparent'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setNewSong({
                                      ...newSong,
                                      shared_with_teams: [...newSong.shared_with_teams, team.id]
                                    })
                                  } else {
                                    setNewSong({
                                      ...newSong,
                                      shared_with_teams: newSong.shared_with_teams.filter(id => id !== team.id)
                                    })
                                  }
                                }}
                                className="mr-2 accent-violet-500"
                              />
                              <span className={isSelected ? 'text-violet-700 font-medium' : 'text-gray-700'}>{team.name}</span>
                            </label>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">소속된 팀이 없습니다. 먼저 팀에 참여하거나 생성하세요.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Key */}
<div>
<label className="block text-sm font-medium text-gray-700 mb-1">Key</label>

{/* Major/Minor 토글 추가 */}
<div className="flex gap-2 mb-2">
<button
type="button"
onClick={() => setNewSong({ ...newSong, key: newSong.key.replace('m', '') })}
className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
!newSong.key.includes('m')
? 'bg-[#C5D7F2] text-white'
: 'bg-gray-100 text-gray-700 hover:bg-gray-200'
}`}
>
Major
</button>
<button
type="button"
onClick={() => {
if (!newSong.key.includes('m') && newSong.key) {
setNewSong({ ...newSong, key: newSong.key + 'm' })
}
}}
className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
newSong.key.includes('m')
? 'bg-[#C4BEE2] text-white'
: 'bg-gray-100 text-gray-700 hover:bg-gray-200'
}`}
>
Minor
</button>
</div>

<select
value={newSong.key.replace('m', '')}
onChange={(e) => {
const baseKey = e.target.value
const isMinor = newSong.key.includes('m')
setNewSong({ ...newSong, key: isMinor && baseKey ? baseKey + 'm' : baseKey })
}}
className="w-full px-3 py-2 border border-gray-300 rounded-lg"
>
<option value="">선택</option>
{KEYS.map(key => (
<option key={key} value={key}>{key}{newSong.key.includes('m') ? 'm' : ''}</option>
))}
</select>
</div>

                {/* 박자 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">박자</label>
                  <select
                    value={newSong.time_signature}
                    onChange={(e) => setNewSong({ ...newSong, time_signature: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">선택</option>
                    {TIME_SIGNATURES.map(ts => (
                      <option key={ts} value={ts}>{ts}</option>
                    ))}
                  </select>
                </div>

                {/* 템포 */}
<div>
<label className="block text-sm font-medium text-gray-700 mb-1">템포</label>
<select
value={newSong.tempo}
onChange={(e) => handleTempoChange(e.target.value)}
className="w-full px-3 py-2 border border-gray-300 rounded-lg"
>
<option value="">선택</option>
{TEMPOS.map(tempo => (
<option key={tempo} value={tempo}>{tempo}</option>
))}
</select>
</div>

                {/* BPM */}
<div>
<label className="block text-sm font-medium text-gray-700 mb-1">
BPM
{newSong.tempo && getBPMRangeFromTempo(newSong.tempo) && (
<span className="text-xs text-gray-500 ml-2">
({getBPMRangeFromTempo(newSong.tempo)?.min} ~ {getBPMRangeFromTempo(newSong.tempo)?.max})
</span>
)}
</label>
<input
type="number"
value={newSong.bpm}
onChange={(e) => handleBPMChange(e.target.value)}
placeholder={newSong.tempo && getBPMRangeFromTempo(newSong.tempo) 
? `${getBPMRangeFromTempo(newSong.tempo)?.min} ~ ${getBPMRangeFromTempo(newSong.tempo)?.max}` 
: "예: 120"}
min={newSong.tempo && getBPMRangeFromTempo(newSong.tempo) ? getBPMRangeFromTempo(newSong.tempo)?.min : 1}
max={newSong.tempo && getBPMRangeFromTempo(newSong.tempo) ? getBPMRangeFromTempo(newSong.tempo)?.max : 300}
className="w-full px-3 py-2 border border-gray-300 rounded-lg"
/>
</div>
              </div>

              {/* 절기 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">절기</label>
                <select
                  value={newSong.season}
                  onChange={(e) => setNewSong({ ...newSong, season: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">선택</option>
                  {SEASONS.filter(s => s !== '전체').map(season => (
                    <option key={season} value={season}>{season}</option>
                  ))}
                </select>
              </div>

              {/* 🆕 테마 다중 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  테마 (다중 선택 가능)
                </label>

                {/* 선택된 테마 표시 */}
                {newSong.themes.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3 p-2 bg-blue-50 rounded-lg">
                    {newSong.themes.map((theme) => (
                      <span
                        key={theme}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-[#C5D7F2] text-white text-sm rounded-full"
                      >
                        {theme}
                        <button
                          type="button"
                          onClick={() => setNewSong({
                            ...newSong,
                            themes: newSong.themes.filter(t => t !== theme)
                          })}
                          className="w-4 h-4 flex items-center justify-center hover:bg-white/20 rounded-full"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* 기존 테마 선택 */}
                <div className="flex flex-wrap gap-2">
                  {themesLoading ? (
                    <p className="text-sm text-gray-500">테마 로딩 중...</p>
                  ) : (
                    themeCounts.map(({ theme }) => (
                      <button
                        key={theme}
                        type="button"
                        onClick={() => {
                          if (newSong.themes.includes(theme)) {
                            setNewSong({
                              ...newSong,
                              themes: newSong.themes.filter(t => t !== theme)
                            })
                          } else {
                            setNewSong({
                              ...newSong,
                              themes: [...newSong.themes, theme]
                            })
                          }
                        }}
                        className={`px-3 py-1 rounded-full text-sm transition ${
                          newSong.themes.includes(theme)
                            ? 'bg-[#C5D7F2] text-white'
                            : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                      >
                        {theme}
                      </button>
                    ))
                  )}
                </div>

                {/* 새 테마 직접 입력 */}
                <div className="flex gap-2 mt-3">
                  <input
                    id="newThemeInput"
                    type="text"
                    value={newThemeInput}
                    onChange={(e) => setNewThemeInput(e.target.value)}
                    placeholder="새 테마 직접 입력..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    onKeyDown={(e) => {
                      // 한글 IME 조합 중이면 무시
                      if (e.nativeEvent.isComposing) return
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const newTheme = newThemeInput.trim()
                        if (newTheme && !newSong.themes.includes(newTheme)) {
                          setNewSong({
                            ...newSong,
                            themes: [...newSong.themes, newTheme]
                          })
                          setNewThemeInput('')
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newTheme = newThemeInput.trim()
                      if (newTheme && !newSong.themes.includes(newTheme)) {
                        setNewSong({
                          ...newSong,
                          themes: [...newSong.themes, newTheme]
                        })
                        setNewThemeInput('')
                      }
                    }}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition"
                  >
                    추가
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  * Enter를 누르거나 추가 버튼을 클릭하면 새 테마가 추가됩니다
                </p>
              </div>

              {/*  YouTube URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  YouTube URL (선택사항)
                </label>
                <input
                  type="url"
                  value={newSong.youtube_url}
                  onChange={(e) => setNewSong({ ...newSong, youtube_url: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              {/* 가사 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  가사 (선택사항)
                </label>
                <textarea
                  value={newSong.lyrics}
                  onChange={(e) => setNewSong({ ...newSong, lyrics: e.target.value })}
                  rows={4}
                  placeholder="곡의 가사를 입력하세요..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  악보 파일 <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 transition flex items-center justify-center"
                  >
                    <Upload className="mr-2" size={20} />
                    {uploadingFile ? (
                      <span className="text-green-600 font-medium">
                        ✅ {uploadingFile.name} ({(uploadingFile.size / 1024 / 1024).toFixed(2)}MB)
                      </span>
                    ) : (
                      '파일 선택 (PDF, JPG, PNG, 최대 10MB)'
                    )}
                  </button>
                  {uploadingFile && (
                    <button
                      onClick={() => setUploadingFile(null)}
                      className="mt-2 text-sm text-red-600 hover:text-red-800"
                    >
                      파일 제거
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowAddSongModal(false)
                  setNewSong({
                    song_name: '',
                    team_name: '',
                    key: '',
                    time_signature: '',
                    tempo: '',
                    bpm: '',
                    themes: [],
                    season: '',
                    youtube_url: '',
                    lyrics: '',
                    visibility: 'public',
                    shared_with_teams: []
                  })
                  setUploadingFile(null)
                }}
                className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium"
              >
                취소
              </button>
              <button
                onClick={addNewSong}
                disabled={uploading || !newSong.song_name.trim() || !uploadingFile || (newSong.visibility === 'teams' && newSong.shared_with_teams.length === 0)}
                className="flex-1 px-6 py-3 bg-[#C5D7F2] hover:bg-[#A8C4E8] text-white rounded-lg font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {uploading ? '추가 중...' : '곡 추가'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📝 파일명 수정 모달 */}
      {showRenameModal && renameNote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">파일명 변경</h2>
            <p className="text-sm text-gray-600 mb-4">
              "{renameNote.song_name}"의 파일명을 변경합니다.
            </p>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="새 파일명 입력..."
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowRenameModal(false)
                  setRenameNote(null)
                  setNewTitle('')
                }}
                className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium"
              >
                취소
              </button>
              <button
                onClick={async () => {
                  if (!newTitle.trim()) {
                    alert('파일명을 입력해주세요.')
                    return
                  }
                  const success = await updateSheetMusicNoteTitle(renameNote.id, newTitle.trim())
                  if (success) {
                    alert('파일명이 변경되었습니다.')
                    setShowRenameModal(false)
                    setRenameNote(null)
                    setNewTitle('')
                  }
                }}
                disabled={!newTitle.trim()}
                className="flex-1 px-4 py-3 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg font-medium disabled:bg-gray-400"
              >
                변경
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📝 공유/다운로드 모달 */}
      {showShareModal2 && shareNote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">악보 내보내기</h2>
            <p className="text-sm text-gray-600 mb-4">
              형식을 선택하고 공유하거나 다운로드하세요.
            </p>

            {/* 파일명 입력 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">파일명</label>
              <input
                type="text"
                value={shareFileName}
                onChange={(e) => setShareFileName(e.target.value)}
                placeholder="파일명 입력..."
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* 공유 섹션 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Share2 size={14} className="inline mr-1" />
                공유하기
              </label>
              <div className="grid grid-cols-2 gap-3">
              <button
                onClick={async () => {
                  if (!shareFileName.trim()) {
                    alert('파일명을 입력해주세요.')
                    return
                  }
                  setSharing(true)
                  try {
                    // PDF 파일 가져오기
                    const response = await fetch(shareNote.file_url)
                    const blob = await response.blob()
                    const file = new File([blob], `${shareFileName.trim()}.pdf`, { type: 'application/pdf' })

                    // Web Share API 지원 확인
                    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                      await navigator.share({
                        title: shareFileName,
                        text: `${shareNote.song_name} 악보`,
                        files: [file]
                      })
                    } else {
                      // Web Share API 미지원 시 다운로드로 대체
                      const url = window.URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `${shareFileName.trim()}.pdf`
                      document.body.appendChild(a)
                      a.click()
                      window.URL.revokeObjectURL(url)
                      document.body.removeChild(a)
                      alert('이 브라우저에서는 직접 공유가 지원되지 않아 파일이 다운로드됩니다.')
                    }

                    setShowShareModal2(false)
                    setShareNote(null)
                    setShareFileName('')
                  } catch (error: any) {
                    if (error.name !== 'AbortError') {
                      console.error('공유 오류:', error)
                      alert('공유에 실패했습니다.')
                    }
                  } finally {
                    setSharing(false)
                  }
                }}
                disabled={sharing || !shareFileName.trim()}
                className="flex flex-col items-center justify-center p-4 bg-red-50 hover:bg-red-100 border-2 border-red-200 rounded-lg transition disabled:opacity-50"
              >
                <FileText size={32} className="text-red-600 mb-2" />
                <span className="font-medium text-red-700">PDF</span>
                <span className="text-xs text-red-500 mt-1">PDF 공유</span>
              </button>

              <button
                onClick={async () => {
                  if (!shareFileName.trim()) {
                    alert('파일명을 입력해주세요.')
                    return
                  }
                  setSharing(true)
                  try {
                    // 이미지로 변환하여 공유
                    const response = await fetch(shareNote.file_url)
                    const blob = await response.blob()

                    // 이미지인 경우 그대로 사용
                    const file = new File([blob], `${shareFileName.trim()}.png`, { type: 'image/png' })

                    // Web Share API 지원 확인
                    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                      await navigator.share({
                        title: shareFileName,
                        text: `${shareNote.song_name} 악보`,
                        files: [file]
                      })
                    } else {
                      // Web Share API 미지원 시 다운로드로 대체
                      const url = window.URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `${shareFileName.trim()}.png`
                      document.body.appendChild(a)
                      a.click()
                      window.URL.revokeObjectURL(url)
                      document.body.removeChild(a)
                      alert('이 브라우저에서는 직접 공유가 지원되지 않아 파일이 다운로드됩니다.')
                    }

                    setShowShareModal2(false)
                    setShareNote(null)
                    setShareFileName('')
                  } catch (error: any) {
                    if (error.name !== 'AbortError') {
                      console.error('공유 오류:', error)
                      alert('공유에 실패했습니다.')
                    }
                  } finally {
                    setSharing(false)
                  }
                }}
                disabled={sharing || !shareFileName.trim()}
                className="flex flex-col items-center justify-center p-4 bg-blue-50 hover:bg-blue-100 border-2 border-blue-200 rounded-lg transition disabled:opacity-50"
              >
                <Image size={32} className="text-blue-600 mb-2" />
                <span className="font-medium text-blue-700">이미지</span>
                <span className="text-xs text-blue-500 mt-1">PNG 공유</span>
              </button>
              </div>
            </div>

            {/* 다운로드 섹션 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Download size={14} className="inline mr-1" />
                다운로드
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={async () => {
                    if (!shareFileName.trim()) {
                      alert('파일명을 입력해주세요.')
                      return
                    }
                    setSharing(true)
                    try {
                      const response = await fetch(shareNote.file_url)
                      const blob = await response.blob()
                      const url = window.URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `${shareFileName.trim()}.pdf`
                      document.body.appendChild(a)
                      a.click()
                      window.URL.revokeObjectURL(url)
                      document.body.removeChild(a)

                      setShowShareModal2(false)
                      setShareNote(null)
                      setShareFileName('')
                    } catch (error) {
                      console.error('다운로드 오류:', error)
                      alert('다운로드에 실패했습니다.')
                    } finally {
                      setSharing(false)
                    }
                  }}
                  disabled={sharing || !shareFileName.trim()}
                  className="flex flex-col items-center justify-center p-3 bg-gray-50 hover:bg-gray-100 border-2 border-gray-200 rounded-lg transition disabled:opacity-50"
                >
                  <FileText size={24} className="text-gray-600 mb-1" />
                  <span className="font-medium text-gray-700 text-sm">PDF</span>
                </button>

                <button
                  onClick={async () => {
                    if (!shareFileName.trim()) {
                      alert('파일명을 입력해주세요.')
                      return
                    }
                    setSharing(true)
                    try {
                      const response = await fetch(shareNote.file_url)
                      const blob = await response.blob()
                      const url = window.URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `${shareFileName.trim()}.png`
                      document.body.appendChild(a)
                      a.click()
                      window.URL.revokeObjectURL(url)
                      document.body.removeChild(a)

                      setShowShareModal2(false)
                      setShareNote(null)
                      setShareFileName('')
                    } catch (error) {
                      console.error('다운로드 오류:', error)
                      alert('다운로드에 실패했습니다.')
                    } finally {
                      setSharing(false)
                    }
                  }}
                  disabled={sharing || !shareFileName.trim()}
                  className="flex flex-col items-center justify-center p-3 bg-gray-50 hover:bg-gray-100 border-2 border-gray-200 rounded-lg transition disabled:opacity-50"
                >
                  <Image size={24} className="text-gray-600 mb-1" />
                  <span className="font-medium text-gray-700 text-sm">이미지</span>
                </button>
              </div>
            </div>

            {sharing && (
              <div className="flex items-center justify-center py-2 text-gray-600">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mr-2"></div>
                준비 중...
              </div>
            )}

            <button
              onClick={() => {
                setShowShareModal2(false)
                setShareNote(null)
                setShareFileName('')
              }}
              disabled={sharing}
              className="w-full mt-4 px-4 py-3 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium disabled:opacity-50"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* ✏️ 곡 수정 모달 */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-2xl p-6 my-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">곡 정보 수정</h2>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setEditingSongId(null)
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  곡 제목 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editSong.song_name}
                  onChange={(e) => setEditSong({ ...editSong, song_name: e.target.value })}
                  placeholder="예: 주의 이름 높이며"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  팀명 / 아티스트
                </label>
                <input
                  type="text"
                  value={editSong.team_name}
                  onChange={(e) => setEditSong({ ...editSong, team_name: e.target.value })}
                  placeholder="예: 위러브(Welove)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              {/* 🆕 공유 범위 선택 */}
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  공유 범위 <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  <label className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
                    editSong.visibility === 'public'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                    <input
                      type="radio"
                      name="editVisibility"
                      value="public"
                      checked={editSong.visibility === 'public'}
                      onChange={(e) => setEditSong({ ...editSong, visibility: 'public', shared_with_teams: [] })}
                      className="mr-3 accent-blue-500"
                    />
                    <div className="flex-1">
                      <div className={`font-medium ${editSong.visibility === 'public' ? 'text-blue-700' : 'text-gray-900'}`}>전체 공개</div>
                      <div className="text-sm text-gray-500">모든 사용자가 이 곡을 볼 수 있습니다</div>
                    </div>
                    {editSong.visibility === 'public' && (
                      <span className="text-blue-500 text-xl">✓</span>
                    )}
                  </label>

                  <label className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
                    editSong.visibility === 'teams'
                      ? 'border-violet-500 bg-violet-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                    <input
                      type="radio"
                      name="editVisibility"
                      value="teams"
                      checked={editSong.visibility === 'teams'}
                      onChange={(e) => setEditSong({ ...editSong, visibility: 'teams' })}
                      className="mr-3 accent-violet-500"
                    />
                    <div className="flex-1">
                      <div className={`font-medium ${editSong.visibility === 'teams' ? 'text-violet-700' : 'text-gray-900'}`}>팀 공개</div>
                      <div className="text-sm text-gray-500">선택한 팀만 이 곡을 볼 수 있습니다</div>
                    </div>
                    {editSong.visibility === 'teams' && (
                      <span className="text-violet-500 text-xl">✓</span>
                    )}
                  </label>

                  <label className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
                    editSong.visibility === 'private'
                      ? 'border-gray-500 bg-gray-100'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                    <input
                      type="radio"
                      name="editVisibility"
                      value="private"
                      checked={editSong.visibility === 'private'}
                      onChange={(e) => setEditSong({ ...editSong, visibility: 'private', shared_with_teams: [] })}
                      className="mr-3 accent-gray-500"
                    />
                    <div className="flex-1">
                      <div className={`font-medium ${editSong.visibility === 'private' ? 'text-gray-700' : 'text-gray-900'}`}>비공개</div>
                      <div className="text-sm text-gray-500">나만 이 곡을 볼 수 있습니다</div>
                    </div>
                    {editSong.visibility === 'private' && (
                      <span className="text-gray-500 text-xl">✓</span>
                    )}
                  </label>
                </div>

                {/* 팀 선택 (팀 공개 선택 시에만 표시) */}
                {editSong.visibility === 'teams' && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      공유할 팀 선택 <span className="text-red-500">*</span>
                    </label>
                    {userTeams.length > 0 ? (
                      <div className="space-y-2 max-h-40 overflow-y-auto border rounded-lg p-2">
                        {userTeams.map(team => {
                          const isSelected = editSong.shared_with_teams.includes(team.id)
                          return (
                            <label key={team.id} className={`flex items-center p-2 rounded cursor-pointer transition ${
                              isSelected
                                ? 'bg-violet-100 border border-violet-300'
                                : 'hover:bg-gray-50 border border-transparent'
                            }`}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setEditSong({
                                      ...editSong,
                                      shared_with_teams: [...editSong.shared_with_teams, team.id]
                                    })
                                  } else {
                                    setEditSong({
                                      ...editSong,
                                      shared_with_teams: editSong.shared_with_teams.filter(id => id !== team.id)
                                    })
                                  }
                                }}
                                className="mr-2 accent-violet-600"
                              />
                              <span>{team.name}</span>
                            </label>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">소속된 팀이 없습니다.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Key */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Key</label>
                  <div className="flex gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setEditSong({ ...editSong, key: editSong.key.replace('m', '') })}
                      className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
                        !editSong.key.includes('m')
                          ? 'bg-[#C5D7F2] text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Major
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!editSong.key.includes('m') && editSong.key) {
                          setEditSong({ ...editSong, key: editSong.key + 'm' })
                        }
                      }}
                      className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
                        editSong.key.includes('m')
                          ? 'bg-[#C4BEE2] text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Minor
                    </button>
                  </div>
                  <select
                    value={editSong.key.replace('m', '')}
                    onChange={(e) => {
                      const baseKey = e.target.value
                      const isMinor = editSong.key.includes('m')
                      setEditSong({ ...editSong, key: isMinor && baseKey ? baseKey + 'm' : baseKey })
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">선택</option>
                    {KEYS.map(key => (
                      <option key={key} value={key}>{key}{editSong.key.includes('m') ? 'm' : ''}</option>
                    ))}
                  </select>
                </div>

                {/* 박자 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">박자</label>
                  <select
                    value={editSong.time_signature}
                    onChange={(e) => setEditSong({ ...editSong, time_signature: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">선택</option>
                    {TIME_SIGNATURES.map(ts => (
                      <option key={ts} value={ts}>{ts}</option>
                    ))}
                  </select>
                </div>

                {/* 템포 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">템포</label>
                  <select
                    value={editSong.tempo}
                    onChange={(e) => handleEditTempoChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">선택</option>
                    {TEMPOS.map(tempo => (
                      <option key={tempo} value={tempo}>{tempo}</option>
                    ))}
                  </select>
                </div>

                {/* BPM */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    BPM
                    {editSong.tempo && getBPMRangeFromTempo(editSong.tempo) && (
                      <span className="text-xs text-gray-500 ml-2">
                        ({getBPMRangeFromTempo(editSong.tempo)?.min} ~ {getBPMRangeFromTempo(editSong.tempo)?.max})
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    value={editSong.bpm}
                    onChange={(e) => handleEditBPMChange(e.target.value)}
                    placeholder="예: 120"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              {/* 절기 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">절기</label>
                <select
                  value={editSong.season}
                  onChange={(e) => setEditSong({ ...editSong, season: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">선택</option>
                  {SEASONS.filter(s => s !== '전체').map(season => (
                    <option key={season} value={season}>{season}</option>
                  ))}
                </select>
              </div>

              {/* 🆕 테마 다중 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  테마 (다중 선택 가능)
                </label>

                {/* 선택된 테마 표시 */}
                {editSong.themes.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3 p-2 bg-blue-50 rounded-lg">
                    {editSong.themes.map((theme) => (
                      <span
                        key={theme}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-[#C5D7F2] text-white text-sm rounded-full"
                      >
                        {theme}
                        <button
                          type="button"
                          onClick={() => setEditSong({
                            ...editSong,
                            themes: editSong.themes.filter(t => t !== theme)
                          })}
                          className="w-4 h-4 flex items-center justify-center hover:bg-white/20 rounded-full"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* 기존 테마 선택 */}
                <div className="flex flex-wrap gap-2">
                  {themesLoading ? (
                    <p className="text-sm text-gray-500">테마 로딩 중...</p>
                  ) : (
                    themeCounts.map(({ theme }) => (
                      <button
                        key={theme}
                        type="button"
                        onClick={() => {
                          if (editSong.themes.includes(theme)) {
                            setEditSong({
                              ...editSong,
                              themes: editSong.themes.filter(t => t !== theme)
                            })
                          } else {
                            setEditSong({
                              ...editSong,
                              themes: [...editSong.themes, theme]
                            })
                          }
                        }}
                        className={`px-3 py-1 rounded-full text-sm transition ${
                          editSong.themes.includes(theme)
                            ? 'bg-[#C5D7F2] text-white'
                            : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                      >
                        {theme}
                      </button>
                    ))
                  )}
                </div>

                {/* 새 테마 직접 입력 */}
                <div className="flex gap-2 mt-3">
                  <input
                    type="text"
                    value={editCustomTheme}
                    onChange={(e) => setEditCustomTheme(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.nativeEvent.isComposing) return
                      if (e.key === 'Enter' && editCustomTheme.trim()) {
                        e.preventDefault()
                        const newTheme = editCustomTheme.trim()
                        if (!editSong.themes.includes(newTheme)) {
                          setEditSong({
                            ...editSong,
                            themes: [...editSong.themes, newTheme]
                          })
                        }
                        setEditCustomTheme('')
                      }
                    }}
                    placeholder="새 테마 직접 입력..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (editCustomTheme.trim()) {
                        const newTheme = editCustomTheme.trim()
                        if (!editSong.themes.includes(newTheme)) {
                          setEditSong({
                            ...editSong,
                            themes: [...editSong.themes, newTheme]
                          })
                        }
                        setEditCustomTheme('')
                      }
                    }}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition"
                  >
                    추가
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  * Enter를 누르거나 추가 버튼을 클릭하면 새 테마가 추가됩니다
                </p>
              </div>

              {/* YouTube URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  YouTube URL (선택사항)
                </label>
                <input
                  type="url"
                  value={editSong.youtube_url}
                  onChange={(e) => setEditSong({ ...editSong, youtube_url: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              {/* 악보 파일 수정 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  악보 파일
                </label>
                <div className="mt-1">
                  <input
                    ref={editFileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleEditFileSelect}
                    className="hidden"
                  />

                  {/* 현재 파일 표시 */}
                  {editCurrentFileUrl && !editFile && (
                    <div className="mb-2 p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <FileText size={16} />
                        <span>현재 파일: {editCurrentFileUrl.split('/').pop()?.substring(0, 30)}...</span>
                      </div>
                      <button
                        onClick={() => setEditCurrentFileUrl(null)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        파일 삭제
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => editFileInputRef.current?.click()}
                    className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 transition flex items-center justify-center"
                  >
                    <Upload className="mr-2" size={20} />
                    {editFile ? (
                      <span className="text-green-600 font-medium">
                        ✅ {editFile.name} ({(editFile.size / 1024 / 1024).toFixed(2)}MB)
                      </span>
                    ) : editCurrentFileUrl ? (
                      '새 파일로 교체'
                    ) : (
                      '파일 선택 (PDF, JPG, PNG, 최대 10MB)'
                    )}
                  </button>
                  {editFile && (
                    <button
                      onClick={() => setEditFile(null)}
                      className="mt-2 text-sm text-red-600 hover:text-red-800"
                    >
                      새 파일 취소
                    </button>
                  )}
                </div>
              </div>

              {/* 가사 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  가사 (선택사항)
                </label>
                <textarea
                  value={editSong.lyrics}
                  onChange={(e) => setEditSong({ ...editSong, lyrics: e.target.value })}
                  rows={4}
                  placeholder="곡의 가사를 입력하세요..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setEditingSongId(null)
                }}
                className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium"
              >
                취소
              </button>
              <button
                onClick={updateSong}
                disabled={updating || !editSong.song_name.trim() || (editSong.visibility === 'teams' && editSong.shared_with_teams.length === 0)}
                className="flex-1 px-6 py-3 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {updating ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    수정 중...
                  </>
                ) : (
                  <>
                    <Save size={20} />
                    수정 완료
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📷 악보 뷰어 */}
      {viewerSong && viewerSong.file_url && (
        <SheetMusicViewer
          fileUrl={viewerSong.file_url}
          fileType={viewerSong.file_type === 'pdf' ? 'pdf' : 'image'}
          songName={viewerSong.song_name}
          onClose={() => setViewerSong(null)}
        />
      )}

    </div>
  )
}