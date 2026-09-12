#!/usr/bin/env node
/**
 * build-podcast-rss.mjs — generates /podcast.xml for lukethinks.nl
 *
 *   node scripts/build-podcast-rss.mjs
 *   node scripts/build-podcast-rss.mjs --content content/episodes --out podcast.xml
 *
 * Channel facts come from content/podcast.json + content/site.json.
 * Reads real byte length and duration from the local master when
 * `audio.localFile` is present (needs ffprobe for duration); otherwise uses the
 * frontmatter values. Fails loudly rather than guessing — a wrong <enclosure
 * length> makes some podcast clients refuse the download outright.
 *
 * Requires: node 20+, `npm i yaml`. ffprobe optional but recommended.
 */

import { readFile, readdir, writeFile, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const run = promisify(execFile);

let YAML;
try {
  YAML = await import('yaml');
} catch {
  const { createRequire } = await import('node:module');
  YAML = createRequire(path.join(process.cwd(), 'package.json'))('yaml');
}

// ------------------------------------------------------- show configuration
// Channel facts live in content/podcast.json and content/site.json (data, not code).
const args0 = process.argv.slice(2);
const contentRoot = (() => { const i = args0.indexOf('--content'); return i !== -1 ? path.dirname(args0[i + 1]) : 'content'; })();
const readJson = async (f) => JSON.parse(await readFile(path.join(contentRoot, f), 'utf8'));
let SITE, POD;
try { SITE = await readJson('site.json'); POD = await readJson('podcast.json'); }
catch (e) { console.error(`build-podcast-rss: cannot read site.json / podcast.json in ${contentRoot}: ${e.message}`); process.exit(1); }
for (const [k, v] of Object.entries(POD)) {
  if (typeof v === 'string' && v.includes('TODO(luke)')) {
    if (k === 'email') {
      console.warn(`build-podcast-rss: podcast.json.${k} has TODO(luke). Using fallback placeholder 'luke@lukethinks.nl'.`);
      POD.email = 'luke@lukethinks.nl';
    } else {
      console.error(`build-podcast-rss: podcast.json.${k} is still TODO(luke). Fill it in before generating the feed.`);
      process.exit(1);
    }
  }
}
const abs = (p) => (/^https?:/.test(p) ? p : SITE.url + p);
const SHOW = { ...POD, siteUrl: SITE.url, feedUrl: abs(POD.feedPath), image: abs(POD.image) };

const args = process.argv.slice(2);
const flag = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};
const DIR = flag('content', 'content/episodes');
const OUT = flag('out', 'podcast.xml');

const fail = (msg) => {
  console.error(`build-podcast-rss: ${msg}`);
  process.exit(1);
};

const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const cdata = (s = '') => `<![CDATA[${String(s).replace(/]]>/g, ']]&gt;')}]]>`;

const hms = (total) => {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};

// RFC 2822 — RSS requires this, not ISO 8601.
const rfc2822 = (d) => new Date(d).toUTCString().replace('GMT', '+0000');

// Show notes are Markdown; RSS <description> wants text/HTML. Minimal, dependency-free
// conversion: paragraphs, links, emphasis stripped. Full rendering happens on the page.
const mdToPlain = (md = '') =>
  md.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/[*_`#>]+/g, '')
    .replace(/\n{2,}/g, '\n\n')
    .trim();

async function probeDuration(file) {
  try {
    const { stdout } = await run('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1', file,
    ]);
    const n = Math.round(Number(stdout.trim()));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ collect

let files;
try {
  files = (await readdir(DIR)).filter((f) => f.endsWith('.md') && !f.endsWith('.linkedin.md'));
} catch {
  fail(`Cannot read episode directory: ${DIR}`);
}

const episodes = [];
for (const name of files) {
  const full = path.join(DIR, name);
  const raw = await readFile(full, 'utf8');
  const end = raw.indexOf('\n---', 3);
  if (!raw.startsWith('---') || end === -1) fail(`${full}: no frontmatter block.`);
  const fm = YAML.parse(raw.slice(3, end)) ?? {};
  const notes = raw.slice(end + 4).trim();

  if (fm.status !== 'published') continue;
  if (fm.type !== 'episode') continue;

  const a = fm.audio ?? {};
  if (!a.src) fail(`${full}: audio.src is required.`);
  if (!/^https?:\/\//.test(a.src)) fail(`${full}: audio.src must be absolute.`);
  if (!fm.guid) fail(`${full}: guid is required and must be permanent.`);

  let bytes = a.bytes;
  let duration = a.durationSeconds;

  if (a.localFile) {
    try {
      bytes = (await stat(a.localFile)).size;
    } catch {
      fail(`${full}: audio.localFile not found: ${a.localFile}`);
    }
    duration = (await probeDuration(a.localFile)) ?? duration;
  }

  if (!Number.isInteger(bytes) || bytes <= 0)
    fail(`${full}: cannot determine audio.bytes. Set audio.localFile, or install ffprobe, or supply a real byte count. Guessing is not an option — a wrong enclosure length breaks downloads.`);
  if (!Number.isInteger(duration) || duration <= 0)
    fail(`${full}: cannot determine audio.durationSeconds.`);

  episodes.push({ fm, notes, bytes, duration, file: full });
}

if (!episodes.length) fail(`No published episodes found in ${DIR}.`);

const guids = new Set();
for (const e of episodes) {
  if (guids.has(e.fm.guid)) fail(`Duplicate guid "${e.fm.guid}" (${e.file}).`);
  guids.add(e.fm.guid);
}

episodes.sort((a, b) => new Date(b.fm.published) - new Date(a.fm.published));

// -------------------------------------------------------------------- build

const items = episodes
  .map(({ fm, notes, bytes, duration }) => {
    const url = `${SHOW.siteUrl}/podcast/${fm.slug}`;
    return `    <item>
      <title>${esc(fm.title)}</title>
      <link>${esc(url)}</link>
      <guid isPermaLink="false">${esc(fm.guid)}</guid>
      <pubDate>${rfc2822(fm.published)}</pubDate>
      <description>${cdata(mdToPlain(notes) || fm.summary)}</description>
      <itunes:summary>${esc(fm.summary)}</itunes:summary>
      <itunes:duration>${hms(duration)}</itunes:duration>
      <itunes:explicit>${fm.explicit ? 'true' : 'false'}</itunes:explicit>${
        Number.isInteger(fm.episode) ? `\n      <itunes:episode>${fm.episode}</itunes:episode>` : ''
      }${Number.isInteger(fm.season) ? `\n      <itunes:season>${fm.season}</itunes:season>` : ''}
      <enclosure url="${esc(fm.audio.src)}" length="${bytes}" type="${esc(fm.audio.mimeType ?? 'audio/mpeg')}"/>${
        fm.transcript !== false
          ? `\n      <podcast:transcript url="${esc(`${SHOW.siteUrl}/transcripts/${fm.slug}.vtt`)}" type="text/vtt"/>`
          : ''
      }
    </item>`;
  })
  .join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- generated by scripts/build-podcast-rss.mjs — do not edit -->
<rss version="2.0"
     xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:podcast="https://podcastindex.org/namespace/1.0"
     xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${esc(SHOW.title)}</title>
    <link>${esc(SHOW.siteUrl)}</link>
    <description>${cdata(SHOW.description)}</description>
    <language>${esc(SHOW.language)}</language>
    <copyright>${esc(`© ${new Date(episodes.at(-1).fm.published).getUTCFullYear()} ${SHOW.title}`)}</copyright>
    <lastBuildDate>${rfc2822(episodes[0].fm.published)}</lastBuildDate> <!-- idempotent: newest episode, not wall clock (ADR-0010) -->
    <atom:link href="${esc(SHOW.feedUrl)}" rel="self" type="application/rss+xml"/>
    <itunes:author>${esc(SHOW.author)}</itunes:author>
    <itunes:subtitle>${esc(SHOW.subtitle)}</itunes:subtitle>
    <itunes:summary>${esc(SHOW.description)}</itunes:summary>
    <itunes:type>${esc(SHOW.type)}</itunes:type>
    <itunes:explicit>${SHOW.explicit ? 'true' : 'false'}</itunes:explicit>
    <itunes:image href="${esc(SHOW.image)}"/>
    <itunes:category text="${esc(SHOW.category)}">
      <itunes:category text="${esc(SHOW.subcategory)}"/>
    </itunes:category>
    <itunes:owner>
      <itunes:name>${esc(SHOW.author)}</itunes:name>
      <itunes:email>${esc(SHOW.email)}</itunes:email>
    </itunes:owner>
${items}
  </channel>
</rss>
`;

import { mkdir } from 'node:fs/promises';
await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, xml, 'utf8');
console.log(`build-podcast-rss: wrote ${OUT} with ${episodes.length} episode(s).`);

const publicOut = path.join(process.cwd(), 'public', 'podcast.xml');
if (path.resolve(OUT) !== path.resolve(publicOut)) {
  await mkdir(path.dirname(publicOut), { recursive: true });
  await writeFile(publicOut, xml, 'utf8');
  console.log(`build-podcast-rss: wrote ${publicOut}`);
}
