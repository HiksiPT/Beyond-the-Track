// In-expedition HUD: minimal panels around the edges so the landscape dominates.
import { fmtClock, compassName, fmtDur } from '../systems/Weather.js';
import { indicators, WARN } from '../systems/SurvivalSystem.js';
import { liveWeight } from '../systems/InventorySystem.js';

const DEG = Math.PI / 180;
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const ICONS = {
  energy: '<svg viewBox="0 0 16 16"><path d="M9 1 3 9h4l-1 6 6-8H8z" fill="#f0c86a"/></svg>',
  hydration: '<svg viewBox="0 0 16 16"><path d="M8 1C5 6 3.5 8.5 3.5 10.5a4.5 4.5 0 0 0 9 0C12.5 8.5 11 6 8 1z" fill="#7fb4d6"/></svg>',
  hunger: '<svg viewBox="0 0 16 16"><path d="M4 1v6a2 2 0 0 0 1.5 1.9V15h1V8.9A2 2 0 0 0 8 7V1H7v5H6V1H5v5H4zm7 0c-1.5 1-2 3-2 5s1 2.5 1.5 3V15h1V1z" fill="#d9a77a"/></svg>',
  warmth: '<svg viewBox="0 0 16 16"><path d="M7 2a2 2 0 0 1 4 0v7.3a3.5 3.5 0 1 1-4 0zM8.5 3v7.2a2 2 0 1 0 1 0V3z" fill="#f07a65"/></svg>',
  equipment: '<svg viewBox="0 0 16 16"><path d="M3 5h10l-1 9H4zM6 5V3h4v2" stroke="#b9c7b0" stroke-width="1.5" fill="none"/></svg>',
};
const LABELS = { energy: 'Energy', hydration: 'Hydration', hunger: 'Hunger', warmth: 'Warmth', equipment: 'Equipment' };

export function buildHud(ui, game) {
  const hud = $('#hud');
  hud.innerHTML = `
    <div class="hud-top">
      <div class="clock glass"><div class="t" id="h-time">--:--</div><div class="s"><span id="h-day">Day 1</span> · <span id="h-sun"></span></div><div class="s" id="h-weather"></div></div>
      <div class="compass glass"><div class="strip" id="h-strip"></div><div class="tick"></div></div>
      <div class="where glass"><div class="p" id="h-place">—</div><div class="s mono dim" style="font-size:11.5px"><span id="h-ele"></span> · <span id="h-terrain"></span></div></div>
    </div>
    <div class="route-strip glass" id="h-route"></div>
    <div class="controls-help glass" id="h-help" hidden>WASD move · mouse look · <b>Shift</b> hurry<br>F follow track · R rest/camp · E interact/water<br>I inventory · M map · P camera · J notes<br>V pace · L labels · H hide help · Esc pause</div>
    <div class="hud-bottom">
      <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
        <div class="vitals glass" id="h-vitals" role="group" aria-label="Survival indicators"></div>
        <div class="packinfo glass" id="h-pack"></div>
      </div>
      <div class="actions glass" id="h-actions"></div>
    </div>`;
  const b = (id, label, key) => `<button data-a="${id}" title="${label} (${key})">${label} <kbd>${key}</kbd></button>`;
  $('#h-actions').innerHTML = [b('follow', 'Follow track', 'F'), b('rest', 'Rest', 'R'), b('interact', 'Interact', 'E'), b('inv', 'Pack', 'I'), b('map', 'Map', 'M'), b('photo', 'Camera', 'P'), b('notes', 'Notes', 'J'), b('pace', 'Pace', 'V'), b('help', '?', 'H'), b('pause', 'Pause', 'Esc')].join('');
  $('#h-actions').onclick = (e) => {
    const id = e.target.closest('button')?.dataset.a; if (!id) return;
    game.audio.click();
    ({ follow: () => game.toggleFollow(), rest: () => ui.restMenu(), interact: () => ui.interact(), inv: () => ui.openPanel('inventory'), map: () => ui.openPanel('map'), photo: () => game.enterPhoto(),
      notes: () => ui.openPanel('notes'), pace: () => ui.cyclePace(), help: () => { $('#h-help').hidden = !$('#h-help').hidden; }, pause: () => ui.openPanel('pause') })[id]();
  };
  if (!game.profile.mentor.seen.helpShown) { $('#h-help').hidden = false; game.profile.mentor.seen.helpShown = true; }
}

let hudT = 0, labelT = 0;
export function updateHud(ui, game) {
  const now = performance.now();
  if (now - labelT > 220) { labelT = now; updateLabels(game); }
  updateCompass(game);
  if (now - hudT < 160) return;
  hudT = now;
  const ex = game.exp, W = game.world;
  const { x, z } = ex.pos, env = game.lastEnv || game.envAt(x, z);
  const startDay = new Date(ex.startUtc + ex.tz * 3600000); startDay.setUTCHours(0, 0, 0, 0);
  const day = Math.floor((ex.simT + ex.tz * 3600000 - startDay.getTime()) / 86400000) + 1;
  $('#h-time').textContent = fmtClock(ex.simT, ex.tz);
  const st = game.route()?.stages;
  $('#h-day').textContent = `Day ${day}${st ? ` · stage ${Math.min(st.length, ex.stage + 1)}/${st.length}` : ''}${ex.resting ? ' · ' + ex.resting.label : ''}`;
  const alt = env.sun.alt / DEG;
  $('#h-sun').textContent = alt > 0 ? `sun ${Math.round(alt)}° ${compassName(env.sun.az / DEG)}` : alt > -6 ? 'twilight' : 'night';
  $('#h-weather').textContent = `${Math.round(env.temp)} °C · wind ${Math.round(env.wind)} km/h${env.exposed ? ' exposed' : ''} · ${env.fog ? 'in cloud' : game.weather.describe(env.weather, env.temp)}`;
  const tr = game.features.index.nearest(x, z, 15);
  const e = tr.d < 6 ? game.net.edges[tr.ref] : null;
  const trailName = e ? (e.virtual ? 'off-track scramble' : e.name || (e.kind === 'track' ? 'vehicle track' : 'walking track')) : null;
  let nearName = null, nd = 1e9;
  for (const l of game.landmarks) { if (l.far) continue; const d = Math.hypot(l.x - x, l.z - z); if (d < nd) { nd = d; nearName = l.name; } }
  $('#h-place').textContent = ex.atPlace ? game.places[ex.atPlace].name : nd < 350 ? `near ${nearName}` : trailName || 'off-track';
  const zn = env.zone;
  const terr = zn.lake ? 'lake shore' : zn.snow ? 'snow' : zn.rock > 0.5 ? 'rock' : zn.moor > 0.5 ? 'button-grass moor' : zn.forest > 0.5 ? (game.eco.palette.startsWith('tas') ? 'rainforest' : 'tall forest') : zn.alpine > 0.5 ? 'alpine heath' : 'snow gum woodland';
  $('#h-ele').textContent = `${Math.round(game.groundY(x, z))} m`;
  $('#h-terrain').textContent = `${terr}${trailName ? ' · ' + trailName : ''}`;
  // vitals
  const ind = indicators(ex);
  let html = '';
  for (const k of ['energy', 'hydration', 'hunger', 'warmth', 'equipment']) {
    const v = ind[k], good = k === 'hunger' ? 100 - v : v;
    const cls = k === 'hunger' ? (v > 85 ? 'bad' : v > WARN.hunger ? 'warn' : '') : (v < WARN[k] * 0.55 ? 'bad' : v < WARN[k] ? 'warn' : '');
    html += `<span title="${LABELS[k]}">${ICONS[k]}</span><div class="bar" title="${LABELS[k]} ${Math.round(v)}"><i class="${cls}" style="width:${Math.max(2, good)}%"></i></div><span class="v">${Math.round(v)}</span>`;
  }
  const tags = [];
  if (ex.body.injury > 0.05) tags.push('<span class="bad">injured</span>');
  if (ex.body.wet > 0.3) tags.push('<span class="warn">wet</span>');
  if (ex.body.blister > 0.3) tags.push('<span class="warn">blister</span>');
  if (ex.flags.gutBug && ex.simT - ex.flags.gutBug < 12 * 3600000) tags.push('<span class="warn">upset stomach</span>');
  html += `<span class="lab">${tags.length ? tags.join(' · ') : 'hunger rises as you burn energy'}</span>`;
  $('#h-vitals').innerHTML = html;
  const pace = game.lastPace;
  $('#h-pack').innerHTML = `Water <b>${ex.supplies.water.toFixed(1)}</b>/${ex.supplies.waterCap} L · Food <b>${Math.round((ex.foodKcal || 0) / 100) / 10}k</b> kcal<br>Pack <b>${liveWeight(ex).toFixed(1)}</b>/${ex.fx.capacityKg} kg · ${ex.pace}${ex.pushing ? ' (hurrying)' : ''}<br>${pace && game.lastMoving ? `<b>${pace.kmh.toFixed(1)}</b> km/h` : 'stopped'}${pace && game.lastMoving && pace.why.length ? ' · ' + esc(pace.why.slice(0, 2).join(', ')) : ''}`;
  const fb = document.querySelector('#h-actions [data-a=follow]'); if (fb) fb.classList.toggle('on', !!ex.follow.active);
  const tid = game.currentTarget(), rs = $('#h-route');
  if (tid) {
    const rem = game.remainingEstimate();
    rs.innerHTML = `Next: <b>${esc(game.placeName(tid))}</b><br>${rem.km.toFixed(1)} km · ~${fmtDur(rem.hours * 3600)}${ex.detour ? ' · detour' : ''}<br>${ex.targets.length} waypoint${ex.targets.length === 1 ? '' : 's'} left${ex.summit ? ' · objective reached' : ''}${ex.follow.active ? '' : ' · <kbd>F</kbd> follow'}`;
  } else rs.innerHTML = `No destination · <kbd>M</kbd> map${ex.summit ? '<br>Head for a trailhead to finish' : ''}`;
}

function updateCompass(game) {
  const strip = $('#h-strip'); if (!strip) return;
  const yaw = game.rig.mode === 'photo' ? game.rig.pyaw : game.rig.yaw;
  const heading = (((Math.atan2(-Math.sin(yaw), Math.cos(yaw)) / DEG) % 360) + 360) % 360;
  const items = [], ppd = 3.2;
  const put = (bearing, html, cls) => { const d = ((bearing - heading + 540) % 360) - 180; if (Math.abs(d) <= 60) items.push(`<span class="${cls}" style="left:${d * ppd}px">${html}</span>`); };
  for (let b = 0; b < 360; b += 15) put(b, b % 90 === 0 ? 'NESW'[b / 90] : b % 45 === 0 ? ['NE', 'SE', 'SW', 'NW'][(b - 45) / 90] : '·', b % 45 === 0 ? 'cp' : '');
  const { x, z } = game.exp.pos;
  // the most important landmarks first; skip any label that would overlap one already placed
  const cand = [];
  for (const l of game.landmarks) {
    if (!['peak', 'hut', 'farpeak', 'summit'].includes(l.kind)) continue;
    const d = Math.hypot(l.x - x, l.z - z); if (d < 40 || (!l.far && d > 6000)) continue;
    const pri = l.kind === 'summit' ? 0 : l.kind === 'farpeak' ? 1 : l.kind === 'peak' ? 2 + d / 6000 : 3 + d / 3000;
    cand.push({ l, pri, b: ((Math.atan2(l.x - x, -(l.z - z)) / DEG) + 360) % 360 });
  }
  cand.sort((a, b) => a.pri - b.pri);
  const used = [];
  for (const c of cand) {
    const off = ((c.b - heading + 540) % 360) - 180;
    if (Math.abs(off) > 60 || used.some(u => Math.abs(u - off) < 22)) continue;
    used.push(off);
    put(c.b, esc(c.l.name.replace('Mount ', 'Mt ')), 'poi');
    if (used.length >= 7) break;
  }
  const tid = game.currentTarget(), p = tid && game.places[tid];
  if (p) put(((Math.atan2(p.x - x, -(p.z - z)) / DEG) + 360) % 360, '▼', 'dest');
  strip.innerHTML = items.join('');
}
function updateLabels(game) {
  const box = $('#labels');
  if (!game.profile.settings.labels || game.mode !== 'play' || game.rig.mode === 'photo') { box.innerHTML = ''; return; }
  const vis = game.visibleLandmarks(1.0).filter(l => l.far || l.d < (l.kind === 'peak' || l.kind === 'summit' ? 7000 : 2500)).slice(0, 14);
  const W = innerWidth, H = innerHeight;
  box.innerHTML = vis.map(l => `<div class="wlabel" style="left:${(l.v.x * 0.5 + 0.5) * W}px;top:${(-l.v.y * 0.5 + 0.5) * H}px">${esc(l.name)}<small>${l.ele ? Math.round(+l.ele) + ' m · ' : ''}${(l.d / 1000).toFixed(1)} km</small></div>`).join('');
}
