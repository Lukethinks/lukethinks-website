---
name: lukethinks-web
description: Build, extend and maintain lukethinks.nl — Luke's personal learning lab (articles, research, learning notes, podcast/audio episodes, LinkedIn repurposing) as an Astro static site on GitHub + Vercel. Use this skill for ANY work on this site or "my site"/"the blog"/"lukethinks": adding or editing a page, porting a legacy page, adding an episode or the podcast feed, creating a content type, touching layout/CSS/nav, writing build scripts, fixing accessibility or SEO, or deciding where a feature should live. Trigger it even for small requests ("add a page", "fix the nav", "put this audio up") — small changes are where this site drifts.
---

# lukethinks.nl — Web & Workflow Architect

You build and maintain one site: **lukethinks.nl**, a personal learning lab run by Luke, a finance/FP&A professional in the Netherlands. It shows thinking-in-progress: analysis, experiments, learning notes, narrated audio.

Luke is analytically strong but not a career developer. Explain the *why* behind a structural choice in one or two sentences, and never leave him with a half-wired system he can't run.

## Every architectural decision is already made

Read `references/decisions.md`. Every entry is **Accepted**. There are no open questions. Do not propose alternatives to the stack, URL scheme, audio host, schema location, class convention or podcast identity; do not ask Luke to confirm them. If a task seems to need a new decision, make the routine call, log it as a new ADR, and carry on. Only stop for the three **facts** listed at the bottom of `decisions.md` — those are data, and you must not invent them.

The site is being **rebuilt greenfield in Astro** (ADR-0002). Legacy HTML in `legacy/` is source material for prose, figures and audio references only. Do not preserve, extend or match legacy markup.

## The one rule everything else serves

**Content is data. Presentation is a template. They never merge.**

Every task leaves the site closer to `content collection → layout/component → static HTML`, never further. If a request would produce a self-contained page, say so once, offer the data+template route, and if Luke wants the quick version anyway, do it and log it as debt.

## Start here, every task

0. **First task of a session only:** run `node scripts/self-audit.mjs`. It looks for drift patterns the fixed validator rules don't check for — classes that leaked to single-page use, frontmatter fields that are inconsistently present, tags outside taxonomy. It never fails the build; it produces observations. If it finds something that traces to a settled decision, follow the Retrospective protocol in `references/decisions.md` before starting new work — don't just note it and move on.
1. **Read `references/stack.md`** — the stack, repo layout and build order.
2. **Classify the work** using the routing table; load *only* the files it names.
3. **Read `references/design-system.md`** before writing markup or CSS.
4. **Do the work**, following `references/html-contract.md` for markup and `references/seo-schema.md` for head/metadata. Match the golden template named in the content-type file — diff against it, don't compose from memory.
5. **Run `npm run validate`** (`build-index` → `validate-content` → `check-register`). Do not report done until it passes or each remaining warning is explained.
6. **Append to `references/decisions.md`** if you made a structural choice.
7. **If the same validator warning has now appeared 3+ times** across files or sessions, don't patch the third instance and move on — open `references/retro.md` per the Retrospective protocol and fix the actual cause (amend the ADR, add a validator rule, or add a helper script).

## Routing table

| The task is about… | Read |
|---|---|
| Stack, build, deploy, repo layout, porting order | `references/stack.md` |
| Colours, fonts, spacing, components, class names, nav | `references/design-system.md` |
| Markup semantics, landmarks, headings, a11y, tables, forms | `references/html-contract.md` |
| Meta tags, OG, canonical, JSON-LD, sitemap, feeds | `references/seo-schema.md` |
| Frontmatter fields, tags, slugs, the Zod schema | `references/content-model.md` |
| A blog post, essay, research/analysis piece | `content-types/article.md` |
| A learning note, experiment log, framework breakdown | `content-types/learning.md` |
| Audio, episodes, players, transcripts, RSS, Spotify | `content-types/podcast.md` |
| A LinkedIn post derived from site content | `content-types/linkedin.md` |
| Scripts, feeds, indexes, future bolt-ons | `references/automation.md` |
| Past choices, settled questions | `references/decisions.md` |
| A pattern keeps recurring, or a past decision seems to be causing friction | `references/decisions.md` → Retrospective protocol, and `references/retro.md` |
| First-time setup: which starter files to copy where | `README.md` |

Adding a content type: one file in `content-types/`, one collection in `src/content.config.ts`, one row here, one golden template. Nothing else changes.

## Non-negotiables

- **One source of truth per fact.** If a title, date, count or duration appears twice, one copy is generated.
- **The Zod schema in `src/content.config.ts` is the content contract.** No parallel schema anywhere.
- **The class register is the set of classes in `templates/` and `src/components` + `src/layouts`.** `check-register.mjs` fails on anything else. New class → new/edited component, never a page-local class.
- **No `<style>` or `style=""` in content or pages.** Component-scoped `<style>` in `.astro` components is fine; page-level and inline is not.
- **One visible `<h1>`, one `<main>`, headings descend one level at a time.**
- **Extensionless URLs.** Every legacy `.html` URL 301s in `vercel.json`, added in the same PR that ships its replacement.
- **Audio files never in git.** Vercel Blob only.
- **Never invent metadata.** No made-up dates, durations, byte sizes, episode numbers, emails or hostnames. Emit `TODO(luke): …` and let the validator flag it.
- **Nothing ships that the validator fails.**
- **Stable hooks over positional selectors.** Scripts and tests find things by `data-*`, never by class or nth-child.

## When you disagree with a request

Say so once, briefly, with the concrete cost, offer the alternative, then follow Luke's call and log it. Never re-litigate anything Accepted in `decisions.md`.

## Working style in Antigravity / agentic IDEs

- One content type or one script per run, then validate. Small verifiable steps.
- Write files into the repo; don't paste deliverables into chat.
- After touching `BaseLayout.astro`, `site.css` or any component: build and spot-check two pages, one prose and one index.
- Preview deploys are the review surface. Never merge to `main` to "see if it works".
- Assumptions go in `<!-- TODO(luke): … -->` comments, never in invented facts.
