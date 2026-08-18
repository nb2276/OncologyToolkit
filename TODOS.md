# OncologyToolkit TODOs

Tracking open work and ideas for future improvement.

## Open

### Codex cross-model review of the 2026-08 PSA work
**Priority:** P1
**Component:** psa.js (parsing, fit statistics, chart readouts)
**Discovered:** 2026-08-18 — tracked as [issue #24](https://github.com/nb2276/OncologyToolkit/issues/24)

Five PRs shipped on 2026-08-17/18 (#23, #25, #26, #27) without a cross-model pass: Codex was over its usage limit the whole session, so the adversarial review ran in the same context that wrote the code. That is one perspective wearing two hats, and it already cost something — the hover bug fixed in #26 was introduced by #25.

Highest value to scrutinise, in order:

1. `compareTrend` uses `se = sqrt(varB_recent + varB_earlier)` with pooled `df = (n_recent - 2) + (n_earlier - 2)`. With unequal residual variances this is closer to a Welch problem; is the pooled form anticonservative at n=3-4 per side?
2. `recentWindow` picks the window boundary from the data, then a significance test runs at that boundary — a garden-of-forking-paths concern for the false-positive rate.
3. `PSA_NOISE_FOLD = 1.2` and `ULTRASENSITIVE_MAX = 0.1` threshold choices.
4. Excluding below-detection values from the fit rather than substituting the limit or half the limit — the one clinical modelling call in the batch.
5. `parseLine` after the QA hardening: clock-time stripping, `GROUPED_NUMBER` field matching, month-name dates.

Run `/code-review ultra 25` (and 26) or point Codex at `git diff 7df27b6..86cb3a6`. Blocks Phase 2 of the PSA rate-change work (changepoint detection), which builds directly on the statistics in item 1.

### Automate CACHE_VERSION bump
**Priority:** P2
**Component:** sw.js, deploy workflow
**Discovered:** 2026-05-08

`sw.js` requires manual `CACHE_VERSION` bump on every deploy that changes a precached file. Forgetting it ships fresh HTML against stale cached JS until the next bump. Options: pre-commit hook that bumps if any precached file is staged; GitHub Actions step that derives the version from the latest git SHA; or a tiny build step that hashes precache file contents.

### PSA: define duplicate-same-day measurement handling
**Priority:** P3
**Component:** psa.js (parseInput / fitExponential)
**Discovered:** 2026-06-10 (Codex outside-voice during PSA figure review)

Multiple PSA values on the same date are currently treated as independent observations, which slightly distorts the regression slope and inflates apparent precision (narrower CI). Options: reject duplicates, average same-day values, or keep as-is with a UI note. Low frequency in practice; deferred. Start in `parseInput` (dedupe/aggregate by `date.getTime()`), then confirm `fitExponential` weighting still holds and update tests.

## Completed (2026-08-18)

- [x] Formalize design system as DESIGN.md — [DESIGN.md](DESIGN.md) documents tokens, type, the 900 px breakpoint convention, component vocabulary, accessibility floors, and the rules for exported artifacts

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
