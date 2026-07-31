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
