// src/app/api/files/[...path]/route.ts
//
// 스토리지 파일 접근 프록시. 모든 악보/노트 파일 읽기가 이 지점을 통과한다.
//
// 흐름:
//   1) ?token= 또는 Authorization: Bearer 로 세션 확인 → 없으면 401
//   2) 접근 권한 확인
//      - admin: 전부 허용
//      - notebooks/<uid>/... (sheetmusic 버킷): uid 일치 시 허용
//      - 그 외(악보): 사용자 토큰으로 songs 를 조회 → 기존 songs RLS(팀 격리)가 판정
//   3) 통과 시 60초 서명 URL 발급 → 302 redirect (파일 바이트는 Supabase CDN 직배송)
//
// ⚠️ 현재 버킷은 아직 public 이므로 이 라우트를 우회한 원본 public URL 로도 파일이 열린다.
//    3단계(버킷 private 전환)에서 비로소 이 접근제어가 실질적으로 강제된다.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const ALLOWED_BUCKETS = new Set(['sheetmusic', 'song-sheets'])
const SIGNED_URL_TTL = 60 // seconds

function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// 사용자 토큰을 그대로 실은 클라이언트 → RLS 가 적용된다.
function userClient(token: string) {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params
    if (!path || path.length < 2) {
      return NextResponse.json({ error: '잘못된 경로' }, { status: 400 })
    }

    const bucket = path[0]
    if (!ALLOWED_BUCKETS.has(bucket)) {
      return NextResponse.json({ error: '알 수 없는 버킷' }, { status: 400 })
    }

    // 인코딩 보존 경로(file_url DB 매칭용) — Next 가 디코딩한 params 대신 원본 pathname 에서 추출
    const rawPath = new URL(req.url).pathname.split('/api/files/')[1] || ''
    const encodedPath = rawPath.slice(bucket.length + 1) // "<bucket>/" 제거
    // 서명 발급용 디코딩 경로(스토리지 오브젝트 키)
    const objectPath = path.slice(1).map(decodeURIComponent).join('/')
    if (!encodedPath || !objectPath) {
      return NextResponse.json({ error: '잘못된 경로' }, { status: 400 })
    }

    // 토큰 추출
    const token =
      req.nextUrl.searchParams.get('token') ||
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
      ''
    if (!token) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const admin = adminClient()
    const {
      data: { user },
      error: authError,
    } = await admin.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    // ── 접근 권한 확인 ────────────────────────────────────────────────
    const allowed = await checkAccess({
      admin,
      token,
      userId: user.id,
      bucket,
      encodedPath,
      objectPath,
    })
    if (!allowed) {
      return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
    }

    // ── 서명 URL 발급 → 302 redirect ─────────────────────────────────
    const { data, error } = await admin.storage
      .from(bucket)
      .createSignedUrl(objectPath, SIGNED_URL_TTL)
    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: '파일을 찾을 수 없습니다.' }, { status: 404 })
    }

    return NextResponse.redirect(data.signedUrl, 302)
  } catch (e) {
    console.error('[api/files] 오류:', e)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

async function checkAccess(args: {
  admin: ReturnType<typeof adminClient>
  token: string
  userId: string
  bucket: string
  encodedPath: string
  objectPath: string
}): Promise<boolean> {
  const { admin, token, userId, bucket, encodedPath, objectPath } = args

  // 1) 관리자는 전부 허용
  const { data: profile } = await admin
    .from('users')
    .select('is_admin')
    .eq('id', userId)
    .single()
  if (profile?.is_admin) return true

  // 2) 개인 노트북 파일: sheetmusic/notebooks/<uid>/...
  const segs = objectPath.split('/')
  if (bucket === 'sheetmusic' && segs[0] === 'notebooks') {
    return segs[1] === userId
  }

  // 3) 악보 파일: 사용자 토큰으로 songs 조회 → songs RLS(팀 격리)가 판정
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodedPath}`
  const { data: songs } = await userClient(token)
    .from('songs')
    .select('id')
    .eq('file_url', publicUrl)
    .limit(1)
  return !!(songs && songs.length > 0)
}
