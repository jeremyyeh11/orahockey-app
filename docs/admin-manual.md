# ORA Hockey — Admin Manual

For coaches and managers with the **admin** role. Use the [user manual](user-manual.md) for signing in, marking your own attendance, viewing the squad, and voting in polls.

[Developer README](../README.md) · [User manual](user-manual.md)

## Roles and access

Players can view the schedule, squad, and polls, mark their own attendance, and vote. Admins can also add, edit, and delete players and events, and create, close, reopen, and delete polls. Admins are players too and can mark their own attendance and vote.

## Managing the club

### Home
Admins see the same Home as players (see the [user manual](user-manual.md#home)): the season record, your own stats, what's next, the last result, and any open polls.

### Squad
Manage the roster.

- **+ Add Player** (top right) adds a player - full name, preferred name, email, jersey number, position(s) (FWD / MID / DEF / GK), and role (player or admin).
- Use **Show inactive** to include inactive players in the list.
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
