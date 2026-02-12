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

    // auth.users에서 직접 확인 (퍼블릭 users 테이블은 불완전할 수 있음)
    const { data: { users } } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })
    const exists = users?.some(u => u.email === email) ?? false

    return NextResponse.json({ exists })
  } catch {
    return NextResponse.json({ exists: false })
  }
}
