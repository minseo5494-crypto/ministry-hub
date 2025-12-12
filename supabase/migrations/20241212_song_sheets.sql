-- =====================================================
-- Song Sheets 테이블 생성 (악보 버전 관리)
-- =====================================================

-- 1. song_sheets 테이블 생성
CREATE TABLE IF NOT EXISTS song_sheets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_type TEXT DEFAULT 'image', -- 'pdf' or 'image'
  file_hash TEXT,
  file_size BIGINT,
  label TEXT, -- 예: "원본", "E키 편곡", "간단 버전"
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  visibility TEXT DEFAULT 'public', -- 'public', 'team', 'private'
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL, -- 팀 공개일 경우
  is_primary BOOLEAN DEFAULT false,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. songs 테이블에 primary_sheet_id 컬럼 추가
ALTER TABLE songs
ADD COLUMN IF NOT EXISTS primary_sheet_id UUID REFERENCES song_sheets(id) ON DELETE SET NULL;

-- 3. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_song_sheets_song_id ON song_sheets(song_id);
CREATE INDEX IF NOT EXISTS idx_song_sheets_uploaded_by ON song_sheets(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_song_sheets_visibility ON song_sheets(visibility);
CREATE INDEX IF NOT EXISTS idx_song_sheets_is_primary ON song_sheets(is_primary);

-- 4. RLS 정책 설정
ALTER TABLE song_sheets ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 public 악보 조회 가능
CREATE POLICY "Public sheets are viewable by everyone" ON song_sheets
  FOR SELECT USING (visibility = 'public');

-- 팀 악보는 팀 멤버만 조회 가능
CREATE POLICY "Team sheets are viewable by team members" ON song_sheets
  FOR SELECT USING (
    visibility = 'team' AND
    team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
  );

-- 비공개 악보는 업로더만 조회 가능
CREATE POLICY "Private sheets are viewable by uploader" ON song_sheets
  FOR SELECT USING (
    visibility = 'private' AND uploaded_by = auth.uid()
  );

-- 인증된 사용자만 악보 업로드 가능
CREATE POLICY "Authenticated users can upload sheets" ON song_sheets
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 업로더만 자신의 악보 수정/삭제 가능
CREATE POLICY "Users can update own sheets" ON song_sheets
  FOR UPDATE USING (uploaded_by = auth.uid());

CREATE POLICY "Users can delete own sheets" ON song_sheets
  FOR DELETE USING (uploaded_by = auth.uid());

-- 5. 기존 songs.file_url 데이터를 song_sheets로 마이그레이션
INSERT INTO song_sheets (song_id, file_url, file_type, file_hash, file_size, is_primary, visibility)
SELECT
  id as song_id,
  file_url,
  COALESCE(file_type, 'image') as file_type,
  file_hash,
  file_size,
  true as is_primary,
  COALESCE(visibility, 'public') as visibility
FROM songs
WHERE file_url IS NOT NULL AND file_url != '';

-- 6. songs 테이블의 primary_sheet_id 업데이트
UPDATE songs s
SET primary_sheet_id = ss.id
FROM song_sheets ss
WHERE ss.song_id = s.id AND ss.is_primary = true;

-- 7. updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_song_sheets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER song_sheets_updated_at
  BEFORE UPDATE ON song_sheets
  FOR EACH ROW
  EXECUTE FUNCTION update_song_sheets_updated_at();
