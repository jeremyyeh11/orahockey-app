# ORA Hockey — Backlog / Feature Queue

> **How this works:**
> - Work starts from **#1** at the top of Backlog. Complete items in order.
> - New feature requests are appended to the **bottom** of the Backlog (insert at back, not front).
> - When a feature is completed, move it to the **Archived** section.
> - Each entry is a self-contained prompt that can be handed off to an implementation agent.
> - Refer to UI elements by what the user sees on the deployed page — not by internal file/component names.

---

## Backlog

---

## 2. Player profile page

Add an individual **player profile** page reachable from the **Squad** tab (player and admin), built using the same reusable modal/panel template defined for the event detail view above.

**Content:**
- Career stats and current-season stats, both displayed.
- Every player's stats are viewable by all players (no access restriction).
- A dedicated space for a player photo, styled like a trading card — to be populated later.
- The photo area is masked to the player only (transparent/no background), with key stats and info overlaid on the masked image appropriately.

Must reference only UI-visible elements (Squad tab, player rows/cards, modal/panel template). Internal data shape TBD.


---

## Archived

### 1. Event modal improvements + match team list ✓ July 2026

Event modal: Delete only in edit mode, smaller Edit/Close buttons, attendance breakdown as list, body scroll lock. Match attendance seeded (378 rows, 27 players × 14 games). Match team list feature: admins can select squad from attending players, save as draft or publish. Published list shows preferred name, position, jersey number. Players see "To be announced" until published. Requires `005_match_team_lists.sql` migration.

### 1. Match / Event detail view ✓ July 2026

Replaced the edit modal on the Schedule tab with a read-first detail modal. Tapping any event opens a modal showing full details (opponent, venue, date/time, competition, result if played). Players can vote attendance from inside the modal. Shows attendance breakdown (attending/maybe/not/hasn't responded) with player names. Additional Information section (notes) shown read-only to players. Admins get Edit→Save/Discard conversion. Created reusable ReadEditModal component for reuse in player profile page.

### 1. Merge stats page into team page ✓ July 2026

Merged the Stats page into the Team page (now "Squad"). Removed old Stats pages and nav links for both player and admin views.
