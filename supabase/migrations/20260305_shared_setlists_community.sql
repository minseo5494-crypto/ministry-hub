-- ============================================================
-- 콘티 커뮤니티 기능 (2026-03-05)
-- shared_setlists + likes + comments + bookmarks + reports
-- ============================================================

-- ===== 1. shared_setlists (공유 콘티) =====
CREATE TABLE IF NOT EXISTS shared_setlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 원본 참조 (FK 제약 없음 - 원본 삭제/수정에 독립적)
  source_setlist_id UUID NOT NULL,
  source_team_id UUID NOT NULL,

  -- 공유 정보
  shared_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  service_type TEXT,

  -- 곡 데이터 스냅샷 (원본 변경에 영향 안 받음)
  -- SharedSetlistSong[] 배열: { order, song_id, song_title, artist, key, selected_form, notes }
  songs JSONB NOT NULL DEFAULT '[]',
  devotional_guide TEXT,

  -- 작성자 정보 (비정규화 - 조회 성능)
  author_name TEXT NOT NULL,
  author_church TEXT,

  -- 통계 (비정규화 - 트리거로 동기화)
  like_count INTEGER DEFAULT 0 NOT NULL,
  comment_count INTEGER DEFAULT 0 NOT NULL,
  bookmark_count INTEGER DEFAULT 0 NOT NULL,
  copy_count INTEGER DEFAULT 0 NOT NULL,

  -- 상태
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'reported')),

  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_shared_setlists_shared_by ON shared_setlists(shared_by);
CREATE INDEX IF NOT EXISTS idx_shared_setlists_created_at ON shared_setlists(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_setlists_like_count ON shared_setlists(like_count DESC);
CREATE INDEX IF NOT EXISTS idx_shared_setlists_tags ON shared_setlists USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_shared_setlists_status ON shared_setlists(status) WHERE status = 'active';

-- ===== 2. shared_setlist_likes (좋아요) =====
CREATE TABLE IF NOT EXISTS shared_setlist_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_setlist_id UUID NOT NULL REFERENCES shared_setlists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  UNIQUE(shared_setlist_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_shared_setlist_likes_setlist ON shared_setlist_likes(shared_setlist_id);
CREATE INDEX IF NOT EXISTS idx_shared_setlist_likes_user ON shared_setlist_likes(user_id);

-- ===== 3. shared_setlist_comments (댓글) =====
CREATE TABLE IF NOT EXISTS shared_setlist_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_setlist_id UUID NOT NULL REFERENCES shared_setlists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) <= 500),

  -- 작성자 정보 (비정규화)
  author_name TEXT NOT NULL,
  author_church TEXT,

  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shared_setlist_comments_setlist ON shared_setlist_comments(shared_setlist_id);
CREATE INDEX IF NOT EXISTS idx_shared_setlist_comments_user ON shared_setlist_comments(user_id);

-- ===== 4. shared_setlist_bookmarks (북마크/저장) =====
CREATE TABLE IF NOT EXISTS shared_setlist_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_setlist_id UUID NOT NULL REFERENCES shared_setlists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  UNIQUE(shared_setlist_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_shared_setlist_bookmarks_setlist ON shared_setlist_bookmarks(shared_setlist_id);
CREATE INDEX IF NOT EXISTS idx_shared_setlist_bookmarks_user ON shared_setlist_bookmarks(user_id);

-- ===== 5. shared_setlist_reports (신고) =====
CREATE TABLE IF NOT EXISTS shared_setlist_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_setlist_id UUID NOT NULL REFERENCES shared_setlists(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (char_length(reason) <= 500),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  UNIQUE(shared_setlist_id, reporter_id)  -- 중복 신고 방지
);

-- ===== 6. 카운트 동기화 트리거 =====

-- 좋아요 카운트 트리거 함수
CREATE OR REPLACE FUNCTION update_shared_setlist_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE shared_setlists SET like_count = like_count + 1, updated_at = now()
    WHERE id = NEW.shared_setlist_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE shared_setlists SET like_count = GREATEST(like_count - 1, 0), updated_at = now()
    WHERE id = OLD.shared_setlist_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_like_count ON shared_setlist_likes;
CREATE TRIGGER trigger_update_like_count
  AFTER INSERT OR DELETE ON shared_setlist_likes
  FOR EACH ROW EXECUTE FUNCTION update_shared_setlist_like_count();

-- 댓글 카운트 트리거 함수
CREATE OR REPLACE FUNCTION update_shared_setlist_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE shared_setlists SET comment_count = comment_count + 1, updated_at = now()
    WHERE id = NEW.shared_setlist_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE shared_setlists SET comment_count = GREATEST(comment_count - 1, 0), updated_at = now()
    WHERE id = OLD.shared_setlist_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_comment_count ON shared_setlist_comments;
CREATE TRIGGER trigger_update_comment_count
  AFTER INSERT OR DELETE ON shared_setlist_comments
  FOR EACH ROW EXECUTE FUNCTION update_shared_setlist_comment_count();

-- 북마크 카운트 트리거 함수
CREATE OR REPLACE FUNCTION update_shared_setlist_bookmark_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE shared_setlists SET bookmark_count = bookmark_count + 1, updated_at = now()
    WHERE id = NEW.shared_setlist_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE shared_setlists SET bookmark_count = GREATEST(bookmark_count - 1, 0), updated_at = now()
    WHERE id = OLD.shared_setlist_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_bookmark_count ON shared_setlist_bookmarks;
CREATE TRIGGER trigger_update_bookmark_count
  AFTER INSERT OR DELETE ON shared_setlist_bookmarks
  FOR EACH ROW EXECUTE FUNCTION update_shared_setlist_bookmark_count();

-- ===== 7. RLS 정책 =====

-- shared_setlists
ALTER TABLE shared_setlists ENABLE ROW LEVEL SECURITY;

-- 로그인 사용자만 active 콘티 조회 가능 (본인 콘티는 status 무관하게 조회)
DROP POLICY IF EXISTS "shared_setlists_select" ON shared_setlists;
CREATE POLICY "shared_setlists_select" ON shared_setlists
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (status = 'active' OR shared_by = auth.uid())
  );

-- 로그인 사용자만 공유 가능
DROP POLICY IF EXISTS "shared_setlists_insert" ON shared_setlists;
CREATE POLICY "shared_setlists_insert" ON shared_setlists
  FOR INSERT WITH CHECK (shared_by = auth.uid());

-- 본인만 수정 가능
DROP POLICY IF EXISTS "shared_setlists_update" ON shared_setlists;
CREATE POLICY "shared_setlists_update" ON shared_setlists
  FOR UPDATE USING (shared_by = auth.uid());

-- 본인 또는 관리자만 삭제 가능
DROP POLICY IF EXISTS "shared_setlists_delete" ON shared_setlists;
CREATE POLICY "shared_setlists_delete" ON shared_setlists
  FOR DELETE USING (
    shared_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.is_admin = true
    )
  );

-- shared_setlist_likes
ALTER TABLE shared_setlist_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "likes_select" ON shared_setlist_likes;
CREATE POLICY "likes_select" ON shared_setlist_likes
  FOR SELECT USING (user_id = auth.uid());  -- 본인 좋아요만 조회 (좋아요 수는 shared_setlists.like_count로 확인)

DROP POLICY IF EXISTS "likes_insert" ON shared_setlist_likes;
CREATE POLICY "likes_insert" ON shared_setlist_likes
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "likes_delete" ON shared_setlist_likes;
CREATE POLICY "likes_delete" ON shared_setlist_likes
  FOR DELETE USING (user_id = auth.uid());

-- shared_setlist_comments
ALTER TABLE shared_setlist_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comments_select" ON shared_setlist_comments;
CREATE POLICY "comments_select" ON shared_setlist_comments
  FOR SELECT USING (true);  -- 누구나 댓글 조회

DROP POLICY IF EXISTS "comments_insert" ON shared_setlist_comments;
CREATE POLICY "comments_insert" ON shared_setlist_comments
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "comments_update" ON shared_setlist_comments;
CREATE POLICY "comments_update" ON shared_setlist_comments
  FOR UPDATE USING (user_id = auth.uid());  -- 본인만 수정

DROP POLICY IF EXISTS "comments_delete" ON shared_setlist_comments;
CREATE POLICY "comments_delete" ON shared_setlist_comments
  FOR DELETE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.is_admin = true
    )
  );

-- shared_setlist_bookmarks
ALTER TABLE shared_setlist_bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bookmarks_select" ON shared_setlist_bookmarks;
CREATE POLICY "bookmarks_select" ON shared_setlist_bookmarks
  FOR SELECT USING (user_id = auth.uid());  -- 본인 북마크만 조회

DROP POLICY IF EXISTS "bookmarks_insert" ON shared_setlist_bookmarks;
CREATE POLICY "bookmarks_insert" ON shared_setlist_bookmarks
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "bookmarks_delete" ON shared_setlist_bookmarks;
CREATE POLICY "bookmarks_delete" ON shared_setlist_bookmarks
  FOR DELETE USING (user_id = auth.uid());

-- shared_setlist_reports
ALTER TABLE shared_setlist_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_insert" ON shared_setlist_reports;
CREATE POLICY "reports_insert" ON shared_setlist_reports
  FOR INSERT WITH CHECK (reporter_id = auth.uid());

-- 관리자만 신고 조회 (admin 페이지용)
DROP POLICY IF EXISTS "reports_select_admin" ON shared_setlist_reports;
CREATE POLICY "reports_select_admin" ON shared_setlist_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.is_admin = true
    )
  );

-- 관리자만 신고 상태 업데이트
DROP POLICY IF EXISTS "reports_update_admin" ON shared_setlist_reports;
CREATE POLICY "reports_update_admin" ON shared_setlist_reports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.is_admin = true
    )
  );

-- ===== 8. updated_at 자동 갱신 트리거 =====

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_shared_setlists_updated_at ON shared_setlists;
CREATE TRIGGER trigger_shared_setlists_updated_at
  BEFORE UPDATE ON shared_setlists
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trigger_shared_setlist_comments_updated_at ON shared_setlist_comments;
CREATE TRIGGER trigger_shared_setlist_comments_updated_at
  BEFORE UPDATE ON shared_setlist_comments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
