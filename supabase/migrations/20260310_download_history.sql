-- download_history 테이블: 사용자별 다운로드 내역 저장
CREATE TABLE IF NOT EXISTS download_history (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  format     TEXT NOT NULL CHECK (format IN ('pdf', 'ppt', 'image')),
  songs      JSONB NOT NULL DEFAULT '[]',
  options    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인덱스: 사용자별 최신순 조회
CREATE INDEX IF NOT EXISTS download_history_user_id_created_at_idx
  ON download_history (user_id, created_at DESC);

-- RLS 활성화
ALTER TABLE download_history ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인 기록만 조회
CREATE POLICY "download_history_select_own"
  ON download_history
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- INSERT: 본인 기록만 추가
CREATE POLICY "download_history_insert_own"
  ON download_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- DELETE: 본인 기록만 삭제
CREATE POLICY "download_history_delete_own"
  ON download_history
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
