// What the player carries: one item per slot (pack, insulation, shell, boots, tent, bag, camera), any
// number of other owned items, plus consumable supplies. Aggregates item effects (fx) for the simulation.
import { ITEMS, SUPPLIES } from '../data/Items.js';

export const PORTIONS = { 'trail-mix': 8, bars: 6, lunch: 4, meal: 1 };

export function defaultPack(profile) {
  const items = {};
  const bestInSlot = {};
  for (const [id, n] of Object.entries(profile.owned)) {
    const it = ITEMS[id];
    if (!it || !n) continue;
    if (it.slot) { if (!bestInSlot[it.slot] || it.price > ITEMS[bestInSlot[it.slot]].price) bestInSlot[it.slot] = id; }
    else if (!['axe', 'rope'].includes(id)) items[id] = n;
  }
  for (const id of Object.values(bestInSlot)) items[id] = 1;
  return { items, supplies: { 'trail-mix': 1, bars: 1, lunch: 1 }, water: 0 };
}

export function fxOf(pack) {
  const fx = { capacityKg: 9, comfort: 1, insulation: 0, insulationMove: 0, waterproof: 0, windproof: 0, rough: 0.75, grip: 0.7, wearRate: 1.6, waterL: 0, nav: 0, sleepWarm: 0, tent: 0, tentWarm: 0, camera: 0, zoom: 1, torch: 0, firstaid: 0, repair: 0, scrub: 1, sleepRecover: 1, tough: 1 };
  for (const [id, n] of Object.entries(pack.items)) {
    const it = ITEMS[id];
    if (!it || !n) continue;
    for (const [k, v] of Object.entries(it.fx)) {
      if (typeof v === 'boolean') fx[k] = fx[k] || v;
      else if (['waterL', 'sleepWarm', 'firstaid', 'repair'].includes(k)) fx[k] += v * (it.stack ? n : 1);
      else if (['nav', 'tent', 'torch'].includes(k)) fx[k] = Math.max(fx[k], v);
      else if (it.slot || ['scrub'].includes(k)) fx[k] = v;
      else fx[k] = v;
    }
    if (it.slot === 'insulation' && it.fx.insulationMove === undefined) fx.insulationMove = it.fx.insulation;
  }
  return fx;
}

export function gearWeight(pack) {
  let kg = 2.2;  // clothes worn, small essentials
  for (const [id, n] of Object.entries(pack.items)) { const it = ITEMS[id]; if (it && n) kg += it.kg * (it.stack ? n : 1); }
  return kg;
}
export function suppliesWeight(pack) {
  let kg = 0;
  for (const [id, n] of Object.entries(pack.supplies)) { const s = SUPPLIES[id]; if (s && n) kg += s.kg * n; }
  return kg;
}
export function packWeight(pack) { return gearWeight(pack) + suppliesWeight(pack) + (pack.water || 0); }
export function packKcal(pack) { let k = 0; for (const [id, n] of Object.entries(pack.supplies)) if (SUPPLIES[id]?.kcal) k += SUPPLIES[id].kcal * n; return k; }

// live weight during an expedition (food eaten, water drunk, fuel burnt)
export function liveWeight(exp) {
  let kg = gearWeight(exp.pack) + exp.supplies.water + exp.supplies.fuel / 1000 * 1.6;
  for (const [id, n] of Object.entries(exp.supplies.food)) if (SUPPLIES[id]) kg += SUPPLIES[id].kg / PORTIONS[id] * n;
  return kg;
}
export function foodPortions(pack) {
  const food = {};
  for (const [id, n] of Object.entries(pack.supplies)) if (PORTIONS[id]) food[id] = n * PORTIONS[id];
  return food;
}
export function portionKcal(id) { return SUPPLIES[id].kcal / PORTIONS[id]; }

// carried durable items whose condition matters
export const WEARABLE_SLOTS = ['boots', 'shell', 'pack', 'tent'];
export function carriedDurables(pack) { return Object.keys(pack.items).filter(id => ITEMS[id] && WEARABLE_SLOTS.includes(ITEMS[id].slot)); }
export function equipmentCondition(exp) {
  const ids = carriedDurables(exp.pack);
  if (!ids.length) return 100;
  const w = { boots: 1.4, shell: 1, pack: 0.8, tent: 0.8 };
  let s = 0, t = 0;
  for (const id of ids) { const k = w[ITEMS[id].slot]; s += (exp.condition[id] ?? 100) * k; t += k; }
  return s / t;
}
export function slotItem(pack, slot) { return Object.keys(pack.items).find(id => ITEMS[id]?.slot === slot) || null; }
