# Oncology Toolkit

Static clinical calculator site for radiation oncology. Plain HTML/CSS/JS, no build step. Hosted on GitHub Pages at **oncologytoolkit.com**. Repo: `nb2276/OncologyToolkit`.

## License

MIT — see [LICENSE](LICENSE). New source files don't need per-file headers.

## Stack

Vanilla ES5 JS, single CSS file, XML/JSON data loaded client-side. No npm, no bundler, no CI. Push to `main` → GitHub Pages auto-deploys.

Vendored deps: `vendor/chart.umd.min.js` (Chart.js 4.4.0) + `vendor/chartjs-adapter-date-fns.bundle.min.js` (3.0.0), used by PSA page only. Localized so the PWA works offline. Google Fonts (DM Sans body, Outfit display) still load from `fonts.googleapis.com` — they're not precached.

## PWA

The site is an installable PWA. Files: `manifest.webmanifest`, `sw.js`, `pwa.js`, plus generated icons (`favicon-192.png`, `favicon-512.png`, `favicon-maskable-512.png`). Every HTML page links the manifest, sets `viewport-fit=cover`, and defers `pwa.js` for SW registration.

**Deploy discipline:** if you change any precached file (HTML/CSS/JS/manifest/vendor), bump `CACHE_VERSION` in `sw.js` (top of file). Browsers detect SW updates by byte-diff on `sw.js` — same bytes means no update. Forgetting this ships new HTML against stale cached JS until the next bump.

This is enforced rather than remembered:

```bash
git config core.hooksPath .githooks     # once per clone — enables the pre-commit guard
node tools/cache-version.js --check     # exit 1 if a bump is owed (what the hook runs)
node tools/cache-version.js --bump      # write the next version
node tools/cache-version.js --list      # print the guarded paths
```

`tools/cache-version.js` reads the precache list out of `sw.js` itself, so adding a file to `REQUIRED_PRECACHE` puts it under the guard automatically — there is no second list to drift. It compares the **index** against `origin/main` (what a commit would actually ship, so unstaged edits don't cause false alarms) and only complains when a precached file changed while `CACHE_VERSION` did not. `git commit --no-verify` bypasses it. If the precache arrays are ever renamed the parser throws instead of silently matching nothing, because a guard that quietly passes forever is worse than no guard.

The service worker uses an atomic `REQUIRED_PRECACHE` (install fails on any 404) plus best-effort `OPTIONAL_PRECACHE`. ICD-10/IMRT XML use stale-while-revalidate against a versionless `DATA_CACHE` so the 9 MB file isn't re-downloaded each deploy. `skipWaiting()` runs after install succeeds and `clients.claim()` runs after activate — updates land on the user's NEXT fetch, not after a full close-and-reopen. The earlier no-skipWaiting policy (which existed to protect mid-session DOM state from desyncing with a freshly-activated worker) was reverted in v9 because: (a) the protected scenario is theoretical here — a session is one calc load and state lives in form inputs + URL params, not long-lived SW state, and (b) the cache-first asset strategy meant any structural change to precached files (e.g., a new page) left existing-PWA users with new HTML loading old assets until they manually closed every tab. The stale-asset bug was concrete; the desync risk was hypothetical.

Analytics: Google Analytics `G-PP2FRCMYS1` + Cloudflare Web Analytics beacon `9025e64d4fb24f0db5c38419fc44f7a2`.

## Pages

| Page | Tool | Backing JS |
|------|------|------------|
| `index.html` | Hub landing — 2×3 / 3×2 tile grid + recents row (BED + Composite + ReRT) | inline `<script>` in the page; reads `history.js` + `url-state.js` |
| `bed.html` | BED / EQD2 calculator | `bed.js` + `math.js` |
| `psa.html` | PSA doubling time | `psa.js` (Chart.js) + `history.js` + `url-state.js` + `clipboard.js` |
| `composite.html` | Composite dose (re-tx tolerance) | `composite.js` + `math.js` |
| `rert.html` | Reirradiation OAR tolerance (UMich ReRT) | `rert.js` + `math.js` |
| `constraints.html` | QUANTEC/HyTEC/NRG/ASTRO-DVH/SFRO dose constraints | `constraints.js` |
| `icd.html` | ICD-10 code search | `script.js` (XHR-loads 9 MB `icd10.xml` only on this page) |
| `about.html` | About / contact | `theme.js` only |

All pages share: nav (hamburger on mobile at ≤900 px), theme toggle, site disclaimer footer, both analytics scripts. The hub doesn't show an `.active` nav link — the brand mark serves as the Home affordance. Six calculator tiles route to the six calc pages; the seven nav links (BED, PSA, Composite, ReRT, Constraints, OncBrain external, About) are reachable from every page including the hub.

## JS modules

**Shared (loaded by multiple pages):**
- `math.js` — single source of truth for `calcBED`, `calcEQD2`, `isoeffDose`, `fmt`. Used by bed/composite/rert. **No duplication** — do not re-implement these formulas.
- `url-state.js` — `parseUrlParams` / `applyUrlParams` / `serializeToUrl` for shareable calculator links, plus `buildToolUrl(toolPath, params)` for building hub recents URLs from a params object (since `serializeToUrl` reads from the current DOM and is unusable from the hub).
- `history.js` — localStorage history (10-item dedupe) for calculators. `saveToHistory(tool, ids, extraParams?)` merges optional `extraParams` (keys outside the fixed input list) into the saved params — ReRT uses this for OAR selection + per-OAR doses, PSA for the computed doubling time / count / date span. `renderHistory(tool, ids, updateFn, summaryFn, restoreFn?)` accepts an optional `restoreFn` that owns the full restore when a plain `el.value = params[id]` loop can't rebuild state (ReRT re-ticks OAR checkboxes before filling doses; PSA must keep the restored projection). Each rendered item is a `.history-item-summary` + a muted `.history-item-date` (`relativeTime(ts)` — "5m ago" / "2d ago" / short date). Shared summary functions `bedSummary` / `compositeSummary` / `rertSummary` / `psaSummary` are the single source of truth (page JS + hub both call them); they format from raw params only (no math.js — the hub doesn't load it), so derived fields like BED's Gy/fx use the local `trimNum` helper and PSA's doubling time is precomputed into params. `getRecentAcrossTools(limit)` powers the hub recents (merges `history_bed` + `history_composite` + `history_rert` + `history_psa`, defensively filters malformed entries, sorts ts desc).
- `theme.js` — dark/light toggle, persists to `localStorage['theme']`, dispatches `'themechange'` event. Inlined in `<head>` to prevent flash.
- `clipboard.js` — `navigator.clipboard` with `execCommand` fallback.
- `shortcuts.js` — `/` or `Ctrl+K` to focus first input, `Esc` to blur. No-ops gracefully on the hub (no inputs).
- `decimals.js` — global decimal-places preference shared by bed/composite/rert. Persists to `localStorage['decimalPlaces']` (default 2), dispatches a `'decimalschange'` event that pages listen for to re-render, and mounts its selector into any `#decimals-control` element on the page.
- `validate.js` — `applyRangeWarning(inputEl, warnEl, range)` and `classifyRange(val, range)`. Single source of truth for fat-finger guardrails. Three states: blank (no warning), negative (red `.input-range-error` "Cannot be negative"), out-of-typical (yellow hint with `range.label`). Used by `bed.js` / `composite.js` / `rert.js` validation passes. Must load before its consumers in every HTML page that uses validation.

**Page-specific:**
- `script.js` — XHR-loads `icd10.xml`, AND-match search, 100-result cap, click-to-copy. Loaded **only** by `icd.html` (never by the hub at `/`).
- `bed.js` — preset regimens, validation ranges (`BED_RANGES`, max fx=80), update() pattern. Validation delegates to shared `applyRangeWarning` from `validate.js`. History label uses the shared `bedSummary` from `history.js`.
- `psa.js` — the biggest surface on the site. Grouped by concern:
  - **Fit** — unweighted log-linear regression of ln(PSA) on time (standard PSADT; DT = ln2/B). `fitExponential` returns varB/covAB plus log-scale `rSquared`/`rSquaredDefined`/`ciEstimable`; `doublingTimeCI` inverts B's CI and returns `{estimable:false}` when it straddles zero; `psaVelocity` is a **separate** linear regression on raw PSA (ng/mL/yr). `fittablePoints` is the one filter all three share (positive and non-censored).
  - **Recent trend** — `recentWindow` splits the fittable points into a trailing window (prefers 12 months; widens until ≥3 points span ≥90 days) and the earlier remainder; `compareTrend` tests the difference in rate constant B across those **disjoint** sets. Renders only when that test resolves. See "Clinically non-obvious logic" for why.
  - **Parsing** — `parseLine` handles below-detection values (`<0.014`, `< 0.014`, `<=`, `≤`) as `censored: true` carrying the reported limit; strips clock times before tokenising; treats a whole field matching `GROUPED_NUMBER` as thousands-separated; strips quotes for Excel pastes; accepts month-name dates in both orders. `countUnparsedLines` drives a note for lines that could not be read.
  - **Display** — measurements are echoed **as entered**: `parseLine` keeps the typed numeric text as `psaText`, and `fmtPsaCell` / measurement readouts show that (an entered `0.154` must not re-round to "0.15" in the table that exists to confirm parsing). `fmtPsa` is for **computed** values only (curves, projections, velocity) and scales precision to magnitude (3 decimals below 0.1 so ultrasensitive values don't collapse to "0.00", 2 sig figs below 0.001, else 2 decimals); `fmtPsaCell` prefixes `< ` for censored rows; `noiseCaveat` emits at most one caution. Censored rows are listed (`.psa-row-censored`), plotted as a down-triangle "Below detection" series, and excluded from both regressions.
  - **Chart readouts** — `hoverTarget` resolves what the cursor is over (nearest measurement within 14 px, else fitted or recent-trend curve within 30 px) and **every readout names its source**. `lastFittedDateMs` anchors the projection-shading divider to the last point the fit used, so a trailing censored or PSA ≤ 0 row cannot present extrapolation as measured data.
  - **State** — saves/restores the whole `psaInput` textarea + `projectionYears` (`PSA_INPUT_IDS`) to `history_psa` and the shareable URL, plus computed `psa-dt`/`psa-n`/`psa-span` extras for labels. `calculate(keepProjection)` skips the auto-projection default when restoring; `restorePsaEntry`/`initPsaFromUrl` rebuild from a history click or `?psaInput=…` (custom URL parse, since `parseUrlParams` drops non-numeric textarea text). Axis mode is view-only, not persisted.
  - **Export** — `copyResults` composites headline, caveats, chart, table, and footer into a themed PNG. See [DESIGN.md §7](DESIGN.md).
- `composite.js` — tolerance BED − (prior BED × TDF), warns if prior > tolerance. Validation via shared `applyRangeWarning` (`COMP_RANGES`, max fx=80). History label uses the shared `compositeSummary` from `history.js`.
- `rert.js` — biggest file (~500 lines). `OAR_DATA` const = 24 OARs (22 serial + 2 parallel). TRF auto-highlights based on months since prior RT. Saves/restores **full state** — plan-level inputs (`pr-fx`, `pr-ab`, `pr-mo`, `custom-fx`) plus the OAR selection (`rert-oars`) and per-OAR doses (`dose-<id>`) — to `history_rert` and to the shareable URL. Saving fires on `change` of any plan input, OAR checkbox, or dose; `restoreRertState(params)` rebuilds the page (resets OARs → sets plan inputs → re-ticks saved OARs → fills doses), guarded by `isRestoring` so the re-ticking doesn't re-save. `serializeRertToUrl` / `initRertFromUrl` / `setupRertCopyLink` replace the generic url-state helpers because the link carries OARs + doses. `RERT_RANGES` + per-OAR `OAR_DOSE_RANGE_GY` / `OAR_DOSE_RANGE_CC` drive `validateRertInputs()` (called from `updateAll`) via shared `applyRangeWarning`.
- `constraints.js` — fetches `constraints-data.json`, AND-match search, source filter, PubMed links.
- `tests.js` — test suite. Run with `node tests.js` (no test framework, no build — vanilla DOM-shimmed `node:vm` sandbox). Currently 572 assertions, 0 failures.

## CSS

**Design system: see [DESIGN.md](DESIGN.md)** — tokens, type, breakpoint convention, component vocabulary, accessibility floors, and the rules for exported artifacts. Read it before adding UI.

Single `style.css` (~50 KB) with numbered TOC at top (sections 1–21). Theming via CSS variables under `:root` and `[data-theme="light"]`. Dark is default. Accent: `#4fc3f7` (dark) / `#0288d1` (light). Section 21 is the hub landing (`.hub-container` / `.hub-grid` / `.hub-tile` / `.hub-recents` / `.hub-recent-pill`). `.hub-tile` uses class composition (`<a class="bed-card hub-tile">`) so it inherits `.bed-card` chrome and only contains hub-specific deltas. **Mobile breakpoint convention: `@media (max-width: 900px)`** to match the nav hamburger; new responsive sections must use this same breakpoint so nav and content switch to mobile mode together.

The PSA layout stacks at that same 900 px (it was 780 px, so between 781–900 px the nav was a hamburger while the content was still two columns). When stacked, `.psa-col-left` / `.psa-col-right` become `display: contents` so their children reorder independently: input → results → parsed table → history. Authored order puts the whole parsed table between the Calculate button and the doubling time, which on a phone means scrolling past every row to reach the answer. CSS `order` moves the boxes but not the DOM, so the result card carries `aria-live="polite"` and `#psaError` carries `role="alert"` — the answer is announced regardless of reading position. Focus order is unaffected: the parsed table holds no focusable elements.

When adding styles, find the right numbered section and add there — don't append to the bottom.

## Data

| File | Size | Format | Loaded by |
|------|------|--------|-----------|
| `icd10.xml` | 9.5 MB | nested `<diag>` with `<name>` + `<desc>` | `script.js` (XHR) |
| `imrt_codes.xml` | 67 KB | oncology subset | not currently consumed |
| `constraints-data.json` | 33 KB | `[{organ, endpoint, constraint, dose, metric, rate, fractionation, source, citation, pmid}]` | `constraints.js` (fetch) |

## Conventions

- **Input IDs match URL params and history keys** — e.g. `bd-dose`, `bd-fx`, `st-dose`. Don't break this contract or you break shareable links + history restore.
- **Validation warnings** — `warn-{inputId}` element pattern. Add a `<span class="input-range-warning" id="warn-{id}">` next to every numeric input you want guarded, then add the input id + range to the page's `*_RANGES` map. `validate.js` does the rest. Negative values get a distinct red `.input-range-error` variant; non-negative out-of-typical values use the softer yellow hint.
- **OAR DOM IDs** — `oar-card-{id}`, `dose-{id}`, `eqd2disp-{id}`, `trf-chip-{id}-{idx}`.
- **Calculator pattern** — input → validate → `update()` → re-render results + push to history + sync URL.
- **Nav active state** — set `.active` on the matching `.nav-link` in each page's nav block.

## Clinically non-obvious logic

- **PSA input hardening** — the defects behind it, so they aren't reintroduced: a clock time used to tokenise on the colon and make the *hour* the PSA value (`08:30 4.5` → 8); a thousands separator truncated (`1,234` → 1). Both produced a confident doubling time from a number the user never entered, which is the worst failure this tool has. The thousands rule matches a **whole field** on purpose — collapsing `\d,\d{3}` anywhere destroys a `2024-01-15,123` CSV pair (there is a test for exactly that). Unreadable lines are counted and reported rather than dropped silently.
- **PSA chart readouts** — with two curves drawn, an *unlabelled* readout is worse than none: the tooltip used to compute from the overall fit while the cursor sat on the recent-trend line (8.67 vs 5.19 at +120 d in the test series), and where the curves run close the wrong number looked plausible. Every readout names its source. Measurements beat curves on proximity because a plotted point is a fact and a curve is a model.
- **PSA same-day measurements**: two draws on one day are two reads of one value, not two points in time. Kept separate they anchor the fit to that date and inflate n, narrowing the CI on precision the data doesn't have. `collapseSameDay` averages them per regression — **geometric** for `fitExponential` and `recentWindow` (the mean of ln values *is* the ln of the geometric mean, so it is exactly the average the log-linear fit would take) and **arithmetic** for `psaVelocity` (raw scale). The parsed table still lists every value as entered, and `psaSameDayNote` reconciles the two out loud. Exact duplicates are removed earlier by `dedupeMeasurements`; this handles same-date *different* values.
- **PSA recent-trend comparison**: `recentWindow` splits the fittable points into a trailing window (prefers 12 months; widens until ≥3 points spanning ≥90 days) and the earlier remainder. `compareTrend` tests the difference in rate constant B between those two **disjoint** sets (Var(diff) = sum of variances — testing recent against the *overall* fit would double-count the shared points and overstate significance), requiring n≥3 on both sides so varB isn't a fake zero. The row and its chart line only render when that test resolves: a "recent trend" number without a beyond-noise verdict invites reading acceleration into scatter. Wording is deliberately descriptive ("growth rate increased vs the earlier values") and never causal — treatment start/stop, 5-ARIs, testosterone recovery, benign post-RT bounce, and assay changes all produce the same signal and are invisible to this page. `noiseCaveat` shows at most one message: series moving <20% total (assay + biological variation can produce that alone) outrank the ultrasensitive-scatter note.
- **PSA fit**: unweighted ordinary least-squares on ln(PSA) vs time (the clinical PSADT standard — equal weight per measurement in log space, matching PSA's multiplicative/log-normal error). Replaced the earlier weighted `w=y²` form in 2026-06 (over-weighted high values, not the clinical convention). Handles halving (negative slope). Variance-covariance matrix powers the CI band + the doubling-time CI; the doubling-time CI is suppressed ("not estimable") when the slope CI straddles zero, since `ln2/B` is then unbounded. Log-scale R² is guarded (undefined for <3 points or constant PSA). PSA velocity is a **separate** linear regression of raw PSA on time, not derived from the exponential fit.
- **BED**: `D × (1 + d/(α/β))` where `d = D/n`. **EQD2**: `D × (d + α/β) / (2 + α/β)`. Inverse for isoeffective fractionation solves a quadratic.
- **ReRT TRF buckets** (UMich): serial `<3mo→0, 3–6mo→0.1, 6mo–1yr→0.25, 1–3yr→0.5, >3yr→0.5`; parallel `<3mo→0, 3–6mo→0, 6mo–2yr→0.25 or 0.5, >2yr→0.5 or 1`. Active bucket auto-highlights from months-since-RT input.
- **Composite TDF**: 0 = full recovery, 1 = no recovery. Empirical, not from a specific paper.
- **Lungs V16 / Liver V32**: volumetric (cc), not Gy. Different math from serial OARs.

## Things to know before touching things

- BED math lives in `math.js` only — don't copy formulas into page JS.
- PSA fit math is subtle; don't "simplify" the weighting without checking against the existing test cases.
- ICD-10 XML is ~9 MB; don't load it on pages that don't need it.
- No CNAME file in repo — custom domain is configured in GitHub Pages UI.
- No `.gitignore` — be careful what you add to the repo root.
