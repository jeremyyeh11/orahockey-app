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

## 1. Match / Event detail view

Replace the current edit modal that appears when an event is clicked on the **Schedule** tab (player and admin) with a read-first **detail modal**. Tapping any event/fixture opens a modal showing full details (opponent, venue, date/time, competition, result if played, attendance status).

**View mode (default):**
- Read-only display of the event details.
- Admins see an **Edit** button. Players do not.
- Attendance voting is available to players from within this modal.
- Show the attending / maybe / not attending / hasn't responded breakdown, in that order, listing other players per state.
- A section for **Additional Information** — read-only to players. Admins can add/modify it via the Edit button.

**Edit mode (admins only, via Edit button):**
- Clicking **Edit** converts the read fields into editable fields. The Edit button is replaced by a **Save** button (persists changes) and a **Discard changes** button (reverts without saving) sitting next to it.

**Reusable component:**
- The modal's read→edit interaction pattern (read view, Edit→Save/Discard conversion, field styling) must be saved as a generic, non-event-specific component so it can be reused as a template for other entities (see #2).

Must reference only UI-visible elements (Schedule tab, fixture cards, modal). Internal data shape TBD.


## 2. Player profile page

Add an individual **player profile** page reachable from the **Squad** tab (player and admin), built using the same reusable modal/panel template from #1.

**Content:**
- Career stats and current-season stats, both displayed.
- Every player's stats are viewable by all players (no access restriction).
- A dedicated space for a player photo, styled like a trading card — to be populated later.
- The photo area is masked to the player only (transparent/no background), with key stats and info overlaid on the masked image appropriately.

Must reference only UI-visible elements (Squad tab, player rows/cards, modal/panel template). Internal data shape TBD.


---

## Archived

### 1. Merge stats page into team page ✓ July 2026

Merged the Stats page into the Team page (now "Squad"). Removed old Stats pages and nav links for both player and admin views.
