// UI facade used by the game core, plus modals and the in-expedition panels.
import { buildHud, updateHud } from './HUD.js';
import { radio, showDialogue, dialogueOpen, advanceDialogue, PORTRAIT } from './Dialogue.js';
import { TopoMap } from './MapInterface.js';
import * as Menus from './Menus.js';
import { fmtClock, fmtDur } from '../systems/Weather.js';
import { eatPortion, foodLeftKcal, indicators } from '../systems/SurvivalSystem.js';
import { PORTIONS, portionKcal, liveWeight, carriedDurables } from '../systems/InventorySystem.js';
import { ITEMS, SUPPLIES } from '../data/Items.js';

const $ = (s) => document.querySelector(s);
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const km = (m) => (m / 1000).toFixed(1) + ' km';

export class UI {
  constructor() { this.modal = null; this.panelKind = null; this.game = null; }
  attach(game) { this.game = game; this.bindKeys(); }

  // ---------- generic modal ----------
  modalOpen() { return !!this.modal || dialogueOpen(); }
  modalCountsAsDecision() { return this.modal?.decision !== false; }
  showModal({ kind, title, text = '', html = '', view = null, resources = null, choices, decision = true, fiction = false }) {
    const m = $('#modal');
    this.modal = { decision };
    m.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="mt">${view ? `<img class="view" src="${view}" alt="The terrain ahead">` : ''}<div class="inner">
      <div class="kind">${esc(kind)}</div><h3 id="mt">${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}${html}${resources ? `<div class="res">${esc(resources)}</div>` : ''}
      <div class="choices">${choices.map((c, i) => `<button class="choice" data-i="${i}" ${c.disabled ? 'disabled' : ''}><b>${i + 1}. ${esc(c.label)}</b>${c.sub ? `<span>${c.sub}</span>` : ''}${c.stats ? `<div class="mono dim" style="font-size:12px;margin-top:3px">${c.stats}</div>` : ''}</button>`).join('')}</div>
      ${fiction ? '<div class="fictional">Simulated situation for gameplay — not real-world route advice.</div>' : ''}</div></div>`;
    m.hidden = false;
    this.modalChoices = choices;
    m.querySelectorAll('.choice').forEach(btn => btn.onclick = () => this.pick(+btn.dataset.i));
    m.querySelector('.choice:not([disabled])')?.focus();
  }
  pick(i) {
    const c = this.modalChoices?.[i];
    if (!c || c.disabled) return;
    this.game?.audio.click();
    this.closeModal();
    c.onPick?.();
  }
  closeModal() { $('#modal').hidden = true; this.modal = null; this.modalChoices = null; }

  // ---------- messages ----------
  toast(msg, ms = 4200) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(this.tt); this.tt = setTimeout(() => t.hidden = true, ms); }
  caption(text) { const c = $('#caption'); c.textContent = text; c.hidden = false; clearTimeout(this.ct); this.ct = setTimeout(() => c.hidden = true, 3500); }
  flashSaved() { const el = $('#h-time'); if (el) { el.style.color = 'var(--ok)'; setTimeout(() => el.style.color = '', 600); } }
  mentorRadio(text, ms) { radio(text, ms); }
  warn(kind) { this.game.audio.tone(330, 0.25, 0.06, 'square'); }
  fatal(e) {
    if (this.fatalShown) return; this.fatalShown = true;
    const d = document.createElement('div'); d.className = 'fatal';
    d.innerHTML = `<div class="card"><h3>Something went wrong</h3><p>The game hit an unexpected error. Your progress up to the last autosave is safe.</p><pre>${esc(e?.stack || e)}</pre><button class="btn primary" onclick="location.reload()">Reload</button></div>`;
    document.body.appendChild(d);
  }

  // ---------- HUD ----------
  showHud() { for (const s of document.querySelectorAll('.screen')) s.hidden = true; $('#hud').hidden = false; buildHud(this, this.game); Menus.showTouch(this.game, true); }
  hideHud() { $('#hud').hidden = true; $('#labels').innerHTML = ''; Menus.showTouch(this.game, false); }
  updateHud(game) { updateHud(this, game); }
  cyclePace() { const ex = this.game.exp, o = ['relaxed', 'steady', 'push']; ex.pace = o[(o.indexOf(ex.pace) + 1) % 3]; this.toast(`Pace: ${ex.pace}`); }

  // ---------- encounters ----------
  encounter({ kind, title, text, view, resources, choices, fiction }) { this.showModal({ kind, title, text, view, resources, choices, fiction }); }
  outcome({ title, text, factors, damaged, minutes, good, onClose }) {
    const tone = good === true ? 'ok' : good === false ? 'bad' : 'warn';
    this.showModal({ kind: good === true ? 'Outcome' : good === false ? 'Consequence' : 'Outcome', title, decision: false,
      html: `<p>${esc(text)}</p>${factors.length ? `<ul class="factors">${factors.map(f => `<li class="${f.startsWith('+') ? 'ok' : 'bad'}">${esc(f)}</li>`).join('')}</ul>` : ''}${damaged.length ? `<p class="warn">Damaged: ${esc(damaged.join(', '))}</p>` : ''}${minutes ? `<p class="dim mono" style="font-size:12px">${minutes} min passed</p>` : ''}<div class="${tone}" style="height:3px;background:currentColor;border-radius:2px;margin-top:6px"></div>`,
      choices: [{ label: 'Continue', onPick: onClose }] });
  }
  junction(node) {
    const g = this.game, ex = g.exp;
    const plannedNext = g.legs?.[g.legIndex]?.edge, cameFrom = g.legs?.[g.legIndex - 1]?.edge;
    const pois = Object.values(g.places).map(p => ({ name: p.name, x: p.x, z: p.z, r: (p.r || 60) + 20 }));
    const st = (la) => `${km(la.len)} · ↑${Math.round(la.up)} ↓${Math.round(la.down)} m · ~${fmtDur(la.sec / 0.85)}`;
    const opts = [];
    if (plannedNext) {
      const la = g.net.lookahead(node.id, plannedNext, pois);
      opts.push({ label: `Continue to ${g.placeName(g.currentTarget())}`, sub: `${esc(plannedNext.name || 'unnamed track')} — your planned route`, stats: st(la), onPick: () => { g.logDecision('Junction', `Continued on ${plannedNext.name || 'the planned track'}`); ex.follow.active = true; } });
    }
    for (const e of node.edges) {
      if (e === plannedNext || e === cameFrom || e.len < 25) continue;
      const la = g.net.lookahead(node.id, e, pois);
      const where = la.passes.length ? la.passes.slice(0, 2).join(', ') : `${km(la.len)} to the next junction`;
      opts.push({ label: `Take ${e.virtual ? 'the off-track route' : e.name || (e.kind === 'track' ? 'the vehicle track' : 'the unnamed path')}`, sub: `Towards ${esc(where)}`, stats: st(la), onPick: () => g.setDetour('node:' + la.end, `${e.name || 'side track'} → ${where}`) });
    }
    opts.push({ label: 'Check the map first', sub: 'Open the map (time passes while you study it)', onPick: () => { this.openPanel('map'); } });
    opts.push({ label: 'Turn back', sub: 'Head for the nearest trailhead', onPick: () => g.turnBack() });
    const names = [...new Set(node.edges.map(e => e.name).filter(Boolean))];
    this.showModal({ kind: 'Junction', title: names.length ? names.join(' · ') : 'Track junction', text: 'The tracks divide here. Distances and climbs are measured from the real terrain.', choices: opts.slice(0, 6) });
  }
  restMenu() {
    const g = this.game, ex = g.exp, camp = g.canCamp();
    const env = g.lastEnv || g.envAt(ex.pos.x, ex.pos.z);
    const rise = g.nextSunrise(), sleepSec = Math.max(6 * 3600, (rise - 30 * 60000 - ex.simT) / 1000);
    const hot = ex.fx.stove && ex.supplies.fuel >= 25 && ex.supplies.food.meal > 0;
    const choices = [
      { label: 'Short break — 15 min', sub: 'Drink, snack, ease the legs', onPick: () => { g.eatBest(); g.startRest('rest', 900, 'Short break'); } },
      { label: 'Long rest — 1 hour', sub: 'Proper food and a real recovery', onPick: () => { g.eatBest(); g.eatBest(); g.startRest('rest', 3600, 'Long rest'); } },
      { label: 'Cook a hot meal — 40 min', sub: hot ? 'Warmth, energy, morale (uses fuel and a dinner)' : 'Needs the stove, fuel and a freeze-dried dinner', disabled: !hot, onPick: () => { eatPortion(ex, 'meal'); g.startRest('rest', 2400, 'Hot meal'); } },
    ];
    if (camp) choices.push({ label: `Camp at ${camp.name} until dawn`, sub: `About ${fmtDur(sleepSec)} · ${ex.fx.tent ? 'tent' : camp.hut ? 'inside the hut' : 'no tent — cold'} · ${ex.fx.sleepWarm ? 'sleeping bag' : 'no sleeping bag!'}`,
      onPick: () => { if (hot && ex.body.hunger > 40) eatPortion(ex, 'meal'); g.startRest('sleep', sleepSec, `Camp at ${camp.name}`, { at: camp.id, tent: !!ex.fx.tent, hut: !!camp.hut, stoveWarm: hot, cold: !ex.fx.sleepWarm }); g.features.tent(ex.pos.x + 4, ex.pos.z + 3); } });
    else choices.push({ label: 'Emergency bivouac here', sub: `Not a camping area. Cold, poor sleep${env.exposed ? ', exposed to wind' : ''}${ex.fx.bivvy ? ' · bivvy bag helps' : ''}`,
      onPick: () => { ex.flags.bivvy = (ex.flags.bivvy || 0) + 1; ex.bonusRep = (ex.bonusRep || 0) - 1; g.startRest('sleep', sleepSec, 'Emergency bivouac', { at: null, tent: !!ex.fx.tent && !env.exposed, hut: false, bivvy: !!ex.fx.bivvy, cold: !ex.fx.sleepWarm }); } });
    choices.push({ label: 'Back on your feet', onPick: () => {} });
    this.showModal({ kind: 'Rest', title: camp ? camp.name : 'Take a break', text: `${fmtClock(ex.simT, ex.tz)} now · sunrise ${fmtClock(rise, ex.tz)}. ${camp ? 'Camping is allowed here.' : ''}`, choices, resources: g.resourceLine() });
  }
  interact() {
    const g = this.game, ex = g.exp, src = g.waterSourceNear();
    const p = ex.atPlace && g.places[ex.atPlace];
    if (p && g.canFinishAt(p)) return this.finishPrompt(p);
    if (src) return this.refill(src);
    const lm = p && g.content.landmarks.find(l => l.at === p.id);
    if (lm) return this.showModal({ kind: 'Landmark', title: lm.title, decision: false, html: `<p>${esc(lm.real || '')}</p><p class="fictional">Field note — general real-world context, not authoritative.</p>`, choices: [{ label: 'Close' }] });
    if (ex.supplies.cached && Math.hypot(ex.supplies.cached.at.x - ex.pos.x, ex.supplies.cached.at.z - ex.pos.z) < 40) {
      for (const [id, n] of Object.entries(ex.supplies.cached.food)) ex.supplies.food[id] = (ex.supplies.food[id] || 0) + n;
      ex.supplies.cached = null; return this.toast('You collect your food cache.');
    }
    this.toast('Nothing to interact with here. Water sources, huts and landmarks respond to E.');
  }
  refill(src) {
    const g = this.game, ex = g.exp, choices = [];
    if (src.kind === 'creek' || src.kind === 'lake') {
      choices.push({ label: 'Filter and fill', sub: 'Safe', disabled: !ex.fx.filter, onPick: () => g.doRefill(src, true) });
      choices.push({ label: 'Fill untreated', sub: 'Faster — small chance of an upset stomach (simulated)', onPick: () => g.doRefill(src, false) });
    } else if (src.kind === 'snow') choices.push({ label: 'Melt snow on the stove', sub: '~15 min and some fuel', onPick: () => g.doRefill(src, true) });
    else if (src.limit !== undefined) choices.push({ label: src.limit > 50 ? 'Fill everything' : src.limit > 0 ? `Take up to ${src.limit} L` : 'Leave the tank (use the spring)', onPick: () => g.doRefill(src, true) });
    else choices.push({ label: 'Fill bottles', onPick: () => g.doRefill(src, true) });
    choices.push({ label: 'Not now' });
    this.showModal({ kind: 'Water', title: src.name, text: `Carrying ${ex.supplies.water.toFixed(1)} of ${ex.supplies.waterCap} L.`, choices });
  }
  finishPrompt(place) {
    const g = this.game, ex = g.exp;
    this.showModal({ kind: 'Trailhead', title: place.name, text: ex.summit ? 'The objective is behind you and the car park is in front.' : 'You are at a trailhead and can end the expedition here.',
      choices: [{ label: ex.summit ? 'Finish the expedition' : 'End the expedition here (retreat)', sub: place.remote ? 'A remote exit — a pick-up is arranged' : '', onPick: () => g.finishExpedition(ex.summit ? 'complete' : 'retreat', place) }, { label: 'Keep exploring' }] });
  }
  stageComplete(stage, next) {
    this.game.audio.sting('summit');
    this.showModal({ kind: 'Stage complete', title: stage.name, decision: false, text: next ? `Next: ${next.name}. Progress is saved — you can stop here and resume later.` : 'Final stage complete.',
      choices: [{ label: 'Continue' }, { label: 'Save and return to the hub', onPick: () => this.leaveToHub() }] });
  }
  photoMode(on) { $('#photo-frame').hidden = !on; $('#hud').style.opacity = on ? '0.25' : ''; if (on) $('#pf-zoom').textContent = ''; }
  photoTaken(photo, img) {
    const f = $('.pf-flash'); f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 60);
    this.toast(`${photo.rarityLabel} photo · score ${photo.score} (scenic ${photo.scenic}, composition ${photo.composition}, rarity ${photo.rarity})${photo.notes.length ? ' · ' + photo.notes.slice(0, 3).join(', ') : ''}`, 5200);
  }

  // ---------- panels during an expedition (time keeps running: map time / decision time) ----------
  openPanel(kind) {
    const g = this.game;
    if (g.rig.mode === 'photo') g.exitPhoto();
    this.panelKind = kind; g.mode = 'panel';
    const scr = $('#screen-panel'); scr.hidden = false;
    const tabs = [['inventory', 'Pack'], ['map', 'Map'], ['notes', 'Notes'], ['pause', 'Pause']];
    scr.innerHTML = `<div class="wrap"><div class="topbar"><div><p class="eyebrow">${esc(g.mountain.name)} · ${fmtClock(g.exp.simT, g.exp.tz)} · the clock is running</p><h2>${tabs.find(t => t[0] === kind)?.[1]}</h2></div>
      <div class="chips">${tabs.map(([k, l]) => `<button class="btn small ${k === kind ? 'primary' : ''}" data-tab="${k}">${l}</button>`).join('')}<button class="btn small" id="pn-close">Back to the trail <kbd>Esc</kbd></button></div></div><div id="pn-body"></div></div>`;
    scr.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => this.openPanel(b.dataset.tab));
    $('#pn-close').onclick = () => this.closePanel();
    ({ inventory: () => this.panelInventory(), map: () => this.panelMap(), notes: () => this.panelNotes(), pause: () => this.panelPause() })[kind]();
  }
  closePanel() { this.map?.destroy(); this.map = null; $('#screen-panel').hidden = true; this.panelKind = null; if (this.game.exp && !this.game.exp.finished) { this.game.mode = 'play'; this.game.clock.getDelta(); } }
  panelInventory() {
    const g = this.game, ex = g.exp, body = $('#pn-body');
    const ind = indicators(ex);
    const food = Object.entries(ex.supplies.food).filter(([, n]) => n > 0);
    body.innerHTML = `<div class="grid2"><div class="card"><h3>Food and water</h3>
      <table class="items">${food.map(([id, n]) => `<tr><td>${esc(SUPPLIES[id].name)}<div class="desc">${n} portion${n === 1 ? '' : 's'} · ${Math.round(portionKcal(id))} kcal each${SUPPLIES[id].hot ? ' · hot meal (stove)' : ''}</div></td><td class="num"><button class="btn small" data-eat="${id}">Eat</button></td></tr>`).join('') || '<tr><td>No food left.</td></tr>'}
      <tr><td>Water<div class="desc">${ex.supplies.water.toFixed(2)} of ${ex.supplies.waterCap} L${g.profile.settings.autoSip ? ' · sipping automatically' : ''}</div></td><td class="num"><button class="btn small" id="inv-drink" ${ex.supplies.water < 0.2 ? 'disabled' : ''}>Drink 0.3 L</button></td></tr></table>
      <dl class="kv" style="margin-top:12px"><dt>Energy</dt><dd>${Math.round(ind.energy)}</dd><dt>Hydration</dt><dd>${Math.round(ind.hydration)}</dd><dt>Hunger</dt><dd>${Math.round(ind.hunger)}</dd><dt>Warmth</dt><dd>${Math.round(ind.warmth)}${ex.body.wet > 0.3 ? ' (wet)' : ''}</dd><dt>Injury</dt><dd>${Math.round(ex.body.injury * 100)}%</dd></dl></div>
      <div class="card"><h3>Equipment</h3><table class="items">${Object.keys(ex.pack.items).map(id => { const it = ITEMS[id]; const c = ex.condition[id]; return `<tr><td>${esc(it.name)}${ex.pack.items[id] > 1 ? ' ×' + ex.pack.items[id] : ''}<div class="fx">${esc(it.effect)}</div></td><td class="num">${c !== undefined ? `<span class="cond"><i style="width:${c}%;background:${c < 30 ? 'var(--bad)' : c < 60 ? 'var(--warn)' : 'var(--ok)'}"></i></span> ${Math.round(c)}%` : ''}</td></tr>`; }).join('')}</table>
      <p class="fine">Pack ${liveWeight(ex).toFixed(1)} of ${ex.fx.capacityKg} kg · first aid ${ex.supplies.firstaid} · repair kit ${ex.supplies.repair} · fuel ${Math.round(ex.supplies.fuel)} g · head torch ${ex.supplies.torch.toFixed(1)} h</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn small" id="inv-repair" ${ex.supplies.repair > 0 ? '' : 'disabled'}>Use repair kit on worst item</button><button class="btn small" id="inv-aid" ${ex.supplies.firstaid > 0 && (ex.body.injury > 0.05 || ex.body.blister > 0.2) ? '' : 'disabled'}>Treat injury / blister</button></div></div></div>`;
    body.querySelectorAll('[data-eat]').forEach(b => b.onclick = () => { const r = eatPortion(ex, b.dataset.eat); this.toast(r.ok ? `Ate ${SUPPLIES[b.dataset.eat].name} (${Math.round(r.kcal)} kcal)` : r.why); this.panelInventory(); });
    $('#inv-drink').onclick = () => { const d = Math.min(0.3, ex.supplies.water); ex.supplies.water -= d; ex.body.hydration = Math.min(100, ex.body.hydration + d / 2.6 * 100); this.panelInventory(); };
    $('#inv-repair').onclick = () => { ex.supplies.repair--; g.repairWeakest(30); g.passTime(900, 'rest'); this.toast('Repaired.'); this.panelInventory(); };
    $('#inv-aid').onclick = () => { ex.supplies.firstaid--; ex.body.injury = Math.max(0, ex.body.injury - 0.2); ex.body.blister = Math.min(ex.body.blister, 0.05); g.passTime(600, 'rest'); this.toast('Treated.'); this.panelInventory(); };
  }
  panelMap() {
    const g = this.game, ex = g.exp, body = $('#pn-body');
    body.innerHTML = `<div id="mp"></div><p class="fine">Time passes in real time while you study the map (booked as map time). Click a place to detour or change the plan. Terrain © Commonwealth of Australia (Geoscience Australia), CC BY 4.0 · tracks and places © OpenStreetMap contributors.</p>`;
    this.map = new TopoMap($('#mp'), g, { onPick: (hit) => this.mapPick(hit) });
    const ids = [g.currentTarget(), ...ex.targets.slice(ex.detour ? 0 : 1)].filter(Boolean);
    let from = g.net.nearestNode(ex.pos.x, ex.pos.z).id; const pts = [];
    for (const id of ids) { const to = g.placeNode(id), legs = g.net.route(from, to); if (!legs) continue; pts.push(...g.net.legsPolyline(legs)); from = to; }
    this.map.setRoute(pts.length > 1 ? pts : null);
    setTimeout(() => this.map?.centreOn(ex.pos.x, ex.pos.z, 2.2), 30);
  }
  mapPick(hit) {
    const g = this.game, ex = g.exp;
    const tid = hit.id || ('node:' + g.net.nearestNode(hit.landmark.x, hit.landmark.z).id);
    const here = g.net.nearestNode(ex.pos.x, ex.pos.z), legs = g.net.route(here.id, g.placeNode(tid));
    const s = legs ? g.net.stats(g.net.legsPolyline(legs)) : null;
    this.showModal({ kind: 'Map', title: hit.name, text: s ? `By track: ${km(s.len)}, ↑${Math.round(s.up)} m ↓${Math.round(s.down)} m, about ${fmtDur(g.net.legsSeconds(legs) / 0.85)} with a pack.` : 'No mapped track leads there.',
      choices: [
        { label: 'Detour there, then resume the plan', disabled: !legs, onPick: () => { this.closePanel(); g.setDetour(tid, hit.name); } },
        { label: 'Make it the new end of the expedition', disabled: !legs, onPick: () => { ex.targets = [tid]; ex.detour = null; g.logDecision('Plan changed', `Head for ${hit.name}`); this.closePanel(); g.startFollow(); } },
        { label: 'Cancel' },
      ] });
  }
  panelNotes() {
    const g = this.game, ex = g.exp, C = g.content, body = $('#pn-body');
    const lms = C.landmarks.filter(l => ex.discovered.includes(l.id));
    body.innerHTML = `<div class="grid2"><div class="card"><h3>Objectives</h3><ul>${[{ title: (C.objectivePlace ? 'Complete the traverse' : 'Reach the summit'), done: ex.summit }, ...(C.objectives || []).map(o => ({ title: o.title + (o.kind === 'photo' ? ` (score ${o.minScore}+)` : ''), done: ex.objectives[o.id] }))].map(o => `<li class="${o.done ? 'ok' : ''}">${o.done ? '✔' : '○'} ${esc(o.title)}</li>`).join('')}</ul>
      <h3 style="margin-top:14px">Decisions</h3><ol class="fine" style="font-size:13px">${ex.decisions.slice(-20).map(d => `<li>${fmtClock(d.simT, ex.tz)} — ${esc(d.title)}: ${esc(d.choice)}${d.outcome ? ` <span class="${d.good ? 'ok' : d.good === false ? 'bad' : 'dim'}">(${esc(d.outcome)})</span>` : ''}</li>`).join('') || '<li>None yet</li>'}</ol></div>
      <div class="card"><h3>Landmarks</h3>${lms.map(l => `<p><b>${esc(l.title)}</b><br><span class="dim">${esc(l.real)}</span></p>`).join('') || '<p class="dim">Landmarks you reach add notes here.</p>'}<p class="fictional">Field notes are general real-world context, not authoritative.</p>
      <h3>Time so far</h3>${Menus.timeBreakdown(ex)}</div></div>`;
  }
  panelPause() {
    const g = this.game, body = $('#pn-body');
    body.innerHTML = `<div class="grid2"><div class="card"><h3>Expedition</h3><p class="dim">Progress autosaves at every checkpoint. You can leave now and resume later from the same spot.</p>
      <div style="display:flex;flex-direction:column;gap:8px;max-width:340px"><button class="btn primary" id="ps-resume">Resume</button><button class="btn" id="ps-hub">Save and return to the hub</button><button class="btn" id="ps-abandon">Abandon the expedition</button></div></div>
      <div class="card"><h3>Settings</h3><div id="ps-settings"></div></div></div>`;
    $('#ps-resume').onclick = () => this.closePanel();
    $('#ps-hub').onclick = () => this.leaveToHub();
    $('#ps-abandon').onclick = () => this.showModal({ kind: 'Abandon', title: 'Abandon the expedition?', text: 'You will be walked out (a transport cost) and the expedition counts as a retreat. Photos and landmarks are kept.', choices: [
      { label: 'Abandon', onPick: () => { this.closePanel(); g.exp.flags.abandoned = true; g.finishExpedition('retreat', null, 'Abandoned mid-route; transport arranged.'); } }, { label: 'Keep going' }] });
    Menus.settingsForm($('#ps-settings'), g);
  }
  leaveToHub() { const g = this.game; g.save(); this.closePanel(); this.hideHud(); Menus.openHub(g); }

  // ---------- end of expedition ----------
  debrief(data) { this.closePanel(); this.hideHud(); Menus.debrief(this.game, data); }

  // ---------- keyboard ----------
  bindKeys() {
    addEventListener('keydown', e => {
      const g = this.game;
      if (!g) return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      g.audio.start();
      if (dialogueOpen()) { if (k === 'enter' || k === ' ') { e.preventDefault(); advanceDialogue(); } return; }
      if (this.modal) { const n = parseInt(k, 10); if (n >= 1 && n <= 9) { e.preventDefault(); this.pick(n - 1); } if (k === 'escape' && this.modal.decision === false) this.closeModal(); return; }
      if (g.mode === 'panel') { if (k === 'escape' || (k === 'm' && this.panelKind === 'map') || (k === 'i' && this.panelKind === 'inventory')) this.closePanel(); return; }
      if (g.mode !== 'play') return;
      if (g.rig.mode === 'photo') {
        if (k === ' ' || k === 'enter') { e.preventDefault(); g.takePhoto(); }
        if (k === 'escape' || k === 'p') g.exitPhoto();
        if (k === '+' || k === '=') g.rig.zoom(-1); if (k === '-') g.rig.zoom(1);
        return;
      }
      g.keys.add(k);
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k) && g.exp.follow.active) g.stopFollow('Walking freely (F to follow the track again)');
      const act = { f: () => g.toggleFollow(), r: () => this.restMenu(), e: () => this.interact(), i: () => this.openPanel('inventory'), m: () => this.openPanel('map'), j: () => this.openPanel('notes'),
        p: () => g.enterPhoto(), v: () => this.cyclePace(), l: () => { g.profile.settings.labels = !g.profile.settings.labels; }, h: () => { const h = $('#h-help'); if (h) h.hidden = !h.hidden; }, escape: () => this.openPanel('pause') }[k];
      if (act) { e.preventDefault(); act(); }
    });
    addEventListener('keyup', e => this.game?.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.game?.keys.clear());
    document.getElementById('view').addEventListener('click', () => { const g = this.game; g?.audio.start(); if (g?.mode === 'play' && g.rig.mode === 'photo' && g.rig.dragMoved < 6) g.takePhoto(); });
  }
}
