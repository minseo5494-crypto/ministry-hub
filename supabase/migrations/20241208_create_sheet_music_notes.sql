-- 악보 필기 노트 테이블 생성
-- Supabase SQL Editor에서 실행하세요

CREATE TABLE IF NOT EXISTS sheet_music_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id UUID NOT NULL,
  title TEXT NOT NULL,
  annotations JSONB NOT NULL DEFAULT '[]',
  thumbnail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_sheet_music_notes_user_id ON sheet_music_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_sheet_music_notes_song_id ON sheet_music_notes(song_id);
CREATE INDEX IF NOT EXISTS idx_sheet_music_notes_updated_at ON sheet_music_notes(updated_at DESC);

-- RLS (Row Level Security) 정책
ALTER TABLE sheet_music_notes ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 노트만 조회/수정/삭제 가능
CREATE POLICY "Users can view their own notes"
  ON sheet_music_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notes"
  ON sheet_music_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes"
  ON sheet_music_notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes"
  ON sheet_music_notes FOR DELETE
  USING (auth.uid() = user_id);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_sheet_music_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_sheet_music_notes_updated_at
  BEFORE UPDATE ON sheet_music_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_sheet_music_notes_updated_at();
