// XP, money rewards, unlocks and achievements.
import { CAMPAIGN, byId } from '../expedition/MountainData.js';
import { rankIndex, RANKS } from './GameState.js';

export function unlockStatus(p, m) {
  const u = m.unlock;
  if (u.always || p.unlocked.includes(m.id)) return { open: true, reasons: [] };
  const rank = rankIndex(p);
  const reasons = [];
  const prev = p.completed[u.prev];
  if (!prev || !(prev.objective || prev.summits)) reasons.push({ ok: false, text: `Complete ${byId[u.prev].name}` }); else reasons.push({ ok: true, text: `Completed ${byId[u.prev].name}` });
  reasons.push({ ok: p.xp >= u.xp, text: `${u.xp} XP (you have ${Math.floor(p.xp)})` });
  if (u.milestone) reasons.push({ ok: !!u.milestone.test(p, rank), text: u.milestone.label });
  return { open: reasons.every(r => r.ok), reasons };
}
export function refreshUnlocks(p) {
  const fresh = [];
  for (const m of CAMPAIGN) if (!p.unlocked.includes(m.id) && unlockStatus(p, m).open) { p.unlocked.push(m.id); fresh.push(m); }
  return fresh;
}

// Rewards for a finished expedition. `r` is the expedition result built by ExpeditionManager.finish.
export function computeRewards(p, r) {
  const m = byId[r.mountain];
  const lines = [];
  let xp = 0, money = 0;
  const add = (label, x, $ = 0) => { if (!x && !$) return; xp += x; money += $; lines.push({ label, xp: Math.round(x), money: Math.round($) }); };
  const routeMult = r.route.rewardMult || 1;
  if (r.outcome === 'complete') add('Expedition completed', m.rewards.xp * 0.5 * routeMult, m.rewards.money * 0.6 * routeMult);
  else if (r.outcome === 'retreat') add('Safe retreat', m.rewards.xp * 0.25, m.rewards.money * 0.15);
  else if (r.outcome === 'assisted') add('Expedition ended with assistance', m.rewards.xp * 0.1, 0);
  if (r.summit) add(m.multiStage ? 'Traverse objective reached' : 'Summit reached', m.rewards.xp * 0.4 * routeMult, m.rewards.money * 0.4 * routeMult);
  if (r.landmarksNew) add(`${r.landmarksNew} new landmarks discovered`, r.landmarksNew * 15);
  if (r.photos) add(`${r.photos} photographs`, Math.min(80, r.photos * 8));
  if (r.objectivesDone) add(`${r.objectivesDone} optional objectives`, r.objectivesDone * 40, r.objectivesDone * 30);
  if (r.prepared) add('Well prepared (essentials packed)', 40);
  if (r.supplyScore > 0.6) add('Good supply management', 30 + 30 * r.supplyScore);
  if (r.outcome !== 'assisted' && r.summit) add('Finished without assistance', 25);
  if (r.stagesDone && m.multiStage) add(`${r.stagesDone} traverse stages`, r.stagesDone * 60, r.stagesDone * 40);
  // sponsors pay per expedition
  for (const s of r.sponsorPay || []) add(`Sponsor: ${s.name}`, 0, s.amount);
  if (r.assistCost) add('Assistance and recovery costs', 0, -r.assistCost);
  return { xp: Math.round(xp), money: Math.round(money), lines };
}

export const ACHIEVEMENTS = [
  { id: 'first-summit', name: 'Top of the Country', desc: 'Reach the summit of Mount Kosciuszko.', test: p => p.completed.kosciuszko?.summits },
  { id: 'razorback', name: 'Razorback', desc: 'Summit Mount Feathertop.', test: p => p.completed.feathertop?.summits },
  { id: 'winter', name: 'White Feather', desc: 'Summit Feathertop in a winter scenario.', test: p => p.history.some(h => h.mountain === 'feathertop' && h.summit && h.winter) },
  { id: 'bogong', name: 'Big Fella', desc: "Summit Victoria's highest peak.", test: p => p.completed.bogong?.summits },
  { id: 'tassie', name: 'Island Wilderness', desc: 'Complete any Tasmanian expedition.', test: p => ['cradle', 'ossa', 'frenchmans', 'federation', 'arthurs'].some(id => p.completed[id]?.objective) },
  { id: 'federation', name: 'The Spire', desc: 'Summit Federation Peak.', test: p => p.completed.federation?.summits },
  { id: 'arthurs', name: 'Traverse', desc: 'Complete the Western Arthurs traverse.', test: p => p.completed.arthurs?.objective },
  { id: 'wise-retreat', name: 'Live to Climb Again', desc: 'Retreat safely in bad weather.', test: p => p.history.some(h => h.outcome === 'retreat' && h.badWeather) },
  { id: 'night-walk', name: 'Head Torch Hero', desc: 'Walk more than 2 km after dark in one expedition.', test: p => p.history.some(h => h.nightKm >= 2) },
  { id: 'photo-90', name: 'Cover Shot', desc: 'Take a photo scoring 90 or more.', test: p => p.photos.some(ph => ph.score >= 90) },
  { id: 'followers-1k', name: 'Rising Star', desc: 'Reach 1,000 followers on Ridgeline.', test: p => p.followers >= 1000 },
  { id: 'followers-10k', name: 'Household Name', desc: 'Reach 10,000 followers.', test: p => p.followers >= 10000 },
  { id: 'sponsor', name: 'Backed', desc: 'Sign your first sponsor.', test: p => p.sponsors.length > 0 },
  { id: 'all-eight', name: 'Beyond the Track', desc: 'Complete all eight expeditions.', test: p => CAMPAIGN.every(m => p.completed[m.id]?.objective) },
  { id: 'light', name: 'Fast and Light', desc: 'Complete an overnight expedition with a pack under 11 kg.', test: p => p.history.some(h => h.outcome === 'complete' && h.nights >= 1 && h.packKg < 11) },
  { id: 'rank-elite', name: 'Elite', desc: 'Reach Elite Mountaineer.', test: p => rankIndex(p) === RANKS.length - 1 },
];
export function checkAchievements(p) {
  const fresh = [];
  for (const a of ACHIEVEMENTS) if (!p.achievements[a.id] && a.test(p)) { p.achievements[a.id] = Date.now(); fresh.push(a); }
  return fresh;
}
