// Decision encounters: trigger from the live expedition context, present a view ahead plus resources and
// 2–4 choices, then resolve outcomes from the player's actual state and explain the factors.
import { GENERIC_ENCOUNTERS } from '../data/Events.js';

export { odds } from './odds.js';

export class DecisionEngine {
  constructor(game) { this.game = game; this.active = null; }
  encounters() { return [...GENERIC_ENCOUNTERS, ...(this.game.content.encounters || [])]; }
  context(extra = {}) {
    const g = this.game, ex = g.exp, env = g.lastEnv || g.envAt(ex.pos.x, ex.pos.z);
    return {
      exp: ex, env, fx: ex.fx, body: ex.body, weather: env.weather, y: env.y, temp: env.temp, wind: env.wind, fog: env.fog, dark: env.dark,
      snow: env.snow, exposed: env.exposed, zone: env.zone, onTrail: g.lastOnTrail, moving: g.lastMoving, virtual: g.lastVirtual,
      atPlace: ex.atPlace, scenario: ex.scenario, flags: ex.flags, rand: g.rand, remaining: g.remainingEstimate(), soon: g.weatherSoon(),
      sunsetIn: g.sunsetIn(), hour: g.localHour(), mountain: g.mountain.id, stage: ex.stage, ...extra,
    };
  }
  // called every frame with sim hours elapsed; at most one encounter at a time
  tick(dtH, extra = {}) {
    if (this.game.ui.modalOpen() || this.active) return;
    const ex = this.game.exp, ctx = this.context(extra);
    for (const enc of this.encounters()) {
      const last = ex.eventsAt[enc.id];
      if (last && enc.once) continue;
      if (last && ex.simT - last < (enc.cooldown ?? 4) * 3600000) continue;
      if (enc.scenario && enc.scenario !== ex.scenario) continue;
      let ok = false;
      try { ok = enc.when(ctx); } catch (e) { console.warn('encounter', enc.id, e); }
      if (!ok) continue;
      const p = enc.perHour >= 99 ? 1 : 1 - Math.exp(-enc.perHour * dtH);
      if (this.game.rand() >= p) continue;
      ex.eventsAt[enc.id] = ex.simT;
      this.present(enc, ctx);
      return;
    }
  }
  present(enc, ctx) {
    const g = this.game, ex = g.exp;
    this.active = enc;
    if (ex.follow.active) { ex.follow.active = false; g.followPausedByEvent = true; }
    const view = enc.view === false ? null : g.snapshotAhead();
    const text = typeof enc.text === 'function' ? enc.text(ctx) : enc.text;
    const choices = enc.choices.map(c => {
      const needOk = !c.need || (typeof c.need === 'function' ? c.need(ctx) : ctx.fx[c.need]);
      return {
        label: c.label, sub: (c.sub || '') + (c.need && !needOk ? ` — ${c.needText || 'needs the right gear'}` : '') + (c.cost ? ` · about ${c.cost} min` : ''),
        disabled: !needOk,
        onPick: () => this.resolve(enc, c, ctx),
      };
    });
    g.audio.sting('decision');
    g.ui.encounter({ kind: enc.kind, title: enc.title, text, view, resources: g.resourceLine(), choices, fiction: enc.fiction !== false });
  }
  resolve(enc, choice, ctx) {
    const g = this.game, ex = g.exp;
    const res = choice.resolve ? choice.resolve(ctx, g) || {} : {};
    const fx = res.effects || {};
    const minutes = (choice.cost || 0) + (res.extraMin || 0);
    if (minutes) g.passTime(minutes * 60, fx.restful ? 'rest' : 'decide');
    const b = ex.body;
    for (const k of ['energy', 'hydration', 'warmth']) if (fx[k]) b[k] = Math.max(0, Math.min(100, b[k] + fx[k]));
    if (fx.hunger) b.hunger = Math.max(0, Math.min(100, b.hunger + fx.hunger));
    if (fx.injury) b.injury = Math.min(1, b.injury + fx.injury);
    if (fx.wet) b.wet = Math.min(1, b.wet + fx.wet);
    if (fx.water) ex.supplies.water = Math.max(0, ex.supplies.water + fx.water);
    const damaged = [];
    for (const [slot, amt] of Object.entries(fx.equip || {})) { const n = g.damageSlot(slot, amt); if (n) damaged.push(n); }
    if (fx.flags) Object.assign(ex.flags, fx.flags);
    if (fx.xp) ex.bonusXp = (ex.bonusXp || 0) + fx.xp;
    if (fx.rep) ex.bonusRep = (ex.bonusRep || 0) + fx.rep;
    ex.decisions.push({ simT: ex.simT, title: enc.title, choice: choice.label, outcome: res.headline || '', good: res.good ?? null });
    const after = () => {
      this.active = null;
      if (fx.action === 'retreat') g.turnBack('decision');
      else if (fx.action === 'shelter') g.seekShelter();
      else if (fx.action === 'camp') g.ui.restMenu();
      else if (fx.action === 'photo') g.enterPhoto();
      else if (fx.action === 'water') g.detourToWater();
      else if (fx.action === 'collapse') g.collapse(res.text);
      else if (g.followPausedByEvent && g.cursor) ex.follow.active = true;
      g.followPausedByEvent = false;
      g.autosave('checkpoint');
    };
    if (res.text) {
      g.ui.outcome({ title: res.headline || choice.label, text: res.text, factors: res.why || [], damaged, minutes, good: res.good, onClose: after });
      if (res.good === false) g.audio.sting('fail');
    } else after();
  }
}
