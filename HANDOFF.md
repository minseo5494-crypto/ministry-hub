# HANDOFF - 프로젝트 인수인계 문서

**마지막 업데이트**: 2026년 1월 27일

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

## 2. 최근 작업 (2026-01-27)

### 완료된 작업
- [x] **예배 관리 시스템 구현**:
  - `/services` 페이지 (예배 목록)
  - `/my-team/[id]/services` 팀별 예배 관리
  - 큐시트 기능 (`src/hooks/useCueSheet.ts`, `src/lib/cuesheet-constants.ts`)
- [x] **좋아요 관리 기능 추가** (관리자):
  - 콘텐츠 관리 > 좋아요 관리 탭 추가
  - 관리자 설정 좋아요와 사용자 좋아요 분리 (`admin_like_count` 컬럼 추가)
- [x] **좋아요 초기 데이터 설정**:
  - 인기곡 기준 좋아요 시딩 (30~2000)
  - 팀별 가중치 적용 (제이어스/팀룩/기프티드 5x, 위러브/위클레시아 4x 등)
  - 원키 버전이 더 높은 좋아요를 갖도록 조정
- [x] **검색 정렬 개선**: 제목 일치 점수 → 좋아요 수 → 가나다 순
- [x] **좋아요 버튼 UX 개선**: Optimistic UI + 중복 클릭 방지
- [x] **서비스 페이지 색상 변경**: indigo → blue (통일)

### 진행 중인 작업
- [ ] **교회 엔티티 구조 변경**: 계획 문서 작성 완료
  - 📄 `docs/교회_엔티티_구조_변경_계획.md` 참고

---

## 3. 다음에 할 일

### 즉시 (다음 세션) - 교회 엔티티 구조 변경
1. [ ] DB 마이그레이션
   - `churches` 테이블 생성
   - `church_members` 테이블 생성
   - `teams.church_id` 컬럼 추가
   - `services.church_id` 컬럼 추가
   - 기존 데이터 마이그레이션
2. [ ] 프론트엔드
   - `/church/create`, `/church/join` 페이지
   - `/my-churches` 페이지
   - `/my-church/[id]` 대시보드
3. [ ] 기존 페이지 수정
   - 홈 화면에 교회 컨텍스트 추가
   - `/my-team` 페이지 교회 연결

### 단기 (베타 전 - 2월 20일까지)
- [ ] 플레이리스트 공개 기능 (팀 셋리스트 공유)
- [ ] 공개 플레이리스트 탐색 페이지
- [ ] 테스터 모집
- [ ] 온보딩 가이드

### 중기 (베타 기간)
- [ ] 베타 피드백 반영
- [ ] 파트너십 연락
- [ ] 디자이너와 UI/UX 리뉴얼

---

## 4. 주요 파일 위치

### 문서
| 문서 | 경로 |
|------|------|
| **교회 구조 변경 계획** | `docs/교회_엔티티_구조_변경_계획.md` |
| 예배관리 사용가이드 | `docs/예배관리_사용가이드.md` |
| 사업계획서 | `docs/사업계획서_WORSHEEP.md` |
| 협업제안서 (팀) | `docs/협업제안서_WORSHEEP.md` |
| 베타 테스터 가이드 | `docs/베타테스터_가이드.md` |

### 새로 추가된 파일
| 기능 | 경로 |
|------|------|
| 예배 서비스 페이지 | `src/app/services/page.tsx` |
| 팀 예배 관리 | `src/app/my-team/[id]/services/` |
| 예배 컴포넌트 | `src/components/services/` |
| 큐시트 훅 | `src/hooks/useCueSheet.ts` |
| 서비스 훅 | `src/hooks/useServices.ts` |
| 타입 정의 | `src/types/` |

### 핵심 코드
| 기능 | 경로 |
|------|------|
| 메인 페이지 | `src/app/main/page.tsx` |
| 콘텐츠 관리 (좋아요 관리) | `src/app/admin/content-management/page.tsx` |
| 악보 에디터 | `src/components/SheetMusicEditor.tsx` |
| 필기 노트 훅 | `src/hooks/useSheetMusicNotes.ts` |

---

## 5. 진행 중인 결정 사항

### 교회 엔티티 구조
- **결정됨**: 교회를 별도 엔티티로 분리
- **구조**: `교회 > 예배`, `교회 > 팀 > 셋리스트`
- **상세 계획**: `docs/교회_엔티티_구조_변경_계획.md`

### 플레이리스트 공개 기능
- **계획**: 팀 셋리스트를 공개 설정하면 다른 팀이 볼 수 있음
- **탐색 페이지**: `/explore/playlists` (추후 구현)

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

그리고 다음 작업:
```
docs/교회_엔티티_구조_변경_계획.md 읽고 구현 시작해줘
```

---

*이 문서는 컨텍스트 리셋 시 업데이트됩니다.*
