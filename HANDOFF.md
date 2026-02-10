# HANDOFF - 프로젝트 인수인계 문서

**마지막 업데이트**: 2026년 2월 10일 (오후)

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

## 2. 최근 작업 (2026-02-10 오후)

### 완료된 작업
- [x] **로그인 에러 메시지 개선** — 미가입 이메일 → "존재하지 않는 이메일입니다", 비밀번호 틀림 → "비밀번호가 올바르지 않습니다"로 분기 처리. `/api/auth/check-email` API 추가
- [x] **회원가입 체크박스 색상 수정** — 이용약관/저작권 동의 체크 표시 흰색→검은색 (`text-white` → `text-black`)
- [x] **Resend SMTP 연동 완료** — 도메인 인증(DKIM, SPF, DMARC), Supabase Auth SMTP 설정, 이메일 인증 정상 동작 확인
- [x] **activity_logs RLS 수정** — 새 계정에서도 "이번주 많이 찾은 악보" 섹션이 보이도록 SELECT 정책 변경 (Supabase Dashboard에서 수동 적용)
- [x] **서비스 인프라 현황 문서 작성** — `docs/내부/서비스_인프라_현황.md` 생성 (도메인, 이메일, 호스팅, DB, 보안, 비용, 갱신 관리 등 전체 정리)

### 이전 작업 요약 (2/10 오전)
- 데모 팀 자동 가입 기능 구현 + 팀 콘티 악보 더블탭 전체화면 기능
- 이메일 인증 활성화/비활성화 Revert (현재 활성화 상태)

---

## 3. 다음에 할 일

### 즉시 (다음 세션)
1. [ ] **page.tsx 거대 컴포넌트 분리** — 1839줄, useState 50개+, useEffect 20개+를 커스텀 훅으로 분리
2. [ ] **page.tsx `as any` 타입 개선** — Song 타입에 `like_count` 등 필드 추가
3. [ ] **page.tsx 필터 useEffect 최적화** — 250줄 useEffect를 `useMemo`로 전환 또는 분리

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
| 인증 함수 | `src/lib/auth.ts` |
| 데모 팀 가입 | `src/lib/demoTeam.ts` |
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
- Resend SMTP 연동 완료, 이메일 인증 정상 동작
- 로그인 에러 메시지 개선 완료
- 모든 변경사항 커밋/푸시 완료
- 베타 테스트 준비에 집중 권장 (2/20 마감)

---

*이 문서는 컨텍스트 리셋 시 업데이트됩니다.*
