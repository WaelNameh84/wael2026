---
name: GitHub default branch mismatch
description: Pushing to a feature/working branch does not guarantee it's what shows on GitHub's repo homepage.
---

In the AttendX (wael2026) repo, the working branch was `clean-main`, but GitHub's default branch was `main`, which held an old, structurally different snapshot of the project (unrelated history, no common ancestor found via merge-base).

**Why:** All pushes with plain `git push origin clean-main` succeeded, but the user only ever browsed the GitHub repo homepage, which renders the default branch (`main`) — so none of the new work was visible to them despite pushes succeeding.

**How to apply:** When a user says "nothing got uploaded to GitHub" but `git log`/`git push` on the workspace show success, check `git ls-remote origin` and compare the SHA for `HEAD`/`refs/heads/main` against the branch actually being worked on. If they differ, the fix is to sync the default branch (fast-forward or force-push) to match the working branch, after confirming with the user since it may discard unrelated content on the default branch.
