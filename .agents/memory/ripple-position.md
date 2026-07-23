---
name: Ripple and positioned controls
description: The interaction between the global ripple effect and positioned close buttons.
---

The global ripple effect must not overwrite an existing non-static CSS `position` on a button. Close controls in dialogs, sheets, image viewers, and floating panels commonly use `absolute` or `fixed`; changing them to `relative` on pointer-down makes them jump on the first touch and appear to require a second tap.

**Why:** The first tap was being consumed visually by the position change, moving the X before the close action could be used at its original location.

**How to apply:** Before adding a ripple-host class, capture the element's computed position and preserve any non-static value inline, or implement the ripple without changing layout positioning.