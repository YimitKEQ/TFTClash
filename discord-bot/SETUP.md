# TFT Clash Discord Bot — Setup Guide

## The only manual steps (5 minutes total)

### Step 1 — Create a Discord Application (2 min)
1. Go to https://discord.com/developers/applications
2. Click **New Application** → name it `TFT Clash Bot`
3. Go to **Bot** tab → click **Add Bot**
4. Under **Token** → click **Reset Token** → copy it (save for .env)
5. Scroll down → enable **Server Members Intent** and **Message Content Intent**
6. Go to **OAuth2 → URL Generator**
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Administrator` (simplest for setup — can restrict later)
7. Copy the generated URL → open it → invite bot to your server

### Step 2 — Get your IDs (1 min)
- **Application ID**: Settings → General Information → copy Application ID
- **Server ID**: In Discord, right-click your server icon → Copy Server ID
  (You need Developer Mode on: User Settings → Advanced → Developer Mode)

### Step 3 — Configure .env (1 min)
```bash
cd discord-bot
cp .env.example .env
```
Edit `.env` and fill in:
```
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_id
GUILD_ID=your_server_id
TIMEZONE=Europe/London
```

### Step 4 — Run it (1 min)
```bash
cd discord-bot
npm install
node setup.js          # builds entire server structure (run once)
node deploy-commands.js # registers slash commands (run once)
node index.js          # starts the bot (keep this running)
```

---

## That's it. The bot will:
- Build all channels and categories automatically
- Assign @Player role to everyone who joins
- Post weekly standings every Monday at 9am
- Post clash reminders 24h and 1h before each event
- Respond to `/profile`, `/standings`, `/clash`, `/link account`
- Allow hosts to post results with `/post-results`

## To keep the bot alive 24/7
```bash
npm install -g pm2
pm2 start index.js --name tft-clash-bot
pm2 save
pm2 startup   # follow the output instructions
```

## Adjusting clash reminder times
Edit `scheduler.js` — the cron expressions use standard 5-field format:
```
'0 20 * * 6'  →  Saturday 8:00 PM
'0 19 * * 0'  →  Sunday 7:00 PM
```
Change to match your actual clash day/time.
