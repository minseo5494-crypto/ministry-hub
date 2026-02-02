'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { useTeamPermissions } from '@/hooks/useTeamPermissions'
import TeamRolesManager from '@/components/TeamRolesManager'
import {
  ArrowLeft, Save, Trash2, RefreshCw, Users,
  Crown, Shield, User, UserX, Copy, Check, Settings,
  UserPlus, UserCheck, X, Clock
} from 'lucide-react'
import Link from 'next/link'

interface TeamInfo {
  id: string
  name: string
  type: string
  church_name: string | null
  invite_code: string
  created_at: string
}

interface TeamMember {
  id: string
  user_id: string
  role: 'leader' | 'admin' | 'member'
  status: string
  joined_at: string
  users: {
    email: string
    name: string | null
  }
}

export default function TeamSettingsPage() {
  const router = useRouter()
  const params = useParams()
  const teamId = params.id as string

  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string>('')
  const [isSystemAdmin, setIsSystemAdmin] = useState(false) // 추가
  const [loading, setLoading] = useState(true)
  const [team, setTeam] = useState<TeamInfo | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [pendingMembers, setPendingMembers] = useState<TeamMember[]>([])
  const [copiedCode, setCopiedCode] = useState(false)

  // 편집 상태
  const [editTeamName, setEditTeamName] = useState('')
  const [editChurchName, setEditChurchName] = useState('')
  const [saving, setSaving] = useState(false)

  // 탭 상태 (기본정보 / 권한관리)
  const [activeTab, setActiveTab] = useState<'info' | 'roles'>('info')

  // 권한 훅 사용
  const { hasPermission, isAdmin, isLeader } = useTeamPermissions(teamId, user?.id)
  const canManageRoles = hasPermission('manage_roles')

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (user && teamId) {
      fetchTeamData()
      fetchMembers()
      fetchPendingMembers()
    }
  }, [user, teamId])

  const checkUser = async () => {
    try {
      const currentUser = await getCurrentUser()
      if (!currentUser) {
        alert('로그인이 필요합니다.')
        router.push('/login')
        return
      }
      setUser(currentUser)

      // 시스템 관리자 여부 확인
      const { data: userData } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', currentUser.id)
        .single()
      
      setIsSystemAdmin(userData?.is_admin || false)

      // 사용자 역할 확인
      const { data: memberData } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', currentUser.id)
        .eq('status', 'active')
        .single()

      if (!memberData) {
        alert('이 팀에 접근 권한이 없습니다.')
        router.push('/my-team')
        return
      }

      setUserRole(memberData.role)

      // 시스템 관리자는 member여도 접근 가능
      if (memberData.role === 'member' && !userData?.is_admin) {
        alert('설정 페이지는 관리자만 접근할 수 있습니다.')
        router.push(`/my-team/${teamId}`)
        return
      }
    } catch (error) {
      console.error('Error checking user:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const fetchTeamData = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single()

      if (error) throw error

      setTeam(data)
      setEditTeamName(data.name)
      setEditChurchName(data.church_name || '')
    } catch (error) {
      console.error('Error fetching team:', error)
      alert('팀 정보를 불러오는데 실패했습니다.')
    }
  }

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          id,
          user_id,
          role,
          status,
          joined_at,
          users:user_id (
            email,
            name
          )
        `)
        .eq('team_id', teamId)
        .eq('status', 'active')
        .order('joined_at', { ascending: true })

      if (error) throw error
      setMembers((data as any) || [])
    } catch (error) {
      console.error('Error fetching members:', error)
    }
  }

  const fetchPendingMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          id,
          user_id,
          role,
          status,
          joined_at,
          users:user_id (
            email,
            name
          )
        `)
        .eq('team_id', teamId)
        .eq('status', 'pending')
        .order('joined_at', { ascending: true })

      if (error) throw error
      setPendingMembers((data as any) || [])
    } catch (error) {
      console.error('Error fetching pending members:', error)
    }
  }

  const handleApproveJoinRequest = async (memberId: string, memberEmail: string) => {
    if (userRole !== 'leader' && userRole !== 'admin' && !isSystemAdmin) {
      alert('권한이 없습니다.')
      return
    }

    try {
      // 1. 멤버 상태를 active로 변경
      const { error: memberError } = await supabase
        .from('team_members')
        .update({ status: 'active', joined_at: new Date().toISOString() })
        .eq('id', memberId)

      if (memberError) throw memberError

      // 2. 팀 멤버 수 증가
      if (team) {
        await supabase
          .from('teams')
          .update({ member_count: (team as any).member_count ? (team as any).member_count + 1 : 1 })
          .eq('id', teamId)
      }

      alert(`✅ ${memberEmail}님의 가입 신청을 승인했습니다.`)
      fetchMembers()
      fetchPendingMembers()
    } catch (error: any) {
      console.error('Error approving join request:', error)
      alert(`승인 실패: ${error.message}`)
    }
  }

  const handleRejectJoinRequest = async (memberId: string, memberEmail: string) => {
    if (userRole !== 'leader' && userRole !== 'admin' && !isSystemAdmin) {
      alert('권한이 없습니다.')
      return
    }

    if (!confirm(`${memberEmail}님의 가입 신청을 거절하시겠습니까?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId)

      if (error) throw error

      alert(`가입 신청을 거절했습니다.`)
      fetchPendingMembers()
    } catch (error: any) {
      console.error('Error rejecting join request:', error)
      alert(`거절 실패: ${error.message}`)
    }
  }

  const handleSaveTeamInfo = async () => {
    if (!editTeamName.trim()) {
      alert('팀 이름을 입력하세요.')
      return
    }

    if (userRole !== 'leader' && userRole !== 'admin' && !isSystemAdmin) {
      alert('권한이 없습니다.')
      return
    }

    setSaving(true)

    try {
      const { error } = await supabase
        .from('teams')
        .update({
          name: editTeamName.trim(),
          church_name: editChurchName.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', teamId)

      if (error) throw error

      alert('✅ 팀 정보가 수정되었습니다.')
      fetchTeamData()
    } catch (error: any) {
      console.error('Error updating team:', error)
      alert(`수정 실패: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleRegenerateCode = async () => {
    if (userRole !== 'leader' && !isSystemAdmin) {
      alert('리더 또는 시스템 관리자만 초대 코드를 재생성할 수 있습니다.')
      return
    }

    if (!confirm('초대 코드를 재생성하시겠습니까?\n기존 코드는 사용할 수 없게 됩니다.')) {
      return
    }

    try {
      const newCode = Math.random().toString(36).substring(2, 10).toUpperCase()

      const { error } = await supabase
        .from('teams')
        .update({ invite_code: newCode })
        .eq('id', teamId)

      if (error) throw error

      alert(`✅ 새 초대 코드: ${newCode}`)
      fetchTeamData()
    } catch (error: any) {
      console.error('Error regenerating code:', error)
      alert(`재생성 실패: ${error.message}`)
    }
  }

  const handleChangeRole = async (memberId: string, currentRole: string) => {
    if (userRole !== 'leader' && !isSystemAdmin) {
      alert('리더 또는 시스템 관리자만 역할을 변경할 수 있습니다.')
      return
    }

    const roles = ['member', 'admin', 'leader']
    const newRole = prompt(
      `새 역할을 입력하세요:\n- member (일반 멤버)\n- admin (관리자)\n- leader (리더)`,
      currentRole
    )

    if (!newRole || !roles.includes(newRole)) {
      return
    }

    try {
      const { error } = await supabase
        .from('team_members')
        .update({ role: newRole })
        .eq('id', memberId)

      if (error) throw error

      alert('✅ 역할이 변경되었습니다.')
      fetchMembers()
    } catch (error: any) {
      console.error('Error changing role:', error)
      alert(`역할 변경 실패: ${error.message}`)
    }
  }

  const handleRemoveMember = async (memberId: string, memberEmail: string) => {
    if (userRole !== 'leader' && userRole !== 'admin' && !isSystemAdmin) {
      alert('권한이 없습니다.')
      return
    }

    if (!confirm(`정말 ${memberEmail}님을 추방하시겠습니까?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId)

      if (error) throw error

      alert('✅ 멤버가 추방되었습니다.')
      fetchMembers()
    } catch (error: any) {
      console.error('Error removing member:', error)
      alert(`추방 실패: ${error.message}`)
    }
  }

  const handleDeleteTeam = async () => {
  // 권한 확인: 리더 또는 시스템 관리자만
  if (userRole !== 'leader' && !isSystemAdmin) {
    alert('리더 또는 시스템 관리자만 팀을 삭제할 수 있습니다.')
    return
  }

  const confirmation = prompt(
    '정말 이 팀을 삭제하시겠습니까?\n모든 콘티와 데이터가 영구적으로 삭제됩니다.\n\n삭제하려면 팀 이름을 정확히 입력하세요:',
    ''
  )

  if (confirmation !== team?.name) {
    alert('팀 이름이 일치하지 않습니다.')
    return
  }

  try {
    console.log('팀 삭제 시작:', teamId)

    // 1. 팀 콘티의 곡들 먼저 가져오기
    const { data: teamSetlists } = await supabase
      .from('team_setlists')
      .select('id')
      .eq('team_id', teamId)

    if (teamSetlists && teamSetlists.length > 0) {
      const setlistIds = teamSetlists.map(s => s.id)
      
      // 팀 콘티의 곡들 삭제
      const { error: teamSongError } = await supabase
        .from('team_setlist_songs')
        .delete()
        .in('setlist_id', setlistIds)

      if (teamSongError) {
        console.error('Error deleting team songs:', teamSongError)
      }
    }

    // 2. 팀 콘티 삭제
    const { error: teamSetlistError } = await supabase
      .from('team_setlists')
      .delete()
      .eq('team_id', teamId)

    if (teamSetlistError) {
      console.error('Error deleting team setlists:', teamSetlistError)
    }

    // 3. 팀 멤버 삭제
    const { error: memberError } = await supabase
      .from('team_members')
      .delete()
      .eq('team_id', teamId)

    if (memberError) {
      console.error('Error deleting members:', memberError)
    }

    // 4. 팀 삭제
    const { error: teamError } = await supabase
      .from('teams')
      .delete()
      .eq('id', teamId)

    if (teamError) throw teamError

    alert('✅ 팀이 삭제되었습니다.')
    router.push('/my-team')
  } catch (error: any) {
    console.error('Error deleting team:', error)
    alert(`삭제 실패: ${error.message}`)
  }
}

  const copyInviteCode = () => {
    if (team) {
      navigator.clipboard.writeText(team.invite_code)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'leader':
        return <Crown className="w-4 h-4 text-yellow-600" />
      case 'admin':
        return <Shield className="w-4 h-4 text-purple-600" />
      default:
        return <User className="w-4 h-4 text-gray-600" />
    }
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'leader':
        return 'bg-yellow-100 text-yellow-800'
      case 'admin':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-700'
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

  if (!team) return null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* 뒤로가기 */}
              <button
                onClick={() => router.push(`/my-team/${teamId}`)}
                className="p-2 -ml-2 hover:bg-gray-100 rounded-lg"
                title="뒤로가기 (팀 페이지)"
              >
                <span className="material-symbols-outlined text-xl text-slate-600">arrow_back</span>
              </button>
              {/* 로고 */}
              <Link href="/main" className="text-lg font-black tracking-tighter text-slate-700 hover:text-indigo-600 transition-colors">
                WORSHEEP
              </Link>
              <span className="text-slate-300">|</span>
              <div>
                <h1 className="text-lg font-bold text-gray-900">팀 설정</h1>
                {isSystemAdmin && (
                  <span className="text-xs text-purple-600 font-semibold">
                    시스템 관리자 권한
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* 탭 네비게이션 */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('info')}
            className={`px-6 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'info'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Settings className="inline-block mr-2" size={18} />
            기본 정보
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`px-6 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'roles'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Shield className="inline-block mr-2" size={18} />
            직책/권한 관리
          </button>
        </div>

        {/* 탭 컨텐츠 */}
        {activeTab === 'roles' ? (
          <TeamRolesManager
            teamId={teamId}
            canManageRoles={canManageRoles}
          />
        ) : (
          <>
        {/* 팀 정보 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">팀 정보</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                팀 이름 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={editTeamName}
                onChange={(e) => setEditTeamName(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>

            {team.type === 'church_internal' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  교회 이름
                </label>
                <input
                  type="text"
                  value={editChurchName}
                  onChange={(e) => setEditChurchName(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                초대 코드
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={team.invite_code}
                  readOnly
                  className="flex-1 px-4 py-2 border rounded-lg bg-gray-50 font-mono"
                />
                <button
                  onClick={copyInviteCode}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg flex items-center"
                >
                  {copiedCode ? <Check size={18} /> : <Copy size={18} />}
                </button>
                {(userRole === 'leader' || isSystemAdmin) && (
                  <button
                    onClick={handleRegenerateCode}
                    className="px-4 py-2 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8] flex items-center"
                  >
                    <RefreshCw size={18} className="mr-2" />
                    재생성
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={handleSaveTeamInfo}
              disabled={saving}
              className="w-full px-4 py-3 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8] font-medium disabled:bg-gray-400 flex items-center justify-center"
            >
              <Save className="mr-2" size={18} />
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>

        {/* 가입 신청 관리 */}
        {pendingMembers.length > 0 && (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center text-amber-900">
              <Clock className="mr-2" size={24} />
              가입 신청 대기 ({pendingMembers.length}명)
            </h2>
            <p className="text-sm text-amber-700 mb-4">
              아래 사용자들이 팀 가입을 요청했습니다. 승인하거나 거절해주세요.
            </p>

            <div className="space-y-3">
              {pendingMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 bg-white border border-amber-200 rounded-lg"
                >
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center mr-3 bg-amber-100">
                      <UserPlus className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-semibold">{member.users?.name || member.users?.email}</p>
                      <p className="text-sm text-gray-500">{member.users?.email}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(member.joined_at).toLocaleDateString('ko-KR')} 신청
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApproveJoinRequest(member.id, member.users?.email)}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center text-sm font-medium"
                    >
                      <UserCheck size={16} className="mr-1" />
                      승인
                    </button>
                    <button
                      onClick={() => handleRejectJoinRequest(member.id, member.users?.email)}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center text-sm font-medium"
                    >
                      <X size={16} className="mr-1" />
                      거절
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 멤버 관리 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <Users className="mr-2" size={24} />
            멤버 관리 ({members.length}명)
          </h2>

          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${getRoleBadge(member.role)}`}>
                    {getRoleIcon(member.role)}
                  </div>
                  <div>
                    <p className="font-semibold">{member.users.email}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(member.joined_at).toLocaleDateString('ko-KR')} 가입
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getRoleBadge(member.role)}`}>
                    {member.role === 'leader' ? '리더' : member.role === 'admin' ? '관리자' : '멤버'}
                  </span>
                  
                  {(userRole === 'leader' || isSystemAdmin) && member.user_id !== user.id && (
                    <>
                      <button
                        onClick={() => handleChangeRole(member.id, member.role)}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"
                        title="역할 변경"
                      >
                        <Shield size={18} />
                      </button>
                      <button
                        onClick={() => handleRemoveMember(member.id, member.users.email)}
                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg"
                        title="추방"
                      >
                        <UserX size={18} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 위험 구역 - 리더 또는 시스템 관리자만 표시 */}
        {(userRole === 'leader' || isSystemAdmin) && (
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-bold text-red-900 mb-4">위험 구역</h2>
            <p className="text-sm text-red-700 mb-4">
              ⚠️ 팀을 삭제하면 모든 콘티와 데이터가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
            </p>
            <button
              onClick={handleDeleteTeam}
              className="px-6 py-3 bg-[#E26559] text-white rounded-lg hover:bg-[#D14E42] font-medium flex items-center"
            >
              <Trash2 className="mr-2" size={18} />
              팀 삭제
            </button>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  )
}