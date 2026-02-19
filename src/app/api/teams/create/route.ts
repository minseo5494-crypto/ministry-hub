import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { teamName, teamType, churchName } = await request.json()

    if (!teamName?.trim()) {
      return NextResponse.json({ error: '팀 이름을 입력하세요.' }, { status: 400 })
    }

    // Service role client (RLS 우회 — 트리거가 team_roles INSERT하므로 필요)
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

    // 팀 개수 제한 체크 (최대 10개)
    const { count } = await adminClient
      .from('team_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('status', ['active', 'pending'])
    if ((count ?? 0) >= 10) {
      return NextResponse.json({ error: '팀은 최대 10개까지 참여할 수 있습니다.' }, { status: 400 })
    }

    // 초대 코드 생성
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase()

    // 팀 생성 (트리거가 team_roles 자동 생성)
    const { data: teamData, error: teamError } = await adminClient
      .from('teams')
      .insert({
        name: teamName.trim(),
        type: teamType,
        church_name: teamType === 'church_internal' ? churchName?.trim() : null,
        invite_code: inviteCode,
        member_count: 1,
        created_by: user.id
      })
      .select()
      .single()

    if (teamError) throw teamError

    // 생성자를 리더로 추가
    const { error: memberError } = await adminClient
      .from('team_members')
      .insert({
        team_id: teamData.id,
        user_id: user.id,
        role: 'leader',
        status: 'active'
      })

    if (memberError) throw memberError

    return NextResponse.json({ team: teamData })
  } catch (error: any) {
    console.error('팀 생성 실패:', error)
    return NextResponse.json({ error: '팀 생성에 실패했습니다.' }, { status: 500 })
  }
}
