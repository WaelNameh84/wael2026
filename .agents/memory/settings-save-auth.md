---
name: Protected settings saves
description: The application settings PATCH endpoint requires the current bearer token even for same-origin browser requests.
---

Use the shared authenticated request helper for every client-side write to protected settings endpoints, including debounced background saves. Do not rely on same-origin cookies or raw `fetch` for these writes. When adding a flush helper, verify the consuming page destructures it from the hook before calling it.

**Why:** A raw same-origin request can reach the endpoint without the bearer token used by this app, causing settings saves to fail with an authorization error.

**How to apply:** When adding or batching settings persistence, use the authenticated helper and preserve non-OK responses so the explicit Save action can report the server reason.