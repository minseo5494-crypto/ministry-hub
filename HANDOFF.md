# HANDOFF - 프로젝트 인수인계 문서

**마지막 업데이트**: 2026년 2월 23일

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

> 2026-02-17~23 보안 점검 및 수정 진행 중.
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
| **악성 유저 차단** (1129devs@gmail.com) | — | ✅ Ban 완료 |
| **activity_logs 과도한 SELECT 정책 삭제** | 중간 | ✅ 완료 (02-23) |
| **songs INSERT 중복 정책 삭제** (user_id 위조 방지) | 중간 | ✅ 완료 (02-23) |
| **sheetmusic 스토리지 정책 교체** (무제한→역할별) | **높음** | ✅ 완료 (02-23) |

### RLS 재점검 결과 (02-23)

이전 감사(02-17) 대비 큰 개선:
- **RLS 활성화**: 8/34 → **33/33 (100%)**
- **anon 접근**: 다수 우려 → **0건**

### 남은 Critical RLS 이슈 (중간 난이도)

| 순위 | 대상 | 내용 | 영향범위 |
|------|------|------|----------|
| 1 | `songs` SELECT | "Enable read access for all users" (public, qual=true) → visibility 시스템 무력화 | 30+파일, authenticated 정책 검증 필요 |
| 2 | `users` SELECT | "users_select_authenticated" (qual=true) → 모든 유저 PII 노출 | Admin 전면 중단 위험, admin 예외 필요 |

### 단기 조치 (1-2주 내)

| 순위 | 항목 | 위험도 | 예상 작업량 |
|------|------|--------|-----------|
| 1 | **songs SELECT 정책 수정** (visibility 복원) | **높음** | 2-3시간 |
| 2 | **users SELECT 정책 수정** (PII 보호 + admin 예외) | **높음** | 2-3시간 |
| 3 | **Next.js 미들웨어 추가** (전역 인증 가드) | 중간 | 2시간 |
| 4 | **관리자 페이지 서버 API 전환** | 높음 | 3-4시간 |

### 중기 조치 (3-4주)

| 순위 | 항목 | 예상 작업량 |
|------|------|-----------|
| 5 | 중간 우선순위 테이블 정책 개선 (team_fixed_songs 팀 멤버십 체크 등) | 3-4시간 |
| 6 | check-email 계정 열거 방지 (Rate Limiting) | 1시간 |
| 7 | my-page 파일 업로드 MIME 타입 검증 | 30분 |
| 8 | invite_code 암호학적 난수 변경 (`Math.random()` → `crypto.randomBytes()`) | 30분 |
| 9 | sheetmusic 버킷 완전 비공개 전환 (API Proxy 필요, 30-40시간) | 장기 |

### 현재 보안 상태 요약
- RLS 활성화: 33/33 테이블 (100%) — 정책 품질 개선 진행 중
- API 인증: 모든 API 인증 적용 완료
- 스토리지: sheetmusic 버킷 역할별 정책 적용 (읽기:공개, 업로드:인증, 삭제:관리자)
- 프롬프트 인젝션: 3중 방어
- Rate Limiting: AI 검색 적용 완료
- 미들웨어: 없음 (전역 인증 가드 부재)

---

## 3. 최근 작업 (2026-02-23)

### 완료된 작업
- [x] **RLS 보안 취약점 3건 수정** (1881cc8)
  - activity_logs: 과도한 SELECT 정책(qual=true) 삭제
  - songs: 중복 INSERT 정책 삭제 (user_id 위조 방지)
  - sheetmusic 스토리지: 무제한 정책 삭제 → 역할별 정책 추가 + 50MB/MIME 제한
- [x] **다운로드 모달 파일명 입력 포커스 유실 수정** (1999ac8)
  - useDownload 훅의 DownloadFormatModal을 useCallback 컴포넌트 → 렌더 헬퍼 함수로 변환
  - 메인 페이지, 콘티 상세 페이지 모두 적용
- [x] **사업자등록 업종분류 가이드 문서 작성** (`docs/내부/사업자등록_업종분류_가이드.md`)
  - 주업종: 62010 컴퓨터 프로그래밍 서비스업, 부업종: 63120 인터넷 정보매개 서비스업

---

## 4. 이전 작업 요약

### 2026-02-20
- 관리자 페이지 데이터 정합성 이슈 11건 수정
- auth.users ↔ public.users 동기화 트리거 추가
- GA4 서비스 전용 계정 전환

### 2026-02-19
- AI 검색 프롬프트 인젝션 3중 방어, 악성 유저 Ban 처리
- 보안 취약점 6건 수정, setup-user API 인증 추가
- 콘티 생성/삭제 서버 API 전환, PostgREST 1000행 제한 수정

### 2026-02-17
- 보안 점검 보고서 작성, 빌드 최적화 분석, iOS Safari 호환성 검사

### 2026-02-13
- 이메일 로그인 동의 팝업, 데모 팀 자동 가입, 탈퇴 후 재가입 수정

---

## 5. 다음에 할 일

### 즉시 (다음 세션)
1. [ ] **songs SELECT RLS 정책 수정** — "Enable read access for all users" 삭제 + authenticated visibility 정책 검증
2. [ ] **users SELECT RLS 정책 수정** — 일반 유저는 자기 데이터만, admin은 전체 조회
3. [ ] **베타 테스터 피드백 수집** — 카톡 메시지 + Notion 가이드 링크

### 단기 (베타 기간)
- [ ] page.tsx 거대 컴포넌트 분리 (1900줄+)
- [ ] Next.js 미들웨어 추가
- [ ] 중간 보안 항목 수정 (check-email Rate Limit, MIME 검증, invite_code 등)
- [ ] 테스터 피드백 반영

### 중기
- [ ] 관리자 페이지 서버 API 전환
- [ ] sheetmusic 버킷 비공개 전환 (API Proxy 구축)
- [ ] 디자이너와 UI/UX 리뉴얼
- [ ] 파트너십 연락

---

## 6. 주요 파일 위치

### 핵심 코드
| 기능 | 경로 |
|------|------|
| 메인 페이지 | `src/app/main/page.tsx` |
| 팀 상세 페이지 | `src/app/my-team/[id]/page.tsx` |
| 다운로드 훅 | `src/hooks/useDownload.tsx` |
| AI 검색 API | `src/app/api/ai-search/route.ts` |
| 콘티 생성 API | `src/app/api/setlists/create/route.ts` |
| PDF 생성 | `src/lib/pdfGenerator.ts` |
| 팀 권한 훅 | `src/hooks/useTeamPermissions.ts` |
| 사용자 설정 API | `src/app/api/auth/setup-user/route.ts` |
| 인증 함수 | `src/lib/auth.ts` |
| 악보 에디터 | `src/components/SheetMusicEditor.tsx` |

### 문서
| 문서 | 경로 |
|------|------|
| 서비스 인프라 현황 | `docs/내부/서비스_인프라_현황.md` |
| 보안 점검 보고서 | `docs/내부/보안_점검_보고서.md` |
| 사업자등록 업종분류 | `docs/내부/사업자등록_업종분류_가이드.md` |
| 사업계획서 | `docs/사업계획서/` |

---

## 7. 인프라 주요 변경 이력

| 날짜 | 변경 |
|------|------|
| 2026-02-23 | RLS 보안 취약점 3건 수정 (activity_logs, songs INSERT, sheetmusic 스토리지) |
| 2026-02-23 | 다운로드 모달 파일명 입력 포커스 유실 수정 |
| 2026-02-20 | 관리자 페이지 데이터 정합성 이슈 11건 수정 |
| 2026-02-20 | auth.users 삭제 트리거 추가 (public.users 자동 정리) |
| 2026-02-20 | GA4 서비스 전용 계정 전환 |
| 2026-02-19 | AI 검색 프롬프트 인젝션 3중 방어 추가 |
| 2026-02-19 | 보안 취약점 6건 수정 |
| 2026-02-19 | setup-user API 인증 추가 |
| 2026-02-13 | 인증 콜백 PKCE 호환, 팀 생성/삭제 서버 API 전환 |

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

현재 일부 Supabase 테이블에서 **클라이언트(anon key)의 CRUD가 RLS에 의해 차단**됨. 서버 API(service role key)로 우회 중:

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
- RLS 보안 취약점 3건 수정 완료 (쉬운 항목), 중간 난이도 2건 남음 (songs SELECT, users SELECT)
- 다운로드 모달 포커스 유실 수정 완료
- 모든 변경사항 커밋/푸시 완료, Vercel 배포 트리거됨

---

*이 문서는 컨텍스트 리셋 시 업데이트됩니다.*
