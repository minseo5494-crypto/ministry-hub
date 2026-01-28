# HANDOFF - 프로젝트 인수인계 문서

**마지막 업데이트**: 2026년 1월 28일

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

## 2. 최근 작업 (2026-01-28)

### 완료된 작업
- [x] **좋아요 관리 기능 추가** (관리자):
  - 콘텐츠 관리 > 좋아요 관리 탭 추가
  - 관리자 설정 좋아요와 사용자 좋아요 분리 (`admin_like_count` 컬럼 추가)
- [x] **좋아요 초기 데이터 설정**:
  - 인기곡 기준 좋아요 시딩 (30~2000)
  - 팀별 가중치 적용
- [x] **검색 정렬 개선**: 제목 일치 점수 → 좋아요 수 → 가나다 순
- [x] **좋아요 버튼 UX 개선**: Optimistic UI + 중복 클릭 방지

### 되돌린 작업
- [x] **교회 엔티티 구조 변경 시도 → 되돌림**:
  - `churches`, `church_members` 테이블 생성 후 RLS 정책 순환 참조 문제 발생
  - 무한 재귀 오류 (`infinite recursion detected in policy`) 반복
  - **결론**: 기존 Team 기반 구조 유지, 다른 접근법 필요
- [x] **예배 관리 시스템 → 되돌림**:
  - `/services`, 큐시트 기능 등 제거
- [x] **온보딩 가이드 → 되돌림**
- [x] **플레이리스트 공개 기능 → 되돌림**

---

## 3. 다음에 할 일

### 즉시 (다음 세션)
1. [ ] **기존 Team 구조 활용 방안 검토**:
   - 교회 엔티티 추가 대신 Team에 `type: 'church'` 추가 고려
   - 또는 교회 기능 없이 Team 단위로 서비스 진행
2. [ ] **테스터 모집** 우선 진행

### 단기 (베타 전 - 2월 20일까지)
- [ ] 베타 테스트 준비
- [ ] 온보딩 가이드 (단순화된 버전)
- [ ] 테스터 모집 및 피드백 수집

### 중기 (베타 기간)
- [ ] 베타 피드백 반영
- [ ] 파트너십 연락
- [ ] 디자이너와 UI/UX 리뉴얼

---

## 4. 주요 파일 위치

### 문서
| 문서 | 경로 |
|------|------|
| **교회 구조 변경 계획** | `docs/교회_엔티티_구조_변경_계획.md` (참고용) |
| 사업계획서 | `docs/사업계획서_WORSHEEP.md` |
| 협업제안서 (팀) | `docs/협업제안서_WORSHEEP.md` |
| 베타 테스터 가이드 | `docs/베타테스터_가이드.md` |

### 핵심 코드
| 기능 | 경로 |
|------|------|
| 메인 페이지 | `src/app/main/page.tsx` |
| 콘텐츠 관리 (좋아요 관리) | `src/app/admin/content-management/page.tsx` |
| 악보 에디터 | `src/components/SheetMusicEditor.tsx` |
| 필기 노트 훅 | `src/hooks/useSheetMusicNotes.ts` |
| 헤더 | `src/app/main/components/Header.tsx` |
| 모바일 메뉴 | `src/app/main/components/MobileMenu.tsx` |

---

## 5. 주요 기술적 교훈

### RLS 정책 순환 참조 문제
- **문제**: 테이블 A의 RLS가 테이블 B를 참조하고, B의 RLS가 다시 A를 참조하면 무한 재귀 발생
- **해결 시도**: `SECURITY DEFINER` 함수 사용 → 부분적 해결
- **결론**: 복잡한 RLS 구조는 피하고, 단순한 정책 설계 필요

---

## 6. 주요 정보

### 연락처
| 용도 | 이메일 |
|------|--------|
| 대표 | minseo@worsheep.org |
| 지원/문의 | support@worsheep.org |

- 담당자: 조민서
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
- 교회 엔티티 추가 시도했으나 RLS 문제로 되돌림
- 기존 Team 기반 구조 유지 중
- 베타 테스트 준비에 집중 권장

---

*이 문서는 컨텍스트 리셋 시 업데이트됩니다.*
