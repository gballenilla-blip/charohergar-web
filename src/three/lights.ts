import * as THREE from 'three';

/** Rig de iluminación: clave cálida, relleno frío, contraluz y acento de marca. */

export interface Lights {
  key: THREE.DirectionalLight;
  accent: THREE.PointLight;
  rim: THREE.SpotLight;
  ambient: THREE.AmbientLight;
  /** Movimiento ambiental continuo (sombras dinámicas). */
  update(t: number): void;
  /** Intensidad global 0–1. */
  setIntensity(v: number): void;
  /** Color de acento (variantes de artista). */
  setAccent(hex: string): void;
  dispose(): void;
}

export function createLights(): Lights {
  const ambient = new THREE.AmbientLight(0xb9b2a6, 0.35);

  const key = new THREE.DirectionalLight(0xfff3d6, 2.1);
  key.position.set(4, 5, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 30;
  key.shadow.bias = -0.0012;

  const fill = new THREE.DirectionalLight(0x4ad9c4, 0.42);
  fill.position.set(-6, -2, 4);

  const rim = new THREE.SpotLight(0xe0bd44, 14, 30, Math.PI / 5, 0.6, 1.4);
  rim.position.set(-4, 3, -6);
  rim.target.position.set(0, 0, 0);

  const accent = new THREE.PointLight(0xc9a227, 6, 22, 1.6);
  accent.position.set(0, -2.5, 4);

  const baseInt = { key: 2.1, rim: 14, accent: 6, fill: 0.42, amb: 0.35 };

  return {
    key,
    accent,
    rim,
    ambient,
    update(t: number) {
      // la clave oscila lentamente → sombras dinámicas
      key.position.x = 4 + Math.sin(t * 0.25) * 2.2;
      key.position.y = 5 + Math.cos(t * 0.19) * 1.4;
      rim.position.x = -4 + Math.cos(t * 0.21) * 2.4;
      accent.position.y = -2.5 + Math.sin(t * 0.33) * 0.9;
      accent.intensity = baseInt.accent + Math.sin(t * 0.7) * 1.2;
    },
    setIntensity(v: number) {
      const k = Math.max(0, v);
      key.intensity = baseInt.key * k;
      fill.intensity = baseInt.fill * k;
      rim.intensity = baseInt.rim * k;
      ambient.intensity = baseInt.amb * (0.35 + 0.65 * k);
    },
    setAccent(hex: string) {
      accent.color.set(hex);
      rim.color.set(hex);
    },
    dispose() {
      [key, fill, rim, accent, ambient].forEach((l) => l.dispose?.());
    },
  };
}
