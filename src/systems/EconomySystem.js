// Money: shop purchases, repairs, supply costs, sponsor discounts.
import { ITEMS, SUPPLIES } from '../data/Items.js';
import { rankIndex, RANKS } from '../game/GameState.js';
import { SPONSORS } from './SocialSystem.js';

export function discount(p) {
  let d = 0;
  for (const id of p.sponsors) d = Math.max(d, SPONSORS.find(s => s.id === id)?.discount || 0);
  return d;
}
export function priceOf(p, id) {
  const it = ITEMS[id] || SUPPLIES[id];
  return Math.round(it.price * (1 - discount(p)));
}
export function canBuy(p, id) {
  const it = ITEMS[id];
  if (!it) return { ok: false, why: 'Unknown item' };
  if (it.rank && rankIndex(p) < it.rank) return { ok: false, why: `Requires ${RANKS[it.rank].name}` };
  const max = it.stack || 1;
  if ((p.owned[id] || 0) >= max) return { ok: false, why: it.stack ? 'Carrying limit reached' : 'Owned' };
  if (p.money < priceOf(p, id)) return { ok: false, why: 'Not enough money' };
  return { ok: true };
}
export function buy(p, id) {
  const c = canBuy(p, id);
  if (!c.ok) return c;
  p.money -= priceOf(p, id);
  p.owned[id] = (p.owned[id] || 0) + 1;
  p.condition[id] = 100;
  return { ok: true };
}
export function sell(p, id) {
  const it = ITEMS[id];
  if (!p.owned[id] || it.starter === true) return { ok: false };
  const value = Math.round(it.price * 0.4 * (p.condition[id] ?? 100) / 100);
  p.owned[id] -= 1;
  if (!p.owned[id]) delete p.owned[id];
  p.money += value;
  return { ok: true, value };
}
export function repairCost(p, id) {
  const it = ITEMS[id];
  const missing = 100 - (p.condition[id] ?? 100);
  return Math.round(Math.max(it.price, 60) * 0.006 * missing * (1 - discount(p)));
}
export function repair(p, id) {
  const c = repairCost(p, id);
  if (!c || p.money < c) return false;
  p.money -= c; p.condition[id] = 100;
  return true;
}
export function suppliesCost(p, supplies) {
  let c = 0;
  for (const [id, n] of Object.entries(supplies)) if (SUPPLIES[id]) c += priceOf(p, id) * n;
  return c;
}
export function refillFirstAidCost() { return 15; }
