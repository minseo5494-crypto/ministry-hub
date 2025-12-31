# 개인 콘티 뷰 & 필기 노트 검색 기능 구현 계획

## 목표
1. 사용자가 수정한 필기 노트를 곡 검색에서도 찾을 수 있게 함
2. 메인 콘티는 변경하지 않고, 개인이 수정 버전을 끼워넣거나 대체할 수 있게 함

---

## Phase 1: 데이터베이스 설계 및 마이그레이션

### 1.1 필기 노트 테이블 확장 (sheet_music_notes)
현재: 로컬 스토리지 기반
변경: Supabase로 이전 + 검색 가능하도록 메타데이터 추가

```sql
-- 기존 테이블에 컬럼 추가
ALTER TABLE sheet_music_notes ADD COLUMN IF NOT EXISTS
  song_name TEXT,
  team_name TEXT,
  file_url TEXT,
  file_type TEXT,
  song_forms JSONB,
  song_form_enabled BOOLEAN DEFAULT false,
  song_form_style JSONB,
  part_tags JSONB,
  piano_scores JSONB,
  drum_scores JSONB;
```

### 1.2 개인 콘티 뷰 테이블 생성
```sql
CREATE TABLE personal_setlist_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_setlist_id UUID NOT NULL REFERENCES team_setlists(id) ON DELETE CASCADE,
  customizations JSONB DEFAULT '[]',
  -- customizations 구조:
  -- [
  --   { "type": "replace", "original_song_id": "...", "note_id": "..." },
  --   { "type": "insert", "after_order": 2, "note_id": "..." }
  -- ]
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, team_setlist_id)
);
```

---

## Phase 2: 필기 노트 검색 기능

### 2.1 로컬 → Supabase 마이그레이션
- [ ] 기존 로컬 스토리지 데이터를 Supabase로 이전하는 유틸리티 작성
- [ ] useSheetMusicNotes 훅을 Supabase 기반으로 변경 (로컬 캐시 유지)

### 2.2 메인 페이지 검색 UI 변경
- [ ] 검색 결과에 "내 수정 버전" 섹션 추가
- [ ] 필기 노트 검색 API 추가
- [ ] 검색 결과 UI에서 원본/수정본 구분 표시

### 2.3 파일 변경 목록
- `src/hooks/useSheetMusicNotes.ts` - Supabase 연동
- `src/app/page.tsx` - 검색 결과에 필기 노트 포함
- `src/lib/supabase.ts` - 타입 정의 추가

---

## Phase 3: 개인 콘티 뷰 기능

### 3.1 콘티 페이지 UI 변경
- [ ] 각 곡 옆에 "내 버전 선택" 드롭다운 추가
- [ ] "곡 끼워넣기" 버튼 추가
- [ ] 개인 뷰 저장/불러오기 로직

### 3.2 악보 뷰어 연동
- [ ] 콘티에서 악보 뷰어로 이동 시 개인 뷰 반영
- [ ] 대체된 곡은 필기 노트 버전으로 표시
- [ ] 끼워넣은 곡도 순서대로 표시

### 3.3 파일 변경 목록
- `src/app/my-team/[id]/setlist/[setlistId]/page.tsx` - 개인 뷰 UI
- `src/hooks/usePersonalSetlistView.ts` - 새로 생성
- `src/components/SheetMusicEditor.tsx` - 개인 뷰 모드 지원

---

## Phase 4: 테스트 및 마무리

### 4.1 테스트 케이스
- [ ] 필기 노트 저장 → 검색에서 찾기
- [ ] 콘티에서 곡 대체 → 악보 뷰어에서 확인
- [ ] 콘티에서 곡 끼워넣기 → 악보 뷰어에서 순서 확인
- [ ] 로컬 스토리지 → Supabase 마이그레이션

### 4.2 엣지 케이스
- [ ] 원본 곡이 삭제된 경우
- [ ] 필기 노트가 삭제된 경우
- [ ] 오프라인 상태에서의 동작

---

## 구현 순서 (권장)

1. **DB 마이그레이션 SQL 작성** ← 현재 단계
2. 필기 노트 Supabase 연동
3. 메인 페이지 검색에 필기 노트 추가
4. 개인 콘티 뷰 테이블 및 훅 생성
5. 콘티 페이지 UI 수정
6. 악보 뷰어 연동
7. 테스트 및 버그 수정

---

## 현재 진행 상황

- [x] 계획 문서 작성
- [x] Phase 1: 데이터베이스 설계 (20241231_personal_setlist_views.sql)
- [x] Phase 2: 필기 노트 검색 (useSheetMusicNotes.ts - searchNotes, syncToSupabase, syncFromSupabase 추가)
- [x] Phase 3: 개인 콘티 뷰 훅 (usePersonalSetlistView.ts 생성)
- [x] Phase 4: 콘티 페이지 UI 수정
  - 각 곡에 "내 버전" 드롭다운 추가
  - 개인화 선택 시 personal_setlist_views에 저장
- [ ] Phase 5: 악보 뷰어 연동 (추후 진행 - SheetMusicEditor 통합 필요)
- [ ] Phase 6: 테스트

## 사용 방법

1. **DB 마이그레이션 실행**
   - Supabase SQL Editor에서 `supabase/migrations/20241231_personal_setlist_views.sql` 실행

2. **콘티 페이지에서 개인화**
   - 콘티 페이지에서 각 곡 아래에 "내 버전" 드롭다운 표시
   - 해당 곡에 대한 필기 노트가 있으면 선택 가능
   - 선택하면 개인 뷰에 저장됨

3. **추후 작업**
   - 악보 뷰어에서 개인 노트 자동 적용
   - 메인 페이지 검색에 필기 노트 포함
   - 곡 끼워넣기 기능

---

## 참고: 현재 데이터 구조

### sheet_music_notes (기존)
```typescript
interface LocalSheetMusicNote {
  id: string
  user_id: string
  song_id: string
  song_name: string
  team_name?: string
  file_url: string
  file_type: 'pdf' | 'image'
  title: string
  annotations: PageAnnotation[]
  songForms?: string[]
  songFormEnabled?: boolean
  songFormStyle?: SavedSongFormStyle
  partTags?: SavedPartTagStyle[]
  pianoScores?: SavedPianoScoreElement[]
  drumScores?: SavedDrumScoreElement[]
  created_at: string
  updated_at: string
}
```

### team_setlist_songs (기존)
```typescript
interface TeamSetlistSong {
  id: string
  setlist_id: string
  song_id: string
  order_number: number
  key_transposed?: string
  notes?: string
  selected_form?: string[]
}
```
