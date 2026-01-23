'use client'

import { useState, useEffect } from 'react'
import {
  Shield, Plus, Edit2, Trash2, Check, X, ChevronDown, ChevronUp,
  Users, Crown
} from 'lucide-react'
import {
  TeamRole, Permission, PERMISSION_LABELS, PERMISSION_CATEGORIES, TeamMember
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
  onRolesChange?: () => void
}

export default function TeamRolesManager({ teamId, canManageRoles, onRolesChange }: TeamRolesManagerProps) {
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

  // 멤버 직책 변경 모달
  const [showMemberModal, setShowMemberModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)

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

  const handleChangeMemberRole = async (memberId: string, newRoleId: string) => {
    const success = await updateMemberRole(memberId, newRoleId)
    if (success) {
      alert('직책이 변경되었습니다.')
      fetchData()
      setShowMemberModal(false)
      setSelectedMember(null)
      onRolesChange?.()
    } else {
      alert('직책 변경에 실패했습니다.')
    }
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

      {/* 멤버별 직책 관리 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold flex items-center mb-4">
          <Users className="mr-2" size={24} />
          멤버별 직책
        </h2>

        <div className="space-y-3">
          {members.map((member) => {
            // 기본 모드에서는 team_role에서 직접 가져오고, 아니면 role_id로 찾기
            const memberRole = isDefaultMode
              ? (member.team_role as TeamRole | undefined)
              : roles.find(r => r.id === member.role_id)
            return (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
                    memberRole?.is_leader ? 'bg-yellow-100' : 'bg-gray-100'
                  }`}>
                    {memberRole?.is_leader ? (
                      <Crown className="w-5 h-5 text-yellow-600" />
                    ) : (
                      <Shield className="w-5 h-5 text-gray-500" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold">{member.user?.name || member.user?.email || '알 수 없음'}</p>
                    <p className="text-sm text-gray-500">{member.user?.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    memberRole?.is_leader
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {memberRole?.name || '미지정'}
                  </span>

                  {canManageRoles && !memberRole?.is_leader && !isDefaultMode && (
                    <button
                      onClick={() => {
                        setSelectedMember(member)
                        setShowMemberModal(true)
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"
                      title="직책 변경"
                    >
                      <Edit2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 멤버 직책 변경 모달 */}
      {showMemberModal && selectedMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">직책 변경</h3>
            <p className="text-gray-600 mb-4">
              {selectedMember.user?.name || selectedMember.user?.email}님의 직책을 선택하세요.
            </p>

            <div className="space-y-2 mb-6">
              {roles.filter(r => !r.is_leader).map(role => (
                <button
                  key={role.id}
                  onClick={() => handleChangeMemberRole(selectedMember.id, role.id)}
                  className={`w-full p-3 border rounded-lg text-left hover:bg-gray-50 flex items-center justify-between ${
                    selectedMember.role_id === role.id ? 'border-blue-500 bg-blue-50' : ''
                  }`}
                >
                  <div>
                    <span className="font-medium">{role.name}</span>
                    {role.description && (
                      <p className="text-sm text-gray-500">{role.description}</p>
                    )}
                  </div>
                  {selectedMember.role_id === role.id && (
                    <Check className="text-blue-500" size={20} />
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                setShowMemberModal(false)
                setSelectedMember(null)
              }}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
