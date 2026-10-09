import * as THREE from 'three';
import type { SceneId } from '../core/scroll';
import type { VisualState } from '../three/scene';

/**
 * Keyframes de cámara / objeto por escena.
 * Cada escena define `from` y `to`; la escena interpola con el progreso 0→1.
 */

export type Keyframe = Partial<VisualState>;

interface SceneRange {
  from: Keyframe;
  to: Keyframe;
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const e = (x: number, y: number, z: number) => new THREE.Euler(x, y, z);

const DARK = new THREE.Color(0x121212);
const DEEP = new THREE.Color(0x0b0b0b);

export const timeline: Record<SceneId, SceneRange> = {
  /* 01 · INTRO — objeto flotando a la derecha, cámara alta, todavía "durmiendo" */
  intro: {
    from: {
      camPos: v(1.4, 0.6, 10.2),
      camTarget: v(1.1, 0.1, 0),
      objPos: v(3.0, -0.1, 0),
      objRot: e(0.04, -0.5, 0.05),
      objScale: 0.82,
      glow: 0.22,
      draw: 1,
      light: 0.85,
      bg: DARK,
    },
    to: {
      camPos: v(1.1, 0.2, 9.2),
      camTarget: v(0.9, 0, 0),
      objPos: v(2.75, 0, 0),
      objRot: e(0.02, -0.34, 0.03),
      objScale: 0.88,
      glow: 0.3,
      draw: 1,
      light: 0.95,
      bg: DARK,
    },
  },

  /* 02 · TRANSFORMACIÓN — la forma se dibuja, la luz se enciende */
  transform: {
    from: {
      camPos: v(0.8, 0.3, 8.2),
      camTarget: v(0.5, 0.1, 0),
      objPos: v(1.7, 0, 0),
      objRot: e(0.02, -0.3, 0.02),
      objScale: 0.86,
      glow: 0.18,
      draw: 0.05,
      light: 0.6,
      bg: DARK,
    },
    to: {
      camPos: v(0.7, 0.1, 7.4),
      camTarget: v(0.45, 0, 0),
      objPos: v(1.55, 0, 0.4),
      objRot: e(0, -0.06, 0),
      objScale: 0.9,
      glow: 1,
      draw: 1,
      light: 1.25,
      bg: DEEP,
    },
  },

  /* 03 · REVELACIÓN — el objeto sube, la hoja marfil con el titular ocupa abajo */
  reveal: {
    from: {
      camPos: v(0, 1.4, 5.6),
      camTarget: v(0, 1.2, 0),
      objPos: v(0, 1.6, 0.8),
      objRot: e(0, 0, 0),
      objScale: 0.92,
      glow: 1,
      draw: 1,
      light: 1.35,
      bg: DARK,
    },
    to: {
      camPos: v(0, 1.8, 6.4),
      camTarget: v(0, 1.5, 0),
      objPos: v(0, 1.9, 0.4),
      objRot: e(0, 0.12, 0),
      objScale: 0.86,
      glow: 0.85,
      draw: 1,
      light: 1.4,
      bg: DARK,
    },
  },

  /* 04 · PRODUCT STORY — rotación por pasos, objeto a la derecha (texto a la izquierda) */
  story: {
    from: {
      camPos: v(-0.4, 0.4, 7.6),
      camTarget: v(0.05, 0.6, 0),
      objPos: v(1.85, 1.1, 0),
      objRot: e(0, 0.5, -0.03),
      objScale: 0.94,
      glow: 0.7,
      draw: 1,
      light: 1.15,
      bg: DARK,
    },
    to: {
      camPos: v(-0.9, -0.2, 5.8),
      camTarget: v(1.15, 0.4, 0),
      objPos: v(1.9, 0.9, 1.2),
      objRot: e(0.12, 2.1, 0.14),
      objScale: 1,
      glow: 1,
      draw: 1,
      light: 1.3,
      bg: DEEP,
    },
  },

  /* 05 · DETALLES — cámara muy cercana, macro a la izquierda (texto a la derecha) */
  details: {
    from: {
      camPos: v(-1.4, 0.6, 4.6),
      camTarget: v(-1.1, 0.3, 0),
      objPos: v(-1.5, 0, 1.4),
      objRot: e(-0.1, -0.7, 0.16),
      objScale: 1.18,
      glow: 1,
      draw: 1,
      light: 1.35,
      bg: DARK,
    },
    to: {
      camPos: v(-1.0, -0.8, 3.8),
      camTarget: v(-0.8, -0.1, 0),
      objPos: v(-1.3, 0.3, 1.6),
      objRot: e(0.24, -1.5, -0.12),
      objScale: 1.24,
      glow: 1,
      draw: 1,
      light: 1.4,
      bg: DEEP,
    },
  },

  /* 06 · PROCESO — el objeto se retira, pasa a segundo plano */
  process: {
    from: {
      camPos: v(0, 0.4, 9),
      camTarget: v(0, 0, 0),
      objPos: v(0, 1.6, -4),
      objRot: e(0, 0.6, 0),
      objScale: 0.8,
      glow: 0.5,
      draw: 1,
      light: 0.8,
      bg: DEEP,
    },
    to: {
      camPos: v(0, 0.4, 9.4),
      camTarget: v(0, 0.4, 0),
      objPos: v(0, 2.2, -5),
      objRot: e(0, 1.1, 0),
      objScale: 0.7,
      glow: 0.4,
      draw: 1,
      light: 0.7,
      bg: DEEP,
    },
  },

  /* 07 · ARTISTAS — el monograma como acento, luz teñida por el artista */
  artists: {
    from: {
      camPos: v(0, 0.2, 10),
      camTarget: v(0, 0.3, 0),
      objPos: v(0, 2.4, -6),
      objRot: e(0, 1.2, 0),
      objScale: 0.62,
      glow: 0.6,
      draw: 1,
      light: 0.75,
      bg: DEEP,
    },
    to: {
      camPos: v(0, 0, 9.6),
      camTarget: v(0, 0.2, 0),
      objPos: v(0, 2, -5.4),
      objRot: e(0, 2, 0),
      objScale: 0.66,
      glow: 0.7,
      draw: 1,
      light: 0.85,
      bg: DARK,
    },
  },

  /* 08 · ESCENA FINAL — protagonista central, gran plano */
  finale: {
    from: {
      camPos: v(0, -0.4, 7.4),
      camTarget: v(-0.45, 0, 0),
      objPos: v(0, -0.6, 1),
      objRot: e(0.08, -0.9, 0.06),
      objScale: 1.1,
      glow: 0.9,
      draw: 1,
      light: 1.2,
      bg: DARK,
    },
    to: {
      camPos: v(0, 0, 5.4),
      camTarget: v(-0.35, 0, 0),
      objPos: v(0, 0, 1.6),
      objRot: e(0, -0.15, 0),
      objScale: 1.22,
      glow: 1,
      draw: 1,
      light: 1.45,
      bg: DEEP,
    },
  },

  /* 09 · CTA — reposo elegante, el objeto respira al fondo */
  cta: {
    from: {
      camPos: v(0, 0.3, 8.6),
      camTarget: v(0, 0.2, 0),
      objPos: v(0, 1.4, -2.6),
      objRot: e(0, 0.4, 0),
      objScale: 0.85,
      glow: 0.75,
      draw: 1,
      light: 1,
      bg: DEEP,
    },
    to: {
      camPos: v(0, 0.6, 9.2),
      camTarget: v(0, 0.4, 0),
      objPos: v(0, 1.8, -3.4),
      objRot: e(0, 0.9, 0),
      objScale: 0.78,
      glow: 0.6,
      draw: 1,
      light: 0.9,
      bg: DEEP,
    },
  },
};

const _pos = new THREE.Vector3();
const _tgt = new THREE.Vector3();
const _rot = new THREE.Euler();

/** Combina `from`/`to` de una escena con progreso p ∈ [0,1]. */
export function sampleTimeline(id: SceneId, p: number): Keyframe {
  const range = timeline[id];
  const t = Math.max(0, Math.min(1, p));
  const out: Keyframe = {};

  if (range.from.camPos && range.to.camPos)
    out.camPos = _pos.copy(range.from.camPos).lerp(range.to.camPos, t).clone();
  if (range.from.camTarget && range.to.camTarget)
    out.camTarget = _tgt.copy(range.from.camTarget).lerp(range.to.camTarget, t).clone();

  const lerpNum = (a?: number, b?: number) =>
    typeof a === 'number' && typeof b === 'number' ? a + (b - a) * t : undefined;

  if (range.from.objPos && range.to.objPos)
    out.objPos = new THREE.Vector3()
      .copy(range.from.objPos)
      .lerp(range.to.objPos, t);
  if (range.from.objRot && range.to.objRot) {
    _rot.set(
      range.from.objRot.x + (range.to.objRot.x - range.from.objRot.x) * t,
      range.from.objRot.y + (range.to.objRot.y - range.from.objRot.y) * t,
      range.from.objRot.z + (range.to.objRot.z - range.from.objRot.z) * t,
    );
    out.objRot = _rot.clone();
  }

  out.objScale = lerpNum(range.from.objScale, range.to.objScale);
  out.glow = lerpNum(range.from.glow, range.to.glow);
  out.draw = lerpNum(range.from.draw, range.to.draw);
  out.light = lerpNum(range.from.light, range.to.light);

  if (range.from.bg && range.to.bg)
    out.bg = range.from.bg.clone().lerp(range.to.bg, t);

  return out;
}
