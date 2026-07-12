# ORA Hockey — Backlog / Feature Queue

> **How this works:**
> - Work starts from the **top of Backlog** (the lowest-numbered open item). Complete items in order.
> - New feature requests are appended to the **bottom** of the Backlog (insert at back, not front).
> - When a feature is completed, move it to the **Archived** section.
> - Each entry is a self-contained prompt that can be handed off to an implementation agent.
> - Refer to UI elements by what the user sees on the deployed page — not by internal file/component names.
> - **Numbering runs as a single continuous sequence and is never reset.** Every new item gets the next number in line — when the current highest is `#N`, the next item is `#N+1` (use decimals like `#2.1` only to split an existing item into sub-parts, never to renumber the sequence). Archived items keep the number they had when completed. Even when the Backlog is empty, the counter keeps its value, so the next item opened continues from where it left off (e.g. after `#3` the next is `#4`).

---

## Backlog

## 3. Player profile page

Add an individual **player profile** page reachable from the **Squad** tab (player and admin), built using the same reusable modal/panel template defined for the event detail view above.

**Content:**
- Career stats and current-season stats, both displayed.
- Every player's stats are viewable by all players (no access restriction).
- A dedicated space for a player photo, styled like a trading card — to be populated later.
- The photo area is masked to the player only (transparent/no background), with key stats and info overlaid on the masked image appropriately.

Must reference only UI-visible elements (Squad tab, player rows/cards, modal/panel template). Internal data shape TBD.

## 4. Update match result

Let players record a played match's result and goals/cards after the match, separate from match creation.

- **Separate score from creation:** when an admin creates a new match (the **Add Game** action on the Schedule tab), the score fields are NOT part of the creation form. The result is entered later through the flow below.
- **Update result button:** on the match detail view (the detail modal opened from the Schedule tab), add an **Update result** button inline with the match title, aligned right. Show it for matches only (not training sessions). The button is disabled (greyed out) until the match's date/time has passed.
- **Result entry UI** (opens on tap):
  - The score (us – them) shows at the top, **read-only**. It is derived from the goal rows entered below, not typed directly.
  - Below it: a **+ Goal** button and a **+ Card** button.
  - **+ Goal** adds a row to a goals table: select **scorer** (from the match team list only) and **assist**.
    - The assist dropdown lists, in order: `PC` (penalty corner), `PS` (penalty stroke), then players (from the match team list only).
  - **+ Card** adds a row to a cards table: select **player** (from the match team list only) and **card type**.
  - **All players** (not just admins) can add goals and cards for a played match.

Must reference only UI-visible elements (Schedule tab, Add Game, match detail modal, match team list). Internal data shape TBD.

*Open questions to resolve at build time:*
- *Goals/cards are not currently stored as per-event rows — `player_stats` holds goals_fg/goals_pc/goals_ps + assists, and there is no cards table. This needs a goals (and cards) table + a migration, like `005_match_team_lists.sql`. Confirm whether the stored `games` score is computed from goal rows or still maintained separately.*
- *RLS: opening result entry to all players requires a new policy (authenticated users may insert goal/card rows for played matches). Admin-only event editing stays unchanged.*
- *Confirm card types (yellow / red / second yellow?).*
- *If the match team list is not yet published ("To be announced"), can players still pick scorers? Edge case to decide.*

---

## Archived

### 1. Merge stats page into team page ✓ July 2026

Merged the Stats page into the Team page (now "Squad"). Removed old Stats pages and nav links for both player and admin views.

### 2. Match / Event detail view ✓ July 2026

Replaced the edit modal on the Schedule tab with a read-first detail modal. Tapping any event opens a modal showing full details (opponent, venue, date/time, competition, result if played). Players can vote attendance from inside the modal. Shows attendance breakdown (attending/maybe/not/hasn't responded) with player names. Additional Information section (notes) shown read-only to players. Admins get Edit→Save/Discard conversion. Created reusable ReadEditModal component for reuse in player profile page.

### 2.1 Event modal improvements + match team list ✓ July 2026

Event modal: Delete only in edit mode, smaller Edit/Close buttons, attendance breakdown as list, body scroll lock. Match attendance seeded (378 rows, 27 players × 14 games). Match team list feature: admins can select squad from attending players, save as draft or publish. Published list shows preferred name, position, jersey number. Players see "To be announced" until published. Requires `005_match_team_lists.sql` migration.

