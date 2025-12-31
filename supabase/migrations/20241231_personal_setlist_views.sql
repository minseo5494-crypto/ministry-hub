-- 개인 콘티 뷰 & 필기 노트 검색 기능
-- Supabase SQL Editor에서 실행하세요

-- =============================================
-- 1. sheet_music_notes 테이블 확장
-- =============================================

-- 곡 메타데이터 추가 (검색용)
ALTER TABLE sheet_music_notes
ADD COLUMN IF NOT EXISTS song_name TEXT,
ADD COLUMN IF NOT EXISTS team_name TEXT,
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS file_type TEXT DEFAULT 'image';

-- 송폼 및 파트 태그 저장
ALTER TABLE sheet_music_notes
ADD COLUMN IF NOT EXISTS song_forms JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS song_form_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS song_form_style JSONB,
ADD COLUMN IF NOT EXISTS part_tags JSONB DEFAULT '[]';

-- 피아노/드럼 악보 저장
ALTER TABLE sheet_music_notes
ADD COLUMN IF NOT EXISTS piano_scores JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS drum_scores JSONB DEFAULT '[]';

-- 검색용 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_sheet_music_notes_song_name
  ON sheet_music_notes USING gin (to_tsvector('simple', coalesce(song_name, '')));

CREATE INDEX IF NOT EXISTS idx_sheet_music_notes_team_name
  ON sheet_music_notes USING gin (to_tsvector('simple', coalesce(team_name, '')));

-- =============================================
-- 2. personal_setlist_views 테이블 생성
-- =============================================

CREATE TABLE IF NOT EXISTS personal_setlist_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_setlist_id UUID NOT NULL,  -- team_setlists 테이블 참조

  -- 커스터마이징 데이터
  -- 구조: [
  --   { "type": "replace", "originalSongId": "...", "noteId": "...", "orderNumber": 1 },
  --   { "type": "insert", "afterOrder": 2, "noteId": "...", "orderNumber": 2.5 }
  -- ]
  customizations JSONB DEFAULT '[]',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 한 사용자당 하나의 콘티에 하나의 개인 뷰만 가능
  UNIQUE(user_id, team_setlist_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_personal_setlist_views_user_id
  ON personal_setlist_views(user_id);

CREATE INDEX IF NOT EXISTS idx_personal_setlist_views_team_setlist_id
  ON personal_setlist_views(team_setlist_id);

-- RLS (Row Level Security) 정책
ALTER TABLE personal_setlist_views ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 개인 뷰만 조회/수정/삭제 가능
CREATE POLICY "Users can view their own personal views"
  ON personal_setlist_views FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own personal views"
  ON personal_setlist_views FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own personal views"
  ON personal_setlist_views FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own personal views"
  ON personal_setlist_views FOR DELETE
  USING (auth.uid() = user_id);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_personal_setlist_views_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_personal_setlist_views_updated_at
  BEFORE UPDATE ON personal_setlist_views
  FOR EACH ROW
  EXECUTE FUNCTION update_personal_setlist_views_updated_at();

-- =============================================
-- 3. 뷰 생성: 필기 노트 검색용
-- =============================================

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
  -- 원본 곡 정보도 조인
  s.song_name as original_song_name,
  s.team_name as original_team_name,
  s.key,
  s.bpm,
  s.themes
FROM sheet_music_notes n
LEFT JOIN songs s ON n.song_id = s.id::uuid
WHERE n.song_name IS NOT NULL;

-- =============================================
-- 주석: 사용 예시
-- =============================================

-- 1. 필기 노트 검색 (사용자의 수정 버전 찾기)
-- SELECT * FROM searchable_notes
-- WHERE user_id = 'user-uuid'
-- AND (song_name ILIKE '%검색어%' OR team_name ILIKE '%검색어%');

-- 2. 개인 콘티 뷰 저장
-- INSERT INTO personal_setlist_views (user_id, team_setlist_id, customizations)
-- VALUES ('user-uuid', 'setlist-uuid', '[{"type":"replace","originalSongId":"...","noteId":"..."}]');

-- 3. 개인 콘티 뷰 조회
-- SELECT * FROM personal_setlist_views
-- WHERE user_id = 'user-uuid' AND team_setlist_id = 'setlist-uuid';
