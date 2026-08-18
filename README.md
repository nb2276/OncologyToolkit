# Oncology Toolkit

A collection of clinical calculation and reference tools for radiation oncology, built as a static web app and hosted on GitHub Pages.

**Live site:** [oncologytoolkit.com](https://oncologytoolkit.com)

---

## Tools

The landing page is a **hub**: a 6-tile launcher (BED, ReRT, Composite, Constraints, PSA, ICD Search) above a "Recent calculations" row that one-click reopens your last calcs on BED, Composite, or ReRT. Six calculator tiles below it route to the tools described in this section.

### BED / EQD2 Calculator
Computes Biologically Effective Dose (BED) and Equivalent Dose in 2 Gy fractions (EQD2) for a given prescription.
- Configurable α/β values for Tumor (10), Late tissue (3), and Prostate/Spine (2)
- Alternative fractionation section: converts the same BED to isoeffective total doses for 1, 3, 5, and an arbitrary number of fractions
- Based on a spreadsheet by Dr. Mike Wahl

### Reirradiation Dose Calculator
Estimates remaining organ-at-risk dose tolerance for reirradiation using University of Michigan ReRT guidelines.
- 22 serial OARs and 2 parallel OARs (Lungs, Liver)
- Tissue Recovery Factor (TRF) columns for all documented time intervals; active time bucket highlighted automatically
- Results table shows remaining EQD2 and isoeffective physical doses for 1, 3, 5, and a custom number of fractions
- Toggleable columns, copy results, and print support
- Parallel OARs (Lungs V16, Liver V32) use volumetric cc inputs with remaining cc output
- All values update in real time as inputs change

### Composite Dose Calculator
Estimates the remaining tolerable dose to a previously irradiated structure.
- Inputs: structure tolerance dose/fractions/α/β, prior dose, time discount factor, planned fractions
- Outputs: remaining BED and safe physical dose per fraction
- Based on a spreadsheet by Dr. Mike Wahl

### Dose Constraint Reference
QUANTEC, HyTEC, ASTRO 2026 (Puckett) DVH, NRG protocol, and SFRO 2025 (French OAR guideline, Noël et al.) constraints with PubMed-linked citations.
- AND-match search across organ, endpoint, dose, and source
- Filter by source compendium
- Click any constraint to copy the full citation

### PSA Doubling Time Calculator
Calculates PSA doubling time from serial PSA measurements using unweighted log-linear regression of ln(PSA) on time — the standard clinical PSADT method (doubling time = ln(2)/slope).

**Reading the input**
- Flexible date parsing — `MM/DD/YYYY`, `YYYY-MM-DD`, `DD.MM.YYYY`, two-digit years, and month names (`Jan 15, 2024`)
- Tolerates real lab exports: timestamps, quoted CSV from Excel, pipe- or comma-delimited fields, stray units and reference ranges
- **Ultrasensitive values** (0.008, 0.014) display to three decimals instead of collapsing to 0.00
- **Below-detection results** (`<0.014`, `≤0.02`) are listed and plotted at the reported limit, but excluded from the fit — fitting them at their limit would bias the slope toward it
- Values with thousands separators (`1,234`) read correctly
- Lines that can't be read are counted and reported, never dropped silently

**What it reports**
- Doubling time with a 95% confidence interval, log-scale R², and PSA velocity (ng/mL/yr, a separate linear regression)
- **Recent-trend comparison** — the last stretch of measurements fitted separately and compared against the earlier ones, so an accelerating series doesn't hide inside a single all-history average. Shown only when the difference test resolves, and worded descriptively: treatment changes, testosterone recovery, and benign post-radiotherapy bounce all produce the same signal and are invisible to the page
- A caution when the total change falls inside the range assay and biological variation alone can produce

**Chart**
- Interactive Chart.js plot with a configurable projection and a 95% confidence band on the trend (trend CI, not a prediction interval)
- Hover or tap anything on the chart for a labelled readout — `Measured`, `Fitted trend`, or `Recent trend` — so a value is never mistaken for the other curve's
- Linear / log y-axis toggle; shaded projection region beginning at the last fitted point
- White background toggle and light/dark adaptation

**Export**
- Copy Results composites the headline, caveats, chart, and measurement table into a single PNG sized for pasting into a note or slide — including every caveat shown on screen, so they travel with the image

### ICD-10 Code Search
Fast full-text search of ICD-10 diagnostic codes with oncology-focused filters.
- Filter by All, Malignancy, In Situ, Benign Neoplasm, or Z Code
- Click any **code** to copy it to the clipboard
- Click the **⧉ button** on any diagnosis to copy the full text
- ICD-10 data stored locally — no API calls, instant results
- Loads the 9 MB ICD-10 XML only when you open this page (not from the hub)

---

## Features

- **Installable PWA** — install to your home screen or desktop; runs in standalone mode with iOS safe-area handling for the iPhone notch
- **Works offline** — service worker precaches the app shell, so the hub and calculators (BED, Composite, ReRT, Constraints, PSA) work without network. ICD-10 search caches lazily on first online use.
- **Recents on the hub** — returning users see their last 1–3 calculations on BED, Composite, or ReRT as one-click pills above the tile grid. Stored only in your browser's localStorage.
- **Dark / Light mode** — toggle in the nav bar, preference saved per visitor via localStorage
- **Responsive design** — works on desktop and mobile with collapsible hamburger navigation; stacked layouts put the answer directly under the button that produced it
- **Accessible** — WCAG AA contrast on any value you read, visible focus, 44 px touch targets, and results announced to screen readers when calculated
- **No account required** — all calculations run client-side in the browser

---

## Tech Stack

- **Vanilla HTML / CSS / JavaScript** — no frameworks, no build step
- **Test suite** — `node tests.js` runs 523 assertions against a DOM-shimmed sandbox; no framework, no dependencies
- **Chart.js 4.4.0** + **chartjs-adapter-date-fns 3.0.0** — vendored under `vendor/` so the PSA page works offline
- **Google Fonts** — DM Sans (body) + Outfit (headings), loaded from `fonts.googleapis.com`
- **ICD-10 data** stored locally as XML (`icd10.xml`, `imrt_codes.xml`) — all search is client-side
- **Service worker** (`sw.js`) + web app manifest (`manifest.webmanifest`) for PWA install and offline support
- Hosted on **GitHub Pages** (static, no server)

---

## Running Locally

No build tools required. Clone the repo and open any `.html` file directly in a browser, or serve with any static file server:

```bash
git clone https://github.com/nb2276/OncologyToolkit.git
cd OncologyToolkit
npx serve .   # or: python3 -m http.server 8080
node tests.js # run the test suite
```

If you plan to commit, enable the deploy guard once: `git config core.hooksPath .githooks`. It blocks a commit that changes a precached file without bumping `CACHE_VERSION` in `sw.js`, which is the one way this site can ship fresh HTML against stale cached JS.

Contributing: [`CLAUDE.md`](CLAUDE.md) covers architecture and module contracts, [`DESIGN.md`](DESIGN.md) covers the design system, [`TODOS.md`](TODOS.md) tracks open work.

---

## Disclaimer

These tools are for educational purposes only and are not a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider.

---

## License

Released under the [MIT License](LICENSE). Free to use, modify, fork, and embed in other projects (including commercial ones) with attribution.

---

## Author

Created by **Nick Boehling, MD** — Radiation Oncologist, Bend, OR

Feedback: [schedulizerbot@gmail.com](mailto:schedulizerbot@gmail.com)
