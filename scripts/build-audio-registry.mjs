#!/usr/bin/env node
/**
 * build-audio-registry.mjs — Fetches Vercel Blob audio and creates a local snapshot.
 *
 * This script runs before `astro build` and `validate-content.mjs`.
 * It pulls the list of files from Vercel Blob (requires BLOB_READ_WRITE_TOKEN),
 * parses filenames matching `companion/<slug>--<variant>.mp3`, and writes them
 * to `content/data/audio-registry.json`.
 *
 * If the token is missing, it will warn and write an empty registry, 
 * UNLESS there's an existing registry, in which case it leaves it alone.
 */

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

// Load local .env.local or .env if present (native in Node 20+)
try {
  if (process.loadEnvFile) {
    if (existsSync('.env.local')) process.loadEnvFile('.env.local');
    else if (existsSync('.env')) process.loadEnvFile('.env');
  }
} catch {}

const REGISTRY_PATH = path.join('content', 'data', 'audio-registry.json');
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

async function run() {
  await mkdir(path.dirname(REGISTRY_PATH), { recursive: true });

  if (!TOKEN || !TOKEN.startsWith('vercel_blob_rw_')) {
    if (!TOKEN) {
      console.warn('\n⚠️  WARNING: BLOB_READ_WRITE_TOKEN is not set in environment.');
    } else {
      console.warn('\n⚠️  WARNING: The provided BLOB_READ_WRITE_TOKEN is invalid.');
      console.warn('⚠️  Vercel Blob tokens always start with "vercel_blob_rw_<storeId>_...".');
      console.warn('⚠️  Check Vercel Dashboard -> Storage -> [Your Blob Store] -> Settings -> .env.local to find the token.');
    }
    
    if (existsSync(REGISTRY_PATH)) {
      console.warn(`⚠️  Using existing ${REGISTRY_PATH} snapshot to continue build.\n`);
      return;
    }

    console.warn('⚠️  Creating a fallback audio-registry.json with known audio.\n');
    const fallback = [
      {
        slug: 'ai-partnership-accounting',
        variant: 'narration',
        label: 'Executive Briefing',
        src: 'https://1fyj7adygjho7vgj.public.blob.vercel-storage.com/Podcasts/ai-thinking-frameworks-narration.mp3',
        bytes: 2310182,
        durationSeconds: 255,
        production: { source: 'notebooklm', aiDisclosed: true }
      },
      {
        slug: 'ai-partnership-accounting',
        variant: 'debate',
        label: 'Deep Debate: Bear vs Bull',
        src: 'https://1fyj7adygjho7vgj.public.blob.vercel-storage.com/Podcasts/compress-ai-thinking-frameworks-narration_debate.mp3',
        bytes: 22378715,
        durationSeconds: 920,
        production: { source: 'notebooklm', aiDisclosed: true }
      }
    ];
    await writeFile(REGISTRY_PATH, JSON.stringify(fallback, null, 2), 'utf8');
    return;
  }

  console.log('Fetching audio list from Vercel Blob...');
  let res;
  try {
    res = await fetch('https://blob.vercel-storage.com?prefix=companion/', {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
  } catch (err) {
    console.warn(`⚠️  Network error fetching from Vercel Blob: ${err.message}`);
    if (existsSync(REGISTRY_PATH)) {
      console.warn(`⚠️  Falling back to cached ${REGISTRY_PATH}.\n`);
      return;
    }
  }

  if (!res || !res.ok) {
    const text = res ? await res.text() : '';
    console.warn(`⚠️  Vercel Blob API returned ${res?.status} ${res?.statusText}: ${text}`);
    if (existsSync(REGISTRY_PATH)) {
      console.warn(`⚠️  Falling back to cached ${REGISTRY_PATH} so the build succeeds.\n`);
      return;
    }
    console.error('Fatal: No audio registry exists and Blob fetch failed.');
    process.exit(1);
  }

  const data = await res.json();
  const registry = [];

  for (const blob of data.blobs || []) {
    const filename = path.basename(blob.pathname, '.mp3');
    const parts = filename.split('--');
    
    if (parts.length !== 2) {
      console.warn(`Skipping unparseable filename in Blob: ${blob.pathname}`);
      continue;
    }

    const [slug, variant] = parts;

    let label = variant === 'narration' ? 'Executive Briefing' : 
                variant === 'debate' ? 'Deep Debate: Bear vs Bull' : 
                'Companion Audio';

    registry.push({
      slug,
      variant,
      label,
      src: blob.url,
      bytes: blob.size,
      durationSeconds: 0,
      production: {
        source: 'notebooklm',
        aiDisclosed: true
      }
    });
  }

  await writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf8');
  console.log(`✅ build-audio-registry: Saved ${registry.length} audio variants to ${REGISTRY_PATH}`);
}

run().catch(err => {
  console.error('Fatal error in build-audio-registry:', err);
  process.exit(1);
});
