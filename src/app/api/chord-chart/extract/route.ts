// src/app/api/chord-chart/extract/route.ts
//
// 악보 이미지/PDF → ChordChart(JSON) 비전 추출 라우트.
// 입력: { songId }  (기존 업로드 악보 — 서버가 private 버킷에서 다운로드)
//   또는 { images: [{ data(base64), mediaType }] }  (변환 전용 새 업로드, 다중 페이지 가능)
// 출력: { success, chart }

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import {
  CHORD_CHART_MODEL,
  CHORD_CHART_MAX_TOKENS,
  CHORD_CHART_SYSTEM_PROMPT,
  parseChordChart,
} from '@/lib/chordChartExtract'

export const runtime = 'nodejs'
export const maxDuration = 120 // 비전 추출은 수십 초 소요 (Vercel Pro 기준)

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// 인메모리 Rate Limiting (사용자별 분당 5회)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 5
const RATE_WINDOW_MS = 60 * 1000
function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_IMAGES = 8

function mediaTypeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || ''
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'pdf') return 'application/pdf'
  return 'image/jpeg'
}

// file_url(전체 public URL) → { bucket, path(디코딩) }
function parseStorage(fileUrl: string): { bucket: string; path: string } | null {
  const marker = '/storage/v1/object/public/'
  const idx = fileUrl.indexOf(marker)
  if (idx === -1) return null
  const rest = fileUrl.slice(idx + marker.length)
  const slash = rest.indexOf('/')
  if (slash === -1) return null
  const bucket = rest.slice(0, slash)
  const encodedPath = rest.slice(slash + 1)
  const path = encodedPath
    .split('/')
    .map((s) => {
      try {
        return decodeURIComponent(s)
      } catch {
        return s
      }
    })
    .join('/')
  return { bucket, path }
}

type ContentBlock =
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } }
  | { type: 'text'; text: string }

function toBlock(mediaType: string, data: string): ContentBlock {
  if (mediaType === 'application/pdf') {
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
  }
  const mt = IMAGE_TYPES.has(mediaType) ? mediaType : 'image/jpeg'
  return { type: 'image', source: { type: 'base64', media_type: mt, data } }
}

export async function POST(request: NextRequest) {
  try {
    // 인증
    const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
    if (!accessToken) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 만료되었습니다. 다시 로그인해주세요.' }, { status: 401 })
    }

    if (!checkRateLimit(user.id)) {
      return NextResponse.json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, { status: 429 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'AI 기능이 설정되지 않았습니다.' }, { status: 500 })
    }

    const body = await request.json()
    const blocks: ContentBlock[] = []

    if (body.songId) {
      // 기존 악보: RLS 로 접근 가능한 곡인지 확인 후 file_url 획득
      const { data: song, error: songErr } = await userClient
        .from('songs')
        .select('file_url, file_type')
        .eq('id', body.songId)
        .single()
      if (songErr || !song?.file_url) {
        return NextResponse.json({ error: '악보를 찾을 수 없거나 접근 권한이 없습니다.' }, { status: 404 })
      }
      const parsed = parseStorage(song.file_url)
      if (!parsed) {
        return NextResponse.json({ error: '악보 파일 경로를 해석할 수 없습니다.' }, { status: 400 })
      }
      // service-role 로 private 버킷에서 다운로드
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { data: blob, error: dlErr } = await admin.storage.from(parsed.bucket).download(parsed.path)
      if (dlErr || !blob) {
        return NextResponse.json({ error: '악보 파일을 불러오지 못했습니다.' }, { status: 502 })
      }
      const base64 = Buffer.from(await blob.arrayBuffer()).toString('base64')
      blocks.push(toBlock(mediaTypeFromPath(parsed.path), base64))
    } else if (Array.isArray(body.images) && body.images.length > 0) {
      // 새 업로드(다중 페이지)
      const images = body.images.slice(0, MAX_IMAGES)
      for (const img of images) {
        if (!img?.data || typeof img.data !== 'string') continue
        blocks.push(toBlock(String(img.mediaType || 'image/jpeg'), img.data))
      }
      if (blocks.length === 0) {
        return NextResponse.json({ error: '유효한 이미지가 없습니다.' }, { status: 400 })
      }
    } else {
      return NextResponse.json({ error: 'songId 또는 images 가 필요합니다.' }, { status: 400 })
    }

    blocks.push({ type: 'text', text: 'Transcribe this sheet into the ChordChart JSON.' })

    const anthropic = new Anthropic({ apiKey })
    const message = await anthropic.messages.create({
      model: CHORD_CHART_MODEL,
      max_tokens: CHORD_CHART_MAX_TOKENS,
      // 추론 비활성화: 악보 전사엔 무거운 추론 불필요 → 비용 −87%, 속도 ~4배(120s→~10s).
      thinking: { type: 'disabled' },
      system: CHORD_CHART_SYSTEM_PROMPT,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: [{ role: 'user', content: blocks as any }],
    })

    const text = message.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
    console.log(
      `[chord-chart/extract] stop=${message.stop_reason} in=${message.usage?.input_tokens} out=${message.usage?.output_tokens} textLen=${text.length}`
    )
    let chart
    try {
      chart = parseChordChart(text)
    } catch (parseErr) {
      console.error('[chord-chart/extract] 파싱 실패:', (parseErr as Error).message)
      console.error('[chord-chart/extract] head:', text.slice(0, 400))
      console.error('[chord-chart/extract] tail:', text.slice(-400))
      const truncated = message.stop_reason === 'max_tokens'
      return NextResponse.json(
        {
          error: truncated
            ? '악보가 너무 길어 변환이 잘렸습니다. 페이지를 나눠 다시 시도해주세요.'
            : '추출 결과를 해석하지 못했습니다. 다시 시도해주세요.',
        },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true, chart })
  } catch (e) {
    console.error('[chord-chart/extract] 오류:', e)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
