'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { ArrowLeft, Save, Trash2, User, Lock, Mail } from 'lucide-react'
import Link from 'next/link'

export default function MyPageSettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // 프로필 정보
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')

  // 비밀번호 변경
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    try {
      const currentUser = await getCurrentUser()
      if (!currentUser) {
        alert('로그인이 필요합니다.')
        router.push('/login')
        return
      }
      setUser(currentUser)

      // 사용자 정보 가져오기
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', currentUser.id)
        .single()

      if (userData) {
        setUserName(userData.name || '')
        setUserEmail(userData.email || currentUser.email || '')
      }
    } catch (error) {
      console.error('Error checking user:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!userName.trim()) {
      alert('이름을 입력하세요.')
      return
    }

    setSaving(true)

    try {
      const { error } = await supabase
        .from('users')
        .update({
          name: userName.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error

      alert('✅ 프로필이 저장되었습니다.')
    } catch (error: any) {
      console.error('Error saving profile:', error)
      alert(`저장 실패: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      alert('모든 필드를 입력하세요.')
      return
    }

    if (newPassword !== confirmPassword) {
      alert('새 비밀번호가 일치하지 않습니다.')
      return
    }

    if (newPassword.length < 6) {
      alert('비밀번호는 최소 6자 이상이어야 합니다.')
      return
    }

    setChangingPassword(true)

    try {
      // Supabase Auth로 비밀번호 변경
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) throw error

      alert('✅ 비밀번호가 변경되었습니다.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      console.error('Error changing password:', error)
      alert(`비밀번호 변경 실패: ${error.message}`)
    } finally {
      setChangingPassword(false)
    }
  }

  const handleDeleteAccount = async () => {
    // Auth에서 직접 이메일 가져오기
    const { data: { user: authUser } } = await supabase.auth.getUser()
    const accountEmail = authUser?.email || user?.email || userEmail

    const confirmation = prompt(
      '정말 계정을 삭제하시겠습니까?\n\n' +
      '• 전체공개/팀공유 곡은 유지됩니다\n' +
      '• 나만보기 곡은 영구 삭제됩니다\n' +
      '• 개인 필기, 좋아요, 팀 멤버십은 삭제됩니다\n\n' +
      '삭제하려면 이메일 주소를 입력하세요:',
      ''
    )

    if (!accountEmail || confirmation?.trim() !== accountEmail) {
      alert('이메일 주소가 일치하지 않습니다.')
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        alert('세션이 만료되었습니다. 다시 로그인 해주세요.')
        router.push('/login')
        return
      }

      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '계정 삭제에 실패했습니다.')
      }

      await supabase.auth.signOut()
      alert('계정이 삭제되었습니다.')
      router.push('/')
    } catch (error: any) {
      console.error('Error deleting account:', error)
      alert(`계정 삭제 실패: ${error.message}`)
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
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            {/* 뒤로가기 */}
            <button
              onClick={() => router.push('/my-page')}
              className="p-2 -ml-2 hover:bg-gray-100 rounded-lg"
              title="뒤로가기 (마이페이지)"
            >
              <span className="material-symbols-outlined text-xl text-slate-600">arrow_back</span>
            </button>
            {/* 로고 */}
            <Link href="/main" className="text-lg font-logo text-slate-700 hover:text-indigo-600 transition-colors">
              WORSHEEP
            </Link>
            <span className="text-slate-300">|</span>
            <h1 className="text-lg font-bold text-gray-900">설정</h1>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* 프로필 정보 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center mb-6">
            <User className="w-6 h-6 text-blue-600 mr-2" />
            <h2 className="text-xl font-bold">프로필 정보</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이름
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="이름을 입력하세요"
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이메일 <span className="text-gray-500 text-sm">(변경 불가)</span>
              </label>
              <div className="flex items-center">
                <Mail className="w-5 h-5 text-gray-400 mr-2" />
                <input
                  type="email"
                  value={userEmail}
                  readOnly
                  className="flex-1 px-4 py-2 border rounded-lg bg-gray-50 text-gray-600"
                />
              </div>
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="w-full px-4 py-3 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8] font-medium disabled:bg-gray-400 flex items-center justify-center"
            >
              <Save className="mr-2" size={18} />
              {saving ? '저장 중...' : '프로필 저장'}
            </button>
          </div>
        </div>

        {/* 비밀번호 변경 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center mb-6">
            <Lock className="w-6 h-6 text-green-600 mr-2" />
            <h2 className="text-xl font-bold">비밀번호 변경</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                현재 비밀번호
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="현재 비밀번호"
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                새 비밀번호
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="새 비밀번호 (최소 6자)"
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                새 비밀번호 확인
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="새 비밀번호 확인"
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>

            <button
              onClick={handleChangePassword}
              disabled={changingPassword}
              className="w-full px-4 py-3 bg-[#84B9C0] text-white rounded-lg hover:bg-[#6FA5AC] font-medium disabled:bg-gray-400 flex items-center justify-center"
            >
              <Lock className="mr-2" size={18} />
              {changingPassword ? '변경 중...' : '비밀번호 변경'}
            </button>
          </div>
        </div>

        {/* 위험 구역 */}
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-red-900 mb-4">위험 구역</h2>
          <div className="mb-4 space-y-2">
            <p className="text-sm font-medium text-red-800">계정 삭제 시 데이터 처리 안내:</p>
            <ul className="text-sm text-red-700 space-y-1 ml-4 list-disc">
              <li>전체공개/팀공유 곡은 <strong>유지</strong>됩니다 (업로더 정보만 제거)</li>
              <li>나만보기 곡은 <strong>영구 삭제</strong>됩니다</li>
              <li>개인 필기, 좋아요, 팀 멤버십은 <strong>삭제</strong>됩니다</li>
            </ul>
            <p className="text-xs text-red-600 mt-2">이 작업은 되돌릴 수 없습니다.</p>
          </div>
          <button
            onClick={handleDeleteAccount}
            className="px-6 py-3 bg-[#E26559] text-white rounded-lg hover:bg-[#D14E42] font-medium flex items-center"
          >
            <Trash2 className="mr-2" size={18} />
            계정 삭제
          </button>
        </div>
      </div>
    </div>
  )
}