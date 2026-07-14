# HANDOFF - 프로젝트 인수인계 문서

**마지막 업데이트**: 2026년 7월 14일 (2차 세션)

---

## 0. 프로젝트 상태: 해동 → 팀 단위 폐쇄 공유로 전환 작업 중

> **2026-07-14 (2차 세션)**: 냉동 해제. **팀 단위 공유 전환에 실제로 착수했고 1단계(DB) 적용 완료.**

### ★ 사업 모델 재정의 (이번 세션에서 확정 — 가장 중요)

**"권리사와 협상해서 라이선스를 얻는다"가 아니라, "협상이 필요 없는 구조로 바꾼다"가 목표다.**

- 팀이 **자기들이 쓰는 악보를 직접 업로드**하고, **그 팀 멤버만** 열람한다.
- 팀 밖으로 나가지 않으므로 불법 유통에 해당하지 않는다는 것이 이 모델의 논리.
- WORSHEEP은 유통자가 아니라 **저장 공간을 빌려주는 호스팅 사업자** 포지션.
- 원래 비전인 "모두에게 악보를 쉽게 제공"은 권리사 협상이 선행돼야 하므로 **이번 전환에서 제외**.
- **요금제: 당분간 전부 무료** 전제로 진행 (Free 요금제 재설계 항목 폐기).
- 기존 기능은 **그대로 유지**. 레이아웃과 사용 흐름만 팀 중심으로 변경.

> ⚠️ **이 논리는 기술적 격리가 실제로 작동할 때만 참이다.** 구멍이 하나라도 남으면
> "팀끼리만 본다"는 주장 자체가 무너진다. 남은 기술 항목(특히 Storage 버킷)은
> 부수 작업이 아니라 **모델의 성립 조건**이다.

### 상태 요약

| 항목 | 상태 |
|------|------|
| 코드베이스 | 정상 동작 (로그인 상태 기능 4종 검증 완료) |
| Supabase | ministry-hub 유지 (Free tier) · **1단계 RLS 적용됨** |
| Vercel | 배포 유지 |
| 계획서 | `docs/내부/팀단위공유_전환계획.md` (2차 세션 기준 전면 갱신됨) |

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

## 3. 최근 작업 (2026-07-14 2차 세션) — 1단계 anon 차단 적용 완료 ✅

### 완료된 작업
- [x] 라이브 DB `pg_policies` 전량 조회 → 배포된 RLS 실체 파악 (git에 없던 대시보드 수기 정책들)
- [x] anon 키로 유출 실측 → **비로그인으로 songs 1,830건 / song_sheets 1,672건 조회 성공 확인**
- [x] 악보 파일 직접 GET → **HTTP 200, 374KB PNG 다운로드 성공** (버킷 public 확증)
- [x] **1단계 마이그레이션 작성 및 적용** — `supabase/migrations/20260714_team_isolation_step1_anon_lockdown.sql`
- [x] 적용 후 anon 재실측 → **전부 0건 차단 확인**
- [x] 로그인 상태 기능 검증 (메인 곡 목록 / 검색 / 악보 뷰어 / 팀) — **4종 정상 동작**
- [x] 사업 모델 재정의 (섹션 0 참조)
- [x] 계획서 전면 갱신

### 🔑 원인 규명 — RLS 부재가 아니라 "쓰레기 PERMISSIVE 정책"이었다

PERMISSIVE 정책은 **OR로 합쳐진다.** `qual=true` 짜리 하나가 올바른 정책을 통째로 무력화하고 있었다.
**올바른 팀 격리 정책(`songs_select`)과 헬퍼 함수(`get_user_team_ids`, `user_has_access_to_shared_song`)는
이미 제대로 만들어져 있었다.** 쓰레기 정책만 지우니 그 즉시 작동했다.

| 삭제한 정책 | 문제 |
|---|---|
| `songs` / `Enable read access for all users` | `qual=true`, `{public}` → **비로그인 포함 전원 전곡 개방** (핵심 원인) |
| `songs` / `Authenticated users can view songs` | 로그인만 하면 전곡 개방 |
| `song_sheets` / `Public sheets are viewable by everyone` | `visibility` 기본값이 `'public'` → 1,672건 전량 개방 |
| `shared_setlists` / `shared_setlists_select` | `{public}` → 비로그인에게 공유 콘티 노출 |
| `shared_setlist_comments` / `comments_select` | `qual=true`, `{public}` |
| `song_likes` / `Users can view all likes` | `qual=true`, `{public}` |

`songs.visibility` 기본값 `'public'` → `'teams'`, `song_sheets.visibility` → `'private'` 로 변경.
**롤백 SQL은 마이그레이션 파일 하단에 주석으로 동봉되어 있다.**

### 📊 확정된 데이터 사실 (⚠️ 재조사 불필요)

- **`shared_with_teams`가 1,830곡 전부 동일하게 `{고페르}`.** → **팀 귀속은 이미 끝나 있다.**
  **기존 계획의 "업로더 기준 팀 자동 귀속 스크립트"는 통째로 불필요.** 데이터 마이그레이션 0건.
- 업로더는 딱 2명: **조민서(admin) 1,811곡**, zion Park 19곡.
- 팀 3개: `고페르`(멤버 2) / `WORSHEEP 찬양팀`(데모, 멤버 9) / `대학1부`(멤버 0). 유저 11명 전원 active.
- 파일 버킷 분포: `sheetmusic` 1,671건 / `song-sheets` 156건 / NULL 3건.
- `song_sheets` 1,672건은 `team_id`·`uploaded_by` 전부 NULL인 고아 데이터. 코드에서 SELECT 0건 = 미사용.

### 적용 후 가시성

| 대상 | 곡 수 |
|---|---|
| 비로그인 | **0곡** ✅ |
| 조민서 (admin) | 1,830곡 (`admin_songs_all` 경로) |
| 고페르 멤버 (2명) | 1,830곡 |
| WORSHEEP 찬양팀 (9명) | **0곡** ← 의도된 결과 (대표 확인 완료) |

### ⚠️ 모델과 현재 구조가 충돌하는 지점 (다음 세션에서 처리)

1. **곡의 99%를 운영자가 올렸다** (조민서 1,811곡). "팀이 자기 악보를 올린다"가 아니라
   "운영자가 라이브러리를 구축했다"로 읽힐 여지가 크다.
2. **`upload/page.tsx` 관리자 벌크 업로드 도구**가 남아 있다 → 운영자 직접 유통의 증거. 제거/봉인 필요.
3. **업로드 UI의 '전체공개' 옵션이 이미 죽은 옵션이 됐다** (`main/page.tsx:159` 기본값 아직 `'public'`).
   지금 '전체공개'로 올리면 업로더·admin 외 아무에게도 안 보인다 → 사용자에겐 버그로 보임. **우선 제거 대상.**

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

> 계획서 상세: `docs/내부/팀단위공유_전환계획.md` 6번 섹션 (A~E단계로 재작성됨)
> **대표 결정: 레이아웃(A단계)을 먼저 잡고, 그 다음 파일 재배관(B단계)으로 간다.**

### 🎯 A단계 — 레이아웃 / 사용 흐름 개편 (**다음 세션 착수 지점**)

기존 기능은 전부 유지. 화면 구성과 동선만 팀 중심으로 바꾼다.

1. [ ] **업로드 '전체공개' 옵션 제거** (`main/page.tsx:159` 기본값 `'public'` → `'teams'`)
   — 이미 죽은 옵션이라 버그로 보임. **가장 먼저, 5분이면 됨.**
2. [ ] **메인 페이지 팀 대시보드형 전환** (`src/app/[locale]/main/page.tsx`, 3,500줄+)
   - 비로그인 → 검색바 없는 랜딩 + 로그인 CTA
   - 로그인+팀 있음 → 팀 전환기 / 내 팀 악보함 / 다가오는 콘티
   - 로그인+팀 없음 → "팀 만들기 / 초대코드로 참여" 온보딩
   - 재사용 가능: `TeamSharedSection`, `fetchTeamSetlists`, `my-team` 빈 상태 패턴
3. [ ] **검색을 "내 팀 악보함 내 검색"으로 스코프 축소** (`fetchSongs`의 전량 `.select('*')` 폐지)
4. [ ] **관리자 벌크 업로드 도구 제거/봉인** (`upload/page.tsx`) — 운영자 직접 유통의 증거가 됨
5. [ ] **explore / 커뮤니티 UI 정리** — RLS는 이미 내 팀 스코프로 좁혔으나 UI는 그대로. 노출/제거 결정 필요
6. [ ] **카피 수정** — `messages/ko.json:198-200` "지금 바로 검색하세요", `:70-72` 온보딩 "악보 검색"

### 🔴 B단계 — 파일 재배관 (**모델의 성립 조건. A단계 직후 필수**)

> **현재 Storage 버킷 `sheetmusic`/`song-sheets` 둘 다 `public: true`.**
> RLS를 조여도 **file_url만 알면 로그인 없이 악보 파일이 받아진다** (HTTP 200 실측).
> 만료도 없고 추적도 안 된다. **"팀끼리만 본다"는 모델의 논리가 여기서 깨진다.**

7. [ ] `songs.file_url`(전체 URL, 1,827건) → 경로만 저장하도록 스키마 변경 + 백필
8. [ ] `getPublicUrl()` **10곳** → 서버 발급 `createSignedUrl()` API 경유로 교체
9. [ ] 버킷 private 전환 + `Public Access` / `sheetmusic_select_public` 정책 삭제
10. [ ] Service Worker PDF 7일 캐시 축소 (`next.config.js`)

### 🟠 C단계 — 팀 경계 마무리

11. [ ] **`/api/teams/join` 서버 API 신설** → `teams_select_for_authenticated`(`qual=true`) 제거
    - 지금은 로그인한 아무나 **모든 팀의 `invite_code`** 를 볼 수 있음
    - 완화 요인: 가입은 `status:'pending'` + 리더 승인 필요 → 즉시 열람은 불가
    - 별건: `invite_code` 생성이 `Math.random()` (`admin/approvals/page.tsx:115`) → `crypto`로 교체
12. [ ] **`team_fixed_songs` 정책 3개 교체** — 팀 체크 없이 `auth.role()='authenticated'`만 검사 (30분)
13. [ ] **`/api/songs/weekly-popular`** — 인증 0건 + service_role. 팀 스코프화 또는 폐지

### 🟡 D단계 — `users` PII (저작권과 무관한 별건)

14. [ ] **`users_select_authenticated`(`qual=true`) 교체** — 로그인한 아무나 전 회원의
    **이메일·전화번호·실명·교회명** 조회 가능. 누구나 가입 가능하므로 실질 위험.
    → "본인 + 같은 팀 active 멤버 + admin"으로 축소 (팀원 목록/관리자 페이지가 users를 조인하므로 주의)

### 📄 E단계 — 코드 밖 (호스팅 사업자 포지션)

15. [ ] 이용약관에 **업로드 권리 책임은 업로더에게** 명시
16. [ ] 권리사 신고 시 **takedown 절차** 마련 + 반복 침해 팀 제재 규정
17. [ ] 사업계획서/소개서의 "1,700곡+ 통합 검색" 서술 갱신, 파트너 MoU 재협의

### 기타 (기존 백로그)
- [ ] 자동 저장 (15~30초 디바운스 + dirty flag), 필기노트 검색/정렬
- [ ] `main/page.tsx` 거대 컴포넌트 분리 (3,500줄+) — A단계와 함께 하면 효율적
- [ ] Next.js 미들웨어 추가 (RLS를 고쳐서 심각도는 낮아짐)
- [ ] check-email Rate Limit, my-page MIME 검증

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
| 2026-07-14 (2차) | **1단계 RLS 적용** — songs/song_sheets/shared_setlists/song_likes의 anon 개방 정책 삭제. 비로그인 유출 0건 확인. `songs.visibility` 기본값 `public`→`teams`. 사업모델 재정의(팀 폐쇄 공유) |
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

## 9. 알려진 이슈: RLS

### 남아있는 유출 (다음 세션 처리 대상, 섹션 5 참조)

| 대상 | 문제 | 단계 |
|---|---|---|
| **Storage 버킷 2개** | `public: true` → file_url만 알면 **로그인 없이 악보 파일 다운로드** (HTTP 200 실측) | B |
| `teams` | `teams_select_for_authenticated`(`qual=true`) → 로그인한 아무나 **모든 팀 invite_code** 조회 | C |
| `team_fixed_songs` | 팀 체크 없이 `auth.role()='authenticated'`만 → 남의 팀 고정곡 조작 가능 | C |
| `/api/songs/weekly-popular` | 인증 체크 0건 + service_role (반환은 `{id, rank}`뿐이라 피해는 작음) | C |
| `users` | `users_select_authenticated`(`qual=true`) → 로그인한 아무나 **전 회원 이메일·전화번호** 조회 | D |

### 서버 API로 우회 중인 항목 (RLS가 클라이언트 CRUD를 막음)

| 테이블 | 문제 | 우회 |
|--------|------|-----------|
| teams | INSERT/DELETE 차단 | `/api/teams/create`, `/api/teams/delete` |
| team_members | INSERT 차단 | `/api/teams/join-demo` |
| team_roles | INSERT/DELETE 차단 (트리거 포함) | service role |
| team_setlists | INSERT/DELETE 차단 | `/api/setlists/create`, `/api/setlists/delete` |
| activity_logs | SELECT 차단 | `/api/songs/weekly-popular` |
| users | UPDATE 차단 (세션 없는 경우) | `/api/auth/setup-user` |

> ✅ **해결됨**: "songs SELECT 전체공개" 이슈는 2026-07-14 1단계 마이그레이션으로 차단 완료.

---

## 10. 새 대화 시작 시

```
HANDOFF.md 읽어줘
```

**현재 상태 (2026-07-14 2차 세션 종료 시점)**
- **냉동 해제.** 팀 단위 폐쇄 공유 모델로 전환 작업 중.
- **모델**: 권리사 협상을 피하기 위해, 팀이 자기 악보를 올려 그 팀만 보는 구조. 운영자는 호스팅만.
- **요금제**: 전부 무료 전제.
- **1단계(anon 차단 RLS) 적용 완료** — 비로그인 유출 0건 확인.
- **다음 착수: A단계 레이아웃/사용 흐름 개편** (섹션 5의 1~6번).
- ⚠️ **Storage 버킷이 아직 public** — 파일은 여전히 URL로 새고 있음. A단계 끝나면 B단계 필수.

### 다음 세션 착수 팁
- **Supabase MCP가 이 프로젝트 경로에 미연결.** 붙이면 라이브 DB를 직접 쿼리/수정 가능:
  `claude mcp add --transport http supabase https://mcp.supabase.com/mcp` → `/mcp`로 인증
  (`~/.claude.json`에 옛 경로 `/Users/cho/Desktop/WORSHEEP`으로만 등록돼 있음)
- MCP 없이도 **anon 키(`.env.local`)로 REST를 직접 호출해 유출 검증 가능** — 이번 세션에서 이 방법으로 실측했다.

---

*이 문서는 컨텍스트 리셋 시 업데이트됩니다.*
