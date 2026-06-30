# BrosephTech Bot - Team Guide

This bot lives in our Discord. It records voice meetings, writes a clean recap,
turns the action items into tasks (board + Jira), and shows everything on a live
dashboard. You mostly use two things: **`/record`** in a voice channel, and the
**dashboard** in your browser.

> A prettier version of this guide is served by the bot at
> `http://<host>:<port>/docs` (open the link Lodie shares). There is also a
> one-page printable PDF in this folder.

![The BrosephTech dashboard](images/dashboard-full.png)

---

## 1. Record a meeting

The headline feature. Hop in a voice channel, run two commands, done.

![How /record works](images/record-flow.svg)

1. **Join a voice channel** and type **`/record start`**. Everyone who talks is
   recorded on their own track, so a long call is never cut off after a pause.
2. **Have your meeting.** Talk normally. `/record status` shows who it has heard.
3. **Type `/record stop`** (optionally `/record stop title:Weekly sync`). It
   transcribes locally on the GPU (audio never leaves the machine), then writes
   the recap with AI. A long meeting takes a couple of minutes.
4. **Pick the real tasks** from the checklist and hit **Create selected**. They
   become board cards and Jira issues, and the full recap posts to `#bt-meetings`.

> Transcription is local; only the text recap and transcript are saved. The
> summary uses Claude.

---

## 2. What you get back

A structured recap you can skim, in two places: a card in `#bt-meetings` (the
permanent record) and the top of the dashboard.

![A meeting recap](images/recap.png)

- **TL;DR** - the one line that says what the meeting settled.
- **Decisions** - the firm calls the team committed to.
- **Tasks created** - the action items, each with department, owner, priority.
- **Blockers** - what is stuck or waiting, in red.
- **Full transcript** - attached to the `#bt-meetings` post as a file.

---

## 3. The dashboard

A live, read-only view of everything. It auto-refreshes every 20 seconds. Open
the link Lodie shares (it looks like
`https://<something>.trycloudflare.com/?k=YOUR_TOKEN`); after the first visit it
remembers you. Works on your phone too.

| Section | What it shows |
|---|---|
| **Do next** | one ranked list of what needs action now (overdue, blocked, due today). Start here. |
| **Latest meeting** | the most recent recap: TL;DR, decisions, tasks, blockers, who was in the call. |
| **Jira board** | a live kanban of the KAN project (To Do / In Progress / Done), click a card to open it in Jira. |
| **Meeting history** | expand any past recap. |
| KPIs | active / overdue / stuck / due soon / blocked / shipped / open ideas |
| Workload | active load per department (donut) |
| Board pipeline | card counts from Ideas to Published |
| Crew | each person's load |
| Needs attention | overdue / due-soon / stuck / blocked cards |

> The dashboard is for **seeing**. To **do** things, use the Discord commands.

---

## 4. Commands

Type these in any channel.

- `/record start | stop | status | jiracheck` - record a meeting into a recap +
  tasks; `jiracheck` tests the Jira link.
- `/dashboard` - post a live snapshot to the channel, with a Refresh button.
- `/meeting` - same as a recording but from pasted notes (async, or a meeting
  the bot missed).
- `/card add` - create a board card directly.
- `/mytasks` / `/scorecard` - your own cards, or a crew member's accountability.
- `/board` / `/blocked` - board health, and everything still blocked.
- `/metrics log | show` - log YouTube / TikTok / Patreon numbers.
- `/standup` / `/digest` - post the standup or weekly digest now.

---

## 5. Where your stuff lands

| Thing | Where it goes |
|---|---|
| Meeting recap | `#bt-meetings` (card + transcript file) and the dashboard's "Latest meeting". |
| Tasks you approve | the content board (Ideas) and Jira (KAN), with links back. |
| New cards / ships / blocks | announced live in the HQ channels. |
| Standup & digest | the standup channel, on a schedule and on demand. |

---

## 6. FAQ

**The bot says "Transcribing..." for a while. Stuck?** No - a long meeting takes
a couple of minutes to transcribe, then a few seconds to summarize. Over 5
minutes, ping Lodie.

**No tasks from my meeting?** If there were no clear action items it still posts
the recap with no tasks. If summaries look basic, the AI key may be missing.

**Recap looks cut off in Discord?** The embed shows highlights; the full
transcript is attached to the `#bt-meetings` post.

**Dashboard asks for a token?** Open the full link Lodie shared (ends in `?k=...`).

**Change or complete a task from the dashboard?** Not yet - it is read-only. Use
Discord commands or Jira for changes.

**Does it always listen?** No. Only between `/record start` and `/record stop`,
and the audio is processed locally and deleted right after.

---

## For Lodie (setup)

Config is in `bt-bot/.env`; restart to apply. Keys: `ANTHROPIC_API_KEY` (recaps),
`WHISPER_CMD`/`WHISPER_MODEL` (local transcription), `JIRA_*` (push to KAN),
`DASHBOARD_TOKEN` (web dashboard). Share the dashboard with `npm run tunnel`.
Full setup in [`../README.md`](../README.md).
