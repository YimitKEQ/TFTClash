-- Migration 094: relax prize_claims one-way trigger
--
-- The original trigger (085 / 089) blocked any transition AWAY from 'claimed',
-- which broke the admin payout workflow: claimed -> shipped -> delivered.
--
-- The intent was only to prevent a player from reverting a claim back to
-- 'unclaimed' (de-claiming a prize they already claimed). Admin-initiated
-- forward movement (shipped, delivered) and exception states (disputed,
-- refunded, forfeited) should always be allowed.

CREATE OR REPLACE FUNCTION public.enforce_prize_claim_one_way()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  -- Block only the specific reversion: claimed -> unclaimed.
  -- All other transitions (claimed -> shipped/delivered/disputed/refunded/forfeited)
  -- are admin-initiated and must be allowed.
  if old.claim_status = 'claimed' and new.claim_status = 'unclaimed' then
    raise exception 'Cannot revert a claimed prize back to unclaimed. Use refunded or forfeited instead.';
  end if;

  -- Also block reverting from any terminal state back to unclaimed.
  if old.claim_status in ('shipped','delivered','disputed','refunded','forfeited')
     and new.claim_status = 'unclaimed' then
    raise exception 'Cannot move % back to unclaimed', old.claim_status;
  end if;

  return new;
end;
$function$;
