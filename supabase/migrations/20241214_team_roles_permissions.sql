-- 팀 권한 관리 시스템
-- 1. 팀별 커스텀 직책 테이블
-- 2. 직책별 권한 설정

-- ===== 1. team_roles 테이블 (팀별 커스텀 직책) =====
CREATE TABLE IF NOT EXISTS team_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,  -- 직책 이름 (예: 인도자, 세션팀장, 싱어팀장, 팀원)
  description TEXT,  -- 직책 설명
  is_default BOOLEAN DEFAULT false,  -- 기본 직책 여부 (새 멤버에게 자동 부여)
  is_leader BOOLEAN DEFAULT false,  -- 인도자(팀장) 직책 여부 (모든 권한)
  sort_order INT DEFAULT 0,  -- 정렬 순서
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(team_id, name)
);

-- ===== 2. role_permissions 테이블 (직책별 권한 설정) =====
-- 권한 종류:
-- - view_setlist: 콘티 보기
-- - create_setlist: 새 콘티 만들기
-- - edit_setlist: 콘티 편집
-- - delete_setlist: 콘티 삭제
-- - copy_setlist: 콘티 복사
-- - view_sheet: 악보 뷰어
-- - download_sheet: 악보 다운로드
-- - add_fixed_song: 고정곡 추가
-- - edit_fixed_song: 고정곡 편집
-- - delete_fixed_song: 고정곡 삭제
-- - manage_members: 팀원 관리 (초대, 역할 변경)
-- - manage_roles: 직책/권한 설정
-- - edit_team_settings: 팀 설정 변경

CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  role_id UUID NOT NULL REFERENCES team_roles(id) ON DELETE CASCADE,
  permission VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(role_id, permission)
);

-- ===== 3. team_members 테이블에 role_id 컬럼 추가 =====
ALTER TABLE team_members
ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES team_roles(id) ON DELETE SET NULL;

-- ===== 4. 인덱스 추가 =====
CREATE INDEX IF NOT EXISTS idx_team_roles_team_id ON team_roles(team_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_team_members_role_id ON team_members(role_id);

-- ===== 5. 기본 직책 생성 함수 =====
-- 팀 생성 시 자동으로 기본 직책들을 생성하는 함수
CREATE OR REPLACE FUNCTION create_default_team_roles()
RETURNS TRIGGER AS $$
DECLARE
  leader_role_id UUID;
  sub_leader_role_id UUID;
  member_role_id UUID;
BEGIN
  -- 인도자 직책 생성 (모든 권한)
  INSERT INTO team_roles (team_id, name, description, is_default, is_leader, sort_order)
  VALUES (NEW.id, '인도자', '팀의 모든 권한을 가진 리더', false, true, 1)
  RETURNING id INTO leader_role_id;

  -- 인도자 권한 설정 (모든 권한)
  INSERT INTO role_permissions (role_id, permission) VALUES
    (leader_role_id, 'view_setlist'),
    (leader_role_id, 'create_setlist'),
    (leader_role_id, 'edit_setlist'),
    (leader_role_id, 'delete_setlist'),
    (leader_role_id, 'copy_setlist'),
    (leader_role_id, 'view_sheet'),
    (leader_role_id, 'download_sheet'),
    (leader_role_id, 'add_fixed_song'),
    (leader_role_id, 'edit_fixed_song'),
    (leader_role_id, 'delete_fixed_song'),
    (leader_role_id, 'manage_members'),
    (leader_role_id, 'manage_roles'),
    (leader_role_id, 'edit_team_settings');

  -- 부리더 직책 생성 (팀장과 유사한 권한, 권한 관리 제외)
  INSERT INTO team_roles (team_id, name, description, is_default, is_leader, sort_order)
  VALUES (NEW.id, '부리더', '콘티 및 고정곡 관리 권한', false, false, 2)
  RETURNING id INTO sub_leader_role_id;

  -- 부리더 권한 설정
  INSERT INTO role_permissions (role_id, permission) VALUES
    (sub_leader_role_id, 'view_setlist'),
    (sub_leader_role_id, 'create_setlist'),
    (sub_leader_role_id, 'edit_setlist'),
    (sub_leader_role_id, 'delete_setlist'),
    (sub_leader_role_id, 'copy_setlist'),
    (sub_leader_role_id, 'view_sheet'),
    (sub_leader_role_id, 'download_sheet'),
    (sub_leader_role_id, 'add_fixed_song'),
    (sub_leader_role_id, 'edit_fixed_song'),
    (sub_leader_role_id, 'delete_fixed_song');

  -- 팀원 직책 생성 (기본 권한만)
  INSERT INTO team_roles (team_id, name, description, is_default, is_leader, sort_order)
  VALUES (NEW.id, '팀원', '기본 팀원 권한', true, false, 10)
  RETURNING id INTO member_role_id;

  -- 팀원 권한 설정 (제한된 권한)
  INSERT INTO role_permissions (role_id, permission) VALUES
    (member_role_id, 'view_setlist'),
    (member_role_id, 'copy_setlist'),
    (member_role_id, 'view_sheet'),
    (member_role_id, 'download_sheet');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===== 6. 트리거 설정 =====
DROP TRIGGER IF EXISTS trigger_create_default_team_roles ON teams;
CREATE TRIGGER trigger_create_default_team_roles
  AFTER INSERT ON teams
  FOR EACH ROW
  EXECUTE FUNCTION create_default_team_roles();

-- ===== 7. 팀장(생성자)에게 인도자 역할 자동 부여 함수 =====
CREATE OR REPLACE FUNCTION assign_leader_role_to_creator()
RETURNS TRIGGER AS $$
DECLARE
  leader_role_id UUID;
BEGIN
  -- 팀의 인도자 직책 찾기
  SELECT id INTO leader_role_id
  FROM team_roles
  WHERE team_id = NEW.team_id AND is_leader = true
  LIMIT 1;

  -- 팀 생성자인 경우 인도자 직책 부여
  IF leader_role_id IS NOT NULL THEN
    -- 팀의 created_by와 현재 추가되는 멤버의 user_id가 같은 경우
    IF EXISTS (SELECT 1 FROM teams WHERE id = NEW.team_id AND created_by = NEW.user_id) THEN
      NEW.role_id := leader_role_id;
    ELSE
      -- 일반 멤버인 경우 기본 직책 부여
      SELECT id INTO leader_role_id
      FROM team_roles
      WHERE team_id = NEW.team_id AND is_default = true
      LIMIT 1;
      IF leader_role_id IS NOT NULL THEN
        NEW.role_id := leader_role_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 팀원 추가 시 자동 역할 부여 트리거
DROP TRIGGER IF EXISTS trigger_assign_role_to_member ON team_members;
CREATE TRIGGER trigger_assign_role_to_member
  BEFORE INSERT ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION assign_leader_role_to_creator();

-- ===== 8. 기존 팀에 기본 직책 생성 (한 번만 실행) =====
-- 기존 팀에 직책이 없는 경우에만 생성
DO $$
DECLARE
  team_record RECORD;
  leader_role_id UUID;
  sub_leader_role_id UUID;
  member_role_id UUID;
BEGIN
  FOR team_record IN SELECT id, created_by FROM teams LOOP
    -- 이미 직책이 있는지 확인
    IF NOT EXISTS (SELECT 1 FROM team_roles WHERE team_id = team_record.id) THEN
      -- 인도자 직책
      INSERT INTO team_roles (team_id, name, description, is_default, is_leader, sort_order)
      VALUES (team_record.id, '인도자', '팀의 모든 권한을 가진 리더', false, true, 1)
      RETURNING id INTO leader_role_id;

      INSERT INTO role_permissions (role_id, permission) VALUES
        (leader_role_id, 'view_setlist'),
        (leader_role_id, 'create_setlist'),
        (leader_role_id, 'edit_setlist'),
        (leader_role_id, 'delete_setlist'),
        (leader_role_id, 'copy_setlist'),
        (leader_role_id, 'view_sheet'),
        (leader_role_id, 'download_sheet'),
        (leader_role_id, 'add_fixed_song'),
        (leader_role_id, 'edit_fixed_song'),
        (leader_role_id, 'delete_fixed_song'),
        (leader_role_id, 'manage_members'),
        (leader_role_id, 'manage_roles'),
        (leader_role_id, 'edit_team_settings');

      -- 부리더 직책
      INSERT INTO team_roles (team_id, name, description, is_default, is_leader, sort_order)
      VALUES (team_record.id, '부리더', '콘티 및 고정곡 관리 권한', false, false, 2)
      RETURNING id INTO sub_leader_role_id;

      INSERT INTO role_permissions (role_id, permission) VALUES
        (sub_leader_role_id, 'view_setlist'),
        (sub_leader_role_id, 'create_setlist'),
        (sub_leader_role_id, 'edit_setlist'),
        (sub_leader_role_id, 'delete_setlist'),
        (sub_leader_role_id, 'copy_setlist'),
        (sub_leader_role_id, 'view_sheet'),
        (sub_leader_role_id, 'download_sheet'),
        (sub_leader_role_id, 'add_fixed_song'),
        (sub_leader_role_id, 'edit_fixed_song'),
        (sub_leader_role_id, 'delete_fixed_song');

      -- 팀원 직책
      INSERT INTO team_roles (team_id, name, description, is_default, is_leader, sort_order)
      VALUES (team_record.id, '팀원', '기본 팀원 권한', true, false, 10)
      RETURNING id INTO member_role_id;

      INSERT INTO role_permissions (role_id, permission) VALUES
        (member_role_id, 'view_setlist'),
        (member_role_id, 'copy_setlist'),
        (member_role_id, 'view_sheet'),
        (member_role_id, 'download_sheet');

      -- 팀 생성자에게 인도자 역할 부여
      UPDATE team_members
      SET role_id = leader_role_id
      WHERE team_id = team_record.id AND user_id = team_record.created_by;

      -- 나머지 멤버에게 팀원 역할 부여
      UPDATE team_members
      SET role_id = member_role_id
      WHERE team_id = team_record.id AND role_id IS NULL;
    END IF;
  END LOOP;
END $$;

-- ===== 9. RLS 정책 =====
ALTER TABLE team_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- team_roles 정책
DROP POLICY IF EXISTS "team_roles_select" ON team_roles;
CREATE POLICY "team_roles_select" ON team_roles
  FOR SELECT USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "team_roles_insert" ON team_roles;
CREATE POLICY "team_roles_insert" ON team_roles
  FOR INSERT WITH CHECK (
    team_id IN (
      SELECT tm.team_id FROM team_members tm
      JOIN team_roles tr ON tm.role_id = tr.id
      JOIN role_permissions rp ON tr.id = rp.role_id
      WHERE tm.user_id = auth.uid() AND rp.permission = 'manage_roles'
    )
  );

DROP POLICY IF EXISTS "team_roles_update" ON team_roles;
CREATE POLICY "team_roles_update" ON team_roles
  FOR UPDATE USING (
    team_id IN (
      SELECT tm.team_id FROM team_members tm
      JOIN team_roles tr ON tm.role_id = tr.id
      JOIN role_permissions rp ON tr.id = rp.role_id
      WHERE tm.user_id = auth.uid() AND rp.permission = 'manage_roles'
    )
  );

DROP POLICY IF EXISTS "team_roles_delete" ON team_roles;
CREATE POLICY "team_roles_delete" ON team_roles
  FOR DELETE USING (
    team_id IN (
      SELECT tm.team_id FROM team_members tm
      JOIN team_roles tr ON tm.role_id = tr.id
      JOIN role_permissions rp ON tr.id = rp.role_id
      WHERE tm.user_id = auth.uid() AND rp.permission = 'manage_roles'
    )
    AND is_leader = false  -- 인도자 직책은 삭제 불가
    AND is_default = false  -- 기본 직책은 삭제 불가
  );

-- role_permissions 정책
DROP POLICY IF EXISTS "role_permissions_select" ON role_permissions;
CREATE POLICY "role_permissions_select" ON role_permissions
  FOR SELECT USING (
    role_id IN (
      SELECT id FROM team_roles WHERE team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "role_permissions_all" ON role_permissions;
CREATE POLICY "role_permissions_all" ON role_permissions
  FOR ALL USING (
    role_id IN (
      SELECT tr.id FROM team_roles tr
      WHERE tr.team_id IN (
        SELECT tm.team_id FROM team_members tm
        JOIN team_roles tr2 ON tm.role_id = tr2.id
        JOIN role_permissions rp ON tr2.id = rp.role_id
        WHERE tm.user_id = auth.uid() AND rp.permission = 'manage_roles'
      )
    )
  );

-- 코멘트 추가
COMMENT ON TABLE team_roles IS '팀별 커스텀 직책 테이블';
COMMENT ON TABLE role_permissions IS '직책별 권한 설정 테이블';
COMMENT ON COLUMN team_members.role_id IS '팀원의 직책 ID';
