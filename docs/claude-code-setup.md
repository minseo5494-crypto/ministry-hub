# WORSHEEP 프로젝트 Claude Code 설정 가이드

이 문서는 WORSHEEP 프로젝트에서 Claude Code의 고급 기능을 활용하기 위한 설정 가이드입니다.

---

## 목차

1. [CLAUDE.md - 프로젝트 컨텍스트](#1-claudemd---프로젝트-컨텍스트)
2. [커스텀 슬래시 명령어](#2-커스텀-슬래시-명령어)
3. [커스텀 에이전트](#3-커스텀-에이전트)
4. [MCP 서버 연결](#4-mcp-서버-연결)
5. [Hooks 설정](#5-hooks-설정)

---

## 1. CLAUDE.md - 프로젝트 컨텍스트

### 개요
`CLAUDE.md` 파일은 프로젝트에 대한 핵심 정보를 Claude에게 자동으로 전달합니다.
매 세션마다 프로젝트 설명을 반복할 필요가 없어집니다.

### 파일 위치
- **팀 공유**: `./CLAUDE.md` (git에 커밋)
- **개인용**: `./CLAUDE.local.md` (자동으로 .gitignore에 추가됨)

### 포함 내용
- 기술 스택 (Next.js, Supabase, TypeScript 등)
- 프로젝트 구조 및 폴더 규칙
- 코딩 컨벤션 (커밋 메시지, 네이밍 등)
- 데이터베이스 스키마 요약
- 주의사항 (iOS 호환성 등)

### 생성 명령어
```bash
/init
```

---

## 2. 커스텀 슬래시 명령어

### 개요
자주 사용하는 작업을 `/명령어` 형태로 빠르게 실행할 수 있습니다.

### 파일 위치
- **프로젝트용**: `.claude/commands/명령어.md`
- **개인용**: `~/.claude/commands/명령어.md`

### 생성할 명령어 목록

#### `/deploy` - 배포 전 빌드 테스트
```markdown
---
description: Vercel 배포 전 빌드 테스트 및 에러 수정
allowed-tools: Bash(npm:*), Read, Edit
---

배포 전 빌드 테스트를 실행합니다.

1. `npm run build` 실행
2. 타입 에러나 빌드 에러 발생 시 원인 분석
3. 에러 수정 후 다시 빌드
4. 성공할 때까지 반복
5. 최종 결과 보고
```

#### `/db-check` - 데이터베이스 스키마 확인
```markdown
---
description: Supabase 테이블 스키마 및 타입 정의 확인
allowed-tools: Read, Grep, Glob
---

현재 데이터베이스 스키마를 분석합니다.

1. `src/types/` 폴더의 타입 정의 읽기
2. Supabase 관련 코드에서 테이블 구조 파악
3. 테이블별 컬럼, 관계, 인덱스 정리
4. 마크다운 테이블 형식으로 출력
```

#### `/ios-test` - iOS Safari 호환성 검사
```markdown
---
description: iOS Safari 호환성 문제 검사
allowed-tools: Read, Grep, Glob
---

변경된 파일들의 iOS Safari 호환성을 검사합니다.

체크 항목:
1. `appearance: none`이 체크박스/라디오에 잘못 적용되지 않았는지
2. input/textarea의 font-size가 16px 이상인지 (자동 줌 방지)
3. 버튼의 최소 터치 영역이 44px 이상인지
4. touch-action: manipulation 적용 여부
5. -webkit-tap-highlight-color 설정 여부

문제 발견 시 수정 방안 제시.
```

#### `/commit-kr` - 한국어 커밋 메시지 생성
```markdown
---
description: 변경사항 분석 후 한국어 커밋 메시지 생성
allowed-tools: Bash(git:*)
---

현재 변경사항을 분석하고 한국어 커밋 메시지를 생성합니다.

1. `git diff --staged` 또는 `git diff` 확인
2. 변경 유형 파악 (feat, fix, style, refactor, docs 등)
3. 한국어로 커밋 메시지 작성
4. 커밋 실행 여부 확인

커밋 메시지 형식:
- feat: 새 기능 추가
- fix: 버그 수정
- style: UI/스타일 변경
- refactor: 코드 리팩토링
- docs: 문서 수정
- chore: 기타 작업
```

#### `/supabase-query` - Supabase 쿼리 도우미
```markdown
---
description: Supabase 쿼리 작성 도우미
allowed-tools: Read, Grep
---

Supabase 쿼리 작성을 도와줍니다.

$ARGUMENTS

1. 기존 유사한 쿼리 패턴 검색
2. 프로젝트의 Supabase 클라이언트 사용법 확인
3. 요청한 쿼리 작성
4. 에러 처리 및 타입 안전성 포함
```

---

## 3. 커스텀 에이전트

### 개요
복잡한 작업을 위한 전문화된 서브에이전트를 생성합니다.
에이전트는 격리된 컨텍스트에서 실행되어 메인 대화를 깔끔하게 유지합니다.

### 파일 위치
- **프로젝트용**: `.claude/agents/에이전트명.md`
- **개인용**: `~/.claude/agents/에이전트명.md`

### 생성할 에이전트 목록

#### `feature-planner` - 기능 기획 에이전트
```yaml
---
name: feature-planner
description: 새 기능 구현 계획을 세울 때 사용. 기존 코드 분석 후 구현 단계를 제시합니다.
tools: Read, Grep, Glob
model: sonnet
---

# WORSHEEP 기능 기획 에이전트

새로운 기능을 구현하기 전에 철저한 분석과 계획을 수립합니다.

## 분석 프로세스

1. **요구사항 분석**
   - 사용자 요청 명확화
   - 기능 범위 정의

2. **기존 코드 분석**
   - 관련 컴포넌트/페이지 탐색
   - 유사 기능 구현 패턴 확인
   - 재사용 가능한 코드 식별

3. **영향 범위 파악**
   - 수정이 필요한 파일 목록
   - 새로 생성할 파일 목록
   - 데이터베이스 스키마 변경 필요 여부

4. **구현 계획**
   - 단계별 구현 순서
   - 각 단계의 상세 작업 내용
   - 예상 주의사항

5. **체크리스트**
   - iOS Safari 호환성
   - 모바일 반응형
   - Supabase RLS 정책
   - 타입 안전성
```

#### `bug-fixer` - 버그 수정 에이전트
```yaml
---
name: bug-fixer
description: 버그 리포트를 받아 원인을 분석하고 수정합니다. 에러 메시지나 증상을 입력하세요.
tools: Read, Grep, Glob, Edit
model: sonnet
---

# WORSHEEP 버그 수정 에이전트

버그를 체계적으로 분석하고 수정합니다.

## 분석 프로세스

1. **증상 파악**
   - 에러 메시지 분석
   - 재현 조건 확인
   - 영향 범위 파악

2. **원인 추적**
   - 관련 코드 탐색
   - 최근 변경사항 확인
   - 의존성 체크

3. **근본 원인 분석**
   - 직접 원인 vs 근본 원인 구분
   - 유사 버그 가능성 체크

4. **수정 방안**
   - 최소 침습적 수정
   - 부작용 검토
   - 테스트 방법 제시

5. **수정 적용**
   - 코드 수정
   - 수정 내용 설명
   - 추가 테스트 권장사항

## 주의사항
- iOS Safari 호환성 유지
- 기존 기능에 영향 없도록
- 타입 안전성 확보
```

#### `code-reviewer` - 코드 리뷰 에이전트
```yaml
---
name: code-reviewer
description: 코드 변경사항을 리뷰하고 개선점을 제안합니다.
tools: Read, Grep, Glob
model: sonnet
---

# WORSHEEP 코드 리뷰 에이전트

코드 품질과 일관성을 검토합니다.

## 리뷰 항목

1. **코드 품질**
   - 가독성
   - 중복 코드
   - 복잡도

2. **타입 안전성**
   - TypeScript 타입 정의
   - any 사용 여부
   - null/undefined 처리

3. **보안**
   - XSS 취약점
   - SQL 인젝션 (Supabase)
   - 인증/권한 체크

4. **성능**
   - 불필요한 리렌더링
   - 메모이제이션 필요성
   - 쿼리 최적화

5. **호환성**
   - iOS Safari
   - 모바일 반응형
   - 접근성

## 출력 형식
- 심각도: 높음/중간/낮음
- 파일:라인 위치
- 문제 설명
- 개선 제안
```

#### `test-helper` - 테스트 도우미 에이전트
```yaml
---
name: test-helper
description: 기능 테스트 시나리오 작성 및 수동 테스트 가이드 생성
tools: Read, Grep, Glob
model: haiku
---

# WORSHEEP 테스트 도우미

수동 테스트 시나리오와 체크리스트를 생성합니다.

## 테스트 범위

1. **기능 테스트**
   - 정상 동작 시나리오
   - 예외 상황 처리
   - 경계값 테스트

2. **UI/UX 테스트**
   - 반응형 레이아웃
   - 터치 인터랙션
   - 로딩/에러 상태

3. **호환성 테스트**
   - Chrome (데스크탑)
   - Safari (iOS)
   - Chrome (Android)

4. **권한 테스트**
   - 비로그인 사용자
   - 일반 사용자
   - 관리자

## 출력 형식
- 테스트 ID
- 전제조건
- 테스트 단계
- 예상 결과
- 실제 결과 (체크박스)
```

---

## 4. MCP 서버 연결

### 개요
MCP(Model Context Protocol) 서버를 연결하면 외부 도구와 통합됩니다.

### 사용 가능한 MCP 서버

#### GitHub MCP 서버
```bash
# 설치
claude mcp add github -- npx -y @anthropic-ai/mcp-server-github

# 또는 scope 지정
claude mcp add --scope project github -- npx -y @anthropic-ai/mcp-server-github
```

**기능:**
- PR 생성/조회/머지
- 이슈 관리
- 코드 리뷰 코멘트
- 브랜치 관리

#### Sentry MCP 서버 (선택사항)
```bash
# 설치 (이미 Sentry 사용 중이므로 유용)
claude mcp add sentry -- npx -y @sentry/mcp-server
```

**기능:**
- 에러 조회
- 이슈 분석
- 성능 모니터링 데이터

### MCP 서버 관리 명령어
```bash
# 목록 확인
claude mcp list

# 상세 정보
claude mcp get github

# 제거
claude mcp remove github

# Claude Code 내에서
/mcp
```

---

## 5. Hooks 설정

### 개요
특정 이벤트 발생 시 자동으로 실행되는 스크립트를 설정합니다.

### 파일 위치
- `~/.claude/settings.json` (전역)
- `.claude/settings.json` (프로젝트)

### Hook 이벤트 종류
- `PreToolUse`: 도구 실행 전
- `PostToolUse`: 도구 실행 후
- `UserPromptSubmit`: 사용자 입력 전
- `Stop`: Claude 응답 완료 시
- `SessionStart`: 세션 시작 시

### 예시 설정

#### 파일 수정 로깅
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "echo \"$(date): 파일 수정됨\" >> ~/.claude/edit-log.txt"
          }
        ]
      }
    ]
  }
}
```

#### 민감한 파일 보호
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "if echo \"$TOOL_INPUT\" | grep -q '.env'; then exit 2; fi"
          }
        ]
      }
    ]
  }
}
```

---

## 설정 완료 후 사용법

### 슬래시 명령어 사용
```
/deploy          # 배포 전 빌드 테스트
/db-check        # DB 스키마 확인
/ios-test        # iOS 호환성 검사
/commit-kr       # 한국어 커밋 메시지 생성
/supabase-query  # Supabase 쿼리 도우미
```

### 에이전트 사용
Claude Code가 작업 설명을 보고 자동으로 적합한 에이전트를 선택하거나,
명시적으로 요청할 수 있습니다:
- "기능 기획해줘" → feature-planner 에이전트
- "이 버그 수정해줘" → bug-fixer 에이전트
- "코드 리뷰해줘" → code-reviewer 에이전트

### MCP 서버 사용
GitHub MCP가 연결되면:
- PR 정보 자동 조회
- 이슈 컨텍스트 자동 로드
- `@github:pr/123` 형식으로 참조 가능

---

## 파일 구조 요약

```
WORSHEEP/
├── CLAUDE.md                    # 프로젝트 컨텍스트
├── CLAUDE.local.md              # 개인 설정 (gitignore)
├── .claude/
│   ├── settings.json            # 프로젝트 설정
│   ├── settings.local.json      # 개인 권한 설정
│   ├── commands/                # 슬래시 명령어
│   │   ├── deploy.md
│   │   ├── db-check.md
│   │   ├── ios-test.md
│   │   ├── commit-kr.md
│   │   └── supabase-query.md
│   └── agents/                  # 커스텀 에이전트
│       ├── feature-planner.md
│       ├── bug-fixer.md
│       ├── code-reviewer.md
│       └── test-helper.md
└── docs/
    └── claude-code-setup.md     # 이 문서
```

---

## 참고 자료

- [Claude Code 공식 문서](https://docs.anthropic.com/claude-code)
- [MCP 서버 목록](https://github.com/anthropics/mcp-servers)
- [Claude Code GitHub](https://github.com/anthropics/claude-code)
