-- 절기(seasons) 테이블 생성
CREATE TABLE IF NOT EXISTS seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 활성화
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽을 수 있도록 정책 추가
CREATE POLICY "seasons_read_policy" ON seasons
  FOR SELECT USING (true);

-- 기본 절기 데이터 삽입
INSERT INTO seasons (name, sort_order) VALUES
  ('크리스마스', 1),
  ('부활절', 2),
  ('고난주간', 3),
  ('추수감사절', 4),
  ('신년', 5),
  ('종교개혁주일', 6)
ON CONFLICT (name) DO NOTHING;
