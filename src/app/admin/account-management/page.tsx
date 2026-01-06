'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { Team, VerifiedPublisher, OfficialUploader } from '@/lib/supabase'
import {
  ArrowLeft, Users, Building2, Upload, Shield,
  Search, Check, X, ChevronLeft, ChevronRight,
  UserPlus, ShieldOff, Crown, Trash2
} from 'lucide-react'

type TabType = 'team-approvals' | 'uploaders' | 'publishers' | 'admins'

const TABS: { id: TabType; label: string; icon: any }[] = [
  { id: 'team-approvals', label: '팀 승인', icon: Users },
  { id: 'uploaders', label: '공식 업로더', icon: Upload },
  { id: 'publishers', label: '퍼블리셔', icon: Building2 },
  { id: 'admins', label: '관리자', icon: Shield },
]

interface AdminUser {
  id: string
  email: string
  name?: string
  created_at?: string
  is_admin: boolean
}

export default function AccountManagementPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('team-approvals')

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
      case 'team-approvals':
        await loadPendingTeams()
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

  const loadPendingTeams = async () => {
    // 팀 승인 대기 목록 (status가 pending인 팀원이 있는 팀)
    const { data } = await supabase
      .from('teams')
      .select('*')
      .order('created_at', { ascending: false })

    setTeams(data || [])
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
        {/* 팀 승인 탭 */}
        {activeTab === 'team-approvals' && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="font-semibold text-gray-900 mb-4">팀 목록</h2>
            {teams.length === 0 ? (
              <p className="text-gray-500 text-center py-8">팀이 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {teams.map(team => (
                  <div key={team.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{team.name}</h3>
                        <p className="text-sm text-gray-500">{team.church_name || team.type}</p>
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(team.created_at || '').toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                  </div>
                ))}
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
                  className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition"
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
                  <div key={publisher.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">{publisher.name}</h3>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          publisher.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {publisher.is_active ? '활성' : '비활성'}
                        </span>
                      </div>
                      {publisher.description && (
                        <p className="text-sm text-gray-500">{publisher.description}</p>
                      )}
                    </div>
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
                    className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition flex items-center gap-2"
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
                          isCurrentUser ? 'bg-blue-600' : 'bg-gray-400'
                        }`}>
                          {isCurrentUser ? (
                            <Crown size={20} className="text-white" />
                          ) : (
                            <Shield size={20} className="text-white" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">{admin.email}</p>
                            {isCurrentUser && (
                              <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">나</span>
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
              {confirmDelete.type === 'admin' ? '관리자 권한 제거' : '삭제 확인'}
            </h3>
            <p className="text-gray-600 mb-6">
              <strong>{confirmDelete.data.email}</strong>
              {confirmDelete.type === 'admin' ? '의 관리자 권한을 제거하시겠습니까?' : '을(를) 삭제하시겠습니까?'}
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
                  }
                }}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
              >
                {confirmDelete.type === 'admin' ? '권한 제거' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 토스트 */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-6 py-3 rounded-xl shadow-lg text-white font-medium z-50 ${
          toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
