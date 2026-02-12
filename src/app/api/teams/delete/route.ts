import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { teamId } = await request.json()

    if (!teamId) {
      return NextResponse.json({ error: '팀 ID가 필요합니다.' }, { status: 400 })
    }

    // Service role client (RLS 우회)
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Authorization 헤더에서 유저 토큰 추출하여 인증 확인
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || ''
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    // 권한 확인: 리더 또는 시스템 관리자만 삭제 가능
    const { data: member } = await adminClient
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single()

    const { data: profile } = await adminClient
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (member?.role !== 'leader' && !profile?.is_admin) {
      return NextResponse.json({ error: '리더 또는 시스템 관리자만 팀을 삭제할 수 있습니다.' }, { status: 403 })
    }

    // 1. 팀 콘티의 곡들 삭제
    const { data: teamSetlists } = await adminClient
      .from('team_setlists')
      .select('id')
      .eq('team_id', teamId)

    if (teamSetlists && teamSetlists.length > 0) {
      const setlistIds = teamSetlists.map(s => s.id)
      await adminClient.from('team_setlist_songs').delete().in('setlist_id', setlistIds)
    }

    // 2. 팀 콘티 삭제
    await adminClient.from('team_setlists').delete().eq('team_id', teamId)

    // 3. 팀 멤버 삭제
    await adminClient.from('team_members').delete().eq('team_id', teamId)

    // 4. 역할 권한 삭제
    const { data: roles } = await adminClient
      .from('team_roles')
      .select('id')
      .eq('team_id', teamId)

    if (roles && roles.length > 0) {
      const roleIds = roles.map(r => r.id)
      await adminClient.from('role_permissions').delete().in('role_id', roleIds)
    }

    // 5. 팀 역할 삭제
    await adminClient.from('team_roles').delete().eq('team_id', teamId)

    // 6. 고정 곡, 폴더 삭제
    await adminClient.from('team_fixed_songs').delete().eq('team_id', teamId)
    await adminClient.from('folders').delete().eq('team_id', teamId)

    // 7. 로그/악보의 team_id를 NULL로 (데이터 보존)
    await adminClient.from('download_logs').update({ team_id: null }).eq('team_id', teamId)
    await adminClient.from('song_sheets').update({ team_id: null }).eq('team_id', teamId)

    // 8. 팀 삭제
    const { error: teamError } = await adminClient
      .from('teams')
      .delete()
      .eq('id', teamId)

    if (teamError) throw teamError

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('팀 삭제 실패:', error)
    return NextResponse.json({ error: error.message || '팀 삭제에 실패했습니다.' }, { status: 500 })
  }
}
