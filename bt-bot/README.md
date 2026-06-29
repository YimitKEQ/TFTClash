# BrosephTech Bot

An accountability and live-feed Discord bot for the BrosephTech crew. It reads
and writes the shared content board (`bt_content_cards`) and keeps the crew
honest: it broadcasts every new card, ship, and block as it happens, posts a
daily standup, runs a weekly digest, sweeps blocked cards, and pings the owners
of work that is overdue, stuck, or due soon.

## Standalone

This is a completely separate project from the TFT Clash Discord bot in
`discord-bot/`. It has its own `package.json`, its own `.env`, its own slash
commands, and runs as its own long-lived process. It does not import from,
depend on, or modify anything in `discord-bot/`. The only thing the two share
is the Supabase project, and this bot only touches `bt_content_cards`.

It is a single Node 18+ process. Run it anywhere Node is available:

- Bare process: `npm start`.
- With a process manager (recommended for uptime):

  ```
  pm2 start index.js --name brosephtech-bot
  ```

- As a container or systemd service: run `node index.js` with the `.env`
  present in the working directory.

## Setup

1. Install dependencies:

   ```
   npm install
   ```

2. Create your environment file and fill it in:

   ```
   cp .env.example .env
   ```

   Then set:
   - `BT_DISCORD_TOKEN`, `BT_CLIENT_ID`, `BT_GUILD_ID` from the Discord
     Developer Portal.
   - `BT_STANDUP_CHANNEL` (channel name or id, defaults to `bt-standup`).
   - `BT_MEETINGS_CHANNEL` (channel name or id, defaults to `bt-meetings`).
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for the shared backend.
   - `BT_CREW_DISCORD` mapping crew names to Discord user ids (see below).
   - `TIMEZONE` (defaults to `Europe/London`).
   - Optionally `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` for AI meeting capture.

3. Invite the bot to your server. Use the OAuth2 URL generator with the `bot`
   and `applications.commands` scopes. The bot needs these permissions:
   View Channels, Send Messages, Embed Links, Mention Everyone (for owner
   pings), and Manage Channels (so `/setup` can build the HQ category and
   channels). The combined permissions integer is **85008**. Example invite URL
   (replace `BT_CLIENT_ID`):

   ```
   https://discord.com/api/oauth2/authorize?client_id=BT_CLIENT_ID&scope=bot+applications.commands&permissions=85008
   ```

4. Build the HQ layout. In the server, run:

   ```
   /setup
   ```

   This creates one category named "BrosephTech HQ" and every `bt-` channel
   inside it (see "HQ layout" below). It is idempotent: re-running it skips
   channels that already exist and reports created / already-there / failed. If
   it reports failures, grant the bot Manage Channels and run it again.

5. Register the slash commands with your guild:

   ```
   npm run deploy
   ```

   Re-run this only when the set of slash commands changes.

6. Start the bot:

   ```
   npm start
   ```

## Commands

- `/standup` - post the standup snapshot to the standup channel immediately
  (Manage Server permission only).
- `/board` - an ephemeral board health summary (totals plus per-department
  overdue / stuck / due-soon counts).
- `/mytasks` - an ephemeral view of your own active, overdue, stuck, and
  due-soon cards.
- `/meeting` - capture a meeting into board cards from pasted notes (a summary
  plus action items). Uses the Claude API when `ANTHROPIC_API_KEY` is set,
  otherwise a built-in rule-based parser. Recaps land in the meetings channel.
- `/record start` / `/record stop` - record the voice channel you are in, then
  turn the conversation into suggested tasks. Each speaker is captured on a
  separate track (so a long call is never cut off after the first pause),
  transcribed locally with whisper.cpp, summarized + extracted into tasks by
  Claude, and posted with a pick-list. You select the real tasks and they are
  created as board cards AND Jira issues. `/record status` shows the live state;
  `/record jiracheck` verifies the Jira connection. See "Voice recording" below.
- `/setup` - build the BrosephTech HQ category and its `bt-` channels.
  Idempotent. Needs Manage Channels.
- `/card add` - create a new board card in the Ideas column. Options: title,
  department, assignee, priority, due date. The new card also fires through the
  live feed.
- `/dashboard` - post a live command-center snapshot (KPIs, department health,
  who is behind, blocked, recent meetings/recordings) with a Refresh button. See
  "Dashboard" below for the companion browser view.
- `/blocked` - show every blocked card that still needs unblocking, with owners.
- `/scorecard` - show a crew member's accountability scorecard (defaults to you).
- `/digest` - post the weekly digest to the standup channel right now.

## Voice recording (/record)

`/record` joins your voice channel, records every speaker on a separate audio
track, transcribes locally with whisper.cpp (audio never leaves the machine),
extracts action items with Claude, and lets you approve which become tasks. Each
approved task is created as a board card and pushed to Jira Cloud.

### One-time setup

1. Dependencies are already in `package.json` (`@discordjs/voice`, `prism-media`,
   `opusscript`, `libsodium-wrappers`, `ffmpeg-static`). Just `npm install`.
   ffmpeg ships with the bot via `ffmpeg-static` - nothing to install for it.

2. Install whisper.cpp and a model (this is the only manual step):
   - Get a whisper.cpp build for your OS. On Windows, download a prebuilt
     release from https://github.com/ggerganov/whisper.cpp/releases (the zip
     contains `whisper-cli.exe`), or build it yourself.
   - Download a model, e.g. `ggml-base.en.bin` (good default) from
     https://huggingface.co/ggerganov/whisper.cpp/tree/main. `small.en` /
     `medium.en` are more accurate but slower on CPU.
   - Point the bot at both in `.env`:

     ```
     WHISPER_CMD=C:\tools\whisper.cpp\whisper-cli.exe
     WHISPER_MODEL=C:\tools\whisper.cpp\models\ggml-base.en.bin
     WHISPER_LANG=en
     ```

   Quick sanity check (should print recognized text):
   `"%WHISPER_CMD%" -m "%WHISPER_MODEL%" -f some.wav -oj`

3. Jira Cloud: create an API token at
   https://id.atlassian.com/manage-profile/security/api-tokens and fill `.env`:

   ```
   JIRA_BASE_URL=https://your-company.atlassian.net
   JIRA_EMAIL=you@your-company.com
   JIRA_API_TOKEN=...
   JIRA_PROJECT_KEY=BT
   JIRA_ISSUE_TYPE=Task
   ```

   Then run `/record jiracheck` to confirm the bot can reach the project.

4. The bot needs the **Connect** permission on the voice channel. Re-run
   `npm run deploy` so the new `/record` command is registered, then restart the
   bot. On startup it logs a voice dependency report - if "Encryption Libraries"
   or "Opus Libraries" show none found, recording will produce silence.

### Using it

- Join a voice channel, run `/record start`.
- Talk. Pauses are fine - each speaker is re-subscribed on every utterance, so
  the whole conversation is captured, not just the first sentence.
- Run `/record stop` (optionally `/record stop title:Weekly sync`). The bot
  transcribes locally (this can take a bit on CPU), then posts the summary,
  a transcript preview, and a checklist of suggested tasks.
- Pick the real tasks in the dropdown and hit **Create selected**. Cards land in
  Ideas/Backlog and matching Jira issues are created with links back.

### Notes / limits

- Transcription is CPU-bound; a long call with a big model can take minutes.
  Use `ggml-base.en` for speed, bump to `small/medium` for accuracy.
- Recording requires the bot to hear audio: it joins un-deafened and muted.
- Audio and intermediate WAV/JSON files are written to the OS temp dir and
  deleted right after transcription. Only the text transcript is kept (in
  `bt_meetings`).

## Dashboard

Two views of the same board snapshot (shared `lib/dashboardData.js`):

- **Discord:** `/dashboard` posts a live command-center embed - KPIs (active /
  overdue / stuck / due soon / blocked / shipped this week / open ideas),
  department health, who needs a nudge, work that needs attention, due-soon,
  recent meetings + recordings, and channel metrics. It has a **Refresh** button
  and, when a public URL is configured, an **Open web dashboard** link.
- **Browser:** a dark, auto-refreshing (20s) web dashboard the bot serves
  itself. It starts only when `DASHBOARD_TOKEN` is set.

### Web dashboard setup

```
DASHBOARD_TOKEN=<long random string>   # required to enable it
DASHBOARD_PORT=8787                     # optional
DASHBOARD_HOST=127.0.0.1               # 0.0.0.0 to expose for a tunnel
DASHBOARD_PUBLIC_URL=                  # https URL if you tunnel it (for the Discord link button)
```

Open `http://127.0.0.1:8787/?k=YOUR_TOKEN`. The token is stored in a cookie, so
later visits to `/` just work. It is read-only and uses the bot's Supabase
service role, so never expose the raw port without the token. To share with the
crew, set `DASHBOARD_HOST=0.0.0.0`, run a tunnel (e.g.
`cloudflared tunnel --url http://localhost:8787`), and put the public https URL
in `DASHBOARD_PUBLIC_URL`.

## Live feed

On startup the bot subscribes to Supabase realtime on `bt_content_cards`,
builds a baseline snapshot, and then announces changes as they happen:

- **Card created** -> posted to `bt-board` and the matching `bt-<department>`
  channel, with the owner pinged when mapped.
- **Card shipped** (column becomes `published`) -> celebrated in `bt-wins` and
  echoed to `bt-board`.
- **Card blocked** (blocked flips false to true) -> alerted in `bt-blocked`
  (owner pinged) and echoed to `bt-board`.

The feed debounces rapid changes, refetches the full board, diffs against its
snapshot, and never throws: a missing guild or channel is logged and skipped.
Make sure realtime is enabled for `bt_content_cards` in the Supabase project.

## Schedules

All cron jobs run in `TIMEZONE` (default `Europe/London`) and are individually
wrapped so a failure never crashes the process:

- **Daily standup (09:30):** a board snapshot with active counts per department
  and a "Needs attention" list of overdue and stuck cards, owners pinged.
- **Evening nudge (18:00):** pings each crew member who has overdue or stuck
  cards with their specific card titles.
- **Weekly digest (Monday 09:00):** posts the crew accountability scorecard for
  the week to the standup channel.
- **Blocked sweep (12:00 daily):** finds blocked cards and pings their owners in
  the blocked channel.

## HQ layout

`/setup` creates one category, "BrosephTech HQ", containing:

- `bt-board` - live feed: every new card, ship, and block (the heartbeat).
- `bt-standup` - daily standup embed (09:30).
- `bt-meetings` - `/meeting` recaps land here.
- `bt-blocked` - blocked-card alerts, owners pinged.
- `bt-wins` - cards moved to published / shipped, celebrated.
- `bt-content`, `bt-engineering`, `bt-design`, `bt-marketing`, `bt-ops` -
  per-department channels.

## Crew to Discord id mapping

The bot tracks the crew members defined in `config/crew.js`. To turn a board
name into a real Discord ping, it reads `BT_CREW_DISCORD`, a JSON object mapping
a crew member's board name to their Discord user id:

```
BT_CREW_DISCORD={"Levitate":"111111111111111111","Broseph":"222222222222222222"}
```

- A mapped member gets a real `@mention` in standups, nudges, and feed pings.
- An unmapped member still appears, but as a bold plain name (never a fabricated
  ping).
- `/mytasks` uses the reverse of this map to identify the caller. Anyone not in
  the map is told exactly which line to add (with their own id pre-filled).

Malformed JSON in `BT_CREW_DISCORD` is handled gracefully: the bot logs a
warning and falls back to an empty map rather than crashing.

## Project layout

```
bt-bot/
  package.json
  .env.example
  .gitignore
  index.js
  deploy-commands.js
  scheduler.js
  config/
    crew.js
  lib/
    supabase.js
    board.js
    embeds.js
    channels.js
    hq.js
    feed.js
    scoring.js
  commands/
    standup.js
    board.js
    mytasks.js
    meeting.js
    setup.js
    card.js
    blocked.js
    scorecard.js
    digest.js
  README.md
```
