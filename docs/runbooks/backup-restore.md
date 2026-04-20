# Supabase Backup + Restore Runbook

## Prerequisites

- Supabase project on Pro plan or higher (free tier has no automated backups)
- `supabase` CLI installed (`npm install -g supabase`)
- Access token in `~/.supabase/access-token`

## Take a manual backup

In Supabase Dashboard > Database > Backups, click "Create backup". Wait for green checkmark (typically 30-90 seconds).

Or via CLI:

```bash
supabase db dump --linked --file backups/manual-$(date +%Y%m%d-%H%M%S).sql
```

## Restore to a branch (dry run)

1. Supabase Dashboard > Branches > Create branch (e.g. `restore-test`).
2. Wait for branch ready (~30 seconds).
3. In branch dashboard > Database > Backups > Restore from production backup.
4. Pick the most recent backup. Confirm.
5. Wait for restore to complete (2-10 min depending on DB size).

## Verify restore

Connect to the branch DB and run:

```sql
SELECT
  (SELECT COUNT(*) FROM players) AS players,
  (SELECT COUNT(*) FROM game_results) AS game_results,
  (SELECT COUNT(*) FROM tournaments) AS tournaments,
  (SELECT COUNT(*) FROM registrations) AS registrations;
```

Compare to prod counts. Diffs > 1% = backup is incomplete or stale -- DO NOT LAUNCH until investigated.

## Cleanup

After verification, delete the branch (Supabase Dashboard > Branches > Delete).

## Restore log

| Date | Backup taken | Branch tested | Players | game_results | tournaments | registrations | Result |
|------|--------------|---------------|---------|--------------|-------------|---------------|--------|
|      |              |               |         |              |             |               |        |
