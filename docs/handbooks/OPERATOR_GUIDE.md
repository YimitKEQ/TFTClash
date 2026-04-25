# TFT Clash - Operator Guide

> Internal guide for running the platform itself. Covers host applications, payouts, support, and the on-call basics. This document is for the platform operator (you).

---

## Daily routine (5-15 min)

1. **Check Discord #host-support** for blockers from active hosts.
2. **Check the admin dashboard** at [tftclash.com/admin](https://tftclash.com/admin) - look for:
   - Pending host applications
   - Pending sponsor placements awaiting approval
   - Pending dispute escalations
   - Failed payouts (PayPal webhook tab)
3. **Check error rates** - Sentry dashboard, look for new exception types.
4. **Reply to lodiestream@gmail.com** - support inbox.

If everything's quiet, you're done in 5 minutes.

---

## Approving host applications

[tftclash.com/admin](https://tftclash.com/admin) -> "Host Applications" tab.

Approval criteria (loose, lean toward yes):
- Real human (not a throwaway email)
- Some prior tournament experience or community presence (Discord server, stream, etc.)
- Willing to commit to ~1 tournament per month minimum

Reject for:
- Duplicate accounts
- No identifiable community presence + no prior experience
- Requests from regions we can't legally process payouts to

Approval is one-click; the applicant gets an automated email with onboarding instructions and a link to start their first tournament draft.

---

## Sponsor approvals

When a sponsor signs a deal through the platform, it's queued for operator review. Check that:
- Sponsor brand isn't sketchy (no scams, no banned game services, no Riot ToS violations)
- Placement matches the host's tier (no over-promising)
- Payment cleared in PayPal

Approve via the admin dashboard. The sponsor's logo + copy auto-deploys to the tournament page within 60 seconds.

---

## Disputes + DQs

99% of disputes resolve at the host level (host has dispute tools in their dashboard). The 1% that escalate come to you.

**Process:**
1. Read the match thread for the tournament in question.
2. Check the audit log on the affected game/round (admin dashboard -> "Audit Log").
3. Talk to both parties via Discord DM.
4. Make a call. Host's word is usually canonical unless audit log contradicts.
5. Update placement via admin tools. The bracket auto-recomputes.

If a host is consistently dispute-prone, flag them. Two flags in 30 days = warning email. Three = host plan suspension pending review.

---

## Payout cycle

Every Monday 00:00 UTC, the platform runs `cron-payouts` (not yet implemented in code - manual for now). It:
1. Calculates each host's net earnings for the prior week.
2. Subtracts platform fees per the splits in `pricing/host_revenue_splits`.
3. Triggers a PayPal Mass Payments transfer.
4. Emails the host a receipt.

Manual operator steps until cron is automated:
1. Pull the report from admin dashboard -> "Pending Payouts".
2. Verify against the PayPal transactions screen.
3. Hit "Approve All Payouts" button.
4. Confirm the PayPal Mass Payments operation.
5. Spot-check 2-3 random hosts that they got their money.

If something goes wrong (failed transfer, currency issue, account holds), email the host immediately. We commit to resolving within 48 hours.

---

## Support tickets

Categorize:
- **Player issues** (login, profile, can't register, lost LP) - usually fixable in admin tools in <5 min
- **Host issues** (tournament won't start, OBS overlay broken, sponsor not showing) - check the host's dashboard with their permission, fix in admin or escalate to engineering
- **Billing** (failed payment, refund, subscription cancellation) - PayPal dashboard + admin tools
- **Bugs** - file in Sentry / GitHub issues, fix priority order: payment > tournament-day > everything else

Standard response time: 4 hours during EU business hours, 24 hours overnight.

---

## Emergency runbook

### "The site is down"
1. Check status page: [tftclash.com/api/health](https://tftclash.com/api/health).
2. Check Vercel dashboard for deployment health.
3. Check Supabase dashboard for DB health.
4. If Vercel is down, post an outage notice in Discord.
5. If Supabase is down, ditto - we're at their mercy.
6. If our code: rollback the most recent deploy via Vercel.

### "A tournament is mid-flight and the bracket broke"
1. Don't panic. The audit log has every score change.
2. Open admin dashboard -> the affected tournament -> "Manual Override" tab.
3. Reconstruct the round state from the audit log.
4. Save. The bracket will refresh for everyone.
5. Apologize in the match thread.

### "Someone's claiming to be hacked"
1. Reset their password from Supabase auth admin.
2. Check the auth log for suspicious sessions.
3. Revoke all sessions for that user.
4. Email them with the new temporary password.
5. Investigate how it happened (rate-limit on login? credential reuse?).

### "PayPal sent us a chargeback"
1. Check the order history for the affected transaction.
2. Pull the audit log + IP log + transaction record.
3. Submit dispute response via PayPal within their window.
4. If we lose, the platform absorbs the loss (don't claw back from the host).

---

## Roadmap maintenance

Public roadmap at [tftclash.com/roadmap](https://tftclash.com/roadmap). Once a month:
1. Review user-submitted ideas + votes.
2. Move top 3 voted ideas into "Planned" if they're feasible.
3. Update "Shipping" items with actual ETAs.
4. Mark "Shipped" things and link to the changelog.

Keeps the community engaged + sets expectations.

---

## Quarterly admin tasks

- **Tax reports** - export sponsor + payout history per host, send quarterly receipts.
- **Sponsor renewal outreach** - email lapsed sponsors a "we miss you" + new tournament list.
- **Player retention dashboard** - check who's gone dark and email them a "we noticed you stopped competing, anything we can do" message.
- **Pricing review** - are subscription rates still right? Does the 70/30 split still feel fair? Adjust if the math has changed.
- **Security audit** - re-run the security review, rotate any suspicious-looking secrets, patch any flagged vulnerabilities.

---

## Things you should NOT do as operator

- **Don't ban a player without a written reason** - everything goes in the audit log; due process matters even at this scale.
- **Don't refund a host's subscription proactively** - if they cancel, fine; if there's a service issue, refund. Don't preempt requests; it sets a weird expectation.
- **Don't take a cut you didn't earn** - the splits in the docs are sacred. If we take more, we lose hosts.
- **Don't ship breaking schema changes during tournament hours** - check the events calendar before pushing migrations.
- **Don't ignore Discord #host-support for >24h** - hosts churn fast if they feel unheard.

---

## Contacts

- **PayPal merchant support:** business.paypal.com -> Help
- **Supabase support:** supabase.com/dashboard -> Support
- **Vercel support:** vercel.com/help
- **Sentry:** sentry.io
- **Domain (Cloudflare):** dash.cloudflare.com

Keep MFA codes accessible (1Password / Authy / hardware key).

---

## When in doubt

**Hosts come first.** They pay our bills, they bring players, they make the platform feel alive. When making a judgment call, optimize for hosts feeling supported, even if it costs you a little time or money.

Players second, spectators third. Platform's reputation is the long-term asset; protect it.
