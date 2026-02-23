-- ============================================================
-- RLS 보안 수정 (2026-02-23)
-- 사이드이펙트 없는 쉬운 수정 3건
-- ============================================================

-- [1] activity_logs: 과도한 SELECT 정책 삭제
-- "Authenticated users can read activity logs" (qual=true)가
-- activity_logs_select (user_id 기반 제한)를 무력화하고 있음
-- 삭제 후 activity_logs_select + admin_activity_logs_all 정책으로 충분
DROP POLICY IF EXISTS "Authenticated users can read activity logs" ON public.activity_logs;

-- [2] songs: 중복 INSERT 정책 삭제
-- "Secure insert for authenticated users" (auth.uid() IS NOT NULL만 체크)가
-- "Authenticated users can insert own songs only" (user_id = auth.uid())를 무력화
-- → user_id 위조 가능한 보안 취약점
DROP POLICY IF EXISTS "Secure insert for authenticated users" ON public.songs;

-- [3] sheetmusic 스토리지: 무제한 전체 접근 정책 삭제 + 적절한 정책 추가
-- "Allow all operations on sheetmusic" (인증 없이 모든 조작 허용) 삭제
DROP POLICY IF EXISTS "Allow all operations on sheetmusic" ON storage.objects;

-- anon 전용 jpg 정책들도 삭제 (위 정책에 의해 이미 무의미했음)
DROP POLICY IF EXISTS "Allow all operations 18agap2_0" ON storage.objects;
DROP POLICY IF EXISTS "Allow all operations 18agap2_1" ON storage.objects;
DROP POLICY IF EXISTS "Allow all operations 18agap2_2" ON storage.objects;
DROP POLICY IF EXISTS "Allow all operations 18agap2_3" ON storage.objects;

-- sheetmusic 버킷: 읽기는 누구나 (public bucket이므로 URL 직접 접근 유지)
-- SELECT 정책 추가 (PostgREST/API 통한 list 등에 필요)
CREATE POLICY "sheetmusic_select_public"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'sheetmusic');

-- sheetmusic 버킷: 업로드는 인증 사용자만
CREATE POLICY "sheetmusic_insert_authenticated"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'sheetmusic');

-- sheetmusic 버킷: 수정은 인증 사용자만
CREATE POLICY "sheetmusic_update_authenticated"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'sheetmusic')
WITH CHECK (bucket_id = 'sheetmusic');

-- sheetmusic 버킷: 삭제는 관리자만
CREATE POLICY "sheetmusic_delete_admin"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'sheetmusic'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.is_admin = true
  )
);

-- sheetmusic 버킷: 파일 크기 제한 (50MB) 및 MIME 타입 제한
UPDATE storage.buckets
SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp']
WHERE name = 'sheetmusic';
