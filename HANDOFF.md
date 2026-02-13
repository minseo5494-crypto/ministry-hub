# HANDOFF - 프로젝트 인수인계 문서

**마지막 업데이트**: 2026년 2월 13일 (오후)

---

## 1. 프로젝트 현재 상태

| 항목 | 상태 |
|------|------|
| **서비스명** | WORSHEEP |
| **개발 단계** | MVP 완료 (95%) |
| **베타 테스트** | 2월 20일 배포 예정 |
| **등록 곡 수** | 1,739곡 |
| **가입자 수** | 11명 |
| **팀 구성** | 1인 (2월 디자이너 합류 예정) |
| **도메인** | worsheep.org (호스팅케이알, 만료 2027-01-22) |
| **비즈니스 이메일** | minseo@worsheep.org (Google Workspace) |
| **시스템 이메일** | noreply@worsheep.org (Resend SMTP) |

---

## 2. 최근 작업 (2026-02-13)

### 완료된 작업 (오후 세션)
- [x] **이메일 로그인 동의 팝업 수정** — `app_metadata.provider`로 인증 방식 감지 (DB 값 대신 Supabase auth 사용), PKCE 호환
- [x] **데모 팀 자동 가입 수정** — 이메일 인증 콜백에서 `setup-user` API 호출로 통합 (join-demo 중복 제거)
- [x] **탈퇴 후 재가입 오류 수정** — setup-user API에서 upsert 전 orphaned email 행 삭제 (email 유니크 제약조건 위반 해결)
- [x] **인증 콜백 PKCE 호환** — URL 해시 기반 감지를 `session.user.app_metadata?.provider` 기반으로 변경
- [x] **setup-user API 개선** — `termsAgreedAt` 파라미터 추가, orphaned 데이터 정리

### 이전 작업 요약 (2/13 새벽)
- 팀 생성/삭제/데모 팀 가입 서버 API 전환, 계정 삭제 FK 오류 수정
- 추천 악보 RLS 우회, 콜백 세션 토큰 버그 수정, Vercel 환경변수 추가

### 이전 작업 요약 (2/12)
- 악보 에디터/콘티 모바일 레이아웃 개선, iOS Safari 캔버스 제한
- 앱 아이콘 양 캐릭터 교체, 로그인 에러 메시지 수정, 팀 최대 10개 제한

---

## 3. 다음에 할 일

### 즉시 (다음 세션)
1. [ ] **RLS 정책 전면 점검** — 현재 많은 테이블에서 클라이언트(anon key) SELECT/INSERT/DELETE가 RLS에 의해 차단됨. 서버 API로 우회 중이지만, 근본적으로 RLS 정책을 정리하거나 더 많은 작업을 서버 API로 전환 필요
2. [ ] **page.tsx 거대 컴포넌트 분리** — 1900줄+, useState 50개+를 커스텀 훅으로 분리

### 단기 (베타 전 - 2월 20일까지)
- [ ] 테스터 모집 및 피드백 수집 체계 구축
- [ ] UI/UX 개선 (디자이너 합류 시)
- [ ] 커스텀 역할 기능 실제 테스트

### 중기 (베타 기간)
- [ ] 베타 피드백 반영
- [ ] 파트너십 연락
- [ ] 디자이너와 UI/UX 리뉴얼

---

## 4. 주요 파일 위치

### 핵심 코드
| 기능 | 경로 |
|------|------|
| 메인 페이지 | `src/app/main/page.tsx` |
| 로그인 | `src/app/login/page.tsx` |
| 회원가입 | `src/app/signup/page.tsx` |
| 이메일 확인 API | `src/app/api/auth/check-email/route.ts` |
| 사용자 설정 API | `src/app/api/auth/setup-user/route.ts` |
| 인증 함수 | `src/lib/auth.ts` |
| 인증 콜백 | `src/app/auth/callback/page.tsx` |
| 데모 팀 가입 API | `src/app/api/teams/join-demo/route.ts` |
| 팀 생성 API | `src/app/api/teams/create/route.ts` |
| 팀 삭제 API | `src/app/api/teams/delete/route.ts` |
| 계정 삭제 API | `src/app/api/account/delete/route.ts` |
| 주간 인기곡 API | `src/app/api/songs/weekly-popular/route.ts` |
| 팀 참여 | `src/app/teams/join/page.tsx` |
| 팀 설정 | `src/app/my-team/[id]/settings/page.tsx` |
| 악보 에디터 | `src/components/SheetMusicEditor.tsx` |
| 악보 뷰어 | `src/components/SheetMusicViewer.tsx` |
| 콘티 상세 | `src/app/my-team/[id]/setlist/[setlistId]/page.tsx` |

### 문서
| 문서 | 경로 |
|------|------|
| 서비스 인프라 현황 | `docs/내부/서비스_인프라_현황.md` |
| 운영비용 정리 | `docs/내부/운영비용_정리.md` |
| 내부 운영 가이드 | `docs/내부/내부운영_가이드.md` |
| 사업계획서 | `docs/사업계획서/` |

---

## 5. 인프라 주요 변경 이력

| 날짜 | 변경 |
|------|------|
| 2026-02-13 | 인증 콜백 PKCE 호환 (app_metadata.provider 기반 감지) |
| 2026-02-13 | setup-user API: termsAgreedAt 추가, orphaned email 정리 |
| 2026-02-13 | 메인 페이지: 이메일 사용자 자동 수정 로직 추가 |
| 2026-02-13 | 팀 생성/삭제 서버 API 전환 (RLS 우회) |
| 2026-02-13 | 데모 팀 가입 서버 API 전환 (/api/teams/join-demo) |
| 2026-02-13 | 주간 인기곡 서버 API 추가 (/api/songs/weekly-popular) |
| 2026-02-13 | Vercel에 SUPABASE_SERVICE_ROLE_KEY 환경변수 추가 |
| 2026-02-12 | 앱 아이콘 양 캐릭터로 교체 (PWA + favicon) |
| 2026-02-12 | iOS Safari 캔버스 제한 적용 (뷰어 + 에디터 + 내보내기) |
| 2026-02-12 | 팀 생성/참여 최대 10개 제한 추가 |
| 2026-02-10 | Resend SMTP 연동 (도메인 인증 완료, Tokyo 리전) |
| 2026-02-10 | Google OAuth setup-user API 추가 (RLS 우회, 데모 팀 자동 가입) |

---

## 6. 주요 정보

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

## 7. 알려진 이슈: RLS 문제

현재 많은 Supabase 테이블에서 **클라이언트(anon key)의 CRUD가 RLS에 의해 차단**됨. 서버 API(service role key)로 우회 중:

| 테이블 | 문제 | 우회 방법 |
|--------|------|-----------|
| teams | INSERT/DELETE 차단 | `/api/teams/create`, `/api/teams/delete` |
| team_members | INSERT 차단 | `/api/teams/join-demo` |
| team_roles | INSERT/DELETE 차단 (트리거 포함) | service role 사용 |
| activity_logs | SELECT 차단 | `/api/songs/weekly-popular` |
| users | UPDATE 차단 (세션 없는 경우) | `/api/auth/setup-user` |

근본적 해결: RLS 정책 전면 점검 또는 모든 DB 작업을 서버 API로 전환

---

## 8. 새 대화 시작 시

```
HANDOFF.md 읽어줘
```

현재 상태:
- 이메일 로그인 시 동의 팝업 안 뜸 (app_metadata.provider 기반 감지)
- 데모 팀 자동 가입 정상 작동 (신규/재가입 모두)
- 탈퇴 후 재가입 시 orphaned 데이터 자동 정리
- 모든 변경사항 커밋/푸시 완료
- Vercel 자동 배포됨

---

*이 문서는 컨텍스트 리셋 시 업데이트됩니다.*
