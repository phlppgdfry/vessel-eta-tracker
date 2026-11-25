# VesselETA portfolio walkthrough

1. Open the public dashboard: it loads live AIS snapshots through a server-side relay every 30 seconds.
2. Search a vessel and select its row to inspect speed, destination and approach.
3. Read the feed status and last-message age. Estimated ETA is distance/speed;
   no operational schedule, confirmed arrival or berth assignment is implied.
4. Export the current vessel state as CSV or print a report; both identify the source.
5. Choose Demo, or open `?mode=demo`, for eight simulated vessels with planned
   arrivals, deviations, berth overlaps and alerts. Choose Live AIS to return.
   Changing modes clears the previous vessels and simulated timers.

## Data boundary

Live mode shows AISStream positions and reported vessel fields. The account key
is private to the Vercel server; visitors do not supply or receive it. A feed
failure is explicit and never silently starts the simulation.

Simulation positions, schedules and specifications are synthetic scenarios.
No production N4 integration is included. ETA is a straight-line estimate and
does not model pilotage, fairways, tides or actual berth readiness.
This is an independent portfolio, not an endorsed CSP product.

Leaflet and Chart.js are served from locked dependencies. OpenStreetMap tiles,
fonts and optional Open-Meteo weather still require internet access.

## Local development

```sh
npm ci
npm start
```

Use Node 24 and open `http://localhost:3000/?mode=demo`. A personal AISStream key
can be entered on localhost to use the local WebSocket proxy; it is held only
in session storage. The public read-only relay is separate from that personal
proxy. See the [README](../README.md) for deployment and verification.
