// Instanced vegetation and rocks, scattered per 400 m chunk around the player using the same ecological
// zones as the terrain shader (zoneAt). Species are generic stand-ins chosen per landscape type.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hash2 } from './TerrainLoader.js';
import { zoneAt, PALETTES } from './TerrainGenerator.js';

const CHUNK = 400;
const BASE_TIERS = [
  { d: 520, tree: 8, shrub: 4.5, tuss: 2.4, rock: 9, lod: 'hi' },
  { d: 1300, tree: 12, shrub: 9, tuss: 0, rock: 16, lod: 'hi' },
  { d: 2600, tree: 19, shrub: 0, tuss: 0, rock: 0, lod: 'lo' },
];
export const QUALITY = { high: { range: 1, spacing: 1, shadows: true }, medium: { range: 0.75, spacing: 1.25, shadows: true }, low: { range: 0.5, spacing: 1.6, shadows: false } };
let TIERS = BASE_TIERS;
export function setVegQuality(q) {
  const Q = QUALITY[q] || QUALITY.high;
  TIERS = BASE_TIERS.map(t => ({ ...t, d: t.d * Q.range, tree: t.tree * Q.spacing, shrub: t.shrub * Q.spacing, tuss: q === 'low' ? 0 : t.tuss * Q.spacing, rock: t.rock * Q.spacing }));
}

function colorize(g, c, jitter = 0.06, seed = 1) {
  const n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const j = (hash2(i, seed, 7) - 0.5) * jitter; col[i * 3] = c[0] + j; col[i * 3 + 1] = c[1] + j; col[i * 3 + 2] = c[2] + j; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
function prep(g) { if (g.index) g = g.toNonIndexed(); g.deleteAttribute('uv'); return g; }
function blob(r, sx, sy, sz, x, y, z, c, seed, detail = 0) {
  const g = prep(new THREE.IcosahedronGeometry(r, detail));
  const p = g.attributes.position, nrm = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const ox = p.getX(i), oy = p.getY(i), oz = p.getZ(i);
    const k = 1 + (hash2(Math.round(ox * 97), Math.round(oy * 97) * 31 + Math.round(oz * 97), seed) - 0.5) * 0.35;
    p.setXYZ(i, ox * sx * k + x, oy * sy * k + y, oz * sz * k + z);
    const l = Math.hypot(ox, oy + r * 0.6, oz) || 1;
    nrm.setXYZ(i, ox / l, (oy + r * 0.6) / l, oz / l);
  }
  return colorize(g, c, 0.08, seed);
}
function limb(x0, y0, z0, x1, y1, z1, r0, r1, c, sides = 5) {
  const len = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
  const g = prep(new THREE.CylinderGeometry(r1, r0, len, sides, 1, true));
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0).normalize()));
  g.translate(x0, y0, z0);
  return colorize(g, c, 0.05, Math.round(len * 100));
}
const BARK_SNOW = [0.84, 0.80, 0.72], BARK_DEAD = [0.70, 0.70, 0.68], BARK_ASH = [0.62, 0.58, 0.50], BARK_DARK = [0.25, 0.20, 0.16];
const LEAF_SNOW = [0.30, 0.37, 0.22], LEAF_ASH = [0.17, 0.23, 0.13], FROND = [0.22, 0.38, 0.13], LEAF_MYRTLE = [0.10, 0.20, 0.08], LEAF_PINE = [0.12, 0.22, 0.12];

const SPECIES = {
  snowgum(lo) {
    const p = [limb(0, -0.4, 0, 0.5, 2.2, 0.2, 0.22, 0.16, BARK_SNOW, lo ? 3 : 5), limb(0.5, 2.2, 0.2, 1.4, 4.4, 0.8, 0.16, 0.08, BARK_SNOW, lo ? 3 : 5), blob(1.6, 1.3, 0.75, 1.2, 1.5, 4.8, 0.9, LEAF_SNOW, 11, lo ? 0 : 1)];
    if (!lo) p.push(limb(0.5, 2.2, 0.2, -0.9, 4.0, -0.6, 0.13, 0.07, BARK_SNOW), blob(1.3, 1.2, 0.7, 1.1, -1.0, 4.4, -0.7, LEAF_SNOW, 12), blob(1.0, 1.1, 0.7, 1.0, 0.3, 5.5, 0.0, LEAF_SNOW, 13));
    return mergeGeometries(p);
  },
  dead(lo) {
    const p = [limb(0, -0.4, 0, 0.3, 3.0, 0.1, 0.20, 0.12, BARK_DEAD, lo ? 3 : 5), limb(0.3, 3.0, 0.1, 1.2, 5.2, 0.5, 0.12, 0.04, BARK_DEAD, 3)];
    if (!lo) p.push(limb(0.3, 3.0, 0.1, -0.8, 4.8, -0.4, 0.10, 0.03, BARK_DEAD, 3), limb(0.2, 2.0, 0.1, 0.4, 3.4, 1.2, 0.07, 0.02, BARK_DEAD, 3));
    return mergeGeometries(p);
  },
  ash(lo) {
    const p = [limb(0, -0.6, 0, 0, 24, 0, 0.45, 0.18, BARK_ASH, lo ? 4 : 6), blob(3.4, 1.1, 1.6, 1.1, 0.4, 25, 0.2, LEAF_ASH, 21, lo ? 0 : 1)];
    if (!lo) p.push(blob(2.6, 1.0, 1.3, 1.0, -1.6, 21, -0.8, LEAF_ASH, 22), blob(2.3, 1.0, 1.2, 1.0, 1.7, 19.5, 1.0, LEAF_ASH, 23));
    return mergeGeometries(p);
  },
  myrtle(lo) {   // cool temperate rainforest: dense dark dome canopy, mossy trunk
    const p = [limb(0, -0.5, 0, 0.3, 9, 0.2, 0.42, 0.25, BARK_DARK, lo ? 4 : 6), blob(4.2, 1.15, 0.85, 1.1, 0.3, 12.5, 0.1, LEAF_MYRTLE, 71, lo ? 0 : 1)];
    if (!lo) p.push(blob(3.0, 1.1, 0.8, 1.0, -2.4, 10.5, 1.2, LEAF_MYRTLE, 72), blob(2.8, 1.1, 0.8, 1.0, 2.2, 10.8, -1.3, LEAF_MYRTLE, 73));
    return mergeGeometries(p);
  },
  pencilpine(lo) {   // Athrotaxis: narrow, dark, layered cone
    const p = [limb(0, -0.3, 0, 0, 2, 0, 0.18, 0.14, BARK_DARK, 4)];
    const layers = lo ? 2 : 4;
    for (let k = 0; k < layers; k++) {
      const g = prep(new THREE.ConeGeometry(1.4 - k * 0.28, 2.6, lo ? 5 : 7));
      g.translate(0, 2.2 + k * 1.5, 0);
      p.push(colorize(g, LEAF_PINE, 0.05, 80 + k));
    }
    return mergeGeometries(p);
  },
  fern() {
    const p = [limb(0, -0.3, 0, 0, 3.0, 0, 0.18, 0.15, [0.22, 0.16, 0.11], 5)];
    for (let k = 0; k < 7; k++) {
      const g = prep(new THREE.ConeGeometry(0.35, 2.4, 3, 1, true));
      g.rotateZ(Math.PI / 2 - 0.35); g.translate(1.1, 3.1, 0); g.rotateY(k / 7 * Math.PI * 2);
      p.push(colorize(g, FROND, 0.08, k + 40));
    }
    return mergeGeometries(p);
  },
  shrub() { return mergeGeometries([blob(0.8, 1.2, 0.6, 1.1, 0, 0.3, 0, [0.22, 0.28, 0.16], 31, 1), blob(0.5, 1.1, 0.7, 1.0, 0.45, 0.45, 0.2, [0.27, 0.31, 0.18], 32)]); },
  tussock() { return grassClump(9, 0.38, 0.3, 0.05, [0.58, 0.55, 0.33], [0.42, 0.46, 0.26]); },
  buttongrass() { return grassClump(16, 0.7, 0.5, 0.06, [0.62, 0.53, 0.30], [0.45, 0.45, 0.25], 0.5); },
  boulder(lo, rock) {
    const g = prep(new THREE.DodecahedronGeometry(1, 0));
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = 0.75 + hash2(Math.round(p.getX(i) * 50), Math.round(p.getZ(i) * 50), 9) * 0.5; p.setXYZ(i, p.getX(i) * k * 1.3, p.getY(i) * k * 0.7, p.getZ(i) * k); }
    g.computeVertexNormals();
    return colorize(g, rock, 0.10, 61);
  },
  column(lo, rock) {   // dolerite: clustered hexagonal columns
    const p = [];
    for (let k = 0; k < 5; k++) {
      const h = 2.5 + hash2(k, 3, 9) * 3.5;
      const g = prep(new THREE.CylinderGeometry(0.55, 0.6, h, 6));
      g.translate(Math.cos(k * 1.26) * 0.95 * (k ? 1 : 0), h / 2 - 0.3, Math.sin(k * 1.26) * 0.95 * (k ? 1 : 0));
      p.push(colorize(g, rock.map(v => v * (0.9 + hash2(k, 1, 9) * 0.2)), 0.05, 90 + k));
    }
    return mergeGeometries(p);
  },
};
function grassClump(n, h0, hr, w, c1, c2, spread = 0.18) {
  const parts = [];
  for (let k = 0; k < n; k++) {
    const h = h0 + hash2(k, 4, 5) * hr;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-w, 0, 0, w, 0, 0, 0, h, 0], 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    g.rotateZ((hash2(k, 1, 5) - 0.5) * 0.9); g.rotateY(k * 0.7 + hash2(k, 6, 5));
    g.translate((hash2(k, 2, 5) - 0.5) * spread, 0, (hash2(k, 3, 5) - 0.5) * spread);
    const nn = g.attributes.normal; for (let i = 0; i < nn.count; i++) nn.setXYZ(i, 0, 1, 0);
    parts.push(colorize(g, k % 3 ? c1 : c2, 0.06, k + 50));
  }
  return mergeGeometries(parts);
}

// which species fill each zone, per landscape type
const FLORA = {
  'vic-alps': { forest: ['ash'], gully: 'fern', wood: ['snowgum'], dead: 0.25, rock: 'boulder', moor: 'tussock' },
  'nsw-alps': { forest: ['ash'], gully: 'fern', wood: ['snowgum'], dead: 0.08, rock: 'boulder', moor: 'tussock' },
  'tas-dolerite': { forest: ['myrtle'], gully: 'fern', wood: ['snowgum', 'pencilpine'], dead: 0.04, rock: 'column', moor: 'buttongrass' },
  'tas-highlands': { forest: ['myrtle'], gully: 'fern', wood: ['pencilpine', 'snowgum'], dead: 0.04, rock: 'column', moor: 'buttongrass' },
  'tas-quartzite': { forest: ['myrtle'], gully: 'fern', wood: ['snowgum', 'pencilpine'], dead: 0.03, rock: 'boulder', moor: 'buttongrass' },
  'tas-southwest': { forest: ['myrtle'], gully: 'fern', wood: ['snowgum', 'pencilpine'], dead: 0.03, rock: 'boulder', moor: 'buttongrass' },
};

export class Vegetation {
  constructor(scene, world, eco, trailIndex, avoid) {
    this.scene = scene; this.world = world; this.eco = eco; this.trails = trailIndex; this.avoid = avoid;
    this.flora = FLORA[eco.palette] || FLORA['vic-alps'];
    const rock = (PALETTES[eco.palette] || PALETTES['vic-alps']).rockB;
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
    this.mat.onBeforeCompile = (sh) => {
      // dithered fade of anything within ~4 m of the camera, so a third-person camera in dense forest
      // never ends up looking through the inside of a canopy
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vVegPos;')
        .replace('#include <project_vertex>', '#include <project_vertex>\n#ifdef USE_INSTANCING\nvVegPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n#else\nvVegPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#endif');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vVegPos;')
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n{ float dc = distance(vVegPos, cameraPosition); float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453); if (dc < 4.5 && n > (dc - 1.5) / 3.0) discard; }')
        .replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''));
    };
    this.mat.customProgramCacheKey = () => 'veg-fade-v1';
    this.geo = {};
    for (const k of Object.keys(SPECIES)) this.geo[k] = { hi: SPECIES[k](false, rock), lo: SPECIES[k](true, rock) };
    this.chunks = new Map();
    this.group = new THREE.Group();
    scene.add(this.group);
  }
  reset() { for (const ch of this.chunks.values()) this.drop(ch); this.chunks.clear(); }
  dispose() { this.reset(); for (const g of Object.values(this.geo)) { g.hi.dispose(); g.lo.dispose(); } this.mat.dispose(); this.scene.remove(this.group); }
  update(px, pz, budgetMs = 5) {
    const R = TIERS[TIERS.length - 1].d;
    const want = new Map();
    for (let r = Math.floor((pz - R) / CHUNK); r <= Math.floor((pz + R) / CHUNK); r++) for (let c = Math.floor((px - R) / CHUNK); c <= Math.floor((px + R) / CHUNK); c++) {
      const cx = (c + 0.5) * CHUNK, cz = (r + 0.5) * CHUNK;
      const d = Math.max(0, Math.hypot(cx - px, cz - pz) - CHUNK * 0.5);
      const tier = TIERS.findIndex(t => d < t.d);
      if (tier < 0 || !this.world.near.contains(cx, cz, -CHUNK * 0.5)) continue;
      want.set(`${c},${r}`, { c, r, tier, d });
    }
    for (const [key, ch] of this.chunks) if (!want.has(key)) { this.drop(ch); this.chunks.delete(key); }
    const todo = [...want.entries()].filter(([k, w]) => !this.chunks.has(k) || this.chunks.get(k).tier !== w.tier).sort((a, b) => a[1].d - b[1].d);
    const start = performance.now();
    for (const [key, w] of todo) {
      const old = this.chunks.get(key);
      const ch = this.build(w.c, w.r, w.tier);
      if (old) this.drop(old);
      this.chunks.set(key, ch);
      if (performance.now() - start > budgetMs) break;
    }
    return todo.length;
  }
  drop(ch) { for (const m of ch.meshes) { this.group.remove(m); m.dispose(); } }
  build(c, r, tier) {
    const T = TIERS[tier], W = this.world, eco = this.eco, F = this.flora;
    const x0 = c * CHUNK, z0 = r * CHUNK;
    const Z = 8, nz = CHUNK / Z;
    const zones = new Array(nz * nz);
    for (let b = 0; b < nz; b++) for (let a = 0; a < nz; a++) zones[b * nz + a] = zoneAt(W, eco, x0 + (a + 0.5) * Z, z0 + (b + 0.5) * Z);
    const zone = (x, z) => zones[Math.min(nz - 1, Math.floor((z - z0) / Z)) * nz + Math.min(nz - 1, Math.floor((x - x0) / Z))];
    const out = {};
    for (const k of Object.keys(SPECIES)) out[k] = [];
    const blocked = (x, z, clear) => this.trails.distance(x, z, clear + 2) < clear || this.avoid(x, z);
    const place = (kind, x, z, s, sink = 0.2) => out[kind].push(x, W.height(x, z) - sink * s, z, hash2(Math.round(x * 10), Math.round(z * 10), 77) * Math.PI * 2, s);
    const scatter = (spacing, seed, fn) => {
      if (!spacing) return;
      const n = Math.round(CHUNK / spacing);
      for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) {
        const gi = c * n + a, gj = r * n + b;
        const x = x0 + (a + hash2(gi, gj, seed)) * spacing, z = z0 + (b + hash2(gi, gj, seed + 1)) * spacing;
        const zn = zone(x, z);
        if (zn.lake) continue;
        fn(x, z, hash2(gi, gj, seed + 2), hash2(gi, gj, seed + 3), zn);
      }
    };
    scatter(T.tree, 100, (x, z, u, v, zn) => {
      if (zn.snow || zn.rock > 0.6 || zn.wet > 0.93) return;
      const p = zn.forest * 0.34 + zn.woodland * (0.20 + 0.22 * zn.n2) + zn.alpine * zn.wet * 0.3 + zn.moor * zn.wet * 0.4;
      if (u > p * (1 - zn.rock * 0.7) || blocked(x, z, 3.5)) return;
      if (zn.forest > 0.5) {
        if (zn.wet > 0.55 && v < 0.5) place(F.gully, x, z, 0.8 + v * 0.8);
        else place(F.forest[Math.floor(v * F.forest.length) % F.forest.length], x, z, 0.75 + v * 0.55);
      } else {
        const deadShare = zn.h > eco.forestTop + 250 ? F.dead * (0.6 + zn.n1) : F.dead * 0.3;
        const sp = v < deadShare ? 'dead' : F.wood[Math.floor(hash2(Math.round(x), Math.round(z), 5) * F.wood.length)];
        place(sp, x, z, (zn.alpine > 0.5 ? 0.55 : 0.8) + v * 0.6);
      }
    });
    scatter(T.shrub, 200, (x, z, u, v, zn) => {
      if (zn.snow || zn.wet > 0.93) return;
      const p = zn.alpine * 0.24 + zn.woodland * 0.22 + zn.forest * 0.30 + zn.rock * 0.1 + zn.moor * 0.12;
      if (u > p || blocked(x, z, 1.8)) return;
      place('shrub', x, z, 0.5 + v * 0.7, 0.1);
    });
    scatter(T.tuss, 300, (x, z, u, v, zn) => {
      if (zn.snow || zn.forest > 0.6) return;
      const moorP = zn.moor * 0.85, p = zn.alpine * 0.75 + zn.woodland * 0.45;
      if (u > (p + moorP) * (1 - zn.rock) || blocked(x, z, 1.0)) return;
      place(u < moorP ? F.moor : 'tussock', x, z, 0.7 + v * 0.8, 0.05);
    });
    scatter(T.rock, 400, (x, z, u, v, zn) => {
      const p = 0.04 + zn.rock * 0.55 + zn.alpine * 0.08;
      if (u > p || blocked(x, z, 2.0)) return;
      if (F.rock === 'column' && zn.rock > 0.4 && v < 0.6) place('column', x, z, 0.6 + v * 0.9, 0.2);
      else place('boulder', x, z, 0.35 + v * v * (zn.rock > 0.4 ? 1.8 : 1.0), 0.35);
    });
    const meshes = [];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), sc = new THREE.Vector3();
    for (const kind in out) {
      const arr = out[kind], n = arr.length / 5;
      if (!n) continue;
      const im = new THREE.InstancedMesh(this.geo[kind][T.lod], this.mat, n);
      for (let i = 0; i < n; i++) {
        p.set(arr[i * 5], arr[i * 5 + 1], arr[i * 5 + 2]);
        q.setFromAxisAngle(up, arr[i * 5 + 3]);
        const s = arr[i * 5 + 4];
        sc.set(s, s * (kind === 'boulder' ? 1 : 0.9 + 0.2 * hash2(i, n, 3)), s);
        im.setMatrixAt(i, m4.compose(p, q, sc));
      }
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = tier === 0 && kind !== 'tussock' && kind !== 'buttongrass';
      im.receiveShadow = tier === 0;
      im.computeBoundingSphere();
      this.group.add(im);
      meshes.push(im);
    }
    return { tier, meshes };
  }
  stats() { let inst = 0, draws = 0; for (const ch of this.chunks.values()) for (const m of ch.meshes) { inst += m.count; draws++; } return { chunks: this.chunks.size, instances: inst, draws }; }
}
