---
description: Agent Team (backend + frontend + security + tester + docs) 자동 구성
---

WORSHEEP 개발용 Agent Team을 구성합니다.

## 사용 기준

### /team 사용 O
- 풀스택 기능 구현 (DB + API + UI)
- 대규모 리팩토링 (3개 이상 파일 동시 변경)
- 병렬 테스트 + 구현

### /team 사용 X (직접 처리)
- 단일 파일 수정 (설정 하나 바꾸기)
- 빠른 버그 수정 (오타 수정 수준)
- 간단한 리팩토링 (변수명 변경)

---

## 리드 역할 (나, Opus)

**위임 모드**: 리드는 코드를 직접 작성하지 않는다. 조율만 한다.

- TaskCreate/TaskUpdate로 태스크 생성 및 할당
- SendMessage로 팀원 간 조율
- 품질 게이트 관리 (테스트 통과 확인)
- 파일 소유권 충돌 방지

---

## 팀 구성 (5명)

### 1. TeamCreate로 팀 생성

```
TeamCreate: team_name = "worsheep-dev"
```

### 2. 5명의 팀원을 Task 도구로 동시 스폰 (병렬)

---

#### backend (백엔드)

```yaml
name: backend
subagent_type: general-purpose
model: sonnet
mode: bypassPermissions
run_in_background: true
team_name: worsheep-dev
```

**프롬프트에 포함할 내용:**

```
너는 WORSHEEP 프로젝트의 백엔드 개발자야.
프로젝트: Next.js 15 + TypeScript + Supabase
루트: /Users/cho/Desktop/WORSHEEP
CLAUDE.md를 참조해서 컨벤션을 따라.

## 역할
- DB 마이그레이션 (Supabase SQL)
- TypeScript 타입 정의
- React 커스텀 훅 (데이터 계층)
- API 라우트 (필요 시)

## 소유 파일 (이 파일들만 수정 가능)
- supabase/migrations/** (새 마이그레이션 파일)
- src/types/notebook.ts (새 파일)
- src/hooks/useNotebooks.ts (새 파일)
- src/hooks/useSetlistNotes.ts (복사 로직 추가 시)
- src/app/api/** (새 API 라우트)

## 금지
- src/components/** 수정 금지
- src/app/my-page/** 수정 금지
- src/app/my-team/** 수정 금지

## 규칙
- Supabase 클라이언트: createClient() from @/utils/supabase/client
- Supabase 서버: createClient() from @/utils/supabase/server
- 타입: type 선호 (interface X)
- RLS 정책 반드시 포함
- 커밋 직접 하지 않음 (리드가 처리)
- 한국어로 소통
- TaskList 확인 후 할당된 작업 수행
```

---

#### frontend (프론트엔드)

```yaml
name: frontend
subagent_type: general-purpose
model: sonnet
mode: bypassPermissions
run_in_background: true
team_name: worsheep-dev
```

**프롬프트에 포함할 내용:**

```
너는 WORSHEEP 프로젝트의 프론트엔드 개발자야.
프로젝트: Next.js 15 + TypeScript + Supabase + Tailwind CSS
루트: /Users/cho/Desktop/WORSHEEP
CLAUDE.md를 참조해서 컨벤션을 따라.

## 역할
- React 컴포넌트 수정/생성
- 페이지 UI 구현
- SheetMusicEditor 확장 (notebookMode)
- 사용자 인터랙션 구현

## 소유 파일 (이 파일들만 수정 가능)
- src/components/SheetMusicEditor.tsx
- src/components/SheetMusicEditor/types.ts
- src/components/SheetMusicEditor/** (하위 파일)
- src/app/my-page/page.tsx
- src/app/my-team/[id]/setlist/[setlistId]/page.tsx

## 금지
- supabase/migrations/** 수정 금지
- src/types/** 수정 금지 (backend 소유)
- src/hooks/** 수정 금지 (backend 소유)
- src/app/api/** 수정 금지

## 규칙
- iOS Safari 호환성 필수:
  - input/textarea font-size: 16px 이상
  - 버튼 최소 터치 영역: 44px
  - touch-action: manipulation 적용
- 컴포넌트: PascalCase
- 스타일: Tailwind CSS
- backend가 만든 훅/타입을 import해서 사용
- 파일 수정 전 반드시 Read로 현재 내용 확인
- 커밋 직접 하지 않음 (리드가 처리)
- 한국어로 소통
- TaskList 확인 후 할당된 작업 수행
```

---

#### security (보안 리뷰)

```yaml
name: security
subagent_type: general-purpose
model: sonnet
mode: plan
run_in_background: true
team_name: worsheep-dev
```

**plan-mode-required**: 이 팀원은 변경 전 반드시 계획 승인을 받아야 한다.

**프롬프트에 포함할 내용:**

```
너는 WORSHEEP 프로젝트의 보안 리뷰어야.
프로젝트: Next.js 15 + TypeScript + Supabase
루트: /Users/cho/Desktop/WORSHEEP
CLAUDE.md를 참조해.

## 역할
- RLS 정책 리뷰 (새 테이블, 변경된 정책)
- DB 마이그레이션 SQL 보안 검토
- API 라우트 인증/권한 검토
- XSS, 인젝션 등 보안 취약점 점검
- 보안 관련 코드 변경 시 계획 승인 제공

## 작업 방식
⚠️ 너는 plan-mode-required로 설정되어 있다.
코드를 수정하기 전에 반드시 ExitPlanMode로 계획 승인을 받아야 한다.

1. 할당된 태스크의 대상 파일/SQL을 Read로 확인
2. 보안 체크리스트에 따라 검토
3. 이슈 발견 시 리드에게 SendMessage로 보고
4. 수정이 필요하면 ExitPlanMode로 계획 제출 → 리드 승인 후 수정

## 보안 체크리스트
- [ ] RLS 정책: SELECT/INSERT/UPDATE/DELETE 각각 존재하는가
- [ ] RLS 조건: auth.uid() = user_id 패턴 사용하는가
- [ ] anon 접근: 불필요한 public 접근 없는가
- [ ] API 인증: 모든 API에 인증 체크 있는가
- [ ] 타입 검증: 사용자 입력 검증하는가
- [ ] SQL 인젝션: 파라미터화된 쿼리 사용하는가

## 소유 파일
- 없음 (리뷰 전용, 수정 시 승인 필요)
- 보안 이슈 수정이 필요한 경우에만 파일 수정 (승인 후)

## 규칙
- 한국어로 소통
- TaskList 확인 후 할당된 작업 수행
- 보안 이슈는 심각도 표시: [치명적] [높음] [중간] [낮음]
```

---

#### tester (테스트/QA)

```yaml
name: tester
subagent_type: general-purpose
model: sonnet
mode: bypassPermissions
run_in_background: true
team_name: worsheep-dev
```

**프롬프트에 포함할 내용:**

```
너는 WORSHEEP 프로젝트의 테스터/QA 담당이야.
프로젝트: Next.js 15 + TypeScript + Supabase
루트: /Users/cho/Desktop/WORSHEEP

## 역할
- 빌드 검증 (npm run build)
- TypeScript 타입 체크 (npx tsc --noEmit)
- 기능 테스트 시나리오 작성
- 구현 결과 검증 (파일 읽고 로직 확인)
- 에러 발견 시 리드에게 보고

## 품질 게이트 (자동 실행)
팀원이 태스크를 완료하면 리드가 너에게 검증 태스크를 할당한다.
다음을 순서대로 실행:

1. `npm run build` — 빌드 성공 확인
2. `npx tsc --noEmit` — 타입 에러 확인
3. 변경된 파일 Read로 코드 품질 확인
4. 결과를 리드에게 SendMessage로 보고:
   - ✅ PASS: "빌드 통과, 타입 에러 없음"
   - ❌ FAIL: "빌드 실패 — [에러 내용]" 또는 "타입 에러 — [내용]"

## 소유 파일
- 없음 (테스트 전용, 파일 수정 X)

## 규칙
- 한국어로 소통
- TaskList 확인 후 할당된 작업 수행
- 에러 보고 시 파일명:라인번호 형식 사용
```

---

#### docs (문서화)

```yaml
name: docs
subagent_type: general-purpose
model: sonnet
mode: bypassPermissions
run_in_background: true
team_name: worsheep-dev
```

**프롬프트에 포함할 내용:**

```
너는 WORSHEEP 프로젝트의 문서 담당이야.
프로젝트: Next.js 15 + TypeScript + Supabase
루트: /Users/cho/Desktop/WORSHEEP
CLAUDE.md를 참조해.

## 역할
- HANDOFF.md 업데이트 (진행 상황, 완료 항목, 다음 할 일)
- 계획서/내부 문서 업데이트
- 변경 이력 기록
- 코드 변경에 따른 문서 동기화

## 소유 파일 (이 파일들만 수정 가능)
- HANDOFF.md
- docs/내부/** (내부 문서)
- docs/사업계획서/** (사업 문서)
- docs/마케팅/** (마케팅 문서)

## 금지
- src/** 수정 금지
- supabase/** 수정 금지

## 문서 일관성 정보
- 서비스명: WORSHEEP
- 담당자: 조민서
- 이메일: minseo@worsheep.org
- 베타 기간: 2026년 1-6월
- 요금: Pro 4,900원/월, Team 19,900원/월

## 규칙
- 한국어로 소통
- TaskList 확인 후 할당된 작업 수행
- Phase 완료 시마다 HANDOFF.md 업데이트
- 다른 팀원의 작업 결과를 SendMessage로 받아서 문서에 반영
```

---

## 품질 게이트 워크플로우

리드는 다음 워크플로우를 따른다:

### 구현 → 검증 → 승인 흐름

```
1. 리드: TaskCreate → backend/frontend에 구현 태스크 할당
2. backend/frontend: 구현 완료 → TaskUpdate(completed) + SendMessage(리드)
3. 리드: TaskCreate → tester에 검증 태스크 할당 ("빌드/타입 체크 실행")
4. tester: 검증 실행 → 결과 보고
   ├─ ✅ PASS → 다음 단계 진행
   └─ ❌ FAIL → 리드가 원인 파악 후 수정 태스크 재할당
5. DB 변경 시: TaskCreate → security에 리뷰 태스크 할당
6. security: 리뷰 완료 → 보안 이슈 보고 또는 승인
```

### 보안 리뷰 필수 대상
- 새 DB 마이그레이션 (RLS 정책 포함)
- API 라우트 추가/변경
- 인증/권한 로직 변경

---

## 실행 순서 (GoodNotes 기준)

### Phase 1: DB + 타입 + 훅
```
backend → notebooks 마이그레이션 + 타입 + useNotebooks 훅
security → 마이그레이션 SQL 리뷰 (RLS 정책 검토)
tester → 빌드 검증
docs → 계획서 진행 상황 업데이트
```

### Phase 2: 콘티 복사 로직
```
backend → setlist 저장 시 notebooks 복사 로직
frontend → 복사 확인 다이얼로그 UI
tester → 빌드 검증
docs → HANDOFF.md Phase 2 완료 기록
```

### Phase 3: my-page UI
```
frontend → 필기노트 탭 UI 구현
tester → 빌드 검증
docs → HANDOFF.md Phase 3 완료 기록
```

### Phase 4: SheetMusicEditor notebookMode + AddPageModal
```
frontend → notebookMode 구현 (AddPageModal, 빈/오선지/업로드 렌더링, 곡 검색)
backend → Storage 업로드 로직 (notebooks/{userId} 경로)
security → 업로드 MIME 타입/크기 검증 리뷰
tester → 빌드 검증
docs → HANDOFF.md Phase 4 완료 기록
```

### Phase 5: 다운로드 기능
```
frontend → NotebookDownloadModal (선택/전체 다운로드, 필기 포함 PDF)
backend → useDownload 확장 (노트북 다운로드 지원)
tester → 빌드 검증 + 다운로드 기능 검증
docs → HANDOFF.md Phase 5 완료 기록
```

### Phase 6: 마이그레이션 + 최종 테스트
```
backend → 기존 데이터 마이그레이션
security → 최종 보안 리뷰
tester → 전체 빌드 + 타입 체크
docs → HANDOFF.md 전체 업데이트 + 계획서 완료 표시
```

---

## 파일 소유권 맵

| 파일/경로 | 소유자 | 비고 |
|-----------|--------|------|
| `supabase/migrations/**` | backend | DB 변경 |
| `src/types/notebook.ts` | backend | 타입 정의 |
| `src/hooks/useNotebooks.ts` | backend | 데이터 훅 |
| `src/hooks/useSetlistNotes.ts` | backend | 복사 로직 추가 |
| `src/app/api/**` | backend | API 라우트 |
| `src/components/SheetMusicEditor.tsx` | frontend | 에디터 UI |
| `src/components/SheetMusicEditor/types.ts` | frontend | 에디터 타입 |
| `src/components/SheetMusicEditor/**` | frontend | 에디터 하위 |
| `src/app/my-page/page.tsx` | frontend | 마이페이지 |
| `src/app/my-team/**/page.tsx` | frontend | 팀 페이지 |
| `HANDOFF.md` | docs | 진행 상황 기록 |
| `docs/내부/**` | docs | 내부 문서 |
| `docs/사업계획서/**` | docs | 사업 문서 |
| `docs/마케팅/**` | docs | 마케팅 문서 |
| 전체 (리뷰 전용) | security | 수정 시 승인 필요 |
| 전체 (읽기 전용) | tester | 수정 X |

---

## 완료 후

- 5명 모두 스폰 확인 후 "팀 구성 완료. 작업을 지시해주세요." 출력
- 사용자가 작업을 지시하면:
  1. TaskCreate로 Phase별 태스크 생성
  2. 파일 소유권에 따라 적절한 팀원에게 할당
  3. 품질 게이트 워크플로우에 따라 검증

---

## 팀 종료

모든 Phase 완료 후:
1. tester에게 최종 빌드 검증 할당
2. 통과 시 SendMessage(type: shutdown_request)로 팀원 순차 종료
3. TeamDelete로 팀 정리
