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
