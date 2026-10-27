// Real-terrain layer: loads the Geoscience Australia DEM grids written by tools/build_mountain.py
// and answers height / slope / drainage questions in local metres.
// World axes: x = metres east of the origin, z = metres SOUTH (three.js -z is north), y = metres AHD.

const BASE = import.meta.env.BASE_URL;

// ---- integer hash + value noise, mirrored exactly in the terrain shader (TerrainGenerator NOISE_GLSL) ----
export function hash2(ix, iz, seed) {
  let h = (Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iz | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}
export function vnoise(x, z, seed = 0) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed), c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}
export function fbm(x, z, oct, seed = 0) {
  let s = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) { s += amp * vnoise(x * f, z * f, seed + i * 17); norm += amp; amp *= 0.5; f *= 2.03; }
  return s / norm;
}

export class Heightfield {
  constructor(info, raw) {
    this.w = info.w; this.h = info.h;
    const [x0, n0, x1, n1] = info.xn;
    this.x0 = x0; this.x1 = x1; this.zN = -n1; this.zS = -n0;   // row 0 is the north edge (smallest z)
    this.cx = (x1 - x0) / this.w; this.cz = (n1 - n0) / this.h; // cell i centre = x0 + (i + .5) * cx
    this.data = new Float32Array(this.w * this.h);
    for (let i = 0; i < raw.length; i++) this.data[i] = raw[i] / 10 - 50;
    this.raw = raw;
  }
  gx(x) { return (x - this.x0) / this.cx - 0.5; }
  gz(z) { return (z - this.zN) / this.cz - 0.5; }
  wx(i) { return this.x0 + (i + 0.5) * this.cx; }
  wz(j) { return this.zN + (j + 0.5) * this.cz; }
  contains(x, z, margin = 0) { return x > this.x0 + margin && x < this.x1 - margin && z > this.zN + margin && z < this.zS - margin; }
  at(i, j) {
    i = i < 0 ? 0 : i >= this.w ? this.w - 1 : i;
    j = j < 0 ? 0 : j >= this.h ? this.h - 1 : j;
    return this.data[j * this.w + i];
  }
  bilinear(x, z) {
    const fx = this.gx(x), fz = this.gz(z);
    const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
    const a = this.at(i, j), b = this.at(i + 1, j), c = this.at(i, j + 1), d = this.at(i + 1, j + 1);
    return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
  }
  bicubic(x, z) {
    const fx = this.gx(x), fz = this.gz(z);
    const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
    const row = (jj) => cr(this.at(i - 1, jj), this.at(i, jj), this.at(i + 1, jj), this.at(i + 2, jj), tx);
    return cr(row(j - 1), row(j), row(j + 1), row(j + 2), tz);
  }
  gradient(x, z) {
    const e = this.cx;
    return [(this.bilinear(x + e, z) - this.bilinear(x - e, z)) / (2 * e), (this.bilinear(x, z + e) - this.bilinear(x, z - e)) / (2 * e)];
  }
}
function cr(p0, p1, p2, p3, t) {
  return p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
}

// D8 flow accumulation over the DEM (O(n) with a counting sort on the uint16 heights)
export function flowAccumulation(hf) {
  const { w, h, raw } = hf, n = w * h;
  const count = new Uint32Array(65537);
  for (let i = 0; i < n; i++) count[raw[i] + 1]++;
  for (let v = 1; v < 65537; v++) count[v] += count[v - 1];
  const order = new Uint32Array(n);
  for (let i = 0; i < n; i++) order[count[raw[i]]++] = i;
  const acc = new Float32Array(n).fill(1);
  const dxs = [-1, 0, 1, -1, 1, -1, 0, 1], dzs = [-1, -1, -1, 0, 0, 1, 1, 1];
  const dist = dxs.map((dx, k) => Math.hypot(dx * hf.cx, dzs[k] * hf.cz));
  const d = hf.data;
  for (let k = n - 1; k >= 0; k--) {
    const c = order[k], ci = c % w, cj = (c / w) | 0;
    let best = -1, bestDrop = 0;
    for (let m = 0; m < 8; m++) {
      const ni = ci + dxs[m], nj = cj + dzs[m];
      if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
      const drop = (d[c] - d[nj * w + ni]) / dist[m];
      if (drop > bestDrop) { bestDrop = drop; best = nj * w + ni; }
    }
    if (best >= 0) acc[best] += acc[c];
  }
  const out = new Uint8Array(n), lmax = Math.log(n * 0.02);
  for (let i = 0; i < n; i++) out[i] = Math.min(255, Math.round(Math.log(acc[i]) / lmax * 255));
  return out;
}

// Restore surveyed summit heights (OSM `ele`) that the smoothed DEM under-reads, with a local Gaussian bump.
export function applySpotHeights(hf, pois, sigma = 70) {
  const fixes = [];
  for (const p of pois) {
    if (p.kind !== 'peak' || !p.ele) continue;
    const ele = parseFloat(p.ele);
    if (!isFinite(ele) || !hf.contains(p.x, -p.n, 200)) continue;
    let best = -1e9, bi = 0, bj = 0;
    const ci = Math.round(hf.gx(p.x)), cj = Math.round(hf.gz(-p.n)), r = Math.ceil(120 / hf.cx);
    for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) { const v = hf.at(i, j); if (v > best) { best = v; bi = i; bj = j; } }
    const diff = ele - best;
    if (diff <= 0.5 || diff > 160) continue;
    // sharp spires (big shortfall, e.g. Federation Peak) get a narrower bump so the surrounding slopes are untouched
    const sg = diff > 90 ? sigma * 0.55 : diff > 40 ? sigma * 0.65 : sigma;
    const R = Math.ceil(3 * sg / hf.cx);
    for (let j = bj - R; j <= bj + R; j++) for (let i = bi - R; i <= bi + R; i++) {
      if (i < 0 || j < 0 || i >= hf.w || j >= hf.h) continue;
      const dx = (i - bi) * hf.cx, dz = (j - bj) * hf.cz;
      hf.data[j * hf.w + i] += diff * Math.exp(-(dx * dx + dz * dz) / (2 * sg * sg));
    }
    fixes.push({ name: p.name, dem: Math.round(best), surveyed: ele });
    p.x = hf.wx(bi); p.n = -hf.wz(bj); p.y = ele;
  }
  return fixes;
}

// Lakes (OSM natural=water): find the water level from the DEM and carve a shallow bed so the
// rendered water plane meets the real shoreline without z-fighting.
export function prepareLakes(hf, lakes) {
  const out = [];
  for (const L of lakes) {
    const poly = L.pts.map(p => [p[0], -p[1]]);
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [x, z] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const cells = [];
    for (let j = Math.floor(hf.gz(z0)); j <= Math.ceil(hf.gz(z1)); j++) for (let i = Math.floor(hf.gx(x0)); i <= Math.ceil(hf.gx(x1)); i++) {
      if (i < 0 || j < 0 || i >= hf.w || j >= hf.h) continue;
      if (inPoly(hf.wx(i), hf.wz(j), poly)) cells.push(j * hf.w + i);
    }
    const shore = poly.map(([x, z]) => hf.bilinear(x, z)).sort((a, b) => a - b);
    const level = shore.length ? shore[Math.floor(shore.length * 0.2)] - 0.4 : 0;
    for (const c of cells) hf.data[c] = Math.min(hf.data[c], level - 3.5);
    out.push({ name: L.name, poly, level, x0, x1, z0, z1, area: (x1 - x0) * (z1 - z0) });
  }
  return out;
}
export function inPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

// Height used for vegetation, trails and tile vertices: bicubic DEM + sub-grid detail (≤ ±1.5 m).
export class World {
  constructor(meta, near, far, drain) { this.meta = meta; this.near = near; this.far = far; this.drain = drain; }
  detail(x, z) { return (fbm(x / 22, z / 22, 3, 101) - 0.5) * 2.2 + (vnoise(x / 6.5, z / 6.5, 202) - 0.5) * 0.7; }
  height(x, z) { return this.near.contains(x, z) ? this.near.bicubic(x, z) + this.detail(x, z) : this.far.bilinear(x, z); }
  dem(x, z) { return this.near.contains(x, z) ? this.near.bilinear(x, z) : this.far.bilinear(x, z); }
  normal(x, z, e = 2) {
    const hx = (this.height(x + e, z) - this.height(x - e, z)) / (2 * e), hz = (this.height(x, z + e) - this.height(x, z - e)) / (2 * e);
    const l = Math.hypot(hx, 1, hz);
    return [-hx / l, 1 / l, -hz / l];
  }
  slopeDeg(x, z) { const [gx, gz] = (this.near.contains(x, z) ? this.near : this.far).gradient(x, z); return Math.atan(Math.hypot(gx, gz)) * 180 / Math.PI; }
  drainage(x, z) {
    const hf = this.near;
    if (!hf.contains(x, z)) return 0;
    const i = Math.round(hf.gx(x)), j = Math.round(hf.gz(z));
    return this.drain[Math.max(0, Math.min(hf.h - 1, j)) * hf.w + Math.max(0, Math.min(hf.w - 1, i))] / 255;
  }
  lakeAt(x, z) {
    for (const L of this.lakes || []) if (x > L.x0 && x < L.x1 && z > L.z0 && z < L.z1 && inPoly(x, z, L.poly)) return L;
    return null;
  }
  toLatLon(x, z) { const m = this.meta; return [m.origin.lat + (-z) / m.m_per_deg.lat, m.origin.lon + x / m.m_per_deg.lon]; }
  fromLatLon(lat, lon) { const m = this.meta; return [(lon - m.origin.lon) * m.m_per_deg.lon, -(lat - m.origin.lat) * m.m_per_deg.lat]; }
}

async function get(url, kind, optional = false) {
  const r = await fetch(url);
  if (!r.ok) { if (optional) return null; throw new Error(`Missing terrain file ${url.replace(BASE, '')} (HTTP ${r.status})`); }
  return kind === 'bin' ? r.arrayBuffer() : r.json();
}

export async function loadWorld(id, onStatus = () => {}) {
  const base = `${BASE}data/${id}/`;
  onStatus('Loading the elevation model…', 0.1);
  const [meta, nearBuf, farBuf, network, pois, water, lakes] = await Promise.all([
    get(base + 'meta.json'), get(base + 'near.bin', 'bin'), get(base + 'far.bin', 'bin'),
    get(base + 'network.json'), get(base + 'pois.json'), get(base + 'water.json'), get(base + 'lakes.json', 'json', true),
  ]);
  const near = new Heightfield(meta.near, new Uint16Array(nearBuf));
  const far = new Heightfield(meta.far, new Uint16Array(farBuf));
  onStatus('Tracing drainage from the DEM…', 0.3);
  await new Promise(r => setTimeout(r, 0));
  const drain = flowAccumulation(near);
  const fixes = applySpotHeights(near, pois);
  const world = new World(meta, near, far, drain);
  world.lakes = prepareLakes(near, lakes || []);
  world.network = network; world.pois = pois; world.water = water; world.spotFixes = fixes;
  return world;
}
