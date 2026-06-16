-- 118_bt_board_departments.sql
-- Add a department dimension to the Brosephtech content board so cards can be
-- grouped/filtered by the team that owns them (content, design, growth, etc.).
--
-- Departments are app-driven and expected to grow over time, so we deliberately
-- do NOT add an enum or CHECK constraint here. The column is a plain text value
-- with a sensible default of 'content' so all existing cards keep working.
--
-- Idempotent: safe to re-run. Uses add column if not exists, an explicit
-- backfill of any NULL values, and create index if not exists.
--
-- This migration does NOT touch RLS. bt_* row-level security is fully governed
-- by migration 069 (069_lock_brosephtech_rls.sql) and stays unchanged.

begin;

-- ── 1. Add the department column (defaults existing + new rows to 'content') ─
alter table if exists public.bt_content_cards
  add column if not exists department text not null default 'content';

-- ── 2. Backfill safety net (rows already get the default, but be explicit) ──
update public.bt_content_cards
   set department = 'content'
 where department is null;

-- ── 3. Index for department filtering on the board ─────────────────────────
create index if not exists bt_content_cards_department_idx
  on public.bt_content_cards (department);

commit;
