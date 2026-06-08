-- 114_soft_bans.sql
-- Soft-ban system (spec Section 2.6 / 8.10). A soft ban does NOT block a player
-- from competing: it deprioritises them to the WAITLIST for their next
-- tournament. After they have sat out one tournament from the waitlist, the ban
-- auto-lifts and they register normally again.
--
-- Model: one active soft_ban row per player. The first time a soft-banned player
-- registers for any tournament, the registration trigger forces their status to
-- 'waitlist' and stamps consumed_tournament_id. When they later register for a
-- DIFFERENT tournament, the ban is considered served and is lifted automatically.
--
-- The soft-ban trigger is named to sort BEFORE registrations_capacity_gate so a
-- forced 'waitlist' status is set before the capacity gate evaluates (a waitlist
-- row never counts against the cap).

begin;

------------------------------------------------------------------------------
-- soft_bans
------------------------------------------------------------------------------
create table if not exists public.soft_bans (
  id                    uuid primary key default gen_random_uuid(),
  player_id             uuid not null references public.players(id) on delete cascade,
  reason                text,
  active                boolean not null default true,
  consumed_tournament_id uuid references public.tournaments(id) on delete set null,
  applied_by            uuid references public.players(id) on delete set null,
  applied_at            timestamptz not null default now(),
  lifted_at             timestamptz,
  lifted_reason         text
);

-- At most one ACTIVE soft ban per player.
create unique index if not exists idx_soft_bans_one_active_per_player
  on public.soft_bans (player_id) where active;

create index if not exists idx_soft_bans_player on public.soft_bans (player_id);

alter table public.soft_bans enable row level security;

-- Read: a player can see their own bans; admins/mods see all.
drop policy if exists soft_bans_read on public.soft_bans;
create policy soft_bans_read on public.soft_bans
  for select using (
    player_id in (select p.id from public.players p where p.auth_user_id = auth.uid())
    or coalesce(public.is_admin_or_mod(auth.uid()), false)
  );

-- All writes go through the security-definer RPCs below; no direct client writes.
drop policy if exists soft_bans_admin_write on public.soft_bans;
create policy soft_bans_admin_write on public.soft_bans
  for all using (coalesce(public.is_admin_or_mod(auth.uid()), false))
  with check (coalesce(public.is_admin_or_mod(auth.uid()), false));

------------------------------------------------------------------------------
-- Registration trigger: force soft-banned players onto the waitlist.
------------------------------------------------------------------------------
create or replace function public.apply_soft_ban_on_register()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ban public.soft_bans%rowtype;
begin
  -- Only act on fresh sign-ups into a counted/waitlist state.
  if tg_op <> 'INSERT' then
    return new;
  end if;
  if new.status not in ('registered', 'checked_in', 'waitlist') then
    return new;
  end if;

  select * into v_ban
    from public.soft_bans
    where player_id = new.player_id and active
    limit 1;

  if not found then
    return new;
  end if;

  if v_ban.consumed_tournament_id is null then
    -- First tournament since the ban: serve it from the waitlist.
    new.status := 'waitlist';
    update public.soft_bans
      set consumed_tournament_id = new.tournament_id
      where id = v_ban.id;
  elsif v_ban.consumed_tournament_id = new.tournament_id then
    -- Re-registering for the same tournament they are serving the ban in.
    new.status := 'waitlist';
  else
    -- A different tournament: the serving tournament is behind them, lift it.
    update public.soft_bans
      set active = false, lifted_at = now(), lifted_reason = 'served'
      where id = v_ban.id;
  end if;

  return new;
end;
$$;

drop trigger if exists registrations_a_softban_gate on public.registrations;
create trigger registrations_a_softban_gate
  before insert on public.registrations
  for each row execute function public.apply_soft_ban_on_register();

------------------------------------------------------------------------------
-- Admin RPCs: add / remove. (List is a plain RLS-gated select from the client.)
------------------------------------------------------------------------------
create or replace function public.softban_add(p_player_id uuid, p_reason text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid;
begin
  if not coalesce(public.is_admin_or_mod(auth.uid()), false) then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  select id into v_actor from public.players where auth_user_id = auth.uid();

  -- Upsert against the partial unique index: refresh the reason if already banned.
  if exists (select 1 from public.soft_bans where player_id = p_player_id and active) then
    update public.soft_bans
      set reason = p_reason, applied_by = v_actor, applied_at = now()
      where player_id = p_player_id and active;
    return 'updated';
  end if;

  insert into public.soft_bans (player_id, reason, applied_by)
    values (p_player_id, p_reason, v_actor);
  return 'added';
end;
$$;

create or replace function public.softban_remove(p_player_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(public.is_admin_or_mod(auth.uid()), false) then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  update public.soft_bans
    set active = false, lifted_at = now(), lifted_reason = 'manual'
    where player_id = p_player_id and active;

  if not found then
    return 'not_banned';
  end if;
  return 'removed';
end;
$$;

revoke all on function public.softban_add(uuid, text) from public, anon;
revoke all on function public.softban_remove(uuid) from public, anon;
grant execute on function public.softban_add(uuid, text) to authenticated, service_role;
grant execute on function public.softban_remove(uuid) to authenticated, service_role;

commit;
