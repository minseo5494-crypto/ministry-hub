'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { useTeamPermissions } from '@/hooks/useTeamPermissions'
import TeamRolesManager from '@/components/TeamRolesManager'
import {
  Save, Trash2, RefreshCw, Shield, Copy, Check, Settings,
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
  const t = useTranslations('myTeam')

  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string>('')
  const [isSystemAdmin, setIsSystemAdmin] = useState(false)
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
        alert(t('loginRequired'))
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
        alert(t('noAccessToTeam'))
        router.push('/my-team')
        return
      }

      setUserRole(memberData.role)

      // 시스템 관리자는 member여도 접근 가능
      if (memberData.role === 'member' && !userData?.is_admin) {
        alert(t('adminOnlyAccess'))
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
      alert(t('fetchTeamInfoError'))
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
      alert(t('permissionDenied'))
      return
    }

    try {
      const { error: memberError } = await supabase
        .from('team_members')
        .update({ status: 'active', joined_at: new Date().toISOString() })
        .eq('id', memberId)

      if (memberError) throw memberError

      if (team) {
        await supabase
          .from('teams')
          .update({ member_count: (team as any).member_count ? (team as any).member_count + 1 : 1 })
          .eq('id', teamId)
      }

      alert(`✅ ${t('approveSuccess', { email: memberEmail })}`)
      fetchMembers()
      fetchPendingMembers()
    } catch (error: any) {
      console.error('Error approving join request:', error)
      alert(t('approveFailed', { message: error.message }))
    }
  }

  const handleRejectJoinRequest = async (memberId: string, memberEmail: string) => {
    if (userRole !== 'leader' && userRole !== 'admin' && !isSystemAdmin) {
      alert(t('permissionDenied'))
      return
    }

    if (!confirm(t('rejectConfirm', { email: memberEmail }))) {
      return
    }

    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId)

      if (error) throw error

      alert(t('rejectSuccess'))
      fetchPendingMembers()
    } catch (error: any) {
      console.error('Error rejecting join request:', error)
      alert(t('rejectFailed', { message: error.message }))
    }
  }

  const handleSaveTeamInfo = async () => {
    if (!editTeamName.trim()) {
      alert(t('teamNameRequired'))
      return
    }

    if (userRole !== 'leader' && userRole !== 'admin' && !isSystemAdmin) {
      alert(t('permissionDenied'))
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

      alert(`✅ ${t('teamInfoSaved')}`)
      fetchTeamData()
    } catch (error: any) {
      console.error('Error updating team:', error)
      alert(t('teamInfoSaveFailed', { message: error.message }))
    } finally {
      setSaving(false)
    }
  }

  const handleRegenerateCode = async () => {
    if (userRole !== 'leader' && !isSystemAdmin) {
      alert(t('regenerateLeaderOnly'))
      return
    }

    if (!confirm(t('regenerateConfirm'))) {
      return
    }

    try {
      const newCode = Math.random().toString(36).substring(2, 10).toUpperCase()

      const { error } = await supabase
        .from('teams')
        .update({ invite_code: newCode })
        .eq('id', teamId)

      if (error) throw error

      alert(`✅ ${t('newInviteCode', { code: newCode })}`)
      fetchTeamData()
    } catch (error: any) {
      console.error('Error regenerating code:', error)
      alert(t('regenerateFailed', { message: error.message }))
    }
  }

  const handleRemoveMember = async (memberId: string, memberEmail: string) => {
    if (userRole !== 'leader' && userRole !== 'admin' && !isSystemAdmin) {
      alert(t('permissionDenied'))
      return
    }

    if (!confirm(t('removeMemberConfirm', { email: memberEmail }))) {
      return
    }

    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId)

      if (error) throw error

      alert(`✅ ${t('memberRemoved')}`)
      fetchMembers()
    } catch (error: any) {
      console.error('Error removing member:', error)
      alert(t('memberRemoveFailed', { message: error.message }))
    }
  }

  const handleDeleteTeam = async () => {
  if (userRole !== 'leader' && !isSystemAdmin) {
    alert(t('deleteTeamLeaderOnly'))
    return
  }

  const confirmation = prompt(
    t('deleteTeamPrompt'),
    ''
  )

  if (confirmation !== team?.name) {
    alert(t('deleteTeamNameMismatch'))
    return
  }

  try {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/teams/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`,
      },
      body: JSON.stringify({ teamId }),
    })
    const result = await res.json()

    if (!res.ok) {
      throw new Error(result.error || t('teamDeleteFailed', { message: '' }))
    }

    alert(`✅ ${t('teamDeleted')}`)
    router.push('/my-team')
  } catch (error: any) {
    console.error('Error deleting team:', error)
    alert(t('teamDeleteFailed', { message: error.message }))
  }
}

  const copyInviteCode = () => {
    if (team) {
      navigator.clipboard.writeText(team.invite_code)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">{t('loading')}</p>
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
                title={t('backToTeamPage')}
              >
                <span className="material-symbols-outlined text-xl text-slate-600">arrow_back</span>
              </button>
              {/* 로고 */}
              <Link href="/main" className="text-lg font-logo text-slate-700 hover:text-indigo-600 transition-colors">
                WORSHEEP
              </Link>
              <span className="text-slate-300">|</span>
              <div>
                <h1 className="text-lg font-bold text-gray-900">{t('settingsTitle')}</h1>
                {isSystemAdmin && (
                  <span className="text-xs text-purple-600 font-semibold">
                    {t('systemAdminLabel')}
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
            {t('tabBasicInfo')}
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
            {t('tabRoles')}
          </button>
        </div>

        {/* 탭 컨텐츠 */}
        {activeTab === 'roles' ? (
          <TeamRolesManager
            teamId={teamId}
            canManageRoles={canManageRoles}
            currentUserId={user?.id}
            userRole={userRole}
            isSystemAdmin={isSystemAdmin}
            onRemoveMember={handleRemoveMember}
          />
        ) : (
          <>
        {/* 팀 정보 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">{t('teamInfo')}</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('teamName')} <span className="text-red-500">*</span>
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
                  {t('churchName')}
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
                {t('inviteCode')}
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
                    {t('regenerate')}
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
              {saving ? t('saving') : t('save')}
            </button>
          </div>
        </div>

        {/* 가입 신청 관리 */}
        {pendingMembers.length > 0 && (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center text-amber-900">
              <Clock className="mr-2" size={24} />
              {t('pendingRequests', { count: pendingMembers.length })}
            </h2>
            <p className="text-sm text-amber-700 mb-4">
              {t('pendingRequestsDesc')}
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
                        {new Date(member.joined_at).toLocaleDateString('ko-KR')} {t('requested')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApproveJoinRequest(member.id, member.users?.email)}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center text-sm font-medium"
                    >
                      <UserCheck size={16} className="mr-1" />
                      {t('approve')}
                    </button>
                    <button
                      onClick={() => handleRejectJoinRequest(member.id, member.users?.email)}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center text-sm font-medium"
                    >
                      <X size={16} className="mr-1" />
                      {t('reject')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 위험 구역 - 리더 또는 시스템 관리자만 표시 */}
        {(userRole === 'leader' || isSystemAdmin) && (
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-bold text-red-900 mb-4">{t('dangerZone')}</h2>
            <p className="text-sm text-red-700 mb-4">
              {t('dangerZoneDesc')}
            </p>
            <button
              onClick={handleDeleteTeam}
              className="px-6 py-3 bg-[#E26559] text-white rounded-lg hover:bg-[#D14E42] font-medium flex items-center"
            >
              <Trash2 className="mr-2" size={18} />
              {t('deleteTeam')}
            </button>
          </div>
        )}
          </>
        )}

      </div>
    </div>
  )
}
