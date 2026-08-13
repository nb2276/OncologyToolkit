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
- Flexible date parsing — accepts most common date formats (MM/DD/YYYY, YYYY-MM-DD, DD.MM.YYYY, etc.)
- Reports a 95% confidence interval for the doubling time, log-scale R² goodness of fit, and PSA velocity (ng/mL/yr, separate linear regression)
- Interactive Chart.js plot projected forward with configurable years
- 95% confidence band on the fit curve (trend CI, not a prediction interval); shaded projection region
- Linear / log y-axis toggle (log keeps the band readable; linear is capped so the band can't crush the data)
- Click or tap anywhere on the chart to query the expected PSA at that date
- White background toggle for pasting into documents
- Copy Results button — composites the doubling time, CI, R², velocity, chart, and measurement table as a PNG to the clipboard
- Chart automatically adapts to light/dark mode

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
- **Responsive design** — works on desktop and mobile with collapsible hamburger navigation
- **No account required** — all calculations run client-side in the browser

---

## Tech Stack

- **Vanilla HTML / CSS / JavaScript** — no frameworks, no build step
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
```

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
