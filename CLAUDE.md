# CLAUDE.md

Personal weightlifting tracker PWA for Android Chrome (Pixel 8 Pro).

## Before doing anything

Read `SPEC.md` (the spec, data model, and progression rule) at the start of every session and follow it. If a request conflicts with the spec, point out the conflict before changing anything.

## Rules

- Plain HTML, CSS, and JavaScript only. No frameworks, no libraries, no npm, no bundlers, no build step. The files must run as-is from a static server.
- Keep the file layout from the spec: `storage.js` holds all data/localStorage functions; `app.js` holds all UI and screen logic. UI code should not touch `localStorage` directly.
- Data lives in localStorage under the keys `"routines"` and `"logs"`, using the exact shapes in the spec's data model. Don't rename fields or keys without a migration.
- Units are pounds.
- Design: mobile first, single column, dark theme, tap targets at least 44px tall, readable at arm's length.

## Running locally

This machine has no Python or Node. Serve the folder with the included PowerShell script, then open http://localhost:8000:

    powershell -ExecutionPolicy Bypass -File serve.ps1

`serve.ps1` is a local dev helper only, not part of the app.
