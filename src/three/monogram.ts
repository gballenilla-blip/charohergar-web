import * as THREE from 'three';

/**
 * Monograma Charohergar construido en3D a partir de los paths SVG oficiales.
 * viewBox 512×512: placa `x=176 y=40 w=160 h=432` + 4 trazos (grosor 16).
 */

export const MONOGRAM_PATHS = [
  'M92 398 C 18 336 6 214 58 142 C 108 74 208 46 300 48 C 380 50 440 78 462 120 C 478 150 468 182 442 192',
  'M150 434 C 140 352 166 268 206 214 C 236 172 270 178 262 214 C 254 254 214 300 199 342',
  'M199 342 C 224 320 250 302 268 322 C 289 344 293 392 283 434',
  'M283 434 C 332 458 402 464 456 432 C 481 416 487 392 470 384',
];

const PLATE = { x: 176, y: 40, w: 160, h: 432, r: 6 };
const STROKE_W = 16;

/** Unidades de mundo: el viewBox 512 se mapea a WORLD_SIZE. */
const WORLD_SIZE = 3.4;
const S = WORLD_SIZE / 512;

type Cmd = { type: 'M' | 'C'; nums: number[] };

/** Parser mínimo para los comandos M y C usados por el logo. */
function parsePath(d: string): Cmd[] {
  const tokens = d.match(/[MC]|-?\d*\.?\d+/g);
  if (!tokens) return [];
  const cmds: Cmd[] = [];
  let i = 0;
  while (i < tokens.length) {
    const type = tokens[i] as 'M' | 'C';
    i++;
    const nums: number[] = [];
    while (i < tokens.length && !/[MC]/.test(tokens[i])) {
      nums.push(parseFloat(tokens[i]));
      i++;
    }
    cmds.push({ type, nums });
  }
  return cmds;
}

/** Muestrea una curva cúbica de Bezier. */
function cubic(
  p0: THREE.Vector2,
  p1: THREE.Vector2,
  p2: THREE.Vector2,
  p3: THREE.Vector2,
  seg: number,
  out: THREE.Vector2[],
): void {
  for (let i = 1; i <= seg; i++) {
    const t = i / seg;
    const u = 1 - t;
    const x = u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x;
    const y = u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y;
    out.push(new THREE.Vector2(x, y));
  }
}

/** Convierte un path SVG en puntos (coordenadas SVG, y hacia abajo). */
export function samplePath(d: string, segments = 26): THREE.Vector2[] {
  const cmds = parsePath(d);
  const pts: THREE.Vector2[] = [];
  let cur = new THREE.Vector2(0, 0);

  for (const cmd of cmds) {
    if (cmd.type === 'M') {
      cur = new THREE.Vector2(cmd.nums[0], cmd.nums[1]);
      pts.push(cur.clone());
    } else {
      const [x1, y1, x2, y2, x, y] = cmd.nums;
      cubic(
        cur.clone(),
        new THREE.Vector2(x1, y1),
        new THREE.Vector2(x2, y2),
        new THREE.Vector2(x, y),
        segments,
        pts,
      );
      cur = new THREE.Vector2(x, y);
    }
  }
  return pts;
}

/** Punto SVG → punto3D (centrado, y invertida). El z separa los trazos del
 *  plano de la placa para que no se interpenetren. */
const STROKE_Z = (16 / 2 + 4 + STROKE_W / 2) * S; // cara frontal de la placa + radio

function toWorld(p: THREE.Vector2): THREE.Vector3 {
  return new THREE.Vector3((p.x - 256) * S, (256 - p.y) * S, STROKE_Z);
}

export interface Monogram {
  group: THREE.Group;
  /** Revela los trazos progresivamente (0 = oculto, 1 = completo). */
  setDraw(t: number): void;
  setGlow(v: number): void;
  plate: THREE.Mesh;
  dispose(): void;
}

export function createMonogram(): Monogram {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];

  /* ---------- placa (extrusión con bisel) ---------- */
  const plateShape = new THREE.Shape();
  const { x, y, w, h, r } = PLATE;
  plateShape.moveTo(x + r, y);
  plateShape.lineTo(x + w - r, y);
  plateShape.quadraticCurveTo(x + w, y, x + w, y + r);
  plateShape.lineTo(x + w, y + h - r);
  plateShape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  plateShape.lineTo(x + r, y + h);
  plateShape.quadraticCurveTo(x, y + h, x, y + h - r);
  plateShape.lineTo(x, y + r);
  plateShape.quadraticCurveTo(x, y, x + r, y);

  const plateGeo = new THREE.ExtrudeGeometry(plateShape, {
    depth: 16,
    bevelEnabled: true,
    bevelThickness: 4,
    bevelSize: 4,
    bevelSegments: 3,
    curveSegments: 8,
  });
  plateGeo.center();
  // centrar respecto al viewBox (en coordenadas SVG, antes de escalar)
  plateGeo.translate(-(x + w / 2 - 256), 256 - (y + h / 2), 0);
  applyScale(plateGeo);

  const plateMat = new THREE.MeshStandardMaterial({
    color: 0x14110f,
    metalness: 0.85,
    roughness: 0.34,
    envMapIntensity: 1,
  });
  const plate = new THREE.Mesh(plateGeo, plateMat);
  plate.castShadow = true;
  disposables.push(plateGeo, plateMat);
  group.add(plate);

  /* ---------- marco dorado de la placa ---------- */
  const frameGeo = trimEdges(
    (x + w / 2 - 256) * S,
    (256 - (y + h / 2)) * S,
    w * S,
    h * S,
    18 * S,
  );
  disposables.push(frameGeo);
  const frameMat = new THREE.LineBasicMaterial({ color: 0xc9a227, transparent: true, opacity: 0.55 });
  disposables.push(frameMat);
  group.add(new THREE.LineSegments(frameGeo, frameMat));

  /* ---------- trazos ---------- */
  const strokeMat = new THREE.MeshStandardMaterial({
    color: 0xe0bd44,
    metalness: 0.9,
    roughness: 0.22,
    emissive: new THREE.Color(0xc9a227),
    emissiveIntensity: 0.15,
  });
  disposables.push(strokeMat);

  const strokeMeshes: THREE.Mesh[] = [];
  const indexCounts: number[] = [];

  for (const d of MONOGRAM_PATHS) {
    const svgPts = samplePath(d);
    const worldPts = svgPts.map(toWorld);
    const curve = new THREE.CatmullRomCurve3(worldPts, false, 'catmullrom', 0.4);
    const tubeGeo = new THREE.TubeGeometry(curve, 220, (STROKE_W / 2) * S, 10, false);
    disposables.push(tubeGeo);
    const mesh = new THREE.Mesh(tubeGeo, strokeMat);
    mesh.castShadow = true;
    indexCounts.push(tubeGeo.index ? tubeGeo.index.count : 0);
    strokeMeshes.push(mesh);
    group.add(mesh);
  }

  let drawT = 0;

  function setDraw(t: number): void {
    drawT = Math.max(0, Math.min(1, t));
    strokeMeshes.forEach((mesh, i) => {
      const geo = mesh.geometry as THREE.TubeGeometry;
      const total = indexCounts[i];
      // los trazos entran en cascada a lo largo del rango global
      const local = Math.max(0, Math.min(1, drawT * MONOGRAM_PATHS.length - i));
      geo.setDrawRange(0, Math.floor((total * local) / 3) * 3);
      mesh.visible = local > 0.001;
    });
  }

  function setGlow(v: number): void {
    strokeMat.emissiveIntensity = 0.08 + v * 1.1;
    plateMat.emissive.setRGB(0.02 * v, 0.017 * v, 0.01 * v);
  }

  function dispose(): void {
    disposables.forEach((d) => d.dispose());
  }

  setDraw(1);
  setGlow(0.3);

  return { group, setDraw, setGlow, plate, dispose };
}

function applyScale(geo: THREE.BufferGeometry): void {
  geo.scale(S, S, S);
}

/** Marcos rectangular simple para el contorno de la placa. */
function trimEdges(
  cx: number,
  cy: number,
  w: number,
  h: number,
  depth: number,
): THREE.BufferGeometry {
  const hw = w / 2;
  const hh = h / 2;
  const hd = depth / 2;
  const corners: THREE.Vector3[] = [];
  for (const z of [-hd, hd]) {
    corners.push(
      new THREE.Vector3(cx - hw, cy - hh, z),
      new THREE.Vector3(cx + hw, cy - hh, z),
      new THREE.Vector3(cx + hw, cy + hh, z),
      new THREE.Vector3(cx - hw, cy + hh, z),
    );
  }
  const pairs: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  const positions = new Float32Array(pairs.length * 6);
  pairs.forEach(([a, b], i) => {
    positions.set([corners[a].x, corners[a].y, corners[a].z], i * 6);
    positions.set([corners[b].x, corners[b].y, corners[b].z], i * 6 + 3);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geo;
}
