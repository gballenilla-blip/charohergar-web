import * as THREE from 'three';
import { createMonogram, type Monogram } from './monogram';
import { createParticles, type Particles } from './particles';
import { createLights, type Lights } from './lights';
import { qualitySettings, PerfMonitor, type Quality } from '../core/quality';

/** Estado visual que la escena3D interpola hacia su objetivo. */
export interface VisualState {
  camPos: THREE.Vector3;
  camTarget: THREE.Vector3;
  objPos: THREE.Vector3;
  objRot: THREE.Euler;
  objScale: number;
  glow: number;
  draw: number;
  light: number;
  bg: THREE.Color;
}

const makeState = (): VisualState => ({
  camPos: new THREE.Vector3(0, 0, 9),
  camTarget: new THREE.Vector3(0, 0, 0),
  objPos: new THREE.Vector3(0, 0, 0),
  objRot: new THREE.Euler(0, 0, 0),
  objScale: 1,
  glow: 0.3,
  draw: 1,
  light: 1,
  bg: new THREE.Color(0x121212),
});

export interface WorldOptions {
  onQuality?: (q: Quality) => void;
}

export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;

  private monogram: Monogram;
  private particles: Particles;
  private lights: Lights;

  private target = makeState();
  readonly current = makeState();

  private pointer = new THREE.Vector2();
  private pointerSmooth = new THREE.Vector2();
  private clock = new THREE.Clock();
  private visible = true;
  private raf = 0;
  private monitor: PerfMonitor;
  private quality: Quality;
  private pixelCap: number;
  private reduced: boolean;
  private envTexture: THREE.Texture | null = null;

  constructor(canvas: HTMLCanvasElement, opts: WorldOptions = {}) {
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const stored = localStorage.getItem('ch-quality');
    const initial =
      stored === 'HIGH' || stored === 'MEDIUM' || stored === 'LOW'
        ? stored
        : detectInitialQuality();
    const base = qualitySettings(initial);
    this.quality = base.level;
    this.pixelCap = base.pixelRatioCap;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: base.antialias,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(base.dpr);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = base.level !== 'LOW';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this.camera.position.copy(this.current.camPos);

    this.scene.fog = new THREE.FogExp2(0x121212, 0.035);

    // entorno sutil para reflejos metálicos
    this.envTexture = buildEnvTexture();
    this.scene.environment = this.envTexture;

    this.monogram = createMonogram();
    this.scene.add(this.monogram.group);

    this.particles = createParticles(base.particles);
    this.scene.add(this.particles.points);

    this.lights = createLights();
    this.scene.add(this.lights.ambient, this.lights.key, this.lights.accent, this.lights.rim, this.lights.rim.target);
    const fill = new THREE.DirectionalLight(0x4ad9c4, 0.42);
    fill.position.set(-6, -2, 4);
    this.scene.add(fill);

    // suelo que recibe sombra (aparece en las escenas de producto)
    const floorGeo = new THREE.PlaneGeometry(60, 60);
    const floorMat = new THREE.ShadowMaterial({ opacity: 0.32 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -3.4;
    floor.receiveShadow = true;
    this.scene.add(floor);

    this.monitor = new PerfMonitor(this.quality, (lvl) => this.applyQuality(lvl));

    this.resize();
    window.addEventListener('resize', () => this.resize(), { passive: true });
    window.addEventListener(
      'pointermove',
      (e) => {
        this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
      },
      { passive: true },
    );
    document.addEventListener('visibilitychange', () => {
      this.visible = !document.hidden;
      if (this.visible) this.monitor.reset();
    });

    opts.onQuality?.(this.quality);
  }

  /* ---------- API pública ---------- */

  /** Establece el estado objetivo (la escena interpola hacia él). */
  setTarget(partial: Partial<VisualState>): void {
    const t = this.target;
    if (partial.camPos) t.camPos.copy(partial.camPos);
    if (partial.camTarget) t.camTarget.copy(partial.camTarget);
    if (partial.objPos) t.objPos.copy(partial.objPos);
    if (partial.objRot) t.objRot.copy(partial.objRot);
    if (typeof partial.objScale === 'number') t.objScale = partial.objScale;
    if (typeof partial.glow === 'number') t.glow = partial.glow;
    if (typeof partial.draw === 'number') t.draw = partial.draw;
    if (typeof partial.light === 'number') t.light = partial.light;
    if (partial.bg) t.bg.copy(partial.bg);
  }

  setAccent(hex: string): void {
    this.lights.setAccent(hex);
  }

  setParticleCount(n: number): void {
    this.particles.setCount(n);
  }

  start(): void {
    if (this.raf) return;
    this.clock.start();
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      this.render();
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  dispose(): void {
    this.stop();
    this.monogram.dispose();
    this.particles.dispose();
    this.lights.dispose();
    this.envTexture?.dispose();
    this.renderer.dispose();
  }

  /* ---------- bucle ---------- */

  private render(): void {
    if (!this.visible) return;
    const t = this.clock.getElapsedTime();
    const k = this.reduced ? 1 : 0.075; // suavizado

    const c = this.current;
    const tg = this.target;

    c.camPos.lerp(tg.camPos, k);
    c.camTarget.lerp(tg.camTarget, k);
    c.objPos.lerp(tg.objPos, k);
    c.objRot.x += (tg.objRot.x - c.objRot.x) * k;
    c.objRot.y += (tg.objRot.y - c.objRot.y) * k;
    c.objRot.z += (tg.objRot.z - c.objRot.z) * k;
    c.objScale += (tg.objScale - c.objScale) * k;
    c.glow += (tg.glow - c.glow) * k;
    c.draw += (tg.draw - c.draw) * k;
    c.light += (tg.light - c.light) * k;
    c.bg.lerp(tg.bg, k);

    // puntero suavizado (parallax)
    this.pointerSmooth.lerp(this.pointer, 0.06);

    // movimiento ambiental del objeto (flotación + micro-rotación)
    const floatY = this.reduced ? 0 : Math.sin(t * 0.62) * 0.13;
    const floatRot = this.reduced ? 0 : Math.sin(t * 0.41) * 0.045;

    const g = this.monogram.group;
    g.position.set(c.objPos.x, c.objPos.y + floatY, c.objPos.z);
    g.rotation.set(c.objRot.x, c.objRot.y + floatRot, c.objRot.z);
    g.scale.setScalar(c.objScale);

    this.monogram.setDraw(c.draw);
    this.monogram.setGlow(c.glow);
    this.lights.setIntensity(c.light);
    if (!this.reduced) this.lights.update(t);

    // cámara: keyframe + parallax de ratón
    this.camera.position.set(
      c.camPos.x + this.pointerSmooth.x * 0.55,
      c.camPos.y + this.pointerSmooth.y * 0.4,
      c.camPos.z,
    );
    this.camera.lookAt(c.camTarget);

    this.particles.update(t, this.pointerSmooth);
    this.scene.background = c.bg;
    if (this.scene.fog instanceof THREE.FogExp2) this.scene.fog.color.copy(c.bg);

    this.renderer.render(this.scene, this.camera);
    this.monitor.sample(performance.now());
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    // en móvil, alejar un poco para que quepa el monograma
    this.camera.fov = w < 720 ? 46 : w < 1024 ? 42 : 38;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.pixelCap));
    this.renderer.setSize(w, h, false);
  }

  private applyQuality(lvl: Quality): void {
    this.quality = lvl;
    const s = qualitySettings(lvl);
    this.pixelCap = s.pixelRatioCap;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, s.pixelRatioCap));
    this.renderer.shadowMap.enabled = s.level !== 'LOW';
    this.particles.setCount(s.particles);
    localStorage.setItem('ch-quality', lvl);
  }
}

function detectInitialQuality(): Quality {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 480;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const mem = nav.deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 4;
  if (coarse || small) return mem >= 6 && cores >= 6 ? 'MEDIUM' : 'LOW';
  if (cores >= 8 && mem >= 8) return 'HIGH';
  return 'MEDIUM';
}

/** Pequeño cubemap procedural para reflejos metálicos. */
function buildEnvTexture(): THREE.Texture {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const v = y / size; // de arriba (claro) a abajo (oscuro)
      const warm = 1 - v;
      data[i] = Math.round(40 + 150 * v * 0.4 + 60 * warm);
      data[i + 1] = Math.round(36 + 130 * v * 0.36 + 48 * warm);
      data[i + 2] = Math.round(30 + 110 * v * 0.3 + 20 * warm);
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
