# VesselETA portfolio walkthrough

1. Open the public demo: eight simulated vessels load automatically.
2. Search a vessel and select its row to inspect its approach and planned ETA.
3. Inspect berth overlaps and the arrival timeline.
4. Export the current vessel state as CSV, or print the shift handover report.
5. Stop the demo; it remains paused until a visitor explicitly supplies a key.

## Data and calculation boundary

AIS positions, N4 schedule and ship specifications in the public demo are
synthetic scenarios. Weather is separately fetched from Open-Meteo. Leaflet,
Chart.js, fonts and OpenStreetMap tiles require internet access; a failed tile
provider does not turn sample positions into real operational data.

ETA uses straight-line distance and reported speed. It is not a navigational
prediction and does not model pilotage, fairways, tides or actual berth readiness.
No live N4 integration is included. This is an independent portfolio, not an
endorsed CSP product.

## Local live-feed option

```sh
npm ci
npm start
```

Open `http://localhost:3000`, then Settings and supply your own AISStream key.
The Node server proxies the WebSocket feed because browsers may reject a direct
connection. The key is held in session storage, not bundled or logged. The public
GitHub Pages host deliberately does not attempt direct live AIS connections.

The HTTP server serves an allowlist of public dashboard files, not the repository.
