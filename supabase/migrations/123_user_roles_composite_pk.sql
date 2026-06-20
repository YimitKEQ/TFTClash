-- 123_user_roles_composite_pk.sql
-- user_roles had its PK on (user_id) ALONE, allowing only one role per user.
-- But every upsert in the app uses onConflict: 'user_id,role' (admin sync in
-- AppContext, host grant in HostsTab, set_staff_role RPC in mig 122) -- they all
-- assumed a composite key and were silently failing ("no unique or exclusion
-- constraint matching the ON CONFLICT specification").
--
-- Fix: make the PK composite so a user can hold multiple roles (e.g. host + mod)
-- and ON CONFLICT (user_id, role) resolves. No data dedup needed -- a single-column
-- PK already guaranteed user_id was unique.
alter table user_roles drop constraint user_roles_pkey;
alter table user_roles add constraint user_roles_pkey primary key (user_id, role);
