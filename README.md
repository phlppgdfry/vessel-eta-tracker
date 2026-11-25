# VesselETA — Zeebrugge approach monitor

[![Portfolio demo](https://github.com/phlppgdfry/vessel-eta-tracker/actions/workflows/portfolio-pages.yml/badge.svg)](https://github.com/phlppgdfry/vessel-eta-tracker/actions/workflows/portfolio-pages.yml)

**[Open live AIS](https://phlppgdfry.github.io/vessel-eta-tracker/)** · **[Open simulation](https://phlppgdfry.github.io/vessel-eta-tracker/?mode=demo)** · [Walkthrough](docs/PORTFOLIO.md) · [Verification](docs/VERIFICATION.md)

Live AIS snapshots around Zeebrugge arrive through a server-side relay; the
dashboard polls every 30 seconds between responses and shows the data age.
Visitors need no key. Public reception and automatic refresh were verified on
25 November 2026. The optional simulation demonstrates arrival deviations,
berth conflicts and handover planning with eight clearly labelled sample vessels.
This is an independent portfolio project, not an endorsed CSP system.

Live snapshot reception captured on 25 November 2026:

![Actual live AIS dashboard](docs/screenshots/live-desktop.png)

<details><summary>Mobile live preview</summary>
<img src="docs/screenshots/live-mobile.png" width="300" alt="Mobile view of actual AIS vessel positions" />
</details>

## Operational purpose

A delayed vessel affects crane allocation, yard preparation and truck appointments.
VesselETA brings position, speed and distance into one searchable map and vessel list.
The simulation shows how planners could compare estimated arrivals with an operational
schedule. **No production N4 schedule or berth plan is connected.**

| Capability | Live AIS | Simulation |
|---|---|---|
| Position, course and speed | AISStream reports | Generated scenario |
| Destination and vessel type | When broadcast by the vessel | Sample data |
| Estimated arrival | Straight-line distance / reported speed | Same calculation |
| Scheduled arrival, voyage and berth | Unavailable | Synthetic examples |
| Deviation and berth-conflict alerts | Unavailable without an operational plan | Interactive scenario |
| Search, vessel details, CSV and printable report | Available, with source labels | Available, with source labels |

ETA is an illustrative distance/speed estimate, not a confirmed port call. It does
not model fairways, pilotage, tides, stops or actual berth readiness. A vessel in
the monitored area is not necessarily heading to Zeebrugge.

## Data flow

```text
AISStream → Vercel server (private key, fixed monitoring area)
                    ↓ validated public vessel fields only
             GitHub Pages / Vercel dashboard
```

The public endpoint is read-only. It collects a bounded seven-second window of
AIS messages, closes the upstream socket before completing the HTTP response,
and caches the snapshot for 30 seconds. Concurrent requests on the same warm
instance share one collection; the CDN also caches successful responses.
The browser shows the age of the AIS data and retries failures explicitly.
It never silently replaces live positions with sample vessels.

The first collection can take longer while AISStream opens its connection.
The short-lived cache is not a vessel-history database or a global connection
coordinator. This setup targets portfolio traffic; AISStream account connection
limits still apply across separately scaled instances.

## Run locally

Use Node 24:

```sh
npm ci
npm start
```

Open `http://localhost:3000/?mode=demo` for the simulation. A personal live key can
be entered in Settings on localhost; it is held in session storage and sent only
to the local `/ais` proxy. The public website disables this key field and uses
the server-owned relay instead.

The snapshot contains intentionally public vessel data and permits cross-origin
GET requests without credentials. Never expose the local personal-key proxy as
a public service.

## Deploy the public relay

The linked Vercel project is `kippiegs-projects/vessel-eta-live`.
Store `AISSTREAM_API_KEY` as a **Secret, Production** environment variable in that
project, then deploy with `vercel --prod`. Never put the value in source, command
arguments, a `NEXT_PUBLIC_` variable, a browser bundle or GitHub Pages.

- Frontend and relay: [vessel-eta-live.vercel.app](https://vessel-eta-live.vercel.app/)
- Public snapshot: [/api/live](https://vessel-eta-live.vercel.app/api/live) (validated vessel fields, no secret)
- GitHub Pages publishes only the explicit `site/` build artifact.
- Vercel deploys the same frontend and the `api/live.mjs` Node function in Washington, D.C..
- Both sites fetch `https://vessel-eta-live.vercel.app/api/live` every 30 seconds.

After a key rotation, redeploy and run `node scripts/check-live.cjs`; this probes
the public endpoint without reading the key. The previously exposed credential
was disabled in the provider account on 24 November 2026.

## Verification

```sh
npm test
npm run test:e2e
node --test .github/scripts/deploy-pages.test.mjs
npm audit
```

Tests cover the fixed subscription, sanitization, shared collection, cache expiry,
read-only access, provider errors, empty feeds and upstream socket cleanup. Desktop and
mobile browser tests cover simulation, live-mode separation, failure states,
settings, filtering, exports and safe printing. CI runs these before Pages deploys.

Leaflet and Chart.js come from locked npm dependencies. Map tiles use attributed
OpenStreetMap and optional weather uses Open-Meteo. Weather or tile failures do
not convert simulated positions into live data.
