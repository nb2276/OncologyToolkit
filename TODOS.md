# OncologyToolkit TODOs

Tracking open work and ideas for future improvement.

## Open

### Automate CACHE_VERSION bump
**Priority:** P2
**Component:** sw.js, deploy workflow
**Discovered:** 2026-05-08

`sw.js` requires manual `CACHE_VERSION` bump on every deploy that changes a precached file. Forgetting it ships fresh HTML against stale cached JS until the next bump. Options: pre-commit hook that bumps if any precached file is staged; GitHub Actions step that derives the version from the latest git SHA; or a tiny build step that hashes precache file contents.

### Formalize design system as DESIGN.md
**Priority:** P2
**Component:** docs, style.css
**Discovered:** 2026-05-30 (during /plan-design-review for the tool-hub landing)

The de facto design system lives implicitly in `style.css` (CSS variables under `:root` + `[data-theme="light"]`, DM Sans body / Outfit display, `.bed-card` token, radius scale, transition scale, accent `#4fc3f7` / `#0288d1`). Future `/plan-design-review` runs would calibrate more consistently against a real `DESIGN.md`. Run `/design-consultation` to inventory tokens, document the type scale, document component vocabulary, and add usage rules (e.g., "tile cards use class composition with `.bed-card`; new `.foo-*` class families should match the breakpoint convention of 900 px nav-hamburger + 700 px content stack").

### PSA: define duplicate-same-day measurement handling
**Priority:** P3
**Component:** psa.js (parseInput / fitExponential)
**Discovered:** 2026-06-10 (Codex outside-voice during PSA figure review)

Multiple PSA values on the same date are currently treated as independent observations, which slightly distorts the regression slope and inflates apparent precision (narrower CI). Options: reject duplicates, average same-day values, or keep as-is with a UI note. Low frequency in practice; deferred. Start in `parseInput` (dedupe/aggregate by `date.getTime()`), then confirm `fitExponential` weighting still holds and update tests.

## Completed (2026-03-16)

- [x] URL Parameter State Sharing — `url-state.js` shared module, BED/Composite/ReRT
- [x] Dose Constraint Reference Page — `constraints.html` + `constraints.js` + `constraints-data.json` (QUANTEC/HyTEC)
- [x] Calculation History (localStorage) — `history.js` shared module, collapsible section on BED/Composite
- [x] CSS Table of Contents + Component Organization — TOC added to top of `style.css`
- [x] Shared Clipboard Helper — `clipboard.js`, used across all copy flows
- [x] Keyboard Shortcuts — `shortcuts.js` (/ or Ctrl+K to focus, Escape to blur)
- [x] Print-Friendly Output — `@media print` stylesheet in `style.css`
- [x] Common Regimen Presets — Dropdown on BED page with 12 common schemes
- [x] Input Validation with Helpful Ranges — Inline warnings on BED and Composite pages
