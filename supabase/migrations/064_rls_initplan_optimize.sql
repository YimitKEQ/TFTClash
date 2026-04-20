-- 064_rls_initplan_optimize.sql
-- Wrap auth.uid() / auth.role() in subqueries across every user-scoped RLS
-- policy so Postgres evaluates them once per query (InitPlan) instead of on
-- every row. Also consolidates duplicate admin policies that were layered
-- on over time (same predicate, different name) so RLS only walks one path.
--
-- Behavior is preserved: every DROP is paired with a CREATE (or with an
-- existing canonical policy that covers the same predicate).

-- activity_feed
drop policy if exists "activity_feed_insert" on public.activity_feed;
create policy "activity_feed_insert" on public.activity_feed for insert
  with check (is_admin_or_mod((select auth.uid())) or (player_id in (select id from public.players where auth_user_id = (select auth.uid()))));

-- admin_audit_log
drop policy if exists "admin_audit_log_insert" on public.admin_audit_log;
drop policy if exists "admins read admin_audit_log" on public.admin_audit_log;
drop policy if exists "audit_log_admin_read" on public.admin_audit_log;
create policy "admin_audit_log_insert" on public.admin_audit_log for insert
  with check (is_admin_or_mod((select auth.uid())));
create policy "admin_audit_log_read" on public.admin_audit_log for select
  using (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = 'admin'));

-- announcements
drop policy if exists "Admins can manage announcements" on public.announcements;
create policy "Admins can manage announcements" on public.announcements for all
  using (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = any(array['admin','mod'])));

-- audit_log
drop policy if exists "Admins insert audit_log with own identity" on public.audit_log;
drop policy if exists "Admins read audit log" on public.audit_log;
create policy "Admins insert audit_log with own identity" on public.audit_log for insert
  with check ((actor_id = (select auth.uid())) and exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = 'admin'));
create policy "Admins read audit log" on public.audit_log for select
  using (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = 'admin'));

-- content_calendar / content_posts / content_templates
drop policy if exists "content_calendar_owner" on public.content_calendar;
create policy "content_calendar_owner" on public.content_calendar for all
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
drop policy if exists "content_posts_owner" on public.content_posts;
create policy "content_posts_owner" on public.content_posts for all
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
drop policy if exists "content_templates_owner" on public.content_templates;
create policy "content_templates_owner" on public.content_templates for all
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- disputes
drop policy if exists "Admins can update disputes" on public.disputes;
drop policy if exists "Players can create disputes" on public.disputes;
create policy "Admins can update disputes" on public.disputes for update
  using (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = 'admin'));
create policy "Players can create disputes" on public.disputes for insert
  with check (player_id = (select id from public.players where auth_user_id = (select auth.uid()) limit 1));

-- event_registrations (consolidated: 4 overlapping policies)
drop policy if exists "Users register themselves" on public.event_registrations;
drop policy if exists "event_regs_delete" on public.event_registrations;
drop policy if exists "event_regs_insert" on public.event_registrations;
drop policy if exists "event_regs_update" on public.event_registrations;
create policy "event_regs_insert" on public.event_registrations for insert
  with check (is_admin_or_mod((select auth.uid())) or (player_id = (select auth.uid())) or (player_id = (select id from public.players where auth_user_id = (select auth.uid()) limit 1)));
create policy "event_regs_update" on public.event_registrations for update
  using (is_admin_or_mod((select auth.uid())) or (player_id = (select auth.uid())))
  with check (is_admin_or_mod((select auth.uid())) or (player_id = (select auth.uid())));
create policy "event_regs_delete" on public.event_registrations for delete
  using (is_admin_or_mod((select auth.uid())) or (player_id = (select auth.uid())));

-- featured_events
drop policy if exists "admins manage featured_events" on public.featured_events;
create policy "admins manage featured_events" on public.featured_events for all
  using (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = any(array['admin','mod'])))
  with check (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = any(array['admin','mod'])));

-- game_results (consolidated: 4 overlapping admin policies -> 1 ALL)
drop policy if exists "Admins can delete game_results" on public.game_results;
drop policy if exists "Admins can insert game_results" on public.game_results;
drop policy if exists "Admins can update game_results" on public.game_results;
drop policy if exists "Admins manage game results" on public.game_results;
create policy "Admins manage game_results" on public.game_results for all
  using (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = any(array['admin','mod'])))
  with check (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = any(array['admin','mod'])));

-- gear_items (consolidated)
drop policy if exists "admin manage gear_items" on public.gear_items;
drop policy if exists "gear_admin_all" on public.gear_items;
create policy "admins manage gear_items" on public.gear_items for all
  using (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = any(array['admin','mod'])))
  with check (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = any(array['admin','mod'])));

-- head_to_head
drop policy if exists "Admins manage h2h" on public.head_to_head;
create policy "Admins manage h2h" on public.head_to_head for all
  using (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = any(array['admin','mod'])))
  with check (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = any(array['admin','mod'])));

-- host_applications (7 overlapping policies -> 3 canonical)
drop policy if exists "Admins can delete host_applications" on public.host_applications;
drop policy if exists "Admins can manage host_applications" on public.host_applications;
drop policy if exists "Admins can update host_applications" on public.host_applications;
drop policy if exists "Admins manage host applications" on public.host_applications;
drop policy if exists "Anyone can read approved applications" on public.host_applications;
drop policy if exists "Users can apply for host" on public.host_applications;
drop policy if exists "Users can read own host application" on public.host_applications;
drop policy if exists "Users can read own host_applications" on public.host_applications;
drop policy if exists "Users can submit own application" on public.host_applications;
create policy "Admins manage host_applications" on public.host_applications for all
  using (is_admin_or_mod((select auth.uid())))
  with check (is_admin_or_mod((select auth.uid())));
create policy "Public reads approved host_applications" on public.host_applications for select
  using ((status = 'approved') or (user_id = (select auth.uid())));
create policy "Users apply for host" on public.host_applications for insert
  with check (user_id = (select auth.uid()));

-- host_profiles
drop policy if exists "Admins can manage host_profiles" on public.host_profiles;
drop policy if exists "Anyone can read approved host profiles" on public.host_profiles;
drop policy if exists "Users can insert own profile" on public.host_profiles;
drop policy if exists "Users can update own profile" on public.host_profiles;
create policy "Admins manage host_profiles" on public.host_profiles for all
  using (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = any(array['admin','mod'])))
  with check (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = any(array['admin','mod'])));
create policy "Public reads approved host_profiles" on public.host_profiles for select
  using ((status = 'approved') or ((select auth.uid()) = user_id));
create policy "Users insert own host_profile" on public.host_profiles for insert
  with check ((select auth.uid()) = user_id);
create policy "Users update own host_profile" on public.host_profiles for update
  using ((select auth.uid()) = user_id);

-- lobbies
drop policy if exists "Admins can manage lobbies" on public.lobbies;
create policy "Admins manage lobbies" on public.lobbies for all
  using (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = any(array['admin','host'])));

-- lobby_players
drop policy if exists "Admins manage lobby players" on public.lobby_players;
create policy "Admins manage lobby_players" on public.lobby_players for all
  using (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = any(array['admin','mod'])))
  with check (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = any(array['admin','mod'])));

-- newsletter_subscribers
drop policy if exists "service_role_reads" on public.newsletter_subscribers;
drop policy if exists "users_see_own" on public.newsletter_subscribers;
create policy "service_role_reads" on public.newsletter_subscribers for select
  using ((select auth.role()) = 'service_role');
create policy "users_see_own" on public.newsletter_subscribers for select
  using ((select auth.uid()) = user_id);

-- notifications
drop policy if exists "Admins can insert any notifications" on public.notifications;
drop policy if exists "Users can insert own notifications" on public.notifications;
drop policy if exists "Users read own notifications" on public.notifications;
drop policy if exists "Users update own notifications" on public.notifications;
create policy "Admins insert any notifications" on public.notifications for insert
  with check (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = any(array['admin','mod'])));
create policy "Users insert own notifications" on public.notifications for insert
  with check (user_id = (select auth.uid()));
create policy "Users read own notifications" on public.notifications for select
  using ((select auth.uid()) = user_id);
create policy "Users update own notifications" on public.notifications for update
  using ((select auth.uid()) = user_id);

-- pending_results
drop policy if exists "admin full access pending_results" on public.pending_results;
drop policy if exists "players insert own pending_results" on public.pending_results;
drop policy if exists "players read own pending_results" on public.pending_results;
create policy "Admins manage pending_results" on public.pending_results for all
  using (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = 'admin'))
  with check (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = 'admin'));
create policy "Players insert own pending_results" on public.pending_results for insert
  with check (player_id in (select id from public.players where auth_user_id = (select auth.uid())));
create policy "Players read own pending_results" on public.pending_results for select
  using (player_id in (select id from public.players where auth_user_id = (select auth.uid())));

-- player_achievements
drop policy if exists "Admins manage achievements" on public.player_achievements;
create policy "Admins manage achievements" on public.player_achievements for all
  using (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = any(array['admin','mod'])))
  with check (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = any(array['admin','mod'])));

-- player_challenges / player_milestones / referrals — owner-or-admin scoped writes
drop policy if exists "player_challenges_insert_scoped" on public.player_challenges;
drop policy if exists "player_challenges_update_scoped" on public.player_challenges;
create policy "player_challenges_insert_scoped" on public.player_challenges for insert
  with check ((player_id in (select id from public.players where auth_user_id = (select auth.uid()))) or is_admin_or_mod((select auth.uid())));
create policy "player_challenges_update_scoped" on public.player_challenges for update
  using ((player_id in (select id from public.players where auth_user_id = (select auth.uid()))) or is_admin_or_mod((select auth.uid())))
  with check ((player_id in (select id from public.players where auth_user_id = (select auth.uid()))) or is_admin_or_mod((select auth.uid())));

drop policy if exists "player_milestones_insert_scoped" on public.player_milestones;
drop policy if exists "player_milestones_update_scoped" on public.player_milestones;
create policy "player_milestones_insert_scoped" on public.player_milestones for insert
  with check ((player_id in (select id from public.players where auth_user_id = (select auth.uid()))) or is_admin_or_mod((select auth.uid())));
create policy "player_milestones_update_scoped" on public.player_milestones for update
  using ((player_id in (select id from public.players where auth_user_id = (select auth.uid()))) or is_admin_or_mod((select auth.uid())))
  with check ((player_id in (select id from public.players where auth_user_id = (select auth.uid()))) or is_admin_or_mod((select auth.uid())));

-- player_penalties (consolidated)
drop policy if exists "admins read player_penalties" on public.player_penalties;
drop policy if exists "penalties_admin" on public.player_penalties;
create policy "Admins manage player_penalties" on public.player_penalties for all
  using (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = 'admin'));

-- player_reports
drop policy if exists "Admins can manage reports" on public.player_reports;
drop policy if exists "Players can update own report" on public.player_reports;
drop policy if exists "Players report own placement" on public.player_reports;
create policy "Admins manage player_reports" on public.player_reports for all
  using (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = 'admin'));
create policy "Players update own report" on public.player_reports for update
  using (player_id in (select id from public.players where auth_user_id = (select auth.uid())));
create policy "Players report own placement" on public.player_reports for insert
  with check (player_id in (select id from public.players where auth_user_id = (select auth.uid())));

-- players
drop policy if exists "Admins can insert players" on public.players;
drop policy if exists "Admins can manage all players" on public.players;
drop policy if exists "Any authenticated user can insert guest players" on public.players;
drop policy if exists "Users can insert own player" on public.players;
drop policy if exists "Users can update own player safely" on public.players;
create policy "Admins manage all players" on public.players for all
  using (is_admin_or_mod((select auth.uid())))
  with check (is_admin_or_mod((select auth.uid())));
create policy "Any authenticated user can insert guest players" on public.players for insert
  with check ((role = 'guest') and (auth_user_id is null) and ((select auth.uid()) is not null));
create policy "Users can insert own player" on public.players for insert
  with check (auth_user_id = (select auth.uid()));
create policy "Users can update own player safely" on public.players for update
  using ((select auth.uid()) = auth_user_id)
  with check (((select auth.uid()) = auth_user_id)
              and (not (is_admin is distinct from (select f.is_admin from public.get_own_player_fields((select auth.uid())) f(is_admin, role))))
              and (not (role is distinct from (select f.role from public.get_own_player_fields((select auth.uid())) f(is_admin, role)))));

-- point_adjustments (consolidated)
drop policy if exists "Admins manage point_adjustments" on public.point_adjustments;
drop policy if exists "admins read point_adjustments" on public.point_adjustments;
drop policy if exists "point_adj_admin_insert" on public.point_adjustments;
create policy "Admins manage point_adjustments" on public.point_adjustments for all
  using (is_admin_or_mod((select auth.uid())))
  with check (is_admin_or_mod((select auth.uid())));

-- prize_claims
drop policy if exists "Admins manage claims" on public.prize_claims;
drop policy if exists "Players claim own prize" on public.prize_claims;
drop policy if exists "Players read own claims" on public.prize_claims;
create policy "Admins manage prize_claims" on public.prize_claims for all
  using (is_admin_or_mod((select auth.uid())))
  with check (is_admin_or_mod((select auth.uid())));
create policy "Players claim own prize" on public.prize_claims for update
  using (player_id in (select id from public.players where auth_user_id = (select auth.uid())))
  with check (player_id in (select id from public.players where auth_user_id = (select auth.uid())));
create policy "Players read own prize_claims" on public.prize_claims for select
  using (is_admin_or_mod((select auth.uid())) or (player_id in (select id from public.players where auth_user_id = (select auth.uid()))));

-- referrals
drop policy if exists "referrals_insert_scoped" on public.referrals;
drop policy if exists "users read own referrals" on public.referrals;
create policy "referrals_insert_scoped" on public.referrals for insert
  with check ((referrer_id in (select id from public.players where auth_user_id = (select auth.uid()))) or is_admin_or_mod((select auth.uid())));
create policy "users read own referrals" on public.referrals for select
  using (referrer_id = (select id from public.players where auth_user_id = (select auth.uid()) limit 1));

-- registrations
drop policy if exists "Admins can manage registrations" on public.registrations;
drop policy if exists "Users can delete own registration" on public.registrations;
drop policy if exists "Users can register own player" on public.registrations;
drop policy if exists "Users can update own registration" on public.registrations;
create policy "Admins manage registrations" on public.registrations for all
  using (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = any(array['admin','host'])))
  with check (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = any(array['admin','host'])));
create policy "Users delete own registration" on public.registrations for delete
  using (player_id = (select id from public.players where auth_user_id = (select auth.uid()) limit 1));
create policy "Users register own player" on public.registrations for insert
  with check (player_id = (select id from public.players where auth_user_id = (select auth.uid()) limit 1));
create policy "Users update own registration" on public.registrations for update
  using (player_id = (select id from public.players where auth_user_id = (select auth.uid()) limit 1));

-- scheduled_events
drop policy if exists "Admins can manage scheduled_events" on public.scheduled_events;
create policy "Admins manage scheduled_events" on public.scheduled_events for all
  using (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = any(array['admin','mod'])));

-- scrim_games / scrim_players / scrim_results
drop policy if exists "scrim_games_delete" on public.scrim_games;
drop policy if exists "scrim_games_insert" on public.scrim_games;
drop policy if exists "scrim_games_update" on public.scrim_games;
create policy "scrim_games_delete" on public.scrim_games for delete
  using (exists (select 1 from public.scrims where id = scrim_games.scrim_id and created_by = (select auth.uid())));
create policy "scrim_games_insert" on public.scrim_games for insert
  with check (((select auth.uid()) is not null) and exists (select 1 from public.scrims s where s.id = scrim_games.scrim_id and s.created_by = (select auth.uid())));
create policy "scrim_games_update" on public.scrim_games for update
  using (exists (select 1 from public.scrims where id = scrim_games.scrim_id and created_by = (select auth.uid())));

drop policy if exists "scrim_players_delete" on public.scrim_players;
drop policy if exists "scrim_players_insert" on public.scrim_players;
create policy "scrim_players_delete" on public.scrim_players for delete
  using (exists (select 1 from public.scrims where id = scrim_players.scrim_id and created_by = (select auth.uid())));
create policy "scrim_players_insert" on public.scrim_players for insert
  with check (((select auth.uid()) is not null) and exists (select 1 from public.scrims s where s.id = scrim_players.scrim_id and s.created_by = (select auth.uid())));

drop policy if exists "scrim_results_delete" on public.scrim_results;
drop policy if exists "scrim_results_insert" on public.scrim_results;
create policy "scrim_results_delete" on public.scrim_results for delete
  using (exists (select 1 from public.scrim_games sg join public.scrims s on s.id = sg.scrim_id where sg.id = scrim_results.scrim_game_id and s.created_by = (select auth.uid())));
create policy "scrim_results_insert" on public.scrim_results for insert
  with check (((select auth.uid()) is not null) and exists (select 1 from public.scrim_games sg join public.scrims s on s.id = sg.scrim_id where sg.id = scrim_results.scrim_game_id and s.created_by = (select auth.uid())));

-- scrims
drop policy if exists "scrims_delete" on public.scrims;
drop policy if exists "scrims_insert" on public.scrims;
drop policy if exists "scrims_update" on public.scrims;
create policy "scrims_delete" on public.scrims for delete
  using (((select auth.uid()) = created_by) or exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = 'admin'));
create policy "scrims_insert" on public.scrims for insert
  with check (((select auth.uid()) is not null) and ((select auth.uid()) = created_by) and is_scrim_host((select auth.uid())));
create policy "scrims_update" on public.scrims for update
  using (((select auth.uid()) = created_by) or exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = 'admin'));

-- season_snapshots / seasons
drop policy if exists "Admins manage season snapshots" on public.season_snapshots;
create policy "Admins manage season_snapshots" on public.season_snapshots for all
  using (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = any(array['admin','mod'])))
  with check (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = any(array['admin','mod'])));
drop policy if exists "Admins manage seasons" on public.seasons;
create policy "Admins manage seasons" on public.seasons for all
  using (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = any(array['admin','mod'])))
  with check (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = any(array['admin','mod'])));

-- site_settings (consolidated 3 -> 1 ALL)
drop policy if exists "Admins can delete site_settings" on public.site_settings;
drop policy if exists "Admins can insert site_settings" on public.site_settings;
drop policy if exists "Admins can update site_settings" on public.site_settings;
create policy "Admins manage site_settings" on public.site_settings for all
  using (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = 'admin'))
  with check (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = 'admin'));

-- social_connections
drop policy if exists "social_connections_owner" on public.social_connections;
create policy "social_connections_owner" on public.social_connections for all
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- sponsors
drop policy if exists "Admins manage sponsors" on public.sponsors;
drop policy if exists "Public can read active sponsors" on public.sponsors;
create policy "Admins manage sponsors" on public.sponsors for all
  using (is_admin_or_mod((select auth.uid())))
  with check (is_admin_or_mod((select auth.uid())));
create policy "Public reads active sponsors" on public.sponsors for select
  using ((active = true) or is_admin_or_mod((select auth.uid())));

-- subscriptions (legacy — kept for compat)
drop policy if exists "Users can read own subscription" on public.subscriptions;
create policy "Users read own subscription" on public.subscriptions for select
  using ((select auth.uid()) = user_id);

-- tournament_results (consolidated duplicates)
drop policy if exists "Admins manage tournament results" on public.tournament_results;
drop policy if exists "Admins manage tournament_results" on public.tournament_results;
create policy "Admins manage tournament_results" on public.tournament_results for all
  using (is_admin_or_mod((select auth.uid())))
  with check (is_admin_or_mod((select auth.uid())));

-- tournament_rounds / tournament_stages / tournaments
drop policy if exists "Admins manage tournament rounds" on public.tournament_rounds;
create policy "Admins manage tournament_rounds" on public.tournament_rounds for all
  using (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = any(array['admin','mod'])))
  with check (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = any(array['admin','mod'])));
drop policy if exists "Admins manage tournament stages" on public.tournament_stages;
create policy "Admins manage tournament_stages" on public.tournament_stages for all
  using (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = any(array['admin','mod'])))
  with check (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = any(array['admin','mod'])));
drop policy if exists "Admins can manage tournaments" on public.tournaments;
create policy "Admins manage tournaments" on public.tournaments for all
  using (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = any(array['admin','host'])));

-- trend_cache
drop policy if exists "trend_cache_read" on public.trend_cache;
create policy "trend_cache_read" on public.trend_cache for select
  using ((select auth.role()) = 'authenticated');

-- user_roles
drop policy if exists "Users read own role" on public.user_roles;
create policy "Users read own role" on public.user_roles for select
  using ((select auth.uid()) = user_id);

-- user_subscriptions
drop policy if exists "Users can insert own subscription" on public.user_subscriptions;
drop policy if exists "Users can update own subscription" on public.user_subscriptions;
create policy "Users insert own subscription" on public.user_subscriptions for insert
  with check ((select auth.uid()) = user_id);
create policy "Users update own subscription" on public.user_subscriptions for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- webhook_events
drop policy if exists "service_role_only" on public.webhook_events;
create policy "service_role_only" on public.webhook_events for all
  using ((select auth.role()) = 'service_role');

-- xp_events (one policy was broken — compared player_id to auth.uid() directly; drop it)
drop policy if exists "Users read own xp" on public.xp_events;
drop policy if exists "users read own xp" on public.xp_events;
create policy "Users read own xp" on public.xp_events for select
  using (player_id = (select id from public.players where auth_user_id = (select auth.uid()) limit 1));
