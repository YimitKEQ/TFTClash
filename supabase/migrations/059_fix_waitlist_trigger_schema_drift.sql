-- 059_fix_waitlist_trigger_schema_drift.sql
-- Fix promote_waitlist_on_drop trigger: registrations.id is UUID (not BIGINT) and
-- the timestamp column is created_at (not registered_at). The previous function
-- body from migration 054 referenced columns that no longer exist after a prior
-- table migration, which caused "column registered_at does not exist" errors on
-- any UPDATE/DELETE of registrations (including claim/delete flows in admin).

create or replace function public.promote_waitlist_on_drop()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_reg_id uuid;
begin
  if tg_op = 'UPDATE' and old.status in ('registered','checked_in')
     and new.status in ('dropped','cancelled','waitlisted','disqualified','no_show') then

    select id into target_reg_id
    from public.registrations
    where tournament_id = new.tournament_id
      and status = 'waitlisted'
    order by waitlist_position nulls last, created_at asc
    limit 1;

    if target_reg_id is not null then
      update public.registrations
      set status = 'registered',
          waitlist_position = null,
          waitlist_notified_at = now()
      where id = target_reg_id;
    end if;
  end if;

  if tg_op = 'DELETE' and old.status in ('registered','checked_in') then
    select id into target_reg_id
    from public.registrations
    where tournament_id = old.tournament_id
      and status = 'waitlisted'
    order by waitlist_position nulls last, created_at asc
    limit 1;

    if target_reg_id is not null then
      update public.registrations
      set status = 'registered',
          waitlist_position = null,
          waitlist_notified_at = now()
      where id = target_reg_id;
    end if;
  end if;

  return coalesce(new, old);
end;
$$;
