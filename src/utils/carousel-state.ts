/**
 * Pure state machine and mutual-exclusion logic for the Audio Carousel.
 * Shared between client-side component (AudioCarousel.astro) and test suite.
 */

export interface CarouselItemData {
  id?: string;
  slug: string;
  title: string;
  summary?: string;
  published?: Date | string;
  episodeNumber?: number;
  episode?: number;
  season?: number;
  format?: 'briefing' | 'debate' | 'narration' | 'summary' | string;
  tags?: string[];
  confidence?: 'low' | 'medium' | 'high' | string;
  audio?: {
    src: string;
    bytes?: number;
    durationSeconds: number;
    mimeType?: string;
  };
  takeaways?: string[];
  companionArticle?: {
    title: string;
    href: string;
  };
  production?: {
    source?: string;
    aiDisclosed?: boolean;
  };
  isSeries?: boolean;
  series?: string;
  seriesPart?: number;
  partsCount?: number;
  theme?: string;
  episodes?: CarouselItemData[];
  [key: string]: any;
}

export interface CarouselStateOptions {
  initialIndex?: number;
  defaultView?: 'carousel' | 'grid';
  prefersReducedMotion?: boolean;
}

export interface DockPayload {
  slug: string;
  title: string;
  audioSrc?: string;
  durationSeconds?: number;
  format?: string;
  episodeNumber?: number;
}

export interface CardTransform {
  rotateY: number;
  scale: number;
  translateZ: number;
  opacity: number;
}

export interface PlayableAudio {
  paused: boolean;
  pause: () => void;
}

/**
 * Ensures mutual exclusivity across audio playback elements:
 * pauses all other audio players on the page when an active audio player begins playback.
 */
export function enforceExclusivePlayback<T extends PlayableAudio>(
  activeAudio: T,
  allAudios: Iterable<T>
): void {
  for (const audio of allAudios) {
    if (audio !== activeAudio && !audio.paused) {
      audio.pause();
    }
  }
}

/**
 * Pure state machine managing active index, view mode, roving tabindex,
 * keyboard controls, and 3D Cover Flow layout transforms.
 */
export class CarouselStateMachine {
  public items: CarouselItemData[];
  public activeIndex: number;
  public viewMode: 'carousel' | 'grid';
  public dockedEpisode: CarouselItemData | null;
  public isPlaying: boolean;
  public isReducedMotion: boolean;
  public expandedSeriesIndex: number | null;

  constructor(items: CarouselItemData[] = [], options: CarouselStateOptions = {}) {
    this.items = items;
    const requestedIndex = options.initialIndex ?? 0;
    this.activeIndex = items.length > 0
      ? Math.max(0, Math.min(items.length - 1, requestedIndex))
      : 0;
    this.viewMode = options.defaultView ?? 'carousel';
    this.dockedEpisode = null;
    this.isPlaying = false;
    this.isReducedMotion = options.prefersReducedMotion ?? false;
    this.expandedSeriesIndex = null;
  }

  get activeItem(): CarouselItemData | null {
    if (!this.items.length) return null;
    return this.items[this.activeIndex] ?? null;
  }

  /**
   * Sets the active index clamped within valid range [0, items.length - 1].
   */
  selectItem(index: number): number {
    if (!this.items.length) {
      this.activeIndex = 0;
      this.expandedSeriesIndex = null;
      return 0;
    }
    const prev = this.activeIndex;
    this.activeIndex = Math.max(0, Math.min(this.items.length - 1, index));
    if (this.expandedSeriesIndex !== null && this.activeIndex !== prev) {
      const target = this.items[this.activeIndex];
      if (target?.isSeries || (target?.episodes && target.episodes.length > 0)) {
        this.expandedSeriesIndex = this.activeIndex;
      } else {
        this.expandedSeriesIndex = null;
      }
    }
    return this.activeIndex;
  }

  /**
   * Expands the drawer for the series at index, or collapses if invalid.
   */
  expandSeries(index: number): boolean {
    if (index < 0 || index >= this.items.length) return false;
    const item = this.items[index];
    if (!item?.isSeries && (!item?.episodes || item.episodes.length === 0)) {
      return false;
    }
    this.expandedSeriesIndex = index;
    return true;
  }

  /**
   * Collapses the series drawer.
   */
  collapseSeries(): void {
    this.expandedSeriesIndex = null;
  }

  /**
   * Toggles drawer expansion for series at index.
   */
  toggleSeries(index: number): boolean {
    if (this.expandedSeriesIndex === index) {
      this.collapseSeries();
      return false;
    }
    return this.expandSeries(index);
  }

  /**
   * Returns whether series at index is expanded.
   */
  isSeriesExpanded(index: number): boolean {
    return this.expandedSeriesIndex === index;
  }

  /**
   * Returns currently expanded series item, or null.
   */
  getExpandedSeries(): CarouselItemData | null {
    if (this.expandedSeriesIndex === null) return null;
    return this.items[this.expandedSeriesIndex] ?? null;
  }

  /**
   * Returns episodes for the series item at index, sorted in intended chronological listening order (Part 1 -> Part 2 -> Part 3).
   */
  getSeriesEpisodes(index: number): CarouselItemData[] {
    const item = this.items[index];
    if (!item || !item.episodes) return [];
    return [...item.episodes].sort((a, b) => {
      const partA = a.seriesPart ?? a.episodeNumber ?? a.episode ?? 0;
      const partB = b.seriesPart ?? b.episodeNumber ?? b.episode ?? 0;
      if (partA !== partB) {
        return partA - partB;
      }
      const dateA = a.published ? new Date(a.published).getTime() : 0;
      const dateB = b.published ? new Date(b.published).getTime() : 0;
      if (dateA !== dateB) {
        return dateA - dateB;
      }
      return (a.slug || '').localeCompare(b.slug || '');
    });
  }

  /**
   * Docks and prepares playback for an episode from a series drawer.
   */
  dockAndPlayEpisode(episode: CarouselItemData): DockPayload | null {
    if (!episode) return null;
    this.dockedEpisode = episode;
    this.isPlaying = true;
    return {
      slug: episode.slug,
      title: episode.title,
      audioSrc: episode.audio?.src,
      durationSeconds: episode.audio?.durationSeconds,
      format: episode.format,
      episodeNumber: episode.episodeNumber ?? episode.episode ?? episode.seriesPart,
    };
  }

  /**
   * Steps forward to the next slide, clamped at the end.
   */
  next(): number {
    return this.selectItem(this.activeIndex + 1);
  }

  /**
   * Steps backward to the previous slide, clamped at 0.
   */
  prev(): number {
    return this.selectItem(this.activeIndex - 1);
  }

  /**
   * Jumps to the first slide (index 0).
   */
  home(): number {
    return this.selectItem(0);
  }

  /**
   * Jumps to the last slide.
   */
  end(): number {
    return this.selectItem(this.items.length - 1);
  }

  /**
   * Directional stepper helper ('next' or 'prev').
   */
  step(direction: 'next' | 'prev'): number {
    if (direction === 'next') {
      return this.next();
    }
    return this.prev();
  }

  /**
   * Calculates tabindex values for all slides based on current view mode and active index.
   * In grid view: all slides receive tabindex="0".
   * In carousel view: only active slide receives tabindex="0", inactive slides receive tabindex="-1".
   */
  getTabIndices(): number[] {
    if (this.viewMode === 'grid') {
      return this.items.map(() => 0);
    }
    return this.items.map((_, idx) => (idx === this.activeIndex ? 0 : -1));
  }

  /**
   * Returns whether interactive child elements inside a slide at `slideIndex` should be focusable.
   */
  getChildTabIndex(slideIndex: number): number {
    if (this.viewMode === 'grid') {
      return 0;
    }
    return slideIndex === this.activeIndex ? 0 : -1;
  }

  /**
   * Toggles or sets view mode between 'carousel' and 'grid'.
   */
  toggleView(mode?: 'carousel' | 'grid'): 'carousel' | 'grid' {
    if (mode === 'carousel' || mode === 'grid') {
      this.viewMode = mode;
    } else {
      this.viewMode = this.viewMode === 'carousel' ? 'grid' : 'carousel';
    }
    return this.viewMode;
  }

  /**
   * Docks and prepares playback for the currently active episode.
   */
  dockAndPlayActive(): DockPayload | null {
    const item = this.activeItem;
    if (!item) return null;
    this.dockedEpisode = item;
    this.isPlaying = true;
    return {
      slug: item.slug,
      title: item.title,
      audioSrc: item.audio?.src,
      durationSeconds: item.audio?.durationSeconds,
      format: item.format,
      episodeNumber: item.episodeNumber ?? item.episode,
    };
  }

  /**
   * Handles keyboard navigation strictly on the horizontal axis.
   * NOTE: ArrowUp and ArrowDown are deliberately omitted / unhandled so vertical page scroll is preserved.
   */
  handleKeyDown(key: string): boolean {
    if (!this.items.length) return false;

    if (this.viewMode === 'grid') {
      // In grid mode, native document grid navigation applies
      return false;
    }

    const prevIndex = this.activeIndex;
    switch (key) {
      case 'ArrowRight':
        this.next();
        break;
      case 'ArrowLeft':
        this.prev();
        break;
      case 'Home':
        this.home();
        break;
      case 'End':
        this.end();
        break;
      case 'PageDown':
        this.selectItem(this.activeIndex + 3);
        break;
      case 'PageUp':
        this.selectItem(this.activeIndex - 3);
        break;
      case 'Enter':
      case ' ': {
        const active = this.activeItem;
        if (active?.isSeries || (active?.episodes && active.episodes.length > 0)) {
          this.toggleSeries(this.activeIndex);
          return true;
        }
        this.dockAndPlayActive();
        return true;
      }
      case 'Escape': {
        if (this.expandedSeriesIndex !== null) {
          this.collapseSeries();
          return true;
        }
        return false;
      }
      default:
        // ArrowUp, ArrowDown, Tab, and other keys are NOT intercepted
        return false;
    }
    return this.activeIndex !== prevIndex;
  }

  /**
   * Computes 3D Cover Flow CSS transform properties for a card at `index`.
   */
  computeCardTransform(index: number): CardTransform {
    if (this.isReducedMotion || this.viewMode === 'grid') {
      return { rotateY: 0, scale: 1, translateZ: 0, opacity: 1 };
    }
    const diff = index - this.activeIndex;
    if (diff === 0) {
      return { rotateY: 0, scale: 1.04, translateZ: 0, opacity: 1 };
    } else if (diff < 0) {
      return { rotateY: 36, scale: 0.82, translateZ: -70, opacity: 0.72 };
    } else {
      return { rotateY: -36, scale: 0.82, translateZ: -70, opacity: 0.72 };
    }
  }
}
