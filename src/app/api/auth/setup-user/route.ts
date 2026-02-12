import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { userId, email, name, profileImageUrl, authProvider, mergeFromId, termsAgreedAt } = await request.json()

    if (!userId || !email) {
      return NextResponse.json({ error: 'userId와 email은 필수입니다.' }, { status: 400 })
    }

    // Service role 클라이언트 (RLS 우회)
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // 0. 기존 계정 id 병합 (탈퇴 후 재가입 등)
    if (mergeFromId && mergeFromId !== userId) {
      console.log('🔗 Merging user id:', mergeFromId, '→', userId)

      // team_members의 user_id를 새 id로 업데이트
      await adminClient
        .from('team_members')
        .update({ user_id: userId })
        .eq('user_id', mergeFromId)

      // 기존 users 레코드 삭제 (새 id로 upsert할 것이므로)
      await adminClient
        .from('users')
        .delete()
        .eq('id', mergeFromId)
    }

    // 1. users 테이블에 upsert
    const upsertData: any = {
      id: userId,
      email,
      name: name || email.split('@')[0],
      profile_image_url: profileImageUrl || null,
      email_verified: true,
      auth_provider: authProvider || 'google',
      last_login: new Date().toISOString()
    }
    if (termsAgreedAt) {
      upsertData.terms_agreed_at = termsAgreedAt
    }

    const { error: upsertError } = await adminClient
      .from('users')
      .upsert(upsertData, { onConflict: 'id' })

    if (upsertError) {
      console.error('setup-user upsert error:', upsertError)
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    // 2. 데모 팀 자동 가입
    const { data: demoTeam } = await adminClient
      .from('teams')
      .select('id')
      .eq('is_demo', true)
      .limit(1)
      .maybeSingle()

    if (demoTeam) {
      const { data: existing } = await adminClient
        .from('team_members')
        .select('id')
        .eq('team_id', demoTeam.id)
        .eq('user_id', userId)
        .maybeSingle()

      if (!existing) {
        await adminClient
          .from('team_members')
          .insert({
            team_id: demoTeam.id,
            user_id: userId,
            role: 'member',
            status: 'active'
          })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('setup-user error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
