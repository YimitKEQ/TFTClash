-- 119_bt_board_links_blocked.sql
-- Make the Brosephtech board work for app/dev cards (Barontactics), not just
-- content. Adds two cross-department card fields:
--   links   - a jsonb array of reference strings (PR, issue, Figma, build, doc).
--   blocked - a boolean flag so a card can be marked as stuck on a blocker.
--
-- Idempotent: add column if not exists, with explicit backfill of NULLs. Does
-- NOT touch RLS (migration 069 governs bt_* row-level security).

begin;

alter table if exists public.bt_content_cards
  add column if not exists links jsonb not null default '[]'::jsonb;

alter table if exists public.bt_content_cards
  add column if not exists blocked boolean not null default false;

update public.bt_content_cards
   set links = '[]'::jsonb
 where links is null;

update public.bt_content_cards
   set blocked = false
 where blocked is null;

commit;
