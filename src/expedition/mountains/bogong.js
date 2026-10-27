// Mount Bogong — endurance and navigation. Tracks and huts from OpenStreetMap; terrain from GA.
import { odds } from '../odds.js';

export default {
  id: 'bogong', tz: 11, startDate: '2027-02-06',
  eco: { forestTop: 1250, treeline: 1760, snowLine: 2300, snowCover: 0, rockSlope: 0.70, moorland: 0, palette: 'vic-alps' },
  clim: { tMean: 18, tAmp: 8, wind: 18, cloud: 0.35, frontEvery: 54, valleyY: 600, tz: 11 },
  summitPlace: 'summit',
  camping: 'Camping is allowed near Bivouac Hut, Michell Hut and Cleve Cole Hut in this simulation, not on the exposed summit plateau.',
  trailheads: {
    mtncreek: { name: 'Mountain Creek campground', node: '602893227', exit: true },
  },
  places: {
    summit: { poi: 'Mount Bogong', name: 'Mount Bogong summit', r: 60 },
    staircaseFoot: { node: '603437757', name: 'Foot of the Staircase', r: 50 },
    bivouac: { poi: 'Bivouac Hut', name: 'Bivouac Hut', r: 70, camp: true, water: 'tank', hut: 'shelter', size: [5, 4] },
    gadsden: { poi: 'Gadsden Memorial', name: 'Gadsden Memorial cairn', r: 50 },
    westpeak: { poi: 'West Peak', name: 'West Peak', r: 80, view: true },
    michell: { poi: 'Michell Hut', name: 'Michell Hut', r: 70, camp: true, water: 'creek', hut: 'gable', size: [6, 4.5] },
    clevecole: { poi: 'Cleve Cole Hut', name: 'Cleve Cole Hut', r: 70, camp: true, water: 'tank', hut: 'gable', size: [9, 6] },
    campcreek: { poi: 'Camp Creek Gap', name: 'Camp Creek Gap', r: 60 },
    eskdaleTop: { node: '603443036', name: 'Top of Eskdale Spur', r: 50 },
  },
  farPeaks: [{ name: 'Mount Feathertop', near: [-36.8942, 147.1381], search: 800 }, { name: 'Mount Kosciuszko', near: [-36.4558, 148.2635], search: 2000, note: 'far to the north-east' }],
  routes: [
    { id: 'staircase', name: 'The Staircase — up and back', difficulty: 'mod', start: 'th:mtncreek', via: ['staircaseFoot', 'bivouac', 'summit', 'bivouac'], end: 'th:mtncreek', nights: 1,
      blurb: 'Straight up the Staircase Spur through tall forest, past Bivouac Hut and onto the open summit plateau. A night at Bivouac Hut and the same way down.',
      gear: ['pack-50', 'tent-1', 'bag-summer', 'stove', 'shell', 'fleece', 'map-compass', 'headtorch', 'firstaid'], teaches: 'A huge climb and plateau navigation.' },
    { id: 'loop', name: 'Staircase – Eskdale loop', difficulty: 'hard', start: 'th:mtncreek', via: ['staircaseFoot', 'bivouac', 'summit', 'eskdaleTop', 'michell', 'campcreek'], end: 'th:mtncreek', nights: 1,
      blurb: 'Up the Staircase, across the summit plateau to the head of Eskdale Spur, down past Michell Hut to Camp Creek Gap and back along Mountain Creek. Longer, with tricky plateau navigation.',
      gear: ['pack-50', 'tent-1', 'bag-summer', 'stove', 'shell', 'fleece', 'map-compass', 'headtorch', 'firstaid', 'poles'], teaches: 'Route-finding, accumulated fatigue, a loop.', navExtra: 1 },
  ],
  landmarks: [
    { id: 'mtncreek', at: 'th:mtncreek', title: 'Mountain Creek', real: 'Mountain Creek campground in the Kiewa valley is the usual start for the Staircase Spur.' },
    { id: 'bivouac', at: 'bivouac', title: 'Bivouac Hut', real: 'Bivouac Hut is a small shelter partway up the Staircase Spur.' },
    { id: 'summit', at: 'summit', title: 'Mount Bogong', real: "At 1986 m Bogong is Victoria's highest mountain, a broad massif with a long exposed summit ridge." },
    { id: 'gadsden', at: 'gadsden', title: 'Memorial cairn', real: 'OpenStreetMap marks a memorial near the summit (the Gadsden Memorial) — one of several on Bogong remembering people who lost their lives on the mountain.' },
    { id: 'clevecole', at: 'clevecole', title: 'Cleve Cole Hut', real: 'Cleve Cole Hut, on the eastern side of the plateau, is named after a skier and walker who died after being lost on Bogong in the 1930s.' },
    { id: 'michell', at: 'michell', title: 'Michell Hut', real: 'Michell Hut sits on the Eskdale Spur below the plateau.' },
  ],
  objectives: [
    { id: 'photo-summit', title: 'Photograph the summit plateau', kind: 'photo', place: 'summit', minScore: 50 },
    { id: 'visit-west', title: 'Detour to West Peak', kind: 'visit', place: 'westpeak' },
  ],
  mentor: {
    briefing: [
      "Bogong's big. Biggest climb in the state — thirteen hundred metres of up before you reach the plateau.",
      'Up top it is wide and featureless. In cloud people walk in circles here; take the map seriously.',
      'Water is scarce on the Staircase. Carry plenty and know where the next tank is.',
    ],
    summit: 'Highest in Victoria. And now the plateau — easy to get lost on a good day, worse in cloud.',
  },
  encounters: [
    { id: 'bogong-plateau-cloud', kind: 'Navigation', title: 'White-out on the plateau', once: true, perHour: 1.5,
      when: c => c.fog && c.y > 1800 && c.moving,
      text: 'The plateau vanishes. Snow poles loom out of the cloud one at a time, and then there is a gap where the next one should be.',
      choices: [
        { label: 'Take a bearing and pace it out', cost: 10, resolve: (c) => {
          const o = odds(0.45, [[c.fx.nav >= 2, 0.3, 'map and compass'], [c.fx.nav >= 3, 0.15, 'GPS'], [c.body.warmth < 40, -0.1, 'cold, slow thinking']]);
          return c.rand() < o.p ? { headline: 'Pole to pole', good: true, text: 'The next pole appears exactly where the bearing said.', why: o.why, effects: { xp: 25 } } : { headline: 'Lost the line', good: false, text: 'You spend a long, cold time quartering the plateau before you find the poles again.', why: o.why, extraMin: 45, effects: { warmth: -12, energy: -10 } };
        } },
        { label: 'Wait for a break in the cloud', cost: 45, resolve: (c) => ({ headline: c.soon.clearing ? 'A window' : 'No window', good: !!c.soon.clearing, text: c.soon.clearing ? 'The cloud thins and the poles march away in a line.' : 'The cloud stays. You are cold and still need to move.', why: [c.soon.clearing ? '+ clearing weather' : '− settled cloud'], effects: { warmth: -10, restful: true } }) },
        { label: 'Retrace your steps', resolve: () => ({ headline: 'Retreat', good: true, text: 'You follow your own tracks back off the plateau.', effects: { action: 'retreat' } }) },
      ] },
    { id: 'bogong-snake', kind: 'Encounter', title: 'Tiger snake on the track', once: true, perHour: 0.4,
      when: c => c.moving && c.onTrail && c.temp > 18 && c.zone.forest > 0.3,
      text: 'A tiger snake lies across the track, basking. It lifts its head as you approach.',
      choices: [
        { label: 'Back off and wait for it to move', cost: 8, resolve: () => ({ headline: 'Patience', good: true, text: 'After a while it slides off into the leaf litter.', why: ['+ gave it space'], effects: {} }) },
        { label: 'Detour wide through the scrub', cost: 5, resolve: (c) => ({ headline: 'Through the scrub', good: true, text: 'Scratched shins, but you are past.', why: ['− scrub is hard on gear'], effects: { equip: { shell: 4 }, energy: -3 } }) },
      ] },
  ],
};
