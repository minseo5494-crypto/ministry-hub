# HANDOFF - 프로젝트 인수인계 문서

**마지막 업데이트**: 2026년 2월 12일 (저녁)

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
| **도메인** | worsheep.org (호스팅케이알, 만료 2027-01-22) |
| **비즈니스 이메일** | minseo@worsheep.org (Google Workspace) |
| **시스템 이메일** | noreply@worsheep.org (Resend SMTP) |

---

## 2. 최근 작업 (2026-02-12)

### 완료된 작업
- [x] **악보 에디터 모바일 레이아웃 개선** — 상단바 버튼/아이콘 크기 통일(w-6 h-6), 하단 도구 막대 가로 스크롤 지원
- [x] **송폼/파트태그 바텀시트 드래그** — 모바일에서 드래그로 리사이즈 가능, 스크롤 분리(overscroll-contain)
- [x] **콘티 카드 모바일 레이아웃** — 번호+제목 한줄, 아이콘/송폼/메모 전체 너비 활용
- [x] **콘티 헤더 개선** — 모바일에서 WORSHEEP만 sticky, 제목은 별도 줄, 날짜와 간격 조정
- [x] **iOS Safari 대용량 악보 캔버스 수정** — iOS 기기 감지 후 보수적 캔버스 제한(4096px/16M), 모바일 scaleFactor 1x
- [x] **악보 에디터 내보내기 모바일 수정** — 내보내기에도 동일 캔버스 제한 적용, 모바일 오류 해결
- [x] **앱 아이콘 양 캐릭터로 변경** — PWA 아이콘(72~512px), favicon.ico, 브라우저 탭 아이콘 교체
- [x] **모바일 메뉴 헤더 스타일** — 보라-파랑 그라데이션 → 연한 보라색(bg-purple-50)
- [x] **로그인 에러 메시지 수정** — check-email API가 auth.users 직접 조회하도록 변경
- [x] **팀 생성 RLS 오류 수정** — teams INSERT에 created_by 누락 → 추가
- [x] **팀 최대 10개 제한** — 팀 생성/참여 시 team_members 기준 10개 제한 체크

### 이전 작업 요약 (2/10)
- 팀 설정 멤버 관리 통합, 곡 검색 개선, 콘티 PPT 리팩토링
- Google OAuth 로그인/데모 팀 자동 가입, 약관 동의 모달

---

## 3. 다음에 할 일

### 즉시 (다음 세션)
1. [ ] **Supabase SQL 실행 필요** — `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS terms_agreed_at timestamptz; UPDATE public.users SET terms_agreed_at = created_at WHERE terms_agreed_at IS NULL;`
2. [ ] **page.tsx 거대 컴포넌트 분리** — 1900줄+, useState 50개+를 커스텀 훅으로 분리

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
| 로그인 | `src/app/login/page.tsx` |
| 회원가입 | `src/app/signup/page.tsx` |
| 이메일 확인 API | `src/app/api/auth/check-email/route.ts` |
| 사용자 설정 API | `src/app/api/auth/setup-user/route.ts` |
| 인증 함수 | `src/lib/auth.ts` |
| 데모 팀 가입 | `src/lib/demoTeam.ts` |
| 직책/권한 관리 | `src/components/TeamRolesManager.tsx` |
| 악보 에디터 | `src/components/SheetMusicEditor.tsx` |
| 악보 뷰어 | `src/components/SheetMusicViewer.tsx` |
| 팀 생성 | `src/app/teams/create/page.tsx` |
| 팀 참여 | `src/app/teams/join/page.tsx` |
| 콘티 상세 | `src/app/my-team/[id]/setlist/[setlistId]/page.tsx` |
| 모바일 메뉴 | `src/app/main/components/MobileMenu.tsx` |
| 팀 설정 | `src/app/my-team/[id]/settings/page.tsx` |

### 문서
| 문서 | 경로 |
|------|------|
| 서비스 인프라 현황 | `docs/내부/서비스_인프라_현황.md` |
| 운영비용 정리 | `docs/내부/운영비용_정리.md` |
| 내부 운영 가이드 | `docs/내부/내부운영_가이드.md` |
| 사업계획서 | `docs/사업계획서/` |

---

## 5. 인프라 주요 변경 이력

| 날짜 | 변경 |
|------|------|
| 2026-02-12 | 앱 아이콘 양 캐릭터로 교체 (PWA + favicon) |
| 2026-02-12 | iOS Safari 캔버스 제한 적용 (뷰어 + 에디터 + 내보내기) |
| 2026-02-12 | check-email API → auth.users 직접 조회로 변경 |
| 2026-02-12 | 팀 생성/참여 최대 10개 제한 추가 |
| 2026-02-10 | Resend SMTP 연동 (도메인 인증 완료, Tokyo 리전) |
| 2026-02-10 | Google OAuth setup-user API 추가 (RLS 우회, 데모 팀 자동 가입) |
| 2026-02-10 | users 테이블 terms_agreed_at 컬럼 추가 (DB SQL 실행 필요) |

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
| Resend | 시스템 이메일 발송 (SMTP) |
| Google Workspace | 비즈니스 이메일 |
| 호스팅케이알 | 도메인 등록/관리 |
| Anthropic API | AI 검색 |
| Cloudflare Turnstile | CAPTCHA |

> 전체 인프라 상세 정보: `docs/내부/서비스_인프라_현황.md`

---

## 7. 새 대화 시작 시

```
HANDOFF.md 읽어줘
```

현재 상태:
- 모바일 레이아웃 대폭 개선 (악보 에디터 + 콘티 페이지)
- iOS Safari 캔버스 제한 적용 완료 (뷰어/에디터/내보내기)
- 앱 아이콘 양 캐릭터로 통일
- 팀 생성 RLS 수정 + 10개 제한 적용
- 약관 동의 모달 코드 완료 (DB SQL 실행 필요 — 위 "즉시" 항목 참조)
- 모든 변경사항 커밋/푸시 완료

---

*이 문서는 컨텍스트 리셋 시 업데이트됩니다.*
