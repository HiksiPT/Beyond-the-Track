// Mount Ossa — sustained, multi-stage expedition planning. OSM tracks/huts/lakes; GA terrain.
import { odds } from '../odds.js';

export default {
  id: 'ossa', tz: 11, startDate: '2027-02-20',
  eco: { forestTop: 950, treeline: 1200, snowLine: 2300, snowCover: 0, rockSlope: 0.78, moorland: 0.8, palette: 'tas-highlands' },
  clim: { tMean: 11.5, tAmp: 5.5, wind: 20, cloud: 0.55, frontEvery: 42, valleyY: 750, tz: 11, wet: 1.3, drizzle: 0.25, frontBase: 1000 },
  summitPlace: 'summit',
  camping: 'Camping is allowed at New Pelion Hut and Kia Ora Hut in this simulation. Pelion Gap is exposed and has no water.',
  trailheads: {
    arm: { name: 'Arm River Track trailhead', node: '1798970572', exit: true },
  },
  places: {
    summit: { node: '647692962', name: 'Mount Ossa summit', r: 40 },
    pelion: { poi: 'New Pelion Hut', name: 'New Pelion Hut', r: 90, camp: true, water: 'tank', hut: 'gable', size: [12, 7] },
    oldpelion: { poi: 'Old Pelion Hut', name: 'Old Pelion Hut', r: 50, hut: 'timber', size: [5, 4] },
    mine: { poi: 'Abandoned Copper Mine', name: 'Old copper mine', r: 40 },
    gap: { node: '647695394', name: 'Pelion Gap', r: 50, view: true },
    pelionEast: { node: '1832700758', name: 'Mount Pelion East', r: 50, view: true },
    kiaora: { poi: 'Kia Ora Hut', name: 'Kia Ora Hut', r: 80, camp: true, water: 'tank', hut: 'gable', size: [9, 6] },
  },
  farPeaks: [{ name: 'Cradle Mountain', near: [-41.6846, 145.9513], search: 1500 }, { name: 'Barn Bluff', near: [-41.724, 145.923], search: 1000 }],
  routes: [
    { id: 'classic', name: 'Arm River — New Pelion — Ossa', difficulty: 'mod', start: 'th:arm', via: ['pelion', 'gap', 'summit', 'gap', 'pelion'], end: 'th:arm', nights: 2,
      blurb: 'Climb over the Arm River Track to the button-grass Pelion Plains and New Pelion Hut, then the Overland Track to Pelion Gap and the rugged dolerite summit of Ossa. Base at New Pelion both nights.',
      gear: ['pack-50', 'boots-trail', 'tent-1', 'bag-summer', 'stove', 'shell', 'fleece', 'map-compass', 'headtorch', 'firstaid'], teaches: 'Multi-day supplies, a base camp, weather windows.' },
    { id: 'peaks', name: 'Ossa and Pelion East — with Kia Ora', difficulty: 'hard', start: 'th:arm', via: ['pelion', 'gap', 'pelionEast', 'gap', 'summit', 'gap', 'kiaora', 'gap', 'pelion'], end: 'th:arm', nights: 2,
      blurb: 'Both summits above Pelion Gap, a night at Kia Ora under Cathedral Mountain, and the long walk back. More climbing, more supplies, more exposure.',
      gear: ['pack-50', 'boots-trail', 'tent-1', 'bag-summer', 'stove', 'shell', 'fleece', 'puffy', 'map-compass', 'headtorch', 'firstaid', 'helmet'], teaches: 'Equipment trade-offs over three days.', exposureExtra: 1 },
  ],
  landmarks: [
    { id: 'arm', at: 'th:arm', title: 'Arm River', real: 'The Arm River Track is a short-cut onto the Overland Track from the east, climbing to the Pelion Plains.' },
    { id: 'pelion', at: 'pelion', title: 'New Pelion Hut', real: 'New Pelion Hut is one of the larger huts on the Overland Track, on the edge of the Pelion Plains with Mount Oakleigh to the north.' },
    { id: 'oldpelion', at: 'oldpelion', title: 'Old Pelion Hut', real: 'Old Pelion Hut dates from the copper-mining era; OSM marks an abandoned copper mine nearby.' },
    { id: 'gap', at: 'gap', title: 'Pelion Gap', real: 'Pelion Gap is the saddle between Mount Pelion East and Mount Doris where the side track to Mount Ossa leaves the Overland Track.' },
    { id: 'summit', at: 'summit', title: 'Mount Ossa', real: "At 1617 m Ossa is Tasmania's highest mountain, a block of dolerite cliffs and columns above the Pelion Gap." },
    { id: 'kiaora', at: 'kiaora', title: 'Kia Ora', real: 'Kia Ora Hut sits below Cathedral Mountain on the Overland Track south of Pelion Gap.' },
  ],
  objectives: [
    { id: 'photo-summit', title: 'Photograph from the top of Tasmania', kind: 'photo', place: 'summit', minScore: 55 },
    { id: 'visit-mine', title: 'Find the old copper mine', kind: 'visit', place: 'mine' },
    { id: 'pelion-east', title: 'Climb Mount Pelion East too', kind: 'visit', place: 'pelionEast' },
  ],
  mentor: {
    briefing: [
      'Ossa is a few days in the bush. That means food for every day plus one, fuel, and a tent that stands up in wind.',
      'The plan is simple: base at New Pelion, wait for a decent morning, then go for the summit from Pelion Gap.',
      'The last bit is a scramble up dolerite. Turn around if it is wet and windy — it will be there next summer.',
    ],
    summit: 'Highest point in Tasmania. Everything you can see is wilderness — and you still have to walk out of it.',
  },
  encounters: [
    { id: 'ossa-window', kind: 'Decision', title: 'Summit day or rest day?', once: true, perHour: 99,
      when: c => c.atPlace === 'pelion' && c.hour > 5 && c.hour < 9 && c.exp.visited.pelion && c.exp.nights >= 1 && !c.exp.summit,
      text: c => `Morning at New Pelion. ${c.soon.worsening ? 'The radio forecast mentions a front by afternoon.' : 'High cloud, light wind.'} Food left for about ${(c.exp.foodKcal / 2500).toFixed(1)} days.`,
      choices: [
        { label: 'Go for the summit now', resolve: (c) => ({ headline: 'Summit push', good: true, text: 'Light pack, early start.', why: ['+ taking the window'], effects: {} }) },
        { label: 'Wait a day for better weather', cost: 60 * 8, resolve: (c) => ({ headline: 'A rest day', good: c.exp.foodKcal > 5000, text: c.exp.foodKcal > 5000 ? 'You read, eat and watch the weather. Tomorrow looks better.' : 'You wait, but your food is getting thin.', why: [c.exp.foodKcal > 5000 ? '+ enough food to wait' : '− food is short'], effects: { energy: 30, hunger: 25, restful: true } }) },
        { label: 'Call it — walk out', resolve: () => ({ headline: 'Retreat', good: true, text: 'Not this time.', effects: { action: 'retreat' } }) },
      ] },
    { id: 'ossa-mud', kind: 'Terrain', title: 'Bottomless mud', once: true, perHour: 0.8,
      when: c => c.moving && c.zone.moor > 0.3,
      text: 'The track dissolves into black button-grass mud, knee-deep in places. Going around widens the erosion scar.',
      choices: [
        { label: 'Straight through the mud', resolve: (c) => ({ headline: 'Through it', good: true, text: 'Filthy and soaked to the knees, but on the track.', why: c.fx.scrub < 1 ? ['+ gaiters'] : ['− wet feet'], effects: { wet: c.fx.scrub < 1 ? 0.05 : 0.25, equip: { boots: 3 }, rep: 1 } }) },
        { label: 'Skirt around through the plants', cost: 5, resolve: () => ({ headline: 'Around', good: null, text: 'Dry feet, wider scar on the plains.', why: ['− track erosion'], effects: { rep: -1 } }) },
      ] },
  ],
};
