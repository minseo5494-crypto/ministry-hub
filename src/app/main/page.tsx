'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase, Song, User, Folder, PageAnnotation, ThemeCount, fetchThemeCounts, SeasonCount, fetchSeasons, parseThemes } from '@/lib/supabase'
import { SongFormStyle, PartTagStyle, PianoScoreElement, DrumScoreElement, EditorSong } from '@/components/SheetMusicEditor/types'
import { getCurrentUser, signOut } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { useMobile } from '@/hooks/useMobile'
import { useTeamNameSearch } from '@/hooks/useTeamNameSearch'
import { useDownload } from '@/hooks/useDownload'
import { useAISearch } from '@/hooks/useAISearch'
import { logSongSearch } from '@/lib/activityLogger'
import { trackSetlistCreate, trackSongView, trackSongLike } from '@/lib/analytics'
import { getErrorMessage } from '@/lib/errorMessages'
import { getTempoFromBPM, getBPMRangeFromTempo } from '@/lib/musicUtils'

// Components
import {
  Header,
  MobileMenu,
  HeroSection,
  SelectedSongsBar,
  SongListToolbar,
  SongList,
  FilterPanel,
  SongFormModal,
  SongFormPositionModal,
  DownloadLoadingModal,
  ImagePreviewModal,
  SheetMusicEditor,
  SheetMusicViewer
} from './components'
import { AddSongModal, SaveSetlistModal, PreviewModal, PPTModal, YoutubeModal, LyricsModal } from './modals'
import { useSheetMusicNotes } from '@/hooks/useSheetMusicNotes'

// Types
import { Filters, SortBy, SongFilter, ViewMode, NewSongForm, UserTeam, LocalSheetMusicNote } from './types'

declare global {
  interface Window {
    pdfjsLib: any
  }
}

// ===== 스팸 방지 유틸리티 =====

// 무의미한 한글 문자열 감지 (랜덤 조합 스팸)
const isSpamContent = (text: string): boolean => {
  if (!text || text.length < 3) return false

  // 공백 제거 후 검사
  const cleaned = text.replace(/\s/g, '')
  if (cleaned.length < 3) return false

  // 1. 숫자나 영문만 있으면 통과 (정상 제목일 수 있음)
  if (/^[a-zA-Z0-9\s\-_.,:!?]+$/.test(text)) return false

  // 2. 한글이 포함된 경우 검사
  const koreanChars = cleaned.match(/[가-힣]/g) || []
  if (koreanChars.length < 3) return false

  // 3. 자주 사용되는 한글 음절 패턴 (정상적인 단어에 자주 등장)
  const commonSyllables = /[가나다라마바사아자차카타파하고노도로모보소오조초코토포호기니디리미비시이지치키티피히은는이가를의에서로와과도면만요네데게세레케테페헤]/g
  const commonCount = (cleaned.match(commonSyllables) || []).length
  const koreanRatio = commonCount / koreanChars.length

  // 4. 흔한 음절 비율이 30% 미만이면 스팸으로 판단
  if (koreanRatio < 0.3 && koreanChars.length >= 4) {
    return true
  }

  // 5. 연속된 희귀 초성 패턴 감지 (ㄲ,ㄸ,ㅃ,ㅆ,ㅉ 등이 연속)
  const rareInitials = /[꺼-껴|떠-뗘|뻐-뼈|써-쎼|쩌-쪄]{2,}/
  if (rareInitials.test(cleaned)) return true

  return false
}

// 업로드 속도 제한 체크
const checkUploadRateLimit = async (
  supabaseClient: typeof supabase,
  userId: string
): Promise<{ allowed: boolean; message?: string }> => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // 최근 1시간 업로드 수
  const { count: hourlyCount } = await supabaseClient
    .from('songs')
    .select('*', { count: 'exact', head: true })
    .eq('uploaded_by', userId)
    .gte('created_at', oneHourAgo)

  // 최근 24시간 업로드 수
  const { count: dailyCount } = await supabaseClient
    .from('songs')
    .select('*', { count: 'exact', head: true })
    .eq('uploaded_by', userId)
    .gte('created_at', oneDayAgo)

  // 제한: 시간당 5곡, 일일 20곡
  if ((hourlyCount || 0) >= 5) {
    return { allowed: false, message: '업로드 제한: 시간당 최대 5곡까지 업로드 가능합니다. 잠시 후 다시 시도해주세요.' }
  }
  if ((dailyCount || 0) >= 20) {
    return { allowed: false, message: '업로드 제한: 일일 최대 20곡까지 업로드 가능합니다. 내일 다시 시도해주세요.' }
  }

  return { allowed: true }
}

const initialFilters: Filters = {
  season: '전체',
  themes: [],
  theme: '',
  key: '',
  isMinor: false,
  timeSignature: '',
  tempo: '',
  searchText: '',
  bpmMin: '',
  bpmMax: '',
  includeMyNotes: false,
  includeLyrics: false
}

const initialNewSong: NewSongForm = {
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
}

export default function MainPage() {
  const router = useRouter()
  const isMobile = useMobile(1024) // lg 브레이크포인트 사용 (태블릿도 모바일 UI)

  // Auth state
  const [user, setUser] = useState<User | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)

  // UI state
  const [showMenu, setShowMenu] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  // Data state
  const [songs, setSongs] = useState<Song[]>([])
  const [filteredSongs, setFilteredSongs] = useState<Song[]>([])
  const [selectedSongs, setSelectedSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)

  // Like state
  const [likedSongs, setLikedSongs] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<SortBy>('recent')
  const [songFilter, setSongFilter] = useState<SongFilter>('all')

  // Pagination
  const [displayCount, setDisplayCount] = useState(20)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // Song form state
  const [songForms, setSongForms] = useState<{ [songId: string]: string[] }>({})
  const [showFormModal, setShowFormModal] = useState(false)
  const [currentFormSong, setCurrentFormSong] = useState<Song | null>(null)

  // Preview state
  const [previewSong, setPreviewSong] = useState<Song | null>(null)
  const [previewStates, setPreviewStates] = useState<{ [key: string]: boolean }>({})
  const [youtubeStates, setYoutubeStates] = useState<{ [key: string]: boolean }>({})
  const [youtubeModalSong, setYoutubeModalSong] = useState<Song | null>(null)
  const [focusedSongIndex, setFocusedSongIndex] = useState<number>(-1)

  // Note editor state
  const [showNoteEditor, setShowNoteEditor] = useState(false)
  const [editingSong, setEditingSong] = useState<Song | null>(null)
  const { saveNote, notes: mySheetNotes, fetchNotes: fetchMyNotes } = useSheetMusicNotes()
  const [matchingNotes, setMatchingNotes] = useState<typeof mySheetNotes>([])

  // Multi-song editor
  const [multiSongEditorSongs, setMultiSongEditorSongs] = useState<{
    song_id: string
    song_name: string
    team_name?: string
    file_url: string
    file_type: 'pdf' | 'image'
    songForms?: string[]
  }[]>([])
  const [showMultiSongEditor, setShowMultiSongEditor] = useState(false)

  // Simple viewer
  const [simpleViewerSong, setSimpleViewerSong] = useState<Song | null>(null)

  // Lyrics modal state
  const [showLyricsModal, setShowLyricsModal] = useState(false)
  const [editingLyricsSong, setEditingLyricsSong] = useState<Song | null>(null)
  const [lyricsText, setLyricsText] = useState('')

  // Save setlist modal state
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [setlistTitle, setSetlistTitle] = useState('')
  const [setlistDate, setSetlistDate] = useState(new Date().toISOString().split('T')[0])
  const [setlistType, setSetlistType] = useState('주일집회')
  const [customSetlistType, setCustomSetlistType] = useState('')
  const [selectedTeamId, setSelectedTeamId] = useState<string>('')

  // Add song modal state
  const [showAddSongModal, setShowAddSongModal] = useState(false)
  const [newSong, setNewSong] = useState<NewSongForm>(initialNewSong)
  const [uploadingFile, setUploadingFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [duplicateSongs, setDuplicateSongs] = useState<Song[]>([])
  const [checkingDuplicate, setCheckingDuplicate] = useState(false)
  const duplicateCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Team state
  const [userTeams, setUserTeams] = useState<UserTeam[]>([])

  // Theme state
  const [themeCounts, setThemeCounts] = useState<ThemeCount[]>([])
  const [themesLoading, setThemesLoading] = useState(true)

  // Season state
  const [seasonsList, setSeasonsList] = useState<SeasonCount[]>([])
  const [seasonsLoading, setSeasonsLoading] = useState(true)

  // Filter state
  const [filters, setFilters] = useState<Filters>(initialFilters)

  // AI search state
  const [isAISearchEnabled, setIsAISearchEnabled] = useState(false)
  const [aiSearchKeywords, setAiSearchKeywords] = useState<string[]>([])
  const { searchWithAI, isSearching: isAISearching, lastResult: aiSearchResult, clearResult: clearAIResult } = useAISearch()

  // Team name search
  const {
    suggestions: teamNameSuggestions,
    showSuggestions: showTeamSuggestions,
    searchTeamNames,
    setShowSuggestions: setShowTeamSuggestions
  } = useTeamNameSearch()

  // Double tap refs
  const lastTapTimeRef = useRef<number>(0)
  const lastTapSongIdRef = useRef<string | null>(null)

  // Download hook
  const {
    downloadingPDF,
    downloadingImage,
    downloadingPPT,
    showFormatModal,
    showPositionModal,
    showPPTModal,
    downloadProgress,
    previewImages,
    showPreview,
    setShowPreview,
    handlePreviewSave,
    handlePreviewSaveAll,
    setShowPPTModal,
    handleDownload,
    onPositionConfirm,
    onPositionCancel,
    generatePPTWithOptions,
    hasMultipleSongs,
    hasSongForms: hasSongFormsForPPT,
    DownloadFormatModal,
  } = useDownload({
    selectedSongs,
    songForms,
    userId: user?.id
  })

  // ===== Effects =====

  useEffect(() => {
    checkUser()
  }, [])

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
    const loadSeasons = async () => {
      setSeasonsLoading(true)
      const seasons = await fetchSeasons()
      setSeasonsList(seasons)
      setSeasonsLoading(false)
    }
    loadSeasons()
  }, [])

  useEffect(() => {
    if (user) fetchLikeData()
  }, [user])

  useEffect(() => {
    if (typeof window !== 'undefined' && window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
    }
  }, [])

  useEffect(() => {
    if (isMobile) {
      setShowFilterPanel(false)
    } else {
      setShowFilterPanel(true)
    }
  }, [isMobile])

  // 모바일에서 필터 패널이 열렸을 때 body 스크롤 잠금
  useEffect(() => {
    if (isMobile && showFilterPanel) {
      document.body.style.overflow = 'hidden'
      document.body.style.touchAction = 'none'
    } else {
      document.body.style.overflow = ''
      document.body.style.touchAction = ''
    }
    return () => {
      document.body.style.overflow = ''
      document.body.style.touchAction = ''
    }
  }, [isMobile, showFilterPanel])

  useEffect(() => {
    if (user?.id) fetchMyNotes(user.id)
  }, [user?.id, fetchMyNotes])

  useEffect(() => {
    const handleClickOutside = () => {
      if (showMenu) setShowMenu(false)
    }
    if (showMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showMenu])

  useEffect(() => {
    fetchSongs()
    fetchUserTeams()
  }, [user])

  useEffect(() => {
    if (user !== null) fetchSongs()
  }, [user, userTeams])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return

      if (previewSong) {
        if (e.key === 'Escape') setPreviewSong(null)
        else if (e.key === 'ArrowLeft') { e.preventDefault(); showPreviousSong() }
        else if (e.key === 'ArrowRight') { e.preventDefault(); showNextSong() }
        return
      }

      if (focusedSongIndex >= 0 && focusedSongIndex < filteredSongs.length) {
        if (e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault()
          const song = filteredSongs[focusedSongIndex]
          if (song.file_url) setPreviewSong(song)
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          if (focusedSongIndex > 0) setFocusedSongIndex(focusedSongIndex - 1)
        } else if (e.key === 'ArrowDown') {
          e.preventDefault()
          if (focusedSongIndex < filteredSongs.length - 1) setFocusedSongIndex(focusedSongIndex + 1)
        } else if (e.key === 'Enter') {
          e.preventDefault()
          toggleSongSelection(filteredSongs[focusedSongIndex])
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [previewSong, focusedSongIndex, filteredSongs])

  // Filter effect
  useEffect(() => {
    let result = [...songs]

    const searchKeywords = aiSearchKeywords.length > 0
      ? aiSearchKeywords
      : filters.searchText
        ? filters.searchText.split(/[,\s]+/).map(k => k.trim()).filter(k => k.length > 0)
        : []

    if (searchKeywords.length > 0) {
      // AI 검색인지 일반 검색인지 구분
      const isAISearch = aiSearchKeywords.length > 0

      result = result.filter(song => {
        const normalizedSongName = normalizeText(song.song_name)
        const normalizedTeamName = normalizeText(song.team_name || '')
        const songNameLower = song.song_name.toLowerCase()
        const teamNameLower = song.team_name?.toLowerCase() || ''

        // AI 검색 시 가사도 자동으로 검색
        const shouldSearchLyrics = isAISearch || filters.includeLyrics
        const normalizedLyrics = shouldSearchLyrics && song.lyrics ? normalizeText(song.lyrics) : ''
        const lyricsLower = shouldSearchLyrics && song.lyrics ? song.lyrics.toLowerCase() : ''

        const matchKeyword = (keyword: string) => {
          const normalizedKeyword = normalizeText(keyword)
          const keywordLower = keyword.toLowerCase()

          // 제목과 팀명으로 검색
          const matchesTitleOrTeam =
            normalizedSongName.includes(normalizedKeyword) ||
            normalizedTeamName.includes(normalizedKeyword) ||
            songNameLower.includes(keywordLower) ||
            teamNameLower.includes(keywordLower)

          // 가사 검색
          const matchesLyrics = shouldSearchLyrics && song.lyrics &&
            (normalizedLyrics.includes(normalizedKeyword) || lyricsLower.includes(keywordLower))

          return matchesTitleOrTeam || matchesLyrics
        }

        // AI 검색: 하나라도 매칭되면 OK (some) - 관련 키워드 중 하나만 있어도 됨
        // 일반 검색: 모든 키워드가 매칭되어야 함 (every)
        if (isAISearch) {
          return searchKeywords.some(matchKeyword)
        } else {
          return searchKeywords.every(matchKeyword)
        }
      })
    }

    if (filters.season && filters.season !== '전체') {
      result = result.filter(song => song.season === filters.season)
    }

    if (filters.themes.length > 0) {
      result = result.filter(song => {
        const songThemes = parseThemes(song.themes)
        if (songThemes.length > 0) {
          return filters.themes.some(theme => songThemes.includes(theme))
        } else {
          return filters.themes.some(theme => song.theme1 === theme || song.theme2 === theme)
        }
      })
    }

    if (filters.theme) {
      result = result.filter(song => song.theme1 === filters.theme || song.theme2 === filters.theme)
    }

    if (filters.key || filters.isMinor) {
      result = result.filter(song => {
        if (!song.key) return false
        if (filters.isMinor && !filters.key) return song.key.includes('m')
        if (filters.key && !filters.isMinor) return song.key === filters.key && !song.key.includes('m')
        if (filters.key && filters.isMinor) return song.key === `${filters.key}m`
        return false
      })
    }

    if (filters.timeSignature) {
      result = result.filter(song => song.time_signature === filters.timeSignature)
    }

    if (filters.tempo) {
      result = result.filter(song => song.tempo === filters.tempo)
    }

    if (filters.bpmMin || filters.bpmMax) {
      result = result.filter(song => {
        const filterMin = filters.bpmMin ? parseFloat(filters.bpmMin) : 0
        const filterMax = filters.bpmMax ? parseFloat(filters.bpmMax) : Infinity

        if (song.bpm) {
          const songBpm = typeof song.bpm === 'string' ? parseFloat(song.bpm) : song.bpm
          return songBpm >= filterMin && songBpm <= filterMax
        }

        if (song.tempo) {
          const tempoRange = getBPMRangeFromTempo(song.tempo)
          if (tempoRange) {
            return tempoRange.max >= filterMin && tempoRange.min <= filterMax
          }
        }

        return false
      })
    }

    if (songFilter === 'official') {
      result = result.filter(song => song.is_official === true)
    } else if (songFilter === 'user') {
      result = result.filter(song => song.is_user_uploaded === true)
    }

    // 검색어가 있을 때 제목 일치 우선 정렬
    if (searchKeywords.length > 0) {
      // 키워드 등장 횟수 계산 함수
      const countKeywordOccurrences = (title: string, keywords: string[]): number => {
        const normalizedTitle = normalizeText(title)
        return keywords.reduce((total, keyword) => {
          const normalizedKeyword = normalizeText(keyword)
          if (!normalizedKeyword) return total
          // 제목에서 키워드가 몇 번 등장하는지 카운트
          const regex = new RegExp(normalizedKeyword, 'g')
          const matches = normalizedTitle.match(regex)
          return total + (matches ? matches.length : 0)
        }, 0)
      }

      result.sort((a, b) => {
        const aTitleScore = countKeywordOccurrences(a.song_name, searchKeywords)
        const bTitleScore = countKeywordOccurrences(b.song_name, searchKeywords)

        // 제목 일치 점수가 높은 순으로 정렬
        if (bTitleScore !== aTitleScore) {
          return bTitleScore - aTitleScore
        }

        // 점수가 같으면 좋아요 많은 순으로 정렬
        const aLikes = (a as any).like_count || 0
        const bLikes = (b as any).like_count || 0
        if (bLikes !== aLikes) {
          return bLikes - aLikes
        }

        // 좋아요도 같으면 제목 가나다순
        return a.song_name.localeCompare(b.song_name, 'ko')
      })
    } else if (sortBy === 'likes') {
      result.sort((a, b) => ((b as any).like_count || 0) - ((a as any).like_count || 0))
    } else if (sortBy === 'name') {
      result.sort((a, b) => a.song_name.localeCompare(b.song_name, 'ko'))
    }

    if (filters.includeMyNotes && mySheetNotes.length > 0) {
      const searchText = filters.searchText.toLowerCase().replace(/\s+/g, '')
      const matchedNotes = mySheetNotes.filter(note => {
        if (!searchText) return true
        const normalizedSongName = (note.song_name || '').toLowerCase().replace(/\s+/g, '')
        const normalizedTeamName = (note.team_name || '').toLowerCase().replace(/\s+/g, '')
        return normalizedSongName.includes(searchText) || normalizedTeamName.includes(searchText)
      })
      setMatchingNotes(matchedNotes)
    } else {
      setMatchingNotes([])
    }

    setFilteredSongs(result)
    setFocusedSongIndex(-1)

    if (user && filters.searchText.length > 0) {
      const debounceTimer = setTimeout(() => {
        logSongSearch(filters.searchText, result.length, user.id).catch(console.error)
      }, 1000)
      return () => clearTimeout(debounceTimer)
    }
  }, [songs, filters, user, sortBy, songFilter, mySheetNotes, aiSearchKeywords])

  useEffect(() => {
    setDisplayCount(20)
  }, [filteredSongs])

  // ===== Helper Functions =====

  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .replace(/\([a-g][#b]?m?\)/gi, '')
      .replace(/\s+/g, '')
      .replace(/[^\w가-힣]/g, '')
  }

  const getYoutubeEmbedUrl = (url: string) => {
    if (!url) return null
    const watchMatch = url.match(/[?&]v=([^&]+)/)
    if (watchMatch) return `https://www.youtube.com/embed/${watchMatch[1]}`
    const shortMatch = url.match(/youtu\.be\/([^?]+)/)
    if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}`
    if (url.includes('/embed/')) return url
    return null
  }

  // ===== Auth Functions =====

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

  const handleSignOut = async () => {
    try {
      await signOut()
      setUser(null)
      router.push('/login')
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  // ===== Data Fetching =====

  const fetchSongs = async () => {
    setLoading(true)
    try {
      let allData: Song[] = []
      let from = 0
      const pageSize = 1000

      while (true) {
        const { data, error } = await supabase
          .from('songs')
          .select('*')
          .or('is_hidden.is.null,is_hidden.eq.false')  // 숨김 처리된 곡 제외
          .order('song_name', { ascending: true })
          .range(from, from + pageSize - 1)

        if (error) throw error
        if (!data || data.length === 0) break
        allData = [...allData, ...data]
        if (data.length < pageSize) break
        from += pageSize
      }

      const filteredData = allData.filter(song => {
        if (!song.song_name || song.song_name.trim() === '' || song.song_name.length <= 1) return false
        if (song.visibility === 'public' || !song.visibility) return true
        if (!user) return false
        if (song.visibility === 'private') return song.uploaded_by === user.id
        if (song.visibility === 'teams') {
          if (song.uploaded_by === user.id) return true
          const myTeamIds = userTeams.map(t => t.id)
          const sharedTeamIds = song.shared_with_teams || []
          return myTeamIds.some(teamId => sharedTeamIds.includes(teamId))
        }
        return false
      })

      setSongs(filteredData)
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
      alert(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const fetchUserTeams = async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select(`team_id, teams (id, name)`)
        .eq('user_id', user.id)
        .eq('status', 'active')

      if (error) throw error

      const teams = data?.map((tm) => {
        const team = tm.teams as unknown as { id: string; name: string }
        return { id: team.id, name: team.name }
      }) || []

      setUserTeams(teams)
    } catch (error) {
      console.error('Error fetching user teams:', error)
      setUserTeams([])
    }
  }

  const fetchLikeData = async () => {
    if (!user) return
    try {
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

  // ===== Song Actions =====

  const toggleSongSelection = (song: Song) => {
    if (selectedSongs.find(s => s.id === song.id)) {
      setSelectedSongs(selectedSongs.filter(s => s.id !== song.id))
    } else {
      setSelectedSongs([...selectedSongs, song])
    }
  }

  const togglePreview = (songId: string) => {
    const isCurrentlyOpen = previewStates[songId]
    if (!isCurrentlyOpen) {
      const song = songs.find(s => s.id === songId)
      if (song) trackSongView(songId, song.song_name)
    }
    setPreviewStates(prev => ({ ...prev, [songId]: !prev[songId] }))
  }

  const toggleYoutube = (songId: string) => {
    setYoutubeStates(prev => ({ ...prev, [songId]: !prev[songId] }))
  }

  // 좋아요 처리 중인 곡 ID 추적
  const [likingIds, setLikingIds] = useState<Set<string>>(new Set())

  const toggleLike = async (e: React.MouseEvent, songId: string) => {
    e.stopPropagation()
    if (!user) {
      alert('로그인이 필요합니다.')
      return
    }

    // 이미 처리 중이면 무시 (중복 클릭 방지)
    if (likingIds.has(songId)) return

    const isLiked = likedSongs.has(songId)

    // 처리 중 상태 설정
    setLikingIds(prev => new Set([...prev, songId]))

    // Optimistic UI: 즉시 UI 업데이트
    if (isLiked) {
      setLikedSongs(prev => {
        const next = new Set(prev)
        next.delete(songId)
        return next
      })
      setSongs(prev => prev.map(s => s.id === songId ? { ...s, like_count: Math.max(0, (s.like_count || 1) - 1) } : s))
    } else {
      setLikedSongs(prev => new Set([...prev, songId]))
      setSongs(prev => prev.map(s => s.id === songId ? { ...s, like_count: (s.like_count || 0) + 1 } : s))
    }

    try {
      if (isLiked) {
        await supabase.from('song_likes').delete().eq('song_id', songId).eq('user_id', user.id)
      } else {
        await supabase.from('song_likes').insert({ song_id: songId, user_id: user.id })
        trackSongLike(songId)
      }
    } catch (error) {
      console.error('좋아요 처리 실패:', error)
      // 실패 시 롤백
      if (isLiked) {
        setLikedSongs(prev => new Set([...prev, songId]))
        setSongs(prev => prev.map(s => s.id === songId ? { ...s, like_count: (s.like_count || 0) + 1 } : s))
      } else {
        setLikedSongs(prev => {
          const next = new Set(prev)
          next.delete(songId)
          return next
        })
        setSongs(prev => prev.map(s => s.id === songId ? { ...s, like_count: Math.max(0, (s.like_count || 1) - 1) } : s))
      }
    } finally {
      // 처리 완료 상태 해제
      setLikingIds(prev => {
        const next = new Set(prev)
        next.delete(songId)
        return next
      })
    }
  }

  const showPreviousSong = () => {
    if (!previewSong) return
    const currentIndex = filteredSongs.findIndex(s => s.id === previewSong.id)
    if (currentIndex > 0) {
      const prevSong = filteredSongs[currentIndex - 1]
      if (prevSong.file_url) setPreviewSong(prevSong)
    }
  }

  const showNextSong = () => {
    if (!previewSong) return
    const currentIndex = filteredSongs.findIndex(s => s.id === previewSong.id)
    if (currentIndex < filteredSongs.length - 1) {
      const nextSong = filteredSongs[currentIndex + 1]
      if (nextSong.file_url) setPreviewSong(nextSong)
    }
  }

  const loadMore = () => {
    setIsLoadingMore(true)
    setTimeout(() => {
      setDisplayCount(prev => Math.min(prev + 20, filteredSongs.length))
      setIsLoadingMore(false)
    }, 300)
  }

  // ===== Sheet Viewer =====

  const openSheetViewer = (clickedSong: Song) => {
    const isClickedSongSelected = selectedSongs.some(s => s.id === clickedSong.id)

    if (selectedSongs.length >= 2 && isClickedSongSelected) {
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
      setEditingSong(clickedSong)
      setShowNoteEditor(true)
    }
  }

  const openSimpleViewer = (song: Song) => {
    if (!song.file_url) return
    setSimpleViewerSong(song)
  }

  const handleDoubleTap = (song: Song) => {
    const now = Date.now()
    const DOUBLE_TAP_DELAY = 300

    if (lastTapSongIdRef.current === song.id && now - lastTapTimeRef.current < DOUBLE_TAP_DELAY) {
      openSimpleViewer(song)
      lastTapTimeRef.current = 0
      lastTapSongIdRef.current = null
    } else {
      lastTapTimeRef.current = now
      lastTapSongIdRef.current = song.id
    }
  }

  const handleSaveMultiSongNotes = async (data: { song: EditorSong, annotations: PageAnnotation[], extra?: { songFormEnabled: boolean, songFormStyle: SongFormStyle, partTags: PartTagStyle[] } }[]) => {
    if (!user) {
      alert('로그인이 필요합니다.')
      return
    }

    let savedCount = 0
    for (const item of data) {
      const hasContent = item.annotations.some(ann => (ann.strokes?.length || 0) > 0 || (ann.textElements?.length || 0) > 0)

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

  const handleCloseMultiSongEditor = () => {
    if (multiSongEditorSongs.length > 0) {
      if (!confirm('필기 내용이 저장되지 않습니다. 정말 닫으시겠습니까?')) return
    }
    setShowMultiSongEditor(false)
    setMultiSongEditorSongs([])
  }

  // ===== Modal Handlers =====

  const openFormModal = (song: Song) => {
    setCurrentFormSong(song)
    setShowFormModal(true)
  }

  const openLyricsModal = (song: Song) => {
    setEditingLyricsSong(song)
    setLyricsText(song.lyrics || '')
    setShowLyricsModal(true)
  }

  // ===== Filter Handlers =====

  const handleFilterChange = (key: string, value: string | string[] | boolean) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const resetFilters = () => {
    setFilters({
      ...initialFilters,
      searchText: filters.searchText
    })
  }

  const toggleThemeFilter = (theme: string) => {
    setFilters(prev => ({
      ...prev,
      themes: prev.themes.includes(theme)
        ? prev.themes.filter(t => t !== theme)
        : [...prev.themes, theme]
    }))
  }

  // ===== Add Song Handlers =====

  const checkDuplicateSong = async (songName: string, teamName: string) => {
    if (!songName.trim()) {
      setDuplicateSongs([])
      return
    }

    setCheckingDuplicate(true)
    try {
      const normalizedInput = normalizeText(songName)
      const normalizedTeam = normalizeText(teamName)

      const { data, error } = await supabase
        .from('songs')
        .select('id, song_name, team_name, is_official, visibility, uploaded_by')
        .ilike('song_name', `%${songName.trim()}%`)
        .limit(50)

      if (error) throw error

      const duplicates = (data || []).filter(song => {
        const normalizedSongName = normalizeText(song.song_name || '')
        const normalizedSongTeam = normalizeText(song.team_name || '')
        const isSimilar = normalizedSongName === normalizedInput ||
          normalizedSongName.includes(normalizedInput) ||
          normalizedInput.includes(normalizedSongName)

        if (isSimilar) {
          if (normalizedTeam && normalizedSongTeam) {
            return normalizedSongTeam === normalizedTeam ||
              normalizedSongTeam.includes(normalizedTeam) ||
              normalizedTeam.includes(normalizedSongTeam)
          }
          return true
        }
        return false
      })

      setDuplicateSongs(duplicates as Song[])
    } catch (error) {
      console.error('중복 체크 오류:', error)
    } finally {
      setCheckingDuplicate(false)
    }
  }

  const handleSongNameChange = (value: string) => {
    setNewSong({ ...newSong, song_name: value })
    if (duplicateCheckTimeoutRef.current) clearTimeout(duplicateCheckTimeoutRef.current)
    duplicateCheckTimeoutRef.current = setTimeout(() => {
      checkDuplicateSong(value, newSong.team_name)
    }, 500)
  }

  const handleTeamNameChange = (value: string) => {
    setNewSong({ ...newSong, team_name: value })
    searchTeamNames(value)
    if (duplicateCheckTimeoutRef.current) clearTimeout(duplicateCheckTimeoutRef.current)
    duplicateCheckTimeoutRef.current = setTimeout(() => {
      checkDuplicateSong(newSong.song_name, value)
    }, 500)
  }

  const handleBPMChange = (bpmValue: string) => {
    const bpm = parseInt(bpmValue)
    if (!isNaN(bpm) && bpm > 0) {
      const autoTempo = getTempoFromBPM(bpm)
      setNewSong({ ...newSong, bpm: bpmValue, tempo: autoTempo })
    } else {
      setNewSong({ ...newSong, bpm: bpmValue })
    }
  }

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
    setUploadingFile(file)
  }

  const addNewSong = async () => {
    if (!newSong.song_name.trim()) {
      alert('곡 제목을 입력하세요.')
      return
    }
    if (newSong.visibility === 'teams' && newSong.shared_with_teams.length === 0) {
      alert('공유할 팀을 최소 1개 선택해주세요')
      return
    }
    if (duplicateSongs.length > 0) {
      const duplicateInfo = duplicateSongs.map(s => `• "${s.song_name}"${s.team_name ? ` - ${s.team_name}` : ''}`).join('\n')
      const confirmed = confirm(`⚠️ 비슷한 곡이 이미 존재합니다!\n\n${duplicateInfo}\n\n그래도 추가하시겠습니까?`)
      if (!confirmed) return
    }

    // 스팸 방지: 콘텐츠 검증
    if (isSpamContent(newSong.song_name.trim()) || isSpamContent(newSong.team_name.trim())) {
      alert('⚠️ 곡 제목 또는 아티스트명이 유효하지 않습니다.\n올바른 정보를 입력해주세요.')
      return
    }

    // 스팸 방지: 업로드 속도 제한
    const rateLimit = await checkUploadRateLimit(supabase, user!.id)
    if (!rateLimit.allowed) {
      alert(`⚠️ ${rateLimit.message}`)
      return
    }

    setUploading(true)

    try {
      let fileUrl = ''
      let fileType = ''

      if (uploadingFile) {
        const fileExt = uploadingFile.name.split('.').pop()?.toLowerCase() || 'pdf'
        const timestamp = Date.now()
        const randomStr = Math.random().toString(36).substring(2, 8)
        const safeFileName = `${timestamp}_${randomStr}.${fileExt}`
        const filePath = `${user!.id}/${safeFileName}`

        const { error: uploadError } = await supabase.storage
          .from('song-sheets')
          .upload(filePath, uploadingFile, {
            cacheControl: '3600',
            upsert: false,
            contentType: uploadingFile.type
          })

        if (uploadError) throw new Error(`파일 업로드 실패: ${uploadError.message}`)

        const { data: urlData } = supabase.storage.from('song-sheets').getPublicUrl(filePath)
        fileUrl = urlData.publicUrl
        fileType = fileExt
      }

      const { data: officialUploader } = await supabase
        .from('official_uploaders')
        .select('id')
        .eq('email', user!.email.toLowerCase())
        .maybeSingle()

      const { data: publisherAccount } = await supabase
        .from('publisher_accounts')
        .select('publisher_id, verified_publishers!inner(is_active)')
        .eq('email', user!.email.toLowerCase())
        .maybeSingle()

      const isOfficial = !!officialUploader || (!!publisherAccount && (publisherAccount.verified_publishers as any)?.is_active)
      const publisherId = publisherAccount?.publisher_id || null

      const { error: insertError } = await supabase.from('songs').insert({
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
        user_id: user!.id,
        uploaded_by: user!.id,
        visibility: newSong.visibility,
        shared_with_teams: newSong.visibility === 'teams' ? newSong.shared_with_teams : null,
        is_user_uploaded: true,
        is_official: isOfficial,
        publisher_id: publisherId
      })

      if (insertError) throw insertError

      alert('✅ 곡이 추가되었습니다!')
      setShowAddSongModal(false)
      setNewSong(initialNewSong)
      setUploadingFile(null)
      setDuplicateSongs([])
      fetchSongs()
    } catch (error: unknown) {
      console.error('❌ 곡 추가 오류:', error)
      const message = error instanceof Error ? error.message : '알 수 없는 오류'
      alert(`❌ 곡 추가에 실패했습니다.\n\n오류: ${message}`)
    } finally {
      setUploading(false)
    }
  }

  // ===== Save Setlist =====

  const saveSetlist = async () => {
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
      const { data: setlist, error: setlistError } = await supabase
        .from('team_setlists')
        .insert({
          team_id: selectedTeamId,
          title: setlistTitle,
          service_date: setlistDate,
          service_type: setlistType === '직접입력' ? customSetlistType : setlistType,
          created_by: user!.id,
          notes: ''
        })
        .select()
        .single()

      if (setlistError) throw setlistError

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

      trackSetlistCreate(selectedSongs.length)
      alert('✅ 콘티가 저장되었습니다!')

      setShowSaveModal(false)
      setSetlistTitle('')
      setCustomSetlistType('')
      setSelectedTeamId('')
      setSelectedSongs([])
      setSongForms({})
    } catch (error) {
      console.error('Error saving setlist:', error)
      alert(getErrorMessage(error))
    }
  }

  // ===== Computed Values =====

  const displayedSongs = filteredSongs.slice(0, displayCount)
  const hasMore = displayCount < filteredSongs.length

  // ===== Render =====

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        user={user}
        showMenu={showMenu}
        setShowMenu={setShowMenu}
        setShowMobileMenu={setShowMobileMenu}
        setShowAddSongModal={setShowAddSongModal}
        handleSignOut={handleSignOut}
      />

      <MobileMenu
        isOpen={showMobileMenu}
        user={user}
        onClose={() => setShowMobileMenu(false)}
        setShowAddSongModal={setShowAddSongModal}
        handleSignOut={handleSignOut}
      />

      <HeroSection
        songs={songs}
        selectedSongs={selectedSongs}
        filters={filters}
        setFilters={setFilters}
        isAISearchEnabled={isAISearchEnabled}
        setIsAISearchEnabled={setIsAISearchEnabled}
        isAISearching={isAISearching}
        aiSearchResult={aiSearchResult}
        aiSearchKeywords={aiSearchKeywords}
        setAiSearchKeywords={setAiSearchKeywords}
        searchWithAI={searchWithAI}
        clearAIResult={clearAIResult}
      />

      <SelectedSongsBar
        user={user}
        selectedSongs={selectedSongs}
        isMobile={isMobile}
        showFilterPanel={showFilterPanel}
        downloadingPDF={downloadingPDF}
        downloadingPPT={downloadingPPT}
        handleDownload={handleDownload}
        startPPTDownload={() => setShowPPTModal(true)}
        setShowSaveModal={setShowSaveModal}
        setSelectedSongs={setSelectedSongs}
        setSongForms={setSongForms}
      />

      {/* 모바일/태블릿 필터 배경 오버레이 */}
      {isMobile && showFilterPanel && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 lg:hidden"
          style={{ touchAction: 'none' }}
          onClick={() => setShowFilterPanel(false)}
          onTouchMove={(e) => e.preventDefault()}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-3 lg:gap-6">
          {/* 필터 패널 */}
          <div
            className={`${showFilterPanel ? 'w-64 lg:w-80' : 'w-0'} transition-all duration-300 overflow-hidden ${isMobile && showFilterPanel ? 'fixed left-0 top-0 h-full z-40 bg-white shadow-xl pt-4' : ''}`}
            style={isMobile && showFilterPanel ? { overscrollBehavior: 'contain' } : undefined}
          >
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

          {/* 곡 목록 */}
          <div className="flex-1">
            <SongListToolbar
              user={user}
              filteredSongs={filteredSongs}
              displayCount={displayCount}
              showFilterPanel={showFilterPanel}
              setShowFilterPanel={setShowFilterPanel}
              viewMode={viewMode}
              setViewMode={setViewMode}
              sortBy={sortBy}
              setSortBy={setSortBy}
              songFilter={songFilter}
              setSongFilter={setSongFilter}
              filters={filters}
              setFilters={setFilters}
              mySheetNotes={mySheetNotes as LocalSheetMusicNote[]}
            />

            <SongList
              loading={loading}
              displayedSongs={displayedSongs}
              filteredSongs={filteredSongs}
              selectedSongs={selectedSongs}
              viewMode={viewMode}
              focusedSongIndex={focusedSongIndex}
              setFocusedSongIndex={setFocusedSongIndex}
              previewStates={previewStates}
              youtubeStates={youtubeStates}
              likedSongs={likedSongs}
              songForms={songForms}
              showFilterPanel={showFilterPanel}
              displayCount={displayCount}
              isLoadingMore={isLoadingMore}
              hasMore={hasMore}
              onLoadMore={loadMore}
              onToggleSongSelection={toggleSongSelection}
              onTogglePreview={togglePreview}
              onToggleYoutube={toggleYoutube}
              onToggleLike={toggleLike}
              onSetPreviewSong={setPreviewSong}
              onOpenFormModal={openFormModal}
              onOpenSheetViewer={openSheetViewer}
              onOpenLyricsModal={openLyricsModal}
              onOpenSimpleViewer={openSimpleViewer}
              onSetYoutubeModalSong={setYoutubeModalSong}
              onSetEditingSong={setEditingSong}
              onSetShowNoteEditor={setShowNoteEditor}
              getYoutubeEmbedUrl={getYoutubeEmbedUrl}
              handleDoubleTap={handleDoubleTap}
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddSongModal
        isOpen={showAddSongModal}
        newSong={newSong}
        setNewSong={setNewSong}
        userTeams={userTeams}
        themeCounts={themeCounts}
        uploadingFile={uploadingFile}
        setUploadingFile={setUploadingFile}
        uploading={uploading}
        duplicateSongs={duplicateSongs}
        checkingDuplicate={checkingDuplicate}
        teamNameSuggestions={teamNameSuggestions}
        showTeamSuggestions={showTeamSuggestions}
        setShowTeamSuggestions={setShowTeamSuggestions}
        onSongNameChange={handleSongNameChange}
        onTeamNameChange={handleTeamNameChange}
        onBPMChange={handleBPMChange}
        onTempoChange={handleTempoChange}
        onFileSelect={handleFileSelect}
        onSubmit={addNewSong}
        onClose={() => {
          setShowAddSongModal(false)
          setNewSong(initialNewSong)
          setUploadingFile(null)
          setDuplicateSongs([])
        }}
      />

      <SaveSetlistModal
        isOpen={showSaveModal}
        setlistTitle={setlistTitle}
        setSetlistTitle={setSetlistTitle}
        setlistDate={setlistDate}
        setSetlistDate={setSetlistDate}
        setlistType={setlistType}
        setSetlistType={setSetlistType}
        customSetlistType={customSetlistType}
        setCustomSetlistType={setCustomSetlistType}
        selectedTeamId={selectedTeamId}
        setSelectedTeamId={setSelectedTeamId}
        userTeams={userTeams}
        onSave={saveSetlist}
        onClose={() => {
          setShowSaveModal(false)
          setSetlistTitle('')
          setCustomSetlistType('')
        }}
      />

      <PreviewModal
        song={previewSong}
        filteredSongs={filteredSongs}
        onClose={() => setPreviewSong(null)}
        onPrevious={showPreviousSong}
        onNext={showNextSong}
      />

      <PPTModal
        isOpen={showPPTModal}
        onGeneratePPT={generatePPTWithOptions}
        onClose={() => setShowPPTModal(false)}
        hasMultipleSongs={hasMultipleSongs}
        hasSongForms={hasSongFormsForPPT}
      />

      <YoutubeModal
        song={youtubeModalSong}
        getYoutubeEmbedUrl={getYoutubeEmbedUrl}
        onClose={() => setYoutubeModalSong(null)}
      />

      <LyricsModal
        isOpen={showLyricsModal}
        song={editingLyricsSong}
        lyricsText={lyricsText}
        onClose={() => {
          setShowLyricsModal(false)
          setEditingLyricsSong(null)
          setLyricsText('')
        }}
      />

      <SongFormModal
        isOpen={showFormModal}
        song={currentFormSong}
        initialForm={currentFormSong ? (songForms[currentFormSong.id] || []) : []}
        onSave={(songId, form) => setSongForms(prev => ({ ...prev, [songId]: form }))}
        onClose={() => {
          setShowFormModal(false)
          setCurrentFormSong(null)
        }}
        userId={user?.id}
      />

      <DownloadFormatModal />

      <DownloadLoadingModal
        isOpen={downloadingPDF || downloadingPPT || downloadingImage}
        type={downloadingPDF ? 'pdf' : downloadingImage ? 'image' : 'ppt'}
        progress={downloadProgress || undefined}
      />

      {showPreview && previewImages.length > 0 && (
        <ImagePreviewModal
          images={previewImages}
          onClose={() => setShowPreview(false)}
          onSave={handlePreviewSave}
          onSaveAll={handlePreviewSaveAll}
        />
      )}

      {showPositionModal && (
        <SongFormPositionModal
          songs={selectedSongs}
          songForms={songForms}
          onConfirm={onPositionConfirm}
          onCancel={onPositionCancel}
        />
      )}

      {simpleViewerSong && simpleViewerSong.file_url && (
        <SheetMusicViewer
          fileUrl={simpleViewerSong.file_url}
          fileType={simpleViewerSong.file_type === 'pdf' ? 'pdf' : 'image'}
          songName={simpleViewerSong.song_name}
          onClose={() => setSimpleViewerSong(null)}
        />
      )}

      {showNoteEditor && editingSong && editingSong.file_url && (
        <SheetMusicEditor
          fileUrl={editingSong.file_url}
          fileType={editingSong.file_type === 'pdf' ? 'pdf' : 'image'}
          songName={editingSong.song_name}
          songForms={songForms[editingSong.id]}
          onSave={async (annotations, extra) => {
            if (!user) {
              alert('로그인이 필요합니다.')
              return
            }
            const result = await saveNote({
              user_id: user.id,
              song_id: editingSong.id,
              song_name: editingSong.song_name,
              team_name: editingSong.team_name || undefined,
              file_url: editingSong.file_url,
              file_type: editingSong.file_type === 'pdf' ? 'pdf' : 'image',
              title: `${editingSong.song_name} 필기`,
              annotations,
              songForms: songForms[editingSong.id],
              songFormEnabled: extra?.songFormEnabled,
              songFormStyle: extra?.songFormStyle,
              partTags: extra?.partTags,
            })
            if (result) {
              alert('필기가 my-page에 저장되었습니다!\nmy-page > 내 필기 노트에서 확인하세요.')
              setShowNoteEditor(false)
              setEditingSong(null)
            } else {
              alert('저장에 실패했습니다.')
            }
          }}
          onClose={() => {
            setShowNoteEditor(false)
            setEditingSong(null)
          }}
        />
      )}

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
