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

Add a dedicated detail view for a single match or event. From the **Schedule** tab (player and admin), each scheduled fixture/result should be tappable and open a focused view showing: opponent, venue, date/time, competition, result (if played), attendance status for the logged-in player, and any lineup/scoreline detail available. Must reference only UI-visible elements (Schedule tab, fixture cards). Internal data shape TBD.

*Details to be filled in: what exactly lives on this screen, whether goals/lineups are shown, deep-link/share behaviour.*

## 2. Player profile page

Add an individual **player profile** page, reachable from the **Squad** tab (player and admin). The profile should consolidate a single player's season at a glance: appearances, goals, attendance record, player-of-the-match awards, and position. Must reference only UI-visible elements (Squad tab, player rows/cards). Internal data shape TBD.

*Details to be filled in: which stats surface, whether it's viewable for any player or only self, admin vs player scope.*

---

## Archived

### 1. Merge stats page into team page ✓ July 2026

Merged the Stats page into the Team page (now "Squad"). Removed old Stats pages and nav links for both player and admin views.
