// Builds (and disposes) everything for one mountain: real terrain, horizon, track graph with places,
// draped features, huts, vegetation, sky and the player figure. One mountain is loaded at a time.
import * as THREE from 'three';
import { loadWorld } from './TerrainLoader.js';
import { TerrainTiles, buildHorizon, makeTerrainMaterial, DEFAULT_ECOLOGY } from './TerrainGenerator.js';
import { Vegetation } from './Vegetation.js';
import { Features } from './Features.js';
import { Environment } from './Environment.js';
import { Network } from '../expedition/RoutePlanner.js';
import { Hiker } from '../player/PlayerController.js';
import { loadContent, byId } from '../expedition/MountainData.js';
import { JACKETS } from '../systems/SocialSystem.js';

export async function buildMountain(game, id, scenarioId, onStatus) {
  const meta = byId[id];
  const content = await loadContent(id);
  const scen = content.scenarios?.[scenarioId] || {};
  const eco = { ...DEFAULT_ECOLOGY, ...content.eco, ...(scen.eco || {}) };
  const clim = { ...content.clim, ...(scen.clim || {}) };
  const W = await loadWorld(id, onStatus);
  onStatus('Building terrain…', 0.5);
  await frame();
  const scene = new THREE.Scene();
  const terrainMat = makeTerrainMaterial(W, eco);
  const tiles = new TerrainTiles(scene, W, terrainMat);
  const horizon = buildHorizon(scene, W, terrainMat);
  const net = new Network(W);
  const places = computePlaces(W, net, content);
  onStatus('Draping tracks, streams and lakes…', 0.65);
  await frame();
  const features = new Features(scene, W, net);
  buildStructures(W, net, content, places, features);
  const veg = new Vegetation(scene, W, eco, features.index, (x, z) => features.avoid(x, z));
  const env = new Environment(game.renderer, scene);
  env.reflective = [features.lakeMat, features.waterMat];
  const hiker = new Hiker(scene, JACKETS[game.profile.cosmetics.jacket] || JACKETS.ember);
  const landmarks = buildLandmarks(W, content, places);
  onStatus('Ready', 1);
  return { id, meta, content, scenario: scenarioId, scen, eco, clim, world: W, scene, terrainMat, tiles, horizon, net, places, features, veg, env, hiker, landmarks };
}

function frame() { return new Promise(r => setTimeout(r, 0)); }

function computePlaces(W, net, C) {
  const places = {};
  const byName = (n) => W.pois.find(p => p.name === n && p.kind !== 'camp') || W.pois.find(p => p.name === n);
  const resolve = (id, p) => {
    let x, z;
    if (p.node && net.nodes.get(p.node)) { const n = net.nodes.get(p.node); x = n.x; z = n.z; }
    else if (p.poi) { const q = byName(p.poi); if (!q) { console.warn('missing poi', p.poi); return null; } x = q.x; z = -q.n; }
    else if (p.latlon) [x, z] = W.fromLatLon(...p.latlon);
    else return null;
    const place = { id, ...p, x, z, y: W.height(x, z) };
    if (!place.node || !net.nodes.get(place.node)) place.node = net.splitAt(x, z, 'p:' + id, 150) || undefined;
    return place;
  };
  // places first (virtual segments may start from one), then virtual segments, then places that target them
  const deferred = [];
  for (const [id, p] of Object.entries(C.places)) {
    if (p.node && p.node.startsWith('v:')) { deferred.push([id, p]); continue; }
    const pl = resolve(id, p);
    if (pl) places[id] = pl;
  }
  for (const v of C.virtual || []) {
    const from = v.from.place ? places[v.from.place]?.node : v.from.node;
    if (!from) continue;
    net.addVirtual(from, v.to.map(ll => W.fromLatLon(...ll)), v.id, v.name);
  }
  for (const [id, p] of deferred) { const pl = resolve(id, p); if (pl) places[id] = pl; }
  for (const [id, t] of Object.entries(C.trailheads)) {
    const n = net.nodes.get(t.node);
    if (!n) { console.warn('missing trailhead node', t.node); continue; }
    places['th:' + id] = { id: 'th:' + id, name: t.name, x: n.x, z: n.z, y: W.height(n.x, n.z), r: 60, trailhead: id, exit: t.exit, remote: t.remote, node: t.node };
  }
  return places;
}

function buildStructures(W, net, C, places, features) {
  for (const p of Object.values(places)) if (p.hut) features.hut(p.x, p.z, p.hut, p.size, p.name);
  const summit = places[C.summitPlace];
  if (summit) features.cairn(summit.x, summit.z);
  for (const q of W.pois) if (q.kind === 'peak' && q.name && q.ele && W.near.contains(q.x, -q.n, 300) && (!summit || Math.hypot(q.x - summit.x, -q.n - summit.z) > 30)) features.cairn(q.x, -q.n);
  // hut-like OSM POIs not modelled by content get a generic hut so the map matches the world
  for (const q of W.pois) {
    if (q.kind !== 'hut' || !q.name || !W.near.contains(q.x, -q.n, 50)) continue;
    if (Object.values(places).some(p => Math.hypot(p.x - q.x, p.z + q.n) < 60)) continue;
    if (/booth|shelter|lodge|club|house/i.test(q.name) && !/hut/i.test(q.name)) continue;
    features.hut(q.x, -q.n, 'gable', [6, 4.5], q.name);
  }
  for (const n of net.nodes.values()) {
    const named = new Set(n.edges.filter(e => e.name && e.kind === 'path' && !e.virtual).map(e => e.name));
    if (named.size >= 2 || (n.edges.length >= 3 && named.size >= 1 && n.edges.some(e => e.kind === 'path' && e.len > 300))) {
      const angles = n.edges.map(e => { const p = e.a === n.id ? e.pts[Math.min(3, e.pts.length - 1)] : e.pts[Math.max(0, e.pts.length - 4)]; return Math.atan2(-(p[1] - n.z), p[0] - n.x); });
      features.sign(n.x + 2.2, n.z + 1.2, angles);
    }
  }
}

function buildLandmarks(W, C, places) {
  const out = [];
  for (const q of W.pois) if (q.name && ['peak', 'hut', 'camp', 'water', 'viewpoint', 'site', 'saddle', 'town', 'village'].includes(q.kind))
    out.push({ name: q.name, kind: q.kind, x: q.x, z: -q.n, y: W.height(q.x, -q.n), ele: q.ele });
  const s = places[C.summitPlace];
  if (s) out.push({ name: s.name, kind: 'summit', x: s.x, z: s.z, y: s.y });
  for (const L of W.lakes) if (L.name && L.area > 20000) out.push({ name: L.name, kind: 'lake', x: (L.x0 + L.x1) / 2, z: (L.z0 + L.z1) / 2, y: L.level });
  for (const fp of C.farPeaks || []) {
    const [x0, z0] = W.fromLatLon(...fp.near);
    let best = { y: -1e9, x: x0, z: z0 };
    for (let dz = -fp.search; dz <= fp.search; dz += 100) for (let dx = -fp.search; dx <= fp.search; dx += 100) {
      const y = W.dem(x0 + dx, z0 + dz);
      if (y > best.y) best = { x: x0 + dx, z: z0 + dz, y };
    }
    out.push({ name: fp.name, kind: 'farpeak', far: true, note: fp.note, ...best });
  }
  return out;
}

export function disposeMountain(m) {
  if (!m) return;
  m.veg.dispose(); m.features.dispose(); m.tiles.dispose(); m.env.dispose();
  m.horizon.geometry.dispose(); m.terrainMat.dispose(); m.terrainMat.userData.uniforms.uDrain.value.dispose();
  m.scene.traverse(o => { if (o.isMesh || o.isPoints) { o.geometry?.dispose?.(); } });
}
