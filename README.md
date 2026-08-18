# Mileage Logbook — Local Storage Version

This is the simple version: no login, no database — trips save straight to this browser's
`localStorage`. Good for single-device use, or as a lighter-weight option if you don't want to deal
with Firebase setup. For cross-device sync, see the sibling "database" version instead.

## Run locally

```bash
npm install
npm run dev
```

## Deploy to Vercel

Push this folder to GitHub, then import the repo in Vercel. It auto-detects Vite — no extra config
needed (there's a `vercel.json` here too in case your dashboard's Output Directory setting ever
defaults to `build` instead of `dist`).

## Data storage — read this

Trips are saved in your browser's `localStorage`, keyed to whichever device/browser you use it on.
- Data does **not** sync between your phone and laptop, or across browsers.
- Clearing site data/cache in that browser will erase your trips.
- Use the **Export CSV** buttons in the Summary tab regularly as a backup outside the browser.

## Backfilling a work session

History interleaves trips and work sessions chronologically, with a "Log a work session" button
for backfilling a job you couldn't toggle live — same fields as Time On/Off, treated identically
by the timesheet generator either way.

## Weekly timesheet

Settings → Weekly timesheet: set name/region once, then tap "Generate last week's timesheet" any
time — fills the HR-018 template entirely in-browser (ExcelJS, lazy-loaded) and downloads it. See
the database version's README for the full breakdown of how KM/HRS/columns are sourced.

## Node-RED sync

Settings tab has a "Node-RED sync" toggle. When on, every trip start/end/edit/delete gets POSTed
as JSON to a webhook URL you enter (e.g. `http://192.168.1.50:1880/mileage`) — point it at an
HTTP-in node on any flow. There's also a "Send test ping" button and a "Sync all" button to push
every stored trip at once. It's fire-and-forget: a failed or unreachable webhook never blocks or
breaks trip saving locally.

The request is sent as `Content-Type: text/plain` (body is still a JSON string) specifically to
avoid CORS preflight, since Node-RED's core `http in` node can't register an OPTIONS route at all.
Your flow needs `JSON.parse(msg.payload)` and should set `Access-Control-Allow-Origin: *` on the
response. A ready-to-import demo flow (`node-red-demo-flow.json`) is included — see the database
version's README for full setup details and payload shapes, since both share the same component.

## Chargeable clients

Settings → Chargeable clients manages the fixed list you pick from for Chargeable trips (replaces
free text). Existing trips auto-migrate their client names into this list on first load.

## Background art

The whole app's background reflects where you actually are right now: mileage art while a trip's
active, "at rest" art (matching the last completed trip's category) once it's ended. Private
arrivals no longer count toward Time on site tracking either. Images live in `public/backgrounds/`
— see the database version's README for the full breakdown, since both share the same component.

## Features

- Start/End Trip flow with GPS location matching (Settings → pin your frequent sites for auto-match)
- Business/Private split, with Business further split into Admin vs Chargeable (+ optional client name)
- **Time on site**: automatically calculated from consecutive trips — arrive somewhere, later leave
  for the next stop, and the gap between becomes "time on site" for that location. Add an optional
  Job Number and short description (at End Trip, or later by editing the trip from History) and it'll
  show up in the Summary tab and in its own CSV export.
- Monthly summary stats, daily chart, CSV exports (all trips / business only / chargeable only /
  time on site)

## Updating the app later

If Claude gives you an updated `MileageLogger.jsx` in the future, just replace
`src/MileageLogger.jsx` — nothing else needs to change (this file doesn't know or care which
storage backend it's running on).
