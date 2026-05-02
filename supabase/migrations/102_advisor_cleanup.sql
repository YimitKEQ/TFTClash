-- 102_advisor_cleanup.sql
-- Addresses Supabase advisor warnings surfaced after migrations 100 + 101:
--   1. 22 SECURITY DEFINER trigger-only functions had EXECUTE granted to PUBLIC
--      (the Postgres default). Triggers are invoked by the trigger system as the
--      function owner, so direct EXECUTE access is never needed. Revoke from
--      PUBLIC, anon, authenticated.
--   2. news-images bucket had a "public read" SELECT policy on storage.objects
--      that let any client LIST the entire bucket. The bucket is public so file
--      URLs work without any SELECT policy; only admin write/update/delete
--      policies are needed.

------------------------------------------------------------------------------
-- 1. Revoke EXECUTE on trigger-only SECURITY DEFINER functions.
------------------------------------------------------------------------------
do $$
declare
  fn text;
  trigger_fns text[] := array[
    'clear_lineup_on_uncheckin()',
    'enforce_prize_claim_one_way()',
    'enforce_registration_capacity()',
    'enforce_registration_lifecycle()',
    'enforce_registration_region()',
    'enforce_registration_team_shape()',
    'enforce_team_lineup_on_checkin()',
    'enforce_team_member_role_change()',
    'enforce_team_member_rules()',
    'enforce_tournament_update_safety()',
    'enforce_unique_player_per_tournament_lineup()',
    'handle_new_user()',
    'news_posts_touch_updated_at()',
    'players_guard_managed_cols()',
    'promote_waitlist_on_drop()',
    'refresh_player_stats()',
    'stamp_game_result_team_id()',
    'team_invites_stamp_response()',
    'team_members_on_remove()',
    'teams_seed_captain_member()',
    'teams_touch_updated_at()',
    'user_subscriptions_guard_sensitive_cols()'
  ];
begin
  foreach fn in array trigger_fns loop
    execute format('revoke execute on function public.%s from public', fn);
    execute format('revoke execute on function public.%s from anon', fn);
    execute format('revoke execute on function public.%s from authenticated', fn);
  end loop;
end $$;

------------------------------------------------------------------------------
-- 2. Tighten news-images bucket. Public URL access does not require SELECT
--    on storage.objects; the public bucket flag handles that. Dropping the
--    broad SELECT policy stops anon clients from LISTing the bucket contents.
------------------------------------------------------------------------------
drop policy if exists "news-images public read" on storage.objects;
