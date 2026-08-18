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

**Also queued (2026-08-18, second batch):** the same-day aggregation and the deploy guard shipped in this batch had the same limitation — Codex was still over its limit (resets Aug 19 21:16), so the adversarial pass again ran in the authoring context. It did find and fix two real defects before merge (a precache parser that would have passed silently forever if the arrays were renamed, and an index-vs-working-tree inconsistency in the guard), but that is self-review, not a second opinion. Worth Codex's view on: whether the geometric mean is the right same-day aggregate for the log-linear fit, and whether averaging rather than keeping or rejecting duplicates is the right clinical call.

Run `/code-review ultra 25` (and 26) or point Codex at `git diff 7df27b6..HEAD`. Blocks Phase 2 of the PSA rate-change work (changepoint detection), which builds directly on the statistics in item 1.

## Completed (2026-08-18)

- [x] Automate CACHE_VERSION bump — `tools/cache-version.js` (`--check` / `--bump` / `--list`) reads the precache list out of `sw.js` itself and compares the index against `origin/main`; `.githooks/pre-commit` enforces it after `git config core.hooksPath .githooks`
- [x] PSA: define duplicate-same-day measurement handling — `collapseSameDay` averages same-date values into one observation (geometric for the log-linear fit and the recent-trend window, arithmetic for velocity); the table still lists every value entered and `psaSameDayNote` says so
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
