// Photo capture and scoring from the actual 3D view: terrain relief and depth in frame, visible landmarks,
// water, light (real sun angle), weather and composition (rule of thirds, horizon), times camera quality.
import * as THREE from 'three';
import { sunPosition } from './Weather.js';

const DEG = Math.PI / 180;

export function analyseView(game) {
  const cam = game.camera, W = game.world;
  cam.updateMatrixWorld();
  const origin = cam.position.clone();
  // cast a 9×5 grid of rays across the frame against the DEM to measure depth and relief
  const ray = new THREE.Vector3();
  let skyRays = 0, depthSum = 0, hits = 0, minHorizon = 1, maxHorizon = -1;
  const horizonByCol = [];
  for (let c = 0; c < 9; c++) {
    let colHorizon = null;
    for (let r = 0; r < 5; r++) {
      ray.set(-0.9 + c * 0.225, -0.8 + r * 0.4, 0.5).unproject(cam).sub(origin).normalize();
      let t = 5, hit = false;
      while (t < 60000) {
        const p = origin.clone().addScaledVector(ray, t);
        if (W.dem(p.x, p.z) > p.y) { hit = true; break; }
        t *= 1.12;
      }
      if (hit) { hits++; depthSum += Math.log10(t); if (colHorizon === null || r > colHorizon) colHorizon = r; }
      else skyRays++;
    }
    horizonByCol.push(colHorizon === null ? -1 : colHorizon);
  }
  const hcols = horizonByCol.filter(v => v >= 0);
  const relief = hcols.length ? Math.max(...hcols) - Math.min(...hcols) : 0;
  const skyFrac = skyRays / 45;
  const meanDepth = hits ? depthSum / hits : 0;    // log10 metres
  return { skyFrac, meanDepth, relief, horizonByCol };
}

export function scorePhoto(game, view, visible) {
  const ex = game.exp, cam = game.camera, fx = ex.fx;
  const [lat, lon] = game.world.toLatLon(ex.pos.x, ex.pos.z);
  const sun = sunPosition(ex.simT, lat, lon).alt / DEG;
  const env = game.lastEnv || game.envAt(ex.pos.x, ex.pos.z);
  const notes = [];
  // ---- scenic ----
  let scenic = 20;
  scenic += Math.min(25, Math.max(0, (view.meanDepth - 2) * 14));            // seeing far
  scenic += view.relief * 5;                                                    // an interesting skyline
  scenic += (view.skyFrac > 0.15 && view.skyFrac < 0.65) ? 10 : -8;             // sky and land both in frame
  const weights = { summit: 3, peak: 1.6, farpeak: 1.6, hut: 1, lake: 1.3, water: 0.8, viewpoint: 0.6, site: 0.5, saddle: 0.4 };
  let lm = 0;
  for (const l of visible.slice(0, 6)) lm += weights[l.kind] || 0.4;
  scenic += Math.min(22, lm * 5);
  const lakes = game.world.lakes.filter(L => game.inView((L.x0 + L.x1) / 2, L.level, (L.z0 + L.z1) / 2, 0.95) && Math.hypot((L.x0 + L.x1) / 2 - cam.position.x, (L.z0 + L.z1) / 2 - cam.position.z) < 6000).length;
  if (lakes) { scenic += Math.min(10, lakes * 5); notes.push('water in frame'); }
  const golden = sun > -3 && sun < 10;
  if (golden) { scenic += 14; notes.push('golden light'); }
  else if (sun < -6) { scenic -= fx.tripod ? 5 : 25; notes.push(fx.tripod ? 'night (tripod)' : 'too dark without a tripod'); }
  if (env.fog) { scenic -= 18; notes.push('in cloud'); }
  const seaOfCloud = env.weather.base < env.y - 150 && env.weather.cloud > 0.6;
  if (seaOfCloud) { scenic += 15; notes.push('above the clouds'); }
  if (env.precip > 0.05 && !env.fog) scenic -= 6;
  scenic = clamp(scenic);
  // ---- composition ----
  let comp = 45;
  const subject = visible[0];
  if (subject) {
    const thirds = [[-1 / 3, -1 / 3], [1 / 3, -1 / 3], [-1 / 3, 1 / 3], [1 / 3, 1 / 3]];
    const d = Math.min(...thirds.map(([x, y]) => Math.hypot(subject.v.x - x, subject.v.y - y)));
    comp += 30 * (1 - Math.min(1, d / 0.5));
    if (Math.abs(subject.v.x) < 0.12 && Math.abs(subject.v.y) < 0.12) comp += 8;   // a bold centred subject also works
  } else comp -= 15;
  const pitch = Math.asin(cam.getWorldDirection(new THREE.Vector3()).y) / DEG;
  if (pitch < -35 || pitch > 35) { comp -= 25; notes.push('awkward angle'); }
  if (view.skyFrac < 0.05) comp -= 10;
  if (game.rig.fov < 30 && subject && subject.d > 2500) { comp += 8; notes.push('telephoto'); }
  comp = clamp(comp);
  // ---- rarity ----
  const m = game.mountain;
  let rarity = 10 + m.difficulty * 7;
  const atSummit = ex.atPlace === game.content.summitPlace && game.content.summitPlace;
  if (atSummit) { rarity += 25; notes.push('summit'); }
  if (golden) rarity += 10;
  if (seaOfCloud) rarity += 20;
  if (env.precip > 0.05 && env.temp < 0.8) { rarity += 12; notes.push('falling snow'); }
  if (ex.scenario === 'winter') rarity += 10;
  rarity = clamp(rarity);
  const raw = scenic * 0.45 + comp * 0.35 + rarity * 0.2;
  const score = Math.round(clamp(raw * (0.75 + 0.25 * (fx.camera || 0.8) / 1) * (fx.camera >= 1.2 ? 1.06 : 1)));
  const label = rarity > 75 ? 'Legendary' : rarity > 55 ? 'Rare' : rarity > 35 ? 'Uncommon' : 'Common';
  return { score, scenic: Math.round(scenic), composition: Math.round(comp), rarity: Math.round(rarity), rarityLabel: label, notes, summit: !!atSummit, subject: subject?.name || null };
}

export function captureThumb(renderer, canvas, w = 480, h = 270) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const sw = canvas.width, sh = canvas.height, ar = w / h;
  let cw = sw, ch = sw / ar; if (ch > sh) { ch = sh; cw = sh * ar; }
  g.drawImage(canvas, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, w, h);
  return c.toDataURL('image/jpeg', 0.8);
}

function clamp(v) { return Math.max(0, Math.min(100, v)); }
