'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { logActivity } from '@/lib/activityLogger'
import { ArrowLeft, Users } from 'lucide-react'
import { trackTeamCreate } from '@/lib/analytics'

export default function CreateTeamPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const [teamName, setTeamName] = useState('')
  const [teamType, setTeamType] = useState<'church_internal' | 'external'>('church_internal')
  const [churchName, setChurchName] = useState('')

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
    } catch (error) {
      console.error('Error checking user:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTeam = async () => {
    if (!teamName.trim()) {
      alert('팀 이름을 입력하세요.')
      return
    }

    if (teamType === 'church_internal' && !churchName.trim()) {
      alert('교회 이름을 입력하세요.')
      return
    }

    setCreating(true)

    try {
      // 1. 초대 코드 생성 (6자리 랜덤 영숫자)
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase()

      // 2. 팀 생성
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .insert({
          name: teamName.trim(),
          type: teamType,
          church_name: teamType === 'church_internal' ? churchName.trim() : null,
          invite_code: inviteCode,
          member_count: 1
        })
        .select()
        .single()

      if (teamError) throw teamError

      // 3. 생성자를 리더로 추가
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({
          team_id: teamData.id,
          user_id: user.id,
          role: 'leader',
          status: 'active'
        })

      if (memberError) throw memberError

      // 📊 팀 생성 로깅
      logActivity({
        actionType: 'team_create',
        userId: user.id,
        teamId: teamData.id
      }).catch(err => console.error('팀 생성 로깅 실패:', err))

      // GA4 트래킹
      trackTeamCreate()

      alert('✅ 팀이 생성되었습니다!')
      router.push(`/my-team/${teamData.id}`)
    } catch (error: any) {
      console.error('Error creating team:', error)
      alert(`팀 생성 실패: ${error.message}`)
    } finally {
      setCreating(false)
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
              onClick={() => router.push('/')}
              className="mr-4 p-2 hover:bg-gray-100 rounded-lg touch-manipulation flex items-center text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft size={20} className="mr-1" />
              <span className="text-sm">메인으로</span>
            </button>
            <h1 className="text-2xl font-bold text-gray-900">팀 만들기</h1>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mx-auto mb-6">
            <Users className="w-8 h-8 text-blue-600" />
          </div>

          <h2 className="text-xl font-bold text-center mb-2">새 팀을 만들어보세요</h2>
          <p className="text-gray-600 text-center mb-8">
            팀을 생성하면 자동으로 리더가 되며, 다른 사람들을 초대할 수 있습니다.
          </p>

          <div className="space-y-6">
            {/* 팀 이름 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                팀 이름 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                inputMode="text"
                autoComplete="off"
                autoCapitalize="words"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="예: 청년부 찬양팀"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                maxLength={50}
              />
              <p className="text-xs text-gray-500 mt-1">
                {teamName.length}/50자
              </p>
            </div>

            {/* 팀 유형 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                팀 유형 <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setTeamType('church_internal')}
                  className={`p-4 border-2 rounded-lg text-left transition ${
                    teamType === 'church_internal'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold mb-1">교회 내부 팀</div>
                  <div className="text-xs text-gray-600">
                    같은 교회 소속 팀원들과 함께
                  </div>
                </button>

                <button
                  onClick={() => setTeamType('external')}
                  className={`p-4 border-2 rounded-lg text-left transition ${
                    teamType === 'external'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold mb-1">외부 팀</div>
                  <div className="text-xs text-gray-600">
                    여러 교회 또는 그룹과 함께
                  </div>
                </button>
              </div>
            </div>

            {/* 교회 이름 (교회 내부 팀인 경우만) */}
            {teamType === 'church_internal' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  교회 이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  autoCapitalize="words"
                  value={churchName}
                  onChange={(e) => setChurchName(e.target.value)}
                  placeholder="예: 사랑의교회"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  maxLength={50}
                />
              </div>
            )}

            {/* 안내 문구 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">💡 알아두세요</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• 팀 생성 후 초대 코드가 자동으로 생성됩니다</li>
                <li>• 초대 코드로 다른 사람들을 팀에 초대할 수 있습니다</li>
                <li>• 리더는 팀 설정과 멤버 관리 권한을 가집니다</li>
              </ul>
            </div>

            {/* 버튼 */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => router.push('/my-team')}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                disabled={creating}
              >
                취소
              </button>
              <button
                onClick={handleCreateTeam}
                disabled={creating}
                className="flex-1 px-6 py-3 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8] font-medium disabled:bg-gray-400"
              >
                {creating ? '생성 중...' : '팀 만들기'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}