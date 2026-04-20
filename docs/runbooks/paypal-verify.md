# PayPal Webhook Verification Runbook

## Code audit summary (2026-04-20)

`api/paypal-webhook.js` is correctly hardened:
- Signature verification happens BEFORE any DB mutation (`handler` line ~142, before the dedup upsert)
- Uses PayPal's official `/v1/notifications/verify-webhook-signature` endpoint with `PAYPAL_WEBHOOK_ID`
- `cert_url` is allowlist-validated to prevent SSRF (line ~83)
- Body is read raw, 64KB cap to prevent DoS (line 16, 42-46)
- Returns HTTP 400 + JSON error if signature invalid; never persists rows from forged events
- Idempotent via `webhook_events` table (atomic upsert, only marks `processed_at` after handler success)

Audit verdict: GREEN. The runbook below verifies live behavior matches the code.

## Spot-check live signature path

1. Subscribe with a real account at the lowest tier ($4.99 Pro). Use a card you control.
2. Watch Vercel logs:
   ```
   vercel logs https://tftclash.com --follow | grep -i paypal
   ```
3. Within ~30 seconds, expect the function to log a successful verification (no `signature verification failed` line) and the subscription row to be written.
4. Confirm in DB:
   ```sql
   SELECT user_id, tier, status, current_period_start, current_period_end
   FROM user_subscriptions
   WHERE user_id = 'YOUR_AUTH_UUID'
   ORDER BY current_period_start DESC LIMIT 1;
   ```
   Row should exist with `status='active'`.
5. Confirm UI: Pro badge appears in nav within 30 seconds of webhook.
6. Cancel subscription via PayPal dashboard. Watch logs for the CANCELLED webhook. Confirm `status` updates to `cancelled` and badge removes at period end.

## Forged-signature negative test

Send a forged POST to `/api/paypal-webhook`:

```bash
curl -X POST https://tftclash.com/api/paypal-webhook \
  -H "Content-Type: application/json" \
  -H "paypal-transmission-id: forged" \
  -H "paypal-transmission-sig: forged" \
  -H "paypal-transmission-time: 2026-01-01T00:00:00Z" \
  -H "paypal-cert-url: https://api-m.paypal.com/v1/notifications/certs/CERT-FAKE" \
  -H "paypal-auth-algo: SHA256withRSA" \
  -d '{"id":"FAKE-EVENT","event_type":"BILLING.SUBSCRIPTION.ACTIVATED","resource":{"id":"FAKE","custom_id":"00000000-0000-0000-0000-000000000000"}}'
```

Expected: HTTP 400 with `{"error":"Invalid signature"}` or `{"error":"Signature verification error"}`. NO row should be created in `user_subscriptions` or `webhook_events`.

Verify in DB:

```sql
SELECT * FROM user_subscriptions WHERE user_id = '00000000-0000-0000-0000-000000000000';
SELECT * FROM webhook_events WHERE event_id = 'FAKE-EVENT';
```

Both should return zero rows.

## Verification log

| Date | Real subscribe verified | Forged rejected | Pro badge appeared | Notes |
|------|-------------------------|-----------------|---------------------|-------|
|      |                         |                 |                     |       |
