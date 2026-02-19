import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { name, profileImageUrl, authProvider, mergeFromId, termsAgreedAt } = await request.json()

    // Service role 클라이언트 (RLS 우회)
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 인증 확인: Bearer 토큰에서 사용자 정보 추출
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || ''
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const userId = user.id
    const email = user.email!

    // 0. 기존 계정 id 병합 (탈퇴 후 재가입 등)
    if (mergeFromId && mergeFromId !== userId) {
      // 병합 대상이 같은 이메일인지 확인 (타인 데이터 탈취 방지)
      const { data: mergeTarget } = await adminClient
        .from('users')
        .select('email')
        .eq('id', mergeFromId)
        .maybeSingle()

      if (mergeTarget?.email === email) {
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
    }

    // 1. 같은 이메일의 orphaned 데이터 정리 (탈퇴 후 재가입 시 이전 ID의 행이 남아있을 수 있음)
    await adminClient
      .from('users')
      .delete()
      .eq('email', email)
      .neq('id', userId)

    // profileImageUrl 검증 (https만 허용)
    let safeProfileImageUrl = null
    if (profileImageUrl && typeof profileImageUrl === 'string') {
      try {
        const url = new URL(profileImageUrl)
        if (url.protocol === 'https:') {
          safeProfileImageUrl = profileImageUrl
        }
      } catch {
        // 잘못된 URL은 무시
      }
    }

    // authProvider 검증
    const allowedProviders = ['google', 'email', 'kakao', 'apple']
    const safeAuthProvider = allowedProviders.includes(authProvider) ? authProvider : 'email'

    // 2. users 테이블에 upsert
    const upsertData: any = {
      id: userId,
      email,
      name: name ? String(name).slice(0, 50) : email.split('@')[0],
      profile_image_url: safeProfileImageUrl,
      email_verified: true,
      auth_provider: safeAuthProvider,
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
      return NextResponse.json({ error: '사용자 설정 중 오류가 발생했습니다.' }, { status: 500 })
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
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
