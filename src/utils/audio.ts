import site from '../../content/site.json';

/**
 * Resolves an audio URL dynamically:
 *
 * 1. If `src` is already an absolute URL (any https:// origin, including Vercel Blob),
 *    return it unchanged. The frontmatter is the source of truth for the full path —
 *    including any subfolder inside the Blob store (e.g. /Podcasts/ vs /audio/).
 *    Rewriting a fully-qualified Blob URL here would strip the subfolder and produce a 404.
 *
 * 2. If `src` is a relative path and `audioHost` is configured in `site.json`
 *    (or via the `PUBLIC_AUDIO_HOST` env var), prepend the Blob host.
 *    This is the escape hatch for future content where the author writes a bare
 *    filename in frontmatter rather than a full URL.
 *
 * 3. Fallback for local development (audioHost still TODO or src is relative):
 *    Routes to /audio/<filename> which is served from public/audio/ (gitignored).
 */
export function resolveAudioUrl(src: string): string {
  if (!src) return '';

  // Rule 1: absolute URL — trust it completely, return as-is
  // This preserves the exact Blob path (including subfolders like /Podcasts/)
  // that was set in the episode frontmatter.
  if (/^https?:\/\//i.test(src)) {
    return src;
  }

  // Rule 2: relative path + a real audioHost is configured → prepend host
  const envHost = typeof process !== 'undefined' ? process.env.PUBLIC_AUDIO_HOST : undefined;
  const siteHost = site.audioHost && !site.audioHost.includes('TODO') ? site.audioHost : undefined;
  const host = envHost || siteHost;

  if (host) {
    const cleanHost = host.replace(/\/$/, '');
    // If src already looks like a path (starts with /), join directly
    const cleanSrc = src.startsWith('/') ? src : `/audio/${src}`;
    return `${cleanHost}${cleanSrc}`;
  }

  // Rule 3: local development fallback → /audio/<filename>
  const filename = src.split('/').pop()?.split('?')[0] || src;
  return `/audio/${filename}`;
}

export function getLocalAudioFallback(src: string): string {
  if (!src) return '';
  const filename = src.split('/').pop()?.split('?')[0] || src;
  return `/audio/${filename}`;
}
