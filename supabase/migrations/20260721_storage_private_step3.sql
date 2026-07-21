-- 20260721_storage_private_step3.sql
-- Storage 파일 접근 프록시 3단계: 버킷 private 전환 + public 읽기 정책 삭제
--
-- ⚠️ 적용 전 필수 조건:
--   1) 프록시 코드(/api/files + toProxyUrl)가 **프로덕션에 배포**돼 있어야 함.
--      (미배포 상태로 적용하면 프로덕션 악보가 전부 안 열림)
--   2) 프로덕션 브라우저에서 파일 요청이 /api/files → 302 → 200 으로 도는지 확인 완료.
--   3) 코드 변경 동반: src/lib/fileUrl.ts 의 "토큰 미로드 시 public fallback" 제거
--      (버킷이 private면 원본 URL은 어차피 안 열리므로 fallback 무의미 + 토큰 항상 필요).
--
-- 적용 후: 원본 public URL(.../object/public/...)은 죽고, 파일은 오직 프록시가 발급한
--          60초 서명 URL로만 접근 가능(세션+팀 권한 통과 필요).

-- 1) 버킷 private 전환
update storage.buckets set public = false where id in ('sheetmusic', 'song-sheets');

-- 2) public 읽기 정책 삭제 (sheetmusic 버킷의 공개 SELECT)
drop policy if exists "sheetmusic_select_public" on storage.objects;

-- 참고: song-sheets 버킷은 storage.objects RLS 정책이 없음(버킷 public에만 의존).
-- private 전환 시 authenticated 클라이언트의 직접 SELECT도 막히지만, 서명 URL 발급은
-- 프록시가 service_role 로 수행하므로 별도 SELECT 정책 불필요.

-- ============================================================
-- 롤백 (문제 시 즉시 복구 — 프로덕션 악보 다시 열림)
-- ============================================================
-- update storage.buckets set public = true where id in ('sheetmusic', 'song-sheets');
-- create policy "sheetmusic_select_public" on storage.objects
--   for select to public using (bucket_id = 'sheetmusic');
-- (그리고 src/lib/fileUrl.ts 의 fallback 복원 or 코드 revert)
