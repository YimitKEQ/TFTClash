# BrosephTech Bot

An accountability Discord bot for the BrosephTech crew. It reads the shared
content board (`bt_content_cards`) and keeps the crew honest by posting a daily
standup and pinging the owners of cards that are overdue, stuck, or due soon.

## What it does

- **Daily standup (09:30):** posts a board snapshot with active counts per
  department and a "Needs attention" list of overdue and stuck cards, with the
  owners pinged.
- **Evening nudge (18:00):** pings each crew member who has overdue or stuck
  cards with their specific card titles.
- **`/standup`:** posts the standup to the standup channel immediately
  (Manage Server permission only).
- **`/board`:** an ephemeral board health summary (totals plus per department
  overdue / stuck / due-soon counts).
- **`/mytasks`:** an ephemeral view of your own active, overdue, stuck, and
  due-soon cards.

## Separation from TFT Clash

This is a completely separate project from the TFT Clash Discord bot in
`discord-bot/`. It has its own `package.json`, its own `.env`, its own slash
commands, and runs as its own process on its own server. It does not import
from, depend on, or modify anything in `discord-bot/`. The only thing the two
share is the Supabase project, and this bot only ever reads `bt_content_cards`.

## Setup

1. Install dependencies:

   ```
   npm install
   ```

2. Create your environment file:

   ```
   cp .env.example .env
   ```

   Then fill in:
   - `BT_DISCORD_TOKEN`, `BT_CLIENT_ID`, `BT_GUILD_ID` from the Discord
     Developer Portal.
   - `BT_STANDUP_CHANNEL` (channel name or id, defaults to `bt-standup`).
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for the shared backend.
   - `BT_CREW_DISCORD` mapping crew names to Discord user ids (see below).
   - `TIMEZONE` (defaults to `Europe/London`).

3. Register the slash commands with your guild:

   ```
   npm run deploy
   ```

4. Start the bot:

   ```
   npm start
   ```

The bot needs the Server Members Privileged Intent enabled in the Developer
Portal, and permission to read and send messages in the standup channel.

## Crew to Discord id mapping

The bot tracks the eight crew members defined in `config/crew.js`. To turn a
board name into a real Discord ping, it reads `BT_CREW_DISCORD`, a JSON object
mapping a crew member's board name to their Discord user id:

```
BT_CREW_DISCORD={"Levitate":"111111111111111111","Broseph":"222222222222222222"}
```

- A mapped member gets a real `@mention` in standups and nudges.
- An unmapped member still appears, but as a bold plain name (never a fabricated
  ping).
- `/mytasks` uses the reverse of this map to identify the caller. Anyone not in
  the map is told exactly which line to add (with their own id pre-filled).

Malformed JSON in `BT_CREW_DISCORD` is handled gracefully: the bot logs a
warning and falls back to an empty map rather than crashing.

## Running on your own server / process

This bot is a single long-lived Node process. Run it anywhere Node 18+ is
available, independently of the TFT Clash bot:

- Bare process: `npm start`.
- With a process manager (recommended for uptime):

  ```
  pm2 start index.js --name brosephtech-bot
  ```

- As a container or systemd service: run `node index.js` with the `.env`
  present in the working directory.

Re-run `npm run deploy` only when the set of slash commands changes.

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
  commands/
    standup.js
    board.js
    mytasks.js
  README.md
```
