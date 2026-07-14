-- 팀 단위 공유 전환 — 1단계: 비로그인(anon) 유출 차단
--
-- 배경 (2026-07-14 라이브 실측):
--   로그인 없이 REST를 직접 호출하면 songs 1,830건 / song_sheets 1,672건이 전량 조회됨.
--   원인은 RLS 부재가 아니라, 올바른 정책(songs_select)이 PERMISSIVE 쓰레기 정책에 가려진 것.
--   PERMISSIVE 정책은 OR로 합쳐지므로 qual=true 짜리 하나가 나머지를 전부 무력화한다.
--
-- 원칙: 데이터는 한 줄도 건드리지 않는다. "누가 볼 수 있는가"만 바꾼다.
--
-- 적용 후 예상 가시성:
--   비로그인            → 0곡
--   조민서(admin)       → 1,830곡 (admin_songs_all 경로)
--   고페르 멤버(2명)    → 1,830곡 (shared_with_teams = {고페르})
--   WORSHEEP 찬양팀(9명) → 0곡  ← 의도된 결과 (대표 확인 완료)
--
-- 참고: Storage 버킷(sheetmusic, song-sheets)은 여전히 public이라 file_url 직행 다운로드가
--       가능하다. 이 구멍은 2단계(서명 URL 발급 API + 버킷 private 전환)에서 막는다.

begin;

-- ─────────────────────────────────────────────────────────────
-- 1. songs — anon 전면 차단, 팀 멤버십만 허용
-- ─────────────────────────────────────────────────────────────

-- qual=true, roles={public} → 비로그인 포함 전원에게 전곡을 열어주던 정책 (핵심 원인)
drop policy if exists "Enable read access for all users" on public.songs;

-- (auth.role()='authenticated' OR visibility='public') → 로그인만 하면 전곡을 열어주던 정책
drop policy if exists "Authenticated users can view songs" on public.songs;

-- 남은 songs_select를 "전체공개 완전 폐지" 방침에 맞춰 재작성.
--   기존: visibility='public' OR visibility IS NULL OR uploaded_by=auth.uid()
--         OR (visibility='teams' AND user_has_access_to_shared_song(shared_with_teams))
--   변경: 'public' / NULL 우회로를 제거. 업로더 본인 또는 공유된 팀의 active 멤버만.
--   (user_has_access_to_shared_song 은 team_members.status='active'를 검사하는 SECURITY DEFINER 함수)
drop policy if exists songs_select on public.songs;
create policy songs_select on public.songs
  for select to authenticated
  using (
    uploaded_by = auth.uid()
    or (visibility = 'teams' and public.user_has_access_to_shared_song(shared_with_teams))
  );

-- 신규 업로드가 실수로 전체공개로 저장되지 않도록 기본값 변경.
-- (업로드 UI에서 '전체공개' 옵션 자체를 제거하는 작업은 4단계)
alter table public.songs alter column visibility set default 'teams';


-- ─────────────────────────────────────────────────────────────
-- 2. song_sheets — 코드 미사용 + team_id 전량 NULL인 고아 테이블. 잠금.
-- ─────────────────────────────────────────────────────────────

-- visibility 기본값이 'public'이라 1,672건 전부가 이 정책으로 anon에 열려 있었다.
drop policy if exists "Public sheets are viewable by everyone" on public.song_sheets;

alter table public.song_sheets alter column visibility set default 'private';

-- 남는 SELECT 경로: 업로더 본인 / song_sheets_team_select / admin_song_sheets_all.
-- 현재 데이터는 uploaded_by·team_id가 전부 NULL이므로 사실상 관리자만 조회 가능해진다.
-- 코드에서 이 테이블을 SELECT하는 곳이 0곳이라 앱 동작에는 영향이 없다.


-- ─────────────────────────────────────────────────────────────
-- 3. shared_setlists — anon 노출 차단 + 내 팀 스코프로 축소
-- ─────────────────────────────────────────────────────────────

-- roles={public} + (status='active' OR ...) → 비로그인에게도 공유 콘티가 읽히던 정책
drop policy if exists shared_setlists_select on public.shared_setlists;
create policy shared_setlists_select on public.shared_setlists
  for select to authenticated
  using (
    shared_by = auth.uid()
    or source_team_id in (select public.get_user_team_ids())
  );

-- 댓글은 qual=true, roles={public} → 비로그인에게 전부 열려 있었다.
-- 상위 콘티를 볼 수 있는 사람만 댓글을 보도록 (하위 쿼리에 shared_setlists RLS가 그대로 적용됨)
drop policy if exists comments_select on public.shared_setlist_comments;
create policy comments_select on public.shared_setlist_comments
  for select to authenticated
  using (
    shared_setlist_id in (select id from public.shared_setlists)
  );


-- ─────────────────────────────────────────────────────────────
-- 4. song_likes — qual=true, roles={public} → 좋아요 행으로 곡 ID·유저 ID가 anon에 유출
-- ─────────────────────────────────────────────────────────────

drop policy if exists "Users can view all likes" on public.song_likes;
create policy song_likes_select on public.song_likes
  for select to authenticated
  using (true);

commit;


-- ─────────────────────────────────────────────────────────────
-- 롤백 (2026-07-14 적용 직전의 실제 배포 상태 그대로 복원)
-- ─────────────────────────────────────────────────────────────
-- begin;
--   create policy "Enable read access for all users" on public.songs
--     for select to public using (true);
--   create policy "Authenticated users can view songs" on public.songs
--     for select to public
--     using ((auth.role() = 'authenticated'::text) or (visibility = 'public'::text));
--   drop policy if exists songs_select on public.songs;
--   create policy songs_select on public.songs
--     for select to authenticated
--     using (
--       (visibility = 'public'::text) or (visibility is null)
--       or (uploaded_by = auth.uid())
--       or ((visibility = 'teams'::text) and user_has_access_to_shared_song(shared_with_teams))
--     );
--   alter table public.songs alter column visibility set default 'public';
--
--   create policy "Public sheets are viewable by everyone" on public.song_sheets
--     for select to public using (visibility = 'public'::text);
--   alter table public.song_sheets alter column visibility set default 'public';
--
--   drop policy if exists shared_setlists_select on public.shared_setlists;
--   create policy shared_setlists_select on public.shared_setlists
--     for select to public
--     using ((status = 'active'::text) or ((auth.uid() is not null) and (shared_by = auth.uid())));
--
--   drop policy if exists comments_select on public.shared_setlist_comments;
--   create policy comments_select on public.shared_setlist_comments
--     for select to public using (true);
--
--   drop policy if exists song_likes_select on public.song_likes;
--   create policy "Users can view all likes" on public.song_likes
--     for select to public using (true);
-- commit;


-- ─────────────────────────────────────────────────────────────
-- 적용 후 검증 (SQL Editor에서 실행 — songs/song_sheets/shared_setlists 행이 사라져야 함)
-- ─────────────────────────────────────────────────────────────
-- select tablename, policyname, roles::text as roles, qual
-- from pg_policies
-- where schemaname='public' and cmd='SELECT' and roles::text like '%public%'
-- order by tablename;
