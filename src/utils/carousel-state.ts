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
      return 0;
    }
    this.activeIndex = Math.max(0, Math.min(this.items.length - 1, index));
    return this.activeIndex;
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
      case ' ':
        this.dockAndPlayActive();
        return true;
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
