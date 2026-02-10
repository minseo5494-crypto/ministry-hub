-- users 테이블에 약관 동의 시각 컬럼 추가
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS terms_agreed_at timestamptz;

-- 기존 사용자는 이미 동의한 것으로 처리
UPDATE public.users SET terms_agreed_at = created_at WHERE terms_agreed_at IS NULL;
