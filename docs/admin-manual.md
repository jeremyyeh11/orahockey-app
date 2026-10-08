# ORA Hockey — Admin Manual

For coaches and managers with the **admin** role. Use the [user manual](user-manual.md) for signing in, marking your own attendance, viewing the squad, and voting in polls.

[Developer README](../README.md) · [User manual](user-manual.md)

## Roles and access

Players can view the schedule, squad, and polls, mark their own attendance, and vote. Admins can also add, edit, and delete players and events, and create, close, reopen, and delete polls. Admins are players too and can mark their own attendance and vote.

## Managing the club

### Seasons
Everything below works on the **season selected** in the season switcher (see the [user manual](user-manual.md#seasons)). New players, games and trainings go into that season.

**Past seasons are archived and read-only for everyone, admins included:** no Add Player, + Game / + Training, Edit, Delete, Update result, Team list or attendance buttons. The database rejects any change to an archived season that comes from the app. **Closing a season:** at the bottom of Home (admins only, while viewing the current season) is a **Danger zone** with **Close season**. It archives the current season, makes the next one (e.g. 2028) current, and carries the active players over with their jersey numbers. It asks three times: the button, **Yes, close 2027**, then typing `CLOSE`. If the season isn't in post-season yet, it warns how many upcoming games/trainings would be archived with it.

**Season phase** is worked out from the current season's fixtures and today's date (Singapore time) and shows on the Home season card: **Pre-season** (no fixtures yet, or before the first), **Season** (first to last fixture day), **Post-season** (after the last).

Corrections to a past season (and undoing a close) are done from the backend (Supabase SQL editor) - archiving is the `locked` flag on the season. The manual equivalent of Close season:

```sql
-- start a new season: add it, make it current, archive the old one, copy the squad
insert into seasons (label, starts_on, ends_on) values ('2028', '2028-01-01', '2028-12-31');
update seasons set is_current = false, locked = true where label = '2027';
update seasons set is_current = true where label = '2028';
insert into season_players (season_id, player_id, jersey_number)
select (select id from seasons where label = '2028'), player_id, jersey_number
from season_players where season_id = (select id from seasons where label = '2027')
on conflict do nothing;
```

### Home
Admins see the same Home as players (see the [user manual](user-manual.md#home)): the season record, your own stats, what's next, the last result, and any open polls.

### Squad
Manage the roster.

- **+ Add Player** (top right) adds a player to the selected season's squad - full name, preferred name, email, jersey number, position(s) (FWD / MID / DEF / GK), and role (player or admin). Jersey numbers are kept per season; positions belong to the player across all seasons.
- **Email is optional.** Leave it blank to add someone before their onboarding details are in - they show as **Pending** (a hollow account dot). Add their email later from their profile's **Account** panel (**Save email**); the **Invite link** appears once it's saved. Once a player has an account, their login email can't be changed from the app.
- **Past players:** untick **Add to the MHL1 2027 squad** to add someone who isn't playing this season - they're created inactive and in no season. Attaching them to an archived season (e.g. 2026) is a backend change: send the names and seasons to whoever manages the database.
- **+ Existing Player** adds players who are already on the books but not in this season's squad (e.g. back after a season out). Tick one or more and tap **Add**. They're marked active, with their last jersey number. The button only shows when someone is missing from the squad.
- **Removing a player from a season:** open their profile → **Squad** panel → **Remove from 2027**. This is only offered while they have no appearances or stats that season; their RSVPs for the season's upcoming events are cleared too. Once they've played, the panel offers **Mark inactive** instead, which hides them from the squad list but keeps their numbers in the leaderboards. A player who isn't in the squad gets **Add to 2027** in the same panel.
- These squad controls are admin-only and only appear for the current (open) season; archived seasons can't be changed.
- Use **Show inactive** to include inactive players in the list. A past season always lists its whole squad.
- Season stats, **Top Scorers** and **Top Assists** are shown here just like the player view, driven by the selected season. On a computer the roster is a sortable table.

**Inviting players (accounts):** each player has a small account dot - on their card on a phone, in the **Acct** column on a computer: green = account active, amber = invited but not set up yet, grey = no account. Tap a player and use the **Account** panel at the bottom of their profile:

- **Invite link** creates their account and gives you a private one-time setup link - copy it or share straight to WhatsApp. The player opens it and picks their own password. Links expire after 24 hours; generating a new one is always one tap.
- **Password reset link** does the same for players who already have an account and got locked out (expires after 1 hour).
- Generate links as you send them (don't stockpile them the night before).

**Players who leave:** set them inactive rather than deleting them - inactive players keep their stats and history but drop out of the default roster, while deleting a player also deletes their stats, attendance, and votes. Untick **Active** in their **Edit** form (below).

**Editing a player:** open their profile and tap the **pencil** (top right). You can change full name, preferred name, positions, jersey number, role, date of birth, year joined and **Active**. A few rules:
- **Positions** belong to the player, the same in every season - tick every position they play.
- **Jersey number** is per season: the field shows which. In the selected season's squad it's that season's number (read-only for an archived season); otherwise it's the number they'll take into the next season they join.
- **Email** can only be set or changed before they have an account - after that it's their login.
- You can't change your own role (so you can't lock yourself out of admin).

### Schedule
- **+ Event** / **+ Training** / **+ Game** add to the season's schedule. A game has an opponent, date/time, venue, home/away, notes and a **League / Friendly** switch. A training has date/time, venue and notes. An **event** is anything else - a gathering, meeting, social - and needs a **title** plus date/time; venue and notes are optional. Players can RSVP to all three. Each can also have an optional **Ends at** time (pick a time on the same day; one earlier than the start means it runs past midnight) and **Report early by** minutes, shown under the date and time as e.g. *Report 08:45 · 15 min early*. **Friendlies don't count** towards the season record, player stats or leaderboards - you can still enter their score, scorers and cards.
- **Respond by + Fines:** every game, training and event has a **Respond by** deadline, filled in from the club rule as you pick the date - Thursday 23:59 before a weekend game/training, Sunday 23:59 before a weekday training, 72 hours before a weekday game, 72 hours after posting for an event. It follows the date until you change it by hand (**Use club rule** puts it back). The **Fines ($5)** switch is on by default for games and trainings, **off for events**, and off for anything you add after its deadline has already passed. Clear the deadline or switch fines off for casual entries.
- Each row shows the headcount on the right - *attending* for upcoming events, *attended* for past ones.
- **Tap any event** to open the detail view (on a computer it opens in the panel beside the list). As an admin you get an **Edit** button that turns the fields into editable inputs; **Save** writes the change and **Discard changes** cancels. You can also **delete** the event (this also removes its attendance and stats).
- For games, **Update result** (available once the match has started) records the score, scorers, assists, and cards - the W/D/L result is worked out from the score - and **Team list** picks and publishes the match squad.

### Polls
- **+ New Poll** creates a poll: a question, 2-6 options, an optional close date, and a **Respond by** deadline (72 hours after posting, or the close date if that's sooner) with a **Fines ($5)** switch - on by default; switch it off for casual polls.
- Open polls can be **Closed** (or reopened), and any poll can be **Deleted** (votes included).
- Admins vote in polls just like players do.
- The vote count on each poll (e.g. *12 voted · 18 haven't · 2 late*) opens a list of who has voted (with when) and who hasn't from the current season's active squad, with late voters in red - votes stay anonymous.

### Fines
The **Fines** tab (between Squad and Profile). Fines are worked out by the app from the deadlines, each player's RSVP history and poll votes - nothing to enter by hand:
- **Late reply** - first reply after the deadline, or none at all (counted in the month the deadline passed).
- **Late change** - a player changing their own answer in the 24 hours before the start (counted in the month of the change). The app can't see who PM'd the coaching committee, so every such change is fined - **Waive** the ones who did.
- Each outstanding fine has **Paid** and **Waive**. **Waive** asks for a reason (e.g. *PM'd Ish before changing*), which shows on the fine for everyone. Paid and waived fines are greyed out and keep an **Undo**.
- The card under the month says **Outstanding** (with the amount still owed) or **Settled** once every fine is paid or waived. Players who still owe are listed first and open; settled players collapse.
- **Copy outstanding for WhatsApp** copies what each player still owes that month, to paste into a message.
- Only active squad members with an app account are fined. Players see the same page without the waive buttons.

### Profile
Your identity card - name, email, role, jersey number, and positions - plus a **Sign out** button.


## Previewing the player experience

Double-tap the **ADMIN** badge in the top bar to open the admin control panel. You can switch to the player view to check what the squad sees, or set a preview date for the season.
