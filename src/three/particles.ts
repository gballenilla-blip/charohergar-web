import * as THREE from 'three';

/** Campo de partículas ambiental: polvo suspendido con parallax suave. */

export interface Particles {
  points: THREE.Points;
  update(t: number, pointer: THREE.Vector2): void;
  setCount(n: number): void;
  dispose(): void;
}

export function createParticles(count: number): Particles {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * 26;
    positions[i3 + 1] = (Math.random() - 0.5) * 16;
    positions[i3 + 2] = (Math.random() - 0.5) * 14 - 2;
    seeds[i3] = Math.random() * Math.PI * 2;
    seeds[i3 + 1] = 0.15 + Math.random() * 0.5;
    seeds[i3 + 2] = 0.2 + Math.random() * 0.8;
    sizes[i] = 0.5 + Math.random() * 1.6;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPointer: { value: new THREE.Vector2() },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uColor: { value: new THREE.Color(0xe0bd44) },
      uOpacity: { value: 0.75 },
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute vec3 aSeed;
      uniform float uTime;
      uniform vec2 uPointer;
      uniform float uPixelRatio;
      varying float vAlpha;

      void main() {
        vec3 p = position;
        float t = uTime * aSeed.y;
        p.x += sin(t + aSeed.x) * 0.5;
        p.y += cos(t * 0.8 + aSeed.x) * 0.42 + sin(uTime * 0.12) * 0.2;
        p.z += sin(t * 0.6 + aSeed.x * 2.0) * 0.4;

        // parallax por puntero, más marcado en partículas cercanas
        float depth = smoothstep(-9.0, 4.0, p.z);
        p.x += uPointer.x * depth * 0.9;
        p.y += uPointer.y * depth * 0.55;

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPixelRatio * (46.0 / -mv.z);
        vAlpha = smoothstep(-16.0, -3.0, mv.z) * (0.35 + aSeed.z * 0.65);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vAlpha;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        if (d > 0.5) discard;
        float glow = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(uColor, glow * glow * vAlpha * uOpacity);
      }
    `,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;

  const base = positions.slice();

  return {
    points,
    update(t: number, pointer: THREE.Vector2) {
      mat.uniforms.uTime.value = t;
      (mat.uniforms.uPointer.value as THREE.Vector2).set(pointer.x, pointer.y);
    },
    setCount(n: number) {
      geo.setDrawRange(0, Math.min(n, count));
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      void base;
    },
  };
}
