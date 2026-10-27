// Terrain rendering: the walkable DEM area as LOD tiles (with skirts), one coarse horizon mesh, and a
// surface shader driven by real elevation, slope, aspect and DEM drainage. Collision is sampled from the
// rendered tile triangles (groundAt) so the character always stands exactly on what is drawn.
import * as THREE from 'three';
import { fbm } from './TerrainLoader.js';

export const NOISE_GLSL = /* glsl */`
float hash2(ivec2 p, int seed) {
  uint h = (uint(p.x) * 0x27d4eb2du) ^ (uint(p.y) * 0x165667b1u) ^ (uint(seed) * 0x9e3779b1u);
  h = (h ^ (h >> 15u)) * 0x85ebca6bu;
  h = (h ^ (h >> 13u)) * 0xc2b2ae35u;
  h = h ^ (h >> 16u);
  return float(h) / 4294967296.0;
}
float vnoise(vec2 q, int seed) {
  vec2 i = floor(q); vec2 f = q - i;
  vec2 u = f * f * (3.0 - 2.0 * f);
  ivec2 ii = ivec2(i);
  float a = hash2(ii, seed), b = hash2(ii + ivec2(1, 0), seed), c = hash2(ii + ivec2(0, 1), seed), d = hash2(ii + ivec2(1, 1), seed);
  return a + (b - a) * u.x + (c - a) * u.y + (a - b - c + d) * u.x * u.y;
}
float fbm3(vec2 q, int seed) {
  float s = 0.0, amp = 0.5, f = 1.0, norm = 0.0;
  for (int i = 0; i < 3; i++) { s += amp * vnoise(q * f, seed + i * 17); norm += amp; amp *= 0.5; f *= 2.03; }
  return s / norm;
}
`;

// Colour palettes per landscape type (linear RGB). Each mountain picks one in its content file.
export const PALETTES = {
  'vic-alps': { forestA: [0.085, 0.13, 0.075], forestB: [0.15, 0.20, 0.11], woodA: [0.28, 0.32, 0.20], woodB: [0.40, 0.40, 0.26], alpA: [0.55, 0.51, 0.32], alpB: [0.37, 0.39, 0.24], rockA: [0.38, 0.36, 0.33], rockB: [0.52, 0.50, 0.46], moor: [0.50, 0.45, 0.28], silver: 0.18 },
  'nsw-alps': { forestA: [0.10, 0.14, 0.08], forestB: [0.17, 0.21, 0.12], woodA: [0.30, 0.34, 0.21], woodB: [0.42, 0.42, 0.27], alpA: [0.46, 0.48, 0.30], alpB: [0.34, 0.40, 0.24], rockA: [0.50, 0.49, 0.46], rockB: [0.64, 0.62, 0.58], moor: [0.48, 0.47, 0.30], silver: 0.10 },
  'tas-dolerite': { forestA: [0.05, 0.10, 0.05], forestB: [0.09, 0.15, 0.07], woodA: [0.22, 0.27, 0.15], woodB: [0.32, 0.34, 0.20], alpA: [0.40, 0.40, 0.25], alpB: [0.27, 0.31, 0.18], rockA: [0.22, 0.21, 0.20], rockB: [0.34, 0.32, 0.30], moor: [0.52, 0.45, 0.27], silver: 0.0 },
  'tas-highlands': { forestA: [0.05, 0.10, 0.05], forestB: [0.10, 0.16, 0.08], woodA: [0.22, 0.28, 0.15], woodB: [0.33, 0.35, 0.21], alpA: [0.42, 0.41, 0.26], alpB: [0.28, 0.32, 0.19], rockA: [0.25, 0.24, 0.22], rockB: [0.37, 0.35, 0.32], moor: [0.53, 0.46, 0.28], silver: 0.0 },
  'tas-quartzite': { forestA: [0.05, 0.10, 0.05], forestB: [0.09, 0.15, 0.07], woodA: [0.22, 0.27, 0.15], woodB: [0.32, 0.34, 0.20], alpA: [0.42, 0.41, 0.27], alpB: [0.29, 0.32, 0.19], rockA: [0.72, 0.72, 0.70], rockB: [0.90, 0.90, 0.87], moor: [0.54, 0.47, 0.28], silver: 0.0 },
  'tas-southwest': { forestA: [0.045, 0.09, 0.045], forestB: [0.08, 0.14, 0.065], woodA: [0.22, 0.26, 0.15], woodB: [0.31, 0.33, 0.20], alpA: [0.40, 0.40, 0.26], alpB: [0.27, 0.31, 0.18], rockA: [0.58, 0.58, 0.56], rockB: [0.74, 0.73, 0.70], moor: [0.56, 0.49, 0.29], silver: 0.0 },
};

// Ecology numbers come from each mountain's content (eco); these are only fallbacks.
export const DEFAULT_ECOLOGY = { forestTop: 1180, treeline: 1760, snowLine: 1790, snowCover: 0.45, rockSlope: 0.70, moorland: 0, palette: 'vic-alps' };

function smooth(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

// JS mirror of the shader's zone logic (vegetation placement, HUD terrain names, pace model)
export function zoneAt(world, eco, x, z) {
  const h = world.dem(x, z);
  const [gx, gz] = (world.near.contains(x, z) ? world.near : world.far).gradient(x, z);
  const l = Math.hypot(gx, 1, gz);
  const ny = 1 / l, nx = -gx / l, nz = -gz / l;
  const n1 = fbm(x / 900, z / 900, 3, 11), n2 = fbm(x / 140, z / 140, 3, 23);
  const warm = -nz;
  const forestTop = eco.forestTop + (n1 - 0.5) * 260;
  const treeline = eco.treeline + (n1 - 0.5) * 160 + warm * 40;
  const wet = world.drainage(x, z);
  let forest = 1 - smooth(forestTop - 60, forestTop + 60, h);
  const alpine = smooth(treeline - 50, treeline + 50, h);
  // button-grass moorland: flat, poorly drained ground below the treeline; forest keeps the gullies
  const flat = smooth(0.90, 0.985, ny);
  const moor = (eco.moorland || 0) * flat * (1 - alpine) * (1 - smooth(0.55, 0.8, wet)) * smooth(0.35, 0.6, n1 + 0.2);
  forest *= 1 - moor;
  const rock = smooth(eco.rockSlope + 0.10, eco.rockSlope - 0.04, ny);
  const lee = Math.max(-1, Math.min(1, nz * 0.7 + nx * 0.5));
  const n4 = fbm(x / 60, z / 60, 3, 37);
  const snow = smooth(eco.snowLine - 60, eco.snowLine + 120, h) * Math.max(0, Math.min(1, 0.35 + lee * 0.9)) * eco.snowCover * (0.55 + 0.9 * n4 + 0.6 * wet) * (1 - rock * 0.6);
  const lake = world.lakeAt(x, z);
  return { h, forest, alpine, moor, woodland: Math.max(0, 1 - forest - alpine - moor), rock, snow: snow > 0.46 ? 1 : 0, wet, n1, n2, slope: Math.acos(ny) * 180 / Math.PI, lake: !!lake };
}

const TERRAIN_FRAG = /* glsl */`
uniform sampler2D uDrain;
uniform vec4 uNear;
uniform vec4 uEco;            // forestTop, treeline, snowLine, snowCover
uniform vec2 uEco2;           // rockSlope, moorland
uniform float uWetness;
uniform vec3 cForestA, cForestB, cWoodA, cWoodB, cAlpA, cAlpB, cRockA, cRockB, cMoor;
uniform float cSilver;
varying vec3 vWPos;
varying vec3 vWNrm;
float tSnow; float tRock; float tWet; vec2 tBump;
${NOISE_GLSL}
vec3 terrainColor() {
  vec3 p = vWPos; vec3 n = normalize(vWNrm);
  vec2 xz = p.xz;
  float n1 = fbm3(xz / 900.0, 11), n2 = fbm3(xz / 140.0, 23), n3 = fbm3(xz / 37.0, 31);
  float warm = -n.z;
  float forestTop = uEco.x + (n1 - 0.5) * 260.0;
  float treeline = uEco.y + (n1 - 0.5) * 160.0 + warm * 40.0;
  float forest = 1.0 - smoothstep(forestTop - 60.0, forestTop + 60.0, p.y);
  float alpine = smoothstep(treeline - 50.0, treeline + 50.0, p.y);
  vec2 uv = (xz - uNear.xy) / uNear.zw;
  float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  float drain = texture2D(uDrain, uv).r * inside;
  tWet = drain;
  float flat_ = smoothstep(0.90, 0.985, n.y);
  float moor = uEco2.y * flat_ * (1.0 - alpine) * (1.0 - smoothstep(0.55, 0.8, drain)) * smoothstep(0.35, 0.6, n1 + 0.2);
  forest *= 1.0 - moor;
  float wood = clamp(1.0 - forest - alpine - moor, 0.0, 1.0);

  vec3 forestC = mix(cForestA, cForestB, n2);
  forestC = mix(forestC, cForestA * 0.75, smoothstep(0.45, 0.75, drain));
  vec3 woodC = mix(cWoodA, cWoodB, smoothstep(0.30, 0.75, n3));
  woodC = mix(woodC, vec3(0.50, 0.50, 0.46), cSilver * smoothstep(0.55, 0.8, n2));
  vec3 alpC = mix(cAlpA, cAlpB, smoothstep(0.40, 0.72, n3));
  alpC = mix(alpC, vec3(0.30, 0.42, 0.19), smoothstep(0.42, 0.62, drain));
  vec3 moorC = mix(cMoor, cMoor * vec3(0.8, 0.85, 0.7), smoothstep(0.3, 0.7, n3));
  vec3 col = forestC * forest + woodC * wood + alpC * alpine + moorC * moor;

  tRock = smoothstep(uEco2.x + 0.10, uEco2.x - 0.04, n.y);
  float strata = vnoise(vec2(p.y / 3.2, xz.x / 40.0), 51);
  vec3 rockC = mix(cRockA, cRockB, clamp(n3 * 0.7 + strata * 0.5, 0.0, 1.0));
  rockC = mix(rockC, rockC * vec3(0.9, 1.0, 0.85), 0.3 * smoothstep(0.5, 0.8, n2));
  col = mix(col, rockC, tRock);

  float creek = smoothstep(0.80, 0.93, drain);
  col = mix(col, vec3(0.11, 0.14, 0.12), creek * 0.8);

  float lee = clamp(n.z * 0.7 + n.x * 0.5, -1.0, 1.0);
  float n4 = fbm3(xz / 60.0, 37);
  tSnow = smoothstep(uEco.z - 60.0, uEco.z + 120.0, p.y) * clamp(0.35 + lee * 0.9, 0.0, 1.0) * uEco.w * (0.55 + 0.9 * n4 + 0.6 * drain) * (1.0 - tRock * 0.6);
  tSnow = smoothstep(0.42, 0.50, tSnow);
  col = mix(col, vec3(0.92, 0.94, 0.97), tSnow);

  // close-range ground texture: grain + a bump vector used to perturb lighting
  float d = length(cameraPosition - p);
  float near = 1.0 - smoothstep(25.0, 200.0, d);
  float f1 = vnoise(xz / 1.7, 41), f2 = vnoise(xz / 0.45, 43);
  col *= 1.0 + ((f1 - 0.5) * 0.16 + (f2 - 0.5) * 0.10) * near * (1.0 - tSnow * 0.7);
  float e = 0.15;
  float bx = vnoise((xz + vec2(e, 0.0)) / 0.9, 47) - vnoise((xz - vec2(e, 0.0)) / 0.9, 47);
  float bz = vnoise((xz + vec2(0.0, e)) / 0.9, 47) - vnoise((xz - vec2(0.0, e)) / 0.9, 47);
  tBump = vec2(bx, bz) * near * (0.6 + tRock * 1.4) * (1.0 - tSnow * 0.6);
  col *= 1.0 - uWetness * 0.25 * (1.0 - tSnow);
  return col;
}
`;

export function makeTerrainMaterial(world, eco) {
  const hf = world.near;
  const tex = new THREE.DataTexture(world.drain, hf.w, hf.h, THREE.RedFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  const pal = PALETTES[eco.palette] || PALETTES['vic-alps'];
  const v3 = (a) => ({ value: new THREE.Vector3(...a) });
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.96, metalness: 0 });
  const uniforms = {
    uDrain: { value: tex },
    uNear: { value: new THREE.Vector4(hf.x0, hf.zN, hf.x1 - hf.x0, hf.zS - hf.zN) },
    uEco: { value: new THREE.Vector4(eco.forestTop, eco.treeline, eco.snowLine, eco.snowCover) },
    uEco2: { value: new THREE.Vector2(eco.rockSlope, eco.moorland || 0) },
    uWetness: { value: 0 },
    cForestA: v3(pal.forestA), cForestB: v3(pal.forestB), cWoodA: v3(pal.woodA), cWoodB: v3(pal.woodB), cAlpA: v3(pal.alpA), cAlpB: v3(pal.alpB),
    cRockA: v3(pal.rockA), cRockB: v3(pal.rockB), cMoor: v3(pal.moor), cSilver: { value: pal.silver },
  };
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNrm = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + TERRAIN_FRAG)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = terrainColor();')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.5, tSnow);\nroughnessFactor = mix(roughnessFactor, 0.55, uWetness * tRock);')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(normal - (viewMatrix * vec4(tBump.x * 1.6, 0.0, tBump.y * 1.6, 0.0)).xyz);');
  };
  mat.customProgramCacheKey = () => 'terrain-v2';
  return mat;
}

const BASE_LODS = [[260, 0.25], [800, 0.5], [2000, 1], [4500, 2], [9000, 4], [Infinity, 8]];
let LODS = BASE_LODS;
export function setTerrainQuality(q) {
  const k = q === 'low' ? 0.55 : q === 'medium' ? 0.8 : 1;
  LODS = BASE_LODS.map(([d, s]) => [d * k, s]);
}
const TILE = 64;

export class TerrainTiles {
  constructor(scene, world, material) {
    this.scene = scene; this.world = world; this.mat = material;
    const hf = world.near;
    this.nx = Math.ceil((hf.w - 1) / TILE); this.nz = Math.ceil((hf.h - 1) / TILE);
    this.tiles = [];
    for (let tj = 0; tj < this.nz; tj++) for (let ti = 0; ti < this.nx; ti++) {
      const i0 = ti * TILE, j0 = tj * TILE, i1 = Math.min(i0 + TILE, hf.w - 1), j1 = Math.min(j0 + TILE, hf.h - 1);
      this.tiles.push({ ti, tj, i0, j0, i1, j1, x0: hf.wx(i0), x1: hf.wx(i1), z0: hf.wz(j0), z1: hf.wz(j1), lod: -1, mesh: null });
    }
    this.group = new THREE.Group();
    scene.add(this.group);
  }
  dist(t, x, z) { return Math.hypot(Math.max(t.x0 - x, 0, x - t.x1), Math.max(t.z0 - z, 0, z - t.z1)); }
  levelFor(d) { for (let k = 0; k < LODS.length; k++) if (d < LODS[k][0]) return k; return LODS.length - 1; }
  update(x, z, budgetMs = 6) {
    const pending = [];
    for (const t of this.tiles) { t.want = this.levelFor(this.dist(t, x, z)); if (t.want !== t.lod) pending.push(t); }
    pending.sort((a, b) => this.dist(a, x, z) - this.dist(b, x, z));
    const start = performance.now();
    for (const t of pending) { this.build(t, t.want); if (performance.now() - start > budgetMs) break; }
    return pending.length;
  }
  build(t, level) {
    const hf = this.world.near, W = this.world;
    const s = LODS[level][1];
    const spanI = t.i1 - t.i0, spanJ = t.j1 - t.j0;
    const cx = Math.max(2, Math.ceil(spanI / s) + 1), cz = Math.max(2, Math.ceil(spanJ / s) + 1);
    const spacing = s * hf.cx, skirt = 6 + spacing * 1.5;
    const nMain = cx * cz, nSkirt = 2 * (cx + cz);
    const pos = new Float32Array((nMain + nSkirt) * 3), nrm = new Float32Array((nMain + nSkirt) * 3);
    const e = Math.max(1.5, spacing * 0.6);
    let k = 0;
    for (let b = 0; b < cz; b++) {
      const z = hf.wz(t.j0 + spanJ * b / (cz - 1));
      for (let a = 0; a < cx; a++, k++) {
        const x = hf.wx(t.i0 + spanI * a / (cx - 1));
        pos[k * 3] = x; pos[k * 3 + 1] = W.height(x, z); pos[k * 3 + 2] = z;
        const hx = (W.height(x + e, z) - W.height(x - e, z)) / (2 * e), hz = (W.height(x, z + e) - W.height(x, z - e)) / (2 * e);
        const l = Math.hypot(hx, 1, hz);
        nrm[k * 3] = -hx / l; nrm[k * 3 + 1] = 1 / l; nrm[k * 3 + 2] = -hz / l;
      }
    }
    const edgeIdx = [
      Array.from({ length: cx }, (_, a) => a), Array.from({ length: cx }, (_, a) => (cz - 1) * cx + a),
      Array.from({ length: cz }, (_, b) => b * cx), Array.from({ length: cz }, (_, b) => b * cx + cx - 1),
    ];
    const edges = [];
    for (const list of edgeIdx) {
      const out = [];
      for (const src of list) {
        pos[k * 3] = pos[src * 3]; pos[k * 3 + 1] = pos[src * 3 + 1] - skirt; pos[k * 3 + 2] = pos[src * 3 + 2];
        nrm[k * 3] = nrm[src * 3]; nrm[k * 3 + 1] = nrm[src * 3 + 1]; nrm[k * 3 + 2] = nrm[src * 3 + 2];
        out.push([src, k]); k++;
      }
      edges.push(out);
    }
    const idx = [];
    for (let b = 0; b < cz - 1; b++) for (let a = 0; a < cx - 1; a++) { const i = b * cx + a; idx.push(i, i + cx, i + 1, i + 1, i + cx, i + cx + 1); }
    for (const out of edges) for (let m = 0; m < out.length - 1; m++) {
      const [a0, s0] = out[m], [a1, s1] = out[m + 1];
      idx.push(a0, s0, a1, a1, s0, s1, a0, a1, s0, a1, s1, s0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    g.setIndex(k > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    if (t.mesh) { this.group.remove(t.mesh); t.mesh.geometry.dispose(); }
    const m = new THREE.Mesh(g, this.mat);
    m.receiveShadow = true; m.castShadow = level <= 1; m.matrixAutoUpdate = false;
    this.group.add(m);
    t.mesh = m; t.lod = level; t.grid = { cx, cz, pos, spanI, spanJ };
  }
  // exact height of the rendered surface (the same triangles the GPU draws)
  groundAt(x, z) {
    const hf = this.world.near;
    const fi = hf.gx(x), fj = hf.gz(z);
    const ti = Math.min(this.nx - 1, Math.max(0, Math.floor(fi / TILE))), tj = Math.min(this.nz - 1, Math.max(0, Math.floor(fj / TILE)));
    const t = this.tiles[tj * this.nx + ti];
    if (!t || !t.grid || !hf.contains(x, z)) return this.world.height(x, z);
    const { cx, cz, pos, spanI, spanJ } = t.grid;
    const u = Math.max(0, Math.min(cx - 1.0001, (fi - t.i0) / spanI * (cx - 1)));
    const v = Math.max(0, Math.min(cz - 1.0001, (fj - t.j0) / spanJ * (cz - 1)));
    const a = Math.floor(u), b = Math.floor(v), fu = u - a, fv = v - b;
    const y = (aa, bb) => pos[((bb) * cx + aa) * 3 + 1];
    // triangles (i, i+cx, i+1) and (i+1, i+cx, i+cx+1): split along the anti-diagonal
    if (fu + fv <= 1) return y(a, b) + (y(a + 1, b) - y(a, b)) * fu + (y(a, b + 1) - y(a, b)) * fv;
    return y(a + 1, b + 1) + (y(a, b + 1) - y(a + 1, b + 1)) * (1 - fu) + (y(a + 1, b) - y(a + 1, b + 1)) * (1 - fv);
  }
  dispose() { for (const t of this.tiles) if (t.mesh) t.mesh.geometry.dispose(); this.scene.remove(this.group); }
}

export function buildHorizon(scene, world, material) {
  const far = world.far, near = world.near, step = 2;
  const cx = Math.floor((far.w - 1) / step) + 1, cz = Math.floor((far.h - 1) / step) + 1;
  const pos = new Float32Array(cx * cz * 3), inner = new Uint8Array(cx * cz);
  const m = far.cx * step * 2;
  for (let b = 0; b < cz; b++) for (let a = 0; a < cx; a++) {
    const k = b * cx + a, x = far.wx(a * step), z = far.wz(b * step);
    let y = far.at(a * step, b * step);
    if (near.contains(x, z, -m * 0.5)) y -= 60;
    if (near.contains(x, z, m)) inner[k] = 1;
    pos[k * 3] = x; pos[k * 3 + 1] = Math.max(y, -2); pos[k * 3 + 2] = z;
  }
  const idx = [];
  for (let b = 0; b < cz - 1; b++) for (let a = 0; a < cx - 1; a++) {
    const i = b * cx + a;
    if (inner[i] && inner[i + 1] && inner[i + cx] && inner[i + cx + 1]) continue;
    idx.push(i, i + cx, i + 1, i + 1, i + cx, i + cx + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.Uint32BufferAttribute(idx, 1));
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, material);
  mesh.matrixAutoUpdate = false;
  scene.add(mesh);
  // sea: Tasmania's horizon grids reach the coast
  if (far.data.some(v => v <= 0.5)) {
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(far.x1 - far.x0, far.zS - far.zN).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x23404f, roughness: 0.25, metalness: 0.2 }));
    sea.position.set((far.x0 + far.x1) / 2, 0.5, (far.zN + far.zS) / 2);
    scene.add(sea);
    mesh.userData.sea = sea;
  }
  return mesh;
}
