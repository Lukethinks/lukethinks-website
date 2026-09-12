# Golden reference — learning note

Learning notes reuse `article.reference.html` in full. Only three things change.

**1. The article element and meta line**

```html
<article data-content-type="learning" data-slug="{{slug}}" data-published="{{published}}">
  <header class="article-header">
    <p class="article-meta">
      <span class="article-category">{{category}}</span>
      <span class="state-badge" data-state="{{state}}">{{stateLabel}}</span>
      <time datetime="{{started}}">Started {{startedHuman}}</time>
      <span class="confidence-badge" data-confidence="{{confidence}}">Confidence: {{confidence}}</span>
    </p>
    <h1 class="article-title">{{title}}</h1>
    <p class="article-subtitle">{{subtitle}}</p>
  </header>
```

**2. The question block, immediately after the header**

```html
<section class="callout" aria-labelledby="the-question">
  <h2 class="callout-title" id="the-question">The question</h2>
  <p>{{question}}</p>
  <!-- experiments only -->
  <p><strong>Hypothesis:</strong> {{hypothesis}}</p>
</section>
```

**3. The five house headings, in this order, inside `.article-content`**

```html
<h2 id="what-i-tried">What I tried</h2>
<h2 id="what-happened">What happened</h2>
<h2 id="what-i-got-wrong">What I got wrong</h2>
<h2 id="what-im-still-unsure-about">What I'm still unsure about</h2>
<h2 id="what-id-do-next">What I'd do next</h2>
```

A `note` may use only the first two. A `breakdown` may substitute topic headings but must
still carry an explicit uncertainty section. Keeping these ids stable means a script can
later extract "what I got wrong" across the whole archive — a genuinely interesting page
that only exists if the structure is consistent from the start.
