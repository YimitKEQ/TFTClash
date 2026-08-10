# Operations runbook

Everything needed to run this bot in production, diagnose it when it misbehaves,
and recover it when it stops. For what the bot *does*, see
[`USAGE.md`](USAGE.md); for how it is built, see [`../README.md`](../README.md).

---

## 1. Where it runs

| | |
|---|---|
| Host | GCP VM `merethbot-vm`, zone `us-central1-a`, project `merethbot-falkreath` |
| Process manager | pm2, process name **`baron-bot`** |
| Remote directory | `/home/gubje/baron-bot` |
| Discord app | `BaronTactics#4047` |
| Deploy source | **`D:\dev\tft-clash`** (a second clone of this repo) |
| Fleet status page | mission-control, VM port 4000 |

The VM also runs `merethbot` and `tftclash-bot`. It is a **1 GB, shared box**, so
memory is the scarce resource, not CPU or disk.

Open the fleet dashboard and every bot's own dashboard through one tunnel:

```
gcloud compute ssh merethbot-vm --zone=us-central1-a --project=merethbot-falkreath -- \
  -L 4000:localhost:4000 -L 3000:localhost:3000 -L 3737:localhost:3737 -L 8787:localhost:8787
```

---

## 2. Deploying

```
# 1. commit and push from whichever clone you edited
git push

# 2. update the clone that actually gets packed
cd D:\dev\tft-clash
git pull --ff-only

# 3. deploy
powershell -File D:\dev\mission-control\deploy.ps1 baron

# 4. ONLY if the set of slash commands changed
cd bt-bot
npm run deploy
```

**Two traps in that sequence.**

1. `deploy.ps1` packs `git archive HEAD -- bt-bot`. Uncommitted changes never
   reach the VM, on purpose. Editing in one clone and deploying from the other
   without push and pull ships the old code, with no error at all.
2. `deploy.ps1` does **not** register slash commands. A new command will not
   appear from a deploy alone. Register it *after* the code is live, or the
   command exists in Discord and answers "the application did not respond".

Verify a deploy landed:

```
pm2 describe baron-bot | grep -E 'status|restarts|unstable'
pm2 logs baron-bot --lines 30 --nostream
```

A healthy boot logs every command, then `online as`, then
`[feed] realtime subscription status: SUBSCRIBED`.

---

## 3. Host hardening

These are one-time host settings. They are not in the repo because `deploy.ps1`
drives pm2 by process name rather than an ecosystem file, so they live on the
box. Re-apply them if the VM is ever rebuilt.

**Swap.** The box has 969 MB of RAM and three Node processes. With no swap the
kernel has nowhere to go under a spike and OOM-kills a bot outright.

```
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

**Memory ceiling.** Let a leak restart one bot instead of taking down the host:

```
pm2 delete baron-bot
cd /home/gubje/baron-bot && pm2 start index.js --name baron-bot --max-memory-restart 250M
pm2 save
```

`deploy.ps1`'s `pm2 restart baron-bot --update-env` preserves the flag afterwards.

**Log rotation.** pm2 logs are unbounded by default:

```
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

**Survives reboot.** `pm2 startup` is already enabled (`systemctl is-enabled
pm2-gubje`). `pm2 save` after any process-list change, which `deploy.ps1` does.

---

## 4. Voice transcription

`/record` transcribes locally with whisper.cpp. **The binary and the model must
exist on the host the bot runs on.**

This is the one config that does not survive being copied between machines, and
it caused a real outage: the VM's `.env` was copied from a Windows desktop, so
`WHISPER_CMD` pointed at `C:\tools\whisper.cpp\...\whisper-cli.exe` on a Linux
box. Nothing checked it, so the bot joined calls, recorded them in full, and only
failed at transcription after everyone had hung up. Those meetings were lost.

The bot now refuses up front. On boot it logs one of:

```
[voice] transcriber ready: whisper.cpp reachable, model present, ffmpeg bundled.
[voice] TRANSCRIPTION UNAVAILABLE (transcriber missing): ...
```

and `/record start` declines with the reason rather than recording something it
cannot process. `/record status` reports the same thing on demand.

To make `/record` work on the VM, install whisper.cpp there and point the VM's
own `.env` at the Linux paths:

```
WHISPER_CMD=/home/gubje/whisper.cpp/build/bin/whisper-cli
WHISPER_MODEL=/home/gubje/whisper.cpp/models/ggml-base.en.bin
WHISPER_LANG=en
```

Then restart: `pm2 restart baron-bot --update-env`.

> Sizing warning: transcription is CPU bound and this VM is small and shared.
> `ggml-base.en` is the realistic ceiling here; `small`/`medium` will be slow and
> will compete for memory with the other two bots. If meetings are long, the
> honest options are a bigger VM or a hosted STT, which is a privacy decision
> because it means audio leaves the machine. Until one of those is chosen,
> `/meeting` with pasted notes gives the same recap and tasks without audio.

---

## 5. Diagnosing

**Start here.** Almost everything shows up in these three:

```
pm2 describe baron-bot | grep -E 'status|restarts|unstable'
pm2 logs baron-bot --lines 50 --nostream
free -m
```

| Symptom | Likely cause | Check |
|---|---|---|
| Bot offline, restarts climbing | crash loop | `pm2 logs baron-bot --err --lines 50 --nostream` |
| Bot offline, restarts NOT climbing | OOM kill | `sudo dmesg -T \| grep -i oom`, then `free -m` |
| Feed silent, commands fine | realtime dropped | look for `realtime subscription status` in the log |
| `Failed to read bt_content_cards` | Supabase unreachable or key rotated | `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` in `.env` |
| `/record start` refuses | transcriber not on this host | section 4 |
| Command says "did not respond" | code not deployed, or not registered | section 2, both traps |
| A slash command is missing entirely | never registered | `npm run deploy` |
| Standup posts nothing | channel missing or no permission | run `/setup`, check Manage Channels |
| Duplicate cards in the standup | duplicate rows on the board | section 6 |

**Node version matters.** `@supabase/realtime-js` needs native WebSocket, which
means Node 22+. On Node 20 it throws at client construction and the live feed
never starts. The VM is on v22.

---

## 6. Data

The bot reads and writes `bt_content_cards` in the shared Supabase project using
the **service role** key (the anon key is blocked by RLS migration 069). That key
is server-only and must never reach a client bundle or a committed file.

Duplicate cards on the board surface as duplicate rows in every card the bot
posts, because the bot reports what is there. To find them:

```sql
select title, count(*), array_agg(id)
from bt_content_cards
where column_id not in ('published','archive')
group by title having count(*) > 1;
```

Deleting rows is destructive and is a human decision. Move a duplicate to
`archive` rather than deleting it if you want it out of the way reversibly.

---

## 7. Recovery

```
pm2 restart baron-bot --update-env    # first thing to try
pm2 logs baron-bot --lines 50 --nostream
```

If a deploy broke it, roll back to the previous commit and redeploy:

```
cd D:\dev\tft-clash
git log --oneline -5 -- bt-bot
git checkout <last-good-sha> -- bt-bot   # inspect first
```

The bot holds no state of its own. Everything lives in Supabase, so restarting,
redeploying, or rebuilding the host loses nothing except an in-flight recording.

---

## 8. Routine checks

| When | What |
|---|---|
| After every deploy | `pm2 describe baron-bot`, confirm `SUBSCRIBED` in the log |
| Weekly | `free -m` and `df -h /` on the VM |
| After any `.env` edit | `pm2 restart baron-bot --update-env`, then check the boot log |
| After adding a command | `npm run deploy`, then confirm it appears in Discord |
| Before a meeting that matters | `/record status`, which reports transcriber health |
