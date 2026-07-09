---
name: Render deploy broken by Replit npm registry
description: External hosts (Render, etc.) fail npm install if package-lock.json resolves against Replit's internal package-firewall registry.
---

Replit's shell sets `NPM_CONFIG_REGISTRY` (and `npm config get registry`) to an internal proxy like `http://package-firewall.replit.local/npm/`. Any `npm install` run inside the Replit workspace writes that host into `package-lock.json`'s `resolved` fields.

**Why:** When the project is deployed elsewhere (e.g. Render), that internal host is unreachable. The external build hangs/fails deep into `npm install` with an unrelated-looking error (observed: `npm error Exit handler never called!`), then downstream steps fail (e.g. `vite: not found`) because the install never finished.

**How to apply:** For any project that deploys outside Replit, add `registry=https://registry.npmjs.org/` to the project's committed `.npmrc`, and when regenerating `package-lock.json` inside the Replit workspace, override the env var explicitly: `npm install --registry=https://registry.npmjs.org/`. Verify with `grep -o '"resolved": "[^"]*"' package-lock.json | sed -E 's#(https?://[^/]+)/.*#\1#' | sort -u` — it must show only `https://registry.npmjs.org`, never the internal firewall host. Commit and push the regenerated lockfile.
