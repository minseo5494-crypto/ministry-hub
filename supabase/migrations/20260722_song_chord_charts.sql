-- 20260722_song_chord_charts.sql
-- 코드악보(마디별 코드+가사) 저장 테이블. 비전 추출 결과를 저장/교정한다.
-- RLS: 그 곡을 볼 수 있는 사용자(업로더 또는 공유팀 active 멤버) 또는 admin 만 접근.
--      (기존 songs 팀 격리 로직 user_has_access_to_shared_song 재사용)

create table if not exists public.song_chord_charts (
  id uuid primary key default gen_random_uuid(),
  song_id text not null references public.songs(id) on delete cascade,
  data jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'confirmed')),
  generated_by text not null default 'ai' check (generated_by in ('ai', 'manual')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (song_id)  -- 곡당 코드악보 1개 (upsert on conflict song_id)
);

create index if not exists idx_song_chord_charts_song on public.song_chord_charts (song_id);

alter table public.song_chord_charts enable row level security;

-- 곡 접근 가능 여부 헬퍼 조건(반복 사용)
-- SELECT
drop policy if exists song_chord_charts_select on public.song_chord_charts;
create policy song_chord_charts_select on public.song_chord_charts
  for select to authenticated
  using (
    exists (
      select 1 from public.songs s
      where s.id = song_id
        and (s.uploaded_by = auth.uid() or public.user_has_access_to_shared_song(s.shared_with_teams))
    )
    or exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin = true)
  );

-- INSERT (본인이 생성자, 그 곡 접근 가능)
drop policy if exists song_chord_charts_insert on public.song_chord_charts;
create policy song_chord_charts_insert on public.song_chord_charts
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (
      exists (
        select 1 from public.songs s
        where s.id = song_id
          and (s.uploaded_by = auth.uid() or public.user_has_access_to_shared_song(s.shared_with_teams))
      )
      or exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin = true)
    )
  );

-- UPDATE (그 곡 접근 가능)
drop policy if exists song_chord_charts_update on public.song_chord_charts;
create policy song_chord_charts_update on public.song_chord_charts
  for update to authenticated
  using (
    exists (
      select 1 from public.songs s
      where s.id = song_id
        and (s.uploaded_by = auth.uid() or public.user_has_access_to_shared_song(s.shared_with_teams))
    )
    or exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin = true)
  );

-- DELETE (그 곡 접근 가능)
drop policy if exists song_chord_charts_delete on public.song_chord_charts;
create policy song_chord_charts_delete on public.song_chord_charts
  for delete to authenticated
  using (
    exists (
      select 1 from public.songs s
      where s.id = song_id
        and (s.uploaded_by = auth.uid() or public.user_has_access_to_shared_song(s.shared_with_teams))
    )
    or exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin = true)
  );

-- ============================================================
-- 롤백
-- ============================================================
-- drop table if exists public.song_chord_charts cascade;
