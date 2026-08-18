# BrosephTech Bot

> **User guide:** [`docs/USAGE.md`](docs/USAGE.md) - how the crew uses the bot
> (with screenshots). The bot also serves a polished version at `/docs`.

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

- `/guide` - the in-Discord user guide: a one page cheat sheet image plus a
  dropdown with a walkthrough of each topic. `/guide topic:record` jumps
  straight to one. `/guide share:true` posts it publicly (for onboarding);
  by default it is private to the caller.
- `/standup` - post the standup snapshot to the standup channel immediately
  (Manage Server permission only).
- `/board` - the pipeline as a kanban, one column per inline field, with a
  status glyph per card. Optional department filter.
- `/mytasks` - a private view of your own work, opening with the single card to
  pick up next, then blocked / overdue / gone quiet / due soon.
- `/meeting` - capture a meeting into board cards from pasted notes (a summary
  plus action items). Uses the Claude API when `ANTHROPIC_API_KEY` is set,
  otherwise a built-in rule-based parser. Recaps land in the meetings channel.
- `/record start` / `/record stop` - record the voice channel you are in, then
  turn the conversation into suggested tasks. Each speaker is captured on a
  separate track (so a long call is never cut off after the first pause),
  transcribed locally with whisper.cpp, summarized + extracted into tasks by
  Claude, and posted with a pick-list. You select the real tasks and they are
  created as board cards AND Jira issues. `/record status` shows the live state;
  `/record jiracheck` verifies the Jira connection; `/record jirasync` pulls Jira
  status changes onto the board on demand (it also runs every 10 minutes). See
  "Voice recording" and "Jira to board sync" below.
- `/setup` - build the BrosephTech HQ category and its `bt-` channels.
  Idempotent. Needs Manage Channels.
- `/card` - the full write path for a card, all with title autocomplete:
  - `add` create a card in Ideas (title, department, assignee, priority, due).
  - `done` move it to Published.
  - `move` move it to any column.
  - `block` flag it, with an optional reason recorded as a card comment.
  - `unblock` clear the flag.
  - `assign` hand it to a crew member, or unassign it.

  Autocomplete is filtered per verb (`done` offers open cards, `unblock` offers
  blocked ones) and every column change stamps `column_changed_at`, so a card
  you just moved does not immediately read as stuck.
- `/dashboard` - a four part live report: a hero card with the verdict and the
  counters, **Do next**, **Where the work sits**, and **Context**. Has a Refresh
  button. See "Dashboard" below for the companion browser view.
- `/blocked` - show every blocked card that still needs unblocking, with owners.
- `/scorecard` - a crew member's accountability standing (a 0..100 score with a
  plain-language band), defaulting to you.
- `/metrics log` / `/metrics show` - record and read channel growth, with a
  unicode sparkline trend per platform.
- `/digest` - post the weekly digest to the standup channel right now.

## How the cards look

All presentation lives in `lib/ui.js`: the color tokens, the status glyph
vocabulary, the progress meters and sparklines, native Discord timestamps, the
line packer, and the base embed shell. Nothing outside that file should contain
a raw hex color or reimplement the 1024 character field packing.

Two rules worth knowing before editing an embed:

- **Native timestamps (`<t:...:R>`) only work in a description or a field
  value.** Titles, author names, field names and footers render literally, so a
  timestamp in one of those ships as visible markup. `test/render.test.js`
  enforces this.
- **A field value can never be empty and never exceed 1024 characters.** Use
  `pack()`, which keeps whole lines (so a mention is never severed) and reports
  what it dropped.

To see every card without posting to Discord:

```
npm run preview     # writes docs/images/embed-preview.png
```

## Tests

```
npm test
```

Node's built-in runner, no dependencies. Covers the card classification engine
(`lib/board.js`), the scorecard weights (`lib/scoring.js`), the autocomplete
ranking (`lib/cards.js`), every helper in `lib/ui.js`, and a render pass that
builds every embed (including a 200 card disaster board) and every slash command
definition. That last one is the check that `npm run deploy` cannot fail on a
malformed command.

## Voice recording (/record)

`/record` joins your voice channel, records every speaker on a separate audio
track, transcribes it (locally with whisper.cpp, or via a hosted API when
  `GROQ_API_KEY` is set, in which case the audio leaves the machine),
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

   If the board already has cards from before the Jira link existed, connect
   them once with `node scripts/backfill-jira-links.js` (dry run) then
   `--apply`. See "Jira to board sync" below.

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

## Jira to board sync

Move a ticket in Jira and its board card follows. A card created by `/record`
stores the key of the issue made from the same task (`jira_key`), and a cron
pass every 10 minutes reconciles the two.

| Jira status category | Board column        |
|----------------------|---------------------|
| To Do (`new`)        | `ideas` (Backlog)   |
| In Progress          | `production`        |
| Done                 | `published`         |

Rules worth knowing:

- **Edge triggered.** Each card remembers the Jira category it last synced with
  (`jira_status`). A pass only acts when Jira has actually changed since. Move a
  card by hand on the board and the sync leaves it there. Whichever side moved
  last wins, and neither side fights the other.
- **One direction.** Jira drives the board, never the reverse. Pushing board
  moves back into Jira needs conflict rules and is deliberately out of scope.
- **Archive is respected.** A card parked in Archive is never dragged back into
  the pipeline; the pass just records the new Jira category and moves on.
- **Announced, not silent.** When a pass moves anything it posts to the standup
  channel. A quiet pass says nothing. `/record jirasync` runs it on demand and
  always answers, including "nothing to move".

### Commands and scripts

```
/record jiracheck                            verify the credentials + project
/record jirasync                             run a sync pass right now
node scripts/backfill-jira-links.js          dry run: what would be linked
node scripts/backfill-jira-links.js --apply  write the links
npm run verify:jirasync                      live end-to-end proof
```

`backfill-jira-links.js` links pre-existing cards to their issues by title, and
only when a title maps to exactly one card and exactly one issue. Anything
ambiguous (the same title created twice) is reported and left unlinked, because
a card wired to the wrong ticket moves the wrong work and nobody notices.

It links **without** moving anything by default. When this first ran on the live
board, Jira was behind: 24 of 40 issues still sat in "Idea" while their cards had
already reached Review and Done. Forcing the board to match would have thrown
that progress away. Pass `--reconcile` only if you really do want Jira's current
state stamped over the board.

`npm run verify:jirasync` creates a throwaway issue and card, drives them through
Done and back, checks the board followed, and deletes both. It touches no real
work and is the fastest way to confirm the whole path after a config change.

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
service role, so never expose the raw port without the token.

### Letting the crew use it

The dashboard is view-only, so the whole crew can safely share one link. With
`DASHBOARD_HOST=0.0.0.0` set (it is by default now):

- **Same network (LAN):** they open `http://<your-LAN-ip>:8787/?k=YOUR_TOKEN`.
- **Anywhere (tunnel):** run `npm run tunnel` in `bt-bot/`. It prints a public
  `https://<random>.trycloudflare.com` URL (no account, no install beyond the
  one-time npx download). Share that URL plus `?k=YOUR_TOKEN`. Put it in
  `DASHBOARD_PUBLIC_URL` so the Discord `/dashboard` command shows an
  **Open web dashboard** button.

The quick-tunnel URL changes each run. For a permanent address, create a named
Cloudflare tunnel (free, needs a domain) or host the bot on a small VPS, then set
`DASHBOARD_PUBLIC_URL` to that stable URL. Actions (creating tasks, scoring,
etc.) stay in Discord; the web dashboard is the shared read-only view.

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
  index.js               -- client, command loader, interaction router
  deploy-commands.js     -- register the slash commands with the guild
  scheduler.js           -- standup / nudge / digest / blocked-sweep crons
  config/
    crew.js              -- roster, departments, Discord id mapping
  lib/
    ui.js                -- THE design system: colors, glyphs, meters, packing
    supabase.js
    board.js             -- card classification (overdue / stuck / due soon)
    cards.js             -- single-card reads and writes behind /card
    embeds.js            -- standup card and evening nudge
    channels.js
    hq.js                -- the HQ channel layout and stage vocabulary
    feed.js              -- realtime board feed
    scoring.js           -- scorecards, standings, digest, blocked sweep
    dashboardData.js     -- the shared overview snapshot
    jiraSync.js          -- Jira status changes back onto the board
    jira.js  extract.js  recorder.js  transcribe.js  voiceLog.js
  commands/
    guide.js  dashboard.js  board.js  mytasks.js  blocked.js  scorecard.js
    card.js  metrics.js  meeting.js  record.js  standup.js  digest.js  setup.js
  scripts/
    render-guide.js      -- docs/guide-card.html  ->  docs/images/guide-card.png
    preview-embeds.js    -- draw every embed as a PNG, no Discord needed
  test/                  -- node --test, no dependencies
  web/                   -- the browser dashboard
  docs/                  -- USAGE.md, the served /docs site, and the artwork
  README.md
```

## Deploying

The bot runs on the fleet VM under pm2 as `baron-bot`, deployed from
`D:\dev\tft-clash` (a second clone of this repo) by
`D:\dev\mission-control\deploy.ps1`:

```
powershell -File D:\dev\mission-control\deploy.ps1 baron
```

That script packs `git archive HEAD -- bt-bot`, so **only committed state ever
reaches the VM**. Commit and push here, pull in `D:\dev\tft-clash`, then deploy.

It does **not** register slash commands. After adding or changing a command,
also run `npm run deploy` once (from anywhere with the `.env`, it only talks to
the Discord REST API).
