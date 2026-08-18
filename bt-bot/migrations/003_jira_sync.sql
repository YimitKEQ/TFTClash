-- Link a board card to the Jira issue created from the same meeting task, so a
-- status change in Jira can flow back onto the board.
--
-- Why: /record created a card AND a Jira issue from every approved task, but
-- the two records never knew about each other. Nothing stored the issue key.
-- Marking a ticket Done in Jira therefore did nothing at all: the card sat in
-- its old column forever, kept counting as overdue/stuck, and kept generating
-- nudges for work that had already shipped.
--
-- jira_status holds the Jira status CATEGORY we last applied to this card
-- ('new' | 'indeterminate' | 'done'). The sync is edge triggered: it only acts
-- when Jira's current category differs from this stored value. That is what
-- lets a human move a card on the board without the next sync pass dragging it
-- straight back to wherever Jira happens to think it lives.
--
-- Idempotent.

begin;

alter table if exists public.bt_content_cards
  add column if not exists jira_key text,
  add column if not exists jira_status text,
  add column if not exists jira_synced_at timestamptz;

-- The sync pass reads only the linked cards, and the backfill looks a card up
-- by key, so both paths want this index rather than a full table scan.
create index if not exists bt_content_cards_jira_key_idx
  on public.bt_content_cards (jira_key)
  where jira_key is not null;

-- One card per issue. A duplicate link would make the sync move two cards for
-- one Jira transition, which is exactly the kind of silent double write that is
-- painful to notice and worse to unpick later.
create unique index if not exists bt_content_cards_jira_key_unique
  on public.bt_content_cards (jira_key)
  where jira_key is not null;

commit;
