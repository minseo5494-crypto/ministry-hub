-- 필기 노트 Soft Delete 지원
-- 다중 기기 동기화 시 삭제가 전파되도록 deleted_at 컬럼 추가

-- 1. deleted_at 컬럼 추가
ALTER TABLE sheet_music_notes
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 2. deleted_at 인덱스 추가 (조회 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_sheet_music_notes_deleted_at
  ON sheet_music_notes(deleted_at);

-- 3. 복합 인덱스 추가 (user_id + deleted_at 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_sheet_music_notes_user_deleted
  ON sheet_music_notes(user_id, deleted_at);
