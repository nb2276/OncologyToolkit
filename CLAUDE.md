# Oncology Toolkit

Static clinical calculator site for radiation oncology. Plain HTML/CSS/JS, no build step. Hosted on GitHub Pages at **oncologytoolkit.com**. Repo: `nb2276/OncologyToolkit`.

## License

MIT — see [LICENSE](LICENSE). New source files don't need per-file headers.

## Stack

Vanilla ES5 JS, single CSS file, XML/JSON data loaded client-side. No npm, no bundler, no CI. Push to `main` → GitHub Pages auto-deploys.

CDN deps: Chart.js 4.4.0 + chartjs-adapter-date-fns 3.0.0 (PSA page only). Google Fonts: DM Sans (body), Outfit (display).

Analytics: Google Analytics `G-PP2FRCMYS1` + Cloudflare Web Analytics beacon `9025e64d4fb24f0db5c38419fc44f7a2`.

## Pages

| Page | Tool | Backing JS |
|------|------|------------|
| `index.html` | ICD-10 code search | `script.js` |
| `bed.html` | BED / EQD2 calculator | `bed.js` + `math.js` |
| `psa.html` | PSA doubling time | `psa.js` (Chart.js) |
| `composite.html` | Composite dose (re-tx tolerance) | `composite.js` + `math.js` |
| `rert.html` | Reirradiation OAR tolerance (UMich ReRT) | `rert.js` + `math.js` |
| `constraints.html` | QUANTEC/HyTEC/NRG dose constraints | `constraints.js` |
| `about.html` | About / contact | `theme.js` only |

All pages share: nav (hamburger on mobile), theme toggle, site disclaimer footer, both analytics scripts.

## JS modules

**Shared (loaded by multiple pages):**
- `math.js` — single source of truth for `calcBED`, `calcEQD2`, `isoeffDose`, `fmt`. Used by bed/composite/rert. **No duplication** — do not re-implement these formulas.
- `url-state.js` — `parseUrlParams` / `serializeToUrl` for shareable calculator links.
- `history.js` — localStorage history (10-item dedupe) for calculators.
- `theme.js` — dark/light toggle, persists to `localStorage['theme']`, dispatches `'themechange'` event. Inlined in `<head>` to prevent flash.
- `clipboard.js` — `navigator.clipboard` with `execCommand` fallback.
- `shortcuts.js` — `/` or `Ctrl+K` to focus first input, `Esc` to blur.

**Page-specific:**
- `script.js` — XHR-loads `icd10.xml`, AND-match search, 100-result cap, click-to-copy.
- `bed.js` — preset regimens, validation ranges (`BED_RANGES`), update() pattern.
- `psa.js` — weighted least-squares exponential fit (weights `w = y²`), 95% CI bands, click-to-query.
- `composite.js` — tolerance BED − (prior BED × TDF), warns if prior > tolerance.
- `rert.js` — biggest file (~500 lines). `OAR_DATA` const = 24 OARs (22 serial + 2 parallel). TRF auto-highlights based on months since prior RT.
- `constraints.js` — fetches `constraints-data.json`, AND-match search, source filter, PubMed links.
- `tests.js` — test suite.

## CSS

Single `style.css` (~47 KB) with numbered TOC at top (sections 1–20). Theming via CSS variables under `:root` and `[data-theme="light"]`. Dark is default. Accent: `#4fc3f7` (dark) / `#0288d1` (light).

When adding styles, find the right numbered section and add there — don't append to the bottom.

## Data

| File | Size | Format | Loaded by |
|------|------|--------|-----------|
| `icd10.xml` | 9.5 MB | nested `<diag>` with `<name>` + `<desc>` | `script.js` (XHR) |
| `imrt_codes.xml` | 67 KB | oncology subset | not currently consumed |
| `constraints-data.json` | 33 KB | `[{organ, endpoint, constraint, dose, metric, rate, fractionation, source, citation, pmid}]` | `constraints.js` (fetch) |

## Conventions

- **Input IDs match URL params and history keys** — e.g. `bd-dose`, `bd-fx`, `st-dose`. Don't break this contract or you break shareable links + history restore.
- **Validation warnings** — `warn-{inputId}` element pattern.
- **OAR DOM IDs** — `oar-card-{id}`, `dose-{id}`, `eqd2disp-{id}`, `trf-chip-{id}-{idx}`.
- **Calculator pattern** — input → validate → `update()` → re-render results + push to history + sync URL.
- **Nav active state** — set `.active` on the matching `.nav-link` in each page's nav block.

## Clinically non-obvious logic

- **PSA fit**: weighted least-squares (weights `w_i = y_i²`), not simple OLS. Handles halving (negative slope). Variance-covariance matrix powers the CI bands.
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
