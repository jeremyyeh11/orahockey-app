# ORA Hockey — Admin Manual

For coaches and managers with the **admin** role. Use the [user manual](user-manual.md) for signing in, marking your own attendance, viewing the squad, and voting in polls.

[Developer README](../README.md) · [User manual](user-manual.md)

## Roles and access

Players can view the schedule, squad, and polls, mark their own attendance, and vote. Admins can also add, edit, and delete players and events, and create, close, reopen, and delete polls. Admins are players too and can mark their own attendance and vote.

## Managing the club

### Seasons
Everything below works on the **season selected** in the season switcher (see the [user manual](user-manual.md#seasons)). New players, games and trainings go into that season.

**Past seasons are archived and read-only for everyone, admins included:** no Add Player, + Game / + Training, Edit, Delete, Update result, Team list or attendance buttons. The database rejects any change to an archived season that comes from the app. Corrections to a past season, starting a new season and archiving the old one are done from the backend (Supabase SQL editor) - archiving is the `locked` flag on the season:

```sql
-- start a new season: add it, make it current, archive the old one, copy the squad
insert into seasons (label, starts_on, ends_on) values ('2028', '2028-01-01', '2028-12-31');
update seasons set is_current = false, locked = true where label = '2027';
update seasons set is_current = true where label = '2028';
insert into season_players (season_id, player_id, jersey_number, position)
select (select id from seasons where label = '2028'), player_id, jersey_number, position
from season_players where season_id = (select id from seasons where label = '2027')
on conflict do nothing;
```

### Home
Admins see the same Home as players (see the [user manual](user-manual.md#home)): the season record, your own stats, what's next, the last result, and any open polls.

### Squad
Manage the roster.

- **+ Add Player** (top right) adds a player to the selected season's squad - full name, preferred name, email, jersey number, position(s) (FWD / MID / DEF / GK), and role (player or admin). Jersey number and position are kept per season.
- **+ Existing Player** adds players who are already on the books but not in this season's squad (e.g. back after a season out). Tick one or more and tap **Add**. They're marked active, with their last jersey number and position. The button only shows when someone is missing from the squad.
- **Removing a player from a season:** open their profile → **Squad** panel → **Remove from 2027**. This is only offered while they have no appearances or stats that season; their RSVPs for the season's upcoming events are cleared too. Once they've played, the panel offers **Mark inactive** instead, which hides them from the squad list but keeps their numbers in the leaderboards. A player who isn't in the squad gets **Add to 2027** in the same panel.
- These squad controls are admin-only and only appear for the current (open) season; archived seasons can't be changed.
- Use **Show inactive** to include inactive players in the list. A past season always lists its whole squad.
- Season stats, **Top Scorers** and **Top Assists** are shown here just like the player view, driven by the selected season. On a computer the roster is a sortable table.

**Inviting players (accounts):** each player has a small account dot - on their card on a phone, in the **Acct** column on a computer: green = account active, amber = invited but not set up yet, grey = no account. Tap a player and use the **Account** panel at the bottom of their profile:

- **Invite link** creates their account and gives you a private one-time setup link - copy it or share straight to WhatsApp. The player opens it and picks their own password. Links expire after 24 hours; generating a new one is always one tap.
- **Password reset link** does the same for players who already have an account and got locked out (expires after 1 hour).
- Generate links as you send them (don't stockpile them the night before).

**Players who leave:** set them inactive rather than deleting them - inactive players keep their stats and history but drop out of the default roster, while deleting a player also deletes their stats, attendance, and votes. The app has no button for editing a player's details or marking them inactive yet, so those changes are made in the database for now.

### Schedule
- **+ Game** / **+ Training** adds an event (opponent, date/time, venue, home/away, type, notes for a game; date/time, venue, notes for a training).
- **Tap any event** to open the detail view (on a computer it opens in the panel beside the list). As an admin you get an **Edit** button that turns the fields into editable inputs; **Save** writes the change and **Discard changes** cancels. You can also **delete** the event (this also removes its attendance and stats).
- For games, **Update result** (available once the match has started) records the score, scorers, assists, and cards - the W/D/L result is worked out from the score - and **Team list** picks and publishes the match squad.

### Polls
- **+ New Poll** creates a poll: a question, 2-6 options, and an optional close date.
- Open polls can be **Closed** (or reopened), and any poll can be **Deleted** (votes included).
- Admins vote in polls just like players do.

### Profile
Your identity card - name, email, role, jersey number, and positions - plus a **Sign out** button.


## Previewing the player experience

Double-tap the **ADMIN** badge in the top bar to open the admin control panel. You can switch to the player view to check what the squad sees, or set a preview date for the season.
