// Gallery and the fictional Ridgeline platform: select a photo, caption it, publish, watch engagement.
import { getImage, saveProfile } from '../game/SaveSystem.js';
import { publish, sponsorOffers, acceptSponsor, SPONSORS, similarity } from '../systems/SocialSystem.js';
import { checkAchievements } from '../game/Progression.js';
import { fmtClock } from '../systems/Weather.js';
import { esc } from './UI.js';

let selected = null;

export async function socialTab(game, body, rerender) {
  const p = game.profile;
  sponsorOffers(p);
  const unpublished = p.photos.filter(ph => !ph.published).slice().reverse();
  const posts = p.posts.slice().reverse();
  body.innerHTML = `
    ${p.sponsorOffers.length ? `<div class="card"><h3>Sponsor offers</h3>${p.sponsorOffers.map(id => { const s = SPONSORS.find(x => x.id === id); return `<p><b>${esc(s.name)}</b> — ${esc(s.desc)} <button class="btn small primary" data-accept="${id}">Accept</button></p>`; }).join('')}</div>` : ''}
    <div class="grid2" style="grid-template-columns:1.2fr 1fr">
      <div class="card"><h3>Gallery <span class="fine">${p.photos.length} photos · ${unpublished.length} unpublished</span></h3>
        <div class="gallery" id="gal">${unpublished.map(ph => `<button class="photo ${selected === ph.id ? 'sel' : ''}" data-ph="${ph.id}"><img data-img="${ph.id}" alt="Photo at ${esc(ph.place)}"><div class="meta"><span class="score">${ph.score}</span><span class="rar ${ph.rarityLabel}">${ph.rarityLabel}</span>${ph.summit ? ' <span class="ok mono" style="font-size:10px">SUMMIT</span>' : ''}<br>${esc(ph.mountainName)} · ${esc(ph.place)}<br><span class="dim">${esc(ph.weather)} · ${fmtClock(ph.simT, ph.tz)}</span></div></button>`).join('') || '<p class="dim">No unpublished photos. Press P on the mountain to use the camera.</p>'}</div></div>
      <div><div class="card"><div class="ridgeline">Ridge<span>line</span></div><p class="fine">A fictional in-game platform. Nothing is posted anywhere real.</p><div id="compose"></div></div>
        <div class="card"><h3>Your feed</h3><div class="feed" id="feed">${posts.slice(0, 12).map(po => { const ph = p.photos.find(x => x.id === po.photoId); return `<div class="post"><img data-img="${po.photoId}" alt=""><div class="body"><b>@you</b> ${esc(po.caption)}<div class="stats"><span>♥ ${po.likes.toLocaleString()}</span><span>+${po.followers} followers</span><span>+$${po.money}</span><span>novelty ${po.novelty}%</span></div>${po.comments.map(c => `<div class="comment">${esc(c)}</div>`).join('')}<div class="dimmer mono" style="font-size:11px;margin-top:4px">${esc(ph?.mountainName || '')} · score ${ph?.score ?? '?'}</div></div></div>`; }).join('') || '<p class="dim">Nothing posted yet.</p>'}</div></div></div></div>`;
  for (const img of body.querySelectorAll('img[data-img]')) getImage(img.dataset.img).then(src => { if (src) img.src = src; });
  body.querySelectorAll('[data-ph]').forEach(b => b.onclick = () => { selected = b.dataset.ph; socialTab(game, body, rerender); });
  body.querySelectorAll('[data-accept]').forEach(b => b.onclick = () => { acceptSponsor(p, b.dataset.accept); checkAchievements(p); saveProfile(p); game.audio.confirm(); rerender(); });
  const ph = p.photos.find(x => x.id === selected && !x.published);
  const comp = body.querySelector('#compose');
  if (!ph) { comp.innerHTML = '<p class="dim">Select a photo from the gallery to post it.</p>'; return; }
  const sim = p.posts.slice(-12).reduce((s, prev) => s + similarity(ph, prev), 0);
  comp.innerHTML = `<img data-img="${ph.id}" style="width:100%;border-radius:8px;aspect-ratio:16/9;object-fit:cover" alt="">
    <dl class="kv" style="margin:8px 0"><dt>Score</dt><dd>${ph.score} — scenic ${ph.scenic}, composition ${ph.composition}, rarity ${ph.rarity} (${ph.rarityLabel})</dd><dt>Notes</dt><dd style="font-family:var(--sans)">${esc(ph.notes.join(', ') || '—')}</dd><dt>In frame</dt><dd style="font-family:var(--sans)">${esc(ph.seen.join(', ') || '—')}</dd><dt>Similar recent posts</dt><dd>${sim > 1 ? '<span class="warn">several — expect less reach</span>' : sim > 0.4 ? 'some' : 'none'}</dd></dl>
    <textarea id="cap" maxlength="280" placeholder="Write a caption…">${esc(`${ph.place}, ${ph.mountainName}. `)}</textarea>
    <button class="btn primary" id="pub" style="margin-top:8px">Publish</button>`;
  getImage(ph.id).then(src => { const im = comp.querySelector('img'); if (src) im.src = src; });
  comp.querySelector('#pub').onclick = () => {
    const post = publish(p, ph, comp.querySelector('#cap').value);
    const offers = sponsorOffers(p);
    checkAchievements(p);
    saveProfile(p);
    game.audio.confirm();
    selected = null;
    game.ui.toast(`Posted: ♥ ${post.likes} · +${post.followers} followers · +$${post.money}${offers.length ? ' · new sponsor offer!' : ''}`, 5000);
    rerender();
  };
}
