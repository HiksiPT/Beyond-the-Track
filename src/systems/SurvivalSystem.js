// The five survival indicators and the pace model. Game numbers, plausible but not physiology advice.
//   energy     0..100  drains with effort, recovers with rest/sleep (slower when hungry)
//   hydration  0..100  drains with time/exertion/heat; topped up from carried water
//   hunger     0..100  rises with calories burnt (0 = well fed); food lowers it
//   warmth     0..100  heat balance of temperature, wind, wetness, clothing, activity, shelter
//   equipment  0..100  weighted condition of carried boots, shell, pack and tent
import { toblerKmh } from '../expedition/RoutePlanner.js';
import { fxOf, liveWeight, equipmentCondition, slotItem, portionKcal, PORTIONS } from './InventorySystem.js';
import { ITEMS, SUPPLIES } from '../data/Items.js';

export function newBody() { return { energy: 100, hydration: 100, hunger: 10, warmth: 85, injury: 0, wet: 0, awake: 0, blister: 0 }; }

export const WARN = { energy: 25, hydration: 30, hunger: 70, warmth: 30, equipment: 30 };

export function indicators(exp) {
  const b = exp.body;
  return { energy: b.energy, hydration: b.hydration, hunger: b.hunger, warmth: b.warmth, equipment: equipmentCondition(exp) };
}

// walking speed (sim m/s) with reasons, from terrain, gear, body, light and weather
export function paceModel(exp, ctx) {
  const fx = exp.fx || (exp.fx = fxOf(exp.pack));
  const why = [];
  const kmh = toblerKmh(ctx.grade);
  let m = 1;
  const roughGround = !ctx.onTrail || ctx.zone.rock > 0.4 || /demanding|alpine/.test(ctx.sac);
  if (!ctx.onTrail) {
    const veg = ctx.zone.forest > 0.5 ? 0.35 : ctx.zone.moor > 0.5 ? 0.45 : ctx.zone.woodland > 0.5 ? 0.55 : ctx.zone.rock > 0.5 ? 0.5 : 0.75;
    const scrub = ctx.zone.forest > 0.5 || ctx.zone.moor > 0.5 ? (fx.scrub < 1 ? 1.15 : 1) : 1;
    m *= 0.6 * veg * scrub; why.push('off-track');
  } else if (ctx.virtual) { m *= 0.5; why.push('scramble'); }
  else if (/demanding|alpine/.test(ctx.sac)) { m *= 0.8; why.push('rough track'); }
  if (roughGround) { m *= 0.7 + 0.3 * fx.rough; if (fx.rough < 0.85) why.push('poor footwear'); }
  const bootsId = slotItem(exp.pack, 'boots');
  if (bootsId && (exp.condition[bootsId] ?? 100) < 30) { m *= 0.88; why.push('worn boots'); }
  if (ctx.wetRock && roughGround) { m *= 0.75 + 0.25 * fx.grip; why.push('wet rock'); }
  m *= exp.pushing ? 1.22 : ({ relaxed: 0.85, steady: 1, push: 1.12 }[exp.pace] || 1);
  const kg = liveWeight(exp);
  const load = Math.max(0.5, 1 - Math.max(0, kg - 5) * 0.018 / fx.comfort);
  if (load < 0.95) why.push(`pack ${kg.toFixed(1)} kg`);
  if (kg > fx.capacityKg) { m *= 0.85; why.push('overloaded'); }
  m *= load;
  const b = exp.body;
  const ef = 0.5 + 0.5 * Math.min(1, Math.max(0, (b.energy - 5) / 40));
  if (ef < 0.97) why.push('tired');
  m *= ef;
  if (b.hunger > 75) { m *= 0.85; why.push('hungry'); }
  if (b.hydration < 30) { m *= 0.8; why.push('dehydrated'); }
  if (b.warmth < 25) { m *= 0.8; why.push('very cold'); }
  if (b.injury > 0.05) { m *= 1 - 0.5 * b.injury; why.push('injured'); }
  if (ctx.dark) { const lit = fx.torch && exp.supplies.torch > 0; m *= lit ? 0.6 : 0.22; why.push(lit ? 'head torch' : 'darkness'); }
  if (ctx.fog && (!ctx.onTrail || ctx.zone.alpine > 0.5)) { const f = [0.55, 0.65, 0.8, 0.9][fx.nav]; m *= f; why.push('cloud'); }
  if (ctx.snow) { m *= fx.spikes ? 0.85 : 0.55 + 0.15 * fx.grip; why.push('snow'); }
  if (ctx.wind > 55 && ctx.exposed) { m *= 0.8; why.push('wind'); }
  if (ctx.grade < -0.12 && fx.poles) m *= 1.07;
  const mps = kmh * m / 3.6;
  return { mps, kmh: kmh * m, why, blocked: ctx.slopeDeg > 44 && !ctx.onTrail };
}

export function effortOf(exp, mps, grade) {
  const fx = exp.fx;
  const kg = liveWeight(exp);
  let e = (mps * 3.6 / 4.5) * (1 + Math.max(0, grade) * 7 + Math.max(0, -grade - 0.15) * (fx.poles ? 1.2 : 2.2)) * (0.85 + kg / 60 / fx.comfort);
  if (exp.pushing) e *= 1.45;
  return e;
}

// advance by dt sim-seconds. activity: 'move' | 'rest' | 'sleep' | 'idle'
export function tickBody(exp, dt, env, activity, effort, settings = {}) {
  const b = exp.body, s = exp.supplies, fx = exp.fx || (exp.fx = fxOf(exp.pack)), h = dt / 3600;
  // hydration
  const need = (0.12 + 0.38 * effort + Math.max(0, env.temp - 18) * 0.035) * h * (activity === 'sleep' ? 0.4 : 1);
  b.hydration -= need / 2.6 * 100;
  if (settings.autoSip !== false && b.hydration < 88 && s.water > 0 && activity !== 'sleep') {
    const drink = Math.min(s.water, (88 - b.hydration) / 100 * 2.6, 0.6 * h + 0.02);
    s.water -= drink; b.hydration += drink / 2.6 * 100;
  }
  // hunger / food
  const kcal = (75 + 330 * effort + (b.warmth < 45 ? 70 : 0)) * h;
  b.hunger += kcal / 18;
  if (settings.autoSnack !== false && b.hunger > 55 && activity !== 'sleep') autoEat(exp);
  // energy
  const hungerDrag = 1 + Math.max(0, b.hunger - 50) / 100;
  const recover = (b.hunger > 75 ? 0.5 : 1) * (b.hydration < 30 ? 0.6 : 1);
  if (activity === 'move') b.energy -= (4 + 18 * effort) * h * hungerDrag;
  else if (activity === 'rest') b.energy += 75 * h * recover;
  else if (activity === 'sleep') b.energy += 28 * h * recover * fx.sleepRecover * (exp.camp?.cold ? 0.6 : 1);
  else b.energy += 20 * h * recover;
  // warmth
  const exposedWind = env.exposed ? env.wind : env.wind * 0.3;
  const shellOk = (exp.condition[slotItem(exp.pack, 'shell')] ?? 0) > 15;
  const chill = Math.max(0, exposedWind - 5) * 0.22 * (1 - (shellOk ? fx.windproof : 0));
  let clothing = activity === 'move' ? fx.insulationMove * 0.6 : fx.insulation;
  if (b.wet > 0.4 && !fx.wetOk) clothing *= 0.6;
  if (activity === 'sleep') clothing += (exp.camp?.tent ? 6 + fx.tentWarm : 0) + fx.sleepWarm + (exp.camp?.hut ? 4 : 0) + (exp.camp?.bivvy ? 4 : 0);
  if (activity === 'rest' && exp.camp?.hut) clothing += 5;
  if (exp.camp?.stoveWarm) clothing += 3;
  const metabolic = activity === 'move' ? 6 + effort * 7 : activity === 'sleep' ? 2 : 0;
  const app = env.temp - chill + clothing + metabolic - b.wet * 7;
  const target = 100 * Math.min(1, Math.max(0, (app + 4) / 20));
  b.warmth += (target - b.warmth) * Math.min(1, 0.6 * h);
  // wetness
  const sheltered = exp.camp?.tent || exp.camp?.hut;
  if (env.precip > 0.05 && !sheltered) b.wet = Math.min(1, b.wet + (1 - (shellOk ? fx.waterproof : 0)) * env.precip * 0.5 * h);
  else b.wet = Math.max(0, b.wet - (activity === 'move' ? 0.25 : 0.15) * h);
  // sleep debt, healing
  if (activity === 'sleep') b.awake = Math.max(0, b.awake - h * 2.2); else b.awake += h;
  if (b.injury > 0 && activity !== 'move') b.injury = Math.max(0, b.injury - 0.025 * h);
  for (const k of ['hydration', 'energy', 'warmth']) b[k] = Math.max(0, Math.min(100, b[k]));
  b.hunger = Math.max(0, Math.min(100, b.hunger));
  if (env.dark && activity === 'move' && fx.torch) s.torch = Math.max(0, s.torch - h);
}

export function eatPortion(exp, id) {
  const s = exp.supplies;
  if (!s.food[id]) return { ok: false, why: 'None left' };
  const sup = SUPPLIES[id];
  if (sup.hot && (!exp.fx.stove || s.fuel < 25)) return { ok: false, why: 'Needs the stove and fuel' };
  s.food[id] -= 1;
  const kcal = portionKcal(id);
  exp.body.hunger = Math.max(0, exp.body.hunger - kcal / 18 * (id === 'lunch' ? 1.15 : 1));
  if (sup.quick) exp.body.energy = Math.min(100, exp.body.energy + 6);
  if (sup.hot) { s.fuel -= 25; exp.body.warmth = Math.min(100, exp.body.warmth + 12); exp.body.energy = Math.min(100, exp.body.energy + 8); }
  return { ok: true, kcal };
}
function autoEat(exp) {
  for (const id of ['bars', 'trail-mix', 'lunch']) if (exp.supplies.food[id] > 0) { eatPortion(exp, id); exp.log?.(`snack ${id}`); return true; }
  return false;
}
export function foodLeftKcal(exp) { let k = 0; for (const [id, n] of Object.entries(exp.supplies.food)) if (PORTIONS[id]) k += n * portionKcal(id); return k; }

export function wearGear(exp, metres, ctx) {
  const km = metres / 1000, fx = exp.fx;
  const boots = slotItem(exp.pack, 'boots'), shell = slotItem(exp.pack, 'shell'), pack = slotItem(exp.pack, 'pack');
  const rough = !ctx.onTrail || ctx.zone.rock > 0.5 || ctx.virtual;
  if (boots) exp.condition[boots] = Math.max(0, exp.condition[boots] - km * (rough ? 0.9 : 0.16) * fx.wearRate * (fx.scrub < 1 && !ctx.onTrail ? 0.7 : 1));
  if (shell && !ctx.onTrail && (ctx.zone.forest > 0.4 || ctx.zone.moor > 0.4)) exp.condition[shell] = Math.max(0, exp.condition[shell] - km * 2.2 / fx.tough);
  if (pack && rough) exp.condition[pack] = Math.max(0, exp.condition[pack] - km * 0.3);
  if (boots && exp.condition[boots] < 35) exp.body.blister = Math.min(1, exp.body.blister + km * 0.05);
}
export function damageItem(exp, slot, amount) {
  const id = slotItem(exp.pack, slot);
  if (!id) return null;
  exp.condition[id] = Math.max(0, (exp.condition[id] ?? 100) - amount);
  return ITEMS[id].name;
}
