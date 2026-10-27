// Procedural audio (Web Audio API): no audio files are needed, so nothing can 404.
// Buses: music, sfx, ambience -> master. Wind/rain/stream are filtered noise; birds and music are synthesised.
export class AudioSystem {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null; this.started = false;
    this.captionFn = null;
    this.lastCaption = {};
  }
  // browsers require a user gesture before audio can start
  start() {
    if (this.started) { this.ctx?.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch { return; }
    this.started = true;
    const c = this.ctx;
    this.master = c.createGain(); this.master.connect(c.destination);
    this.music = c.createGain(); this.music.connect(this.master);
    this.sfx = c.createGain(); this.sfx.connect(this.master);
    this.amb = c.createGain(); this.amb.connect(this.master);
    this.applyVolumes();
    const noise = c.createBuffer(1, c.sampleRate * 3, c.sampleRate);
    const d = noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }   // brown-ish
    this.noiseBuf = noise;
    const white = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), wd = white.getChannelData(0);
    for (let i = 0; i < wd.length; i++) wd[i] = Math.random() * 2 - 1;
    this.whiteBuf = white;
    this.wind = this.loop(this.noiseBuf, 'bandpass', 420, 0.6, this.amb);
    this.gust = this.loop(this.noiseBuf, 'bandpass', 900, 1.2, this.amb);
    this.rain = this.loop(this.whiteBuf, 'highpass', 2500, 0.3, this.amb);
    this.stream = this.loop(this.whiteBuf, 'bandpass', 1300, 0.9, this.amb);
    this.birdT = 0; this.musicT = 0; this.musicOn = false;
  }
  loop(buf, type, freq, q, bus) {
    const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(bus); src.start();
    return { src, f, g };
  }
  applyVolumes() {
    if (!this.ctx) return;
    const s = this.settings, m = s.mute ? 0 : s.master;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(m, t, 0.1);
    this.music.gain.setTargetAtTime(s.music, t, 0.1);
    this.sfx.gain.setTargetAtTime(s.sfx, t, 0.1);
    this.amb.gain.setTargetAtTime(s.ambience, t, 0.1);
  }
  caption(key, text, minGap = 25000) {
    if (!this.settings.captions || !this.captionFn) return;
    const now = performance.now();
    if (now - (this.lastCaption[key] || 0) < minGap) return;
    this.lastCaption[key] = now;
    this.captionFn(text);
  }
  // per-frame ambience from the simulation context
  update(dt, ctx) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const windAmt = ctx ? Math.min(1, ctx.wind / 70) * (ctx.exposed ? 1 : 0.45) : 0;
    this.wind.g.gain.setTargetAtTime(0.05 + windAmt * 0.5, t, 0.8);
    this.wind.f.frequency.setTargetAtTime(300 + windAmt * 500 + Math.sin(t * 0.7) * 80, t, 0.5);
    const gust = windAmt > 0.5 ? Math.max(0, Math.sin(t * 0.37) * Math.sin(t * 0.13)) * windAmt : 0;
    this.gust.g.gain.setTargetAtTime(gust * 0.3, t, 0.4);
    if (gust > 0.45) this.caption('wind', '[wind gusting hard]');
    const rain = ctx ? Math.min(1, ctx.precip / 2) * (ctx.snowing ? 0.15 : 1) : 0;
    this.rain.g.gain.setTargetAtTime(rain * 0.35, t, 1);
    if (rain > 0.3) this.caption('rain', '[rain drumming on your hood]', 60000);
    const stream = ctx ? Math.max(0, 1 - ctx.waterDist / 70) : 0;
    this.stream.g.gain.setTargetAtTime(stream * 0.22, t, 0.6);
    if (stream > 0.5) this.caption('stream', '[running water nearby]', 90000);
    // birdsong in forest by day, the odd call in woodland
    this.birdT -= dt;
    if (ctx && ctx.day && ctx.birds > 0 && this.birdT <= 0) {
      this.chirp(ctx.birds);
      this.birdT = 1.5 + Math.random() * (8 / ctx.birds);
    }
    if (this.musicOn) { this.musicT -= dt; if (this.musicT <= 0) { this.musicPhrase(); this.musicT = 4.5; } }
  }
  chirp(k) {
    const c = this.ctx, t = c.currentTime;
    const n = 2 + Math.floor(Math.random() * 4), f0 = 1800 + Math.random() * 2200;
    for (let i = 0; i < n; i++) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine';
      const st = t + i * (0.09 + Math.random() * 0.05);
      o.frequency.setValueAtTime(f0 * (1 + Math.random() * 0.2), st);
      o.frequency.exponentialRampToValueAtTime(f0 * (0.6 + Math.random() * 0.8), st + 0.08);
      g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(0.05 * Math.min(1, k), st + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, st + 0.1);
      o.connect(g); g.connect(this.amb); o.start(st); o.stop(st + 0.12);
    }
  }
  // footstep by surface: grass, gravel, rock, snow, wood, mud
  step(surface, loud = 1) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const src = c.createBufferSource(); src.buffer = this.whiteBuf;
    const f = c.createBiquadFilter(), g = c.createGain();
    const P = { grass: ['lowpass', 900, 0.05, 0.08], gravel: ['bandpass', 2600, 0.09, 0.07], rock: ['bandpass', 1500, 0.08, 0.03], snow: ['lowpass', 1400, 0.1, 0.12], wood: ['bandpass', 400, 0.12, 0.05], mud: ['lowpass', 500, 0.08, 0.1] }[surface] || ['lowpass', 900, 0.05, 0.08];
    f.type = P[0]; f.frequency.value = P[1] * (0.85 + Math.random() * 0.3);
    g.gain.setValueAtTime(P[2] * loud, t); g.gain.exponentialRampToValueAtTime(0.0001, t + P[3]);
    src.connect(f); f.connect(g); g.connect(this.sfx);
    src.start(t, Math.random() * 1.5, P[3] + 0.02);
  }
  click() { this.tone(880, 0.04, 0.04, 'triangle'); }
  confirm() { this.tone(660, 0.06, 0.05, 'triangle'); setTimeout(() => this.tone(990, 0.08, 0.05, 'triangle'), 70); }
  shutter() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime, src = c.createBufferSource(); src.buffer = this.whiteBuf;
    const g = c.createGain(); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    src.connect(g); g.connect(this.sfx); src.start(t, 0, 0.07);
  }
  tone(freq, dur, vol, type = 'sine', bus = null) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || this.sfx); o.start(t); o.stop(t + dur + 0.05);
  }
  // soft chord for narrative moments (decisions, summit)
  sting(kind = 'decision') {
    if (!this.ctx) return;
    const chords = { decision: [220, 277.2, 329.6], summit: [261.6, 329.6, 392, 523.3], fail: [196, 233.1, 293.7] };
    const c = this.ctx, t = c.currentTime;
    for (const f of chords[kind] || chords.decision) {
      const o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
      o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 3.4);
    }
  }
  setMusic(on) { this.musicOn = on; if (on) this.musicT = 0; }
  musicPhrase() {
    // gentle pentatonic phrase over a slow pad (hub music)
    const c = this.ctx, t = c.currentTime;
    const roots = [146.8, 164.8, 196, 130.8], root = roots[Math.floor(t / 18) % roots.length];
    for (const m of [1, 1.5, 2]) {
      const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = root * m;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.025, t + 1.5); g.gain.linearRampToValueAtTime(0, t + 4.5);
      o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 4.6);
    }
    const scale = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2];
    for (let i = 0; i < 3; i++) {
      if (Math.random() < 0.35) continue;
      const o = c.createOscillator(), g = c.createGain(), st = t + 0.6 + i * 1.2;
      o.type = 'triangle'; o.frequency.value = root * 2 * scale[Math.floor(Math.random() * scale.length)];
      g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(0.03, st + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, st + 1.1);
      o.connect(g); g.connect(this.music); o.start(st); o.stop(st + 1.2);
    }
  }
}
