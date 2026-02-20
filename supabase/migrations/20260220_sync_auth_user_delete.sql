-- auth.users 삭제 시 public.users도 자동 삭제하는 트리거
-- 원인: auth.users에서 사용자 삭제 시 public.users에 고아 레코드가 남는 문제 방지

CREATE OR REPLACE FUNCTION public.handle_auth_user_deleted()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- auth.users DELETE 시 트리거 실행
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
  AFTER DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_deleted();
