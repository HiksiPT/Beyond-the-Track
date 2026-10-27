// Topographic map from the real DEM: hillshade, elevation tint and contour lines (marching squares),
// plus lakes, streams, tracks, routes, campsites, landmarks and the player. Pan with drag, zoom with wheel.
let baseCache = null;

function buildBase(game) {
  if (baseCache && baseCache.id === game.m.id + game.m.scenario) return baseCache.canvas;
  const hf = game.world.near, w = hf.w, h = hf.h, d = hf.data, eco = game.eco;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), img = g.createImageData(w, h);
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < d.length; i++) { lo = Math.min(lo, d[i]); hi = Math.max(hi, d[i]); }
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = j * w + i;
    const dx = (d[j * w + Math.min(w - 1, i + 1)] - d[j * w + Math.max(0, i - 1)]) / (2 * hf.cx);
    const dz = (d[Math.min(h - 1, j + 1) * w + i] - d[Math.max(0, j - 1) * w + i]) / (2 * hf.cz);
    const shade = Math.max(0, Math.min(1, 0.62 + (-dx * 0.7 - dz * 0.7) * 0.85 / Math.hypot(1, dx, dz)));
    const y = d[k];
    let r, gg, b;
    if (y < eco.forestTop) { r = 150; gg = 172; b = 128; }
    else if (y < eco.treeline) { r = 186; gg = 190; b = 146; }
    else { r = 222; gg = 212; b = 172; }
    if (y > eco.snowLine && eco.snowCover > 0.6) { r = 236; gg = 238; b = 240; }
    img.data[k * 4] = r * shade + 18; img.data[k * 4 + 1] = gg * shade + 18; img.data[k * 4 + 2] = b * shade + 18; img.data[k * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // contours every 50 m (index every 250 m), marching squares on a 2-cell grid
  const step = 2, span = hi - lo, interval = span > 1200 ? 50 : 25;
  g.lineWidth = 0.6;
  for (let lev = Math.ceil(lo / interval) * interval; lev < hi; lev += interval) {
    const major = lev % (interval * 5) === 0;
    g.strokeStyle = major ? 'rgba(110,70,40,.55)' : 'rgba(110,70,40,.22)';
    g.lineWidth = major ? 0.9 : 0.5;
    g.beginPath();
    for (let j = 0; j < h - step; j += step) for (let i = 0; i < w - step; i += step) {
      const a = d[j * w + i], b2 = d[j * w + i + step], cc = d[(j + step) * w + i + step], dd = d[(j + step) * w + i];
      const idx = (a > lev ? 8 : 0) | (b2 > lev ? 4 : 0) | (cc > lev ? 2 : 0) | (dd > lev ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      const lerp = (p, q) => (lev - p) / (q - p || 1);
      const T = [i + step * lerp(a, b2), j], R = [i + step, j + step * lerp(b2, cc)], B = [i + step * lerp(dd, cc), j + step], L = [i, j + step * lerp(a, dd)];
      const segs = { 1: [L, B], 2: [B, R], 3: [L, R], 4: [T, R], 5: [L, T, B, R], 6: [T, B], 7: [L, T], 8: [L, T], 9: [T, B], 10: [L, B, T, R], 11: [T, R], 12: [L, R], 13: [B, R], 14: [L, B] }[idx];
      for (let s = 0; s < segs.length; s += 2) { g.moveTo(segs[s][0], segs[s][1]); g.lineTo(segs[s + 1][0], segs[s + 1][1]); }
    }
    g.stroke();
  }
  // lakes and named streams
  const px = (x) => (x - hf.x0) / hf.cx - 0.5, pz = (z) => (z - hf.zN) / hf.cz - 0.5;
  g.fillStyle = '#5f8fb3';
  for (const L of game.world.lakes) { g.beginPath(); L.poly.forEach(([x, z], i) => i ? g.lineTo(px(x), pz(z)) : g.moveTo(px(x), pz(z))); g.closePath(); g.fill(); }
  g.strokeStyle = 'rgba(70,120,180,.85)'; g.lineWidth = 0.8;
  for (const wv of game.world.water) { if (!wv.name && wv.kind !== 'river') continue; g.beginPath(); wv.pts.forEach((p, i) => i ? g.lineTo(px(p[0]), pz(-p[1])) : g.moveTo(px(p[0]), pz(-p[1]))); g.stroke(); }
  baseCache = { id: game.m.id + game.m.scenario, canvas: c };
  return c;
}

export class TopoMap {
  constructor(container, game, opts = {}) {
    this.game = game; this.opts = opts;
    const hf = game.world.near;
    this.W = hf.w; this.H = hf.h;
    container.innerHTML = `<div class="mapbox"><canvas></canvas><div class="maptools"><button class="btn small" data-z="1" aria-label="Zoom in">+</button><button class="btn small" data-z="-1" aria-label="Zoom out">−</button><button class="btn small" data-z="0">Fit</button></div></div>
      <div class="maplegend"><span><i style="background:#c0392b"></i>walking track</span><span><i style="background:#d99a2b"></i>vehicle track</span><span><i style="background:#111"></i>selected route</span><span><i style="background:#5f8fb3"></i>water</span><span><i style="background:#fff"></i>your track</span><span>● camp &nbsp;▲ peak &nbsp;■ hut</span><span>contours ${'50'} m</span></div>`;
    this.cv = container.querySelector('canvas');
    this.base = buildBase(game);
    this.scale = 1; this.ox = 0; this.oy = 0;
    this.route = null; this.altRoutes = [];
    this.fit();
    const ro = new ResizeObserver(() => this.resize()); ro.observe(this.cv.parentElement); this.ro = ro;
    container.querySelectorAll('[data-z]').forEach(b => b.onclick = () => { const z = +b.dataset.z; if (!z) this.fit(); else this.zoomAt(this.cv.clientWidth / 2, this.cv.clientHeight / 2, z > 0 ? 1.4 : 1 / 1.4); });
    let drag = null;
    this.cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, ox: this.ox, oy: this.oy, moved: 0 }; this.cv.setPointerCapture(e.pointerId); });
    this.cv.addEventListener('pointermove', e => { if (!drag) return; drag.moved += Math.abs(e.movementX) + Math.abs(e.movementY); this.ox = drag.ox + (e.clientX - drag.x); this.oy = drag.oy + (e.clientY - drag.y); this.draw(); });
    this.cv.addEventListener('pointerup', e => { const d = drag; drag = null; if (d && d.moved < 6) this.click(e); });
    this.cv.addEventListener('wheel', e => { e.preventDefault(); const r = this.cv.getBoundingClientRect(); this.zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.2 : 1 / 1.2); }, { passive: false });
  }
  destroy() { this.ro?.disconnect(); }
  resize() {
    const box = this.cv.parentElement, w = box.clientWidth, h = Math.min(innerHeight * 0.68, w * this.H / this.W);
    const dpr = devicePixelRatio || 1;
    this.cv.width = w * dpr; this.cv.height = h * dpr; this.cv.style.height = h + 'px';
    this.draw();
  }
  fit() {
    const w = this.cv.parentElement.clientWidth || 600, h = Math.min(innerHeight * 0.68, w * this.H / this.W);
    this.scale = Math.min(w / this.W, h / this.H); this.ox = (w - this.W * this.scale) / 2; this.oy = (h - this.H * this.scale) / 2;
    this.resize();
  }
  zoomAt(sx, sy, k) {
    const ns = Math.max(0.3, Math.min(12, this.scale * k));
    this.ox = sx - (sx - this.ox) * ns / this.scale; this.oy = sy - (sy - this.oy) * ns / this.scale; this.scale = ns;
    this.draw();
  }
  centreOn(x, z, zoom = 3) {
    const [gx, gy] = this.grid(x, z), w = this.cv.clientWidth, h = this.cv.clientHeight;
    this.scale = zoom; this.ox = w / 2 - gx * zoom; this.oy = h / 2 - gy * zoom; this.draw();
  }
  grid(x, z) { const hf = this.game.world.near; return [(x - hf.x0) / hf.cx - 0.5, (z - hf.zN) / hf.cz - 0.5]; }
  scr(x, z) { const [gx, gy] = this.grid(x, z); return [this.ox + gx * this.scale, this.oy + gy * this.scale]; }
  setRoute(pts, alts = []) { this.route = pts; this.altRoutes = alts; this.draw(); }
  draw() {
    const g = this.cv.getContext('2d'), dpr = devicePixelRatio || 1, game = this.game;
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#1d2326'; g.fillRect(0, 0, this.cv.width, this.cv.height);
    g.imageSmoothingEnabled = this.scale < 2;
    g.drawImage(this.base, this.ox, this.oy, this.W * this.scale, this.H * this.scale);
    const line = (pts, color, width, dash = null, get = (p) => [p[0], p[1]]) => {
      g.strokeStyle = color; g.lineWidth = width; g.setLineDash(dash || []); g.beginPath();
      pts.forEach((p, i) => { const [x, z] = get(p); const [sx, sy] = this.scr(x, z); i ? g.lineTo(sx, sy) : g.moveTo(sx, sy); });
      g.stroke(); g.setLineDash([]);
    };
    const lw = Math.max(1, Math.min(3, this.scale * 1.2));
    for (const e of game.net.edges) { if (e.dead) continue; line(e.pts, e.virtual ? 'rgba(160,40,30,.9)' : e.kind === 'track' ? '#d99a2b' : '#c0392b', e.kind === 'track' ? lw * 0.7 : lw, e.virtual ? [4, 3] : null); }
    for (const a of this.altRoutes) line(a, 'rgba(20,20,20,.35)', lw * 2.2);
    if (this.route) { line(this.route, 'rgba(255,255,255,.7)', lw * 4); line(this.route, '#111', lw * 2.2, [8, 5]); }
    const ex = game.exp;
    if (ex && game.mode !== 'brief') { line(ex.breadcrumbs.concat([[ex.pos.x, ex.pos.z]]), '#fff', lw * 1.4); }
    // places
    g.font = `600 ${Math.max(10, Math.min(13, 9 + this.scale))}px IBM Plex Sans, sans-serif`;
    this.hits = [];
    for (const p of Object.values(game.places)) {
      const [sx, sy] = this.scr(p.x, p.z);
      g.fillStyle = p.camp ? '#d0703f' : p.water ? '#4f8fc0' : p.trailhead ? '#222' : p.id === game.content.summitPlace ? '#f0c86a' : '#fff';
      g.strokeStyle = '#000'; g.lineWidth = 1;
      g.beginPath();
      if (p.hut) g.rect(sx - 4, sy - 4, 8, 8); else g.arc(sx, sy, p.trailhead ? 5 : 4, 0, 7);
      g.fill(); g.stroke();
      if (this.scale > 0.8 || p.trailhead || p.id === game.content.summitPlace) { g.fillStyle = '#111'; g.fillText(p.name, sx + 7, sy - 5); }
      this.hits.push({ sx, sy, id: p.id, name: p.name });
    }
    for (const l of game.landmarks) {
      if (l.far || (l.kind !== 'peak' && l.kind !== 'hut')) continue;
      const [sx, sy] = this.scr(l.x, l.z);
      if (sx < -20 || sy < -20 || sx > this.cv.clientWidth + 20 || sy > this.cv.clientHeight + 20) continue;
      g.fillStyle = '#2a2a2a';
      g.beginPath(); g.moveTo(sx, sy - 4); g.lineTo(sx + 4, sy + 3); g.lineTo(sx - 4, sy + 3); g.closePath(); g.fill();
      if (this.scale > 1.4) { g.fillStyle = 'rgba(20,20,20,.85)'; g.fillText(l.name.replace('Mount ', 'Mt ') + (l.ele ? ` ${Math.round(+l.ele)}` : ''), sx + 6, sy + 3); }
      if (!this.hits.some(h => Math.hypot(h.sx - sx, h.sy - sy) < 10)) this.hits.push({ sx, sy, landmark: l, name: l.name });
    }
    if (ex && game.mode !== 'brief') {
      const [sx, sy] = this.scr(ex.pos.x, ex.pos.z);
      g.save(); g.translate(sx, sy); g.rotate(-ex.pos.heading); g.fillStyle = '#ff5a2a'; g.strokeStyle = '#fff'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(0, -10); g.lineTo(6.5, 7); g.lineTo(0, 3); g.lineTo(-6.5, 7); g.closePath(); g.fill(); g.stroke(); g.restore();
    }
    // scale bar
    const hf = game.world.near, mPerPx = hf.cx / this.scale, bar = [500, 1000, 2000, 5000].find(m => m / mPerPx > 70) || 5000;
    const bx = 12, by = this.cv.clientHeight - 14;
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(bx - 4, by - 14, bar / mPerPx + 8, 20);
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + bar / mPerPx, by); g.stroke();
    g.fillStyle = '#fff'; g.font = '11px IBM Plex Mono, monospace'; g.fillText(bar >= 1000 ? `${bar / 1000} km` : `${bar} m`, bx, by - 4);
    g.fillText('N ↑', this.cv.clientWidth - 34, this.cv.clientHeight - 10);
  }
  click(e) {
    const r = this.cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    let best = null;
    for (const h of this.hits || []) { const d = Math.hypot(h.sx - mx, h.sy - my); if (d < 14 && (!best || d < best.d)) best = { ...h, d }; }
    if (best) this.opts.onPick?.(best);
  }
}
