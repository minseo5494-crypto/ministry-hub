'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase, Song, SECTION_ABBREVIATIONS, PageAnnotation, ThemeCount, fetchThemeCounts, SeasonCount, fetchSeasons, parseThemes } from '@/lib/supabase'
import { getCurrentUser, signOut } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { parseLyrics } from '@/lib/lyricParser'
import {
  Search, Music, FileText, Presentation, FolderOpen, Plus, X,
  ChevronLeft, ChevronRight, Eye, EyeOff, Upload, Users, UserPlus, MoreVertical,
  Grid, List, Filter, Tag, Calendar, Clock, Activity, ChevronDown,
  BarChart3, Youtube, Trash2, Menu, Heart, Pencil, Shield
} from 'lucide-react'
import { useMobile } from '@/hooks/useMobile'
import { useTeamNameSearch } from '@/hooks/useTeamNameSearch'
import { useDownload } from '@/hooks/useDownload'

import Link from 'next/link'
import { loadKoreanFont } from '@/lib/fontLoader'
// 🆕 로깅 함수 import
import { logSongSearch, logPPTDownload, logSongView, logPDFDownload } from '@/lib/activityLogger'
// 🆕 추가
import SongFormPositionModal from '@/components/SongFormPositionModal'
import DownloadLoadingModal from '@/components/DownloadLoadingModal'
import FilterPanel from '@/components/FilterPanel'  // ← 이 줄 추가
import SongFormModal from '@/components/SongFormModal'  // ← 이 줄 추가
import SheetMusicEditor from '@/components/SheetMusicEditor'
import { useSheetMusicNotes } from '@/hooks/useSheetMusicNotes'

import { generatePDF as generatePDFFile, PDFSong, SongFormPosition } from '@/lib/pdfGenerator'
import { SEASONS, TEMPO_RANGES } from '@/lib/constants'
import { getTempoFromBPM, getBPMRangeFromTempo } from '@/lib/musicUtils'

// 🆕 TypeScript를 위한 전역 선언 (import 아래에 추가)
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

// 모바일 기기 감지 함수
const isMobileDevice = () => {
  if (typeof navigator === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

export default function Home() {
  const router = useRouter()
  const isMobile = useMobile()
  const [user, setUser] = useState<any>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [showMenu, setShowMenu] = useState(false)

  // UI 상태 추가
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [showFilterPanel, setShowFilterPanel] = useState(true)
  const [showMobileMenu, setShowMobileMenu] = useState(false)  // ← 🆕 추가!
  
  // 임시 사용자 ID
  const USER_ID = user?.id || '00000000-0000-0000-0000-000000000001'

  // 기존 상태 유지
const [songs, setSongs] = useState<Song[]>([])
const [filteredSongs, setFilteredSongs] = useState<Song[]>([])
const [selectedSongs, setSelectedSongs] = useState<Song[]>([])
const [loading, setLoading] = useState(true)

// 🎵 좋아요 관련 상태
const [likedSongs, setLikedSongs] = useState<Set<string>>(new Set())
const [sortBy, setSortBy] = useState<'recent' | 'likes' | 'name'>('recent')
const [showUserUploaded, setShowUserUploaded] = useState(true) // 사용자 추가 악보 표시 여부

  // 🆕 무한 스크롤을 위한 상태
const [displayCount, setDisplayCount] = useState(20)
const [isLoadingMore, setIsLoadingMore] = useState(false)
const loadMoreRef = useRef<HTMLDivElement>(null)

  // 송폼 관련 상태
  const [songForms, setSongForms] = useState<{[songId: string]: string[]}>({})
  const [showFormModal, setShowFormModal] = useState(false)
  const [currentFormSong, setCurrentFormSong] = useState<Song | null>(null)

  const [customSection, setCustomSection] = useState('')

  /// useDownload 훅 사용
const {
  downloadingPDF,
  downloadingImage,
  downloadingPPT,
  showFormatModal,
  showPositionModal,
  showPPTModal,
  downloadProgress,  // 진행률 상태 추가
  setShowFormatModal,
  setShowPositionModal,
  setShowPPTModal,
  handleDownload,
  onPositionConfirm,
  onPositionCancel,
  startDownloadWithFormat,
  startPPTDownload,
  generatePPTWithOptions,
  // 🔄 다운로드 옵션 추가
  downloadOptions,
  setDownloadOptions,
  hasSongsWithForms,
  DownloadFormatModal,  // ✅ 추가
} = useDownload({
  selectedSongs,
  songForms,
  userId: user?.id
})

  
  
  
  // 악보 미리보기 상태
  const [previewSong, setPreviewSong] = useState<Song | null>(null)

  // 🆕 미리보기 토글 상태 (각 곡별로)
  const [previewStates, setPreviewStates] = useState<{ [key: string]: boolean }>({})

  // 🆕 유튜브 영상 토글 상태 (각 곡별로)
  const [youtubeStates, setYoutubeStates] = useState<{ [key: string]: boolean }>({})
  const [focusedSongIndex, setFocusedSongIndex] = useState<number>(-1)
  // 👇 이 줄 추가!
  const [youtubeModalSong, setYoutubeModalSong] = useState<Song | null>(null)

  // 📝 필기 에디터 상태
  const [showNoteEditor, setShowNoteEditor] = useState(false)
  const [editingSong, setEditingSong] = useState<Song | null>(null)
  const { saveNote } = useSheetMusicNotes()

  // 📝 다중 곡 악보 뷰어 상태
  const [multiSongEditorSongs, setMultiSongEditorSongs] = useState<{
    song_id: string
    song_name: string
    team_name?: string
    file_url: string
    file_type: 'pdf' | 'image'
    songForms?: string[]
  }[]>([])
  const [showMultiSongEditor, setShowMultiSongEditor] = useState(false)

  // 콘티 저장 관련 상태
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [setlistTitle, setSetlistTitle] = useState('')
  const [setlistDate, setSetlistDate] = useState(new Date().toISOString().split('T')[0])
  const [setlistType, setSetlistType] = useState('주일집회')
  const [customSetlistType, setCustomSetlistType] = useState('')
  const [selectedFolderId, setSelectedFolderId] = useState<string>('')
  const [folders, setFolders] = useState<any[]>([])
  // 🆕 팀 선택 상태 추가
  const [selectedTeamId, setSelectedTeamId] = useState<string>('')
  
  // 곡 추가 모달 상태
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

  // 🔍 중복 체크 관련 상태
  const [duplicateSongs, setDuplicateSongs] = useState<Song[]>([])
  const [checkingDuplicate, setCheckingDuplicate] = useState(false)
  const duplicateCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // 🆕 사용자의 팀 목록 상태 추가
  const [uploadingFile, setUploadingFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [userTeams, setUserTeams] = useState<any[]>([])

  // 🎨 동적 테마 목록 상태
  const [themeCounts, setThemeCounts] = useState<ThemeCount[]>([])
  const [themesLoading, setThemesLoading] = useState(true)

  // 📅 동적 절기 목록 상태
  const [seasonsList, setSeasonsList] = useState<SeasonCount[]>([])
  const [seasonsLoading, setSeasonsLoading] = useState(true)

  // ✅ 팀명 자동완성 훅
const {
  suggestions: teamNameSuggestions,
  showSuggestions: showTeamSuggestions,
  searchTeamNames,
  setShowSuggestions: setShowTeamSuggestions
} = useTeamNameSearch()
  
  // 필터 상태 (개선된 버전)
  const [filters, setFilters] = useState<{
    season: string;
    themes: string[];
    theme: string;
    key: string;
    isMinor: boolean;  // ← 추가!
    timeSignature: string;
    tempo: string;
    searchText: string;
    bpmMin: string;
    bpmMax: string;
  }>({
    season: '전체',
    themes: [] as string[],
    theme: '',  // 기존 호환성
    key: '',
    isMinor: false,  // ← 추가!
    timeSignature: '',
    tempo: '',
    searchText: '',
    // 👇 BPM 필터 추가
    bpmMin: '',
    bpmMax: ''
  })

  const songListRef = useRef<HTMLDivElement>(null)

  // 사용 가능한 옵션들
  const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
  const timeSignatures = ['4/4', '3/4', '6/8', '12/8', '6/4', '2/4']
  const tempos = ['느림', '조금느림', '보통', '조금빠름', '빠름', '매우빠름']

  

  // 사용자 정보 확인
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

  // 📅 절기 목록 로드
  useEffect(() => {
    const loadSeasons = async () => {
      setSeasonsLoading(true)
      const seasons = await fetchSeasons()
      setSeasonsList(seasons)
      setSeasonsLoading(false)
    }
    loadSeasons()
  }, [])

  // 🎵 좋아요 데이터 로드
useEffect(() => {
  if (user) {
    fetchLikeData()
  }
}, [user])

  // 🆕 PDF.js 초기화
  useEffect(() => {
    if (typeof window !== 'undefined' && window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      console.log('✅ PDF.js 초기화 완료');
    }
  }, [])

  const checkUser = async () => {
    try {
      const currentUser = await getCurrentUser()
      setUser(currentUser)
    } catch (error) {
      console.error('Error checking user:', error)
    } finally {
      setCheckingAuth(false)
    }
  }
  // 🆕 초기 로드 시 모바일이면 필터 패널 닫기
useEffect(() => {
  if (window.innerWidth < 768) {
    setShowFilterPanel(false)
  }
}, [])

  const handleSignOut = async () => {
    try {
      await signOut()
      setUser(null)
      router.push('/login')
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  // 메뉴 외부 클릭시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showMenu) {
        setShowMenu(false)
      }
    }
  
    if (showMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showMenu])

  // 데이터 불러오기
  useEffect(() => {
    fetchSongs()
    fetchUserTeams() // 🆕 추가!
  }, [user]) // 🆕 의존성도 변경!

  // 🆕 팀 정보가 로드된 후 곡 불러오기
  useEffect(() => {
    if (user !== null) { // null이 아닐 때만 (로그인 체크 완료 후)
      fetchSongs()
    }
  }, [user, userTeams])

  // 키보드 이벤트 핸들러
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return
      }

      if (previewSong) {
        if (e.key === 'Escape') {
          setPreviewSong(null)
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault()
          showPreviousSong()
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          showNextSong()
        }
        return
      }

      if (focusedSongIndex >= 0 && focusedSongIndex < filteredSongs.length) {
        if (e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault()
          const song = filteredSongs[focusedSongIndex]
          if (song.file_url) {
            setPreviewSong(song)
          } else {
            alert('악보가 없는 곡입니다.')
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          if (focusedSongIndex > 0) {
            setFocusedSongIndex(focusedSongIndex - 1)
          }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault()
          if (focusedSongIndex < filteredSongs.length - 1) {
            setFocusedSongIndex(focusedSongIndex + 1)
          }
        } else if (e.key === 'Enter') {
          e.preventDefault()
          toggleSongSelection(filteredSongs[focusedSongIndex])
        }
      }
    }

    

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [previewSong, focusedSongIndex, filteredSongs])

  const showPreviousSong = () => {
    if (!previewSong) return
    const currentIndex = filteredSongs.findIndex(s => s.id === previewSong.id)
    if (currentIndex > 0) {
      const prevSong = filteredSongs[currentIndex - 1]
      if (prevSong.file_url) {
        setPreviewSong(prevSong)
      }
    }
  }

  const showNextSong = () => {
    if (!previewSong) return
    const currentIndex = filteredSongs.findIndex(s => s.id === previewSong.id)
    if (currentIndex < filteredSongs.length - 1) {
      const nextSong = filteredSongs[currentIndex + 1]
      if (nextSong.file_url) {
        setPreviewSong(nextSong)
      }
    }
  }

const fetchSongs = async () => {
  setLoading(true)
  try {
    // 🔥 전체 데이터를 페이지네이션으로 가져오기
    let allData: any[] = []
    let from = 0
    const pageSize = 1000

    console.log('📊 데이터 로딩 시작...')

    while (true) {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .order('song_name', { ascending: true })
        .range(from, from + pageSize - 1)

      if (error) throw error
      if (!data || data.length === 0) break

      allData = [...allData, ...data]
      console.log(`📦 ${allData.length}개 로딩 중...`)

      // 마지막 페이지면 종료
      if (data.length < pageSize) break
      
      from += pageSize
    }

    console.log('✅ 전체 곡 데이터:', allData.length)

    // 🔍 특정 곡 존재 여부 확인
    const has3149 = allData.some(s => s.id === '3149')
    const has3150 = allData.some(s => s.id === '3150')
    const has3151 = allData.some(s => s.id === '3151')
    console.log('🎵 3149 존재?', has3149)
    console.log('🎵 3150 존재?', has3150)
    console.log('🎵 3151 존재?', has3151)

    // 🆕 공유 범위에 따른 필터링
    const filteredData = allData.filter(song => {
      // 🔍 디버깅: 특정 곡 체크
      if (song.id === '3149' || song.id === '3150' || song.id === '3151') {
        console.log(`🔍 곡 ${song.id} - "${song.song_name}" 필터링 체크:`, {
          song_name: song.song_name,
          name_length: song.song_name?.length,
          visibility: song.visibility,
          will_pass: song.song_name && song.song_name.trim() !== '' && song.song_name.length > 1
        })
      }
        
      // 기본 유효성 검사
      if (!song.song_name || song.song_name.trim() === '' || song.song_name.length <= 1) {
        return false
      }

      // 1. public 곡은 모두에게 표시
      if (song.visibility === 'public' || !song.visibility) {
        return true
      }

      // 로그인 안 한 사용자는 public만 볼 수 있음
      if (!user) {
        return false
      }

      // 2. private 곡은 본인만
      if (song.visibility === 'private') {
        return song.uploaded_by === user.id
      }

      // 3. teams 곡은 해당 팀 소속 멤버만
      if (song.visibility === 'teams') {
        if (song.uploaded_by === user.id) {
          return true // 본인이 올린 곡
        }
      
        // 내가 속한 팀과 곡이 공유된 팀이 겹치는지 확인
        const myTeamIds = userTeams.map(t => t.id)
        const sharedTeamIds = song.shared_with_teams || []
      
        return myTeamIds.some(teamId => sharedTeamIds.includes(teamId))
      }

      return false
    })
  
    console.log(`✅ 총 ${allData.length}개 중 ${filteredData.length}개의 곡 표시`)
    console.log(`   - 사용자: ${user?.email || '비로그인'}`)
    console.log(`   - 소속 팀: ${userTeams.length}개`)
    
    // 🔍 필터링 후 특정 곡 존재 여부
    console.log('🎵 필터링 후 3149 포함?', filteredData.some(s => s.id === '3149'))
    console.log('🎵 필터링 후 3150 포함?', filteredData.some(s => s.id === '3150'))
    console.log('🎵 필터링 후 3151 포함?', filteredData.some(s => s.id === '3151'))
  
    setSongs(filteredData)
    
    // 🆕 미리보기 상태 초기화
    const initialPreviewStates: { [key: string]: boolean } = {}
    const initialYoutubeStates: { [key: string]: boolean } = {}
    filteredData.forEach(song => {
      initialPreviewStates[song.id] = false
      initialYoutubeStates[song.id] = false
    })
    setPreviewStates(initialPreviewStates)
    setYoutubeStates(initialYoutubeStates)
    setFilteredSongs(filteredData)
  } catch (error) {
    console.error('Error fetching songs:', error)
    alert('데이터를 불러오는데 실패했습니다.')
  } finally {
    setLoading(false)
  }
}

  const fetchFolders = async () => {
    try {
      const { data, error } = await supabase
       .from('folders')
       .select('*')
       .order('created_at', { ascending: false })

      if (error) throw error
      setFolders(data || [])
    } catch (error) {
      console.error('Error fetching folders:', error)
      setFolders([])
    }
  }

  // 🆕 여기에 추가!
  const fetchUserTeams = async () => {
    if (!user) return
  
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          team_id,
          teams (
            id,
            name
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')

      if (error) throw error

      const teams = data?.map((tm: any) => ({
        id: tm.teams.id,
        name: tm.teams.name
      })) || []

      setUserTeams(teams)
      console.log('✅ 사용자 팀 목록:', teams)
    } catch (error) {
      console.error('Error fetching user teams:', error)
      setUserTeams([])
    }
  }

  // 🎵 좋아요 데이터 로드
const fetchLikeData = async () => {
  if (!user) return
  
  try {
    // 사용자의 좋아요 목록
    const { data: userLikes } = await supabase
      .from('song_likes')
      .select('song_id')
      .eq('user_id', user.id)
    
    if (userLikes) {
      setLikedSongs(new Set(userLikes.map(l => l.song_id)))
    }
  } catch (error) {
    console.error('좋아요 데이터 로드 실패:', error)
  }
}

// 🎵 좋아요 토글
const toggleLike = async (e: React.MouseEvent, songId: string) => {
  e.stopPropagation()
  
  if (!user) {
    alert('로그인이 필요합니다.')
    return
  }
  
  const isLiked = likedSongs.has(songId)
  
  try {
    if (isLiked) {
      // 좋아요 취소
      await supabase
        .from('song_likes')
        .delete()
        .eq('song_id', songId)
        .eq('user_id', user.id)
      
      setLikedSongs(prev => {
        const next = new Set(prev)
        next.delete(songId)
        return next
      })
      
      // songs 상태에서 like_count 업데이트
      setSongs(prev => prev.map(s => 
        s.id === songId 
          ? { ...s, like_count: Math.max(0, (s.like_count || 1) - 1) }
          : s
      ))
    } else {
      // 좋아요 추가
      await supabase
        .from('song_likes')
        .insert({ song_id: songId, user_id: user.id })
      
      setLikedSongs(prev => new Set([...prev, songId]))
      
      // songs 상태에서 like_count 업데이트
      setSongs(prev => prev.map(s => 
        s.id === songId 
          ? { ...s, like_count: (s.like_count || 0) + 1 }
          : s
      ))
    }
  } catch (error) {
    console.error('좋아요 처리 실패:', error)
  }
}

  // 🆕 미리보기 토글
  const togglePreview = (songId: string) => {
    setPreviewStates(prev => ({
      ...prev,
      [songId]: !prev[songId]
    }))
  }

  // 🆕 유튜브 영상 토글
  const toggleYoutube = (songId: string) => {
    setYoutubeStates(prev => ({
      ...prev,
      [songId]: !prev[songId]
    }))
  }

  // 🆕 유튜브 URL을 임베드 형식으로 변환
  const getYoutubeEmbedUrl = (url: string) => {
    if (!url) return null
  
    // https://www.youtube.com/watch?v=VIDEO_ID 형식
    const watchMatch = url.match(/[?&]v=([^&]+)/)
    if (watchMatch) {
      return `https://www.youtube.com/embed/${watchMatch[1]}`
    }
  
    // https://youtu.be/VIDEO_ID 형식
    const shortMatch = url.match(/youtu\.be\/([^?]+)/)
    if (shortMatch) {
      return `https://www.youtube.com/embed/${shortMatch[1]}`
    }
  
    // 이미 embed 형식인 경우
    if (url.includes('/embed/')) {
      return url
    }
  
    return null
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

// 🔍 텍스트 정규화 함수 (띄어쓰기, 특수문자 제거, 소문자 변환)
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/\s+/g, '')  // 모든 공백 제거
    .replace(/[^\w가-힣]/g, '')  // 특수문자 제거 (영문, 숫자, 한글만 유지)
}

// 🔍 중복 곡 체크 함수
const checkDuplicateSong = async (songName: string, teamName: string) => {
  if (!songName.trim()) {
    setDuplicateSongs([])
    return
  }

  setCheckingDuplicate(true)

  try {
    // 먼저 모든 곡을 가져와서 클라이언트에서 비교
    // (DB에서 정규화된 비교가 어려우므로)
    const normalizedInput = normalizeText(songName)
    const normalizedTeam = normalizeText(teamName)

    // 이미 로드된 songs에서 검색 (성능 최적화)
    const duplicates = songs.filter(song => {
      const normalizedSongName = normalizeText(song.song_name || '')
      const normalizedSongTeam = normalizeText(song.team_name || '')

      // 제목이 같은 경우
      if (normalizedSongName === normalizedInput) {
        // 아티스트도 입력된 경우 아티스트도 비교
        if (normalizedTeam && normalizedSongTeam) {
          return normalizedSongTeam === normalizedTeam
        }
        // 아티스트 미입력 시 제목만 같아도 중복 후보
        return true
      }
      return false
    })

    setDuplicateSongs(duplicates)
  } catch (error) {
    console.error('중복 체크 오류:', error)
  } finally {
    setCheckingDuplicate(false)
  }
}

// 🔍 제목/아티스트 변경 시 디바운스로 중복 체크
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

    console.log('📝 DB에 곡 정보 저장 중...')

    // 🔍 공식 업로더 여부 확인
    const { data: officialUploader } = await supabase
      .from('official_uploaders')
      .select('id')
      .eq('email', user.email.toLowerCase())
      .single()

    const isOfficial = !!officialUploader

    // ✅ 디버깅: 저장할 데이터 확인
    console.log('📋 저장할 곡 정보:', {
      song_name: newSong.song_name,
      team_name: newSong.team_name,
      key: newSong.key,
      time_signature: newSong.time_signature,  // ← 박자 값 확인
      tempo: newSong.tempo,
      bpm: newSong.bpm,
      visibility: newSong.visibility,
      is_official: isOfficial
    })

    // ✨ 임시 변경: 모든 곡을 바로 songs 테이블에 저장 (승인 프로세스 비활성화)
// 나중에 복원하려면 이 주석 아래의 원본 코드 참고

const { error: insertError } = await supabase
  .from('songs')
  .insert({
    song_name: newSong.song_name.trim(),
    team_name: newSong.team_name.trim() || null,
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

/* ========== 원본 코드 (나중에 복원용) ==========
if (newSong.visibility === 'public') {
  // 전체 공개 → 승인 요청 테이블에 저장
  const { error: requestError } = await supabase
    .from('song_approval_requests')
    .insert({
      song_name: newSong.song_name.trim(),
      team_name: newSong.team_name.trim() || null,
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
      requester_id: user.id,
      visibility: 'public',
      status: 'pending'
    })

  if (requestError) throw requestError
  alert('✅ 곡이 제출되었습니다!\n관리자 승인 후 전체 공개됩니다.')
} else {
  // 팀 공개 또는 비공개 → 바로 songs 테이블에 저장
  const { error: insertError } = await supabase
    .from('songs')
    .insert({...})
  if (insertError) throw insertError
  alert('✅ 곡이 추가되었습니다!')
}
========== 원본 코드 끝 ========== */

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

    fetchSongs()

  } catch (error: any) {
    console.error('❌ 곡 추가 오류:', error)
    alert(`❌ 곡 추가에 실패했습니다.\n\n오류: ${error.message}`)
  } finally {
    setUploading(false)
  }
}

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      alert('파일 크기는 10MB 이하여야 합니다.')
      return
    }

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
    if (!allowedTypes.includes(file.type)) {
      alert('PDF, JPG, PNG 파일만 업로드 가능합니다.')
      return
    }

    console.log('✅ 파일 선택됨:', file.name, file.type, (file.size / 1024 / 1024).toFixed(2) + 'MB')
    setUploadingFile(file)
  }

  const saveSetlist = async () => {
    // 🆕 유효성 검사 추가
    if (!setlistTitle.trim()) {
      alert('콘티 제목을 입력하세요.')
      return
    }

    if (selectedSongs.length === 0) {
      alert('곡을 선택해주세요.')
      return
    }

    if (!selectedTeamId) {
      alert('팀을 선택해주세요.')
      return
    }

    if (setlistType === '직접입력' && !customSetlistType.trim()) {
      alert('예배 유형을 입력하세요.')
      return
    }

    try {
      // 🆕 team_setlists 테이블에 저장
      const { data: setlist, error: setlistError } = await supabase
        .from('team_setlists')
        .insert({
          team_id: selectedTeamId, // 🆕 팀 ID
          title: setlistTitle,
          service_date: setlistDate,
          service_type: setlistType === '직접입력' ? customSetlistType : setlistType,
          created_by: USER_ID, // 🆕 생성자
          notes: '' // 🆕 메모 (빈값)
        })
        .select()
        .single()

      if (setlistError) throw setlistError

      // 🆕 team_setlist_songs 테이블에 저장
      const setlistSongs = selectedSongs.map((song, index) => ({
        setlist_id: setlist.id,
        song_id: song.id,
        order_number: index + 1,
        selected_form: songForms[song.id] || null
      }))

      const { error: songsError } = await supabase
        .from('team_setlist_songs')
        .insert(setlistSongs as any)

      if (songsError) throw songsError

      alert('✅ 콘티가 저장되었습니다!')
    
      // 🆕 초기화
      setShowSaveModal(false)
      setSetlistTitle('')
      setCustomSetlistType('')
      setSelectedTeamId('') // 🆕 팀 선택 초기화
      setSelectedSongs([])
      setSongForms({})
    
    } catch (error) {
      console.error('Error saving setlist:', error)
      alert('콘티 저장에 실패했습니다.')
    }
  }

  

  // 개선된 필터링 로직
  useEffect(() => {
    let result = [...songs]

    if (filters.searchText) {
      const normalizedSearch = normalizeText(filters.searchText)
      result = result.filter(song => {
        // 띄어쓰기/특수문자 무시 검색
        const normalizedSongName = normalizeText(song.song_name)
        const normalizedTeamName = normalizeText(song.team_name || '')

        // 정규화된 검색과 일반 검색 둘 다 지원
        const searchLower = filters.searchText.toLowerCase()
        return normalizedSongName.includes(normalizedSearch) ||
               normalizedTeamName.includes(normalizedSearch) ||
               song.song_name.toLowerCase().includes(searchLower) ||
               song.team_name?.toLowerCase().includes(searchLower)
      })
    }

    // 절기 필터
    if (filters.season && filters.season !== '전체') {
      result = result.filter(song => song.season === filters.season)
    }

    // 테마 필터 (다중 선택)
    if (filters.themes.length > 0) {
      result = result.filter(song => {
        // parseThemes로 배열/텍스트 모두 지원
        const songThemes = parseThemes(song.themes)
        if (songThemes.length > 0) {
          return filters.themes.some(theme => songThemes.includes(theme))
        } else {
          // themes가 없으면 theme1, theme2 체크 (이전 호환)
          return filters.themes.some(theme =>
            song.theme1 === theme || song.theme2 === theme
          )
        }
      })
    }

    // 기존 단일 테마 필터 (호환성)
    if (filters.theme) {
      result = result.filter(song =>
        song.theme1 === filters.theme || song.theme2 === filters.theme
      )
    }

    if (filters.key || filters.isMinor) {
  result = result.filter(song => {
    if (!song.key) return false
    
    // Minor만 선택된 경우 - 모든 minor key
    if (filters.isMinor && !filters.key) {
      return song.key.includes('m')
    }
    
    // 특정 키만 선택된 경우 - Major keys
    if (filters.key && !filters.isMinor) {
      return song.key === filters.key && !song.key.includes('m')
    }
    
    // 특정 키 + Minor 선택된 경우
    if (filters.key && filters.isMinor) {
      return song.key === `${filters.key}m`
    }
    
    return false
  })
}

    if (filters.timeSignature) {
      result = result.filter(song => song.time_signature === filters.timeSignature)
    }

    if (filters.tempo) {
      result = result.filter(song => song.tempo === filters.tempo)
    }

    // 👇 BPM 범위 필터 추가
    if (filters.bpmMin || filters.bpmMax) {
      result = result.filter(song => {
        if (!song.bpm) return false
      
        const songBpm = typeof song.bpm === 'string' ? parseFloat(song.bpm) : song.bpm
        const minBpm = filters.bpmMin ? parseFloat(filters.bpmMin) : 0
        const maxBpm = filters.bpmMax ? parseFloat(filters.bpmMax) : Infinity
      
        return songBpm >= minBpm && songBpm <= maxBpm
      })
    }

    // 🛡️ 공식/사용자 악보 필터
    if (!showUserUploaded) {
      result = result.filter(song => song.is_official === true)
    }

    // 🎵 정렬 적용
if (sortBy === 'likes') {
  result.sort((a, b) => ((b as any).like_count || 0) - ((a as any).like_count || 0))
} else if (sortBy === 'name') {
  result.sort((a, b) => a.song_name.localeCompare(b.song_name, 'ko'))
}
// 'recent'는 기본 정렬 (created_at desc) 유지

    setFilteredSongs(result)
    setFocusedSongIndex(-1)

    // 🆕 검색 로깅 (debounce 적용)
    if (user && filters.searchText.length > 0) {
  const debounceTimer = setTimeout(() => {
    logSongSearch(
      filters.searchText,  // 🔹 첫 번째: 검색어
      result.length,       // 🔹 두 번째: 결과 개수
      user.id              // 🔹 세 번째: 사용자 ID
    ).catch(error => {
      console.error('Error logging search:', error)
    })
  }, 1000)

  return () => clearTimeout(debounceTimer)
}
  }, [songs, filters, user, sortBy, showUserUploaded])
  
  // 🆕 필터가 변경되면 표시 개수 초기화
useEffect(() => {
  setDisplayCount(20)
}, [filteredSongs])

// 🆕 무한 스크롤 Intersection Observer
useEffect(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && displayCount < filteredSongs.length && !isLoadingMore) {
        setIsLoadingMore(true)
        setTimeout(() => {
          setDisplayCount(prev => Math.min(prev + 20, filteredSongs.length))
          setIsLoadingMore(false)
        }, 300)
      }
    },
    { threshold: 0.1 }
  )

  if (loadMoreRef.current) {
    observer.observe(loadMoreRef.current)
  }

  return () => observer.disconnect()
}, [displayCount, filteredSongs.length, isLoadingMore])

// 🆕 표시할 곡 목록 계산
const displayedSongs = filteredSongs.slice(0, displayCount)
const hasMore = displayCount < filteredSongs.length

  const toggleSongSelection = (song: Song) => {
    if (selectedSongs.find(s => s.id === song.id)) {
      setSelectedSongs(selectedSongs.filter(s => s.id !== song.id))
    } else {
      setSelectedSongs([...selectedSongs, song])
    }
  }

  const moveSong = (index: number, direction: 'up' | 'down') => {
    const newSelected = [...selectedSongs]
    if (direction === 'up' && index > 0) {
      [newSelected[index - 1], newSelected[index]] = [newSelected[index], newSelected[index - 1]]
    } else if (direction === 'down' && index < newSelected.length - 1) {
      [newSelected[index], newSelected[index + 1]] = [newSelected[index + 1], newSelected[index]]
    }
    setSelectedSongs(newSelected)
  }

  // 📝 악보 뷰어 열기 (단일 곡 또는 선택된 여러 곡)
  const openSheetViewer = (clickedSong: Song) => {
    // 선택된 곡이 2개 이상이고, 클릭한 곡이 선택 목록에 있으면 다중 곡 모드
    const isClickedSongSelected = selectedSongs.some(s => s.id === clickedSong.id)

    if (selectedSongs.length >= 2 && isClickedSongSelected) {
      // 다중 곡 모드: 선택된 곡들 중 악보가 있는 곡들만
      const songsWithSheets = selectedSongs.filter(s => s.file_url)
      if (songsWithSheets.length === 0) {
        alert('악보가 있는 곡이 없습니다.')
        return
      }

      const songsForEditor = songsWithSheets.map(song => ({
        song_id: song.id,
        song_name: song.song_name,
        team_name: song.team_name || '',
        file_url: song.file_url!,
        file_type: song.file_type === 'pdf' ? 'pdf' as const : 'image' as const,
        songForms: songForms[song.id] || []
      }))

      setMultiSongEditorSongs(songsForEditor)
      setShowMultiSongEditor(true)
    } else {
      // 단일 곡 모드
      setEditingSong(clickedSong)
      setShowNoteEditor(true)
    }
  }

  // 📝 다중 곡 악보 뷰어 저장 핸들러
  const handleSaveMultiSongNotes = async (data: { song: any, annotations: PageAnnotation[], extra?: { songFormEnabled: boolean, songFormStyle: any, partTags: any[] } }[]) => {
    if (!user) {
      alert('로그인이 필요합니다.')
      return
    }

    let savedCount = 0
    for (const item of data) {
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
          title: `${item.song.song_name} 필기`,
          annotations: item.annotations,
          songForms: item.song.songForms,
          songFormEnabled: item.extra?.songFormEnabled,
          songFormStyle: item.extra?.songFormStyle,
          partTags: item.extra?.partTags,
        })
        if (result) savedCount++
      }
    }

    setShowMultiSongEditor(false)
    setMultiSongEditorSongs([])

    if (savedCount > 0) {
      alert(`${savedCount}개의 필기가 저장되었습니다!\nmy-page > 내 필기 노트에서 확인하세요.`)
    } else {
      alert('저장할 필기가 없습니다.')
    }
  }

  // 📝 다중 곡 악보 뷰어 닫기 핸들러
  const handleCloseMultiSongEditor = () => {
    if (multiSongEditorSongs.length > 0) {
      if (!confirm('필기 내용이 저장되지 않습니다. 정말 닫으시겠습니까?')) {
        return
      }
    }
    setShowMultiSongEditor(false)
    setMultiSongEditorSongs([])
  }

  // ===== 송폼 관련 함수들 =====
  const openFormModal = (song: Song) => {
    setCurrentFormSong(song)
    const existingForm = songForms[song.id] || []
    setShowFormModal(true)
  }

  // 🆕 필터 변경 핸들러 (FilterPanel용)
  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  // 🆕 필터 초기화 (FilterPanel용)
  const resetFilters = () => {
    setFilters({
      season: '전체',
      themes: [],
      theme: '',
      key: '',
      isMinor: false,
      timeSignature: '',
      tempo: '',
      searchText: filters.searchText,  // 검색어는 유지
      bpmMin: '',
      bpmMax: ''
    })
  }


  // 테마 다중 선택 토글
  const toggleThemeFilter = (theme: string) => {
    setFilters(prev => ({
      ...prev,
      themes: prev.themes.includes(theme)
        ? prev.themes.filter(t => t !== theme)
        : [...prev.themes, theme]
    }))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* 로고 */}
            <div className="flex flex-wrap items-center gap-1 sm:gap-2">
              <Music className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Ministry Hub</h1>
            </div>

            {/* 네비게이션 */}
<div className="flex items-center gap-2">
  {/* 🆕 모바일: 햄버거 메뉴 버튼 */}
  <button
    onClick={() => setShowMobileMenu(true)}
    className="md:hidden p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
    title="메뉴"
  >
    <Menu size={24} />
  </button>

  {/* 🆕 데스크톱: 기존 버튼들 */}
  <div className="hidden md:flex items-center gap-2">
    {/* PraiseHub 버튼 */}
    <button
      onClick={() => router.push('/streaming')}
      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:opacity-90 transition-opacity"
    >
      <Music size={18} />
      <span className="text-sm font-medium">PraiseHub</span>
    </button>

    {user ? (
      <>
        <button
          onClick={() => router.push('/my-team')}
          className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition whitespace-nowrap"
        >
          My Team
        </button>

        <button
          onClick={() => router.push('/my-page')}
          className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition whitespace-nowrap"
        >
          My Page
        </button>

        <div className="w-px h-8 bg-gray-300 mx-2"></div>

        {/* 더보기 메뉴 */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowMenu(!showMenu)
            }}
            className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
            title="더보기"
          >
            <MoreVertical size={20} />
          </button>
          
          {showMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border py-1 z-50">
              <button
                onClick={() => {
                  setShowAddSongModal(true)
                  setShowMenu(false)
                }}
                className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 flex items-center"
              >
                <Plus className="mr-2" size={18} />
                곡 추가
              </button>
              <button
                onClick={() => {
                  router.push('/teams/create')
                  setShowMenu(false)
                }}
                className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 flex items-center"
              >
                <Users className="mr-2" size={18} />
                팀 만들기
              </button>
              <button
                onClick={() => {
                  router.push('/teams/join')
                  setShowMenu(false)
                }}
                className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 flex items-center"
              >
                <UserPlus className="mr-2" size={18} />
                팀 참여
              </button>

              {user?.is_admin && (
                <>
                  <div className="border-t my-1"></div>
                  <button
                    onClick={() => {
                      router.push('/admin/song-approvals')
                      setShowMenu(false)
                    }}
                    className="w-full px-4 py-2 text-left text-blue-700 hover:bg-blue-50 flex items-center font-medium"
                  >
                    <Music className="mr-2" size={18} />
                    곡 승인 관리
                  </button>
                  <button
                    onClick={() => {
                      router.push('/admin/user-songs')
                      setShowMenu(false)
                    }}
                    className="w-full px-4 py-2 text-left text-blue-700 hover:bg-blue-50 flex items-center font-medium"
                  >
                    <Trash2 className="mr-2" size={18} />
                    사용자 곡 관리
                  </button>
                  <button
                    onClick={() => {
                      router.push('/admin/approvals')
                      setShowMenu(false)
                    }}
                    className="w-full px-4 py-2 text-left text-blue-700 hover:bg-blue-50 flex items-center font-medium"
                  >
                    <Activity className="mr-2" size={18} />
                    팀 승인 관리
                  </button>
                  <button
                    onClick={() => {
                      router.push('/admin/official-uploaders')
                      setShowMenu(false)
                    }}
                    className="w-full px-4 py-2 text-left text-blue-700 hover:bg-blue-50 flex items-center font-medium"
                  >
                    <Shield className="mr-2" size={18} />
                    공식 업로더 관리
                  </button>
                  <button
                    onClick={() => {
                      router.push('/admin/dashboard')
                      setShowMenu(false)
                    }}
                    className="w-full px-4 py-2 text-left text-blue-700 hover:bg-blue-50 flex items-center font-medium"
                  >
                    <BarChart3 className="mr-2" size={18} />
                    통계 대시보드
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="w-px h-8 bg-gray-300 mx-2"></div>

        <span className="text-sm text-gray-600 px-2">
          {user.email}
        </span>
        
        <button
          onClick={handleSignOut}
          className="px-3 py-2 text-sm bg-[#E26559] text-white rounded-lg hover:bg-[#D14E42] transition whitespace-nowrap"
        >
          로그아웃
        </button>
      </>
    ) : (
      <>
        <button
          onClick={() => router.push('/login')}
          className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition whitespace-nowrap"
        >
          로그인
        </button>
        <button
          onClick={() => router.push('/signup')}
          className="px-4 py-2 text-sm bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8] transition whitespace-nowrap"
        >
          회원가입
        </button>
      </>
    )}
  </div>
</div>
          </div>
        </div>
      </div>

      {/* 🆕 모바일 메뉴 사이드바 */}
{showMobileMenu && (
  <>
    {/* 배경 오버레이 */}
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50"
      onClick={() => setShowMobileMenu(false)}
    />
    
    {/* 사이드바 메뉴 */}
    <div className="fixed top-0 right-0 h-full w-80 bg-white shadow-2xl z-50 overflow-y-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-purple-500 to-blue-500">
        <h2 className="text-xl font-bold text-white">메뉴</h2>
        <button
          onClick={() => setShowMobileMenu(false)}
          className="p-2 text-white hover:bg-white/20 rounded-lg transition"
        >
          <X size={24} />
        </button>
      </div>

      {/* 메뉴 아이템들 */}
      <div className="p-4 space-y-2">
        {user ? (
          <>
            {/* PraiseHub */}
            <button
              onClick={() => {
                router.push('/streaming')
                setShowMobileMenu(false)
              }}
              className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:opacity-90 transition"
            >
              <Music size={20} />
              <span className="font-medium">PraiseHub</span>
            </button>

            {/* My Team */}
            <button
              onClick={() => {
                router.push('/my-team')
                setShowMobileMenu(false)
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              <Users size={20} />
              <span>My Team</span>
            </button>

            {/* My Page */}
            <button
              onClick={() => {
                router.push('/my-page')
                setShowMobileMenu(false)
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              <UserPlus size={20} />
              <span>My Page</span>
            </button>

            {/* 📝 내 필기 */}
            <button
              onClick={() => {
                router.push('/my-notes')
                setShowMobileMenu(false)
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              <FileText size={20} />
              <span>내 필기</span>
            </button>

            <div className="border-t my-2"></div>

            {/* 곡 추가 */}
            <button
              onClick={() => {
                setShowAddSongModal(true)
                setShowMobileMenu(false)
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              <Plus size={20} />
              <span>곡 추가</span>
            </button>

            {/* 팀 만들기 */}
            <button
              onClick={() => {
                router.push('/teams/create')
                setShowMobileMenu(false)
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              <Users size={20} />
              <span>팀 만들기</span>
            </button>

            {/* 팀 참여 */}
            <button
              onClick={() => {
                router.push('/teams/join')
                setShowMobileMenu(false)
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              <UserPlus size={20} />
              <span>팀 참여</span>
            </button>

            {/* 관리자 메뉴 */}
            {user?.is_admin && (
              <>
                <div className="border-t my-2"></div>
                <p className="px-4 py-2 text-xs font-bold text-gray-500 uppercase">관리자</p>
                
                <button
                  onClick={() => {
                    router.push('/admin/song-approvals')
                    setShowMobileMenu(false)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-blue-700 hover:bg-blue-50 rounded-lg transition"
                >
                  <Music size={20} />
                  <span>곡 승인 관리</span>
                </button>

                <button
                  onClick={() => {
                    router.push('/admin/user-songs')
                    setShowMobileMenu(false)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-blue-700 hover:bg-blue-50 rounded-lg transition"
                >
                  <Trash2 size={20} />
                  <span>사용자 곡 관리</span>
                </button>

                <button
                  onClick={() => {
                    router.push('/admin/approvals')
                    setShowMobileMenu(false)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-blue-700 hover:bg-blue-50 rounded-lg transition"
                >
                  <Activity size={20} />
                  <span>팀 승인 관리</span>
                </button>

                <button
                  onClick={() => {
                    router.push('/admin/official-uploaders')
                    setShowMobileMenu(false)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-blue-700 hover:bg-blue-50 rounded-lg transition"
                >
                  <Shield size={20} />
                  <span>공식 업로더 관리</span>
                </button>

                <button
                  onClick={() => {
                    router.push('/admin/dashboard')
                    setShowMobileMenu(false)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-blue-700 hover:bg-blue-50 rounded-lg transition"
                >
                  <BarChart3 size={20} />
                  <span>통계 대시보드</span>
                </button>
              </>
            )}

            <div className="border-t my-2"></div>

            {/* 사용자 정보 */}
            <div className="px-4 py-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">로그인 계정</p>
              <p className="text-sm font-medium text-gray-900 truncate">{user.email}</p>
            </div>

            {/* 로그아웃 */}
            <button
              onClick={() => {
                handleSignOut()
                setShowMobileMenu(false)
              }}
              className="w-full flex items-center gap-3 px-4 py-3 bg-[#E26559] text-white rounded-lg hover:bg-[#D14E42] transition"
            >
              <X size={20} />
              <span className="font-medium">로그아웃</span>
            </button>
          </>
        ) : (
          <>
            {/* 로그인 */}
            <button
              onClick={() => {
                router.push('/login')
                setShowMobileMenu(false)
              }}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              <span className="font-medium">로그인</span>
            </button>

            {/* 회원가입 */}
            <button
              onClick={() => {
                router.push('/signup')
                setShowMobileMenu(false)
              }}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8] transition"
            >
              <span className="font-medium">회원가입</span>
            </button>
          </>
        )}
      </div>
    </div>
  </>
)}

      {/* 🎨 히어로 섹션 (Figma 디자인) */}
      <div 
        className="relative bg-cover bg-center py-16"
        style={{
          backgroundImage: `url('/images/church-hero.jpg')`
        }}
      >
        <div className="max-w-7xl mx-auto px-4">
          {/* 제목 - 강제 흰색 */}
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 hero-title" style={{
              color: '#FFFFFF',
              textShadow: '0 2px 8px rgba(0,0,0,0.8)'
            }}>
            찬양으로 하나되는 예배
            </h1>
            <p className="text-xl" style={{ 
              color: '#FFFFFF',
              opacity: 0.95,
              textShadow: '0 2px 8px rgba(0,0,0,0.8)'
            }}>
              Ministry Hub와 함께 은혜로운 예배를 준비하세요
            </p>
          </div>

          {/* 검색바 - 흰색 배경 */}
          <div className="max-w-3xl mx-auto mb-8">
            <div className="relative">
              <Search className="absolute left-4 top-4 text-gray-400" size={24} />
              <input
                type="text"
                placeholder="찬양곡 제목, 아티스트, 가사로 검색..."
                className="w-full pl-12 pr-4 py-4 text-lg text-gray-900 bg-white rounded-xl shadow-xl focus:ring-4 focus:ring-blue-500 focus:outline-none border-2 border-white/50"
                value={filters.searchText}
                onChange={(e) => setFilters({ ...filters, searchText: e.target.value })}
                style={{ backgroundColor: 'white' }}
              />
            </div>
          </div>


          {/* 통계 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/10 backdrop-blur rounded-lg p-4 text-center">
              <div className="text-2xl font-semibold" style={{ color: '#ffffff' }}>{songs.length}+</div>
              <div className="text-xs opacity-80" style={{ color: '#ffffff' }}>찬양곡</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4 text-center">
              <div className="text-2xl font-semibold" style={{ color: '#ffffff' }}>
                {new Set(songs.map(s => s.team_name).filter(Boolean)).size}+
              </div>
              <div className="text-xs opacity-80" style={{ color: '#ffffff' }}>아티스트</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4 text-center">
              <div className="text-2xl font-semibold" style={{ color: '#ffffff' }}>{selectedSongs.length}</div>
              <div className="text-xs opacity-80" style={{ color: '#ffffff' }}>선택한 곡</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4 text-center">
              <div className="text-2xl font-semibold" style={{ color: '#ffffff' }}>12</div>
              <div className="text-xs opacity-80" style={{ color: '#ffffff' }}>Key</div>
            </div>
          </div>
        </div>
      </div>

      {/* 선택된 곡 상단바 */}
      {selectedSongs.length > 0 && !(isMobile && showFilterPanel) && (
        <div className="bg-white border-b sticky top-0 z-40 shadow-sm">
          <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2 sm:py-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full sm:w-auto">
                <span className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">
                  {selectedSongs.length}곡 선택됨
                </span>
                <div className="flex gap-1 sm:gap-2 overflow-x-auto">
                  {selectedSongs.slice(0, 3).map(song => (
                    <span key={song.id} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                      {song.song_name}
                    </span>
                  ))}
                  {selectedSongs.length > 3 && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                      +{selectedSongs.length - 3}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 sm:gap-2 w-full sm:w-auto">
  <button
  onClick={() => {
    if (!user) {
      alert('콘티 저장은 로그인 후 이용 가능합니다.')
      router.push('/login')
      return
    }
    setShowSaveModal(true)
  }}
  className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-[#84B9C0] text-white rounded-lg hover:bg-[#6FA5AC] text-xs sm:text-sm flex items-center justify-center whitespace-nowrap"
>
  <FolderOpen className="mr-1 sm:mr-2" size={14} />
  콘티 저장
</button>
                <button
  onClick={handleDownload}
  disabled={downloadingPDF}
  className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8] text-xs sm:text-sm flex items-center justify-center whitespace-nowrap ${downloadingPDF ? 'opacity-75 cursor-not-allowed' : ''}`}
>
  {downloadingPDF ? (
    <>
      <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white mr-1 sm:mr-2"></div>
      <span className="hidden sm:inline">PDF 생성 중...</span>
      <span className="sm:hidden">생성중</span>
    </>
  ) : (
    <>
      <FileText className="mr-1 sm:mr-2" size={14} />
      다운로드
    </>
  )}
</button>
                <button
  onClick={startPPTDownload}
  disabled={downloadingPPT}
  className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-xs sm:text-sm flex items-center justify-center whitespace-nowrap ${downloadingPPT ? 'opacity-75 cursor-not-allowed' : ''}`}
>
  {downloadingPPT ? (
    <>
      <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white mr-1 sm:mr-2"></div>
      <span className="hidden sm:inline">PPT 생성 중...</span>
      <span className="sm:hidden">생성중</span>
    </>
  ) : (
    <>
      <Presentation className="mr-1 sm:mr-2" size={14} />
      PPT
    </>
  )}
</button>
                <button
  onClick={() => {
    setSelectedSongs([])
    setSongForms({})
  }}
  className="flex-1 sm:flex-none px-3 sm:px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-xs sm:text-sm whitespace-nowrap"
>
  초기화
</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 모바일 필터 배경 오버레이 */}
      {isMobile && showFilterPanel && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setShowFilterPanel(false)}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row gap-3 md:gap-6">
          {/* 왼쪽: 필터 패널 */}
          <div className={`${showFilterPanel ? 'w-64 md:w-80' : 'w-0'} transition-all duration-300 overflow-hidden ${isMobile && showFilterPanel ? 'fixed left-0 top-0 h-full z-40 bg-white shadow-xl pt-4' : ''}`}>
            <FilterPanel
              filters={filters}
              onFilterChange={handleFilterChange}
              onThemeToggle={toggleThemeFilter}
              onReset={resetFilters}
              onClose={() => setShowFilterPanel(false)}
              isMobile={isMobile}
              isVisible={showFilterPanel}
              themeCounts={themeCounts}
              themesLoading={themesLoading}
              seasonsList={seasonsList}
              seasonsLoading={seasonsLoading}
            />
          </div>

{/* 오른쪽: 곡 목록 */}
<div className="flex-1">
  {/* 툴바 */}
  <div className="bg-white rounded-lg shadow-md p-4 mb-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button
          onClick={() => setShowFilterPanel(!showFilterPanel)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <Filter size={20} />
        </button>
        <span className="text-gray-600">
{displayCount < filteredSongs.length 
  ? `${displayCount} / ${filteredSongs.length}개의 찬양`
  : `${filteredSongs.length}개의 찬양`
}
</span>

        {/* 🎵 정렬 드롭다운 */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'recent' | 'likes' | 'name')}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="recent">최신순</option>
          <option value="likes">좋아요순</option>
          <option value="name">이름순</option>
        </select>
    </div>

    <div className="flex items-center gap-2 md:gap-3">
        {/* 🛡️ 공식/사용자 악보 토글 */}
        <button
          onClick={() => setShowUserUploaded(!showUserUploaded)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 md:px-3 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-all ${
            showUserUploaded
              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
          }`}
          title={showUserUploaded ? '공식 악보만 보기' : '모든 악보 보기'}
        >
          <Shield size={16} className="flex-shrink-0" />
          <span className="hidden sm:inline">{showUserUploaded ? '전체' : '공식만'}</span>
        </button>

        <div className="w-px h-6 bg-gray-200 hidden md:block"></div>

        <button
          onClick={() => setViewMode('grid')}
          className={`p-2 rounded-lg transition ${
            viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'
          }`}
        >
          <Grid size={20} />
        </button>
        <button
          onClick={() => setViewMode('list')}
          className={`p-2 rounded-lg transition ${
            viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'
          }`}
        >
          <List size={20} />
        </button>
      </div>
    </div>
  </div>

  {/* 곡 목록 */}
  <div className="bg-white rounded-lg shadow-md">
    {loading ? (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <p className="mt-4 text-gray-600">불러오는 중...</p>
      </div>
    ) : filteredSongs.length === 0 ? (
      <div className="text-center py-12 text-gray-500">
        <Music size={48} className="mx-auto mb-4 text-gray-300" />
        <p>검색 결과가 없습니다.</p>
      </div>
    ) : viewMode === 'grid' ? (
  
  // 그리드 뷰
  <div className="p-3 md:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
{displayedSongs.map((song, index) => (
      <div
        key={song.id}
        onClick={() => {
          toggleSongSelection(song)
          setFocusedSongIndex(index)
        }}
        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
          selectedSongs.find(s => s.id === song.id)
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
        }`}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 truncate">{song.song_name}</h3>
            {song.is_official ? (
              <span className="flex-shrink-0 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full flex items-center gap-1" title="공식 악보">
                <Shield size={12} />
              </span>
            ) : song.is_user_uploaded && (
              <span className="flex-shrink-0 px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full" title="사용자 추가">
                +
              </span>
            )}
          </div>
          <div className="flex gap-1 ml-2">
            {/* 악보 미리보기 버튼 - 모달로 열기 */}
            {song.file_url && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setPreviewSong(song)
                  }}
                  className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                  title="악보 보기"
                >
                  <Eye size={18} />
                </button>
                {/* 📝 필기 버튼 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingSong(song)
                    setShowNoteEditor(true)
                  }}
                  className="p-1 text-gray-700 hover:bg-gray-100 rounded"
                  title="필기하기"
                >
                  <Pencil size={18} />
                </button>
              </>
            )}
            {/* 유튜브 버튼 - 항상 표시 */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (song.youtube_url) {
                  setYoutubeModalSong(song)
                }
              }}
              disabled={!song.youtube_url}
              className="p-1 rounded"
              style={{
                color: song.youtube_url ? '#dc2626' : '#d1d5db',
                cursor: song.youtube_url ? 'pointer' : 'not-allowed',
                opacity: song.youtube_url ? 1 : 0.5
              }}
              title={song.youtube_url ? '유튜브' : '유튜브 링크 없음'}
            >
              <Youtube size={18} />
            </button>
          </div>
        </div>
        
        {song.team_name && (
          <p className="text-sm text-gray-600 mb-2">{song.team_name}</p>
        )}
        
        {/* 미리보기 (토글 시 표시) */}
        {previewStates[song.id] && (
          <div className="mt-3 border-t pt-3">
            {song.lyrics && (
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans max-h-40 overflow-y-auto bg-gray-50 p-2 rounded">
                {song.lyrics}
              </pre>
            )}
            {song.file_url && (
              <img 
                src={song.file_url}
                alt={song.song_name}
                className="w-full h-auto mt-2 rounded"
              />
            )}
          </div>
        )}
        
        <div className="flex flex-wrap gap-2 text-xs mt-2">
          {song.key && (
            <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">
              Key: {song.key}
            </span>
          )}
          {song.time_signature && (
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
              {song.time_signature}
            </span>
          )}
          {song.tempo && (
            <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded">
              {song.tempo}
            </span>
          )}
        </div>
        {(song.theme1 || song.theme2) && (
          <div className="flex flex-wrap gap-1 mt-2">
            {song.theme1 && (
              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                {song.theme1}
              </span>
            )}
            {song.theme2 && (
              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                {song.theme2}
              </span>
            )}
          </div>
        )}
      </div>
    ))}
  </div>
              ) : (
                // 리스트 뷰 (기존 스타일 유지)
<div ref={songListRef} className="divide-y divide-gray-200">
  {displayedSongs.map((song, index) => (
    <div
      key={song.id}
      tabIndex={0}
      onFocus={() => setFocusedSongIndex(index)}
      className={`p-4 cursor-pointer transition-all ${
        selectedSongs.find(s => s.id === song.id)
          ? 'bg-blue-50'
          : focusedSongIndex === index
          ? 'bg-gray-50'
          : 'hover:bg-gray-50'
      }`}
    >
      {/* 상단: 곡 정보 + 버튼 (항상 고정) */}
      <div 
        className="flex items-start justify-between"
        onClick={() => {
          toggleSongSelection(song)
          setFocusedSongIndex(index)
        }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!selectedSongs.find(s => s.id === song.id)}
              onChange={() => {
                toggleSongSelection(song)
                setFocusedSongIndex(index)
              }}
              onClick={(e) => e.stopPropagation()}
              className="mr-3 flex-shrink-0 mt-1 w-4 h-4 cursor-pointer"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-gray-900">{song.song_name}</h3>
                {song.is_official ? (
                  <span className="flex-shrink-0 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full flex items-center" title="공식 악보">
                    <Shield size={12} />
                  </span>
                ) : song.is_user_uploaded && (
                  <span className="flex-shrink-0 px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full" title="사용자 추가">
                    +
                  </span>
                )}
                {songForms[song.id] && songForms[song.id].length > 0 && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded flex-shrink-0">
                    송폼: {songForms[song.id].join('-')}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {song.team_name && `${song.team_name} | `}
                Key: {song.key || '-'} | 
                박자: {song.time_signature || '-'} | 
                템포: {song.bpm ? `${song.bpm}BPM` : (song.tempo || '-')}
              </p>
              
              {/* 테마 태그 */}
              <div className="flex flex-wrap gap-1 mt-2">
                {song.theme1 && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                    {song.theme1}
                  </span>
                )}
                {song.theme2 && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                    {song.theme2}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 버튼들 - 항상 오른쪽 상단에 고정 */}
        <div className="flex gap-1 md:gap-2 ml-2 md:ml-4 flex-shrink-0">
          {/* 송폼 설정 버튼 - 선택 시에만 표시 */}
          {selectedSongs.find(s => s.id === song.id) && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                openFormModal(song)
              }}
              className="px-2 md:px-3 py-1 bg-[#C4BEE2] text-white text-xs md:text-sm rounded hover:bg-[#B0A8D8] whitespace-nowrap"
            >
              송폼
            </button>
          )}

          {/* 미리보기 토글 버튼 */}
          {(song.lyrics || song.file_url) && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                togglePreview(song.id)
              }}
              className={`p-2 rounded-lg ${
                previewStates[song.id]
                  ? 'text-blue-600 bg-blue-100'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              title={previewStates[song.id] ? '접기' : '펼치기'}
            >
              {previewStates[song.id] ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          )}

          {/* 📝 악보 뷰어 (보기 + 필기 통합) */}
          {song.file_url && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                openSheetViewer(song)
              }}
              className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"
              title={selectedSongs.length >= 2 && selectedSongs.some(s => s.id === song.id) ? `선택한 ${selectedSongs.filter(s => s.file_url).length}곡 악보 뷰어` : '악보 보기/필기 모드'}
            >
              <Presentation size={18} />
            </button>
          )}

          {/* 유튜브 영상 토글 버튼 */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (song.youtube_url) {
                toggleYoutube(song.id)
              }
            }}
            disabled={!song.youtube_url}
            className="p-2 rounded-lg"
            style={{
              color: !song.youtube_url 
                ? '#d1d5db' 
                : youtubeStates[song.id] 
                ? '#dc2626'
                : '#dc2626',
              backgroundColor: !song.youtube_url
                ? 'transparent'
                : youtubeStates[song.id]
                ? '#fee2e2'
                : 'transparent',
              cursor: song.youtube_url ? 'pointer' : 'not-allowed',
              opacity: song.youtube_url ? 1 : 0.5
            }}
            title={
              !song.youtube_url
                ? '유튜브 링크 없음'
                : youtubeStates[song.id]
                ? '유튜브 닫기'
                : '유튜브 열기'
            }
          >
            <Youtube size={18} />
          </button>

          {/* 🎵 좋아요 버튼 */}
          <button
            onClick={(e) => toggleLike(e, song.id)}
            className={`p-2 rounded-lg transition-colors flex items-center gap-1 ${
              likedSongs.has(song.id)
                ? 'text-red-500 bg-red-50'
                : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
            }`}
            title={likedSongs.has(song.id) ? '좋아요 취소' : '좋아요'}
          >
            <Heart size={18} fill={likedSongs.has(song.id) ? 'currentColor' : 'none'} />
            {((song as any).like_count || 0) > 0 && (
              <span className="text-xs">{(song as any).like_count}</span>
            )}
          </button>
        </div>
      </div>

      {/* 하단: 펼쳐지는 콘텐츠 (유튜브) */}
      {youtubeStates[song.id] && song.youtube_url && (
        <div className="mt-4 ml-7">
          {getYoutubeEmbedUrl(song.youtube_url) ? (
            <div className="relative w-full max-w-2xl" style={{ paddingBottom: '56.25%' }}>
              <iframe
                src={getYoutubeEmbedUrl(song.youtube_url) || ''}
                className="absolute top-0 left-0 w-full h-full rounded-lg"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <p className="text-sm text-gray-500">유효하지 않은 유튜브 링크입니다.</p>
          )}
        </div>
      )}

      {/* 하단: 펼쳐지는 콘텐츠 (악보/가사) */}
      {previewStates[song.id] && (
        <div className="mt-4 ml-7 border-t pt-4">
          {song.lyrics && (
            <div className="mb-4">
              <h4 className="font-semibold text-gray-700 mb-2 text-sm">가사</h4>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans bg-gray-50 p-3 rounded max-h-60 overflow-y-auto">
                {song.lyrics}
              </pre>
            </div>
          )}
          {song.file_url && (
            <div>
              <h4 className="font-semibold text-gray-700 mb-2 text-sm">악보</h4>
              {song.file_type === 'pdf' ? (
                <iframe
                  src={`${song.file_url}#toolbar=0&navpanes=0&scrollbar=1`}
                  className="w-full h-[600px] border rounded"
                />
              ) : (
                <img 
                  src={song.file_url}
                  alt={`${song.song_name} 악보`}
                  className="max-w-full h-auto rounded shadow-sm"
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  ))}
</div>
              )}
            </div>

            {/* 🆕 무한 스크롤 로딩 표시 */}
{hasMore && (
  <div 
    ref={loadMoreRef} 
    className="py-8 text-center"
  >
    {isLoadingMore ? (
      <div className="flex items-center justify-center gap-2">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        <span className="text-gray-600">더 불러오는 중...</span>
      </div>
    ) : (
      <span className="text-gray-400">
        스크롤하여 더 보기 ({displayCount} / {filteredSongs.length})
      </span>
    )}
  </div>
)}

            {/* 선택한 곡 순서 변경 (숨김 처리) */}
            {selectedSongs.length > 0 && (
              <div className="hidden">
                {selectedSongs.map((song, index) => (
                  <div key={song.id} className="flex gap-1">
                    <button onClick={() => moveSong(index, 'up')}>▲</button>
                    <button onClick={() => moveSong(index, 'down')}>▼</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 단축키 안내 */}
      <div className="hidden md:block fixed bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 text-xs text-gray-600">
        <div className="flex items-center gap-2 mb-1">
          <kbd className="px-2 py-1 bg-gray-100 rounded border">Space</kbd>
          <span>악보 미리보기</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <kbd className="px-2 py-1 bg-gray-100 rounded border">↑↓</kbd>
          <span>이동</span>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="px-2 py-1 bg-gray-100 rounded border">Enter</kbd>
          <span>선택/해제</span>
        </div>
      </div>

      {/* 기존 모달들 그대로 유지 */}
      {/* 곡 추가 모달 */}
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
                  <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="visibility"
                      value="public"
                      checked={newSong.visibility === 'public'}
                      onChange={(e) => {
                        setNewSong({ ...newSong, visibility: 'public', shared_with_teams: [] })
                        // ✨ 경고문 추가
                        //alert('⚠️ 전체 공개로 선택하시면 관리자 승인 후 공개됩니다.\n\n바로 사용하시려면 "팀 공유" 또는 "나만 보기"를 선택해주세요.')
                      }}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium text-gray-900">전체 공개</div>
                      <div className="text-sm text-gray-500">모든 사용자가 이 곡을 볼 수 있습니다</div>
                    </div>
                  </label>

                  <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="visibility"
                      value="teams"
                      checked={newSong.visibility === 'teams'}
                      onChange={(e) => setNewSong({ ...newSong, visibility: 'teams' })}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium text-gray-900">팀 공개</div>
                      <div className="text-sm text-gray-500">선택한 팀만 이 곡을 볼 수 있습니다</div>
                    </div>
                  </label>

                  <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="visibility"
                      value="private"
                      checked={newSong.visibility === 'private'}
                      onChange={(e) => setNewSong({ ...newSong, visibility: 'private', shared_with_teams: [] })}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium text-gray-900">비공개</div>
                      <div className="text-sm text-gray-500">나만 이 곡을 볼 수 있습니다</div>
                    </div>
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
                        {userTeams.map(team => (
                          <label key={team.id} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newSong.shared_with_teams.includes(team.id)}
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
                              className="mr-2"
                            />
                            <span>{team.name}</span>
                          </label>
                        ))}
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
      {keys.map(key => (
        <option key={key} value={key}>{key}{newSong.key.includes('m') ? 'm' : ''}</option>
      ))}
    </select>
  </div>  {/* ← Key div 닫기 */}


                {/* 박자 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">박자</label>
                  <select
                    value={newSong.time_signature}
                    onChange={(e) => setNewSong({ ...newSong, time_signature: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">선택</option>
                    {timeSignatures.map(ts => (
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
{tempos.map(tempo => (
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

              {/* 🆕 절기 선택 */}
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
                <div className="flex flex-wrap gap-2">
                  {themeCounts.map(({ theme }) => (
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
                  ))}
                </div>
                {/* 새 테마 직접 입력 */}
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    placeholder="새 테마 입력..."
                    className="flex-1 px-3 py-1 border border-gray-300 rounded-lg text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const input = e.currentTarget
                        const newTheme = input.value.trim()
                        if (newTheme && !newSong.themes.includes(newTheme)) {
                          setNewSong({
                            ...newSong,
                            themes: [...newSong.themes, newTheme]
                          })
                          input.value = ''
                        }
                      }
                    }}
                  />
                </div>
              </div>

              {/* 🆕 YouTube URL */}
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
                  악보 파일 (선택사항)
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

            <div className="flex gap-2 mt-6 pt-4 border-t">
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
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                disabled={uploading}
              >
                취소
              </button>
              <button
                onClick={addNewSong}
                disabled={uploading || !newSong.song_name.trim()}
                className="flex-1 px-4 py-2 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8] disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    업로드 중...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2" size={18} />
                    곡 추가
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 악보 미리보기 모달 */}
      {previewSong && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-5xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{previewSong.song_name}</h2>
                <p className="text-sm text-gray-600">
                  {previewSong.team_name} | Key: {previewSong.key || '-'}
                </p>
              </div>
              <button
                onClick={() => setPreviewSong(null)}
                className="text-gray-500 hover:text-gray-700 p-2"
                title="닫기 (ESC)"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-gray-100">
              {previewSong.file_url ? (
                previewSong.file_type === 'pdf' ? (
                  <iframe
                    src={previewSong.file_url}
                    className="w-full h-full min-h-[600px] border-0"
                    title={previewSong.song_name}
                  />
                ) : (
                  <img
                    src={previewSong.file_url}
                    alt={previewSong.song_name}
                    className="max-w-full h-auto mx-auto"
                  />
                )
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Music size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>악보가 없습니다.</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between p-4 border-t bg-gray-50">
              <button
                onClick={showPreviousSong}
                disabled={filteredSongs.findIndex(s => s.id === previewSong.id) === 0}
                className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={20} className="mr-1" />
                이전 곡
              </button>
              
              <div className="text-sm text-gray-600">
                <kbd className="px-2 py-1 bg-white rounded border">←</kbd> 이전 | 
                <kbd className="px-2 py-1 bg-white rounded border ml-2">→</kbd> 다음 | 
                <kbd className="px-2 py-1 bg-white rounded border ml-2">ESC</kbd> 닫기
              </div>

              <button
                onClick={showNextSong}
                disabled={filteredSongs.findIndex(s => s.id === previewSong.id) === filteredSongs.length - 1}
                className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                다음 곡
                <ChevronRight size={20} className="ml-1" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 콘티 저장 모달 */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">콘티 저장</h2>

            <div className="space-y-4">
              {/* 🆕 팀 선택 (제일 먼저!) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  팀 선택 <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">팀을 선택하세요</option>
                  {userTeams.map(team => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
                {userTeams.length === 0 && (
                  <p className="text-sm text-red-600 mt-1">
                    ⚠️ 소속된 팀이 없습니다. 먼저 팀에 참여하거나 생성하세요.
                  </p>
                )}
              </div>
            
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  콘티 제목
                </label>
                <input
                  type="text"
                  value={setlistTitle}
                  onChange={(e) => setSetlistTitle(e.target.value)}
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
                  value={setlistDate}
                  onChange={(e) => setSetlistDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  예배 유형
                </label>
                <select
                  value={setlistType}
                  onChange={(e) => setSetlistType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="주일집회">주일집회</option>
                  <option value="중보기도회">중보기도회</option>
                  <option value="기도회">기도회</option>
                  <option value="직접입력">직접입력</option>
                </select>
              </div>

              {setlistType === '직접입력' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    예배 유형 입력
                  </label>
                  <input
                    type="text"
                    value={customSetlistType}
                    onChange={(e) => setCustomSetlistType(e.target.value)}
                    placeholder="예: 또래 기도회"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              )}


            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setShowSaveModal(false)
                  setSetlistTitle('')
                  setCustomSetlistType('')
                  setSelectedFolderId('')
                }}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                취소
              </button>
              <button
                onClick={saveSetlist}
                className="flex-1 px-4 py-2 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8]"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📁 파일 형식 + 옵션 선택 모달 - 공통 컴포넌트 */}
<DownloadFormatModal />

      {/* PPT 옵션 모달 */}
      {showPPTModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <h3 className="text-xl font-bold mb-4">PPT 다운로드 옵션</h3>
            <p className="text-gray-600 mb-6">
              어떤 방식으로 PPT를 생성하시겠습니까?
            </p>
            
            <div className="space-y-3">
              <button
                onClick={() => generatePPTWithOptions('form')}
                className="w-full p-4 border-2 border-blue-600 rounded-lg hover:bg-blue-50 text-left transition"
              >
                <div className="font-bold text-blue-900 mb-1">🎵 송폼 순서대로</div>
                <div className="text-sm text-gray-600">
                  설정한 송폼 순서에 따라 가사 슬라이드 생성
                </div>
              </button>
              
              <button
                onClick={() => generatePPTWithOptions('original')}
                className="w-full p-4 border-2 border-gray-300 rounded-lg hover:bg-gray-50 text-left transition"
              >
                <div className="font-bold text-gray-900 mb-1">📄 악보 그대로</div>
                <div className="text-sm text-gray-600">
                  업로드된 악보 이미지 그대로 생성
                </div>
              </button>
            </div>
            
            <button
              onClick={() => setShowPPTModal(false)}
              className="w-full mt-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 송폼 설정 모달 */}
      <SongFormModal
  isOpen={showFormModal}
  song={currentFormSong}
  initialForm={currentFormSong ? (songForms[currentFormSong.id] || []) : []}
  onSave={(songId, form) => {
    setSongForms(prev => ({ ...prev, [songId]: form }))
  }}
  onClose={() => {
    setShowFormModal(false)
    setCurrentFormSong(null)
  }}
  userId={user?.id}
/>
      {/* 유튜브 모달 */}
      {youtubeModalSong && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-5xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{youtubeModalSong.song_name}</h2>
                <p className="text-sm text-gray-600">
                  {youtubeModalSong.team_name} | Key: {youtubeModalSong.key || '-'}
                </p>
              </div>
              <button
                onClick={() => setYoutubeModalSong(null)}
                className="text-gray-500 hover:text-gray-700 p-2"
                title="닫기"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-gray-100">
              {getYoutubeEmbedUrl(youtubeModalSong.youtube_url || '') ? (
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    src={getYoutubeEmbedUrl(youtubeModalSong.youtube_url || '') || ''}
                    className="absolute top-0 left-0 w-full h-full rounded-lg"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Youtube size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>유효하지 않은 유튜브 링크입니다.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 다운로드 로딩 모달 */}
<DownloadLoadingModal
  isOpen={downloadingPDF || downloadingPPT || downloadingImage}
  type={downloadingPDF ? 'pdf' : downloadingImage ? 'image' : 'ppt'}
  progress={downloadProgress || undefined}
/>

{/* 🆕 송폼 위치 선택 모달 */}
{showPositionModal && (
  <SongFormPositionModal
    songs={selectedSongs}
    songForms={songForms}
    onConfirm={onPositionConfirm}  // 이미 두 인자를 받도록 되어있으면 그대로
    onCancel={onPositionCancel}
  />
)}

{/* 📝 악보 보기 & 필기 에디터 (통합) */}
{showNoteEditor && editingSong && editingSong.file_url && (
  <SheetMusicEditor
    fileUrl={editingSong.file_url}
    fileType={editingSong.file_type === 'pdf' ? 'pdf' : 'image'}
    songName={editingSong.song_name}
    songForms={songForms[editingSong.id]}
    initialMode="view"
    onSave={async (annotations, extra) => {
      console.log('🟢 메인페이지 onSave 호출됨:', {
        annotationCount: annotations.length,
        strokeCount: annotations.reduce((sum, a) => sum + (a.strokes?.length || 0), 0),
        songFormEnabled: extra?.songFormEnabled
      })
      if (!user) {
        alert('로그인이 필요합니다.')
        return
      }
      // 새로운 LocalSheetMusicNote 형식으로 저장 (송폼 정보 포함)
      console.log('📝 saveNote 호출 직전, annotations:', annotations)
      const result = await saveNote({
        user_id: user.id,
        song_id: editingSong.id,
        song_name: editingSong.song_name,
        team_name: editingSong.team_name || undefined,
        file_url: editingSong.file_url,
        file_type: editingSong.file_type === 'pdf' ? 'pdf' : 'image',
        title: `${editingSong.song_name} 필기`,
        annotations,
        songForms: songForms[editingSong.id],  // 곡의 송폼 정보도 저장
        songFormEnabled: extra?.songFormEnabled,
        songFormStyle: extra?.songFormStyle,
        partTags: extra?.partTags,
      })
      console.log('📝 saveNote 결과:', result)
      if (result) {
        alert('필기가 my-page에 저장되었습니다!\nmy-page > 내 필기 노트에서 확인하세요.')
        setShowNoteEditor(false)
        setEditingSong(null)
      } else {
        console.error('❌ saveNote 실패')
        alert('저장에 실패했습니다.')
      }
    }}
    onClose={() => {
      setShowNoteEditor(false)
      setEditingSong(null)
    }}
  />
)}

{/* 📝 다중 곡 악보 뷰어 (선택된 곡들) */}
{showMultiSongEditor && multiSongEditorSongs.length > 0 && (
  <SheetMusicEditor
    fileUrl=""
    fileType="image"
    songName=""
    songs={multiSongEditorSongs}
    initialMode="view"
    onSaveAll={handleSaveMultiSongNotes}
    onClose={handleCloseMultiSongEditor}
  />
)}

    </div>
  )
}