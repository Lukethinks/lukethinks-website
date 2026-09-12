#!/usr/bin/env node
/**
 * self-audit.mjs — looks for drift the fixed validator rules can't catch,
 * because it's statistical / cross-page rather than a single-file check.
 *
 * validate-content.mjs asks "does this file break a known rule?"
 * self-audit.mjs asks "has a pattern emerged that no rule was written for?"
 *
 * Run at the START of a session, before new work, not as a CI gate — it produces
 * observations to feed into references/retro.md, not pass/fail. Exit code is
 * always 0; this never blocks a build.
 *
 *   node scripts/self-audit.mjs [--dist dist] [--content content]
 */
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i !== -1 && args[i + 1] ? args[i + 1] : d; };
const DIST = flag('dist', 'dist');
const CONTENT = flag('content', 'content');

async function walk(dir, exts) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full, exts)));
    else if (exts.some((x) => e.name.endsWith(x))) out.push(full);
  }
  return out;
}

const findings = [];
const note = (title, detail) => findings.push({ title, detail });

// ---- 1. Class names used once anywhere in built HTML ----
// A class that appears in exactly one file is either a genuinely page-specific
// hook (fine) or the first instance of a synonym nobody caught yet (not fine).
// check-register.mjs only catches classes missing from templates entirely —
// this catches classes that ARE registered but are drifting into single use
// when they were meant to be shared.
{
  const htmlFiles = await walk(DIST, ['.html']);
  const countBy = new Map();
  const classesIn = (s) => [...s.matchAll(/class(?:Name)?=["']([^"']*)/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean);
  for (const f of htmlFiles) {
    for (const c of classesIn(await readFile(f, 'utf8'))) {
      if (!countBy.has(c)) countBy.set(c, new Set());
      countBy.get(c).add(f);
    }
  }
  if (htmlFiles.length >= 5) {
    const singles = [...countBy.entries()].filter(([c, files]) => files.size === 1 && !/^(is-|has-)/.test(c));
    if (singles.length) note(
      'Classes used on exactly one page',
      `${singles.length} class(es) appear on only one built page out of ${htmlFiles.length}: ${singles.slice(0, 8).map(([c]) => c).join(', ')}${singles.length > 8 ? '…' : ''}. Worth a look — either it's a legitimate one-off hook, or two pages solving the same problem drifted into different class names.`
    );
  }
}

// ---- 2. Frontmatter fields that appear on some items of a type but not others ----
// The Zod schema catches missing REQUIRED fields. It says nothing about optional
// fields that are creeping toward de-facto required, or ad-hoc fields nobody
// added to the schema.
{
  let YAML;
  try { YAML = await import('yaml'); } catch { note('yaml not installed', 'Cannot inspect frontmatter — run `npm i yaml`.'); }
  if (YAML) {
    const byType = new Map();
    for (const f of await walk(CONTENT, ['.md'])) {
      if (f.endsWith('.linkedin.md')) continue;
      const raw = await readFile(f, 'utf8');
      const end = raw.indexOf('\n---', 3);
      if (!raw.startsWith('---') || end === -1) continue;
      let fm; try { fm = YAML.parse(raw.slice(3, end)) ?? {}; } catch { continue; }
      if (!fm.type) continue;
      if (!byType.has(fm.type)) byType.set(fm.type, []);
      byType.get(fm.type).push({ file: f, keys: new Set(Object.keys(fm)) });
    }
    for (const [type, items] of byType) {
      if (items.length < 3) continue;
      const allKeys = new Set();
      items.forEach((i) => i.keys.forEach((k) => allKeys.add(k)));
      const coverage = [...allKeys].map((k) => [k, items.filter((i) => i.keys.has(k)).length]);
      const partial = coverage.filter(([, n]) => n > 1 && n < items.length);
      if (partial.length) note(
        `Inconsistent fields on type "${type}"`,
        partial.map(([k, n]) => `${k} (${n}/${items.length})`).join(', ') + ` — either this should be in the schema as optional-with-a-default, or the items missing it are actually incomplete.`
      );
    }
  }
}

// ---- 3. Tags used once — candidate synonyms or candidate taxonomy gaps ----
{
  let YAML;
  try { YAML = await import('yaml'); } catch {}
  if (YAML) {
    const tagCount = new Map();
    let taxonomy = new Set();
    try { taxonomy = new Set(JSON.parse(await readFile(path.join(CONTENT, 'taxonomy.json'), 'utf8')).tags.map((t) => t.id)); } catch {}
    for (const f of await walk(CONTENT, ['.md'])) {
      if (f.endsWith('.linkedin.md')) continue;
      const raw = await readFile(f, 'utf8');
      const end = raw.indexOf('\n---', 3);
      if (!raw.startsWith('---') || end === -1) continue;
      let fm; try { fm = (await import('yaml')).parse(raw.slice(3, end)) ?? {}; } catch { continue; }
      for (const t of fm.tags ?? []) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
    }
    const offTaxonomy = [...tagCount.keys()].filter((t) => taxonomy.size && !taxonomy.has(t));
    if (offTaxonomy.length) note(
      'Tags used that are not in taxonomy.json',
      `${offTaxonomy.join(', ')} — the validator should already be erroring on these; if it isn't, check validate-content.mjs's taxonomy check is wired up.`
    );
  }
}

// ---- report ----
if (!findings.length) {
  console.log('self-audit: no drift patterns detected.');
} else {
  console.log(`self-audit: ${findings.length} pattern(s) worth a look. These are observations, not failures.\n`);
  for (const f of findings) console.log(`- ${f.title}\n  ${f.detail}\n`);
  console.log('If a pattern traces to a decision (ADR-000X), add a RETRO entry in references/retro.md per the Retrospective protocol in decisions.md, and act on it before starting new work.');
}
process.exit(0);
