-- =====================================================
-- 공식 퍼블리셔(팀) 테이블 생성
-- 마커스, 제이어스 등 공식 팀 계정 관리용
-- =====================================================

-- 1. verified_publishers 테이블 생성
CREATE TABLE IF NOT EXISTS verified_publishers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,                    -- 퍼블리셔 이름 (예: 마커스워십, 제이어스)
  description TEXT,                              -- 설명
  contact_email VARCHAR(255),                    -- 연락처 이메일
  website_url VARCHAR(500),                      -- 웹사이트 URL
  logo_url VARCHAR(500),                         -- 로고 이미지 URL
  is_active BOOLEAN DEFAULT true,                -- 활성화 상태
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 퍼블리셔 소속 계정 테이블 (퍼블리셔에 연결된 사용자 계정들)
CREATE TABLE IF NOT EXISTS publisher_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id UUID NOT NULL REFERENCES verified_publishers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),        -- 연결된 사용자 (있으면)
  email VARCHAR(255) NOT NULL,                   -- 계정 이메일
  role VARCHAR(50) DEFAULT 'member',             -- 역할: admin, member
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(publisher_id, email)
);

-- 3. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_verified_publishers_name ON verified_publishers(name);
CREATE INDEX IF NOT EXISTS idx_verified_publishers_active ON verified_publishers(is_active);
CREATE INDEX IF NOT EXISTS idx_publisher_accounts_publisher ON publisher_accounts(publisher_id);
CREATE INDEX IF NOT EXISTS idx_publisher_accounts_email ON publisher_accounts(email);
CREATE INDEX IF NOT EXISTS idx_publisher_accounts_user ON publisher_accounts(user_id);

-- 4. songs 테이블에 publisher_id 컬럼 추가 (선택적)
-- 이미 is_official 컬럼이 있으므로, 추가로 어떤 퍼블리셔의 곡인지 추적
ALTER TABLE songs ADD COLUMN IF NOT EXISTS publisher_id UUID REFERENCES verified_publishers(id);
CREATE INDEX IF NOT EXISTS idx_songs_publisher ON songs(publisher_id);

-- 5. RLS 정책 설정
ALTER TABLE verified_publishers ENABLE ROW LEVEL SECURITY;
ALTER TABLE publisher_accounts ENABLE ROW LEVEL SECURITY;

-- verified_publishers: 모든 사용자 조회 가능, 관리자만 수정
CREATE POLICY "verified_publishers_select" ON verified_publishers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "verified_publishers_insert" ON verified_publishers
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "verified_publishers_update" ON verified_publishers
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "verified_publishers_delete" ON verified_publishers
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
  );

-- publisher_accounts: 모든 사용자 조회 가능, 관리자만 수정
CREATE POLICY "publisher_accounts_select" ON publisher_accounts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "publisher_accounts_insert" ON publisher_accounts
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "publisher_accounts_update" ON publisher_accounts
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "publisher_accounts_delete" ON publisher_accounts
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
  );

-- 6. 업데이트 시간 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_verified_publishers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_verified_publishers_updated_at
  BEFORE UPDATE ON verified_publishers
  FOR EACH ROW
  EXECUTE FUNCTION update_verified_publishers_updated_at();

-- =====================================================
-- 사용 예시:
--
-- 1. 새 퍼블리셔 추가:
-- INSERT INTO verified_publishers (name, description, contact_email)
-- VALUES ('마커스워십', '마커스워십 공식 계정', 'contact@markers.com');
--
-- 2. 퍼블리셔에 계정 연결:
-- INSERT INTO publisher_accounts (publisher_id, email)
-- VALUES ('publisher-uuid', 'markers@example.com');
--
-- 3. 공식 여부 확인 쿼리:
-- SELECT EXISTS (
--   SELECT 1 FROM publisher_accounts pa
--   JOIN verified_publishers vp ON pa.publisher_id = vp.id
--   WHERE pa.email = 'user@email.com' AND vp.is_active = true
-- ) as is_verified_publisher;
-- =====================================================
