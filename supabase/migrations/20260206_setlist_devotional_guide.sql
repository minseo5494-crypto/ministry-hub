-- 콘티 인도자 묵상 가이드 컬럼 추가
ALTER TABLE team_setlists
  ADD COLUMN IF NOT EXISTS devotional_guide TEXT;
