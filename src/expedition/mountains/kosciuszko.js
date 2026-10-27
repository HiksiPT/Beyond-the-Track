// Mount Kosciuszko — introductory expedition. Tracks, huts, lakes and peaks from OpenStreetMap; terrain from GA.
// `real` notes are general context; encounters and mentor lines are fiction for gameplay.
import { odds } from '../odds.js';

export default {
  id: 'kosciuszko', tz: 11, startDate: '2026-12-12',
  eco: { forestTop: 1500, treeline: 1850, snowLine: 2060, snowCover: 0.55, rockSlope: 0.72, moorland: 0, palette: 'nsw-alps' },
  clim: { tMean: 11, tAmp: 7, wind: 22, cloud: 0.35, frontEvery: 60, valleyY: 1400, tz: 11 },
  summitPlace: 'summit',
  camping: 'This is a day expedition. Seamans Hut is an emergency shelter only; camping near the glacial lakes is not allowed in this simulation.',
  trailheads: {
    eagles: { name: "Eagles Nest — top of the Thredbo chairlift", node: '179245641', exit: true },
    charlotte: { name: 'Charlotte Pass', node: '321926465', exit: true },
    charlotteRoad: { name: 'Charlotte Pass — Summit Walk', node: '179288585', exit: true },
  },
  places: {
    summit: { node: '30880145', name: 'Mount Kosciuszko summit', r: 40 },
    rawson: { poi: 'Rawson Pass', name: 'Rawson Pass', r: 60 },
    seamans: { poi: 'Seamans Hut', name: 'Seamans Hut', r: 50, hut: 'shelter', size: [5, 4], shelter: true },
    cootapatamba: { poi: 'Lake Cootapatamba Lookout', name: 'Lake Cootapatamba lookout', r: 60, view: true },
    kosLookout: { poi: 'Kosciusko Lookout', name: 'Kosciuszko Lookout', r: 60, view: true },
    bluelake: { poi: 'Blue Lake lookout', name: 'Blue Lake lookout', r: 70, view: true, water: 'lake' },
    carruthers: { poi: 'Carruthers Peak', name: 'Carruthers Peak', r: 80 },
    muellers: { poi: 'Muellers Pass', name: 'Muellers Pass', r: 60 },
    mainLookout: { poi: 'Main Range Lookout', name: 'Main Range Lookout', r: 70, view: true },
    etheridge: { poi: 'Etheridge Gap', name: 'Etheridge Gap', r: 60 },
    snowy: { latlon: [-36.43013, 148.32212], name: 'Snowy River crossing', r: 50, water: 'creek' },
  },
  farPeaks: [{ name: 'Mount Townsend', near: [-36.4229, 148.2586], search: 600 }, { name: 'Mount Jagungal', near: [-36.144, 148.39], search: 3000, note: 'far to the north' }],
  routes: [
    { id: 'walk', name: 'Kosciuszko Walk from Thredbo', difficulty: 'easy', start: 'th:eagles', via: ['kosLookout', 'cootapatamba', 'rawson', 'summit'], end: 'th:eagles', nights: 0,
      blurb: 'The forgiving route. From the top of the Thredbo chairlift a raised track crosses open alpine herbfields to Rawson Pass, then spirals up to the summit. Out and back.',
      gear: ['shell', 'fleece', 'map-compass'], teaches: 'Movement, camera, water, the map, junctions.', rewardMult: 0.9 },
    { id: 'road', name: 'Summit Walk from Charlotte Pass', difficulty: 'mod', start: 'th:charlotteRoad', via: ['seamans', 'rawson', 'summit'], end: 'th:charlotteRoad', nights: 0,
      blurb: 'The old summit road from Charlotte Pass: steady, wide and exposed, crossing the Snowy River headwaters country past Seamans Hut.',
      gear: ['shell', 'fleece'], teaches: 'Longer distance and exposure on open ground.' },
    { id: 'mainrange', name: 'Main Range loop', difficulty: 'hard', start: 'th:charlotte', via: ['snowy', 'bluelake', 'carruthers', 'muellers', 'summit', 'rawson', 'seamans'], end: 'th:charlotteRoad', nights: 0,
      blurb: 'The optional challenge: cross the Snowy River, climb past Blue Lake to Carruthers Peak, follow the crest of the Main Range over Muellers Pass to the summit, and return down the Summit Walk.',
      gear: ['shell', 'fleece', 'map-compass', 'boots-trail'], teaches: 'A big alpine day with real exposure.', navExtra: 1 },
  ],
  landmarks: [
    { id: 'eagles', at: 'th:eagles', title: 'Eagles Nest', real: 'The Kosciuszko Express chairlift lifts walkers from Thredbo village to nearly 1930 m, the start of the Kosciuszko Walk.' },
    { id: 'charlotte', at: 'th:charlotte', title: 'Charlotte Pass', real: 'Charlotte Pass sits at about 1840 m at the end of Kosciuszko Road; both the Main Range Track and the Summit Walk start here.' },
    { id: 'cootapatamba', at: 'cootapatamba', title: 'Lake Cootapatamba', real: 'Lake Cootapatamba is the highest of the Main Range glacial lakes, sitting in a cirque below the summit.' },
    { id: 'rawson', at: 'rawson', title: 'Rawson Pass', real: 'Rawson Pass is where the walking routes from Thredbo and Charlotte Pass meet below the summit.' },
    { id: 'summit', at: 'summit', title: 'Mount Kosciuszko', real: "At 2228 m, Kosciuszko is mainland Australia's highest point. The summit is broad and rounded, with views over the Main Range and the Snowy Mountains." },
    { id: 'bluelake', at: 'bluelake', title: 'Blue Lake', real: 'Blue Lake is one of five glacial lakes on the Main Range and among the deepest in mainland Australia.' },
    { id: 'carruthers', at: 'carruthers', title: 'Carruthers Peak', real: 'Carruthers Peak (2145 m) overlooks Club Lake and the steep western fall of the Main Range.' },
    { id: 'seamans', at: 'seamans', title: 'Seamans Hut', real: 'Seamans Hut is a stone emergency shelter built after two skiers died in a 1928 blizzard.' },
    { id: 'snowy', at: 'snowy', title: 'Snowy River', real: 'Near Charlotte Pass the Snowy River is a small alpine stream; the Main Range Track crosses it on stepping stones.' },
  ],
  objectives: [
    { id: 'photo-summit', title: 'Photograph the view from the summit', kind: 'photo', place: 'summit', minScore: 45 },
    { id: 'visit-cootapatamba', title: 'Visit the Lake Cootapatamba lookout', kind: 'visit', place: 'cootapatamba' },
    { id: 'visit-bluelake', title: 'See Blue Lake', kind: 'visit', place: 'bluelake' },
  ],
  tutorial: [
    { id: 'move', when: c => c.simMin > 0.2, text: 'W A S D to walk, drag with the mouse to look around. Or press F and I will keep you on the track — it stops at junctions.' },
    { id: 'map', when: c => c.distance > 300, text: 'Press M for the map. That line is the real track, on the real ground. Worth a look before every junction.' },
    { id: 'water', when: c => c.distance > 1200, text: 'Your water drains as you walk — the blue bar. It sips automatically. Up here you can refill at streams and lakes with E, but untreated water is a gamble.' },
    { id: 'energy', when: c => c.body.energy < 70, text: 'Energy is dropping. R opens rest: a short break with a snack goes a long way. Shift is for hurrying, and it costs.' },
    { id: 'photo', when: c => c.viewpoint, text: 'Good view. P for the camera. Put something interesting on a third of the frame and keep the horizon level — the scores reward it.' },
    { id: 'junction', when: c => c.junctions > 0, text: 'Junctions ask which way. Read the distances and climbs before you choose — they are measured off the real terrain.' },
  ],
  mentor: {
    briefing: [
      "Kosciuszko first. It's not hard, and that's the point — you learn the habits here where mistakes are cheap.",
      "It's big open country above the trees. Nowhere to hide from wind, so pack a shell even if the morning's perfect.",
      'Three ways up. The Thredbo walk is gentle. The Main Range loop is a proper day out — save it for when you know your legs.',
    ],
    summit: 'Highest point on the mainland. Take a photo, then think about getting down — the summit is only halfway.',
    radio: { first_junction: 'Lots of little side pads up here. Stick to the formed track; the herbfields are fragile.' },
  },
  encounters: [
    { id: 'kos-crowd', kind: 'Encounter', title: 'A group in jeans and sneakers', once: true, perHour: 0.6,
      when: c => c.moving && c.y > 2000 && c.onTrail,
      text: 'A cheerful group in jeans and sneakers asks if the summit is "just up there". Cloud is building in the west and one of them has no jacket.',
      choices: [
        { label: 'Lend advice and point out the weather', cost: 6, resolve: (c) => ({ headline: 'Good deed', good: true, text: 'They decide to turn back before the cloud arrives, and thank you for it.', why: ['+ sharing what you have learned'], effects: { rep: 3, xp: 15 } }) },
        { label: 'Give them your spare layer', cost: 4, need: 'insulation', resolve: (c) => ({ headline: 'Cold but kind', good: true, text: 'You hand over your fleece. You will feel it later if the wind picks up.', why: ['+ generosity', '− you are now carrying less warmth'], effects: { warmth: -10, rep: 6, xp: 20, flags: { gaveLayer: true } } }) },
        { label: 'Nod and keep walking', resolve: () => ({ headline: 'On your way', good: null, text: 'Not your problem — or is it?', effects: {} }) },
      ] },
    { id: 'kos-snowdrift', kind: 'Terrain', title: 'A late snowdrift across the track', once: true, perHour: 1.5,
      when: c => c.snow && c.onTrail && c.moving,
      text: 'A summer snowdrift lies across the track, firm and slick in the morning shade.',
      choices: [
        { label: 'Kick steps and cross carefully', cost: 6, resolve: (c) => {
          const o = odds(0.7, [[c.fx.spikes, 0.25, 'microspikes'], [c.fx.grip >= 0.85, 0.1, 'grippy boots'], [c.fx.grip < 0.75, -0.2, 'smooth soles'], [c.fx.poles, 0.08, 'poles']]);
          return c.rand() < o.p ? { headline: 'Across', good: true, text: 'Step by step, and you are over.', why: o.why, effects: {} } : { headline: 'Slip', good: false, text: 'Your feet shoot out and you slide a few metres, bruised and wet.', why: o.why, effects: { injury: 0.15, wet: 0.3 } };
        } },
        { label: 'Walk around on the rocks', cost: 12, resolve: () => ({ headline: 'The long way round', good: true, text: 'Slower, but your feet stay under you.', why: ['+ avoided the hazard'], effects: { energy: -4 } }) },
      ] },
  ],
};
