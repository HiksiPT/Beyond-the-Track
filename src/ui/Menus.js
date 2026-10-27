// Screens outside the 3D climb: title, hub, briefing + route planning, packing, shop, career, settings, debrief.
import { CAMPAIGN, byId, loadContent } from '../expedition/MountainData.js';
import { planRoute } from '../expedition/RoutePlanner.js';
import { unlockStatus, ACHIEVEMENTS } from '../game/Progression.js';
import { newProfile, rankOf, rankIndex, RANKS, PACING, changed } from '../game/GameState.js';
import { saveProfile, listSlots, writeSlot, readSlot, exportProfile, importProfile, allImages, wipeProfile } from '../game/SaveSystem.js';
import { ITEMS, SUPPLIES, CATEGORIES } from '../data/Items.js';
import { defaultPack, fxOf, packWeight, packKcal, gearWeight } from '../systems/InventorySystem.js';
import { priceOf, canBuy, buy, sell, repairCost, repair, suppliesCost, discount } from '../systems/EconomySystem.js';
import { Weather, sunTimes, fmtDur, fmtClock } from '../systems/Weather.js';
import { SPONSORS, JACKETS, acceptSponsor } from '../systems/SocialSystem.js';
import { showDialogue, HUB_LINES, PORTRAIT, MENTOR_NAME } from './Dialogue.js';
import { TopoMap } from './MapInterface.js';
import { socialTab } from './SocialUI.js';
import { esc } from './UI.js';

const $ = (s) => document.querySelector(s);
const km = (m) => (m / 1000).toFixed(1) + ' km';
const money = (v) => '$' + Math.round(v).toLocaleString('en-AU');
const dots = (n) => `<span class="dots">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;

function screen(html, solid = false) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = true;
  const el = $('#screen-main');
  el.className = 'screen' + (solid ? ' solid' : '');
  el.hidden = false; el.innerHTML = html; el.scrollTop = 0;
  return el;
}
export function loading(msg, p) {
  const l = $('#loading');
  if (msg === false) { l.hidden = true; return; }
  l.hidden = false; $('#ld-msg').textContent = msg; if (p !== undefined) $('#ld-bar').style.width = Math.round(p * 100) + '%';
}

// ====================== title ======================
export function title(game, hasSave, notes = []) {
  game.mode = 'title';
  game.audio.setMusic(true);
  const p = game.profile;
  const el = screen(`<div class="title">
    <p class="eyebrow">Real Australian terrain · long-form expeditions</p>
    <h1>Beyond the Track<span>Australian Expeditions</span></h1>
    <p class="lede">Eight real mountains, rebuilt from Geoscience Australia elevation data. Plan the route, pack the bag, read the weather — then walk every metre. From the Main Range to the Western Arthurs.</p>
    <div class="actions">
      ${hasSave ? `<button class="btn primary" id="t-continue">Continue${p.active ? ' expedition' : ''}</button>` : ''}
      <button class="btn ${hasSave ? '' : 'primary'}" id="t-new">New game</button>
      <button class="btn" id="t-load">Load</button>
      <button class="btn ghost" id="t-credits">Data &amp; credits</button>
    </div>
    ${notes.length ? `<p class="warn fine">${notes.map(esc).join('<br>')}</p>` : ''}
    <p class="status">${hasSave ? `${esc(rankOf(p).name)} · ${money(p.money)} · ${p.followers.toLocaleString()} followers` : 'No save yet.'} · Simulation: routes and events are game mechanics, not real-world advice.</p></div>`);
  el.querySelector('#t-continue')?.addEventListener('click', () => { game.audio.start(); openHub(game); });
  el.querySelector('#t-new').onclick = () => {
    game.audio.start();
    const go = () => { game.profile = newProfile(); Object.assign(game.rig.settings, game.profile.settings); game.audio.settings = game.profile.settings; saveProfile(game.profile); openHub(game, true); };
    if (hasSave) confirmBox(game, 'Start a new game?', 'Your current career will be replaced (export it first from Load if you want to keep it).', go); else go();
  };
  el.querySelector('#t-load').onclick = () => { game.audio.start(); savesScreen(game, true); };
  el.querySelector('#t-credits').onclick = () => credits(game, () => title(game, hasSave));
}
function confirmBox(game, t, text, yes) { game.ui.showModal({ kind: 'Confirm', title: t, text, decision: false, choices: [{ label: 'Yes', onPick: yes }, { label: 'Cancel' }] }); }

// ====================== hub ======================
let hubTab = 'home';
export async function openHub(game, fresh = false, tab = null) {
  const p = game.profile;
  game.mode = 'hub';
  game.audio.setMusic(true);
  if (tab) hubTab = tab;
  // backdrop: the active expedition's mountain, else the newest unlocked one
  const bgId = p.active?.mountain || [...CAMPAIGN].reverse().find(m => p.unlocked.includes(m.id))?.id || 'kosciuszko';
  if (!game.m || (game.m.id !== bgId && !game.exp)) {
    try { loading('Loading terrain…', 0.05); await game.loadMountain(bgId, p.active?.scenario || 'summer', (m, f) => loading(m, f)); } catch (e) { console.error(e); game.ui.toast(e.message); }
    loading(false);
  }
  game.exp = null;
  renderHub(game);
  if (fresh) showDialogue(HUB_LINES.welcome, () => { p.mentor.seen.welcome = true; saveProfile(p); });
}
function renderHub(game) {
  const p = game.profile, r = rankOf(p), ri = rankIndex(p), next = RANKS[ri + 1];
  const offers = p.sponsorOffers.length;
  const tabs = [['home', 'Base camp'], ['expeditions', 'Expeditions'], ['shop', 'Outfitters'], ['gear', 'Gear & repairs'], ['social', 'Photos & Ridgeline', offers], ['career', 'Career'], ['settings', 'Settings'], ['saves', 'Save / load']];
  if (p.freeRoam) tabs.splice(2, 0, ['free', 'Free exploration']);
  const el = screen(`<div class="wrap">
    <div class="topbar"><div><p class="eyebrow">Expedition hub</p><h2>Base camp</h2></div>
      <div class="chips"><span class="chip">Rank <b>${esc(r.name)}</b></span><span class="chip">XP <b>${Math.floor(p.xp)}</b>${next ? ` / ${next.xp}` : ''}</span><span class="chip">Money <b>${money(p.money)}</b></span><span class="chip">Followers <b>${p.followers.toLocaleString()}</b></span><span class="chip">Reputation <b>${Math.round(p.reputation)}</b></span></div></div>
    <div class="hub-grid"><nav class="nav" aria-label="Hub">${tabs.map(([id, l, b]) => `<button data-tab="${id}" class="${id === hubTab ? 'on' : ''}">${l}${b ? `<span class="badge">${b}</span>` : ''}</button>`).join('')}
      <button data-tab="title" style="margin-top:14px">← Title screen</button></nav><main id="hub-body"></main></div></div>`);
  el.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { game.audio.click(); if (b.dataset.tab === 'title') return title(game, true); hubTab = b.dataset.tab; renderHub(game); });
  const body = $('#hub-body');
  ({ home: hubHome, expeditions: hubExpeditions, shop: hubShop, gear: hubGear, social: (g, b) => socialTab(g, b, () => renderHub(g)), career: hubCareer, settings: (g, b) => { b.innerHTML = '<div class="card"><h3>Settings</h3><div id="st"></div></div>'; settingsForm($('#st'), g); }, saves: (g, b) => savesPanel(g, b), free: hubFree })[hubTab](game, body);
}
function hubHome(game, body) {
  const p = game.profile, act = p.active;
  const line = HUB_LINES.idle[Math.floor(Date.now() / 60000) % HUB_LINES.idle.length];
  const nextM = CAMPAIGN.find(m => !p.completed[m.id]?.objective);
  body.innerHTML = `<div class="card"><div class="mentor"><div class="portrait">${PORTRAIT}</div><div><div class="who">${MENTOR_NAME}</div><p>${esc(act ? `You left an expedition on ${byId[act.mountain].name} half done. It's all where you left it.` : nextM ? `${nextM.name} next? ${line}` : 'You have done them all. Go and enjoy the hills.')}</p></div></div></div>
    ${act ? `<div class="card"><p class="eyebrow">Expedition in progress</p><h3>${esc(byId[act.mountain].name)}</h3><p class="dim">${esc(act.routeId)} · ${km(act.stats.distance)} walked · ${fmtDur((act.simT - act.startUtc) / 1000)} on the mountain</p><button class="btn primary" id="hb-resume">Resume expedition</button> <button class="btn" id="hb-abandon">Abandon it</button></div>` : ''}
    ${nextM && !act ? `<div class="card"><p class="eyebrow">Next on the list</p><h3>${esc(nextM.name)}</h3><p class="dim">${esc(nextM.tagline)}</p><button class="btn primary" id="hb-next">Open the briefing</button></div>` : ''}
    <div class="card"><h3>Recent expeditions</h3>${p.history.slice(-5).reverse().map(h => `<p class="fine"><b>${esc(h.name)}</b> · ${esc(h.route)} · ${h.outcome}${h.summit ? ' · summit' : ''} · ${km(h.distance)} · +${h.xp} XP · ${money(h.money)}</p>`).join('') || '<p class="dim">None yet. Kosciuszko is waiting.</p>'}</div>`;
  $('#hb-resume')?.addEventListener('click', () => resume(game));
  $('#hb-abandon')?.addEventListener('click', () => confirmBox(game, 'Abandon the expedition?', 'It will be recorded as abandoned. Photos already taken are kept.', () => { p.history.push({ id: act.id, mountain: act.mountain, name: byId[act.mountain].name, route: act.routeId, outcome: 'abandoned', summit: false, distance: act.stats.distance, ascent: act.stats.ascent, simSec: (act.simT - act.startUtc) / 1000, xp: 0, money: 0, at: Date.now() }); p.stats.abandoned++; p.active = null; saveProfile(p); renderHub(game); }));
  $('#hb-next')?.addEventListener('click', () => briefing(game, nextM.id));
}
export async function resume(game) {
  const act = game.profile.active;
  try {
    loading('Returning to the mountain…', 0.05);
    await game.loadMountain(act.mountain, act.scenario, (m, f) => loading(m, f));
    loading(false);
    game.beginExpedition(act);
    game.ui.toast('Expedition resumed — position, route, supplies and decisions restored.');
  } catch (e) { loading(false); console.error(e); game.ui.toast('Could not resume: ' + e.message); }
}
function hubExpeditions(game, body) {
  const p = game.profile;
  body.innerHTML = `<div class="mountains">${CAMPAIGN.map(m => {
    const u = unlockStatus(p, m), rec = p.completed[m.id];
    return `<button class="mcard ${u.open ? '' : 'locked'}" data-m="${m.id}" ${u.open ? '' : 'aria-disabled="true"'}>${rec?.objective ? '<span class="done">✔ DONE</span>' : ''}<div class="n">${m.order} · ${m.state} · ${m.elevation} m</div><h4>${esc(m.name)}</h4><div class="sub">${esc(m.role)}</div>
      <div class="diff">${[1, 2, 3, 4, 5, 6, 7, 8].map(i => `<i class="${i <= m.difficulty ? 'on' : ''}"></i>`).join('')}</div>
      ${u.open ? `<div class="sub" style="margin-top:6px">${esc(m.duration)} · ${rec ? `${rec.attempts} attempt${rec.attempts === 1 ? '' : 's'}${rec.best ? ` · best ${rec.best.score}` : ''}` : 'not attempted'}</div>` : `<ul>${u.reasons.map(r => `<li class="${r.ok ? 'ok' : ''}">${r.ok ? '✔' : '○'} ${esc(r.text)}</li>`).join('')}</ul>`}</button>`;
  }).join('')}</div><p class="fine" style="margin-top:12px">Every mountain is rebuilt from real elevation data. Unlock the next by completing the previous one, earning XP and meeting a preparation milestone.</p>`;
  body.querySelectorAll('.mcard').forEach(b => b.onclick = () => { if (!b.classList.contains('locked')) briefing(game, b.dataset.m); else game.ui.toast('Locked — see the requirements on the card.'); });
}
function hubShop(game, body) {
  const p = game.profile, d = discount(p);
  const rows = CATEGORIES.map(([cat, label]) => {
    const items = Object.entries(ITEMS).filter(([, it]) => it.cat === cat);
    if (!items.length) return '';
    return `<tr class="cat"><td colspan="4">${label}</td></tr>` + items.map(([id, it]) => {
      const c = canBuy(p, id), owned = p.owned[id] || 0;
      return `<tr><td><b>${esc(it.name)}</b>${owned ? ` <span class="ok mono" style="font-size:11px">owned${it.stack ? ' ×' + owned : ''}</span>` : ''}<div class="desc">${esc(it.desc)}</div><div class="fx">${esc(it.effect)}</div></td><td class="num">${it.kg.toFixed(2)} kg</td><td class="num">${it.price ? money(priceOf(p, id)) : 'free'}</td>
        <td class="num">${c.ok ? `<button class="btn small primary" data-buy="${id}">Buy</button>` : `<span class="dim fine">${esc(c.why)}</span>`}${owned && it.starter !== true && !it.stack ? ` <button class="btn small" data-sell="${id}">Sell</button>` : ''}</td></tr>`;
    }).join('');
  }).join('');
  body.innerHTML = `<div class="card"><div class="topbar" style="margin:0 0 6px"><h3>Outfitters</h3><span class="chip">Money <b>${money(p.money)}</b>${d ? ` · sponsor discount ${Math.round(d * 100)}%` : ''}</span></div><p class="fine">Durable gear is bought once and wears with use — repair it in Gear & repairs. Food and fuel are bought on the packing screen for each trip. Some items need a higher career rank.</p>
    <table class="items"><thead><tr><th>Item</th><th class="num">Weight</th><th class="num">Price</th><th></th></tr></thead>${rows}</table></div>`;
  body.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { const r = buy(p, b.dataset.buy); if (r.ok) { game.audio.confirm(); saveProfile(p); renderHub(game); } else game.ui.toast(r.why); });
  body.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => confirmBox(game, `Sell ${ITEMS[b.dataset.sell].name}?`, 'You get 40% of the price, adjusted for condition.', () => { const r = sell(p, b.dataset.sell); if (r.ok) { game.ui.toast(`Sold for ${money(r.value)}`); saveProfile(p); renderHub(game); } }));
}
function hubGear(game, body) {
  const p = game.profile;
  const owned = Object.keys(p.owned).filter(id => ITEMS[id]);
  body.innerHTML = `<div class="card"><h3>Your gear</h3><table class="items"><thead><tr><th>Item</th><th>Condition</th><th class="num">Repair</th></tr></thead>${owned.map(id => {
    const it = ITEMS[id], c = p.condition[id] ?? 100, cost = it.slot ? repairCost(p, id) : 0;
    return `<tr><td>${esc(it.name)}${it.stack ? ' ×' + p.owned[id] : ''}<div class="fx">${esc(it.effect)}</div></td><td>${it.slot ? `<span class="cond"><i style="width:${c}%;background:${c < 30 ? 'var(--bad)' : c < 60 ? 'var(--warn)' : 'var(--ok)'}"></i></span> ${Math.round(c)}%` : '—'}</td><td class="num">${cost ? `<button class="btn small" data-rep="${id}" ${p.money < cost ? 'disabled' : ''}>${money(cost)}</button>` : ''}</td></tr>`;
  }).join('')}</table></div>
  <div class="card"><h3>Jacket colour</h3><div class="chips">${p.unlockedCosmetics.map(c => `<button class="btn small ${p.cosmetics.jacket === c ? 'primary' : ''}" data-jk="${c}"><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#${JACKETS[c].toString(16).padStart(6, '0')}"></span> ${c}</button>`).join('')}</div><p class="fine">More colours come with sponsorships.</p></div>`;
  body.querySelectorAll('[data-rep]').forEach(b => b.onclick = () => { if (repair(p, b.dataset.rep)) { game.audio.confirm(); saveProfile(p); renderHub(game); } });
  body.querySelectorAll('[data-jk]').forEach(b => b.onclick = () => { p.cosmetics.jacket = b.dataset.jk; game.hiker?.setJacket(JACKETS[b.dataset.jk]); saveProfile(p); renderHub(game); });
}
function hubCareer(game, body) {
  const p = game.profile, ri = rankIndex(p), s = p.stats;
  body.innerHTML = `<div class="grid2"><div class="card"><h3>${esc(RANKS[ri].name)}</h3><div class="weightbar"><i style="width:${RANKS[ri + 1] ? Math.min(100, (p.xp - RANKS[ri].xp) / (RANKS[ri + 1].xp - RANKS[ri].xp) * 100) : 100}%"></i></div>
      <p class="fine">${RANKS[ri + 1] ? `${Math.ceil(RANKS[ri + 1].xp - p.xp)} XP to ${RANKS[ri + 1].name}${RANKS[ri + 1].needs ? ' (and the Western Arthurs)' : ''}` : 'Top rank.'}</p>
      <ol class="fine" style="font-size:13px">${RANKS.map((r, i) => `<li class="${i <= ri ? 'ok' : ''}">${esc(r.name)} — ${r.xp} XP</li>`).join('')}</ol>
      <dl class="kv"><dt>Expeditions</dt><dd>${s.expeditions}</dd><dt>Summits</dt><dd>${s.summits}</dd><dt>Abandoned / retreated</dt><dd>${s.abandoned}</dd><dt>Needed assistance</dt><dd>${s.assisted}</dd><dt>Photos taken / published</dt><dd>${s.photosTaken} / ${s.photosPublished}</dd><dt>Followers</dt><dd>${p.followers.toLocaleString()}</dd><dt>Money earned</dt><dd>${money(s.moneyEarned)}</dd><dt>Distance walked</dt><dd>${km(s.distance)}</dd><dt>Ascent</dt><dd>${Math.round(s.ascent)} m</dd><dt>Time on mountains</dt><dd>${fmtDur(s.simSeconds)}</dd></dl></div>
    <div class="card"><h3>Mountains</h3><table class="items">${CAMPAIGN.map(m => { const r = p.completed[m.id]; return `<tr><td>${esc(m.name)}</td><td class="num">${r ? `${r.summits}/${r.attempts}` : '—'}</td><td class="num">${r?.best ? `best ${r.best.score} · ${fmtDur(r.best.simSec)}` : ''}</td></tr>`; }).join('')}</table>
      <h3 style="margin-top:14px">Achievements</h3><ul class="fine" style="font-size:13px;list-style:none;padding:0">${ACHIEVEMENTS.map(a => `<li class="${p.achievements[a.id] ? 'ok' : 'dim'}">${p.achievements[a.id] ? '★' : '☆'} <b>${esc(a.name)}</b> — ${esc(a.desc)}</li>`).join('')}</ul></div></div>`;
}
function hubFree(game, body) {
  body.innerHTML = `<div class="card"><h3>Free exploration</h3><p class="dim">Unlocked by completing the Western Arthurs. Wander any mountain with no supply limits, no survival drain and no rewards — just the terrain, the light and your camera.</p><div class="mountains">${CAMPAIGN.map(m => `<button class="mcard" data-fm="${m.id}"><h4>${esc(m.name)}</h4><div class="sub">${m.state} · ${m.elevation} m</div></button>`).join('')}</div></div>`;
  body.querySelectorAll('[data-fm]').forEach(b => b.onclick = async () => {
    loading('Loading terrain…', 0.05);
    await game.loadMountain(b.dataset.fm, 'summer', (m, f) => loading(m, f)); loading(false);
    const route = game.content.routes[0];
    const pack = defaultPack(game.profile); pack.water = fxOf(pack).waterL;
    game.beginExpedition(game.newExpedition(route.id, 'summer', pack, { freeRoam: true, departHour: 7 }));
  });
}

// ====================== briefing ======================
let brief = null;
export async function briefing(game, id) {
  const p = game.profile, m = byId[id];
  const content = await loadContent(id);
  const scen = brief?.id === id ? brief.scenario : 'summer';
  try { loading(`Loading ${m.name} from the elevation model…`, 0.05); await game.loadMountain(id, scen, (msg, f) => loading(msg, f)); } catch (e) { loading(false); game.ui.toast(e.message); return; }
  loading(false);
  game.mode = 'brief'; game.exp = null;
  if (!brief || brief.id !== id) brief = { id, scenario: scen, route: content.routes[0].id, depart: 7, seed: (Math.random() * 2 ** 31) | 0 };
  const C = game.content;
  const plans = Object.fromEntries(C.routes.map(r => [r.id, planRoute(game, r)]));
  const scenDef = C.scenarios?.[brief.scenario] || {};
  const tz = scenDef.tz ?? C.tz;
  const [y, mo, d] = (scenDef.startDate || C.startDate).split('-').map(Number);
  const dayUtc = Date.UTC(y, mo - 1, d) - tz * 3600000;
  const s = game.places[C.summitPlace] || Object.values(game.places)[0];
  const [lat, lon] = game.world.toLatLon(s.x, s.z);
  const st = sunTimes(dayUtc, lat, lon);
  const weather = new Weather(brief.seed, dayUtc + brief.depart * 3600000 - 6 * 3600000, { ...C.clim, ...(scenDef.clim || {}) }, 10);
  const fc = weather.forecast(brief.seed, dayUtc + brief.depart * 3600000);
  const R = C.routes.find(r => r.id === brief.route), P = plans[brief.route], M = P.metrics;
  const realMin = (sec) => sec / (PACING[p.settings.pacing]?.k || 8) / 60;
  const el = screen(`<div class="wrap">
    <div class="topbar"><div><p class="eyebrow">Briefing · ${m.order} of 8 · ${esc(m.region)}</p><h2>${esc(m.name)} <span class="dim" style="font-size:18px">${m.elevation} m · ${m.state}</span></h2></div>
      <div class="chips"><button class="btn" id="br-back">← Hub</button><button class="btn primary" id="br-pack">Pack for this route →</button></div></div>
    <div class="brief-grid"><div>
      <div class="card"><div class="mentor"><div class="portrait">${PORTRAIT}</div><div><div class="who">${MENTOR_NAME}</div><p id="br-mentor">${esc(C.mentor?.briefing?.[0] || m.tagline)}</p></div></div></div>
      <div class="card"><div id="br-map"></div></div>
      <div class="card"><h3 style="font-size:17px">Elevation profile — ${esc(R.name)}</h3><canvas class="profile" id="br-prof"></canvas><p class="fine">Profile from the GA 1-second DEM along the mapped tracks${M.offTrackKm ? `; includes ${M.offTrackKm.toFixed(1)} km of off-track scrambling (game representation)` : ''}.</p></div>
    </div><div>
      <div class="card"><h3 style="font-size:17px">The mountain</h3><p class="dim" style="margin:6px 0">${esc(m.environment)}</p>
        <dl class="kv"><dt>Role</dt><dd>${esc(m.role)}</dd><dt>Hazards</dt><dd style="font-family:var(--sans)">${m.hazards.map(esc).join(' · ')}</dd><dt>Preparation</dt><dd style="font-family:var(--sans)">${esc(m.prep)}</dd><dt>Expected</dt><dd>${esc(m.duration)} of play</dd><dt>Sunrise / sunset</dt><dd>${fmtClock(st.rise, tz)} / ${fmtClock(st.set, tz)}</dd></dl>
        ${C.scenarios ? `<div style="margin-top:10px">${Object.entries(C.scenarios).map(([k, v]) => `<button class="btn small ${k === brief.scenario ? 'primary' : ''}" data-scen="${k}">${esc(v.label)}</button>`).join(' ')}<p class="fine">${esc(scenDef.desc || '')}</p></div>` : ''}</div>
      <div class="card"><h3 style="font-size:17px">Routes</h3>${C.routes.map(r => { const pl = plans[r.id], mt = pl.metrics; return `<button class="route ${r.id === brief.route ? 'sel' : ''}" data-route="${r.id}"><h4>${esc(r.name)} <span class="tag ${r.difficulty}">${r.difficulty === 'easy' ? 'forgiving' : r.difficulty === 'mod' ? 'moderate' : 'demanding'}</span></h4><p>${esc(r.blurb)}</p>
        <div class="metrics"><div class="metric"><div class="k">Distance</div><div class="v">${km(pl.total.len)}</div></div><div class="metric"><div class="k">Climb</div><div class="v">↑${Math.round(pl.total.up)} m</div></div><div class="metric"><div class="k">Moving</div><div class="v">~${fmtDur(mt.hours * 3600)}</div></div><div class="metric"><div class="k">Play</div><div class="v">~${Math.round(realMin(mt.hours * 3600))} min</div></div>
        <div class="metric"><div class="k">Terrain</div><div class="v">${dots(mt.terrain)}</div></div><div class="metric"><div class="k">Navigation</div><div class="v">${dots(mt.navigation)}</div></div><div class="metric"><div class="k">Exposure</div><div class="v">${dots(mt.exposure)}</div></div><div class="metric"><div class="k">Nights</div><div class="v">${mt.nights}</div></div></div>
        <div class="fine" style="margin-top:6px">Needs about ${mt.water.toFixed(1)} L water over the route · ${Math.round(mt.food / 100) * 100} kcal food · rewards ×${(mt.rewardMult * (scenDef.rewardMult || 1)).toFixed(2)} (≈ ${Math.round(m.rewards.xp * 0.9 * mt.rewardMult * (scenDef.rewardMult || 1))} XP, ${money(m.rewards.money * mt.rewardMult * (scenDef.rewardMult || 1))})</div></button>`; }).join('')}</div>
      <div class="card"><h3 style="font-size:17px">Forecast <span class="fine">(simulated — forecasts can be wrong)</span></h3><div class="forecast">${fc.map((f, i) => `<div><b>Day ${i + 1}</b>${Math.round(f.minT)}–${Math.round(f.maxT)} °C low<br>${Math.round(f.minT - 6.5 * (m.elevation - C.clim.valleyY) / 1000)}–${Math.round(f.maxT - 6.5 * (m.elevation - C.clim.valleyY) / 1000)} °C top<br>wind ${Math.round(f.wind)} km/h<br>rain ${f.pRain}%<br>cloud base ${Math.round(f.cloudBase / 100) * 100} m<br><span class="dimmer">${f.conf} confidence</span></div>`).join('')}</div>
        <div style="margin-top:10px" class="fine">Leave at <select id="br-depart">${[5, 6, 7, 8, 9, 10, 11, 12].map(h => `<option value="${h}" ${h === brief.depart ? 'selected' : ''}>${String(h).padStart(2, '0')}:00</option>`).join('')}</select> · <button class="btn small" id="br-mentor-more">Ask ${MENTOR_NAME.split(' ')[0]} about this</button></div>
        <p class="fine">${esc(C.camping)}</p></div>
    </div></div></div>`);
  const map = new TopoMap($('#br-map'), game, { onPick: (h) => game.ui.toast(h.name) });
  map.setRoute(P.pts, C.routes.filter(r => r.id !== brief.route).map(r => plans[r.id].pts));
  drawProfile($('#br-prof'), game.net.profile(P.pts), P.stages, game);
  el.querySelectorAll('[data-route]').forEach(b => b.onclick = () => { brief.route = b.dataset.route; game.audio.click(); briefing(game, id); });
  el.querySelectorAll('[data-scen]').forEach(b => b.onclick = () => { brief.scenario = b.dataset.scen; briefing(game, id); });
  $('#br-depart').onchange = (e) => { brief.depart = +e.target.value; briefing(game, id); };
  $('#br-back').onclick = () => { map.destroy(); openHub(game); };
  $('#br-pack').onclick = () => { map.destroy(); packing(game); };
  let li = 0;
  $('#br-mentor-more').onclick = () => {
    const lines = [...(C.mentor?.briefing || [])];
    if (fc[0]?.pRain > 50) lines.push('That forecast has rain in it. Waterproofs, and decide your turn-around time before you start.');
    if (M.water > 3) lines.push(`Look at the water: about ${M.water.toFixed(1)} litres over the route. Know where you can refill.`);
    if (M.exposure >= 4) lines.push('Lots of exposed ground on this one. Wind will be your problem, not distance.');
    if (st.set && (st.set - (dayUtc + brief.depart * 3600000)) / 3600000 < M.hours / Math.max(1, M.nights + 1) + 1) lines.push('You are cutting it fine for daylight on the first day. Leave earlier or carry a torch.');
    li = (li + 1) % lines.length; $('#br-mentor').textContent = lines[li];
  };
}
function drawProfile(cv, prof, stages, game) {
  const dpr = devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  const g = cv.getContext('2d'); g.scale(dpr, dpr);
  const L = prof[prof.length - 1][0] || 1, ys = prof.map(p => p[1]);
  const lo = Math.floor(Math.min(...ys) / 200) * 200, hi = Math.ceil(Math.max(...ys) / 200) * 200 || lo + 200;
  const px = (d) => 38 + (W - 48) * d / L, py = (y) => H - 18 - (H - 30) * (y - lo) / (hi - lo || 1);
  g.font = '10px IBM Plex Mono, monospace'; g.strokeStyle = 'rgba(255,255,255,.12)'; g.fillStyle = '#9b9488';
  for (let y = lo; y <= hi; y += 200) { g.beginPath(); g.moveTo(38, py(y)); g.lineTo(W - 10, py(y)); g.stroke(); }
  for (let y = lo; y <= hi; y += 400) g.fillText(y + '', 2, py(y) + 3);
  for (let d = 0; d <= L; d += L > 30000 ? 10000 : 5000) g.fillText((d / 1000) + ' km', px(d) - 8, H - 4);
  g.beginPath(); g.moveTo(px(0), py(lo)); for (const [d, y] of prof) g.lineTo(px(d), py(y)); g.lineTo(px(L), py(lo)); g.closePath();
  g.fillStyle = 'rgba(208,112,63,.22)'; g.fill();
  g.beginPath(); prof.forEach(([d, y], i) => i ? g.lineTo(px(d), py(y)) : g.moveTo(px(d), py(y))); g.strokeStyle = '#f0a272'; g.lineWidth = 1.6; g.stroke();
  let acc = 0; g.fillStyle = '#ece6d8';
  stages.slice(0, -1).forEach((s, i) => { acc += s.len; g.fillRect(px(acc) - 0.5, 10, 1, H - 28); g.fillText(game.placeName(s.to).slice(0, 18), px(acc) + 3, 18 + (i % 3) * 12); });
}

// ====================== packing ======================
let pack = null;
export function packing(game) {
  const p = game.profile, C = game.content, R = C.routes.find(r => r.id === brief.route), plan = planRoute(game, R), M = plan.metrics;
  if (!pack || pack.mountain !== C.id) {
    // a sensible starting point sized to the route; the player adjusts from here
    pack = { ...defaultPack(p), mountain: C.id };
    pack.supplies = { 'trail-mix': M.nights ? Math.ceil(M.nights / 2) : 0, bars: 1, lunch: Math.max(1, M.nights + (M.hours > 6 ? 1 : 0)), meal: M.nights, fuel: M.nights ? 1 : 0 };
  }
  const fx = fxOf(pack);
  pack.water = Math.min(pack.water || fx.waterL, fx.waterL);
  const kg = packWeight(pack), kcal = packKcal(pack), cost = suppliesCost(p, pack.supplies);
  const cap = fx.capacityKg, ratio = kg / cap;
  const missing = (R.gear || []).filter(id => ITEMS[id]?.slot ? !Object.keys(pack.items).some(x => ITEMS[x]?.slot === ITEMS[id].slot && ITEMS[x].price >= 0) : !pack.items[id]).filter(id => !(ITEMS[id]?.slot && Object.keys(pack.items).some(x => ITEMS[x]?.slot === ITEMS[id].slot)));
  const ownedBy = (cat) => Object.keys(p.owned).filter(id => ITEMS[id]?.cat === cat);
  const rows = CATEGORIES.filter(([c]) => c !== 'food').map(([cat, label]) => {
    const ids = ownedBy(cat);
    if (!ids.length) return '';
    return `<tr class="cat"><td colspan="3">${label}</td></tr>` + ids.map(id => {
      const it = ITEMS[id], on = !!pack.items[id], cond = p.condition[id] ?? 100;
      const ctrl = it.stack ? `<span class="qty"><button data-dec="${id}" aria-label="fewer">−</button><span>${pack.items[id] || 0}/${p.owned[id]}</span><button data-inc="${id}" aria-label="more">+</button></span>`
        : `<label><input type="${it.slot ? 'radio' : 'checkbox'}" name="${it.slot || id}" data-tog="${id}" ${on ? 'checked' : ''}> take</label>`;
      return `<tr><td><b>${esc(it.name)}</b>${it.slot && cond < 100 ? ` <span class="${cond < 40 ? 'bad' : 'dim'} mono" style="font-size:11px">${Math.round(cond)}%</span>` : ''}<div class="fx">${esc(it.effect)}</div></td><td class="num">${it.kg.toFixed(2)} kg</td><td class="num">${ctrl}</td></tr>`;
    }).join('');
  }).join('');
  const food = Object.entries(SUPPLIES).map(([id, s]) => `<tr><td><b>${esc(s.name)}</b><div class="desc">${esc(s.desc)}</div><div class="fx">${esc(s.effect)}</div></td><td class="num">${s.kg.toFixed(2)} kg · ${money(priceOf(p, id))}</td><td class="num"><span class="qty"><button data-sdec="${id}">−</button><span>${pack.supplies[id] || 0}</span><button data-sinc="${id}">+</button></span></td></tr>`).join('');
  const el = screen(`<div class="wrap">
    <div class="topbar"><div><p class="eyebrow">Packing · ${esc(byId[C.id].name)} · ${esc(R.name)}</p><h2>Pack the bag</h2></div>
      <div class="chips"><button class="btn" id="pk-back">← Briefing</button><button class="btn primary" id="pk-go" ${p.money < cost ? 'disabled' : ''}>Begin expedition (${money(cost)})</button></div></div>
    <div class="grid2" style="grid-template-columns:1.4fr 1fr">
      <div class="card"><table class="items">${rows}<tr class="cat"><td colspan="3">Food & fuel (bought for this trip)</td></tr>${food}
        <tr class="cat"><td colspan="3">Water at the start</td></tr><tr><td>Fill to<div class="desc">Capacity ${fx.waterL} L from your bottles and bladder. 1 L weighs 1 kg.</div></td><td class="num" colspan="2"><input type="range" min="0" max="${fx.waterL}" step="0.25" value="${pack.water}" id="pk-water" style="width:140px"> <span class="mono">${pack.water.toFixed(2)} L</span></td></tr></table>
        <p class="fine">Missing something? Buy it at the Outfitters in the hub. You cannot buy gear on the mountain.</p></div>
      <div><div class="card sticky"><h3>Load</h3><div class="weightbar"><i class="${ratio > 1 ? 'bad' : ratio > 0.85 ? 'warn' : ''}" style="width:${Math.min(100, ratio * 100)}%"></i></div>
        <dl class="kv"><dt>Pack weight</dt><dd>${kg.toFixed(1)} / ${cap} kg${ratio > 1 ? ' — overloaded' : ''}</dd><dt>Gear</dt><dd>${gearWeight(pack).toFixed(1)} kg</dd><dt>Food</dt><dd>${Math.round(kcal)} kcal (route needs ~${Math.round(M.food / 100) * 100})</dd><dt>Water</dt><dd>${pack.water.toFixed(1)} L (route ~${M.water.toFixed(1)} L)</dd><dt>Supplies cost</dt><dd>${money(cost)} of ${money(p.money)}</dd><dt>Insulation</dt><dd>+${fx.insulation} °C</dd><dt>Rain / wind</dt><dd>${Math.round(fx.waterproof * 100)}% / ${Math.round(fx.windproof * 100)}%</dd><dt>Navigation</dt><dd>${['phone only', 'phone', 'map & compass', 'GPS'][fx.nav]}</dd><dt>Shelter</dt><dd>${fx.tent ? 'tent' : 'none'}${fx.sleepWarm ? `, sleep +${fx.sleepWarm} °C` : ''}</dd></dl>
        ${missing.length ? `<div class="mentor" style="margin-top:12px"><div class="portrait" style="width:44px;height:44px">${PORTRAIT}</div><p class="fine">${esc(MENTOR_NAME.split(' ')[0])}: “For this route I'd want ${missing.map(id => ITEMS[id]?.name || id).slice(0, 4).join(', ')}.”</p></div>` : ''}
        ${M.nights && !fx.tent && !Object.values(game.places).some(pl => pl.hut && pl.camp) ? '<p class="warn fine">This route has nights out and you have no tent.</p>' : ''}
        ${kcal < M.food * 0.8 ? '<p class="warn fine">Less food than the route is likely to need.</p>' : ''}${pack.water < Math.min(fx.waterL, M.water * 0.5) ? '<p class="warn fine">Not much water for the first stretch.</p>' : ''}</div></div></div></div>`);
  const re = () => packing(game);
  el.querySelectorAll('[data-tog]').forEach(i => i.onchange = () => {
    const id = i.dataset.tog, it = ITEMS[id];
    if (it.slot) { for (const x of Object.keys(pack.items)) if (ITEMS[x]?.slot === it.slot) delete pack.items[x]; pack.items[id] = 1; }
    else if (i.checked) pack.items[id] = 1; else delete pack.items[id];
    re();
  });
  el.querySelectorAll('[data-inc]').forEach(b => b.onclick = () => { const id = b.dataset.inc; pack.items[id] = Math.min(p.owned[id], (pack.items[id] || 0) + 1); re(); });
  el.querySelectorAll('[data-dec]').forEach(b => b.onclick = () => { const id = b.dataset.dec; pack.items[id] = Math.max(0, (pack.items[id] || 0) - 1); if (!pack.items[id]) delete pack.items[id]; re(); });
  el.querySelectorAll('[data-sinc]').forEach(b => b.onclick = () => { const id = b.dataset.sinc; pack.supplies[id] = (pack.supplies[id] || 0) + 1; re(); });
  el.querySelectorAll('[data-sdec]').forEach(b => b.onclick = () => { const id = b.dataset.sdec; pack.supplies[id] = Math.max(0, (pack.supplies[id] || 0) - 1); re(); });
  $('#pk-water').oninput = (e) => { pack.water = +e.target.value; e.target.nextElementSibling.textContent = pack.water.toFixed(2) + ' L'; };
  $('#pk-water').onchange = re;
  $('#pk-back').onclick = () => briefing(game, C.id);
  $('#pk-go').onclick = () => {
    if (!pack.items[Object.keys(pack.items).find(x => ITEMS[x]?.slot === 'pack')]) return game.ui.toast('Take a backpack.');
    p.money -= cost;
    const exp = game.newExpedition(R.id, brief.scenario, pack, { departHour: brief.depart, seed: brief.seed });
    pack = null; brief = null;
    game.audio.confirm();
    game.beginExpedition(exp);
    game.ui.mentorRadio(C.id === 'kosciuszko' ? 'Off you go. Press F to follow the track, or walk with WASD. I will be on the radio.' : 'Radio check. Pace yourself, drink before you are thirsty.', 7000);
  };
}

// ====================== debrief ======================
export function debrief(game, d) {
  game.mode = 'debrief';
  game.audio.setMusic(true);
  const { summary: s, rewards: r, ex } = d;
  const outcomeText = { complete: s.summit ? 'Objective completed' : 'Expedition completed', retreat: 'Retreated safely', assisted: 'Ended with assistance' }[s.outcome] || s.outcome;
  const photos = game.profile.photos.filter(ph => ph.expId === ex.id);
  const el = screen(`<div class="wrap"><div class="topbar"><div><p class="eyebrow">Debrief · ${esc(s.name)}</p><h2>${outcomeText}</h2><p class="dim">${esc(s.route)}${s.scenario === 'winter' ? ' · winter' : ''}${d.note ? ' · ' + esc(d.note) : ''}</p></div>
      <div class="chips"><button class="btn" id="db-social" ${photos.length ? '' : 'disabled'}>Publish photos on Ridgeline</button><button class="btn primary" id="db-hub">Back to base camp</button></div></div>
    <div class="grid2"><div>
      <div class="card"><div class="mentor"><div class="portrait">${PORTRAIT}</div><div><div class="who">${MENTOR_NAME}</div><p>${esc(d.mentor)}</p></div></div></div>
      <div class="card"><h3>Rewards</h3><table class="items">${r.lines.map(l => `<tr><td>${esc(l.label)}</td><td class="num">${l.xp ? '+' + l.xp + ' XP' : ''}</td><td class="num ${l.money < 0 ? 'bad' : ''}">${l.money ? (l.money > 0 ? '+' : '') + money(l.money) : ''}</td></tr>`).join('')}<tr><td><b>Total</b></td><td class="num"><b>+${r.xp} XP</b></td><td class="num"><b>${r.money >= 0 ? '+' : ''}${money(r.money)}</b></td></tr></table>
        ${d.unlocked.length ? `<p class="ok">Unlocked: ${d.unlocked.map(m => esc(m.name)).join(', ')}</p>` : ''}${d.achievements.length ? `<p class="ok">Achievements: ${d.achievements.map(a => '★ ' + esc(a.name)).join(', ')}</p>` : ''}${d.offers.length ? `<p class="ok">Sponsor offers waiting: ${d.offers.map(o => esc(o.name)).join(', ')}</p>` : ''}</div>
      <div class="card"><h3>Suggestions</h3><ul>${d.suggestions.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>
    <div><div class="card"><h3>The numbers</h3><dl class="kv"><dt>Distance</dt><dd>${km(s.distance)} (planned ${km(d.plan.total.len)})</dd><dt>Ascent / descent</dt><dd>${Math.round(s.ascent)} / ${Math.round(ex.stats.descent)} m</dd><dt>Highest point</dt><dd>${Math.round(ex.stats.maxY)} m</dd><dt>Nights out</dt><dd>${s.nights}</dd><dt>Water drunk</dt><dd>${s.consumed.water.toFixed(1)} L + refills</dd><dt>Food eaten</dt><dd>${Math.round(s.consumed.kcal)} kcal</dd><dt>Fuel used</dt><dd>${Math.round(s.consumed.fuel)} g</dd><dt>Photos</dt><dd>${photos.length}</dd><dt>Real time played</dt><dd>${fmtDur(ex.stats.realPlay)}</dd></dl>
      <h3 style="margin-top:12px">Simulated time</h3>${timeBreakdown(ex)}</div>
      <div class="card"><h3>Decisions</h3><ol class="fine" style="font-size:13px">${s.decisions.map(x => `<li>${fmtClock(x.simT, ex.tz)} — ${esc(x.title)}: ${esc(x.choice)}${x.outcome ? ` <span class="${x.good ? 'ok' : x.good === false ? 'bad' : 'dim'}">(${esc(x.outcome)})</span>` : ''}</li>`).join('') || '<li>None</li>'}</ol></div></div></div></div>`, true);
  $('#db-hub').onclick = () => { game.exp = null; openHub(game, false, 'home'); };
  $('#db-social').onclick = () => { game.exp = null; openHub(game, false, 'social'); };
  if (d.unlocked.length) setTimeout(() => showDialogue(d.unlocked.map(m => HUB_LINES.unlock(m.name))), 600);
}
export function timeBreakdown(ex) {
  const s = ex.stats, total = Math.max(1, (ex.simT - ex.startUtc) / 1000);
  const parts = [['Moving', s.moving, '#d0703f'], ['Resting & stops', s.resting, '#7a9a6a'], ['Sleeping', s.sleeping, '#4a5a8a'], ['Decisions', s.deciding, '#c9a03a'], ['Map', s.map, '#5f8fb3'], ['Photography', s.photo, '#9a6ab0']];
  return `<div class="weightbar" style="display:flex;height:14px">${parts.map(([l, v, c]) => `<span title="${l}" style="display:block;width:${v / total * 100}%;background:${c}"></span>`).join('')}</div>
    <dl class="kv">${parts.map(([l, v, c]) => `<dt><span style="display:inline-block;width:9px;height:9px;background:${c};margin-right:6px;border-radius:2px"></span>${l}</dt><dd>${fmtDur(v)}</dd>`).join('')}<dt><b>Total expedition</b></dt><dd><b>${fmtDur(total)}</b></dd></dl>`;
}

// ====================== settings / saves / credits ======================
export function settingsForm(box, game) {
  const s = game.profile.settings;
  const rng = (k, label) => `<label class="fine" style="display:grid;grid-template-columns:130px 1fr 40px;gap:8px;align-items:center">${label}<input type="range" min="0" max="1" step="0.05" value="${s[k]}" data-vol="${k}"><span class="mono">${Math.round(s[k] * 100)}</span></label>`;
  box.innerHTML = `<div style="display:grid;gap:8px">${rng('master', 'Master volume')}${rng('music', 'Music')}${rng('sfx', 'Effects')}${rng('ambience', 'Ambience')}
    <label class="fine"><input type="checkbox" data-bool="mute" ${s.mute ? 'checked' : ''}> Mute all</label>
    <label class="fine"><input type="checkbox" data-bool="captions" ${s.captions ? 'checked' : ''}> Captions for important sounds</label>
    <label class="fine">Graphics <select data-sel="quality">${['high', 'medium', 'low'].map(q => `<option ${s.quality === q ? 'selected' : ''}>${q}</option>`).join('')}</select> <span class="dimmer">terrain shape never changes</span></label>
    <label class="fine">Expedition length <select data-sel="pacing">${Object.entries(PACING).map(([k, v]) => `<option value="${k}" ${s.pacing === k ? 'selected' : ''}>${v.name} (1 real min ≈ ${v.k} sim min)</option>`).join('')}</select></label>
    <label class="fine" style="display:grid;grid-template-columns:130px 1fr 40px;gap:8px;align-items:center">Camera sensitivity<input type="range" min="0.3" max="2.5" step="0.1" value="${s.sensitivity}" data-num="sensitivity"><span class="mono">${s.sensitivity.toFixed(1)}</span></label>
    <label class="fine"><input type="checkbox" data-bool="invertY" ${s.invertY ? 'checked' : ''}> Invert camera Y</label>
    <label class="fine"><input type="checkbox" data-bool="labels" ${s.labels ? 'checked' : ''}> Place labels in the world</label>
    <label class="fine"><input type="checkbox" data-bool="autoSip" ${s.autoSip ? 'checked' : ''}> Sip water automatically</label>
    <label class="fine"><input type="checkbox" data-bool="autoSnack" ${s.autoSnack ? 'checked' : ''}> Snack automatically when hungry</label>
    <label class="fine"><input type="checkbox" data-bool="bigText" ${s.bigText ? 'checked' : ''}> Larger text</label></div>`;
  const save = () => { saveProfile(game.profile); game.audio.applyVolumes(); document.body.classList.toggle('big-text', !!s.bigText); };
  box.querySelectorAll('[data-vol]').forEach(i => i.oninput = () => { s[i.dataset.vol] = +i.value; i.nextElementSibling.textContent = Math.round(i.value * 100); save(); });
  box.querySelectorAll('[data-num]').forEach(i => i.oninput = () => { s[i.dataset.num] = +i.value; i.nextElementSibling.textContent = (+i.value).toFixed(1); save(); });
  box.querySelectorAll('[data-bool]').forEach(i => i.onchange = () => { s[i.dataset.bool] = i.checked; save(); });
  box.querySelectorAll('[data-sel]').forEach(i => i.onchange = () => { s[i.dataset.sel] = i.value; if (i.dataset.sel === 'quality') game.applyQuality(i.value); if (i.dataset.sel === 'pacing' && game.exp) game.exp.timeScale = PACING[i.value].k; save(); });
}
function savesPanel(game, body, fromTitle = false) {
  const p = game.profile;
  body.innerHTML = `<div class="card"><h3>Save slots</h3><p class="fine">Your career autosaves continuously (including any expedition in progress). Slots keep extra copies.</p>
    <table class="items">${listSlots().map(sl => `<tr><td>Slot ${sl.id.slice(-1)}</td><td>${sl.meta ? (sl.meta.broken ? '<span class="bad">damaged</span>' : `${esc(sl.meta.rank)} · ${money(sl.meta.money)} · ${new Date(sl.savedAt).toLocaleString()}`) : '<span class="dim">empty</span>'}</td>
      <td class="num">${!fromTitle && p ? `<button class="btn small" data-save="${sl.id}">Save here</button>` : ''} ${sl.meta && !sl.meta.broken ? `<button class="btn small primary" data-load="${sl.id}">Load</button>` : ''}</td></tr>`).join('')}</table>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">${p && !fromTitle ? '<button class="btn" id="sv-export">Export career file</button>' : ''}<label class="btn">Import career file<input type="file" id="sv-import" accept="application/json" hidden></label>${p && !fromTitle ? '<button class="btn ghost bad" id="sv-wipe">Delete career</button>' : ''}</div></div>`;
  body.querySelectorAll('[data-save]').forEach(b => b.onclick = () => { writeSlot(b.dataset.save, p, { rank: rankOf(p).name, money: p.money }); game.ui.toast('Saved.'); savesPanel(game, body, fromTitle); });
  body.querySelectorAll('[data-load]').forEach(b => b.onclick = () => { const np = readSlot(b.dataset.load); if (!np) return game.ui.toast('That slot could not be read.'); game.profile = np; Object.assign(game.rig.settings, np.settings); game.audio.settings = np.settings; saveProfile(np); openHub(game); });
  $('#sv-export')?.addEventListener('click', async () => exportProfile(p, await allImages(p.photos.map(x => x.id))));
  $('#sv-import').onchange = async (e) => { try { const np = await importProfile(e.target.files[0]); game.profile = np; saveProfile(np); openHub(game); } catch (err) { game.ui.toast(err.message); } };
  $('#sv-wipe')?.addEventListener('click', () => confirmBox(game, 'Delete this career?', 'This cannot be undone (export first if unsure).', () => { wipeProfile(); location.reload(); }));
}
function savesScreen(game, fromTitle) {
  screen(`<div class="wrap"><div class="topbar"><h2>Load</h2><button class="btn" id="sv-back">← Back</button></div><div id="sv"></div></div>`);
  savesPanel(game, $('#sv'), fromTitle);
  $('#sv-back').onclick = () => title(game, !!game.profile?.history);
}
export function credits(game, back) {
  screen(`<div class="wrap" style="max-width:860px"><div class="topbar"><h2>Data &amp; credits</h2><button class="btn" id="cr-back">← Back</button></div>
    <div class="card"><h3>Real terrain</h3><p>Every mountain is reconstructed from the <b>Geoscience Australia National Digital Elevation Model 1 Second</b> (DEM-S, derived from SRTM): about 25–31 m cells over a 20–30 km walkable area per mountain, plus a coarser grid of the same model for the distant horizon. © Commonwealth of Australia (Geoscience Australia), CC BY 4.0. GA's 5 m LiDAR does not cover these areas except Mt Barney, so the 1-second model is the best authoritative national data available; see README for the limitations.</p>
      <p>Tracks, huts, campsites, springs, peaks, streams and lakes: <b>© OpenStreetMap contributors</b>, ODbL 1.0. Summit spot heights from OpenStreetMap restore peaks the smoothed DEM under-reads.</p></div>
    <div class="card"><h3>What is simulated</h3><p>Weather, forecasts, encounters, hazards, survival, equipment, economy and the Ridgeline social network are game systems. Peg Arden is fictional. Hut models are generic. <b>Nothing here is real-world route or safety advice.</b></p></div>
    <div class="card"><h3>Software and assets</h3><p>three.js (MIT). Fonts: Fraunces and IBM Plex (SIL Open Font License). All sound is synthesised in the browser; all models, textures and the mentor portrait are procedural or original.</p></div></div>`);
  $('#cr-back').onclick = back;
}

// ====================== touch controls ======================
let touchBuilt = false;
export function showTouch(game, on) {
  const isTouch = matchMedia('(pointer: coarse)').matches;
  const el = $('#touch');
  if (!isTouch) { el.hidden = true; return; }
  el.hidden = !on;
  if (touchBuilt || !on) return;
  touchBuilt = true;
  el.innerHTML = `<div class="look"></div><div class="stick"><div class="knob"></div></div><div class="tbtns"><button data-t="f">F</button><button data-t="r">Rest</button><button data-t="p">Cam</button><button data-t="m">Map</button><button data-t="i">Pack</button><button data-t="shift">Run</button></div>`;
  const stick = el.querySelector('.stick'), knob = el.querySelector('.knob');
  let sid = null, cx = 0, cy = 0;
  stick.addEventListener('pointerdown', e => { sid = e.pointerId; const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; stick.setPointerCapture(sid); move(e); });
  const move = (e) => { if (e.pointerId !== sid) return; let dx = e.clientX - cx, dy = e.clientY - cy; const L = Math.hypot(dx, dy), max = 50; if (L > max) { dx *= max / L; dy *= max / L; } knob.style.transform = `translate(${dx}px,${dy}px)`; game.input.move.x = dx / max; game.input.move.y = dy / max; if (game.exp?.follow.active && L > 15) game.stopFollow(); };
  stick.addEventListener('pointermove', move);
  const end = () => { sid = null; knob.style.transform = ''; game.input.move.x = 0; game.input.move.y = 0; };
  stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
  const look = el.querySelector('.look'); let lid = null, lx = 0, ly = 0;
  look.addEventListener('pointerdown', e => { lid = e.pointerId; lx = e.clientX; ly = e.clientY; look.setPointerCapture(lid); });
  look.addEventListener('pointermove', e => { if (e.pointerId !== lid) return; game.rig.look(e.clientX - lx, e.clientY - ly); lx = e.clientX; ly = e.clientY; });
  look.addEventListener('pointerup', () => { lid = null; });
  el.querySelectorAll('[data-t]').forEach(b => {
    const k = b.dataset.t;
    if (k === 'shift') { b.addEventListener('pointerdown', () => game.input.push = true); b.addEventListener('pointerup', () => game.input.push = false); return; }
    b.onclick = () => { if (game.rig.mode === 'photo') { if (k === 'p') game.takePhoto(); return; } ({ f: () => game.toggleFollow(), r: () => game.ui.restMenu(), p: () => game.enterPhoto(), m: () => game.ui.openPanel('map'), i: () => game.ui.openPanel('inventory') })[k](); };
  });
}
