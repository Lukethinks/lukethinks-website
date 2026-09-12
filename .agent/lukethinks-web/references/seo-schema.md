# Head, metadata and structured data

## Standard head

Order matters for readability, not for browsers. Keep this order so diffs stay clean across generated pages.

```html
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">

  <title>Page title · Luke Thinks</title>
  <meta name="description" content="140–160 characters, written for a human.">
  <link rel="canonical" href="https://lukethinks.nl/articles/ai-partnership-accounting">

  <meta property="og:type" content="article">
  <meta property="og:title" content="…">
  <meta property="og:description" content="…">
  <meta property="og:url" content="https://lukethinks.nl/…">
  <meta property="og:image" content="https://lukethinks.nl/assets/og/…png">
  <meta property="og:site_name" content="Luke Thinks">
  <meta name="twitter:card" content="summary_large_image">

  <link rel="icon" href="/assets/favicon.ico" sizes="any">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">

  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <!-- site.css is imported by BaseLayout.astro; Astro emits the link -->

  <link rel="alternate" type="application/rss+xml" title="Luke Thinks" href="/feed.xml">
</head>
```

Rules:

- Every value here comes from the content file. If a title is typed twice — once in `<title>` and once in `og:title` — one of them is already wrong.
- `og:image` must be absolute. Relative OG images silently fail on LinkedIn, which is the main sharing surface.
- LinkedIn caches previews aggressively. When a title or image changes on a page already shared, run it through LinkedIn's Post Inspector to refresh.
- Canonical is absolute, extensionless, no trailing slash (ADR-0006).
- Vercel Analytics and Speed Insights are components in `BaseLayout.astro`, rendered before `</body>`.

## OG images

A hand-made image per post will not survive at volume. Generate them: one template with the title, category and the site mark, rendered at build time with Satori to `public/assets/og/<slug>.png` at 1200×630. Falls back to a site-wide default when absent.

## Structured data

One `<script type="application/ld+json">` block per page, generated from frontmatter. Never hand-typed — it duplicates facts that already exist, and hand-typed JSON-LD drifts from the visible page within two edits.

Articles and learning notes:

```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "…",
  "description": "…",
  "datePublished": "2025-10-04",
  "dateModified": "2025-11-02",
  "author": { "@type": "Person", "name": "Luke", "url": "https://lukethinks.nl/about" },
  "publisher": { "@type": "Person", "name": "Luke" },
  "mainEntityOfPage": "https://lukethinks.nl/…",
  "keywords": ["accounting", "ai"]
}
```

Episodes use `PodcastEpisode` with an `associatedMedia` `AudioObject` carrying `contentUrl`, `duration` (ISO 8601, e.g. `PT23M52S`) and `encodingFormat`, plus `partOfSeries` pointing at a `PodcastSeries`.

Article pages with companion audio add an `AudioObject` too — it is how a narrated article becomes eligible for audio surfaces in search.

Breadcrumbs get a `BreadcrumbList` matching the visible breadcrumb exactly. Mismatched breadcrumb markup is a common cause of Search Console warnings.

## Sitemap and feeds

- `/sitemap.xml` — generated from `content-index.json`, published items only, with `lastmod` from `updated ?? published`.
- `/robots.txt` — allow all, point at the sitemap.
- `/feed.xml` — site-wide RSS for readers.
- `/podcast.xml` — separate, different spec, see `content-types/podcast.md`. Do not try to serve both from one feed; podcast clients and feed readers want different things.

## What not to do

- No keyword stuffing in hidden elements. The existing `.sr-only` `<h1>` reads as an SEO-first title rather than a human one; replace it with one honest visible title.
- No `<meta name="keywords">`. Ignored for two decades.
- Do not change a slug for SEO reasons without a 301 in `vercel.json`.
- No `hreflang` until a second language exists (ADR-0008).
