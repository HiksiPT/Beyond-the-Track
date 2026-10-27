// Expedition lifecycle and in-world logic, mixed into Game (so `this` is the game).
import { Weather, sunPosition, sunTimes, rng, fmtDur } from '../systems/Weather.js';
import { newBody, paceModel, effortOf, tickBody, wearGear, eatPortion, foodLeftKcal, damageItem, indicators, WARN } from '../systems/SurvivalSystem.js';
import { fxOf, foodPortions, liveWeight, carriedDurables, equipmentCondition, packWeight, packKcal } from '../systems/InventorySystem.js';
import { analyseView, scorePhoto, captureThumb } from '../systems/PhotographySystem.js';
import { putImage } from '../game/SaveSystem.js';
import { computeRewards, refreshUnlocks, checkAchievements } from '../game/Progression.js';
import { sponsorPay, sponsorOffers } from '../systems/SocialSystem.js';
import { PACING } from '../game/GameState.js';
import { EdgeCursor, planRoute } from './RoutePlanner.js';
import { ITEMS } from '../data/Items.js';

const DEG = Math.PI / 180;

export const ExpeditionMethods = {
  // ================= setup =================
  newExpedition(routeId, scenario, pack, opts = {}) {
    const C = this.content, route = C.routes.find(r => r.id === routeId);
    const scen = C.scenarios?.[scenario] || {};
    const tz = scen.tz ?? C.tz;
    const [y, mo, d] = (scen.startDate || C.startDate).split('-').map(Number);
    const startUtc = Date.UTC(y, mo - 1, d) - tz * 3600000 + (opts.departHour ?? 7) * 3600000;
    const th = this.places[route.start];
    const seed = opts.seed ?? ((Math.random() * 2 ** 31) | 0);
    const fx = fxOf(pack);
    const condition = {};
    for (const id of Object.keys(pack.items)) if (ITEMS[id]?.slot) condition[id] = this.profile.condition[id] ?? 100;
    const exp = {
      v: 2, id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36), mountain: C.id, routeId, scenario, freeRoam: !!opts.freeRoam,
      createdAt: Date.now(), startUtc, simT: startUtc, tz, seed, rngState: seed ^ 0xabcdef,
      pos: { x: th.x, z: th.z, heading: 0 }, startPlace: route.start,
      targets: opts.freeRoam ? [] : [...route.via, route.end], detour: null, follow: { active: false },
      stage: 0, stagesDone: 0, pace: 'steady', timeScale: PACING[this.profile.settings.pacing]?.k || 8,
      pack: JSON.parse(JSON.stringify(pack)),
      supplies: { water: pack.water, waterCap: fx.waterL, food: foodPortions(pack), fuel: fx.stove ? 230 * (pack.supplies.fuel || 0) : 0, firstaid: fx.firstaid, repair: fx.repair, torch: fx.torch || 0 },
      condition, body: newBody(), camp: null, resting: null,
      stats: { moving: 0, resting: 0, sleeping: 0, deciding: 0, map: 0, photo: 0, distance: 0, ascent: 0, descent: 0, offTrail: 0, nightKm: 0, maxY: th.y, realPlay: 0, realDeciding: 0, realPhoto: 0, realMap: 0 },
      initial: { water: pack.water, kcal: packKcal(pack), fuel: fx.stove ? 230 * (pack.supplies.fuel || 0) : 0, packKg: packWeight(pack) },
      mins: { water: pack.water, hydration: 100, energy: 100, warmth: 100, hungerMax: 0, equipment: 100 },
      visited: {}, discovered: [], photos: [], objectives: {}, decisions: [], flags: {}, eventsAt: {}, junctionsAt: {}, tips: {}, warned: {},
      breadcrumbs: [[Math.round(th.x), Math.round(th.z)]], summit: null, nights: 0, finished: null,
      plannedSec: planRoute(this, route).total.sec,
    };
    return exp;
  },
  beginExpedition(exp) {
    this.exp = exp;
    exp.fx = fxOf(exp.pack);
    this.weather = new Weather(exp.seed, exp.startUtc - 6 * 3600000, { ...this.content.clim, ...(this.content.scenarios?.[exp.scenario]?.clim || {}) }, 10);
    this.rand = rng(exp.rngState);
    this.cursor = null; this.legs = null; this.approach = null;
    this.mode = 'play';
    this.lastAutosave = performance.now();
    const p = exp.pos, y = this.groundY(p.x, p.z);
    this.rig.yaw = p.heading; this.rig.dist = 9; this.rig.pitch = 0.3; this.rig.first = true;
    this.hiker.place(p.x, y, p.z, p.heading);
    this.tiles.update(p.x, p.z, Infinity);
    this.veg.update(p.x, p.z, 300);
    this.features.update(p.x, p.z);
    this.checkPlaces(true);
    if (exp.follow.active) this.startFollow(true);
    this.profile.active = exp;
    this.ui.showHud();
    this.audio.setMusic(false);
    this.clock.getDelta();
    this.save();
  },

  // ================= routing =================
  placeNode(id) {
    if (!id) return null;
    if (id.startsWith('node:')) return id.slice(5);
    const p = this.places[id];
    if (!p) return null;
    return p.node || this.net.nearestNode(p.x, p.z)?.id;
  },
  placeName(id) { if (!id) return '—'; if (id.startsWith('node:')) return 'the junction'; return this.places[id]?.name || id; },
  currentTarget() { return this.exp.detour || this.exp.targets[0] || null; },
  toggleFollow() { if (this.exp.follow.active) this.stopFollow('Following paused'); else this.startFollow(); },
  stopFollow(msg) { this.exp.follow.active = false; this.cursor = null; this.legs = null; this.approach = null; if (msg) this.ui.toast(msg); },
  startFollow(silent = false) {
    const ex = this.exp, tid = this.currentTarget();
    if (!tid) { this.ui.toast('No destination. Open the map (M) to choose one.'); return false; }
    const goal = this.placeNode(tid);
    const { x, z } = ex.pos;
    const near = this.features.index.nearest(x, z, 500);
    if (near.ref === null) { this.ui.toast('No track within 500 m. Walk towards a track first (WASD).'); return false; }
    const e = this.net.edges[near.ref];
    let s = 0, bestD = Infinity;
    for (let k = 0; k < e.pts.length - 1; k++) {
      const a = e.pts[k], b = e.pts[k + 1], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2));
      const d = Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z);
      if (d < bestD) { bestD = d; s = e.cum[k] + Math.sqrt(L2) * t; }
    }
    const opts = [
      { cursor: new EdgeCursor(e, e.a, s), pre: (e.len - s) / Math.max(1, e.len) * e.tAB, node: e.b },
      { cursor: new EdgeCursor(e, e.b, e.len - s), pre: s / Math.max(1, e.len) * e.tBA, node: e.a },
    ].map(o => ({ ...o, legs: o.node === goal ? [] : this.net.route(o.node, goal) })).filter(o => o.legs);
    if (!opts.length) { this.ui.toast('No mapped route to that destination from here.'); return false; }
    opts.forEach(o => { o.total = o.pre + this.net.legsSeconds(o.legs); });
    opts.sort((a, b) => a.total - b.total);
    const best = opts[0];
    this.cursor = best.cursor; this.legs = best.legs; this.legIndex = -1;
    this.goalTid = tid;   // which target these legs lead to
    this.approach = near.d > 5 ? { x: near.x, z: near.z } : null;
    ex.follow.active = true;
    if (!silent) this.ui.toast(`Following the track to ${this.placeName(tid)}`);
    return true;
  },
  followStep(d) {
    if (this.approach) {
      const { x, z } = this.exp.pos, dx = this.approach.x - x, dz = this.approach.z - z, L = Math.hypot(dx, dz);
      if (L <= d) { this.approach = null; return { x: x + dx, z: z + dz, dirx: dx / (L || 1), dirz: dz / (L || 1), grade: 0 }; }
      return { x: x + dx / L * d, z: z + dz / L * d, dirx: dx / L, dirz: dz / L, grade: (this.world.height(x + dx / L * 5, z + dz / L * 5) - this.world.height(x, z)) / 5 };
    }
    let c = this.cursor;
    while (d > 0) {
      const rem = c.remaining();
      if (d < rem) { c.s += d; d = 0; break; }
      d -= rem; c.s = c.edge.len;
      const node = c.to;
      this.legIndex++;
      const next = this.legs[this.legIndex];
      if (!next) { const p = c.sample(); this.arriveAtGoal(); return { ...p, stopped: true }; }
      this.cursor = c = new EdgeCursor(next.edge, next.from, 0);
      if (this.junctionCheck(node)) return { ...c.sample(0), stopped: true };
    }
    return c.sample();
  },
  arriveAtGoal() {
    const ex = this.exp, tid = this.goalTid;
    // the target may already have been ticked off on foot (onPlace); only pop it if it is still current
    if (tid && this.currentTarget() === tid) { if (ex.detour) ex.detour = null; else ex.targets.shift(); }
    this.goalTid = null;
    this.cursor = null; this.legs = null; ex.follow.active = false;
    if (tid && this.places[tid]) this.onPlace(this.places[tid], true);
    const next = this.currentTarget();
    if (next) this.ui.toast(`Reached ${this.placeName(tid)}. Next: ${this.placeName(next)} — F to continue.`);
    else if (!ex.finished) this.ui.toast(`Reached ${this.placeName(tid)}.`);
    this.autosave('checkpoint');
  },
  junctionCheck(nid) {
    const n = this.net.nodes.get(nid), ex = this.exp;
    if (!n || n.edges.length < 3) return false;
    if (ex.junctionsAt[nid] && ex.simT - ex.junctionsAt[nid] < 2 * 3600000) return false;
    // only stop where a branch other than the planned way and the way we came is a real alternative:
    // it leads somewhere (a mapped place) or continues for a meaningful distance
    const planned = this.legs?.[this.legIndex]?.edge, came = this.legs?.[this.legIndex - 1]?.edge;
    const pois = Object.values(this.places).map(p => ({ name: p.name, x: p.x, z: p.z, r: (p.r || 60) + 20 }));
    const alternatives = n.edges.filter(e => e !== planned && e !== came).filter(e => {
      const la = this.net.lookahead(nid, e, pois, 2500);
      return la.passes.length > 0 || la.len > 1500 || (e.name && e.name !== planned?.name && la.len > 800);
    });
    if (!alternatives.length) return false;
    // don't nag: minor junctions in quick succession are skipped unless a branch leads to a mapped place
    const leadsSomewhere = alternatives.some(e => this.net.lookahead(nid, e, pois, 2500).passes.length);
    if (!leadsSomewhere && ex.lastJunctionAt && ex.simT - ex.lastJunctionAt < 40 * 60000) return false;
    ex.lastJunctionAt = ex.simT;
    ex.junctionsAt[nid] = ex.simT;
    ex.junctionCount = (ex.junctionCount || 0) + 1;
    this.ui.junction(n);
    return true;
  },
  setDetour(tid, label) { this.exp.detour = tid; this.logDecision('Detour', label); this.startFollow(); },
  logDecision(title, choice) { this.exp.decisions.push({ simT: this.exp.simT, title, choice }); },
  nearestExit() {
    const ex = this.exp, here = this.net.nearestNode(ex.pos.x, ex.pos.z);
    let best = null;
    for (const [id, t] of Object.entries(this.content.trailheads)) {
      const legs = this.net.route(here.id, t.node);
      if (!legs) continue;
      const sec = this.net.legsSeconds(legs) * (t.remote ? 1.6 : 1);
      if (!best || sec < best.sec) best = { id: 'th:' + id, sec };
    }
    return best;
  },
  turnBack(why = 'player') {
    const ex = this.exp, best = this.nearestExit();
    if (!best) return;
    ex.targets = [best.id]; ex.detour = null; ex.flags.retreat = true;
    this.logDecision('Retreat', `Turned back towards ${this.places[best.id].name}`);
    this.startFollow();
    this.ui.mentorRadio(why === 'decision' ? "Good call. The mountain isn't going anywhere." : 'Heading out. Keep eating and drinking on the way down.');
  },
  seekShelter() {
    const ex = this.exp;
    const shelters = Object.values(this.places).filter(p => p.hut || p.camp || p.shelter);
    if (!shelters.length) return this.turnBack();
    shelters.sort((a, b) => Math.hypot(a.x - ex.pos.x, a.z - ex.pos.z) - Math.hypot(b.x - ex.pos.x, b.z - ex.pos.z));
    this.setDetour(shelters[0].id, `Shelter at ${shelters[0].name}`);
  },
  detourToWater() {
    const ex = this.exp;
    const src = Object.values(this.places).filter(p => p.water).sort((a, b) => Math.hypot(a.x - ex.pos.x, a.z - ex.pos.z) - Math.hypot(b.x - ex.pos.x, b.z - ex.pos.z))[0];
    if (src) this.setDetour(src.id, `Water at ${src.name}`);
    else this.ui.toast('No known water source on the map nearby. Streams are marked blue.');
  },

  // ================= places =================
  checkPlaces(initial = false) {
    const ex = this.exp, { x, z } = ex.pos;
    for (const p of Object.values(this.places)) {
      if (Math.hypot(p.x - x, p.z - z) < (p.r || 60)) {
        if (ex.atPlace !== p.id) { ex.atPlace = p.id; ex.placeName = p.name; if (!initial || p.trailhead) this.onPlace(p, false, initial); }
        return p;
      }
    }
    ex.atPlace = null;
    return null;
  },
  onPlace(p, viaRoute, initial = false) {
    const ex = this.exp, C = this.content;
    const first = !ex.visited[p.id];
    ex.visited[p.id] = ex.visited[p.id] || ex.simT;
    const goalPlace = this.route()?.objective || C.objectivePlace || C.summitPlace;
    if (p.id === C.summitPlace && !ex.summitReached) { ex.summitReached = ex.simT; this.ui.mentorRadio(C.mentor?.summit || 'Summit.'); this.audio.sting('summit'); this.logDecision('Milestone', `Reached ${p.name}`); }
    if (p.id === goalPlace && !ex.summit) ex.summit = ex.simT;
    const lm = C.landmarks.find(l => l.at === p.id);
    if (lm && !ex.discovered.includes(lm.id)) { ex.discovered.push(lm.id); if (!initial) this.ui.toast(`Landmark: ${lm.title} (J for notes)`); }
    for (const o of C.objectives || []) if (o.kind === 'visit' && o.place === p.id && !ex.objectives[o.id]) { ex.objectives[o.id] = ex.simT; this.ui.toast(`Objective complete: ${o.title}`); }
    if (!viaRoute && this.currentTarget() === p.id) {
      if (ex.detour) ex.detour = null; else ex.targets.shift();
      // reached on foot while following: re-route from here to the next target
      if (!this.currentTarget()) { this.goalTid = null; this.stopFollow(); }
      else if (ex.follow.active && this.goalTid === p.id) { this.goalTid = null; this.startFollow(true); }
    }
    if (p.view && !ex.tips?.viewpointSeen) { ex.viewpointHere = true; }
    if (this.canFinishAt(p) && !initial) this.pendingFinish = p.id;   // shown as soon as no other dialog is open
    if (first && !initial) this.autosave('checkpoint');
  },
  canFinishAt(p) {
    const ex = this.exp;
    return !!(p?.exit && ex.stats.distance > 1500 && (ex.summit || ex.flags.retreat || !this.currentTarget()));
  },
  waterSourceNear() {
    const ex = this.exp, p = ex.atPlace && this.places[ex.atPlace];
    if (p?.water) return { kind: p.water, name: p.name, limit: p.id === 'fedhut' ? ex.flags.tankLimit : undefined };
    const w = this.features.waterIndex.nearest(ex.pos.x, ex.pos.z, 40);
    if (w.d < 30) return { kind: w.ref === -1 ? 'lake' : 'creek', name: w.ref === -1 ? 'the lake' : (this.world.water[w.ref]?.name || 'a creek') };
    if (ex.scenario === 'winter' && this.lastEnv?.snow && ex.fx.stove && ex.supplies.fuel > 20) return { kind: 'snow', name: 'melted snow' };
    return null;
  },
  doRefill(src, treat) {
    const ex = this.exp, s = ex.supplies;
    let want = s.waterCap - s.water;
    if (src.limit !== undefined) want = Math.min(want, src.limit);
    if (want <= 0.05) { this.ui.toast(src.limit === 0 ? 'You leave the tank for others.' : 'Bottles already full.'); return; }
    if (src.kind === 'snow') { s.fuel -= Math.min(s.fuel, want * 12); }
    s.water += want;
    this.passTime(Math.round(90 + want * 50 + (src.kind === 'snow' ? 900 : 0)), 'rest');
    if ((src.kind === 'creek' || src.kind === 'lake') && !treat && this.rand() < 0.2) {
      ex.flags.gutBug = ex.simT; ex.body.hydration -= 12; ex.body.energy -= 15;
      this.ui.toast('Untreated water. Hours later your stomach turns (simulated).');
    }
    this.ui.toast(`Filled ${want.toFixed(1)} L from ${src.name}.`);
    this.logDecision('Water', `Refilled ${want.toFixed(1)} L from ${src.name}${src.kind === 'creek' || src.kind === 'lake' ? (treat ? ' (filtered)' : ' (untreated)') : ''}`);
  },
  canCamp() { const p = this.exp.atPlace && this.places[this.exp.atPlace]; return p?.camp ? p : null; },

  // ================= time =================
  startRest(kind, seconds, label, camp = null) {
    const ex = this.exp;
    if (camp) ex.camp = camp;
    ex.resting = { kind, until: ex.simT + seconds * 1000, label, rate: kind === 'sleep' ? 5400 : 1500 };
    if (ex.follow.active) { ex.follow.active = false; this.cursor = null; }
    this.logDecision('Rest', label);
  },
  passTime(seconds, kind) {
    const ex = this.exp, env = this.lastEnv || this.envAt(ex.pos.x, ex.pos.z);
    tickBody(ex, seconds, env, kind === 'decide' ? 'idle' : kind, 0, this.profile.settings);
    ex.simT += seconds * 1000;
    if (kind === 'sleep') ex.stats.sleeping += seconds; else if (kind === 'decide') ex.stats.deciding += seconds; else ex.stats.resting += seconds;
  },
  localHour() { const d = new Date(this.exp.simT + this.exp.tz * 3600000); return d.getUTCHours() + d.getUTCMinutes() / 60; },
  sunsetIn() {
    const ex = this.exp, [lat, lon] = this.world.toLatLon(ex.pos.x, ex.pos.z);
    const d = new Date(ex.simT + ex.tz * 3600000);
    const day0 = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - ex.tz * 3600000;
    const t = this._sunCache?.day === day0 ? this._sunCache : (this._sunCache = { day: day0, ...sunTimes(day0, lat, lon) });
    return t.set ? (t.set - ex.simT) / 3600000 : 99;
  },
  nextSunrise() {
    const ex = this.exp, [lat, lon] = this.world.toLatLon(ex.pos.x, ex.pos.z);
    const d = new Date(ex.simT + ex.tz * 3600000);
    const day0 = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - ex.tz * 3600000;
    const today = sunTimes(day0, lat, lon).rise;
    return ex.simT < today - 3600000 ? today : sunTimes(day0 + 86400000, lat, lon).rise;
  },
  weatherSoon() {
    const now = this.weather.at(this.exp.simT), later = this.weather.at(this.exp.simT + 3 * 3600000);
    const worsening = later.precip > now.precip + 0.3 || later.wind > now.wind + 18 || later.base < now.base - 400;
    const severity = Math.min(1, later.precip / 2.5 + Math.max(0, later.wind - 30) / 60);
    const clearing = later.base > now.base + 200 && later.precip < now.precip + 0.05;
    const text = worsening ? `Wind ${Math.round(later.wind)} km/h and ${later.precip > 0.3 ? 'rain' : 'cloud'} likely within a few hours.` : 'The next few hours look settled.';
    return { worsening, severity, clearing, text };
  },
  remainingEstimate() {
    const ex = this.exp, tid = this.currentTarget();
    const out = { km: 0, hours: 0, name: this.placeName(tid), alpineAhead: false, junctionNear: false, water: null };
    if (!tid) return out;
    const legs = this.legs && this.legIndex >= -1 ? this.legs.slice(Math.max(0, this.legIndex)) : null;
    let sec = 0, len = 0;
    if (legs && legs.length) { sec = this.net.legsSeconds(legs); len = legs.reduce((s, L) => s + L.edge.len, 0); }
    else { const p = this.places[tid]; if (p) { len = Math.hypot(p.x - ex.pos.x, p.z - ex.pos.z) * 1.3; sec = len / 0.9; } }
    out.km = len / 1000;
    const pace = this.lastPace?.kmh ? this.lastPace.kmh / 4 : 0.85;
    out.hours = sec / 3600 / Math.max(0.3, pace);
    if (legs) {
      const pts = this.net.legsPolyline(legs.slice(0, 4));
      out.alpineAhead = pts.some((p, i) => i % 6 === 0 && p[2] > this.eco.treeline);
      out.junctionNear = legs.slice(0, 2).some(L => this.net.nodes.get(L.to)?.edges.length >= 3);
    }
    const w = Object.values(this.places).filter(p => p.water).sort((a, b) => Math.hypot(a.x - ex.pos.x, a.z - ex.pos.z) - Math.hypot(b.x - ex.pos.x, b.z - ex.pos.z))[0];
    if (w) out.water = `${w.name}, about ${(Math.hypot(w.x - ex.pos.x, w.z - ex.pos.z) / 1000).toFixed(1)} km away`;
    return out;
  },

  // ================= frame simulation =================
  simulate(dt) {
    const ex = this.exp, W = this.world, S = this.profile.settings;
    if (this.ui.modalOpen()) {
      if (this.ui.modalCountsAsDecision()) { ex.simT += dt * 1000; ex.stats.deciding += dt; ex.stats.realDeciding += dt; }
      return;
    }
    if (this.rig.mode === 'photo') { ex.simT += dt * 1000; ex.stats.photo += dt; ex.stats.realPhoto += dt; return; }
    if (ex.resting) return this.simulateRest(dt);
    const k = this.keys, mv = this.input.move;
    let mx = mv.x, mz = mv.y;
    if (k.has('w') || k.has('arrowup')) mz -= 1;
    if (k.has('s') || k.has('arrowdown')) mz += 1;
    if (k.has('a') || k.has('arrowleft')) mx -= 1;
    if (k.has('d') || k.has('arrowright')) mx += 1;
    ex.pushing = k.has('shift') || this.input.push;
    const following = ex.follow.active && this.cursor;
    const simDt = dt * ex.timeScale;
    const { x, z } = ex.pos;
    const env = this.lastEnv = this.envAt(x, z);
    let moving = false;
    this.lastVirtual = false;
    if (following || Math.hypot(mx, mz) > 0.1) {
      let dirx, dirz, grade, onTrail, sac = '', virtual = false, kind = 'path';
      if (following) {
        const p = this.approach ? null : this.cursor.sample();
        if (p) { dirx = p.dirx; dirz = p.dirz; grade = p.grade; onTrail = true; sac = this.cursor.edge.sac || ''; virtual = !!this.cursor.edge.virtual; kind = this.cursor.edge.kind; }
        else { const ax = this.approach.x - x, az = this.approach.z - z, L = Math.hypot(ax, az) || 1; dirx = ax / L; dirz = az / L; onTrail = false; grade = (W.height(x + dirx * 4, z + dirz * 4) - W.height(x, z)) / 4; }
      } else {
        const yaw = this.rig.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = -fz, rz = fx;
        dirx = fx * -mz + rx * mx; dirz = fz * -mz + rz * mx;
        const L = Math.hypot(dirx, dirz); dirx /= L; dirz /= L;
        grade = (W.height(x + dirx * 4, z + dirz * 4) - W.height(x, z)) / 4;
        const nt = this.features.index.nearest(x, z, 8);
        onTrail = nt.d < 4;
        if (onTrail) { const e = this.net.edges[nt.ref]; sac = e.sac || ''; virtual = !!e.virtual; kind = e.kind; }
      }
      this.lastVirtual = virtual; this.lastTrailKind = kind;
      const ctx = { grade, onTrail, sac, virtual, zone: env.zone, slopeDeg: env.zone.slope, dark: env.dark, fog: env.fog, snow: env.snow, wind: env.wind, exposed: env.exposed, wetRock: env.precip > 0.05 || env.fog };
      const pace = paceModel(ex, ctx);
      this.lastPace = pace;
      const steepAhead = !onTrail && Math.abs(grade) > 0.95;
      if ((pace.blocked && grade > 0.3) || steepAhead) {
        this.ui.toast('Too steep to climb safely here.');
      } else {
        const d = pace.mps * simDt * (ex.freeRoam ? 1.5 : 1);
        let nx, nz, ndx = dirx, ndz = dirz;
        if (following) { const r = this.followStep(d); nx = r.x; nz = r.z; ndx = r.dirx; ndz = r.dirz; }
        else { nx = x + dirx * d; nz = z + dirz * d; }
        if (!W.near.contains(nx, nz, 350)) { this.ui.toast('The edge of the reconstructed terrain.'); nx = x; nz = z; }
        if (this.features.collide(nx, nz)) { nx = x; nz = z; }
        if (W.lakeAt(nx, nz) && !onTrail) { this.ui.toast('Deep water.'); nx = x; nz = z; }
        const y0 = W.height(x, z), y1 = W.height(nx, nz), moved = Math.hypot(nx - x, nz - z);
        ex.pos.x = nx; ex.pos.z = nz;
        if (moved > 0.001) ex.pos.heading = Math.atan2(-ndx, -ndz);
        ex.stats.distance += moved; if (!onTrail) ex.stats.offTrail += moved; if (env.dark) ex.stats.nightKm += moved / 1000;
        if (y1 > y0) ex.stats.ascent += y1 - y0; else ex.stats.descent += y0 - y1;
        ex.stats.maxY = Math.max(ex.stats.maxY, y1);
        ex.stats.moving += simDt;
        if (!ex.freeRoam) {
          tickBody(ex, simDt, env, 'move', effortOf(ex, pace.mps, grade), S);
          wearGear(ex, moved, ctx);
        }
        ex.simT += simDt * 1000;
        moving = moved > 0.001;
        this.lastOnTrail = onTrail;
        this.hiker.animate(dt, Math.min(1.6, pace.kmh / 4), grade, ex.pushing);
        const last = ex.breadcrumbs[ex.breadcrumbs.length - 1];
        if (Math.hypot(nx - last[0], nz - last[1]) > 40) ex.breadcrumbs.push([Math.round(nx), Math.round(nz)]);
      }
    }
    if (!moving) {
      if (!ex.freeRoam) tickBody(ex, simDt, env, 'idle', 0, S);
      ex.simT += simDt * 1000; ex.stats.resting += simDt;
      this.hiker.rest(dt);
    }
    this.lastMoving = moving;
    this.trackMinima();
    this.audioCtx = { wind: env.wind, exposed: env.exposed, precip: env.precip, snowing: env.temp < 0.8, waterDist: this.features.waterIndex.nearest(ex.pos.x, ex.pos.z, 80).d, day: !env.dark, birds: env.zone.forest > 0.4 ? 1 : env.zone.woodland > 0.4 ? 0.4 : 0.1 };
    this.checkPlaces();
    if (this.pendingFinish && !this.ui.modalOpen()) {
      const p = this.places[this.pendingFinish];
      this.pendingFinish = null;
      if (ex.atPlace === p.id) { this.stopFollow(); this.ui.finishPrompt(p); }
    }
    this.stageCheck();
    this.tutorialCheck();
    this.warningCheck();
    if (!ex.freeRoam) this.decisions.tick(simDt / 3600);
    if (performance.now() - this.lastAutosave > 60000) this.autosave('timer');
  },
  simulateRest(dt) {
    const ex = this.exp, r = ex.resting, step = Math.min(dt * r.rate * 1000, r.until - ex.simT);
    const env = this.lastEnv = this.envAt(ex.pos.x, ex.pos.z);
    tickBody(ex, step / 1000, env, r.kind, 0, this.profile.settings);
    if (r.kind === 'sleep') {
      ex.stats.sleeping += step / 1000;
      if (env.wind > 65 && ex.camp?.tent && !ex.camp.hut) this.damageSlot('tent', step / 3.6e6 * (ex.fx.tent >= 2 ? 3 : 12));
    } else ex.stats.resting += step / 1000;
    ex.simT += step;
    this.hiker.rest(dt);
    this.audioCtx = { wind: env.wind, exposed: env.exposed, precip: env.precip, waterDist: 999, day: !env.dark, birds: 0 };
    if (ex.simT >= r.until) {
      ex.resting = null;
      if (r.kind === 'sleep') {
        ex.nights++; ex.body.awake = 0;
        this.objectiveCamp();
        this.stageCamp();
        ex.camp = null;
        this.ui.mentorRadio(this.morningLine());
      }
      this.ui.toast(`${r.label} — done.`);
      this.autosave('checkpoint');
    }
  },
  morningLine() {
    const ex = this.exp, b = ex.body;
    if (b.warmth < 40) return 'Cold night. Get something hot into you before you move.';
    if (ex.foodKcal < 2500) return 'Morning. Check that food bag — you are running thin.';
    return this.weatherSoon().worsening ? 'Morning. Weather is turning later — decide early.' : 'Morning. Looks like a good day. Pack up and get moving.';
  },
  trackMinima() {
    const ex = this.exp, b = ex.body, m = ex.mins;
    ex.foodKcal = foodLeftKcal(ex);
    ex.packKg = liveWeight(ex);
    const eq = equipmentCondition(ex);
    m.water = Math.min(m.water, ex.supplies.water); m.hydration = Math.min(m.hydration, b.hydration); m.energy = Math.min(m.energy, b.energy);
    m.warmth = Math.min(m.warmth, b.warmth); m.hungerMax = Math.max(m.hungerMax, b.hunger); m.equipment = Math.min(m.equipment, eq);
    // weakest item for equipment encounters
    let weak = null;
    for (const id of carriedDurables(ex.pack)) if (!weak || (ex.condition[id] ?? 100) < (ex.condition[weak] ?? 100)) weak = id;
    ex.minCondition = weak ? ex.condition[weak] : 100; ex.weakestSlot = weak ? ITEMS[weak].slot : 'boots'; ex.weakestName = weak ? ITEMS[weak].name : 'Your gear';
  },
  warningCheck() {
    const ex = this.exp, ind = indicators(ex);
    const lines = { energy: 'You are fading. Rest and eat before you make mistakes.', hydration: 'You are getting dehydrated. Drink, and find water.', hunger: 'Hungry. Eat something — I to open the pack.', warmth: 'You are getting cold. Layers on, out of the wind.', equipment: 'Your gear is falling apart. Nurse it, or head out.' };
    for (const [k, v] of Object.entries(ind)) {
      const bad = k === 'hunger' ? v > WARN.hunger : v < WARN[k];
      if (bad && !ex.warned[k]) { ex.warned[k] = ex.simT; this.ui.mentorRadio(lines[k]); this.ui.warn(k); }
      if (!bad && ex.warned[k] && (k === 'hunger' ? v < WARN.hunger - 15 : v > WARN[k] + 15)) ex.warned[k] = null;
    }
  },
  tutorialCheck() {
    const ex = this.exp, T = this.content.tutorial;
    if (!T || this.ui.modalOpen()) return;
    const c = { simMin: (ex.simT - ex.startUtc) / 60000, distance: ex.stats.distance, body: ex.body, viewpoint: !!(ex.atPlace && this.places[ex.atPlace]?.view), junctions: ex.junctionCount || 0 };
    for (const t of T) if (!ex.tips[t.id] && t.when(c)) { ex.tips[t.id] = 1; this.ui.mentorRadio(t.text, 9000); break; }
  },
  autosave(why) {
    if (!this.exp || this.exp.finished) return;
    this.save();
    this.lastAutosave = performance.now();
    if (why === 'checkpoint') this.ui.flashSaved();
  },

  // ================= stages, objectives =================
  route() { return this.content.routes.find(r => r.id === this.exp.routeId); },
  stageCheck() {
    const ex = this.exp, st = this.route()?.stages;
    if (!st || ex.stage >= st.length) return;
    const s = st[ex.stage];
    if (s.until.startsWith('th:') && ex.atPlace === s.until && ex.stats.distance > 2000) { ex.stage++; ex.stagesDone = ex.stage; }
  },
  stageCamp() {
    const ex = this.exp, st = this.route()?.stages;
    if (!st || ex.stage >= st.length) return;
    const s = st[ex.stage];
    if (ex.atPlace === s.until || (ex.camp && ex.camp.at === s.until)) {
      ex.stage++; ex.stagesDone = ex.stage;
      this.ui.stageComplete(s, st[ex.stage]);
    }
  },
  objectiveCamp() {
    for (const o of this.content.objectives || []) if (o.kind === 'camp' && !this.exp.objectives[o.id] && this.exp.camp?.at) { this.exp.objectives[o.id] = this.exp.simT; this.ui.toast(`Objective complete: ${o.title}`); }
  },

  // ================= supplies helpers for encounters =================
  eatBest() {
    for (const id of ['lunch', 'trail-mix', 'bars']) if (this.exp.supplies.food[id] > 0) { eatPortion(this.exp, id); return ITEMS[id]?.name || { lunch: 'a wrap', 'trail-mix': 'a handful of trail mix', bars: 'an energy bar' }[id]; }
    return null;
  },
  cacheFood(frac) {
    const f = this.exp.supplies.food, cache = {};
    for (const id of Object.keys(f)) { const n = Math.floor(f[id] * frac); cache[id] = n; f[id] -= n; }
    this.exp.supplies.cached = { at: { x: this.exp.pos.x, z: this.exp.pos.z }, food: cache };
  },
  damageSlot(slot, amt) { const n = damageItem(this.exp, slot, amt); return n; },
  repairWeakest(amt) {
    let weak = null;
    for (const id of carriedDurables(this.exp.pack)) if (!weak || this.exp.condition[id] < this.exp.condition[weak]) weak = id;
    if (weak) this.exp.condition[weak] = Math.min(100, this.exp.condition[weak] + amt);
  },
  resourceLine() {
    const ex = this.exp, b = ex.body;
    return `Water ${ex.supplies.water.toFixed(1)} L · food ${Math.round(ex.foodKcal || foodLeftKcal(ex))} kcal · energy ${Math.round(b.energy)} · hydration ${Math.round(b.hydration)} · hunger ${Math.round(b.hunger)} · warmth ${Math.round(b.warmth)} · gear ${Math.round(equipmentCondition(ex))}% · ${fmtDur((this.sunsetIn() > 0 ? this.sunsetIn() : 0) * 3600)} to sunset`;
  },

  // ================= photography =================
  enterPhoto() {
    if (!this.exp.fx.camera) { this.ui.toast('No camera packed.'); return; }
    if (this.exp.follow.active) this.stopFollow();
    this.rig.enterPhoto(this.exp.fx.zoom || 2);
    this.ui.photoMode(true);
  },
  exitPhoto() { this.rig.exitPhoto(); this.ui.photoMode(false); },
  async takePhoto() {
    const ex = this.exp;
    this.rig.update(ex.pos.x, this.groundY(ex.pos.x, ex.pos.z), ex.pos.z);
    this.camera.updateMatrixWorld();
    this.renderer.render(this.m.scene, this.camera);
    const img = captureThumb(this.renderer, this.canvas);
    const visible = this.visibleLandmarks(0.92);
    const view = analyseView(this);
    const sc = scorePhoto(this, view, visible);
    const env = this.lastEnv || this.envAt(ex.pos.x, ex.pos.z);
    const id = 'ph-' + ex.id + '-' + ex.photos.length;
    const photo = {
      id, expId: ex.id, mountain: this.content.id, mountainName: this.mountain.name, simT: ex.simT, tz: ex.tz,
      place: ex.atPlace ? this.places[ex.atPlace].name : (visible[0] ? `near ${visible[0].name}` : 'on the mountain'),
      weather: `${this.weather.describe(env.weather, env.temp)}, ${Math.round(env.temp)} °C`, y: Math.round(env.y),
      ...sc, seen: visible.slice(0, 5).map(l => l.name), at: Date.now(),
    };
    await putImage(id, img);
    ex.photos.push(id);
    this.profile.photos.push(photo);
    this.profile.stats.photosTaken++;
    for (const o of this.content.objectives || []) if (o.kind === 'photo' && !ex.objectives[o.id] && ex.atPlace === o.place && sc.score >= (o.minScore || 0)) { ex.objectives[o.id] = ex.simT; this.ui.toast(`Objective complete: ${o.title}`); }
    this.passTime(40, 'rest'); ex.stats.photo += 40; ex.stats.resting -= 40;
    this.audio.shutter();
    this.ui.photoTaken(photo, img);
    this.autosave('checkpoint');
  },

  // ================= ending =================
  collapse(text) { this.finishExpedition('assisted', null, text); },
  finishExpedition(outcome, place, note = '') {
    const ex = this.exp, p = this.profile, C = this.content, m = this.mountain;
    if (ex.finished) return;
    if (outcome === 'auto') outcome = ex.summit ? 'complete' : ex.flags.retreat ? 'retreat' : 'retreat';
    const routeDef = this.route();
    const plan = planRoute(this, routeDef);
    const prepared = (routeDef.gear || []).filter(id => ITEMS[id]?.slot).every(id => {
      const slot = ITEMS[id].slot; return Object.keys(ex.pack.items).some(x => ITEMS[x]?.slot === slot);
    }) && ex.initial.water >= plan.metrics.water * 0.5;
    const leftover = ex.foodKcal / Math.max(1, ex.initial.kcal);
    const supplyScore = Math.max(0, 1 - Math.abs(leftover - 0.15) * 2) * (ex.mins.hydration > 30 ? 1 : 0.4);
    const assistCost = outcome === 'assisted' ? (ex.fx.beacon ? 150 : 600) : 0;
    const objectivesDone = Object.keys(ex.objectives).length;
    const w = this.weather.at(ex.simT);
    const result = {
      mountain: C.id, outcome, summit: !!ex.summit, route: { id: routeDef.id, name: routeDef.name, rewardMult: (plan.metrics.rewardMult || 1) * (C.scenarios?.[ex.scenario]?.rewardMult || 1) },
      landmarksNew: ex.discovered.length, photos: ex.photos.length, objectivesDone, prepared, supplyScore, stagesDone: ex.stagesDone,
      sponsorPay: outcome === 'complete' ? sponsorPay(p) : [], assistCost,
    };
    const rewards = ex.freeRoam ? { xp: 0, money: 0, lines: [{ label: 'Free exploration — no rewards', xp: 0, money: 0 }] } : computeRewards(p, result);
    rewards.xp += ex.bonusXp || 0;
    ex.finished = { outcome, at: place?.id || null, simT: ex.simT, note };
    // write back to the profile
    p.xp += rewards.xp; p.money = Math.max(0, p.money + rewards.money); p.reputation += (ex.bonusRep || 0) + (ex.summit ? 2 : 0) - (outcome === 'assisted' ? 5 : 0);
    if (rewards.money > 0) p.stats.moneyEarned += rewards.money;
    for (const [id, c] of Object.entries(ex.condition)) p.condition[id] = Math.round(c);
    const rec = p.completed[C.id] || (p.completed[C.id] = { attempts: 0, summits: 0, objective: false, best: null });
    rec.attempts++;
    if (ex.summitReached) rec.summits++;
    if (ex.summit && outcome !== 'assisted' && !routeDef.partial) rec.objective = true;
    const simSec = (ex.simT - ex.startUtc) / 1000;
    const score = Math.round((ex.summit ? 60 : 20) + objectivesDone * 8 + Math.max(0, 20 - simSec / 3600) + supplyScore * 10);
    if (!rec.best || score > rec.best.score) rec.best = { score, simSec, route: routeDef.name, at: Date.now() };
    p.stats.expeditions++; if (ex.summitReached) p.stats.summits++; if (outcome === 'retreat') p.stats.abandoned++; if (outcome === 'assisted') p.stats.assisted++;
    p.stats.distance += ex.stats.distance; p.stats.ascent += ex.stats.ascent; p.stats.simSeconds += simSec; p.stats.landmarks += ex.discovered.length;
    const summary = {
      id: ex.id, mountain: C.id, name: m.name, route: routeDef.name, scenario: ex.scenario, outcome, summit: !!ex.summit, at: Date.now(),
      distance: ex.stats.distance, ascent: ex.stats.ascent, simSec, stats: { ...ex.stats }, xp: rewards.xp, money: rewards.money, photos: ex.photos.length,
      decisions: ex.decisions.slice(-40), nights: ex.nights, packKg: ex.initial.packKg, nightKm: ex.stats.nightKm, winter: ex.scenario === 'winter',
      badWeather: !!ex.flags.badWeatherRetreat || w.precip > 0.5 || w.wind > 50,
      consumed: { water: Math.max(0, ex.initial.water - ex.supplies.water), kcal: Math.max(0, ex.initial.kcal - ex.foodKcal), fuel: Math.max(0, ex.initial.fuel - ex.supplies.fuel) },
    };
    p.history.push(summary);
    const unlocked = refreshUnlocks(p);
    if (C.id === 'arthurs' && rec.objective) p.freeRoam = true;
    const achievements = checkAchievements(p);
    const offers = sponsorOffers(p);
    const suggestions = this.suggestions(ex, plan);
    const mentor = this.debriefLine(ex, outcome, suggestions);
    p.active = null;
    this.save();
    this.ui.debrief({ summary, rewards, unlocked, achievements, offers, suggestions, mentor, plan, ex, note });
  },
  suggestions(ex, plan) {
    const s = [];
    if (ex.mins.water < 0.05 || ex.mins.hydration < 30) s.push('You ran dry. Carry more water for the longest gap between sources, or plan refills — the briefing shows the estimate.');
    if (ex.mins.hungerMax > 80) s.push('You got very hungry. Pack more food, and eat little and often — hunger makes energy drain faster.');
    if (ex.mins.warmth < 30) s.push('You got dangerously cold. A better insulating layer and a proper shell make the difference above the treeline.');
    if (ex.mins.energy < 15) s.push('You hit empty. Take short breaks before you need them, and save Shift for when it counts.');
    if (ex.initial.packKg > (ex.fx.capacityKg || 11)) s.push(`Your pack (${ex.initial.packKg.toFixed(1)} kg) was over its comfortable limit. Lighter gear or a bigger pack would help.`);
    if (ex.mins.equipment < 40) s.push('Your gear took a beating. Repair or replace it at the hub before the next trip.');
    if (ex.stats.nightKm > 0.5 && !ex.fx.torch) s.push('You walked in the dark without a head torch. Pack one — it weighs almost nothing.');
    if (ex.stats.offTrail > 2000) s.push('You spent a long time off-track. It is slow, hard on gear and easy to get lost.');
    if (!s.length) s.push('A well-run trip. Look at the harder routes for more reward — and more risk.');
    return s;
  },
  debriefLine(ex, outcome, sugg) {
    if (outcome === 'assisted') return "You needed help this time. It happens to good people. Let's work out where it started going wrong — usually it's hours before the crisis.";
    if (outcome === 'retreat') return ex.flags.badWeatherRetreat ? 'Turning back in that weather was the best decision you made all trip. That is how people get old in the mountains.' : 'You turned around. No shame in that — you will come back knowing more.';
    if (ex.flags.corniceLuck) return 'You summited — but you walked across that cornice on someone else’s footprints. Lucky. Don’t rely on luck twice.';
    if (ex.flags.corniceRead) return 'Stopping to read that ridge was proper mountaineering. That’s the habit that will keep you alive.';
    return sugg.length > 1 ? 'Good result, but a few things to tidy up before the next one.' : 'That was textbook. Steady, well-prepared, good decisions. Next one will ask more of you.';
  },
};
