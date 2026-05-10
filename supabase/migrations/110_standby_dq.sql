-- 110_standby_dq.sql
-- Phase 4: no-show handling. A small "standby pool" lets late-joiners reserve
-- a seat that auto-promotes when a registered player is DQ'd for missing
-- check-in. The standby_pool table is the source of truth — site_settings
-- jsonb is too coarse for atomic seat claims under load.
--
-- The claim_standby_seat RPC takes a row-level lock on the tournament so two
-- different players racing for the last seat resolve deterministically. The
-- ON CONFLICT DO NOTHING shortcut only catches same-player double-clicks.

begin;

------------------------------------------------------------------------------
-- standby_pool
------------------------------------------------------------------------------
create table if not exists public.standby_pool (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  player_id     uuid not null references public.players(id)     on delete cascade,
  opted_in_at   timestamptz not null default now(),
  source        text not null default 'self',
  primary key (tournament_id, player_id)
);

create index if not exists idx_standby_pool_tournament_optin
  on public.standby_pool (tournament_id, opted_in_at);

alter table public.standby_pool enable row level security;

-- Read: anyone can see who is on standby for a tournament (fair signaling).
drop policy if exists standby_pool_read_all on public.standby_pool;
create policy standby_pool_read_all on public.standby_pool
  for select using (true);

-- Insert: only the player themself (resolved via auth_user_id → players.id).
drop policy if exists standby_pool_self_insert on public.standby_pool;
create policy standby_pool_self_insert on public.standby_pool
  for insert with check (
    player_id in (
      select p.id from public.players p
      where p.auth_user_id = auth.uid()
    )
  );

-- Delete: only the player themself or an admin.
drop policy if exists standby_pool_self_delete on public.standby_pool;
create policy standby_pool_self_delete on public.standby_pool
  for delete using (
    player_id in (
      select p.id from public.players p
      where p.auth_user_id = auth.uid()
    )
    or coalesce(public.is_admin_or_mod(auth.uid()), false)
  );

------------------------------------------------------------------------------
-- claim_standby_seat(p_tournament_id, p_player_id, p_seat_cap)
--
-- Atomically promotes a standby player into a real registration when a seat
-- opens up. Locks the tournament row so two concurrent calls cannot both
-- succeed past the cap. Returns 'promoted' | 'already_registered' | 'full'
-- | 'not_on_standby' | 'tournament_missing'.
------------------------------------------------------------------------------
create or replace function public.claim_standby_seat(
  p_tournament_id uuid,
  p_player_id     uuid,
  p_seat_cap      int
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_count int;
  v_lock_row       record;
begin
  -- Lock the tournament row so concurrent claims serialize.
  select id into v_lock_row
    from public.tournaments
    where id = p_tournament_id
    for update;
  if v_lock_row is null then
    return 'tournament_missing';
  end if;

  -- If the player is already registered, no-op (and clean up the standby row).
  if exists (
    select 1 from public.registrations r
    where r.tournament_id = p_tournament_id
      and r.player_id = p_player_id
  ) then
    delete from public.standby_pool
      where tournament_id = p_tournament_id and player_id = p_player_id;
    return 'already_registered';
  end if;

  -- Player must actually be on standby for this tournament.
  if not exists (
    select 1 from public.standby_pool s
    where s.tournament_id = p_tournament_id and s.player_id = p_player_id
  ) then
    return 'not_on_standby';
  end if;

  -- Seat cap check (NULL or <=0 means "no cap").
  if p_seat_cap is not null and p_seat_cap > 0 then
    select count(*) into v_existing_count
      from public.registrations r
      where r.tournament_id = p_tournament_id;
    if v_existing_count >= p_seat_cap then
      return 'full';
    end if;
  end if;

  -- Promote: insert a registration row + remove the standby row.
  -- status='registered' so the player still has to /checkin like everyone else.
  insert into public.registrations (tournament_id, player_id, status, created_at)
    values (p_tournament_id, p_player_id, 'registered', now())
    on conflict do nothing;

  delete from public.standby_pool
    where tournament_id = p_tournament_id and player_id = p_player_id;

  return 'promoted';
end;
$$;

revoke all on function public.claim_standby_seat(uuid, uuid, int) from public, anon;
grant execute on function public.claim_standby_seat(uuid, uuid, int) to authenticated, service_role;

commit;
