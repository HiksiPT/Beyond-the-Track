// Sun position (real latitude/longitude/date) and simulated weather with fronts and an uncertain forecast.
// Weather is a game model, not a forecast of anything real.

export function rng(seed) {
  let a = seed >>> 0;
  const f = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.state = () => a; f.set = (s) => { a = s >>> 0; };
  return f;
}

export function sunPosition(utcMs, lat, lon) {
  const rad = Math.PI / 180, d = utcMs / 86400000 - 10957.5;
  const g = (357.529 + 0.98560028 * d) * rad, q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad, e = (23.439 - 0.00000036 * d) * rad;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  const ha = (gmst * 15 + lon) * rad - ra, la = lat * rad;
  const alt = Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(ha));
  const az = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(la) - Math.sin(la) * Math.cos(ha));
  return { alt, az: (az + 2 * Math.PI) % (2 * Math.PI) };
}
export function sunTimes(dayStartUtc, lat, lon) {
  let rise = null, set = null, prev = null;
  for (let m = 0; m <= 1440; m += 2) {
    const t = dayStartUtc + m * 60000, a = sunPosition(t, lat, lon).alt * 180 / Math.PI + 0.833;
    if (prev !== null) { if (prev < 0 && a >= 0 && rise === null) rise = t; if (prev >= 0 && a < 0) set = t; }
    prev = a;
  }
  return { rise, set };
}

export class Weather {
  // clim: { tMean, tAmp, wind, cloud, frontEvery (h), valleyY, tz, wet }
  constructor(seed, startUtc, clim, days = 8) {
    this.startUtc = startUtc; this.clim = clim; this.hours = days * 24;
    const r = rng(seed ^ 0x5eed);
    const fronts = [];
    let t = 8 + r() * 30;
    while (t < this.hours) { fronts.push({ t, strength: 0.5 + r() * 0.6 * (clim.wet || 1), dur: 8 + r() * 14 }); t += clim.frontEvery * (0.6 + r() * 0.9); }
    this.fronts = fronts;
    this.series = [];
    for (let h = 0; h < this.hours; h++) {
      const utc = startUtc + h * 3600000;
      const local = ((utc / 3600000 + clim.tz) % 24 + 24) % 24;
      let tV = clim.tMean + clim.tAmp * Math.cos((local - 15) / 24 * 2 * Math.PI) + (r() - 0.5) * 1.5;
      let wind = clim.wind * (0.7 + r() * 0.5), cloud = clim.cloud * (0.6 + r() * 0.8), precip = (clim.drizzle || 0) * (r() < 0.25 ? r() : 0), base = 2600 - cloud * 900 + (clim.baseShift || 0);
      for (const f of fronts) {
        const dt = h - f.t;
        if (dt > -14 && dt < 0) { const k = (dt + 14) / 14; wind += 25 * f.strength * k; tV += 2.5 * k; cloud += 0.35 * k; base -= 500 * k; }
        if (dt >= 0 && dt < f.dur) {
          const k = Math.sin(Math.PI * dt / f.dur);
          tV -= 8 * f.strength * Math.min(1, dt / 3 + 0.3); wind += 35 * f.strength * k; cloud = Math.max(cloud, 0.85 + 0.15 * k);
          precip = Math.max(precip, (1.2 + 2.5 * r()) * f.strength * k); base = Math.min(base, (clim.frontBase || 1250) + 400 * (1 - k));
        }
        if (dt >= f.dur && dt < f.dur + 12) { tV -= 4 * f.strength * (1 - (dt - f.dur) / 12); wind += 15 * f.strength * (1 - (dt - f.dur) / 12); }
      }
      this.series.push({ tV, wind: Math.max(3, wind), cloud: Math.max(0, Math.min(1, cloud)), precip, base: Math.max(300, base) });
    }
  }
  at(utc) {
    const fh = Math.max(0, Math.min(this.hours - 1.001, (utc - this.startUtc) / 3600000));
    const i = Math.floor(fh), t = fh - i, a = this.series[i], b = this.series[i + 1] || a;
    const mix = (k) => a[k] + (b[k] - a[k]) * t;
    return { tV: mix('tV'), wind: mix('wind'), cloud: mix('cloud'), precip: mix('precip'), base: mix('base') };
  }
  tempAt(utc, y) { return this.at(utc).tV - 6.5 * (y - this.clim.valleyY) / 1000; }
  forecast(seed, fromUtc = this.startUtc) {
    const r = rng(seed ^ 0xf0ca), out = [];
    const h0 = Math.max(0, Math.floor((fromUtc - this.startUtc) / 3600000));
    for (let d = 0; d < 4; d++) {
      const slice = this.series.slice(h0 + d * 24, h0 + d * 24 + 24);
      if (!slice.length) break;
      const err = 0.15 + d * 0.12;
      out.push({
        day: d, maxT: Math.max(...slice.map(s => s.tV)) + (r() - 0.5) * 6 * err, minT: Math.min(...slice.map(s => s.tV)) + (r() - 0.5) * 6 * err,
        wind: Math.max(...slice.map(s => s.wind)) * (1 + (r() - 0.5) * err),
        pRain: Math.max(0, Math.min(95, Math.round(((x) => x > 2 ? 70 : x > 0.3 ? 40 : 10)(slice.reduce((s, x) => s + x.precip, 0)) + (r() - 0.5) * 60 * err))),
        cloudBase: Math.min(...slice.map(s => s.base)), conf: d < 2 ? 'high' : d < 3 ? 'medium' : 'low',
      });
    }
    return out;
  }
  describe(w, temp) {
    if (w.precip > 0.05) return temp < 0.8 ? 'snow' : w.precip > 1.5 ? 'heavy rain' : 'rain';
    return w.cloud > 0.75 ? 'overcast' : w.cloud > 0.4 ? 'some cloud' : 'clear';
  }
}

export function fmtDur(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60);
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
}
export function fmtClock(utc, tz) { const d = new Date(utc + tz * 3600000); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; }
export function compassName(deg) { return ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(((deg % 360) + 360) % 360 / 22.5) % 16]; }
