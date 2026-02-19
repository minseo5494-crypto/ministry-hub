import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { teamId, title, serviceDate, serviceType, songs } = await request.json()

    if (!teamId || !title?.trim() || !serviceDate || !serviceType?.trim()) {
      return NextResponse.json({ error: '필수 항목을 모두 입력하세요.' }, { status: 400 })
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 인증 확인
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || ''
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    // 팀 멤버 확인 + 역할 조회
    const { data: member } = await adminClient
      .from('team_members')
      .select('role, role_id')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (!member) {
      return NextResponse.json({ error: '팀 멤버가 아닙니다.' }, { status: 403 })
    }

    // 권한 확인: leader/admin이면 허용
    const isLeaderOrAdmin = member.role === 'leader' || member.role === 'admin'

    // role_id 기반 권한 체크
    let hasCreatePermission = isLeaderOrAdmin
    if (!hasCreatePermission && member.role_id) {
      const { data: perms } = await adminClient
        .from('role_permissions')
        .select('permission')
        .eq('role_id', member.role_id)
        .eq('permission', 'create_setlist')

      hasCreatePermission = (perms && perms.length > 0) || false
    }

    // 시스템 관리자 체크
    if (!hasCreatePermission) {
      const { data: profile } = await adminClient
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (profile?.is_admin) hasCreatePermission = true
    }

    if (!hasCreatePermission) {
      return NextResponse.json({ error: '콘티 생성 권한이 없습니다. 팀 리더에게 문의하세요.' }, { status: 403 })
    }

    // 콘티 생성
    const { data, error } = await adminClient
      .from('team_setlists')
      .insert({
        team_id: teamId,
        title: title.trim(),
        service_date: serviceDate,
        service_type: serviceType.trim(),
        created_by: user.id,
      })
      .select()
      .single()

    if (error) throw error

    // 곡 목록이 있으면 함께 저장
    if (songs && Array.isArray(songs) && songs.length > 0) {
      const setlistSongs = songs.map((song: any, index: number) => ({
        setlist_id: data.id,
        song_id: song.song_id,
        order_number: index + 1,
        selected_form: song.selected_form || null,
      }))

      const { error: songsError } = await adminClient
        .from('team_setlist_songs')
        .insert(setlistSongs)

      if (songsError) {
        console.error('콘티 곡 추가 실패:', songsError)
      }
    }

    return NextResponse.json({ setlist: data })
  } catch (error: any) {
    console.error('콘티 생성 실패:', error)
    return NextResponse.json({ error: error.message || '콘티 생성에 실패했습니다.' }, { status: 500 })
  }
}
