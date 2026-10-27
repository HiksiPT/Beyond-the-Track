// Walking network from OpenStreetMap, routed with Tobler's hiking function over the real DEM profile,
// plus route metrics derived from the actual terrain. Estimates are gameplay, not real-world advice.
import { zoneAt } from '../world/TerrainGenerator.js';

export function toblerKmh(grade) { return 6 * Math.exp(-3.5 * Math.abs(grade + 0.05)); }
export function walkSeconds(pts, mult = 1) {
  let s = 0;
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k], b = pts[k + 1], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d < 0.01) continue;
    s += d / (toblerKmh((b[2] - a[2]) / d) * mult / 3.6);
  }
  return s;
}
const surfMult = (e) => e.virtual ? 0.45 : e.kind === 'track' ? 1.05 : e.sac && /demanding|alpine/.test(e.sac) ? 0.75 : e.sac === 'mountain_hiking' ? 0.9 : 1;

export class Network {
  constructor(world) {
    this.world = world;
    this.nodes = new Map();
    for (const [id, v] of Object.entries(world.network.nodes)) this.nodes.set(id, { id, x: v[0], z: -v[1], y: v[2], edges: [] });
    this.edges = [];
    for (const e of world.network.edges) {
      const pts = e.pts.map(p => [p[0], -p[1], world.dem(p[0], -p[1])]);
      this.addEdge(e.a, e.b, pts, { name: e.name, kind: e.kind, sac: e.sac });
    }
    for (const n of this.nodes.values()) n.y = world.dem(n.x, n.z);
  }
  addEdge(a, b, pts, props) {
    const cum = [0];
    for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
    const e = { i: this.edges.length, a, b, pts, cum, len: cum[cum.length - 1], ...props };
    const m = surfMult(e);
    e.tAB = walkSeconds(pts, m); e.tBA = walkSeconds([...pts].reverse(), m);
    let up = 0, down = 0;
    for (let k = 1; k < pts.length; k++) { const dy = pts[k][2] - pts[k - 1][2]; if (dy > 0) up += dy; else down -= dy; }
    e.up = up; e.down = down;
    this.edges.push(e);
    this.nodes.get(a)?.edges.push(e);
    if (b !== a) this.nodes.get(b)?.edges.push(e);
    return e;
  }
  // insert a node where a place lies along a track (OSM ways usually only have nodes at their ends)
  splitAt(x, z, id, maxD = 150) {
    let best = null;
    for (const e of this.edges) {
      if (e.dead) continue;
      for (let k = 0; k < e.pts.length - 1; k++) {
        const a = e.pts[k], b = e.pts[k + 1], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2));
        const d = Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z);
        if (!best || d < best.d) best = { e, k, t, d, px: a[0] + dx * t, pz: a[1] + dz * t };
      }
    }
    if (!best || best.d > maxD) return null;
    const { e, k, t, px, pz } = best;
    const s = e.cum[k] + (e.cum[k + 1] - e.cum[k]) * t;
    if (s < 15) return e.a;
    if (e.len - s < 15) return e.b;
    const mid = [px, pz, this.world.dem(px, pz)];
    this.nodes.set(id, { id, x: px, z: pz, y: mid[2], edges: [] });
    e.dead = true;
    for (const nid of [e.a, e.b]) { const n = this.nodes.get(nid); if (n) n.edges = n.edges.filter(x => x !== e); }
    const props = { name: e.name, kind: e.kind, sac: e.sac, virtual: e.virtual, parent: e.parent ?? e.i };
    this.addEdge(e.a, id, [...e.pts.slice(0, k + 1), mid], props);
    this.addEdge(id, e.b, [mid, ...e.pts.slice(k + 1)], props);
    return id;
  }
  // an off-track game segment (e.g. an unformed summit climb), draped on the DEM every 15 m
  addVirtual(fromId, waypoints, id, name) {
    const n0 = this.nodes.get(fromId);
    const xs = [[n0.x, n0.z], ...waypoints];
    const pts = [];
    for (let k = 0; k < xs.length - 1; k++) {
      const [ax, az] = xs[k], [bx, bz] = xs[k + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 15));
      for (let s = 0; s < n; s++) { const x = ax + (bx - ax) * s / n, z = az + (bz - az) * s / n; pts.push([x, z, this.world.dem(x, z)]); }
    }
    const [lx, lz] = xs[xs.length - 1];
    pts.push([lx, lz, this.world.dem(lx, lz)]);
    this.nodes.set(id, { id, x: lx, z: lz, y: this.world.dem(lx, lz), edges: [] });
    this.addEdge(fromId, id, pts, { name, kind: 'route', sac: 'alpine_hiking', virtual: true });
    return id;
  }
  other(e, nid) { return e.a === nid ? e.b : e.a; }
  nearestNode(x, z) {
    let best = null, bd = Infinity;
    for (const n of this.nodes.values()) { const d = Math.hypot(n.x - x, n.z - z); if (d < bd && n.edges.length) { bd = d; best = n; } }
    return best;
  }
  route(fromId, toId) {
    if (fromId === toId) return [];
    const dist = new Map([[fromId, 0]]), prev = new Map(), done = new Set(), heap = [[0, fromId]];
    while (heap.length) {
      let bi = 0; for (let k = 1; k < heap.length; k++) if (heap[k][0] < heap[bi][0]) bi = k;
      const [d, u] = heap.splice(bi, 1)[0];
      if (done.has(u)) continue;
      done.add(u);
      if (u === toId) break;
      for (const e of this.nodes.get(u).edges) {
        const v = this.other(e, u), t = d + (e.a === u ? e.tAB : e.tBA);
        if (t < (dist.get(v) ?? Infinity)) { dist.set(v, t); prev.set(v, { e, u }); heap.push([t, v]); }
      }
    }
    if (!prev.has(toId)) return null;
    const legs = [];
    for (let v = toId; v !== fromId;) { const { e, u } = prev.get(v); legs.unshift({ edge: e, from: u, to: v }); v = u; }
    return legs;
  }
  legsPolyline(legs) {
    const out = [];
    for (const L of legs) { const pts = L.edge.a === L.from ? L.edge.pts : [...L.edge.pts].reverse(); for (let k = out.length ? 1 : 0; k < pts.length; k++) out.push(pts[k]); }
    return out;
  }
  legsSeconds(legs) { return legs.reduce((s, L) => s + (L.edge.a === L.from ? L.edge.tAB : L.edge.tBA), 0); }
  stats(pts) {
    let len = 0, up = 0, down = 0, maxY = -1e9, minY = 1e9;
    for (let k = 0; k < pts.length; k++) {
      maxY = Math.max(maxY, pts[k][2]); minY = Math.min(minY, pts[k][2]);
      if (!k) continue;
      len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
      const dy = pts[k][2] - pts[k - 1][2]; if (dy > 0) up += dy; else down -= dy;
    }
    return { len, up, down, maxY, minY, sec: walkSeconds(pts) };
  }
  profile(pts, n = 240) {
    const st = this.stats(pts), out = [];
    let acc = 0, k = 0;
    for (let i = 0; i <= n; i++) {
      const target = st.len * i / n;
      while (k < pts.length - 1) {
        const d = Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]);
        if (acc + d >= target) { const t = d ? (target - acc) / d : 0; out.push([target, pts[k][2] + (pts[k + 1][2] - pts[k][2]) * t]); break; }
        acc += d; k++;
      }
      if (k >= pts.length - 1) out.push([target, pts[pts.length - 1][2]]);
    }
    return out;
  }
  lookahead(nid, e, pois, maxLen = 6000) {
    let cur = nid, edge = e, len = 0, up = 0, down = 0, sec = 0;
    const names = new Set(), seen = new Set(), passes = [], pts = [];
    while (edge && len < maxLen && !seen.has(edge.i)) {
      seen.add(edge.i);
      const fwd = edge.a === cur, p = fwd ? edge.pts : [...edge.pts].reverse();
      pts.push(...(pts.length ? p.slice(1) : p));
      len += edge.len; up += fwd ? edge.up : edge.down; down += fwd ? edge.down : edge.up; sec += fwd ? edge.tAB : edge.tBA;
      if (edge.name) names.add(edge.name);
      cur = this.other(edge, cur);
      const onward = this.nodes.get(cur).edges.filter(x => !seen.has(x.i));
      if (onward.length !== 1) break;
      edge = onward[0];
    }
    for (const p of pois) for (let k = 0; k < pts.length; k += 3) if (Math.hypot(pts[k][0] - p.x, pts[k][1] - p.z) < (p.r || 80)) { passes.push(p.name); break; }
    return { end: cur, len, up, down, sec, names: [...names], passes, pts };
  }
}

export class EdgeCursor {
  constructor(edge, fromNode, s = 0) { this.edge = edge; this.from = fromNode; this.s = s; }
  get fwd() { return this.edge.a === this.from; }
  get to() { return this.fwd ? this.edge.b : this.edge.a; }
  remaining() { return this.edge.len - this.s; }
  sample(s = this.s) {
    const e = this.edge, d = this.fwd ? s : e.len - s;
    let k = 0;
    while (k < e.cum.length - 2 && e.cum[k + 1] < d) k++;
    const seg = e.cum[k + 1] - e.cum[k] || 1, t = Math.max(0, Math.min(1, (d - e.cum[k]) / seg));
    const a = e.pts[k], b = e.pts[k + 1];
    let dx = b[0] - a[0], dz = b[1] - a[1], dy = b[2] - a[2];
    if (!this.fwd) { dx = -dx; dz = -dz; dy = -dy; }
    const l = Math.hypot(dx, dz) || 1;
    return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, dirx: dx / l, dirz: dz / l, grade: dy / l };
  }
}

// ---- route planning for the briefing: build each stage, then rate it from the real terrain ----
export function planRoute(game, route) {
  const ids = [route.start, ...route.via, route.end];
  const stages = [], allLegs = [];
  for (let i = 0; i < ids.length - 1; i++) {
    const a = game.placeNode(ids[i]), b = game.placeNode(ids[i + 1]);
    const legs = (a && b && game.net.route(a, b)) || [];
    const pts = game.net.legsPolyline(legs);
    const st = pts.length > 1 ? game.net.stats(pts) : { len: 0, up: 0, down: 0, sec: 0, maxY: 0, minY: 0 };
    stages.push({ from: ids[i], to: ids[i + 1], legs, pts, ...st, sec: game.net.legsSeconds(legs) });
    allLegs.push(...legs);
  }
  const pts = game.net.legsPolyline(allLegs);
  const total = pts.length > 1 ? game.net.stats(pts) : { len: 0, up: 0, down: 0, sec: 0, maxY: 0, minY: 0 };
  total.sec = game.net.legsSeconds(allLegs);
  return { stages, pts, legs: allLegs, total, metrics: rateRoute(game, allLegs, pts, total, route) };
}

export function rateRoute(game, legs, pts, total, route) {
  const W = game.world, eco = game.eco;
  let steep = 0, alpine = 0, rocky = 0, offTrack = 0, rough = 0, samples = 0;
  let acc = 0;
  for (let k = 1; k < pts.length; k++) {
    const d = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
    acc += d;
    if (acc < 60) continue;
    const g = Math.abs(pts[k][2] - pts[k - 1][2]) / Math.max(1, d);
    const zn = zoneAt(W, eco, pts[k][0], pts[k][1]);
    samples++; acc = 0;
    if (g > 0.25) steep++;
    if (zn.alpine > 0.5) alpine++;
    if (zn.rock > 0.4) rocky++;
  }
  for (const L of legs) { if (L.edge.virtual) offTrack += L.edge.len; if (L.edge.sac && /demanding|alpine/.test(L.edge.sac)) rough += L.edge.len; }
  const n = Math.max(1, samples), len = Math.max(1, total.len);
  const junctions = legs.filter(L => game.net.nodes.get(L.to)?.edges.length >= 3).length;
  const clamp5 = (v) => Math.max(1, Math.min(5, Math.round(v)));
  const terrain = clamp5(1 + steep / n * 9 + rocky / n * 6 + (offTrack + rough) / len * 6 + total.up / 1600);
  // exposure grows with time spent above the treeline and on rock, and with how long the route is up there
  const alpineKm = alpine / n * len / 1000;
  const navigation = clamp5(1 + Math.min(1.5, junctions / 14) + offTrack / len * 10 + Math.min(1, alpineKm / 12) + (route.navExtra || 0));
  const exposure = clamp5(1 + Math.min(1.6, alpineKm / 8) + rocky / n * 5 + (total.maxY - eco.treeline > 250 ? 0.4 : 0) + (route.exposureExtra || 0));
  const hours = total.sec / 3600 / 0.85;   // laden walker
  const nights = route.nights || 0;
  const water = hours * 0.55;
  const food = hours * 300 + nights * 1800 + 600;
  const score = terrain + navigation + exposure;
  const rewardMult = route.rewardMult || (0.8 + (score - 3) * 0.08);
  return { terrain, navigation, exposure, hours, water, food, nights, junctions, offTrackKm: offTrack / 1000, rewardMult, alpinePct: Math.round(alpine / n * 100) };
}
