'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, Permission, TeamRole, TeamMember } from '@/lib/supabase'

interface UseTeamPermissionsResult {
  permissions: Permission[]
  role: TeamRole | null
  isLeader: boolean
  isAdmin: boolean  // 관리자 계정 여부
  loading: boolean
  error: string | null
  hasPermission: (permission: Permission) => boolean
  hasAnyPermission: (permissions: Permission[]) => boolean
  hasAllPermissions: (permissions: Permission[]) => boolean
  refetch: () => Promise<void>
}

export function useTeamPermissions(teamId: string | null, userId: string | null): UseTeamPermissionsResult {
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [role, setRole] = useState<TeamRole | null>(null)
  const [isLeader, setIsLeader] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPermissions = useCallback(async () => {
    if (!teamId || !userId) {
      setPermissions([])
      setRole(null)
      setIsLeader(false)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // 1. 먼저 사용자가 관리자인지 확인 (DB의 is_admin 필드 사용)
      const { data: userData } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', userId)
        .single()

      if (userData?.is_admin) {
        // 관리자는 모든 권한 부여
        setIsAdmin(true)
        setIsLeader(true)
        setPermissions([
          'view_setlist', 'create_setlist', 'edit_setlist', 'delete_setlist', 'copy_setlist',
          'view_sheet', 'download_sheet',
          'add_fixed_song', 'edit_fixed_song', 'delete_fixed_song',
          'manage_members', 'manage_roles', 'edit_team_settings'
        ])
        setRole({
          id: 'admin',
          team_id: teamId,
          name: '관리자',
          description: '시스템 관리자',
          is_default: false,
          is_leader: true,
          sort_order: 0,
        })
        setLoading(false)
        return
      }

      // 2. 팀 멤버 정보 조회 (role_id + role 필드 모두)
      const { data: memberData, error: memberError } = await supabase
        .from('team_members')
        .select('role, role_id')
        .eq('team_id', teamId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .single()

      if (memberError || !memberData) {
        // 팀 멤버가 아님
        setPermissions([])
        setRole(null)
        setIsLeader(false)
        setLoading(false)
        return
      }

      // role_id가 있으면 DB에서 역할+권한 조회
      if (memberData.role_id) {
        const { data: roleData } = await supabase
          .from('team_roles')
          .select('*')
          .eq('id', memberData.role_id)
          .single()

        if (roleData) {
          const { data: permsData } = await supabase
            .from('role_permissions')
            .select('permission')
            .eq('role_id', memberData.role_id)

          const rolePerms = (permsData || []).map(p => p.permission as Permission)

          setIsLeader(roleData.is_leader)
          setPermissions(roleData.is_leader ? [
            'view_setlist', 'create_setlist', 'edit_setlist', 'delete_setlist', 'copy_setlist',
            'view_sheet', 'download_sheet',
            'add_fixed_song', 'edit_fixed_song', 'delete_fixed_song',
            'manage_members', 'manage_roles', 'edit_team_settings'
          ] : rolePerms)
          setRole({ ...roleData, permissions: rolePerms })
          setLoading(false)
          return
        }
      }

      // fallback: 기존 role 필드 기반으로 권한 설정 (leader, admin, member)
      const legacyRole = memberData.role as string

      if (legacyRole === 'leader' || legacyRole === 'admin') {
        // 리더/관리자는 모든 권한
        setIsLeader(true)
        setPermissions([
          'view_setlist', 'create_setlist', 'edit_setlist', 'delete_setlist', 'copy_setlist',
          'view_sheet', 'download_sheet',
          'add_fixed_song', 'edit_fixed_song', 'delete_fixed_song',
          'manage_members', 'manage_roles', 'edit_team_settings'
        ])
        setRole({
          id: legacyRole,
          team_id: teamId,
          name: legacyRole === 'leader' ? '인도자' : '관리자',
          description: legacyRole === 'leader' ? '팀 인도자' : '팀 관리자',
          is_default: true,
          is_leader: true,
          sort_order: 0,
        })
      } else {
        // 일반 멤버는 기본 권한만
        setIsLeader(false)
        setPermissions(['view_setlist', 'copy_setlist', 'view_sheet', 'download_sheet'])
        setRole({
          id: 'member',
          team_id: teamId,
          name: '팀원',
          description: '일반 팀원',
          is_default: true,
          is_leader: false,
          sort_order: 10,
        })
      }

    } catch (err) {
      console.error('권한 조회 오류:', err)
      setError('권한을 불러오는데 실패했습니다.')
      // 오류 시에도 기본 권한 부여
      setPermissions(['view_setlist', 'view_sheet'])
    } finally {
      setLoading(false)
    }
  }, [teamId, userId])

  useEffect(() => {
    fetchPermissions()
  }, [fetchPermissions])

  // 특정 권한이 있는지 확인
  const hasPermission = useCallback((permission: Permission): boolean => {
    if (isAdmin || isLeader) return true
    return permissions.includes(permission)
  }, [permissions, isAdmin, isLeader])

  // 주어진 권한 중 하나라도 있는지 확인
  const hasAnyPermission = useCallback((perms: Permission[]): boolean => {
    if (isAdmin || isLeader) return true
    return perms.some(p => permissions.includes(p))
  }, [permissions, isAdmin, isLeader])

  // 주어진 권한이 모두 있는지 확인
  const hasAllPermissions = useCallback((perms: Permission[]): boolean => {
    if (isAdmin || isLeader) return true
    return perms.every(p => permissions.includes(p))
  }, [permissions, isAdmin, isLeader])

  return {
    permissions,
    role,
    isLeader,
    isAdmin,
    loading,
    error,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    refetch: fetchPermissions,
  }
}

// 팀의 모든 직책 조회
export async function getTeamRoles(teamId: string): Promise<TeamRole[]> {
  try {
    // 1. team_roles 조회
    const { data: rolesData, error: rolesError } = await supabase
      .from('team_roles')
      .select('*')
      .eq('team_id', teamId)
      .order('sort_order', { ascending: true })

    if (rolesError || !rolesData || rolesData.length === 0) {
      // DB 테이블이 없거나 데이터가 없으면 기본값 반환
      return getDefaultRoles(teamId)
    }

    // 2. 각 역할의 권한 조회
    const roleIds = rolesData.map(r => r.id)
    const { data: permsData } = await supabase
      .from('role_permissions')
      .select('role_id, permission')
      .in('role_id', roleIds)

    // 3. 권한을 역할에 매핑
    const permsByRole: Record<string, Permission[]> = {}
    ;(permsData || []).forEach(p => {
      if (!permsByRole[p.role_id]) permsByRole[p.role_id] = []
      permsByRole[p.role_id].push(p.permission as Permission)
    })

    return rolesData.map(role => ({
      ...role,
      permissions: permsByRole[role.id] || []
    }))
  } catch (err) {
    console.error('팀 직책 조회 오류:', err)
    return getDefaultRoles(teamId)
  }
}

// 기본 직책 목록 반환 (DB 마이그레이션 전)
function getDefaultRoles(teamId: string): TeamRole[] {
  return [
    {
      id: 'default-leader',
      team_id: teamId,
      name: '인도자',
      description: '팀 인도자 - 모든 권한',
      is_default: false,
      is_leader: true,
      sort_order: 1,
      permissions: [
        'view_setlist', 'create_setlist', 'edit_setlist', 'delete_setlist', 'copy_setlist',
        'view_sheet', 'download_sheet',
        'add_fixed_song', 'edit_fixed_song', 'delete_fixed_song',
        'manage_members', 'manage_roles', 'edit_team_settings'
      ]
    },
    {
      id: 'default-admin',
      team_id: teamId,
      name: '부리더',
      description: '팀 관리 권한',
      is_default: false,
      is_leader: false,
      sort_order: 2,
      permissions: [
        'view_setlist', 'create_setlist', 'edit_setlist', 'copy_setlist',
        'view_sheet', 'download_sheet',
        'add_fixed_song', 'edit_fixed_song',
        'manage_members'
      ]
    },
    {
      id: 'default-member',
      team_id: teamId,
      name: '팀원',
      description: '기본 멤버',
      is_default: true,
      is_leader: false,
      sort_order: 10,
      permissions: ['view_setlist', 'copy_setlist', 'view_sheet', 'download_sheet']
    }
  ]
}

// 직책 생성
export async function createTeamRole(
  teamId: string,
  name: string,
  description: string,
  permissions: Permission[],
  sortOrder: number = 5
): Promise<TeamRole | null> {
  // 1. 직책 생성
  const { data: roleData, error: roleError } = await supabase
    .from('team_roles')
    .insert({
      team_id: teamId,
      name,
      description,
      is_default: false,
      is_leader: false,
      sort_order: sortOrder,
    })
    .select()
    .single()

  if (roleError || !roleData) {
    console.error('직책 생성 오류:', roleError)
    return null
  }

  // 2. 권한 설정
  if (permissions.length > 0) {
    const permInserts = permissions.map(perm => ({
      role_id: roleData.id,
      permission: perm
    }))

    const { error: permError } = await supabase
      .from('role_permissions')
      .insert(permInserts)

    if (permError) {
      console.error('권한 설정 오류:', permError)
    }
  }

  return { ...roleData, permissions }
}

// 직책 수정
export async function updateTeamRole(
  roleId: string,
  updates: {
    name?: string
    description?: string
    permissions?: Permission[]
    sort_order?: number
  }
): Promise<boolean> {
  // 1. 직책 정보 수정
  if (updates.name || updates.description || updates.sort_order !== undefined) {
    const { error } = await supabase
      .from('team_roles')
      .update({
        ...(updates.name && { name: updates.name }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.sort_order !== undefined && { sort_order: updates.sort_order }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', roleId)

    if (error) {
      console.error('직책 수정 오류:', error)
      return false
    }
  }

  // 2. 권한 수정
  if (updates.permissions) {
    // 기존 권한 삭제
    await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId)

    // 새 권한 추가
    if (updates.permissions.length > 0) {
      const permInserts = updates.permissions.map(perm => ({
        role_id: roleId,
        permission: perm
      }))

      const { error: permError } = await supabase
        .from('role_permissions')
        .insert(permInserts)

      if (permError) {
        console.error('권한 설정 오류:', permError)
        return false
      }
    }
  }

  return true
}

// 직책 삭제
export async function deleteTeamRole(roleId: string): Promise<boolean> {
  const { error } = await supabase
    .from('team_roles')
    .delete()
    .eq('id', roleId)

  if (error) {
    console.error('직책 삭제 오류:', error)
    return false
  }

  return true
}

// 팀원 직책 변경 (role_id + 후방 호환 role 필드 동시 업데이트)
export async function updateMemberRole(
  memberId: string,
  roleId: string,
  legacyRole?: 'leader' | 'admin' | 'member'
): Promise<boolean> {
  const updateData: Record<string, string> = { role_id: roleId }
  if (legacyRole) {
    updateData.role = legacyRole
  }

  const { error } = await supabase
    .from('team_members')
    .update(updateData)
    .eq('id', memberId)

  if (error) {
    console.error('팀원 직책 변경 오류:', error)
    return false
  }

  return true
}

// 팀원 목록 조회 (직책 정보 포함)
export async function getTeamMembersWithRoles(teamId: string): Promise<TeamMember[]> {
  try {
    const { data, error } = await supabase
      .from('team_members')
      .select(`
        *,
        user:users(id, email, name),
        team_role:team_roles(*)
      `)
      .eq('team_id', teamId)
      .eq('status', 'active')

    if (error) {
      // team_roles 조인 실패 시 기본 조회로 fallback
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('team_members')
        .select(`
          *,
          user:users(id, email, name)
        `)
        .eq('team_id', teamId)
        .eq('status', 'active')

      if (fallbackError || !fallbackData) {
        console.error('팀원 조회 오류:', fallbackError)
        return []
      }

      return fallbackData.map(member => ({
        ...member,
        team_role: legacyRoleToTeamRole(member.role, teamId)
      }))
    }

    // role_id가 있고 team_role이 조인된 경우 그대로 사용, 아니면 legacy fallback
    return (data || []).map(member => ({
      ...member,
      team_role: member.team_role || legacyRoleToTeamRole(member.role, teamId)
    }))
  } catch (err) {
    console.error('팀원 조회 중 예외:', err)
    return []
  }
}

// 기존 role 필드를 TeamRole 객체로 변환 (후방 호환)
function legacyRoleToTeamRole(role: string, teamId: string) {
  if (role === 'leader') {
    return { id: 'default-leader', team_id: teamId, name: '인도자', is_leader: true, is_default: false, sort_order: 1 }
  }
  if (role === 'admin') {
    return { id: 'default-admin', team_id: teamId, name: '부리더', is_leader: false, is_default: false, sort_order: 2 }
  }
  return { id: 'default-member', team_id: teamId, name: '팀원', is_leader: false, is_default: true, sort_order: 10 }
}
