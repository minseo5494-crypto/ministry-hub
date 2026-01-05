-- sheet_music_notes 테이블의 id, song_id 타입을 TEXT로 변경
-- 클라이언트에서 생성하는 UUID 문자열과 다양한 song_id 형식 지원

-- 1. searchable_notes view 삭제 (id 컬럼 참조)
DROP VIEW IF EXISTS searchable_notes;

-- 2. id 타입을 TEXT로 변경
ALTER TABLE sheet_music_notes
  ALTER COLUMN id TYPE TEXT USING id::TEXT;

-- 3. song_id 타입을 TEXT로 변경
ALTER TABLE sheet_music_notes
  ALTER COLUMN song_id TYPE TEXT USING song_id::TEXT;

-- 4. searchable_notes view 재생성
CREATE OR REPLACE VIEW searchable_notes AS
SELECT
  n.id,
  n.user_id,
  n.song_id,
  n.song_name,
  n.team_name,
  n.file_url,
  n.file_type,
  n.title,
  n.song_form_enabled,
  n.created_at,
  n.updated_at,
  s.song_name as original_song_name,
  s.team_name as original_team_name,
  s.key,
  s.bpm,
  s.themes
FROM sheet_music_notes n
LEFT JOIN songs s ON n.song_id = s.id::text
WHERE n.song_name IS NOT NULL;
