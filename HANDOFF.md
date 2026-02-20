# HANDOFF - 프로젝트 인수인계 문서

**마지막 업데이트**: 2026년 2월 20일 오후

---

## 1. 프로젝트 현재 상태

| 항목 | 상태 |
|------|------|
| **서비스명** | WORSHEEP |
| **개발 단계** | MVP 완료 (95%) |
| **베타 테스트** | 2월 20일 연락 시작 |
| **등록 곡 수** | 1,809곡 |
| **가입자 수** | 11명 |
| **팀 구성** | 1인 (2월 디자이너 합류 예정) |
| **도메인** | worsheep.org (호스팅케이알, 만료 2027-01-22) |
| **비즈니스 이메일** | minseo@worsheep.org (Google Workspace) |
| **시스템 이메일** | noreply@worsheep.org (Resend SMTP) |

---

## 2. 보안 수정 현황

> 2026-02-17~19 보안 점검에서 발견된 취약점을 대부분 수정 완료.
> 상세 보고서: `docs/내부/보안_점검_보고서.md`

### 완료된 보안 수정

| 항목 | 위험도 | 상태 |
|------|--------|------|
| **`/api/auth/setup-user` 인증 추가** | **치명적** | ✅ 완료 (02-19) |
| **`/api/auth/check-email` 쿼리 최적화** | **높음** | ✅ 완료 (02-19) |
| **AI 검색 프롬프트 인젝션 방어** | **높음** | ✅ 완료 (02-19) |
| **AI 검색 Rate Limiting** (분당 5회) | **높음** | ✅ 완료 (02-19) |
| **API 에러 메시지 내부 정보 노출 제거** | **높음** | ✅ 완료 (02-19) |
| **PDF innerHTML XSS 방어** | **높음** | ✅ 완료 (02-19) |
| **setup-user profileImageUrl/authProvider 검증** | **높음** | ✅ 완료 (02-19) |
| **is_admin 테이블 불일치 수정** (profiles→users) | **높음** | ✅ 완료 (02-19) |
| **weekly-popular API 인증 추가** | **높음** | ✅ 완료 (02-19) |
| **악성 유저 차단** (1129devs@gmail.com, 프롬프트 인젝션 시도) | — | ✅ Ban 완료 |

### 단기 조치 (1-2주 내)

| 순위 | 항목 | 위험도 | 예상 작업량 |
|------|------|--------|-----------|
| 1 | **RLS 미적용 7개 핵심 테이블 정책 추가** (teams, team_members 등) | **높음** | 5-8시간 |
| 2 | **Next.js 미들웨어 추가** (전역 인증 가드) | 중간 | 2시간 |
| 3 | **관리자 페이지 서버 API 전환** (클라이언트 anon key로 RLS 없는 테이블 직접 조작 중) | 높음 | 3-4시간 |

### 중기 조치 (3-4주)

| 순위 | 항목 | 예상 작업량 |
|------|------|-----------|
| 4 | 중간 우선순위 6개 테이블 RLS 적용 (feedbacks, song_likes 등) | 3-4시간 |
| 5 | check-email 계정 열거 방지 (Rate Limiting) | 1시간 |
| 6 | my-page 파일 업로드 MIME 타입 검증 | 30분 |
| 7 | invite_code 암호학적 난수 변경 (`Math.random()` → `crypto.randomBytes()`) | 30분 |
| 8 | 관리자 페이지 서버사이드 권한 체크 | 2시간 |

### 현재 보안 상태 요약
- RLS 적용: 8/34 테이블 (23.5%) - 기존 정책은 잘 구현됨
- API 인증: 모든 API 인증 적용 완료
- 프롬프트 인젝션: 3중 방어 (패턴 감지 + 시스템 프롬프트 강화 + 응답 검증)
- Rate Limiting: AI 검색 적용 완료
- 환경변수 관리: 양호 (service_role_key 서버 전용)
- 미들웨어: 없음 (전역 인증 가드 부재)

---

## 3. 최근 작업 (2026-02-20 저녁)

### 완료된 작업
- [x] **관리자 페이지 데이터 정합성 이슈 11건 수정** (da6a9b3)
  - 대시보드: songs 통계 숨김 곡 필터, PostgREST 1000건 제한 해결, DAU/WAU/MAU 삭제된 사용자 제외, 성장 비교 관리자 제외
  - 곡 승인: 삭제된 사용자 승인 방지 (requester JOIN + NULL 체크)
  - 팀 승인: 삭제된 사용자 경고 표시
  - 계정 관리: member_count 실시간 집계, feedbacks 삭제→null 보존
- [x] **auth.users ↔ public.users 동기화 트리거 추가** — auth.users 삭제 시 public.users 자동 정리
- [x] **고아 레코드 정리** — minseo5494@gmail.com (public.users에만 존재) 삭제
- [x] **CLAUDE.md 테이블명 수정** — profiles→users, songforms→team_setlists
- [x] **GA4 서비스 전용 계정 전환** — G-JGTQG531DE → G-VRWZH9YVDX
- [x] **Supabase Postgres Best Practices 에이전트 스킬 설치**

---

## 4. 이전 작업 요약

### 2026-02-20 오후
- GA4 서비스 전용 계정 전환, Supabase Best Practices 에이전트 스킬 설치

### 2026-02-19
- AI 검색 프롬프트 인젝션 3중 방어, 악성 유저 Ban 처리
- 보안 취약점 6건 수정 (Rate Limiting, XSS, 에러 노출 등)
- setup-user API 인증 추가, check-email 쿼리 최적화, 미사용 패키지 제거
- 콘티 생성/삭제 서버 API 전환, PostgREST 1000행 제한 수정

### 2026-02-17
- 보안 점검 보고서 작성, 빌드 최적화 분석, iOS Safari 호환성 검사

### 2026-02-13
- 이메일 로그인 동의 팝업, 데모 팀 자동 가입, 탈퇴 후 재가입 수정, 인증 콜백 PKCE 호환

---

## 5. 다음에 할 일

### 즉시 (다음 세션)
1. [ ] **베타 테스터 연락** — 카톡 메시지 + Notion 가이드 링크 (https://www.notion.so/Worsheep-2ff88dd5e72480ccb20df5ff437d97cf)
2. [ ] **page.tsx 거대 컴포넌트 분리** — 1900줄+, useState 50개+를 커스텀 훅으로 분리

### 단기 (베타 기간)
- [ ] 핵심 7개 테이블 RLS 적용 (섹션 2 참조)
- [ ] Next.js 미들웨어 추가
- [ ] 중간 보안 항목 수정 (check-email Rate Limit, MIME 검증, invite_code 등)
- [ ] 테스터 피드백 수집 및 반영

### 중기
- [ ] 관리자 페이지 서버 API 전환
- [ ] 나머지 RLS 적용
- [ ] 디자이너와 UI/UX 리뉴얼
- [ ] 파트너십 연락

---

## 6. 주요 파일 위치

### 핵심 코드
| 기능 | 경로 |
|------|------|
| 메인 페이지 | `src/app/main/page.tsx` |
| 팀 상세 페이지 | `src/app/my-team/[id]/page.tsx` |
| AI 검색 API | `src/app/api/ai-search/route.ts` |
| 콘티 생성 API | `src/app/api/setlists/create/route.ts` |
| 콘티 삭제 API | `src/app/api/setlists/delete/route.ts` |
| PDF 생성 | `src/lib/pdfGenerator.ts` |
| 에러 메시지 매핑 | `src/lib/errorMessages.ts` |
| 팀 권한 훅 | `src/hooks/useTeamPermissions.ts` |
| 사용자 설정 API | `src/app/api/auth/setup-user/route.ts` |
| 인증 함수 | `src/lib/auth.ts` |
| 악보 에디터 | `src/components/SheetMusicEditor.tsx` |

### 문서
| 문서 | 경로 |
|------|------|
| 서비스 인프라 현황 | `docs/내부/서비스_인프라_현황.md` |
| 운영비용 정리 | `docs/내부/운영비용_정리.md` |
| 보안 점검 보고서 | `docs/내부/보안_점검_보고서.md` |
| 베타 초대 메시지 | `docs/마케팅/베타테스트_초대메시지.md` |
| 빠른 시작 가이드 | `docs/사용자가이드/빠른시작_가이드_Notion.md` |
| 베타테스터 가이드 | `docs/사용자가이드/베타테스터_가이드.md` |
| 사업계획서 | `docs/사업계획서/` |

---

## 7. 인프라 주요 변경 이력

| 날짜 | 변경 |
|------|------|
| 2026-02-20 | 관리자 페이지 데이터 정합성 이슈 11건 수정 |
| 2026-02-20 | auth.users 삭제 트리거 추가 (public.users 자동 정리) |
| 2026-02-20 | GA4 서비스 전용 계정 전환 (G-JGTQG531DE → G-VRWZH9YVDX) |
| 2026-02-20 | Supabase Postgres Best Practices 에이전트 스킬 설치 |
| 2026-02-19 | AI 검색 프롬프트 인젝션 3중 방어 추가 |
| 2026-02-19 | 보안 취약점 6건 수정 (Rate Limit, XSS, 에러 노출, URL 검증 등) |
| 2026-02-19 | 악성 유저 1129devs@gmail.com Ban 처리 |
| 2026-02-19 | setup-user API 인증 추가 (Bearer 토큰 검증) |
| 2026-02-19 | check-email API 쿼리 최적화 (단건 조회) |
| 2026-02-19 | 콘티 생성/삭제 서버 API 전환, PostgREST 1000행 제한 수정 |
| 2026-02-17 | 보안 점검 보고서 작성 |
| 2026-02-13 | 인증 콜백 PKCE 호환, 팀 생성/삭제 서버 API 전환 |
| 2026-02-12 | iOS Safari 캔버스 제한, 앱 아이콘 교체 |
| 2026-02-10 | Resend SMTP 연동, Google OAuth setup-user API 추가 |

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
| Anthropic API | AI 검색 (claude-3-haiku) |
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
- 관리자 페이지 데이터 정합성 11건 수정 완료 (대시보드 통계, 승인 페이지, 계정 관리)
- auth.users ↔ public.users 동기화 트리거 추가 완료
- 보안 취약점 수정 완료, 모든 변경사항 커밋/푸시 완료
- 베타 테스트 연락 진행 중

---

*이 문서는 컨텍스트 리셋 시 업데이트됩니다.*
