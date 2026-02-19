import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    // 1. 요청자 본인 인증
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return NextResponse.json({ error: '인증에 실패했습니다.' }, { status: 401 })
    }

    const userId = user.id

    // 2. 관리자 계정 삭제 방지
    const { data: profile } = await anonClient
      .from('users')
      .select('is_admin')
      .eq('id', userId)
      .single()

    if (profile?.is_admin) {
      return NextResponse.json(
        { error: '관리자 계정은 탈퇴할 수 없습니다. 다른 관리자에게 권한을 이전한 후 다시 시도해주세요.' },
        { status: 403 }
      )
    }

    // 3. service_role 클라이언트 생성
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 4. private 곡 삭제
    const { error: deletePrivateError } = await adminClient
      .from('songs')
      .delete()
      .eq('uploaded_by', userId)
      .eq('visibility', 'private')

    if (deletePrivateError) {
      console.error('Private songs delete error:', deletePrivateError)
      return NextResponse.json(
        { error: '계정 삭제 처리 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    // 5. public/teams 곡의 uploaded_by를 null로 설정
    const { error: updateSongsError } = await adminClient
      .from('songs')
      .update({ uploaded_by: null })
      .eq('uploaded_by', userId)

    if (updateSongsError) {
      console.error('Songs update error:', updateSongsError)
      return NextResponse.json(
        { error: '계정 삭제 처리 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    // 6. teams.created_by를 null로 (외래키 제약조건 해제)
    await adminClient
      .from('teams')
      .update({ created_by: null })
      .eq('created_by', userId)

    // 7. users 테이블에서 삭제 (CASCADE로 관련 데이터 정리)
    const { error: deleteUserError } = await adminClient
      .from('users')
      .delete()
      .eq('id', userId)

    if (deleteUserError) {
      console.error('User delete error:', deleteUserError)
      return NextResponse.json(
        { error: '계정 삭제 처리 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    // 7. Auth 계정 삭제
    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(userId)

    if (deleteAuthError) {
      console.error('Auth user delete error:', deleteAuthError)
      return NextResponse.json(
        { error: '계정 삭제 처리 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Account delete API error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
