-- 085_squads_teams.sql
-- Foundation for the new 4v4 ("Squads") format. Adds three tables:
--   * teams           -- a persistent 4-person roster with a captain
--   * team_members    -- which players are on which team, with role + soft delete
--   * team_invites    -- captain-issued invites pending acceptance
--
-- Plus column additions on tournaments (team_size, subs_allowed, points_scale)
-- and players (last_left_team_at) so the existing custom-tournament rails can
-- run a 4v4 event without forking a parallel registration system.
--
-- Product rules locked in this session:
--   * Teams are persistent. Soft-delete (archived_at) on disband so history
--     and tournament results stay intact.
--   * One active team per player. Enforced via a partial unique index on
--     team_members(player_id) where removed_at is null.
--   * Leaving a team starts a 60-minute cooldown before joining another team
--     (admin override via service_role). Stored as players.last_left_team_at.
--   * 2 subs per team. Captain can swap subs in before a match.
--   * Free-agent matchmaking lives on Discord, not the website. We only need
--     a "team has open seats" hint; no match-me queue here.
--
-- IDs are uuid throughout to match the rest of the platform (players,
-- tournaments, registrations, etc. all use uuid pk with gen_random_uuid()).

------------------------------------------------------------------------------
-- 1. teams
------------------------------------------------------------------------------
create table if not exists public.teams (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  tag           text,
  region        text default 'EUW',
  captain_player_id uuid not null references public.players(id) on delete restrict,
  logo_url      text,
  bio           text default '',
  archived_at   timestamptz,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create unique index if not exists teams_active_name_unique
  on public.teams (lower(name))
  where archived_at is null;

create index if not exists teams_captain_idx     on public.teams (captain_player_id);
create index if not exists teams_archived_at_idx on public.teams (archived_at);

------------------------------------------------------------------------------
-- 2. team_members
------------------------------------------------------------------------------
create table if not exists public.team_members (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id)   on delete cascade,
  player_id   uuid not null references public.players(id) on delete cascade,
  role        text not null default 'main'
              check (role in ('captain', 'main', 'sub')),
  joined_at   timestamptz default now(),
  removed_at  timestamptz,
  removed_reason text
);

create unique index if not exists team_members_one_active_per_player
  on public.team_members (player_id)
  where removed_at is null;

create index if not exists team_members_team_idx   on public.team_members (team_id);
create index if not exists team_members_active_idx on public.team_members (team_id) where removed_at is null;

------------------------------------------------------------------------------
-- 3. team_invites
------------------------------------------------------------------------------
create table if not exists public.team_invites (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id)   on delete cascade,
  invitee_player_id uuid not null references public.players(id) on delete cascade,
  inviter_player_id uuid references public.players(id) on delete set null,
  status      text not null default 'pending'
              check (status in ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  message     text default '',
  expires_at  timestamptz default (now() + interval '7 days'),
  created_at  timestamptz default now(),
  responded_at timestamptz
);

create unique index if not exists team_invites_unique_pending
  on public.team_invites (team_id, invitee_player_id)
  where status = 'pending';

create index if not exists team_invites_invitee_idx on public.team_invites (invitee_player_id) where status = 'pending';
create index if not exists team_invites_team_idx    on public.team_invites (team_id)            where status = 'pending';

------------------------------------------------------------------------------
-- 4. Column additions on existing tables
------------------------------------------------------------------------------
alter table public.players
  add column if not exists last_left_team_at timestamptz;

alter table public.tournaments
  add column if not exists team_size     int  default 1
    check (team_size in (1, 2, 3, 4)),
  add column if not exists subs_allowed  int  default 0
    check (subs_allowed >= 0 and subs_allowed <= 4),
  add column if not exists points_scale  text default 'standard'
    check (points_scale in ('standard', 'win_weighted'));

------------------------------------------------------------------------------
-- 5. Auto-create captain row on team insert
------------------------------------------------------------------------------
create or replace function public.teams_seed_captain_member()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- If captain already has an active membership somewhere, the unique index
  -- will block this and surface a clear error to the caller.
  insert into public.team_members (team_id, player_id, role)
  values (new.id, new.captain_player_id, 'captain');
  return new;
end;
$$;

drop trigger if exists teams_seed_captain on public.teams;
create trigger teams_seed_captain
  after insert on public.teams
  for each row execute function public.teams_seed_captain_member();

------------------------------------------------------------------------------
-- 6. Roster cap + cooldown enforcement on team_members
------------------------------------------------------------------------------
create or replace function public.enforce_team_member_rules()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  active_count int;
  cooldown_until timestamptz;
  cooldown_minutes int := 60;
  is_service boolean := (select auth.role()) = 'service_role';
begin
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and old.removed_at is not null and new.removed_at is null) then
    select count(*) into active_count
      from public.team_members
      where team_id = new.team_id
        and removed_at is null
        and id <> new.id;

    if active_count >= 6 then
      raise exception 'Team roster is full (6 / 6 active members).' using errcode = 'P0001';
    end if;

    if not is_service then
      select last_left_team_at into cooldown_until from public.players where id = new.player_id;
      if cooldown_until is not null
         and cooldown_until + (cooldown_minutes || ' minutes')::interval > now() then
        raise exception 'Player is on a leave cooldown until %.',
          cooldown_until + (cooldown_minutes || ' minutes')::interval
          using errcode = 'P0001';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists team_members_rules on public.team_members;
create trigger team_members_rules
  before insert or update on public.team_members
  for each row execute function public.enforce_team_member_rules();

------------------------------------------------------------------------------
-- 7. On member removal: stamp last_left_team_at + start cooldown
------------------------------------------------------------------------------
create or replace function public.team_members_on_remove()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and old.removed_at is null and new.removed_at is not null then
    update public.players
       set last_left_team_at = new.removed_at
     where id = new.player_id;

    if old.role = 'captain' then
      perform 1
        from public.teams
        where id = old.team_id and archived_at is null and captain_player_id = old.player_id;
      if found then
        raise exception 'Cannot remove captain without transferring captaincy first.'
          using errcode = 'P0001';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists team_members_remove_hooks on public.team_members;
create trigger team_members_remove_hooks
  before update on public.team_members
  for each row execute function public.team_members_on_remove();

------------------------------------------------------------------------------
-- 8. Stamp responded_at when an invite leaves the pending state
------------------------------------------------------------------------------
create or replace function public.team_invites_stamp_response()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and old.status = 'pending' and new.status <> 'pending' then
    new.responded_at = coalesce(new.responded_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists team_invites_stamp on public.team_invites;
create trigger team_invites_stamp
  before update on public.team_invites
  for each row execute function public.team_invites_stamp_response();

------------------------------------------------------------------------------
-- 9. updated_at trigger on teams
------------------------------------------------------------------------------
create or replace function public.teams_touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists teams_set_updated_at on public.teams;
create trigger teams_set_updated_at
  before update on public.teams
  for each row execute function public.teams_touch_updated_at();

------------------------------------------------------------------------------
-- 10. Row-Level Security
------------------------------------------------------------------------------
alter table public.teams         enable row level security;
alter table public.team_members  enable row level security;
alter table public.team_invites  enable row level security;

drop policy if exists "Anyone can read teams" on public.teams;
create policy "Anyone can read teams" on public.teams
  for select using (true);

drop policy if exists "Captains create teams" on public.teams;
create policy "Captains create teams" on public.teams
  for insert to authenticated
  with check (
    captain_player_id = (select id from public.players where auth_user_id = (select auth.uid()) limit 1)
  );

drop policy if exists "Captains update own team" on public.teams;
create policy "Captains update own team" on public.teams
  for update to authenticated
  using (
    captain_player_id = (select id from public.players where auth_user_id = (select auth.uid()) limit 1)
  )
  with check (
    captain_player_id = (select id from public.players where auth_user_id = (select auth.uid()) limit 1)
  );

drop policy if exists "Service role manages teams" on public.teams;
create policy "Service role manages teams" on public.teams
  for all to service_role using (true) with check (true);

drop policy if exists "Anyone can read team_members" on public.team_members;
create policy "Anyone can read team_members" on public.team_members
  for select using (true);

drop policy if exists "Captain inserts members" on public.team_members;
create policy "Captain inserts members" on public.team_members
  for insert to authenticated
  with check (
    exists (
      select 1 from public.teams t
      where t.id = team_members.team_id
        and t.captain_player_id = (select id from public.players where auth_user_id = (select auth.uid()) limit 1)
    )
  );

drop policy if exists "Players leave or captain edits" on public.team_members;
create policy "Players leave or captain edits" on public.team_members
  for update to authenticated
  using (
    player_id = (select id from public.players where auth_user_id = (select auth.uid()) limit 1)
    or exists (
      select 1 from public.teams t
      where t.id = team_members.team_id
        and t.captain_player_id = (select id from public.players where auth_user_id = (select auth.uid()) limit 1)
    )
  )
  with check (
    player_id = (select id from public.players where auth_user_id = (select auth.uid()) limit 1)
    or exists (
      select 1 from public.teams t
      where t.id = team_members.team_id
        and t.captain_player_id = (select id from public.players where auth_user_id = (select auth.uid()) limit 1)
    )
  );

drop policy if exists "Service role manages team_members" on public.team_members;
create policy "Service role manages team_members" on public.team_members
  for all to service_role using (true) with check (true);

drop policy if exists "Invitee or captain reads invites" on public.team_invites;
create policy "Invitee or captain reads invites" on public.team_invites
  for select to authenticated
  using (
    invitee_player_id = (select id from public.players where auth_user_id = (select auth.uid()) limit 1)
    or exists (
      select 1 from public.teams t
      where t.id = team_invites.team_id
        and t.captain_player_id = (select id from public.players where auth_user_id = (select auth.uid()) limit 1)
    )
  );

drop policy if exists "Captain sends invites" on public.team_invites;
create policy "Captain sends invites" on public.team_invites
  for insert to authenticated
  with check (
    inviter_player_id = (select id from public.players where auth_user_id = (select auth.uid()) limit 1)
    and exists (
      select 1 from public.teams t
      where t.id = team_invites.team_id
        and t.captain_player_id = (select id from public.players where auth_user_id = (select auth.uid()) limit 1)
        and t.archived_at is null
    )
    and not exists (
      select 1 from public.team_members tm
      where tm.player_id = team_invites.invitee_player_id
        and tm.removed_at is null
    )
  );

drop policy if exists "Invitee or captain updates invite" on public.team_invites;
create policy "Invitee or captain updates invite" on public.team_invites
  for update to authenticated
  using (
    invitee_player_id = (select id from public.players where auth_user_id = (select auth.uid()) limit 1)
    or exists (
      select 1 from public.teams t
      where t.id = team_invites.team_id
        and t.captain_player_id = (select id from public.players where auth_user_id = (select auth.uid()) limit 1)
    )
  )
  with check (
    invitee_player_id = (select id from public.players where auth_user_id = (select auth.uid()) limit 1)
    or exists (
      select 1 from public.teams t
      where t.id = team_invites.team_id
        and t.captain_player_id = (select id from public.players where auth_user_id = (select auth.uid()) limit 1)
    )
  );

drop policy if exists "Service role manages team_invites" on public.team_invites;
create policy "Service role manages team_invites" on public.team_invites
  for all to service_role using (true) with check (true);
