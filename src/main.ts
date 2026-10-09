import './styles/main.css';

import { Loader, buildTasks } from './core/loader';
import { ScrollController, type SceneId } from './core/scroll';
import { prefersReducedMotion } from './core/quality';
import { sampleTimeline } from './data/timeline';
import { World } from './three/scene';
import { initCursor } from './ui/cursor';
import { initCarousel } from './ui/carousel';
import { initSound } from './ui/sound';
import { initNav, initTilt, initMagnetic, initYear } from './ui/interactions';
import { variants, asset } from './data/variants';

document.body.classList.add('is-loading');

const CRITICAL_IMAGES = [
  asset('/assets/img/logo.png'),
  ...variants.slice(0, 2).map((v) => v.webp),
];

/** ¿WebGL disponible? */
function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext('webgl2') || c.getContext('webgl'))
    );
  } catch {
    return false;
  }
}

async function boot(): Promise<void> {
  const loader = new Loader();

  // ----------3D (o fallback) ----------
  const canvas = document.getElementById('gl') as HTMLCanvasElement | null;
  let world: World | null = null;
  const webgl = !!canvas && hasWebGL();

  if (!webgl) {
    document.body.classList.add('no-webgl');
  } else if (canvas) {
    try {
      world = new World(canvas, {});
      world.setAccent(variants[0].color);
    } catch (err) {
      console.warn('[charohergar] WebGL no disponible, usando fallback2D', err);
      document.body.classList.add('no-webgl');
      world = null;
    }
  }

  // ---------- carga con progreso real ----------
  await loader.run(buildTasks(CRITICAL_IMAGES));

  // ---------- escena inicial ----------
  const scroll = new ScrollController();
  const reduced = prefersReducedMotion();

  // el bucle de render arranca siempre; con reduced-motion la interpolación
  // es instantánea y el movimiento ambiental está desactivado dentro de World
  world?.start();

  let currentScene: SceneId = 'intro';

  const applyScene = (id: SceneId, p: number) => {
    if (!world) return;
    const kf = sampleTimeline(id, p);
    world.setTarget(kf);
  };

  // solo la escena que ocupa el centro del viewport gobierna la cámara
  scroll.onActiveScene((id, progress) => {
    currentScene = id;
    applyScene(id, progress);
  });

  // los pasos de cada escena apilada se activan con su propio progreso
  (['transform', 'story', 'details'] as SceneId[]).forEach((id) => {
    scroll.onScene(id, ({ progress, el }) => updateSteps(el, progress));
  });

  // estado inicial
  applyScene('intro', 0);

  // ---------- pasos de las escenas apiladas ----------
  function updateSteps(section: HTMLElement, progress: number): void {
    const track = section.querySelector<HTMLElement>('.stack__track');
    if (!track) return;
    const items = Array.from(track.querySelectorAll<HTMLElement>('.stack__item'));
    const dots = Array.from(section.querySelectorAll<HTMLElement>('.stack__dots li'));
    const count = items.length;
    if (!count) return;

    // el scroll de la sección se reparte entre sus pasos
    const local = Math.min(0.999, Math.max(0, (progress - 0.12) / 0.76));
    const idx = Math.min(count - 1, Math.floor(local * count));

    items.forEach((it, i) => it.classList.toggle('is-active', i === idx));
    dots.forEach((d, i) => d.classList.toggle('is-active', i <= idx));
  }

  // ---------- carrusel → acento de luz3D ----------
  initCarousel({
    onSelect: (v) => {
      world?.setAccent(v.color);
    },
  });

  // ---------- UI ----------
  initCursor();
  initNav();
  initTilt();
  initMagnetic();
  initYear();
  initSound();

  // ---------- replay ----------
  document.querySelector<HTMLElement>('[data-replay]')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  });

  // ---------- reveal inicial de la intro ----------
  window.setTimeout(() => {
    document
      .querySelectorAll<HTMLElement>('#intro [data-reveal]')
      .forEach((el) => el.classList.add('is-in'));
  }, 60);

  // ---------- salida ----------
  loader.finish();
  scroll.refresh();

  console.info('[charohergar] lista · escena activa:', currentScene);
}

void boot();
