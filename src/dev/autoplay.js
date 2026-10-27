// Development-only test driver (not included in production builds): plays a route end to end at high
// time scale, taking the first available choice at every decision, resting when tired, camping at night.
//   await __autoplay('feathertop', 'bungalow', { scenario: 'winter' })
import { ITEMS } from '../data/Items.js';
import { fxOf } from '../systems/InventorySystem.js';

export function installAutoplay(game) {
  // freeze the world at a place for visual checks: await __view('cradle', 'marions', yaw, pitch, dist)
  window.__view = async (m, place, yaw, pitch = 0.25, dist = 30, scen = 'summer', hour = 9) => {
    await game.loadMountain(m, scen);
    const R = game.content.routes[0];
    const pack = { items: { 'pack-50': 1, bottle: 2, shell: 1, fleece: 1, compact: 1 }, supplies: { bars: 1 }, water: 2 };
    const ex = game.newExpedition(R.id, scen, pack, { departHour: hour, seed: 7 });
    const p = game.places[place];
    ex.pos.x = p.x; ex.pos.z = p.z;
    game.beginExpedition(ex);
    ex.timeScale = 0;
    game.weather.at = () => ({ tV: 14, wind: 10, cloud: 0.15, precip: 0, base: 4000 });
    Object.assign(game.rig, { yaw, pitch, dist, first: true });
    for (let i = 0; i < 60; i++) { game.tiles.update(p.x, p.z, 50); game.veg.update(p.x, p.z, 50); }
    game.features.update(p.x, p.z);
    document.getElementById('hud').hidden = true;
    document.getElementById('labels').style.display = 'none';
    return { summitY: Math.round(game.world.height(game.places[game.content.summitPlace].x, game.places[game.content.summitPlace].z)) };
  };
  window.__autoplay = async (mountain, routeId, opts = {}) => {
    const t0 = performance.now();
    await game.loadMountain(mountain, opts.scenario || 'summer');
    const C = game.content, R = C.routes.find(r => r.id === routeId) || C.routes[0];
    const items = {};
    for (const id of [...(R.gear || []), 'pack-70', 'bottle', 'bladder', 'filter', 'firstaid', 'headtorch', 'compact', 'spare-laces', 'emergency-bivvy']) {
      const it = ITEMS[id]; if (!it) continue;
      if (it.slot) for (const x of Object.keys(items)) if (ITEMS[x].slot === it.slot) delete items[x];
      items[id] = it.stack ? Math.min(it.stack, 2) : 1;
    }
    const pack = { items, supplies: { 'trail-mix': 2, bars: 2, lunch: (R.nights || 0) + 2, meal: (R.nights || 0) + 1, fuel: R.nights ? 2 : 0 }, water: 0 };
    pack.water = fxOf(pack).waterL;
    const ex = game.newExpedition(R.id, opts.scenario || 'summer', pack, { departHour: 6, seed: opts.seed ?? 12345 });
    game.beginExpedition(ex);
    ex.timeScale = opts.timeScale || 160;
    game.startFollow(true);
    const H = () => new Date(ex.simT + ex.tz * 3600e3).toISOString().slice(5, 16).replace('T', ' ');
    const log = []; let last = null, done = false, steps = 0;
    const ui = game.ui;
    while (!done && steps < (opts.maxSteps || 60000)) {
      steps++;
      if (ui.modal) {
        const t = document.querySelector('#modal h3')?.textContent;
        const btns = [...document.querySelectorAll('#modal .choice:not([disabled])')];
        const fin = btns.find(b => /Finish the expedition|End the expedition/.test(b.textContent));
        const camp = btns.find(b => /^.*Camp at/.test(b.textContent));
        const pick = fin || (t === 'Take a break' || /Rest|camp/i.test(document.querySelector('#modal .kind')?.textContent || '') ? camp || btns[0] : btns.find(b => !/Turn back|Retreat|Bail|Abandon|Check the map/.test(b.textContent)) || btns[0]);
        log.push(`${H()} [${t}] -> ${pick?.querySelector('b')?.textContent}`);
        pick?.click();
        if (fin) done = true;
        if (game.mode !== 'play' && game.mode !== 'panel') done = true;
        if (game.mode === 'panel') ui.closePanel();
        continue;
      }
      if (!document.getElementById('dialogue').hidden) { document.getElementById('dlg-next')?.click(); continue; }
      if (ex.finished) { done = true; break; }
      if (game.rig.mode === 'photo') { await game.takePhoto(); game.exitPhoto(); log.push(`${H()} photo`); continue; }
      if (ex.resting) { game.simulate(0.1); continue; }
      // camp when the current place allows it and night is near, or a stage ends here
      const camp = game.canCamp();
      const stage = game.route()?.stages?.[ex.stage];
      if (camp && (game.sunsetIn() < 1.2 || (stage && stage.until === camp.id)) && !ex._campedAt?.[camp.id + ex.nights]) {
        ex._campedAt = { ...(ex._campedAt || {}), [camp.id + ex.nights]: 1 };
        if (ex.supplies.water < ex.supplies.waterCap * 0.6) { const src = game.waterSourceNear(); if (src) game.doRefill(src, true); }
        const rise = game.nextSunrise();
        game.startRest('sleep', Math.max(6 * 3600, (rise - 1800000 - ex.simT) / 1000), `Camp at ${camp.name}`, { at: camp.id, tent: !!ex.fx.tent, hut: !!camp.hut, stoveWarm: !!ex.fx.stove });
        log.push(`${H()} CAMP ${camp.name}`);
        continue;
      }
      if (ex.body.energy < 25) { game.eatBest(); game.startRest('rest', 1200, 'Break'); continue; }
      if (ex.supplies.water < 0.5) { const src = game.waterSourceNear(); if (src) { game.doRefill(src, true); log.push(`${H()} refill ${src.name}`); } }
      game.simulate(0.1);
      if (ex.atPlace !== last) { last = ex.atPlace; if (last) log.push(`${H()} @${last}`); }
      if (!ex.follow.active && !ex.resting && !ui.modal && !ex.finished && game.mode === 'play') {
        if (game.currentTarget()) { if (!game.startFollow(true)) { log.push('cannot follow to ' + game.currentTarget()); break; } }
        else { log.push('no target left'); break; }
      }
    }
    const res = { mountain, route: R.id, steps, ms: Math.round(performance.now() - t0), finished: ex.finished?.outcome, summit: !!ex.summit, km: +(ex.stats.distance / 1000).toFixed(1), simH: +((ex.simT - ex.startUtc) / 3.6e6).toFixed(1), nights: ex.nights, stagesDone: ex.stagesDone, body: Object.fromEntries(Object.entries(ex.body).map(([k, v]) => [k, Math.round(v * 10) / 10])), log };
    return res;
  };
}
