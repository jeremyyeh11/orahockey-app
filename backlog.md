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

## 6.1 Emailed invites (deferred from #6)

Deferred at build time: sending invite/reset links by email instead of admin copy-link.
Blocked on an email service — Supabase free-plan built-in email is ~2/hour and only
delivers to project team members, and external SMTP providers (Resend etc.) need a
verified custom domain. If the club ever gets a domain (or routes via Gmail SMTP with an
app password), wire `generateSetupLink`'s output into Supabase `inviteUserByEmail` /
`resetPasswordForEmail` and add a self-serve "Forgot password?" flow on the login page.

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

### 6. Self-serve player onboarding via whitelist + invite links ✓ July 2026

Replaced manual Supabase-dashboard onboarding. Design changed at build time: links are
**hand-delivered by the admin (copy / WhatsApp share), not emailed** — free-plan Supabase
email is ~2/hour and team-members-only, and external SMTP needs a custom domain (deferred
to #6.1). Admin flow: every Squad card shows an account-status dot (green active / amber
invited / grey none); the player profile (admin view) gains an ACCOUNT panel whose button
mints a private one-time link — "Invite link" for new players (24h expiry, creates the
auth user), "Password reset link" for active ones (1h expiry). Links land on a
set-password page, then the app links the roster row by email and routes by role. The
roster is the gate: adding a player auto-whitelists their email (trigger), and
`generateSetupLink` (server action, service-role client via server-only
`SUPABASE_SERVICE_ROLE_KEY` env) refuses non-roster emails. Whitelist rows track
`invited_at`/`claimed_at` (migration `010_onboarding.sql`). Login page: expired-link
notice + "ask your coach/manager for a reset link" hint. Build questions resolved with
Jeremy: copy-link over email/both; resets also admin-mediated. Shipped alongside a fix to
PullToRefresh (its always-on transform collapsed the fixed-layer profile hero to blank).

### 5. Vote POTM system ✓ July 2026

Match-linked POTM vote replacing admin-only manual `potm` entry. Surfaced in the Polls
tab (both player and admin): a poll auto-creates lazily on Polls-tab load for every
played match with a published team list (`ensure_potm_polls()`; no scheduler). Eligible
voters and candidates are that published team list. Voters rank 1st/2nd/3rd via three
dropdowns (each rank excludes the others' picks), see a confirm-to-lock preview, then a
locked warning after confirming. Ballots are secret: choices live in `potm_votes` (admin-
only RLS) while a public `potm_ballots` receipt drives the live "yet to vote" tags — the
current user's tag is green, and tags update live via Supabase Realtime (first use of
Realtime in the app; the ssr browser client must set the auth token on the socket or the
authenticated-only RLS filters events out). The poll auto-closes once every listed player
has voted; `close_potm_poll()` tallies 3/2/1 points and writes places 1/2/3 (shared on
ties via dense_rank) into the existing `potm` table, so season stats keep deriving
unchanged. Closed results show in the Polls card and fill the reserved POTM slot in the
match result modal (#4). New migration `008_potm_vote.sql` (tables, definer functions,
RLS, Realtime publication). Build questions resolved with Jeremy: Realtime over polling,
Polls-tab entry point, lazy creation, points-weighted tally.

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
