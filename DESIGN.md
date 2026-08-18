# Design System

The de facto system as rendered, extracted from `style.css` and the decisions behind it. This documents what **is**, not an aspiration — if the code and this file disagree, the code is the bug or this file is stale, and either way one of them needs fixing.

Audience: anyone (human or agent) adding UI to this site. Read alongside `CLAUDE.md`, which covers architecture and module contracts.

---

## 1. Principle

This is a clinical calculator used between patients. Every design call answers to that:

- **The number is the product.** A doubling time, a remaining dose, a constraint. Chrome that competes with the number is wrong.
- **Say what a value is.** A readout with no label is worse than no readout — it invites confident misreading. This is why every chart readout names its source (`Recent trend:` vs `Fitted trend:`), and why below-detection rows keep their `<`.
- **Legibility outranks subtlety.** Data the reader consumes clears WCAG AA. Muted grey is for footnotes, never for a value.
- **Caveats travel with the artifact.** A hedge that only exists on screen never reaches the person handed the exported PNG.

---

## 2. Tokens

All colour lives in CSS custom properties under `:root` (dark, default) and `[data-theme="light"]`. Never hardcode a hex in a component rule; add or reuse a token.

### Surfaces

| Token | Dark | Light |
|---|---|---|
| `--bg-root` | `#1c1c1e` | `#f2f3f5` |
| `--bg-surface` | `#242428` | `#e8e9ec` |
| `--bg-card` | `#2a2a2f` | `#ffffff` |
| `--bg-card-hover` | `#30303a` | `#f8f8fa` |
| `--bg-input` | `#1e1e22` | `#f0f1f3` |
| `--bg-nav` | `rgba(24,24,28,0.82)` | `rgba(255,255,255,0.85)` |

Dark mode uses **elevation**, not lightness inversion: root → surface → card get progressively lighter.

### Text

| Token | Dark | Light | Use |
|---|---|---|---|
| `--text-primary` | `#ececf0` | `#1a1a1e` | Headings, values |
| `--text-secondary` | `#b0b0b8` | `#4a4a52` | Body, table cells, any number the reader consumes |
| `--text-tertiary` | `#68686e` | `#7a7a84` | Notes, captions, column heads |
| `--text-muted` | `#4a4a50` | `#9a9aa2` | Decorative only |

`--text-secondary` was raised from `#a0a0a8` to `#b0b0b8` (2026-05-30) to bring 13 px body text on `--bg-card` from ~4.4:1 to ~5.0:1.

**Contrast rule:** anything a reader reads as data uses `--text-secondary` or better. `--text-tertiary` is for annotation. This was decided twice in practice — the below-detection table row and the export sheet's small type both started at tertiary and were raised after measuring against AA.

### Accent

`#4fc3f7` dark / `#0288d1` light, with `--accent-glow`, `--accent-dim`, `--accent-hover`. One accent. A second hue appears only to encode a distinct series (the recent-trend line's amber, `#ffb74d` dark / `#c77c14` light).

### Semantic

`--success` `#81c784` / `#2e7d32`. `--danger` `#ff8a80` / `#c62828`, with `--danger-bg` and `--danger-border`. Never colour-only: pair with text.

### Shape and motion

- Radius: `--radius-sm: 6px`, `--radius-md: 10px`, `--radius-lg: 14px`. Not uniform — chips are small, cards medium, panels large.
- Shadow: `--shadow-card`, `--shadow-card-hover`, `--shadow-glow`. Heavier in dark, near-flat in light.
- Transitions: `--transition-fast: 0.15s ease`, `--transition-med: 0.25s ease`. Name the properties; never `transition: all`.

---

## 3. Type

- **Body:** `--font-body` — DM Sans, system fallbacks.
- **Display:** `--font-display` — Outfit, falling back to DM Sans. Headings and the site mark.

Both load from `fonts.googleapis.com` and are deliberately **not** precached, so an offline PWA session renders in the fallback stack. That is an accepted trade, not an oversight.

Rules:
- Body text ≥ 16 px; the smallest UI text (labels, notes) is 12–13 px and never carries a value.
- Numeric columns get `font-variant-numeric: tabular-nums` so digits align.
- Result values are display-weight and clearly the largest thing in their card.

---

## 4. Layout and breakpoints

**Convention: `@media (max-width: 900px)`.** It matches the nav hamburger, so nav and content switch together. New responsive sections use this number. The PSA layout used to stack at 780 px, which left 781–900 px showing a hamburger nav above a two-column body — the exact mismatch this rule prevents.

Two older exceptions exist, and are exceptions rather than precedent:

| Query | Scope | Why it differs |
|---|---|---|
| `max-width: 960px` | `.rert-layout` stacking | Predates the convention; ReRT's two-column body runs out of room ~60 px earlier than the others |
| `max-width: 700px` | Dense-table card-stacking (BED / ReRT / Constraints) | A second, narrower tier *below* the main breakpoint — it restyles wide data tables into stacked cards rather than switching the page layout |

The 700 px tier is legitimately a different job. The 960 px one is drift; align it with 900 px if you touch ReRT's layout.

Stacked layouts follow **input → result → supporting detail**. On the PSA page the column wrappers become `display: contents` when stacked so their children reorder independently; without it the parsed table sits between the Calculate button and the answer.

CSS `order` moves boxes, not the DOM. When you reorder visually, check two things: focus order (enumerate the focusable elements and confirm their tops increase) and reading order (if the DOM sequence no longer matches, make the outcome announce itself — see §6).

Content is inset by a consistent page margin; figures sit inside that margin rather than bleeding to the edges.

---

## 5. Components

`style.css` carries a numbered table of contents (sections 1–21). **Add to the right section; never append to the bottom.**

- **`.bed-card`** is the shared card chrome, used by BED, Composite, ReRT, Constraints, and composed into `.hub-tile` (`<a class="bed-card hub-tile">`). A rule on `.bed-table` or `.bed-card` touches four pages — scope page-specific changes with a modifier class.
- **Result card** — label, value, CI. The value is the largest element on the page. Carries `aria-live="polite"`.
- **Notes** (`.psa-drop-note` and friends) — 12 px, tertiary, one line each, directly under the result they qualify.
- **Chart wrapper** (`.psa-chart-wrap`) owns the chart's height (360 px desktop, 300 px mobile) with Chart.js `maintainAspectRatio: false`. A fixed aspect ratio left ~100 px of plot on a phone with every point collapsed onto one line.

Cards earn their place. A card that only groups text is a border for its own sake.

---

## 6. Accessibility

Non-negotiable, because the audience is clinical:

- Body text and any consumed value clear **4.5:1**. Large text clears 3:1.
- Touch targets ≥ 44 px at the mobile breakpoint.
- Focus is always visible; never remove an outline without replacing it.
- Never encode meaning in colour alone — the recent-trend line is amber **and** dashed **and** labelled.
- State changes announce themselves: the result card is `aria-live="polite"`, `#psaError` is `role="alert"`. Before that, calculating produced no announcement at all.
- Visual reordering must not break focus order (see §4).

---

## 7. Exported artifacts

The PSA "Copy Results" PNG is a document, not a screenshot, and it leaves the site:

- The sheet takes its palette from the chart's own mode. A dark chart on a hardcoded white sheet reads as two documents in one frame.
- Hierarchy is explicit: tracked eyebrow label → dominant value → subordinate CI and metrics.
- The figure is inset to the sheet margin.
- Tables lead with the key column (Date) and right-align numerics against a hard edge, matching the on-screen order.
- Every caveat visible on screen is printed on the image.
- The footer states when it was generated, then how to reopen it — quietly.

---

## 8. Anti-patterns

Do not ship: purple/indigo gradient backgrounds; symmetric three-column icon-in-circle feature grids; decorative blobs and wavy dividers; emoji as design elements; uniform bubbly radius on everything; centred everything; `transition: all`; placeholder-as-only-label; low-contrast small type; a second display typeface; a card grid where a table belongs.

If a section feels empty, it needs better content, not decoration.
