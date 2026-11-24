# Closeout audit — 24 November 2026

Settings now toggle actual Leaflet overlays, respect notification switches, validate threshold ordering, and immediately update list, details, timeline and KPIs. The drawer uses a native dialog with Escape and focus restoration. Terminal text is escaped before printing. The hosted-site key field and connect control are disabled; an early hostname guard preserves simulation and avoids storing a key on the public site. The regression test exercises both local-proxy and hosted origins. Superseded conflicting PR #1 was closed, with its branch preserved.

4 Chromium browser checks passed across 1440×1000 desktop and 390×844 mobile emulation. No uncaught page errors or horizontal page overflow were observed. The full five-project set contains 20 browser checks. Current npm audit: zero known vulnerabilities. Publication uses the immutable artifact ID from the upload output and the official Pages REST API with job-scoped OIDC. Eight deployment tests cover success, mismatched source artifacts, failed deploys, status outages, timeout/cancellation, delayed metadata, missing artifacts and permission denial. Metadata reads for the exact upload ID retry briefly while GitHub propagates the artifact; deployment creation is never blindly retried. Credentials and request payloads are not logged. Local Markdown links resolve. Browser plugin not available; validation used Playwright. Physical devices, Safari and production terminal/ERP integrations are outside this synthetic portfolio acceptance scope.

# Verification — 24 November 2026

Vessel rows now use larger text and fewer badges. Delays appear first by default; arrival-time sorting remains available. Search, keyboard detail opening and CSV export are covered on desktop and mobile. Leaflet and Chart.js are served from locked dependencies, so their CDNs are not required at runtime.

The demo explicitly classifies its eight container vessels as AIS cargo type 70. Browser checks verify cargo includes all eight, tanker returns an explained empty result, and All restores the list.

Current checks: production build, functional browser flows on desktop/mobile, CSV/download contents and no uncaught browser errors. PDF source reconciliation and gate-validator checks run in their respective CI pipelines. Updated screenshots are actual renders of the production artifacts.

## Earlier release evidence

# Verification record

Portfolio refresh · 8 November 2026

- `npm test`: two Node server tests passed. Root/query/manifest work; source,
  environment, git metadata and local drafts return 404.
- Inline JavaScript compiled with Node's syntax checker.
- `npm audit`: zero known vulnerabilities.
- Chromium: eight demo vessels start automatically; search, vessel detail,
  CSV export, pause without credentials and restart passed.
- Desktop/mobile fit checked. The ETA chart has a bounded 120px plot, preventing
  a responsive-canvas growth loop from consuming the vessel list.
- The old tile provider returned an API-key watermark; it was replaced with
  attributed OpenStreetMap tiles and visually checked in actual screenshots.
- Live AIS and production N4 access were not exercised; see PORTFOLIO.md.

## Browser evidence

Desktop screenshots use a 1440 × 1040 viewport; mobile screenshots use 390 × 844.
These are actual Chromium captures of the built applications, not design mockups.
Screenshots show sample data. External map, chart-library or weather availability
can vary independently of the application.

- [Desktop capture](screenshots/desktop.png)
- [Mobile capture](screenshots/mobile.png)
- [Local commands and demo boundary](PORTFOLIO.md)

The public deployment is built from the committed source by
`.github/workflows/portfolio-pages.yml`. Review its Actions run for the exact
commit and deployment result; this note is not a claim of production integration
certification, a full accessibility audit or a penetration test.

## Final review — 15 November 2026

The published demo was rechecked in Chromium using Playwright at 1440 × 1040
and 390 × 844. Page identity, meaningful content, absence of framework overlays,
working user interactions and CSV contents all passed. No uncaught JavaScript
errors or page-level horizontal overflow were observed. Desktop and mobile
screenshots were refreshed from the published demo.

The exact routes, viewports and interaction checks are recorded in
[the machine-readable final review](verification/final-review.json).
The finalized source is preserved by the `portfolio-2026-11-15` release tag.

## External account action — resolved

Resolved on 24 November 2026: after the owner authenticated, the previously exposed AISStream credential was matched to the historical repository credential without displaying its value. It was disabled in the authenticated provider account; the UI confirmed Disabled and offered Re-enable. A replacement credential was subsequently created by the owner and saved as a secret Production variable in the separate Vercel relay project. The value was not read into source or chat. Public live AIS was verified through the deployed relay; simulation remains a separate explicit mode. Two pre-existing local drafts remain outside the published artifact and were preserved.


## Secure public live AIS — 24 November 2026

The owner saved `AISSTREAM_API_KEY` as a Secret for Production in
`kippiegs-projects/vessel-eta-live`. The authenticated Vercel UI and CLI confirmed
the variable exists; its value was not requested or logged. After redeployment,
the public WebSocket delivered actual AIS positions and Chromium displayed
ANDREA, MULTRATUG 3 and EVER ECHO in live mode with no synthetic schedule.

Nine Node checks cover local file isolation and the relay; eight browser checks
cover desktop and mobile, including mode changes and an unavailable feed. Eight
Pages deployment checks cover artifact identity and deployment failure handling.
Public live reception is a point-in-time integration check, not a guarantee of
continuous provider coverage or unlimited concurrent connections.

Live mode intentionally leaves schedule, deviation, critical delays and berth
conflict KPIs unavailable. Reports and exports identify their data source. The
previous screenshot pair shows the simulation; new live captures are separate.
