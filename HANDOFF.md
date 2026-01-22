# HANDOFF - 프로젝트 인수인계 문서

**마지막 업데이트**: 2026년 1월 22일

---

## 1. 프로젝트 현재 상태

| 항목 | 상태 |
|------|------|
| **서비스명** | WORSHEEP |
| **개발 단계** | MVP 완료 (95%) |
| **베타 테스트** | 준비 완료, 시작 전 |
| **등록 곡 수** | 1,000곡+ |
| **팀 구성** | 1인 (2월 디자이너 합류 예정) |
| **도메인** | worsheep.org ✅ |
| **비즈니스 이메일** | minseo@worsheep.org ✅ |

---

## 2. 최근 작업 (2026-01-22)

### 완료된 작업
- [x] 도메인 구매 (worsheep.org) - 호스팅케이알
- [x] WHOIS 개인정보 보호 설정
- [x] Google Workspace 설정 및 도메인 인증
- [x] 비즈니스 이메일 생성 (minseo@worsheep.org)
- [x] 이메일 별칭 추가 (support@worsheep.org)
- [x] Gmail MX 레코드 설정
- [x] DKIM 이메일 인증 설정
- [x] Vercel 커스텀 도메인 연결 (worsheep.org)
- [x] DNS A 레코드 설정 (Vercel 연결)
- [x] 코드 내 이메일 주소 변경 (worsheep.com → worsheep.org)
- [x] Cloudflare Turnstile에 worsheep.org 도메인 추가

### 이전 세션 요약
- 검색 기능 개선 및 다수 버그 수정
- 문서 전면 재구성 및 베타 테스트 준비 완료

---

## 3. 다음에 할 일

### 즉시 (베타 시작)
- [ ] 테스터 모집 (지인 연락)
- [ ] 초대 메시지 발송 (minseo@worsheep.org 또는 support@worsheep.org 사용)
- [ ] 베타 피드백 수집 시작

### 단기 (베타 기간)
- [ ] 베타 피드백 반영
- [ ] 파트너십 연락 (찬양팀에 협업제안서 발송)
- [ ] 디자이너와 UI/UX 리뉴얼 (2월)

### 중기 (정식 출시 전)
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

### 스킬/에이전트
| 이름 | 경로 | 용도 |
|------|------|------|
| `/docs` | `.claude/commands/docs.md` | 문서 관리 |
| `/handoff` | `.claude/commands/handoff.md` | 컨텍스트 리셋 전 업데이트 |
| `doc-writer` | `.claude/agents/doc-writer.md` | 문서 작성 전문 |

### 핵심 코드
| 기능 | 경로 |
|------|------|
| 메인 페이지 | `src/app/main/page.tsx` |
| 악보 에디터 | `src/components/SheetMusicEditor/` |
| 다운로드 훅 | `src/hooks/useDownload.tsx` |
| AI 검색 | `src/hooks/useAISearch.ts` |

---

## 5. 진행 중인 결정 사항

### 사업자 등록
- **현재**: 미등록 (개인 프로젝트)
- **타이밍**: 정식 출시 전, 결제 받기 전 등록 필요

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
