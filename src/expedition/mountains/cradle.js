// Cradle Mountain — technical terrain and changing conditions. OSM tracks/huts/lakes; GA terrain.
import { odds } from '../odds.js';

export default {
  id: 'cradle', tz: 11, startDate: '2027-01-16',
  eco: { forestTop: 950, treeline: 1150, snowLine: 2300, snowCover: 0, rockSlope: 0.80, moorland: 0.8, palette: 'tas-dolerite' },
  clim: { tMean: 11, tAmp: 5, wind: 22, cloud: 0.55, frontEvery: 40, valleyY: 900, tz: 11, wet: 1.3, drizzle: 0.3, frontBase: 950 },
  summitPlace: 'summit',
  camping: 'Camping is allowed at Waterfall Valley in this simulation. Kitchen Hut is an emergency shelter only.',
  trailheads: {
    dove: { name: 'Dove Lake car park', node: '696476545', exit: true },
    ronny: { name: 'Ronny Creek — start of the Overland Track', node: '9681601442', exit: true },
  },
  places: {
    summit: { node: '59141009', name: 'Cradle Mountain summit', r: 40 },
    kitchen: { poi: 'Kitchen Hut', name: 'Kitchen Hut', r: 50, hut: 'shelter', size: [4, 4], shelter: true },
    marions: { poi: "Marion's Lookout", name: "Marion's Lookout", r: 70, view: true },
    wombat: { poi: 'Wombat Pool Lookout', name: 'Wombat Pool', r: 60, water: 'lake' },
    crater: { poi: 'Crater Lake Hut', name: 'Crater Lake', r: 80, water: 'lake' },
    faceJn: { node: '590036277', name: 'Face Track junction', r: 40 },
    waterfall: { poi: 'Waterfall Valley Hut', name: 'Waterfall Valley Hut', r: 90, camp: true, water: 'tank', hut: 'gable', size: [9, 6] },
    barnBluff: { poi: 'Barn Bluff', name: 'Barn Bluff', r: 90, view: true },
  },
  farPeaks: [{ name: 'Barn Bluff', near: [-41.724, 145.923], search: 600 }, { name: 'Mount Ossa', near: [-41.8707, 146.033], search: 1500, note: "Tasmania's highest" }],
  routes: [
    { id: 'dove', name: 'Dove Lake — Marions Lookout — summit — Face Track', difficulty: 'mod', start: 'th:dove', via: ['wombat', 'marions', 'kitchen', 'summit', 'kitchen', 'faceJn'], end: 'th:dove', nights: 0,
      blurb: 'Up past Lake Lilla and Wombat Pool to Marions Lookout, along the plateau to Kitchen Hut, then the boulder-scramble to the summit. Return along the Face Track under the dolerite cliffs.',
      gear: ['boots-trail', 'shell', 'fleece', 'map-compass', 'helmet', 'firstaid'], teaches: 'Scrambling, wet rock, mist.', exposureExtra: 1 },
    { id: 'overland', name: 'Overland Track start — summit and Waterfall Valley', difficulty: 'hard', start: 'th:ronny', via: ['crater', 'marions', 'kitchen', 'summit', 'kitchen', 'waterfall', 'kitchen'], end: 'th:ronny', nights: 1,
      blurb: 'Begin the Overland Track from Ronny Creek, summit Cradle, continue south across exposed Cradle Cirque to camp at Waterfall Valley under Barn Bluff, and walk back the next day.',
      gear: ['pack-50', 'boots-trail', 'tent-1', 'bag-summer', 'stove', 'shell', 'fleece', 'map-compass', 'helmet', 'firstaid'], teaches: 'Exposure, overnight in Tasmanian weather.' },
  ],
  landmarks: [
    { id: 'dove', at: 'th:dove', title: 'Dove Lake', real: 'Dove Lake lies in a glacial basin directly beneath the dolerite towers of Cradle Mountain.' },
    { id: 'ronny', at: 'th:ronny', title: 'Ronny Creek', real: 'Ronny Creek is the northern start of the Overland Track.' },
    { id: 'marions', at: 'marions', title: "Marion's Lookout", real: "Marion's Lookout looks down on Dove Lake and across to the Cradle summit ridge." },
    { id: 'kitchen', at: 'kitchen', title: 'Kitchen Hut', real: 'Kitchen Hut is a small emergency shelter where the summit route leaves the Overland Track.' },
    { id: 'summit', at: 'summit', title: 'Cradle Mountain', real: 'The summit is reached by scrambling over large dolerite boulders; the jagged ridge of Weindorfers Tower, Smithies Peak and the summit gives the mountain its cradle shape.' },
    { id: 'waterfall', at: 'waterfall', title: 'Waterfall Valley', real: 'Waterfall Valley, below Barn Bluff, is the first overnight stop on the Overland Track.' },
  ],
  objectives: [
    { id: 'photo-dove', title: 'Photograph Dove Lake from above', kind: 'photo', place: 'marions', minScore: 50 },
    { id: 'photo-summit', title: 'Photograph from the summit boulders', kind: 'photo', place: 'summit', minScore: 50 },
  ],
  mentor: {
    briefing: [
      "Cradle's the first one that asks for your hands. The last stretch to the summit is boulder-hopping — big dolerite blocks, slippery when wet.",
      "Tasmanian weather doesn't do forecasts so much as suggestions. Pack for four seasons.",
      'A helmet is not overkill on the summit route. Grippy boots matter more than anything.',
    ],
    summit: 'You climbed a pile of rocks the size of houses. Now climb back down it — that is where people get hurt.',
  },
  encounters: [
    { id: 'cradle-boulders', kind: 'Scramble', title: 'Boulder field, wet and steep', once: true, perHour: 99,
      when: c => c.moving && c.y > 1350 && c.zone.rock > 0.3,
      text: c => `The route climbs over car-sized dolerite boulders with gaps between them. ${c.weather.precip > 0.05 || c.fog ? 'Everything is wet and greasy with mist.' : 'The rock is dry and grippy.'}`,
      choices: [
        { label: 'Climb carefully, three points of contact', cost: 15, resolve: (c) => {
          const o = odds(0.75, [[c.fx.grip >= 0.85, 0.12, 'grippy soles'], [c.fx.helmet, 0.05, 'helmet'], [c.weather.precip > 0.05 || c.fog, -0.2, 'wet rock'], [c.body.energy < 35, -0.12, 'tired arms'], [c.fx.capacityKg && c.exp.packKg > 14, -0.1, 'a heavy pack throws your balance']]);
          return c.rand() < o.p ? { headline: 'Up the boulders', good: true, text: 'Hand, foot, hand. You top out on the summit ridge.', why: o.why, effects: { energy: -6, xp: 20 } } : { headline: 'A slip between blocks', good: false, text: 'A foot skates off wet rock and you bang a shin hard against a boulder edge.', why: o.why, effects: { injury: c.fx.helmet ? 0.18 : 0.28, energy: -8 } };
        } },
        { label: 'Leave the heavy pack at Kitchen Hut first', cost: 10, resolve: (c, g) => { g.exp.flags.packCached = true; return { headline: 'Lighter', good: true, text: 'With just water and a jacket you move much more easily.', why: ['+ much lighter on the scramble', '− no supplies with you until you return'], effects: { flags: { lightScramble: true } } }; } },
        { label: 'Turn back — not today', resolve: () => ({ headline: 'Retreat', good: true, text: 'The summit can wait for dry rock.', effects: { action: 'retreat' } }) },
      ] },
    { id: 'cradle-mist', kind: 'Weather', title: 'Mist fills the cirque', once: true, perHour: 1.2,
      when: c => c.fog && c.moving && c.y > 1100,
      text: 'In minutes the cirque fills with mist. The towers disappear and the boardwalk is the only thing you can see.',
      choices: [
        { label: 'Stay on the boardwalk and keep going', cost: 5, resolve: (c) => ({ headline: 'Following the boards', good: true, text: 'The boardwalk keeps you honest.', why: ['+ a formed track'], effects: {} }) },
        { label: 'Shelter at Kitchen Hut and wait', cost: 45, resolve: (c) => ({ headline: c.soon.clearing ? 'It lifts' : 'Still thick', good: !!c.soon.clearing, text: c.soon.clearing ? 'The mist peels back off the towers.' : 'An hour in a cold hut, still misty.', effects: { warmth: -6, restful: true } }) },
      ] },
  ],
};
