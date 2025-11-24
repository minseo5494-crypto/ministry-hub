'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase, Song, SECTION_ABBREVIATIONS } from '@/lib/supabase'
import { getCurrentUser, signOut } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { parseLyrics } from '@/lib/lyricParser'
import {
  Search, Music, FileText, Presentation, FolderOpen, Plus, X,
  ChevronLeft, ChevronRight, Eye, EyeOff, Upload, Users, UserPlus, MoreVertical,
  Grid, List, Filter, Tag, Calendar, Clock, Activity, ChevronDown, BarChart3, Youtube, Trash2
} from 'lucide-react'
import Link from 'next/link'
import { loadKoreanFont } from '@/lib/fontLoader'
// 🆕 로깅 함수 import
import { logSongSearch, logPPTDownload, logSongView, logPDFDownload } from '@/lib/activityLogger'
// 🆕 추가
import SongFormPositionModal from '@/components/SongFormPositionModal'
import { generatePDF as generatePDFFile, PDFSong, SongFormPosition } from '@/lib/pdfGenerator'

// 🆕 TypeScript를 위한 전역 선언 (import 아래에 추가)
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

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

  // PDF/PPT 다운로드 로딩 상태
  const [downloadingPDF, setDownloadingPDF] = useState(false)
  const [downloadingPPT, setDownloadingPPT] = useState(false)

  // 🆕 파일 형식 선택 모달 상태
  const [showFormatModal, setShowFormatModal] = useState(false)

  // 🆕 추가
  const [showPositionModal, setShowPositionModal] = useState(false)
  const [songFormPositions, setSongFormPositions] = useState<{ [key: string]: SongFormPosition }>({})

  // 사용 가능한 송폼 섹션
  const availableSections = [
    'Intro', 'Verse1', 'Verse2', 'Verse3', 'Verse4',
    'PreChorus', 'PreChorus1', 'PreChorus2',
    'Chorus', 'Chorus1', 'Chorus2',
    'Interlude', 'Bridge', 'Outro'
  ]
  
  
  // 악보 미리보기 상태
  const [previewSong, setPreviewSong] = useState<Song | null>(null)

  // 🆕🆕🆕 악보보기 모드 전용 상태 추가
  const [showSheetViewer, setShowSheetViewer] = useState(false)
  const [currentSheetSong, setCurrentSheetSong] = useState<Song | null>(null)
  const [currentPDFPage, setCurrentPDFPage] = useState(1)
  const [totalPDFPages, setTotalPDFPages] = useState(0)
  const [pdfDoc, setPdfDoc] = useState<any>(null)
  const [isLoadingPDF, setIsLoadingPDF] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
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
  themes: [] as string[],
  season: '',
  youtube_url: '',
  lyrics: '',
  visibility: 'teams' as 'public' | 'teams' | 'private',
  shared_with_teams: [] as string[]
})

  // 🆕 사용자의 팀 목록 상태 추가
  const [uploadingFile, setUploadingFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [userTeams, setUserTeams] = useState<any[]>([])
  const [teamNameSuggestions, setTeamNameSuggestions] = useState<string[]>([])
  const [showTeamSuggestions, setShowTeamSuggestions] = useState(false)

  // ✅ 팀명 자동완성 검색
const searchTeamNames = async (query: string) => {
  if (!query.trim()) {
    setTeamNameSuggestions([])
    setShowTeamSuggestions(false)
    return
  }

  try {
    const { data, error } = await supabase
      .from('songs')
      .select('team_name')
      .ilike('team_name', `%${query}%`)
      .not('team_name', 'is', null)
      .limit(50)

    if (error) throw error

    // 중복 제거 및 정렬
    const uniqueTeams = [...new Set(data?.map(d => d.team_name).filter(Boolean))] as string[]
    setTeamNameSuggestions(uniqueTeams.slice(0, 10))
    setShowTeamSuggestions(uniqueTeams.length > 0)
  } catch (error) {
    console.error('Error searching team names:', error)
  }
}
  
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
  const tempos = ['느림', '보통', '빠름']
  const themes = THEMES  // 새로운 테마 배열 사용

  // 사용자 정보 확인
  useEffect(() => {
    checkUser()
  }, [])

  // 🆕 PDF.js 초기화
  useEffect(() => {
    if (typeof window !== 'undefined' && window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      console.log('✅ PDF.js 초기화 완료');
    }
  }, [])

  // 🆕 PDF 문서 로드
  useEffect(() => {
    if (!showSheetViewer || !currentSheetSong?.file_url) return;
    if (currentSheetSong.file_type !== 'pdf') {
      setPdfDoc(null);
      setTotalPDFPages(0);
      return;
    }

    const loadPDF = async () => {
      setIsLoadingPDF(true);
      console.log('📄 PDF 로딩 시작:', currentSheetSong.file_url);
      
      try {
        if (!window.pdfjsLib) {
          console.error('PDF.js가 로드되지 않았습니다');
          return;
        }
        
        const loadingTask = window.pdfjsLib.getDocument(currentSheetSong.file_url);
        const pdf = await loadingTask.promise;
        
        setPdfDoc(pdf);
        setTotalPDFPages(pdf.numPages);
        setCurrentPDFPage(1);
        
        console.log(`✅ PDF 로드 완료: ${pdf.numPages} 페이지`);
      } catch (error) {
        console.error('❌ PDF 로드 실패:', error);
        alert('PDF 파일을 불러올 수 없습니다.');
      } finally {
        setIsLoadingPDF(false);
      }
    };

    loadPDF();
  }, [showSheetViewer, currentSheetSong]);

  // 🆕 PDF 페이지 렌더링
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    const renderPage = async () => {
      console.log(`📄 페이지 ${currentPDFPage} 렌더링 시작`);
      
      try {
        const page = await pdfDoc.getPage(currentPDFPage);
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;
        
        // 세로 기준으로 화면의 85%에 맞춤!
        const viewport = page.getViewport({ scale: 1 });
        const scale = (window.innerHeight * 0.85) / viewport.height;
        const scaledViewport = page.getViewport({ scale });

        // Canvas 크기 설정
        canvas.height = scaledViewport.height;
        canvas.width = scaledViewport.width;

        // 렌더링
        const renderContext = {
          canvasContext: context,
          viewport: scaledViewport
        };

        await page.render(renderContext).promise;
        console.log('✅ 페이지 렌더링 완료');
      } catch (error) {
        console.error('❌ 페이지 렌더링 실패:', error);
      }
    };

    renderPage();
  }, [pdfDoc, currentPDFPage]);

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

  // 🆕 악보보기 모드 열기
  const openSheetViewerForSong = (song: Song) => {
    console.log('🎵 악보보기 모드 열기:', song.song_name);

    // 📊 곡 조회 로깅 추가
  if (user) {
    logSongView(song.id, user.id).catch(err => console.error('로깅 실패:', err));
  }
    setCurrentSheetSong(song);
    setCurrentPDFPage(1);
    setPdfDoc(null);
    setShowSheetViewer(true);
  }

  // 🆕 악보보기 모드 닫기
  const closeSheetViewer = () => {
    setShowSheetViewer(false);
    setCurrentSheetSong(null);
    setPdfDoc(null);
    setCurrentPDFPage(1);
    setTotalPDFPages(0);
  }

  // 🆕 다음/이전 곡으로 이동
  const goToAdjacentSong = (direction: 'prev' | 'next') => {
    if (!currentSheetSong) return;
    
    const currentIndex = filteredSongs.findIndex(s => s.id === currentSheetSong.id);
    let targetIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    
    // 악보가 있는 곡 찾기
    while (targetIndex >= 0 && targetIndex < filteredSongs.length) {
      if (filteredSongs[targetIndex].file_url) {
        setCurrentSheetSong(filteredSongs[targetIndex]);
        setCurrentPDFPage(1);
        setPdfDoc(null);
        console.log(`🎵 ${direction === 'prev' ? '이전' : '다음'} 곡으로 이동:`, 
                    filteredSongs[targetIndex].song_name);
        break;
      }
      targetIndex = direction === 'prev' ? targetIndex - 1 : targetIndex + 1;
    }
  }

  // 🆕 악보보기 모드 키보드 단축키
  useEffect(() => {
    if (!showSheetViewer) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeSheetViewer();
      } else if (e.key === 'ArrowLeft') {
        if (currentSheetSong?.file_type === 'pdf' && currentPDFPage > 1) {
          setCurrentPDFPage(p => p - 1);
        } else {
          goToAdjacentSong('prev');
        }
      } else if (e.key === 'ArrowRight') {
        if (currentSheetSong?.file_type === 'pdf' && currentPDFPage < totalPDFPages) {
          setCurrentPDFPage(p => p + 1);
        } else {
          goToAdjacentSong('next');
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showSheetViewer, currentSheetSong, currentPDFPage, totalPDFPages]);

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

  // 팀 공유 시 팀 선택 확인
  if (newSong.visibility === 'teams' && newSong.shared_with_teams.length === 0) {
    alert('공유할 팀을 최소 1개 선택해주세요')
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

    // ✨ 핵심 변경: visibility에 따라 다른 테이블에 저장
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
          is_user_uploaded: true
        })

      if (insertError) throw insertError

      alert('✅ 곡이 추가되었습니다!')
    }

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

  // 🆕 다운로드 버튼 클릭 시 (파일 형식 선택 모달 열기)
const handleDownload = () => {
  if (selectedSongs.length === 0) {
    alert('찬양을 선택해주세요.')
    return
  }
  
  // 파일 형식 선택 모달 열기
  setShowFormatModal(true)
}

// 🆕 선택한 형식에 따라 다운로드 시작
const startDownloadWithFormat = (format: 'pdf' | 'image') => {
  setShowFormatModal(false)
  
  if (format === 'pdf') {
    // PDF 다운로드 로직
    const songsWithForms = selectedSongs.filter(song => {
      const forms = songForms[song.id] || []
      return forms.length > 0
    })
    
    if (songsWithForms.length > 0) {
      setShowPositionModal(true)
    } else {
      generatePDF({})
    }
  } else {
    // 사진파일 다운로드
    downloadAsImageFiles()
  }
}

// 🆕 위치 확정 후 PDF 생성 (모달에서 "확정" 버튼 클릭 시 호출됨)
const generatePDF = async (positions: { [key: string]: SongFormPosition }) => {
  setDownloadingPDF(true)
  setShowPositionModal(false)  // 모달 닫기

  try {
    // PDFSong 형식으로 변환
    const pdfSongs: PDFSong[] = selectedSongs.map(song => ({
      id: song.id,
      song_name: song.song_name,
      team_name: song.team_name,
      key: song.key,
      file_url: song.file_url,
      file_type: song.file_type,
      lyrics: song.lyrics,
      selectedForm: songForms[song.id] || [],
    }))

    // generatePDFFile 함수 호출
    await generatePDFFile({
      title: '찬양 콘티',
      date: new Date().toLocaleDateString('ko-KR'),
      songs: pdfSongs,
      songForms: songForms,
      songFormPositions: positions  // 🆕 위치 정보 추가
    })

    // 📊 PDF 다운로드 로깅 추가
if (user) {
  const songIds = selectedSongs.map(s => s.id);
  await logPDFDownload(songIds, undefined, user.id).catch(err => 
    console.error('PDF 로깅 실패:', err)
  );
}

    alert('✅ PDF가 생성되었습니다!')
  } catch (error) {
    console.error('PDF 생성 오류:', error)
    alert('❌ PDF 생성 중 오류가 발생했습니다.')
  } finally {
    setDownloadingPDF(false)
  }
}

// 🆕 사진파일로 다운로드 (각 곡을 개별 파일로)
const downloadAsImageFiles = async () => {
  setDownloadingPDF(true)
  
  try {
    let downloadCount = 0
    
    console.log(`✅ 총 ${selectedSongs.length}개 곡 다운로드 시작`)
    
    for (let i = 0; i < selectedSongs.length; i++) {
      const song = selectedSongs[i]
      
      if (!song.file_url) {
        console.warn(`⚠️ ${song.song_name}: 파일이 없어서 건너뜁니다`)
        continue
      }
      
      console.log(`\n📥 처리 중 (${i + 1}/${selectedSongs.length}): ${song.song_name}`)
      
      try {
        if (song.file_type === 'pdf') {
          // PDF → JPG 변환
          await downloadPdfAsJpg(song, i)
        } else {
          // JPG/PNG → 원본 형식 유지
          await downloadImageWithForm(song, i)
        }
        downloadCount++
      } catch (error) {
        console.error(`❌ ${song.song_name} 다운로드 실패:`, error)
        alert(`⚠️ ${song.song_name} 다운로드 중 오류가 발생했습니다.\n계속 진행합니다.`)
      }
      
      // 다음 파일 다운로드 전 0.5초 대기
      if (i < selectedSongs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
    
    alert(`✅ 총 ${downloadCount}개 곡이 다운로드되었습니다!\n\n※ 브라우저에서 여러 파일 다운로드를 차단한 경우\n설정에서 허용해주세요.`)
  } catch (error) {
    console.error('다운로드 오류:', error)
    alert('❌ 다운로드 중 오류가 발생했습니다.')
  } finally {
    setDownloadingPDF(false)
  }
}

// 🆕 이미지 파일에 송폼 추가해서 다운로드
const downloadImageWithForm = async (song: Song, index: number) => {
  return new Promise<void>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    
    img.onload = () => {
      try {
        // Canvas 생성
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas context를 가져올 수 없습니다'))
          return
        }
        
        // 1. 원본 이미지 그리기
        ctx.drawImage(img, 0, 0)
        
        // 2. 송폼 오버레이
        const selectedForms = songForms[song.id] || []
        if (selectedForms.length > 0) {
          const formText = selectedForms.join(' - ')
          
          // 폰트 크기 설정 (이미지 크기에 비례)
          const fontSize = Math.max(24, Math.floor(canvas.height / 30))
          ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
          
          const textWidth = ctx.measureText(formText).width
          const padding = fontSize * 0.6
          
          // 우측 상단 위치
          const x = canvas.width - textWidth - padding * 2 - 30
          const y = 50
          
          // 배경 박스
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
          ctx.fillRect(
            x - padding,
            y - fontSize - padding / 2,
            textWidth + padding * 2,
            fontSize + padding
          )
          
          // 텍스트
          ctx.fillStyle = 'rgb(102, 51, 204)'
          ctx.fillText(formText, x, y - padding / 2)
          
          console.log(`✅ 송폼 추가: ${formText}`)
        }
        
        // 3. 원본 형식으로 다운로드
        const mimeType = song.file_type === 'png' ? 'image/png' : 'image/jpeg'
        const extension = song.file_type === 'png' ? 'png' : 'jpg'
        
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Blob 생성 실패'))
            return
          }
          
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = `${index + 1}_${sanitizeFilename(song.song_name)}.${extension}`
          link.click()
          URL.revokeObjectURL(url)
          
          console.log(`✅ 다운로드 완료: ${link.download}`)
          resolve()
        }, mimeType, 0.95)
      } catch (error) {
        reject(error)
      }
    }
    
    img.onerror = () => {
      reject(new Error(`이미지 로드 실패: ${song.file_url}`))
    }
    
    img.src = song.file_url
  })
}

// 🆕 PDF를 JPG로 변환해서 다운로드
const downloadPdfAsJpg = async (song: Song, index: number) => {
  if (!window.pdfjsLib) {
    throw new Error('PDF.js가 로드되지 않았습니다')
  }
  
  try {
    // PDF 로드
    const loadingTask = window.pdfjsLib.getDocument(song.file_url)
    const pdf = await loadingTask.promise
    const pageCount = pdf.numPages
    
    console.log(`📄 PDF 페이지 수: ${pageCount}`)
    
    // 각 페이지를 JPG로 변환
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await pdf.getPage(pageNum)
      
      // Canvas에 렌더링
      const viewport = page.getViewport({ scale: 2.0 }) // 고화질을 위해 scale 2.0
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      
      if (!context) continue
      
      canvas.height = viewport.height
      canvas.width = viewport.width
      
      // PDF 페이지 렌더링
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise
      
      // 송폼 오버레이 (첫 페이지에만)
      if (pageNum === 1) {
        const selectedForms = songForms[song.id] || []
        if (selectedForms.length > 0) {
          const formText = selectedForms.join(' - ')
          
          const fontSize = Math.max(32, Math.floor(canvas.height / 30))
          context.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
          
          const textWidth = context.measureText(formText).width
          const padding = fontSize * 0.6
          
          const x = canvas.width - textWidth - padding * 2 - 30
          const y = 50
          
          // 배경 박스
          context.fillStyle = 'rgba(255, 255, 255, 0.95)'
          context.fillRect(
            x - padding,
            y - fontSize - padding / 2,
            textWidth + padding * 2,
            fontSize + padding
          )
          
          // 텍스트
          context.fillStyle = 'rgb(102, 51, 204)'
          context.fillText(formText, x, y - padding / 2)
          
          console.log(`✅ PDF 첫 페이지에 송폼 추가: ${formText}`)
        }
      }
      
      // JPG로 다운로드
      await new Promise<void>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Blob 생성 실패'))
            return
          }
          
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          
          // 파일명: 페이지가 여러 개면 _page1, _page2 추가
          const filename = pageCount > 1
            ? `${index + 1}_${sanitizeFilename(song.song_name)}_page${pageNum}.jpg`
            : `${index + 1}_${sanitizeFilename(song.song_name)}.jpg`
          
          link.download = filename
          link.click()
          URL.revokeObjectURL(url)
          
          console.log(`✅ PDF > JPG 다운로드 완료: ${filename}`)
          resolve()
        }, 'image/jpeg', 0.95)
      })
      
      // 페이지가 여러 개면 0.3초 간격으로 다운로드
      if (pageNum < pageCount) {
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    }
  } catch (error) {
    console.error('PDF 변환 오류:', error)
    throw error
  }
}

// 🆕 파일명에서 사용 불가능한 문자 제거
const sanitizeFilename = (filename: string): string => {
  return filename.replace(/[\\/:*?"<>|]/g, '_')
}

  // PPT 생성 함수
  const generatePPTWithOptions = async (mode: 'form' | 'original') => {
    if (selectedSongs.length === 0) {
      alert('찬양을 선택해주세요.')
      return
    }

    setDownloadingPPT(true)  // 👈 로딩 시작

    try {
      // 🆕 동적 import
    const PptxGenJS = (await import('pptxgenjs')).default
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
    } finally {
      setDownloadingPPT(false)  // 👈 로딩 종료
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
               {/* 새로운 스트리밍 허브 버튼 추가 */}
  <button
    onClick={() => router.push('/streaming')}
    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:opacity-90 transition-opacity"
  >
    <Music size={18} />
    <span className="text-sm font-medium">PraiseHub</span>
  </button>
  
  {/* 기존 버튼들은 그대로 유지 */}
  <Link href="/setlists">
  </Link>
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
    {/* 🆕 곡 승인 관리 버튼 */}
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
    {/* 🆕 사용자 곡 관리 버튼 (새로 추가!) */}
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
    {/* 팀 승인 관리 버튼 */}
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
    {/* 통계 대시보드 버튼 */}
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
                    className="px-3 py-2 text-sm bg-[#E26559] text-white rounded-lg hover:bg-[#D14E42] transition"
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
                    className="px-4 py-2 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8] transition"
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
                  className="px-4 py-2 bg-[#84B9C0] text-white rounded-lg hover:bg-[#6FA5AC] text-sm flex items-center"
                >
                  <FolderOpen className="mr-2" size={16} />
                  콘티 저장
                </button>
                <button
                  onClick={handleDownload}  // 🆕 함수명 변경
                  disabled={downloadingPDF}
                  className={`px-4 py-2 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8] text-sm flex items-center ${downloadingPDF ? 'opacity-75 cursor-not-allowed' : ''}`}
                >
                  {downloadingPDF ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      PDF 생성 중...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2" size={16} />
                      다운로드
                    </>
                  )}
                </button>
                <button
                  onClick={startPPTDownload}
                  disabled={downloadingPPT}
                  className={`px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm flex items-center ${downloadingPPT ? 'opacity-75 cursor-not-allowed' : ''}`}
                >
                    {downloadingPPT ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      PPT 생성 중...
                    </>
                  ) : (
                    <>
                      <Presentation className="mr-2" size={16} />
                      PPT
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setSelectedSongs([])
                    setSongForms({})
                  }}
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
                      isMinor: false,  // ← 추가!
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
                            ? 'bg-[#C5D7F2] text-white'
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
                            ? 'bg-[#C5D7F2] text-white'
                            : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                      >
                        {key}
                      </button>
                    ))}
                  </div>

                  {/* Minor 버튼 추가 */}
<button
  onClick={() => setFilters({ ...filters, isMinor: !filters.isMinor })}
  className={`w-full mt-3 px-4 py-2 rounded-lg text-sm font-medium transition ${
    filters.isMinor
      ? 'bg-[#C4BEE2] text-white'
      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
  }`}
>
  minor
</button>
</div>  {/* Key 필터 div 닫기 */}

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
            ? 'bg-[#C5D7F2] text-white'
            : 'bg-gray-100 hover:bg-gray-200'
        }`}
      >
        {tempo}
      </button>
    ))}
  </div>
</div>

{/* BPM 범위 필터 */}
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
  {/* 빠른 선택 버튼 */}
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
</div>  {/* 필터 패널 전체 div 닫기 */}

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
                            템포: {song.bpm ? `${song.bpm}BPM` : (song.tempo || '-')}
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

{/* 🆕🆕🆕 여기에 악보보기 버튼 추가! */}
  {song.file_url && (
    <button
      onClick={(e) => {
        e.stopPropagation()
        openSheetViewerForSong(song)  // 새로운 함수 호출!
      }}
      className="p-2 text-purple-600 hover:bg-purple-100 rounded-lg"
      title="악보 전체화면"
    >
      <Presentation size={18} />
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
      className="px-3 py-1 bg-[#C4BEE2] text-white text-sm rounded hover:bg-[#C4BEE2]"
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

              <div className="relative">
<label className="block text-sm font-medium text-gray-700 mb-1">
팀명 / 아티스트
</label>
<input
type="text"
value={newSong.team_name}
onChange={(e) => {
  setNewSong({ ...newSong, team_name: e.target.value })
  searchTeamNames(e.target.value)
}}
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
                        alert('⚠️ 전체 공개로 선택하시면 관리자 승인 후 공개됩니다.\n\n바로 사용하시려면 "팀 공유" 또는 "나만 보기"를 선택해주세요.')
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
                          ? 'bg-[#C5D7F2] text-white'
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

      {/* 🆕 파일 형식 선택 모달 */}
{showFormatModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-lg w-full max-w-md p-6">
      <h3 className="text-xl font-bold mb-4">다운로드 형식 선택</h3>
      <p className="text-gray-600 mb-6">
        어떤 형식으로 다운로드하시겠습니까?
      </p>
      
      <div className="space-y-3">
        <button
          onClick={() => startDownloadWithFormat('pdf')}
          className="w-full p-4 border-2 border-blue-600 rounded-lg hover:bg-blue-50 text-left transition"
        >
          <div className="font-bold text-blue-900 mb-1">📄 PDF 파일</div>
          <div className="text-sm text-gray-600">
            모든 곡을 하나의 PDF 문서로 통합
          </div>
        </button>
        
        <button
          onClick={() => startDownloadWithFormat('image')}
          className="w-full p-4 border-2 border-green-600 rounded-lg hover:bg-green-50 text-left transition"
        >
          <div className="font-bold text-green-900 mb-1">🖼️ 사진파일 (JPG/PNG)</div>
          <div className="text-sm text-gray-600">
            각 곡을 개별 이미지 파일로 다운로드
          </div>
          <div className="text-xs text-gray-500 mt-1">
            ※ PDF 악보는 JPG로 변환됩니다
          </div>
        </button>
      </div>
      
      <button
        onClick={() => setShowFormatModal(false)}
        className="w-full mt-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
      >
        취소
      </button>
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
                        <span className="text-sm bg-blue-200 px-2 py-1 
rounded text-blue-900">{abbr}</span>
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
<div className="flex flex-col h-[500px]">
  <h4 className="font-bold mb-3 text-lg">선택된 순서</h4>
  
  {/* 스크롤 가능한 송폼 리스트 영역 */}
  <div className="flex-1 overflow-y-auto border-2 border-dashed rounded-lg p-4 bg-gray-50">
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
                className="px-2 py-1 bg-[#84B9C0] text-white rounded hover:bg-[#6FA5AC] disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                ↑
              </button>
              <button
                onClick={() => moveSectionDown(index)}
                disabled={index === tempSelectedForm.length - 1}
                className="px-2 py-1 bg-[#84B9C0] text-white rounded hover:bg-[#6FA5AC] disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                ↓
              </button>
              <button
                onClick={() => removeSection(index)}
                className="px-2 py-1 bg-[#E26559] text-white rounded hover:bg-[#D14E42]"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>

  {/* 미리보기 - 하단 고정 */}
  {tempSelectedForm.length > 0 && (
    <div className="flex-none mt-3 p-3 bg-blue-50 rounded border border-blue-200">
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
                className="px-6 py-2 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8] font-bold"
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

      {/* ✅ 여기부터 새로 추가 ✅ */}
      {/* PDF/PPT 다운로드 로딩 모달 */}
      {(downloadingPDF || downloadingPPT) && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 text-center">
            {/* 스피너 */}
            <div className="flex justify-center mb-4">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
            </div>
            
            {/* 제목 */}
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {downloadingPDF ? 'PDF 생성 중...' : 'PPT 생성 중...'}
            </h3>
            
            {/* 설명 */}
            <p className="text-gray-600 mb-4">
              {downloadingPDF
                ? '선택하신 곡들의 악보를 PDF로 생성하고 있습니다.'
                : '선택하신 곡들의 가사를 PPT로 생성하고 있습니다.'}
            </p>
            
            {/* 안내 메시지 */}
            <p className="text-sm text-gray-500">
              잠시만 기다려 주세요. 곡 수에 따라 시간이 소요될 수 있습니다.
            </p>
            
            {/* 바운스 애니메이션 점들 */}
            <div className="mt-6 flex justify-center gap-2">
              <div className="w-2 h-2 bg-[#C5D7F2] rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
              <div className="w-2 h-2 bg-[#C5D7F2] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 bg-[#C5D7F2] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
            </div>
          </div>
        </div>
      )}
      {/* ✅ 여기까지 새로 추가 ✅ */}
      {/* ✅ 여기까지 새로 추가 ✅ */}

      {/* 🆕🆕🆕 악보보기 모드 (전체화면) */}
{showSheetViewer && currentSheetSong && (
  <div className="fixed inset-0 bg-black z-50 flex flex-col">
    {/* 상단 바 */}
    <div className="bg-gray-900 text-white p-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <span className="text-lg font-bold">
          {currentSheetSong.song_name}
        </span>
        {currentSheetSong.team_name && (
          <span className="text-sm text-gray-400">
            {currentSheetSong.team_name}
          </span>
        )}
        {currentSheetSong.key && (
          <span className="text-sm text-gray-400">
            Key: {currentSheetSong.key}
          </span>
        )}
      </div>
      
      {/* 닫기 버튼 - 더 잘 보이게 개선 */}
      <button
        onClick={closeSheetViewer}
        className="px-4 py-2 bg-[#E26559] hover:bg-[#D14E42] rounded-lg transition-colors flex items-center gap-2"
        title="닫기 (ESC)"
      >
        <X size={20} />
        <span className="font-medium">닫기</span>
      </button>
    </div>

    {/* 악보 표시 영역 */}
    <div className="flex-1 flex items-center justify-center relative overflow-hidden bg-gray-900">
      {!currentSheetSong.file_url ? (
        <div className="text-white text-center">
          <Music size={80} className="mx-auto mb-4 opacity-30" />
          <p className="text-2xl">악보가 없습니다</p>
        </div>
      ) : currentSheetSong.file_type === 'pdf' ? (
        <>
          {isLoadingPDF ? (
            <div className="flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
              <p className="text-white">PDF 로딩 중...</p>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              className="shadow-2xl bg-white"
              style={{ 
                maxHeight: '85vh', 
                width: 'auto'
              }}
            />
          )}
          
          {/* PDF 페이지 네비게이션 버튼 */}
          {!isLoadingPDF && totalPDFPages > 1 && (
            <>
              {currentPDFPage > 1 && (
                <button
                  onClick={() => setCurrentPDFPage(p => p - 1)}
                  className="absolute left-8 top-1/2 -translate-y-1/2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-4 rounded-full backdrop-blur transition-all"
                >
                  <ChevronLeft size={32} />
                </button>
              )}
              
              {currentPDFPage < totalPDFPages && (
                <button
                  onClick={() => setCurrentPDFPage(p => p + 1)}
                  className="absolute right-8 top-1/2 -translate-y-1/2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-4 rounded-full backdrop-blur transition-all"
                >
                  <ChevronRight size={32} />
                </button>
              )}
            </>
          )}
          
          {/* 페이지 번호 표시 */}
          {!isLoadingPDF && totalPDFPages > 0 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black bg-opacity-70 text-white px-4 py-2 rounded-full">
              페이지 {currentPDFPage} / {totalPDFPages}
            </div>
          )}
        </>
      ) : (
        <img
          src={currentSheetSong.file_url}
          alt={currentSheetSong.song_name}
          className="shadow-2xl"
          style={{
            maxHeight: '85vh',
            width: 'auto',
            objectFit: 'contain'
          }}
        />
      )}
    </div>

    {/* 하단 정보 바 - 더 잘 보이게 개선 */}
    <div className="bg-gray-900 text-white p-4 flex justify-between items-center border-t border-gray-700">
      <div className="flex gap-4 text-sm">
        {currentSheetSong.bpm && (
          <span className="px-3 py-1 bg-gray-800 rounded">
            BPM: {currentSheetSong.bpm}
          </span>
        )}
        {currentSheetSong.time_signature && (
          <span className="px-3 py-1 bg-gray-800 rounded">
            박자: {currentSheetSong.time_signature}
          </span>
        )}
      </div>
      
      {/* 곡 네비게이션 - 더 크고 잘 보이게 */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => goToAdjacentSong('prev')}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors font-medium flex items-center gap-1"
        >
          <ChevronLeft size={20} />
          이전 곡
        </button>
        
        {/* 현재 위치 - 더 크고 명확하게 */}
        <span className="px-4 py-2 bg-[#C5D7F2] text-white rounded-lg font-bold">
          {filteredSongs.findIndex(s => s.id === currentSheetSong?.id) + 1} / {filteredSongs.filter(s => s.file_url).length}
        </span>
        
        <button
          onClick={() => goToAdjacentSong('next')}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors font-medium flex items-center gap-1"
        >
          다음 곡
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  </div>
)}

      {/* 🆕 송폼 위치 설정 모달 */}
      {showPositionModal && (
        <SongFormPositionModal
          songs={selectedSongs}
          songForms={songForms}
          onConfirm={generatePDF}
          onCancel={() => setShowPositionModal(false)}
        />
      )}
      
    </div>
  )
}