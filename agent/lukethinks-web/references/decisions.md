# Decision log

Append-only. Newest at the top. Do not rewrite history — mark a decision `Superseded by ADR-xxx` instead.

Format:

```
## ADR-000N — Title
**Date:** YYYY-MM-DD · **Status:** Accepted | Rejected | Superseded | Pending
**Context:** what forced the choice
**Decision:** what was chosen
**Consequences:** what this now costs or enables
```

Any agent that makes a structural choice adds an entry in the same change. Any agent about to revisit a settled question reads this first and does not re-litigate. **Everything below marked Accepted is settled. Do not propose alternatives.**

---

## ADR-0020 — Persistent bottom audio player bar and unified playback triggers
**Date:** 2026-09-20 · **Status:** Accepted
**Context:** Playing podcast episodes previously suffered from duplicate players across `/podcast` (the top carousel had a docked player while every individual catalog card also embedded an identical full `<audio>` player widget). This created visual clutter and stopped users from controlling playback while scrolling through takeaways or show notes.
**Decision:** Implement a persistent bottom audio player bar (`GlobalAudioPlayer.astro`) mounted globally in `BaseLayout.astro`. The bar reveals on play with responsive transport controls (skip -15s, play/pause, skip +30s, interactive scrubber with elapsed/remaining times, multi-speed cycle `1x`/`1.25x`/`1.5x`/`2x`, download action, and dismiss button). Streamline `EpisodeCard.astro` by replacing the embedded player widget with an accessible, high-contrast play trigger button that synchronizes state with the global bar via decoupled window events (`lukethinks:dock-audio` and `lukethinks:audio-state-change`).
**Consequences:** A clean, unified listening experience where playback persists during page scrolling; catalog cards are uncluttered and focus on takeaways; exactly one active playback engine is in DOM focus; class register is strictly maintained with zero drift.

## ADR-0019 — AudioCarousel component and removal of iPod skeuomorphism
**Date:** 2026-09-19 · **Status:** Accepted (supersedes ADR-0018)
**Context:** Luke requested removing the iPod click wheel on the website and all iPod branding/naming across the code.
**Decision:** Remove the rotary click wheel element from the audio browsing UI and rename the component to `AudioCarousel.astro`. Preserve all responsive card navigation, stepper controls, roving tabindex, docked audio playback, and grid/flow view switching under clean, standard naming (`audio-carousel-*`).
**Consequences:** Clean responsive presentation without skeuomorphic wheel controls or third-party trademark references in the codebase.

## ADR-0018 — iPod-like scroll interaction for podcast and audio browsing
**Date:** 2026-09-19 · **Status:** Superseded by ADR-0019
**Context:** Luke requested an iPod-style tactile scroll/wheel interface for browsing through podcasts, audio stacks, and series of audio items in chronological order.
**Decision:** Implement an iPod classic-inspired scroll carousel/rotator interaction for browsing audio cards and episodes. This will feature rotary/scroll navigation, tactile haptic/audio cues, active track previewing, and seamless docking to playback, while preserving keyboard accessibility and fallback grid views.
**Consequences:** A dedicated, polished listening interface that distinguishes Luke Thinks audio; encapsulated in reusable components conforming to the class register.

## ADR-0017 — Podcast catalog architecture and foundational subscription layer
**Date:** 2026-09-13 · **Status:** Accepted
**Context:** Podcast audio was previously rendered as isolated raw HTML audio elements without speed controls or catalog filtering. In addition, the site needed a foundational architecture for commerciality and subscriber briefings.
**Decision:** 
1. Created `AudioPlayer.astro` conforming to podcast governance with variable playback speed controls (`1x`, `1.25x`, `1.5x`), fallback MP3 download, and accessible ARIA attributes.
2. Created `EpisodeCard.astro` following the Construction Disruption horizontal card anatomy (1:1 square badge/art, meta line, bold title, takeaways bullets, player controls, show notes link).
3. Redesigned `/podcast` into an interactive catalog featuring platform subscribe links (Spotify, Apple Podcasts, RSS), live text search, and category/topic filter pills.
4. Added bi-directional cross-pollination linking companion audio on technical articles (`CompanionAudioBanner.astro`) with full podcast episodes.
5. Built `NewsletterCapture.astro` and `/api/subscribe` as a foundational subscription layer introducing free executive briefings alongside upcoming subscriber intelligence tiers.
**Consequences:** Audio players and episode cards are reusable shared components across all page types; subscribers can join executive briefing lists; the class register (`check-register.mjs`) is preserved with zero drift.

## ADR-0016 — Dark mode and theme toggle via single-place token redefinition
**Date:** 2026-09-13 · **Status:** Accepted
**Context:** The site lacked dark mode support. Readers in low-light environments need a comfortable reading experience, and modern web guidelines recommend supporting both system preferences and explicit manual overrides without layout flashes (FOUC).
**Decision:** Dark mode is implemented by redefining design tokens in one place (`src/styles/site.css`) under `@media (prefers-color-scheme: dark)` (system preference) and `:root[data-theme="dark"]` (explicit override). Explicit surface tokens (`--surface-header`, `--surface-card`, `--surface-card-translucent`, `--surface-footer`) map card and header surfaces to dark slate values. An accessible `ThemeToggle.astro` component in the header lets users switch modes, and an inline script in `<head>` applies any saved preference synchronously before paint to prevent FOUC.
**Consequences:** Theme switching is instantaneous and zero-flicker; individual page templates remain purely semantic without inline theme checks; class register constraints (ADR-0013) remain fully compliant.

## ADR-0015 — Counters stored in Upstash Redis over HTTP
**Date:** 2026-09-12 · **Status:** Accepted
**Context:** Article reader reactions require persistent atomic counters without adding database overhead or client bundle weight.
**Decision:** Counters are stored in Upstash Redis (provisioned via Vercel Storage as KV), free tier, EU region, over HTTP via @upstash/redis. No other new dependency.
**Consequences:** Atomic increments without race conditions; fail-soft reads and fail-loud writes; no heavy client drivers or connection pooling needed.

## ADR-0014 — Hybrid on-demand rendering for reactions endpoint and counter display
**Date:** 2026-09-12 · **Status:** Accepted
**Context:** lukethinks.nl is fundamentally a static site (ADR-0002), but reactions require real-time counts and cookie verification per visitor.
**Decision:** Rendering stays static everywhere except a single reactions endpoint and its counter display, which alone use on-demand rendering (Astro's hybrid mode, export const prerender = false on just those routes).
**Consequences:** Article pages remain completely static and cached at the edge; reactions bar is deferred via server:defer; zero impact on page load performance or static hosting benefits.

## ADR-0013 — Templates are the class register
**Date:** 2026-09-07 · **Status:** Accepted
**Context:** The prose register in `design-system.md` and the golden templates drifted apart on day one (~20 classes in templates were missing from the register).
**Decision:** The class names that appear in `templates/*.html` (and the Astro layouts/components that replace them) are the register. `design-system.md` lists them but is generated/checked from the templates, not the other way round. `scripts/check-register.mjs` fails if a page uses a class not present in any template.
**Consequences:** One source of truth. Adding a class means adding it to a template, which is where it belongs anyway.

## ADR-0012 — Zod schema in Astro is the content contract; JSON Schema removed
**Date:** 2026-09-07 · **Status:** Accepted
**Context:** `schemas/content.schema.json` and `validate-content.mjs` re-implemented the same rules by hand and had already diverged.
**Decision:** `src/content.config.ts` (Zod) is the single schema. `astro build` enforces field shape. `validate-content.mjs` only checks what Zod cannot: cross-file references, taxonomy, slug/filename agreement, duplicate GUIDs, and built HTML.
**Consequences:** No duplicated rules. Field additions happen in one file. `schemas/` directory deleted.

## ADR-0011 — Transcripts live in `public/transcripts/<slug>.vtt`
**Date:** 2026-09-07 · **Status:** Accepted
**Context:** Frontmatter pointed at `content/episodes/*.vtt` while the feed advertised `/transcripts/*.vtt`; nothing bridged them.
**Decision:** Transcripts are static public files at `public/transcripts/<slug>.vtt`. Frontmatter `transcript: true` means "exists at the conventional path"; the validator checks the file is there.
**Consequences:** Feed URL and disk path can no longer disagree.

## ADR-0010 — Generated files are idempotent; no timestamps
**Date:** 2026-09-07 · **Status:** Accepted
**Context:** `podcast.xml` embedded `lastBuildDate` and the current year, so every run produced a diff.
**Decision:** No wall-clock values in generated output. `lastBuildDate` = newest episode `published`. Copyright year = year of the earliest published item.
**Consequences:** Identical input → identical output. Generated files can be diffed in review.

## ADR-0009 — Modifier classes are `.is-*` / `.has-*` only
**Date:** 2026-09-07 · **Status:** Accepted
**Context:** Legacy pages used `.active`; the register proposed `.is-active` for new work, creating two conventions.
**Decision:** `.is-*` / `.has-*` exclusively. Legacy `.active` is not carried into the rebuild.
**Consequences:** One modifier convention.

## ADR-0008 — English only, with a `lang` field defaulting to `en`
**Date:** 2026-09-07 · **Status:** Accepted
**Context:** Open question on Dutch content.
**Decision:** Site is English. Every content item carries `lang` (default `en`) so Dutch pieces can be added later with `hreflang` support without a schema migration. No `hreflang` emitted until a second language exists.
**Consequences:** Zero cost now, no migration later.

## ADR-0007 — Podcast inherits the site identity; Podcast is a primary nav item
**Date:** 2026-09-07 · **Status:** Accepted
**Context:** Open question on a separate podcast identity.
**Decision:** Same tokens, same type, same name ("Luke Thinks"). Cover art is the site mark at 3000×3000. **Podcast** `/podcast` is the sixth primary nav item from the first standalone episode.
**Consequences:** No second brand to maintain. Nav order fixed: Home · Research · Experiments · Learning · Podcast · About.

## ADR-0006 — Extensionless URLs
**Date:** 2026-09-07 · **Status:** Accepted
**Context:** Legacy pages ship as `/x.html`; Astro emits `/x/index.html` by default.
**Decision:** Canonical URLs are extensionless (`/research`, `/articles/<slug>`, `/podcast/<slug>`). Every legacy `.html` URL gets a 301 in `vercel.json` at the moment its replacement ships. `vercel.json` is the only place redirects live.
**Consequences:** Cleaner canonicals and feeds. One redirect table to maintain, and it is never allowed to lose an entry.

## ADR-0005 — Vercel Blob for audio
**Date:** 2026-09-07 · **Status:** Accepted (supersedes ADR-0004 Pending)
**Context:** Storage choice was blocking episode modelling.
**Decision:** Vercel Blob, public store, path `audio/<slug>.mp3`. Switch to Cloudflare R2 only if monthly egress cost exceeds the Blob allowance — that is a URL change and therefore a new-GUID event, so it is avoided, not planned.
**Consequences:** No new vendor. Absolute permanent URLs. `audio.src` must start with the Blob host; the validator checks it.

## ADR-0004 — Audio files stored outside git
**Date:** 2026-09-07 · **Status:** Superseded by ADR-0005 (decision made; principle unchanged)

## ADR-0003 — Podcast RSS feed built from day one, published later
**Date:** 2026-09-07 · **Status:** Accepted
**Context:** Audio is currently on-site only; Spotify is a stated future goal.
**Decision:** Model episodes fully and generate `podcast.xml` immediately, even while unlisted.
**Consequences:** Requires byte length, duration and a permanent GUID at publish time. Going public becomes a form submission rather than a migration.

## ADR-0002 — Greenfield Astro rebuild; legacy pages are source material, not a base
**Date:** 2026-09-07 · **Status:** Accepted (supersedes the Phase 1 "de-duplicate in place" plan)
**Context:** The existing site is small and of uneven quality. Extracting shared CSS from pages that will be discarded is wasted work.
**Decision:** Build the site in Astro (`@astrojs/vercel`, static output) from the templates in this skill. Legacy HTML moves to `legacy/` and is read only to recover prose, figures and audio references. Brand tokens are kept; legacy markup is not.
**Consequences:** Skips Phase 1 entirely. Legacy pages are excluded from validation. The site goes live when the ported page count equals the legacy page count and every legacy URL redirects.

## ADR-0001 — Content and presentation are separated
**Date:** 2026-09-07 · **Status:** Accepted
**Context:** Every original page inlines its own tokens, header, nav, footer and player.
**Decision:** Content lives in Astro content collections with a Zod schema; presentation lives in one stylesheet and one layout set.
**Consequences:** Tag pages, feeds, related links and LinkedIn repurposing become generatable.

---

## Open questions

None. Anything not covered above is a routine implementation choice — make it, log it if structural, do not stop to ask.

## Facts only Luke can supply

These are not decisions; they are data the agent must not invent. They live in `content/podcast.json` and `content/site.json` as `TODO(luke)` until filled in. The validator blocks publishing (not building) while any remain.

- Podcast owner email (Apple requires a working one)
- Apple/Spotify category pair (default proposed: Business › Investing)
- Vercel Blob store hostname (known after the first upload)

## Retrospective protocol

An ADR records what was decided. It does not record whether the decision worked. Close that loop explicitly:

**On every session's first `validate` run**, before doing new work, scan for repeated warnings — the same warning text appearing across 3+ files, or the same file failing the same check on 3+ separate sessions. That pattern means a decision has an unrecorded consequence. Do not just keep patching the symptom. Open (or append to) `references/retro.md`:

```
## RETRO-00N — <the recurring symptom>
**Trigger:** <warning text> seen N times across <files/sessions>
**Traces to:** ADR-000X
**Read as:** the decision was <right but underspecified | wrong for this case | missing a helper>
**Action:** <amend the ADR | add a validator rule | add a script | leave as accepted friction, and say why>
```

Then act on the Action line in the same session — don't just log the pattern and leave it. A retro that doesn't change anything is noise.

**On every ADR that supersedes another**, check whether the reason it's being superseded was foreseeable from the original ADR's Consequences section. If it was foreseeable and wasn't foreseen, note that in the new ADR's Context — this is what makes future Consequences sections more honest instead of optimistic.

**Before proposing a new script or automation**, search `references/automation.md`'s integration ladder and `retro.md` for a prior attempt at solving the same problem. Don't re-propose something already tried and rolled back without saying so.
