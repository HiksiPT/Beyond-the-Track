// Core: renderer, main loop, mountain loading and rendering. Expedition logic lives in ExpeditionManager
// (mixed into this class) so both share one central state (this.profile / this.exp).
import * as THREE from 'three';
import { buildMountain, disposeMountain } from '../world/WorldManager.js';
import { setVegQuality, QUALITY } from '../world/Vegetation.js';
import { setTerrainQuality, zoneAt } from '../world/TerrainGenerator.js';
import { CameraRig } from '../player/CameraController.js';
import { AudioSystem } from '../systems/AudioSystem.js';
import { sunPosition } from '../systems/Weather.js';
import { saveProfile } from './SaveSystem.js';
import { ExpeditionMethods } from '../expedition/ExpeditionManager.js';
import { DecisionEngine } from '../expedition/DecisionEngine.js';
import { changed } from './GameState.js';

const DEG = Math.PI / 180;

export class Game {
  constructor(canvas, profile, ui) {
    this.canvas = canvas; this.profile = profile; this.ui = ui;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.3, 160000);
    this.clock = new THREE.Clock();
    this.keys = new Set();
    this.input = { move: { x: 0, y: 0 }, push: false };
    this.audio = new AudioSystem(profile.settings);
    this.audio.captionFn = (t) => ui.caption(t);
    this.rig = new CameraRig(this.camera, canvas, profile.settings);
    this.decisions = new DecisionEngine(this);
    this.m = null; this.exp = null;
    this.mode = 'title';
    this.orbit = 0;
    this.applyQuality(profile.settings.quality, false);
    this.resize();
    addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.save(); });
    addEventListener('beforeunload', () => this.save());
  }
  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  applyQuality(q, rebuild = true) {
    this.quality = QUALITY[q] ? q : 'high';
    this.profile.settings.quality = this.quality;
    setVegQuality(this.quality); setTerrainQuality(this.quality);
    this.renderer.shadowMap.enabled = QUALITY[this.quality].shadows;
    this.renderer.setPixelRatio(this.quality === 'low' ? 1 : Math.min(devicePixelRatio, this.quality === 'medium' ? 1.25 : 1.75));
    if (rebuild && this.m) { this.m.veg.reset(); this.m.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); }
    this.resize();
  }
  save() {
    if (this.exp && !this.exp.finished) this.exp.rngState = this.rand?.state?.() ?? this.exp.rngState;
    this.profile.active = this.exp && !this.exp.finished ? this.exp : this.profile.active;
    return saveProfile(this.profile);
  }

  // ---- mountain world ----
  async loadMountain(id, scenario = 'summer', onStatus = () => {}) {
    if (this.m && this.m.id === id && this.m.scenario === scenario) return this.m;
    const prevMode = this.mode;
    this.mode = 'loading';   // the loop idles while the old world is disposed and the new one built
    if (this.m) { disposeMountain(this.m); this.m = null; }
    let m;
    try { m = await buildMountain(this, id, scenario, onStatus); }
    finally { if (this.mode === 'loading') this.mode = prevMode === 'play' ? 'hub' : prevMode; }
    this.m = m;
    Object.assign(this, { world: m.world, net: m.net, places: m.places, content: m.content, eco: m.eco, features: m.features, veg: m.veg, env: m.env, hiker: m.hiker, tiles: m.tiles, landmarks: m.landmarks, mountain: m.meta });
    this.rig.world = m.world;
    this.hiker.stepCb = () => this.footstep();
    const s = this.places[this.content.summitPlace] || Object.values(this.places)[0];
    this.focus = { x: s.x, z: s.z, y: s.y };
    this.tiles.update(s.x, s.z, Infinity);
    return m;
  }

  start() { requestAnimationFrame(() => this.frame()); }
  frame() {
    requestAnimationFrame(() => this.frame());
    const dt = Math.min(0.1, this.clock.getDelta());
    try {
      if (!this.m || this.mode === 'loading') { /* nothing to draw yet */ }
      else if (this.mode === 'play' && this.exp && !this.exp.finished) {
        this.exp.stats.realPlay += dt;
        this.simulate(dt);
        this.renderWorld(dt);
      } else if (this.m && ['hub', 'brief', 'title', 'debrief', 'panel'].includes(this.mode)) {
        if (this.mode === 'panel' && this.exp && !this.exp.finished) this.panelTime(dt);
        this.backdrop(dt);
      }
      this.audio.update(dt, this.mode === 'play' ? this.audioCtx : null);
    } catch (e) {
      console.error(e);
      this.ui.fatal?.(e);
    }
  }
  // map/inventory open mid-expedition: the clock runs in real time and is booked as map time
  panelTime(dt) {
    const ex = this.exp;
    ex.simT += dt * 1000;
    if (this.ui.panelKind === 'map') { ex.stats.map += dt; ex.stats.realMap = (ex.stats.realMap || 0) + dt; }
    else ex.stats.deciding += dt;
  }
  backdrop(dt) {
    this.orbit += dt * 0.025;
    const f = this.focus, W = this.world, r = 2600;
    const x = f.x + Math.sin(this.orbit) * r, z = f.z + Math.cos(this.orbit) * r;
    this.camera.position.set(x, Math.max(W.height(x, z) + 150, f.y + 280), z);
    this.camera.lookAt(f.x, f.y - 60, f.z);
    this.tiles.update(f.x, f.z, 6);
    this.veg.update(f.x, f.z, 4);
    this.features.update(f.x, f.z);
    const t = this.backdropTime || (this.backdropTime = Date.UTC(2026, 11, 1, 20, 30));
    this.env.apply(t, W, { cloud: 0.25, base: 3500, precip: 0, wind: 10 }, f.x, f.y, f.z, this.m.terrainMat);
    this.hiker.group.visible = false;
    this.renderer.render(this.m.scene, this.camera);
  }
  renderWorld(dt) {
    const ex = this.exp, W = this.world;
    const { x, z } = ex.pos, y = this.groundY(x, z);
    this.hiker.group.visible = this.rig.mode !== 'photo';
    this.hiker.place(x, y, z, ex.pos.heading);
    this.rig.update(x, y, z, dt);
    this.tiles.update(x, z, 6);
    this.veg.update(x, z, 4);
    this.features.update(x, z);
    const w = this.weather.at(ex.simT);
    const { sun } = this.env.apply(ex.simT, W, w, x, y, z, this.m.terrainMat);
    this.hiker.lamp.intensity = sun.alt < -4 * DEG && ex.fx.torch && ex.supplies.torch > 0 ? 30 : 0;
    this.env.updatePrecip(this.camera, w, this.weather.tempAt(ex.simT, y), !ex.resting);
    this.renderer.render(this.m.scene, this.camera);
    this.ui.updateHud(this);
  }
  groundY(x, z) { return this.tiles.groundAt(x, z); }

  // ---- views and visibility ----
  envAt(x, z) {
    const ex = this.exp, y = this.world.height(x, z), w = this.weather.at(ex.simT);
    const zone = zoneAt(this.world, this.eco, x, z);
    const sun = sunPosition(ex.simT, ...this.world.toLatLon(x, z));
    return {
      y, zone, weather: w, temp: this.weather.tempAt(ex.simT, y), wind: w.wind * (0.55 + 0.45 * Math.min(1, Math.max(0, (y - this.content.clim.valleyY) / 900))),
      precip: w.precip, exposed: zone.alpine > 0.5 || zone.rock > 0.5 || zone.moor > 0.6, dark: sun.alt < -4 * DEG, sun, fog: w.base < y + 40, snow: !!zone.snow,
    };
  }
  inView(x, y, z, margin = 0.95) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return v.z < 1 && Math.abs(v.x) < margin && Math.abs(v.y) < margin ? v : null;
  }
  occluded(x, y, z) {
    const c = this.camera.position, d = Math.hypot(x - c.x, z - c.z), n = Math.min(60, Math.max(8, Math.round(d / 150)));
    for (let i = 1; i < n; i++) { const t = i / n; if (this.world.dem(c.x + (x - c.x) * t, c.z + (z - c.z) * t) > c.y + (y - c.y) * t + 3) return true; }
    return false;
  }
  visibleLandmarks(margin = 0.95, maxD = 9000) {
    const out = [], cp = this.camera.position;
    for (const l of this.landmarks) {
      const d = Math.hypot(l.x - cp.x, l.z - cp.z);
      if (!l.far && d > maxD) continue;
      const v = this.inView(l.x, l.y + 2, l.z, margin);
      if (v && !this.occluded(l.x, l.y + 2, l.z)) out.push({ ...l, d, v });
    }
    const w = { summit: 0, farpeak: 1, peak: 1, lake: 2, hut: 3 };
    return out.sort((a, b) => (w[a.kind] ?? 4) - (w[b.kind] ?? 4) || a.d - b.d);
  }
  // render a small picture of the terrain ahead (for decision encounters)
  snapshotAhead() {
    try {
      const ex = this.exp, h = ex.pos.heading;
      const fx = -Math.sin(h), fz = -Math.cos(h);
      const x = ex.pos.x - fx * 6, z = ex.pos.z - fz * 6, y = this.groundY(ex.pos.x, ex.pos.z) + 3.2;
      const cam = this.camera.clone();
      cam.position.set(x, Math.max(y, this.world.height(x, z) + 2), z);
      cam.lookAt(ex.pos.x + fx * 120, this.world.height(ex.pos.x + fx * 120, ex.pos.z + fz * 120) + 6, ex.pos.z + fz * 120);
      cam.aspect = 16 / 9; cam.updateProjectionMatrix();
      this.hiker.group.visible = true;
      this.renderer.render(this.m.scene, cam);
      const c = document.createElement('canvas'); c.width = 480; c.height = 270;
      const sw = this.canvas.width, sh = this.canvas.height;
      let cw = sw, ch = sw * 9 / 16; if (ch > sh) { ch = sh; cw = sh * 16 / 9; }
      c.getContext('2d').drawImage(this.canvas, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, 480, 270);
      return c.toDataURL('image/jpeg', 0.75);
    } catch { return null; }
  }
  footstep() {
    const ex = this.exp;
    if (!ex) return;
    const env = this.lastEnv;
    let s = 'grass';
    if (env?.snow) s = 'snow';
    else if (this.features.collide(ex.pos.x, ex.pos.z)) s = 'wood';
    else if (env?.zone.rock > 0.4 || this.lastVirtual) s = 'rock';
    else if (this.lastOnTrail && this.lastTrailKind === 'track') s = 'gravel';
    else if (env?.zone.moor > 0.5 || (env?.precip > 0.3)) s = 'mud';
    else if (this.lastOnTrail) s = 'gravel';
    this.audio.step(s, this.exp.pushing ? 1.2 : 1);
  }
  changed(what) { changed(what); }
}

Object.assign(Game.prototype, ExpeditionMethods);
