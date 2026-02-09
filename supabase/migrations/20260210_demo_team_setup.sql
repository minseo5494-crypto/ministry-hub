-- ============================================
-- 신규 사용자 가상 팀 자동 가입을 위한 데모 팀 세팅
-- ============================================

-- 1. teams 테이블에 is_demo 컬럼 추가
ALTER TABLE teams ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;

-- 2. 가상 팀 생성 (시스템 사용자 = created_by는 NULL 허용 안되므로 첫 번째 관리자 사용)
DO $$
DECLARE
  v_admin_id uuid;
  v_team_id uuid;
  v_setlist1_id uuid;
  v_setlist2_id uuid;
BEGIN
  -- 관리자 ID 가져오기
  SELECT id INTO v_admin_id FROM users WHERE is_admin = true LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION '관리자 계정이 필요합니다';
  END IF;

  -- 이미 데모 팀이 존재하면 스킵
  IF EXISTS (SELECT 1 FROM teams WHERE is_demo = true) THEN
    RAISE NOTICE '데모 팀이 이미 존재합니다. 스킵합니다.';
    RETURN;
  END IF;

  -- 가상 팀 생성
  INSERT INTO teams (name, type, church_name, description, invite_code, created_by, is_demo)
  VALUES (
    '새소망 찬양팀',
    'church_internal',
    '새소망교회',
    '워십(WORSHEEP) 서비스 체험을 위한 데모 팀입니다.',
    'DEMO00',
    v_admin_id,
    true
  )
  RETURNING id INTO v_team_id;

  -- 콘티 1: 2월 2주 주일예배 (인기곡 3곡)
  INSERT INTO team_setlists (team_id, title, service_date, service_type, created_by)
  VALUES (
    v_team_id,
    '2월 2주 주일예배',
    '2026-02-08',
    '주일집회',
    v_admin_id
  )
  RETURNING id INTO v_setlist1_id;

  INSERT INTO team_setlist_songs (setlist_id, song_id, order_number) VALUES
    (v_setlist1_id, '4010', 1),  -- 내 모습 이대로
    (v_setlist1_id, '4620', 2),  -- 주님의 선하심
    (v_setlist1_id, '4231', 3);  -- 내 영혼이 은총 입어

  -- 콘티 2: 2월 1주 수요예배 (인기곡 3곡)
  INSERT INTO team_setlists (team_id, title, service_date, service_type, created_by)
  VALUES (
    v_team_id,
    '2월 1주 수요예배',
    '2026-02-04',
    '수요집회',
    v_admin_id
  )
  RETURNING id INTO v_setlist2_id;

  INSERT INTO team_setlist_songs (setlist_id, song_id, order_number) VALUES
    (v_setlist2_id, '4287', 1),  -- 예수 나의 첫사랑 되시네
    (v_setlist2_id, '4252', 2),  -- 멈출 수 없네
    (v_setlist2_id, '4269', 3);  -- 새 힘 얻으리

  RAISE NOTICE '데모 팀 생성 완료: team_id = %', v_team_id;
END $$;
