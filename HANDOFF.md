# HANDOFF - 프로젝트 인수인계 문서

**마지막 업데이트**: 2026년 1월 24일

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

## 2. 최근 작업 (2026-01-24)

### 완료된 작업
- [x] **화면 캡쳐 스크립트 작성** (Google Stitch 디자인 작업용):
  - `scripts/capture-all-screens.ts` - Playwright 기반 자동 캡쳐
  - 모든 페이지 + 3개 뷰포트 (데스크톱/태블릿/모바일)
  - 모달, 팝업 등 인터랙션 캡쳐 포함
- [x] **개발환경 CAPTCHA 비활성화 옵션 추가**:
  - `NEXT_PUBLIC_SKIP_CAPTCHA=true` 환경변수로 제어
  - `src/app/login/page.tsx`, `src/lib/auth.ts` 수정
  - ⚠️ `.env.local`에 설정됨 - 배포 시 제거 필요

### 진행 중인 작업
- [ ] **스크린샷 캡쳐 실행**: Playwright 스크립트로 전체 화면 캡쳐 중

### 이전 세션 요약 (01-23)
- 스팸 방지 기능, 곡 숨김 기능, 보안 강화
- 계정 관리 개선 (이메일 인증 상태 표시)

---

## 3. 다음에 할 일

### 즉시 (다음 세션)
- [ ] **스크린샷 캡쳐 완료 후 Google Stitch 작업**
- [ ] **배포 전 CAPTCHA 설정 복원** (`.env.local`에서 `NEXT_PUBLIC_SKIP_CAPTCHA` 제거)
- [ ] **저작권 미해결 곡 숨김 처리**

### 단기 (베타 전 - 2월 20일까지)
- [ ] 테스터 모집 (지인 연락)
- [ ] 피드백 수집 UI 개선
- [ ] 에러 페이지 개선
- [ ] 온보딩 가이드
- [ ] 관리자 대시보드 개선

### 중기 (베타 기간)
- [ ] 베타 피드백 반영
- [ ] 파트너십 연락 (찬양팀에 협업제안서 발송)
- [ ] 디자이너와 UI/UX 리뉴얼 (2월)

### 장기 (정식 출시 전)
- [ ] 사업자 등록 (결제 받기 전 필수)
- [ ] 결제 시스템 연동

---

## 4. 주요 파일 위치

### 문서
| 문서 | 경로 |
|------|------|
| 사업계획서 | `docs/사업계획서_WORSHEEP.md` |
| 협업제안서 (팀) | `docs/협업제안서_WORSHEEP.md` |
| 협업제안서 (채보자) | `docs/협업제안서_채보자.md` |
| 동의서 양식 | `docs/동의서_악보사용허락.md` |
| 베타 테스터 가이드 | `docs/베타테스터_가이드.md` |
| 초대 메시지 템플릿 | `docs/베타테스트_초대메시지.md` |
| 서비스 소개서 | `docs/서비스소개서_WORSHEEP.md` |
| 내부 운영 가이드 | `docs/내부운영_가이드.md` |
| FAQ | `docs/FAQ.md` |

### 스크립트
| 스크립트 | 경로 | 용도 |
|----------|------|------|
| 화면 캡쳐 | `scripts/capture-all-screens.ts` | Playwright 자동 스크린샷 |

### 핵심 코드
| 기능 | 경로 |
|------|------|
| 메인 페이지 | `src/app/main/page.tsx` |
| 로그인 페이지 | `src/app/login/page.tsx` |
| 악보 에디터 | `src/components/SheetMusicEditor/` |
| 다운로드 훅 | `src/hooks/useDownload.tsx` |
| AI 검색 | `src/hooks/useAISearch.ts` |

---

## 5. 진행 중인 결정 사항

### 사업자 등록
- **현재**: 미등록 (개인 프로젝트)
- **타이밍**: 정식 출시 전, 결제 받기 전 등록 필요

### 개발환경 CAPTCHA 비활성화
- **현재**: `.env.local`에 `NEXT_PUBLIC_SKIP_CAPTCHA=true` 설정됨
- **주의**: 프로덕션 배포 전 반드시 제거할 것

---

## 6. 주요 정보

### 연락처
| 용도 | 이메일 |
|------|--------|
| 대표 | minseo@worsheep.org |
| 지원/문의 | support@worsheep.org |
| (개인) | minseo1885@naver.com |

- 담당자: 조민서
- 전화: 010-3150-4221

### 서비스 URL
- **프로덕션**: https://worsheep.org
- **Vercel 기본**: https://ministry-hub-three.vercel.app
- **GitHub**: https://github.com/minseo5494-crypto/ministry-hub

### 요금제
- Free: 무료 (다운로드 주 5회)
- Pro: 월 4,900원
- Team: 월 19,900원/팀

### 외부 서비스
| 서비스 | 용도 |
|--------|------|
| Supabase | DB, Auth, Storage (Project ID: uoneiotepfmikprknxhk) |
| Vercel | 배포, 호스팅 |
| Google Workspace | 비즈니스 이메일 |
| Cloudflare Turnstile | CAPTCHA (회원가입/로그인) |
| 호스팅케이알 | 도메인 (worsheep.org) |

---

## 7. 새 대화 시작 시

새 대화에서 이 파일을 읽으면 프로젝트 상태를 파악할 수 있습니다:

```
HANDOFF.md 읽어줘
```

또는

```
프로젝트 현재 상태 파악하고 [작업 내용] 해줘
```

---

*이 문서는 컨텍스트 리셋 시 업데이트됩니다.*
