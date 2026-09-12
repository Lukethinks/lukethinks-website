# Stack

All choices here are **Accepted** (see `decisions.md`). Do not propose alternatives; do not ask Luke to confirm them.

## The stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Astro**, static output | `npm create astro@latest`, minimal template, TypeScript strict |
| Adapter | `@astrojs/vercel` | Static. No SSR, no edge functions. |
| Hosting | Vercel, deploy on push to `main`; preview deploys per PR | Unchanged from legacy |
| Content | Astro **content collections** with a Zod schema in `src/content.config.ts` | This is the content contract. See `content-model.md`. |
| Styling | One stylesheet `src/styles/site.css`; tokens in `:root`; no CSS framework | See `design-system.md` |
| Fonts | Inter via Google Fonts, `preconnect` | |
| Charts | Chart.js, loaded only on pages that use it | See `content-types/article.md` |
| Scripts | Node 20+ ESM in `scripts/`, run as npm scripts and as `astro:build:done` hooks | See `automation.md` |
| Audio storage | **Vercel Blob**, public, `audio/<slug>.mp3` | Never in git |
| Analytics | Vercel Analytics + Speed Insights, nothing else | |
| URLs | **Extensionless.** `/articles/<slug>`, `/learning/<slug>`, `/research/<slug>`, `/podcast/<slug>` | Legacy `.html` URLs 301 via `vercel.json` |
| Language | English; every item has `lang: en` | |

## Repository layout

```
/
├── AGENTS.md
├── .agent/lukethinks-web/        ← this skill
├── astro.config.mjs
├── vercel.json                   ← redirects only
├── package.json
├── content/
│   ├── site.json                 ← site-wide facts (name, URL, author, nav)
│   ├── podcast.json              ← channel-level podcast facts
│   ├── taxonomy.json             ← controlled tag list
│   ├── articles/<slug>.md
│   ├── research/<slug>.md
│   ├── learnings/<slug>.md
│   ├── episodes/<slug>.md
│   └── **/<slug>.linkedin.md     ← sidecars, excluded from build
├── public/
│   ├── transcripts/<slug>.vtt
│   ├── assets/og/<slug>.png      ← generated
│   ├── favicon.ico, apple-touch-icon.png, robots.txt
├── src/
│   ├── content.config.ts         ← Zod schema = content contract
│   ├── layouts/BaseLayout.astro  ← head, header, nav, footer, skip link
│   ├── components/               ← AudioPlayer, Callout, StatsBox, Toc, StateBadge …
│   ├── pages/                    ← index, research, experiments, learning, podcast, about, [type]/[slug]
│   └── styles/site.css
├── scripts/
└── legacy/                       ← old HTML, read-only source material, excluded from validation
```

## Build order

1. Scaffold Astro + adapter. Commit.
2. `content.config.ts`, `taxonomy.json`, `site.json`, `podcast.json`. Commit.
3. `site.css` with the token block from `design-system.md`. `BaseLayout.astro` from `templates/article.reference.html`'s outer shell. Commit.
4. One article ported from `legacy/` as a content entry + `[slug].astro`. Preview deploy. Compare against the legacy page for lost content only — not for matching markup.
5. Remaining articles, then learnings, then index pages, then podcast.
6. `vercel.json` redirect for every legacy URL. `legacy/` stays in the repo for one release, then is deleted.
7. Scripts wired as build hooks. CI validate gate on.

Each step is a separate PR and a preview deploy. Do not merge to `main` to "see if it works".

## Deployment rules

- Every change survives `git push` → Vercel build with no manual step.
- Redirects live in `vercel.json` only. A slug or URL change without a 301 in the same PR is a validator error.
- Keep the Vercel Analytics and Speed Insights components in `BaseLayout.astro`.

## Choosing between a script, a data file and manual work

Ask, in order:
1. **Is this fact derived from another fact?** (counts, tag lists, related posts, sitemap, RSS) → generated. Never typed.
2. **Will this be repeated more than three times?** → script.
3. **Would getting it wrong be silent?** (enclosure byte length, canonical URLs) → script plus a validator check.
4. Otherwise → data file, hand-edited, schema-validated.

Manual is acceptable for prose, framing, and which episode to publish. It is not acceptable for anything countable.
