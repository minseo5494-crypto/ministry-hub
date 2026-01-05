-- 필기노트 동기화를 위한 컬럼 추가
-- 아이패드에서 작성한 필기를 웹에서도 볼 수 있도록 필요한 컬럼들 추가

-- 1. 기본 필드 추가 (이미 존재하면 스킵)
ALTER TABLE sheet_music_notes
  ADD COLUMN IF NOT EXISTS song_name TEXT,
  ADD COLUMN IF NOT EXISTS team_name TEXT,
  ADD COLUMN IF NOT EXISTS file_url TEXT,
  ADD COLUMN IF NOT EXISTS file_type TEXT DEFAULT 'image';

-- 3. 송폼 관련 필드 추가
ALTER TABLE sheet_music_notes
  ADD COLUMN IF NOT EXISTS song_forms JSONB,
  ADD COLUMN IF NOT EXISTS song_form_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS song_form_style JSONB;

-- 4. 파트 태그 필드 추가
ALTER TABLE sheet_music_notes
  ADD COLUMN IF NOT EXISTS part_tags JSONB;

-- 5. 피아노/드럼 악보 필드 추가
ALTER TABLE sheet_music_notes
  ADD COLUMN IF NOT EXISTS piano_scores JSONB,
  ADD COLUMN IF NOT EXISTS drum_scores JSONB;

-- 인덱스 추가 (song_name으로 검색 최적화)
CREATE INDEX IF NOT EXISTS idx_sheet_music_notes_song_name ON sheet_music_notes(song_name);
