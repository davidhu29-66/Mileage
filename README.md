# Mileage Logbook

A standalone version of the mileage-tracking app, set up to deploy to Vercel (or any static host).

## What was fixed vs. dropping the raw component into a repo

1. **Tailwind CSS is now actually configured** (`tailwind.config.js`, `postcss.config.js`, `src/index.css`)
   so the dark theme, spacing, and colors render — previously nothing was styled at all.
2. **`window.storage` is polyfilled** (`src/storagePolyfill.js`) using real `localStorage`, since the
   original `window.storage` API only exists inside Claude's sandbox. The app component itself
   (`src/MileageLogger.jsx`) is untouched — same file Claude gave you.
3. **Company logo included** at `public/logo.png` — swap this file to update the header branding.

## Business trip types (new)

Business trips now split further into **Admin** (non-client work, e.g. commuting) and **Chargeable**
(billable to a client, with an optional client name field). Summary tab shows the breakdown and lets
you export a chargeable-only CSV for client invoicing. Trips saved before this update show as
"Admin" by default until you edit them — nothing is silently reclassified as billable.

## GPS location matching

Each saved location can have a GPS coordinate "pinned" to it (Settings tab → "Pin here", or automatically
the first time you use "Use current location" somewhere new). On future trips, tapping **Use current
location** on the Start/End Trip screen checks your GPS against saved spots within ~200m and auto-fills
the match — otherwise it drops you into a text field to name the new place, which then gets remembered
for next time.

This needs an HTTPS site (Vercel gives you this automatically) and the browser will prompt for location
permission the first time it's used.

## Run locally

```bash
npm install
npm run dev
```

## Deploy to Vercel

Push this folder to GitHub, then import the repo in Vercel. It auto-detects Vite —
no extra config needed. Build command: `npm run build`, output directory: `dist`.

## Data storage — read this

Trips are saved in your browser's `localStorage`, keyed to whichever device/browser you use it on.
That means:
- Data does **not** sync between your phone and laptop, or across browsers.
- Clearing site data/cache in that browser will erase your trips.
- It's fine for single-device daily use, but if you want it backed up or synced across devices,
  that needs a real backend (e.g. a small database + login) — happy to help with that next if
  you want it.

Use the **Export CSV** button in the Summary tab regularly to keep a backup outside the browser.

## Updating the app later

If Claude gives you an updated `MileageLogger.jsx` in the future, you can just replace
`src/MileageLogger.jsx` with the new version — nothing else needs to change.
