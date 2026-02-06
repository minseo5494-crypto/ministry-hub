# HANDOFF - 프로젝트 인수인계 문서

**마지막 업데이트**: 2026년 2월 6일

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

## 2. 최근 작업 (2026-02-06)

### 완료된 작업
- [x] **커스텀 역할 시스템 활성화**: `team_roles` DB 연동
  - `getTeamRoles()`: 항상 기본값 반환 → DB 조회 + fallback
  - `getTeamMembersWithRoles()`: `role_id` 기반 `team_roles` 조인 추가
  - `fetchPermissions()`: `role_id` 우선 조회, 없으면 legacy `role` 필드 사용
  - `updateMemberRole()`: `role_id` + legacy `role` 동시 업데이트
- [x] **역할 변경 모달 동적화** (settings/page.tsx)
  - 하드코딩 3개 역할 → DB에서 로드한 동적 역할 목록
  - "새 역할 추가" 인라인 폼 (이름 입력 + 권한 수준 선택)
  - 멤버 목록에 커스텀 역할 이름 표시

### 커밋되지 않은 변경사항 (⚠️)
- `src/hooks/useTeamPermissions.ts` — 커스텀 역할 시스템 활성화
- `src/app/my-team/[id]/settings/page.tsx` — 역할 모달 동적화
- `src/app/my-team/[id]/setlist/[setlistId]/page.tsx` — (이전 세션 변경)
- `src/components/SetlistDevotionals.tsx` — (이전 세션, 새 파일)
- `supabase/migrations/20260206_setlist_devotional*.sql` — (이전 세션, 새 파일)
- `docs/개발자_상담_질문지.md` — (이전 세션, 새 파일)
- `docs/내부/교회_엔티티_구조_변경_계획.md` — (삭제됨)

### 이전 작업 (1/30 이전)
- 송폼 편집 모달 디자인 개선
- 그리드 뷰 제거, 네비게이션 통일
- 다크모드 제거, 아이패드 에디터 헤더 개선

---

## 3. 다음에 할 일

### 즉시 (다음 세션)
1. [ ] **커밋되지 않은 변경사항 정리/커밋** — 위 변경사항 검토 후 커밋
2. [ ] **커스텀 역할 기능 실제 테스트** — 팀 설정에서 역할 추가/할당/표시 확인
3. [ ] **세트리스트 묵상가이드 기능 완성** (setlist devotionals 관련 파일들)

### 단기 (베타 전 - 2월 20일까지)
- [ ] 테스터 모집 및 피드백 수집 체계 구축
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
| 팀 설정 페이지 | `src/app/my-team/[id]/settings/page.tsx` |
| 팀 권한 훅 | `src/hooks/useTeamPermissions.ts` |
| 직책 관리 컴포넌트 | `src/components/TeamRolesManager.tsx` |
| 악보 에디터 | `src/components/SheetMusicEditor.tsx` |
| 송폼 편집 모달 | `src/components/SongFormPositionModal.tsx` |

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
- 커스텀 역할 시스템 활성화 완료 (커밋 필요)
- 커밋되지 않은 변경사항 여러 개 있음 — 다음 세션에서 정리 필요
- 베타 테스트 준비에 집중 권장

---

*이 문서는 컨텍스트 리셋 시 업데이트됩니다.*
