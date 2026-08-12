-- Durable storage for a /record suggestion set awaiting approval.
--
-- Why: the pending task list lived only in an in-memory Map, so ANY restart
-- destroyed it. A deploy, a crash, or the pm2 memory ceiling silently threw
-- away a meeting's tasks, and the only recovery was to record the meeting
-- again, which is impossible after the fact. It happened for real on
-- 2026-08-12: a full recap with seven tasks was posted, the bot restarted, and
-- clicking "Create selected" reported the set as expired.
--
-- Stored on the voice session because one already exists by the time the
-- suggestion message is sent, and it already holds the transcript, so the
-- transcript is not duplicated here.
--
-- Idempotent.

begin;

alter table if exists public.bt_voice_sessions
  add column if not exists pending jsonb;

-- The approve handler looks a set up by the token embedded in the button's
-- customId, so that lookup needs an index rather than a scan.
create index if not exists bt_voice_sessions_pending_token_idx
  on public.bt_voice_sessions ((pending ->> 'token'))
  where pending is not null;

commit;
