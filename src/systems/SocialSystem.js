// Ridgeline: a fictional in-game photo-sharing platform. Nothing connects to real social media.
// Engagement depends on photo score, novelty versus earlier posts, caption effort and current followers.
import { rng } from './Weather.js';

export const SPONSORS = [
  { id: 'southern-cross', name: 'Southern Cross Outdoors', followers: 400, rep: 15, discount: 0.10, desc: '10% off all shop gear.' },
  { id: 'kiewa-coffee', name: 'Kiewa Valley Coffee Roasters', followers: 1100, rep: 35, pay: 120, desc: '$120 for every completed expedition.' },
  { id: 'highland-optics', name: 'Highland Optics', followers: 2600, rep: 70, discount: 0.15, gift: 'compact', desc: 'A rugged compact camera and 15% off.' },
  { id: 'tasman-fund', name: 'Tasman Expeditions Fund', followers: 5500, rep: 130, pay: 380, desc: '$380 expedition funding per completed expedition.' },
  { id: 'aurora-apparel', name: 'Aurora Apparel', followers: 9000, rep: 220, discount: 0.20, cosmetics: ['glacier', 'forest', 'sunrise'], desc: '20% off and signature jacket colours.' },
];
export const JACKETS = { ember: 0xb5502b, glacier: 0x3f7fb5, forest: 0x2f6a45, sunrise: 0xd9a03a };

const COMMENTS = [
  'Unreal light up there.', 'This is going straight on my list.', 'How long did the climb take?', 'That ridge though!', 'Bucket list.',
  'Was it windy on top?', 'Proper wilderness.', 'Love the composition.', 'Goals.', 'Looks freezing — worth it?', 'Saving this for my next trip.',
  'The clouds!', 'Mum, look where they went.', 'Respect for carrying that pack.', 'Did you see anyone else up there?',
];

export function similarity(post, prev) {
  let s = 0;
  if (post.mountain === prev.mountain) s += 0.5;
  if (post.subject && post.subject === prev.subject) s += 0.4;
  if (post.place && post.place === prev.place) s += 0.3;
  return Math.min(1, s);
}

export function publish(p, photo, caption) {
  const r = rng((photo.simT ^ (p.posts.length * 7919)) >>> 0);
  const recent = p.posts.slice(-12);
  const sim = recent.reduce((s, prev) => s + similarity(photo, prev), 0);
  const novelty = 1 / (1 + sim * 0.55);
  const sameTrip = p.posts.filter(x => x.expId === photo.expId).length;
  const burst = Math.pow(0.8, Math.max(0, sameTrip - 2));
  const len = caption.trim().length;
  const captionK = len < 5 ? 0.85 : len < 20 ? 0.95 : len <= 220 ? 1.08 : 1.0;
  const quality = Math.pow(photo.score / 60, 2.2);
  const likes = Math.round((p.followers * 0.09 + 25) * quality * novelty * burst * captionK * (0.8 + r() * 0.4));
  const followers = Math.round(likes * 0.14 * novelty + (photo.score > 85 ? 20 : 0));
  const money = Math.round(likes * 0.04);
  const rep = Math.round((photo.score / 18) * novelty * 10) / 10;
  const n = Math.min(4, 1 + Math.floor(likes / 60));
  const comments = Array.from({ length: n }, () => COMMENTS[Math.floor(r() * COMMENTS.length)]);
  const post = { id: 'post-' + Date.now().toString(36), photoId: photo.id, expId: photo.expId, mountain: photo.mountain, subject: photo.subject, place: photo.place, caption: caption.slice(0, 280), at: Date.now(), likes, followers, money, rep, comments, novelty: Math.round(novelty * 100) };
  p.posts.push(post);
  photo.published = post.id;
  p.followers += followers; p.money += money; p.reputation += rep;
  p.stats.photosPublished++; p.stats.moneyEarned += money;
  return post;
}

export function sponsorOffers(p) {
  const fresh = [];
  for (const s of SPONSORS) {
    if (p.sponsors.includes(s.id) || p.sponsorOffers.includes(s.id)) continue;
    if (p.followers >= s.followers && p.reputation >= s.rep) { p.sponsorOffers.push(s.id); fresh.push(s); }
  }
  return fresh;
}
export function acceptSponsor(p, id) {
  const s = SPONSORS.find(x => x.id === id);
  if (!s) return;
  p.sponsorOffers = p.sponsorOffers.filter(x => x !== id);
  p.sponsors.push(id);
  if (s.gift && !p.owned[s.gift]) { p.owned[s.gift] = 1; p.condition[s.gift] = 100; }
  for (const c of s.cosmetics || []) if (!p.unlockedCosmetics.includes(c)) p.unlockedCosmetics.push(c);
}
export function sponsorPay(p) {
  return p.sponsors.map(id => SPONSORS.find(s => s.id === id)).filter(s => s?.pay).map(s => ({ name: s.name, amount: s.pay }));
}
