-- 공식 업로더 관리 시스템
-- 1. official_uploaders 테이블 (공식 업로더 이메일 목록)
-- 2. songs 테이블에 is_official 필드 추가

-- ===== 1. official_uploaders 테이블 =====
CREATE TABLE IF NOT EXISTS official_uploaders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(100),  -- 표시 이름 (선택)
  description TEXT,   -- 설명 (예: "공식 관리자", "00교회 찬양팀")
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id)  -- 누가 추가했는지
);

-- ===== 2. songs 테이블에 is_official 필드 추가 =====
ALTER TABLE songs
ADD COLUMN IF NOT EXISTS is_official BOOLEAN DEFAULT false;

-- ===== 3. 인덱스 추가 =====
CREATE INDEX IF NOT EXISTS idx_official_uploaders_email ON official_uploaders(email);
CREATE INDEX IF NOT EXISTS idx_songs_is_official ON songs(is_official);

-- ===== 4. 기본 공식 업로더 추가 =====
INSERT INTO official_uploaders (email, name, description)
VALUES ('minseo1885@naver.com', '관리자', '시스템 관리자')
ON CONFLICT (email) DO NOTHING;

-- ===== 5. 기존 관리자가 업로드한 곡들을 공식으로 마킹 =====
UPDATE songs
SET is_official = true
WHERE uploaded_by IN (
  SELECT id FROM users WHERE email = 'minseo1885@naver.com'
);
