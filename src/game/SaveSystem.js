// Persistence: the profile (including any active expedition) in localStorage with a rolling backup,
// version migration and corruption recovery; photo images in IndexedDB (falls back to localStorage).
import { newProfile, PROFILE_VERSION } from './GameState.js';

const KEY = 'btt.profile';
const BACKUP = 'btt.profile.backup';
const SLOTS = ['slot1', 'slot2', 'slot3'];

function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } }

export function migrate(p) {
  if (!p || typeof p !== 'object') throw new Error('empty');
  const base = newProfile(p.name);
  // v1 -> v2: settings and stats gained fields; fill anything missing from the defaults
  for (const k of Object.keys(base)) if (p[k] === undefined) p[k] = base[k];
  for (const k of Object.keys(base.settings)) if (p.settings[k] === undefined) p.settings[k] = base.settings[k];
  for (const k of Object.keys(base.stats)) if (p.stats[k] === undefined) p.stats[k] = base.stats[k];
  if (p.active && (typeof p.active !== 'object' || !p.active.mountain || !p.active.pos)) p.active = null;
  p.v = PROFILE_VERSION;
  return p;
}

export function loadProfile() {
  const notes = [];
  for (const k of [KEY, BACKUP]) {
    const raw = safeGet(k);
    if (!raw) continue;
    try {
      const p = migrate(JSON.parse(raw));
      if (k === BACKUP) notes.push('The main save was damaged; restored the previous autosave.');
      return { profile: p, notes };
    } catch (e) {
      notes.push(`A save (${k}) could not be read and was skipped.`);
      safeSet(KEY + '.corrupt.' + Date.now(), raw);   // keep the bad data for inspection
    }
  }
  return { profile: null, notes };
}

let lastWrite = 0;
export function saveProfile(p) {
  const json = JSON.stringify(p);
  const prev = safeGet(KEY);
  // rotate the previous good save into the backup slot at most every 30 s
  if (prev && Date.now() - lastWrite > 30000) safeSet(BACKUP, prev);
  const ok = safeSet(KEY, json);
  lastWrite = Date.now();
  return ok;
}
export function hasProfile() { return !!safeGet(KEY) || !!safeGet(BACKUP); }
export function wipeProfile() { try { localStorage.removeItem(KEY); localStorage.removeItem(BACKUP); } catch {} }

export function listSlots() {
  return SLOTS.map(id => {
    const raw = safeGet('btt.' + id);
    if (!raw) return { id, meta: null };
    try { const d = JSON.parse(raw); return { id, meta: d.meta, savedAt: d.savedAt }; } catch { return { id, meta: { broken: true } }; }
  });
}
export function writeSlot(id, p, meta) { return safeSet('btt.' + id, JSON.stringify({ savedAt: Date.now(), meta, profile: p })); }
export function readSlot(id) {
  const raw = safeGet('btt.' + id);
  if (!raw) return null;
  try { return migrate(JSON.parse(raw).profile); } catch { return null; }
}

export function exportProfile(p, photos) {
  const blob = new Blob([JSON.stringify({ app: 'beyond-the-track', v: PROFILE_VERSION, exportedAt: new Date().toISOString(), profile: p, photos })], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `beyond-the-track-save-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export async function importProfile(file) {
  const d = JSON.parse(await file.text());
  if (d.app !== 'beyond-the-track' || !d.profile) throw new Error('This is not a Beyond the Track save file.');
  for (const ph of d.photos || []) await putImage(ph.id, ph.img);
  return migrate(d.profile);
}

// ---- photo images ----
let dbp = null;
function db() {
  if (!dbp) dbp = new Promise((res, rej) => {
    try {
      const r = indexedDB.open('btt-photos', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('img');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    } catch (e) { rej(e); }
  });
  return dbp;
}
export async function putImage(id, dataUrl) {
  try {
    const d = await db();
    await new Promise((res, rej) => { const t = d.transaction('img', 'readwrite'); t.objectStore('img').put(dataUrl, id); t.oncomplete = res; t.onerror = () => rej(t.error); });
  } catch { safeSet('btt.img.' + id, dataUrl); }
}
const cache = new Map();
export async function getImage(id) {
  if (cache.has(id)) return cache.get(id);
  let v = null;
  try {
    const d = await db();
    v = await new Promise((res, rej) => { const r = d.transaction('img').objectStore('img').get(id); r.onsuccess = () => res(r.result || null); r.onerror = () => rej(r.error); });
  } catch { v = null; }
  v = v || safeGet('btt.img.' + id);
  if (v) cache.set(id, v);
  return v;
}
export async function allImages(ids) { const out = []; for (const id of ids) out.push({ id, img: await getImage(id) }); return out; }
