# LinkedIn posts

**LinkedIn is a derived artifact, never a content type with a page.**

Nothing on lukethinks.nl exists to hold a LinkedIn post. Posts are generated *from* canonical content and stored as sidecar files, so the site stays the source of truth and the archive shows what was promoted where.

## Where it lives

```
content/articles/ai-partnership-accounting.md
content/articles/ai-partnership-accounting.linkedin.md   ← sidecar
```

Sidecar frontmatter:

```yaml
source: "ai-partnership-accounting"   # slug of the canonical piece
variant: "hook-first"                 # hook-first | question | data-point | process
status: "draft"                       # draft | posted
postedAt: 2025-10-06                  # filled in after posting
postUrl: "https://www.linkedin.com/…" # filled in after posting
utm: "?utm_source=linkedin&utm_medium=social&utm_campaign=ai-partnership"
```

Sidecars are excluded from the site build, sitemap, indexes and feeds. They are working material in the repo, not pages.

## Link conventions

Every link back to the site carries the `utm` string, so Vercel Analytics can separate LinkedIn traffic from search. Link to the canonical URL, or to a heading anchor when the post is about one section — deep links convert better than homepage links and prove the point being made.

Never shorten links through a third-party shortener. It breaks the analytics chain and the link dies when the service does.

## Drafting rules

Write from the content file, not from memory of it. Load the source piece and pull real figures and real headings.

- Open with the tension or the number, not "I wrote a new post".
- One idea. A LinkedIn post that summarises eight sections converts nobody.
- Keep the specifics: the actual figure, the actual standard, the actual surprise. Generic thought-leadership is indistinguishable from every other post in the feed.
- Match the site voice: curious, honest about limits, process over expertise. If a draft claims certainty the article marks as `confidence: low`, it is wrong.
- Do not fabricate anything not in the source. If a hook needs a fact the article does not have, the hook is wrong, not the article.
- No hashtag walls. Three at most, and only ones matching the controlled tag list.
- Offer 2–3 variants with different angles when asked for a post — hook-first, question-first, and one built around a single data point — and say what each trades off. Do not silently pick one.

## Audio posts

For an episode, the post links to the episode page, not the raw MP3 — the page carries the transcript, notes and player. Mention the runtime; people decide on runtime. Disclose AI production if the audio is AI-generated, in the post as well as on the page.

## The scale play

Once `content-index.json` exists, generating a backlog of drafts is one pass over published items with no sidecar. That is the point of enforcing the content contract: repurposing becomes a script over structured data instead of a re-read of eighty HTML files.
