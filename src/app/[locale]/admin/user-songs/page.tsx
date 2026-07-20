'use client'

import { useState, useEffect, useRef } from 'react'
import { toProxyUrl } from '@/lib/fileUrl'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase, parseThemes } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { Trash2, Eye, Search, Filter, X, Globe, Users, Lock, Edit, Save, Upload, FileText, RefreshCw } from 'lucide-react'
import { SEASONS, THEMES, KEYS, TIME_SIGNATURES, TEMPOS } from '@/lib/constants'
import { getTempoFromBPM, getBPMRangeFromTempo } from '@/lib/musicUtils'

interface UserSong {
  id: string
  song_name: string
  team_name: string | null
  key: string | null
  time_signature: string | null
  tempo: string | null
  bpm: number | null
  themes: string[] | null
  season: string | null
  youtube_url: string | null
  lyrics: string | null
  visibility: 'public' | 'private' | 'teams'
  shared_with_teams: string[] | null
  is_user_uploaded: boolean
  uploaded_by: string
  created_at: string
  file_url: string | null
}

export default function UserSongsPage() {
  const router = useRouter()
  const t = useTranslations('admin')
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [songs, setSongs] = useState<UserSong[]>([])
  const [filteredSongs, setFilteredSongs] = useState<UserSong[]>([])
  const [searchText, setSearchText] = useState('')
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private' | 'teams'>('all')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [previewSong, setPreviewSong] = useState<UserSong | null>(null)

  // 곡 수정 모달 상태
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

  // 데이터 정규화 상태
  const [normalizing, setNormalizing] = useState(false)
  const [normalizeProgress, setNormalizeProgress] = useState({ current: 0, total: 0 })

  // 파일 수정 관련 상태
  const [editFile, setEditFile] = useState<File | null>(null)
  const [editCurrentFileUrl, setEditCurrentFileUrl] = useState<string | null>(null)
  const editFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    checkAdmin()
  }, [])

  useEffect(() => {
    if (user) {
      fetchUserSongs()
    }
  }, [user])

  useEffect(() => {
    filterSongs()
  }, [songs, searchText, visibilityFilter])

  const checkAdmin = async () => {
    try {
      const currentUser = await getCurrentUser()
      if (!currentUser) {
        alert(t('loginRequired'))
        router.push('/login')
        return
      }

      const { data: userData, error } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', currentUser.id)
        .single()

      if (error || !userData?.is_admin) {
        alert(t('adminRequiredEmoji'))
        router.push('/')
        return
      }

      setUser(currentUser)
    } catch (error) {
      console.error('Error checking admin:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const fetchUserSongs = async () => {
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('is_user_uploaded', true)
        .order('created_at', { ascending: false })

      if (error) throw error

      setSongs(data || [])
    } catch (error) {
      console.error('Error fetching user songs:', error)
      alert(t('fetchUserSongsFailed'))
    }
  }

  // 🆕 전체 곡 데이터 정규화 (유니코드 NFC 변환)
  const normalizeAllSongs = async () => {
    if (!confirm(t('normalizeConfirm'))) {
      return
    }

    setNormalizing(true)

    try {
      // 1. 모든 곡 가져오기 (사용자 곡만 아니라 전체)
      let allSongs: any[] = []
      let from = 0
      const pageSize = 1000

      while (true) {
        const { data, error } = await supabase
          .from('songs')
          .select('id, song_name, team_name')
          .range(from, from + pageSize - 1)

        if (error) throw error
        if (!data || data.length === 0) break

        allSongs = [...allSongs, ...data]
        if (data.length < pageSize) break
        from += pageSize
      }

      // 2. 정규화 필요한 곡만 필터링
      const songsToUpdate = allSongs.filter(song => {
        const nameNormalized = song.song_name?.normalize('NFC') || ''
        const teamNormalized = song.team_name?.normalize('NFC') || ''
        return song.song_name !== nameNormalized || song.team_name !== teamNormalized
      })

      setNormalizeProgress({ current: 0, total: songsToUpdate.length })

      if (songsToUpdate.length === 0) {
        alert(t('normalizeAlreadyDone'))
        setNormalizing(false)
        return
      }

      // 3. 배치로 업데이트 (10개씩)
      const batchSize = 10
      let updated = 0

      for (let i = 0; i < songsToUpdate.length; i += batchSize) {
        const batch = songsToUpdate.slice(i, i + batchSize)

        await Promise.all(batch.map(async (song) => {
          const { error } = await supabase
            .from('songs')
            .update({
              song_name: song.song_name?.normalize('NFC') || song.song_name,
              team_name: song.team_name?.normalize('NFC') || song.team_name
            })
            .eq('id', song.id)

          if (error) {
            console.error(`Failed to update song ${song.id}:`, error)
          }
        }))

        updated += batch.length
        setNormalizeProgress({ current: updated, total: songsToUpdate.length })
      }

      alert(t('normalizeSuccess', { count: songsToUpdate.length }))
      fetchUserSongs() // 목록 새로고침
    } catch (error: any) {
      console.error('Normalization error:', error)
      alert(t('normalizeFailed', { message: error.message }))
    } finally {
      setNormalizing(false)
      setNormalizeProgress({ current: 0, total: 0 })
    }
  }

  const filterSongs = () => {
    let result = [...songs]

    // 검색어 필터 (유니코드 정규화 적용)
    if (searchText) {
      const normalizedSearch = searchText.normalize('NFC').toLowerCase()
      result = result.filter(song => {
        const normalizedName = (song.song_name || '').normalize('NFC').toLowerCase()
        const normalizedTeam = (song.team_name || '').normalize('NFC').toLowerCase()
        return normalizedName.includes(normalizedSearch) ||
               normalizedTeam.includes(normalizedSearch)
      })
    }

    // 공유 범위 필터
    if (visibilityFilter !== 'all') {
      result = result.filter(song => song.visibility === visibilityFilter)
    }

    setFilteredSongs(result)
  }

  // 곡 수정 모달 열기
  const openEditModal = (song: UserSong) => {
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
    setEditFile(null)
    setEditCurrentFileUrl(song.file_url || null)
    setShowEditModal(true)
  }

  // 파일 선택 핸들러
  const handleEditFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert(t('fileSizeLimitError'))
        return
      }
      setEditFile(file)
    }
  }

  // 곡 수정 저장
  const updateSong = async () => {
    if (!editingSongId) return
    if (!editSong.song_name.trim()) {
      alert(t('songTitleRequired'))
      return
    }

    setUpdating(true)

    try {
      let fileUrl = editCurrentFileUrl
      let fileType = editCurrentFileUrl ? editCurrentFileUrl.split('.').pop()?.toLowerCase() : null

      // 새 파일이 선택된 경우 업로드
      if (editFile) {
        // 곡의 원래 소유자 ID 가져오기
        const originalSong = songs.find(s => s.id === editingSongId)
        const uploaderId = originalSong?.uploaded_by || 'admin'

        const fileExt = editFile.name.split('.').pop()?.toLowerCase() || 'pdf'
        const timestamp = Date.now()
        const randomStr = Math.random().toString(36).substring(2, 8)
        const safeFileName = `${timestamp}_${randomStr}.${fileExt}`
        const filePath = `${uploaderId}/${safeFileName}`

        const { error: uploadError } = await supabase.storage
          .from('song-sheets')
          .upload(filePath, editFile, {
            cacheControl: '3600',
            upsert: false,
            contentType: editFile.type
          })

        if (uploadError) {
          throw new Error(t('fileUploadFailed', { message: uploadError.message }))
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

      alert(t('songUpdateSuccess'))
      setShowEditModal(false)
      setEditingSongId(null)
      setEditFile(null)
      setEditCurrentFileUrl(null)
      fetchUserSongs()
    } catch (error: any) {
      console.error('Error updating song:', error)
      alert(t('updateFailed', { message: error.message }))
    } finally {
      setUpdating(false)
    }
  }

  // BPM 입력 시 템포 자동 선택
  const handleEditBPMChange = (bpmValue: string) => {
    const bpm = parseInt(bpmValue)
    if (!isNaN(bpm) && bpm > 0) {
      const autoTempo = getTempoFromBPM(bpm)
      setEditSong({ ...editSong, bpm: bpmValue, tempo: autoTempo })
    } else {
      setEditSong({ ...editSong, bpm: bpmValue })
    }
  }

  // 템포 선택 시 BPM 범위 검증
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

  const handleDelete = async (song: UserSong) => {
    if (!confirm(t('deleteSongConfirm', { name: song.song_name }))) {
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

      if (deleteError) throw deleteError

      alert(t('deleteSuccess', { name: song.song_name }))
      fetchUserSongs()
    } catch (error: any) {
      console.error('Error deleting song:', error)
      alert(t('deleteFailed', { message: error.message }))
    } finally {
      setDeleting(null)
    }
  }

  const renderVisibilityBadge = (visibility: string) => {
    if (visibility === 'private') {
      return (
        <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
          <Lock className="w-3 h-3 mr-1" />
          {t('privateOnly')}
        </span>
      )
    } else if (visibility === 'public') {
      return (
        <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
          <Globe className="w-3 h-3 mr-1" />
          {t('publicShared')}
        </span>
      )
    } else if (visibility === 'teams') {
      return (
        <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
          <Users className="w-3 h-3 mr-1" />
          {t('teamShared')}
        </span>
      )
    }
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">{t('loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">{t('userSongsTitle')}</h1>
            <div className="flex gap-2">
              <button
                onClick={() => router.push('/admin/song-approvals')}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                {t('songApprovalLink')}
              </button>
              <button
                onClick={() => router.push('/')}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                {t('backToMain')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 통계 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600">{t('totalUserSongs')}</div>
            <div className="text-3xl font-bold text-blue-600">{songs.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600">{t('publicShared')}</div>
            <div className="text-3xl font-bold text-green-600">
              {songs.filter(s => s.visibility === 'public').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600">{t('teamShared')}</div>
            <div className="text-3xl font-bold text-purple-600">
              {songs.filter(s => s.visibility === 'teams').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600">{t('privateOnly')}</div>
            <div className="text-3xl font-bold text-gray-600">
              {songs.filter(s => s.visibility === 'private').length}
            </div>
          </div>
        </div>

        {/* 검색 및 필터 */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex gap-2 md:gap-4 flex-wrap">
            <div className="flex-1 min-w-[150px] md:min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder={t('searchSongOrArtistShort')}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm md:text-base"
              />
            </div>
            <select
              value={visibilityFilter}
              onChange={(e) => setVisibilityFilter(e.target.value as any)}
              className="px-3 md:px-4 py-2 border rounded-lg text-sm md:text-base flex-shrink-0"
            >
              <option value="all">{t('allVisibility')}</option>
              <option value="public">{t('publicShared')}</option>
              <option value="teams">{t('teamShared')}</option>
              <option value="private">{t('privateOnly')}</option>
            </select>

            {/* 데이터 정규화 버튼 */}
            <button
              onClick={normalizeAllSongs}
              disabled={normalizing}
              className="px-3 md:px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg flex items-center gap-1.5 md:gap-2 disabled:bg-orange-300 disabled:cursor-not-allowed text-sm md:text-base flex-shrink-0 whitespace-nowrap"
              title={t('normalizeConfirm')}
            >
              <RefreshCw size={16} className={`flex-shrink-0 ${normalizing ? 'animate-spin' : ''}`} />
              {normalizing ? (
                <span className="hidden sm:inline">{t('normalizing', { current: normalizeProgress.current, total: normalizeProgress.total })}</span>
              ) : (
                <span className="hidden sm:inline">{t('normalizeData')}</span>
              )}
              {normalizing && <span className="sm:hidden">{normalizeProgress.current}/{normalizeProgress.total}</span>}
            </button>
          </div>
        </div>

        {/* 곡 목록 */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="text-lg font-bold">
              {t('userAddedSongs', { count: filteredSongs.length })}
            </h2>
          </div>

          {filteredSongs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">
                {searchText || visibilityFilter !== 'all'
                  ? t('noSearchResults')
                  : t('noUserSongs')}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredSongs.map((song) => (
                <div key={song.id} className="p-3 md:p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-base md:text-lg text-gray-900 truncate">{song.song_name}</h3>
                      <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-1 text-xs md:text-sm text-gray-600">
                        {song.team_name && <span className="truncate max-w-[120px] md:max-w-none">{song.team_name}</span>}
                        {song.key && <span>Key: {song.key}</span>}
                        {song.bpm && <span>{song.bpm}BPM</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {renderVisibilityBadge(song.visibility)}
                        <span className="text-xs text-gray-500">
                          {new Date(song.created_at).toLocaleDateString('ko-KR')}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-1 md:gap-2 ml-2 md:ml-4 flex-shrink-0">
                      {song.file_url && (
                        <button
                          onClick={() => setPreviewSong(song)}
                          className="p-1.5 md:p-2 text-blue-600 hover:bg-blue-100 rounded-lg"
                          title={t('preview')}
                        >
                          <Eye size={18} className="md:w-5 md:h-5" />
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(song)}
                        className="p-1.5 md:p-2 text-green-600 hover:bg-green-100 rounded-lg"
                        title={t('edit')}
                      >
                        <Edit size={18} className="md:w-5 md:h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(song)}
                        disabled={deleting === song.id}
                        className="p-1.5 md:p-2 text-red-600 hover:bg-red-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        title={t('delete')}
                      >
                        <Trash2 size={18} className="md:w-5 md:h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 미리보기 모달 */}
      {previewSong && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-auto">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold">{previewSong.song_name}</h2>
              <button
                onClick={() => setPreviewSong(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6">
              {previewSong.file_url && (
                <iframe
                  src={toProxyUrl(previewSong.file_url)}
                  className="w-full h-[600px] border rounded"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* 곡 수정 모달 */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-2xl p-6 my-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">{t('editSongAdmin')}</h2>
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
                  {t('songTitleLabel')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editSong.song_name}
                  onChange={(e) => setEditSong({ ...editSong, song_name: e.target.value })}
                  placeholder={t('songTitlePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('teamNameFieldLabel')}
                </label>
                <input
                  type="text"
                  value={editSong.team_name}
                  onChange={(e) => setEditSong({ ...editSong, team_name: e.target.value })}
                  placeholder={t('teamNamePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              {/* 공유 범위 선택 */}
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">{t('shareScope')}</label>
                <div className="space-y-2">
                  <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="editVisibility"
                      value="public"
                      checked={editSong.visibility === 'public'}
                      onChange={(e) => setEditSong({ ...editSong, visibility: 'public', shared_with_teams: [] })}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium text-gray-900">{t('visibilityPublic')}</div>
                      <div className="text-sm text-gray-500">{t('visibilityAllUsers')}</div>
                    </div>
                  </label>

                  <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="editVisibility"
                      value="teams"
                      checked={editSong.visibility === 'teams'}
                      onChange={(e) => setEditSong({ ...editSong, visibility: 'teams' })}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium text-gray-900">{t('visibilityTeam')}</div>
                      <div className="text-sm text-gray-500">{t('visibilityTeamOnly')}</div>
                    </div>
                  </label>

                  <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="editVisibility"
                      value="private"
                      checked={editSong.visibility === 'private'}
                      onChange={(e) => setEditSong({ ...editSong, visibility: 'private', shared_with_teams: [] })}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium text-gray-900">{t('visibilityPrivate')}</div>
                      <div className="text-sm text-gray-500">{t('visibilityPrivateUploader')}</div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Key */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('keyLabel')}</label>
                  <div className="flex gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setEditSong({ ...editSong, key: editSong.key.replace('m', '') })}
                      className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
                        !editSong.key.includes('m')
                          ? 'bg-blue-100 text-blue-700'
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
                          ? 'bg-purple-100 text-purple-700'
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
                    <option value="">{t('selectOption')}</option>
                    {KEYS.map(key => (
                      <option key={key} value={key}>{key}{editSong.key.includes('m') ? 'm' : ''}</option>
                    ))}
                  </select>
                </div>

                {/* 박자 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('timeSignatureLabel')}</label>
                  <select
                    value={editSong.time_signature}
                    onChange={(e) => setEditSong({ ...editSong, time_signature: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">{t('selectOption')}</option>
                    {TIME_SIGNATURES.map(ts => (
                      <option key={ts} value={ts}>{ts}</option>
                    ))}
                  </select>
                </div>

                {/* 템포 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('tempoLabel')}</label>
                  <select
                    value={editSong.tempo}
                    onChange={(e) => handleEditTempoChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">{t('selectOption')}</option>
                    {TEMPOS.map(tempo => (
                      <option key={tempo} value={tempo}>{tempo}</option>
                    ))}
                  </select>
                </div>

                {/* BPM */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('bpmLabel')}
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
                    placeholder={t('bpmExample')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              {/* 시즌 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('seasonLabel')}</label>
                <select
                  value={editSong.season}
                  onChange={(e) => setEditSong({ ...editSong, season: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">{t('selectOption')}</option>
                  {SEASONS.filter(s => s !== '전체').map(season => (
                    <option key={season} value={season}>{season}</option>
                  ))}
                </select>
              </div>

              {/* 테마 선택 (다중) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('themeMultiSelect')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {THEMES.map(theme => (
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
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      {theme}
                    </button>
                  ))}
                </div>
              </div>

              {/* YouTube URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('youtubeOptional')}
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
                  {t('sheetFileLabel')}
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
                        <span>{t('currentFileLabel', { name: editCurrentFileUrl.split('/').pop()?.substring(0, 30) + '...' })}</span>
                      </div>
                      <button
                        onClick={() => setEditCurrentFileUrl(null)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        {t('deleteFileLabel')}
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
                        {editFile.name} ({(editFile.size / 1024 / 1024).toFixed(2)}MB)
                      </span>
                    ) : editCurrentFileUrl ? (
                      t('replaceFile')
                    ) : (
                      t('fileSelect')
                    )}
                  </button>
                  {editFile && (
                    <button
                      onClick={() => setEditFile(null)}
                      className="mt-2 text-sm text-red-600 hover:text-red-800"
                    >
                      {t('cancelNewFile')}
                    </button>
                  )}
                </div>
              </div>

              {/* 가사 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('lyricsOptional')}
                </label>
                <textarea
                  value={editSong.lyrics}
                  onChange={(e) => setEditSong({ ...editSong, lyrics: e.target.value })}
                  rows={4}
                  placeholder={t('lyricsPlaceholder')}
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
                {t('cancel')}
              </button>
              <button
                onClick={updateSong}
                disabled={updating || !editSong.song_name.trim()}
                className="flex-1 px-6 py-3 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {updating ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {t('updating')}
                  </>
                ) : (
                  <>
                    <Save size={20} />
                    {t('updateComplete')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
