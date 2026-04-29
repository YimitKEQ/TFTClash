-- 078_fix_handle_new_user_region.sql
-- Bug: handle_new_user trigger inserted region='EUW', but migration 066
-- narrowed players_region_check to (region IS NULL OR region IN ('EU','NA')).
-- Result: every signup hit "Database error saving new user".
-- Fix: drop the region literal from the insert. The column is nullable;
-- the user picks their server (EU/NA) from the Account page after signup.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  uname text;
begin
  if exists (select 1 from public.players where auth_user_id = new.id) then
    return new;
  end if;

  uname := get_signup_username(new.raw_user_meta_data, new.email);

  insert into public.players (id, username, rank, auth_user_id)
  values (gen_random_uuid(), uname, 'Iron', new.id)
  on conflict (auth_user_id) do nothing;

  return new;
end;
$function$;
