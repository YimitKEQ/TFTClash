-- 075: Let authenticated players upsert their own achievement rows
--
-- Background:
-- syncAchievements is called from the client (PlayerProfileScreen, BracketScreen,
-- ClashScreen) to keep player_achievements in sync with computed stats. Existing
-- RLS only allows SELECT (anyone) and ALL (admin/mod or service_role), so any
-- normal player viewing their profile triggers a 400 from PostgREST.
--
-- Fix: allow an authenticated user to INSERT/UPDATE achievements where the
-- target player.auth_user_id matches their auth.uid(). Tier is still constrained
-- by app code (computed from ACHIEVEMENTS def) and the achievement_id list is
-- fixed in code.

create policy "Players upsert own achievements"
  on public.player_achievements
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.players p
      where p.id = player_achievements.player_id
        and p.auth_user_id = (select auth.uid())
    )
  );

create policy "Players update own achievements"
  on public.player_achievements
  for update
  to authenticated
  using (
    exists (
      select 1 from public.players p
      where p.id = player_achievements.player_id
        and p.auth_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.players p
      where p.id = player_achievements.player_id
        and p.auth_user_id = (select auth.uid())
    )
  );
