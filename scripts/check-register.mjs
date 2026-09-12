#!/usr/bin/env node
/**
 * check-register.mjs — the class-name drift guard (ADR-0013).
 *
 * The register IS the set of class names used in the golden templates and in
 * src/layouts + src/components. Any class in built HTML that is not in that set
 * is a new class introduced without going through a shared component.
 *
 *   node scripts/check-register.mjs [--dist dist] [--src src] [--templates .agent/lukethinks-web/templates]
 */
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i !== -1 && args[i + 1] ? args[i + 1] : d; };
const DIST = flag('dist', 'dist'), SRC = flag('src', 'src'), TPL = flag('templates', '.agent/lukethinks-web/templates');
const IGNORE = /^(astro-|is-|has-|sr-only$|chartjs-|shiki|github-|line$)/; // Astro scoped hashes, modifiers, vendor

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
const classesIn = (s) => [...s.matchAll(/class(?:Name|:list)?=["'{]([^"'}]*)/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean);

const register = new Set();
for (const f of [...(await walk(TPL, ['.html', '.md'])), ...(await walk(SRC, ['.astro', '.tsx', '.jsx']))])
  for (const c of classesIn(await readFile(f, 'utf8'))) register.add(c);
if (!register.size) { console.error('check-register: no templates or components found — nothing to check against.'); process.exit(2); }

const offenders = new Map();
for (const f of await walk(DIST, ['.html']))
  for (const c of classesIn(await readFile(f, 'utf8')))
    if (!register.has(c) && !IGNORE.test(c)) offenders.set(c, [...(offenders.get(c) ?? []), f]);

if (offenders.size) {
  console.log('Classes used in built pages that are not in any template or component:');
  for (const [c, files] of offenders) console.log(`  .${c}  (${files.length} page(s), e.g. ${files[0]})`);
  console.log('\nAdd the class to a shared component/template, or reuse an existing one.');
  process.exit(1);
}
console.log(`check-register: ${register.size} registered classes, no drift.`);
