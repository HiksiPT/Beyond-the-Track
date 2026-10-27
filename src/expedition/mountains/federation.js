// Federation Peak — major campaign milestone. OSM tracks/campsites; GA terrain.
// The final climb from Hanging Lake is not a formed track in OSM: it is added as a clearly labelled
// off-track game segment that follows the real DEM between the campsite and the summit.
import { odds } from '../odds.js';

export default {
  id: 'federation', tz: 11, startDate: '2027-01-30',
  eco: { forestTop: 650, treeline: 900, snowLine: 2300, snowCover: 0, rockSlope: 0.80, moorland: 1.0, palette: 'tas-southwest' },
  clim: { tMean: 12, tAmp: 5, wind: 24, cloud: 0.65, frontEvery: 34, valleyY: 200, tz: 11, wet: 1.6, drizzle: 0.4, frontBase: 700 },
  summitPlace: 'summit',
  camping: 'Camping is allowed at Cutting Camp, Bechervaise Plateau, Hanging Lake, Goon Moor and Stuart Saddle in this simulation.',
  trailheads: {
    farmhouse: { name: 'Farmhouse Creek track (edge of the mapped area)', node: '2396117731', exit: true },
    passcreek: { name: 'Pass Creek — northern end of the Eastern Arthurs', node: '2396105304', exit: true, remote: true },
  },
  virtual: [{ from: { place: 'hanging' }, to: [[-43.2714, 146.4758]], id: 'v:fedsummit', name: 'Federation Peak summit climb (off-track scramble)' }],
  places: {
    summit: { node: 'v:fedsummit', name: 'Federation Peak summit', r: 30 },
    cutting: { poi: 'Cutting Camp', name: 'Cutting Camp', r: 80, camp: true, water: 'creek' },
    bechervaise: { poi: 'Bechervaise Plateau Campsite', name: 'Bechervaise Plateau', r: 90, camp: true, water: 'creek', view: true },
    hanging: { poi: 'Hanging Lake Campsite', name: 'Hanging Lake', r: 80, camp: true, water: 'lake' },
    goon: { poi: 'Goon Moor Campsite', name: 'Goon Moor', r: 90, camp: true, water: 'creek' },
    stuart: { poi: 'Stuart Saddle Campsite', name: 'Stuart Saddle', r: 80, camp: true, water: 'creek' },
    passCamp: { poi: 'Pass Creek Campsite', name: 'Pass Creek', r: 80, camp: true, water: 'creek' },
  },
  farPeaks: [{ name: 'Precipitous Bluff', near: [-43.465, 146.59], search: 2500, note: 'far to the south' }, { name: 'Western Arthurs', near: [-43.17, 146.3], search: 4000 }],
  routes: [
    { id: 'moss', name: 'Moss Ridge — out and back', difficulty: 'hard', start: 'th:farmhouse', via: ['cutting', 'bechervaise', 'hanging', 'summit', 'hanging', 'bechervaise'], end: 'th:farmhouse', nights: 3,
      blurb: 'The direct way: up from Farmhouse Creek through rainforest, the infamous mud and roots of Moss Ridge to Bechervaise Plateau, across to Hanging Lake, then the airy climb to the summit spire. Back the same way.',
      gear: ['pack-70', 'boots-alpine', 'gaiters', 'tent-4s', 'bag-alpine', 'stove', 'shell-pro', 'puffy', 'gps', 'headtorch', 'firstaid', 'helmet', 'rope', 'plb'], teaches: 'Linked decisions, retreat discipline.' },
    { id: 'traverse', name: 'Eastern Arthurs traverse — Pass Creek to Farmhouse Creek', difficulty: 'hard', start: 'th:passcreek', via: ['passCamp', 'stuart', 'goon', 'hanging', 'summit', 'hanging', 'bechervaise', 'cutting'], end: 'th:farmhouse', nights: 4,
      blurb: 'The grand line: along the jagged Eastern Arthur Range from the north, over Stuart Saddle and Goon Moor, past the Four Peaks and The Gables to Hanging Lake, the summit, then down Moss Ridge. Long, exposed and committing.',
      gear: ['pack-70', 'boots-alpine', 'gaiters', 'tent-4s', 'bag-alpine', 'mat', 'stove', 'shell-pro', 'down', 'gps', 'headtorch', 'firstaid', 'helmet', 'rope', 'plb'], teaches: 'A committing traverse.', rewardMult: 1.5, exposureExtra: 1 },
  ],
  landmarks: [
    { id: 'farmhouse', at: 'th:farmhouse', title: 'Farmhouse Creek', real: 'The common approach to Federation Peak starts at Farmhouse Creek, east of the range.' },
    { id: 'bechervaise', at: 'bechervaise', title: 'Bechervaise Plateau', real: 'Bechervaise Plateau sits at the top of Moss Ridge, a small high camp below the peak.' },
    { id: 'hanging', at: 'hanging', title: 'Hanging Lake', real: 'Hanging Lake is a tarn perched beneath the summit spire; the final climb starts nearby.' },
    { id: 'summit', at: 'summit', title: 'Federation Peak', real: 'Federation Peak (1224 m) is a sharp quartzite spire with huge drops on several sides, widely regarded as the most challenging bushwalking summit in Australia.' },
    { id: 'goon', at: 'goon', title: 'Goon Moor', real: 'Goon Moor is an open alpine moor on the Eastern Arthur Range north of the peak.' },
  ],
  objectives: [
    { id: 'photo-spire', title: 'Photograph the spire from Bechervaise Plateau', kind: 'photo', place: 'bechervaise', minScore: 55 },
    { id: 'photo-summit', title: 'Photograph from the top of the spire', kind: 'photo', place: 'summit', minScore: 60 },
  ],
  mentor: {
    briefing: [
      "Federation's the one people dream about and a lot of them don't summit. The mud on Moss Ridge breaks spirits before the rock even starts.",
      'The last climb is real scrambling with a big drop beside you. Helmet, a hand line for the pack, and dry rock — or turn around.',
      'Remote means slow help. Pack a beacon and plan as if nobody is coming.',
    ],
    summit: "You're standing on Federation Peak. Breathe. Every metre from here is downclimbing, and that's where it bites.",
  },
  encounters: [
    { id: 'moss-ridge', kind: 'Terrain', title: 'Moss Ridge', once: true, perHour: 99,
      when: c => c.moving && c.y > 450 && c.y < 900 && c.zone.forest > 0.4 && c.routeId === 'moss',
      text: 'The track becomes a vertical tangle of roots, mud chutes and fallen myrtle. Packs snag, boots slide, and progress is measured in metres.',
      choices: [
        { label: 'Haul the pack up the roots', resolve: (c) => {
          const o = odds(0.65, [[c.exp.packKg < 18, 0.15, 'a manageable pack'], [c.fx.rope, 0.1, 'a hand line to haul the pack'], [c.exp.packKg > 22, -0.2, 'an enormous pack'], [c.weather.precip > 0.05, -0.1, 'rain']]);
          return c.rand() < o.p ? { headline: 'Grind', good: true, text: 'An hour of grunting and hauling, and the angle eases.', why: o.why, extraMin: 30, effects: { energy: -18, equip: { pack: 8 } } } : { headline: 'Torn and exhausted', good: false, text: 'A strap rips and you slide back down a mud chute. It takes everything to get up.', why: o.why, extraMin: 60, effects: { energy: -28, equip: { pack: 20, shell: 10 }, injury: 0.1 } };
        } },
        { label: 'Lighten the pack — cache some food here', resolve: (c, g) => { g.cacheFood(0.3); return { headline: 'Cache', good: null, text: 'You stash a bag of food under a rock for the way out.', why: ['+ lighter now', '− less food on the mountain'], effects: { energy: -10 } }; } },
      ] },
    { id: 'fed-climb', kind: 'Scramble · linked decision', title: 'The summit climb', once: true, perHour: 99,
      when: c => c.virtual && c.moving,
      text: c => `From Hanging Lake the route climbs a gully and then exposed ledges above a huge drop. ${c.weather.precip > 0.05 || c.fog ? 'The rock is wet and cloud blows through the gap.' : 'The rock is dry.'} ${c.flags.mossHard ? 'Your arms still ache from Moss Ridge.' : ''}`,
      choices: [
        { label: 'Climb on, hauling the pack on the hand line', need: 'rope', needText: 'needs a hand line', cost: 20, resolve: (c) => {
          const o = odds(0.8, [[c.fx.helmet, 0.05, 'helmet'], [c.weather.precip > 0.05, -0.25, 'wet rock'], [c.body.energy < 35, -0.15, 'fatigue'], [c.wind > 50, -0.1, 'gusts']]);
          return c.rand() < o.p ? { headline: 'Up the ledges', good: true, text: 'Move, belay the pack, move. The summit block appears.', why: o.why, effects: { energy: -10, xp: 50 } } : { headline: 'A frightening slip', good: false, text: 'A foothold breaks. The line on your pack saves you a nasty fall but you are battered.', why: o.why, effects: { injury: 0.3, energy: -15 } };
        } },
        { label: 'Climb on without a line', resolve: (c) => {
          const o = odds(0.55, [[c.fx.helmet, 0.05, 'helmet'], [c.exp.packKg < 12, 0.1, 'a light pack'], [c.weather.precip > 0.05, -0.3, 'wet rock'], [c.body.energy < 35, -0.15, 'fatigue']]);
          return c.rand() < o.p ? { headline: 'Committed', good: null, text: 'Heart in your mouth on the exposed ledges, you make it.', why: o.why, effects: { energy: -14 } } : { headline: 'Fall', good: false, text: 'You slip, slide and stop hard on a ledge. Bloodied and shaking.', why: o.why, effects: { injury: c.fx.helmet ? 0.45 : 0.7, energy: -20 } };
        } },
        { label: 'Wait at Hanging Lake for dry rock', cost: 120, resolve: (c) => ({ headline: c.soon.clearing ? 'Drying out' : 'Still wet', good: !!c.soon.clearing, text: c.soon.clearing ? 'Wind dries the rock by afternoon.' : 'Cloud stays on the spire.', effects: { restful: true, hunger: 8 } }) },
        { label: 'Retreat — the summit is not worth it today', resolve: () => ({ headline: 'Retreat', good: true, text: 'Many good walkers have turned around here. So do you.', why: ['+ discipline'], effects: { action: 'retreat', xp: 40 } }) },
      ] },
  ],
};
