// Frenchmans Cap — remote wilderness expedition. OSM track/huts/lakes; GA terrain. Pale quartzite palette.
import { odds } from '../odds.js';

export default {
  id: 'frenchmans', tz: 11, startDate: '2027-03-06',
  eco: { forestTop: 720, treeline: 980, snowLine: 2300, snowCover: 0, rockSlope: 0.80, moorland: 0.9, palette: 'tas-quartzite' },
  clim: { tMean: 12, tAmp: 5, wind: 22, cloud: 0.65, frontEvery: 36, valleyY: 400, tz: 11, wet: 1.5, drizzle: 0.5, frontBase: 700 },
  summitPlace: 'summit',
  camping: 'Camping is allowed at the Loddon River, Lake Vera and Lake Tahune in this simulation.',
  trailheads: {
    lyell: { name: 'Lyell Highway trailhead', node: '2368193209', exit: true },
  },
  places: {
    summit: { node: '2368193205', name: 'Frenchmans Cap summit', r: 40 },
    loddon: { poi: 'Loddon River East Bank', name: 'Loddon River', r: 80, camp: true, water: 'creek' },
    vera: { poi: 'Vera Hut', name: 'Vera Hut (Lake Vera)', r: 90, camp: true, water: 'lake', hut: 'gable', size: [9, 6] },
    barron: { poi: 'Barron Pass', name: 'Barron Pass', r: 60, view: true },
    tahune: { poi: 'Tahune Hut', name: 'Tahune Hut (Lake Tahune)', r: 80, camp: true, water: 'lake', hut: 'gable', size: [8, 5] },
    northcol: { poi: 'North Col', name: 'North Col', r: 50, view: true },
    donaghys: { poi: 'Donaghys Lookout', name: "Donaghys Lookout", r: 80, view: true },
  },
  farPeaks: [{ name: 'Philps Peak', near: [-42.2857, 145.8639], search: 500 }, { name: 'Clytemnestra', near: [-42.2858, 145.818], search: 500 }],
  routes: [
    { id: 'steady', name: 'Three nights: Loddon, Vera, Tahune', difficulty: 'hard', start: 'th:lyell', via: ['loddon', 'vera', 'barron', 'tahune', 'northcol', 'summit', 'tahune', 'barron', 'vera'], end: 'th:lyell', nights: 3,
      blurb: 'The patient plan: cross the Franklin and the Loddon Plains, camp at Lake Vera, climb over Barron Pass under the quartzite walls to Lake Tahune, summit via North Col, and walk out over two days.',
      gear: ['pack-70', 'boots-alpine', 'gaiters', 'tent-4s', 'bag-alpine', 'stove', 'shell-pro', 'puffy', 'map-compass', 'headtorch', 'firstaid', 'helmet'], teaches: 'Remote logistics and rain.' },
    { id: 'fast', name: 'Fast and light: two nights at Tahune', difficulty: 'hard', start: 'th:lyell', via: ['vera', 'barron', 'tahune', 'northcol', 'summit', 'tahune'], end: 'th:lyell', nights: 2,
      blurb: 'The same single track, but long days: straight through to Lake Tahune, summit, and a huge walk out. Less food to carry, much less margin for weather or injury.',
      gear: ['pack-50', 'boots-alpine', 'gaiters', 'tent-1', 'bag-alpine', 'stove', 'shell-pro', 'puffy', 'map-compass', 'headtorch', 'firstaid'], teaches: 'Speed versus margin.', rewardMult: 1.3 },
  ],
  landmarks: [
    { id: 'lyell', at: 'th:lyell', title: 'Lyell Highway', real: 'The Frenchmans Cap track starts from the Lyell Highway and soon crosses the Franklin River.' },
    { id: 'loddon', at: 'loddon', title: 'Loddon River', real: 'The track crosses the button-grass Loddon Plains — notorious for mud — before climbing towards Lake Vera.' },
    { id: 'vera', at: 'vera', title: 'Lake Vera', real: 'Lake Vera sits in rainforest below the quartzite cliffs; Vera Hut is the first hut on the track.' },
    { id: 'barron', at: 'barron', title: 'Barron Pass', real: 'Barron Pass crosses under the white quartzite walls of Sharlands Peak and Nicoles Needle.' },
    { id: 'tahune', at: 'tahune', title: 'Lake Tahune', real: 'Lake Tahune lies beneath the sheer south-east face of Frenchmans Cap, one of the tallest cliffs in Australia.' },
    { id: 'summit', at: 'summit', title: 'Frenchmans Cap', real: 'Frenchmans Cap (1446 m) is a dome of pale quartzite visible from far across western Tasmania.' },
  ],
  objectives: [
    { id: 'photo-face', title: 'Photograph the quartzite face from Lake Tahune', kind: 'photo', place: 'tahune', minScore: 55 },
    { id: 'photo-summit', title: 'Photograph from the summit dome', kind: 'photo', place: 'summit', minScore: 55 },
  ],
  mentor: {
    briefing: [
      "Frenchmans is remote. Once you're past the Loddon you're a long way from help, and it rains here more than it doesn't.",
      'One track in and out. The choice is how you pace it: patient with three camps, or fast with two and no margin.',
      'Good waterproofs and good boots, or you will be wet and blistered by Lake Vera.',
    ],
    summit: 'White rock and black lakes — that face below you is one of the biggest cliffs in the country.',
  },
  encounters: [
    { id: 'franklin-crossing', kind: 'River', title: 'The Franklin is up', once: true, perHour: 99,
      when: c => c.moving && c.zone.wet > 0.85 && c.y < 300 && c.weather.precip > 0.2,
      text: 'Overnight rain has the Franklin running brown and fast. The crossing is on a swing bridge — but the approach is under knee-deep water.',
      choices: [
        { label: 'Wade the flooded approach', resolve: (c) => {
          const o = odds(0.7, [[c.fx.poles, 0.15, 'poles for balance'], [c.weather.precip > 1.5, -0.25, 'heavy rain still falling'], [c.body.energy < 40, -0.1, 'fatigue']]);
          return c.rand() < o.p ? { headline: 'Across', good: true, text: 'Cold to the knees, but over the bridge.', why: o.why, effects: { wet: 0.4, warmth: -6 } } : { headline: 'Knocked over', good: false, text: 'The current takes your feet; you scramble out soaked to the chest.', why: o.why, effects: { wet: 1, warmth: -25, injury: 0.1 } };
        } },
        { label: 'Wait for the level to drop', cost: 120, resolve: (c) => ({ headline: 'Waiting', good: !c.soon.worsening, text: c.soon.worsening ? 'More rain. The river is still up.' : 'The water recedes enough to cross dry-footed.', effects: { restful: true } }) },
      ] },
    { id: 'quartzite-slab', kind: 'Scramble', title: 'Quartzite slabs above North Col', once: true, perHour: 99,
      when: c => c.moving && c.y > 1250 && c.zone.rock > 0.3,
      text: c => `Pale quartzite slabs lead to the summit dome. ${c.weather.precip > 0.05 || c.fog ? 'They are wet and as slick as glass.' : 'Dry, they are wonderfully grippy.'}`,
      choices: [
        { label: 'Climb the slabs', cost: 12, resolve: (c) => {
          const o = odds(0.78, [[c.fx.grip >= 0.95, 0.1, 'stiff mountain boots'], [c.fx.helmet, 0.05, 'helmet'], [c.weather.precip > 0.05, -0.3, 'wet quartzite'], [c.wind > 50, -0.1, 'gusty wind']]);
          return c.rand() < o.p ? { headline: 'On the dome', good: true, text: 'The slabs ease and the summit appears.', why: o.why, effects: { xp: 25 } } : { headline: 'A slide', good: false, text: 'Your boots skate on wet quartzite. You stop yourself after a frightening slide.', why: o.why, effects: { injury: 0.3, equip: { pack: 10 } } };
        } },
        { label: 'Wait for the rock to dry', cost: 60, resolve: (c) => ({ headline: c.weather.precip > 0.05 ? 'Still wet' : 'Drier', good: c.weather.precip < 0.05, text: c.weather.precip > 0.05 ? 'It is still raining.' : 'Wind and sun dry the slabs.', effects: { warmth: -6, restful: true } }) },
        { label: 'Turn back here', resolve: () => ({ headline: 'Retreat', good: true, text: 'You have seen the face from below. That is enough.', effects: { action: 'retreat' } }) },
      ] },
  ],
};
