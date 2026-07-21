# HANDOFF - 프로젝트 인수인계 문서

**마지막 업데이트**: 2026년 7월 20일 (5차 세션)

---

## ⏭️ 다음 세션 할 일 (골라서)

### ✅ Storage 파일 프록시 **1~3단계 전체 완료** (5차 세션, 2026-07-21)
> 프록시 라우트+배선+버킷 private 전환까지 끝. **파일 유출 구멍 닫힘 — "팀끼리만 본다" 모델 기술적으로 성립.**
> main 병합·배포 완료. 파일은 로그인+팀 권한 통과한 60초 서명 URL로만 열림. 상세는 섹션 3.
> 로그인 상태 다운로드/뷰어 정상 확인(대표). 원본 public URL 직행 → 400(Bucket not found) 확인.

### 🟡 새 기능 (설계 문서 작성됨 — 미결 항목 답 주면 구현 착수)
- [ ] **기능1: 악보→코드악보 자동변환** — `docs/내부/코드악보_자동변환_계획.md`. 비전 LLM 추출+교정 UI. 미결 5개(입력소스/모델비용/저장구조/PDF 포함여부).
- [ ] **기능2: 클릭(가이드) 트랙** — `docs/내부/클릭_가이드트랙_계획.md`. Web Audio 클릭+섹션 큐. 미결 5개(음성큐 방식/섹션·마디 데이터/내보내기 MVP 포함).
- 두 기능은 데이터 연결됨(코드악보 마디/섹션 → 클릭트랙 입력).

### 🟠 3단계 후속 (선택)
- [ ] **JWT-in-URL 강화 여부 결정** — 현재 `toProxyUrl`이 `?token=`에 실제 access token 노출(짧은 수명·자동갱신). 그대로 둘지 / HMAC 서명 grant 토큰으로 바꿀지.
- [ ] Service Worker PDF 캐시 축소(`next.config.js`) — 프록시 서명 URL 캐시 정책 점검.

### 나머지 선택 후속 (급한 것 없음)
0. [ ] ⚠️ **[검증 대기] 콘티↔일정 연동 브라우저 확인** — 커밋 `31f31fc`은 빌드만 통과, 대표 실동작 미확인. 콘티(예배날짜)가 일정 탭 캘린더에 뜨는지 / 클릭 시 콘티로 이동하는지 확인 필요. 안 뜨면 콘티 `service_date` 유무 또는 조회범위(-3M~+6M) 문제.
1. [ ] **반복 일정 수정 UI** — "이 회차만/이후/전체" 선택. 훅(`updateEventSeries`)엔 로직 있고 UI만 없음(현재 삭제는 단일만).
2. [ ] **메인 대시보드 "다가오는 일정" 카드** — 로그인+팀 홈에 요약 노출. `useTeamEvents.fetchUpcomingEvents` 재사용.
3. [ ] **`/ko/undefinedundefined` 깨진 prefetch 링크 추적** — 메인 로드 시 404 prefetch(기능엔 영향 X, 기존 이슈). 원인 링크 찾아 수정.
4. [ ] **팀 전환 B단계 (Storage 버킷 private + 서명 URL)** — 저작권 모델의 미완 조각. 섹션 5 참조.
5. [ ] 캘린더 v2: 구글 캘린더 연동 (보류 중).

> **환경 팁**: `npm run build`(프로덕션) 직후 `npm run dev`를 띄우면 `.next` 캐시가 꼬여 **모든 라우트가 404**날 수 있음. → `rm -rf .next && npm run dev`로 해결. (4차 세션에서 겪음)
> **MCP**: 아직 이 프로젝트 경로에 미연결. 붙이면 라이브 DB 직접 조작 가능(`claude mcp add --transport http supabase https://mcp.supabase.com/mcp` → `/mcp` 인증 → 재시작). 없으면 SQL 파일을 대표가 SQL Editor에 붙여넣기(4차 세션 방식).

---

## 0. 프로젝트 상태: 해동 → 팀 단위 폐쇄 공유로 전환 작업 중

> **2026-07-14 (2차)**: 냉동 해제. 팀 전환 1단계(anon 차단 RLS) 적용 완료.
> **2026-07-15 (3차)**: 메인 레이아웃 팀 단위로 전환 + 캘린더 기능 계획 확정.
> **2026-07-15 (4차)**: 팀 일정 캘린더 기능 1~6단계 전체 구현·검증·푸시 완료. (아래 섹션 3)

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

## 3. 최근 작업 (2026-07-20 5차 세션) — Storage 파일 접근 프록시 1~2단계 ✅

> **목적**: 버킷이 `public=true`라 `file_url`만 알면 로그인 없이 악보 파일이 새는 구멍(섹션 5 B단계)을 막기 위한 사전 작업. 모든 파일 읽기를 접근제어 지점(프록시)으로 통과시킴.
> **상태**: `main` 병합·배포 완료(브랜치 `feat/file-proxy-signed-url` 병합). **1~3단계 전체 완료.**

### 확정 아키텍처 — 프록시 + 서명URL 302 리다이렉트
- `/api/files/[...path]`: 세션 인증(`?token=` 또는 Bearer) → 접근 판정 → 60초 서명URL로 **302 redirect**(파일 바이트는 Supabase CDN 직배송, Vercel 대역폭 0).
- 접근 판정: **admin 전체허용 / notebooks 경로는 `uid` 일치 / 그 외 악보는 사용자 토큰으로 `songs` 조회 → 기존 songs RLS(팀 격리)가 그대로 판정**(단일 소스).
- ⚠️ **앱 세션이 localStorage 저장(쿠키 아님)** → `<img>`/`<iframe>`/pdfjs가 헤더 인증 불가 → 토큰을 URL `?token=`으로 전달. `toProxyUrl` 헬퍼가 처리.

### 완료
- [x] **1단계**: `src/app/api/files/[...path]/route.ts` + `src/lib/fileUrl.ts`(`toProxyUrl`/`parseStorageRef`, 토큰 캐시, **토큰 미로드 시 public fallback**). 빌드 통과.
- [x] **2단계**: 약 20개 파일 읽기 지점 배선 — 뷰어/에디터(SheetMusicViewer·AnnotatedPreview·SongFormPositionModal·SheetMusicEditor), useDownload·pdfGenerator, main(PreviewModal·SongListItem·SongGridItem)·my-team·setlist·explore·personal·my-page(노트북·공유노트)·admin 3종의 img·iframe·href·fetch·pdfjs.
- [x] **런타임 스모크**: 토큰없음→401 / 잘못된버킷→400 / 잘못된토큰→401 / 짧은경로→400 정상.
- [x] **브라우저 검증(일부)**: 로그인 후 메인·뷰어에서 `/api/files/... → 302 → Supabase 서명URL → 200 jpeg` 흐름 확인(대표). 기능 정상.
- [x] 빌드 통과. **버킷은 아직 public 유지 → 기존 동작 안 깨짐, 완전 롤백 가능.**

### 단순화 발견
- 경로가 `file_url`에서 파싱 가능 → **HANDOFF 기존 B단계 7번(스키마 변경+1,827건 백필) 불필요.** 런타임 변환으로 대체.

### 3단계 완료 (2026-07-21)
- [x] 프록시 코드 `main` 병합·프로덕션 배포(401 확인).
- [x] `fileUrl.ts`: public fallback 제거 + 토큰 localStorage 동기읽기(레이스 제거). 배포.
- [x] **버킷 private 전환**: `sheetmusic`/`song-sheets` `public=false` + `sheetmusic_select_public` 정책 삭제 (`supabase/migrations/20260721_storage_private_step3.sql`, 대표 SQL Editor 실행).
- [x] 검증: 원본 public URL 직행 → **400(Bucket not found)**, 프록시 무토큰 → 401, 로그인 상태 뷰어/다운로드 정상(대표).
- 후속: JWT-in-URL 강화 여부 결정(섹션 최상단).

---

## 3-A. 이전 작업 (2026-07-15 4차 세션) — 팀 일정 캘린더 기능 완성 ✅

### 완료된 작업 (커밋 `4a2e418`, `36ab475` — 푸시 완료)
- [x] **1단계 DB**: `team_events` + `team_event_attendance` 테이블 + RLS 적용
  (`supabase/migrations/20260715_team_events.sql`, 롤백 SQL 동봉). anon 차단 검증 완료.
- [x] **2단계 타입/훅**: `types/teamEvent.ts`, `hooks/useTeamEvents.ts` (CRUD, 반복 인스턴스 생성, 시리즈 수정/삭제, 참석 upsert, 요약 집계)
- [x] **3~6단계 UI**: `my-team/[id]`에 **`일정` 탭** 신설 (콘티/곡 탭과 병렬)
  - `components/TeamCalendar.tsx` — 목록(아젠다)/월 그리드 뷰, 유형별 색상, 상세 모달
  - `components/TeamEventModal.tsx` — 생성/수정 폼: 유형·시각·장소·메모·**반복(주간 12주 인스턴스)**·콘티 연결
  - **참석**: 본인 참석/불참/미정 토글 + 리더 대리 지정 + 요약 집계
  - **예배 유형 → team_setlists 콘티 연결** + 바로가기
  - `myTeam.calendar` i18n 네임스페이스 한/영 추가
- [x] **로그인 상태 실동작 검증 완료**: 일정 생성·조회·참석 저장 전부 정상 (대표 확인).
- [x] 빌드 통과. 기존 기능(콘티/곡 탭 등) 영향 없음.
- [x] **콘티↔일정 연동** (커밋 `31f31fc`): `team_setlists.service_date`를 캘린더에 자동 표시(인디고 📋 배지),
  클릭 시 콘티 상세로 이동. 일정에 이미 연결된 콘티는 중복 제외. ⚠️ **빌드만 통과, 브라우저 검증 대기.**

### 확정 설계 (이미 반영됨)
- 반복=인스턴스 생성(12주), 참석=셀프+리더 대리, 콘티 연결 포함, **구글 연동은 v2 보류**.
- ⚠️ DB에 유령 `services*` 테이블군(미사용) 존재 → 재활용 안 함. 별도 정리 대상.

### 이 세션에서 얻은 교훈
- **`npm run build` 직후 `npm run dev`를 띄우면 `.next` 캐시가 꼬여 전 라우트 404.** `rm -rf .next` 후 재시작으로 해결. (진단에 시간 씀 — 다음엔 바로 이걸 의심)

---

## 3-B. 이전 작업 (2026-07-15 3차 세션) — 메인 레이아웃 팀 전환 + 캘린더 계획 ✅

### 완료된 작업 (커밋 `13e84d4`, `5acb0e0` — 푸시 완료)
- [x] **메인 페이지 로그인·팀 상태별 3분기** (`main/components/HeroSection.tsx`)
  - 비로그인 → 검색바 제거 + 서비스 소개 랜딩(기능 4카드: 악보/콘티/팀협업/스트리밍 + 가입 CTA)
  - 로그인+팀 없음 → 팀 만들기/참여 온보딩
  - 로그인+팀 있음 → 기존 검색 화면 유지
- [x] 곡 목록/필터/선택바를 **로그인+팀 있음일 때만** 렌더 (`main/page.tsx`)
- [x] **업로드 '전체 공개' 옵션 사용자에게 숨김** (`AddSongModal.tsx`의 `SHOW_PUBLIC_VISIBILITY_OPTION=false` 플래그).
  코드는 보존 → 나중에 되살릴 때 **RLS `songs_select`의 public 경로도 함께 복원** 필요 (주석에 명시).
  기본값 `visibility` public→teams (`main/page.tsx:159`)
- [x] 랜딩/온보딩/소개 카피 한/영 추가 (`messages/ko.json`·`en.json`)
- [x] 빌드 통과 확인 (`npm run build` ✓)
- [x] **팀 일정 캘린더 기능 계획 확정** → `docs/내부/팀_일정_캘린더_계획.md`

### 팀 일정 캘린더 — 확정된 설계 (다음 세션에서 구현 착수)
- **새 테이블 2개**: `team_events`(유형=연습/섬김/예배/기타, 시각, 장소, 메모, 콘티연결, 반복묶음)
  + `team_event_attendance`(팀원별 참석/불참/미정 + 사유).
- **결정**: 반복=인스턴스 생성(12주치), 참석=셀프+리더 대리, 콘티 연결 포함, **구글 연동은 v2 보류**.
- 위치: `my-team/[id]`에 `일정` 탭 신설(현 setlists/songs 탭 옆), 월 뷰+아젠다 뷰.
- RLS: 팀 폐쇄 모델(`get_user_team_ids()`) 재사용.
- ⚠️ DB에 유령 `services*` 테이블군 있으나 미사용 → 재활용 안 함(별도 정리 대상).

### 참고
- 이 세션은 Supabase MCP 미연결이라 anon 키(REST 직접 호출)로 검증. 다음 세션은 MCP 붙이는 중.

---

## 3-C. 이전 작업 (2026-07-14 2차 세션) — 1단계 anon 차단 적용 완료 ✅

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

> 팀 전환 계획서: `docs/내부/팀단위공유_전환계획.md` · 캘린더 계획서: `docs/내부/팀_일정_캘린더_계획.md`

### 🗓️ 캘린더 기능 — ✅ 1~6단계 전체 완료 (4차 세션)

DB·훅·UI·참석·콘티연결 전부 구현·검증·푸시됨. 남은 건 아래 후속(선택):
- [ ] 반복 일정 **수정** UI (이 회차만/이후/전체) — 훅 `updateEventSeries`엔 로직 있음, UI만 없음
- [ ] 메인 대시보드 "다가오는 일정" 카드 (`fetchUpcomingEvents` 재사용)
- [ ] 구글 캘린더 연동 (v2 보류)

### 🎯 A단계 — 레이아웃 / 사용 흐름 개편 (일부 완료)

1. [x] ~~업로드 '전체공개' 옵션 숨김~~ — 완료 (플래그로 숨김, 기본값 teams)
2. [x] ~~메인 페이지 상태별 분기~~ — 완료 (비로그인 랜딩 / 팀없음 온보딩 / 팀있음 검색)
3. [ ] **검색을 "내 팀 악보함 내 검색"으로 스코프 축소** (`fetchSongs`의 전량 `.select('*')` 폐지) — 남음
4. [ ] **관리자 벌크 업로드 도구 제거/봉인** (`upload/page.tsx`) — 운영자 직접 유통의 증거가 됨
5. [ ] **explore / 커뮤니티 UI 정리** — RLS는 이미 내 팀 스코프로 좁혔으나 UI는 그대로. 노출/제거 결정 필요
6. [~] 카피 수정 — 랜딩/온보딩은 완료. 검색 화면(팀있음) 카피는 3번과 함께

### 🔴 B단계 — 파일 재배관 (**모델의 성립 조건. A단계 직후 필수**)

> **현재 Storage 버킷 `sheetmusic`/`song-sheets` 둘 다 `public: true`.**
> RLS를 조여도 **file_url만 알면 로그인 없이 악보 파일이 받아진다** (HTTP 200 실측).
> **5차 세션에서 프록시 배관(1~2단계)을 깔았고, private 전환(3단계)만 남았다.** 상세는 섹션 3.

7. [x] ~~스키마 변경+백필~~ — **불필요 판명**(경로가 file_url에서 파싱 가능, 런타임 변환으로 대체)
8. [x] **읽기 지점 프록시 배선 완료** — `getPublicUrl` 직접 소비 → `/api/files` 프록시 경유(`toProxyUrl`). 약 20개 파일. (커밋 `55d36c6`)
9. [ ] **버킷 private 전환 + `sheetmusic_select_public` 정책 삭제 + fallback 제거** ← 3단계 핵심(검증 후). 섹션 최상단 C 참조
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
| **팀 단위 공유 전환 계획** | `docs/내부/팀단위공유_전환계획.md` |
| **팀 일정 캘린더 계획 (신규)** | `docs/내부/팀_일정_캘린더_계획.md` |
| 악보 통합 관리 계획서 | `docs/내부/개인_악보_필기_버전관리_계획.md` |
| 독립 필기노트 서비스 계획서 | `docs/내부/독립_필기노트_서비스_계획서.md` |
| 서비스 인프라 현황 | `docs/내부/서비스_인프라_현황.md` |
| 보안 점검 보고서 | `docs/내부/보안_점검_보고서.md` |
| 사업계획서 | `docs/사업계획서/` |

---

## 7. 인프라 주요 변경 이력

| 날짜 | 변경 |
|------|------|
| 2026-07-21 (5차) | **Storage 파일 프록시 3단계 완료** — 버킷 `sheetmusic`/`song-sheets` `public=false` + `sheetmusic_select_public` 삭제. 원본 public URL 직행 400 확인. 파일 유출 구멍 닫힘. (`20260721_storage_private_step3.sql`) |
| 2026-07-20 (5차) | **Storage 파일 접근 프록시 1~2단계** — `/api/files` 프록시(세션 인증→songs RLS 접근판정→60초 서명URL 302) + `toProxyUrl` 배선 약 20개 파일. 브라우저 302 흐름 확인. **버킷 아직 public**(3단계 private 전환 대기). 브랜치 `feat/file-proxy-signed-url` 커밋 `55d36c6` (미푸시) |
| 2026-07-15 (4차) | **팀 일정 캘린더 기능 완성** — team_events/team_event_attendance 테이블+RLS, 훅, my-team '일정' 탭(월/목록/생성/참석/콘티연결). 로그인 실동작 검증. + 콘티 자동표시 연동(`31f31fc`, 검증대기) (커밋 `4a2e418`,`36ab475` 푸시) |
| 2026-07-15 (3차) | 메인 레이아웃 팀 단위 3분기 전환(비로그인 랜딩/온보딩/검색), 업로드 전체공개 옵션 숨김. 팀 일정 캘린더 계획 확정 (커밋 `13e84d4`,`5acb0e0` 푸시) |
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
| ~~**Storage 버킷 2개**~~ | ✅ **해결됨(2026-07-21)** — 버킷 private 전환 + 프록시 서명URL. 원본 URL 직행 400. | B 완료 |
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

**현재 상태 (2026-07-20 5차 세션 종료 시점)**
- **냉동 해제.** 팀 단위 폐쇄 공유 모델로 전환 작업 중.
- **모델**: 권리사 협상을 피하기 위해, 팀이 자기 악보를 올려 그 팀만 보는 구조. 운영자는 호스팅만.
- **요금제**: 전부 무료 전제.
- **완료**: 팀전환 1단계(anon RLS) + 메인 레이아웃 팀 3분기 + 팀 일정 캘린더 전체 + **Storage 파일 프록시 1~3단계 전체**.
- ✅ **Storage 유출 구멍 닫힘(2026-07-21)** — 버킷 private + 프록시 서명URL. 저작권 모델의 미완 조각 해결. "팀끼리만 본다" 기술적으로 성립.
- **다음 착수**: 새 기능 2종(코드악보 자동변환 / 클릭 가이드트랙) — 설계 문서 작성됨, 미결 항목 답 대기. + JWT-in-URL 강화 여부 결정(선택).

### 다음 세션 착수 팁
- **Supabase MCP 아직 미연결.** 붙이면 라이브 DB 직접 조작 가능: `claude mcp add --transport http supabase https://mcp.supabase.com/mcp` → `/mcp` 인증 → 재시작.
- MCP 없이도 **anon 키(`.env.local`)로 REST 직접 호출해 검증 가능**. DB 변경은 SQL 파일을 대표가 SQL Editor에 붙여넣기(pbcopy로 클립보드 복사 시 잘림 없음).
- 로컬 dev 서버는 `/dev`로 재실행. **`npm run build` 후엔 `.next`가 꼬여 전 라우트 404날 수 있음 → `rm -rf .next && npm run dev`.**

---

*이 문서는 컨텍스트 리셋 시 업데이트됩니다.*
