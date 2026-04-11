-- sheetmusic 버킷 Storage RLS 정책 — notebooks/ 경로 (Phase 4 보안)
-- 일반 사용자가 본인의 notebooks/ 파일만 업로드/삭제 가능

-- ============================================================
-- Phase 6 보안 수정: sheetmusic_insert_authenticated에서
-- notebooks/ 경로 분리 — 경로별 정책 격리 적용
-- ============================================================

-- 기존 전체 허용 정책 제거
DROP POLICY IF EXISTS "sheetmusic_insert_authenticated" ON storage.objects;

-- 일반 업로드 정책 재생성: notebooks/ 경로 제외
-- (notebooks/ 경로는 아래 notebooks_storage_insert 정책만 적용)
CREATE POLICY "sheetmusic_insert_general"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'sheetmusic'
  AND (storage.foldername(name))[1] != 'notebooks'
);

-- INSERT (업로드): notebooks/{auth.uid()}/... 경로만 허용
CREATE POLICY "notebooks_storage_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'sheetmusic'
  AND (storage.foldername(name))[1] = 'notebooks'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- DELETE (삭제): notebooks/{auth.uid()}/... 경로만 허용
CREATE POLICY "notebooks_storage_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'sheetmusic'
  AND (storage.foldername(name))[1] = 'notebooks'
  AND (storage.foldername(name))[2] = auth.uid()::text
);
