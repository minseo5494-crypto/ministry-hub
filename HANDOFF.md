# HANDOFF - 프로젝트 인수인계 문서

**마지막 업데이트**: 2026년 2월 10일 (저녁)

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

## 2. 최근 작업 (2026-02-10 저녁)

### 완료된 작업
- [x] **팀 설정 멤버 관리 통합** — "기본정보" 탭의 멤버 관리를 "직책/권한 관리" 탭(`TeamRolesManager`)으로 이동, 기존 멤버별 직책 섹션 제거
- [x] **곡 검색 개선** — 콘티 곡 추가 검색에서 띄어쓰기 무시 검색 지원, 모달 높이 고정(`h-[80vh]`)으로 UI 점핑 방지
- [x] **콘티 PPT 다운로드 리팩토링** — 표지 슬라이드 + 곡별 타이틀 + 가사 2줄/슬라이드 방식으로 전면 개편. 팀명/송폼/키/섹션 라벨 제거
- [x] **Google OAuth 로그인 개선** — 중복 이메일 에러(23505) 수정, 사용자 생성/업데이트를 서버 API(`/api/auth/setup-user`)로 통합 (RLS 우회)
- [x] **Google OAuth 데모 팀 자동 가입** — 신규 Google 사용자도 데모 WORSHEEP 팀에 자동 가입되도록 setup-user API에서 처리
- [x] **신규 사용자 약관 동의 모달** — `terms_agreed_at` 컬럼 추가, 메인 페이지에서 미동의 사용자에게 이용약관/저작권 동의 모달 표시

### 이전 작업 요약 (2/10 오전~오후)
- 로그인 에러 메시지 개선, 회원가입 체크박스 색상 수정
- Resend SMTP 연동, activity_logs RLS 수정
- 데모 팀 자동 가입 기능, 서비스 인프라 현황 문서 작성

---

## 3. 다음에 할 일

### 즉시 (다음 세션)
1. [ ] **Supabase SQL 실행 필요** — `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS terms_agreed_at timestamptz; UPDATE public.users SET terms_agreed_at = created_at WHERE terms_agreed_at IS NULL;` (Dashboard SQL Editor에서 실행)
2. [ ] **모바일 my-team/[id] 설정 버튼 확인** — 사용자가 모바일에서 설정 아이콘이 안 보인다고 보고. 코드상 `lg:hidden`으로 보여야 하는데 원인 조사 필요
3. [ ] **page.tsx 거대 컴포넌트 분리** — 1900줄+, useState 50개+를 커스텀 훅으로 분리

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
| 2026-02-10 | Resend SMTP 연동 (도메인 인증 완료, Tokyo 리전) |
| 2026-02-10 | activity_logs RLS 정책 수정 (전체 인증 사용자 SELECT 허용) |
| 2026-02-10 | 이메일 인증 활성화 (Resend 통해 발송) |
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
- Google OAuth + 데모 팀 자동 가입 정상 동작
- 약관 동의 모달 코드 완료 (DB SQL 실행 필요 — 위 "즉시" 항목 참조)
- 모바일 my-team 설정 버튼 이슈 미해결 (조사 필요)
- 모든 변경사항 커밋/푸시 완료

---

*이 문서는 컨텍스트 리셋 시 업데이트됩니다.*
