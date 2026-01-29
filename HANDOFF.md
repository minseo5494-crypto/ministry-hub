# HANDOFF - 프로젝트 인수인계 문서

**마지막 업데이트**: 2026년 1월 29일 (저녁)

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

## 2. 최근 작업 (2026-01-29 저녁)

### 완료된 작업
- [x] **플레이리스트 기능 제거**: 불필요한 기능 삭제 (DB 롤백 포함)
- [x] **체크박스 색상 통일**: 흰색 체크 → 검은색/파란색으로 변경 (globals.css, SVG)
- [x] **네비게이션 통일**: 모든 페이지에 로고(→메인) + 뒤로가기 버튼 추가
  - 형식: 화살표 아이콘 + "뒤로가기 (페이지이름)"
  - 적용 페이지: my-team, my-page, my-notes, upload, streaming, teams/join, teams/create, settings 등
- [x] **사이드바 사용자 프로필 클릭**: 클릭 시 /my-page/settings(계정 관리)로 이동
- [x] **팀 콘티 송폼 모달 리디자인**: SongFormModal 디자인과 통일
- [x] **버튼 텍스트 색상 수정**: global CSS 오버라이드로 흰색 텍스트 적용

### 이전 작업 (1/28)
- 온보딩 가이드 구현, 관리자 대시보드 통계 개선
- "많이 찾은 순" 정렬 추가, 곡 활동 로깅

---

## 3. 다음에 할 일

### 즉시 (다음 세션)
1. [ ] **변경사항 커밋 & 푸시** (네비게이션 통일 등)
2. [ ] **테스터 모집** 우선 진행
3. [ ] **베타 테스트 준비**: 핵심 기능 안정화

### 단기 (베타 전 - 2월 20일까지)
- [ ] 테스터 피드백 수집 체계 구축
- [ ] UI/UX 개선 (디자이너 합류 시)

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
| AI 검색 API | `src/app/api/ai-search/route.ts` |
| AI 검색 훅 | `src/hooks/useAISearch.ts` |
| 콘텐츠 관리 | `src/app/admin/content-management/page.tsx` |
| 악보 에디터 | `src/components/SheetMusicEditor.tsx` |

### 문서
| 문서 | 경로 |
|------|------|
| 사업계획서 | `docs/사업계획서_WORSHEEP.md` |
| 베타 테스터 가이드 | `docs/베타테스터_가이드.md` |

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
- 네비게이션 통일 작업 완료 (커밋 필요)
- 기존 Team 기반 구조 유지 중
- 베타 테스트 준비에 집중 권장

---

*이 문서는 컨텍스트 리셋 시 업데이트됩니다.*
