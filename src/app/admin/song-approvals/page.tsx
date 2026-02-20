'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { CheckCircle, XCircle, Clock, Music, Eye, X } from 'lucide-react'

interface SongApprovalRequest {
  id: string
  song_name: string
  team_name: string | null
  key: string | null
  bpm: number | null
  time_signature: string | null  // ✅ 추가
  tempo: string | null           // ✅ 추가
  themes: string[] | null
  season: string | null
  youtube_url: string | null
  lyrics: string | null
  file_url: string | null
  file_type: string | null
  requester_id: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  admin_notes: string | null
  requester?: {
    email: string
    name: string
  } | null
}

export default function SongApprovalsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<SongApprovalRequest[]>([])
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [processing, setProcessing] = useState<string | null>(null)
  const [previewSong, setPreviewSong] = useState<SongApprovalRequest | null>(null)

  useEffect(() => {
    checkAdmin()
  }, [])

  useEffect(() => {
    if (user) {
      fetchRequests()
    }
  }, [user, filter])

  const checkAdmin = async () => {
    try {
      const currentUser = await getCurrentUser()
      if (!currentUser) {
        alert('로그인이 필요합니다.')
        router.push('/login')
        return
      }

      // 관리자 권한 확인
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

  const fetchRequests = async () => {
    try {
      let query = supabase
        .from('song_approval_requests')
        .select('*, requester:requester_id(email, name)')
        .order('created_at', { ascending: false })

      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { data, error } = await query

      if (error) throw error

      setRequests(data || [])
    } catch (error) {
      console.error('Error fetching requests:', error)
      alert('요청 목록을 불러오는데 실패했습니다.')
    }
  }

  const handleApprove = async (request: SongApprovalRequest) => {
    if (!request.requester_id) {
      alert('요청자가 삭제되어 승인할 수 없습니다.')
      return
    }

    if (!confirm(`"${request.song_name}" 곡을 승인하시겠습니까?`)) {
      return
    }

    setProcessing(request.id)

    try {
      // 1. songs 테이블에 추가
      const { error: songError } = await supabase
        .from('songs')
        .insert({
          song_name: request.song_name,
          team_name: request.team_name,
          key: request.key,
          bpm: request.bpm,
          time_signature: request.time_signature,  // ✅ 추가
          tempo: request.tempo,                     // ✅ 추가
          themes: request.themes,
          season: request.season,
          youtube_url: request.youtube_url,
          lyrics: request.lyrics,
          file_url: request.file_url,
          file_type: request.file_type,
          uploaded_by: request.requester_id,
          visibility: 'public',
          is_user_uploaded: true
        })

      if (songError) throw songError

      // 2. 승인 요청 상태 업데이트
      const { error: updateError } = await supabase
        .from('song_approval_requests')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', request.id)

      if (updateError) throw updateError

      alert(`✅ "${request.song_name}"이(가) 승인되었습니다!`)
      fetchRequests()
    } catch (error: any) {
      console.error('Error approving request:', error)
      alert(`승인 실패: ${error.message}`)
    } finally {
      setProcessing(null)
    }
  }

  const handleReject = async (request: SongApprovalRequest) => {
    const reason = prompt('거부 사유를 입력하세요 (선택사항):')
    if (reason === null) return // 취소

    setProcessing(request.id)

    try {
      const { error } = await supabase
        .from('song_approval_requests')
        .update({
          status: 'rejected',
          admin_notes: reason || null,
          approved_by: user.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', request.id)

      if (error) throw error

      alert('❌ 요청이 거부되었습니다.')
      fetchRequests()
    } catch (error: any) {
      console.error('Error rejecting request:', error)
      alert(`거부 실패: ${error.message}`)
    } finally {
      setProcessing(null)
    }
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
            <h1 className="text-2xl font-bold text-gray-900">곡 승인 관리</h1>
            <div className="flex gap-2">
              <button
                onClick={() => router.push('/admin/approvals')}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                팀 승인
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
        {/* 필터 */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'all'
                  ? 'bg-[#C5D7F2] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              전체 ({requests.length})
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'pending'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Clock className="inline w-4 h-4 mr-1" />
              대기 중
            </button>
            <button
              onClick={() => setFilter('approved')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'approved'
                  ? 'bg-[#84B9C0] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <CheckCircle className="inline w-4 h-4 mr-1" />
              승인됨
            </button>
            <button
              onClick={() => setFilter('rejected')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'rejected'
                  ? 'bg-[#E26559] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <XCircle className="inline w-4 h-4 mr-1" />
              거부됨
            </button>
          </div>
        </div>

        {/* 요청 목록 */}
        {requests.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <Music className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">승인 요청이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div
                key={request.id}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-xl font-bold text-gray-900">
                        {request.song_name}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          request.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : request.status === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {request.status === 'pending'
                          ? '⏳ 대기 중'
                          : request.status === 'approved'
                          ? '✅ 승인됨'
                          : '❌ 거부됨'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4 text-sm text-gray-600">
                      {request.team_name && <div>아티스트: {request.team_name}</div>}
                      {request.key && <div>Key: {request.key}</div>}
                      {request.bpm && <div>BPM: {request.bpm}</div>}
                      {request.themes && request.themes.length > 0 && (
                        <div>테마: {request.themes.join(', ')}</div>
                      )}
                    </div>

                    <div className="text-sm text-gray-600">
                      <p>
                        요청자: {request.requester
                          ? `${request.requester.name || ''} (${request.requester.email})`
                          : '알 수 없음 (삭제된 계정)'}
                      </p>
                      <p>요청일: {new Date(request.created_at).toLocaleString('ko-KR')}</p>
                    </div>

                    {!request.requester_id && request.status === 'pending' && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                        요청자가 삭제되어 승인할 수 없습니다
                      </div>
                    )}

                    {request.admin_notes && (
                      <div className="mt-2 p-3 bg-gray-50 rounded text-sm">
                        <strong>관리자 메모:</strong> {request.admin_notes}
                      </div>
                    )}
                  </div>

                  {/* 버튼 */}
                  <div className="flex gap-2 ml-4">
                    {request.file_url && (
                      <button
                        onClick={() => setPreviewSong(request)}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"
                        title="미리보기"
                      >
                        <Eye size={20} />
                      </button>
                    )}
                    {request.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApprove(request)}
                          disabled={processing === request.id || !request.requester_id}
                          className="px-4 py-2 bg-[#84B9C0] text-white rounded-lg hover:bg-[#6FA5AC] font-medium transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                          title={!request.requester_id ? '요청자가 삭제되어 승인할 수 없습니다' : ''}
                        >
                          <CheckCircle className="mr-2" size={18} />
                          승인
                        </button>
                        <button
                          onClick={() => handleReject(request)}
                          disabled={processing === request.id}
                          className="px-4 py-2 bg-[#E26559] text-white rounded-lg hover:bg-[#D14E42] font-medium transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                        >
                          <XCircle className="mr-2" size={18} />
                          거부
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
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
              {previewSong.lyrics && (
                <div className="mt-4">
                  <h3 className="font-bold mb-2">가사</h3>
                  <pre className="whitespace-pre-wrap bg-gray-50 p-4 rounded">
                    {previewSong.lyrics}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}