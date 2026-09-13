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

## 2026-09-12T20:03:13Z

Add reader reactions with a visible counter to every article on lukethinks.nl — three buttons: Useful / Changed my mind / Want more depth.

Working directory: c:\Users\lvanden\OneDrive - Stryker\Documents\1. Trauma & Extremities - Personal Luke vdTop\4. LukeThinks\lukethinks-website
Integrity mode: development

This is a single self-contained feature; keep it small and focused.

## Reference Material
- `AGENTS.md` (root rules and instructions)
- `.agent/lukethinks-web/SKILL.md` (authoritative routing and contracts)
- `.agent/lukethinks-web/references/decisions.md` (architectural decision record)
- `.agent/lukethinks-web/references/design-system.md`
- `.agent/lukethinks-web/references/html-contract.md`

## Environment Configuration
The Vercel project uses the following Upstash/KV variables:
- `KV_REST_API_URL="https://super-terrier-152269.upstash.io"`
- `KV_REST_API_TOKEN="xxx"`
- Cookie signing secret set in .env and to be set in Vercel:
  `REACTIONS_COOKIE_SECRET="xxx"`

Node and npm are located at: `C:\Users\lvanden\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.19.0-win-x64`
Run commands using `$env:PATH = "C:\Users\lvanden\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.19.0-win-x64;$env:PATH"` and `npm.cmd`.

Build, in this order, validating after each step with npm.cmd run validate before moving to the next:

1. Confirm @astrojs/vercel hybrid config. Set up astro:env secrets matching the actual env var names (KV_REST_API_URL, KV_REST_API_TOKEN, and REACTIONS_COOKIE_SECRET). Confirm no secret ends up in the client bundle.
2. A thin Redis client (incr, mget only) using @upstash/redis, reading KV_REST_API_URL / KV_REST_API_TOKEN. Fails soft on read (Redis down → hide counts, never break the page), fails loud on write.
3. An Astro Action with two endpoints: react({slug, kind}) and getCounts({slug}). Validate slug against the existing articles content collection. Atomic increments only, never read-modify-write.
4. One signed cookie (not one per article) preventing repeat votes, capped at 2KB, httpOnly/secure/sameSite=lax. Rate-limit by hashed IP, never store a raw IP.
5. The visible reaction bar: a vanilla custom element, no framework, rendered via a server:defer island so the article page itself stays fully static and cached. Three buttons, current counts, clearly shows which one (if any) this visitor already picked. With JavaScript disabled, render nothing.
6. Insert it at the end of the article template (src/pages/articles/[slug].astro), after content, before Related reading (inside `<footer class="article-footer">`). Tell the user the exact file and line you changed.

Add two new ADRs with status Accepted to `.agent/lukethinks-web/references/decisions.md`:
- ADR-0014: Rendering stays static everywhere except a single reactions endpoint and its counter display, which alone use on-demand rendering (Astro's hybrid mode, export const prerender = false on just those routes).
- ADR-0015: Counters are stored in Upstash Redis (provisioned via Vercel Storage as KV), free tier, EU region, over HTTP via @upstash/redis. No other new dependency.

Constraints: no user accounts, no auth, no email capture, no analytics, no IP storage, no new dependency beyond @astrojs/vercel and @upstash/redis. Keyboard operable, visible focus, works with a screen reader. Total added client JavaScript under 5KB gzipped — report the exact figure.

When done:
- Run npm.cmd run validate
- Run npm.cmd run check-register
- Run npm.cmd run build
- Paste all three outputs
- Provide health check route /api/health against Redis
- Hit /api/health against the live Vercel deployment if reachable or verify it locally with live Upstash Redis
- Report the exact article URL to check by hand.
