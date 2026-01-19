# WORSHEEP Claude Code 사용 가이드

이 문서는 WORSHEEP 프로젝트에 추가된 Claude Code 설정들의 **구체적인 사용법**을 설명합니다.

---

## 목차

1. [추가된 항목 요약](#1-추가된-항목-요약)
2. [CLAUDE.md - 프로젝트 컨텍스트](#2-claudemd---프로젝트-컨텍스트)
3. [Supabase MCP 연결](#3-supabase-mcp-연결)
4. [슬래시 명령어 사용법](#4-슬래시-명령어-사용법)
5. [커스텀 에이전트 사용법](#5-커스텀-에이전트-사용법)
6. [활용 시나리오 예시](#6-활용-시나리오-예시)

---

## 1. 추가된 항목 요약

| 항목 | 파일 위치 | 활성화 방법 | 용도 | MCP 활용 |
|------|-----------|-------------|------|----------|
| CLAUDE.md | `/CLAUDE.md` | **자동** (매 세션 로드) | 프로젝트 정보 자동 전달 | - |
| /deploy | `.claude/commands/deploy.md` | `/deploy` 입력 | 배포 전 빌드 테스트 | - |
| /db-check | `.claude/commands/db-check.md` | `/db-check` 입력 | DB 스키마 확인 | **Supabase MCP** |
| /ios-test | `.claude/commands/ios-test.md` | `/ios-test` 입력 | iOS 호환성 검사 | - |
| /commit-kr | `.claude/commands/commit-kr.md` | `/commit-kr` 입력 | 한국어 커밋 생성 | - |
| /supabase-query | `.claude/commands/supabase-query.md` | `/supabase-query [설명]` 입력 | Supabase 쿼리 도우미 | **Supabase MCP** |
| feature-planner | `.claude/agents/feature-planner.md` | **자동** (작업에 따라) | 기능 기획 | **Supabase MCP** |
| bug-fixer | `.claude/agents/bug-fixer.md` | **자동** (작업에 따라) | 버그 수정 | **Supabase MCP** |
| code-reviewer | `.claude/agents/code-reviewer.md` | **자동** (작업에 따라) | 코드 리뷰 | **Supabase MCP** |
| test-helper | `.claude/agents/test-helper.md` | **자동** (작업에 따라) | 테스트 시나리오 | - |

---

## 2. CLAUDE.md - 프로젝트 컨텍스트

### 이게 뭔가요?
`CLAUDE.md`는 프로젝트의 핵심 정보를 담은 파일입니다. Claude Code가 세션을 시작할 때 **자동으로 읽어서** 프로젝트를 이해합니다.

### 활성화 방법
**자동 활성화** - 아무것도 할 필요 없습니다!

프로젝트 폴더에서 Claude Code를 실행하면 자동으로 로드됩니다.

### 포함된 정보
- 기술 스택 (Next.js, Supabase, TypeScript 등)
- 프로젝트 구조
- 데이터베이스 테이블 설명
- 코딩 컨벤션
- 주의사항 (iOS Safari 호환성 등)

### 확인 방법
```bash
# 파일 내용 보기
cat CLAUDE.md
```

### 수정하고 싶다면
`CLAUDE.md` 파일을 직접 편집하면 됩니다. 다음 세션부터 반영됩니다.

---

## 3. Supabase MCP 연결

### MCP란?
**Model Context Protocol** - Claude Code와 외부 서비스를 연결해주는 프로토콜입니다.
Supabase MCP를 연결하면 **실시간으로 DB에 직접 접근**할 수 있습니다.

### 연결 상태 확인
Claude Code 실행 시 상단에 "1 MCP server needs auth" 메시지가 뜨면:
```
/mcp
```
를 입력하여 인증을 완료합니다.

### Supabase MCP로 가능한 작업

| 기능 | 설명 | 사용 예시 |
|------|------|----------|
| **테이블 조회** | 실제 DB 테이블 목록 확인 | "현재 테이블 목록 보여줘" |
| **스키마 확인** | 컬럼, 타입, FK 관계 조회 | "songs 테이블 구조 보여줘" |
| **SQL 실행** | SELECT 쿼리 직접 실행 | "최근 10개 곡 조회해줘" |
| **타입 생성** | TypeScript 타입 자동 생성 | "DB 타입 새로 생성해줘" |
| **로그 확인** | API, Auth, DB 로그 조회 | "인증 에러 로그 확인해줘" |
| **보안 점검** | RLS, 취약점 검사 | "보안 점검 해줘" |
| **문서 검색** | Supabase 공식 문서 검색 | "RLS 정책 설정 방법 알려줘" |

### 프로젝트 정보
- **Project ID**: `uoneiotepfmikprknxhk`
- **Name**: ministry-hub
- **Region**: ap-southeast-1 (Singapore)

---

## 4. 슬래시 명령어 사용법

### 사용 방법
Claude Code 대화창에서 `/명령어`를 입력하면 됩니다.

### 명령어 목록

#### `/deploy` - 배포 전 빌드 테스트

**언제 사용하나요?**
- Vercel에 배포하기 전에 빌드가 성공하는지 확인하고 싶을 때
- 타입 에러나 빌드 에러를 미리 잡고 싶을 때

**사용 예시:**
```
> /deploy
```

**실행 결과:**
1. `npm run build` 실행
2. 에러 발생 시 자동으로 원인 분석
3. 에러 수정 후 다시 빌드
4. 성공할 때까지 반복

---

#### `/db-check` - 데이터베이스 스키마 확인 (MCP 활용)

**언제 사용하나요?**
- 현재 DB 구조를 파악하고 싶을 때
- 새 기능 추가 전 테이블 구조를 확인하고 싶을 때
- RLS 정책 상태를 확인하고 싶을 때

**사용 예시:**
```
> /db-check
```

**실행 결과 (MCP 연결 시):**
- **실제 DB**에서 테이블 목록 조회
- 각 테이블의 컬럼, 타입, 기본값 정보
- 외래키 관계 매핑
- RLS 정책 현황
- 보안 취약점 점검
- TypeScript 타입 생성 가능

---

#### `/ios-test` - iOS Safari 호환성 검사

**언제 사용하나요?**
- CSS나 UI 코드를 수정한 후
- iOS에서 버그가 발생했을 때
- 새 컴포넌트를 만든 후

**사용 예시:**
```
> /ios-test
```

**검사 항목:**
- 체크박스/라디오 버튼 스타일
- input 폰트 크기 (16px 이상인지)
- 버튼 터치 영역 (44px 이상인지)
- 터치 관련 CSS 속성

---

#### `/commit-kr` - 한국어 커밋 메시지 생성

**언제 사용하나요?**
- 코드 수정 후 커밋하고 싶을 때
- 적절한 커밋 메시지가 떠오르지 않을 때

**사용 예시:**
```
> /commit-kr
```

**실행 결과:**
1. 변경 사항 자동 분석
2. 적절한 타입 선택 (feat, fix, style 등)
3. 한국어 커밋 메시지 생성
4. 확인 후 커밋 실행

---

#### `/supabase-query` - Supabase 쿼리 도우미 (MCP 활용)

**언제 사용하나요?**
- Supabase 쿼리 작성이 필요할 때
- 복잡한 조인이나 필터가 필요할 때
- 쿼리를 테스트하고 싶을 때

**사용 예시:**
```
> /supabase-query 특정 사용자의 모든 송폼과 곡 목록 조회
> /supabase-query 최근 7일간 추가된 곡 조회
> /supabase-query 관리자 승인 대기 중인 곡 목록
```

**실행 결과 (MCP 연결 시):**
- 실제 DB 스키마 확인 후 쿼리 작성
- SELECT 쿼리 직접 테스트 가능
- 프로젝트 패턴에 맞는 TypeScript 코드
- 에러 처리 포함
- 타입 안전한 쿼리

---

### 명령어 목록 확인
```
> /help
```
또는 탭 키를 누르면 사용 가능한 명령어 목록이 표시됩니다.

---

## 5. 커스텀 에이전트 사용법

### 에이전트란?
복잡한 작업을 처리하는 **전문화된 AI 도우미**입니다. 작업 내용에 따라 **자동으로 선택**됩니다.

### 활성화 방법
**자동 활성화** - 작업을 설명하면 Claude가 적절한 에이전트를 선택합니다.

### 에이전트 목록

#### `feature-planner` - 기능 기획 에이전트 (MCP 활용)

**자동 선택 키워드:**
- "기획해줘", "계획 세워줘", "구현 방법", "어떻게 만들지"

**사용 예시:**
```
> 다크 모드 기능 기획해줘
> 악보에 북마크 기능 추가하려면 어떻게 해야 할지 계획 세워줘
> 실시간 채팅 기능 구현 방법 알려줘
```

**제공하는 정보 (MCP 연결 시):**
- 기능 요약
- **실제 DB 스키마 분석** (MCP로 조회)
- 영향받는 파일 목록
- 단계별 구현 계획
- DB 변경 필요 시 마이그레이션 SQL
- RLS 정책 필요 여부
- 주의사항 체크리스트

---

#### `bug-fixer` - 버그 수정 에이전트 (MCP 활용)

**자동 선택 키워드:**
- "버그", "에러", "안 돼", "오류", "수정해줘"

**사용 예시:**
```
> 체크박스가 안 보이는 버그 수정해줘
> iOS에서 버튼이 안 눌리는 에러 있어
> 이 오류 메시지 해결해줘: [에러 메시지]
```

**처리 과정 (MCP 연결 시):**
1. 증상 분석
2. **Supabase 로그 확인** (API, Auth, DB 로그)
3. **DB 상태 조회** (데이터 정합성 체크)
4. 관련 코드 탐색
5. 근본 원인 파악
6. **보안 점검** (advisors 확인)
7. 수정 방안 제시
8. 코드 수정

---

#### `code-reviewer` - 코드 리뷰 에이전트 (MCP 활용)

**자동 선택 키워드:**
- "리뷰", "검토", "코드 확인", "개선점"

**사용 예시:**
```
> 방금 수정한 코드 리뷰해줘
> src/components/SheetMusicViewer.tsx 코드 검토해줘
> 이번 PR 코드 확인해줘
```

**검토 항목 (MCP 연결 시):**
- 코드 품질 (가독성, 중복)
- 타입 안전성
- 보안 취약점
- 성능 이슈
- iOS 호환성
- **DB 보안 점검** (RLS 정책, advisors)

---

#### `test-helper` - 테스트 도우미 에이전트

**자동 선택 키워드:**
- "테스트", "시나리오", "QA", "체크리스트"

**사용 예시:**
```
> 송폼 기능 테스트 시나리오 만들어줘
> 새로 만든 필기 기능 테스트 체크리스트 작성해줘
> 로그인 기능 QA 시나리오 필요해
```

**제공하는 정보:**
- 기능별 테스트 케이스
- 전제조건, 테스트 단계, 예상 결과
- 브라우저/기기별 테스트 항목
- 권한별 테스트 시나리오

---

## 6. 활용 시나리오 예시

### 시나리오 1: 새 기능 개발 (MCP 활용)

```
1. DB 스키마 확인
   > /db-check

2. 기능 기획 (MCP로 실제 DB 분석)
   > 사용자별 즐겨찾기 기능 기획해줘

3. 구현
   > 기획대로 구현해줘

4. iOS 호환성 검사
   > /ios-test

5. 빌드 테스트
   > /deploy

6. 커밋
   > /commit-kr
```

### 시나리오 2: 버그 수정 (MCP 활용)

```
1. 버그 신고
   > iOS Safari에서 송폼 저장 버튼이 안 눌려

2. (bug-fixer 에이전트가 MCP로 로그 확인 및 분석)

3. 테스트 시나리오 생성
   > 수정된 기능 테스트 시나리오 만들어줘

4. 빌드 확인
   > /deploy

5. 커밋
   > /commit-kr
```

### 시나리오 3: 코드 리뷰 후 배포 (MCP 활용)

```
1. 코드 리뷰 (MCP로 DB 보안 점검 포함)
   > 오늘 수정한 파일들 코드 리뷰해줘

2. 리뷰 반영
   > 지적된 부분 수정해줘

3. iOS 검사
   > /ios-test

4. 최종 빌드
   > /deploy

5. 커밋 및 푸시
   > /commit-kr
   > git push
```

### 시나리오 4: DB 관련 작업 (MCP 활용)

```
1. 현재 스키마 확인 (실제 DB 조회)
   > /db-check

2. 쿼리 작성 및 테스트
   > /supabase-query 최근 일주일간 가장 많이 본 악보 TOP 10

3. 기능 구현
   > 위 쿼리를 사용해서 인기 악보 섹션 만들어줘

4. RLS 정책 확인
   > songs 테이블 RLS 정책 확인해줘

5. 보안 점검
   > 보안 취약점 있는지 점검해줘
```

### 시나리오 5: 에러 디버깅 (MCP 활용)

```
1. 에러 발생
   > "인증 에러가 계속 나요"

2. 로그 확인
   > Supabase auth 로그 확인해줘

3. DB 상태 확인
   > 해당 사용자 프로필 데이터 조회해줘

4. 원인 분석 및 수정
   > (bug-fixer 에이전트가 자동 처리)
```

---

## 추가 팁

### 1. MCP 인증
세션 시작 시 "MCP server needs auth" 메시지가 뜨면 `/mcp` 입력

### 2. 명령어 자동완성
`/`를 입력하고 **Tab** 키를 누르면 사용 가능한 명령어 목록이 표시됩니다.

### 3. CLAUDE.md 개인화
프로젝트 루트에 `CLAUDE.local.md` 파일을 만들면 개인 설정을 추가할 수 있습니다 (git에 커밋되지 않음).

### 4. 명령어 수정
`.claude/commands/` 폴더의 `.md` 파일을 수정하면 명령어 동작을 커스터마이즈할 수 있습니다.

### 5. 에이전트 수정
`.claude/agents/` 폴더의 `.md` 파일을 수정하면 에이전트 동작을 커스터마이즈할 수 있습니다.

---

## 문제 해결

### MCP 연결 안 돼요
- Claude Code 실행 후 `/mcp` 입력하여 인증
- 인증 성공 메시지: "Authentication successful. Connected to supabase."

### 명령어가 안 보여요
- Claude Code를 재시작해 보세요
- `.claude/commands/` 폴더에 파일이 있는지 확인하세요

### 에이전트가 자동 선택 안 돼요
- 작업 설명을 더 구체적으로 해보세요
- 예: "버그 있어" → "체크박스가 안 보이는 버그 수정해줘"

### CLAUDE.md가 로드 안 되는 것 같아요
- 프로젝트 루트 폴더에서 Claude Code를 실행했는지 확인하세요
- `cat CLAUDE.md` 명령으로 파일 존재 여부 확인

### DB 쿼리가 실행 안 돼요
- MCP 연결 상태 확인 (`/mcp`)
- SELECT 쿼리만 직접 실행 가능 (INSERT/UPDATE/DELETE는 확인 후)

---

## 파일 구조 요약

```
WORSHEEP/
├── CLAUDE.md                          # 자동 로드되는 프로젝트 정보
├── docs/
│   ├── claude-code-setup.md           # 상세 설정 문서
│   └── claude-code-사용-가이드.md      # 이 문서
└── .claude/
    ├── settings.local.json            # 권한 설정 (개인용)
    ├── commands/                      # 슬래시 명령어
    │   ├── deploy.md
    │   ├── db-check.md               # MCP: Supabase
    │   ├── ios-test.md
    │   ├── commit-kr.md
    │   └── supabase-query.md         # MCP: Supabase
    └── agents/                        # 커스텀 에이전트
        ├── feature-planner.md        # MCP: Supabase
        ├── bug-fixer.md              # MCP: Supabase
        ├── code-reviewer.md          # MCP: Supabase
        └── test-helper.md
```
