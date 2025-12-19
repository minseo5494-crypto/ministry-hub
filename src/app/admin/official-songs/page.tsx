'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { Song, VerifiedPublisher } from '@/lib/types'
import {
  ArrowLeft, Search, Shield, ShieldOff, Music,
  Filter, Check, X, ChevronLeft, ChevronRight, Building2
} from 'lucide-react'

interface SongWithUploader extends Song {
  uploader_email?: string
  uploader_name?: string
  publisher_name?: string
}

export default function OfficialSongsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [songs, setSongs] = useState<SongWithUploader[]>([])
  const [publishers, setPublishers] = useState<VerifiedPublisher[]>([])
  const [totalCount, setTotalCount] = useState(0)

  // 필터 및 검색
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'official' | 'unofficial'>('all')
  const [page, setPage] = useState(1)
  const pageSize = 20

  // 처리 중 상태
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    checkAdminAndLoad()
  }, [])

  useEffect(() => {
    if (user && publishers.length >= 0) {
      loadSongs()
    }
  }, [user, searchQuery, filterStatus, page, publishers])

  const checkAdminAndLoad = async () => {
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
        alert('관리자 권한이 필요합니다.')
        router.push('/')
        return
      }

      setUser(currentUser)
      await loadPublishers()
    } catch (error) {
      console.error('Error checking admin:', error)
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  const loadPublishers = async () => {
    const { data } = await supabase
      .from('verified_publishers')
      .select('id, name')
      .eq('is_active', true)

    setPublishers(data || [])
  }

  const loadSongs = async () => {
    let query = supabase
      .from('songs')
      .select(`
        *,
        users:uploaded_by (email, name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })

    // 검색 필터
    if (searchQuery.trim()) {
      query = query.or(`song_name.ilike.%${searchQuery}%,team_name.ilike.%${searchQuery}%`)
    }

    // 공식 상태 필터
    if (filterStatus === 'official') {
      query = query.eq('is_official', true)
    } else if (filterStatus === 'unofficial') {
      query = query.or('is_official.is.null,is_official.eq.false')
    }

    // 페이지네이션
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      console.error('Error loading songs:', error)
      return
    }

    // 퍼블리셔 이름 매핑
    const songsWithUploader = (data || []).map((song: any) => {
      const publisherName = song.publisher_id
        ? publishers.find(p => p.id === song.publisher_id)?.name
        : undefined
      return {
        ...song,
        uploader_email: song.users?.email,
        uploader_name: song.users?.name,
        publisher_name: publisherName
      }
    })

    setSongs(songsWithUploader)
    setTotalCount(count || 0)
  }

  const toggleOfficial = async (song: SongWithUploader) => {
    setProcessingIds(prev => new Set(prev).add(song.id))

    try {
      const { error } = await supabase
        .from('songs')
        .update({ is_official: !song.is_official })
        .eq('id', song.id)

      if (error) throw error

      // 로컬 상태 업데이트
      setSongs(prev => prev.map(s =>
        s.id === song.id ? { ...s, is_official: !s.is_official } : s
      ))
    } catch (error) {
      console.error('Error toggling official status:', error)
      alert('상태 변경 중 오류가 발생했습니다.')
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(song.id)
        return newSet
      })
    }
  }

  const setPublisher = async (song: SongWithUploader, publisherId: string | null) => {
    setProcessingIds(prev => new Set(prev).add(song.id))

    try {
      const { error } = await supabase
        .from('songs')
        .update({
          publisher_id: publisherId,
          is_official: publisherId ? true : song.is_official
        })
        .eq('id', song.id)

      if (error) throw error

      // 로컬 상태 업데이트
      const publisherName = publisherId
        ? publishers.find(p => p.id === publisherId)?.name
        : undefined

      setSongs(prev => prev.map(s =>
        s.id === song.id ? {
          ...s,
          publisher_id: publisherId || undefined,
          publisher_name: publisherName,
          is_official: publisherId ? true : s.is_official
        } : s
      ))
    } catch (error) {
      console.error('Error setting publisher:', error)
      alert('퍼블리셔 설정 중 오류가 발생했습니다.')
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(song.id)
        return newSet
      })
    }
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin/dashboard')}
              className="p-2 hover:bg-gray-100 rounded-lg touch-manipulation"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Shield className="text-blue-600" />
                공식 악보 관리
              </h1>
              <p className="text-sm text-gray-600">
                개별 곡을 공식 악보로 지정하거나 퍼블리셔를 연결할 수 있습니다
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 검색 및 필터 */}
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* 검색 */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setPage(1)
                }}
                placeholder="곡 제목 또는 팀명으로 검색..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* 필터 */}
            <div className="flex gap-2">
              <button
                onClick={() => { setFilterStatus('all'); setPage(1) }}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  filterStatus === 'all'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                전체
              </button>
              <button
                onClick={() => { setFilterStatus('official'); setPage(1) }}
                className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-1 ${
                  filterStatus === 'official'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Shield size={16} />
                공식
              </button>
              <button
                onClick={() => { setFilterStatus('unofficial'); setPage(1) }}
                className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-1 ${
                  filterStatus === 'unofficial'
                    ? 'bg-gray-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <ShieldOff size={16} />
                비공식
              </button>
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-500">
            총 {totalCount}개의 곡
          </div>
        </div>

        {/* 곡 목록 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {songs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Music size={48} className="mx-auto mb-4 text-gray-300" />
              <p>검색 결과가 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">곡 정보</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">업로더</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">퍼블리셔</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">공식</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {songs.map((song) => (
                    <tr
                      key={song.id}
                      className={`hover:bg-gray-50 ${processingIds.has(song.id) ? 'opacity-50' : ''}`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            song.is_official ? 'bg-blue-100' : 'bg-gray-100'
                          }`}>
                            <Music size={20} className={song.is_official ? 'text-blue-600' : 'text-gray-400'} />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{song.song_name}</p>
                            <p className="text-sm text-gray-500">{song.team_name || '-'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-sm text-gray-900">{song.uploader_name || '-'}</p>
                        <p className="text-xs text-gray-500">{song.uploader_email}</p>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={song.publisher_id || ''}
                          onChange={(e) => setPublisher(song, e.target.value || null)}
                          disabled={processingIds.has(song.id)}
                          className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">선택 안함</option>
                          {publishers.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        {song.publisher_name && (
                          <p className="text-xs text-purple-600 mt-1 flex items-center gap-1">
                            <Building2 size={12} />
                            {song.publisher_name}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {song.is_official ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                            <Shield size={12} />
                            공식
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                            <ShieldOff size={12} />
                            비공식
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => toggleOfficial(song)}
                          disabled={processingIds.has(song.id)}
                          className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                            song.is_official
                              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {song.is_official ? (
                            <>
                              <X size={14} className="inline mr-1" />
                              해제
                            </>
                          ) : (
                            <>
                              <Check size={14} className="inline mr-1" />
                              공식 지정
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
              <div className="text-sm text-gray-500">
                {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, totalCount)} / {totalCount}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="px-3 py-1 bg-white border rounded-lg text-sm">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 안내 */}
        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">공식 악보 관리 안내</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• <strong>공식 지정:</strong> 개별 곡을 공식 악보로 표시합니다.</li>
            <li>• <strong>퍼블리셔 연결:</strong> 곡을 특정 퍼블리셔와 연결하면 자동으로 공식 악보가 됩니다.</li>
            <li>• 공식 업로더(/admin/official-uploaders)나 퍼블리셔 계정이 올린 곡은 자동으로 공식 표시됩니다.</li>
            <li>• 이 페이지에서는 개별 곡을 수동으로 공식/비공식 전환할 수 있습니다.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
