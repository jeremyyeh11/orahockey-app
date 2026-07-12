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

## 1. Event modal improvements + match team list

### Event modal fixes
- **Delete only in edit mode**: The Delete button should only appear when the admin is in edit mode, not in read mode.
- **Visual hierarchy**: The Edit and Close buttons should not appear larger/more prominent than the attendance vote buttons. Make them smaller.
- **Attendance breakdown as list**: Arrange player names in a list (one per line), not as tags/pills.
- **Prevent body scroll**: When any modal is open, prevent scrolling on the main page behind it. Apply universally to all modals.

### Match attendance data
- For matches, the data of who attended and who didn't should already be available (everyone has responded). Update/seed this data so the attendance breakdown is populated.

### Match team list (admin-only feature)
- On the event detail modal for **matches**, add a **"Team List"** select option for admins, appearing **above** the "Your attendance" section.
- Clicking it opens a **new modal** (replaces the current event detail modal):
  - Has **Publish** and **Save Draft** buttons.
  - **Column 1**: Players who indicated "attending" (from attendance), listed in one column.
  - **Column 2**: Player positions.
  - **Column 3**: Checkbox — admins select true/false per player to include them in the match squad.
  - **Save Draft**: Saves selections but not visible to non-admins. Non-admins see "To be announced" under the team list section.
  - **Publish**: Publishes the team list for everyone to see.
  - **Published view**: Same columns for name and position, but instead of a checkbox, show the **jersey number**. Sort rows in full-name alphabetical order, but display **preferred name** to save space.
  - **Unpublish**: Admins can go back to edit and select "Unpublish" to save selections but hide the list from non-admins.
  - **When published**: Show the team list above "Your attendance" on the event detail modal.

---

## 2. Player profile page

Add an individual **player profile** page reachable from the **Squad** tab (player and admin), built using the same reusable modal/panel template defined for the event detail view above.

**Content:**
- Career stats and current-season stats, both displayed.
- Every player's stats are viewable by all players (no access restriction).
- A dedicated space for a player photo, styled like a trading card — to be populated later.
- The photo area is masked to the player only (transparent/no background), with key stats and info overlaid on the masked image appropriately.

Must reference only UI-visible elements (Squad tab, player rows/cards, modal/panel template). Internal data shape TBD.


---

## Archived

### 1. Match / Event detail view ✓ July 2026

Replaced the edit modal on the Schedule tab with a read-first detail modal. Tapping any event opens a modal showing full details (opponent, venue, date/time, competition, result if played). Players can vote attendance from inside the modal. Shows attendance breakdown (attending/maybe/not/hasn't responded) with player names. Additional Information section (notes) shown read-only to players. Admins get Edit→Save/Discard conversion. Created reusable ReadEditModal component for reuse in player profile page.

### 1. Merge stats page into team page ✓ July 2026

Merged the Stats page into the Team page (now "Squad"). Removed old Stats pages and nav links for both player and admin views.
