# Original User Request

## 2026-09-12T14:44:26Z

Rebuild lukethinks.nl as a greenfield Astro static site deployed to Vercel, strictly following the architectural decisions and build order defined in `.agent/lukethinks-web/`.

Working directory: `c:\Users\lvanden\OneDrive - Stryker\Documents\1. Trauma & Extremities - Personal Luke vdTop\4. LukeThinks\lukethinks-website`
Integrity mode: development

## Architectural Rules (Settled & Non-negotiable)
- **Stack**: Astro with `@astrojs/vercel` static output adapter (no SSR, no edge functions).
- **URL Scheme**: Extensionless canonical URLs (`/articles/<slug>`, `/research/<slug>`, `/learning/<slug>`, `/podcast/<slug>`). Every legacy `.html` URL receives a 301 redirect in `vercel.json` when its replacement ships.
- **Audio Storage**: Vercel Blob public storage (`audio/<slug>.mp3`), never committed to git.
- **Content Contract**: Single source of truth in `src/content.config.ts` using Zod schemas.
- **Design System**: Global styles in `src/styles/site.css` using `:root` CSS variables. The class register consists strictly of classes defined in `templates/` and Astro layouts/components. No inline styles.
- **HTML Contract**: One visible `<h1>` per page, `<main>` present, headings descend one level at a time without skipping, accessible landmarks.
- **Data Integrity**: Never invent metadata. If a fact is unknown, emit `TODO(luke)` and flag it.

## Execution Order (Steps 1–4 Only)

### R1. Step 1: Scaffold Astro
- Initialize/scaffold Astro minimal template with TypeScript strict and static output adapter `@astrojs/vercel`.
- Ensure Node 20+ scripts and dependencies (`yaml`, etc.) are wired up in `package.json`.
- Commit. Run `npm run validate` and report output.

### R2. Step 2: Content Schema & Core Collections
- Place `src/content.config.ts` (from `.agent/lukethinks-web/starter/content.config.ts`).
- Ensure `content/site.json`, `content/podcast.json`, and `content/taxonomy.json` are in place (copied from starter, with any unknown facts left as `TODO(luke)`).
- Commit. Run `npm run validate` and report output.

### R3. Step 3: Design System & BaseLayout
- Build `src/styles/site.css` using the tokens from `references/design-system.md`.
- Build `src/layouts/BaseLayout.astro` modeled after the outer shell of `templates/article.reference.html`.
- Commit. Run `npm run validate` and report output.

### R4. Step 4: Port One Reference Article & STOP
- Move original HTML pages to `legacy/` as source material (read-only, never edited).
- Port exactly ONE existing article from `legacy/` (e.g. `asc-323-equity-method.html` or `ai-article.html`) into `content/articles/<slug>.md` and create `src/pages/articles/[slug].astro` (or the appropriate dynamic route).
- Add the corresponding 301 redirect in `vercel.json` for the ported legacy URL.
- Commit. Run `npm run validate` and report output.
- **STOP HERE.** Provide a preview link/instructions for Luke to review. Do NOT proceed to Step 5 (porting remaining content) until Luke explicitly reviews and approves.

## Verification & Guardrails

### Verification Resources
- `npm run validate` (`node scripts/build-index.mjs && node scripts/validate-content.mjs && node scripts/check-register.mjs`) must pass cleanly after every step.
- `check-register.mjs` must confirm zero unregistered CSS classes.

## Acceptance Criteria

### Execution & Quality Gate
- [ ] Astro static build with `@astrojs/vercel` adapter successfully completes.
- [ ] `src/content.config.ts`, `site.json`, `podcast.json`, and `taxonomy.json` correctly configured.
- [ ] `site.css` and `BaseLayout.astro` follow the design system and HTML contract (1 visible `<h1>`, `<main>`, no inline styles).
- [ ] Exactly one article ported from `legacy/` into `content/articles/<slug>.md` and verified.
- [ ] 301 redirect for the ported article present in `vercel.json`.
- [ ] `npm run validate` output provided after each step with zero errors.
- [ ] Hard stop observed after Step 4 — no content ported beyond the first reference article.
