# On-Call Protocol (First 2 Weeks Post-Launch)

## Roles

- **Primary:** Levitate (you), daytime CET hours
- **Backup:** TBD trusted Discord moderator with admin role and your phone number
- **Escalation triggers:** see "Rollback triggers" in `docs/LAUNCH-CHECKLIST.md`

## Communication channels

- Internal: Discord #ops (private channel, admin + backup only)
- Public status: Discord #announcements + status page (when live)
- Sentry alerts: route to Discord #ops via webhook
- Uptime monitor (UptimeRobot / Better Stack): same Discord webhook

## Response time targets

| Severity | Target acknowledge | Target mitigation |
|----------|--------------------|--------------------|
| Auth bypass / data leak | 5 min | 30 min (rollback if needed) |
| Site down (health 5xx > 5 min) | 5 min | 30 min |
| Payment broken (webhook 5xx, badge stuck) | 15 min | 2 hours |
| Single feature broken (non-payment) | 1 hour | Same day |
| Cosmetic / copy | Best effort | Next deploy |

## Standing checks (run twice daily, week 1)

- Sentry inbox: any new issues > 5 occurrences?
- DB CPU graph in Supabase: any sustained spikes > 60%?
- Signup count: trending up? plateau? cliff?
- Payment row count vs prior day
- Discord #feedback: triage to GitHub issues

## Rollback command

```bash
vercel rollback
```

Pick the last green deploy from the interactive list. Confirms in 60 seconds.

## Health check from anywhere

```bash
curl -s https://tftclash.com/api/health | head
```

Should return `{"status":"ok",...,"sha":"<40-char hex>"}`. The `sha` field tells you which commit is currently live -- match it against `git log` to confirm a deploy or a rollback completed.

## Post-incident

Every incident gets:
1. A GitHub issue with timeline (detected -> mitigated -> root cause)
2. A line in `docs/runbooks/incidents.md` (create if missing)
3. A change to a runbook, test, or alert if it could happen again

## Backup contact list (fill in before launch)

- Mod backup name + Discord handle: TBD
- Mod backup phone (only for site-down incidents): TBD
- Vercel account recovery email: TBD
- Supabase account recovery email: TBD
- PayPal merchant support: 1-888-221-1161 (US) / 0800-358-7929 (UK)
- Domain registrar support: TBD
