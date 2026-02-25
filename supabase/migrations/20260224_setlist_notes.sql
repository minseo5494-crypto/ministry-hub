-- setlist_notes: 콘티(셋리스트) 단위 개인 필기 노트
CREATE TABLE IF NOT EXISTS setlist_notes (
  id TEXT DEFAULT gen_random_uuid()::TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  setlist_id UUID NOT NULL,
  note_data JSONB DEFAULT '{}',
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(user_id, setlist_id)
);

-- RLS 활성화
ALTER TABLE setlist_notes ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인 노트만 조회
CREATE POLICY "setlist_notes_select" ON setlist_notes
  FOR SELECT USING (auth.uid() = user_id);

-- INSERT: 본인 노트만 생성
CREATE POLICY "setlist_notes_insert" ON setlist_notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- UPDATE: 본인 노트만 수정
CREATE POLICY "setlist_notes_update" ON setlist_notes
  FOR UPDATE USING (auth.uid() = user_id);

-- DELETE: 본인 노트만 삭제
CREATE POLICY "setlist_notes_delete" ON setlist_notes
  FOR DELETE USING (auth.uid() = user_id);
