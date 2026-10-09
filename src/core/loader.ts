/** Loader con progreso REAL: fuentes, imágenes críticas y arranque de la escena. */

export interface LoadTask {
  weight: number;
  run: (onProgress: (p: number) => void) => Promise<void>;
}

const loadImage = (src: string): Promise<void> =>
  new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve();
    img.onerror = () => resolve(); // nunca bloquear por un asset roto
    img.src = src;
  });

const loadFonts = async (): Promise<void> => {
  if (!('fonts' in document)) return;
  try {
    await Promise.all([
      (document as Document & { fonts: FontFaceSet }).fonts.load('400 1em "Instrument Serif"'),
      (document as Document & { fonts: FontFaceSet }).fonts.load('700 1em "Inter"'),
      (document as Document & { fonts: FontFaceSet }).fonts.ready,
    ]);
  } catch {
    /* ignorar */
  }
};

export function buildTasks(criticalImages: string[]): LoadTask[] {
  return [
    { weight: 2, run: () => loadFonts() },
    ...criticalImages.map<LoadTask>((src) => ({
      weight: 1,
      run: async () => {
        await loadImage(src);
      },
    })),
  ];
}

export class Loader {
  private pct = 0;
  private fill: HTMLElement | null;
  private num: HTMLElement | null;
  private root: HTMLElement | null;

  constructor(
    rootId = 'loader',
    fillId = 'loader-fill',
    numId = 'loader-pct',
  ) {
    this.root = document.getElementById(rootId);
    this.fill = document.getElementById(fillId);
    this.num = document.getElementById(numId);
  }

  private render(): void {
    const v = Math.round(this.pct);
    if (this.fill) this.fill.style.width = `${v}%`;
    if (this.num) this.num.textContent = String(v);
  }

  /** Ejecuta las tareas respetando sus pesos y reporta progreso real 0–100. */
  async run(tasks: LoadTask[]): Promise<void> {
    const total = tasks.reduce((s, t) => s + t.weight, 0) || 1;
    let done = 0;

    const update = (taskWeight: number, local: number) => {
      this.pct = Math.min(99, ((done + taskWeight * local) / total) * 100);
      this.render();
    };

    // Las tareas ligeras en paralelo, cada una reportando su propio avance.
    await Promise.all(
      tasks.map(async (task) => {
        await task.run((local) => update(task.weight, local));
        done += task.weight;
        this.pct = Math.min(99, (done / total) * 100);
        this.render();
      }),
    );

    this.pct = 100;
    this.render();
  }

  finish(): void {
    this.pct = 100;
    this.render();
    this.root?.classList.add('is-done');
    document.body.classList.remove('is-loading');
    window.setTimeout(() => this.root?.setAttribute('aria-hidden', 'true'), 900);
  }
}
