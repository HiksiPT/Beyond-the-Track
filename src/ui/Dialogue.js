// The mentor: Peg Arden — veteran mountaineer, pragmatic, calm, occasionally funny. Portrait is original SVG.
export const MENTOR_NAME = 'Peg Arden';

export const PORTRAIT = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-label="Portrait of Peg Arden">
<rect width="100" height="100" fill="#33414a"/>
<path d="M0 100 C10 78 28 70 50 70 C72 70 90 78 100 100Z" fill="#9c4a2a"/>
<path d="M36 72 L50 86 L64 72" fill="none" stroke="#6e3119" stroke-width="3"/>
<rect x="43" y="58" width="14" height="14" rx="5" fill="#c99573"/>
<ellipse cx="50" cy="44" rx="18" ry="21" fill="#d4a382"/>
<path d="M32 44 C30 26 40 18 50 18 C61 18 70 26 68 44 C66 34 60 30 50 30 C40 30 34 34 32 44Z" fill="#cfcac0"/>
<path d="M30 33 C32 16 68 14 70 33 C64 26 36 26 30 33Z" fill="#4f6b5a"/>
<rect x="29" y="29" width="42" height="6" rx="3" fill="#3f5649"/>
<circle cx="50" cy="15" r="4" fill="#3f5649"/>
<path d="M41 44 q3-2 6 0 M53 44 q3-2 6 0" stroke="#3a2a20" stroke-width="1.6" fill="none" stroke-linecap="round"/>
<circle cx="44" cy="46" r="1.4" fill="#2a1d16"/><circle cx="56" cy="46" r="1.4" fill="#2a1d16"/>
<path d="M38 50 q2 3 5 2 M57 52 q3 1 5-2" stroke="#b07f60" stroke-width="1" fill="none"/>
<path d="M50 47 q-2 6 0 8" stroke="#a8765a" stroke-width="1.4" fill="none"/>
<path d="M44 59 q6 4 12 0" stroke="#7d4a3a" stroke-width="1.8" fill="none" stroke-linecap="round"/>
</svg>`;

export const HUB_LINES = {
  welcome: [
    "So you're the one who wants to climb everything. I'm Peg. I've been walking these hills since before your parents met.",
    "Here's the deal: I'll brief you, I'll nag you about water, and I'll tell you the truth afterwards. You make the decisions out there — I can't make them for you.",
    'Start with Kosciuszko. It forgives mistakes. Most mountains don’t.',
    'Controls are simple: W A S D to walk, mouse to look, F to follow the track, M for the map, I for your pack, P for the camera, R to rest. Escape pauses.',
  ],
  idle: [
    'Every mountain is a set of decisions with a walk in between.',
    'The summit is optional. Getting down is not.',
    'Weight is the enemy and also the thing that keeps you alive. Find the balance.',
    'Photos pay the bills these days, apparently. In my day we just looked at things.',
    "If a route looks too good on the map, check the contour lines again.",
    'Repair your boots before they fail, not after.',
  ],
  poor: 'Money’s tight. Basic gear will get you up Kosciuszko — sell the photos, and the sponsors will come.',
  gear: (missing) => `Before you go: you have no ${missing}. I'd fix that.`,
  unlock: (name) => `${name} is open to you now. It will ask more of you than the last one.`,
};

let queue = [], onDone = null, el = null;
export function showDialogue(lines, done) {
  el = el || document.getElementById('dialogue');
  queue = Array.isArray(lines) ? [...lines] : [lines];
  onDone = done || null;
  next();
}
function next() {
  if (!queue.length) { el.hidden = true; el.innerHTML = ''; const d = onDone; onDone = null; d?.(); return; }
  const line = queue.shift();
  el.hidden = false;
  el.innerHTML = `<div class="card" role="dialog" aria-live="polite"><div class="portrait">${PORTRAIT}</div><div class="mentor"><div><div class="who">${MENTOR_NAME}</div><p>${line}</p></div></div><button class="btn small next" id="dlg-next">${queue.length ? 'Next' : 'OK'} <kbd>Enter</kbd></button></div>`;
  const b = document.getElementById('dlg-next');
  b.onclick = next; b.focus();
}
export function dialogueOpen() { return el && !el.hidden; }
export function advanceDialogue() { if (dialogueOpen()) next(); }

let radioTimer = 0;
export function radio(text, ms = 6500) {
  const r = document.getElementById('radio');
  r.innerHTML = `<div class="card glass" aria-live="polite"><div class="portrait">${PORTRAIT}</div><p><b class="mono" style="font-size:11px;color:var(--accent-2)">PEG · RADIO</b><br>${text}</p></div>`;
  r.hidden = false;
  clearTimeout(radioTimer);
  radioTimer = setTimeout(() => { r.hidden = true; }, ms);
}
