---
name: Manual shift alarm times
description: Shift alarm times are user-controlled and must not be recalculated from the work schedule.
---

Shift alarm start and end times are independent user settings. Changing the work schedule or break duration must not overwrite them.

**Why:** The user explicitly needs to choose the alarm times, and automatic recalculation caused a manually entered end time to change unexpectedly.

**How to apply:** Keep alarm inputs editable and persist the exact `HH:MM` values the user saves; only change them when the user edits those alarm fields.