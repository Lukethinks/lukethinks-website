# Learning notes and experiments

**Golden reference:** `templates/learning.reference.md` (a delta against `article.reference.html`)

Covers `type: learning`. These are the site's differentiator: not "here is what I know" but "here is what I tried and what happened". The structure should make that impossible to fake.

## Frontmatter

```yaml
type: "learning"
category: "Accounting Standards"
format: "note"              # note | experiment | breakdown
status: "published"
state: "in-progress"        # in-progress | concluded | abandoned
question: "Does the equity method make sense when there are no voting rights?"
hypothesis: "…"             # required when format is experiment
started: 2025-09-12
concluded: 2025-10-04       # optional
confidence: "low"
outcome: "partial"          # supported | refuted | partial | inconclusive | null
tags: ["accounting"]
```

Two fields do the heavy lifting. `state` lets the site show live, unfinished work honestly, which is the whole premise. `outcome` — including `refuted` and `abandoned` — is what makes the archive trustworthy. Publishing failures is the point; the schema should make it easy rather than exceptional.

## Structure

```html
<article data-content-type="learning" data-slug="…" data-published="…">
  <header class="article-header">
    <p class="article-meta">
      <span class="article-category">Accounting Standards</span>
      <span class="state-badge" data-state="in-progress">In progress</span>
      <time datetime="2025-09-12">Started 12 September 2025</time>
    </p>
    <h1 class="article-title">…</h1>
    <p class="article-subtitle">…</p>
  </header>

  <section class="callout" aria-labelledby="the-question">
    <h2 class="callout-title" id="the-question">The question</h2>
    <p>…</p>
  </section>

  <div class="article-content" data-region="body">
    <h2 id="what-i-tried">What I tried</h2>
    <h2 id="what-happened">What happened</h2>
    <h2 id="what-i-got-wrong">What I got wrong</h2>
    <h2 id="what-im-still-unsure-about">What I'm still unsure about</h2>
    <h2 id="what-id-do-next">What I'd do next</h2>
  </div>
</article>
```

Those five headings are the house shape for `format: experiment`. Keep them, in order — a consistent shape means the reader learns where to look, and a script can extract "what I got wrong" across the archive later. A `note` may use only the first two; a `breakdown` may replace them with topic headings but must still carry an explicit uncertainty section.

## Index pages

`/learning` generates every `.topic-count` from the collection. Never type a count. Hand-maintained counts go stale on the second post and quietly undermine trust in everything else on the page.

Group by `category` for the topic grid, then list recent items by date. Show `state` on each card — an in-progress note is more interesting than a finished one, not less, and hiding the state makes the page look like a stale blog.

## Linking to articles

A learning note that grows into a full analysis links forward with `related`, and the article links back. Do not delete or rewrite the note when the article lands — the note *is* the record of the process, and overwriting it deletes the site's whole reason for existing.
