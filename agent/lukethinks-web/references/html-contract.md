# HTML contract

Every page on lukethinks.nl obeys this skeleton. In Astro it is `src/layouts/BaseLayout.astro`; pages supply only what goes inside `<main>`. Consistency here is what lets scripts, feeds and future templates consume pages reliably.

## Page skeleton

```html
<!DOCTYPE html>
<html lang="en">
<head><!-- see seo-schema.md --></head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>

  <header class="site-header">
    <div class="container header-content">
      <div class="logo-section">…</div>
      <nav aria-label="Primary"><ul>…</ul></nav>
    </div>
  </header>

  <nav aria-label="Breadcrumb" class="breadcrumbs">
    <ol>…</ol>
  </nav>

  <main id="main" class="container">
    <h1>…</h1>
    …
  </main>

  <footer class="site-footer">…</footer>
</body>
</html>
```

Rules that follow from it:

- **Exactly one `<h1>` per page, and it is visible.** Legacy pages hid its `<h1>` with `.sr-only` and showed an `<h2>` as the visual title. Do not repeat that pattern — it splits the document outline from what the reader sees and confuses both screen readers and parsers. Write one honest `<h1>` that works for humans and search.
- Headings descend without skipping. `h1 → h2 → h3`. A heading is never chosen for its size.
- `<main>` appears once and wraps the page's unique content. Header, nav, breadcrumbs and footer sit outside it.
- Multiple `<nav>` elements need distinct `aria-label`s (`Primary`, `Breadcrumb`, `Footer`).
- A skip link is the first focusable element. It may be `.sr-only` until focused.
- Scripts go before `</body>` or carry `defer`. Never place `<script>` between `</head>` and `<body>` as some current pages do — that is invalid and browsers silently relocate it.

## Semantics

| Use | Not |
|---|---|
| `<article>` for a standalone post/episode | `<div class="article">` |
| `<section>` **with a heading** for a thematic block | `<section>` as a styling wrapper |
| `<time datetime="2025-10-04">` for every date | bare text dates |
| `<button type="button">` for in-page actions | `<a href="#">` or `<div onclick>` |
| `<a>` for navigation to a URL | a button with a JS redirect |
| `<figure>` + `<figcaption>` for charts and images with captions | a `div` and a `p` |
| `<ol>` for breadcrumbs and ordered steps | `<ul>` or bare spans |
| `<dl>` for label/value metadata pairs | stacked divs |

If an element exists only to hold a class for layout, it is fine — but give it a name from the register, and delete wrappers that hold nothing.

## Accessibility floor

Non-negotiable on every page:

- Every image has `alt`. Decorative images use `alt=""`. Charts get a text alternative — either a caption stating the takeaway or an adjacent data table; a canvas alone is invisible to screen readers.
- Every form control has a `<label for>`. Placeholder text is not a label.
- Colour is never the only signal — pair with text or an icon.
- Interactive elements are reachable and operable by keyboard, with a visible focus ring.
- Tabs, accordions and disclosure widgets carry `aria-expanded` / `aria-selected` / `aria-controls`, and the state updates in JS.
- Text contrast meets 4.5:1. `--light-text` on white passes; `--very-light-text` does not — use it only for non-text separators.
- The audio player is a native `<audio controls>` (keyboard-accessible for free). If ever replaced by a custom player, it must be rebuilt with real `<button>`s, an `aria-label` per control, and a labelled `<input type="range">` for the scrubber.

## Stable hooks

Anything a script, feed builder, test or future template must find gets a `data-*` attribute. Classes are for styling and may be restyled; `data-*` is a contract.

```html
<article data-content-type="article" data-slug="ai-partnership-accounting" data-published="2025-10-04">
  <div data-region="audio">…</div>
  <div data-region="body">…</div>
</article>
```

Reserved attributes:

- `data-content-type` — `article` | `learning` | `research` | `episode` | `page`
- `data-slug` — the canonical slug, matching the content file name
- `data-published` — ISO date
- `data-region` — a named zone a script may read or replace (`audio`, `body`, `toc`, `related`, `meta`)
- `data-episode` — episode number, on podcast pages only

IDs are for anchor targets and `for`/`aria-controls` wiring only. Keep them kebab-case, derived from the heading text, and stable — TOC links and external deep links depend on them. Changing a heading's `id` is a breaking change; add a redirect-safe duplicate anchor if you must.

## Tables

```html
<table>
  <caption>Quarterly losses recognised under the equity method</caption>
  <thead>
    <tr><th scope="col">Quarter</th><th scope="col">Amount</th></tr>
  </thead>
  <tbody>
    <tr><th scope="row">Q1 FY2025</th><td>$683m</td></tr>
  </tbody>
</table>
```

Always a `<caption>`. Always `scope` on header cells. Never a table for layout. For narrow screens, wrap in `<div class="table-scroll" role="region" aria-label="…" tabindex="0">` so keyboard users can scroll it.

## Forms

Only relevant if a newsletter or contact form arrives. When it does:

```html
<form action="…" method="post">
  <div class="field">
    <label for="email">Email address</label>
    <input id="email" name="email" type="email" autocomplete="email" required
           aria-describedby="email-hint email-error">
    <p id="email-hint" class="field-hint">Used only for new-post notifications.</p>
    <p id="email-error" class="field-error" role="alert" hidden>Enter a valid email address.</p>
  </div>
  <button type="submit">Subscribe</button>
</form>
```

Group related inputs in `<fieldset>` with a `<legend>`. Errors are announced with `role="alert"`, referenced by `aria-describedby`, and written as instructions ("Enter a valid email address"), not accusations.

## Anti-patterns to remove on sight

- Inline `style="…"` attributes. Styling lives in `site.css` or a component's scoped `<style>`.
- `<script>` outside `<head>`/`<body>`.
- A hidden `<h1>` with a visible `<h2>` acting as the title.
- Emoji used as the only content of a meaningful element. Emoji is part of the site's voice — keep it, but pair it with text, and mark purely decorative emoji `aria-hidden="true"`.
- Repeated header/nav/footer markup that diverges page to page.
- `controlslist="nodownload"` treated as protection. It is a hint, nothing more; do not build anything on the assumption a file is unreachable.
