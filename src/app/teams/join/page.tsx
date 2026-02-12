'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { logActivity } from '@/lib/activityLogger'
import { ArrowLeft, UserPlus } from 'lucide-react'
import { trackTeamJoin } from '@/lib/analytics'
import Link from 'next/link'

export default function JoinTeamPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [inviteCode, setInviteCode] = useState('')

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

  const handleJoinTeam = async () => {
    if (!inviteCode.trim()) {
      alert('초대 코드를 입력하세요.')
      return
    }

    setJoining(true)

    try {
      // 0. 팀 개수 제한 체크 (최대 10개)
      const { count: teamCount } = await supabase
        .from('team_members')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('status', ['active', 'pending'])
      if ((teamCount ?? 0) >= 10) {
        alert('팀은 최대 10개까지 참여할 수 있습니다.')
        setJoining(false)
        return
      }

      // 1. 초대 코드로 팀 찾기
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('invite_code', inviteCode.trim().toUpperCase())
        .single()

      if (teamError || !teamData) {
        alert('❌ 유효하지 않은 초대 코드입니다.')
        setJoining(false)
        return
      }

      // 2. 이미 팀 멤버인지 또는 신청 중인지 확인
      const { data: existingMember } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', teamData.id)
        .eq('user_id', user.id)
        .single()

      if (existingMember) {
        if (existingMember.status === 'pending') {
          alert('이미 가입 신청 중입니다. 팀 리더의 승인을 기다려주세요.')
        } else {
          alert('이미 이 팀의 멤버입니다.')
          router.push(`/my-team/${teamData.id}`)
        }
        return
      }

      // 3. 팀에 가입 신청 (pending 상태로)
      const insertData = {
        team_id: teamData.id,
        user_id: user.id,
        role: 'member',
        status: 'pending'  // 승인 대기 상태
      }
      console.log('🔵 Inserting team member with data:', insertData)

      const { data: insertResult, error: memberError } = await supabase
        .from('team_members')
        .insert(insertData)
        .select()

      console.log('🟢 Insert result:', insertResult, 'Error:', memberError)

      if (memberError) throw memberError

      // 📊 팀 가입 신청 로깅
      logActivity({
        actionType: 'team_join_request',
        userId: user.id,
        teamId: teamData.id
      }).catch(err => console.error('팀 가입 신청 로깅 실패:', err))

      // GA4 트래킹
      trackTeamJoin()

      alert(`✅ "${teamData.name}" 팀에 가입 신청을 보냈습니다!\n팀 리더의 승인을 기다려주세요.`)
      router.push('/my-team')
    } catch (error: any) {
      console.error('Error joining team:', error)
      alert(`팀 참여 실패: ${error.message}`)
    } finally {
      setJoining(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !joining) {
      handleJoinTeam()
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
              onClick={() => router.push('/my-team')}
              className="p-2 -ml-2 hover:bg-gray-100 rounded-lg"
              title="뒤로가기 (팀 목록)"
            >
              <span className="material-symbols-outlined text-xl text-slate-600">arrow_back</span>
            </button>
            {/* 로고 */}
            <Link href="/main" className="text-lg font-logo text-slate-700 hover:text-indigo-600 transition-colors">
              WORSHEEP
            </Link>
            <span className="text-slate-300">|</span>
            <h1 className="text-lg font-bold text-gray-900">팀 참여하기</h1>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mx-auto mb-6">
            <UserPlus className="w-8 h-8 text-green-600" />
          </div>

          <h2 className="text-xl font-bold text-center mb-2">팀에 참여하세요</h2>
          <p className="text-gray-600 text-center mb-8">
            팀 리더에게 받은 초대 코드를 입력하면 바로 팀에 참여할 수 있습니다.
          </p>

          <div className="space-y-6">
            {/* 초대 코드 입력 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                초대 코드 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                inputMode="text"
                autoComplete="off"
                autoCapitalize="characters"
                autoCorrect="off"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                onKeyPress={handleKeyPress}
                placeholder="예: ABC123"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-center text-2xl font-mono tracking-widest uppercase"
                maxLength={10}
                disabled={joining}
              />
              <p className="text-xs text-gray-500 mt-2 text-center">
                6-8자리 영숫자 코드를 입력하세요
              </p>
            </div>

            {/* 안내 문구 */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-900 mb-2">💡 가입 안내</h3>
              <ul className="text-sm text-green-800 space-y-1">
                <li>• 팀 리더나 관리자에게 초대 코드를 요청하세요</li>
                <li>• 코드는 대소문자를 구분하지 않습니다</li>
                <li>• 가입 신청 후 <strong>팀 리더의 승인</strong>이 필요합니다</li>
              </ul>
            </div>

            {/* 버튼 */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => router.push('/my-team')}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                disabled={joining}
              >
                취소
              </button>
              <button
                onClick={handleJoinTeam}
                disabled={joining || !inviteCode.trim()}
                className="flex-1 px-6 py-3 bg-[#84B9C0] text-white rounded-lg hover:bg-[#6FA5AC] font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {joining ? '참여 중...' : '팀 참여하기'}
              </button>
            </div>
          </div>
        </div>

        {/* 팀 만들기 링크 */}
        <div className="mt-8 text-center">
          <p className="text-gray-600 mb-2">아직 팀이 없으신가요?</p>
          <button
            onClick={() => router.push('/teams/create')}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            새 팀 만들기 →
          </button>
        </div>
      </div>
    </div>
  )
}