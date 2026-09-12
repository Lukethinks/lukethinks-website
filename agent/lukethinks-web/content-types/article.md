# Articles, essays and research pieces

**Golden reference:** `templates/article.reference.html`

Covers `type: article` and `type: research`. They share a template; `research` differs only in breadcrumb, category label, and a stronger expectation of sources and data.

## Voice

From the site brief, and it should shape structure, not just prose: show the thinking, not only the conclusion. Analytical but conversational, like explaining to a smart friend. Honest about uncertainty. Process over outcome. Structure that supports this:

- Open with the question, not the answer.
- Make uncertainty visible with a `.callout` where the reasoning is genuinely unsettled, rather than smoothing it into confident prose.
- Put figures in `.stats-box` early, so a skimmer gets the scale before the argument.

## Frontmatter

Core fields plus:

```yaml
type: "article"
category: "Financial Analysis"     # the visible .article-category label
subtitle: "What happens when technology moves faster than the accounting rules?"
hero: { src: "/assets/img/…", alt: "…" }   # optional
toc: true                          # generate table of contents from h2s
audio: []                          # see podcast.md
sources:
  - { title: "Microsoft FY2025 Q2 10-Q", url: "https://…" }
confidence: "medium"               # low | medium | high — how settled the conclusion is
```

`confidence` is unusual and worth keeping. It is a one-word promise that matches the site's premise, it renders as a small badge, and it stops every piece reading as if equally certain.

## Structure

```html
<main id="main" class="container">
  <article data-content-type="article" data-slug="…" data-published="2025-10-04">

    <header class="article-header">
      <p class="article-meta">
        <span class="article-category">Financial Analysis</span>
        <time datetime="2025-10-04">4 October 2025</time>
        <span>25 min read</span>
      </p>
      <h1 class="article-title">…</h1>
      <p class="article-subtitle">…</p>
    </header>

    <nav class="toc-container" aria-labelledby="toc-title" data-region="toc">
      <h2 class="toc-title" id="toc-title">On this page</h2>
      <ol class="toc-list">…</ol>
    </nav>

    <div data-region="audio">…</div>

    <div class="article-content" data-region="body">
      <h2 id="the-partnership-web">…</h2>
      …
    </div>

    <footer class="article-footer">
      <h2>Sources</h2>
      <ol>…</ol>
      <nav aria-label="Related reading" data-region="related">…</nav>
    </footer>

  </article>
</main>
```

Points that differ from the current pages, each for a reason:

- **One visible `<h1>`**, the real title. The existing pattern of an `.sr-only` `<h1>` with an `<h2>` shown is a split outline — fix it on any page you touch.
- The TOC is a `<nav>` with a label and an `<ol>`, because it is ordered navigation.
- `<time datetime>` on the date.
- Sources are an ordered list in the article footer. Every factual claim about a company, filing or figure needs one — this is a finance site, and unsourced numbers are the fastest way to lose the reader.
- Reading time is computed (`readingMinutes`), not typed.

## Charts

Chart.js is already in use. A `<canvas>` is invisible to assistive technology and to search engines, so:

```html
<figure class="chart-figure">
  <canvas id="chart-losses" role="img"
          aria-label="Quarterly equity-method losses rising from $410m to $683m across FY2025."></canvas>
  <figcaption>Losses recognised despite no voting rights. <a href="#chart-losses-data">See the data</a>.</figcaption>
</figure>
<details id="chart-losses-data">
  <summary>Chart data as a table</summary>
  <table>…</table>
</details>
```

The `aria-label` states the **takeaway**, not "a chart of losses". The data table is not optional — it is also what makes the figures reusable in a LinkedIn post.

## Anchors

Every `<h2>` gets a kebab-case `id` derived from its text. These are permanent: the TOC, external deep links and shared LinkedIn links all point at them. Changing heading text is fine; changing an existing `id` is a breaking change.

## Publishing checklist

1. Frontmatter complete; tags from `taxonomy.json`.
2. One `<h1>`; headings descend.
3. Every figure sourced.
4. Charts have text alternatives.
5. Reading time and index regenerated.
6. `related` set, or tags good enough for the fallback.
7. Validator passes.
