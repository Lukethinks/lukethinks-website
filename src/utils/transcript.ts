// src/utils/transcript.ts — turns public/transcripts/<slug>.vtt (ADR-0011) into readable
// paragraphs for the episode page. Returns null when no transcript file exists, so a page
// never promises a transcript it does not have.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function readTranscript(slug: string): string[] | null {
  const file = join(process.cwd(), 'public', 'transcripts', `${slug}.vtt`);
  if (!existsSync(file)) return null;

  const paragraphs: string[] = [];
  const blocks = readFileSync(file, 'utf8').replace(/\r/g, '').split(/\n{2,}/);

  for (const block of blocks) {
    const lines = block.split('\n');
    if (/^(WEBVTT|NOTE|STYLE|REGION)/.test(lines[0])) continue;

    const at = lines.findIndex((l) => l.includes('-->'));
    if (at === -1) continue;

    const raw = lines.slice(at + 1).join(' ');
    const startsSpeaker = /^<v\s+[^>]+>/.test(raw);
    const text = raw
      .replace(/<v\s+([^>]+)>/g, '$1: ')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) continue;

    if (startsSpeaker || paragraphs.length === 0) paragraphs.push(text);
    else paragraphs[paragraphs.length - 1] += ` ${text}`;
  }

  return paragraphs.length > 0 ? paragraphs : null;
}
