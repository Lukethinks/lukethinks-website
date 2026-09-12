# Project: lukethinks-web (Astro Greenfield Rebuild)

## Architecture
- **Framework**: Astro v5 Static Site Generation (SSG).
- **Deployment & Hosting**: Vercel via `@astrojs/vercel` static output adapter (zero SSR, zero Edge functions).
- **TypeScript**: Strict mode (`astro/tsconfigs/strict`).
- **Content Engine**: Astro 5 Content Layer using `notSidecar` loader and Zod schemas in `src/content.config.ts`.
- **Design System**: Global CSS tokens in `src/styles/site.css` with 13 `:root` variables. Strictly registered classes verified by `scripts/check-register.mjs`.
- **Layout Architecture**: `BaseLayout.astro` providing HTML outer shell, skip link, accessible landmarks (`header`, `nav`, `main#main`, `footer`), single visible `<h1>`, and Vercel Analytics hook.
- **Routing & URLs**: Extensionless canonical routes (`/articles/<slug>`). Permanent 301 redirects in `vercel.json` mapping all legacy `.html` URLs.
- **Data Integrity**: Zero invented metadata (`TODO(luke)` placeholders where facts are unknown).
- **Validation Pipeline**: Native 3-stage validation suite via `npm run validate`:
  1. `build-index.mjs` -> generates `public/content-index.json`
  2. `validate-content.mjs` -> checks frontmatter, Zod contracts, HTML contracts, links, audio
  3. `check-register.mjs` -> verifies zero unregistered CSS classes in built output

## Feature Inventory
Every feature from the survey phase is enumerated here and assigned to a milestone:

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Astro Static Scaffold | Astro v5 project initialized with minimal template and TypeScript strict | M1 | stack.md |
| 2 | Vercel Adapter Configuration | `@astrojs/vercel` static output adapter configured in `astro.config.mjs` | M1 | stack.md |
| 3 | Strict TypeScript Configuration | `tsconfig.json` extending `astro/tsconfigs/strict` | M1 | stack.md |
| 4 | NPM Scripts Suite | `package.json` scripts (`audit`, `dev`, `build:index`, `build:podcast`, `validate`, `build`) | M1 | AGENTS.md |
| 5 | Validation Scripts Migration | Copy scripts from `.agent/lukethinks-web/scripts/` to `scripts/` | M1 | automation.md |
| 6 | Core Content Schema | `src/content.config.ts` defining articles, research, learnings, episodes collections | M2 | starter/content.config.ts |
| 7 | Site Facts JSON | `content/site.json` establishing site metadata and nav links | M2 | starter/site.json |
| 8 | Podcast Metadata JSON | `content/podcast.json` establishing channel data with `TODO(luke)` markers | M2 | starter/podcast.json |
| 9 | Controlled Taxonomy JSON | `content/taxonomy.json` establishing allowed tag dictionary | M2 | starter/taxonomy.json |
| 10 | Glob Loaders & Sidecar Filtering | `notSidecar` loader in content config filtering `*.linkedin.md` | M2 | content.config.ts |
| 11 | CSS Variables Design Tokens | 13 `:root` variables in `src/styles/site.css` matching design system specs | M3 | design-system.md |
| 12 | Brand Gradients & Radii | Signature cream/amber gradients and 8px/12px/16px/20px border radii | M3 | design-system.md |
| 13 | Typography & Container System | Inter typography, max-width 1200px container with 24px padding (16px mobile) | M3 | design-system.md |
| 14 | Focus Ring Styling | 2px solid accent amber with 2px offset for accessible focus states | M3 | design-system.md |
| 15 | BaseLayout HTML Shell | `src/layouts/BaseLayout.astro` encapsulating outer HTML document and landmarks | M3 | html-contract.md |
| 16 | Single Visible H1 Enforcement | Exactly one visible `<h1>` rendered per page inside `<main>` | M3 | html-contract.md |
| 17 | Accessible Navigation Landmarks | Unique `aria-label` for primary nav and breadcrumbs | M3 | html-contract.md |
| 18 | Class Register Compliance | All classes used in layout/styles registered against `check-register.mjs` | M3 | check-register.mjs |
| 19 | Legacy File Relocation | Move all 14 existing root `.html` files to `legacy/` (read-only) | M4 | ADR-0002 |
| 20 | Reference Article Migration | Port `asc-323-equity-method.html` into `content/articles/asc-323-equity-method.md` | M4 | content-model.md |
| 21 | Article Dynamic Route | `src/pages/articles/[slug].astro` querying `articles` collection | M4 | stack.md |
| 22 | Permanent 301 Redirects | Configure `vercel.json` with 301 redirects for legacy URLs to `/articles/<slug>` | M4 | ADR-0006 |
| 23 | Hard Stop at Step 4 | Halt execution after Step 4 and prepare review handoff for Luke | M4 | ORIGINAL_REQUEST.md |

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Step 1: Scaffold Astro | Astro v5 minimal, TS strict, `@astrojs/vercel`, scripts copied to `scripts/`, `package.json` scripts configured, install dependencies, commit, `npm run validate` | None | DONE |
| M2 | Step 2: Content Schema & Core Collections | Place `src/content.config.ts`, `content/site.json`, `content/podcast.json`, `content/taxonomy.json`, commit, `npm run validate` | M1 | DONE |
| M3 | Step 3: Design System & BaseLayout | Build `src/styles/site.css` with 13 tokens and component styles, build `src/layouts/BaseLayout.astro`, commit, `npm run validate` | M2 | PLANNED |
| M4 | Step 4: Port One Reference Article & Stop | Move legacy HTML to `legacy/`, port `asc-323-equity-method.md`, create `src/pages/articles/[slug].astro`, configure `vercel.json` 301s, commit, `npm run validate`, generate Luke review handoff | M3 | PLANNED |

## Interface Contracts

### M1 ↔ M2 (Scaffolding to Content Schema)
- `scripts/` directory populated with `build-index.mjs`, `validate-content.mjs`, `check-register.mjs`.
- Dependencies `astro`, `@astrojs/vercel`, `yaml` installed.
- `package.json` scripts executable via `npm.cmd run validate`.

### M2 ↔ M3 (Content Schema to Design System & Layout)
- `content/site.json` provides site title, author, and primary nav links to `BaseLayout.astro`.
- Content collection types (`articles`, `research`, `learnings`, `episodes`) established for layout consumption.

### M3 ↔ M4 (Layout to Article Migration)
- `BaseLayout.astro` accepts props (`title`, `description`, `canonical`, `type`, `publishedTime`, etc.) and provides `<slot />` inside `<main id="main" class="container">`.
- `site.css` provides all typography, prose styling, callouts, and code/table classes for markdown rendering.
- Classes used in `[slug].astro` and rendered markdown must strictly match classes known to `check-register.mjs`.

## Code Layout
```
├── .agent/lukethinks-web/     # Project documentation, reference templates, and starter assets (read-only)
├── legacy/                   # Archived legacy HTML files (read-only source material)
├── scripts/                  # Build and validation scripts (build-index, validate-content, check-register, etc.)
├── content/                  # Content collections and metadata
│   ├── articles/             # Markdown articles (e.g. asc-323-equity-method.md)
│   ├── site.json             # Global site metadata and navigation
│   ├── podcast.json          # Podcast metadata
│   └── taxonomy.json         # Tag taxonomy dictionary
├── src/
│   ├── content.config.ts     # Zod content collection schemas
│   ├── styles/
│   │   └── site.css          # Design system tokens and global styles
│   └── layouts/
│       └── BaseLayout.astro  # Outer HTML shell and layout
│   └── pages/
│       └── articles/
│           └── [slug].astro  # Dynamic article page route
├── astro.config.mjs          # Astro configuration with Vercel adapter
├── tsconfig.json             # TypeScript strict configuration
├── vercel.json               # Vercel deployment and 301 redirects configuration
└── package.json              # Project dependencies and script runner
```
