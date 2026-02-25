# GoodNotes 스타일 필기 시스템 — WORSHEEP 통합 계획서

> 작성일: 2026-02-24
> 목적: GoodNotes 기능 명세서를 WORSHEEP "내 필기노트"에 통합하기 위한 분석 및 구현 계획

---

## 1. 현재 WORSHEEP 필기 기능 현황

### 1-1. 기존 아키텍처

```
사용자
 ├── my-page (내 페이지)
 │   └── "필기 노트" 탭
 │       ├── 개별 악보 필기 (sheet_music_notes 테이블)
 │       └── 콘티 필기 (setlist_notes 테이블) ← 방금 구현 완료
 ├── my-team/[id] (팀 페이지)
 │   └── 콘티 → 악보 에디터 → 저장
 └── songs/[id] (곡 상세)
     └── 악보 에디터 → 저장
```

### 1-2. 기존 데이터 저장 구조

| 테이블 | 용도 | 주요 필드 |
|--------|------|-----------|
| `sheet_music_notes` | 개별 곡 필기 | user_id, song_id, annotations(JSONB), song_form_style, part_tags |
| `setlist_notes` | 콘티 단위 통합 필기 | user_id, setlist_id, note_data(JSONB: {songId→곡별데이터}) |
| `songs` | 곡 정보 | song_name, file_url, file_type |
| `song_sheets` | 악보 파일 (버전관리) | song_id, file_url, file_type, label |

### 1-3. 기존 컴포넌트/훅

| 파일 | 역할 | 재사용 가능성 |
|------|------|--------------|
| `SheetMusicEditor.tsx` (~4600줄) | 필기 에디터 (펜, 형광펜, 지우개, 텍스트, 올가미, 피아노/드럼 악보) | **높음** — 핵심 에디터 |
| `SheetMusicViewer.tsx` | 보기 전용 뷰어 | 중간 |
| `useSheetMusicNotes.ts` | localStorage + Supabase 동기화 | 🔄 리팩토링 필요 |
| `useSetlistNotes.ts` | 콘티 노트 CRUD | 🔄 확장 필요 |
| `useDownload.tsx` | PDF/이미지 내보내기 | **높음** — 그대로 재사용 |

---

## 2. GoodNotes 기능 vs WORSHEEP 기존 기능 매핑

### 2-1. 상세 매핑표

| # | GoodNotes 기능 | 상태 | WORSHEEP 현황 | 비고 |
|---|---------------|------|--------------|------|
| **파일 관리 시스템** | | | |
| 1 | 메인 화면 (파일 관리자) | ❌ 없음 | my-page "필기 노트" 탭이 플랫 리스트 | 폴더 계층 구조 없음 |
| 2 | 폴더 생성/관리 | ❌ 없음 | - | 새로 구현 필요 |
| 3 | 노트북 생성 | 🔄 부분 | "악보에서 필기 저장"으로 노트 생성됨 | 빈 노트북 생성 불가 |
| 4 | 격자/목록 보기 전환 | ❌ 없음 | 목록 형태만 존재 | |
| 5 | 정렬 (이름/생성일/수정일) | ❌ 없음 | 수정일 내림차순 고정 | |
| 6 | 다중 선택 모드 | ❌ 없음 | - | |
| 7 | 드래그 앤 드롭 (파일 이동) | ❌ 없음 | - | |
| **노트 편집** | | | |
| 8 | 필기 도구 (펜/형광펜/지우개/텍스트) | ✅ 있음 | SheetMusicEditor에 완전 구현 | |
| 9 | 올가미 선택/이동 | ✅ 있음 | SheetMusicEditor lasso 기능 | |
| 10 | 보기모드/편집모드 전환 | ✅ 있음 | initialMode='view'/'edit' | |
| 11 | Undo/Redo | ✅ 있음 | 히스토리 스택 구현됨 | |
| **페이지 관리** | | | |
| 12 | 다중 페이지 지원 | 🔄 부분 | PDF 다중 페이지 뷰어 있음. 빈 페이지 추가 불가 | |
| 13 | 페이지 네비게이션 (이전/다음) | ✅ 있음 | 상단 페이지 번호 + 좌우 버튼 | |
| 14 | 페이지 개요 패널 (썸네일) | ❌ 없음 | - | |
| 15 | 페이지 추가 (빈 오선지) | ❌ 없음 | - | 새 기능 |
| 16 | 페이지 추가 (악보 검색) | 🔗 결합 | songs 테이블 검색 → 악보 가져오기 | 기존 악보 DB 활용 |
| 17 | 페이지 순서 변경 | ❌ 없음 | - | |
| 18 | 페이지 복제/삭제 | ❌ 없음 | - | |
| **용지 템플릿** | | | |
| 19 | 오선지 템플릿 | ❌ 없음 | - | 새로 구현 (SVG/Canvas) |
| 20 | 악보 가져오기 (검색) | 🔗 결합 | songs 검색 + song_sheets 악보 조회 기능 존재 | API 연결만 필요 |
| 21 | 페이지별 다른 템플릿 | ❌ 없음 | 현재 노트 전체가 하나의 악보 | |
| **저장/내보내기** | | | |
| 22 | 자동 저장 (5초 간격) | ❌ 없음 | 수동 저장만 (저장 버튼) | |
| 23 | 페이지 이동 시 자동 저장 | ❌ 없음 | - | |
| 24 | PDF 내보내기 | ✅ 있음 | useDownload + jsPDF | |
| 25 | 이미지 내보내기 | ✅ 있음 | useDownload | |
| 26 | 선택 페이지만 내보내기 | ❌ 없음 | 전체만 가능 | |
| **고급 기능** | | | |
| 27 | 연속 스크롤 모드 | ❌ 없음 | 페이지 단위만 | |
| 28 | 스와이프 제스처 | 🔄 부분 | 다중 곡 모드에서 좌우 곡 전환 | 페이지 스와이프는 없음 |
| 29 | 노트 정보 표시 | ❌ 없음 | - | |

### 2-2. 요약 통계

- ✅ 이미 있음: **6개** (필기도구, 올가미, 보기/편집모드, Undo/Redo, 페이지 네비, 내보내기)
- 🔄 부분적: **4개** (노트북 생성, 다중페이지, 스와이프, 악보 검색)
- ❌ 없음: **16개** (파일관리, 폴더, 페이지개요, 오선지, 자동저장 등)
- 🔗 결합 가능: **3개** (악보 검색 가져오기, 기존 DB 활용)

---

## 3. WORSHEEP 특화 시너지 포인트

WORSHEEP은 일반 노트앱이 아닌 **예배팀 악보 관리 플랫폼**이므로 GoodNotes 기능을 그대로 복제하는 것이 아니라, 예배팀 워크플로우에 맞게 변형해야 합니다.

### 3-1. 악보 가져오기 = WORSHEEP 곡 검색

| GoodNotes 원안 | WORSHEEP 변형 |
|---------------|--------------|
| 외부 악보 API 검색 | **songs 테이블 + song_sheets 검색** (이미 5000+ 곡 보유) |
| 로컬 파일 가져오기 | **팀 악보 업로드 기능** (이미 구현됨) |
| 악보 선택 후 배경 삽입 | **song_sheets.file_url을 페이지 배경으로** |

### 3-2. 노트북 = 콘티/예배 단위

| GoodNotes 원안 | WORSHEEP 변형 |
|---------------|--------------|
| 빈 노트북 생성 | **콘티에서 자동 생성** + 빈 노트북도 지원 |
| 표지 색상 | **콘티 날짜/예배 유형**으로 구분 |
| 여러 페이지 = 여러 문서 | **여러 곡의 악보 = 콘티의 각 곡** |

### 3-3. 폴더 = 팀/시즌/카테고리

| GoodNotes 원안 | WORSHEEP 변형 |
|---------------|--------------|
| 일반 폴더 | **팀별 자동 폴더** + 사용자 커스텀 폴더 |
| 수동 정리 | **팀 연동**: 팀에서 콘티 저장 시 자동으로 해당 팀 폴더에 |

### 3-4. 오선지 = 악보 연습 노트

| GoodNotes 원안 | WORSHEEP 변형 |
|---------------|--------------|
| 빈 오선지 | **빈 오선지 + 코드 차트 템플릿** |
| 음악 노트용 | **밴드 파트별 템플릿** (피아노, 기타 TAB, 드럼) |

---

## 4. Supabase 데이터베이스 설계

### 4-1. 새로 필요한 테이블

#### (1) `note_folders` — 폴더 관리

```sql
CREATE TABLE note_folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES note_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '새 폴더',
  color TEXT DEFAULT '#FFD60A',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 인덱스
CREATE INDEX idx_note_folders_user ON note_folders(user_id);
CREATE INDEX idx_note_folders_parent ON note_folders(parent_id);

-- RLS
ALTER TABLE note_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "note_folders_select" ON note_folders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "note_folders_insert" ON note_folders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "note_folders_update" ON note_folders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "note_folders_delete" ON note_folders FOR DELETE USING (auth.uid() = user_id);
```

#### (2) `notebooks` — 노트북 관리

```sql
CREATE TABLE notebooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES note_folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL DEFAULT '제목 없는 노트',
  cover_color TEXT DEFAULT '#E8735A',
  paper_orientation TEXT DEFAULT 'portrait' CHECK (paper_orientation IN ('portrait', 'landscape')),
  last_opened_page INTEGER DEFAULT 1,
  -- 콘티 연동 (선택적)
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  setlist_id UUID,
  -- 메타
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 인덱스
CREATE INDEX idx_notebooks_user ON notebooks(user_id);
CREATE INDEX idx_notebooks_folder ON notebooks(folder_id);
CREATE INDEX idx_notebooks_setlist ON notebooks(setlist_id);
CREATE INDEX idx_notebooks_updated ON notebooks(updated_at DESC);

-- RLS
ALTER TABLE notebooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notebooks_select" ON notebooks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notebooks_insert" ON notebooks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notebooks_update" ON notebooks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notebooks_delete" ON notebooks FOR DELETE USING (auth.uid() = user_id);
```

#### (3) `notebook_pages` — 노트북 내 페이지

```sql
CREATE TABLE notebook_pages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  notebook_id UUID NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  -- 용지 템플릿
  paper_template TEXT DEFAULT 'blank' CHECK (paper_template IN ('blank', 'staff', 'imported', 'chord_chart', 'guitar_tab', 'drum')),
  paper_orientation TEXT DEFAULT 'portrait' CHECK (paper_orientation IN ('portrait', 'landscape')),
  -- 악보 가져오기 시
  song_id UUID REFERENCES songs(id) ON DELETE SET NULL,
  sheet_id UUID REFERENCES song_sheets(id) ON DELETE SET NULL,
  imported_file_url TEXT,
  imported_file_type TEXT,
  -- 필기 데이터 (JSONB — 기존 PageAnnotation 구조 호환)
  annotations JSONB DEFAULT '[]',
  -- 송폼/파트태그 (기존 기능 호환)
  song_form_enabled BOOLEAN DEFAULT false,
  song_form_style JSONB,
  part_tags JSONB DEFAULT '[]',
  piano_scores JSONB DEFAULT '[]',
  drum_scores JSONB DEFAULT '[]',
  -- 썸네일
  thumbnail_url TEXT,
  thumbnail_updated_at TIMESTAMPTZ,
  -- 메타
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_notebook_pages_notebook ON notebook_pages(notebook_id, page_number);
CREATE INDEX idx_notebook_pages_song ON notebook_pages(song_id);

-- RLS (notebook의 user_id를 통해 간접 확인)
ALTER TABLE notebook_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notebook_pages_select" ON notebook_pages FOR SELECT
  USING (notebook_id IN (SELECT id FROM notebooks WHERE user_id = auth.uid()));
CREATE POLICY "notebook_pages_insert" ON notebook_pages FOR INSERT
  WITH CHECK (notebook_id IN (SELECT id FROM notebooks WHERE user_id = auth.uid()));
CREATE POLICY "notebook_pages_update" ON notebook_pages FOR UPDATE
  USING (notebook_id IN (SELECT id FROM notebooks WHERE user_id = auth.uid()));
CREATE POLICY "notebook_pages_delete" ON notebook_pages FOR DELETE
  USING (notebook_id IN (SELECT id FROM notebooks WHERE user_id = auth.uid()));
```

#### (4) `user_note_settings` — 사용자 설정

```sql
CREATE TABLE user_note_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_paper_template TEXT DEFAULT 'staff',
  default_paper_orientation TEXT DEFAULT 'portrait',
  view_mode TEXT DEFAULT 'grid' CHECK (view_mode IN ('grid', 'list')),
  sort_order TEXT DEFAULT 'modified_desc' CHECK (sort_order IN ('name_asc', 'name_desc', 'created_desc', 'modified_desc')),
  auto_save_interval INTEGER DEFAULT 5000,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE user_note_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_select" ON user_note_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "settings_upsert" ON user_note_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "settings_update" ON user_note_settings FOR UPDATE USING (auth.uid() = user_id);
```

### 4-2. 테이블 관계도

```
auth.users
 ├── note_folders (user_id)
 │   └── note_folders (parent_id) ← 재귀 (중첩 폴더)
 ├── notebooks (user_id)
 │   ├── note_folders (folder_id) ← 어느 폴더에 있는지
 │   ├── teams (team_id) ← 팀 연동 (선택)
 │   └── notebook_pages (notebook_id)
 │       ├── songs (song_id) ← 악보 가져오기
 │       └── song_sheets (sheet_id) ← 악보 버전
 ├── user_note_settings (user_id)
 │
 │── [기존] sheet_music_notes (user_id) ← 마이그레이션 대상
 └── [기존] setlist_notes (user_id) ← 마이그레이션 대상
```

### 4-3. 기존 데이터 마이그레이션 전략

기존 `sheet_music_notes`와 `setlist_notes` 데이터를 새 구조로 이전합니다.

#### sheet_music_notes → notebooks + notebook_pages

```sql
-- 1단계: 각 sheet_music_note를 notebook으로 변환
INSERT INTO notebooks (id, user_id, name, created_at, updated_at)
SELECT
  gen_random_uuid(),
  user_id,
  COALESCE(title, song_name, '필기 노트'),
  created_at,
  updated_at
FROM sheet_music_notes
WHERE deleted_at IS NULL;

-- 2단계: 각 노트의 annotations를 페이지로 분리
-- (annotations 배열의 각 원소 = 하나의 페이지)
-- 이 부분은 서버 사이드 스크립트로 처리
```

#### setlist_notes → notebooks + notebook_pages

```sql
-- 콘티 노트의 note_data 내 각 곡을 페이지로 분리
-- note_data: { songId: { annotations, songFormStyle, ... } }
-- → 각 songId = 하나 이상의 notebook_pages
-- 이 부분도 서버 사이드 스크립트로 처리
```

**마이그레이션 원칙:**
- 기존 테이블은 즉시 삭제하지 않음 (읽기 전용으로 유지, 6개월 후 삭제)
- 새 시스템이 안정화될 때까지 병행 운영
- 마이그레이션 스크립트는 Node.js로 작성하여 1회 실행

---

## 5. 구현 계획 (Phase별)

### Phase 0: 기반 준비 (1주)

| 작업 | 설명 | 변경 파일 |
|------|------|-----------|
| DB 마이그레이션 파일 생성 | note_folders, notebooks, notebook_pages, user_note_settings | `supabase/migrations/` |
| 기본 훅 생성 | `useNotebooks`, `useNotebookPages`, `useNoteFolders` | `src/hooks/` |
| 타입 정의 | Notebook, NotebookPage, NoteFolder 타입 | `src/types/` |

### Phase 1: 다중 페이지 노트북 (2주) ★ 최우선

| 작업 | 설명 | 기존 코드 활용 |
|------|------|--------------|
| 노트북 데이터 구조 | 단일 annotations[] → notebook_pages 테이블 | `useSheetMusicNotes` 리팩토링 |
| 페이지 CRUD | 페이지 추가/삭제/복제/순서변경 | 새 훅 `useNotebookPages` |
| 페이지 네비게이션 | 하단 이전/다음/페이지번호 | **SheetMusicEditor 기존 기능 확장** |
| 페이지 이동 시 자동 저장 | 곡 전환 시 annotations 저장 | SheetMusicEditor 곡 전환 로직 참조 |
| 자동 저장 (디바운스) | 5초 간격 자동 저장 | 새로 구현 |

### Phase 2: 페이지 개요 패널 (1주)

| 작업 | 설명 | 기존 코드 활용 |
|------|------|--------------|
| 페이지 개요 UI | 좌측 슬라이드인 패널, 썸네일 그리드 | 새 컴포넌트 `PageOverviewPanel` |
| 썸네일 생성 | Canvas → toDataURL 캡처 | SheetMusicEditor Canvas 활용 |
| 썸네일 캐싱 | 변경 시에만 갱신, Supabase Storage 저장 | |
| 페이지 드래그 앤 드롭 순서 변경 | @dnd-kit 사용 | **setlist 페이지의 DnD 로직 그대로 재사용** |
| 페이지 컨텍스트 메뉴 | 길게 누르기 → 복제/삭제/내보내기 | |

### Phase 3: 파일 관리 시스템 (2주)

| 작업 | 설명 | 기존 코드 활용 |
|------|------|--------------|
| 메인 화면 리디자인 | my-page "필기 노트" 탭을 파일 관리자로 전면 개편 | my-page 구조 변경 |
| 폴더 CRUD | 생성/이름변경/이동/삭제 | 새 컴포넌트 |
| 노트북 CRUD | 생성/열기/이름변경/이동/삭제 | 기존 SheetMusicEditor 연동 |
| 폴더 네비게이션 | 폴더 진입/상위이동/경로 표시 | |
| 격자/목록 보기 전환 | grid ↔ list 토글 | |
| 정렬 | 이름/생성일/수정일 | |

### Phase 4: 용지 템플릿 & 악보 연동 (2주)

| 작업 | 설명 | 기존 코드 활용 |
|------|------|--------------|
| 오선지 템플릿 | SVG 기반 오선지 배경 렌더링 | 새 컴포넌트 `StaffPaperTemplate` |
| 코드 차트 템플릿 | 기타/피아노 코드 차트 배경 | 새 컴포넌트 |
| 악보 검색 가져오기 | songs 테이블 검색 → 악보 선택 → 페이지 배경 | **기존 곡 검색 UI 재사용** (SongSearchModal) |
| 다중 페이지 악보 분리 | PDF 악보의 각 페이지를 자동 분리하여 삽입 | SheetMusicEditor PDF 파싱 로직 재사용 |
| 템플릿 변경 | 기존 페이지의 배경을 다른 템플릿으로 변경 | |

### Phase 5: 고급 기능 (1주)

| 작업 | 설명 |
|------|------|
| 다중 선택 모드 | 체크박스 → 일괄 이동/삭제 |
| 드래그 앤 드롭 파일 이동 | 노트북을 폴더로 드래그 |
| 연속 스크롤 모드 | 세로 스크롤로 모든 페이지 이어보기 |
| 스와이프 제스처 | 좌우 스와이프로 페이지 넘기기 |
| 노트 정보 표시 | 이름, 생성일, 수정일, 페이지 수 |

### Phase 6: 마이그레이션 & 안정화 (1주)

| 작업 | 설명 |
|------|------|
| 데이터 마이그레이션 스크립트 | sheet_music_notes → notebooks 변환 |
| 콘티 연동 | 팀에서 콘티 저장 시 자동으로 notebooks에도 저장 |
| 팀별 자동 폴더 | 팀에 가입하면 해당 팀 폴더 자동 생성 |
| 성능 최적화 | Lazy loading, 썸네일 캐싱, 디바운스 저장 |

---

## 6. 기존 기능 결합 상세

### 6-1. SheetMusicEditor 확장

현재 SheetMusicEditor는 이미 다중 곡 모드(`songs` prop)를 지원합니다. 이를 "다중 페이지 노트북"으로 확장:

```
현재:  songs prop → 곡별 전환 (다중 곡 모드)
확장:  pages prop → 페이지별 전환 (노트북 모드)
```

**변경 계획:**
- `songs` prop 대신 `pages: NotebookPage[]` prop 추가
- `currentSongIndex` → `currentPageIndex`
- `allAnnotations` → 페이지별 annotations 관리 (이미 유사 구조)
- 페이지 추가/삭제 콜백 prop 추가

### 6-2. 곡 검색 → 악보 가져오기

기존 여러 곳에서 곡 검색 UI가 사용됩니다:
- `src/app/main/page.tsx` — 메인 검색
- `src/app/my-team/[id]/setlist/[setlistId]/page.tsx` — 콘티에 곡 추가
- `src/components/AISearchBar.tsx` — AI 검색

이 검색 UI를 재사용하여 "악보 가져오기" 기능 구현:

```
사용자가 "악보 가져오기" 선택
→ SongSearchModal 열림 (기존 UI 재사용)
→ 곡 선택 → song_sheets에서 악보 목록 표시
→ 악보 선택 → file_url을 페이지 배경으로 삽입
→ PDF인 경우 자동 페이지 분리
```

### 6-3. DnD 재사용

setlist 페이지에서 이미 `@dnd-kit/core` + `@dnd-kit/sortable`을 사용 중:
- 콘티 곡 순서 변경 (드래그 앤 드롭)
- SortableContext + useSortable 패턴

이 패턴을 그대로:
- 페이지 개요 패널의 페이지 순서 변경
- 파일 관리자의 노트북/폴더 이동

### 6-4. 내보내기 확장

현재 `useDownload` 훅은 전체 내보내기만 지원. 확장:
- "선택 페이지만 내보내기" 옵션 추가
- "현재 페이지만 내보내기" 옵션 추가
- 배경 포함/미포함 옵션

---

## 7. 새로 만들어야 하는 핵심 컴포넌트

| 컴포넌트 | 설명 | 예상 규모 |
|----------|------|----------|
| `NoteFileManager` | 메인 화면 파일 관리자 | ~500줄 |
| `NotebookGrid` | 격자형 노트북/폴더 목록 | ~200줄 |
| `FolderNavigation` | 폴더 경로 + 뒤로가기 | ~100줄 |
| `PageOverviewPanel` | 페이지 개요 패널 (썸네일) | ~400줄 |
| `StaffPaperTemplate` | 오선지 SVG 렌더러 | ~150줄 |
| `SongSearchModal` | 악보 검색 (기존 UI 재사용) | ~200줄 (래퍼) |
| `NotebookCreateModal` | 노트북 생성 다이얼로그 | ~300줄 |
| `useNotebooks` | 노트북 CRUD 훅 | ~200줄 |
| `useNotebookPages` | 페이지 CRUD 훅 | ~250줄 |
| `useNoteFolders` | 폴더 CRUD 훅 | ~150줄 |
| `useAutoSave` | 자동 저장 훅 (디바운스) | ~80줄 |

---

## 8. 기술적 고려사항

### 8-1. 성능

- **페이지 데이터 Lazy Loading**: `notebook_pages`에서 현재 페이지 + 인접 2페이지만 로드
- **썸네일 생성**: Canvas `toDataURL('image/jpeg', 0.3)` → Supabase Storage 저장
- **자동 저장 디바운스**: 마지막 입력 후 5초, `useCallback` + `setTimeout` 패턴
- **IndexedDB 캐시**: 오프라인 접근을 위한 로컬 캐시 (Phase 5+)

### 8-2. iOS Safari 호환성

- 터치 영역 44px+ 유지
- `font-size: 16px` 이상 (자동 줌 방지)
- `touch-action: manipulation` 적용
- 페이지 개요 패널: `position: fixed` + `overflow-y: auto` (iOS 스크롤 이슈 방지)

### 8-3. 기존 데이터 호환

- `sheet_music_notes.annotations`의 `PageAnnotation[]` 구조는 `notebook_pages.annotations`에서 그대로 사용
- `setlist_notes.note_data`의 곡별 데이터는 각 `notebook_pages` 레코드로 분리

---

## 9. 일정 요약

| Phase | 기간 | 핵심 산출물 |
|-------|------|------------|
| Phase 0 | 1주 | DB 테이블, 기본 훅, 타입 |
| Phase 1 | 2주 | 다중 페이지 노트북 (핵심) |
| Phase 2 | 1주 | 페이지 개요 패널 |
| Phase 3 | 2주 | 파일 관리 시스템 |
| Phase 4 | 2주 | 용지 템플릿 & 악보 연동 |
| Phase 5 | 1주 | 고급 기능 |
| Phase 6 | 1주 | 마이그레이션 & 안정화 |
| **합계** | **~10주** | |

---

## 10. 결론

WORSHEEP의 기존 필기 시스템은 **에디터 자체는 매우 강력**(펜, 형광펜, 올가미, 피아노/드럼 악보 등)하지만, **파일 관리와 페이지 관리가 부재**합니다. GoodNotes 기능을 통합하면:

1. **예배팀 악보 DB**(5000+ 곡)를 "악보 가져오기"로 직접 활용 → 차별화
2. **콘티 자동 연동**: 팀에서 콘티 저장 시 개인 노트북으로 자동 복제
3. **오선지/코드차트**: 빈 오선지에 직접 악보를 필기하는 연습 노트 기능
4. **체계적 관리**: 팀별 폴더, 시즌별 정리, 검색/정렬

핵심은 **Phase 1 (다중 페이지)** → **Phase 3 (파일 관리)** 순서로 구현하여, 사용자가 체감하는 가치를 빠르게 제공하는 것입니다.
