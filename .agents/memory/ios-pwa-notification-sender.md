---
name: iOS PWA notification sender
description: How iOS labels web-push notifications for an installed PWA.
---

On iOS, the `from ...` label shown under a web-push notification is the application name captured when the PWA was added to the Home Screen. It is not controlled by the notification title/body and does not update for an already-installed old PWA.

**Why:** The current app can send a correct title such as `Pulse — إشعار جديد` while iOS still displays `from Rrrrr` from an older installation.

**How to apply:** Keep the manifest `name`, `short_name`, and `apple-mobile-web-app-title` aligned with the current app name. After changing the name, remove the old Home Screen PWA and add it again from Safari so iOS refreshes the sender label.