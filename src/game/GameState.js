// Central persistent state: the player's career profile plus the active expedition (if any).
// Everything the UI, economy, survival and progression systems read or change lives here.
import { ITEMS } from '../data/Items.js';

export const PROFILE_VERSION = 2;

export function newProfile(name = 'You') {
  const owned = {}, condition = {};
  for (const [id, it] of Object.entries(ITEMS)) if (it.starter) { owned[id] = it.starter === true ? 1 : it.starter; condition[id] = 100; }
  return {
    v: PROFILE_VERSION, createdAt: Date.now(), name,
    money: 450, xp: 0, followers: 35, reputation: 0,
    owned, condition,                     // durable gear and its condition (0..100), persists across expeditions
    cosmetics: { jacket: 'ember' }, unlockedCosmetics: ['ember'],
    unlocked: ['kosciuszko'],
    completed: {},                        // id -> { attempts, summits, objective, best: { score, simSec, route } }
    history: [],                          // expedition summaries (newest last)
    photos: [],                           // photo meta; images live in IndexedDB (SaveSystem)
    posts: [],                            // published posts
    sponsors: [],                         // accepted sponsor ids
    sponsorOffers: [],
    achievements: {},                     // id -> timestamp
    stats: { expeditions: 0, summits: 0, abandoned: 0, assisted: 0, photosTaken: 0, photosPublished: 0, moneyEarned: 0, distance: 0, ascent: 0, simSeconds: 0, landmarks: 0 },
    mentor: { seen: {} },
    freeRoam: false,
    settings: {
      master: 0.8, music: 0.45, sfx: 0.8, ambience: 0.8, mute: false,
      quality: 'high', sensitivity: 1, invertY: false, pacing: 'standard', labels: true, captions: true, autoSip: true, autoSnack: true,
    },
    active: null,                         // in-progress expedition state (see ExpeditionManager.newExpedition)
  };
}

export const RANKS = [
  { id: 'beginner', name: 'Beginner', xp: 0 },
  { id: 'explorer', name: 'Trail Explorer', xp: 300 },
  { id: 'adventurer', name: 'Alpine Adventurer', xp: 900 },
  { id: 'specialist', name: 'Mountain Specialist', xp: 2000 },
  { id: 'leader', name: 'Expedition Leader', xp: 3800 },
  { id: 'elite', name: 'Elite Mountaineer', xp: 6500, needs: 'arthurs' },
];
export function rankIndex(p) {
  let r = 0;
  RANKS.forEach((k, i) => { if (p.xp >= k.xp && (!k.needs || p.completed[k.needs]?.objective)) r = i; });
  return r;
}
export function rankOf(p) { return RANKS[rankIndex(p)]; }

// pacing setting -> sim seconds per real second while moving
export const PACING = { short: { k: 14, name: 'Short' }, standard: { k: 8, name: 'Standard' }, long: { k: 5, name: 'Long' } };

// tiny event bus so UI panels can refresh when state changes
const subs = new Set();
export function onChange(fn) { subs.add(fn); return () => subs.delete(fn); }
export function changed(what) { for (const f of subs) { try { f(what); } catch (e) { console.error(e); } } }
