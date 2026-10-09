/** Gestión de calidad: niveles HIGH/MEDIUM/LOW, DPR adaptativo y prefers-reduced-motion. */

export type Quality = 'HIGH' | 'MEDIUM' | 'LOW';

export interface QualityState {
  level: Quality;
  dpr: number;
  particles: number;
  antialias: boolean;
  pixelRatioCap: number;
}

const reducedQuery = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const prefersReducedMotion = (): boolean => reducedQuery();

export function detectQuality(): Quality {
  if (typeof navigator === 'undefined') return 'MEDIUM';
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = nav.deviceMemory ?? 8;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 480;

  if (coarse || small) return mem >= 6 && cores >= 6 ? 'MEDIUM' : 'LOW';
  if (cores >= 8 && mem >= 8) return 'HIGH';
  return 'MEDIUM';
}

export function qualitySettings(level: Quality): QualityState {
  switch (level) {
    case 'HIGH':
      return { level, dpr: Math.min(devicePixelRatio, 2), particles: 900, antialias: true, pixelRatioCap: 2 };
    case 'MEDIUM':
      return { level, dpr: Math.min(devicePixelRatio, 1.6), particles: 520, antialias: true, pixelRatioCap: 1.6 };
    default:
      return { level, dpr: 1, particles: 240, antialias: false, pixelRatioCap: 1 };
  }
}

/**
 * Monitor de FPS que degrada el nivel (HIGH → MEDIUM → LOW) si el framerate
 * se mantiene por debajo del umbral durante la ventana de medición.
 */
export class PerfMonitor {
  private frames = 0;
  private last = performance.now();
  private cooldownUntil = 0;

  constructor(
    private level: Quality,
    private onDowngrade: (lvl: Quality) => void,
  ) {}

  get quality(): Quality {
    return this.level;
  }

  sample(now: number): void {
    this.frames++;
    const delta = now - this.last;
    if (delta < 2000) return;

    const fps = (this.frames * 1000) / delta;
    this.frames = 0;
    this.last = now;

    if (fps < 42 && now > this.cooldownUntil && this.level !== 'LOW') {
      this.level = this.level === 'HIGH' ? 'MEDIUM' : 'LOW';
      this.cooldownUntil = now + 6000;
      this.onDowngrade(this.level);
    }
  }

  /** Rst manual (por ejemplo al volver a la pestaña). */
  reset(): void {
    this.frames = 0;
    this.last = performance.now();
  }
}
