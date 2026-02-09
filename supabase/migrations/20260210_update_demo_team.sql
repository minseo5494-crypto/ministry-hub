-- ============================================
-- 데모 팀 이름 변경 + 콘티 작성자 초기화
-- ============================================

-- 1. 데모 팀 이름/교회명 변경
UPDATE teams
SET name = 'WORSHEEP 찬양팀',
    church_name = 'WORSHEEP 교회',
    description = '워십(WORSHEEP) 서비스 체험을 위한 데모 팀입니다.'
WHERE is_demo = true;

-- 2. 데모 팀 콘티의 created_by를 NULL로 변경 (가상 인물 표시용)
UPDATE team_setlists
SET created_by = NULL
WHERE team_id IN (SELECT id FROM teams WHERE is_demo = true);
