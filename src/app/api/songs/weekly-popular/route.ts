import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
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
  } catch (error: any) {
    console.error('Weekly popular API error:', error)
    return NextResponse.json({ data: [] })
  }
}
