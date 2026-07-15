-- 팀 일정 캘린더 — 1단계: 스키마 + RLS
--
-- 계획서: docs/내부/팀_일정_캘린더_계획.md
--
-- ⚠️ 이 마이그레이션은 순수 추가(additive)다. 기존 테이블/정책/데이터/코드를 일절 건드리지 않는다.
--    새 테이블 2개(team_events, team_event_attendance)만 생성한다.
--    아직 어떤 프론트 코드도 이 테이블을 참조하지 않으므로 앱 동작에 영향 0.
--
-- 설계 결정 (2026-07-15 확정):
--   - 반복: 인스턴스 생성 방식. "매주 토요일 연습" → 개별 회차 행 여러 개 + 같은 recurrence_group_id.
--   - 참석: 팀원 셀프 입력 + 리더 대리. 미리 행 안 만들고 상태 고를 때 upsert.
--   - 콘티 연결: 예배 일정에서 team_setlists 링크 (setlist_id, nullable).
--   - 구글 연동: v2 보류 (이 스키마에는 관련 컬럼 없음).
--   - RLS: 팀 폐쇄 공유 모델. get_user_team_ids()(active 멤버) / get_user_admin_team_ids()(leader·admin) 재사용.

begin;

-- ─────────────────────────────────────────────────────────────
-- 1. team_events — 일정 본체
-- ─────────────────────────────────────────────────────────────
create table if not exists public.team_events (
  id                  uuid primary key default gen_random_uuid(),
  team_id             uuid not null references public.teams(id) on delete cascade,
  title               text not null,
  event_type          text not null default 'etc'
                        check (event_type in ('practice','serving','worship','etc')),
  start_at            timestamptz not null,
  end_at              timestamptz,
  all_day             boolean not null default false,
  location            text,
  description         text,
  setlist_id          uuid references public.team_setlists(id) on delete set null,
  recurrence_group_id uuid,
  created_by          uuid references public.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.team_events is '팀 일정(연습/섬김/예배/기타). 반복은 recurrence_group_id로 묶인 개별 인스턴스.';

create index if not exists team_events_team_id_start_idx
  on public.team_events (team_id, start_at);
create index if not exists team_events_recurrence_group_idx
  on public.team_events (recurrence_group_id);
create index if not exists team_events_setlist_id_idx
  on public.team_events (setlist_id);

drop trigger if exists set_team_events_updated_at on public.team_events;
create trigger set_team_events_updated_at
  before update on public.team_events
  for each row execute function public.set_updated_at();


-- ─────────────────────────────────────────────────────────────
-- 2. team_event_attendance — 팀원별 참석 현황
-- ─────────────────────────────────────────────────────────────
create table if not exists public.team_event_attendance (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.team_events(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  status      text not null default 'no_response'
                check (status in ('attending','absent','maybe','no_response')),
  note        text,
  updated_at  timestamptz not null default now(),
  unique (event_id, user_id)
);

comment on table public.team_event_attendance is '일정별 팀원 참석 상태. 팀원당 일정별 1행(upsert).';

create index if not exists team_event_attendance_user_idx
  on public.team_event_attendance (user_id);

drop trigger if exists set_team_event_attendance_updated_at on public.team_event_attendance;
create trigger set_team_event_attendance_updated_at
  before update on public.team_event_attendance
  for each row execute function public.set_updated_at();


-- ─────────────────────────────────────────────────────────────
-- 3. RLS — team_events
-- ─────────────────────────────────────────────────────────────
alter table public.team_events enable row level security;

-- 조회: 소속 active 팀의 일정만
create policy team_events_select on public.team_events
  for select to authenticated
  using (team_id in (select public.get_user_team_ids()));

-- 생성: 소속 active 팀에만, 작성자는 본인
create policy team_events_insert on public.team_events
  for insert to authenticated
  with check (
    team_id in (select public.get_user_team_ids())
    and created_by = auth.uid()
  );

-- 수정: 작성자 본인 또는 팀 리더/관리자
create policy team_events_update on public.team_events
  for update to authenticated
  using (
    created_by = auth.uid()
    or team_id in (select public.get_user_admin_team_ids())
  );

-- 삭제: 작성자 본인 또는 팀 리더/관리자
create policy team_events_delete on public.team_events
  for delete to authenticated
  using (
    created_by = auth.uid()
    or team_id in (select public.get_user_admin_team_ids())
  );

-- 관리자(전역) 전체 접근
create policy admin_team_events_all on public.team_events
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ─────────────────────────────────────────────────────────────
-- 4. RLS — team_event_attendance
--    (event_id → team_events 로 팀 판별. 하위 쿼리는 team_events RLS를 그대로 탐)
-- ─────────────────────────────────────────────────────────────
alter table public.team_event_attendance enable row level security;

-- 조회: 그 일정이 속한 팀의 멤버는 전체 참석 현황을 봄
create policy team_event_attendance_select on public.team_event_attendance
  for select to authenticated
  using (
    event_id in (
      select e.id from public.team_events e
      where e.team_id in (select public.get_user_team_ids())
    )
  );

-- 생성: 같은 팀 일정에 한해 본인 행만
create policy team_event_attendance_insert on public.team_event_attendance
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and event_id in (
      select e.id from public.team_events e
      where e.team_id in (select public.get_user_team_ids())
    )
  );

-- 수정: 본인 행 또는 팀 리더/관리자(대리 지정)
create policy team_event_attendance_update on public.team_event_attendance
  for update to authenticated
  using (
    user_id = auth.uid()
    or event_id in (
      select e.id from public.team_events e
      where e.team_id in (select public.get_user_admin_team_ids())
    )
  );

-- 삭제: 본인 행 또는 팀 리더/관리자
create policy team_event_attendance_delete on public.team_event_attendance
  for delete to authenticated
  using (
    user_id = auth.uid()
    or event_id in (
      select e.id from public.team_events e
      where e.team_id in (select public.get_user_admin_team_ids())
    )
  );

-- 관리자(전역) 전체 접근
create policy admin_team_event_attendance_all on public.team_event_attendance
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

commit;


-- ─────────────────────────────────────────────────────────────
-- 적용 후 검증 (SQL Editor에서 실행)
-- ─────────────────────────────────────────────────────────────
-- 1) 테이블 2개 + RLS 활성화 확인:
-- select relname, relrowsecurity from pg_class
-- where relname in ('team_events','team_event_attendance');
--
-- 2) 정책 개수 확인 (team_events 5개, attendance 5개):
-- select tablename, count(*) from pg_policies
-- where tablename in ('team_events','team_event_attendance') group by tablename;


-- ─────────────────────────────────────────────────────────────
-- 롤백 (문제 시)
-- ─────────────────────────────────────────────────────────────
-- begin;
--   drop table if exists public.team_event_attendance cascade;
--   drop table if exists public.team_events cascade;
-- commit;
