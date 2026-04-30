-- 081_pre_weekend_hardening.sql
-- Tighten registrations and prize_claims policies before the prize-money
-- weekend tournament. Migration 079 left two gaps the audit caught:
--
--   1. Players could self-set status='checked_in' bypassing admin check-in.
--   2. Players could flip prize_claims.claim_status back to 'unclaimed'
--      and re-claim a prize.

------------------------------------------------------------------------------
-- 1. registrations: remove 'checked_in' from the allowed self-update set.
--    Admin check-in must go through the admin RPC / service role path.
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
  );

------------------------------------------------------------------------------
-- 2. prize_claims: claim is one-way. Once 'claimed', it cannot revert.
--    Replace the previous WITH CHECK and add a defense-in-depth trigger.
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
  );

create or replace function public.enforce_prize_claim_one_way()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  if old.claim_status = 'claimed' and new.claim_status is distinct from 'claimed' then
    raise exception 'Prize claims cannot be reverted once claimed';
  end if;
  return new;
end;
$$;

drop trigger if exists prize_claims_one_way on public.prize_claims;
create trigger prize_claims_one_way
  before update on public.prize_claims
  for each row execute function public.enforce_prize_claim_one_way();
