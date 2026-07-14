# HANDOFF - 프로젝트 인수인계 문서

**마지막 업데이트**: 2026년 7월 14일

---

## 0. 프로젝트 상태: 냉동 보존 + 저작권 대응 계획 수립

> **2026-04-11**: WORSHEEP 프로젝트는 **냉동 보존** 상태입니다.
> - **사유**: 저작권 문제 미해결로 서비스 일시 중단
> - **계획**: 저작권 해결 시 서비스 재개 / AI 악보 변환 플랫폼으로 피봇 가능
> - **연습실 플랫폼**: 별도 프로젝트로 신규 개발 진행 중
> - **코드베이스**: 이 상태 그대로 보존 (건드리지 않음)
> - **Supabase**: ministry-hub 프로젝트 유지 (Free tier)
> - **Vercel**: 배포 유지 가능 (필요시 랜딩 페이지로 전환)
>
> **2026-07-14**: 저작권 대응 방향으로 **"전체공개 검색 폐지 → 팀 단위 공유 전환" 계획 수립 완료** (코드/DB 미변경, 계획만).
> - 계획서: `docs/내부/팀단위공유_전환계획.md`
> - 상세는 아래 섹션 3 참고. 서비스 재개 시 이 계획대로 착수 예정.

---

## 1. 프로젝트 현재 상태

| 항목 | 상태 |
|------|------|
| **서비스명** | WORSHEEP |
| **개발 단계** | MVP 완료 (95%) → **냉동 보존** |
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

## 3. 최근 작업 (2026-07-14) — 팀 단위 공유 전환 계획 수립

이번 세션은 **조사·계획만** 수행했고 코드/DB/기존 문서는 변경하지 않았다. `/team`으로 조사팀(backend/frontend/security/domain) 투입 + anon 키로 라이브 DB 직접 실측 병행.

### 라이브 실측 결과 (⚠️ 다음 세션에서 재조사 불필요, 확증됨)
- **anon(비로그인) 키로 `songs` 1,830곡 전량 + `song_sheets` 1,672건 전량이 그대로 읽힘.** `visibility='teams'` 곡도 예외 없이 노출. → 섹션 9의 "songs SELECT 전체공개" 알려진 이슈가 라이브로 확증됨. 필터링이 서버(RLS)가 아니라 브라우저 JS(`useSongSearch.ts`, `main/page.tsx fetchSongs`)에서만 돌고 있음.
- **Storage 버킷(`sheetmusic`, `song-sheets`)이 public이라 file_url 직접 GET 시 HTTP 200.** RLS를 조여도 파일은 샌다 (public 버킷 URL은 RLS를 안 탐).
- **songs 1,830곡은 이미 전량 `visibility='teams'`, is_hidden=false.** 데이터 전환은 절반 되어 있고 강제(enforcement)만 안 됨.
- `teams`/`team_members`/`users` 등은 anon 차단 정상. **`shared_setlists`는 비로그인에 2건 읽히는 RLS 드리프트 버그** (마이그레이션 의도와 라이브 동작 불일치).
- `song_sheets` 테이블은 코드에서 SELECT 0건 = 사실상 미사용. 실파일은 `songs.file_url`. song_sheets 1,672건은 샘플 전부 team_id/uploaded_by NULL (레거시 벌크 = 고아 데이터).

### 확정된 결정 (대표 결정 완료)
1. **전환 범위: 전체공개 완전 폐지 (b안)** — 모든 곡을 팀 안으로, 전체공개 옵션 제거.
2. **기존 1,809곡: 업로더 기준 팀 자동 귀속** (업로더·팀 없는 고아는 비공개 격리 후 재검수).
3. **explore + shared_setlists 크로스팀 공유: 내 팀 스코프로 축소** (폐지 아님).
4. **긴급 지혈은 전체 계획에 통합** (냉동 상태라 실사용자 리스크 낮음).

### 후속 파급 (계획서 5번 섹션)
- Free 요금제("검색·미리보기·월 10곡")는 공용 풀 소멸로 성립 불가 → 재설계 필요.
- 파트너 MoU "추천 워십팀 노출" 조항 무효화 → 재협의 필요.
- 사업계획서/소개서의 "1,700곡+ 통합 검색" 서술 전면 갱신 필요.

---

## 4. 이전 작업 요약

### 2026-03-13
- 전체공개 곡 업로드 시 관리자 승인 시스템 (`1011780`), 비로그인 다운로드 제한 + 온보딩 가이드 개선 (`edc33e1`), Vercel 빌드 에러 수정 (`85c6913`)

### 2026-03-12
- my-team 곡 이름 검색 및 곡별 사용 내역 탭 추가 (fetchSetlists 조인 쿼리 개선, 띄어쓰기 무시 검색)

### 2026-03-10
- 다운로드 내역 기능 구현 완료 (download_history 테이블, 타입, 훅, my-page UI, 재다운로드 모달)
- 독립 필기노트 서비스 Phase 1~6 전체 완료 (notebooks 테이블, 에디터, 다운로드, 마이그레이션)

### 2026-02-24
- 콘티 노트 저장 버그 수정 (팀 페이지→setlist_notes 연결, 곡 순서 수정)
- GoodNotes 통합 계획서 작성 (29개 기능 분석)

### 2026-02-23
- RLS 보안 취약점 3건 수정 (activity_logs, songs INSERT, sheetmusic 스토리지)
- 다운로드 모달 파일명 입력 포커스 유실 수정

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

### 즉시 (다음 세션) — 팀 단위 공유 전환 (계획서: `docs/내부/팀단위공유_전환계획.md`)
1. [ ] **[대표 직접] Supabase 대시보드에서 `pg_policies` 조회** — `songs`/`teams`/`team_members`/`shared_setlists`의 실제 배포된 RLS를 뽑아 마이그레이션 파일로 백필 (git에 없어서 착수 전 필수). 계획서 6번 0단계에 SQL 있음.
2. [ ] **[대표 직접] Storage 버킷 public→private 전환** (`sheetmusic`, `song-sheets`)
3. [ ] **지혈 1단계**: songs/song_sheets RLS anon 차단 + 로그인·팀 멤버십 기반 교체, shared_setlists 노출 버그 수정
4. [ ] **파일 재배관 2단계**: `file_url`(전체 URL) → 경로만 저장 + 서명 URL 발급 API (`getPublicUrl()` 10곳 교체). 코드 변경량 최대.
5. [ ] **데이터 3단계**: 업로더 기준 팀 자동 귀속 스크립트 + 고아 격리, RLS `status='active'` 통일, teams/join 서버 API화
6. [ ] **UX 4단계**: 메인 팀 대시보드형, 검색 내 팀 스코프화, 업로드 전체공개 옵션 제거, explore 축소, 카피 수정
7. [ ] **문서 5단계**: Free 요금제 재설계, 파트너 MoU 재협의, 사업계획서/소개서 갱신

> 참고: 위 1~2는 대표가 대시보드에서 직접 해야 하고, 이 세션의 Claude는 Supabase MCP 미연결이라 라이브 DB를 직접 못 고침. 이전에 있던 "users SELECT RLS 수정"도 이 전환 작업과 함께 처리 권장.

### 단기 (베타 기간)
- [ ] 자동 저장 기능 추가 (15~30초 디바운스 + dirty flag)
- [ ] 필기노트 검색/정렬 기능
- [ ] page.tsx 거대 컴포넌트 분리 (3500줄+)
- [ ] Next.js 미들웨어 추가
- [ ] 중간 보안 항목 수정 (check-email Rate Limit, MIME 검증, invite_code 등)
- [ ] 테스터 피드백 반영

### 장기 과제
- [ ] AddPageModal 업로드 로직을 `useNotebooks.uploadNotebookFile`로 통합 리팩토링
- [ ] `generateNotebookPDF` 래퍼 정리 — SheetMusicEditor에서 미사용 (generatePDFFromCanvas 직접 호출 중)

### 중기
- [ ] 악보 통합 관리 Phase 3 (song_sheets 활성화)
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
| 개인 필기 훅 (곡별) | `src/hooks/useSheetMusicNotes.ts` |
| 콘티 필기 훅 (콘티 단위) | `src/hooks/useSetlistNotes.ts` |
| 콘티 개인화 훅 | `src/hooks/usePersonalSetlistView.ts` |
| 콘티 상세 페이지 | `src/app/my-team/[id]/setlist/[setlistId]/page.tsx` |
| 관리자 콘텐츠 관리 | `src/app/admin/content-management/page.tsx` |

### 독립 필기노트 서비스
| 기능 | 경로 |
|------|------|
| 노트북 타입 정의 | `src/types/notebook.ts` |
| 노트북 CRUD 훅 | `src/hooks/useNotebooks.ts` |
| 페이지 추가 모달 | `src/components/AddPageModal.tsx` |
| 노트북 다운로드 모달 | `src/components/NotebookDownloadModal.tsx` |
| notebooks 테이블 마이그레이션 | `supabase/migrations/20260225_notebooks.sql` |
| notebooks Storage RLS | `supabase/migrations/20260225_notebooks_storage_policy.sql` |
| setlist_notes 마이그레이션 | `supabase/migrations/20260225_migrate_setlist_notes_to_notebooks.sql` |

### 다운로드 내역 기능
| 기능 | 경로 |
|------|------|
| 다운로드 내역 타입 정의 | `src/types/downloadHistory.ts` |
| 다운로드 내역 훅 | `src/hooks/useDownloadHistory.ts` |
| 다운로드 상세/재다운로드 모달 | `src/components/DownloadHistoryDetailModal.tsx` |
| download_history 테이블 마이그레이션 | `supabase/migrations/20260310_download_history.sql` |
| 다운로드 훅 (기록 저장 연동) | `src/hooks/useDownload.tsx` |
| my-page (다운로드 탭 추가) | `src/app/my-page/page.tsx` |

### 문서
| 문서 | 경로 |
|------|------|
| 악보 통합 관리 계획서 | `docs/내부/개인_악보_필기_버전관리_계획.md` |
| 독립 필기노트 서비스 계획서 | `docs/내부/독립_필기노트_서비스_계획서.md` |
| 서비스 인프라 현황 | `docs/내부/서비스_인프라_현황.md` |
| 보안 점검 보고서 | `docs/내부/보안_점검_보고서.md` |
| 사업계획서 | `docs/사업계획서/` |

---

## 7. 인프라 주요 변경 이력

| 날짜 | 변경 |
|------|------|
| 2026-07-14 | 팀 단위 공유 전환 계획 수립 (계획만, 코드 미변경). anon 실측으로 songs/song_sheets 전량 노출 + 버킷 public 확증 |
| 2026-03-13 | 비로그인 다운로드 제한 (PDF/PPT), 온보딩 가이드 개선 (WORSHEEP팀 안내 + ? 버튼) |
| 2026-03-13 | 전체공개 곡 업로드 시 관리자 승인 필수 (is_hidden + upload_status 활용) |
| 2026-03-12 | my-team 곡 이름 검색 + 곡별 사용 내역 탭 추가 (fetchSetlists 조인 쿼리 개선) |
| 2026-03-10 | download_history 테이블 추가 — 다운로드 내역 기록/조회 기능 구현 완료 |
| 2026-02-25 | 독립 필기노트 서비스 Phase 1~6 전체 완료 — notebooks 독립 필기노트 서비스 구현 완료 |
| 2026-02-23 | RLS 보안 취약점 3건 수정 (activity_logs, songs INSERT, sheetmusic 스토리지) |
| 2026-02-20 | 관리자 페이지 데이터 정합성 이슈 11건 수정, auth.users 삭제 트리거 추가 |
| 2026-02-19 | AI 검색 프롬프트 인젝션 3중 방어, 보안 취약점 6건 수정 |
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
- **프로젝트 냉동 보존** (2026-04-11)
- 저작권 문제 미해결로 서비스 일시 중단
- 코드베이스는 i18n 마이그레이션 완료 상태로 보존
- 연습실 플랫폼은 별도 프로젝트로 진행
- 서비스 재개 시: 저작권 해결 후 AI 악보 변환(OMR) 플랫폼으로 피봇 검토

---

*이 문서는 컨텍스트 리셋 시 업데이트됩니다.*
