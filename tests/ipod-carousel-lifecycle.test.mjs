/**
 * Adversarial Empirical Test Suite: iPod Carousel Audio Lifecycle & Docking
 *
 * Specifically verifies:
 * 1. Exclusive Playback (Docked player vs page players, mutual pausing, UI synchronization)
 * 2. Dynamic Cueing (Metadata updates, speed preservation, toggle play/pause, custom events)
 * 3. Fallback Grid Docking (Grid play button, card click behavior, keyboard handling, activeIndex sync)
 * 4. Extensionless URL resolution for show notes
 * 5. Adversarial Edge Cases & Failure Modes
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

const ROOT_DIR = process.cwd();
const EPISODES_DIR = path.join(ROOT_DIR, 'content', 'episodes');

// --- Lightweight DOM Environment Simulation ---

class MockClassList {
  constructor(el) {
    this.el = el;
    this._classes = new Set();
  }
  add(...tokens) {
    tokens.forEach(t => this._classes.add(t));
    this._sync();
  }
  remove(...tokens) {
    tokens.forEach(t => this._classes.delete(t));
    this._sync();
  }
  toggle(token, force) {
    let result;
    if (force !== undefined) {
      if (force) this._classes.add(token);
      else this._classes.delete(token);
      result = force;
    } else {
      if (this._classes.has(token)) {
        this._classes.delete(token);
        result = false;
      } else {
        this._classes.add(token);
        result = true;
      }
    }
    this._sync();
    return result;
  }
  contains(token) {
    return this._classes.has(token);
  }
  _sync() {
    this.el.className = Array.from(this._classes).join(' ');
  }
  _load(className) {
    this._classes = new Set((className || '').split(/\s+/).filter(Boolean));
  }
}

class MockElement {
  constructor(tagName = 'div', attributes = {}) {
    this.tagName = tagName.toUpperCase();
    this.attributes = { ...attributes };
    this.children = [];
    this.parentNode = null;
    this.listeners = new Map();
    this.dataset = {};
    this.classList = new MockClassList(this);
    this.style = {};
    this._textContent = '';
    this.disabled = false;

    for (const [k, v] of Object.entries(attributes)) {
      if (k === 'class') {
        this.classList._load(v);
      } else if (k.startsWith('data-')) {
        const camel = k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        this.dataset[camel] = String(v);
      }
    }
  }

  get textContent() {
    return this._textContent;
  }
  set textContent(val) {
    this._textContent = String(val);
  }

  get offsetLeft() { return 0; }
  get offsetWidth() { return 320; }
  get clientWidth() { return 800; }

  getBoundingClientRect() {
    return { left: 0, right: 320, width: 320, top: 0, bottom: 300, height: 300 };
  }

  getAttribute(name) {
    if (name === 'class') return this.classList.contains.length ? Array.from(this.classList._classes).join(' ') : null;
    return this.attributes[name] ?? null;
  }

  setAttribute(name, val) {
    this.attributes[name] = String(val);
    if (name === 'class') {
      this.classList._load(val);
    } else if (name.startsWith('data-')) {
      const camel = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      this.dataset[camel] = String(val);
    }
  }

  removeAttribute(name) {
    delete this.attributes[name];
    if (name === 'class') {
      this.classList._classes.clear();
    } else if (name.startsWith('data-')) {
      const camel = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      delete this.dataset[camel];
    }
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  addEventListener(event, fn, options = false) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push({ fn, useCapture: typeof options === 'boolean' ? options : !!options.capture });
  }

  removeEventListener(event, fn) {
    if (!this.listeners.has(event)) return;
    const filtered = this.listeners.get(event).filter(l => l.fn !== fn);
    this.listeners.set(event, filtered);
  }

  dispatchEvent(event) {
    event.target = this;
    event.currentTarget = this;

    // Trigger local listeners
    const handlers = this.listeners.get(event.type) || [];
    for (const h of handlers) {
      h.fn.call(this, event);
    }

    // Bubbles
    if (event.bubbles && this.parentNode) {
      this.parentNode.dispatchEvent(event);
    }
    return !event.defaultPrevented;
  }

  closest(selector) {
    let curr = this;
    while (curr) {
      if (curr.matches && curr.matches(selector)) return curr;
      curr = curr.parentNode;
    }
    return null;
  }

  matches(selector) {
    if (selector.startsWith('.')) {
      return this.classList.contains(selector.slice(1));
    }
    if (selector.startsWith('#')) {
      return this.attributes.id === selector.slice(1);
    }
    if (selector === this.tagName.toLowerCase() || selector === this.tagName) {
      return true;
    }
    if (selector.startsWith('[') && selector.endsWith(']')) {
      const inner = selector.slice(1, -1);
      if (inner.includes('=')) {
        const [k, rawV] = inner.split('=');
        const v = rawV.replace(/['"]/g, '');
        return this.getAttribute(k) === v;
      }
      return this.getAttribute(inner) !== null;
    }
    return false;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const results = [];
    function traverse(node) {
      for (const child of node.children) {
        if (child.matches(selector)) {
          results.push(child);
        }
        traverse(child);
      }
    }
    traverse(this);
    return results;
  }

  focus() {
    this.isFocused = true;
  }

  scrollTo(options) {
    this.scrollOptions = options;
  }

  click() {
    const ev = new MockEvent('click', { bubbles: true, cancelable: true });
    this.dispatchEvent(ev);
  }
}

class MockAudioElement extends MockElement {
  constructor(attributes = {}) {
    super('audio', attributes);
    this.paused = true;
    this.playbackRate = 1.0;
    this.defaultPlaybackRate = 1.0;
    this.loadCount = 0;
    this.playCount = 0;
    this.pauseCount = 0;
  }

  get src() {
    return this.getAttribute('src') || '';
  }
  set src(val) {
    this.setAttribute('src', val);
  }

  load() {
    this.loadCount++;
    this.playbackRate = 1.0;
  }

  async play() {
    this.paused = false;
    this.playCount++;
    const ev = new MockEvent('play', { bubbles: false, cancelable: true });
    this.dispatchEvent(ev);
    if (this.ownerDocument) {
      this.ownerDocument.dispatchEvent(new MockEvent('play', { bubbles: true, cancelable: true, target: this }));
    }
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
    this.pauseCount++;
    const ev = new MockEvent('pause', { bubbles: false, cancelable: true });
    this.dispatchEvent(ev);
    if (this.ownerDocument) {
      this.ownerDocument.dispatchEvent(new MockEvent('pause', { bubbles: true, cancelable: true, target: this }));
    }
  }
}

class MockEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.bubbles = init.bubbles ?? false;
    this.cancelable = init.cancelable ?? false;
    this.defaultPrevented = false;
    this.target = init.target ?? null;
    this.currentTarget = null;
    this.key = init.key ?? '';
    this.detail = init.detail ?? null;
  }
  preventDefault() {
    this.defaultPrevented = true;
  }
  stopPropagation() {}
}

class MockDocument extends MockElement {
  constructor() {
    super('#document');
    this.body = new MockElement('body');
    this.appendChild(this.body);
    this.readyState = 'complete';
  }
  querySelectorAll(sel) {
    return this.body.querySelectorAll(sel);
  }
  querySelector(sel) {
    return this.body.querySelector(sel);
  }
  getElementById(id) {
    return this.querySelector(`#${id}`);
  }
}

// --- DOM Setup Helper ---

function createPodcastPageDom() {
  const doc = new MockDocument();

  // 1. Carousel Container
  const carouselContainer = new MockElement('section', {
    class: 'ipod-carousel-container is-carousel-view',
    'data-component': 'ipod-carousel',
    'data-initial-index': '0',
    'data-total-items': '2',
    role: 'region',
    'aria-label': 'Featured Audio & Episodes',
  });
  doc.body.appendChild(carouselContainer);

  // Announcer
  const announcer = new MockElement('div', { id: 'carousel-live-announcer', class: 'sr-only' });
  carouselContainer.appendChild(announcer);

  // Toolbar
  const toolbar = new MockElement('div', { class: 'carousel-toolbar', role: 'toolbar' });
  const trackCounter = new MockElement('div', { class: 'carousel-track-counter' });
  const currentTrackNum = new MockElement('span', { class: 'current-track-num' });
  currentTrackNum.textContent = '1';
  trackCounter.appendChild(currentTrackNum);
  toolbar.appendChild(trackCounter);

  const viewGroup = new MockElement('div', { class: 'view-mode-toggle' });
  const carouselBtn = new MockElement('button', { class: 'view-btn is-active', 'data-view': 'carousel', 'aria-pressed': 'true' });
  const gridBtn = new MockElement('button', { class: 'view-btn', 'data-view': 'grid', 'aria-pressed': 'false' });
  viewGroup.appendChild(carouselBtn);
  viewGroup.appendChild(gridBtn);
  toolbar.appendChild(viewGroup);
  carouselContainer.appendChild(toolbar);

  // Stage
  const stage = new MockElement('div', { class: 'ipod-carousel-stage' });
  const prevBtn = new MockElement('button', { class: 'carousel-stepper-btn prev-btn', disabled: 'true' });
  const nextBtn = new MockElement('button', { class: 'carousel-stepper-btn next-btn' });
  stage.appendChild(prevBtn);
  stage.appendChild(nextBtn);

  // Track
  const track = new MockElement('div', { class: 'carousel-track', id: 'ipod-carousel-track', tabindex: '0' });
  stage.appendChild(track);
  carouselContainer.appendChild(stage);

  // Slides
  const slide1 = new MockElement('article', {
    class: 'carousel-item is-active',
    'data-index': '0',
    'data-slug': 'the-50b-ai-partnership-bubble',
    'data-title': 'The $50B AI Partnership Bubble',
    'data-episode': '01',
    'data-format': 'briefing',
    'data-format-label': 'Executive Briefing',
    'data-audio-src': 'https://blob.vercel.com/ep01.mp3',
    'data-duration': '5',
    tabindex: '0',
  });
  const playBtn1 = new MockElement('button', { class: 'carousel-play-btn', 'data-index': '0', 'data-slug': 'the-50b-ai-partnership-bubble' });
  const playIcon1 = new MockElement('span', { class: 'play-btn-icon' });
  playIcon1.textContent = '▶';
  const playText1 = new MockElement('span', { class: 'play-btn-text' });
  playText1.textContent = 'Listen';
  playBtn1.appendChild(playIcon1);
  playBtn1.appendChild(playText1);
  slide1.appendChild(playBtn1);
  track.appendChild(slide1);

  const slide2 = new MockElement('article', {
    class: 'carousel-item is-next',
    'data-index': '1',
    'data-slug': 'big-tech-ai-investments-the-great-accounting-debate',
    'data-title': 'Big Tech AI Investments: Debate',
    'data-episode': '02',
    'data-format': 'debate',
    'data-format-label': 'Point · Counterpoint',
    'data-audio-src': 'https://blob.vercel.com/ep02.mp3',
    'data-duration': '15',
    tabindex: '-1',
  });
  const playBtn2 = new MockElement('button', { class: 'carousel-play-btn', 'data-index': '1', 'data-slug': 'big-tech-ai-investments-the-great-accounting-debate' });
  const playIcon2 = new MockElement('span', { class: 'play-btn-icon' });
  playIcon2.textContent = '▶';
  const playText2 = new MockElement('span', { class: 'play-btn-text' });
  playText2.textContent = 'Listen';
  playBtn2.appendChild(playIcon2);
  playBtn2.appendChild(playText2);
  slide2.appendChild(playBtn2);
  track.appendChild(slide2);

  // Rotary
  const rotaryWrapper = new MockElement('div', { class: 'rotary-dial-wrapper' });
  const rotaryDisc = new MockElement('div', { class: 'rotary-wheel-disc' });
  const rotaryLeft = new MockElement('button', { class: 'rotary-btn rotary-left-btn' });
  const rotaryRight = new MockElement('button', { class: 'rotary-btn rotary-right-btn' });
  const rotaryCenter = new MockElement('button', { class: 'rotary-center-btn' });
  const rotaryTop = new MockElement('button', { class: 'rotary-btn rotary-top-btn' });
  rotaryDisc.appendChild(rotaryLeft);
  rotaryDisc.appendChild(rotaryRight);
  rotaryDisc.appendChild(rotaryCenter);
  rotaryDisc.appendChild(rotaryTop);
  rotaryWrapper.appendChild(rotaryDisc);
  carouselContainer.appendChild(rotaryWrapper);

  // Docked Section
  const dockedSection = new MockElement('section', { class: 'ipod-docked-section has-docked-audio', id: 'carousel-docked-player' });
  const dockedWrapper = new MockElement('div', { class: 'docked-player-wrapper' });
  const dockedPlayerContainer = new MockElement('div', { class: 'audio-player-container', id: 'player-carousel-docked-station' });
  const dockedTitle = new MockElement('h3', { class: 'audio-title' });
  dockedTitle.textContent = 'Play Episode 01: The $50B AI Partnership Bubble';
  const dockedMeta = new MockElement('p', { class: 'audio-meta' });
  const dockedVariant = new MockElement('span', { class: 'audio-variant-label' });
  dockedVariant.textContent = 'Executive Briefing';
  const dockedTime = new MockElement('time');
  dockedTime.textContent = '5 min';
  dockedMeta.appendChild(dockedVariant);
  dockedMeta.appendChild(dockedTime);
  dockedPlayerContainer.appendChild(dockedTitle);
  dockedPlayerContainer.appendChild(dockedMeta);

  const dockedAudio = new MockAudioElement({ class: 'custom-audio-player', src: 'https://blob.vercel.com/ep01.mp3' });
  dockedAudio.ownerDocument = doc;
  dockedPlayerContainer.appendChild(dockedAudio);

  const speedSelector = new MockElement('div', { class: 'audio-speed-selector' });
  const speed1 = new MockElement('button', { class: 'speed-btn is-active', 'data-speed': '1' });
  const speed125 = new MockElement('button', { class: 'speed-btn', 'data-speed': '1.25' });
  const speed15 = new MockElement('button', { class: 'speed-btn', 'data-speed': '1.5' });
  speedSelector.appendChild(speed1);
  speedSelector.appendChild(speed125);
  speedSelector.appendChild(speed15);
  dockedPlayerContainer.appendChild(speedSelector);

  const downloadLink = new MockElement('a', { class: 'audio-download-action', href: 'https://blob.vercel.com/ep01.mp3' });
  dockedPlayerContainer.appendChild(downloadLink);

  dockedWrapper.appendChild(dockedPlayerContainer);
  dockedSection.appendChild(dockedWrapper);
  carouselContainer.appendChild(dockedSection);

  // 2. Standalone EpisodeCard Player
  const episodeCardContainer = new MockElement('div', { class: 'audio-player-container', id: 'player-card-ep01' });
  const cardAudio = new MockAudioElement({ class: 'custom-audio-player', src: 'https://blob.vercel.com/ep01.mp3' });
  cardAudio.ownerDocument = doc;
  const cardSpeed1 = new MockElement('button', { class: 'speed-btn is-active', 'data-speed': '1' });
  episodeCardContainer.appendChild(cardAudio);
  episodeCardContainer.appendChild(cardSpeed1);
  doc.body.appendChild(episodeCardContainer);

  return {
    doc,
    carouselContainer,
    track,
    slide1,
    slide2,
    playBtn1,
    playBtn2,
    dockedAudio,
    dockedTitle,
    dockedVariant,
    dockedTime,
    downloadLink,
    speed1,
    speed15,
    rotaryCenter,
    rotaryTop,
    carouselBtn,
    gridBtn,
    cardAudio,
  };
}

// --- Wire Up Client Logic per Component Scripts ---

function setupAudioPlayerScript(doc) {
  const containers = doc.querySelectorAll('.audio-player-container');
  containers.forEach((container) => {
    if (container.dataset.initialized === 'true') return;
    container.dataset.initialized = 'true';

    const audio = container.querySelector('audio.custom-audio-player');
    const speedButtons = container.querySelectorAll('.speed-btn');
    if (!audio || !speedButtons.length) return;

    audio.addEventListener('play', () => {
      doc.querySelectorAll('audio.custom-audio-player').forEach((otherAudio) => {
        if (otherAudio !== audio && !otherAudio.paused) {
          otherAudio.pause();
        }
      });

      const activeBtn = container.querySelector('.speed-btn.is-active');
      if (activeBtn) {
        const speed = parseFloat(activeBtn.dataset.speed || '1');
        audio.playbackRate = speed;
        audio.defaultPlaybackRate = speed;
      }
    });

    speedButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const speed = parseFloat(btn.dataset.speed || '1');
        audio.playbackRate = speed;
        audio.defaultPlaybackRate = speed;

        speedButtons.forEach((b) => {
          b.classList.remove('is-active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('is-active');
        btn.setAttribute('aria-pressed', 'true');
      });
    });
  });
}

function setupCarouselScript(doc, windowMock) {
  const containers = doc.querySelectorAll('.ipod-carousel-container[data-component="ipod-carousel"]');

  containers.forEach((container) => {
    if (container.dataset.initialized === 'true') return;
    container.dataset.initialized = 'true';

    const track = container.querySelector('.carousel-track');
    const slides = container.querySelectorAll('.carousel-item');
    const prevBtn = container.querySelector('.carousel-stepper-btn.prev-btn');
    const nextBtn = container.querySelector('.carousel-stepper-btn.next-btn');
    const rotaryLeft = container.querySelector('.rotary-left-btn');
    const rotaryRight = container.querySelector('.rotary-right-btn');
    const rotaryCenter = container.querySelector('.rotary-center-btn');
    const rotaryTop = container.querySelector('.rotary-top-btn');
    const rotaryDisc = container.querySelector('.rotary-wheel-disc');
    const currentTrackNum = container.querySelector('.current-track-num');
    const announcer = container.querySelector('#carousel-live-announcer');
    const viewButtons = container.querySelectorAll('.view-btn');
    const dockedSection = container.querySelector('#carousel-docked-player');
    const playButtons = container.querySelectorAll('.carousel-play-btn');

    if (!track || slides.length === 0) return;

    let activeIndex = Math.max(0, Math.min(slides.length - 1, parseInt(container.dataset.initialIndex || '0', 10)));
    let isGridView = container.classList.contains('is-grid-view');
    let currentPlayingSlug = null;

    function getDockedPlayerElements() {
      if (!dockedSection) return null;
      const audio = dockedSection.querySelector('audio.custom-audio-player');
      const titleEl = dockedSection.querySelector('.audio-title');
      const variantEl = dockedSection.querySelector('.audio-variant-label');
      const timeEl = dockedSection.querySelector('.audio-meta time');
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
        slide.classList.remove('is-active', 'is-prev', 'is-next', 'is-far-prev', 'is-far-next');

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

          if (idx === newIndex - 1) slide.classList.add('is-prev');
          else if (idx < newIndex - 1) slide.classList.add('is-far-prev');
          else if (idx === newIndex + 1) slide.classList.add('is-next');
          else if (idx > newIndex + 1) slide.classList.add('is-far-next');
        }
      });

      if (currentTrackNum) currentTrackNum.textContent = String(newIndex + 1);
      if (announcer && slides[newIndex]) {
        announcer.textContent = `Slide ${newIndex + 1} of ${slides.length}: ${slides[newIndex].dataset.title || ''}`;
      }
      if (prevBtn) prevBtn.disabled = newIndex <= 0;
      if (nextBtn) nextBtn.disabled = newIndex >= slides.length - 1;
    }

    function scrollToIndex(newIndex) {
      if (isGridView || !track) return;
      track.scrollTo({ left: newIndex * 320, behavior: 'smooth' });
    }

    function goToSlide(newIndex, shouldFocus = false) {
      const clamped = Math.max(0, Math.min(slides.length - 1, newIndex));
      activeIndex = clamped;
      updateSlideClasses(clamped);
      scrollToIndex(clamped);
      if (shouldFocus && !isGridView && slides[clamped]) slides[clamped].focus();
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
          docked.audio.play().catch(() => {});
        } else {
          docked.audio.pause();
        }
        return;
      }

      if (docked.titleEl) docked.titleEl.textContent = `Play Episode ${ep}: ${title}`;
      if (docked.variantEl && formatLabel) docked.variantEl.textContent = formatLabel;
      if (docked.timeEl && duration) docked.timeEl.textContent = `${duration} min`;
      if (docked.downloadLink && audioSrc) {
        docked.downloadLink.href = audioSrc;
        docked.downloadLink.setAttribute('aria-label', `Download MP3 for Episode ${ep}: ${title}`);
      }

      docked.audio.src = audioSrc;
      docked.audio.setAttribute('aria-label', `Play Episode ${ep}: ${title}`);
      docked.audio.load();
      docked.audio.play().catch(() => {});

      currentPlayingSlug = slug;

      slides.forEach((s) => {
        s.classList.remove('is-docked', 'is-playing');
        updatePlayButtonUI(s, false);
      });

      slide.classList.add('is-docked', 'is-playing');
      updatePlayButtonUI(slide, true);

      windowMock.lastDispatchedEvent = {
        name: 'lukethinks:dock-audio',
        detail: { slug, title, episodeNumber: ep, format: formatLabel, audioSrc, durationMinutes: duration },
      };
    }

    function switchView(mode) {
      if (mode === 'grid') {
        isGridView = true;
        container.classList.remove('is-carousel-view');
        container.classList.add('is-grid-view');
      } else {
        isGridView = false;
        container.classList.remove('is-grid-view');
        container.classList.add('is-carousel-view');
      }

      viewButtons.forEach((btn) => {
        const isActive = btn.dataset.view === mode;
        btn.classList.toggle('is-active', isActive);
        btn.setAttribute('aria-pressed', String(isActive));
      });

      updateSlideClasses(activeIndex);
      if (!isGridView) scrollToIndex(activeIndex);
    }

    // Event bindings
    prevBtn?.addEventListener('click', () => goToSlide(activeIndex - 1, true));
    nextBtn?.addEventListener('click', () => goToSlide(activeIndex + 1, true));
    rotaryLeft?.addEventListener('click', () => goToSlide(activeIndex - 1, true));
    rotaryRight?.addEventListener('click', () => goToSlide(activeIndex + 1, true));
    rotaryCenter?.addEventListener('click', () => {
      if (slides[activeIndex]) dockAndPlay(slides[activeIndex], true);
    });
    rotaryTop?.addEventListener('click', () => switchView(isGridView ? 'carousel' : 'grid'));

    viewButtons.forEach((btn) => btn.addEventListener('click', () => switchView(btn.dataset.view)));

    playButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const slide = btn.closest('.carousel-item');
        if (slide) dockAndPlay(slide, true);
      });
    });

    slides.forEach((slide, idx) => {
      slide.addEventListener('click', (e) => {
        const target = e.target;
        if (target && (target.closest('a') || target.closest('button'))) return;
        if (!isGridView) {
          if (idx !== activeIndex) goToSlide(idx, true);
          else dockAndPlay(slide, true);
        }
      });
    });

    track.addEventListener('keydown', (e) => {
      if (isGridView) return;
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          goToSlide(activeIndex - 1, true);
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          goToSlide(activeIndex + 1, true);
          break;
        case 'Home':
          e.preventDefault();
          goToSlide(0, true);
          break;
        case 'End':
          e.preventDefault();
          goToSlide(slides.length - 1, true);
          break;
        case 'Enter':
        case ' ': {
          const target = e.target;
          if (target && !target.closest('a')) {
            e.preventDefault();
            if (slides[activeIndex]) dockAndPlay(slides[activeIndex], true);
          }
          break;
        }
      }
    });

    const docked = getDockedPlayerElements();
    if (docked?.audio) {
      docked.audio.addEventListener('play', () => {
        doc.querySelectorAll('audio.custom-audio-player').forEach((other) => {
          if (other !== docked.audio && !other.paused) other.pause();
        });
        if (currentPlayingSlug) {
          const currentSlide = slides.find((s) => s.dataset.slug === currentPlayingSlug);
          if (currentSlide) {
            currentSlide.classList.add('is-playing');
            updatePlayButtonUI(currentSlide, true);
          }
        }
      });

      docked.audio.addEventListener('pause', () => {
        if (currentPlayingSlug) {
          const currentSlide = slides.find((s) => s.dataset.slug === currentPlayingSlug);
          if (currentSlide) {
            currentSlide.classList.remove('is-playing');
            updatePlayButtonUI(currentSlide, false);
          }
        }
      });
    }

    doc.addEventListener('play', (e) => {
      const target = e.target;
      if (target && target !== docked?.audio && !docked?.audio?.paused) {
        docked?.audio?.pause();
      }
    }, true);

    updateSlideClasses(activeIndex);
  });
}

// =========================================================================
// TEST SUITE
// =========================================================================

describe('Adversarial Verification: iPod Carousel Audio Lifecycle & Docking', () => {

  // --- 1. Exclusive Playback ---
  describe('1. Exclusive Playback Enforcement', () => {
    it('1.1 Docked player play pauses external episode card player on page', async () => {
      const dom = createPodcastPageDom();
      const win = {};
      setupAudioPlayerScript(dom.doc);
      setupCarouselScript(dom.doc, win);

      // Start external card audio
      await dom.cardAudio.play();
      assert.equal(dom.cardAudio.paused, false, 'Card audio is playing');
      assert.equal(dom.dockedAudio.paused, true, 'Docked audio is paused initially');

      // Click "Listen" on carousel card 1
      dom.playBtn1.click();
      assert.equal(dom.dockedAudio.paused, false, 'Docked audio started playing');
      assert.equal(dom.cardAudio.paused, true, 'External card audio was paused by docked player');
    });

    it('1.2 External episode card player play pauses carousel docked player', async () => {
      const dom = createPodcastPageDom();
      const win = {};
      setupAudioPlayerScript(dom.doc);
      setupCarouselScript(dom.doc, win);

      // Start carousel docked playback
      dom.playBtn1.click();
      assert.equal(dom.dockedAudio.paused, false, 'Docked player is playing');
      assert.equal(dom.slide1.classList.contains('is-playing'), true, 'Slide 1 has is-playing');

      // Now start external card audio
      await dom.cardAudio.play();
      assert.equal(dom.cardAudio.paused, false, 'Card audio is now playing');
      assert.equal(dom.dockedAudio.paused, true, 'Docked audio was paused by external player');
      assert.equal(dom.slide1.classList.contains('is-playing'), false, 'Slide 1 lost is-playing class');
      assert.equal(dom.playBtn1.querySelector('.play-btn-text').textContent, 'Listen', 'Play button reset to Listen');
    });

    it('1.3 Document capturing listener terminates docked playback when unknown external audio starts', async () => {
      const dom = createPodcastPageDom();
      const win = {};
      setupAudioPlayerScript(dom.doc);
      setupCarouselScript(dom.doc, win);

      dom.playBtn1.click();
      assert.equal(dom.dockedAudio.paused, false);

      // Create an un-registered third-party audio element
      const rogueAudio = new MockAudioElement({ class: 'third-party-player', src: 'https://example.com/ad.mp3' });
      rogueAudio.ownerDocument = dom.doc;
      dom.doc.body.appendChild(rogueAudio);

      await rogueAudio.play();
      assert.equal(dom.dockedAudio.paused, true, 'Capturing listener caught external audio and paused docked player');
    });
  });

  // --- 2. Dynamic Cueing & Audio Controls Lifecycle ---
  describe('2. Dynamic Cueing & Controls Integrity', () => {
    it('2.1 Cueing new slide updates docked player DOM and attributes completely', () => {
      const dom = createPodcastPageDom();
      const win = {};
      setupAudioPlayerScript(dom.doc);
      setupCarouselScript(dom.doc, win);

      // Cue slide 2
      dom.playBtn2.click();

      assert.equal(dom.dockedAudio.src, 'https://blob.vercel.com/ep02.mp3');
      assert.equal(dom.dockedTitle.textContent, 'Play Episode 02: Big Tech AI Investments: Debate');
      assert.equal(dom.dockedVariant.textContent, 'Point · Counterpoint');
      assert.equal(dom.dockedTime.textContent, '15 min');
      assert.equal(dom.downloadLink.href, 'https://blob.vercel.com/ep02.mp3');
      assert.equal(dom.downloadLink.getAttribute('aria-label'), 'Download MP3 for Episode 02: Big Tech AI Investments: Debate');
      assert.equal(dom.dockedAudio.getAttribute('aria-label'), 'Play Episode 02: Big Tech AI Investments: Debate');

      assert.equal(win.lastDispatchedEvent?.name, 'lukethinks:dock-audio');
      assert.equal(win.lastDispatchedEvent?.detail.slug, 'big-tech-ai-investments-the-great-accounting-debate');
      assert.equal(win.lastDispatchedEvent?.detail.format, 'Point · Counterpoint');
    });

    it('2.2 Playback speed setting (1.5x) persists when cueing new episode', () => {
      const dom = createPodcastPageDom();
      const win = {};
      setupAudioPlayerScript(dom.doc);
      setupCarouselScript(dom.doc, win);

      // User sets speed to 1.5x
      dom.speed15.click();
      assert.equal(dom.dockedAudio.playbackRate, 1.5);

      // Cue next episode
      dom.playBtn2.click();

      // AudioPlayer play handler restores active speed
      assert.equal(dom.dockedAudio.playbackRate, 1.5, 'Playback speed maintained at 1.5x after episode cue');
    });

    it('2.3 Re-clicking currently playing card toggles pause, re-clicking again resumes playback', () => {
      const dom = createPodcastPageDom();
      const win = {};
      setupAudioPlayerScript(dom.doc);
      setupCarouselScript(dom.doc, win);

      // Click to play
      dom.playBtn1.click();
      assert.equal(dom.dockedAudio.paused, false);
      assert.equal(dom.playBtn1.querySelector('.play-btn-text').textContent, 'Pause');

      // Click again to pause
      dom.playBtn1.click();
      assert.equal(dom.dockedAudio.paused, true);
      assert.equal(dom.playBtn1.querySelector('.play-btn-text').textContent, 'Listen');

      // Click third time to resume
      dom.playBtn1.click();
      assert.equal(dom.dockedAudio.paused, false);
      assert.equal(dom.playBtn1.querySelector('.play-btn-text').textContent, 'Pause');
    });

    it('2.4 Pressing Enter on active card triggers dock and play', () => {
      const dom = createPodcastPageDom();
      const win = {};
      setupAudioPlayerScript(dom.doc);
      setupCarouselScript(dom.doc, win);

      const enterEv = new MockEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      dom.slide1.dispatchEvent(enterEv);

      assert.equal(dom.dockedAudio.paused, false);
      assert.equal(dom.slide1.classList.contains('is-playing'), true);
    });

    it('2.5 Rotary center button triggers dock and play on active card', () => {
      const dom = createPodcastPageDom();
      const win = {};
      setupAudioPlayerScript(dom.doc);
      setupCarouselScript(dom.doc, win);

      dom.rotaryCenter.click();
      assert.equal(dom.dockedAudio.paused, false);
      assert.equal(dom.slide1.classList.contains('is-playing'), true);
    });
  });

  // --- 3. Fallback Grid Docking ---
  describe('3. Fallback Grid Docking & View Switching', () => {
    it('3.1 View toggle switches to .is-grid-view and relaxes roving tabindex', () => {
      const dom = createPodcastPageDom();
      const win = {};
      setupAudioPlayerScript(dom.doc);
      setupCarouselScript(dom.doc, win);

      dom.gridBtn.click();
      assert.equal(dom.carouselContainer.classList.contains('is-grid-view'), true);
      assert.equal(dom.carouselContainer.classList.contains('is-carousel-view'), false);
      assert.equal(dom.slide1.getAttribute('tabindex'), '0');
      assert.equal(dom.slide2.getAttribute('tabindex'), '0');
    });

    it('3.2 In Grid View, clicking "▶ Listen" button successfully docks and plays episode', () => {
      const dom = createPodcastPageDom();
      const win = {};
      setupAudioPlayerScript(dom.doc);
      setupCarouselScript(dom.doc, win);

      // Switch to Grid View
      dom.gridBtn.click();

      // Click Listen on Slide 2
      dom.playBtn2.click();

      assert.equal(dom.dockedAudio.src, 'https://blob.vercel.com/ep02.mp3');
      assert.equal(dom.dockedAudio.paused, false);
      assert.equal(dom.slide2.classList.contains('is-docked'), true);
      assert.equal(dom.slide2.classList.contains('is-playing'), true);
    });

    it('3.3 Switching back from Grid View to Carousel preserves active playback', () => {
      const dom = createPodcastPageDom();
      const win = {};
      setupAudioPlayerScript(dom.doc);
      setupCarouselScript(dom.doc, win);

      dom.gridBtn.click();
      dom.playBtn2.click();
      assert.equal(dom.dockedAudio.paused, false);

      // Switch back to Carousel
      dom.carouselBtn.click();
      assert.equal(dom.dockedAudio.paused, false, 'Audio playback continues uninterrupted');
      assert.equal(dom.carouselContainer.classList.contains('is-carousel-view'), true);
    });
  });

  // --- 4. Extensionless URL Resolution ---
  describe('4. Extensionless URL Resolution for Show Notes', () => {
    it('4.1 All carousel show notes links resolve to valid extensionless routes', () => {
      const files = readdirSync(EPISODES_DIR).filter(f => f.endsWith('.md'));
      for (const file of files) {
        const content = readFileSync(path.join(EPISODES_DIR, file), 'utf8');
        const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        const data = parseYaml(match[1]);

        const url = `/podcast/${data.slug}`;
        assert.match(url, /^\/podcast\/[a-z0-9-]+$/);
        assert.doesNotMatch(url, /\.html$/);
        assert.doesNotMatch(url, /\/$/);
      }
    });
  });

  // --- 5. Adversarial Edge Cases & Failure Modes (Findings) ---
  describe('5. Adversarial Edge Cases & Potential Failure Modes', () => {

    // CHALLENGE FINDING 1: Direct native play desynchronizes carousel button state
    it('5.1 CHALLENGE 1: Direct play on docked player without card click leaves initial slide desynchronized', async () => {
      const dom = createPodcastPageDom();
      const win = {};
      setupAudioPlayerScript(dom.doc);
      setupCarouselScript(dom.doc, win);

      // User initiates playback directly via native audio controls
      await dom.dockedAudio.play();

      // Because currentPlayingSlug was initialized to null (not slides[0].dataset.slug),
      // the slide does NOT receive .is-playing and button text remains 'Listen'!
      const isPlayingClass = dom.slide1.classList.contains('is-playing');
      const btnText = dom.playBtn1.querySelector('.play-btn-text').textContent;

      assert.equal(isPlayingClass, false, 'CONFIRMED: currentPlayingSlug is null initially, so native play does not mark slide as playing');
      assert.equal(btnText, 'Listen', 'CONFIRMED: Button still displays Listen while audio is actively playing');

      // Now user clicks "Listen" on slide 1 thinking it will pause
      dom.playBtn1.click();
      // Because currentPlayingSlug was null, dockAndPlay sees currentPlayingSlug !== slug,
      // so instead of toggling pause, it calls .load() and re-starts playback from the beginning!
      assert.equal(dom.dockedAudio.loadCount, 1, 'CONFIRMED: Re-triggered load() restarting audio instead of toggling pause');
    });

    // CHALLENGE FINDING 2: In Grid View, card surface click does not cue/dock
    it('5.2 CHALLENGE 2: In Grid View, clicking card body does not cue or dock', () => {
      const dom = createPodcastPageDom();
      const win = {};
      setupAudioPlayerScript(dom.doc);
      setupCarouselScript(dom.doc, win);

      // Switch to grid view
      dom.gridBtn.click();

      // Click card surface (not button)
      dom.slide2.click();

      // In grid view, line 661: `if (!isGridView)` suppresses card click
      assert.equal(dom.dockedAudio.src, 'https://blob.vercel.com/ep01.mp3', 'Card surface click in grid view does not cue audio');
      assert.equal(dom.slide2.classList.contains('is-docked'), false);
    });

    // CHALLENGE FINDING 3: In Grid View, pressing Enter on card does not dock
    it('5.3 CHALLENGE 3: In Grid View, pressing Enter while focused on slide does not dock', () => {
      const dom = createPodcastPageDom();
      const win = {};
      setupAudioPlayerScript(dom.doc);
      setupCarouselScript(dom.doc, win);

      // Switch to grid view
      dom.gridBtn.click();

      // Keyboard enter on slide2
      const enterEv = new MockEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      dom.slide2.dispatchEvent(enterEv);

      // In grid view, line 674: `if (isGridView) return;` suppresses track keydown
      assert.equal(dom.dockedAudio.src, 'https://blob.vercel.com/ep01.mp3', 'Enter on slide in grid view does not dock audio');
    });

    // CHALLENGE FINDING 4: View switch desynchronization (dockAndPlay does not update activeIndex)
    it('5.4 CHALLENGE 4: Playing card in Grid View does not update activeIndex when switching back to Cover Flow', () => {
      const dom = createPodcastPageDom();
      const win = {};
      setupAudioPlayerScript(dom.doc);
      setupCarouselScript(dom.doc, win);

      // Switch to Grid View
      dom.gridBtn.click();

      // Play Episode 2 (index 1)
      dom.playBtn2.click();
      assert.equal(dom.slide2.classList.contains('is-playing'), true);

      // Switch back to Cover Flow
      dom.carouselBtn.click();

      // In Cover Flow, activeIndex is still 0!
      // Slide 1 has is-active, while Slide 2 is the one docked and playing!
      assert.equal(dom.slide1.classList.contains('is-active'), true, 'CONFIRMED DESYNC: Cover Flow centers on Slide 1 instead of playing Slide 2');
      assert.equal(dom.slide2.classList.contains('is-next'), true, 'CONFIRMED DESYNC: Playing Slide 2 is tilted at flank instead of centered');
    });

  });

});
