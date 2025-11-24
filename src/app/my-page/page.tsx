'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import {
  Music, Settings, Edit, Trash2, Eye, Globe,
  Lock, Users, Share2, Upload, ChevronRight, X, Save, Search, Filter, Plus
} from 'lucide-react'

// 절기 & 테마 상수
const SEASONS = ['전체', '크리스마스', '부활절', '고난주간', '추수감사절', '신년', '종교개혁주일']
const THEMES = ['경배', '찬양', '회개', '감사', '헌신', '선교', '구원', '사랑', '소망', '믿음', '은혜', '성령', '치유', '회복', '십자가']

// 상수
const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
const timeSignatures = ['3/4', '4/4', '6/8', '12/8']
const tempos = ['느림', '보통', '빠름']

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

export default function MyPagePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [songs, setSongs] = useState<UploadedSong[]>([])
  const [userTeams, setUserTeams] = useState<Team[]>([])
  const [activeTab, setActiveTab] = useState<'songs'>('songs')

  
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
  const [editSong, setEditSong] = useState({
    song_name: '',
    team_name: '',
    key: ''
  })

  // 곡 미리보기
  const [previewSong, setPreviewSong] = useState<UploadedSong | null>(null)

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
    visibility: 'public' as 'public' | 'private' | 'teams',
    shared_with_teams: [] as string[]
  })
  const [uploadingFile, setUploadingFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (user) {
      fetchUploadedSongs()
      fetchUserTeams()
    }
  }, [user])

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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Music className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold">My Page</h1>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">{user?.email}</span>

              {/* ✨ 이 부분이 추가됨 ✨ */}
              <button
                onClick={() => router.push('/my-page/settings')}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
            >
                <Settings size={18} />
                계정 설정
            </button>
  
            <button
                onClick={() => router.push('/')}
                className="px-4 py-2 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8]"
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
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="곡명 또는 아티스트 검색..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg"
                />
              </div>
            </div>

            <select
              value={visibilityFilter}
              onChange={(e) => setVisibilityFilter(e.target.value as any)}
              className="px-4 py-2 border rounded-lg"
            >
              <option value="all">모든 공유 상태</option>
              <option value="public">전체 공유</option>
              <option value="teams">팀 공유</option>
              <option value="private">나만 보기</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 border rounded-lg"
            >
              <option value="recent">최근순</option>
              <option value="name">이름순</option>
              <option value="usage">사용빈도순</option>
            </select>

            <button
              onClick={() => setShowAddSongModal(true)}
              className="px-6 py-2 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8] flex items-center whitespace-nowrap"
            >
              <Plus className="mr-2" size={18} />
              곡 추가
            </button>
          </div>
        </div>

        {/* 곡 목록 */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="text-lg font-bold">
              내가 추가한 곡 ({filteredSongs.length}개)
            </h2>
          </div>

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
                <div key={song.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-gray-900">{song.song_name}</h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                        {song.team_name && <span>{song.team_name}</span>}
                        {song.key && <span>Key: {song.key}</span>}
                        {song.time_signature && <span>{song.time_signature}</span>}
                        {song.tempo && <span>{song.tempo}</span>}
                        {song.bpm && <span>{song.bpm}BPM</span>}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {renderVisibilityBadge(song)}
                        {song.themes?.map(theme => (
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

                    <div className="flex gap-2 ml-4">
                      {song.file_url && (
                        <button
                          onClick={() => setPreviewSong(song)}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"
                          title="미리보기"
                        >
                          <Eye size={20} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            {/* ✨ 새로 추가: 탭 네비게이션 ✨ */}
<div className="flex gap-4 mb-8 border-b">
  <button
    onClick={() => setActiveTab('songs')}
    className={`pb-3 px-4 font-medium transition-colors relative ${
      activeTab === 'songs'
        ? 'text-blue-600'
        : 'text-gray-600 hover:text-gray-900'
    }`}
  >
    <div className="flex items-center gap-2">
      <Music size={18} />
      내가 추가한 곡
    </div>
    {activeTab === 'songs' && (
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C5D7F2]"></div>
    )}
  </button>

  <button
    onClick={() => router.push('/my-page/settings')}
    className="pb-3 px-4 font-medium text-gray-600 hover:text-gray-900 transition-colors"
  >
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

              {/* 테마 선택 (다중) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  테마 (복수 선택 가능)
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
                disabled={uploading || !newSong.song_name.trim() || (newSong.visibility === 'teams' && newSong.shared_with_teams.length === 0)}
                className="flex-1 px-6 py-3 bg-[#C5D7F2] hover:bg-[#A8C4E8] text-white rounded-lg font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {uploading ? '추가 중...' : '곡 추가'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 미리보기 모달 */}
      {previewSong && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-2xl font-bold">{previewSong.song_name}</h2>
              <button
                onClick={() => setPreviewSong(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {previewSong.file_url ? (
                previewSong.file_type === 'pdf' ? (
                  <iframe
                    src={previewSong.file_url}
                    className="w-full h-[600px] border rounded"
                  />
                ) : (
                  <img
                    src={previewSong.file_url}
                    alt={previewSong.song_name}
                    className="max-w-full h-auto"
                  />
                )
              ) : (
                <div className="text-center text-gray-500">
                  <p>악보 파일이 없습니다</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}