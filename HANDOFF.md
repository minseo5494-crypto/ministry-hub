# HANDOFF - 프로젝트 인수인계 문서

**마지막 업데이트**: 2026년 2월 10일

---

## 1. 프로젝트 현재 상태

| 항목 | 상태 |
|------|------|
| **서비스명** | WORSHEEP |
| **개발 단계** | MVP 완료 (95%) |
| **베타 테스트** | 2월 20일 배포 예정 |
| **등록 곡 수** | 1,739곡 |
| **가입자 수** | 11명 |
| **팀 구성** | 1인 (2월 디자이너 합류 예정) |
| **도메인** | worsheep.org |
| **비즈니스 이메일** | minseo@worsheep.org |

---

## 2. 최근 작업 (2026-02-10)

### 완료된 작업
- [x] **신규 사용자 데모 팀 자동 가입 기능**
  - DB: `teams.is_demo` 컬럼 추가 + "새소망 찬양팀" 데모 팀/콘티/곡 데이터 생성
  - `src/lib/demoTeam.ts`: `joinDemoTeam(userId)` 유틸 함수 (중복 방지, 실패 무시)
  - `src/lib/auth.ts`: signUp + handleOAuthCallback에서 신규 사용자 시 자동 호출
  - 마이그레이션 SQL: `supabase/migrations/20260210_demo_team_setup.sql` (Supabase에 적용 완료)
- [x] **팀 콘티 악보 미리보기 더블탭 전체화면 기능**
  - `src/app/my-team/[id]/setlist/[setlistId]/page.tsx`에 SheetMusicViewer 연동
  - 데스크톱(더블클릭) + 모바일(더블탭 300ms 감지) 모두 지원
  - PDF는 `pointer-events-none`으로 wrapper div가 이벤트 수신

### 미커밋 변경사항 (커밋 필요)
- `src/lib/demoTeam.ts` (신규)
- `supabase/migrations/20260210_demo_team_setup.sql` (신규)
- `src/lib/auth.ts`, `src/lib/supabase.ts`, `src/app/my-team/[id]/setlist/[setlistId]/page.tsx` (수정)

### 이전 작업 요약 (2/9)
- 코드 리뷰 기반 품질 개선 + iOS Safari 호환성 개선
- AI 검색 tempo 버그 수정
- 메인 페이지 레이아웃 통일 및 히어로 섹션 조정

---

## 3. 다음에 할 일

### 즉시 (다음 세션)
1. [ ] **page.tsx 거대 컴포넌트 분리** — 1839줄, useState 50개+, useEffect 20개+를 커스텀 훅으로 분리 (예: `useSongManagement`, `useFilterLogic`, `useLikeSystem`)
2. [ ] **page.tsx `as any` 타입 개선** — Song 타입에 `like_count` 등 필드 추가, 6곳 수정
3. [ ] **page.tsx 필터 useEffect 최적화** — 250줄 useEffect(의존성 8개)를 `useMemo`로 전환 또는 분리

### 단기 (베타 전 - 2월 20일까지)
- [ ] 테스터 모집 및 피드백 수집 체계 구축
- [ ] UI/UX 개선 (디자이너 합류 시)
- [ ] 커스텀 역할 기능 실제 테스트

### 중기 (베타 기간)
- [ ] 베타 피드백 반영
- [ ] 파트너십 연락
- [ ] 디자이너와 UI/UX 리뉴얼

---

## 4. 주요 파일 위치

### 핵심 코드
| 기능 | 경로 |
|------|------|
| 메인 페이지 | `src/app/main/page.tsx` |
| 히어로 섹션 | `src/app/main/components/HeroSection.tsx` |
| AI 검색 API | `src/app/api/ai-search/route.ts` |
| 팀 설정 페이지 | `src/app/my-team/[id]/settings/page.tsx` |
| 팀 권한 훅 | `src/hooks/useTeamPermissions.ts` |
| 악보 에디터 | `src/components/SheetMusicEditor.tsx` |
| 송폼 편집 모달 | `src/components/SongFormPositionModal.tsx` |
| 송폼 모달 | `src/components/SongFormModal.tsx` |
| 묵상 가이드 | `src/components/SetlistDevotionals.tsx` |

### 문서
| 문서 | 경로 |
|------|------|
| 사업계획서 | `docs/사업계획서/` |
| 베타 테스터 가이드 | `docs/사용자가이드/베타테스터_가이드.md` |

---

## 5. 보안 관련 사항

### 완료된 보안 점검
- [x] `.env.local` gitignore 확인
- [x] 소스코드 내 API 키 하드코딩 없음
- [x] Supabase service_role 키 미사용 (anon key만 사용)
- [x] AI Search API 인증 추가

### 업로드 제한 설정
| 구분 | 시간당 | 일일 |
|------|--------|------|
| 일반 사용자 | 20곡 | 100곡 |
| 관리자 | 무제한 | 무제한 |

---

## 6. 주요 정보

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
| Anthropic API | AI 검색 |
| Cloudflare Turnstile | CAPTCHA |

---

## 7. 새 대화 시작 시

```
HANDOFF.md 읽어줘
```

현재 상태:
- 데모 팀 자동 가입 기능 구현 완료 (DB 마이그레이션 적용됨)
- 팀 콘티 악보 더블탭 전체화면 기능 추가 완료
- 미커밋 변경사항 있음 → 커밋 필요
- 베타 테스트 준비에 집중 권장 (2/20 마감)

---

*이 문서는 컨텍스트 리셋 시 업데이트됩니다.*
