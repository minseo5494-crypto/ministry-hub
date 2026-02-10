'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { useTeamPermissions, getTeamRoles, createTeamRole, updateMemberRole } from '@/hooks/useTeamPermissions'
import TeamRolesManager from '@/components/TeamRolesManager'
import { TeamRole, Permission } from '@/lib/supabase'
import {
  ArrowLeft, Save, Trash2, RefreshCw, Users,
  Crown, Shield, User, UserX, Copy, Check, Settings,
  UserPlus, UserCheck, X, Clock, Plus
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
  role_id?: string
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

  // 역할 변경 모달
  const [roleModalMember, setRoleModalMember] = useState<TeamMember | null>(null)
  const [roleModalSaving, setRoleModalSaving] = useState(false)
  const [teamRoles, setTeamRoles] = useState<TeamRole[]>([])
  const [rolesLoading, setRolesLoading] = useState(false)

  // 새 역할 추가 (모달 내 인라인 폼)
  const [showAddRoleForm, setShowAddRoleForm] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleLevel, setNewRoleLevel] = useState<'leader' | 'admin' | 'member'>('member')
  const [addingRole, setAddingRole] = useState(false)

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
      // 역할 목록 미리 로드 (멤버 목록에서 커스텀 역할 이름 표시용)
      getTeamRoles(teamId).then(roles => setTeamRoles(roles)).catch(() => {})
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
          role_id,
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

  const handleChangeRole = async (member: TeamMember) => {
    if (userRole !== 'leader' && !isSystemAdmin) {
      alert('리더 또는 시스템 관리자만 역할을 변경할 수 있습니다.')
      return
    }
    setRoleModalMember(member)
    setShowAddRoleForm(false)
    setNewRoleName('')
    setNewRoleLevel('member')

    // 역할 목록 로드
    setRolesLoading(true)
    try {
      const roles = await getTeamRoles(teamId)
      setTeamRoles(roles)
    } catch (err) {
      console.error('역할 목록 로드 실패:', err)
    } finally {
      setRolesLoading(false)
    }
  }

  // 역할의 legacy role 매핑 결정
  const getLegacyRole = (role: TeamRole): 'leader' | 'admin' | 'member' => {
    if (role.is_leader) return 'leader'
    const perms = role.permissions || []
    if (perms.includes('manage_members') || perms.includes('manage_roles')) return 'admin'
    return 'member'
  }

  const handleConfirmRoleChange = async (selectedRole: TeamRole) => {
    if (!roleModalMember) return
    setRoleModalSaving(true)
    try {
      const legacyRole = getLegacyRole(selectedRole)

      // default- prefix 역할은 DB role_id가 아닌 legacy role만 업데이트
      if (selectedRole.id.startsWith('default-')) {
        const { error } = await supabase
          .from('team_members')
          .update({ role: legacyRole, role_id: null })
          .eq('id', roleModalMember.id)
        if (error) throw error
      } else {
        const success = await updateMemberRole(roleModalMember.id, selectedRole.id, legacyRole)
        if (!success) throw new Error('역할 변경 실패')
      }

      setRoleModalMember(null)
      fetchMembers()
    } catch (error: any) {
      console.error('Error changing role:', error)
      alert(`역할 변경 실패: ${error.message}`)
    } finally {
      setRoleModalSaving(false)
    }
  }

  // 모달 내 새 역할 추가
  const handleAddNewRole = async () => {
    if (!newRoleName.trim()) {
      alert('역할 이름을 입력하세요.')
      return
    }
    setAddingRole(true)
    try {
      // 권한 레벨에 따른 권한 설정
      let perms: Permission[]
      if (newRoleLevel === 'leader') {
        perms = [
          'view_setlist', 'create_setlist', 'edit_setlist', 'delete_setlist', 'copy_setlist',
          'view_sheet', 'download_sheet',
          'add_fixed_song', 'edit_fixed_song', 'delete_fixed_song',
          'manage_members', 'manage_roles', 'edit_team_settings'
        ]
      } else if (newRoleLevel === 'admin') {
        perms = [
          'view_setlist', 'create_setlist', 'edit_setlist', 'copy_setlist',
          'view_sheet', 'download_sheet',
          'add_fixed_song', 'edit_fixed_song',
          'manage_members'
        ]
      } else {
        perms = ['view_setlist', 'copy_setlist', 'view_sheet', 'download_sheet']
      }

      const result = await createTeamRole(
        teamId,
        newRoleName.trim(),
        '',
        perms,
        newRoleLevel === 'leader' ? 1 : newRoleLevel === 'admin' ? 3 : 5
      )

      if (result) {
        // 역할 목록 새로고침
        const roles = await getTeamRoles(teamId)
        setTeamRoles(roles)
        setShowAddRoleForm(false)
        setNewRoleName('')
        setNewRoleLevel('member')
      } else {
        alert('역할 추가에 실패했습니다.')
      }
    } catch (err) {
      console.error('역할 추가 오류:', err)
      alert('역할 추가 중 오류가 발생했습니다.')
    } finally {
      setAddingRole(false)
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

  // 멤버의 표시용 역할 이름 가져오기 (커스텀 역할 이름 우선)
  const getMemberRoleDisplayName = (member: TeamMember): string => {
    if (member.role_id && teamRoles.length > 0) {
      const customRole = teamRoles.find(r => r.id === member.role_id)
      if (customRole) return customRole.name
    }
    return member.role === 'leader' ? '리더' : member.role === 'admin' ? '관리자' : '멤버'
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
              <Link href="/main" className="text-lg font-logo text-slate-700 hover:text-indigo-600 transition-colors">
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
                    {getMemberRoleDisplayName(member)}
                  </span>
                  
                  {(userRole === 'leader' || isSystemAdmin) && member.user_id !== user.id && (
                    <>
                      <button
                        onClick={() => handleChangeRole(member)}
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

        {/* 역할 변경 모달 */}
        {roleModalMember && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-sm w-full shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
              <div className="px-6 py-4 border-b bg-gray-50 flex-shrink-0">
                <h3 className="text-lg font-bold text-gray-900">역할 변경</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {roleModalMember.users?.name || roleModalMember.users.email}
                </p>
              </div>

              <div className="p-4 space-y-2 overflow-y-auto flex-1">
                {rolesLoading ? (
                  <div className="flex justify-center py-4">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <>
                    {teamRoles.map((role) => {
                      const isCurrentRole = roleModalMember.role_id
                        ? roleModalMember.role_id === role.id
                        : (role.id === 'default-leader' && roleModalMember.role === 'leader') ||
                          (role.id === 'default-admin' && roleModalMember.role === 'admin') ||
                          (role.id === 'default-member' && roleModalMember.role === 'member')
                      const Icon = role.is_leader ? Crown : (role.permissions || []).includes('manage_members') ? Shield : User
                      const color = role.is_leader
                        ? 'text-yellow-600 bg-yellow-50 border-yellow-200'
                        : (role.permissions || []).includes('manage_members')
                          ? 'text-blue-600 bg-blue-50 border-blue-200'
                          : 'text-gray-600 bg-gray-50 border-gray-200'

                      return (
                        <button
                          key={role.id}
                          onClick={() => handleConfirmRoleChange(role)}
                          disabled={roleModalSaving || isCurrentRole}
                          className={`w-full p-4 border-2 rounded-xl text-left flex items-center gap-3 transition min-h-[44px] ${
                            isCurrentRole
                              ? `${color} border-current`
                              : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50'
                          } disabled:opacity-60`}
                          style={{ touchAction: 'manipulation' }}
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isCurrentRole ? color : 'bg-gray-100'
                          }`}>
                            <Icon size={20} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900">{role.name}</span>
                              {isCurrentRole && (
                                <span className="text-xs px-2 py-0.5 bg-white rounded-full border font-medium">현재</span>
                              )}
                            </div>
                            {role.description && (
                              <p className="text-xs text-gray-500 mt-0.5">{role.description}</p>
                            )}
                          </div>
                          {roleModalSaving && !isCurrentRole && (
                            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                          )}
                        </button>
                      )
                    })}

                    {/* 새 역할 추가 */}
                    {!showAddRoleForm ? (
                      <button
                        onClick={() => setShowAddRoleForm(true)}
                        className="w-full p-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:border-blue-300 hover:text-blue-600 flex items-center justify-center gap-2 transition min-h-[44px]"
                        style={{ touchAction: 'manipulation' }}
                      >
                        <Plus size={18} />
                        <span className="text-sm font-medium">새 역할 추가</span>
                      </button>
                    ) : (
                      <div className="p-4 border-2 border-blue-200 rounded-xl bg-blue-50 space-y-3">
                        <input
                          type="text"
                          value={newRoleName}
                          onChange={(e) => setNewRoleName(e.target.value)}
                          placeholder="역할 이름 (예: 파트장, 부팀장)"
                          className="w-full px-3 py-2 border rounded-lg text-base"
                          style={{ fontSize: '16px' }}
                          autoFocus
                        />
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1.5">권한 수준</label>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { value: 'leader' as const, label: '리더급', desc: '모든 권한' },
                              { value: 'admin' as const, label: '관리자급', desc: '편집+관리' },
                              { value: 'member' as const, label: '멤버급', desc: '조회만' },
                            ].map(({ value, label, desc }) => (
                              <button
                                key={value}
                                onClick={() => setNewRoleLevel(value)}
                                className={`p-2 border-2 rounded-lg text-center transition min-h-[44px] ${
                                  newRoleLevel === value
                                    ? 'border-blue-500 bg-blue-100 text-blue-800'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                                style={{ touchAction: 'manipulation' }}
                              >
                                <div className="text-sm font-semibold">{label}</div>
                                <div className="text-xs text-gray-500">{desc}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleAddNewRole}
                            disabled={addingRole || !newRoleName.trim()}
                            className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm disabled:bg-gray-400 min-h-[44px]"
                            style={{ touchAction: 'manipulation' }}
                          >
                            {addingRole ? '추가 중...' : '추가'}
                          </button>
                          <button
                            onClick={() => {
                              setShowAddRoleForm(false)
                              setNewRoleName('')
                              setNewRoleLevel('member')
                            }}
                            className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm min-h-[44px]"
                            style={{ touchAction: 'manipulation' }}
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="px-4 pb-4 flex-shrink-0">
                <button
                  onClick={() => setRoleModalMember(null)}
                  disabled={roleModalSaving}
                  className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium transition min-h-[44px]"
                  style={{ touchAction: 'manipulation' }}
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}