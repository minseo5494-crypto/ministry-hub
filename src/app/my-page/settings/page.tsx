'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { ArrowLeft, Save, Trash2, User, Lock, Mail } from 'lucide-react'

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
        setUserEmail(userData.email || '')
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
    const confirmation = prompt(
      '정말 계정을 삭제하시겠습니까?\n모든 데이터가 영구적으로 삭제됩니다.\n삭제하려면 이메일 주소를 입력하세요:',
      ''
    )

    if (confirmation !== userEmail) {
      alert('이메일 주소가 일치하지 않습니다.')
      return
    }

    try {
      // 사용자 삭제 (Supabase의 ON DELETE CASCADE로 관련 데이터 자동 삭제)
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', user.id)

      if (error) throw error

      // 로그아웃
      await supabase.auth.signOut()

      alert('✅ 계정이 삭제되었습니다.')
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
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center">
            <button
              onClick={() => router.push('/my-page')}
              className="mr-4 p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">설정</h1>
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
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:bg-gray-400 flex items-center justify-center"
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
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:bg-gray-400 flex items-center justify-center"
            >
              <Lock className="mr-2" size={18} />
              {changingPassword ? '변경 중...' : '비밀번호 변경'}
            </button>
          </div>
        </div>

        {/* 위험 구역 */}
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-red-900 mb-4">위험 구역</h2>
          <p className="text-sm text-red-700 mb-4">
            ⚠️ 계정을 삭제하면 모든 콘티, 폴더, 업로드한 곡이 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
          </p>
          <button
            onClick={handleDeleteAccount}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center"
          >
            <Trash2 className="mr-2" size={18} />
            계정 삭제
          </button>
        </div>
      </div>
    </div>
  )
}