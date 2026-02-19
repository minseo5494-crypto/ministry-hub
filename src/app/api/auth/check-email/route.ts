import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ exists: false })
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // users 테이블에서 이메일로 단건 조회 (1000명 전체 로드 대신)
    const { data } = await adminClient
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    return NextResponse.json({ exists: !!data })
  } catch {
    return NextResponse.json({ exists: false })
  }
}
