# lukethinks-web

Agent skill for building and maintaining **lukethinks.nl** as an Astro static site on GitHub + Vercel.
All architectural decisions are settled (see `references/decisions.md`); an agent can start building from this without asking questions.

## Install (once)

```
your-repo/
├── AGENTS.md                        ← copy from this skill to the repo root
├── .agent/lukethinks-web/           ← this whole folder (Antigravity)
│   or .claude/skills/lukethinks-web/ (Claude Code)
├── scripts/                         ← copy scripts/ here
├── content/
│   ├── site.json                    ← copy from starter/, fill TODO(luke) items
│   ├── podcast.json                 ← copy from starter/, fill TODO(luke) items
│   └── taxonomy.json                ← copy from starter/
├── src/content.config.ts            ← copy from starter/
├── vercel.json                      ← copy from starter/, extend as pages port
└── legacy/                          ← move all existing .html pages here
```

Then:

```bash
npm create astro@latest . -- --template minimal --typescript strict --no-git
npx astro add vercel
npm install yaml
npm run validate
```

## What is in here

| Path | Purpose |
|---|---|
| `SKILL.md` | Router. Loaded first; points at everything else. |
| `references/decisions.md` | **Settled** decision log. Everything Accepted. |
| `references/stack.md` | Stack, repo layout, build order |
| `references/design-system.md` | Tokens + how the class register works |
| `references/html-contract.md` | Page skeleton, semantics, a11y floor, `data-*` hooks |
| `references/seo-schema.md` | Head, OG, JSON-LD, sitemap, feeds |
| `references/content-model.md` | Frontmatter contract, taxonomy, derived files |
| `references/automation.md` | Script set and integration ladder |
| `content-types/*.md` | One file per content type — the growth seam |
| `templates/` | Golden reference markup — the class register |
| `starter/` | Files to copy into the repo on first setup |
| `scripts/validate-content.mjs` | Cross-file + built-HTML checks; exits non-zero on error |
| `scripts/build-index.mjs` | `public/content-index.json`, the keystone |
| `scripts/build-podcast-rss.mjs` | Idempotent `podcast.xml` from `content/podcast.json` + episodes |
| `scripts/check-register.mjs` | Fails on any class not in a template/component |

## Adding a content type

1. `content-types/<type>.md`
2. A collection in `src/content.config.ts`
3. A row in the SKILL.md routing table
4. A golden template in `templates/`
