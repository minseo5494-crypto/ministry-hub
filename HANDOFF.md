# HANDOFF - 프로젝트 인수인계 문서

**마지막 업데이트**: 2026년 3월 13일

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

## 3. 최근 작업 (2026-03-13)

### 완료된 작업
- [x] **전체공개 곡 업로드 시 관리자 승인 시스템** — 커밋 완료 (`1011780`)
  - `visibility: 'public'` 업로드 시 `is_hidden: true` + `upload_status: 'pending'` 설정
  - 관리자 승인 시 `is_hidden: false` + `upload_status: 'completed'`
  - my-page에서 "승인 대기" 배지 표시
- [x] **비로그인 다운로드 제한** — 커밋 완료 (`edc33e1`)
  - PDF/PPT 다운로드 시 로그인 체크 + 로그인 유도 팝업
  - 검색, 미리보기, 가사보기, 유튜브는 비로그인 허용
- [x] **온보딩 가이드 개선** — 커밋 완료 (`edc33e1`)
  - WORSHEEP 찬양팀 안내 스텝 추가 (데모 팀 체험 유도)
  - 헤더 로고 옆 ? 버튼으로 가이드 다시 열기 가능
- [x] **Vercel 빌드 에러 수정** — 커밋 완료 (`85c6913`)
  - 미커밋 파일 3개 추가 (useDownloadHistory, DownloadHistoryDetailModal, downloadHistory 타입)
  - 이전 세션 포함 총 4건의 Vercel 빌드 에러 모두 해결

---

## 4. 이전 작업 요약

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

### 즉시 (다음 세션)
1. [ ] **songs SELECT RLS 정책 수정** — "Enable read access for all users" 삭제 + authenticated visibility 정책 검증
2. [ ] **users SELECT RLS 정책 수정** — 일반 유저는 자기 데이터만, admin은 전체 조회
3. [ ] **미커밋 변경사항 정리** — CLAUDE.md, docs, src 등 unstaged 변경사항 확인 및 커밋 필요

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
- **전체공개 곡 승인 시스템** 배포 완료
- **비로그인 다운로드 제한 + 온보딩 가이드 개선** 배포 완료
- **Vercel 빌드 에러** 모두 해결 (미커밋 파일 추가)
- 다음 작업: songs/users SELECT RLS 정책 수정, 미커밋 변경사항 정리

---

*이 문서는 컨텍스트 리셋 시 업데이트됩니다.*
