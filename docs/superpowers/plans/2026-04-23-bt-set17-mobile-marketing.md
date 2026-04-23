# BrosephTech Sprint 4: Set 17 Accuracy + Mobile + Marketing Lab

**Goal:** Make the command center accurate to TFT Set 17 (Space Gods, launched 2026-04-15), thumb-usable on mobile, and add a Marketing Lab tab that applies Corey Haines / content-engine principles (one CTA, hooks first, distribution > creation, platform-native).

**Architecture:**
- New `src/lib/btset17.js` as single source of truth: patch dates, champion roster, traits, mechanic terms.
- Bottom tab bar appears on `sm:` screens; modals go full-screen on mobile.
- New `BTMarketing.jsx` tab with three tools: Repurposer, Description Builder, Hook Sharpener.
- Touch-friendly tap-to-place pattern in tier lists (in addition to drag).

**Tech Stack:** React 18 + Tailwind CSS 3 + Supabase. No new dependencies.

---

## Set 17 Source of Truth

**Set:** Space Gods - launched 2026-04-15, runs through ~July 2026.
**Mechanic:** Realm of the Gods (replaces carousels). Players choose Minor Blessings, votes accumulate, top God grants a God Boon at 4-7. Pool of 9 Gods.

**Patch schedule (2026):**
| ID    | Date         | Notes                  |
|-------|--------------|------------------------|
| 17.1  | Wed Apr 15   | Set 17 launch          |
| 17.2  | Wed Apr 29   | First balance          |
| 17.3  | Wed May 13   |                        |
| 17.4  | Thu May 28   | Mid-set update         |
| 17.5  | Wed Jun 10   |                        |
| 17.6  | Wed Jun 24   |                        |
| 17.7  | Wed Jul 15   | Set close              |

**Champion roster (Set 17 Space Gods):**
- 1-cost: Aatrox, Briar, Caitlyn, Cho'Gath, Ezreal, Leona, Lissandra, Nasus, Poppy, Rek'Sai, Talon, Teemo, Twisted Fate, Veigar
- 2-cost: Akali, Bel'Veth, Gnar, Gragas, Gwen, Jax, Jinx, Meepsie, Milio, Mordekaiser, Pantheon, Pyke, Zoe
- 3-cost: Aurora, Diana, Fizz, Illaoi, Kai'Sa, Lulu, Maokai, Miss Fortune, Ornn, Rhaast, Samira, Urgot, Viktor
- 4-cost: Aurelion Sol, Corki, Karma, Kindred, LeBlanc, Master Yi, Nami, Nunu, Rammus, Riven, Tahm Kench, The Mighty Mech, Xayah
- 5-cost: Bard, Blitzcrank, Fiora, Graves, Jhin, Morgana, Shen, Sona, Vex, Zed

**Traits (Set 17):** Anima, Arbiter, Bulwark, Commander, Dark Lady, Dark Star, Divine Duelist, Doomer, Eradicator, Factory New, Galaxy Hunter, Gun Goddess, Mecha, Meeple, N.O.V.A., Oracle, Party Animal, Primordian, Psionic, Redeemer, Space Groove, Stargazer, Timebreaker, Bastion, Brawler, Challenger, Channeler, Fateweaver, Marauder, Replicator, Rogue, Shepherd, Sniper, Vanguard, Voyager.

**Set-specific terms for scoreTitle:** "set 17", "space gods", "realm of the gods", "minor blessing", "god boon", "stargazer", "psionic", "mecha", "dark star", "space groove" (etc).

---

## Phase 1: Set 17 Accuracy

**Files:**
- Create: `src/lib/btset17.js` (export CURRENT_SET, PATCHES, CHAMPIONS, TRAITS, MECHANIC_TERMS)
- Modify: `src/screens/brosephtech/BTPatchBanner.jsx` (import from lib, drop hardcoded)
- Modify: `src/screens/brosephtech/BTSchedule.jsx` (import PATCHES from lib)
- Modify: `src/screens/brosephtech/BTTierLists.jsx` (import CHAMPIONS from lib, replace 53-champ list, fix placeholder text)
- Modify: `src/screens/brosephtech/BTBoard.jsx` (import MECHANIC_TERMS, append to TFT_TERMS, fix patch_id placeholder text)

---

## Phase 2: Mobile Functionality

**Bottom nav (the big one):**
- In `BrosephTechScreen.jsx`, render top tabs as `hidden sm:flex` and add a fixed bottom tab bar visible only on mobile (`fixed bottom-0 inset-x-0 sm:hidden`).
- Pad the page bottom so content isn't hidden behind the bar.
- Bottom bar shows icons + tiny label, 5 tabs visible (split: board/schedule/studio/tierlists/more).

**Modal full-screen on mobile:**
- `CardModal` in BTBoard: change container to `inset-0 sm:p-4` and inner panel to `w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-2xl rounded-none`.
- `CardDetailDrawer` in BTSchedule: already a drawer, but expand width to `max-w-md sm:max-w-md w-full`.

**Board mobile list view:**
- Add view toggle (Kanban / List) in BTBoard header.
- List view: cards grouped by column, single column, swipe-friendly (no horizontal scroll).
- Default to List on mobile (`window.innerWidth < 640` initial state).

**Schedule mobile week view:**
- When viewport is small, render a 7-row vertical list (one row per day, this week + next) instead of the 7x6 grid.
- Toggle button on header.

**Tier Lists touch:**
- In addition to drag-drop, add tap-to-select pattern: tap a champion in picker → highlights → tap a tier row → places. Tap selected champ in tier → returns to picker.
- Visual feedback: selected champ gets gold ring.

**Card modal layout:**
- Stack the 2-col grids on `sm:` (already responsive via `grid-cols-2` - keep but ensure no overflow on 320px).
- Increase touch targets: button height min `h-10` on mobile.

---

## Phase 3: Marketing Lab

**New file:** `src/screens/brosephtech/BTMarketing.jsx`
**New tab:** Insert as 4th tab (between Studio and Tier Lists), icon `campaign`, label `Marketing Lab`.

**Sub-tools:**

### A) Repurposer
- Pick a published or in-review card → inject brief into templates.
- Output 5 platform-native variants:
  - X thread (5-7 tweets, hook tweet first, no hashtags in body)
  - TikTok script (3s hook + 25s body + 2s CTA)
  - LinkedIn post (lesson framing, short paragraphs)
  - Reddit r/CompetitiveTFT post (data-forward title + body)
  - Newsletter blurb (200 words, scannable, one CTA)
- Each output has a Copy button.
- Templates use brief.hookLine, brief.talkingPoints, brief.cta, card.title, card.patch_id.

### B) Description Builder
- Inputs: card (with brief), optional chapter timestamps, primary CTA selector (one of: subscribe, newsletter, watch-next, comment).
- Output: full YouTube/TikTok description with:
  - Hook line (first 100 chars - SEO matters)
  - 1-3 sentence summary
  - Chapters section (00:00 format)
  - Links section (newsletter + channel + related vid placeholder)
  - One clear CTA (the selected primary)
  - 5-8 hashtags from MECHANIC_TERMS + champ names found in title
- Copy button + character count display.

### C) Hook Sharpener
- Live scoring (reuses scoreTitle pattern, tuned for opener line not titles).
- Take a draft hook → render 3 sharpened variants in different angles:
  - Curiosity (question or twist)
  - Contrarian (against meta opinion)
  - Specific (with numbers or named champ)
- Each variant gets its own score.
- Inline tip: "First 3 seconds decide retention. Promise a payoff or pose a question."

---

## Phase 4: Polish + Build + Push

- Update BTBoard `KanbanCard` to work in both kanban and list view layouts.
- Update header order: Board, Schedule, Studio, Marketing Lab, Tier Lists, Metrics, SOPs.
- Run `npm run build`, fix any errors.
- Single commit with clear message: "feat(brosephtech): set 17 accuracy + mobile + marketing lab".
- Push to master.

---

## Self-Review Checklist

- [ ] All Set 14 references removed from BT files.
- [ ] Champion roster matches Set 17 Space Gods.
- [ ] Patch dates match official Riot 2026 schedule.
- [ ] Bottom tab bar works on mobile, top tabs hidden on sm:.
- [ ] CardModal full-screen on mobile.
- [ ] Board list view default on mobile.
- [ ] Schedule week list view available on mobile.
- [ ] Tier Lists work with touch (tap pattern).
- [ ] Marketing Lab tab renders with 3 sub-tools.
- [ ] Each repurposer output has copy button.
- [ ] Description builder enforces one CTA.
- [ ] Hook sharpener gives 3 angled variants.
- [ ] Build passes.
