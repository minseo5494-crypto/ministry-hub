'use client'

import { useState, useEffect } from 'react'
import {
  Shield, Plus, Edit2, Trash2, Check, X, ChevronDown, ChevronUp,
  Users, Crown, User, UserX
} from 'lucide-react'
import {
  supabase, TeamRole, Permission, PERMISSION_LABELS, PERMISSION_CATEGORIES, TeamMember
} from '@/lib/supabase'
import {
  getTeamRoles,
  createTeamRole,
  updateTeamRole,
  deleteTeamRole,
  updateMemberRole,
  getTeamMembersWithRoles
} from '@/hooks/useTeamPermissions'

interface TeamRolesManagerProps {
  teamId: string
  canManageRoles: boolean  // manage_roles 권한 여부
  currentUserId?: string
  userRole?: string
  isSystemAdmin?: boolean
  onRemoveMember?: (memberId: string, memberEmail: string) => void
  onRolesChange?: () => void
}

export default function TeamRolesManager({ teamId, canManageRoles, currentUserId, userRole, isSystemAdmin, onRemoveMember, onRolesChange }: TeamRolesManagerProps) {
  const [roles, setRoles] = useState<TeamRole[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null)
  const [isDefaultMode, setIsDefaultMode] = useState(false)  // DB 테이블이 없는 경우

  // 새 직책 추가
  const [showAddRole, setShowAddRole] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDesc, setNewRoleDesc] = useState('')
  const [newRolePerms, setNewRolePerms] = useState<Permission[]>([])

  // 직책 편집
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null)
  const [editRoleName, setEditRoleName] = useState('')
  const [editRoleDesc, setEditRoleDesc] = useState('')
  const [editRolePerms, setEditRolePerms] = useState<Permission[]>([])

  // 멤버 역할 변경 모달
  const [roleModalMember, setRoleModalMember] = useState<TeamMember | null>(null)
  const [roleModalSaving, setRoleModalSaving] = useState(false)
  const [showModalAddRoleForm, setShowModalAddRoleForm] = useState(false)
  const [modalNewRoleName, setModalNewRoleName] = useState('')
  const [modalNewRoleLevel, setModalNewRoleLevel] = useState<'leader' | 'admin' | 'member'>('member')
  const [modalAddingRole, setModalAddingRole] = useState(false)

  useEffect(() => {
    fetchData()
  }, [teamId])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [rolesData, membersData] = await Promise.all([
        getTeamRoles(teamId),
        getTeamMembersWithRoles(teamId)
      ])
      setRoles(rolesData)
      setMembers(membersData)

      // 기본 모드인지 확인 (default- prefix가 있으면 DB 테이블이 없는 상태)
      const hasDefaultRoles = rolesData.some(r => r.id.startsWith('default-'))
      setIsDefaultMode(hasDefaultRoles)
    } catch (error) {
      console.error('데이터 로딩 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddRole = async () => {
    if (!newRoleName.trim()) {
      alert('직책 이름을 입력하세요.')
      return
    }

    const result = await createTeamRole(
      teamId,
      newRoleName.trim(),
      newRoleDesc.trim(),
      newRolePerms
    )

    if (result) {
      alert('직책이 추가되었습니다.')
      setShowAddRole(false)
      setNewRoleName('')
      setNewRoleDesc('')
      setNewRolePerms([])
      fetchData()
      onRolesChange?.()
    } else {
      alert('직책 추가에 실패했습니다.')
    }
  }

  const handleStartEdit = (role: TeamRole) => {
    setEditingRoleId(role.id)
    setEditRoleName(role.name)
    setEditRoleDesc(role.description || '')
    setEditRolePerms(role.permissions || [])
  }

  const handleSaveEdit = async () => {
    if (!editingRoleId || !editRoleName.trim()) return

    const success = await updateTeamRole(editingRoleId, {
      name: editRoleName.trim(),
      description: editRoleDesc.trim(),
      permissions: editRolePerms
    })

    if (success) {
      alert('직책이 수정되었습니다.')
      setEditingRoleId(null)
      fetchData()
      onRolesChange?.()
    } else {
      alert('직책 수정에 실패했습니다.')
    }
  }

  const handleDeleteRole = async (roleId: string, roleName: string) => {
    // 해당 직책을 가진 멤버 수 확인
    const membersWithRole = members.filter(m => m.role_id === roleId)

    if (membersWithRole.length > 0) {
      alert(`이 직책을 가진 멤버가 ${membersWithRole.length}명 있습니다.\n먼저 멤버들의 직책을 변경해주세요.`)
      return
    }

    if (!confirm(`"${roleName}" 직책을 삭제하시겠습니까?`)) return

    const success = await deleteTeamRole(roleId)
    if (success) {
      alert('직책이 삭제되었습니다.')
      fetchData()
      onRolesChange?.()
    } else {
      alert('직책 삭제에 실패했습니다.')
    }
  }

  // 역할의 legacy role 매핑 결정
  const getLegacyRole = (role: TeamRole): 'leader' | 'admin' | 'member' => {
    if (role.is_leader) return 'leader'
    const perms = role.permissions || []
    if (perms.includes('manage_members') || perms.includes('manage_roles')) return 'admin'
    return 'member'
  }

  const handleOpenRoleChangeModal = (member: TeamMember) => {
    if (userRole !== 'leader' && !isSystemAdmin) {
      alert('리더 또는 시스템 관리자만 역할을 변경할 수 있습니다.')
      return
    }
    setRoleModalMember(member)
    setShowModalAddRoleForm(false)
    setModalNewRoleName('')
    setModalNewRoleLevel('member')
  }

  const handleConfirmRoleChange = async (selectedRole: TeamRole) => {
    if (!roleModalMember) return
    setRoleModalSaving(true)
    try {
      const legacyRole = getLegacyRole(selectedRole)

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
      fetchData()
      onRolesChange?.()
    } catch (error: any) {
      console.error('Error changing role:', error)
      alert(`역할 변경 실패: ${error.message}`)
    } finally {
      setRoleModalSaving(false)
    }
  }

  const handleModalAddNewRole = async () => {
    if (!modalNewRoleName.trim()) {
      alert('역할 이름을 입력하세요.')
      return
    }
    setModalAddingRole(true)
    try {
      let perms: Permission[]
      if (modalNewRoleLevel === 'leader') {
        perms = [
          'view_setlist', 'create_setlist', 'edit_setlist', 'delete_setlist', 'copy_setlist',
          'view_sheet', 'download_sheet',
          'add_fixed_song', 'edit_fixed_song', 'delete_fixed_song',
          'manage_members', 'manage_roles', 'edit_team_settings'
        ]
      } else if (modalNewRoleLevel === 'admin') {
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
        modalNewRoleName.trim(),
        '',
        perms,
        modalNewRoleLevel === 'leader' ? 1 : modalNewRoleLevel === 'admin' ? 3 : 5
      )

      if (result) {
        fetchData()
        setShowModalAddRoleForm(false)
        setModalNewRoleName('')
        setModalNewRoleLevel('member')
      } else {
        alert('역할 추가에 실패했습니다.')
      }
    } catch (err) {
      console.error('역할 추가 오류:', err)
      alert('역할 추가 중 오류가 발생했습니다.')
    } finally {
      setModalAddingRole(false)
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

  const getMemberRoleDisplayName = (member: TeamMember): string => {
    if (member.role_id && roles.length > 0) {
      const customRole = roles.find(r => r.id === member.role_id)
      if (customRole) return customRole.name
    }
    // legacyRoleToTeamRole 이름과 일치시킴 (인도자/부리더/팀원)
    return member.role === 'leader' ? '인도자' : member.role === 'admin' ? '부리더' : '팀원'
  }

  const togglePermission = (
    perms: Permission[],
    setPerms: (p: Permission[]) => void,
    perm: Permission
  ) => {
    if (perms.includes(perm)) {
      setPerms(perms.filter(p => p !== perm))
    } else {
      setPerms([...perms, perm])
    }
  }

  const PermissionCheckboxes = ({
    permissions,
    setPermissions,
    disabled = false
  }: {
    permissions: Permission[]
    setPermissions: (p: Permission[]) => void
    disabled?: boolean
  }) => (
    <div className="space-y-4">
      {Object.entries(PERMISSION_CATEGORIES).map(([category, perms]) => (
        <div key={category} className="border rounded-lg p-3">
          <h4 className="font-medium text-gray-700 mb-2">{category}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {perms.map(perm => (
              <label
                key={perm}
                className={`flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer ${disabled ? 'opacity-50' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={permissions.includes(perm)}
                  onChange={() => togglePermission(permissions, setPermissions, perm)}
                  disabled={disabled}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm">{PERMISSION_LABELS[perm]}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  )

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 직책 관리 섹션 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center">
            <Shield className="mr-2" size={24} />
            직책 관리
          </h2>
          {canManageRoles && !isDefaultMode && (
            <button
              onClick={() => setShowAddRole(true)}
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-100 flex items-center text-sm"
            >
              <Plus size={18} className="mr-1" />
              새 직책 추가
            </button>
          )}
        </div>

        {/* 기본 모드 안내 */}
        {isDefaultMode && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 text-sm">
              현재 기본 직책 설정을 보여주고 있습니다. 커스텀 직책 관리 기능은 DB 설정 후 사용 가능합니다.
            </p>
          </div>
        )}

        {/* 새 직책 추가 폼 */}
        {showAddRole && canManageRoles && (
          <div className="mb-6 p-4 border-2 border-blue-200 rounded-lg bg-blue-50">
            <h3 className="font-semibold mb-3">새 직책 추가</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">직책 이름 *</label>
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="예: 세션팀장, 싱어팀장"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">설명</label>
                <input
                  type="text"
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  placeholder="직책에 대한 설명"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">권한 설정</label>
                <PermissionCheckboxes
                  permissions={newRolePerms}
                  setPermissions={setNewRolePerms}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleAddRole}
                  className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-100"
                >
                  추가
                </button>
                <button
                  onClick={() => {
                    setShowAddRole(false)
                    setNewRoleName('')
                    setNewRoleDesc('')
                    setNewRolePerms([])
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 직책 목록 */}
        <div className="space-y-3">
          {roles.map((role) => (
            <div key={role.id} className="border rounded-lg overflow-hidden">
              {/* 직책 헤더 */}
              <div
                className={`flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 ${
                  role.is_leader ? 'bg-yellow-50' : ''
                }`}
                onClick={() => setExpandedRoleId(expandedRoleId === role.id ? null : role.id)}
              >
                <div className="flex items-center">
                  {role.is_leader ? (
                    <Crown className="w-5 h-5 text-yellow-600 mr-2" />
                  ) : (
                    <Shield className="w-5 h-5 text-gray-400 mr-2" />
                  )}
                  <div>
                    <span className="font-semibold">{role.name}</span>
                    {role.is_default && (
                      <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                        기본
                      </span>
                    )}
                    {role.is_leader && (
                      <span className="ml-2 text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded">
                        리더
                      </span>
                    )}
                    {role.description && (
                      <p className="text-sm text-gray-500 mt-0.5">{role.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">
                    {members.filter(m =>
                      isDefaultMode
                        ? (m.team_role as any)?.id === role.id
                        : m.role_id === role.id
                    ).length}명
                  </span>
                  {expandedRoleId === role.id ? (
                    <ChevronUp size={20} />
                  ) : (
                    <ChevronDown size={20} />
                  )}
                </div>
              </div>

              {/* 확장된 내용 */}
              {expandedRoleId === role.id && (
                <div className="border-t p-4 bg-gray-50">
                  {editingRoleId === role.id ? (
                    // 편집 모드
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">직책 이름</label>
                        <input
                          type="text"
                          value={editRoleName}
                          onChange={(e) => setEditRoleName(e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg"
                          disabled={role.is_leader}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">설명</label>
                        <input
                          type="text"
                          value={editRoleDesc}
                          onChange={(e) => setEditRoleDesc(e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">권한 설정</label>
                        <PermissionCheckboxes
                          permissions={editRolePerms}
                          setPermissions={setEditRolePerms}
                          disabled={role.is_leader}  // 리더 직책은 권한 수정 불가
                        />
                        {role.is_leader && (
                          <p className="text-sm text-yellow-600 mt-2">
                            * 인도자 직책은 모든 권한을 가집니다.
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={handleSaveEdit}
                          className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-100 flex items-center"
                        >
                          <Check size={18} className="mr-1" />
                          저장
                        </button>
                        <button
                          onClick={() => setEditingRoleId(null)}
                          className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 flex items-center"
                        >
                          <X size={18} className="mr-1" />
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    // 보기 모드
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">권한 목록</h4>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {(role.permissions || []).length > 0 ? (
                          role.permissions!.map(perm => (
                            <span
                              key={perm}
                              className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm"
                            >
                              {PERMISSION_LABELS[perm]}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-500 text-sm">권한 없음</span>
                        )}
                      </div>

                      {canManageRoles && !isDefaultMode && (
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleStartEdit(role)
                            }}
                            className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 flex items-center text-sm"
                          >
                            <Edit2 size={16} className="mr-1" />
                            편집
                          </button>
                          {!role.is_leader && !role.is_default && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteRole(role.id, role.name)
                              }}
                              className="px-3 py-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 flex items-center text-sm"
                            >
                              <Trash2 size={16} className="mr-1" />
                              삭제
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

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
                  <p className="font-semibold">{member.user?.name || member.user?.email || '알 수 없음'}</p>
                  <p className="text-sm text-gray-500">{member.user?.email}</p>
                  {member.joined_at && (
                    <p className="text-sm text-gray-400">
                      {new Date(member.joined_at).toLocaleDateString('ko-KR')} 가입
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getRoleBadge(member.role)}`}>
                  {getMemberRoleDisplayName(member)}
                </span>

                {(userRole === 'leader' || isSystemAdmin) && member.user_id !== currentUserId && (
                  <>
                    <button
                      onClick={() => handleOpenRoleChangeModal(member)}
                      className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"
                      title="역할 변경"
                    >
                      <Shield size={18} />
                    </button>
                    {onRemoveMember && (
                      <button
                        onClick={async () => {
                          await onRemoveMember(member.id, member.user?.email || '')
                          fetchData()
                        }}
                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg"
                        title="추방"
                      >
                        <UserX size={18} />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 역할 변경 모달 */}
      {roleModalMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b bg-gray-50 flex-shrink-0">
              <h3 className="text-lg font-bold text-gray-900">역할 변경</h3>
              <p className="text-sm text-gray-500 mt-1">
                {roleModalMember.user?.name || roleModalMember.user?.email}
              </p>
            </div>

            <div className="p-4 space-y-2 overflow-y-auto flex-1">
              {roles.map((role) => {
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
              {!showModalAddRoleForm ? (
                <button
                  onClick={() => setShowModalAddRoleForm(true)}
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
                    value={modalNewRoleName}
                    onChange={(e) => setModalNewRoleName(e.target.value)}
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
                          onClick={() => setModalNewRoleLevel(value)}
                          className={`p-2 border-2 rounded-lg text-center transition min-h-[44px] ${
                            modalNewRoleLevel === value
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
                      onClick={handleModalAddNewRole}
                      disabled={modalAddingRole || !modalNewRoleName.trim()}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm disabled:bg-gray-400 min-h-[44px]"
                      style={{ touchAction: 'manipulation' }}
                    >
                      {modalAddingRole ? '추가 중...' : '추가'}
                    </button>
                    <button
                      onClick={() => {
                        setShowModalAddRoleForm(false)
                        setModalNewRoleName('')
                        setModalNewRoleLevel('member')
                      }}
                      className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm min-h-[44px]"
                      style={{ touchAction: 'manipulation' }}
                    >
                      취소
                    </button>
                  </div>
                </div>
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
  )
}
