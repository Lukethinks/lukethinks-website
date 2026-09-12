# Podcast and audio

**Golden reference:** `templates/episode.reference.html`

## The strategic point first

On-site audio and a Spotify podcast are the *same data problem*. A podcast is not a platform — it is an RSS feed with an `<enclosure>` per episode, which Spotify, Apple and everyone else read. If episode data is modelled properly now, going public later is one script and one form submission. If it is not, it is a re-do.

So: **build the feed from day one, even while it is unlisted.** Cost is near zero, and it forces the fields that are easy to capture at publish time and painful to reconstruct a year later — duration, byte length, GUID, episode number.

Current reality: NotebookLM-generated narrations and "debate" versions attached to articles. Likely future: ElevenLabs-produced episodes that stand alone. The model below handles both, because it treats audio as a first-class content item that *may* be attached to an article, rather than as an article decoration.

## Two shapes of audio

1. **Companion audio** — a narration or debate version of an existing article. Lives in the article's frontmatter. No page of its own. May optionally appear in the feed as a bonus item.
2. **Episode** — stands alone, has show notes, a number, a page, and always appears in the feed.

Do not model companion audio as a fake episode with a stub page. That inflates the feed with duplicate content and confuses listeners who already read the piece.

## Frontmatter — episodes

Core fields from `content-model.md`, plus:

```yaml
type: "episode"
episode: 7
season: 1
audio:
  src: "https://<blob-host>/audio/ep-007-equity-method.mp3"
  bytes: 24118374          # exact file size — required by RSS, computed by script
  durationSeconds: 1432    # computed by script from the file
  mimeType: "audio/mpeg"
guid: "lukethinks-ep-007"  # permanent, never reused, never changed
explicit: false
transcript: true               # file lives at public/transcripts/<slug>.vtt (ADR-0011)
chapters:
  - { start: 0,   title: "What the equity method actually says" }
  - { start: 245, title: "Where Microsoft's numbers come from" }
production:
  source: "elevenlabs"     # notebooklm | elevenlabs | human | mixed
  voices: 2
  aiDisclosed: true
```

`bytes` and `durationSeconds` are **never typed by hand.** A wrong `length` on an `<enclosure>` makes some clients refuse the download. `scripts/build-podcast-rss.mjs` reads them from the file; if it cannot, it fails loudly rather than guessing.

`guid` is permanent. Changing it makes every podcast client re-download the episode as new. Never derive it from the title.

## Frontmatter — companion audio on an article

```yaml
audio:
  - label: "Listen to this article"
    src: "https://<blob-host>/audio/ai-partnership-narration.mp3"
    durationSeconds: 240
    bytes: 3840112
    variant: "narration"
    production: { source: "notebooklm", aiDisclosed: true }
  - label: "Listen as a longer debate"
    src: "https://<blob-host>/audio/ai-partnership-debate.mp3"
    durationSeconds: 900
    bytes: 14402118
    variant: "debate"
    production: { source: "notebooklm", aiDisclosed: true }
```

An array, always — the current article already carries two variants, and hardcoding "narration + debate" as named fields breaks the moment there is a third.

## Where the audio files live

**Not in git.** MP3s are large, binary and immutable. Committing them bloats the repository permanently (git keeps every version forever), slows every clone, and pushes toward deployment size limits as the archive grows.

**Decided: Vercel Blob** (ADR-0005), public store, path `audio/<slug>.mp3`. The store hostname lives in `content/site.json` as `audioHost`; the validator rejects any `audio.src` not on it. Do not propose R2 or a podcast host.

Whatever is chosen:
- The URL in `audio.src` is **absolute and permanent**. Podcast clients cache it; a relative path breaks in every feed reader.
- Never move or re-encode a published file at the same URL. Publish a new file with a new URL and a new GUID.
- Keep an offline master. The published MP3 is a derivative.
- Encode consistently: MP3, mono or joint stereo, 96–128 kbps for speech, loudness-normalised to roughly −16 LUFS stereo / −19 LUFS mono, the podcast convention. `ffmpeg` can enforce this — see `automation.md`.

The storage choice is logged. It is the hardest thing here to reverse, which is why it is not revisited.

## Player markup

This is `src/components/AudioPlayer.astro`. Classes `.audio-player-container` / `.custom-audio-player`; no inline styles.

```html
<div class="audio-player-container" data-region="audio" data-variant="narration">
  <h2 class="audio-title" id="audio-narration">Listen to this article</h2>
  <p class="audio-meta">
    <span aria-hidden="true">🎧</span>
    <span>Narration · <time datetime="PT4M">4 min</time></span>
  </p>
  <audio class="custom-audio-player" controls preload="none"
         aria-labelledby="audio-narration"
         src="https://…/ai-partnership-narration.mp3">
    <p>Your browser does not support audio playback.
       <a href="https://…/ai-partnership-narration.mp3">Download the MP3</a>.</p>
  </audio>
  <p class="audio-disclosure">Audio generated with AI from the written article.</p>
</div>
```

Each detail is a real failure mode:

- `preload="none"` — two players on one page will otherwise start pulling megabytes before anyone presses play.
- The fallback is a **download link**, not the current dead-end sentence.
- `aria-labelledby` ties the player to its own heading, so a screen-reader user with two players can tell them apart. Two identically-labelled players is the current article's actual bug.
- `<time datetime="PT4M">` is ISO 8601 duration, so it is machine-readable.
- **AI disclosure appears on the page, not only in metadata.** For NotebookLM or ElevenLabs output published under Luke's name this is an honesty matter, increasingly a platform requirement, and entirely on-brand for a site about showing the process.

## Transcripts

Every episode gets one. In order of weight: accessibility (audio without a transcript is unusable for deaf visitors), search (audio is invisible to search engines; the transcript is the only indexable version), and reuse (transcripts are the raw material for LinkedIn drafts).

- Store as WebVTT at `public/transcripts/<slug>.vtt` — the feed and the page both derive the URL from the slug, so they cannot disagree.
- Render in a `<details>`/`<summary>` disclosure, not a JS accordion.
- The feed emits `<podcast:transcript>` automatically when `transcript` is not `false`.

## RSS feed requirements

Generated by `scripts/build-podcast-rss.mjs` into `/podcast.xml`. Never hand-edited.

Channel values come from `content/podcast.json` — never from code. Channel: `title`, `link`, `description`, `language`, `itunes:author`, `itunes:image` (square, 1400×1400 to 3000×3000 — Apple rejects smaller), `itunes:category`, `itunes:explicit`, `itunes:type` (`episodic`), and `atom:link rel="self"`.

Item: `title`, `description`, `pubDate` (RFC 2822, *not* ISO — the script converts), `guid isPermaLink="false"`, `enclosure url/length/type`, `itunes:duration`, `itunes:episode`, `itunes:season`, `itunes:explicit`.

Going live later is then: host the artwork, submit `https://lukethinks.nl/podcast.xml` to Spotify for Creators and Apple Podcasts Connect, verify by email. Nothing about the site changes.

## Pages

- `/podcast` — show index: latest episodes, subscribe links, what the show is.
- `/podcast/<slug>` — per episode: player, show notes, transcript, links.
- **Podcast** is already in the primary nav (ADR-0007). It renders as "coming soon" until the first published episode exists.

## Checklist before publishing an episode

1. Audio uploaded to permanent storage; URL absolute.
2. `bytes` and `durationSeconds` computed by script, not typed.
3. GUID unique and permanent.
4. Transcript present.
5. AI production disclosed where applicable.
6. Show notes contain every URL mentioned in the audio — listeners cannot click audio.
7. `build-podcast-rss.mjs` run; feed validates.
8. Validator passes.
