import site from '../../content/site.json';

/**
 * Resolves an audio URL dynamically:
 *
 * 1. If a valid `audioHost` is defined in `site.json` (not containing 'TODO')
 *    or provided via environment variable `PUBLIC_AUDIO_HOST`:
 *    It ensures the audio file is fetched from the Vercel Blob store.
 *    If `src` is a relative path or local audio URL (or points to the default blob domain),
 *    it prepends the real blob host.
 *
 * 2. If no real `audioHost` is configured yet (still `TODO(luke)`):
 *    It automatically routes to the local `/audio/<filename>` static file.
 *    This ensures that in local development, testing, and staging, audio streaming
 *    works seamlessly without needing an active Vercel Blob token.
 *
 * 3. Once Luke uploads his audio files to Vercel Blob:
 *    All he has to do is update `audioHost` in `content/site.json` (or set `PUBLIC_AUDIO_HOST`).
 *    Every audio player across the entire site will instantly switch to the live Blob URL!
 */
export function resolveAudioUrl(src: string): string {
  if (!src) return '';

  // If it's already an external non-blob URL (e.g. external podcast host), preserve it
  if (/^https?:\/\//i.test(src) && !src.includes('blob.vercel-storage.com')) {
    return src;
  }

  // Extract pure filename (e.g. "ai-thinking-frameworks-narration.mp3")
  const filename = src.split('/').pop()?.split('?')[0] || src;

  // Check if a real audio host is configured in site.json or env
  const envHost = typeof process !== 'undefined' ? process.env.PUBLIC_AUDIO_HOST : undefined;
  const siteHost = site.audioHost && !site.audioHost.includes('TODO') ? site.audioHost : undefined;
  const host = envHost || siteHost;

  if (host) {
    const cleanHost = host.replace(/\/$/, '');
    return `${cleanHost}/audio/${filename}`;
  }

  // Fallback for local development and preview before Blob is configured
  return `/audio/${filename}`;
}

export function getLocalAudioFallback(src: string): string {
  if (!src) return '';
  const filename = src.split('/').pop()?.split('?')[0] || src;
  return `/audio/${filename}`;
}
