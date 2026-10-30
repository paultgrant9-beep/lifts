# CLAUDE.md

Personal weightlifting tracker PWA for Android Chrome (Pixel 8 Pro).

## Before doing anything

Read `SPEC.md` (the spec, data model, and progression rule) at the start of every session and follow it. If a request conflicts with the spec, point out the conflict before changing anything.

## Rules

- Plain HTML, CSS, and JavaScript only. No frameworks, no libraries, no npm, no bundlers, no build step. The files must run as-is from a static server.
- Keep the file layout from the spec: `storage.js` holds all data/localStorage functions; `app.js` holds all UI and screen logic. UI code should not touch `localStorage` directly.
- Data lives in localStorage under the keys `"routines"` and `"logs"`, using the exact shapes in the spec's data model. Don't rename fields or keys without a migration.
- Units are pounds.
- `sw.js` caches the app for offline use. When adding a new app file, add it to `ASSETS` there and bump `CACHE` (e.g. `lifts-v2`). The cache is stale-while-revalidate, so after an edit the first reload can still show the old version; reload again.
- Design: mobile first, single column, dark theme, tap targets at least 44px tall, readable at arm's length.

## Running locally

This machine has no Python or Node. Serve the folder with the included PowerShell script, then open http://localhost:8000:

    powershell -ExecutionPolicy Bypass -File serve.ps1

`serve.ps1` is a local dev helper only, not part of the app.

## Deployment

Hosted on GitHub Pages from the `main` branch root: https://paultgrant9-beep.github.io/lifts/ (repo: https://github.com/paultgrant9-beep/lifts). Pushing to `main` deploys in a minute or two. Only push when the user asks. Bump `CACHE` in `sw.js` with any release so installed phones pick up the change.
