# ORA Hockey — Changelog / Feature Queue

> **How this works:**
> - New features go to the **Backlog** section (bottom).
> - When a feature is completed by an implementation agent, move it to **Archived**.
> - Each entry is a self-contained prompt that can be handed off.

---

## Archived

_Completed features live here, moved from Backlog._

---

## Backlog

### 1. Merge stats page into team page

**Prompt:** Merge the `/dashboard/stats` page into `/dashboard/team`. Rename the combined page to "Squad" (instead of "Team"). Deprecate and remove the old `/dashboard/stats` page and its nav link. Remove the `/admin/stats` page and its nav link too — the admin view should also be merged.

**Requirements:**
- **Preserve the existing Team (now "Squad") page layout** — keep the roster card design (`RosterList`), the top-bar, nav, and overall visual structure intact.
- **Add a season selector dropdown** at the top of the page. When a season is selected, only show players who were registered/active for that season.
- **Display per-player stats inline** in each player's roster card, below their name and position badges. Stats should be compact and legible on mobile — not in a separate table.
- **Move the POTS race card** (`PotsCard` from `SeasonStats.tsx`) to the top of the page, above the squad list.
- **Exclude "My" stats** — the "My season" summary cards and "My games" per-game breakdown (currently in `StatsClient.tsx`) should not appear on the merged Squad page. These will be implemented later as a separate feature.
- **Update navigation:** in both `app/dashboard/layout.tsx` and `app/admin/layout.tsx`, rename "Stats" to... actually remove the Stats nav link entirely. Change "Team" to "Squad".
- **Deprecate old stats pages**: remove `app/dashboard/stats/` and `app/admin/stats/` directories entirely.

**Files to modify:**
- `app/dashboard/team/page.tsx` — add season selector, stats integration, rename heading to "Squad"
- `app/dashboard/layout.tsx` — rename nav: Team → Squad, remove Stats (or hide it)
- `app/admin/layout.tsx` — same nav changes
- `app/admin/team/page.tsx` and `TeamClient.tsx` — add season selector, stats, rename to Squad
- `components/RosterList.tsx` — accept optional stats data and render inline below player name
- `components/SeasonStats.tsx` — already has `computeSeason`, `SeasonSelect`, `PotsCard` — reuse these

**Files to remove:**
- `app/dashboard/stats/page.tsx`
- `app/dashboard/stats/StatsClient.tsx`
- `app/dashboard/stats/actions.ts`
- `app/admin/stats/page.tsx`
- `app/admin/stats/StatsClient.tsx`
- `app/admin/stats/actions.ts`
