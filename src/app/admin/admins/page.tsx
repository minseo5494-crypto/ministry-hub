'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import {
  ArrowLeft, UserPlus, Shield, ShieldOff, Search,
  Trash2, Crown, AlertTriangle
} from 'lucide-react'

interface AdminUser {
  id: string
  email: string
  name?: string
  created_at?: string
  is_admin: boolean
}

export default function AdminsManagePage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [admins, setAdmins] = useState<AdminUser[]>([])

  // 관리자 추가
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [searchResult, setSearchResult] = useState<AdminUser | null>(null)
  const [searchError, setSearchError] = useState('')

  // 토스트
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // 삭제 확인 모달
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null)

  useEffect(() => {
    checkAdminAndLoad()
  }, [])

  const checkAdminAndLoad = async () => {
    try {
      const user = await getCurrentUser()
      if (!user) {
        alert('로그인이 필요합니다.')
        router.push('/login')
        return
      }

      const { data: userData, error } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (error || !userData?.is_admin) {
        alert('관리자 권한이 필요합니다.')
        router.push('/')
        return
      }

      setCurrentUser(user)
      await loadAdmins()
    } catch (error) {
      console.error('Error checking admin:', error)
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  const loadAdmins = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, created_at, is_admin')
      .eq('is_admin', true)
      .order('created_at', { ascending: true })

    if (!error && data) {
      setAdmins(data)
    }
  }

  // 이메일로 사용자 검색
  const searchUserByEmail = async () => {
    if (!newAdminEmail.trim()) {
      setSearchError('이메일을 입력해주세요.')
      return
    }

    setSearchError('')
    setSearchResult(null)

    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, is_admin')
      .eq('email', newAdminEmail.trim().toLowerCase())
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

    setAdding(true)

    try {
      const { error } = await supabase
        .from('users')
        .update({ is_admin: true })
        .eq('id', searchResult.id)

      if (error) throw error

      showToast(`${searchResult.email}을(를) 관리자로 추가했습니다.`, 'success')
      setNewAdminEmail('')
      setSearchResult(null)
      await loadAdmins()
    } catch (error) {
      console.error('Error adding admin:', error)
      showToast('관리자 추가 중 오류가 발생했습니다.', 'error')
    } finally {
      setAdding(false)
    }
  }

  // 관리자 권한 제거
  const removeAdmin = async (admin: AdminUser) => {
    // 본인 제거 방지
    if (admin.id === currentUser?.id) {
      showToast('본인의 관리자 권한은 제거할 수 없습니다.', 'error')
      return
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({ is_admin: false })
        .eq('id', admin.id)

      if (error) throw error

      showToast(`${admin.email}의 관리자 권한을 제거했습니다.`, 'success')
      setConfirmDelete(null)
      await loadAdmins()
    } catch (error) {
      console.error('Error removing admin:', error)
      showToast('권한 제거 중 오류가 발생했습니다.', 'error')
    }
  }

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
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
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin/dashboard')}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">관리자 관리</h1>
              <p className="text-sm text-gray-500">
                현재 {admins.length}명의 관리자
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* 관리자 추가 */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <UserPlus size={20} className="text-violet-600" />
            관리자 추가
          </h2>

          <div className="flex gap-2 mb-3">
            <input
              type="email"
              value={newAdminEmail}
              onChange={(e) => {
                setNewAdminEmail(e.target.value)
                setSearchResult(null)
                setSearchError('')
              }}
              onKeyDown={(e) => e.key === 'Enter' && searchUserByEmail()}
              placeholder="추가할 사용자의 이메일 입력"
              className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            />
            <button
              onClick={searchUserByEmail}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition flex items-center gap-2"
            >
              <Search size={18} />
              검색
            </button>
          </div>

          {searchError && (
            <p className="text-red-500 text-sm mb-3">{searchError}</p>
          )}

          {searchResult && (
            <div className="flex items-center justify-between p-4 bg-violet-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">{searchResult.email}</p>
                {searchResult.name && (
                  <p className="text-sm text-gray-500">{searchResult.name}</p>
                )}
              </div>
              <button
                onClick={addAdmin}
                disabled={adding}
                className="px-4 py-2 bg-violet-100 hover:bg-violet-200 disabled:bg-violet-400 text-white rounded-lg transition flex items-center gap-2"
              >
                <Shield size={18} />
                {adding ? '추가 중...' : '관리자로 추가'}
              </button>
            </div>
          )}
        </div>

        {/* 현재 관리자 목록 */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Shield size={20} className="text-blue-600" />
            현재 관리자 목록
          </h2>

          <div className="space-y-3">
            {admins.map((admin) => {
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
                      isCurrentUser ? 'bg-blue-100' : 'bg-gray-400'
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
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            나
                          </span>
                        )}
                      </div>
                      {admin.name && (
                        <p className="text-sm text-gray-500">{admin.name}</p>
                      )}
                      <p className="text-xs text-gray-400">
                        가입일: {new Date(admin.created_at || '').toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                  </div>

                  {!isCurrentUser && (
                    <button
                      onClick={() => setConfirmDelete(admin)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                      title="관리자 권한 제거"
                    >
                      <ShieldOff size={20} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {admins.length === 0 && (
            <p className="text-center text-gray-500 py-8">관리자가 없습니다.</p>
          )}
        </div>

        {/* 안내 문구 */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-1">관리자 권한 안내</p>
              <ul className="list-disc list-inside space-y-1 text-yellow-700">
                <li>관리자는 모든 곡, 사용자, 통계에 접근할 수 있습니다.</li>
                <li>신뢰할 수 있는 사용자에게만 권한을 부여하세요.</li>
                <li>본인의 관리자 권한은 제거할 수 없습니다.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <ShieldOff className="text-red-600" size={24} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">관리자 권한 제거</h3>
                <p className="text-sm text-gray-500">이 작업은 되돌릴 수 있습니다.</p>
              </div>
            </div>

            <p className="text-gray-700 mb-6">
              <strong>{confirmDelete.email}</strong>의 관리자 권한을 제거하시겠습니까?
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
              >
                취소
              </button>
              <button
                onClick={() => removeAdmin(confirmDelete)}
                className="flex-1 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition"
              >
                권한 제거
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 토스트 */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-6 py-3 rounded-xl shadow-lg text-white font-medium z-50 ${
          toast.type === 'success' ? 'bg-green-100' : 'bg-red-100'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
