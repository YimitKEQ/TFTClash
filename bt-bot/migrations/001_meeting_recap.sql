-- Structured meeting recap (TL;DR, decisions, discussion, blockers, next_steps, tasks)
-- produced by /record and read by the dashboard "Latest meeting" panel.
alter table bt_meetings add column if not exists recap jsonb;
