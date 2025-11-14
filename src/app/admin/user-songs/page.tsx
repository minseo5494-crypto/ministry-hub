'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { Trash2, Eye, Search, Filter, X, Globe, Users, Lock } from 'lucide-react'

interface UserSong {
  id: string
  song_name: string
  team_name: string | null
  key: string | null
  bpm: number | null
  visibility: 'public' | 'private' | 'teams'
  is_user_uploaded: boolean
  uploaded_by: string
  created_at: string
  file_url: string | null
}

export default function UserSongsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [songs, setSongs] = useState<UserSong[]>([])
  const [filteredSongs, setFilteredSongs] = useState<UserSong[]>([])
  const [searchText, setSearchText] = useState('')
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private' | 'teams'>('all')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [previewSong, setPreviewSong] = useState<UserSong | null>(null)

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
        alert('로그인이 필요합니다.')
        router.push('/login')
        return
      }

      const { data: userData, error } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', currentUser.id)
        .single()

      if (error || !userData?.is_admin) {
        alert('⛔ 관리자 권한이 없습니다.')
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
      alert('사용자 곡 목록을 불러오는데 실패했습니다.')
    }
  }

  const filterSongs = () => {
    let result = [...songs]

    // 검색어 필터
    if (searchText) {
      result = result.filter(song =>
        song.song_name.toLowerCase().includes(searchText.toLowerCase()) ||
        song.team_name?.toLowerCase().includes(searchText.toLowerCase())
      )
    }

    // 공유 범위 필터
    if (visibilityFilter !== 'all') {
      result = result.filter(song => song.visibility === visibilityFilter)
    }

    setFilteredSongs(result)
  }

  const handleDelete = async (song: UserSong) => {
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

      if (deleteError) throw deleteError

      alert(`✅ "${song.song_name}"이(가) 삭제되었습니다.`)
      fetchUserSongs()
    } catch (error: any) {
      console.error('Error deleting song:', error)
      alert(`삭제 실패: ${error.message}`)
    } finally {
      setDeleting(null)
    }
  }

  const renderVisibilityBadge = (visibility: string) => {
    if (visibility === 'private') {
      return (
        <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
          <Lock className="w-3 h-3 mr-1" />
          나만 보기
        </span>
      )
    } else if (visibility === 'public') {
      return (
        <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
          <Globe className="w-3 h-3 mr-1" />
          전체 공유
        </span>
      )
    } else if (visibility === 'teams') {
      return (
        <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
          <Users className="w-3 h-3 mr-1" />
          팀 공유
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
          <p className="mt-4 text-gray-600">로딩 중...</p>
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
            <h1 className="text-2xl font-bold text-gray-900">사용자 곡 관리</h1>
            <div className="flex gap-2">
              <button
                onClick={() => router.push('/admin/song-approvals')}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                곡 승인
              </button>
              <button
                onClick={() => router.push('/admin/dashboard')}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                대시보드
              </button>
              <button
                onClick={() => router.push('/')}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                메인으로
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
            <div className="text-sm text-gray-600">전체 사용자 곡</div>
            <div className="text-3xl font-bold text-blue-600">{songs.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600">전체 공유</div>
            <div className="text-3xl font-bold text-green-600">
              {songs.filter(s => s.visibility === 'public').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600">팀 공유</div>
            <div className="text-3xl font-bold text-purple-600">
              {songs.filter(s => s.visibility === 'teams').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600">나만 보기</div>
            <div className="text-3xl font-bold text-gray-600">
              {songs.filter(s => s.visibility === 'private').length}
            </div>
          </div>
        </div>

        {/* 검색 및 필터 */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="곡명 또는 아티스트 검색..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
              />
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
          </div>
        </div>

        {/* 곡 목록 */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="text-lg font-bold">
              사용자가 추가한 곡 ({filteredSongs.length}개)
            </h2>
          </div>

          {filteredSongs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">
                {searchText || visibilityFilter !== 'all'
                  ? '검색 결과가 없습니다'
                  : '사용자가 추가한 곡이 없습니다'}
              </p>
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
                        {song.bpm && <span>{song.bpm}BPM</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        {renderVisibilityBadge(song.visibility)}
                        <span className="text-xs text-gray-500">
                          {new Date(song.created_at).toLocaleDateString('ko-KR')}
                        </span>
                      </div>
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
                      <button
                        onClick={() => handleDelete(song)}
                        disabled={deleting === song.id}
                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        title="삭제"
                      >
                        <Trash2 size={20} />
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
                  src={previewSong.file_url}
                  className="w-full h-[600px] border rounded"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}