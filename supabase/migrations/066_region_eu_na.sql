-- 066_region_eu_na.sql
-- Lock region to EU / NA only. The product ships with two servers; the old
-- EUW/EUNE/etc. labels came from Riot client accounts and leaked into our
-- scheduling. Tournaments and registrations key off a coarser server concept:
-- one EU lobby stack and one NA lobby stack per day. Collapse legacy values
-- into the two valid ones, then enforce via CHECK + a BEFORE INSERT trigger
-- on registrations so client bypass is impossible.

-- 1. Normalize existing data. EUW/EUNE/TR collapse to EU; LATAM/BR collapse
--    to NA; KR/OCE/JP stay as NULL on players (unset) because we don't run
--    Asia lobbies. Tournaments must be non-null; force them to EU.
update public.players
  set region = case
    when region in ('EUW','EUNE','TR') then 'EU'
    when region in ('NA','LATAM','BR') then 'NA'
    else null
  end
  where region is not null;

update public.tournaments
  set region = case
    when region in ('EUW','EUNE','TR') then 'EU'
    when region in ('NA','LATAM','BR') then 'NA'
    else 'EU'
  end;

-- 2. Tournaments.region becomes NOT NULL with EU default and a check.
alter table public.tournaments
  alter column region set default 'EU',
  alter column region set not null;

alter table public.tournaments
  drop constraint if exists tournaments_region_check;
alter table public.tournaments
  add constraint tournaments_region_check check (region in ('EU','NA'));

-- 3. Players.region stays nullable (new signup may have neither Riot ID yet)
--    but when set must be EU or NA.
alter table public.players
  drop constraint if exists players_region_check;
alter table public.players
  add constraint players_region_check check (region is null or region in ('EU','NA'));

-- 4. Index for the common lookup: upcoming tournaments in a region.
create index if not exists tournaments_region_phase_date_idx
  on public.tournaments (region, phase, date desc);

-- 5. Server-side region gate. A player cannot register into a tournament
--    whose region does not match theirs. Null player region is rejected too
--    because we want them to pick a server before joining a real lobby.
create or replace function public.enforce_registration_region()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  t_region text;
  p_region text;
begin
  select region into t_region from public.tournaments where id = new.tournament_id;
  if t_region is null then
    return new;
  end if;

  select region into p_region from public.players where id = new.player_id;
  if p_region is null then
    raise exception 'Set your server region on your account before signing up for a % tournament.', t_region
      using errcode = 'P0001';
  end if;

  if p_region <> t_region then
    raise exception 'This is a % tournament. Your account is set to %. Switch your region on the Account page to sign up.', t_region, p_region
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists registrations_region_gate on public.registrations;
create trigger registrations_region_gate
  before insert on public.registrations
  for each row execute function public.enforce_registration_region();
