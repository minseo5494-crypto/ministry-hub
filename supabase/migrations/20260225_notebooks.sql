-- notebooks: 독립 필기노트 서비스 — 콘티와 분리된 개인 노트북
-- 관련 계획서: docs/내부/독립_필기노트_서비스_계획서.md (섹션 3)

CREATE TABLE IF NOT EXISTS notebooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '제목 없는 노트',

  -- 출처 추적 (콘티에서 복사된 경우)
  source_setlist_id UUID,           -- 원본 콘티 ID (없으면 직접 생성한 노트)
  source_setlist_title TEXT,        -- 원본 콘티 제목 (표시용)
  team_id UUID,                     -- 팀 ID (콘티 연동 시)

  -- 페이지 데이터 (JSONB 배열 — 각 원소가 하나의 NotebookPage)
  pages JSONB NOT NULL DEFAULT '[]',

  -- 메타
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_notebooks_user
  ON notebooks(user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notebooks_user_updated
  ON notebooks(user_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notebooks_source_setlist
  ON notebooks(user_id, source_setlist_id)
  WHERE deleted_at IS NULL;

-- RLS 활성화
ALTER TABLE notebooks ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인 노트북만 조회
CREATE POLICY "notebooks_select" ON notebooks
  FOR SELECT USING (auth.uid() = user_id);

-- INSERT: 본인 노트북만 생성 (authenticated만 가능, anon 불가)
CREATE POLICY "notebooks_insert" ON notebooks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- UPDATE: 본인 노트북만 수정 (WITH CHECK으로 user_id 변경 차단)
CREATE POLICY "notebooks_update" ON notebooks
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: 본인 노트북만 삭제
CREATE POLICY "notebooks_delete" ON notebooks
  FOR DELETE USING (auth.uid() = user_id);

-- updated_at 자동 갱신 트리거
-- update_sheet_music_notes_updated_at() 함수 재활용 (20241208_create_sheet_music_notes.sql에서 정의됨)
CREATE TRIGGER trigger_notebooks_updated_at
  BEFORE UPDATE ON notebooks
  FOR EACH ROW
  EXECUTE FUNCTION update_sheet_music_notes_updated_at();
