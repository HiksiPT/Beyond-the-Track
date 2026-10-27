// Mapped features draped on the terrain: OSM walking tracks, streams, lakes, huts, junction signs, cairns.
// Positions are real (OpenStreetMap); hut and sign models are generic representations, not reconstructions.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const CHUNK = 400;

export class TrailIndex {
  constructor(cell = 50) { this.cell = cell; this.b = new Map(); }
  key(i, j) { return i * 100003 + j; }
  add(x0, z0, x1, z1, ref) {
    const c = this.cell, seg = [x0, z0, x1, z1, ref];
    for (let i = Math.floor(Math.min(x0, x1) / c); i <= Math.floor(Math.max(x0, x1) / c); i++)
      for (let j = Math.floor(Math.min(z0, z1) / c); j <= Math.floor(Math.max(z0, z1) / c); j++) {
        const k = this.key(i, j);
        if (!this.b.has(k)) this.b.set(k, []);
        this.b.get(k).push(seg);
      }
  }
  nearest(x, z, r = 60) {
    const c = this.cell, best = { d: Infinity, ref: null, t: 0, x: 0, z: 0 };
    for (let i = Math.floor((x - r) / c); i <= Math.floor((x + r) / c); i++)
      for (let j = Math.floor((z - r) / c); j <= Math.floor((z + r) / c); j++) {
        const list = this.b.get(this.key(i, j));
        if (!list) continue;
        for (const s of list) {
          const dx = s[2] - s[0], dz = s[3] - s[1], L2 = dx * dx + dz * dz || 1;
          const t = Math.max(0, Math.min(1, ((x - s[0]) * dx + (z - s[1]) * dz) / L2));
          const px = s[0] + dx * t, pz = s[1] + dz * t, d = Math.hypot(x - px, z - pz);
          if (d < best.d) Object.assign(best, { d, ref: s[4], t, x: px, z: pz });
        }
      }
    return best;
  }
  distance(x, z, r = 10) { return this.nearest(x, z, r).d; }
}

function ribbon(world, pts, width, lift, color, step = 3) {
  const P = [];
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, az] = pts[k], [bx, bz] = pts[k + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
    for (let s = 0; s < n; s++) P.push([ax + (bx - ax) * s / n, az + (bz - az) * s / n]);
  }
  P.push(pts[pts.length - 1]);
  if (P.length < 2) return null;
  const pos = new Float32Array(P.length * 6), col = new Float32Array(P.length * 6);
  for (let k = 0; k < P.length; k++) {
    const a = P[Math.max(0, k - 1)], b = P[Math.min(P.length - 1, k + 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    const nx = -tz * width / 2, nz = tx * width / 2;
    for (let s = 0; s < 2; s++) {
      const x = P[k][0] + (s ? nx : -nx), z = P[k][1] + (s ? nz : -nz), o = (k * 2 + s) * 3;
      pos[o] = x; pos[o + 1] = world.height(x, z) + lift; pos[o + 2] = z;
      const j = ((k * 7 + s * 3) % 11) / 11 * 0.06 - 0.03;
      col[o] = color[0] + j; col[o + 1] = color[1] + j; col[o + 2] = color[2] + j;
    }
  }
  const idx = [];
  for (let k = 0; k < P.length - 1; k++) { const i = k * 2; idx.push(i, i + 2, i + 1, i + 1, i + 2, i + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
function chunked(pts) {
  const out = new Map();
  let cur = null, curKey = null;
  for (let k = 0; k < pts.length; k++) {
    const key = `${Math.floor(pts[k][0] / CHUNK)},${Math.floor(pts[k][1] / CHUNK)}`;
    if (key !== curKey) {
      if (cur) cur.push(pts[k]);
      cur = k ? [pts[k - 1], pts[k]] : [pts[k]];
      curKey = key;
      if (!out.has(key)) out.set(key, []);
      out.get(key).push(cur);
    } else cur.push(pts[k]);
  }
  return out;
}

export class Features {
  constructor(scene, world, net) {
    this.scene = scene; this.world = world; this.net = net;
    this.index = new TrailIndex(50);
    this.group = new THREE.Group(); scene.add(this.group);
    this.chunks = new Map();
    this.trailMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    this.waterMat = new THREE.MeshStandardMaterial({ color: 0x4f6872, roughness: 0.12, metalness: 0.25, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, transparent: true, opacity: 0.9 });
    this.lakeMat = new THREE.MeshStandardMaterial({ color: 0x2c4550, roughness: 0.06, metalness: 0.35, transparent: true, opacity: 0.93 });
    this.huts = [];
    this.buildTrails();
    this.buildWater();
    this.buildLakes();
  }
  addToChunk(key, mesh, range) {
    if (!this.chunks.has(key)) this.chunks.set(key, []);
    this.chunks.get(key).push({ mesh, range });
    mesh.visible = false;
    this.group.add(mesh);
  }
  buildTrails() {
    const W = this.world, perChunk = new Map();
    this.net.edges.forEach((e, ei) => {
      if (e.dead) return;
      const pts = e.pts.map(p => [p[0], p[1]]);
      for (let k = 0; k < pts.length - 1; k++) this.index.add(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], ei);
      if (e.virtual) return;    // off-track game segments are not drawn as formed track
      const track = e.kind === 'track';
      const width = track ? 3.0 : 1.1, color = track ? [0.50, 0.45, 0.37] : [0.40, 0.31, 0.22];
      for (const [key, pieces] of chunked(pts)) for (const piece of pieces) {
        const g = ribbon(W, piece, width, 0.18, color);
        if (!g) continue;
        if (!perChunk.has(key)) perChunk.set(key, []);
        perChunk.get(key).push(g);
      }
    });
    for (const [key, gs] of perChunk) { const m = new THREE.Mesh(mergeGeometries(gs), this.trailMat); m.receiveShadow = true; this.addToChunk(key, m, 1100); }
  }
  buildWater() {
    const W = this.world, perChunk = new Map();
    this.waterIndex = new TrailIndex(60);
    W.water.forEach((w, wi) => {
      const pts = w.pts.map(p => [p[0], -p[1]]);
      const width = w.kind === 'river' ? 6 : w.name ? 2.4 : 1.4;
      for (let k = 0; k < pts.length - 1; k++) this.waterIndex.add(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], wi);
      for (const [key, pieces] of chunked(pts)) for (const piece of pieces) {
        const g = ribbon(W, piece, width, 0.25, [1, 1, 1], 5);
        if (!g) continue;
        g.deleteAttribute('color');
        if (!perChunk.has(key)) perChunk.set(key, []);
        perChunk.get(key).push(g);
      }
    });
    for (const [key, gs] of perChunk) this.addToChunk(key, new THREE.Mesh(mergeGeometries(gs), this.waterMat), 1600);
  }
  buildLakes() {
    for (const L of this.world.lakes) {
      const shape = new THREE.Shape(L.poly.map(([x, z]) => new THREE.Vector2(x, -z)));
      const g = new THREE.ShapeGeometry(shape);
      g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, this.lakeMat);
      m.position.y = L.level;
      m.receiveShadow = true;
      this.group.add(m);
      for (const [x, z] of L.poly.filter((_, i) => i % 3 === 0)) this.waterIndex.add(x, z, x + 0.1, z + 0.1, -1);
    }
  }
  update(px, pz) {
    for (const [key, list] of this.chunks) {
      const [c, r] = key.split(',').map(Number);
      const d = Math.hypot((c + 0.5) * CHUNK - px, (r + 0.5) * CHUNK - pz) - CHUNK * 0.7;
      for (const it of list) it.mesh.visible = d < it.range;
    }
  }
  hut(x, z, style = 'gable', size = [6, 4.5], name = '') {
    const W = this.world, [w, d] = size;
    const ys = [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]].map(([a, b]) => W.height(x + a, z + b));
    const y = Math.min(...ys), top = Math.max(...ys);
    const g = new THREE.Group();
    const wall = new THREE.MeshStandardMaterial({ color: style === 'shelter' ? 0x7d6e5d : style === 'timber' ? 0x6b4f36 : 0x6f6a5f, roughness: 0.85 });
    const roof = new THREE.MeshStandardMaterial({ color: style === 'aframe' ? 0x8a3b2a : 0x9aa0a0, roughness: 0.5, metalness: 0.4 });
    const stone = new THREE.MeshStandardMaterial({ color: 0x77736b, roughness: 1 });
    const found = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, top - y + 0.6, d + 0.4), stone);
    found.position.y = (top - y + 0.6) / 2 - 0.3; g.add(found);
    const base = top - y + 0.3;
    if (style === 'aframe') {
      const shape = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, w * 0.95)]);
      const prism = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false }), roof);
      prism.position.set(0, base, -d / 2); g.add(prism);
    } else if (style === 'platform') {
      const deck = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), new THREE.MeshStandardMaterial({ color: 0x6b5238, roughness: 0.9 }));
      deck.position.y = base + 0.3; g.add(deck);
    } else {
      const h = style === 'shelter' ? 2.3 : 2.7;
      const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wall); box.position.y = base + h / 2; g.add(box);
      const shape = new THREE.Shape([new THREE.Vector2(-w / 2 - 0.4, 0), new THREE.Vector2(w / 2 + 0.4, 0), new THREE.Vector2(0, style === 'shelter' ? 0.9 : 1.7)]);
      const r = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: d + 0.6, bevelEnabled: false }), roof);
      r.position.set(0, base + h, -d / 2 - 0.3); g.add(r);
      const ch = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.2, 0.8), stone); ch.position.set(w / 2 - 0.6, base + h + 0.9, d / 4); g.add(ch);
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.9, 0.08), new THREE.MeshStandardMaterial({ color: 0x3b2c20 })); door.position.set(0, base + 0.95, d / 2 + 0.04); g.add(door);
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.06), new THREE.MeshStandardMaterial({ color: 0x1d2a30, roughness: 0.2, metalness: 0.5 })); win.position.set(-w / 4, base + 1.5, d / 2 + 0.04); g.add(win);
    }
    const [nx, , nz] = W.normal(x, z, 6);
    g.rotation.y = Math.atan2(nx, nz);
    g.position.set(x, y, z);
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.group.add(g);
    this.huts.push({ x, z, r: Math.max(w, d) / 2 + 0.6, clear: Math.max(w, d) + 4, name });
    return g;
  }
  sign(x, z, angles) {
    const y = this.world.height(x, z), g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a4330, roughness: 0.9 });
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.0, 0.12), wood); post.position.y = 1.0; g.add(post);
    const boardMat = new THREE.MeshStandardMaterial({ color: 0x2f5a3a, roughness: 0.7 });
    angles.slice(0, 4).forEach((a, i) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 0.04), boardMat); b.position.set(0.38, 1.75 - i * 0.22, 0); b.rotation.y = a; g.add(b); });
    g.position.set(x, y, z);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.group.add(g);
  }
  cairn(x, z) {
    const y = this.world.height(x, z), parts = [];
    for (let k = 0; k < 26; k++) {
      const layer = Math.floor(Math.sqrt(k * 1.6)), ring = Math.max(0.05, 0.55 - layer * 0.11), a = k * 2.399, s = 0.13 + ((k * 37) % 7) * 0.012;
      const g = new THREE.DodecahedronGeometry(s, 0); g.scale(1.2, 0.7, 1); g.translate(Math.cos(a) * ring, layer * 0.17 + 0.05, Math.sin(a) * ring);
      parts.push(g);
    }
    const m = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({ color: 0x8a867c, roughness: 1 }));
    m.position.set(x, y - 0.1, z); m.castShadow = true;
    this.group.add(m);
  }
  tent(x, z, color = 0xd9682a) {
    const y = this.world.height(x, z);
    const g = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.2, 4, 1), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
    g.scale.set(1, 1, 1.6); g.rotation.y = Math.PI / 4; g.position.set(x, y + 0.55, z); g.castShadow = true;
    this.group.add(g);
    return g;
  }
  avoid(x, z) { for (const h of this.huts) if (Math.abs(x - h.x) < h.clear && Math.abs(z - h.z) < h.clear) return true; return false; }
  // solid huts for the player
  collide(x, z) { for (const h of this.huts) if (Math.hypot(x - h.x, z - h.z) < h.r) return h; return null; }
  dispose() {
    this.group.traverse(o => { if (o.isMesh) { o.geometry.dispose(); } });
    for (const m of [this.trailMat, this.waterMat, this.lakeMat]) m.dispose();
    this.scene.remove(this.group);
  }
}
