---
name: GitHub push authentication
description: Safe fallback for pushing to the configured GitHub origin.
---

If the GitHub source-control connector reports that no credentials are available but a project GitHub secret exists, push with a temporary `GIT_ASKPASS` helper and disable credential persistence. Never place the secret in the remote URL, shell output, or a committed file.

**Why:** The configured GitHub connector and the project secret are separate authentication paths; the connector can be unavailable even when the secret is present.

**How to apply:** Verify the target branch and remote first, use a temporary helper that reads the secret only for the password prompt, remove the helper afterward, and verify the remote commit with `git ls-remote`.