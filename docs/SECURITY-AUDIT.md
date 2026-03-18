# TFT Clash — Security Audit Report

**Date:** 2026-03-18
**Scope:** Full platform — frontend, API, Discord bot, database, deployment

---

## Executive Summary

4 CRITICAL, 6 HIGH, 5 MEDIUM, 3 LOW, 4 INFO findings.
The most urgent: live credentials on disk, client-side-only admin auth, browser-exposed API key, and SVG upload XSS vector.

---

## CRITICAL Findings

### CRIT-1: Live Credentials Committed to Disk (`discord-bot/.env`)

`discord-bot/.env` contains a live Discord bot token and a live Supabase **service role key** (bypasses all RLS). The root `.gitignore` only excludes `.env` at project root; `discord-bot/.env` is not covered.

**Required actions:**
1. Add `**/.env` to `.gitignore` immediately
2. Rotate the Discord bot token via Discord Developer Portal
3. Rotate the Supabase service role key via Dashboard > Settings > API
4. Run `git log --all -S "service_role"` to check git history exposure

### CRIT-2: Admin Authorization Is Entirely Client-Side

`src/App.jsx` line ~15047 reads admin status from `localStorage.getItem("tft-admin")`. Any user can set this to `"1"` in browser console. RLS policies on `game_results`, `tournaments`, `players` (delete), and `registrations` use `USING (true)` for all authenticated users.

**Fix:** Add `user_roles.role = 'admin'` checks to sensitive table RLS policies. Replace localStorage admin flag with server-side role validation.

### CRIT-3: Anthropic API Called Directly from Browser

`src/App.jsx` lines ~13304–13320: `AICommentaryPanel` calls `https://api.anthropic.com/v1/messages` from the browser. The API key is either absent (non-functional) or bundled into client JS via `VITE_` env var.

**Fix:** Move to `api/ai-commentary.js` serverless function with server-side env var.

### CRIT-4: SVG Upload Allowed — Stored XSS Vector

`supabase/migrations/024_create_host_assets_bucket.sql` allows `image/svg+xml`. SVGs can contain `<script>` tags. Bucket is public.

**Fix:** Remove `image/svg+xml` from `allowed_mime_types`.

---

## HIGH Findings

- **HIGH-1:** RLS UPDATE/DELETE policies on `registrations`, `lobbies`, `game_results`, `players` use `USING (true)` — any authenticated user can modify/delete any row
- **HIGH-2:** Raw Stripe exception messages returned to client in `api/create-checkout.js` line 149
- **HIGH-3:** CORS in `api/check-admin.js` reflects any `Origin` header instead of whitelisting production domain
- **HIGH-4:** `src/lib/supabase.js` uses `flowType: 'implicit'` — OAuth tokens in URL fragment; switch to PKCE
- **HIGH-5:** `notifications` INSERT allows any authenticated user to insert for any `user_id`
- **HIGH-6:** Admin route guard is client-side React check on forged localStorage flag

---

## MEDIUM Findings

- **MED-1:** In-memory rate limiters reset on serverless cold starts
- **MED-2:** `audit_log` readable/writable by any authenticated user — audit trail tampering possible
- **MED-3:** `site_settings` "write all" policy may still be active from out-of-order migration
- **MED-4:** `/api/create-checkout` accepts `userId` from request body with no JWT verification
- **MED-5:** `host_profiles.brand_color` has no format constraint — CSS injection possible

---

## LOW Findings

- **LOW-1:** Health endpoint exposes version number
- **LOW-2:** `discord-bot/.env` not in `.gitignore`
- **LOW-3:** Plausible analytics script loaded without SRI hash

---

## INFO (Good Practices Found)

- `check-admin.js` correctly uses `crypto.timingSafeEqual`
- Stripe webhook correctly validates signatures using raw body
- Supabase anon key is intentionally public — by design
- `unsafe-inline` in CSP required by current Vite SPA architecture

---

## Priority Fix Order

1. **CRIT-1** — Rotate credentials, fix `.gitignore` (immediate)
2. **CRIT-2 + HIGH-1** — Tighten RLS policies with admin role checks
3. **CRIT-3** — Move AI API call to serverless function
4. **CRIT-4** — Remove SVG from allowed upload types
5. **HIGH-3** — Whitelist CORS origin
6. **HIGH-4** — Switch to PKCE auth flow
