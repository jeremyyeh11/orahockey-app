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

## 6. Self-serve player onboarding via whitelist + email set-password link

Replace the manual (Supabase-dashboard) onboarding with an in-app flow driven by the existing `player_whitelist` table. Each new player gets a **private, per-user setup link by email** — no shared or app-generated temporary password is ever transmitted.

- **Admin adds email to whitelist:** from the admin Squad (or a dedicated admin control), an admin adds a player's email to the `player_whitelist` table. This is the gate — only whitelisted emails can self-register.
- **App creates the auth user + emails a set-password link:** when the whitelist entry is created, the app (server action using the service-role admin client) creates the Supabase auth user for that email with `email_confirm: true`, then uses Supabase's native email (`inviteUserByEmail` / `generateLink` "invite" or "recovery" type) to **email the player a private set-password link**. The player sets their own password via that link — nothing sensitive is handled by the app itself.
- **First login:** the player clicks the emailed link, sets a password, then signs in at `/login` normally. (No shared `orahockey` password, no app-side temp-password storage.)
- **Player row auto-created/linked:** the `players` row is created/linked to the new auth user (role defaults to `player`), removing the manual `auth_user_id` linking step. Use the existing `002_link_player_function.sql` pattern (match on email) so the row links automatically.
- **Prerequisite:** Supabase project SMTP must be configured so Supabase can send the invite/recovery email. (Supabase sends it — the app does not run its own mail server.)

Must reference only UI-visible elements (login page, admin Squad / whitelist control). Internal data shape TBD.

*Open questions to resolve at build time:*
- *Service-role key: the auth-user creation must run server-side with the admin client; confirm the key lives in a server-only env var and is never exposed to the client.*
- *The `player_whitelist` table currently has no `used` / `claimed` flag — add one so a whitelisted email can't be re-used and we know the invite was sent/completed.*
- *RLS: the whitelist is currently admin-only readable — broaden so the signup/invite server action can verify the email is whitelisted before creating the auth user (client must not be able to read the whole list).*
- *Edge: what if the admin whitelists an email that already has an auth user? Decide (link existing vs reject).*
- *SMTP in Supabase: confirm it is enabled in the project, or this flow silently fails to email the player.*

## 7. Live player photos + dynamic season labels

Two spots still not driven by live data (flagged during the July 2026 hardcoded-stats audit):

- **Player photos:** the player profile page loads the trading-card photo from files committed to the
  repo (`public/players/{playerId}.png` — only one photo exists). Adding a player's photo currently
  means a git commit + deploy. Move photos to Supabase Storage with an in-app upload (admin edit mode
  on the player profile), keeping the silhouette fallback for players without one.
- **Season labels:** the "Season 2026 · MHL1" hero label on the player Home page and the "Season 2026"
  heading on both Schedule tabs are hardcoded strings that will silently go stale in 2027. Derive the
  season from game dates (the Squad tab's season selector already does this).

Must reference only UI-visible elements (player profile photo, Home hero, Schedule tab heading).

---

## Archived

### 4. Update match result ✓ July 2026

Post-match result entry open to all players, separate from match creation (score fields removed
from Add Game). **Update result** button inline with the title in the match detail modal, matches
only, disabled until the match date/time passes. Design changed at build time: anyone enters the
final score (us–them) first, which spawns one scorer slot per goal we scored; slots are filled with
scorer + assist (`PC` / `PS` / player) from the published team list (full roster if none published),
chronological and drag-reorderable. Cards consolidated at the bottom (`name ▲/■/● count`, Squad-tab
style, green/yellow/red); blank POTM space beneath the scoreline awaits #5. New tables `match_goals`
and `match_cards` (`007_match_results.sql`) with player-write RLS for played matches; score entry via
`set_match_score()` definer fn (derives result); `player_stats` FG/PC/PS/A kept in sync by trigger.
The seeded 2026 season was backfilled into goal rows (verified 0 drift), and the previously hardcoded
CARD_DATA card counts migrated to `match_cards` (legacy rows, no game attribution).

### 3. Player profile page ✓ July 2026

Player profile modal accessible from the Squad tab (both player and admin). Shows season stats and career stats in a stat grid with position-based visibility (GK shows CS, outfield shows FG/PC/PS/A). Trading card photo area as placeholder (jersey number in a styled box). Admins get Edit mode for preferred name, jersey, position, role via ReadEditModal. Career stats computed via computeSeason with season='all'. No SQL migration needed — uses existing tables.

### 1. Merge stats page into team page ✓ July 2026

Merged the Stats page into the Team page (now "Squad"). Removed old Stats pages and nav links for both player and admin views.

### 2. Match / Event detail view ✓ July 2026

Replaced the edit modal on the Schedule tab with a read-first detail modal. Tapping any event opens a modal showing full details (opponent, venue, date/time, competition, result if played). Players can vote attendance from inside the modal. Shows attendance breakdown (attending/maybe/not/hasn't responded) with player names. Additional Information section (notes) shown read-only to players. Admins get Edit to Save/Discard conversion. Created reusable ReadEditModal component for reuse in player profile page.

### 2.1 Event modal improvements + match team list ✓ July 2026

Event modal: Delete only in edit mode, smaller Edit/Close buttons, attendance breakdown as list, body scroll lock. Match attendance seeded (378 rows, 27 players x 14 games). Match team list feature: admins can select squad from attending players, save as draft or publish. Published list shows preferred name, position, jersey number. Players see "To be announced" until published. Requires `005_match_team_lists.sql` migration.
