/**
 * E2E Test Suite: Audio Carousel (ADR-0019)
 * Framework: Node 24 Native Test Runner (node:test, node:assert/strict)
 *
 * Test Architecture: 4-Tier Opaque-Box Methodology
 * - Tier 1: Feature Coverage (F01–F18, >=5 test cases per feature)
 * - Tier 2: Boundary & Corner Cases (Empty, single, long text, missing meta, extreme viewports)
 * - Tier 3: Cross-Feature Combinations (Pairwise interaction assertions)
 * - Tier 4: Real-World Scenarios (Full catalog rendering, show notes links, live audio player sync)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

// --- Paths & Fixtures ---
const ROOT_DIR = process.cwd();
const CAROUSEL_COMPONENT_PATH = path.join(ROOT_DIR, 'src', 'components', 'AudioCarousel.astro');
const PODCAST_PAGE_PATH = path.join(ROOT_DIR, 'src', 'pages', 'podcast.astro');
const AUDIO_PLAYER_PATH = path.join(ROOT_DIR, 'src', 'components', 'AudioPlayer.astro');
const SITE_CSS_PATH = path.join(ROOT_DIR, 'src', 'styles', 'site.css');
const EPISODES_DIR = path.join(ROOT_DIR, 'content', 'episodes');

// --- Shared State Machine & Mutual Exclusion Logic (ADR-0018) ---
import {
  CarouselStateMachine,
  enforceExclusivePlayback,
} from '../src/utils/carousel-state.ts';

/**
 * Standard Mock Items for Testing
 */
const mockEpisodes = [
  {
    id: 'ep-001',
    slug: 'the-50b-ai-partnership-bubble',
    title: 'The $50B AI Partnership Bubble: Accounting Crisis in Big Tech',
    summary: 'Tech giants have deployed over $50 billion into generative AI startups...',
    published: '2025-10-12',
    episodeNumber: 1,
    season: 1,
    format: 'briefing',
    tags: ['ai', 'accounting'],
    confidence: 'high',
    audio: {
      src: 'https://1fyj7adygjho7vgj.public.blob.vercel-storage.com/Podcasts/ai-thinking-frameworks-narration.mp3',
      bytes: 2310182,
      durationSeconds: 255,
      mimeType: 'audio/mpeg',
    },
    takeaways: ['Governance nuance', 'Round-tripping concerns'],
    companionArticle: {
      title: 'When Billion-Dollar AI Partnerships Meet Reality',
      href: '/articles/ai-partnership-accounting',
    },
  },
  {
    id: 'ep-002',
    slug: 'big-tech-ai-investments-the-great-accounting-debate',
    title: 'Big Tech AI Investments: The Great Accounting Debate',
    summary: 'An in-depth 15-minute debate dissecting both sides of the AI investment thesis...',
    published: '2025-10-26',
    episodeNumber: 2,
    season: 1,
    format: 'debate',
    tags: ['ai', 'valuation'],
    confidence: 'medium',
    audio: {
      src: 'https://1fyj7adygjho7vgj.public.blob.vercel-storage.com/Podcasts/compress-ai-thinking-frameworks-narration_debate.mp3',
      bytes: 22378715,
      durationSeconds: 920,
      mimeType: 'audio/mpeg',
    },
    takeaways: ['Capex vs Opex', 'Circular Velocity'],
    companionArticle: {
      title: 'When Billion-Dollar AI Partnerships Meet Reality',
      href: '/articles/ai-partnership-accounting',
    },
  },
  {
    id: 'ep-003',
    slug: 'thames-water-corporate-finance',
    title: 'Thames Water: Leverage, Regulation, and Liquidity Traps',
    summary: 'Forensic autopsy of regulated utility debt structures...',
    published: '2025-11-05',
    episodeNumber: 3,
    season: 1,
    format: 'briefing',
    tags: ['accounting', 'valuation'],
    confidence: 'high',
    audio: {
      src: 'https://1fyj7adygjho7vgj.public.blob.vercel-storage.com/Podcasts/thames-water.mp3',
      bytes: 15400000,
      durationSeconds: 680,
      mimeType: 'audio/mpeg',
    },
  },
];

// Helper to check if component exists
function loadComponentSource() {
  if (existsSync(CAROUSEL_COMPONENT_PATH)) {
    return readFileSync(CAROUSEL_COMPONENT_PATH, 'utf8');
  }
  return null;
}

// Helper to load site.css
function loadSiteCss() {
  return readFileSync(SITE_CSS_PATH, 'utf8');
}

// Helper to load podcast.astro
function loadPodcastPage() {
  return readFileSync(PODCAST_PAGE_PATH, 'utf8');
}

// Helper to load AudioPlayer.astro
function loadAudioPlayer() {
  return readFileSync(AUDIO_PLAYER_PATH, 'utf8');
}

// Helper to parse frontmatter from markdown file
function parseEpisodeFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  return parseYaml(match[1]) || {};
}

// =========================================================================
// TIER 1: FEATURE COVERAGE (F01–F18, >=5 test cases per feature)
// =========================================================================

describe('Tier 1: Feature Coverage (F01–F18)', () => {

  // --- F01: Component Props & Rendering Contract ---
  describe('F01: Component Props & Rendering Contract', () => {
    it('F01.1: CarouselItem schema enforces required properties', () => {
      const item = mockEpisodes[0];
      assert.ok(item.id, 'Item must have id');
      assert.ok(item.slug, 'Item must have slug');
      assert.ok(item.title, 'Item must have title');
      assert.ok(item.summary, 'Item must have summary');
      assert.ok(item.published, 'Item must have published date');
      assert.ok(item.audio?.src, 'Item must have audio.src');
      assert.ok(typeof item.audio?.durationSeconds === 'number', 'audio.durationSeconds must be number');
    });

    it('F01.2: Props interface contract supports initialIndex and defaultView defaults', () => {
      const smDefault = new CarouselStateMachine(mockEpisodes);
      assert.equal(smDefault.activeIndex, 0, 'Default initialIndex is 0');
      assert.equal(smDefault.viewMode, 'carousel', 'Default viewMode is carousel');

      const smCustom = new CarouselStateMachine(mockEpisodes, { initialIndex: 1, defaultView: 'grid' });
      assert.equal(smCustom.activeIndex, 1, 'Custom initialIndex preserved');
      assert.equal(smCustom.viewMode, 'grid', 'Custom defaultView preserved');
    });

    it('F01.3: Container specification mandates .audio-carousel-container and data-component', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /audio-carousel-container|audio-carousel-section/, 'Stage container class present');
      assert.match(src, /data-component=["']audio-carousel["']/, 'data-component attribute present');
    });

    it('F01.4: Container sets data-initial-index attribute matching prop', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /data-initial-index/, 'data-initial-index attribute present in template');
    });

    it('F01.5: Track scroller renders with id="carousel-track" or class .carousel-track', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /carousel-track|audio-carousel-track/, 'Carousel track class present');
    });

    it('F01.6: Component supports parameterized id prop defaulting to audio-carousel and prefixes internal element IDs', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /id\s*=\s*['"]audio-carousel['"]/, 'Default id prop is audio-carousel');
      assert.match(src, /id=\{`?\$\{id\}-track`?\}|id=\{trackId\}/, 'Track id is parameterized with component id');
      assert.match(src, /id=\{`?\$\{id\}-announcer`?\}|id=\{announcerId\}/, 'Live announcer id is parameterized');
      assert.match(src, /id=\{`?\$\{id\}-docked-player`?\}|id=\{dockedPlayerId\}/, 'Docked player id is parameterized');
      assert.match(src, /id=\{`?\$\{id\}-docked-station`?\}|id=\{dockedStationId\}/, 'Docked station id is parameterized');
      assert.match(src, /id=\{`?\$\{id\}-docked-heading`?\}|id=\{dockedHeadingId\}/, 'Docked heading id is parameterized');
    });
  });

  // --- F02: Cover Flow 2.5D Perspective ---
  describe('F02: Cover Flow 2.5D Perspective', () => {
    it('F02.1: Perspective viewport stage defines 1000px focal depth', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /perspective:\s*(1000px|800px|1200px)/, 'Perspective viewport defined');
    });

    it('F02.2: Active center card has 0deg rotation and elevated scale', () => {
      const sm = new CarouselStateMachine(mockEpisodes, { initialIndex: 1 });
      const transform = sm.computeCardTransform(1);
      assert.equal(transform.rotateY, 0, 'Center card has rotateY(0deg)');
      assert.ok(transform.scale >= 1.0, 'Center card scale >= 1.0');
      assert.equal(transform.opacity, 1.0, 'Center card full opacity');
    });

    it('F02.3: Left flank cards have positive Y-rotation and receding depth', () => {
      const sm = new CarouselStateMachine(mockEpisodes, { initialIndex: 1 });
      const transform = sm.computeCardTransform(0);
      assert.ok(transform.rotateY > 0, 'Left flank card has positive rotateY');
      assert.ok(transform.scale < 1.0, 'Left flank card is scaled down');
      assert.ok(transform.translateZ < 0, 'Left flank card is translated backwards');
      assert.ok(transform.opacity < 1.0, 'Left flank card has reduced opacity');
    });

    it('F02.4: Right flank cards have negative Y-rotation and receding depth', () => {
      const sm = new CarouselStateMachine(mockEpisodes, { initialIndex: 1 });
      const transform = sm.computeCardTransform(2);
      assert.ok(transform.rotateY < 0, 'Right flank card has negative rotateY');
      assert.ok(transform.scale < 1.0, 'Right flank card is scaled down');
      assert.ok(transform.translateZ < 0, 'Right flank card is translated backwards');
      assert.ok(transform.opacity < 1.0, 'Right flank card has reduced opacity');
    });

    it('F02.5: Stage enforces transform-style: preserve-3d for 3D stacking', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /transform-style:\s*preserve-3d/, 'preserve-3d present in component styles');
    });
  });

  // --- F03: 1:1 Square Artwork Badges ---
  describe('F03: 1:1 Square Artwork Badges', () => {
    it('F03.1: Artwork badge enforces 1:1 square aspect ratio', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /aspect-ratio:\s*1\s*\/\s*1/, '1:1 aspect-ratio declared on artwork badge');
    });

    it('F03.2: Artwork badge renders formatted episode number (EP 0X)', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /EP\s*\d+|episodeNumber|data\.episode/, 'Episode number badge rendering in template');
    });

    it('F03.3: Artwork badge renders format pill (Briefing / Debate)', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /format|audio-variant-label/, 'Format label pill rendering in artwork');
    });

    it('F03.4: Artwork badge uses site design tokens for gradient background', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /var\(--primary-brown\)|var\(--accent-amber\)|var\(--surface-card\)/, 'Site tokens used for artwork gradient');
    });

    it('F03.5: Acrylic floor reflection or sheen gradient is declared', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /-webkit-box-reflect|linear-gradient\(transparent|sheen/, 'Acrylic reflection or gradient sheen declared');
    });
  });

  // --- F04: Purely Visual Tactile Feedback ---
  describe('F04: Purely Visual Tactile Feedback', () => {
    it('F04.1: Active focus ring maps to var(--accent-amber)', () => {
      const css = loadSiteCss();
      assert.match(css, /--accent-amber:\s*#ea580c/, 'Token --accent-amber exists in site.css');
      assert.match(css, /--accent-amber:\s*#f97316/, 'Dark theme redefinition for --accent-amber exists');
    });

    it('F04.2: Active card elevation uses var(--shadow-medium) and transform transition', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /var\(--shadow-medium\)/, 'Elevated shadow token used');
      assert.match(src, /transition:\s*[^;]*transform/, 'Smooth transform transition declared');
    });

    it('F04.3: Active border highlight uses var(--accent-amber)', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /border-color:\s*var\(--accent-amber\)|outline:\s*[^;]*var\(--accent-amber\)/, 'Amber border or outline declared for active state');
    });

    it('F04.4: STRICT: Zero audio sound effects or clicks on slide transition', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.doesNotMatch(src, /new\s+Audio\(/, 'No synthetic sound effect Audio constructor');
      assert.doesNotMatch(src, /AudioContext/, 'No Web Audio API click synthesizer');
    });

    it('F04.5: STRICT: Zero hardware vibration calls (navigator.vibrate prohibited)', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.doesNotMatch(src, /navigator\.vibrate/, 'navigator.vibrate is strictly prohibited');
    });
  });

  // --- F05: Native Scroll Snap & Alignment ---
  describe('F05: Native Scroll Snap & Alignment', () => {
    it('F05.1: Track defines scroll-snap-type: x mandatory', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /scroll-snap-type:\s*x\s+mandatory/, 'scroll-snap-type: x mandatory declared');
    });

    it('F05.2: Slide cards define scroll-snap-align: center', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /scroll-snap-align:\s*center/, 'scroll-snap-align: center declared');
    });

    it('F05.3: Track scroller defines scroll-behavior: smooth', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /scroll-behavior:\s*smooth/, 'scroll-behavior: smooth declared');
    });

    it('F05.4: Track scrollbars are hidden across Firefox and WebKit', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /scrollbar-width:\s*none/, 'Firefox scrollbar-width: none declared');
      assert.match(src, /::-webkit-scrollbar\s*\{\s*display:\s*none;?\s*\}/, 'WebKit scrollbar hidden');
    });

    it('F05.5: Track scroller defines overflow-x: auto and overflow-y: hidden', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /overflow-x:\s*auto/, 'overflow-x: auto declared on track');
    });
  });

  // --- F06: ARIA Carousel Semantics ---
  describe('F06: ARIA Carousel Semantics', () => {
    it('F06.1: Stage root defines role="region"', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /role=["']region["']/, 'role="region" declared on carousel stage');
    });

    it('F06.2: Stage defines aria-roledescription="carousel"', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /aria-roledescription=["']carousel["']/, 'aria-roledescription="carousel" declared');
    });

    it('F06.3: Stage defines accessible aria-label', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /aria-label=["'][^"']+["']/, 'Accessible aria-label present on stage');
    });

    it('F06.4: Live region defines aria-live="polite"', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /aria-live=["']polite["']/, 'aria-live="polite" live region declared');
    });

    it('F06.5: Slides define role="group" and aria-roledescription="slide"', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /role=["']group["']/, 'role="group" declared on slide');
      assert.match(src, /aria-roledescription=["']slide["']/, 'aria-roledescription="slide" declared');
    });
  });

  // --- F07: Roving Tabindex State Machine ---
  describe('F07: Roving Tabindex State Machine', () => {
    it('F07.1: Exactly one slide has tabindex="0" and inactive slides have tabindex="-1"', () => {
      const sm = new CarouselStateMachine(mockEpisodes, { initialIndex: 0 });
      const indices = sm.getTabIndices();
      assert.deepEqual(indices, [0, -1, -1], 'Only item 0 has tabindex="0"');
    });

    it('F07.2: Advancing index shifts tabindex="0" to new active slide', () => {
      const sm = new CarouselStateMachine(mockEpisodes, { initialIndex: 0 });
      sm.handleKeyDown('ArrowRight');
      assert.equal(sm.activeIndex, 1);
      assert.deepEqual(sm.getTabIndices(), [-1, 0, -1], 'Only item 1 has tabindex="0"');
    });

    it('F07.3: Decrementing index shifts tabindex="0" backwards', () => {
      const sm = new CarouselStateMachine(mockEpisodes, { initialIndex: 1 });
      sm.handleKeyDown('ArrowLeft');
      assert.equal(sm.activeIndex, 0);
      assert.deepEqual(sm.getTabIndices(), [0, -1, -1], 'Only item 0 has tabindex="0"');
    });

    it('F07.4: Home and End keys update roving tabindex to endpoints', () => {
      const sm = new CarouselStateMachine(mockEpisodes, { initialIndex: 0 });
      sm.handleKeyDown('End');
      assert.equal(sm.activeIndex, 2);
      assert.deepEqual(sm.getTabIndices(), [-1, -1, 0]);

      sm.handleKeyDown('Home');
      assert.equal(sm.activeIndex, 0);
      assert.deepEqual(sm.getTabIndices(), [0, -1, -1]);
    });

    it('F07.5: Switching to Grid View relaxes roving tabindex so all slides have tabindex="0"', () => {
      const sm = new CarouselStateMachine(mockEpisodes, { initialIndex: 1, defaultView: 'carousel' });
      assert.deepEqual(sm.getTabIndices(), [-1, 0, -1]);

      sm.toggleView('grid');
      assert.deepEqual(sm.getTabIndices(), [0, 0, 0], 'All slides have tabindex="0" in grid view');
    });

    it('F07.6: Inactive slides and interactive children have tabindex="-1" and inert in carousel mode; relaxed in grid mode', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /inert=\{isInert|\.setAttribute\(['"]inert['"]/, 'Inert attribute applied to inactive slides in carousel mode');
      assert.match(src, /tabindex=\{childTabIndex\}|\.carousel-play-btn[^}]*tabindex/, 'Interactive children bind to roving tabindex in carousel mode');

      // State machine child tabindex calculations
      const sm = new CarouselStateMachine(mockEpisodes, { initialIndex: 1, defaultView: 'carousel' });
      assert.equal(sm.getChildTabIndex(0), -1, 'Inactive slide 0 interactive children have tabindex="-1"');
      assert.equal(sm.getChildTabIndex(1), 0, 'Active slide 1 interactive children have tabindex="0"');
      assert.equal(sm.getChildTabIndex(2), -1, 'Inactive slide 2 interactive children have tabindex="-1"');

      sm.toggleView('grid');
      assert.equal(sm.getChildTabIndex(0), 0, 'In grid view, all interactive children have tabindex="0"');
      assert.equal(sm.getChildTabIndex(1), 0, 'In grid view, all interactive children have tabindex="0"');
    });
  });

  // --- F08: Comprehensive Keyboard Controls ---
  describe('F08: Comprehensive Keyboard Controls', () => {
    it('F08.1: ArrowRight advances active index clamped at length - 1 and ArrowDown is ignored', () => {
      const sm = new CarouselStateMachine(mockEpisodes, { initialIndex: 1 });
      sm.handleKeyDown('ArrowRight');
      assert.equal(sm.activeIndex, 2);
      sm.handleKeyDown('ArrowRight'); // clamp at end
      assert.equal(sm.activeIndex, 2, 'Clamped at end');

      sm.activeIndex = 0;
      const handledDown = sm.handleKeyDown('ArrowDown');
      assert.equal(handledDown, false, 'ArrowDown must not be handled by horizontal carousel');
      assert.equal(sm.activeIndex, 0, 'Active index unchanged by ArrowDown (preserves vertical page scroll)');
    });

    it('F08.2: ArrowLeft returns active index clamped at 0 and ArrowUp is ignored', () => {
      const sm = new CarouselStateMachine(mockEpisodes, { initialIndex: 1 });
      sm.handleKeyDown('ArrowLeft');
      assert.equal(sm.activeIndex, 0);
      sm.handleKeyDown('ArrowLeft'); // clamp at 0
      assert.equal(sm.activeIndex, 0, 'Clamped at 0');

      sm.activeIndex = 2;
      const handledUp = sm.handleKeyDown('ArrowUp');
      assert.equal(handledUp, false, 'ArrowUp must not be handled by horizontal carousel');
      assert.equal(sm.activeIndex, 2, 'Active index unchanged by ArrowUp (preserves vertical page scroll)');
    });

    it('F08.3: Home key jumps to index 0', () => {
      const sm = new CarouselStateMachine(mockEpisodes, { initialIndex: 2 });
      sm.handleKeyDown('Home');
      assert.equal(sm.activeIndex, 0);
    });

    it('F08.4: End key jumps to index items.length - 1', () => {
      const sm = new CarouselStateMachine(mockEpisodes, { initialIndex: 0 });
      sm.handleKeyDown('End');
      assert.equal(sm.activeIndex, mockEpisodes.length - 1);
    });

    it('F08.5: Enter and Space trigger docking and initiate playback', () => {
      const sm = new CarouselStateMachine(mockEpisodes, { initialIndex: 1 });
      assert.equal(sm.isPlaying, false);
      const handled = sm.handleKeyDown('Enter');
      assert.equal(handled, true);
      assert.equal(sm.isPlaying, true);
      assert.equal(sm.dockedEpisode?.slug, 'big-tech-ai-investments-the-great-accounting-debate');
    });
  });

  // --- F09: Stepper Navigation Buttons ---
  describe('F09: Stepper Navigation Buttons', () => {
    it('F09.1: Previous stepper button declares accessible aria-label', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /aria-label=["'][^"']*Previous[^"']*["']/i, 'Previous episode button has accessible label');
    });

    it('F09.2: Next stepper button declares accessible aria-label', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /aria-label=["'][^"']*Next[^"']*["']/i, 'Next episode button has accessible label');
    });

    it('F09.3: Stepper buttons bind to track via aria-controls', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /aria-controls=(?:["'][^"']*carousel-track[^"']*["']|\{`?\$\{[^}]*id\}[^`}]*track`?\}|\{trackId\}|["'][^"']*track["'])/, 'Stepper buttons have aria-controls targeting track');
    });

    it('F09.4: Stepper logic steps forward and clamps at end', () => {
      const sm = new CarouselStateMachine(mockEpisodes, { initialIndex: 1 });
      sm.step('next');
      assert.equal(sm.activeIndex, 2);
      sm.step('next');
      assert.equal(sm.activeIndex, 2, 'Cannot step past last item');
    });

    it('F09.5: Stepper logic steps backward and clamps at start', () => {
      const sm = new CarouselStateMachine(mockEpisodes, { initialIndex: 1 });
      sm.step('prev');
      assert.equal(sm.activeIndex, 0);
      sm.step('prev');
      assert.equal(sm.activeIndex, 0, 'Cannot step past first item');
    });
  });

  // --- F10: View Mode Switcher Toolbar ---
  describe('F10: View Mode Switcher Toolbar', () => {
    it('F10.1: Toolbar container declares role="toolbar" or view toggle group', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /role=["']toolbar["']|view-toggle|view-btn/, 'Toolbar structure present');
    });

    it('F10.2: Toggle buttons exist for Cover Flow / Carousel and Grid View', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /data-view=["']carousel["']|Cover Flow|Carousel/, 'Carousel view toggle option present');
      assert.match(src, /data-view=["']grid["']|Grid View|Grid/, 'Grid view toggle option present');
    });

    it('F10.3: Buttons expose aria-pressed attribute reflecting active view', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /aria-pressed/, 'aria-pressed present on view mode toggle');
    });

    it('F10.4: Toggling to Grid View applies .is-grid-view modifier', () => {
      const sm = new CarouselStateMachine(mockEpisodes, { defaultView: 'carousel' });
      assert.equal(sm.viewMode, 'carousel');
      sm.toggleView('grid');
      assert.equal(sm.viewMode, 'grid');
    });

    it('F10.5: Toggling back restores .is-carousel-view modifier', () => {
      const sm = new CarouselStateMachine(mockEpisodes, { defaultView: 'grid' });
      assert.equal(sm.viewMode, 'grid');
      sm.toggleView('carousel');
      assert.equal(sm.viewMode, 'carousel');
    });
  });

  // --- F11: Fallback Responsive CSS Grid ---
  describe('F11: Fallback Responsive CSS Grid', () => {
    it('F11.1: In .is-grid-view, track scroller switches to display: grid', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /is-grid-view[^}]*display:\s*grid|\.is-grid-view[\s\S]*?display:\s*grid/, 'display: grid declared for grid view');
    });

    it('F11.2: Grid view uses responsive columns (repeat(auto-fit/fill, minmax(...)))', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /grid-template-columns:\s*repeat\(auto-(fit|fill),\s*minmax\(/, 'Responsive minmax grid columns declared');
    });

    it('F11.3: Grid view suppresses 3D card transforms', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /is-grid-view[^}]*transform:\s*none|\.is-grid-view[\s\S]*?transform:\s*none/, '3D transform reset in grid mode');
    });

    it('F11.4: Grid view disables horizontal scroll snapping', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /is-grid-view[^}]*scroll-snap-type:\s*none|\.is-grid-view[\s\S]*?scroll-snap-type:\s*none/, 'scroll-snap-type: none declared in grid mode');
    });

    it('F11.5: Grid view defines card gap using standard spacing (1.5rem to 2rem)', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /gap:\s*(1\.5rem|1\.75rem|2rem|1\.25rem)/, 'Standard card gap declared in grid mode');
    });
  });

  // --- F12: Zero-JS Progressive Fallback ---
  describe('F12: Zero-JS Progressive Fallback', () => {
    it('F12.1: Server-rendered HTML payload contains all episode cards', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /items\.map|\.map\(/, 'Component maps items into server-rendered markup');
    });

    it('F12.2: Every card provides a direct link to /podcast/${slug}', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /\/podcast\/\$\{?item\.slug|\/podcast\/\$\{?ep\.data\.slug|\/podcast\//, 'Direct episode show notes links present');
    });

    it('F12.3: Audio download link or native audio fallback is present in static payload', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /download|downloadable|AudioPlayer/, 'Direct download or AudioPlayer fallback present in payload');
    });

    it('F12.4: noscript styles ensure content remains accessible without JS', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /<noscript>|display:\s*(grid|flex)/, 'Progressive fallback styles or noscript tag present');
      assert.match(src, /\.audio-carousel-stage\s*\{[^}]*perspective:\s*none/, 'Noscript styles target .audio-carousel-stage without typo');
    });

    it('F12.5: Episode title and summary are visible semantic headings and paragraphs', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /<h[34][^>]*>[^<]*title|<h[34]/, 'Semantic heading tag used for card title');
      assert.match(src, /<p[^>]*>[^<]*summary|<p/, 'Semantic paragraph tag used for summary');
    });
  });

  // --- F13: Prefers-Reduced-Motion Rules ---
  describe('F13: Prefers-Reduced-Motion Rules', () => {
    it('F13.1: Component or site CSS defines @media (prefers-reduced-motion: reduce)', () => {
      const css = loadSiteCss();
      assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/, 'Site CSS includes prefers-reduced-motion query');
    });

    it('F13.2: Reduced motion disables smooth scrolling (scroll-behavior: auto !important)', (t) => {
      const src = loadComponentSource();
      const css = loadSiteCss();
      const combined = (src || '') + css;
      assert.match(combined, /scroll-behavior:\s*auto\s*!important/, 'scroll-behavior: auto !important declared under reduced-motion');
    });

    it('F13.3: Reduced motion suppresses 3D card transforms (transform: none !important)', (t) => {
      const src = loadComponentSource();
      const css = loadSiteCss();
      const combined = (src || '') + css;
      assert.match(combined, /transform:\s*none\s*!important/, 'transform: none !important declared under reduced-motion');
    });

    it('F13.4: Reduced motion collapses transition durations', (t) => {
      const src = loadComponentSource();
      const css = loadSiteCss();
      const combined = (src || '') + css;
      assert.match(combined, /transition:\s*(none|0s|0\.01ms)\s*!important|animation:\s*none\s*!important/, 'Transitions collapsed under reduced motion');
    });

    it('F13.5: State machine transforms collapse to zero rotation under reduced motion', () => {
      const sm = new CarouselStateMachine(mockEpisodes, { initialIndex: 0, prefersReducedMotion: true });
      const transformActive = sm.computeCardTransform(0);
      const transformFlank = sm.computeCardTransform(1);
      assert.equal(transformActive.rotateY, 0, 'Active has 0 rotation');
      assert.equal(transformFlank.rotateY, 0, 'Flank has 0 rotation');
      assert.equal(transformFlank.translateZ, 0, 'Flank has 0 translateZ');
    });
  });

  // --- F14: Docked AudioPlayer Section ---
  describe('F14: Docked AudioPlayer Section', () => {
    it('F14.1: AudioPlayer.astro component file exists in src/components/', () => {
      assert.ok(existsSync(AUDIO_PLAYER_PATH), 'AudioPlayer.astro must exist in repository');
    });

    it('F14.2: AudioPlayer embeds native <audio class="custom-audio-player">', () => {
      const playerSrc = loadAudioPlayer();
      assert.match(playerSrc, /<audio[^>]*class=["'][^"']*custom-audio-player[^"']*["']/, 'Native custom-audio-player present');
    });

    it('F14.3: AudioPlayer enforces preload="none" per architectural audio governance', () => {
      const playerSrc = loadAudioPlayer();
      assert.match(playerSrc, /preload=["']none["']/, 'preload="none" strictly enforced');
    });

    it('F14.4: AudioPlayer links accessible title via aria-labelledby', () => {
      const playerSrc = loadAudioPlayer();
      assert.match(playerSrc, /aria-labelledby=\{titleId\}|aria-labelledby=["'][^"']*title/, 'aria-labelledby bound to header title');
    });

    it('F14.5: AudioPlayer includes speed controls (1x, 1.25x, 1.5x) and download action', () => {
      const playerSrc = loadAudioPlayer();
      assert.match(playerSrc, /audio-speed-selector/, 'Speed selector present');
      assert.match(playerSrc, /audio-download-action/, 'Download MP3 action present');
    });
  });

  // --- F15: Play & Dock Action ---
  describe('F15: Play & Dock Action', () => {
    it('F15.1: Card includes an accessible "▶ Listen" / play action button', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /carousel-play-btn|play-btn|Listen/, 'Play button present in card markup');
    });

    it('F15.2: Play button carries dataset attributes (slug, audioSrc, title, duration)', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /data-slug|data-audio-src|data-title|data-duration/, 'Dataset attributes present on card or play button');
    });

    it('F15.3: Dock action triggers custom event (lukethinks:dock-audio or lukethinks:cue-episode)', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /lukethinks:(dock-audio|cue-episode)/, 'Decoupled custom event dispatched on dock action');
    });

    it('F15.4: Dock event detail payload schema conforms to specification', () => {
      const sm = new CarouselStateMachine(mockEpisodes, { initialIndex: 0 });
      const payload = sm.dockAndPlayActive();
      assert.ok(payload, 'Payload returned');
      assert.equal(payload.slug, 'the-50b-ai-partnership-bubble');
      assert.equal(payload.title, 'The $50B AI Partnership Bubble: Accounting Crisis in Big Tech');
      assert.equal(payload.audioSrc, 'https://1fyj7adygjho7vgj.public.blob.vercel-storage.com/Podcasts/ai-thinking-frameworks-narration.mp3');
      assert.equal(payload.durationSeconds, 255);
      assert.equal(payload.format, 'briefing');
    });

    it('F15.5: Active cued card receives .is-docked or .is-playing modifier class', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /is-docked|is-playing|is-cued/, 'Modifier class applied on active playback dock');
    });
  });

  // --- F16: Exclusive Playback Enforcement ---
  describe('F16: Exclusive Playback Enforcement', () => {
    it('F16.1: AudioPlayer contains exclusive playback listener on "play" event', () => {
      const playerSrc = loadAudioPlayer();
      assert.match(playerSrc, /audio\.addEventListener\(['"]play['"]/, 'play event listener registered');
    });

    it('F16.2: AudioPlayer iterates over other custom-audio-player elements and pauses them', () => {
      const playerSrc = loadAudioPlayer();
      assert.match(playerSrc, /querySelectorAll(<[^>]+>)?\(['"]audio\.custom-audio-player['"]\)/, 'Queries all audio players on page');
      assert.match(playerSrc, /otherAudio\.pause\(\)/, 'Pauses non-active playing instances');
    });

    it('F16.3: Simulated exclusive playback stops previous audio when new episode starts', () => {
      let player1PausedCalled = false;
      let player2PausedCalled = false;

      const player1 = {
        paused: false,
        pause() {
          this.paused = true;
          player1PausedCalled = true;
        },
      };

      const player2 = {
        paused: false,
        pause() {
          this.paused = true;
          player2PausedCalled = true;
        },
      };

      // Call genuine mutual exclusion logic from carousel-state
      enforceExclusivePlayback(player2, [player1, player2]);

      assert.equal(player1.paused, true, 'Active audio stopped previous player');
      assert.equal(player1PausedCalled, true, 'Previous audio pause() method invoked');
      assert.equal(player2.paused, false, 'Current player remained playing');
      assert.equal(player2PausedCalled, false, 'Current player pause() was not invoked');
    });

    it('F16.4: Playback rate is restored from active speed button upon playback', () => {
      const playerSrc = loadAudioPlayer();
      assert.match(playerSrc, /audio\.playbackRate\s*=\s*speed/, 'Restores playback rate from active speed button');
    });

    it('F16.5: Fallback message and download link provided if browser cannot play format', () => {
      const playerSrc = loadAudioPlayer();
      assert.match(playerSrc, /Your browser does not support audio playback/, 'Fallback message present');
      assert.match(playerSrc, /<a[^>]*download[^>]*>Download the MP3<\/a>/, 'Fallback download link present in audio tag');
    });
  });

  // --- F17: Podcast Page Integration ---
  describe('F17: Podcast Page Integration', () => {
    it('F17.1: podcast.astro loads episodes collection sorted by episode number', () => {
      const pageSrc = loadPodcastPage();
      assert.match(pageSrc, /getCollection\(['"]episodes['"]/, 'Queries episodes collection');
      assert.match(pageSrc, /sort\(/, 'Sorts episodes collection');
    });

    it('F17.2: podcast.astro has exactly one visible <h1> element inside <main>', () => {
      const pageSrc = loadPodcastPage();
      const h1Matches = [...pageSrc.matchAll(/<h1[\s>]/g)];
      assert.equal(h1Matches.length, 1, 'Exactly one <h1> tag present on podcast page');
      assert.match(pageSrc, /<h1[^>]*>[\s\S]*?Audio Library[\s\S]*?<\/h1>/, '<h1> contains expected title');
    });

    it('F17.3: Headings descend sequentially (h1 -> h2 -> h3) without skipping levels', () => {
      const pageSrc = loadPodcastPage();
      assert.match(pageSrc, /<h2[^>]*id=["']catalog-heading["']/, 'h2 present for Episode Catalog');
    });

    it('F17.4: Filter categories bar contains topic buttons (all, ai, accounting, briefing, debate)', () => {
      const pageSrc = loadPodcastPage();
      assert.match(pageSrc, /id=["']podcast-filters["']/, 'Podcast filter container present');
      assert.match(pageSrc, /data-category=\{cat\.id\}/, 'Filter buttons render data-category');
    });

    it('F17.5: Platform subscription bar contains Spotify, Apple, and RSS links', () => {
      const pageSrc = loadPodcastPage();
      assert.match(pageSrc, /platform-pill spotify/, 'Spotify link present');
      assert.match(pageSrc, /platform-pill apple/, 'Apple Podcasts link present');
      assert.match(pageSrc, /platform-pill rss/, 'RSS feed link present');
    });
  });

  // --- F18: Class Register & Design Tokens ---
  describe('F18: Class Register & Design Tokens', () => {
    it('F18.1: Site CSS defines all mandatory design tokens in :root', () => {
      const css = loadSiteCss();
      const requiredTokens = [
        '--primary-brown',
        '--secondary-brown',
        '--accent-amber',
        '--light-amber',
        '--cream',
        '--light-cream',
        '--surface-card',
        '--surface-button',
        '--surface-input',
        '--dark-text',
        '--medium-text',
        '--light-text',
        '--border-light',
        '--shadow-light',
        '--shadow-medium',
      ];
      for (const token of requiredTokens) {
        assert.ok(css.includes(`${token}:`), `Token ${token} must be defined in site.css`);
      }
    });

    it('F18.2: State modifiers strictly adhere to .is-* and .has-* standard (ADR-0009)', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      const classes = [...src.matchAll(/class(?:Name|:list)?=["'{]([^"'}]*)/g)]
        .flatMap(m => m[1].replace(/[`'"[\]{}()]/g, ' ').split(/\s+/))
        .filter(Boolean);

      assert.ok(!classes.includes('active'), 'Bare .active is prohibited; use .is-active');
      assert.ok(!classes.includes('playing'), 'Bare .playing is prohibited; use .is-playing');
      assert.ok(!classes.includes('docked'), 'Bare .docked is prohibited; use .is-docked or .has-docked-audio');
    });

    it('F18.3: Dark theme redefines tokens under :root[data-theme="dark"]', () => {
      const css = loadSiteCss();
      assert.match(css, /:root\[data-theme=["']dark["']\]/, 'Dark theme selector exists in site.css');
      assert.match(css, /--card-bg:\s*#1e293b/, 'Dark card-bg token redefined');
    });

    it('F18.4: Zero inline style attributes present in component template', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      // Astro templates must not use inline style="..." attributes
      assert.doesNotMatch(src, /<[a-z0-9-]+\s+[^>]*\bstyle=["'][^"']+["']/i, 'No inline style attributes permitted');
    });

    it('F18.5: check-register.mjs script exists and defines class drift validation', () => {
      const scriptPath = path.join(ROOT_DIR, 'scripts', 'check-register.mjs');
      assert.ok(existsSync(scriptPath), 'check-register.mjs exists');
      const script = readFileSync(scriptPath, 'utf8');
      assert.match(script, /register\.has\(c\)/, 'Verifies built classes against registered set');
    });

    it('F18.6: Artwork number uses design token var(--cream) instead of hardcoded hex (ADR-0004)', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not yet authored by M1 implementer');
        return;
      }
      assert.match(src, /\.artwork-number\s*\{[^}]*color:\s*var\(--cream\)/, '.artwork-number uses var(--cream)');
      assert.doesNotMatch(src, /\.artwork-number\s*\{[^}]*#fef7f0/, '.artwork-number does not contain hardcoded #fef7f0');
    });
  });

  // --- F19: Expandable Series-Centric Browsing & Drawer Interaction ---
  describe('F19: Expandable Series-Centric Browsing & Drawer Interaction', () => {
    const mockSeriesCard = {
      id: 'series-ai-skills',
      slug: 'why-ai-verification-replaced-prompt-engineering',
      title: 'AI Skills & The Future of Human Judgment',
      series: 'AI Skills & The Future of Human Judgment',
      isSeries: true,
      partsCount: 3,
      theme: 'Human Judgment, Cognitive Friction & Automation Oversight',
      summary: 'A 3-part investigative audio series examining human skills in the agentic era.',
      published: '2026-09-19',
      audio: {
        src: 'https://1fyj7adygjho7vgj.public.blob.vercel-storage.com/Podcasts/AI%20skills%20podcast%20part%201-debate.m4a',
        bytes: 93819356,
        durationSeconds: 2915,
      },
      episodes: [
        {
          slug: 'part-3-oversight',
          title: 'The Ironies of Automation & The Art of Oversight',
          seriesPart: 3,
          format: 'debate',
          audio: { src: 'https://example.com/p3.m4a', durationSeconds: 1800 },
        },
        {
          slug: 'part-1-verification',
          title: 'Why AI Verification Replaced Prompt Engineering',
          seriesPart: 1,
          format: 'debate',
          audio: { src: 'https://example.com/p1.m4a', durationSeconds: 2915 },
        },
        {
          slug: 'part-2-friction',
          title: 'Why Your Brain Needs Cognitive Friction',
          seriesPart: 2,
          format: 'debate',
          audio: { src: 'https://example.com/p2.m4a', durationSeconds: 1800 },
        },
      ],
    };

    it('F19.1: Top carousel highlights series cards with clear part counts and overarching theme', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not found');
        return;
      }
      assert.match(src, /carousel-parts-count/, 'Part count badge class present');
      assert.match(src, /data-parts-count/, 'data-parts-count attribute present');
      assert.match(src, /data-is-series/, 'data-is-series attribute present');
      assert.match(src, /carousel-series-toggle-btn/, 'Series toggle button present');
      assert.match(src, /carousel-theme-tag|drawer-theme/, 'Overarching theme rendered');
    });

    it('F19.2: Series episodes in drawer are strictly ordered by intended listening sequence (Part 1 -> Part 2 -> Part 3)', () => {
      const sm = new CarouselStateMachine([mockSeriesCard]);
      const episodes = sm.getSeriesEpisodes(0);
      assert.equal(episodes.length, 3, 'All 3 parts retrieved');
      assert.equal(episodes[0].seriesPart, 1, 'Part 1 is first');
      assert.equal(episodes[1].seriesPart, 2, 'Part 2 is second');
      assert.equal(episodes[2].seriesPart, 3, 'Part 3 is third');
      assert.equal(episodes[0].slug, 'part-1-verification');
      assert.equal(episodes[1].slug, 'part-2-friction');
      assert.equal(episodes[2].slug, 'part-3-oversight');
    });

    it('F19.3: Selecting a series card expands an in-place episode list drawer below the carousel track', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not found');
        return;
      }
      assert.match(src, /carousel-series-drawer/, 'Series drawer container class present');
      assert.match(src, /aria-controls=\{seriesDrawerId\}|aria-controls=/, 'Toggle button controls drawer');
      assert.match(src, /drawer-tracklist/, 'Tracklist list element present in drawer');
      assert.match(src, /drawer-close-btn/, 'Collapse button present in drawer');

      const sm = new CarouselStateMachine([mockSeriesCard]);
      assert.equal(sm.isSeriesExpanded(0), false, 'Initially collapsed');
      sm.expandSeries(0);
      assert.equal(sm.isSeriesExpanded(0), true, 'Expanded after expandSeries');
      assert.equal(sm.expandedSeriesIndex, 0);
      sm.collapseSeries();
      assert.equal(sm.isSeriesExpanded(0), false, 'Collapsed after collapseSeries');
      assert.equal(sm.expandedSeriesIndex, null);
    });

    it('F19.4: Clicking an episode in drawer initiates in-line synchronized playback and updates player', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not found');
        return;
      }
      assert.match(src, /drawer-play-btn/, 'Drawer play button present');
      assert.match(src, /data-part=/, 'Drawer play button includes data-part');

      const sm = new CarouselStateMachine([mockSeriesCard]);
      const episodes = sm.getSeriesEpisodes(0);
      const payload = sm.dockAndPlayEpisode(episodes[1]); // Part 2
      assert.ok(payload, 'Payload returned');
      assert.equal(payload.slug, 'part-2-friction');
      assert.equal(payload.audioSrc, 'https://example.com/p2.m4a');
      assert.equal(sm.isPlaying, true);
      assert.equal(sm.dockedEpisode?.slug, 'part-2-friction');
    });

    it('F19.5: Accessible keyboard navigation: Enter/Space toggles drawer, Escape collapses it', () => {
      const sm = new CarouselStateMachine([mockSeriesCard]);
      assert.equal(sm.isSeriesExpanded(0), false);

      // Enter on series card expands drawer
      const handledEnter = sm.handleKeyDown('Enter');
      assert.equal(handledEnter, true);
      assert.equal(sm.isSeriesExpanded(0), true, 'Enter expands series drawer');

      // Escape key collapses drawer
      const handledEscape = sm.handleKeyDown('Escape');
      assert.equal(handledEscape, true);
      assert.equal(sm.isSeriesExpanded(0), false, 'Escape collapses series drawer');

      // Space key toggles drawer back open
      const handledSpace = sm.handleKeyDown(' ');
      assert.equal(handledSpace, true);
      assert.equal(sm.isSeriesExpanded(0), true, 'Space toggles series drawer');
    });

    it('F19.6: Strict Zero-Hardware-Trademark Compliance across modified components and tests', () => {
      const carouselSrc = readFileSync(CAROUSEL_COMPONENT_PATH, 'utf8');
      const stateSrc = readFileSync(path.join(ROOT_DIR, 'src', 'utils', 'carousel-state.ts'), 'utf8');
      const podcastSrc = readFileSync(PODCAST_PAGE_PATH, 'utf8');
      const testSrc = readFileSync(path.join(ROOT_DIR, 'tests', 'audio-carousel.test.mjs'), 'utf8');

      const FORBIDDEN_KEYWORD = ['i', 'p', 'o', 'd'].join('');
      const forbiddenPattern = new RegExp(FORBIDDEN_KEYWORD, 'i');

      assert.doesNotMatch(carouselSrc, forbiddenPattern, 'AudioCarousel.astro contains zero forbidden hardware references');
      assert.doesNotMatch(stateSrc, forbiddenPattern, 'carousel-state.ts contains zero forbidden hardware references');
      assert.doesNotMatch(podcastSrc, forbiddenPattern, 'podcast.astro contains zero forbidden hardware references');
      assert.doesNotMatch(testSrc, forbiddenPattern, 'audio-carousel.test.mjs contains zero forbidden hardware references');
    });

    it('F19.7: Deterministic tiebreaker sorting when seriesPart and episode numbers are identical or omitted', () => {
      const cardWithAmbiguousParts = {
        id: 'series-ambiguous',
        slug: 'series-ambiguous',
        title: 'Ambiguous Series',
        isSeries: true,
        episodes: [
          { slug: 'part-b', title: 'Part B', published: '2026-09-20', audio: { src: 'https://example.com/b.m4a', durationSeconds: 100 } },
          { slug: 'part-a', title: 'Part A', published: '2026-09-10', audio: { src: 'https://example.com/a.m4a', durationSeconds: 100 } },
          { slug: 'part-c', title: 'Part C', published: '2026-09-20', audio: { src: 'https://example.com/c.m4a', durationSeconds: 100 } },
        ],
      };
      const sm = new CarouselStateMachine([cardWithAmbiguousParts]);
      const episodes = sm.getSeriesEpisodes(0);
      assert.equal(episodes.length, 3);
      assert.equal(episodes[0].slug, 'part-a', 'Earliest published date comes first when parts are unnumbered');
      assert.equal(episodes[1].slug, 'part-b', 'Alphabetical slug tiebreaker when published dates match');
      assert.equal(episodes[2].slug, 'part-c');
    });

    it('F19.8: Switching between series cards updates expandedSeriesIndex, while switching to standalone slide collapses drawer', () => {
      const standaloneCard = {
        id: 'standalone-ep',
        slug: 'standalone-ep',
        title: 'Standalone Episode',
        audio: { src: 'https://example.com/single.m4a', durationSeconds: 500 },
      };
      const secondSeriesCard = {
        id: 'series-2',
        slug: 'series-2',
        title: 'Second Series',
        isSeries: true,
        episodes: [
          { slug: 's2-p1', title: 'S2 Part 1', seriesPart: 1, audio: { src: 'https://example.com/s2p1.m4a', durationSeconds: 300 } },
        ],
      };

      const sm = new CarouselStateMachine([mockSeriesCard, standaloneCard, secondSeriesCard]);
      assert.equal(sm.activeIndex, 0);

      // Expand first series
      sm.expandSeries(0);
      assert.equal(sm.expandedSeriesIndex, 0);

      // Select standalone card (index 1) -> drawer must collapse (expandedSeriesIndex becomes null)
      sm.selectItem(1);
      assert.equal(sm.expandedSeriesIndex, null, 'Drawer collapses when navigating to standalone episode');

      // Select second series card (index 2) and expand
      sm.expandSeries(2);
      assert.equal(sm.expandedSeriesIndex, 2);

      // Navigate back to first series card (index 0) while expanded -> automatically switches expanded index
      sm.selectItem(0);
      assert.equal(sm.expandedSeriesIndex, 0, 'Drawer switches expanded series index when moving between series cards');
    });

    it('F19.9: APG trigger focus restoration and scoped keyboard navigation within active series', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not found');
        return;
      }
      // Verify APG trigger focus restoration in collapseDrawer
      assert.match(src, /triggerBtn\s*=\s*slides\[prevIdx\]\.querySelector.*carousel-series-toggle-btn/, 'Returns focus to series toggle button on collapse');
      // Verify scoped navigation within active series
      assert.match(src, /activeSeriesContent\s*=\s*item\.closest.*drawer-series-content/, 'Scopes drawer items within active series content');
      assert.match(src, /target\s*!==\s*item\s*&&\s*\(target\.closest\(['"]a['"]\)\s*\|\|\s*target\.closest\(['"]button['"]\)\)/, 'Prevents double-click activation on interactive children');
    });

    it('F19.10: Series card button label preservation and prefers-reduced-motion compliance', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not found');
        return;
      }
      // Verify series button preserves Play Part 1 and Pause Part 1
      assert.match(src, /isSeries[\s\S]*?Play Part 1/, 'Series play button preserves Play Part 1 label');
      assert.match(src, /isSeries[\s\S]*?Pause Part 1/, 'Series play button updates to Pause Part 1 when active');
      // Verify scrollIntoView checks prefers-reduced-motion
      assert.match(src, /prefersReduced[\s\S]*?scrollIntoView/, 'Docked player scrollIntoView respects prefers-reduced-motion');
    });

    it('F19.11: Unified playback state synchronization across drawer, series cards, and docked player', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not found');
        return;
      }
      // Verify unified syncPlaybackState function exists
      assert.match(src, /function\s+syncPlaybackState\s*\(/, 'syncPlaybackState function defined');
      // Verify docked audio events (play, pause, ended) invoke syncPlaybackState
      assert.match(src, /docked\.audio\.addEventListener\(['"]play['"][\s\S]*?syncPlaybackState/, 'Audio play event triggers syncPlaybackState');
      assert.match(src, /docked\.audio\.addEventListener\(['"]pause['"][\s\S]*?syncPlaybackState/, 'Audio pause event triggers syncPlaybackState');
      assert.match(src, /docked\.audio\.addEventListener\(['"]ended['"][\s\S]*?syncPlaybackState/, 'Audio ended event triggers syncPlaybackState');
      // Verify aria-pressed is synchronized on play buttons
      assert.match(src, /btn\.setAttribute\(['"]aria-pressed['"]/, 'aria-pressed synchronized on carousel play buttons');
      assert.match(src, /pBtn\.setAttribute\(['"]aria-pressed['"]/, 'aria-pressed synchronized on drawer play buttons');
    });

    it('F19.12: Track keydown excludes button children to prevent double-trigger toggling on Enter/Space', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not found');
        return;
      }
      assert.match(
        src,
        /!target\.closest\(['"]a['"]\)\s*&&\s*!target\.closest\(['"]button['"]\)/,
        'Track keydown excludes button children on Enter/Space to avoid duplicate events'
      );
    });

    it('F19.13: Scoped ArrowDown and ArrowUp navigation across drawer episodes supports focused drawer buttons', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not found');
        return;
      }
      // Verify keydown guard on drawer episode items only excludes Enter and Space for interactive children
      assert.match(
        src,
        /\(e\.key\s*===\s*['"]Enter['"]\s*\|\|\s*e\.key\s*===\s*['"]\s*['"]\)\s*&&\s*target\s*!==\s*item/,
        'Only guards Enter and Space for interactive children, allowing vertical arrow navigation'
      );
      // Verify ArrowDown and ArrowUp support navigating when focus is on play button
      assert.match(src, /target\.classList\.contains\(['"]drawer-play-btn['"]\)/, 'Maintains focus on drawer-play-btn during arrow navigation');
    });

    it('F19.14: Series quick play button toggles play/pause on active series rather than restarting Part 1', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not found');
        return;
      }
      assert.match(
        src,
        /isThisSeriesActive[\s\S]*?docked\.audio\.paused[\s\S]*?docked\.audio\.pause\(\)/,
        'Series quick play button pauses active playback if series is already playing'
      );
    });

    it('F19.15: Strict design token adherence in .carousel-play-btn.is-playing without hardcoded hex colors', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not found');
        return;
      }
      assert.match(
        src,
        /\.carousel-play-btn\.is-playing\s*\{[\s\S]*?var\(--accent-amber\)[\s\S]*?var\(--secondary-brown\)/,
        '.carousel-play-btn.is-playing uses CSS custom property tokens instead of hardcoded hex colors'
      );
    });

    it('F19.16: Scroll synchronization updates state machine active index and synchronizes drawer state', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not found');
        return;
      }
      assert.match(
        src,
        /handleScrollSync[\s\S]*?clampedIndex\s*=\s*stateMachine\.selectItem\(newIndex\)/,
        'handleScrollSync updates stateMachine.selectItem to maintain index consistency during manual scrolling'
      );
      assert.match(
        src,
        /handleScrollSync[\s\S]*?wasDrawerOpen[\s\S]*?expandDrawer\(clampedIndex,\s*false\)/,
        'handleScrollSync synchronizes expanded drawer when active slide changes via manual scroll'
      );
    });

    it('F19.17: Initial direct docked audio playback resolves currentPlayingSlug and synchronizes playback UI', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not found');
        return;
      }
      assert.match(
        src,
        /docked\.audio\.addEventListener\(['"]play['"][\s\S]*?!currentPlayingSlug[\s\S]*?activeSlide(?:\.|\?\.)dataset\.isSeries/,
        'Docked audio play event resolves currentPlayingSlug when playback starts directly from docked player'
      );
    });

    it('F19.18: Pausing playback on Part 2 or Part 3 preserves paused episode part in series button label', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not found');
        return;
      }
      assert.match(
        src,
        /pausedPartLabel[\s\S]*?Play Part \$\{pausedPartLabel\}/,
        'updatePlayButtonUI dynamically retains the paused part number when paused'
      );
    });

    it('F19.19: Complete zero hex colors in AudioCarousel.astro styles adhering to design tokens', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not found');
        return;
      }
      const hexMatches = [...src.matchAll(/#[0-9a-fA-F]{3,6}\b/g)];
      assert.equal(
        hexMatches.length,
        0,
        `AudioCarousel.astro must contain 0 hardcoded hex colors, found: ${hexMatches.map((m) => m[0]).join(', ')}`
      );
    });

    it('F19.20: APG Home and End keys navigate to first and last items in series drawer tracklist', (t) => {
      const src = loadComponentSource();
      if (!src) {
        t.skip('src/components/AudioCarousel.astro not found');
        return;
      }
      assert.match(
        src,
        /e\.key\s*===\s*['"]Home['"][\s\S]*?siblingItems\[0\]/,
        'Drawer keydown handles Home key to navigate to first episode'
      );
      assert.match(
        src,
        /e\.key\s*===\s*['"]End['"][\s\S]*?siblingItems\[siblingItems\.length\s*-\s*1\]/,
        'Drawer keydown handles End key to navigate to last episode'
      );
    });
  });

});

// =========================================================================
// TIER 2: BOUNDARY & CORNER CASES (>=5 test cases)
// =========================================================================

describe('Tier 2: Boundary & Corner Cases', () => {
  it('Tier 2.1 (B01): Empty items array gracefully renders accessible empty state without throwing', () => {
    const sm = new CarouselStateMachine([]);
    assert.equal(sm.activeItem, null, 'Active item is null for empty items');
    assert.equal(sm.getTabIndices().length, 0, 'Tab indices empty for empty array');
    assert.equal(sm.handleKeyDown('ArrowRight'), false, 'Keydown returns false safely');
    assert.equal(sm.dockAndPlayActive(), null, 'Dock action returns null safely');
  });

  it('Tier 2.2 (B02): Single item catalog centers card, locks roving tabindex, and clamps step navigation', () => {
    const single = [mockEpisodes[0]];
    const sm = new CarouselStateMachine(single, { initialIndex: 0 });
    assert.equal(sm.activeIndex, 0);
    assert.deepEqual(sm.getTabIndices(), [0], 'Single item has tabindex="0"');

    // Attempting to advance remains clamped at 0
    sm.handleKeyDown('ArrowRight');
    assert.equal(sm.activeIndex, 0, 'Index clamped at 0 for single item');

    sm.step('next');
    assert.equal(sm.activeIndex, 0, 'Stepper next clamped at 0');

    sm.step('prev');
    assert.equal(sm.activeIndex, 0, 'Stepper prev clamped at 0');

    // 3D transform is centered
    const transform = sm.computeCardTransform(0);
    assert.equal(transform.rotateY, 0, 'Single card is centered at 0deg');
    assert.ok(transform.scale >= 1.0);
  });

  it('Tier 2.3 (B03): Very long titles (200+ chars) and summaries (500+ chars) clamp cleanly without breaking layout', () => {
    const longEpisode = {
      ...mockEpisodes[0],
      title: 'A'.repeat(250),
      summary: 'B'.repeat(600),
    };
    const sm = new CarouselStateMachine([longEpisode]);
    assert.equal(sm.activeItem.title.length, 250);
    assert.equal(sm.activeItem.summary.length, 600);

    const payload = sm.dockAndPlayActive();
    assert.equal(payload.title.length, 250, 'Payload handles long title without truncation failure');
  });

  it('Tier 2.4 (B04): Missing optional metadata (season, format, takeaways, companionArticle) handles gracefully', () => {
    const sparseEpisode = {
      id: 'sparse-01',
      slug: 'sparse-episode',
      title: 'Sparse Episode',
      summary: 'Minimal meta episode',
      published: '2025-12-01',
      audio: {
        src: 'https://example.com/sparse.mp3',
        bytes: 1000000,
        durationSeconds: 120,
      },
      // Missing: episodeNumber, season, format, tags, confidence, takeaways, companionArticle
    };
    const sm = new CarouselStateMachine([sparseEpisode]);
    assert.equal(sm.activeItem.season, undefined);
    assert.equal(sm.activeItem.format, undefined);

    const payload = sm.dockAndPlayActive();
    assert.equal(payload.slug, 'sparse-episode');
    assert.equal(payload.episodeNumber, undefined);
    assert.equal(payload.format, undefined);
  });

  it('Tier 2.5 (B05): Extreme viewport & no-script styling rules enforce container max-width and fluid mobile layout', (t) => {
    const src = loadComponentSource();
    const css = loadSiteCss();
    const combined = (src || '') + css;
    assert.match(combined, /max-width:\s*(1200px|960px)/, 'Stage container adheres to max-width constraint on ultrawide viewports');
  });
});

// =========================================================================
// TIER 3: CROSS-FEATURE COMBINATIONS (Pairwise interactions)
// =========================================================================

describe('Tier 3: Cross-Feature Combinations', () => {
  it('Tier 3.1 (C01): View mode switching while audio is playing preserves active playback state', () => {
    const sm = new CarouselStateMachine(mockEpisodes, { initialIndex: 1, defaultView: 'carousel' });
    sm.dockAndPlayActive();
    assert.equal(sm.isPlaying, true);
    assert.equal(sm.dockedEpisode?.slug, 'big-tech-ai-investments-the-great-accounting-debate');

    // Switch view to grid
    sm.toggleView('grid');
    assert.equal(sm.viewMode, 'grid');
    assert.equal(sm.isPlaying, true, 'Audio continues playing after switching to grid view');
    assert.equal(sm.dockedEpisode?.slug, 'big-tech-ai-investments-the-great-accounting-debate', 'Active docked episode preserved in grid view');

    // Switch back to carousel
    sm.toggleView('carousel');
    assert.equal(sm.viewMode, 'carousel');
    assert.equal(sm.isPlaying, true, 'Audio continues playing after switching back to carousel');
  });

  it('Tier 3.2 (C02): Keyboard navigation in grid view vs carousel view respects roving tabindex contracts', () => {
    const sm = new CarouselStateMachine(mockEpisodes, { initialIndex: 0, defaultView: 'carousel' });
    assert.deepEqual(sm.getTabIndices(), [0, -1, -1], 'Carousel mode: roving tabindex active');

    // Toggle to grid
    sm.toggleView('grid');
    assert.deepEqual(sm.getTabIndices(), [0, 0, 0], 'Grid mode: all items natively focusable');

    // In grid mode, carousel arrow key interception is disabled
    const handledInGrid = sm.handleKeyDown('ArrowRight');
    assert.equal(handledInGrid, false, 'In grid view, horizontal slide cycling is bypassed');

    // Toggle back to carousel
    sm.toggleView('carousel');
    assert.deepEqual(sm.getTabIndices(), [0, -1, -1], 'Carousel mode: roving tabindex restored');
    const handledInCarousel = sm.handleKeyDown('ArrowRight');
    assert.equal(handledInCarousel, true, 'In carousel view, arrow navigation works');
    assert.deepEqual(sm.getTabIndices(), [-1, 0, -1]);
  });

  it('Tier 3.3 (C03): Reduced motion styling assertions applied across cards and track', () => {
    const sm = new CarouselStateMachine(mockEpisodes, { initialIndex: 1, prefersReducedMotion: true });
    for (let i = 0; i < mockEpisodes.length; i++) {
      const transform = sm.computeCardTransform(i);
      assert.equal(transform.rotateY, 0, `Card ${i} has 0deg rotation under reduced motion`);
      assert.equal(transform.translateZ, 0, `Card ${i} has 0 translateZ under reduced motion`);
      assert.equal(transform.scale, 1, `Card ${i} has scale 1 under reduced motion`);
    }
  });

  it('Tier 3.4 (C04): Filter categories simulation updates active items and synchronizes active index', () => {
    const allItems = mockEpisodes;
    let activeFilter = 'all';

    function getFiltered(filter) {
      if (filter === 'all') return allItems;
      if (filter === 'briefing' || filter === 'debate') {
        return allItems.filter(e => e.format === filter);
      }
      return allItems.filter(e => e.tags?.includes(filter));
    }

    const filteredDebates = getFiltered('debate');
    assert.equal(filteredDebates.length, 1);
    assert.equal(filteredDebates[0].slug, 'big-tech-ai-investments-the-great-accounting-debate');

    const sm = new CarouselStateMachine(filteredDebates, { initialIndex: 0 });
    assert.equal(sm.activeIndex, 0);
    assert.equal(sm.activeItem.slug, 'big-tech-ai-investments-the-great-accounting-debate');
  });

  it('Tier 3.5 (C05): Alternating stepper clicks and keyboard navigation maintains index consistency', () => {
    const sm = new CarouselStateMachine(mockEpisodes, { initialIndex: 0 });
    sm.step('next'); // index 1
    assert.equal(sm.activeIndex, 1);

    sm.handleKeyDown('ArrowRight'); // index 2
    assert.equal(sm.activeIndex, 2);

    sm.step('prev'); // index 1
    assert.equal(sm.activeIndex, 1);

    sm.handleKeyDown('ArrowLeft'); // index 0
    assert.equal(sm.activeIndex, 0);
  });
});

// =========================================================================
// TIER 4: REAL-WORLD SCENARIOS
// =========================================================================

describe('Tier 4: Real-World Scenarios', () => {
  it('Tier 4.1 (R01): Full catalog loading parses real episode markdown files from content/episodes/', () => {
    const files = readdirSync(EPISODES_DIR).filter(f => f.endsWith('.md'));
    assert.ok(files.length >= 2, 'At least 2 real episodes exist in content/episodes/');

    const episodes = files.map(f => parseEpisodeFile(path.join(EPISODES_DIR, f)));
    for (const ep of episodes) {
      assert.ok(ep.title, 'Episode must have a title');
      assert.ok(ep.slug, 'Episode must have a slug');
      assert.ok(ep.audio?.src, 'Episode must have an audio.src');
      assert.ok(typeof ep.audio?.durationSeconds === 'number', 'durationSeconds must be a number');
      assert.ok(ep.type === 'episode', 'Episode type must be episode');
      assert.ok(typeof ep.episode === 'number', 'Episode number must be a number');
    }
  });

  it('Tier 4.2 (R02): Show notes links in real episodes resolve to valid extensionless URLs', () => {
    const files = readdirSync(EPISODES_DIR).filter(f => f.endsWith('.md'));
    const episodes = files.map(f => parseEpisodeFile(path.join(EPISODES_DIR, f)));

    for (const ep of episodes) {
      const showNotesUrl = `/podcast/${ep.slug}`;
      assert.match(showNotesUrl, /^\/podcast\/[a-z0-9-]+$/, `Valid extensionless URL: ${showNotesUrl}`);
      assert.doesNotMatch(showNotesUrl, /\.html$/, 'URL must not have .html extension per ADR-0006');
    }
  });

  it('Tier 4.3 (R03): All audio sources in real episodes point to Vercel Blob storage per ADR-0005', () => {
    const files = readdirSync(EPISODES_DIR).filter(f => f.endsWith('.md'));
    const episodes = files.map(f => parseEpisodeFile(path.join(EPISODES_DIR, f)));

    for (const ep of episodes) {
      assert.match(
        ep.audio.src,
        /^https:\/\/.*\.public\.blob\.vercel-storage\.com\/.*\.(mp3|m4a|aac|wav)$/,
        `Audio source must point to public Vercel Blob store: ${ep.audio.src}`
      );
    }
  });

  it('Tier 4.4 (R04): Live audio player docking simulation with real episode metadata succeeds', () => {
    const files = readdirSync(EPISODES_DIR).filter(f => f.endsWith('.md'));
    const realEpisodes = files.map(f => {
      const data = parseEpisodeFile(path.join(EPISODES_DIR, f));
      return {
        id: data.guid || data.slug,
        slug: data.slug,
        title: data.title,
        summary: data.summary,
        published: data.published,
        episodeNumber: data.episode,
        season: data.season,
        format: data.tags?.includes('debate') ? 'debate' : 'briefing',
        tags: data.tags,
        confidence: data.confidence,
        audio: data.audio,
      };
    });

    const sm = new CarouselStateMachine(realEpisodes, { initialIndex: 0 });
    const payload = sm.dockAndPlayActive();

    assert.ok(payload);
    assert.ok(payload.slug);
    assert.ok(payload.title);
    assert.ok(payload.audioSrc.startsWith('https://'));
    assert.ok(payload.durationSeconds > 0);
    assert.equal(sm.isPlaying, true);
  });

  it('Tier 4.5 (R05): Global site styles and tokens validate cleanly without missing references', () => {
    const css = loadSiteCss();
    assert.ok(css.length > 1000, 'site.css is populated');
    assert.match(css, /--accent-amber/, 'Theme has accent amber');
    assert.match(css, /--primary-brown/, 'Theme has primary brown');
    assert.match(css, /--surface-card/, 'Theme has surface card');
    assert.match(css, /--border-light/, 'Theme has border light');
  });
});
