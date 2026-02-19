import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const authHeader = request.headers.get('authorization')
    const accessToken = authHeader?.replace('Bearer ', '')

    if (!accessToken) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    // 토큰 검증
    const authClient = createClient(supabaseUrl, supabaseAnonKey)
    const { data: { user }, error: authError } = await authClient.auth.getUser(accessToken)

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 만료되었습니다.' }, { status: 401 })
    }

    // service_role로 activity_logs 조회 (RLS 우회 필요)
    const adminClient = createClient(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    const { data: activityData } = await adminClient
      .from('activity_logs')
      .select('song_id')
      .not('song_id', 'is', null)
      .gte('created_at', oneWeekAgo.toISOString())

    const songUsageMap: Record<string, number> = {}
    activityData?.forEach(log => {
      if (log.song_id) {
        songUsageMap[log.song_id] = (songUsageMap[log.song_id] || 0) + 1
      }
    })

    // 사용량 순으로 정렬
    const sorted = Object.entries(songUsageMap)
      .sort((a, b) => b[1] - a[1])
      .map(([id], index) => ({ id, rank: index }))

    return NextResponse.json({ data: sorted })
  } catch (error) {
    console.error('Weekly popular API error:', error)
    return NextResponse.json({ data: [] })
  }
}
