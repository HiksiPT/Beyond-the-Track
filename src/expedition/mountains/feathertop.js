// Mount Feathertop — first serious alpine challenge, with a winter scenario and the corniced-ridge encounter.
// Tracks, huts and springs from OpenStreetMap; terrain from GA. Encounters and mentor lines are fiction.
import { odds } from '../odds.js';

export default {
  id: 'feathertop', tz: 11, startDate: '2026-11-21',
  eco: { forestTop: 1180, treeline: 1760, snowLine: 1790, snowCover: 0.45, rockSlope: 0.70, moorland: 0, palette: 'vic-alps' },
  clim: { tMean: 13.5, tAmp: 7, wind: 16, cloud: 0.35, frontEvery: 56, valleyY: 500, tz: 11 },
  scenarios: {
    summer: { label: 'Late spring', desc: 'Long days, lingering snow patches on the shaded slopes.' },
    winter: { label: 'Winter', desc: 'Snow from about 1300 m, short days, cornices on the ridges. Microspikes and an ice axe matter.', tz: 10, startDate: '2026-08-15',
      eco: { snowLine: 1300, snowCover: 1.0 }, clim: { tMean: 5, tAmp: 4, wind: 24, cloud: 0.5, frontEvery: 42, tz: 10 }, rewardMult: 1.4 },
  },
  summitPlace: 'summit',
  camping: 'Camping is allowed at Federation Hut and MUMC Hut only in this simulation; the summit area is protected.',
  trailheads: {
    harrietville: { name: 'Harrietville — Bungalow Spur trailhead', node: '538659378', exit: true },
    diamantina: { name: 'Diamantina Hut, Mt Hotham', node: '2106924828', exit: true },
    nwspur: { name: 'Stony Creek — foot of the Northwest Spur', node: '610711732', exit: true },
  },
  places: {
    summit: { node: '251154646', name: 'Mount Feathertop summit', r: 45 },
    fedhut: { poi: 'Federation Hut', name: 'Federation Hut', r: 70, camp: true, water: 'tank', hut: 'gable', size: [8, 5] },
    mumc: { poi: 'MUMC Hut', name: 'MUMC Hut', r: 70, camp: true, water: 'tank', hut: 'aframe', size: [5.5, 6] },
    diamhut: { poi: 'Diamantina Hut', name: 'Diamantina Hut', r: 60, hut: 'shelter', size: [4, 3.5], shelter: true },
    littlefeather: { poi: 'Little Feathertop', name: 'Little Feathertop', r: 60, view: true },
    nwspring: { poi: 'NW Spur Spring', name: 'NW Spur Spring', r: 40, water: 'spring' },
    oldhut: { poi: 'Old Feathertop Hut Site', name: 'Old Feathertop Hut site', r: 70 },
    bungalow: { poi: 'Feathertop Bungalow Site', name: 'Feathertop Bungalow site', r: 70 },
    bungspring: { latlon: [-36.89745, 147.11399], name: 'Spring below the bungalow site', r: 35, water: 'spring' },
    tobias: { poi: 'Tobias Gap', name: 'Tobias Gap', r: 80, view: true },
    picture: { poi: 'Picture Point', name: 'Picture Point', r: 80, view: true },
    razorJn: { node: '610709627', name: 'Razorback junction', r: 40 },
    diamJn: { node: '1260489561', name: 'Diamantina Spur junction', r: 40 },
    geezer: { poi: 'Geezer Hill', name: 'Geezer Hill', r: 80 },
  },
  farPeaks: [{ name: 'Mount Bogong', near: [-36.7324, 147.3058], search: 1500, note: "Victoria's highest" }, { name: 'Mount Buffalo plateau', near: [-36.75, 146.78], search: 6000 }],
  routes: [
    { id: 'bungalow', name: 'Bungalow Spur — up and back', difficulty: 'mod', start: 'th:harrietville', via: ['tobias', 'bungalow', 'fedhut', 'summit', 'fedhut'], end: 'th:harrietville', nights: 1,
      blurb: 'The classic: a long, steady climb through tall forest and snow gums from the Ovens valley to Federation Hut, a night there, then the summit and back down.',
      gear: ['tent-1', 'bag-summer', 'stove', 'shell', 'fleece', 'headtorch', 'map-compass', 'firstaid'], teaches: 'Pacing, water carrying, a camp, summit timing.' },
    { id: 'razorback', name: 'Razorback traverse — Hotham to Harrietville', difficulty: 'mod', start: 'th:diamantina', via: ['geezer', 'razorJn', 'fedhut', 'summit', 'fedhut'], end: 'th:harrietville', nights: 1,
      blurb: 'Start high at Mt Hotham and follow the exposed Razorback north above the treeline. No shade, nowhere to hide from wind or cloud. Descend the Bungalow Spur.',
      gear: ['tent-1', 'bag-summer', 'stove', 'shell', 'fleece', 'puffy', 'headtorch', 'map-compass', 'firstaid'], teaches: 'Exposure, weather windows, a one-way route.', exposureExtra: 1 },
    { id: 'nwspur', name: 'Northwest Spur — the steep way', difficulty: 'hard', start: 'th:nwspur', via: ['nwspring', 'mumc', 'summit', 'razorJn', 'fedhut'], end: 'th:harrietville', nights: 1,
      blurb: 'A relentless climb of more than 1200 m from Stony Creek to MUMC Hut, the summit from the north, and down the Bungalow Spur. Few water points low down.',
      gear: ['tent-1', 'bag-summer', 'stove', 'shell', 'fleece', 'headtorch', 'map-compass', 'firstaid', 'poles'], teaches: 'Water, stamina, steep descents.' },
  ],
  landmarks: [
    { id: 'harrietville', at: 'th:harrietville', title: 'Harrietville', real: 'Harrietville sits in the Ovens River valley at about 500 m. The Bungalow Spur track climbs from near the town to Federation Hut.' },
    { id: 'diamantina', at: 'th:diamantina', title: 'Diamantina Hut', real: 'The Razorback branches north from the Mt Hotham area along a narrow ridge to Feathertop, mostly above the treeline.' },
    { id: 'tobias', at: 'tobias', title: 'Tobias Gap', real: 'A saddle on the Bungalow Spur with the first wide views back over the Ovens valley.' },
    { id: 'bungalow', at: 'bungalow', title: 'The bungalow site', real: 'OpenStreetMap marks the Feathertop Bungalow and Old Feathertop Hut sites here — remains of earlier tourist accommodation that gave the spur its name.' },
    { id: 'fedhut', at: 'fedhut', title: 'Federation Hut', real: 'Federation Hut stands near the junction of the Bungalow Spur and the Razorback, the usual base for a summit.' },
    { id: 'summit', at: 'summit', title: 'Mount Feathertop', real: "At 1922 m Feathertop is Victoria's second-highest peak. The name is often linked to the feather-like snow cornices that build on its eastern side." },
    { id: 'mumc', at: 'mumc', title: 'MUMC Hut', real: 'MUMC Hut sits on the Northwest Spur below the summit; MUMC is the Melbourne University Mountaineering Club.' },
    { id: 'diamJn', at: 'diamJn', title: 'Diamantina Spur', real: 'OpenStreetMap grades the Diamantina Spur track as demanding mountain hiking; it drops steeply east into the Kiewa.' },
  ],
  objectives: [
    { id: 'photo-razor', title: 'Photograph the Razorback from the summit', kind: 'photo', place: 'summit', minScore: 50 },
    { id: 'visit-little', title: 'Detour to Little Feathertop', kind: 'visit', place: 'littlefeather' },
    { id: 'night-hut', title: 'Spend a night at a hut campsite', kind: 'camp' },
  ],
  mentor: {
    briefing: [
      "Feathertop is where it gets real. Twelve hundred metres of climbing from Harrietville, and no water on the spur until the hut.",
      'Look at the Razorback on the map: a long exposed seam. Glorious in sun, miserable in a westerly.',
      'If you choose winter: cornices form on the lee side of the ridge. Footprints in the snow are not a guarantee of anything.',
    ],
    summit: 'Victoria at your feet. Look south — that ridge is the Razorback. Now, how much daylight have you got?',
  },
  encounters: [
    { id: 'cornice', kind: 'Winter · corniced ridge', title: 'The corniced ridge', once: true, perHour: 99, scenario: 'winter',
      when: c => c.moving && c.exposed && c.y > 1720 && c.onTrail && c.snow,
      text: c => `You reach an exposed section of the ridge. Existing footsteps appear to follow a line near the edge, while the terrain farther from the edge is less straightforward.${c.fog ? ' Cloud hides where the snow ends and the air begins.' : ''}`,
      choices: [
        { label: 'Follow the visible footsteps', sub: 'Someone came this way…',
          resolve: (c) => {
            const o = odds(0.55, [[!c.fog, 0.1, 'you can see the lip of the ridge'], [c.fx.axe, 0.08, 'an ice axe to probe and arrest'], [c.fog, -0.25, 'visibility too poor to judge the edge'],
              [c.wind > 45, -0.1, 'fresh wind loading on the lee side'], [c.body.energy < 35, -0.1, 'tired, less careful']]);
            if (c.rand() < o.p) return { headline: 'You got away with it', good: null, text: 'The steps hold. Later, from the summit, you look back and see the line you walked: it ran across overhanging snow, a metre from nothing. Tracks are not proof of safety.', why: o.why, effects: { flags: { corniceLuck: true } } };
            return { headline: 'The edge breaks', good: false, text: 'With a soft thump a slab of cornice drops away beside you. You throw yourself uphill as the snow under one boot goes. Shaken, bruised, snow down your neck.', why: o.why, effects: { injury: c.fx.axe ? 0.2 : 0.45, warmth: -12, wet: 0.3, flags: { corniceFall: true } } };
          } },
        { label: 'Stop to assess the terrain', sub: 'Look at the shape of the ridge from a safe spot', cost: 12,
          resolve: (c) => {
            const o = odds(0.6, [[!c.fog, 0.25, 'clear enough to read the snow'], [c.fx.axe, 0.1, 'probing with an axe'], [c.fog, -0.2, 'cloud'], [c.flags.knowsCornices, 0.1, 'Peg’s briefing']]);
            if (c.rand() < o.p) return { headline: 'You see it', good: true, text: 'From a rock outcrop the overhang is obvious: the footsteps cross the cornice itself. You pick a line well back on solid ground.', why: o.why, effects: { xp: 40, rep: 2, flags: { corniceRead: true } } };
            return { headline: 'Hard to tell', good: null, text: 'You can’t be certain where the ground ends. You stay well back from the edge and move carefully, losing time.', why: o.why, extraMin: 15, effects: { warmth: -5 } };
          } },
        { label: 'Take an alternative line on the windward slope', sub: 'Slower, steeper sidling away from the edge', cost: 20,
          resolve: (c) => {
            const o = odds(0.65, [[c.fx.spikes, 0.2, 'microspikes on hard snow'], [c.fx.axe, 0.1, 'ice axe'], [c.fx.grip < 0.8, -0.2, 'poor footwear'], [c.body.energy < 30, -0.1, 'fatigue']]);
            if (c.rand() < o.p) return { headline: 'Slow and solid', good: true, text: 'It is harder work, but every step is on ground.', why: o.why, effects: { energy: -10, xp: 25 } };
            return { headline: 'A slip on the sidle', good: false, text: 'Your feet skate on wind-hardened snow; you stop yourself, heart hammering.', why: o.why, effects: { energy: -12, injury: 0.15 } };
          } },
        { label: 'Retreat — conditions are unacceptable', sub: 'Turn around here',
          resolve: () => ({ headline: 'Turned back', good: true, text: 'The mountain will be there next winter. You will be too.', why: ['+ refused an unknown risk'], effects: { action: 'retreat', xp: 30, flags: { corniceRetreat: true } } }) },
      ] },
    { id: 'tank-low', kind: 'Supplies', title: 'The hut tank is low', once: true, perHour: 99,
      when: c => c.atPlace === 'fedhut' && c.scenario !== 'winter',
      text: 'The water tank at Federation Hut gurgles and coughs. There is some, but other parties will need it too.',
      choices: [
        { label: 'Take only what you need for tonight', cost: 4, resolve: () => ({ headline: 'Sharing', good: true, text: 'You take what you need and leave the rest.', why: ['+ considerate'], effects: { flags: { tankLimit: 2.5 }, rep: 2 } }) },
        { label: 'Fill everything', cost: 6, resolve: () => ({ headline: 'Full bottles', good: null, text: 'Your bottles are full. The next party looks at the tank and says nothing.', why: ['− took more than your share'], effects: { flags: { tankLimit: 99 }, rep: -3 } }) },
        { label: 'Walk to the spring below the bungalow site', resolve: () => ({ headline: 'Spring water', good: true, text: 'A short detour down the spur to the spring.', why: ['+ left the tank for others'], effects: { flags: { tankLimit: 0 }, rep: 3, action: 'water' } }) },
      ] },
    { id: 'fog-razor', kind: 'Weather', title: 'Cloud on the Razorback', once: true, perHour: 1,
      when: c => c.exposed && c.fog && c.onTrail && c.y > 1600,
      text: 'Cloud pours over the ridge from the west. Visibility drops to a few dozen metres; the track is a pale line that comes and goes.',
      choices: [
        { label: 'Navigate carefully, checking at each junction', cost: 8, resolve: (c) => {
          const o = odds(0.55, [[c.fx.nav >= 2, 0.3, 'map and compass'], [c.fx.nav >= 3, 0.1, 'GPS'], [c.body.warmth < 40, -0.1, 'cold']]);
          return c.rand() < o.p ? { headline: 'Steady', good: true, text: 'Bearing by bearing you work along the ridge.', why: o.why, effects: {} } : { headline: 'Off-line', good: false, text: 'You drift onto a spur and have to climb back.', why: o.why, extraMin: 30, effects: { energy: -10 } };
        } },
        { label: 'Wait in the lee of the rocks', cost: 40, resolve: (c) => ({ headline: c.soon.clearing ? 'It lifts' : 'Still in it', good: !!c.soon.clearing, text: c.soon.clearing ? 'The cloud tears away and the ridge reappears.' : 'Cold and damp, you are still in cloud.', why: [c.soon.clearing ? '+ clearing' : '− settled cloud'], effects: { warmth: -8, restful: true } }) },
        { label: 'Turn back', resolve: () => ({ headline: 'Retreat', good: true, text: 'You head back the way you came.', effects: { action: 'retreat' } }) },
      ] },
  ],
};
