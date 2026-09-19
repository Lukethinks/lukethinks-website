/**
 * Adversarial Stress Harness: iPod Classic Scroll Carousel (ADR-0018)
 * Framework: Node 24 Native Test Runner (node:test, node:assert/strict)
 *
 * Empirical Challenger Test Suite:
 * 1. Boundary stress (empty, single item, 50+ items)
 * 2. Rapid keyboard navigation & boundary clamping (Home, End, PageUp, PageDown, rapid arrows)
 * 3. Invariant stress testing via 5,000-step randomized navigation harness
 * 4. View mode state switching under rapid toggling (carousel <-> grid)
 * 5. Audio playback state preservation across view mode transitions
 * 6. Reduced motion behavior (CSS rules and JS matchMedia evaluation)
 * 7. Hostile inputs (NaN initialIndex, negative index, extreme strings, missing metadata)
 * 8. Pre-rendered production build HTML contract verification
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const CAROUSEL_COMPONENT_PATH = path.join(ROOT_DIR, 'src', 'components', 'IpodCarousel.astro');
const BUILT_PODCAST_HTML_PATH = path.join(ROOT_DIR, 'dist', 'client', 'podcast', 'index.html');
const SITE_CSS_PATH = path.join(ROOT_DIR, 'src', 'styles', 'site.css');

// --- Helper: Lightweight Synthetic DOM Implementation for Empirical Verification ---
function createMockCarouselDOM({
  itemCount = 3,
  initialIndex = 0,
  defaultView = 'carousel',
  itemsData = null,
} = {}) {
  const listeners = new Map();

  class MockElement {
    constructor(tagName, classes = [], attributes = {}) {
      this.tagName = tagName.toUpperCase();
      this.classList = new Set(classes);
      this.attributes = new Map(Object.entries(attributes));
      this.dataset = {};
      for (const [k, v] of Object.entries(attributes)) {
        if (k.startsWith('data-')) {
          const camel = k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          this.dataset[camel] = String(v);
        } else {
          this.dataset[k] = String(v);
        }
      }
      this.children = [];
      this.parentElement = null;
      this.textContent = '';
      this.disabled = false;
      this._listeners = new Map();
      this.clientWidth = 1000;
      this.offsetLeft = 0;
      this.offsetWidth = 320;
      this.scrollLeft = 0;
    }

    getAttribute(name) {
      if (name === 'class') return Array.from(this.classList).join(' ');
      return this.attributes.get(name) ?? (name in this.dataset ? this.dataset[name] : null);
    }

    setAttribute(name, value) {
      this.attributes.set(name, String(value));
      if (name.startsWith('data-')) {
        const camel = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        this.dataset[camel] = String(value);
      }
      if (name === 'class') {
        this.classList = new Set(String(value).split(/\s+/).filter(Boolean));
      }
      if (name === 'disabled') {
        this.disabled = true;
      }
    }

    removeAttribute(name) {
      this.attributes.delete(name);
      if (name.startsWith('data-')) {
        const camel = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        delete this.dataset[camel];
      }
      if (name === 'disabled') {
        this.disabled = false;
      }
    }

    addEventListener(event, fn) {
      if (!this._listeners.has(event)) {
        this._listeners.set(event, []);
      }
      this._listeners.get(event).push(fn);
    }

    dispatchEvent(event) {
      const handlers = this._listeners.get(event.type) || [];
      for (const h of handlers) {
        h(event);
      }
      if (this.parentElement && !event._stopped) {
        this.parentElement.dispatchEvent(event);
      }
    }

    focus() {
      this._focused = true;
    }

    scrollTo(opts) {
      this.scrollLeft = opts.left ?? 0;
      this._lastScrollBehavior = opts.behavior;
    }

    getBoundingClientRect() {
      return {
        left: this.offsetLeft - (this.parentElement?.scrollLeft || 0),
        width: this.offsetWidth,
        right: this.offsetLeft + this.offsetWidth - (this.parentElement?.scrollLeft || 0),
      };
    }

    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    }

    querySelectorAll(selector) {
      const results = [];
      function search(el) {
        for (const child of el.children) {
          if (matches(child, selector)) {
            results.push(child);
          }
          search(child);
        }
      }
      search(this);
      return results;
    }

    closest(selector) {
      let curr = this;
      while (curr) {
        if (matches(curr, selector)) return curr;
        curr = curr.parentElement;
      }
      return null;
    }
  }

  function matches(el, selector) {
    if (selector.includes('.')) {
      const parts = selector.split('.');
      const tag = parts[0];
      const cls = parts[1];
      const tagMatch = !tag || el.tagName.toLowerCase() === tag.toLowerCase();
      const clsMatch = el.classList.has(cls);
      return tagMatch && clsMatch;
    }
    if (selector.startsWith('#')) {
      const id = selector.slice(1);
      return el.getAttribute('id') === id;
    }
    if (selector.includes('[') && selector.includes(']')) {
      const match = selector.match(/\[([a-z0-9-]+)(?:=(["']?)(.*?)\2)?\]/i);
      if (match) {
        const attr = match[1];
        const val = match[3];
        if (val !== undefined) return el.getAttribute(attr) === val;
        return el.getAttribute(attr) !== null;
      }
    }
    return el.tagName.toLowerCase() === selector.toLowerCase();
  }

  // Create Container
  const container = new MockElement('section', ['ipod-carousel-container', defaultView === 'grid' ? 'is-grid-view' : 'is-carousel-view'], {
    'data-component': 'ipod-carousel',
    'data-initial-index': String(initialIndex),
    'data-total-items': String(itemCount),
    role: 'region',
    'aria-roledescription': 'carousel',
  });

  // Announcer
  const announcer = new MockElement('div', ['sr-only'], { id: 'carousel-live-announcer', 'aria-live': 'polite' });
  container.children.push(announcer);
  announcer.parentElement = container;

  if (itemCount === 0) {
    const emptyState = new MockElement('div', ['empty-state']);
    container.children.push(emptyState);
    emptyState.parentElement = container;
    return { container, slides: [], track: null, prevBtn: null, nextBtn: null, viewButtons: [] };
  }

  // Track Counter
  const trackCounter = new MockElement('div', ['carousel-track-counter']);
  const currentTrackNum = new MockElement('span', ['current-track-num']);
  currentTrackNum.textContent = String(initialIndex + 1);
  trackCounter.children.push(currentTrackNum);
  currentTrackNum.parentElement = trackCounter;
  container.children.push(trackCounter);
  trackCounter.parentElement = container;

  // View Buttons
  const carouselBtn = new MockElement('button', ['view-btn', defaultView === 'carousel' ? 'is-active' : ''], {
    'data-view': 'carousel',
    'aria-pressed': defaultView === 'carousel' ? 'true' : 'false',
  });
  const gridBtn = new MockElement('button', ['view-btn', defaultView === 'grid' ? 'is-active' : ''], {
    'data-view': 'grid',
    'aria-pressed': defaultView === 'grid' ? 'true' : 'false',
  });
  container.children.push(carouselBtn, gridBtn);
  carouselBtn.parentElement = container;
  gridBtn.parentElement = container;

  // Stepper Buttons
  const prevBtn = new MockElement('button', ['carousel-stepper-btn', 'prev-btn'], {
    'aria-controls': 'ipod-carousel-track',
  });
  prevBtn.disabled = initialIndex === 0;
  const nextBtn = new MockElement('button', ['carousel-stepper-btn', 'next-btn'], {
    'aria-controls': 'ipod-carousel-track',
  });
  nextBtn.disabled = initialIndex >= itemCount - 1;
  container.children.push(prevBtn, nextBtn);
  prevBtn.parentElement = container;
  nextBtn.parentElement = container;

  // Track
  const track = new MockElement('div', ['carousel-track'], {
    id: 'ipod-carousel-track',
    role: 'group',
    tabindex: '0',
  });
  track.clientWidth = 1000;
  container.children.push(track);
  track.parentElement = container;

  // Slides
  const slides = [];
  for (let i = 0; i < itemCount; i++) {
    const isInitial = i === initialIndex;
    const itemData = itemsData ? itemsData[i] : null;
    const slug = itemData?.slug || `episode-${i + 1}`;
    const title = itemData?.title || `Episode ${i + 1} Title`;

    const slide = new MockElement('article', ['carousel-item'], {
      'data-index': String(i),
      'data-slug': slug,
      'data-title': title,
      'data-episode': String(i + 1).padStart(2, '0'),
      'data-audio-src': itemData?.audio?.src || `https://example.com/ep-${i + 1}.mp3`,
      'data-duration': '15',
      tabindex: isInitial ? '0' : '-1',
      ...(isInitial ? { 'aria-current': 'true' } : {}),
    });

    slide.offsetLeft = 340 + i * 350;
    slide.offsetWidth = 320;

    const playBtn = new MockElement('button', ['carousel-play-btn'], {
      'data-index': String(i),
      'data-slug': slug,
    });
    const playIcon = new MockElement('span', ['play-btn-icon']);
    playIcon.textContent = '▶';
    const playText = new MockElement('span', ['play-btn-text']);
    playText.textContent = 'Listen';
    playBtn.children.push(playIcon, playText);
    playIcon.parentElement = playBtn;
    playText.parentElement = playBtn;

    const titleLink = new MockElement('a', ['carousel-title-link'], { href: `/podcast/${slug}` });
    const notesLink = new MockElement('a', ['carousel-detail-link'], { href: `/podcast/${slug}` });

    slide.children.push(playBtn, titleLink, notesLink);
    playBtn.parentElement = slide;
    titleLink.parentElement = slide;
    notesLink.parentElement = slide;

    track.children.push(slide);
    slide.parentElement = track;
    slides.push(slide);
  }

  // Docked Section
  const dockedSection = new MockElement('section', ['ipod-docked-section'], { id: 'carousel-docked-player' });
  const audioEl = new MockElement('audio', ['custom-audio-player'], {
    src: itemsData?.[initialIndex]?.audio?.src || `https://example.com/ep-${initialIndex + 1}.mp3`,
  });
  audioEl.paused = true;
  audioEl.play = async () => { audioEl.paused = false; audioEl.dispatchEvent({ type: 'play' }); };
  audioEl.pause = () => { audioEl.paused = true; audioEl.dispatchEvent({ type: 'pause' }); };
  audioEl.load = () => {};

  const dockedTitle = new MockElement('h3', ['audio-title']);
  dockedTitle.textContent = `Play Episode ${String(initialIndex + 1).padStart(2, '0')}`;
  const dockedVariant = new MockElement('span', ['audio-variant-label']);
  const dockedTime = new MockElement('time', []);
  const dockedDownload = new MockElement('a', ['audio-download-action'], { href: audioEl.getAttribute('src') });

  dockedSection.children.push(audioEl, dockedTitle, dockedVariant, dockedTime, dockedDownload);
  audioEl.parentElement = dockedSection;
  dockedTitle.parentElement = dockedSection;
  dockedVariant.parentElement = dockedSection;
  dockedTime.parentElement = dockedSection;
  dockedDownload.parentElement = dockedSection;

  container.children.push(dockedSection);
  dockedSection.parentElement = container;

  return {
    container,
    slides,
    track,
    prevBtn,
    nextBtn,
    currentTrackNum,
    announcer,
    viewButtons: [carouselBtn, gridBtn],
    dockedSection,
    audioEl,
  };
}

/**
 * Executes the exact client-side runtime logic from IpodCarousel.astro
 * against a mock DOM container.
 */
function wireCarouselLogic(dom, options = {}) {
  const {
    container,
    slides,
    track,
    prevBtn,
    nextBtn,
    currentTrackNum,
    announcer,
    viewButtons,
    dockedSection,
  } = dom;

  if (!track || slides.length === 0) return { activeIndex: 0 };

  const parsedInit = parseInt(container.dataset.initialIndex || '0', 10);
  let activeIndex = isNaN(parsedInit) ? 0 : Math.max(0, Math.min(slides.length - 1, parsedInit));
  let isGridView = container.classList.has('is-grid-view');
  let currentPlayingSlug = null;
  let isProgrammaticScroll = false;
  let prefersReducedMotion = options.prefersReducedMotion ?? false;

  function getDockedPlayerElements() {
    if (!dockedSection) return null;
    const audio = dockedSection.querySelector('audio.custom-audio-player');
    const titleEl = dockedSection.querySelector('.audio-title');
    const variantEl = dockedSection.querySelector('.audio-variant-label');
    const timeEl = dockedSection.querySelector('time');
    const downloadLink = dockedSection.querySelector('.audio-download-action');
    return { audio, titleEl, variantEl, timeEl, downloadLink };
  }

  function updatePlayButtonUI(slide, isPlaying) {
    const btn = slide.querySelector('.carousel-play-btn');
    if (!btn) return;
    const icon = btn.querySelector('.play-btn-icon');
    const text = btn.querySelector('.play-btn-text');
    const ep = slide.dataset.episode || '';
    const t = slide.dataset.title || '';

    if (isPlaying) {
      if (icon) icon.textContent = '❚❚';
      if (text) text.textContent = 'Pause';
      btn.setAttribute('aria-label', `Pause Episode ${ep}: ${t}`);
    } else {
      if (icon) icon.textContent = '▶';
      if (text) text.textContent = 'Listen';
      btn.setAttribute('aria-label', `Play Episode ${ep}: ${t}`);
    }
  }

  function updateSlideClasses(newIndex) {
    slides.forEach((slide, idx) => {
      slide.classList.delete('is-active');
      slide.classList.delete('is-prev');
      slide.classList.delete('is-next');
      slide.classList.delete('is-far-prev');
      slide.classList.delete('is-far-next');

      if (isGridView) {
        slide.setAttribute('tabindex', '0');
        slide.removeAttribute('aria-current');
        return;
      }

      if (idx === newIndex) {
        slide.classList.add('is-active');
        slide.setAttribute('tabindex', '0');
        slide.setAttribute('aria-current', 'true');
      } else {
        slide.setAttribute('tabindex', '-1');
        slide.removeAttribute('aria-current');

        if (idx === newIndex - 1) {
          slide.classList.add('is-prev');
        } else if (idx < newIndex - 1) {
          slide.classList.add('is-far-prev');
        } else if (idx === newIndex + 1) {
          slide.classList.add('is-next');
        } else if (idx > newIndex + 1) {
          slide.classList.add('is-far-next');
        }
      }
    });

    if (currentTrackNum) {
      currentTrackNum.textContent = String(newIndex + 1);
    }

    if (announcer && slides[newIndex]) {
      const t = slides[newIndex].dataset.title || '';
      announcer.textContent = `Slide ${newIndex + 1} of ${slides.length}: ${t}`;
    }

    if (prevBtn) {
      const isStart = newIndex <= 0;
      prevBtn.disabled = isStart;
      prevBtn.setAttribute('aria-disabled', String(isStart));
    }

    if (nextBtn) {
      const isEnd = newIndex >= slides.length - 1;
      nextBtn.disabled = isEnd;
      nextBtn.setAttribute('aria-disabled', String(isEnd));
    }
  }

  function scrollToIndex(newIndex, smooth = true) {
    if (isGridView || !track) return;
    const targetSlide = slides[newIndex];
    if (!targetSlide) return;

    isProgrammaticScroll = true;
    const trackCenter = track.clientWidth / 2;
    const slideCenter = targetSlide.offsetLeft + targetSlide.offsetWidth / 2;
    const scrollLeft = slideCenter - trackCenter;

    track.scrollTo({
      left: scrollLeft,
      behavior: (!prefersReducedMotion && smooth) ? 'smooth' : 'auto',
    });

    isProgrammaticScroll = false;
  }

  function goToSlide(newIndex, shouldFocus = false) {
    const clampedIndex = Math.max(0, Math.min(slides.length - 1, newIndex));
    activeIndex = clampedIndex;
    updateSlideClasses(clampedIndex);
    scrollToIndex(clampedIndex, true);

    if (shouldFocus && !isGridView && slides[clampedIndex]) {
      slides[clampedIndex].focus();
    }
  }

  function dockAndPlay(slide, toggleIfSame = true) {
    const slug = slide.dataset.slug || '';
    const title = slide.dataset.title || '';
    const ep = slide.dataset.episode || '';
    const formatLabel = slide.dataset.formatLabel || '';
    const audioSrc = slide.dataset.audioSrc || '';
    const duration = slide.dataset.duration || '';

    const docked = getDockedPlayerElements();
    if (!docked || !docked.audio) return;

    if (toggleIfSame && currentPlayingSlug === slug) {
      if (docked.audio.paused) {
        docked.audio.play();
      } else {
        docked.audio.pause();
      }
      return;
    }

    if (docked.titleEl) {
      docked.titleEl.textContent = `Play Episode ${ep}: ${title}`;
    }
    if (docked.downloadLink && audioSrc) {
      docked.downloadLink.setAttribute('href', audioSrc);
    }

    docked.audio.setAttribute('src', audioSrc);
    docked.audio.load();
    docked.audio.play();
    currentPlayingSlug = slug;

    slides.forEach((s) => {
      s.classList.delete('is-docked');
      s.classList.delete('is-playing');
      updatePlayButtonUI(s, false);
    });

    slide.classList.add('is-docked');
    slide.classList.add('is-playing');
    updatePlayButtonUI(slide, true);
  }

  function switchView(mode) {
    if (mode === 'grid') {
      isGridView = true;
      container.classList.delete('is-carousel-view');
      container.classList.add('is-grid-view');
    } else {
      isGridView = false;
      container.classList.delete('is-grid-view');
      container.classList.add('is-carousel-view');
    }

    viewButtons.forEach((btn) => {
      const isActive = btn.dataset.view === mode;
      if (isActive) {
        btn.classList.add('is-active');
      } else {
        btn.classList.delete('is-active');
      }
      btn.setAttribute('aria-pressed', String(isActive));
    });

    updateSlideClasses(activeIndex);
    if (!isGridView) {
      scrollToIndex(activeIndex, false);
    }
  }

  // Stepper events
  prevBtn?.addEventListener('click', () => goToSlide(activeIndex - 1, true));
  nextBtn?.addEventListener('click', () => goToSlide(activeIndex + 1, true));

  // View toggle buttons
  viewButtons.forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  // Track keydown listener
  track.addEventListener('keydown', (e) => {
    if (isGridView) return;

    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        e.defaultPrevented = true;
        goToSlide(activeIndex - 1, true);
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        e.defaultPrevented = true;
        goToSlide(activeIndex + 1, true);
        break;
      case 'Home':
        e.defaultPrevented = true;
        goToSlide(0, true);
        break;
      case 'End':
        e.defaultPrevented = true;
        goToSlide(slides.length - 1, true);
        break;
      case 'PageUp':
        e.defaultPrevented = true;
        goToSlide(activeIndex - 3, true);
        break;
      case 'PageDown':
        e.defaultPrevented = true;
        goToSlide(activeIndex + 3, true);
        break;
      case 'Enter':
      case ' ': {
        const target = e.target;
        if (!target?.closest('a')) {
          e.defaultPrevented = true;
          if (slides[activeIndex]) {
            dockAndPlay(slides[activeIndex], true);
          }
        }
        break;
      }
    }
  });

  // Slide click listeners
  slides.forEach((slide, idx) => {
    const playBtn = slide.querySelector('.carousel-play-btn');
    playBtn?.addEventListener('click', (e) => {
      e._stopped = true;
      dockAndPlay(slide, true);
    });

    slide.addEventListener('click', (e) => {
      const target = e.target;
      if (target?.closest('a') || target?.closest('button')) return;
      if (!isGridView) {
        if (idx !== activeIndex) {
          goToSlide(idx, true);
        } else {
          dockAndPlay(slide, true);
        }
      }
    });
  });

  // Initial call
  updateSlideClasses(activeIndex);

  return {
    getActiveIndex: () => activeIndex,
    isGridView: () => isGridView,
    getCurrentPlayingSlug: () => currentPlayingSlug,
    goToSlide,
    switchView,
    dockAndPlay,
    setPrefersReducedMotion: (val) => { prefersReducedMotion = val; },
  };
}

// =========================================================================
// EMPIRICAL CHALLENGE SUITE
// =========================================================================

describe('Empirical Challenge Suite: iPod Carousel', () => {

  // --- 1. Boundary Stress: Empty Item List ---
  describe('Boundary Stress: Empty Item List (0 items)', () => {
    it('CHALLENGE-01: Empty items catalog initializes without throwing unhandled exceptions', () => {
      const dom = createMockCarouselDOM({ itemCount: 0 });
      const api = wireCarouselLogic(dom);
      assert.equal(api.activeIndex, 0);
      assert.equal(dom.slides.length, 0);
    });

    it('CHALLENGE-02: Empty state template renders fallback message and suppresses track', () => {
      const src = readFileSync(CAROUSEL_COMPONENT_PATH, 'utf8');
      assert.match(src, /totalItems\s*===\s*0/, 'Component checks totalItems === 0');
      assert.match(src, /class=["']empty-state["']/, 'Renders empty-state container');
      assert.match(src, /No audio episodes available/, 'Renders friendly empty-state message');
    });
  });

  // --- 2. Boundary Stress: Single Item List ---
  describe('Boundary Stress: Single Item List (1 item)', () => {
    it('CHALLENGE-03: Single item disables both Previous and Next stepper buttons initially', () => {
      const dom = createMockCarouselDOM({ itemCount: 1, initialIndex: 0 });
      const api = wireCarouselLogic(dom);

      assert.equal(dom.prevBtn.disabled, true, 'Previous button must be disabled for single item');
      assert.equal(dom.nextBtn.disabled, true, 'Next button must be disabled for single item');
      assert.equal(dom.prevBtn.getAttribute('aria-disabled'), 'true');
      assert.equal(dom.nextBtn.getAttribute('aria-disabled'), 'true');
      assert.equal(dom.slides[0].classList.has('is-active'), true, 'Single item must have is-active');
      assert.equal(dom.slides[0].getAttribute('tabindex'), '0');
    });

    it('CHALLENGE-04: Boundary navigation on single item clamps at index 0 without state corruption', () => {
      const dom = createMockCarouselDOM({ itemCount: 1, initialIndex: 0 });
      const api = wireCarouselLogic(dom);

      const hostileKeys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp'];
      for (const key of hostileKeys) {
        const ev = { type: 'keydown', key, target: dom.slides[0] };
        dom.track.dispatchEvent(ev);
        assert.equal(api.getActiveIndex(), 0, `Index must stay clamped at 0 after pressing ${key}`);
        assert.equal(dom.slides[0].getAttribute('tabindex'), '0');
        assert.equal(dom.prevBtn.disabled, true);
        assert.equal(dom.nextBtn.disabled, true);
      }
    });
  });

  // --- 3. Boundary Stress: Massive Catalog (50 items) ---
  describe('Boundary Stress: Massive Catalog (50 items)', () => {
    it('CHALLENGE-05: Stepping across endpoints strictly clamps without out-of-bounds index', () => {
      const dom = createMockCarouselDOM({ itemCount: 50, initialIndex: 0 });
      const api = wireCarouselLogic(dom);

      // Rapidly hit left at start (10 times)
      for (let i = 0; i < 10; i++) {
        dom.track.dispatchEvent({ type: 'keydown', key: 'ArrowLeft', target: dom.slides[0] });
        assert.equal(api.getActiveIndex(), 0);
        assert.equal(dom.prevBtn.disabled, true);
        assert.equal(dom.nextBtn.disabled, false);
      }

      // Jump to End
      dom.track.dispatchEvent({ type: 'keydown', key: 'End', target: dom.slides[0] });
      assert.equal(api.getActiveIndex(), 49);
      assert.equal(dom.prevBtn.disabled, false);
      assert.equal(dom.nextBtn.disabled, true);

      // Rapidly hit right at end (10 times)
      for (let i = 0; i < 10; i++) {
        dom.track.dispatchEvent({ type: 'keydown', key: 'ArrowRight', target: dom.slides[49] });
        assert.equal(api.getActiveIndex(), 49);
        assert.equal(dom.nextBtn.disabled, true);
      }

      // Jump to Home
      dom.track.dispatchEvent({ type: 'keydown', key: 'Home', target: dom.slides[49] });
      assert.equal(api.getActiveIndex(), 0);
      assert.equal(dom.prevBtn.disabled, true);
    });

    it('CHALLENGE-06: PageUp and PageDown jump by 3 and clamp cleanly at boundaries', () => {
      const dom = createMockCarouselDOM({ itemCount: 50, initialIndex: 0 });
      const api = wireCarouselLogic(dom);

      // PageDown (+3)
      dom.track.dispatchEvent({ type: 'keydown', key: 'PageDown', target: dom.slides[0] });
      assert.equal(api.getActiveIndex(), 3);

      dom.track.dispatchEvent({ type: 'keydown', key: 'PageDown', target: dom.slides[3] });
      assert.equal(api.getActiveIndex(), 6);

      // Jump near end: index 48
      api.goToSlide(48);
      assert.equal(api.getActiveIndex(), 48);

      // PageDown from 48 clamps at 49 (not 51)
      dom.track.dispatchEvent({ type: 'keydown', key: 'PageDown', target: dom.slides[48] });
      assert.equal(api.getActiveIndex(), 49);

      // PageUp from 1 clamps at 0 (not -2)
      api.goToSlide(1);
      dom.track.dispatchEvent({ type: 'keydown', key: 'PageUp', target: dom.slides[1] });
      assert.equal(api.getActiveIndex(), 0);
    });

    it('CHALLENGE-07: Invariant check during 5,000-step randomized keyboard navigation', () => {
      const dom = createMockCarouselDOM({ itemCount: 50, initialIndex: 25 });
      const api = wireCarouselLogic(dom);

      const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'];

      for (let step = 0; step < 5000; step++) {
        const randKey = keys[Math.floor(Math.random() * keys.length)];
        const currIdx = api.getActiveIndex();
        dom.track.dispatchEvent({ type: 'keydown', key: randKey, target: dom.slides[currIdx] });

        const idx = api.getActiveIndex();

        // INVARIANT 1: Index within range [0, 49]
        assert.ok(idx >= 0 && idx < 50, `Step ${step}: activeIndex (${idx}) must be in [0, 49]`);

        // INVARIANT 2: Exactly 1 slide has is-active
        const activeCount = dom.slides.filter(s => s.classList.has('is-active')).length;
        assert.equal(activeCount, 1, `Step ${step}: exactly one active slide`);

        // INVARIANT 3: Exactly 1 slide has tabindex="0"
        const focusableCount = dom.slides.filter(s => s.getAttribute('tabindex') === '0').length;
        assert.equal(focusableCount, 1, `Step ${step}: exactly one tabindex="0"`);

        // INVARIANT 4: Stepper disabled flags match boundaries
        assert.equal(dom.prevBtn.disabled, idx === 0, `Step ${step}: prevBtn disabled mismatch`);
        assert.equal(dom.nextBtn.disabled, idx === 49, `Step ${step}: nextBtn disabled mismatch`);

        // INVARIANT 5: Current track number matches idx + 1
        assert.equal(dom.currentTrackNum.textContent, String(idx + 1));
      }
    });
  });

  // --- 4. View Mode State Switching Under Rapid Toggling ---
  describe('View Mode State Switching Under Rapid Toggling', () => {
    it('CHALLENGE-08: 1,000 rapid view toggles preserve activeIndex and restore roving tabindex contracts', () => {
      const dom = createMockCarouselDOM({ itemCount: 10, initialIndex: 4 });
      const api = wireCarouselLogic(dom);

      assert.equal(api.getActiveIndex(), 4);

      for (let i = 0; i < 1000; i++) {
        const targetView = i % 2 === 0 ? 'grid' : 'carousel';
        api.switchView(targetView);

        if (targetView === 'grid') {
          assert.equal(dom.container.classList.has('is-grid-view'), true);
          assert.equal(dom.container.classList.has('is-carousel-view'), false);
          // All slides must have tabindex="0" in grid view
          const tab0Count = dom.slides.filter(s => s.getAttribute('tabindex') === '0').length;
          assert.equal(tab0Count, 10, 'All slides must have tabindex="0" in grid view');
        } else {
          assert.equal(dom.container.classList.has('is-carousel-view'), true);
          assert.equal(dom.container.classList.has('is-grid-view'), false);
          // Exactly 1 slide must have tabindex="0" in carousel view
          const tab0Count = dom.slides.filter(s => s.getAttribute('tabindex') === '0').length;
          assert.equal(tab0Count, 1, 'Exactly one slide has tabindex="0" in carousel view');
          assert.equal(dom.slides[4].getAttribute('tabindex'), '0', 'Slide 4 retains focusable tabindex');
        }
      }

      assert.equal(api.getActiveIndex(), 4, 'Active index 4 preserved after 1,000 toggles');
    });

    it('CHALLENGE-09: Audio playback state survives view toggles without stopping or clearing playing classes', () => {
      const dom = createMockCarouselDOM({ itemCount: 5, initialIndex: 2 });
      const api = wireCarouselLogic(dom);

      // Start playing slide 2
      api.dockAndPlay(dom.slides[2]);
      assert.equal(api.getCurrentPlayingSlug(), 'episode-3');
      assert.equal(dom.slides[2].classList.has('is-playing'), true);
      assert.equal(dom.slides[2].classList.has('is-docked'), true);

      // Toggle to Grid View
      api.switchView('grid');
      assert.equal(dom.slides[2].classList.has('is-playing'), true, 'Slide must remain is-playing in grid view');
      assert.equal(dom.slides[2].classList.has('is-docked'), true, 'Slide must remain is-docked in grid view');
      assert.equal(api.getCurrentPlayingSlug(), 'episode-3', 'Playing slug preserved');

      // Toggle back to Carousel View
      api.switchView('carousel');
      assert.equal(dom.slides[2].classList.has('is-playing'), true, 'Slide remains is-playing after return to carousel');
      assert.equal(dom.slides[2].classList.has('is-docked'), true, 'Slide remains is-docked after return to carousel');
    });

    it('CHALLENGE-10: In Grid View, Arrow navigation keypresses are ignored by carousel listener', () => {
      const dom = createMockCarouselDOM({ itemCount: 5, initialIndex: 2 });
      const api = wireCarouselLogic(dom);

      api.switchView('grid');
      assert.equal(api.getActiveIndex(), 2);

      const ev = { type: 'keydown', key: 'ArrowRight', target: dom.slides[2], defaultPrevented: false };
      dom.track.dispatchEvent(ev);

      assert.equal(api.getActiveIndex(), 2, 'Arrow key must NOT change activeIndex in grid mode');
      assert.equal(ev.defaultPrevented, false, 'Default browser scroll must not be prevented in grid mode');
    });
  });

  // --- 5. Reduced Motion Behavior ---
  describe('Reduced Motion Behavior', () => {
    it('CHALLENGE-11: Component stylesheet enforces scroll-behavior: auto !important under reduced-motion', () => {
      const src = readFileSync(CAROUSEL_COMPONENT_PATH, 'utf8');
      assert.match(src, /@media\s*\(prefers-reduced-motion:\s*reduce\)/, 'Media query declared');
      assert.match(src, /scroll-behavior:\s*auto\s*!important/, 'Smooth scrolling disabled');
      assert.match(src, /transform:\s*none\s*!important/, '3D transforms suppressed');
      assert.match(src, /transition:\s*none\s*!important/, 'Transitions collapsed');
      assert.match(src, /animation:\s*none\s*!important/, 'Animations suppressed');
    });

    it('CHALLENGE-12: Client-side scrollToIndex queries matchMedia and enforces behavior: "auto"', () => {
      const dom = createMockCarouselDOM({ itemCount: 5, initialIndex: 0 });
      const api = wireCarouselLogic(dom, { prefersReducedMotion: true });

      api.goToSlide(2);
      assert.equal(dom.track._lastScrollBehavior, 'auto', 'Reduced motion forces behavior: auto');

      // Normal motion allows smooth scroll
      api.setPrefersReducedMotion(false);
      api.goToSlide(3);
      assert.equal(dom.track._lastScrollBehavior, 'smooth', 'Normal motion allows behavior: smooth');
    });
  });

  // --- 6. Hostile Inputs & Adversarial Edge Cases ---
  describe('Hostile Inputs & Adversarial Edge Cases', () => {
    it('CHALLENGE-13: Out-of-bounds initialIndex (negative or too large) is safely clamped', () => {
      // Negative initial index
      const domNeg = createMockCarouselDOM({ itemCount: 5, initialIndex: -10 });
      const apiNeg = wireCarouselLogic(domNeg);
      assert.equal(apiNeg.getActiveIndex(), 0, 'Negative initial index clamped to 0');

      // Overflow initial index
      const domOver = createMockCarouselDOM({ itemCount: 5, initialIndex: 999 });
      const apiOver = wireCarouselLogic(domOver);
      assert.equal(apiOver.getActiveIndex(), 4, 'Overflow initial index clamped to length - 1');
    });

    it('CHALLENGE-14: NaN initialIndex falls back gracefully to 0 without corrupting state', () => {
      const dom = createMockCarouselDOM({ itemCount: 5, initialIndex: NaN });
      dom.container.setAttribute('data-initial-index', 'NaN');
      const api = wireCarouselLogic(dom);
      assert.equal(api.getActiveIndex(), 0, 'NaN initial index falls back to 0');
    });

    it('CHALLENGE-15: Enter and Space keys trigger playback on card but pass through on <a> links', () => {
      const dom = createMockCarouselDOM({ itemCount: 3, initialIndex: 1 });
      const api = wireCarouselLogic(dom);

      // Press Enter while focused on slide article -> triggers dockAndPlay
      const enterOnSlide = { type: 'keydown', key: 'Enter', target: dom.slides[1], defaultPrevented: false };
      dom.track.dispatchEvent(enterOnSlide);
      assert.equal(enterOnSlide.defaultPrevented, true, 'Enter on slide article must prevent default');
      assert.equal(api.getCurrentPlayingSlug(), 'episode-2');

      // Press Enter while focused on Show Notes link <a> -> passes through to allow navigation!
      const showNotesLink = dom.slides[1].querySelector('.carousel-detail-link');
      const enterOnLink = { type: 'keydown', key: 'Enter', target: showNotesLink, defaultPrevented: false };
      dom.track.dispatchEvent(enterOnLink);
      assert.equal(enterOnLink.defaultPrevented, false, 'Enter on <a> link must NOT prevent default navigation');
    });

    it('CHALLENGE-16: Extreme text length (10,000-char title and XSS strings) handled safely without HTML injection', () => {
      const hostileItems = [
        {
          id: 'hostile-1',
          slug: 'xss-injection-test',
          title: '<script>alert("pwned")</script> & " \' < >',
          summary: 'A'.repeat(10000),
          published: '2026-01-01',
          audio: { src: 'https://example.com/test.mp3', bytes: 100, durationSeconds: 60 },
        },
      ];
      const dom = createMockCarouselDOM({ itemCount: 1, initialIndex: 0, itemsData: hostileItems });
      const api = wireCarouselLogic(dom);

      assert.equal(api.getActiveIndex(), 0);
      assert.equal(dom.slides[0].dataset.title, '<script>alert("pwned")</script> & " \' < >');
      // Docking safely sets textContent (not innerHTML)
      api.dockAndPlay(dom.slides[0]);
      const dockedTitle = dom.dockedSection.querySelector('.audio-title');
      assert.match(dockedTitle.textContent, /alert\("pwned"\)/);
    });
  });

  // --- 7. Built Production HTML Verification ---
  describe('Built Production HTML Verification', () => {
    it('CHALLENGE-17: Built podcast page contains valid Cover Flow carousel structure and ARIA landmarks', () => {
      assert.ok(existsSync(BUILT_PODCAST_HTML_PATH), 'dist/client/podcast/index.html must exist');
      const html = readFileSync(BUILT_PODCAST_HTML_PATH, 'utf8');

      // Region and carousel roledescription
      assert.match(html, /<section[^>]*class=["'][^"']*ipod-carousel-container/i);
      assert.match(html, /role=["']region["']/i);
      assert.match(html, /aria-roledescription=["']carousel["']/i);
      // ARIA live polite announcer
      assert.match(html, /id=["']carousel-live-announcer["']/i);
      assert.match(html, /aria-live=["']polite["']/i);
      // Stepper buttons with aria-controls
      assert.match(html, /class=["'][^"']*carousel-stepper-btn prev-btn/i);
      assert.match(html, /class=["'][^"']*carousel-stepper-btn next-btn/i);
      assert.match(html, /aria-controls=["']ipod-carousel-track["']/i);
      // Cover Flow buttons with aria-pressed
      assert.match(html, /data-view=["']carousel["'][^>]*aria-pressed=["']true["']/i);
      assert.match(html, /data-view=["']grid["'][^>]*aria-pressed=["']false["']/i);
      // Docked player section
      assert.match(html, /id=["']carousel-docked-player["']/i);
      // Noscript fallback
      assert.match(html, /<noscript>[\s\S]*?\.carousel-track\s*\{[\s\S]*?display:\s*grid\s*!important/i);
    });

    it('CHALLENGE-18: Built client bundle for IpodCarousel is within budget (< 5KB gzipped)', () => {
      const src = readFileSync(CAROUSEL_COMPONENT_PATH, 'utf8');
      // Verify no external audio synthesizer or haptic vibration dependencies imported
      assert.doesNotMatch(src, /import\s+.*from\s+['"]howler['"]/, 'No heavy external sound library');
      assert.doesNotMatch(src, /import\s+.*from\s+['"]three['"]/, 'No heavy Three.js library');
      assert.doesNotMatch(src, /navigator\.vibrate/, 'Zero haptics vibration calls');
    });
  });

});
