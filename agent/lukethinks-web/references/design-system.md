# Design system and do-not-invent register

The visual language is already set. Your job is to **reuse it exactly**, not to improve it. Novel token names, one-off class names and near-duplicate colours are how an AI-maintained site turns to mush.

## Register: tokens

Declared once, in `src/styles/site.css`, under `:root`. Never redeclare in a page or component.

| Token | Value | Use for |
|---|---|---|
| `--primary-brown` | `#92400e` | Primary brand, headings accents, badges |
| `--secondary-brown` | `#c05621` | Gradient partner to primary |
| `--accent-amber` | `#ea580c` | Interactive accent, focus rings, hover borders |
| `--light-amber` | `#fbbf24` | Highlights, footer link hover |
| `--cream` | `#fef7f0` | Page background start |
| `--light-cream` | `#f7fafc` | Page background end |
| `--dark-text` | `#0f172a` | Headings, footer background |
| `--medium-text` | `#1e293b` | Body copy |
| `--light-text` | `#64748b` | Secondary copy, meta |
| `--very-light-text` | `#94a3b8` | Separators, tertiary |
| `--border-light` | `rgba(226,232,240,0.5)` | Card and section borders |
| `--shadow-light` | `rgba(0,0,0,0.1)` | Resting shadow |
| `--shadow-medium` | `rgba(0,0,0,0.15)` | Hover shadow |
| `--surface-header` | `rgba(255,255,255,0.95)` | Sticky header surface |
| `--surface-card` | `linear-gradient(...)` | Card & content panels background |
| `--surface-card-translucent` | `rgba(255,255,255,0.85)` | Secondary/translucent card surfaces |
| `--surface-footer` | `#0f172a` | Footer background |

Signature gradients: page background `linear-gradient(135deg, var(--cream), var(--light-cream))`; active/primary surfaces `linear-gradient(135deg, var(--primary-brown), var(--accent-amber))`.

Type: **Inter**, weights 300–800, with the system stack as fallback. Body `line-height: 1.6`. Display headings use `font-weight: 700–800` and `letter-spacing: -0.02em`.

Radii in use: `8px` (controls), `12px` (small cards), `16px` (panels), `20px` (feature cards). Do not introduce new values.

Container: `max-width: 1200px`, `padding: 0 24px`, dropping to `16px` under 768px. Prose columns cap at `~72ch`.

## Register: components

**The register is the set of class names that appear in `templates/*.html` and in `src/layouts` + `src/components`** (ADR-0013). This table is a convenience index, not the authority — if it and the templates disagree, the templates win and this table gets fixed. `scripts/check-register.mjs` fails the build on any class not in that set. Do not create synonyms (`.card`, `.post-card`, `.item-card` for the same thing).

Page furniture: `.skip-link` · `.site-header` · `.site-footer` · `.logo-main` / `.logo-sub` · `.article-footer` · `.state-badge` · `.confidence-badge` · `.audio-title` / `.audio-meta` / `.audio-disclosure` / `.audio-subscribe` · `.chapter-list` · `.transcript` · `.chart-figure` · `.table-scroll` · `.field` / `.field-hint` / `.field-error`.

| Class | What it is |
|---|---|
| `.container` | Width-constrained wrapper |
| `.header-content` / `.logo-section` / `.logo-icon` / `.logo-text` | Sticky header block |
| `.breadcrumbs` | Breadcrumb nav, wrapped in `<nav aria-label="Breadcrumb">` |
| `.hero` / `.hero-badge` / `.hero-tagline` / `.hero-highlight` | Page intro block |
| `.section-header` / `.section-title` / `.section-subtitle` | Section intro block |
| `.topic-card` / `.topic-icon` / `.topic-title` / `.topic-description` / `.topic-count` | Index tile linking to a hub |
| `.learning-card` / `.learning-grid` | Learning index tile |
| `.article-header` / `.article-meta` / `.article-category` / `.article-title` / `.article-subtitle` / `.article-content` | Article page furniture |
| `.toc-container` / `.toc-title` / `.toc-list` | Table of contents |
| `.stats-box` / `.stat-card` / `.stat-number` / `.stat-label` | Inline figure callout |
| `.callout` / `.callout-title` | Highlighted aside |
| `.audio-player-container` / `.custom-audio-player` | Audio block — see `content-types/podcast.md` |
| `.tab-buttons` / `.tab-btn` / `.tab-content` | Tabbed panel |
| `.footer-content` / `.footer-links` | Footer |
| `.sr-only` | Visually hidden, screen-reader available |
| `.fade-in` | Entrance animation |

Modifier convention: `.is-*` / `.has-*` only (`.tab-btn.is-active`, `nav a.is-current`). Legacy `.active` is not carried into the rebuild (ADR-0009).

## Register: navigation and paths

Primary nav, in this order, read from `content/site.json`: **Home** `/` · **Research** `/research` · **Experiments** `/experiments` · **Learning** `/learning` · **Podcast** `/podcast` · **About** `/about` (ADR-0007). Adding a nav item is a decision — log it.

Fixed public paths: `/assets/` static assets, `/assets/og/` generated OG images, `/transcripts/` VTT files, `/content-index.json`, `/podcast.xml`, `/feed.xml`, `/sitemap.xml`. Audio is on Vercel Blob, never under the site origin.

## Rules for new styling

- Global CSS goes in `src/styles/site.css`, grouped under a comment header matching its component name. Component-scoped `<style>` inside an `.astro` component is acceptable for layout local to that component; it must still use tokens.
- Compose from existing tokens. If a genuinely new colour is unavoidable, add a token, add it to the table above, and log the decision — never hardcode a hex in a component.
- Motion: `transition: all 0.3s ease` is the house default; keep hover transforms subtle (`translateY(-2px)` to `-8px`).
- Wrap non-essential animation in `@media (prefers-reduced-motion: reduce) { … }` — the current pages do not, and every new component should.
- Focus states are not optional: `outline: 2px solid var(--accent-amber); outline-offset: 2px`. Never `outline: none` without a replacement.
- Mobile first in behaviour if not in source order: every grid collapses to one column at 768px.

## Dark mode

Implemented via single-place token redefinition in `src/styles/site.css` (ADR-0016) under `@media (prefers-color-scheme: dark)` (system preference default) and `:root[data-theme="dark"]` (explicit override).
The header contains an accessible `<ThemeToggle />` component. An anti-FOUC inline script in `BaseLayout.astro` applies any stored user preference from `localStorage` synchronously before first paint.
Surface tokens `--surface-header`, `--surface-card`, `--surface-card-translucent`, and `--surface-footer` map container and card backgrounds across themes.
