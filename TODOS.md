# OncologyToolkit TODOs

Tracking open work and ideas for future improvement.

## Open

### Test runner is broken
**Priority:** P1
**Component:** tests.js
**Discovered:** 2026-05-08 (during PWA ship)

`tests.js` runs source files inside a `node:vm` context that has no `document`. Three calculator files (`bed.js:120`, `composite.js:158`, `rert.js:565`) execute `document.addEventListener('decimalschange', ...)` at top level (added with the decimals feature in commit `14c25b6`), so the runner crashes with `TypeError: document.addEventListener is not a function` before any assertion runs. Fix: either provide a JSDOM-style `document` shim in `tests.js`, or wrap the top-level event bindings in a guard so they only run when `typeof document !== 'undefined'`.

### Automate CACHE_VERSION bump
**Priority:** P2
**Component:** sw.js, deploy workflow
**Discovered:** 2026-05-08

`sw.js` requires manual `CACHE_VERSION` bump on every deploy that changes a precached file. Forgetting it ships fresh HTML against stale cached JS until the next bump. Options: pre-commit hook that bumps if any precached file is staged; GitHub Actions step that derives the version from the latest git SHA; or a tiny build step that hashes precache file contents.

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
