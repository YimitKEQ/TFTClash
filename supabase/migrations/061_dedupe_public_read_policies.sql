-- 061_dedupe_public_read_policies.sql
-- Core tables had two identical "public read" policies — one from the original
-- table create ("Anyone can read ...") and one named "read all" added by a
-- later migration. Postgres evaluates them both on every row, so we drop the
-- shorter / less-named duplicate. No functional change (both had qual=true).

drop policy if exists "read all" on public.tournaments;
drop policy if exists "read all" on public.registrations;
drop policy if exists "read all" on public.lobbies;
drop policy if exists "read all" on public.players;
