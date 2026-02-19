# HANDOFF - 프로젝트 인수인계 문서

**마지막 업데이트**: 2026년 2월 19일

---

## 1. 프로젝트 현재 상태

| 항목 | 상태 |
|------|------|
| **서비스명** | WORSHEEP |
| **개발 단계** | MVP 완료 (95%) |
| **베타 테스트** | 2월 20일 배포 예정 |
| **등록 곡 수** | 1,809곡 |
| **가입자 수** | 11명 |
| **팀 구성** | 1인 (2월 디자이너 합류 예정) |
| **도메인** | worsheep.org (호스팅케이알, 만료 2027-01-22) |
| **비즈니스 이메일** | minseo@worsheep.org (Google Workspace) |
| **시스템 이메일** | noreply@worsheep.org (Resend SMTP) |

---

## 2. 보안 수정 현황

> 2026-02-17 보안 점검에서 치명적/높은 취약점이 발견되었습니다.
> 상세 보고서: `docs/내부/보안_점검_보고서.md`

### 완료된 보안 수정

| 항목 | 위험도 | 상태 |
|------|--------|------|
| **`/api/auth/setup-user` 인증 추가** | **치명적** | ✅ 완료 (2026-02-19) |
| **`/api/auth/check-email` 쿼리 최적화** | **높음** | ✅ 완료 (2026-02-19) |

### 단기 조치 (1-2주 내)

| 순위 | 항목 | 위험도 | 예상 작업량 |
|------|------|--------|-----------|
| 1 | `/api/songs/weekly-popular` 인증 추가 또는 anon key 전환 | 낮음 | 15분 |
| 2 | **RLS 미적용 7개 핵심 테이블 정책 추가** (teams, team_members, team_setlists, team_setlist_songs, team_fixed_songs, songs, users) | **높음** | 5-8시간 |
| 3 | **Next.js 미들웨어 추가** (전역 인증 가드) | 중간 | 2시간 |
| 4 | **관리자 페이지 서버 API 전환** (클라이언트 anon key로 RLS 없는 테이블 직접 조작 중) | 높음 | 3-4시간 |

### 중기 조치 (3-4주)

| 순위 | 항목 | 예상 작업량 |
|------|------|-----------|
| 5 | 중간 우선순위 6개 테이블 RLS 적용 (feedbacks, song_likes 등) | 3-4시간 |
| 6 | Rate Limiting 적용 (인증 관련 API) | 2-3시간 |
| 7 | invite_code 암호학적 난수로 변경 (`Math.random()` -> `crypto.randomBytes()`) | 30분 |

### 현재 보안 상태 요약
- RLS 적용: 8/34 테이블 (23.5%) - 기존 정책은 잘 구현됨
- API 인증: 모든 API 인증 적용 완료 (setup-user, check-email 수정됨)
- 환경변수 관리: 양호 (service_role_key 서버 전용)
- 미들웨어: 없음 (전역 인증 가드 부재)

---

## 3. 최근 작업 (2026-02-19 오후)

### 완료된 작업
- [x] **setup-user API 인증 추가** — Bearer 토큰 검증, userId/email 토큰에서 추출, mergeFromId 이메일 검증
- [x] **check-email API 쿼리 최적화** — listUsers 1000명 로드 → users 테이블 단건 조회
- [x] **미사용 패키지 4개 제거** — @react-pdf/renderer, jszip, jspdf-autotable, @supabase/auth-helpers-nextjs

---

## 4. 이전 작업 요약

### 2026-02-19 오전
- 콘티 생성/삭제 서버 API 전환, PostgREST 1000행 제한 수정, 정렬/에러 메시지 개선

### 2026-02-17
- 보안 점검 보고서 작성, 빌드 최적화 분석, iOS Safari 호환성 검사

### 2026-02-13
- 이메일 로그인 동의 팝업 수정, 데모 팀 자동 가입, 탈퇴 후 재가입 수정
- 인증 콜백 PKCE 호환, 팀 생성/삭제 서버 API 전환

### 2026-02-12
- 악보 에디터/콘티 모바일 레이아웃, iOS Safari 캔버스 제한, 앱 아이콘 교체

---

## 5. 다음에 할 일

### 즉시 (다음 세션)
1. [ ] **page.tsx 거대 컴포넌트 분리** — 1900줄+, useState 50개+를 커스텀 훅으로 분리

### 단기 (베타 전 - 2월 20일까지)
- [ ] 핵심 7개 테이블 RLS 적용 (섹션 2 참조)
- [ ] Next.js 미들웨어 추가
- [ ] 테스터 모집 및 피드백 수집 체계 구축
- [ ] UI/UX 개선 (디자이너 합류 시)

### 중기 (베타 기간)
- [ ] 나머지 RLS 적용 + Rate Limiting
- [ ] 베타 피드백 반영
- [ ] 파트너십 연락
- [ ] 디자이너와 UI/UX 리뉴얼

---

## 6. 주요 파일 위치

### 핵심 코드
| 기능 | 경로 |
|------|------|
| 메인 페이지 | `src/app/main/page.tsx` |
| 팀 상세 페이지 | `src/app/my-team/[id]/page.tsx` |
| 콘티 생성 API | `src/app/api/setlists/create/route.ts` |
| 콘티 삭제 API | `src/app/api/setlists/delete/route.ts` |
| 에러 메시지 매핑 | `src/lib/errorMessages.ts` |
| 팀 권한 훅 | `src/hooks/useTeamPermissions.ts` |
| 로그인 | `src/app/login/page.tsx` |
| 회원가입 | `src/app/signup/page.tsx` |
| 이메일 확인 API | `src/app/api/auth/check-email/route.ts` |
| 사용자 설정 API | `src/app/api/auth/setup-user/route.ts` |
| 인증 함수 | `src/lib/auth.ts` |
| 인증 콜백 | `src/app/auth/callback/page.tsx` |
| 팀 생성 API | `src/app/api/teams/create/route.ts` |
| 팀 삭제 API | `src/app/api/teams/delete/route.ts` |
| 악보 에디터 | `src/components/SheetMusicEditor.tsx` |
| 콘티 상세 | `src/app/my-team/[id]/setlist/[setlistId]/page.tsx` |

### 문서
| 문서 | 경로 |
|------|------|
| 서비스 인프라 현황 | `docs/내부/서비스_인프라_현황.md` |
| 운영비용 정리 | `docs/내부/운영비용_정리.md` |
| 내부 운영 가이드 | `docs/내부/내부운영_가이드.md` |
| 사업계획서 | `docs/사업계획서/` |

---

## 7. 인프라 주요 변경 이력

| 날짜 | 변경 |
|------|------|
| 2026-02-19 | setup-user API 인증 추가 (Bearer 토큰 검증) |
| 2026-02-19 | check-email API 쿼리 최적화 (단건 조회) |
| 2026-02-19 | 미사용 패키지 4개 제거 |
| 2026-02-19 | 콘티 생성/삭제 서버 API 추가 (권한 체크 포함) |
| 2026-02-19 | 메인페이지 콘티 저장 서버 API 전환 |
| 2026-02-19 | Supabase PostgREST 1000행 제한 전체 수정 (페이지네이션) |
| 2026-02-19 | getErrorMessage 한국어 에러 패스스루 로직 추가 |
| 2026-02-13 | 인증 콜백 PKCE 호환 (app_metadata.provider 기반 감지) |
| 2026-02-13 | setup-user API: termsAgreedAt 추가, orphaned email 정리 |
| 2026-02-13 | 팀 생성/삭제 서버 API 전환 (RLS 우회) |
| 2026-02-12 | 앱 아이콘 양 캐릭터로 교체 (PWA + favicon) |
| 2026-02-12 | iOS Safari 캔버스 제한 적용 (뷰어 + 에디터 + 내보내기) |
| 2026-02-10 | Resend SMTP 연동 (도메인 인증 완료, Tokyo 리전) |
| 2026-02-10 | Google OAuth setup-user API 추가 (RLS 우회, 데모 팀 자동 가입) |

---

## 8. 주요 정보

### 연락처
- 담당자: 조민서
- 이메일: minseo@worsheep.org
- 전화: 010-3150-4221

### 서비스 URL
- **프로덕션**: https://worsheep.org
- **GitHub**: https://github.com/minseo5494-crypto/ministry-hub

### 외부 서비스
| 서비스 | 용도 |
|--------|------|
| Supabase | DB, Auth, Storage (Project ID: uoneiotepfmikprknxhk) |
| Vercel | 배포, 호스팅 |
| Resend | 시스템 이메일 발송 (SMTP) |
| Google Workspace | 비즈니스 이메일 |
| 호스팅케이알 | 도메인 등록/관리 |
| Anthropic API | AI 검색 |
| Cloudflare Turnstile | CAPTCHA |

> 전체 인프라 상세 정보: `docs/내부/서비스_인프라_현황.md`

---

## 9. 알려진 이슈: RLS 문제

현재 많은 Supabase 테이블에서 **클라이언트(anon key)의 CRUD가 RLS에 의해 차단**됨. 서버 API(service role key)로 우회 중:

| 테이블 | 문제 | 우회 방법 |
|--------|------|-----------|
| teams | INSERT/DELETE 차단 | `/api/teams/create`, `/api/teams/delete` |
| team_members | INSERT 차단 | `/api/teams/join-demo` |
| team_roles | INSERT/DELETE 차단 (트리거 포함) | service role 사용 |
| team_setlists | INSERT/DELETE 차단 | `/api/setlists/create`, `/api/setlists/delete` |
| activity_logs | SELECT 차단 | `/api/songs/weekly-popular` |
| users | UPDATE 차단 (세션 없는 경우) | `/api/auth/setup-user` |

근본적 해결: RLS 정책 전면 점검 또는 모든 DB 작업을 서버 API로 전환

---

## 10. 새 대화 시작 시

```
HANDOFF.md 읽어줘
```

현재 상태:
- setup-user API 인증 추가 완료 (치명적 보안 취약점 해결)
- check-email API 쿼리 최적화 완료
- 미사용 패키지 4개 제거 완료
- 모든 변경사항 커밋/푸시 완료, Vercel 배포됨
- 로그인/로그인실패 테스트 정상 확인

---

*이 문서는 컨텍스트 리셋 시 업데이트됩니다.*
