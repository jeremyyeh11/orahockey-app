# ORA Hockey — Changelog / Feature Queue

> **How this works:**
> - Work starts from **#1** at the top of Backlog. Complete items in order.
> - New feature requests are appended to the **bottom** of the Backlog (insert at back, not front).
> - When a feature is completed, move it to the **Archived** section.
> - Each entry is a self-contained prompt that can be handed off to an implementation agent.
> - Refer to UI elements by what the user sees on the deployed page — not by internal file/component names.

---

## Backlog

### 1. Merge stats page into team page

**Prompt:** Merge the Stats page into the Team page. Rename the combined page to "Squad". Remove the old Stats page (both player-facing and admin views) and their nav links.

**Requirements:**
- Preserve the existing Squad (formerly Team) page layout — the roster cards, top-bar, bottom nav, and overall visual structure stay the same.
- Add a **season selector dropdown** at the top of the page. When a season is selected, only show players who were active/registered for that season.
- Display each player's stats **inline inside their roster card**, below their name and position badges. Stats should be compact and legible on mobile — not in a separate table.
- Place the **Player of the Season (POTS) race card** at the top of the page, above the squad list.
- **"My" stats** (personal season summary cards and per-game breakdown) must NOT appear on this page — they will be a separate feature later.
- Update the bottom navigation: remove the Stats tab. Change "Team" to "Squad".

---

## Archived

_Completed features live here, moved from Backlog._
