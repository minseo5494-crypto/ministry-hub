'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { CheckCircle, XCircle, Clock, Users, Building2 } from 'lucide-react'

interface ApprovalRequest {
  id: string
  team_name: string
  team_type: 'church_internal' | 'external'
  church_name: string | null
  requester_id: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  users?: {
    email: string
    name: string
  }
}

export default function AdminApprovalsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [processing, setProcessing] = useState<string | null>(null)

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
        .from('team_approval_requests')
        .select(`
          *,
          users:requester_id (
            email,
            name
          )
        `)
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

  const handleApprove = async (request: ApprovalRequest) => {
    if (!confirm(`"${request.team_name}" 팀 생성을 승인하시겠습니까?`)) {
      return
    }

    setProcessing(request.id)

    try {
      // 1. 팀 생성
      const { data: newTeam, error: teamError } = await supabase
        .from('teams')
        .insert({
          name: request.team_name,
          type: request.team_type,
          church_name: request.church_name,
          invite_code: Math.random().toString(36).substring(2, 10).toUpperCase(),
          created_by: request.requester_id,
          is_active: true
        })
        .select()
        .single()

      if (teamError) throw teamError

      // 2. 요청자를 리더로 추가
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({
          team_id: newTeam.id,
          user_id: request.requester_id,
          role: 'leader',
          status: 'active',
          joined_at: new Date().toISOString()
        })

      if (memberError) throw memberError

      // 3. 승인 요청 상태 업데이트
      const { error: updateError } = await supabase
        .from('team_approval_requests')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', request.id)

      if (updateError) throw updateError

      alert(`✅ "${request.team_name}" 팀이 생성되었습니다!\n초대 코드: ${newTeam.invite_code}`)
      fetchRequests()
    } catch (error: any) {
      console.error('Error approving request:', error)
      alert(`승인 실패: ${error.message}`)
    } finally {
      setProcessing(null)
    }
  }

  const handleReject = async (request: ApprovalRequest) => {
    const reason = prompt('거부 사유를 입력하세요 (선택사항):')
    if (reason === null) return // 취소

    setProcessing(request.id)

    try {
      const { error } = await supabase
        .from('team_approval_requests')
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
            <h1 className="text-2xl font-bold text-gray-900">팀 승인 관리</h1>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              메인으로
            </button>
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
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              전체 ({requests.length})
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'pending'
                  ? 'bg-yellow-600 text-white'
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
                  ? 'bg-green-600 text-white'
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
                  ? 'bg-red-600 text-white'
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
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
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
                        {request.team_name}
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

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="flex items-center text-gray-700">
                        <Users className="w-5 h-5 mr-2 text-gray-500" />
                        <span className="text-sm">
                          {request.team_type === 'church_internal' ? '교회 내부 팀' : '외부 팀'}
                        </span>
                      </div>
                      {request.church_name && (
                        <div className="flex items-center text-gray-700">
                          <Building2 className="w-5 h-5 mr-2 text-gray-500" />
                          <span className="text-sm">{request.church_name}</span>
                        </div>
                      )}
                    </div>

                    <div className="text-sm text-gray-600">
                      <p>
                        요청자: {request.users?.email || '알 수 없음'}
                      </p>
                      <p>
                        요청일: {new Date(request.created_at).toLocaleString('ko-KR')}
                      </p>
                    </div>
                  </div>

                  {/* 버튼 */}
                  {request.status === 'pending' && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleApprove(request)}
                        disabled={processing === request.id}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                      >
                        <CheckCircle className="mr-2" size={18} />
                        승인
                      </button>
                      <button
                        onClick={() => handleReject(request)}
                        disabled={processing === request.id}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                      >
                        <XCircle className="mr-2" size={18} />
                        거부
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}