'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { Team, VerifiedPublisher, OfficialUploader } from '@/lib/supabase'
import {
  ArrowLeft, Users, Building2, Upload, Shield,
  Search, Check, X, ChevronLeft, ChevronRight,
  UserPlus, ShieldOff, Crown, Trash2, Edit2, User,
  Mail, Church, Calendar, MoreVertical
} from 'lucide-react'

type TabType = 'teams' | 'users' | 'uploaders' | 'publishers' | 'admins'

const TABS: { id: TabType; label: string; icon: any }[] = [
  { id: 'teams', label: '팀 관리', icon: Users },
  { id: 'users', label: '사용자', icon: User },
  { id: 'uploaders', label: '공식 업로더', icon: Upload },
  { id: 'publishers', label: '퍼블리셔', icon: Building2 },
  { id: 'admins', label: '관리자', icon: Shield },
]

interface AdminUser {
  id: string
  email: string
  name?: string
  church_name?: string
  created_at?: string
  is_admin: boolean
  email_verified?: boolean
  auth_provider?: string
}

interface EditModal {
  type: 'team' | 'publisher' | 'user'
  data: any
}

export default function AccountManagementPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('teams')

  // 데이터
  const [teams, setTeams] = useState<Team[]>([])
  const [uploaders, setUploaders] = useState<OfficialUploader[]>([])
  const [publishers, setPublishers] = useState<VerifiedPublisher[]>([])
  const [admins, setAdmins] = useState<AdminUser[]>([])

  // 검색
  const [searchQuery, setSearchQuery] = useState('')

  // 관리자 추가
  const [newEmail, setNewEmail] = useState('')
  const [searchResult, setSearchResult] = useState<AdminUser | null>(null)
  const [searchError, setSearchError] = useState('')

  // 처리 중
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())

  // 토스트
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // 삭제 확인
  const [confirmDelete, setConfirmDelete] = useState<any>(null)

  // 수정 모달
  const [editModal, setEditModal] = useState<EditModal | null>(null)
  const [editForm, setEditForm] = useState<any>({})

  // 사용자 목록
  const [users, setUsers] = useState<AdminUser[]>([])

  useEffect(() => {
    const tab = searchParams.get('tab') as TabType
    if (tab && TABS.find(t => t.id === tab)) {
      setActiveTab(tab)
    }
    checkAdminAndLoad()
  }, [])

  useEffect(() => {
    if (!loading) {
      loadData()
    }
  }, [activeTab, loading])

  const checkAdminAndLoad = async () => {
    try {
      const user = await getCurrentUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: userData, error } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (error || !userData?.is_admin) {
        router.push('/')
        return
      }

      setCurrentUser(user)
    } catch (error) {
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  const loadData = async () => {
    switch (activeTab) {
      case 'teams':
        await loadTeams()
        break
      case 'users':
        await loadUsers()
        break
      case 'uploaders':
        await loadUploaders()
        break
      case 'publishers':
        await loadPublishers()
        break
      case 'admins':
        await loadAdmins()
        break
    }
  }

  const loadTeams = async () => {
    const { data } = await supabase
      .from('teams')
      .select('*, team_members(count)')
      .order('created_at', { ascending: false })

    setTeams(data || [])
  }

  const loadUsers = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, email, name, church_name, created_at, is_admin, email_verified, auth_provider')
      .order('created_at', { ascending: false })
      .limit(100)

    setUsers(data || [])
  }

  const loadUploaders = async () => {
    const { data } = await supabase
      .from('official_uploaders')
      .select('*')
      .order('created_at', { ascending: false })

    setUploaders(data || [])
  }

  const loadPublishers = async () => {
    const { data } = await supabase
      .from('verified_publishers')
      .select('*')
      .order('created_at', { ascending: false })

    setPublishers(data || [])
  }

  const loadAdmins = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, email, name, created_at, is_admin')
      .eq('is_admin', true)
      .order('created_at', { ascending: true })

    setAdmins(data || [])
  }

  // 업로더 추가
  const addUploader = async () => {
    if (!newEmail.trim()) return

    const { error } = await supabase
      .from('official_uploaders')
      .insert({ email: newEmail.trim().toLowerCase() })

    if (!error) {
      showToast('공식 업로더가 추가되었습니다.', 'success')
      setNewEmail('')
      loadUploaders()
    } else {
      showToast('추가 중 오류가 발생했습니다.', 'error')
    }
  }

  // 업로더 삭제
  const removeUploader = async (id: string) => {
    const { error } = await supabase
      .from('official_uploaders')
      .delete()
      .eq('id', id)

    if (!error) {
      showToast('업로더가 삭제되었습니다.', 'success')
      setConfirmDelete(null)
      loadUploaders()
    }
  }

  // 퍼블리셔 활성화/비활성화
  const togglePublisher = async (publisher: VerifiedPublisher) => {
    const { error } = await supabase
      .from('verified_publishers')
      .update({ is_active: !publisher.is_active })
      .eq('id', publisher.id)

    if (!error) {
      showToast(publisher.is_active ? '비활성화됨' : '활성화됨', 'success')
      loadPublishers()
    }
  }

  // 팀 수정
  const updateTeam = async () => {
    if (!editModal || editModal.type !== 'team') return

    const { error } = await supabase
      .from('teams')
      .update({
        name: editForm.name,
        church_name: editForm.church_name,
        description: editForm.description
      })
      .eq('id', editModal.data.id)

    if (!error) {
      showToast('팀 정보가 수정되었습니다.', 'success')
      setEditModal(null)
      loadTeams()
    } else {
      showToast('수정 중 오류가 발생했습니다.', 'error')
    }
  }

  // 팀 삭제
  const deleteTeam = async (teamId: string) => {
    try {
      // team_setlists의 songs 먼저 삭제
      const { data: setlists } = await supabase
        .from('team_setlists')
        .select('id')
        .eq('team_id', teamId)

      if (setlists && setlists.length > 0) {
        const setlistIds = setlists.map(s => s.id)
        await supabase.from('team_setlist_songs').delete().in('setlist_id', setlistIds)
      }

      // 관련 테이블 순서대로 삭제 또는 NULL 설정
      await supabase.from('team_setlists').delete().eq('team_id', teamId)
      await supabase.from('team_members').delete().eq('team_id', teamId)
      await supabase.from('role_permissions').delete().in('role_id',
        (await supabase.from('team_roles').select('id').eq('team_id', teamId)).data?.map(r => r.id) || []
      )
      await supabase.from('team_roles').delete().eq('team_id', teamId)
      await supabase.from('team_fixed_songs').delete().eq('team_id', teamId)
      await supabase.from('folders').delete().eq('team_id', teamId)
      await supabase.from('download_logs').update({ team_id: null }).eq('team_id', teamId)
      await supabase.from('song_sheets').update({ team_id: null }).eq('team_id', teamId)

      // 팀 삭제
      const { error } = await supabase.from('teams').delete().eq('id', teamId)

      if (!error) {
        showToast('팀이 삭제되었습니다.', 'success')
        setConfirmDelete(null)
        loadTeams()
      } else {
        console.error('Team delete error:', error)
        showToast(`삭제 실패: ${error.message}`, 'error')
      }
    } catch (err: any) {
      console.error('Team delete error:', err)
      showToast(`삭제 중 오류: ${err.message}`, 'error')
    }
  }

  // 퍼블리셔 수정
  const updatePublisher = async () => {
    if (!editModal || editModal.type !== 'publisher') return

    const { error } = await supabase
      .from('verified_publishers')
      .update({
        name: editForm.name,
        description: editForm.description,
        contact_email: editForm.contact_email,
        website_url: editForm.website_url
      })
      .eq('id', editModal.data.id)

    if (!error) {
      showToast('퍼블리셔 정보가 수정되었습니다.', 'success')
      setEditModal(null)
      loadPublishers()
    } else {
      showToast('수정 중 오류가 발생했습니다.', 'error')
    }
  }

  // 퍼블리셔 삭제
  const deletePublisher = async (publisherId: string) => {
    try {
      // songs에서 publisher_id를 NULL로 설정
      await supabase.from('songs').update({ publisher_id: null }).eq('publisher_id', publisherId)
      // publisher_accounts 삭제
      await supabase.from('publisher_accounts').delete().eq('publisher_id', publisherId)

      const { error } = await supabase
        .from('verified_publishers')
        .delete()
        .eq('id', publisherId)

      if (!error) {
        showToast('퍼블리셔가 삭제되었습니다.', 'success')
        setConfirmDelete(null)
        loadPublishers()
      } else {
        console.error('Publisher delete error:', error)
        showToast(`삭제 실패: ${error.message}`, 'error')
      }
    } catch (err: any) {
      console.error('Publisher delete error:', err)
      showToast(`삭제 중 오류: ${err.message}`, 'error')
    }
  }

  // 사용자 수정
  const updateUser = async () => {
    if (!editModal || editModal.type !== 'user') return

    const { error } = await supabase
      .from('users')
      .update({
        name: editForm.name,
        church_name: editForm.church_name
      })
      .eq('id', editModal.data.id)

    if (!error) {
      showToast('사용자 정보가 수정되었습니다.', 'success')
      setEditModal(null)
      loadUsers()
    } else {
      showToast('수정 중 오류가 발생했습니다.', 'error')
    }
  }

  // 사용자 삭제
  const deleteUser = async (userId: string) => {
    if (userId === currentUser?.id) {
      showToast('본인 계정은 삭제할 수 없습니다.', 'error')
      return
    }

    try {
      // 관련 테이블 순서대로 삭제 또는 NULL 설정
      const deleteResults = await Promise.allSettled([
        supabase.from('team_members').delete().eq('user_id', userId),
        supabase.from('activity_logs').delete().eq('user_id', userId),
        supabase.from('download_logs').delete().eq('user_id', userId),
        supabase.from('folders').delete().eq('user_id', userId),
        supabase.from('song_likes').delete().eq('user_id', userId),
        supabase.from('user_favorite_songforms').delete().eq('user_id', userId),
        supabase.from('user_song_settings').delete().eq('user_id', userId),
        supabase.from('sheet_music_notes').delete().eq('user_id', userId),
        supabase.from('feedbacks').update({ user_id: null }).eq('user_id', userId),
        supabase.from('song_sheets').update({ uploaded_by: null }).eq('uploaded_by', userId),
        supabase.from('songs').update({ uploaded_by: null }).eq('uploaded_by', userId),
      ])

      // NULL로 설정 (삭제하면 안 되는 데이터)
      await Promise.allSettled([
        supabase.from('teams').update({ created_by: null }).eq('created_by', userId),
        supabase.from('team_setlists').update({ created_by: null }).eq('created_by', userId),
        supabase.from('team_fixed_songs').update({ created_by: null }).eq('created_by', userId),
        supabase.from('team_approval_requests').update({ requester_id: null }).eq('requester_id', userId),
        supabase.from('team_approval_requests').update({ approved_by: null }).eq('approved_by', userId),
        supabase.from('official_uploaders').update({ created_by: null }).eq('created_by', userId),
        supabase.from('song_approval_requests').update({ requester_id: null }).eq('requester_id', userId),
        supabase.from('song_approval_requests').update({ approved_by: null }).eq('approved_by', userId),
        supabase.from('verified_publishers').update({ created_by: null }).eq('created_by', userId),
      ])

      // public.users 삭제
      const { error } = await supabase.from('users').delete().eq('id', userId)
      if (error) {
        console.error('User delete error:', error)
        showToast(`삭제 실패: ${error.message}`, 'error')
        return
      }

      // auth.users 삭제 (service_role API)
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ userId }),
      })

      if (!res.ok) {
        const data = await res.json()
        console.error('Auth delete error:', data.error)
        showToast(`계정 데이터는 삭제되었으나 인증 정보 삭제 실패: ${data.error}`, 'error')
      } else {
        showToast('사용자가 완전히 삭제되었습니다.', 'success')
      }

      setConfirmDelete(null)
      loadUsers()
    } catch (err: any) {
      console.error('User delete error:', err)
      showToast(`삭제 중 오류: ${err.message}`, 'error')
    }
  }

  // 수정 모달 열기
  const openEditModal = (type: 'team' | 'publisher' | 'user', data: any) => {
    setEditModal({ type, data })
    setEditForm({ ...data })
  }

  // 관리자 검색
  const searchUserByEmail = async () => {
    if (!newEmail.trim()) {
      setSearchError('이메일을 입력해주세요.')
      return
    }

    setSearchError('')
    setSearchResult(null)

    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, is_admin')
      .eq('email', newEmail.trim().toLowerCase())
      .single()

    if (error || !data) {
      setSearchError('해당 이메일의 사용자를 찾을 수 없습니다.')
      return
    }

    if (data.is_admin) {
      setSearchError('이미 관리자입니다.')
      return
    }

    setSearchResult(data)
  }

  // 관리자 추가
  const addAdmin = async () => {
    if (!searchResult) return

    const { error } = await supabase
      .from('users')
      .update({ is_admin: true })
      .eq('id', searchResult.id)

    if (!error) {
      showToast(`${searchResult.email}을(를) 관리자로 추가했습니다.`, 'success')
      setNewEmail('')
      setSearchResult(null)
      loadAdmins()
    }
  }

  // 관리자 제거
  const removeAdmin = async (admin: AdminUser) => {
    if (admin.id === currentUser?.id) {
      showToast('본인의 관리자 권한은 제거할 수 없습니다.', 'error')
      return
    }

    const { error } = await supabase
      .from('users')
      .update({ is_admin: false })
      .eq('id', admin.id)

    if (!error) {
      showToast(`${admin.email}의 관리자 권한을 제거했습니다.`, 'success')
      setConfirmDelete(null)
      loadAdmins()
    }
  }

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    setSearchQuery('')
    setNewEmail('')
    setSearchResult(null)
    setSearchError('')
    router.push(`/admin/account-management?tab=${tab}`, { scroll: false })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">계정 관리</h1>
              <p className="text-sm text-gray-500">팀, 업로더, 퍼블리셔, 관리자 관리</p>
            </div>
          </div>
        </div>

        {/* 탭 네비게이션 */}
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto pb-px">
            {TABS.map(tab => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition ${
                    isActive
                      ? 'border-violet-600 text-violet-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* 팀 관리 탭 */}
        {activeTab === 'teams' && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">팀 목록 ({teams.length})</h2>
            </div>
            {teams.length === 0 ? (
              <p className="text-gray-500 text-center py-8">팀이 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {teams.map(team => (
                  <div key={team.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900">{team.name}</h3>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            team.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {team.is_active ? '활성' : '비활성'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">
                          {team.church_name || team.type} · 멤버 {(team as any).team_members?.[0]?.count || 0}명
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(team.created_at || '').toLocaleDateString('ko-KR')} 생성
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal('team', team)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="수정"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete({ type: 'team', data: team })}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                          title="삭제"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 사용자 관리 탭 */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">사용자 목록 ({users.length})</h2>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="이메일 또는 이름 검색"
                  className="px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-violet-500"
                />
              </div>
            </div>
            {users.length === 0 ? (
              <p className="text-gray-500 text-center py-8">사용자가 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">이메일</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">이름</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">교회</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">가입일</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">인증상태</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users
                      .filter(user => {
                        if (!searchQuery) return true
                        const q = searchQuery.toLowerCase()
                        return user.email.toLowerCase().includes(q) ||
                               user.name?.toLowerCase().includes(q)
                      })
                      .map(user => (
                        <tr key={user.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm text-gray-900">{user.email}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">{user.name || '-'}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">{user.church_name || '-'}</td>
                          <td className="py-3 px-4 text-sm text-gray-500">
                            {new Date(user.created_at || '').toLocaleDateString('ko-KR')}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {user.is_admin && (
                                <span className="px-2 py-0.5 text-xs bg-violet-100 text-violet-700 rounded-full">
                                  관리자
                                </span>
                              )}
                              {user.auth_provider === 'google' ? (
                                <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                                  구글 로그인
                                </span>
                              ) : user.email_verified ? (
                                <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                                  인증완료
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full">
                                  미인증
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openEditModal('user', user)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                                title="수정"
                              >
                                <Edit2 size={16} />
                              </button>
                              {user.id !== currentUser?.id && (
                                <button
                                  onClick={() => setConfirmDelete({ type: 'user', data: user })}
                                  className="p-1.5 text-red-500 hover:bg-red-50 rounded transition"
                                  title="삭제"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 공식 업로더 탭 */}
        {activeTab === 'uploaders' && (
          <div className="space-y-6">
            {/* 업로더 추가 */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <UserPlus size={20} className="text-pink-600" />
                공식 업로더 추가
              </h2>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addUploader()}
                  placeholder="업로더 이메일 입력"
                  className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500"
                />
                <button
                  onClick={addUploader}
                  className="px-4 py-2 bg-pink-100 text-pink-700 rounded-lg hover:bg-pink-200 transition"
                >
                  추가
                </button>
              </div>
            </div>

            {/* 업로더 목록 */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="font-semibold text-gray-900 mb-4">현재 공식 업로더 ({uploaders.length}명)</h2>
              {uploaders.length === 0 ? (
                <p className="text-gray-500 text-center py-8">공식 업로더가 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {uploaders.map(uploader => (
                    <div key={uploader.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{uploader.email}</p>
                        {uploader.name && <p className="text-sm text-gray-500">{uploader.name}</p>}
                      </div>
                      <button
                        onClick={() => setConfirmDelete({ type: 'uploader', data: uploader })}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 퍼블리셔 탭 */}
        {activeTab === 'publishers' && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="font-semibold text-gray-900 mb-4">퍼블리셔 목록 ({publishers.length})</h2>
            {publishers.length === 0 ? (
              <p className="text-gray-500 text-center py-8">퍼블리셔가 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {publishers.map(publisher => (
                  <div key={publisher.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900">{publisher.name}</h3>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            publisher.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {publisher.is_active ? '활성' : '비활성'}
                          </span>
                        </div>
                        {publisher.description && (
                          <p className="text-sm text-gray-500 mt-1">{publisher.description}</p>
                        )}
                        {publisher.contact_email && (
                          <p className="text-xs text-gray-400 mt-1">{publisher.contact_email}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => togglePublisher(publisher)}
                          className={`px-3 py-1 text-sm rounded-lg transition ${
                            publisher.is_active
                              ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          {publisher.is_active ? '비활성화' : '활성화'}
                        </button>
                        <button
                          onClick={() => openEditModal('publisher', publisher)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="수정"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete({ type: 'publisher', data: publisher })}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                          title="삭제"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 관리자 탭 */}
        {activeTab === 'admins' && (
          <div className="space-y-6">
            {/* 관리자 추가 */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <UserPlus size={20} className="text-violet-600" />
                관리자 추가
              </h2>
              <div className="flex gap-2 mb-3">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => {
                    setNewEmail(e.target.value)
                    setSearchResult(null)
                    setSearchError('')
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && searchUserByEmail()}
                  placeholder="추가할 사용자의 이메일 입력"
                  className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500"
                />
                <button
                  onClick={searchUserByEmail}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition flex items-center gap-2"
                >
                  <Search size={18} />
                  검색
                </button>
              </div>

              {searchError && <p className="text-red-500 text-sm mb-3">{searchError}</p>}

              {searchResult && (
                <div className="flex items-center justify-between p-4 bg-violet-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{searchResult.email}</p>
                    {searchResult.name && <p className="text-sm text-gray-500">{searchResult.name}</p>}
                  </div>
                  <button
                    onClick={addAdmin}
                    className="px-4 py-2 bg-violet-100 hover:bg-violet-200 text-violet-700 rounded-lg transition flex items-center gap-2"
                  >
                    <Shield size={18} />
                    관리자로 추가
                  </button>
                </div>
              )}
            </div>

            {/* 관리자 목록 */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="font-semibold text-gray-900 mb-4">현재 관리자 ({admins.length}명)</h2>
              <div className="space-y-3">
                {admins.map(admin => {
                  const isCurrentUser = admin.id === currentUser?.id
                  return (
                    <div
                      key={admin.id}
                      className={`flex items-center justify-between p-4 rounded-lg ${
                        isCurrentUser ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          isCurrentUser ? 'bg-blue-100' : 'bg-gray-200'
                        }`}>
                          {isCurrentUser ? (
                            <Crown size={20} className="text-blue-700" />
                          ) : (
                            <Shield size={20} className="text-gray-600" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">{admin.email}</p>
                            {isCurrentUser && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">나</span>
                            )}
                          </div>
                          {admin.name && <p className="text-sm text-gray-500">{admin.name}</p>}
                        </div>
                      </div>

                      {!isCurrentUser && (
                        <button
                          onClick={() => setConfirmDelete({ type: 'admin', data: admin })}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                        >
                          <ShieldOff size={20} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 삭제 확인 모달 */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="font-bold text-gray-900 mb-2">
              {confirmDelete.type === 'admin' ? '관리자 권한 제거' :
               confirmDelete.type === 'team' ? '팀 삭제' :
               confirmDelete.type === 'user' ? '사용자 삭제' :
               confirmDelete.type === 'publisher' ? '퍼블리셔 삭제' : '삭제 확인'}
            </h3>
            <p className="text-gray-600 mb-6">
              <strong>{confirmDelete.data.email || confirmDelete.data.name}</strong>
              {confirmDelete.type === 'admin' ? '의 관리자 권한을 제거하시겠습니까?' :
               confirmDelete.type === 'team' ? ' 팀을 삭제하시겠습니까? 팀원 정보도 함께 삭제됩니다.' :
               confirmDelete.type === 'user' ? '을(를) 삭제하시겠습니까? 모든 활동 기록이 삭제됩니다.' :
               '을(를) 삭제하시겠습니까?'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
              >
                취소
              </button>
              <button
                onClick={() => {
                  if (confirmDelete.type === 'admin') {
                    removeAdmin(confirmDelete.data)
                  } else if (confirmDelete.type === 'uploader') {
                    removeUploader(confirmDelete.data.id)
                  } else if (confirmDelete.type === 'team') {
                    deleteTeam(confirmDelete.data.id)
                  } else if (confirmDelete.type === 'publisher') {
                    deletePublisher(confirmDelete.data.id)
                  } else if (confirmDelete.type === 'user') {
                    deleteUser(confirmDelete.data.id)
                  }
                }}
                className="flex-1 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition"
              >
                {confirmDelete.type === 'admin' ? '권한 제거' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 수정 모달 */}
      {editModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6">
            <h3 className="font-bold text-gray-900 mb-4">
              {editModal.type === 'team' ? '팀 정보 수정' :
               editModal.type === 'publisher' ? '퍼블리셔 정보 수정' :
               editModal.type === 'user' ? '사용자 정보 수정' : '수정'}
            </h3>

            <div className="space-y-4">
              {/* 팀 수정 폼 */}
              {editModal.type === 'team' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">팀 이름</label>
                    <input
                      type="text"
                      value={editForm.name || ''}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">교회명</label>
                    <input
                      type="text"
                      value={editForm.church_name || ''}
                      onChange={(e) => setEditForm({ ...editForm, church_name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                    <textarea
                      value={editForm.description || ''}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500"
                      rows={3}
                    />
                  </div>
                </>
              )}

              {/* 퍼블리셔 수정 폼 */}
              {editModal.type === 'publisher' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">퍼블리셔 이름</label>
                    <input
                      type="text"
                      value={editForm.name || ''}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                    <textarea
                      value={editForm.description || ''}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">연락처 이메일</label>
                    <input
                      type="email"
                      value={editForm.contact_email || ''}
                      onChange={(e) => setEditForm({ ...editForm, contact_email: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">웹사이트 URL</label>
                    <input
                      type="url"
                      value={editForm.website_url || ''}
                      onChange={(e) => setEditForm({ ...editForm, website_url: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                </>
              )}

              {/* 사용자 수정 폼 */}
              {editModal.type === 'user' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
                    <input
                      type="email"
                      value={editForm.email || ''}
                      disabled
                      className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
                    <input
                      type="text"
                      value={editForm.name || ''}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">교회명</label>
                    <input
                      type="text"
                      value={editForm.church_name || ''}
                      onChange={(e) => setEditForm({ ...editForm, church_name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditModal(null)}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
              >
                취소
              </button>
              <button
                onClick={() => {
                  if (editModal.type === 'team') updateTeam()
                  else if (editModal.type === 'publisher') updatePublisher()
                  else if (editModal.type === 'user') updateUser()
                }}
                className="flex-1 px-4 py-2 bg-violet-100 hover:bg-violet-200 text-violet-700 rounded-lg transition"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 토스트 */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-6 py-3 rounded-xl shadow-lg font-medium z-50 ${
          toast.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
