#!/usr/bin/env node
/**
 * build-index.mjs — emits public/content-index.json, the keystone every other
 * script and page reads (counts, related posts, tag pages, LinkedIn backlog).
 *
 *   node scripts/build-index.mjs [--content content] [--out public/content-index.json]
 *
 * Idempotent: sorted output, no timestamps. Drafts and sidecars excluded.
 * Requires: node 20+, `npm i yaml`
 */
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
let YAML;
try { YAML = await import('yaml'); } catch {
  const { createRequire } = await import('node:module');
  YAML = createRequire(path.join(process.cwd(), 'package.json'))('yaml');
}
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i !== -1 && args[i + 1] ? args[i + 1] : d; };
const CONTENT = flag('content', 'content');
const OUT = flag('out', 'public/content-index.json');
const URL_PREFIX = { article: '/articles', research: '/research', learning: '/learning', episode: '/podcast' };

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else if (e.name.endsWith('.md') && !e.name.endsWith('.linkedin.md')) out.push(full);
  }
  return out;
}
const words = (s) => (s.match(/\S+/g) ?? []).length;

const items = [];
for (const file of await walk(CONTENT)) {
  const raw = await readFile(file, 'utf8');
  const end = raw.indexOf('\n---', 3);
  if (!raw.startsWith('---') || end === -1) { console.error(`build-index: ${file} has no frontmatter`); process.exit(1); }
  const fm = YAML.parse(raw.slice(3, end)) ?? {};
  if (fm.status !== 'published') continue;
  const body = raw.slice(end + 4);
  const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : d ?? null);
  items.push({
    slug: fm.slug, type: fm.type, title: fm.title, summary: fm.summary,
    url: `${URL_PREFIX[fm.type] ?? ''}/${fm.slug}`,
    published: iso(fm.published), updated: iso(fm.updated),
    lang: fm.lang ?? 'en', tags: fm.tags ?? [], category: fm.category ?? null,
    confidence: fm.confidence ?? null, state: fm.state ?? null, outcome: fm.outcome ?? null,
    readingMinutes: fm.type === 'episode' ? null : Math.max(1, Math.round(words(body) / 220)),
    durationSeconds: fm.audio?.durationSeconds ?? null, episode: fm.episode ?? null,
    related: fm.related ?? [], series: fm.series ?? null, seriesPart: fm.seriesPart ?? null,
    hasAudio: Array.isArray(fm.audio) ? fm.audio.length > 0 : fm.type === 'episode',
    file,
  });
}
items.sort((a, b) => (a.published < b.published ? 1 : a.published > b.published ? -1 : a.slug.localeCompare(b.slug)));
const counts = {};
for (const i of items) { counts[i.type] = (counts[i.type] ?? 0) + 1; for (const t of i.tags) counts[`tag:${t}`] = (counts[`tag:${t}`] ?? 0) + 1; }
await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify({ _generated: 'scripts/build-index.mjs — do not edit', counts, items }, null, 2) + '\n');
console.log(`build-index: wrote ${OUT} with ${items.length} published item(s).`);
