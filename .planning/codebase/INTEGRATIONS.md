# External Integrations

**Analysis Date:** 2026-03-13

## APIs & External Services

**AI Commentary:**
- Anthropic Claude API (Sonnet 4)
  - Used for: Post-clash AI-generated commentary in `AICommentaryPanel` component
  - Endpoint: `https://api.anthropic.com/v1/messages`
  - Method: POST
  - Implementation: `src/App.jsx` lines 4896-4950
  - Model: `claude-sonnet-4-20250514`
  - Max tokens: 200
  - Auth: Bearer token expected in Authorization header (currently missing in code - requires secret)

**Social Media Links:**
- Twitch - User profile links (e.g., `https://twitch.tv/{username}`)
- Twitter/X - User profile links (e.g., `https://twitter.com/{username}`)
- YouTube - User profile links (referenced but not currently rendered)
- No SDK integration; links are simple href strings

## Data Storage

**Databases:**
- None - Entirely client-side application
- No persistent backend storage

**Local Storage:**
- Browser localStorage available for future implementation
- Currently: No localStorage persistence implemented
- All state is in-memory (resets on page refresh)

**File Storage:**
- None - No file upload or cloud storage integration
- Static assets served from Vercel CDN

**Caching:**
- No explicit caching layer
- Vite handles module caching in dev/production builds

## Authentication & Identity

**Auth Provider:**
- None - Custom mock authentication only
- Mock authentication logic: `src/App.jsx` line 4426
- Matches email/password against hardcoded mock accounts in `MOCK_ACCOUNTS` array (lines 160-171)

**Mock Accounts (for testing):**
```javascript
- dishsoap@gmail.com / Dishsoap
- k3soju@gmail.com / k3soju
```

**User Linking:**
- Riot ID field: Stores `{username}#{region}` format (e.g., "Levitate#EUW")
- Region: 9 options (EUW, EUNE, NA, KR, OCE, BR, JP, TR, LATAM)
- Social verification: Optional Twitch, Twitter, YouTube fields

## Monitoring & Observability

**Error Tracking:**
- None detected
- Basic try/catch in AI commentary (line 4931): Catches errors and displays fallback message

**Logs:**
- Browser console only (via `console.log` or similar)
- No external logging service

**Analytics:**
- None - No analytics provider detected

## CI/CD & Deployment

**Hosting:**
- Vercel (confirmed by `vercel.json`)
- SPA routing: All non-filesystem routes redirect to `/` for client-side React routing

**CI Pipeline:**
- Not detected in repository
- Likely configured in Vercel dashboard or via GitHub Actions (not in repo)

## Environment Configuration

**Required env vars:**
- None enforced
- `ANTHROPIC_API_KEY` would be required for Claude API calls (currently not implemented client-side)
  - Note: Exposing API keys client-side is a security risk; should use backend proxy

**Secrets location:**
- `.env` files: None present
- Secrets should NOT be committed; any future secrets use `vercel.json` env config or GitHub secrets

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected

## Font & Static Content CDN

**Google Fonts CDN:**
- Endpoint: `https://fonts.googleapis.com/css2`
- Fonts loaded in GCSS block (`src/App.jsx` line 363):
  - Playfair Display
  - Barlow Condensed
  - JetBrains Mono

**Riot Games Verification:**
- `public/riot.txt` - Contains GUID for Riot Games API verification
- Served at `/.well-known/` or `/riot.txt` depending on Vercel routing

## Security Considerations

**API Key Exposure Risk:**
- Claude API calls made client-side (line 4918)
- No Authorization header added to fetch request
- **Risk**: API key must be passed from client, exposing it publicly
- **Mitigation**: Implement backend proxy endpoint to handle Claude API calls

**Mock Authentication:**
- No real authentication; email/password matched against hardcoded array
- **Risk**: Any user can login as any account (development only)
- **Mitigation**: Replace with real OAuth2 provider (Riot Games, Discord, etc.) before production

**XSS Attack Surface:**
- URL fields (imgur, twitch, twitter, youtube) rendered in links
- Social media links use `target="_blank"` which is safe
- No markdown or HTML rendering detected

---

*Integration audit: 2026-03-13*
