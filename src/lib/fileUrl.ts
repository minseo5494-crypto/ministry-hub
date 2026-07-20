// src/lib/fileUrl.ts
//
// 스토리지 파일 접근을 프록시 라우트(/api/files)로 우회시키는 헬퍼.
//
// 배경: songs.file_url 은 전체 public URL(.../object/public/<bucket>/<path>)로 저장돼 있고,
// <img>/<iframe>/pdfjs/fetch 등 여러 곳에서 직접 소비된다. 버킷을 private 로 전환하려면
// 모든 읽기 경로가 접근제어 지점(프록시)을 통과해야 한다.
//
// 앱 세션은 쿠키가 아니라 localStorage 에 저장되므로, <img>/<iframe> 요청은 인증 헤더를
// 실을 수 없다. 따라서 프록시 URL 에 현재 access token 을 ?token= 로 붙인다.
// (fetch/pdfjs 는 Authorization 헤더도 지원하지만, 통일을 위해 동일하게 처리한다.)
//
// ⚠️ 현재 버킷은 아직 public 이다(1~2단계). 토큰이 아직 로드되지 않은 짧은 순간에는
//    원본 public URL 로 그대로 통과시켜 화면이 깨지지 않게 한다.
//    3단계(버킷 private 전환) 시 이 fallback 을 제거하고 토큰을 항상 요구해야 한다.

import { supabase } from '@/lib/supabase'

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
const PUBLIC_PREFIX = '/storage/v1/object/public/'

// 현재 세션 access token 을 메모리에 캐시 (동기 접근용).
let cachedAccessToken: string | null = null

if (typeof window !== 'undefined') {
  // 초기 로드 시 세션 복원
  supabase.auth.getSession().then(({ data }) => {
    cachedAccessToken = data.session?.access_token ?? null
  })
  // 로그인/로그아웃/토큰 갱신 시 최신 토큰 유지
  supabase.auth.onAuthStateChange((_event, session) => {
    cachedAccessToken = session?.access_token ?? null
  })
}

export interface StorageRef {
  bucket: string
  /** URL 인코딩된 상태의 경로 (file_url 에 저장된 형태 그대로). */
  encodedPath: string
}

/**
 * 전체 public URL 에서 버킷/경로를 추출한다.
 * 스토리지 URL 이 아니면(외부 URL 등) null 을 반환한다.
 */
export function parseStorageRef(fileUrl: string): StorageRef | null {
  if (!fileUrl) return null
  const idx = fileUrl.indexOf(PUBLIC_PREFIX)
  if (idx === -1) return null
  const rest = fileUrl.slice(idx + PUBLIC_PREFIX.length) // "<bucket>/<path...>"
  const slash = rest.indexOf('/')
  if (slash === -1) return null
  return { bucket: rest.slice(0, slash), encodedPath: rest.slice(slash + 1) }
}

/**
 * 저장된 스토리지 URL 을 프록시 URL(/api/files/<bucket>/<path>?token=...)로 변환한다.
 * - 스토리지 URL 이 아니면(youtube 등 외부 URL, 이미 프록시 URL) 그대로 반환.
 * - 토큰이 아직 없으면 원본 URL 을 그대로 반환(버킷 public 유지 중이므로 안전).
 *   ⚠️ 3단계 전환 시 이 fallback 제거 필요.
 *
 * ⚠️ 프래그먼트(#toolbar=0 등)는 이 함수가 붙이지 않는다. 호출부에서
 *    `toProxyUrl(url) + '#toolbar=0...'` 처럼 뒤에 붙일 것(쿼리 뒤 프래그먼트가 정상 순서).
 */
export function toProxyUrl(fileUrl: string | null | undefined): string {
  if (!fileUrl) return ''
  // 이미 프록시 URL 이면 그대로
  if (fileUrl.startsWith('/api/files/')) return fileUrl
  const ref = parseStorageRef(fileUrl)
  if (!ref) return fileUrl // 외부 URL — 변환하지 않음
  const base = `/api/files/${ref.bucket}/${ref.encodedPath}`
  if (!cachedAccessToken) return fileUrl // 토큰 미로드 — public URL 로 fallback
  return `${base}?token=${encodeURIComponent(cachedAccessToken)}`
}

/** 서버에서 프록시 경로 후보의 원본 public URL 을 재구성한다(접근확인용 file_url 매칭). */
export function buildPublicUrl(bucket: string, encodedPath: string): string {
  return `${SUPABASE_URL}${PUBLIC_PREFIX}${bucket}/${encodedPath}`
}
