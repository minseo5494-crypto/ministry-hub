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

## 관련 서비스

- **Vercel**: https://vercel.com/dashboard
- **Supabase**: https://supabase.com/dashboard
- **Sentry**: https://sentry.io
- **GA4**: https://analytics.google.com
