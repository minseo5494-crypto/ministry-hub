import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { setlistId, teamId } = await request.json()

    if (!setlistId || !teamId) {
      return NextResponse.json({ error: '콘티 ID와 팀 ID가 필요합니다.' }, { status: 400 })
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

    // 권한 확인: 팀 리더/관리자 또는 콘티 생성자
    const { data: member } = await adminClient
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (!member) {
      return NextResponse.json({ error: '팀 멤버가 아닙니다.' }, { status: 403 })
    }

    const { data: setlist } = await adminClient
      .from('team_setlists')
      .select('created_by')
      .eq('id', setlistId)
      .eq('team_id', teamId)
      .single()

    if (!setlist) {
      return NextResponse.json({ error: '콘티를 찾을 수 없습니다.' }, { status: 404 })
    }

    const isLeaderOrAdmin = member.role === 'leader' || member.role === 'admin'
    const isCreator = setlist.created_by === user.id

    if (!isLeaderOrAdmin && !isCreator) {
      return NextResponse.json({ error: '삭제 권한이 없습니다. (리더/관리자 또는 생성자만 가능)' }, { status: 403 })
    }

    // 1. 콘티 곡 삭제
    await adminClient
      .from('team_setlist_songs')
      .delete()
      .eq('setlist_id', setlistId)

    // 2. 콘티 삭제
    const { error: deleteError } = await adminClient
      .from('team_setlists')
      .delete()
      .eq('id', setlistId)

    if (deleteError) throw deleteError

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('콘티 삭제 실패:', error)
    return NextResponse.json({ error: '콘티 삭제에 실패했습니다.' }, { status: 500 })
  }
}
