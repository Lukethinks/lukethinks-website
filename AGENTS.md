# AGENTS.md — lukethinks.nl

> Drop this file at the repository root. Antigravity, Claude Code, Cursor and most
> agentic IDEs read it automatically at the start of a session.

## Read this first

The authoritative instructions for this repository live in `.agent/lukethinks-web/`.

**Before doing any work, open `.agent/lukethinks-web/SKILL.md` and follow its routing table.**
Do not work from this file alone — it is a pointer, not the rules.

## Project in one paragraph

lukethinks.nl is a personal learning lab: articles, research pieces, learning notes and
narrated/podcast audio, written by Luke, a finance professional in the Netherlands.
Static site, GitHub → Vercel. The site's premise is showing the thinking, not just conclusions.

## Everything is decided

`.agent/lukethinks-web/references/decisions.md` — every entry is Accepted. Do not propose
alternatives or ask Luke to confirm the stack (Astro), URLs (extensionless), audio host
(Vercel Blob), schema (Zod in `src/content.config.ts`), or podcast identity. The site is a
greenfield Astro rebuild; `legacy/` is source material only.

## Hard rules (the full set is in SKILL.md)

1. Content is data, presentation is a template. Never generate a self-contained page that
   re-declares tokens, header, nav or footer.
2. Never invent metadata. No made-up dates, durations, byte sizes, episode numbers or
   figures. Emit `TODO(luke): …` and let the validator flag it.
3. One `<h1>` per page, visible. `<main>` present. Headings descend one level at a time.
4. The class register is the set of classes in `templates/` + `src/components` + `src/layouts`.
   `check-register.mjs` fails on anything else. No synonym classes, no new hex colours.
5. Audio files are never committed to git.
6. Run `npm run validate` before reporting any task complete.
8. Every legacy `.html` URL gets a 301 in `vercel.json` in the PR that ships its replacement.
7. Log architectural decisions in `references/decisions.md`; never re-litigate a settled one.

## Commands

```bash
npm install
npm run dev                      # Astro dev server
npm run build                    # index → astro build → podcast feed → validate
npm run validate                 # build-index → validate-content → check-register
```

## Working style for agents

- One content type or one script per run, then validate. Small verifiable steps.
- Write files into the repo. Do not paste deliverables into chat.
- After touching shared assets (stylesheet, layout, header, footer), rebuild and spot-check
  two pages: one old, one new.
- State assumptions as HTML comments or `TODO(luke)`, never as invented facts.
- Prefer a preview deploy over merging to main to "see if it works".

## package.json scripts

```json
{
  "type": "module",
  "scripts": {
    "audit": "node scripts/self-audit.mjs",
    "dev": "astro dev",
    "build:index": "node scripts/build-index.mjs",
    "build:podcast": "node scripts/build-podcast-rss.mjs --out dist/podcast.xml",
    "validate": "npm run build:index && node scripts/validate-content.mjs && node scripts/check-register.mjs",
    "build": "npm run build:index && astro build && npm run build:podcast && node scripts/validate-content.mjs && node scripts/check-register.mjs"
  },
  "dependencies": { "astro": "^5", "@astrojs/vercel": "^8", "yaml": "^2.4.0" }
}
```

`build:podcast` fails while `podcast.json` still has `TODO(luke)` values — that is deliberate.
Until they are filled, run `npm run build` without that step or fill them.

## Suggested CI gate

`.github/workflows/validate.yml` — runs `npm ci && npm run validate` on every pull request.
This is what actually stops drift, because it does not rely on anyone remembering.
