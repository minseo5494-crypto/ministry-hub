'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase, Song, SECTION_ABBREVIATIONS } from '@/lib/supabase'
import { getCurrentUser, signOut } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { parseLyrics } from '@/lib/lyricParser'
import {
  Search, Music, FileText, Presentation, FolderOpen, Plus, X,
  ChevronLeft, ChevronRight, Eye, EyeOff, Upload, Users, UserPlus, MoreVertical,
  Grid, List, Filter, Tag, Calendar, Clock, Activity, ChevronDown, BarChart3, Youtube
} from 'lucide-react'
import PptxGenJS from 'pptxgenjs'
import Link from 'next/link'
import { loadKoreanFont } from '@/lib/fontLoader'
// 🆕 로깅 함수 import
import { logSongSearch, logPPTDownload } from '@/lib/activityLogger'

// 절기 & 테마 상수 추가
const SEASONS = ['전체', '크리스마스', '부활절', '고난주간', '추수감사절', '신년', '종교개혁주일']
const THEMES = ['경배', '찬양', '회개', '감사', '헌신', '선교', '구원', '사랑', '소망', '믿음', '은혜', '성령', '치유', '회복', '십자가']

export default function Home() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [showMenu, setShowMenu] = useState(false)

  // UI 상태 추가
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [showFilterPanel, setShowFilterPanel] = useState(true)
  
  // 임시 사용자 ID
  const USER_ID = user?.id || '00000000-0000-0000-0000-000000000001'

  // 기존 상태 유지
  const [songs, setSongs] = useState<Song[]>([])
  const [filteredSongs, setFilteredSongs] = useState<Song[]>([])
  const [selectedSongs, setSelectedSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)

  // 송폼 관련 상태
  const [songForms, setSongForms] = useState<{[songId: string]: string[]}>({})
  const [showFormModal, setShowFormModal] = useState(false)
  const [currentFormSong, setCurrentFormSong] = useState<Song | null>(null)
  const [tempSelectedForm, setTempSelectedForm] = useState<string[]>([])
  const [customSection, setCustomSection] = useState('')

  // PPT 모달 상태
  const [showPPTModal, setShowPPTModal] = useState(false)

  // 사용 가능한 송폼 섹션
  const availableSections = [
    'Intro', 'Verse1', 'Verse2', 'Verse3', 'Verse4',
    'PreChorus', 'PreChorus1', 'PreChorus2',
    'Chorus', 'Chorus1', 'Chorus2',
    'Interlude', 'Bridge', 'Outro'
  ]
  
  // 악보 미리보기 상태
  const [previewSong, setPreviewSong] = useState<Song | null>(null)
  // 🆕 미리보기 토글 상태 (각 곡별로)
  const [previewStates, setPreviewStates] = useState<{ [key: string]: boolean }>({})

  // 🆕 유튜브 영상 토글 상태 (각 곡별로)
  const [youtubeStates, setYoutubeStates] = useState<{ [key: string]: boolean }>({})
  const [focusedSongIndex, setFocusedSongIndex] = useState<number>(-1)
  // 👇 이 줄 추가!
  const [youtubeModalSong, setYoutubeModalSong] = useState<Song | null>(null)

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
    themes: [] as string[], // 🆕 배열로 변경
    season: '', // 🆕 추가
    youtube_url: '', // 🆕 추가
    lyrics: '',
    visibility: 'public' as 'public' | 'teams' | 'private', // 🆕 추가
    shared_with_teams: [] as string[] // 🆕 추가
  })

  // 🆕 사용자의 팀 목록 상태 추가
  const [uploadingFile, setUploadingFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [userTeams, setUserTeams] = useState<any[]>([])
  
  // 필터 상태 (개선된 버전)
  const [filters, setFilters] = useState<{
    season: string;
    themes: string[];
    theme: string;
    key: string;
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
  const tempos = ['느림', '보통', '빠름']
  const themes = THEMES  // 새로운 테마 배열 사용

  // 사용자 정보 확인
  useEffect(() => {
    checkUser()
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
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .order('song_name', { ascending: true })
    
      if (error) throw error
    
      console.log('🔍 전체 곡 데이터:', data?.length)
    
      // 🆕 공유 범위에 따른 필터링
      const filteredData = (data || []).filter(song => {
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
    
      console.log(`✅ 총 ${data?.length || 0}개 중 ${filteredData.length}개의 곡 표시`)
      console.log(`   - 사용자: ${user?.email || '비로그인'}`)
      console.log(`   - 소속 팀: ${userTeams.length}개`)
    
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

  const addNewSong = async () => {
    if (!newSong.song_name.trim()) {
      alert('곡 제목을 입력하세요.')
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
        const filePath = `${USER_ID}/${safeFileName}`

        console.log('📤 파일 업로드 시작:', filePath)

        const { data: uploadData, error: uploadError } = await supabase.storage
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

        console.log('✅ 파일 업로드 성공:', uploadData)

        const { data: urlData } = supabase.storage
          .from('song-sheets')
          .getPublicUrl(filePath)

        fileUrl = urlData.publicUrl
        fileType = fileExt

        console.log('🔗 Public URL:', fileUrl)
      }

      console.log('💾 DB에 곡 정보 저장 중...')
      
      const songData = {
        song_name: newSong.song_name.trim(),
        team_name: newSong.team_name.trim() || null,
        key: newSong.key || null,
        time_signature: newSong.time_signature || null,
        tempo: newSong.tempo || null,
        bpm: newSong.bpm ? parseInt(newSong.bpm) : null,
        themes: newSong.themes.length > 0 ? newSong.themes : null, // 🆕 배열로
        season: newSong.season || null, // 🆕 추가
        youtube_url: newSong.youtube_url.trim() || null, // 🆕 추가
        lyrics: newSong.lyrics.trim() || null,
        file_url: fileUrl || null,
        file_type: fileType || null,
        uploaded_by: USER_ID, // 🆕 추가
        uploader_name: user?.name || user?.email || null, // 🆕 추가
        visibility: newSong.visibility, // 🆕 추가
        shared_with_teams: newSong.visibility === 'teams' ? newSong.shared_with_teams : null, // 🆕 추가
        is_user_uploaded: true, // 🆕 추가
        created_at: new Date().toISOString()
      }

      console.log('📝 저장할 데이터:', songData)

      const { data: insertedSong, error: songError } = await supabase
        .from('songs')
        .insert(songData)
        .select()
        .single()

      if (songError) {
        console.error('❌ DB 저장 오류:', songError)
        throw songError
      }

      console.log('✅ 곡 추가 완료:', insertedSong)

      alert('✅ 곡이 추가되었습니다!')
      
      // 🆕 초기화 로직 수정
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
      
      fetchSongs()

    } catch (error: any) {
      console.error('❌ 곡 추가 오류:', error)
      alert(`❌ 곡 추가에 실패했습니다.\n\n오류: ${error.message}\n\n브라우저 콘솔(F12)을 확인하세요.`)
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
      const searchLower = filters.searchText.toLowerCase()
      result = result.filter(song =>
        song.song_name.toLowerCase().includes(filters.searchText.toLowerCase()) ||
        song.team_name?.toLowerCase().includes(filters.searchText.toLowerCase())
      )
    }

    // 절기 필터
    if (filters.season && filters.season !== '전체') {
      result = result.filter(song => song.season === filters.season)
    }

    // 테마 필터 (다중 선택)
    if (filters.themes.length > 0) {
      result = result.filter(song => {
        // themes 배열이 있으면 사용, 없으면 theme1, theme2 체크
        if (song.themes && Array.isArray(song.themes)) {
          return filters.themes.some(theme => song.themes?.includes(theme))
        } else {
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

    if (filters.key) {
      result = result.filter(song => song.key === filters.key)
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
  }, [songs, filters, user])

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

  // ===== 송폼 관련 함수들 =====
  const openFormModal = (song: Song) => {
    setCurrentFormSong(song)
    const existingForm = songForms[song.id] || []
    setTempSelectedForm(existingForm)
    setShowFormModal(true)
  }

  const addSection = (section: string) => {
    const abbr = SECTION_ABBREVIATIONS[section] || section
    setTempSelectedForm(prev => [...prev, abbr])
  }

  const addCustomSection = () => {
    if (customSection.trim()) {
      setTempSelectedForm(prev => [...prev, customSection.trim()])
      setCustomSection('')
    }
  }

  const removeSection = (index: number) => {
    setTempSelectedForm(prev => prev.filter((_, i) => i !== index))
  }

  const moveSectionUp = (index: number) => {
    if (index === 0) return
    const newForm = [...tempSelectedForm]
    ;[newForm[index - 1], newForm[index]] = [newForm[index], newForm[index - 1]]
    setTempSelectedForm(newForm)
  }

  const moveSectionDown = (index: number) => {
    if (index === tempSelectedForm.length - 1) return
    const newForm = [...tempSelectedForm]
    ;[newForm[index], newForm[index + 1]] = [newForm[index + 1], newForm[index]]
    setTempSelectedForm(newForm)
  }

  const saveSongForm = () => {
    if (!currentFormSong) return
    setSongForms(prev => ({
      ...prev,
      [currentFormSong.id]: tempSelectedForm
    }))
    setShowFormModal(false)
    setCurrentFormSong(null)
  }

  // PDF 생성 함수
  const generatePDF = async () => {
    if (selectedSongs.length === 0) {
      alert('찬양을 선택해주세요.')
      return
    }

    console.log('==================== PDF 생성 시작 ====================')
    console.log('선택된 곡 목록:', selectedSongs.map(s => ({ id: s.id, name: s.song_name })))
    console.log('현재 songForms 전체:', songForms)
    console.log('각 곡별 송폼:')
    selectedSongs.forEach(song => {
      console.log(`  - ${song.song_name} (${song.id}):`, songForms[song.id] || '❌ 설정 안됨')
    })
    console.log('======================================================')

    try {
      const pdfLib = await import('pdf-lib')
      const { PDFDocument, rgb } = pdfLib
      const jsPDFModule = await import('jspdf')
      const jsPDF = jsPDFModule.default
      const html2canvas = (await import('html2canvas')).default

      const mergedPdf = await PDFDocument.create()

      // fontkit 등록 (Variable Font 지원)
      const fontkit = await import('@pdf-lib/fontkit')
      mergedPdf.registerFontkit(fontkit.default)
      console.log('✅ fontkit 등록 완료')

      // 한글 폰트 로드
      console.log('📥 한글 폰트 로딩 시작...')
      let koreanFont = null
      try {
        const fontBytes = await loadKoreanFont()
        
        if (fontBytes) {
          koreanFont = await mergedPdf.embedFont(fontBytes)
          console.log('✅ 한글 폰트 임베드 성공!')
        } else {
          console.warn('⚠️ 한글 폰트를 찾을 수 없습니다. 영문 폰트를 사용합니다.')
        }
      } catch (fontError) {
        console.error('❌ 한글 폰트 로드 실패:', fontError)
        console.warn('⚠️ 영문 폰트로 대체됩니다.')
      }

      // 표지 페이지 생성
      const coverDiv = document.createElement('div')
      coverDiv.style.cssText = `
        width: 210mm;
        height: 297mm;
        padding: 60px;
        background-color: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        box-sizing: border-box;
      `

      coverDiv.innerHTML = `
        <div style="text-align: center;">
          <h1 style="font-size: 48px; font-weight: bold; color: #1a202c; margin: 40px 0 20px 0;">
            찬양 콘티
          </h1>
          <p style="font-size: 28px; color: #4a5568; margin-bottom: 60px;">
            ${new Date().toLocaleDateString('ko-KR')}
          </p>
        </div>
        
        <div style="margin-top: 80px;">
          <h2 style="font-size: 32px; font-weight: 600; color: #2d3748; margin-bottom: 30px; border-bottom: 3px solid #3b82f6; padding-bottom: 10px;">
            선택한 찬양 목록
          </h2>
          <div style="font-size: 24px; line-height: 2.5; color: #1a202c;">
            ${selectedSongs.map((song, index) => `
              <div style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                <span style="font-weight: 600; color: #3b82f6; margin-right: 15px;">
                  ${index + 1}.
                </span>
                <span style="font-weight: 500;">
                  ${song.song_name}
                </span>
                <span style="color: #718096; margin-left: 10px;">
                  (${song.key || '-'})
                </span>
              </div>
            `).join('')}
          </div>
        </div>
        
        <div style="position: absolute; bottom: 60px; left: 60px; right: 60px; text-align: center; color: #a0aec0; font-size: 18px;">
          총 ${selectedSongs.length}곡 선택됨
        </div>
      `

      coverDiv.style.position = 'fixed'
      coverDiv.style.left = '-9999px'
      document.body.appendChild(coverDiv)

      const canvas = await html2canvas(coverDiv, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true
      })

      document.body.removeChild(coverDiv)

      const coverPdf = new jsPDF('p', 'mm', 'a4')
      const imgData = canvas.toDataURL('image/png')
      coverPdf.addImage(imgData, 'PNG', 0, 0, 210, 297)

      const coverPdfBytes = coverPdf.output('arraybuffer')
      const coverDoc = await PDFDocument.load(coverPdfBytes)
      const coverPages = await mergedPdf.copyPages(coverDoc, coverDoc.getPageIndices())
      coverPages.forEach(page => mergedPdf.addPage(page))

      // 악보 추가
      const songsWithSheets = selectedSongs.filter(song => song.file_url && song.file_url.trim() !== '')

      if (songsWithSheets.length === 0) {
        alert('⚠️ 악보가 업로드된 곡이 없습니다. 표지만 다운로드됩니다.')
      }

      const A4_WIDTH = 595.28
      const A4_HEIGHT = 841.89

      for (const song of songsWithSheets) {
        try {
          const response = await fetch(song.file_url!)
          if (!response.ok) continue

          const fileType = song.file_type || 'pdf'
          const currentSongForm = songForms[song.id]
      
          console.log('========================================')
          console.log(`🎵 현재 처리 중인 곡: ${song.song_name}`)
          console.log(`📋 곡 ID: ${song.id}`)
          console.log(`📝 저장된 송폼:`, currentSongForm)
          console.log(`📄 파일 타입: ${fileType}`)
          console.log('========================================')

          // PDF 파일 처리
          if (fileType === 'pdf') {
            const arrayBuffer = await response.arrayBuffer()
            const sheetPdf = await PDFDocument.load(arrayBuffer)
            const pageCount = sheetPdf.getPageCount()

            console.log(`📑 PDF 페이지 수: ${pageCount}`)

            for (let i = 0; i < pageCount; i++) {
              const [embeddedPage] = await mergedPdf.embedPdf(sheetPdf, [i])
              const { width, height } = embeddedPage

              const scaleX = A4_WIDTH / width
              const scaleY = A4_HEIGHT / height
              const scale = Math.min(scaleX, scaleY)

              const scaledWidth = width * scale
              const scaledHeight = height * scale

              const a4Page = mergedPdf.addPage([A4_WIDTH, A4_HEIGHT])

              const x = (A4_WIDTH - scaledWidth) / 2
              const y = (A4_HEIGHT - scaledHeight) / 2

              a4Page.drawPage(embeddedPage, {
                x: x,
                y: y,
                width: scaledWidth,
                height: scaledHeight,
              })
              console.log(`✅ PDF 악보 그리기 완료 (페이지 ${i + 1})`)

              // 송폼 오버레이 (첫 페이지에만)
              if (i === 0 && currentSongForm && currentSongForm.length > 0) {
                console.log(`✅ PDF 송폼 오버레이 시작: ${song.song_name} (페이지 ${i + 1})`)
    
                // 송폼 텍스트
                const formText = currentSongForm.join(' - ')
                console.log(`   📝 송폼 텍스트: "${formText}"`)
    
                try {
                  a4Page.drawText(formText, {
                    x: 30,
                    y: A4_HEIGHT - 25,
                    size: 14,
                    color: rgb(0.23, 0.51, 0.96),
                    font: koreanFont || undefined,
                  })
                  console.log(`✅ PDF 송폼 표시 성공!`)
                } catch (textError) {
                  console.error('❌ 송폼 텍스트 렌더링 실패:', textError)
                }
              }
            }
          } 
          // 이미지 파일 처리
          else if (['jpg', 'jpeg', 'png'].includes(fileType)) {
            console.log(`🖼️ 이미지 파일 처리 중: ${song.song_name}`)
    
            const imageBytes = await response.arrayBuffer()
            let image

            if (fileType === 'png') {
              image = await mergedPdf.embedPng(imageBytes)
            } else {
              image = await mergedPdf.embedJpg(imageBytes)
            }

            const imgWidth = image.width
            const imgHeight = image.height
            const scaleX = A4_WIDTH / imgWidth
            const scaleY = A4_HEIGHT / imgHeight
            const scale = Math.min(scaleX, scaleY)

            const scaledWidth = imgWidth * scale
            const scaledHeight = imgHeight * scale

            const page = mergedPdf.addPage([A4_WIDTH, A4_HEIGHT])

            const x = (A4_WIDTH - scaledWidth) / 2
            const y = (A4_HEIGHT - scaledHeight) / 2

            // 1. 먼저 이미지 그리기
            page.drawImage(image, {
              x: x,
              y: y,
              width: scaledWidth,
              height: scaledHeight,
            })
            console.log(`✅ 이미지 그리기 완료`)

            // 2. 그 다음 송폼 오버레이
            if (currentSongForm && currentSongForm.length > 0) {
              console.log(`✅ 이미지 송폼 오버레이 시작: ${song.song_name}`)

              // 송폼 텍스트
              const formText = currentSongForm.join(' - ')
              console.log(`   📝 송폼 텍스트: "${formText}"`)
      
              try {
                page.drawText(formText, {
                  x: 30,
                  y: A4_HEIGHT - 35,
                  size: 14,
                  color: rgb(0.23, 0.51, 0.96),
                  font: koreanFont || undefined,
                })
                console.log(`✅ 이미지 송폼 표시 성공!`)
              } catch (textError) {
                console.error('❌ 송폼 텍스트 렌더링 실패:', textError)
              }
            } else {
              console.warn(`⚠️ ${song.song_name}: 송폼이 설정되지 않음`)
            }
          }
        } catch (error) {
          console.error(`${song.song_name} 처리 중 오류:`, error)
        }
      }

      // PDF 다운로드
      const pdfBytes = await mergedPdf.save()
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `찬양콘티_${new Date().toISOString().split('T')[0]}.pdf`
      link.click()
      URL.revokeObjectURL(url)

      alert(`✅ PDF가 생성되었습니다!`)
    } catch (error) {
      console.error('PDF 생성 오류:', error)
      alert('❌ PDF 생성 중 오류가 발생했습니다.')
    }
  }

  // PPT 생성 함수
  const generatePPTWithOptions = async (mode: 'form' | 'original') => {
    if (selectedSongs.length === 0) {
      alert('찬양을 선택해주세요.')
      return
    }

    try {
      const prs = new PptxGenJS()
      
      // 표지 슬라이드
      const coverSlide = prs.addSlide()
      coverSlide.background = { color: '1F2937' }
      coverSlide.addText('찬양 콘티', {
        x: 0.5,
        y: 2.0,
        w: 9,
        h: 1.5,
        fontSize: 60,
        bold: true,
        color: 'FFFFFF',
        align: 'center'
      })
      coverSlide.addText(new Date().toLocaleDateString('ko-KR'), {
        x: 0.5,
        y: 3.8,
        w: 9,
        h: 0.5,
        fontSize: 24,
        color: '9CA3AF',
        align: 'center'
      })

      // 각 곡 처리
      for (const song of selectedSongs) {
        const songForm = songForms[song.id]
        
        // 송폼 모드이고 송폼이 설정된 경우
        if (mode === 'form' && songForm && songForm.length > 0 && song.song_structure) {
          for (const abbr of songForm) {
            const fullName = Object.keys(SECTION_ABBREVIATIONS).find(
              key => SECTION_ABBREVIATIONS[key] === abbr
            )
            
            if (fullName && song.song_structure[fullName]) {
              const slide = prs.addSlide()
              slide.background = { color: 'FFFFFF' }
              
              slide.addText(abbr, {
                x: 0.5,
                y: 0.3,
                w: 9,
                h: 0.5,
                fontSize: 16,
                bold: true,
                color: '6B7280',
                align: 'left'
              })
              
              slide.addText(song.song_structure[fullName], {
                x: 1,
                y: 1.5,
                w: 8,
                h: 4,
                fontSize: 28,
                color: '111827',
                align: 'center',
                valign: 'middle'
              })
              
              slide.addText(song.song_name, {
                x: 0.5,
                y: 6.5,
                w: 9,
                h: 0.3,
                fontSize: 14,
                color: '9CA3AF',
                align: 'center'
              })
            }
          }
        } else {
          // 원본 모드 또는 송폼 미설정: 악보 이미지 사용
          if (song.file_url) {
            const slide = prs.addSlide()
            slide.addImage({
              path: song.file_url,
              x: 0,
              y: 0,
              w: '100%',
              h: '100%',
              sizing: { type: 'contain', w: '100%', h: '100%' }
            })
          }
        }
      }

      await prs.writeFile({ fileName: `찬양콘티_${new Date().toISOString().split('T')[0]}.pptx` })

      // 🆕 PPT 다운로드 로깅
      if (user) {
        await logPPTDownload(
          selectedSongs.map(s => s.id),  // 🔹 첫 번째: 곡 ID 배열
          undefined,                      // 🔹 두 번째: 콘티 ID (없으면 undefined)
          user.id,                        // 🔹 세 번째: 사용자 ID
          undefined                       // 🔹 네 번째: 팀 ID (없으면 undefined)
        ).catch(error => {
          console.error('Error logging PPT download:', error)
        })
      }

      alert('✅ PPT가 생성되었습니다!')
      setShowPPTModal(false)
      
    } catch (error) {
      console.error('PPT 생성 오류:', error)
      alert('❌ PPT 생성 중 오류가 발생했습니다.')
    }
  }

  const startPPTDownload = () => {
    const hasSongForm = selectedSongs.some(song => 
      songForms[song.id] && songForms[song.id].length > 0
    )
    
    if (hasSongForm) {
      setShowPPTModal(true)
    } else {
      generatePPTWithOptions('original')
    }
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
            <div className="flex items-center gap-2">
              <Music className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Ministry Hub</h1>
            </div>

            {/* 네비게이션 */}
            <div className="flex items-center gap-2">
              {user ? (
                <>
                  <button
                    onClick={() => router.push('/my-team')}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                  >
                    My Team
                  </button>

                  <button
                    onClick={() => router.push('/my-page')}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
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

                        {/* ✨ 여기부터 새로 추가하는 부분 ✨ */}
                        {user?.is_admin && (
                          <>
                            <div className="border-t my-1"></div>
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
                        {/* ✨ 여기까지 새로 추가하는 부분 ✨ */}
                      </div>
                    )}
                  </div>

                  <div className="w-px h-8 bg-gray-300 mx-2"></div>

                  <span className="text-sm text-gray-600 px-2">
                    {user.email}
                  </span>
                  
                  <button
                    onClick={handleSignOut}
                    className="px-3 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                  >
                    로그아웃
                  </button>
                </>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => router.push('/login')}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                  >
                    로그인
                  </button>
                  <button
                    onClick={() => router.push('/signup')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    회원가입
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

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
            <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ 
              color: '#FFFFFF',
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
              <div className="text-3xl font-bold">{songs.length}+</div>
              <div className="text-sm opacity-90">찬양곡</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4 text-center">
              <div className="text-3xl font-bold">
                {new Set(songs.map(s => s.team_name).filter(Boolean)).size}+
              </div>
              <div className="text-sm opacity-90">아티스트</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4 text-center">
              <div className="text-3xl font-bold">{selectedSongs.length}</div>
              <div className="text-sm opacity-90">선택한 곡</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4 text-center">
              <div className="text-3xl font-bold">
                12
              </div>
              <div className="text-sm opacity-90">Key</div>
            </div>
          </div>
        </div>
      </div>

      {/* 선택된 곡 상단바 */}
      {selectedSongs.length > 0 && (
        <div className="bg-white border-b sticky top-0 z-40 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">
                  {selectedSongs.length}곡 선택됨
                </span>
                <div className="flex gap-2">
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

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (!user) {
                      alert('콘티 저장은 로그인 후 이용 가능합니다.')
                      router.push('/login')
                      return
                    }
                    setShowSaveModal(true)
                  }}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm flex items-center"
                >
                  <FolderOpen className="mr-2" size={16} />
                  콘티 저장
                </button>
                <button
                  onClick={generatePDF}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm flex items-center"
                >
                  <FileText className="mr-2" size={16} />
                  PDF
                </button>
                <button
                  onClick={startPPTDownload}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm flex items-center"
                >
                  <Presentation className="mr-2" size={16} />
                  PPT
                </button>
                <button
                  onClick={() => setSelectedSongs([])}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                >
                  초기화
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* 왼쪽: 필터 패널 */}
          <div className={`${showFilterPanel ? 'w-80' : 'w-0'} transition-all duration-300 overflow-hidden`}>
            {showFilterPanel && (
              <div className="bg-white rounded-lg shadow-md p-6 sticky top-20">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg">필터</h3>
                  <button
                    onClick={() => setFilters({
                      season: '전체',
                      themes: [],
                      theme: '',
                      key: '',
                      timeSignature: '',
                      tempo: '',
                      searchText: '',
                      bpmMin: '',    // 👈 추가
                      bpmMax: ''     // 👈 추가
                    })}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    초기화
                  </button>
                </div>

                {/* 절기 필터 */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="inline w-4 h-4 mr-1" />
                    절기
                  </label>
                  <select
                    value={filters.season}
                    onChange={(e) => setFilters({ ...filters, season: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {SEASONS.map(season => (
                      <option key={season} value={season}>{season}</option>
                    ))}
                  </select>
                </div>

                {/* 테마 필터 (다중 선택) */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Tag className="inline w-4 h-4 mr-1" />
                    테마 (다중 선택)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {themes.map(theme => (
                      <button
                        key={theme}
                        onClick={() => toggleThemeFilter(theme)}
                        className={`px-3 py-1 rounded-full text-sm transition ${
                          filters.themes.includes(theme)
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                      >
                        {theme}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Key 필터 */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Music className="inline w-4 h-4 mr-1" />
                    Key
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {keys.map(key => (
                      <button
                        key={key}
                        onClick={() => setFilters({ 
                          ...filters, 
                          key: filters.key === key ? '' : key 
                        })}
                        className={`px-3 py-2 rounded text-sm font-medium transition ${
                          filters.key === key
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 박자 필터 */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Clock className="inline w-4 h-4 mr-1" />
                    박자
                  </label>
                  <select
                    value={filters.timeSignature}
                    onChange={(e) => setFilters({ ...filters, timeSignature: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">전체</option>
                    {timeSignatures.map(ts => (
                      <option key={ts} value={ts}>{ts}</option>
                    ))}
                  </select>
                </div>

                {/* 템포 필터 */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Activity className="inline w-4 h-4 mr-1" />
                    템포
                  </label>
                  <div className="flex gap-2">
                    {tempos.map(tempo => (
                      <button
                        key={tempo}
                        onClick={() => setFilters({ 
                          ...filters, 
                          tempo: filters.tempo === tempo ? '' : tempo 
                        })}
                        className={`flex-1 px-3 py-2 rounded text-sm transition ${
                          filters.tempo === tempo
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                      >
                        {tempo}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 👇 BPM 범위 필터 추가 */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Activity className="inline w-4 h-4 mr-1" />
                    BPM 범위
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="최소"
                      value={filters.bpmMin}
                      onChange={(e) => setFilters({ ...filters, bpmMin: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="0"
                    />
                    <span className="text-gray-500">~</span>
                    <input
                      type="number"
                      placeholder="최대"
                      value={filters.bpmMax}
                      onChange={(e) => setFilters({ ...filters, bpmMax: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="0"
                    />
                  </div>
                  {/* 빠른 선택 버튼 (선택사항) */}
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => setFilters({ ...filters, bpmMin: '', bpmMax: '80' })}
                      className="w-full px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                    >
                      느림 (~80)
                    </button>
                    <button
                      onClick={() => setFilters({ ...filters, bpmMin: '80', bpmMax: '120' })}
                      className="w-full px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                    >
                      보통 (80-120)
                    </button>
                    <button
                      onClick={() => setFilters({ ...filters, bpmMin: '120', bpmMax: '' })}
                      className="w-full px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                    >
                      빠름 (120~)
                    </button>
                  </div>
                  {/* 초기화 버튼 */}
                  {(filters.bpmMin || filters.bpmMax) && (
                    <button
                      onClick={() => setFilters({ ...filters, bpmMin: '', bpmMax: '' })}
                      className="w-full mt-2 px-3 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                    >
                      BPM 필터 초기화
                    </button>
                  )}
                </div>
              </div>
            )}
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
                    {filteredSongs.length}개의 찬양
                  </span>
                </div>

                <div className="flex items-center gap-2">
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
  <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {filteredSongs.map((song, index) => (
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
          <h3 className="font-bold text-gray-900 flex-1">{song.song_name}</h3>
          <div className="flex gap-1 ml-2">
            {/* 악보 미리보기 버튼 - 모달로 열기 */}
            {song.file_url && (
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
                  {filteredSongs.map((song, index) => (
                    <div
                      key={song.id}
                      tabIndex={0}
                      onClick={() => {
                        toggleSongSelection(song)
                        setFocusedSongIndex(index)
                      }}
                      onFocus={() => setFocusedSongIndex(index)}
                      className={`p-4 cursor-pointer transition-all ${
                        selectedSongs.find(s => s.id === song.id)
                          ? 'bg-blue-50'
                          : focusedSongIndex === index
                          ? 'bg-gray-50'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={!!selectedSongs.find(s => s.id === song.id)}
                              onChange={() => {}}
                              className="mr-3"
                            />
                            <h3 className="font-semibold text-gray-900">{song.song_name}</h3>
                            {songForms[song.id] && songForms[song.id].length > 0 && (
                              <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">
                                송폼: {songForms[song.id].join('-')}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1 ml-7">
                            {song.team_name && `${song.team_name} | `}
                            Key: {song.key || '-'} | 
                            박자: {song.time_signature || '-'} | 
                            템포: {song.tempo || '-'}
                            {song.bpm && ` (${song.bpm}BPM)`}
                          </p>

                          {/* 🆕 유튜브 영상 (토글 시 표시) */}
{youtubeStates[song.id] && song.youtube_url && (
  <div className="mt-3 ml-7 mb-3">
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

{/* 🆕 상세 정보 (토글 시 표시) */}
{previewStates[song.id] && (
  <div className="mt-3 ml-7 border-t pt-3">
    {song.lyrics && (
      <div className="mb-3">
        <h4 className="font-semibold text-gray-700 mb-2 text-sm">가사</h4>
        <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans bg-gray-50 p-3 rounded">
          {song.lyrics}
        </pre>
      </div>
    )}
    {song.file_url && (
      <div>
        <h4 className="font-semibold text-gray-700 mb-2 text-sm">악보</h4>
        {song.file_type === 'pdf' ? (
          <iframe
            src={song.file_url}
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

<div className="flex flex-wrap gap-1 mt-2 ml-7">
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
                          <div className="flex flex-wrap gap-1 mt-2 ml-7">
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
                        <div className="flex gap-2 ml-4">
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
  {/* 유튜브 영상 토글 버튼 - 항상 표시 */}
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
        : '#4b5563',
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
  {selectedSongs.find(s => s.id === song.id) && (
    <button
      onClick={(e) => {
        e.stopPropagation()
        openFormModal(song)
      }}
      className="px-3 py-1 bg-purple-500 text-white text-sm rounded hover:bg-purple-600"
    >
      송폼 설정
    </button>
  )}
</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
      <div className="fixed bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 text-xs text-gray-600">
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
                  onChange={(e) => setNewSong({ ...newSong, song_name: e.target.value })}
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
                  value={newSong.team_name}
                  onChange={(e) => setNewSong({ ...newSong, team_name: e.target.value })}
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
                  <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="visibility"
                      value="public"
                      checked={newSong.visibility === 'public'}
                      onChange={(e) => setNewSong({ ...newSong, visibility: 'public', shared_with_teams: [] })}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium">전체 공개</div>
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
                      <div className="font-medium">팀 공개</div>
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
                      <div className="font-medium">비공개</div>
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
                  <select
                    value={newSong.key}
                    onChange={(e) => setNewSong({ ...newSong, key: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">선택</option>
                    {keys.map(key => (
                      <option key={key} value={key}>{key}</option>
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
                    onChange={(e) => setNewSong({ ...newSong, tempo: e.target.value })}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">BPM</label>
                  <input
                    type="number"
                    value={newSong.bpm}
                    onChange={(e) => setNewSong({ ...newSong, bpm: e.target.value })}
                    placeholder="예: 120"
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
                  {THEMES.map(theme => (
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
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      {theme}
                    </button>
                  ))}
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
                }}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                disabled={uploading}
              >
                취소
              </button>
              <button
                onClick={addNewSong}
                disabled={uploading || !newSong.song_name.trim()}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
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
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

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
      {showFormModal && currentFormSong && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-2xl font-bold mb-4">
              {currentFormSong.song_name} - 송폼 설정
            </h3>

            <div className="grid grid-cols-2 gap-6">
              {/* 왼쪽: 사용 가능한 섹션 */}
              <div>
                <h4 className="font-bold mb-3 text-lg">사용 가능한 섹션</h4>
                <div className="space-y-2 mb-4 max-h-[400px] overflow-y-auto">
                  {availableSections.map(section => {
                    const abbr = SECTION_ABBREVIATIONS[section]
                    return (
                      <button
                        key={section}
                        onClick={() => addSection(section)}
                        className="w-full px-4 py-3 rounded text-left bg-blue-50 hover:bg-blue-100 text-blue-900 font-medium flex justify-between items-center"
                      >
                        <span>{section}</span>
                        <span className="text-sm bg-blue-200 px-2 py-1 rounded">{abbr}</span>
                      </button>
                    )
                  })}
                </div>
                
                {/* 직접 입력 */}
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h5 className="font-bold mb-2">직접 입력</h5>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customSection}
                      onChange={(e) => setCustomSection(e.target.value)}
                      placeholder="예: 기도회, 멘트"
                      className="flex-1 px-3 py-2 border rounded"
                      onKeyPress={(e) => e.key === 'Enter' && addCustomSection()}
                    />
                    <button
                      onClick={addCustomSection}
                      className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                    >
                      추가
                    </button>
                  </div>
                </div>
              </div>

              {/* 오른쪽: 선택된 순서 */}
              <div>
                <h4 className="font-bold mb-3 text-lg">선택된 순서</h4>
                <div className="border-2 border-dashed rounded-lg p-4 min-h-[500px] bg-gray-50">
                  {tempSelectedForm.length === 0 ? (
                    <p className="text-gray-400 text-center mt-20">
                      왼쪽에서 섹션을 선택하세요
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {tempSelectedForm.map((abbr, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 bg-white border-2 border-green-200 px-3 py-3 rounded-lg"
                        >
                          <span className="font-bold text-green-900 flex-1 text-lg">
                            {index + 1}. {abbr}
                          </span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => moveSectionUp(index)}
                              disabled={index === 0}
                              className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => moveSectionDown(index)}
                              disabled={index === tempSelectedForm.length - 1}
                              className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                            >
                              ↓
                            </button>
                            <button
                              onClick={() => removeSection(index)}
                              className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {tempSelectedForm.length > 0 && (
                  <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
                    <p className="text-sm font-bold text-blue-900 mb-1">미리보기:</p>
                    <p className="text-blue-800 font-mono">
                      {tempSelectedForm.join(' - ')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 버튼 */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowFormModal(false)
                  setCurrentFormSong(null)
                }}
                className="px-6 py-2 bg-gray-300 rounded-lg hover:bg-gray-400 font-medium"
              >
                취소
              </button>
              <button
                onClick={saveSongForm}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  )
}
