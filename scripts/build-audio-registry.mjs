#!/usr/bin/env node
/**
 * build-audio-registry.mjs — Fetches Vercel Blob audio and syncs companion & podcast audio.
 *
 * Runs before `astro build` and `validate-content.mjs`.
 * 1. Pulls the full list of files from Vercel Blob (using BLOB_READ_WRITE_TOKEN).
 * 2. Parses companion audio (`companion/<slug>--<variant>.mp3`) -> `content/data/audio-registry.json`.
 * 3. Auto-matches podcast series files (e.g. Part 2 & Part 3 in Podcasts/) and promotes them to published!
 */

import { writeFile, readFile, mkdir, readdir } from 'node:fs/promises';
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
const EPISODES_DIR = path.join('content', 'episodes');
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

async function getAudioDuration(url, size) {
  try {
    // Range request for m4a/mp4 'mvhd' atom
    const headRes = await fetch(url, { headers: { Range: 'bytes=0-1048576' } });
    const buf = Buffer.from(await headRes.arrayBuffer());
    let mvhdIndex = buf.indexOf(Buffer.from('mvhd'));
    if (mvhdIndex !== -1) {
      const version = buf.readUInt8(mvhdIndex + 4);
      let timescale, duration;
      if (version === 0) {
        timescale = buf.readUInt32BE(mvhdIndex + 16);
        duration = buf.readUInt32BE(mvhdIndex + 20);
      } else {
        timescale = buf.readUInt32BE(mvhdIndex + 24);
        duration = Number(buf.readBigUInt64BE(mvhdIndex + 28));
      }
      return Math.round(duration / timescale);
    }
    // Tail range request if moov is at end
    if (size > 1048576) {
      const tailRes = await fetch(url, { headers: { Range: `bytes=${size - 1048576}-${size - 1}` } });
      const tailBuf = Buffer.from(await tailRes.arrayBuffer());
      const tailMvhd = tailBuf.indexOf(Buffer.from('mvhd'));
      if (tailMvhd !== -1) {
        const version = tailBuf.readUInt8(tailMvhd + 4);
        let timescale, duration;
        if (version === 0) {
          timescale = tailBuf.readUInt32BE(tailMvhd + 16);
          duration = tailBuf.readUInt32BE(tailMvhd + 20);
        } else {
          timescale = tailBuf.readUInt32BE(tailMvhd + 24);
          duration = Number(tailBuf.readBigUInt64BE(tailMvhd + 28));
        }
        return Math.round(duration / timescale);
      }
    }
  } catch (e) {
    console.warn(`Could not read duration from audio header for ${url}:`, e.message);
  }
  return 1800; // fallback 30m
}

async function syncPodcastEpisodes(blobs) {
  if (!existsSync(EPISODES_DIR)) return;

  const episodeFiles = (await readdir(EPISODES_DIR)).filter(f => f.endsWith('.md'));

  // Mapping rules for multi-part series
  const matchers = [
    {
      file: 'why-your-brain-needs-cognitive-friction.md',
      test: (p) => /part[\s-_]*2/i.test(p) || /cognitive-friction/i.test(p),
      partNum: 2,
    },
    {
      file: 'the-ironies-of-automation-and-the-art-of-oversight.md',
      test: (p) => /part[\s-_]*3/i.test(p) || /automation/i.test(p),
      partNum: 3,
    },
  ];

  for (const m of matchers) {
    const filePath = path.join(EPISODES_DIR, m.file);
    if (!existsSync(filePath)) continue;

    const matchedBlob = blobs.find(b => m.test(b.pathname) && (b.pathname.endsWith('.m4a') || b.pathname.endsWith('.mp3')));
    if (!matchedBlob) continue;

    const content = await readFile(filePath, 'utf8');
    if (content.includes('status: "draft"') || content.includes('status: draft')) {
      console.log(`🎙️  Auto-matcher: Found audio in Blob storage for Part ${m.partNum}: ${matchedBlob.pathname}`);
      const durationSeconds = await getAudioDuration(matchedBlob.url, matchedBlob.size);
      const mimeType = matchedBlob.pathname.endsWith('.m4a') ? 'audio/mp4' : 'audio/mpeg';

      let updated = content
        .replace(/status:\s*["']?draft["']?/, 'status: "published"')
        .replace(/src:\s*["'][^"']*["']/, `src: "${matchedBlob.url}"`)
        .replace(/bytes:\s*\d+/, `bytes: ${matchedBlob.size}`)
        .replace(/durationSeconds:\s*\d+/, `durationSeconds: ${durationSeconds}`)
        .replace(/mimeType:\s*["'][^"']*["']/, `mimeType: "${mimeType}"`);

      await writeFile(filePath, updated, 'utf8');
      console.log(`✅  Promoted Part ${m.partNum} to PUBLISHED! (${durationSeconds}s, ${matchedBlob.size} bytes)`);
    }
  }
}

async function run() {
  await mkdir(path.dirname(REGISTRY_PATH), { recursive: true });

  if (!TOKEN || !TOKEN.startsWith('vercel_blob_rw_')) {
    if (!TOKEN) {
      console.warn('\n⚠️  WARNING: BLOB_READ_WRITE_TOKEN is not set in environment.');
    } else {
      console.warn('\n⚠️  WARNING: The provided BLOB_READ_WRITE_TOKEN is invalid.');
      console.warn('⚠️  Vercel Blob tokens always start with "vercel_blob_rw_<storeId>_...".');
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
    // Fetch all blobs in the store
    res = await fetch('https://blob.vercel-storage.com', {
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
  const allBlobs = data.blobs || [];

  // 1. Process companion audio (prefix: companion/)
  const registry = [];
  for (const blob of allBlobs) {
    if (!blob.pathname.startsWith('companion/')) continue;
    const filename = path.basename(blob.pathname, path.extname(blob.pathname));
    const parts = filename.split('--');
    
    if (parts.length !== 2) {
      console.warn(`Skipping unparseable filename in companion Blob: ${blob.pathname}`);
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
  console.log(`✅ build-audio-registry: Synced ${registry.length} companion audio variants to ${REGISTRY_PATH}`);

  // 2. Auto-match podcast episode uploads (Part 2 & Part 3)
  await syncPodcastEpisodes(allBlobs);
}

run().catch(err => {
  console.error('Fatal error in build-audio-registry:', err);
  process.exit(1);
});
