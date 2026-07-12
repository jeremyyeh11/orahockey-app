# ORA Hockey — Backlog / Feature Queue

> **How this works:**
> - Work starts from the **top of Backlog** (the lowest-numbered open item). Complete items in order.
> - New feature requests are appended to the **bottom** of the Backlog (insert at back, not front).
> - When a feature is completed, move it to the **Archived** section.
> - Each entry is a self-contained prompt that can be handed off to an implementation agent.
> - Refer to UI elements by what the user sees on the deployed page — not by internal file/component names.
> - **Numbering runs as a single continuous sequence and is never reset.** Every new item gets the next number in line — when the current highest is `#N`, the next item is `#N+1` (use decimals like `#2.1` only to split an existing item into sub-parts, never to renumber the sequence). Archived items keep the number they had when completed. Even when the Backlog is empty, the counter keeps its value, so the next item opened continues from where it left off (e.g. after `#4` the next is `#5`).

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
  - The score (us - them) shows at the top, **read-only**. It is derived from the goal rows entered below, not typed directly.
  - Below it: a **+ Goal** button and a **+ Card** button.
  - **+ Goal** adds a row to a goals table: select **scorer** (from the match team list only) and **assist**.
    - The assist dropdown lists, in order: `PC` (penalty corner), `PS` (penalty stroke), then players (from the match team list only).
  - **+ Card** adds a row to a cards table: select **player** (from the match team list only) and **card type**.
  - **All players** (not just admins) can add goals and cards for a played match.
- **Scorers table:** maintain as a **chronological list** (order goals were scored), each row showing scorer with its assist / `PC` / `PS` label — **not consolidated**. The table is **rearrangeable by dragging**.
- **Cards:** auto-sort to the **bottom** of the result view and are **consolidated** as `name - card - card number` (same style as the Squad tab indications).
- **POTM space:** beneath the scoreline, leave a **blank POTM space** (populated by the vote-POTM system in #5).

Must reference only UI-visible elements (Schedule tab, Add Game, match detail modal, match team list). Internal data shape TBD.

*Open questions to resolve at build time:*
- *Goals/cards are not currently stored as per-event rows — `player_stats` holds goals_fg/goals_pc/goals_ps + assists, and there is no cards table. This needs a goals (and cards) table + a migration, like `005_match_team_lists.sql`. Confirm whether the stored `games` score is computed from goal rows or still maintained separately.*
- *RLS: opening result entry to all players requires a new policy (authenticated users may insert goal/card rows for played matches). Admin-only event editing stays unchanged.*
- *Confirm card types (yellow / red / second yellow?).*
- *If the match team list is not yet published ("To be announced"), can players still pick scorers? Edge case to decide.*

## 5. Vote POTM system

A match-linked POTM vote that replaces the current admin-only manual `potm` entry (table `potm`, currently populated by admins). Players vote 1st / 2nd / 3rd from the match's published team list; results stay secret until the poll closes.

- **Auto-create:** when a match is over (date/time passed), automatically create a POTM poll linked to that match.
- **Single-choice, 3 ranks:** the poll is single-choice but captures **1st / 2nd / 3rd choice** for POTM (three separate rank selections, not a multi-select).
- **Linked to the match:** the selectable options are the players in that match's **published team list** only (`match_team_lists` where `team_list_status = 'published'`).
- **Eligibility:** only players who are in that same team list may **vote** (everyone can **see** the poll, but voting is restricted to listed players).
- **Secret until closed:** poll results are hidden until the poll is **closed**.
- **Confirm to lock:** a **Confirm** button locks in the vote. Before confirming, show the **selected vote**; after confirming, show a **warning** that no changes are allowed.
- **Auto-close:** the poll **auto-closes** once **every eligible voter has voted**.
- **Not-yet-voted list:** show players who haven't voted as small, legible **tags** (not a one-name-per-line list). The **current user's tag is highlighted green** if present (i.e. if they haven't voted yet). Once they vote, their tag disappears. These tags **update live** — no refresh needed.
- **Result display:** after the poll closes, show the POTM result (1st / 2nd / 3rd). Display the POTM in the **match detail view** alongside the match result (fills the blank POTM space from #4).

Must reference only UI-visible elements (Schedule tab, match detail modal, team list, polls). Internal data shape TBD.

*Open questions to resolve at build time:*
- *This reuses the existing `polls` / `poll_options` / `poll_votes` tables or a new POTM-specific structure? The 1st/2nd/3rd rank + game link + secret-until-closed + auto-close suggest a new `potm_polls` / `potm_votes` model rather than stretching the general poll (which is multi-choice, open to all). Decide before build.*
- *Existing `potm` table (1st/2nd/3rd, points derived in app) — the vote result should populate it, replacing admin manual entry. Confirm the migration path and that points stay derived.*
- *RLS: voting restricted to team-list members needs a policy; viewing open to all authenticated. Auto-create likely needs a server function / trigger on match end.*
- *Tie-breaking / shared places for POTM (the `potm` table already allows shared places) — how does the rank tally resolve ties?*

## 6. Self-serve player onboarding via whitelist + forced password reset

Replace the manual (Supabase-dashboard) onboarding with an in-app flow driven by the existing `player_whitelist` table.

- **Admin adds email to whitelist:** from the admin Squad (or a dedicated admin control), an admin adds a player's email to the `player_whitelist` table. This is the gate — only whitelisted emails can self-register.
- **App assigns a standard password:** when the whitelist entry is created, the app (server action / edge function) creates the Supabase auth user for that email with a standard temporary password `orahockey`.
- **New user signs in:** the user goes to `/login`, enters their email and the standard password `orahockey`.
- **Triggers password reset:** because the login used the standard temporary password, the app immediately triggers a **password reset** flow (Supabase `resetPasswordForEmail` / update flow) so the user sets their own password on first login. They cannot continue on the temporary password.
- **Player row auto-created:** on whitelist-based signup, a `players` row is created/linked to the new auth user (role defaults to `player`), removing the manual `auth_user_id` linking step.

Must reference only UI-visible elements (login page, admin Squad / whitelist control). Internal data shape TBD.

*Open questions to resolve at build time:*
- *How is the auth user created from the app? Needs the service-role key server-side (admin client) — confirm where it lives and that it is not exposed to the client.*
- *Detecting "used standard password" to force reset: compare against the known `orahockey` value, or flag the whitelist/user as `needs_password_reset` until changed. Decide the signal.*
- *The `player_whitelist` table currently has no `used` / `claimed` flag — add one so a whitelisted email can't be re-used and we know signup completed.*
- *RLS: the signup server action must verify the email is whitelisted before creating the auth user (the whitelist is currently admin-only readable — broaden for the signup check).*
- *Edge: what if the admin whitelists an email that already has an auth user? Decide (link existing vs reject).*

---

## Archived

### 1. Merge stats page into team page ✓ July 2026

Merged the Stats page into the Team page (now "Squad"). Removed old Stats pages and nav links for both player and admin views.

### 2. Match / Event detail view ✓ July 2026

Replaced the edit modal on the Schedule tab with a read-first detail modal. Tapping any event opens a modal showing full details (opponent, venue, date/time, competition, result if played). Players can vote attendance from inside the modal. Shows attendance breakdown (attending/maybe/not/hasn't responded) with player names. Additional Information section (notes) shown read-only to players. Admins get Edit to Save/Discard conversion. Created reusable ReadEditModal component for reuse in player profile page.

### 2.1 Event modal improvements + match team list ✓ July 2026

Event modal: Delete only in edit mode, smaller Edit/Close buttons, attendance breakdown as list, body scroll lock. Match attendance seeded (378 rows, 27 players x 14 games). Match team list feature: admins can select squad from attending players, save as draft or publish. Published list shows preferred name, position, jersey number. Players see "To be announced" until published. Requires `005_match_team_lists.sql` migration.
