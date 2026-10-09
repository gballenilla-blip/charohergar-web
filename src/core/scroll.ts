/** Controlador de scroll: progreso por escena, reveal y tema de la navbar. */

export type SceneId =
  | 'intro'
  | 'transform'
  | 'reveal'
  | 'story'
  | 'details'
  | 'process'
  | 'artists'
  | 'finale'
  | 'cta';

export interface SceneState {
  id: SceneId;
  /** 0 → 1 dentro de la sección (top-to-bottom). */
  progress: number;
  /** 0 → 1 cuando la sección está visible en pantalla. */
  visible: number;
  el: HTMLElement;
}

type SceneHandler = (state: SceneState) => void;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export class ScrollController {
  private sections = new Map<HTMLElement, SceneId>();
  private states = new Map<HTMLElement, SceneState>();
  private handlers = new Map<SceneId, SceneHandler[]>();
  private navHandlers: ((theme: 'dark' | 'light', id: SceneId) => void)[] = [];
  private activeHandlers: ((
    id: SceneId,
    progress: number,
    state: SceneState,
  ) => void)[] = [];
  private ticking = false;
  private lastNavTheme: 'dark' | 'light' | null = null;

  readonly navEl: HTMLElement | null;
  private lastY = 0;

  constructor() {
    this.navEl = document.getElementById('nav');

    document.querySelectorAll<HTMLElement>('[data-scene]').forEach((el) => {
      const id = el.dataset.scene as SceneId;
      this.sections.set(el, id);
      this.states.set(el, {
        id,
        progress: 0,
        visible: 0,
        el,
      });
    });

    // reveals fuera de pantalla
    this.setupReveals();
    window.addEventListener('scroll', () => this.requestTick(), { passive: true });
    window.addEventListener('resize', () => this.requestTick(), { passive: true });
    this.requestTick();
  }

  onScene(id: SceneId, handler: SceneHandler): void {
    const list = this.handlers.get(id) ?? [];
    list.push(handler);
    this.handlers.set(id, list);
  }

  onNavTheme(handler: (theme: 'dark' | 'light', id: SceneId) => void): void {
    this.navHandlers.push(handler);
  }

  /**
   * Se dispara una sola vez por frame con la escena que ocupa el centro del
   * viewport: es la única que debe gobernar la cámara3D.
   */
  onActiveScene(
    handler: (id: SceneId, progress: number, state: SceneState) => void,
  ): void {
    this.activeHandlers.push(handler);
  }

  private pendingReveals = new Set<HTMLElement>();

  private setupReveals(): void {
    document
      .querySelectorAll<HTMLElement>('[data-reveal]')
      .forEach((t) => this.pendingReveals.add(t));
    // rescate tras cargas de imágenes que desplazan el layout sin scroll
    window.setTimeout(() => this.revealVisible(), 1200);
  }

  /**
   * Revela todo lo que haya entrado en el viewport (incluidos los elementos
   * ya por encima, que un salto de scroll puede dejar fuera de la intersección).
   */
  private revealVisible(): void {
    if (!this.pendingReveals.size) return;
    const limit = window.innerHeight * 0.92;
    this.pendingReveals.forEach((el) => {
      if (el.getBoundingClientRect().top < limit) {
        el.classList.add('is-in');
        this.pendingReveals.delete(el);
      }
    });
  }

  private requestTick(): void {
    if (this.ticking) return;
    this.ticking = true;
    requestAnimationFrame(() => {
      this.ticking = false;
      this.update();
    });
  }

  /** Fuerza un recálculo inmediato (tras redimensionar o cambiar de escena). */
  refresh(): void {
    this.update();
  }

  private update(): void {
    const vh = window.innerHeight;
    this.revealVisible();
    let themeSection: HTMLElement | null = null;
    let activeState: SceneState | null = null;
    let activeId: SceneId | null = null;
    let activeProgress = 0;

    this.states.forEach((state, el) => {
      const rect = el.getBoundingClientRect();
      const h = rect.height || 1;
      const pinned = h > vh * 1.5;

      // progreso: en secciones ancladas mide desde que empieza el pin
      // hasta que lo libera; en el resto, recorrido del centro del viewport
      if (pinned) {
        state.progress = clamp01(-rect.top / Math.max(1, h - vh));
      } else {
        state.progress = clamp01((vh / 2 - rect.top) / h);
      }

      // visibilidad: 1 cuando el elemento ocupa pantalla
      const visibleTop = Math.max(rect.top, 0);
      const visibleBottom = Math.min(rect.bottom, vh);
      state.visible = clamp01((visibleBottom - visibleTop) / Math.min(h, vh));

      // la escena activa es la que contiene el centro del viewport
      if (rect.top <= vh * 0.5 && rect.bottom > vh * 0.5) {
        activeState = state;
        activeId = state.id;
        activeProgress = state.progress;
      }

      // ¿qué sección define el tema de la navbar (bajo la barra)?
      if (rect.top <= vh * 0.12 && rect.bottom > vh * 0.12) themeSection = el;

      const handlers = this.handlers.get(state.id);
      if (handlers && state.visible > 0) handlers.forEach((fn) => fn(state));
    });

    // la escena activa es la única que gobierna la cámara3D
    if (activeId !== null && activeState) {
      this.activeHandlers.forEach((fn) =>
        fn(activeId as SceneId, activeProgress, activeState as SceneState),
      );
    }

    const y = window.scrollY;
    const goingDown = y > this.lastY;
    this.lastY = y;

    // navbar: sólida al hacer scroll, se oculta al bajar y aparece al subir
    if (this.navEl) {
      this.navEl.classList.toggle('is-scrolled', y > 40);
      if (y > vh * 0.9 && goingDown) this.navEl.classList.add('is-hidden');
      else this.navEl.classList.remove('is-hidden');
    }

    if (themeSection) {
      const el = themeSection as HTMLElement;
      const theme = (el.dataset.nav ?? 'dark') as 'dark' | 'light';
      if (theme !== this.lastNavTheme) {
        this.lastNavTheme = theme;
        if (this.navEl) this.navEl.dataset.navTheme = theme;
        const id = this.sections.get(el);
        if (id) this.navHandlers.forEach((fn) => fn(theme, id));
      }
    }
  }
}
