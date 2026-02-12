import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
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

    // 데모 팀 조회
    const { data: demoTeam } = await adminClient
      .from('teams')
      .select('id')
      .eq('is_demo', true)
      .limit(1)
      .maybeSingle()

    if (!demoTeam) {
      return NextResponse.json({ error: '데모 팀을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 이미 가입 확인
    const { data: existing } = await adminClient
      .from('team_members')
      .select('id')
      .eq('team_id', demoTeam.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ success: true, already: true })
    }

    // 멤버로 추가
    const { error: insertError } = await adminClient
      .from('team_members')
      .insert({
        team_id: demoTeam.id,
        user_id: user.id,
        role: 'member',
        status: 'active',
      })

    if (insertError) {
      console.error('데모 팀 가입 실패:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('데모 팀 가입 API 오류:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
