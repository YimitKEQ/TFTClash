-- 083_banned_guards.sql
-- Defense-in-depth: even if the client-side banned check is bypassed, banned
-- players cannot self-check-in or claim a prize. Closes a gap flagged in the
-- pre-tournament audit.

------------------------------------------------------------------------------
-- 1. registrations: a banned player cannot toggle their own status.
--    Migration 081 already restricts the allowed status values - this layers
--    a banned check on top so a not-yet-banned-at-registration-time player
--    cannot still flip their row after we ban them.
------------------------------------------------------------------------------
drop policy if exists "Users update own registration" on public.registrations;

create policy "Users update own registration" on public.registrations
  for update to authenticated
  using (
    player_id = (select id from public.players where auth_user_id = (select auth.uid()) limit 1)
  )
  with check (
    player_id = (select id from public.players where auth_user_id = (select auth.uid()) limit 1)
    and status in ('registered', 'dropped', 'waitlist')
    and not exists (
      select 1 from public.players p
      where p.id = registrations.player_id and coalesce(p.banned, false) = true
    )
  );

------------------------------------------------------------------------------
-- 2. prize_claims: a banned player cannot claim their prize. Admin can still
--    write claim rows via the service role / RPC path.
------------------------------------------------------------------------------
drop policy if exists "Players claim own prize" on public.prize_claims;

create policy "Players claim own prize" on public.prize_claims
  for update to authenticated
  using (
    player_id in (select id from public.players where auth_user_id = (select auth.uid()))
  )
  with check (
    player_id in (select id from public.players where auth_user_id = (select auth.uid()))
    and claim_status = 'claimed'
    and not exists (
      select 1 from public.players p
      where p.id = prize_claims.player_id and coalesce(p.banned, false) = true
    )
  );
