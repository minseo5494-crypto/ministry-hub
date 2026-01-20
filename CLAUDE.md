# WORSHEEP - 예배팀 악보 관리 플랫폼

예배팀을 위한 악보 관리, 송폼 설정, 스트리밍 기능을 제공하는 웹 애플리케이션입니다.

## 기술 스택

- **프레임워크**: Next.js 15 (App Router)
- **언어**: TypeScript
- **데이터베이스**: Supabase (PostgreSQL)
- **인증**: Supabase Auth
- **스토리지**: Supabase Storage
- **스타일링**: Tailwind CSS
- **모니터링**: Sentry, Google Analytics 4
- **배포**: Vercel

## Supabase 프로젝트

- **Project ID**: `uoneiotepfmikprknxhk`
- **Name**: ministry-hub
- **Region**: ap-southeast-1 (Singapore)

## 프로젝트 구조

```
src/
├── app/                    # Next.js App Router 페이지
│   ├── admin/              # 관리자 페이지
│   │   ├── dashboard/      # 통계 대시보드
│   │   ├── content-management/  # 콘텐츠 관리
│   │   └── feedbacks/      # 피드백 관리
│   ├── auth/               # 인증 (로그인, 회원가입)
│   ├── songs/[id]/         # 악보 뷰어
│   ├── songform/           # 송폼 설정
│   └── streaming/          # 스트리밍 페이지
├── components/             # React 컴포넌트
├── hooks/                  # 커스텀 훅
├── lib/                    # 유틸리티 함수
├── types/                  # TypeScript 타입 정의
└── utils/                  # Supabase 클라이언트 등
```

## 주요 기능

1. **악보 관리**: PDF 악보 업로드, 조회, 검색
2. **개인 필기**: 악보에 필기 추가 (Soft Delete 방식 동기화)
3. **송폼 설정**: 예배 순서 편집, 드래그앤드롭 정렬
4. **스트리밍**: 예배 진행용 화면 송출
5. **관리자**: 콘텐츠 승인, 피드백 관리, 통계

## 데이터베이스 스키마 (주요 테이블)

| 테이블 | 설명 |
|--------|------|
| songs | 곡 정보 (제목, 아티스트, 키 등) |
| song_sheets | 악보 파일 (PDF URL, 버전) |
| user_song_notes | 개인 필기 노트 |
| songforms | 송폼 (예배 순서) |
| feedbacks | 사용자 피드백 |
| profiles | 사용자 프로필 |

## 코딩 컨벤션

### 커밋 메시지 (한국어)
```
feat: 새 기능 추가
fix: 버그 수정
style: UI/스타일 변경
refactor: 코드 리팩토링
docs: 문서 수정
chore: 기타 작업
```

### 파일 네이밍
- 컴포넌트: PascalCase (`SheetMusicViewer.tsx`)
- 훅: camelCase with use prefix (`useSheetMusicNotes.ts`)
- 유틸리티: camelCase (`supabase.ts`)

### 타입 정의
- 인터페이스보다 type 선호
- Supabase 자동 생성 타입 활용 (`Database['public']['Tables']`)

## 주의사항

### iOS Safari 호환성 (필수)
- input/textarea font-size: 16px 이상 (자동 줌 방지)
- 버튼 최소 터치 영역: 44px
- 체크박스/라디오: `appearance: checkbox` 유지
- touch-action: manipulation 적용

### Supabase
- RLS (Row Level Security) 정책 확인 필수
- 클라이언트: `createClient()` from `@/utils/supabase/client`
- 서버: `createClient()` from `@/utils/supabase/server`

### 보안
- 환경변수는 `.env.local`에 저장
- CAPTCHA: 회원가입에 Turnstile 적용
- 관리자 권한: `profiles.is_admin` 체크

## 자주 사용하는 명령어

```bash
npm run dev      # 개발 서버 실행
npm run build    # 프로덕션 빌드
npm run lint     # ESLint 검사
git push         # Vercel 자동 배포
```

## Claude Code 스킬

| 명령어 | 설명 |
|--------|------|
| `/deploy` | 배포 전 빌드 테스트 |
| `/db-check` | DB 스키마 확인 (MCP) |
| `/ios-test` | iOS 호환성 검사 |
| `/commit-kr` | 한국어 커밋 생성 |
| `/supabase-query` | Supabase 쿼리 도우미 (MCP) |
| `/docs` | 문서 관리 (생성, 수정, 목록) |

## 컨텍스트 관리

**HANDOFF.md**: 프로젝트 상태 인수인계 문서
- 위치: 프로젝트 루트
- 용도: 컨텍스트 리셋 후 프로젝트 상태 파악
- 새 대화 시작 시: "HANDOFF.md 읽어줘"로 상태 파악 가능

## Claude Code 에이전트

| 에이전트 | 설명 |
|----------|------|
| `doc-writer` | 문서 작성/수정 전문 |
| `code-reviewer` | 코드 리뷰 및 개선점 제안 |
| `feature-planner` | 새 기능 구현 계획 |
| `bug-fixer` | 버그 분석 및 수정 |
| `test-helper` | 테스트 시나리오 작성 |

## 문서 목록

| 문서 | 위치 | 용도 |
|------|------|------|
| 사업계획서 | docs/사업계획서_WORSHEEP.md | 내부용, 투자/정부지원 |
| 협업제안서 (팀) | docs/협업제안서_WORSHEEP.md | 찬양팀 파트너십 |
| 협업제안서 (채보자) | docs/협업제안서_채보자.md | 채보자 파트너십 |
| 동의서 양식 | docs/동의서_악보사용허락.md | 팀/채보자 동의 |
| 베타 테스터 가이드 | docs/베타테스터_가이드.md | 테스터 안내 |
| 서비스 소개서 | docs/서비스소개서_WORSHEEP.md | 마케팅 자료 |
| 내부 운영 가이드 | docs/내부운영_가이드.md | 운영 절차 |
| FAQ | docs/FAQ.md | 자주 묻는 질문 |
| 베타 초대 메시지 | docs/베타테스트_초대메시지.md | 테스터 초대 템플릿 |

## 관련 서비스

- **Vercel**: https://vercel.com/dashboard
- **Supabase**: https://supabase.com/dashboard
- **Sentry**: https://sentry.io
- **GA4**: https://analytics.google.com
