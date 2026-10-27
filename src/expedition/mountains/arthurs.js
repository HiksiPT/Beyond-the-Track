// Western Arthurs traverse — final campaign expedition, multi-stage. OSM track/campsites/lakes; GA terrain.
// The full real traverse takes many days; this is a geographically faithful, simplified game representation.
import { odds } from '../odds.js';

export default {
  id: 'arthurs', tz: 11, startDate: '2027-02-13',
  eco: { forestTop: 600, treeline: 850, snowLine: 2300, snowCover: 0, rockSlope: 0.80, moorland: 1.0, palette: 'tas-southwest' },
  clim: { tMean: 12, tAmp: 5, wind: 24, cloud: 0.6, frontEvery: 36, valleyY: 250, tz: 11, wet: 1.5, drizzle: 0.35, frontBase: 750 },
  summitPlace: 'oberon',
  objectivePlace: 'seven',
  camping: 'Camp at the designated campsites: Junction Creek, Lake Cygnus, Lake Oberon, High Moor, Haven Lake, Promontory Lake and Seven Mile Creek.',
  trailheads: {
    scotts: { name: 'Scotts Peak Road — McKays Track', node: '1339108281', exit: true },
  },
  places: {
    junction: { poi: 'Junction Creek Campsite', name: 'Junction Creek', r: 80, camp: true, water: 'creek' },
    moraineA: { node: '1339108357', name: 'Foot of Moraine A', r: 50 },
    hesperus: { node: '1339108295', name: 'Top of Moraine A (Mt Hesperus)', r: 60, view: true },
    cygnus: { poi: 'Lake Cygnus Campsite', name: 'Lake Cygnus', r: 80, camp: true, water: 'lake' },
    hayes: { poi: 'Mount Hayes', name: 'Mount Hayes', r: 120, view: true },
    oberon: { poi: 'Lake Oberon Campsite', name: 'Lake Oberon', r: 80, camp: true, water: 'lake', view: true },
    highmoor: { poi: 'High Moor Campsite', name: 'High Moor', r: 80, camp: true, water: 'lake' },
    haven: { poi: 'Haven Lake Campsite', name: 'Haven Lake', r: 80, camp: true, water: 'lake' },
    scorpio: { node: '1339117842', name: 'Top of Moraine K (Mt Scorpio)', r: 60, view: true },
    promontory: { poi: 'Promontory Lake Campsite', name: 'Promontory Lake', r: 80, camp: true, water: 'lake' },
    seven: { poi: 'Seven Mile Creek Campsite', name: 'Seven Mile Creek', r: 80, camp: true, water: 'creek' },
  },
  farPeaks: [{ name: 'Federation Peak', near: [-43.2714, 146.4758], search: 600, note: 'the Eastern Arthurs' }, { name: 'Lake Pedder', near: [-43.03, 146.25], search: 10, note: 'impoundment' }],
  routes: [
    { id: 'full', name: 'Full traverse — six stages', difficulty: 'hard', start: 'th:scotts', via: ['junction', 'moraineA', 'hesperus', 'cygnus', 'hayes', 'oberon', 'highmoor', 'haven', 'scorpio', 'seven', 'junction'], end: 'th:scotts', nights: 5,
      blurb: 'Across the Arthur Plains, up Moraine A onto the range, then lake to lake along the crest — Cygnus, Oberon, High Moor, Haven — over Mt Scorpio, down Moraine K and back across the plains.',
      gear: ['pack-70', 'boots-alpine', 'gaiters', 'tent-4s', 'bag-alpine', 'mat', 'stove', 'shell-pro', 'down', 'gps', 'headtorch', 'firstaid', 'helmet', 'rope', 'plb', 'spare-laces'],
      stages: [
        { name: 'Stage 1 · Scotts Peak to Junction Creek', until: 'junction' },
        { name: 'Stage 2 · Moraine A to Lake Cygnus', until: 'cygnus' },
        { name: 'Stage 3 · Mt Hayes to Lake Oberon', until: 'oberon' },
        { name: 'Stage 4 · Lake Oberon to High Moor', until: 'highmoor' },
        { name: 'Stage 5 · Haven Lake, Mt Scorpio, Moraine K', until: 'seven' },
        { name: 'Stage 6 · Arthur Plains and out', until: 'th:scotts' },
      ], teaches: 'Cumulative fatigue and supplies across a whole range.', rewardMult: 1.5, exposureExtra: 1 },
    { id: 'oberon', name: 'Partial traverse — out to Lake Oberon and back', difficulty: 'hard', objective: 'oberon', partial: true, start: 'th:scotts', via: ['junction', 'moraineA', 'hesperus', 'cygnus', 'hayes', 'oberon', 'cygnus', 'hesperus', 'moraineA', 'junction'], end: 'th:scotts', nights: 4,
      blurb: 'The first half of the range to the famous Lake Oberon, then back over the same ground. Shorter, with known terrain on the way out.',
      gear: ['pack-70', 'boots-alpine', 'gaiters', 'tent-4s', 'bag-alpine', 'stove', 'shell-pro', 'puffy', 'map-compass', 'headtorch', 'firstaid', 'helmet'],
      stages: [
        { name: 'Stage 1 · Scotts Peak to Junction Creek', until: 'junction' },
        { name: 'Stage 2 · Moraine A to Lake Cygnus', until: 'cygnus' },
        { name: 'Stage 3 · Out to Lake Oberon', until: 'oberon' },
        { name: 'Stage 4 · Back to Junction Creek', until: 'junction' },
        { name: 'Stage 5 · Out to Scotts Peak', until: 'th:scotts' },
      ], teaches: 'Multi-day ridge travel with a retreat option.', rewardMult: 1.1 },
  ],
  landmarks: [
    { id: 'scotts', at: 'th:scotts', title: 'Scotts Peak', real: 'The Western Arthurs are usually approached from Scotts Peak Road beside the Lake Pedder impoundment, across the button-grass Arthur Plains.' },
    { id: 'junction', at: 'junction', title: 'Junction Creek', real: 'Junction Creek campsite sits where the tracks to the Arthur Plains, Moraine A and Port Davey meet.' },
    { id: 'hesperus', at: 'hesperus', title: 'Moraine A', real: 'Moraine A is the steep western access onto the range near Mt Hesperus.' },
    { id: 'cygnus', at: 'cygnus', title: 'Lake Cygnus', real: 'Lake Cygnus is the first glacial lake campsite on the range, below Capella Crags.' },
    { id: 'oberon', at: 'oberon', title: 'Lake Oberon', real: 'Lake Oberon, in a cirque beneath Mt Pegasus and Mt Orion, is one of the best-known views in Tasmania.' },
    { id: 'highmoor', at: 'highmoor', title: 'High Moor', real: 'High Moor is a small exposed campsite in the middle of the range.' },
    { id: 'haven', at: 'haven', title: 'Haven Lake', real: 'Haven Lake lies below Mt Scorpio on the eastern half of the range.' },
    { id: 'seven', at: 'seven', title: 'Seven Mile Creek', real: 'Seven Mile Creek is at the foot of Moraine K, back on the Arthur Plains.' },
  ],
  objectives: [
    { id: 'photo-oberon', title: 'Photograph Lake Oberon from above', kind: 'photo', place: 'oberon', minScore: 60 },
    { id: 'photo-scorpio', title: 'Photograph the range from Mt Scorpio', kind: 'photo', place: 'scorpio', minScore: 55 },
  ],
  mentor: {
    briefing: [
      "The Western Arthurs. Everything you've learned, every day for a week. You won't carry enough food for a mistake, so don't make one.",
      'It is lake to lake along the crest — steep down into each cirque, steep back out. Your legs will hate the Beggary Bumps.',
      'Watch the weather off the Southern Ocean. Every camp is a decision point: carry on, wait, or bail off the range.',
    ],
    summit: 'Lake Oberon. Half the range behind you, half in front. Count your food.',
  },
  encounters: [
    { id: 'arthurs-storm', kind: 'Weather · linked decision', title: 'Storm warning at camp', once: false, cooldown: 24, perHour: 99,
      when: c => c.exp.camp && !c.exp.resting && c.soon.severity > 0.65 && ['cygnus', 'oberon', 'highmoor', 'haven'].includes(c.atPlace),
      text: c => `At ${c.exp.placeName} the barometer is falling fast. ${c.soon.text} Food left for about ${(c.exp.foodKcal / 2500).toFixed(1)} days.`,
      choices: [
        { label: 'Sit out the storm in the tent', cost: 60 * 10, resolve: (c) => {
          const o = odds(0.7, [[c.fx.tent >= 2, 0.2, '4-season tent'], [c.fx.tent < 2, -0.25, 'a flimsy tent'], [c.atPlace === 'highmoor', -0.15, 'an exposed campsite']]);
          return c.rand() < o.p ? { headline: 'A long night', good: true, text: 'The tent shudders all night but holds. By morning the wind has eased.', why: o.why, effects: { hunger: 30, energy: 20, restful: true } } : { headline: 'Tent damaged', good: false, text: 'A pole snaps at 3 a.m. You spend the rest of the night holding the tent up.', why: o.why, effects: { hunger: 30, warmth: -20, equip: { tent: 45 } } };
        } },
        { label: 'Push on to the next lake before it hits', resolve: (c) => {
          const o = odds(0.45, [[c.body.energy > 60, 0.15, 'fresh legs'], [c.fx.nav >= 3, 0.1, 'GPS'], [c.soon.severity > 0.85, -0.2, 'a severe front']]);
          return c.rand() < o.p ? { headline: 'Just in time', good: true, text: 'You reach the next campsite as the first hail arrives.', why: o.why, effects: { energy: -12 } } : { headline: 'Caught on the ridge', good: false, text: 'The front hits on the exposed crest: hail, wind, cold.', why: o.why, effects: { warmth: -30, wet: 0.8, energy: -15 } };
        } },
        { label: 'Bail off the range', resolve: () => ({ headline: 'Retreat', good: true, text: 'You head for the nearest moraine and the plains.', why: ['+ prudent'], effects: { action: 'retreat', flags: { badWeatherRetreat: true } } }) },
      ] },
    { id: 'beggary', kind: 'Terrain', title: 'Pack-hauling down a gully', once: true, perHour: 99,
      when: c => c.moving && c.y > 850 && c.zone.rock > 0.45 && c.exp.stage >= 2,
      text: 'The track drops off the crest down a near-vertical gully. You will need to lower your pack.',
      choices: [
        { label: 'Lower the pack on the hand line', need: 'rope', needText: 'needs a hand line', cost: 25, resolve: () => ({ headline: 'Controlled', good: true, text: 'Pack down, then you. Slow but safe.', why: ['+ hand line'], effects: { energy: -8 } }) },
        { label: 'Downclimb wearing the pack', cost: 10, resolve: (c) => {
          const o = odds(0.6, [[c.exp.packKg < 16, 0.15, 'a lighter pack'], [c.fx.helmet, 0.05, 'helmet'], [c.weather.precip > 0.05, -0.2, 'wet rock'], [c.body.energy < 35, -0.15, 'fatigue']]);
          return c.rand() < o.p ? { headline: 'Down', good: true, text: 'Awkward and exposed, but down.', why: o.why, effects: { energy: -10 } } : { headline: 'A heavy slip', good: false, text: 'The pack swings you off balance and you slither down the gully.', why: o.why, effects: { injury: 0.35, equip: { pack: 15 } } };
        } },
      ] },
  ],
};
