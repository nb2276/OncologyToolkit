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
- `validate.js` — `applyRangeWarning(inputEl, warnEl, range)` and `classifyRange(val, range)`. Single source of truth for fat-finger guardrails. Three states: blank (no warning), negative (red `.input-range-error` "Cannot be negative"), out-of-typical (yellow hint with `range.label`). Used by `bed.js` / `composite.js` / `rert.js` validation passes. Must load before its consumers in every HTML page that uses validation.

**Page-specific:**
- `script.js` — XHR-loads `icd10.xml`, AND-match search, 100-result cap, click-to-copy. Loaded **only** by `icd.html` (never by the hub at `/`).
- `bed.js` — preset regimens, validation ranges (`BED_RANGES`, max fx=80), update() pattern. Validation delegates to shared `applyRangeWarning` from `validate.js`. History label uses the shared `bedSummary` from `history.js`.
- `psa.js` — unweighted log-linear regression of ln(PSA) on time (standard PSADT; doubling time = ln(2)/B), 95% CI band on the trend, click/tap-to-query. Pure helpers `fitExponential` (returns varB/covAB + log-scale `rSquared`/`rSquaredDefined`/`ciEstimable`), `doublingTimeCI` (inverts B's CI; returns `{estimable:false}` when the slope CI straddles zero), `psaVelocity` (separate linear regression, ng/mL/yr). `parseLine` accepts below-detection results (`<0.014`, `< 0.014`, `<=0.014`, `≤0.014`) and returns `censored: true` with the reported limit as `psaValue`; censored rows are listed in the parsed table (`.psa-row-censored`, `fmtPsaCell` prefixes `< `), plotted as a separate down-triangle "Below detection" dataset at the limit, noted in `psaCensoredNote`, and excluded from both `fitExponential` and `psaVelocity` (fitting them at their limit would bias the slope). The parsed table now also stays visible when the fit fails, so an all-undetectable series still shows its rows. The projection-shading divider comes from `lastFittedDateMs` (last point the fit used), not the last row — a trailing censored or PSA ≤ 0 row must not present extrapolation as measured data. All PSA values render through `fmtPsa` (magnitude-scaled precision: 3 decimals below 0.1 so ultrasensitive assay values like 0.008 don't collapse to "0.00", 2 sig figs below 0.001, 2 decimals otherwise) — used by the parsed table, chart tooltip, click readout, PNG export, and `fmtVelocity`. Chart has a linear(capped)/log y-axis toggle (`toggleAxisScale`, `yAxisType`) and a shaded projection region. Saves/restores full state to `history_psa` + the shareable URL: the whole `psaInput` textarea + `projectionYears` (`PSA_INPUT_IDS`), plus computed `psa-dt` / `psa-n` / `psa-span` extras for the label (axis mode is view-only, not persisted). `calculate(keepProjection)` skips the auto-projection-default when restoring; `restorePsaEntry` / `initPsaFromUrl` reconstruct from a history click or `?psaInput=…` (custom URL parse since `parseUrlParams` drops the non-numeric textarea text).
- `composite.js` — tolerance BED − (prior BED × TDF), warns if prior > tolerance. Validation via shared `applyRangeWarning` (`COMP_RANGES`, max fx=80). History label uses the shared `compositeSummary` from `history.js`.
- `rert.js` — biggest file (~500 lines). `OAR_DATA` const = 24 OARs (22 serial + 2 parallel). TRF auto-highlights based on months since prior RT. Saves/restores **full state** — plan-level inputs (`pr-fx`, `pr-ab`, `pr-mo`, `custom-fx`) plus the OAR selection (`rert-oars`) and per-OAR doses (`dose-<id>`) — to `history_rert` and to the shareable URL. Saving fires on `change` of any plan input, OAR checkbox, or dose; `restoreRertState(params)` rebuilds the page (resets OARs → sets plan inputs → re-ticks saved OARs → fills doses), guarded by `isRestoring` so the re-ticking doesn't re-save. `serializeRertToUrl` / `initRertFromUrl` / `setupRertCopyLink` replace the generic url-state helpers because the link carries OARs + doses. `RERT_RANGES` + per-OAR `OAR_DOSE_RANGE_GY` / `OAR_DOSE_RANGE_CC` drive `validateRertInputs()` (called from `updateAll`) via shared `applyRangeWarning`.
- `constraints.js` — fetches `constraints-data.json`, AND-match search, source filter, PubMed links.
- `tests.js` — test suite. Run with `node tests.js` (no test framework, no build — vanilla DOM-shimmed `node:vm` sandbox). Currently 485 assertions, 0 failures.

## CSS

Single `style.css` (~50 KB) with numbered TOC at top (sections 1–21). Theming via CSS variables under `:root` and `[data-theme="light"]`. Dark is default. Accent: `#4fc3f7` (dark) / `#0288d1` (light). Section 21 is the hub landing (`.hub-container` / `.hub-grid` / `.hub-tile` / `.hub-recents` / `.hub-recent-pill`). `.hub-tile` uses class composition (`<a class="bed-card hub-tile">`) so it inherits `.bed-card` chrome and only contains hub-specific deltas. **Mobile breakpoint convention: `@media (max-width: 900px)`** to match the nav hamburger; new responsive sections must use this same breakpoint so nav and content switch to mobile mode together.

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
