-- 콘티 묵상 나눔 테이블
CREATE TABLE setlist_devotionals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setlist_id UUID NOT NULL REFERENCES team_setlists(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스: 세트리스트별 시간순 조회 최적화
CREATE INDEX idx_setlist_devotionals_setlist_created
  ON setlist_devotionals(setlist_id, created_at DESC);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_setlist_devotionals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_setlist_devotionals_updated_at
  BEFORE UPDATE ON setlist_devotionals
  FOR EACH ROW
  EXECUTE FUNCTION update_setlist_devotionals_updated_at();

-- RLS 활성화
ALTER TABLE setlist_devotionals ENABLE ROW LEVEL SECURITY;

-- 조회: 같은 팀의 active 멤버만
CREATE POLICY "Team members can view devotionals"
  ON setlist_devotionals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = setlist_devotionals.team_id
        AND team_members.user_id = auth.uid()
        AND team_members.status = 'active'
    )
  );

-- 작성: 같은 팀의 active 멤버만
CREATE POLICY "Team members can insert devotionals"
  ON setlist_devotionals FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = setlist_devotionals.team_id
        AND team_members.user_id = auth.uid()
        AND team_members.status = 'active'
    )
  );

-- 삭제: 본인 글만
CREATE POLICY "Users can delete own devotionals"
  ON setlist_devotionals FOR DELETE
  USING (auth.uid() = user_id);
