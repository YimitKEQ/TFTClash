# **TFT Tournament Process Guide**

---

## **⚙️ SECTION 1 — PRE-TOURNAMENT SETUP**

⚠️ **Get this done at least 2 days before tournament day\!**

### **1.1 — Channel & Category Setup**

1. Rename the **Tourney Category** to the tournament name.  
2. Update **\#tourney-info** with:  
   * Tournament Name  
   * Server (if applicable)  
   * Lobby Player Format (starting size)  
   * Tournament standings/results page link (if applicable)  
   * All relevant dates  
   * Prizing (if applicable)

### **1.2 — Role Setup**

1. **Create the Tourney Player role**  
   * No need to touch permissions or the color.  
2. **Create the Checked In role**  
   * Make it bright **Green**.  
   * Drag it above all the other color roles — just above "Name Colors".

ℹ️ Unless noted, you don't need to mess with channel permissions for these roles.

### **1.3 — Channel Setup**

1. **Add the Checked In role** to the Tourney Category (category-level).  
2. **Add the Tourney Player role** to **\#chatting** — channel only, **not** the whole category.  
3. **Create a \#check-in channel**  
   * **Tourney Player role:** Cannot View \+ Cannot Add Reactions *(you'll flip View Channel on when check-in opens)*  
   * **Checked In role:** Should already have access — double check it's there.  
   * Set **slowmode to 6 hours**.  
4. **Create a \#announcements channel**  
   * Checked In role: Can View, but Cannot Send Messages.  
   * Drag it to the **top** of the tournament category.  
5. **Create 8 Lobby Channels** — no special permissions needed.

---

## **📣 SECTION 1.5 — PRE-TOURNAMENT COMMS**

### **1.5.1 — Announcement Timeline**

| When | What to Post | Where |
| ----- | ----- | ----- |
| X days before (you decide) | Tournament announced — name, date, format, prizing | \#announcements |
| Day of | Tournament is starting — follow the sign-up instructions | \#announcements |

ℹ️ How far in advance you announce is up to you each time — just make sure it's in \#announcements.

### **1.5.2 — Day-Of Flow**

Once the announcement goes out:

1. Track sign-ups in real time as players register.  
2. Manage the waitlist as needed (see Section 2.5).  
3. Kick things off once sign-ups are complete and check-in is done — no hard start time beyond that.

---

## **📋 SECTION 2 — REGISTRATION**

### **2.1 — Manual Registration (bot down? do this instead)**

1. Head to **\#registrations**.  
2. Copy player **Discord IDs** and paste them into the text area — don't hit send yet.  
   * ⚠️ Use **IDs, not usernames** — usernames can ping the wrong thing (like a region).  
3. Wrap each ID like this: `<@IDNUMBER>`  
   * Example: `<@226191434011770881>`  
   * If it shows "Unknown" before sending, don't stress — it usually fixes itself after you send.  
4. Hit **Send** — each player should get tagged.  
5. If someone still shows as "Unknown" after sending, that ID is wrong — find the right one.  
6. Manually give each player the **Tourney Player** role.

---

## 

## 

## **⏳ SECTION 2.5 — WAITLIST**

### **2.5.1 — How the Waitlist Works**

* Registration stays open up to the cap (**64 or 128 players**).  
* Anyone who registers after the cap is hit goes on the **waitlist**, in order.  
* Waitlisted players fill spots as they open up.

### **2.5.2 — Promoting Waitlisted Players**

When a spot opens up (no-show, dropout, etc.):

1. Ping the next person on the waitlist: `@[Player] are you around?`  
2. They've got **5 minutes** to respond.  
   * **Yes** → they're in\! Direct them to check in right away.  
   * **No response** → move to the next person on the list.  
3. Keep going until all spots are filled.

### **2.5.3 — Waitlist Check-In**

* Promoted players still need to **check in** like everyone else.  
* Check-in happens as soon as they confirm they're available.  
* Once check-in closes, the waitlist is done — no more additions after that.

---

## **🚨 SECTION 2.6 — NO-SHOWS, SOFT BANS & DCs**

ℹ️ Since this community is just getting started, we're keeping things fair but not too strict. The warning system gives people a chance while still keeping things accountable.

### **2.6.1 — Subs on Standby**

Always have a few **subs on standby** before each tournament — people who are around and ready to jump in if a spot opens up. These are separate from the waitlist and already confirmed day-of.

### **2.6.2 — Warning System**

| What Happened | What Happens to Them |
| ----- | ----- |
| Registered but missed check-in, no reason | **Soft ban** — waitlisted next tourney |
| Checked in but no-showed without reason | **Soft ban** — waitlisted next tourney |
| Missed check-in but had a valid reason | No penalty — staff notes it |
| Left mid-tourney with a valid reason | No penalty — staff notes it |
| Keeps doing it | Escalate to a full ban |

### **2.6.3 — What's a Soft Ban?**

A soft ban just means you're automatically bumped to the **waitlist** for the next tournament, no matter when you register. You're not banned from playing — just deprioritized once. After you sit out a tourney from the waitlist, it's lifted. Staff keeps track of these and lets the player know via DM or ping.

### **2.6.4 — No-Shows at Game 1**

If someone disappears once lobbies are posted:

1. Ping them in their lobby channel and via DM: `@[Player] are you around?`  
2. They've got **5 minutes** to respond.  
   * **Shows up** → all good, game continues.  
   * **Nothing** → pull the next waitlisted player in (same flow as Section 2.5.2).  
3. **Soft ban** applies unless they come back with a valid reason.

### **2.6.5 — Uneven Lobbies (Multiple No-Shows)**

Lobbies always need exactly **8 players**. If no-shows leave gaps:

1. **Spread the gaps evenly** — take one player from each lobby in rotation so no single lobby takes all the hits.  
   * Example: 3 no-shows across 8 lobbies → 3 separate lobbies each lose 1 player, not 1 lobby losing 3\.  
2. **Fill empty spots with a "random"** — a non-tournament player jumps in to bring the lobby back to 8\.  
   * The random doesn't exist to the bot — not tracked, not scored, completely invisible tournament-wise.  
   * The Lobby Leader handles finding and inviting the random.  
3. **Scoring stays the same** — tournament players get points based on their actual placement, period.  
   * Example: Random takes 1st, tournament player finishes 3rd → that player still gets 7 points for 3rd.  
4. The bot handles rebalancing automatically before Game 1 starts.

ℹ️ **"Filled by a random"** \= any non-tournament filler player. You'll see this term throughout the doc.

### **2.6.6 — Mid-Tournament Dropouts**

If someone bails after Game 1 has started:

* **Had a valid reason** → no penalty, staff notes it.  
* **Just vanished** → **soft ban**.  
* No subs are brought in once games are underway.

### **2.6.7 — Disconnections (DCs)**

We can't tell a DC apart from a rage quit from the outside — so the rule is simple: **did they say something or not?**

* **DC'd and told staff** (lobby channel or DM, by end of the round) → valid reason, no penalty, keeps their placement.  
* **DC'd and said nothing** → treated as a no-reason dropout → **soft ban**.  
* **Keeps DC'ing across tourneys** → staff escalates, even if they always have an excuse.

---

## **✅ SECTION 3 — CHECK-IN**

### **3.1 — Check-In Process**

1. When check-in opens, ping the tourney role in **\#check-in**:  
   * `🔔 @[Tourney Role] CHECK IN BY TYPING HERE ONCE.`  
2. Players check in by sending **one message** in the channel.  
   * Bot auto-gives them the **Checked In** role.  
   * That role unlocks all the tournament channels — lobby chats, announcements, etc.  
3. Bot logs everyone who checks in and tracks their status automatically.

### **3.2 — Manual Check-In (bot down? do this instead)**

1. Manually give each player who messages in \#check-in the **Checked In** role.  
2. Split the work across **2–3 staff members**:  
   * One starts from the **top** of the list.  
   * Another starts from the **bottom**.

---

## **🎮 SECTION 4 — TOURNAMENT FLOW**

### **4.1 — Lobby Randomization**

The bot handles all of this automatically each round:

1. Pulls the current list of active players.  
2. Randomly splits them into groups of 8\.  
3. Randomly picks one player per group as the **Lobby Leader**.  
4. Posts the lobby message to all active channels at the same time.  
5. All games start simultaneously.

ℹ️ The bot already has everyone's Riot IDs from registration — no manual lookup needed.

---

### **4.2 — Lobby Channel Message**

Here's exactly what the bot posts to each lobby channel:

The Lobby Leader will create the lobby.

🎮 Lobby Leader: @\[Player\]  
@\[Player\]  
@\[Player\]  
@\[Player\]  
@\[Player\]  
@\[Player\]  
@\[Player\]  
@\[Player\]

Riot IDs:  
\> RiotID\#TAG  
\> RiotID\#TAG  
\> RiotID\#TAG  
\> RiotID\#TAG  
\> RiotID\#TAG  
\> RiotID\#TAG  
\> RiotID\#TAG  
\> RiotID\#TAG

📸 Once the game is over, 1st or 2nd place please send a screenshot of the results.  
⚠️ Make sure everyone is in the lobby before starting\!  
Feel free to ping staff if anything comes up. GL HF\! 🍀

---

### **4.3 — Results & Round Management**

1. Once games wrap up, the **1st or 2nd place player** drops a screenshot in their lobby channel.  
   * ⚠️ Has to be 1st or 2nd — no other placements.  
2. Bot posts placement buttons in each lobby channel: *"Game X is done\! Pick your placement 👇"*  
   * Players tap their placement (1–8). One tap, that's it.  
3. Bot watches for issues:  
   * Flags if two people pick the same placement.  
   * Tracks how many have submitted per lobby (e.g. "Lobby 3 — 6/8 in").  
4. Once every lobby hits 8/8 clean submissions, the bot locks the round and calculates scores.  
5. Staff reviews and hits `/confirm-round` to release the next round.

---

### **4.4 — Eliminations**

Games 1 & 2 everyone plays — no cuts. First elimination happens after Game 2, then 8 players are cut every round after that until 8 are left for the Finals.

**64-Player Tournament (Standard):**

| Game | Players | Cut | Notes |
| ----- | ----- | ----- | ----- |
| Game 1 | 64 | None | No eliminations |
| Game 2 | 64 | 8 cut | First cut after this game |
| Game 3 | 56 | 8 cut |  |
| Game 4 | 48 | 8 cut |  |
| Game 5 | 40 | 8 cut |  |
| Game 6 | 32 | 8 cut |  |
| Game 7 | 24 | 8 cut |  |
| Game 8 | 16 → 8 | 8 cut → **Finals** | Top 8 play Finals — this is the last game |

ℹ️ Game 8 cuts from 16 down to 8\. Those 8 players ARE the Finals lobby. Game 8 is the last game, winner is crowned from it.

**128-Player Tournament (Occasional):**

| Game | Players | Cut | Notes |
| ----- | ----- | ----- | ----- |
| Game 1 | 128 | None | No eliminations |
| Game 2 | 128 | 32 cut | First cut after this game |
| Game 3 | 96 | 32 cut |  |
| Game 4 | 64 | — | Picks up the standard 64-player schedule from here |
| Game 5 | 56 | 8 cut |  |
| Game 6 | 48 | 8 cut |  |
| Game 7 | 40 | 8 cut |  |
| Game 8 | 32 | 8 cut |  |
| Game 9 | 24 | 8 cut |  |
| Game 10 | 16 → 8 | 8 cut → **Finals** | Top 8 play Finals — last game |

ℹ️ From Game 4 onwards, 128-player tourneys follow the exact same schedule as the standard 64-player format.

**How eliminations work each round (after Game 2):**

1. Bot sorts everyone by **Total Score**, highest to lowest.  
2. Takes the top X scores — those players advance, the rest are out.  
   * Example: 16 players advance → take the top 16 scores, cut everyone else.  
3. Bot checks for **tiebreakers** before anything is finalized (see Section 5).  
4. Bot announces and tags eliminated players in **\#announcements**.  
5. Eliminated players are removed from future lobby assignments automatically.  
6. Bot lines up the next round and goes again from **4.1**.

---

## **⚖️ SECTION 5 — TIEBREAKERS**

### **5.1 — How the Bot Handles Ties**

The bot detects ties automatically after each round and works through the tiebreaker rules on its own. If it can't resolve it, staff gets flagged to make the call.

### **5.2 — Tiebreaker Rules (in order)**

| Priority | Rule | Who Wins |
| ----- | ----- | ----- |
| 1 | Most Top 4 finishes | Higher count advances |
| 2 | Fewest Bot 3s (6th/7th/8th) | Lower count advances |
| 3 | Most 1st place finishes | Higher count advances |
| 4 | Better placement in last game | Higher placement advances |

If it's still tied after all four — staff makes the final call.

---

## **🏛️ SECTION 5.5 — DISPUTES**

### **5.5.1 — The Screenshot is Final**

The screenshot posted by the 1st or 2nd place player is the **official record**. Full stop. It overrules everything else.

### **5.5.2 — Dispute Rules**

| Situation | What Happens |
| ----- | ----- |
| Player says their placement is wrong | Screenshot wins — result stands |
| Player says the screenshot itself is wrong | Staff reviews it — burden of proof is on the person disputing |
| No screenshot was posted | Staff makes the call — this is on the Lobby Leader / 1st or 2nd place player |

### **5.5.3 — Dispute Window**

Disputes need to be raised **before the next round starts**. Once the next round is live, it's done. Raise it by pinging staff in the lobby channel or via DM.

---

## **🏁 SECTION 6 — END OF TOURNAMENT**

The bot handles everything once the Finals are done:

* Winner announcement  
* Role cleanup  
* Channel clearing  
* Removing tournament roles

---

## **🎉 SECTION 6.5 — POST-TOURNAMENT**

### **6.5.1 — Prize Claim Thread**

1. Create a **private thread** in \#tourney-chat.  
2. Name it: `Tournament Name Prize Claim`  
   * Example: `Set 7.5 PBE Tourney Prize Claim`  
3. Drop this message in the thread:

Hello\!

Congrats for winning the \[Tournament Name\]\!  
Please fill out this command to claim your prize:

@Winner 1  
@Winner 2  
@Winner 3  
@Winner 4

Please give some time before these are distributed, likely \~2 weeks or so — if you don't see anything after that, feel free to ask me\!  
If you have questions, please ping me\~

🔧 **To be decided:** Prize claim method will be either a bot command (e.g. `/claimprize`) or a form on the website. Update this message once that's locked in.

---

### **6.5.2 — Winner Roles**

**Standard tournaments — 1st place only:**

1. Open the **Roles** section on their Discord profile.  
2. Check if they have any previous tourney win roles.  
3. Hit **"+"** and search `Tournament wins: #` where `#` \= previous wins \+ 1\.  
   * No previous wins → `Tournament wins: 1`  
   * One previous win → `Tournament wins: 2`  
   * And so on.

ℹ️ Only **1st place** gets the Tournament wins role.

**PBE tournaments:**

| Placement | Role |
| ----- | ----- |
| 1st place | `PBE Champ` |
| 2nd place | `PBE Runner Up` |

**4v4 tournaments:**

* 1st place **team** gets their custom team role.

---

## **📊 SECTION 7 — FORMAT & SCORING**

### **7.1 — Points Per Placement**

Same across all lobbies:

| Placement | Points |
| ----- | ----- |
| 1st | 8 |
| 2nd | 7 |
| 3rd | 6 |
| 4th | 5 |
| 5th | 4 |
| 6th | 3 |
| 7th | 2 |
| 8th | 1 |

ℹ️ Linear placement scoring (official EMEA scale). The platform's `PTS` constant is the single source of truth: `{1:8, 2:7, 3:6, 4:5, 5:4, 6:3, 7:2, 8:1}`. (An earlier draft proposed a 9-to-1 curve that skipped 5 points; that was dropped in favour of the locked linear scale so tournament results stay consistent with season standings.)

---

### **7.2 — Tournament Format by Starting Size**

| Starting Players | Lobby 1 | Lobby 2 | Lobby 3 | Lobby 4 | Lobby 5 (Finals) |
| ----- | ----- | ----- | ----- | ----- | ----- |
| 16 Players | 16 | 16 | 16 | 16 | 8 |
| 24 Players | 24 | 24 | 16 | 16 | 8 |
| 32 Players | 32 | 32 | 16 | 16 | 8 |
| 40 Players | 40 | 40 | 24 | 16 | 8 |
| 48 Players | 48 | 48 | 32 | 16 | 8 |
| 56 Players | 56 | 56 | 32 | 16 | 8 |
| 64 Players | 64 | 64 | 32 | 16 | 8 |

ℹ️ Every path ends with a **Finals lobby of 8**. Eliminations happen after each round until you're down to 8\.

---

## **🤖 SECTION 8 — BOT COMMANDS CHEAT SHEET**

ℹ️ Full breakdown of every bot command — what it does, what it needs, what it spits out, and the logic behind it. Use this as your build reference.

---

### **8.1 — `/register`**

**What it does:** Registers a player into the tournament.

**Triggered by:** Player runs it in the registration channel.

**Needs:**

* Discord ID (auto-grabbed from whoever runs the command)  
* Riot ID (player types this in, e.g. `PlayerName#TAG`)

**Logic:**

* Saves the Discord ID \+ Riot ID to the database.  
* Checks if registration is open — rejects if not.  
* Checks if the cap has been hit:  
  * Spots available → registers them, gives **Tourney Player** role, confirms.  
  * Cap hit → adds them to the **waitlist** in order, lets them know.  
* Rejects duplicate registrations (same Discord ID or Riot ID).

**Outputs:**

* ✅ `You're registered for [Tournament Name]! See you on [Date].`  
* ⏳ `Registration is full — you've been added to the waitlist at position #X.`  
* ❌ `You're already registered.`

---

### **8.2 — `/checkin`**

**What it does:** Marks a player as checked in.

**Triggered by:** Player sends any message in \#check-in during the check-in window (bot listens automatically), or runs `/checkin` explicitly.

**Needs:**

* Discord ID (auto-grabbed)

**Logic:**

* Confirms they have the **Tourney Player** role.  
* Confirms check-in is currently open.  
* Gives them the **Checked In** role.  
* Logs them internally.  
* Rejects duplicates.

**Outputs:**

* ✅ `You're checked in, [Player]! Good luck! 🍀`  
* ❌ `You're not registered for this tournament.`  
* ❌ `Check-in isn't open right now.`

---

### **8.3 — `/waitlist-promote`**

**What it does:** Promotes the next waitlisted player when a spot opens up.

**Triggered by:** Staff runs it when a no-show is confirmed.

**Needs:** Nothing — bot picks the next person in the waitlist queue automatically.

**Logic:**

* Grabs the next player from the waitlist.  
* Pings them: `@[Player] are you around?`  
* Starts a **5-minute timer**.  
  * Responds → gets **Tourney Player** role, directed to check in immediately.  
  * No response in 5 min → moves to the next person and repeats.  
* Logs the promotion internally.

**Outputs:**

* `@[Player] are you around? You've got 5 minutes to claim your spot!`  
* ✅ `[Player] has been promoted from the waitlist — directing them to check in.`  
* ⏭️ `No response from [Player] — moving to the next person on the waitlist.`

---

### **8.4 — `/create-lobbies`**

**What it does:** Randomizes players into lobbies of 8 and posts the lobby message to all active channels at once.

**Triggered by:** Staff runs it once check-in is done.

**Needs:** Player count (bot detects this from checked-in players automatically).

**Logic:**

* Counts checked-in players, figures out how many lobbies to activate:

| Players | Active Lobbies |
| ----- | ----- |
| 64 | 8 |
| 56 | 7 |
| 48 | 6 |
| 40 | 5 |
| 32 | 4 |
| 24 | 3 |
| 16 | 2 |
| 8 | 1 |

* Randomly splits players into groups of 8\.  
* If no-shows left gaps:  
  * Spreads gaps evenly across lobbies (one per lobby at a time).  
  * Leftover empty slots flagged as **"filled by a random"** — Lobby Leader handles inviting them.  
* Randomly assigns a **Lobby Leader** per lobby.  
* Pulls each player's Riot ID from the registration database.  
* Posts the lobby message to all active channels simultaneously — inactive channels get nothing.

**Lobby message posted:**

The Lobby Leader will create the lobby.

🎮 Lobby Leader: @\[Player\]  
@\[Player\]  
@\[Player\]  
@\[Player\]  
@\[Player\]  
@\[Player\]  
@\[Player\]  
@\[Player\]

Riot IDs:  
\> RiotID\#TAG  
\> RiotID\#TAG  
\> RiotID\#TAG  
\> RiotID\#TAG  
\> RiotID\#TAG  
\> RiotID\#TAG  
\> RiotID\#TAG  
\> RiotID\#TAG

📸 Once the game is over, 1st or 2nd place please send a screenshot of the results.  
⚠️ Make sure everyone is in the lobby before starting\!  
Feel free to ping staff if anything comes up. GL HF\! 🍀

**Outputs:**

* ✅ Lobby messages posted to all \[X\] active channels at once.  
* ❌ `Not enough players to create lobbies — check-in might still be going.`

---

### **8.5 — `/round-end`**

**What it does:** Fires off placement submission buttons in all active lobby channels once games are done.

**Triggered by:** Staff runs it when games are wrapping up, or bot auto-triggers when lobby channel activity drops off.

**Needs:** Round number (auto-tracked).

**Logic:**

* Posts in each active lobby channel: `"Game X is done! Pick your placement 👇"`  
  * Buttons: 1st | 2nd | 3rd | 4th | 5th | 6th | 7th | 8th  
* Each player gets one tap, that's it.  
* Tracks submissions per lobby (e.g. "Lobby 3 — 6/8 in").  
* **Duplicate detection:** two people pick the same placement → flags it:  
  * `"⚠️ Conflict in Lobby [X] — two players picked [placement]. Sort it out!"`  
* Waits until every active lobby hits 8/8 clean before moving on.  
* "Filled by a random" slots are skipped — bot only waits on tournament players.

**Outputs:**

* Per lobby: `"Game X is done! Pick your placement 👇"` \+ buttons.  
* Staff view: `"Lobby 1 ✅ | Lobby 2 ✅ | Lobby 3 ⚠️ conflict | Lobby 4 — 5/8 in"`

---

### **8.6 — `/confirm-round`**

**What it does:** Staff signs off on round results before the next round drops.

**Triggered by:** Staff runs it after all lobbies have submitted.

**Needs:** Nothing.

**Logic:**

* Shows staff a full summary of all placements from the round.  
* Staff reviews and confirms (or flags issues).  
* On confirm:  
  * Scores updated for all players.  
  * Eliminations checked (see `/eliminate`).  
  * Next round lobby assignments queued up.

**Outputs:**

* `"Game X Results — confirm to proceed:"` \+ full placement list.  
* ✅ `"Game X confirmed. Scores updated. Running eliminations..."`

---

### **8.7 — `/standings`**

**What it does:** Shows the current tournament standings.

**Triggered by:** Anyone, anytime during the tournament.

**Needs:** Nothing.

**Logic:**

* Pulls cumulative scores for all active players.  
* Sorts highest to lowest.  
* Shows rank, name, and total points.

**Output:**

🏆 Current Standings — Game X

1\. @Player — 24pts  
2\. @Player — 22pts  
3\. @Player — 21pts  
...

---

### **8.8 — `/eliminate`**

**What it does:** Figures out who's out after each round and makes the announcement.

**Triggered by:** Automatically after `/confirm-round`.

**Needs:** Current round number (auto-tracked).

**Logic:**

* Bot already knows the full cut schedule based on starting size:

**64-Player Schedule:**

| After Game | Who Advances |
| ----- | ----- |
| Game 1 | No cut — all 64 move on |
| Game 2 | 56 advance (8 cut) |
| Game 3 | 48 advance (8 cut) |
| Game 4 | 40 advance (8 cut) |
| Game 5 | 32 advance (8 cut) |
| Game 6 | 24 advance (8 cut) |
| Game 7 | 16 advance (8 cut) |
| Game 8 | 8 advance to Finals (8 cut) — **last game** |

**128-Player Schedule:**

| After Game | Who Advances |
| ----- | ----- |
| Game 1 | No cut — all 128 move on |
| Game 2 | 96 advance (32 cut) |
| Game 3 | 64 advance (32 cut) |
| Game 4+ | Follows 64-player schedule above |

* After Game 1 → no cut, straight to the next round.  
* After Game 2+ → sorts by total score, takes the top X, checks tiebreakers, cuts the rest.  
* Eliminated players are removed from future lobbies.  
* Announces cuts in \#announcements with tags.  
* After Finals → triggers end of tournament flow.

**Outputs:**

* After Game 1: `"No cuts this round — everyone moves on to Game 2!"`  
* After Game 2+: `"The following players have been eliminated after Game X:"` \+ tagged list.  
* `"[X] players move on to Game [X+1]. Good luck! 🍀"`  
* After Finals: `"🏆 That's a wrap! Congrats to our winner: @[Player]!"`

---

### **8.9 — `/tiebreaker`**

**What it does:** Sorts out tied scores automatically so eliminations can go through.

**Triggered by:** Auto-called by `/eliminate` when a tie is detected.

**Needs:** Tied players (auto-detected).

**Logic:** Works through these rules in order until the tie breaks:

| Priority | Rule | Who Wins |
| ----- | ----- | ----- |
| 1 | Most Top 4s | Higher count |
| 2 | Fewest Bot 3s (6th/7th/8th) | Lower count |
| 3 | Most 1st places | Higher count |
| 4 | Better placement in last game | Higher placement |

* Tie resolved → moves on automatically.  
* Still tied after all 4 → flags staff to make the call.

**Outputs:**

* ✅ `"Tie broken — [Player] advances, [Player] is out."`  
* ⚠️ `"Still tied between [Player] and [Player] — staff needs to step in."`

---

### **8.10 — `/softban`**

**What it does:** Tracks, applies, and clears soft bans.

**Triggered by:** Staff runs it manually after a tournament.

**Subcommands:**

`/softban add @[Player] [reason]`

* Adds them to the soft ban list.  
* Auto-bumps them to the bottom of the waitlist for next tourney.  
* DMs them: `"You've been soft banned for [reason]. You'll be on the waitlist for the next tournament."`

`/softban remove @[Player]`

* Lifts the ban after they've sat out a tourney on the waitlist.  
* Bot logs it.

`/softban list`

* Shows everyone currently soft banned.

**Outputs:**

* ✅ `"[Player] has been soft banned — they'll be waitlisted next time."`  
* ✅ `"[Player]'s soft ban has been lifted."`  
* List: `"Current soft bans: @Player1, @Player2..."`

---

*Last updated: May 2026*

