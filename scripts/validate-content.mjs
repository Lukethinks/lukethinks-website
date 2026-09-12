#!/usr/bin/env node
/**
 * validate-content.mjs — the drift guard for lukethinks.nl
 *
 * Checks content files and (optionally) built HTML against the contracts in the
 * lukethinks-web skill. Exits non-zero on any error so CI can block the merge.
 *
 *   node scripts/validate-content.mjs
 *   node scripts/validate-content.mjs --content content --html . --strict
 *
 * --strict promotes warnings to errors.
 *
 * Requires: node 20+, `npm i yaml`
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

// Resolve `yaml` from the project root so the script can live anywhere.
let YAML;
try {
  YAML = await import('yaml');
} catch {
  try {
    const { createRequire } = await import('node:module');
    const require = createRequire(path.join(process.cwd(), 'package.json'));
    YAML = require('yaml');
  } catch {
    console.error('Missing dependency. Run:  npm install yaml');
    process.exit(2);
  }
}

// ---------------------------------------------------------------- config

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const CONTENT_DIR = flag('content', 'content');
const HTML_DIR = flag('html', existsSync(path.join('dist', 'client')) ? path.join('dist', 'client') : 'dist');           // built output, not source
const PUBLIC_DIR = flag('public', 'public');
const STRICT = args.includes('--strict');

const VALID_TYPES = ['article', 'research', 'learning', 'episode'];
const VALID_STATUS = ['draft', 'published', 'archived'];
const REQUIRED_CORE = ['title', 'slug', 'type', 'summary', 'published', 'status'];
// legacy/ is read-only source material (ADR-0002) and is never validated.
const SKIP_DIRS = new Set(['node_modules', '.git', '.astro', '.vercel', 'legacy', 'templates']);

// Field-shape validation is Zod's job (src/content.config.ts, ADR-0012).
// This script checks only what Zod cannot see: cross-file references, taxonomy,
// slug/filename agreement, duplicate GUIDs, TODO(luke) placeholders, and built HTML.

const problems = [];
const err = (file, msg) => problems.push({ level: 'error', file, msg });
const warn = (file, msg) => problems.push({ level: STRICT ? 'error' : 'warn', file, msg });

// ---------------------------------------------------------------- helpers

async function walk(dir, exts) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full, exts)));
    else if (exts.some((x) => e.name.endsWith(x))) out.push(full);
  }
  return out;
}

function parseFrontmatter(raw, file) {
  if (!raw.startsWith('---')) {
    err(file, 'No YAML frontmatter block. Every content file starts with ---.');
    return null;
  }
  const end = raw.indexOf('\n---', 3);
  if (end === -1) {
    err(file, 'Frontmatter block is not closed with ---.');
    return null;
  }
  try {
    return YAML.parse(raw.slice(3, end)) ?? {};
  } catch (e) {
    err(file, `Frontmatter is not valid YAML: ${e.message}`);
    return null;
  }
}

const isIsoDate = (v) =>
  v instanceof Date || /^\d{4}-\d{2}-\d{2}$/.test(String(v));

// ---------------------------------------------------------------- taxonomy

let allowedTags = null;
const taxonomyPath = path.join(CONTENT_DIR, 'taxonomy.json');
if (existsSync(taxonomyPath)) {
  try {
    const tax = JSON.parse(await readFile(taxonomyPath, 'utf8'));
    allowedTags = new Set((tax.tags ?? []).map((t) => t.id));
  } catch (e) {
    err(taxonomyPath, `Could not parse taxonomy: ${e.message}`);
  }
} else {
  warn(taxonomyPath, 'No taxonomy.json — tags cannot be validated and will drift.');
}

// ---------------------------------------------------------------- site facts
let audioHost = null;
for (const name of ['site.json', 'podcast.json']) {
  const p = path.join(CONTENT_DIR, name);
  if (!existsSync(p)) { err(p, `Missing ${name} — copy it from the skill's starter/ directory.`); continue; }
  try {
    const j = JSON.parse(await readFile(p, 'utf8'));
    const todos = Object.entries(j).filter(([, v]) => typeof v === 'string' && v.includes('TODO(luke)'));
    for (const [k] of todos) warn(p, `${k} is still TODO(luke). Building is fine; publishing the podcast feed is not.`);
    if (name === 'site.json' && typeof j.audioHost === 'string' && !j.audioHost.includes('TODO')) audioHost = j.audioHost;
  } catch (e) { err(p, `Not valid JSON: ${e.message}`); }
}

// ---------------------------------------------------------------- content

const contentFiles = await walk(CONTENT_DIR, ['.md']);
const seenSlugs = new Map();
const seenGuids = new Map();
const publishedSlugs = new Set();
const relatedRefs = [];

for (const file of contentFiles) {
  if (file.endsWith('.linkedin.md')) continue; // sidecars are not site content
  const raw = await readFile(file, 'utf8');
  const fm = parseFrontmatter(raw, file);
  if (!fm) continue;

  for (const key of REQUIRED_CORE) {
    if (fm[key] === undefined || fm[key] === null || fm[key] === '')
      err(file, `Missing required field: ${key}`);
  }

  if (fm.type && !VALID_TYPES.includes(fm.type))
    err(file, `Unknown type "${fm.type}". Expected one of: ${VALID_TYPES.join(', ')}`);
  if (fm.status && !VALID_STATUS.includes(fm.status))
    err(file, `Unknown status "${fm.status}".`);
  if (fm.published && !isIsoDate(fm.published))
    err(file, `published must be an ISO date (YYYY-MM-DD), got "${fm.published}".`);
  if (fm.updated && !isIsoDate(fm.updated))
    err(file, `updated must be an ISO date (YYYY-MM-DD), got "${fm.updated}".`);

  // slug must match the filename, and must be permanent
  const base = path.basename(file, '.md');
  if (fm.slug && fm.slug !== base)
    err(file, `slug "${fm.slug}" does not match filename "${base}". They must agree.`);
  if (fm.slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(fm.slug))
    err(file, `slug "${fm.slug}" must be lowercase kebab-case.`);
  if (fm.slug) {
    if (seenSlugs.has(fm.slug))
      err(file, `Duplicate slug "${fm.slug}" — also in ${seenSlugs.get(fm.slug)}.`);
    seenSlugs.set(fm.slug, file);
    if (fm.status === 'published') publishedSlugs.add(fm.slug);
  }

  // tags
  if (allowedTags) {
    for (const t of fm.tags ?? []) {
      if (!allowedTags.has(t))
        err(file, `Tag "${t}" is not in taxonomy.json. Add it there deliberately, or reuse an existing tag.`);
    }
  }
  if (!(fm.tags ?? []).length) warn(file, 'No tags — this item will not appear on any tag page.');

  // placeholder metadata is worse than missing metadata
  if (/TODO\(luke\)/.test(raw.slice(0, raw.indexOf('\n---', 3))))
    warn(file, 'Frontmatter still contains TODO(luke) — resolve before publishing.');

  for (const r of fm.related ?? []) relatedRefs.push({ file, slug: r });

  // ---- episode-specific
  if (fm.type === 'episode') {
    const a = fm.audio ?? {};
    if (!a.src) err(file, 'Episode has no audio.src.');
    else if (!/^https:\/\//.test(a.src))
      err(file, 'audio.src must be an absolute https URL — podcast clients cannot resolve relative paths.');
    else if (audioHost && !a.src.startsWith(audioHost))
      err(file, `audio.src must live on the Vercel Blob store (${audioHost}) — see ADR-0005.`);
    if (!Number.isInteger(a.bytes) || a.bytes <= 0)
      err(file, 'audio.bytes must be the real file size in bytes (computed, never typed).');
    if (!Number.isInteger(a.durationSeconds) || a.durationSeconds <= 0)
      err(file, 'audio.durationSeconds must be computed from the file.');
    if (!fm.guid) err(file, 'Episode has no guid. It must be permanent and unique.');
    else {
      if (seenGuids.has(fm.guid))
        err(file, `Duplicate guid "${fm.guid}" — also in ${seenGuids.get(fm.guid)}. Clients would collapse these into one episode.`);
      seenGuids.set(fm.guid, file);
    }
    if (!Number.isInteger(fm.episode)) warn(file, 'No episode number.');
    if (fm.transcript === false) warn(file, 'No transcript — the episode is inaccessible and invisible to search.');
    else {
      const vtt = path.join(PUBLIC_DIR, 'transcripts', `${fm.slug}.vtt`);
      if (!existsSync(vtt)) err(file, `Transcript expected at ${vtt} (ADR-0011). Add it, or set transcript: false.`);
    }
    if (fm.production?.source && fm.production.source !== 'human' && fm.production.aiDisclosed !== true)
      err(file, 'AI-produced audio must set production.aiDisclosed: true and state it on the page.');
  }

  // ---- companion audio on articles/learnings
  if (fm.type !== 'episode' && fm.audio) {
    if (!Array.isArray(fm.audio))
      err(file, 'Companion audio must be an array, even for a single file — variants multiply.');
    else
      fm.audio.forEach((a, i) => {
        if (!a.src) err(file, `audio[${i}] has no src.`);
        if (!a.label) warn(file, `audio[${i}] has no label — two unlabelled players are indistinguishable to a screen reader.`);
        if (a.production?.source && a.production.source !== 'human' && a.production.aiDisclosed !== true)
          err(file, `audio[${i}] is AI-produced but not disclosed.`);
      });
  }

  // ---- learning-specific
  if (fm.type === 'learning') {
    if (fm.format === 'experiment' && !fm.hypothesis)
      err(file, 'An experiment needs a hypothesis. Without it the outcome means nothing.');
    if (!fm.state) warn(file, 'No state (in-progress | concluded | abandoned) — the index cannot show live work.');
  }
}

for (const { file, slug } of relatedRefs) {
  if (!seenSlugs.has(slug)) err(file, `related references unknown slug "${slug}".`);
  else if (!publishedSlugs.has(slug)) warn(file, `related points at "${slug}", which is not published.`);
}

// ---------------------------------------------------------------- html

const htmlFiles = existsSync(HTML_DIR) ? await walk(HTML_DIR, ['.html']) : [];
if (!htmlFiles.length) warn(HTML_DIR, 'No built HTML found — run `astro build` first, then validate, to check the pages themselves.');

for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, '');
  const body = strip(html);

  const h1s = [...body.matchAll(/<h1\b([^>]*)>/gi)];
  if (h1s.length === 0) err(file, 'No <h1>.');
  if (h1s.length > 1) err(file, `${h1s.length} <h1> elements — a page has exactly one.`);
  if (h1s.length === 1 && /class="[^"]*\bsr-only\b/.test(h1s[0][1]))
    err(file, 'The <h1> is visually hidden. Write one honest visible title instead of splitting the outline.');

  if (!/<main\b/i.test(body)) err(file, 'No <main> landmark.');
  if (!/<html[^>]+lang=/i.test(body)) err(file, 'No lang attribute on <html>.');
  if (!/<link[^>]+rel=["']canonical/i.test(body)) warn(file, 'No canonical link.');
  if (!/<meta[^>]+name=["']description/i.test(body)) warn(file, 'No meta description.');
  if (!/<meta[^>]+name=["']viewport/i.test(body)) err(file, 'No viewport meta — the page will not be mobile-usable.');

  // heading order
  const levels = [...body.matchAll(/<h([1-6])\b/gi)].map((m) => Number(m[1]));
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] - levels[i - 1] > 1) {
      warn(file, `Heading level jumps from h${levels[i - 1]} to h${levels[i]} — levels descend one at a time.`);
      break;
    }
  }

  // images
  for (const m of body.matchAll(/<img\b[^>]*>/gi)) {
    if (!/\salt=/i.test(m[0])) err(file, `<img> without alt: ${m[0].slice(0, 90)}`);
  }

  // structural regressions this site is specifically prone to
  if (/<\/head>\s*<script/i.test(html))
    err(file, '<script> sits between </head> and <body>. Move it into the head or before </body>.');
  const inlineStyles = [...body.matchAll(/\sstyle="/g)].length;
  if (inlineStyles) warn(file, `${inlineStyles} inline style attribute(s) — move to src/styles/site.css.`);

  // audio
  const audios = [...body.matchAll(/<audio\b[^>]*>/gi)];
  if (audios.length > 1) {
    const labelled = audios.filter((a) => /aria-label(ledby)?=/i.test(a[0])).length;
    if (labelled < audios.length)
      err(file, `${audios.length} players but only ${labelled} labelled — identical players are indistinguishable to a screen reader.`);
  }
  for (const a of audios) {
    if (!/preload=/i.test(a[0]))
      warn(file, '<audio> without preload="none" — the page will fetch audio before anyone presses play.');
  }

  // modifier convention (ADR-0009)
  if (/class="[^"]*(?<!is-)\bactive\b/.test(body))
    warn(file, 'Legacy `.active` modifier — use `.is-active` (ADR-0009).');

  // nav labelling
  const navs = [...body.matchAll(/<nav\b[^>]*>/gi)];
  if (navs.length > 1 && navs.some((n) => !/aria-label/i.test(n[0])))
    warn(file, 'Multiple <nav> elements, not all labelled with aria-label.');

  // internal links
  for (const m of body.matchAll(/href="(\/[^"#?]*)["#?]/g)) {
    const target = m[1];
    if (target.startsWith('//') || target.startsWith('/_')) continue;
    const candidates = [
      path.join(HTML_DIR, target),
      path.join(HTML_DIR, target, 'index.html'),
      path.join(HTML_DIR, `${target}.html`),
      path.join(PUBLIC_DIR, target),
    ];
    if (/\.html$/.test(target)) warn(file, `Internal link uses .html — URLs are extensionless (ADR-0006): ${target}`);
    if (target !== '/' && !candidates.some((c) => existsSync(c)))
      warn(file, `Internal link may be broken: ${target}`);
  }
}

// ---------------------------------------------------------------- report

const errors = problems.filter((p) => p.level === 'error');
const warns = problems.filter((p) => p.level === 'warn');

const byFile = new Map();
for (const p of problems) {
  if (!byFile.has(p.file)) byFile.set(p.file, []);
  byFile.get(p.file).push(p);
}
for (const [file, list] of byFile) {
  console.log(`\n${file}`);
  for (const p of list) console.log(`  ${p.level === 'error' ? 'ERROR' : 'warn '}  ${p.msg}`);
}

console.log(
  `\nChecked ${contentFiles.length} content file(s) and ${htmlFiles.length} HTML file(s).` +
    `\n${errors.length} error(s), ${warns.length} warning(s).`
);

if (errors.length) {
  console.log('\nNothing ships while errors remain.');
  process.exit(1);
}
process.exit(0);
