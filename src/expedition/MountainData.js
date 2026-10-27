// Campaign registry: real-world facts and campaign rules per mountain. Detailed routes, places and
// encounters live in ./mountains/<id>.js and are loaded on demand with the terrain.

export const CAMPAIGN = [
  {
    id: 'kosciuszko', order: 1, name: 'Mount Kosciuszko', elevation: 2228, state: 'NSW', region: 'Kosciuszko National Park, Main Range',
    role: 'Introductory expedition', tagline: 'The roof of the continent, broad and open.',
    environment: 'Open alpine grassland and heath above the treeline, rounded granite tops, glacial lakes and long views across the Main Range. Weather can change quickly over the exposed plateau.',
    hazards: ['Exposure to wind on open tops', 'Fast-changing cloud', 'Sunburn and dehydration'],
    duration: '30â€“60 min', difficulty: 1, prep: 'Day pack, water, warm and waterproof layers.',
    rewards: { xp: 180, money: 220 }, palette: 'nsw-alps',
    unlock: { always: true },
  },
  {
    id: 'feathertop', order: 2, name: 'Mount Feathertop', elevation: 1922, state: 'VIC', region: 'Alpine National Park, Victoria',
    role: 'First serious alpine challenge', tagline: 'A long climb to an exposed summit, with the Razorback for a spine.',
    environment: 'Tall forest in the Ovens valley, snow gum woodland, then an exposed alpine ridge system â€” the Razorback â€” to a narrow summit with steep eastern falls.',
    hazards: ['Sustained climbing', 'Exposure on the Razorback', 'Snow and cornices in winter scenarios', 'Poor visibility'],
    duration: '45â€“90 min', difficulty: 2, prep: 'Overnight gear if camping, plenty of water for the dry spur.',
    rewards: { xp: 320, money: 380 }, palette: 'vic-alps', winter: true,
    unlock: { prev: 'kosciuszko', xp: 150, milestone: { label: 'Own a waterproof shell', test: p => p.owned['shell'] || p.owned['shell-pro'] } },
  },
  {
    id: 'bogong', order: 3, name: 'Mount Bogong', elevation: 1986, state: 'VIC', region: 'Alpine National Park, Victoria',
    role: 'Endurance and navigation', tagline: "Victoria's highest â€” big, steep and long.",
    environment: 'A massive steep-sided mountain: forested spurs climb more than 1300 m from the Kiewa valley to broad, open upper slopes and an exposed summit plateau.',
    hazards: ['Very long climbs', 'Navigation on the open plateau in cloud', 'Accumulating fatigue'],
    duration: '60â€“120 min', difficulty: 3, prep: 'Overnight pack, map and compass, good boots.',
    rewards: { xp: 480, money: 520 },
    unlock: { prev: 'feathertop', xp: 420, milestone: { label: 'Own a map and compass (or GPS)', test: p => p.owned['map-compass'] || p.owned['gps'] } },
  },
  {
    id: 'cradle', order: 4, name: 'Cradle Mountain', elevation: 1545, state: 'TAS', region: 'Cradle Mountainâ€“Lake St Clair National Park',
    role: 'Technical terrain and changing conditions', tagline: 'Dolerite columns above Dove Lake.',
    environment: 'Rugged dolerite towers and boulder fields above glacial lakes, button-grass and alpine heath, frequent mist and wet rock.',
    hazards: ['Boulder scrambling', 'Wet, slippery rock', 'Sudden mist'],
    duration: '60â€“120 min', difficulty: 4, prep: 'Grippy boots, waterproofs, helmet recommended.',
    rewards: { xp: 560, money: 600 }, palette: 'tas-dolerite',
    unlock: { prev: 'bogong', xp: 900, milestone: { label: 'Own hiking or mountain boots', test: p => p.owned['boots-trail'] || p.owned['boots-alpine'] } },
  },
  {
    id: 'ossa', order: 5, name: 'Mount Ossa', elevation: 1617, state: 'TAS', region: 'Central Highlands, Tasmania',
    role: 'Sustained expedition planning', tagline: "Tasmania's highest, deep in the Overland country.",
    environment: 'Rainforest and myrtle beech approaches, button-grass plains around Pelion, and a rugged dolerite summit block above Pelion Gap.',
    hazards: ['Multi-day supplies', 'Mud and roots', 'Exposed final scramble', 'Rapid weather changes'],
    duration: '75â€“150 min', difficulty: 5, prep: 'Multi-day food, stove, tent, waterproofs.',
    rewards: { xp: 700, money: 760 }, palette: 'tas-highlands',
    unlock: { prev: 'cradle', xp: 1350, milestone: { label: 'Own a tent and a stove', test: p => (p.owned['tent-1'] || p.owned['tent-4s']) && p.owned['stove'] } },
  },
  {
    id: 'frenchmans', order: 6, name: 'Frenchmans Cap', elevation: 1446, state: 'TAS', region: 'Franklinâ€“Gordon Wild Rivers National Park',
    role: 'Remote wilderness expedition', tagline: 'A pale quartzite dome above the rainforest.',
    environment: 'Rainforest and button-grass approach across the Franklin River, then lakes beneath the gleaming white quartzite dome and its sheer south-east face.',
    hazards: ['Long remote approach', 'River and mud', 'Heavy rain', 'Steep quartzite scramble'],
    duration: '90â€“180 min', difficulty: 6, prep: 'Full expedition kit, excellent waterproofs.',
    rewards: { xp: 900, money: 980 }, palette: 'tas-quartzite',
    unlock: { prev: 'ossa', xp: 2050, milestone: { label: 'Own an expedition-capable pack (50 L+)', test: p => p.owned['pack-50'] || p.owned['pack-70'] } },
  },
  {
    id: 'federation', order: 7, name: 'Federation Peak', elevation: 1224, state: 'TAS', region: 'Southwest National Park, Eastern Arthur Range',
    role: 'Major campaign milestone', tagline: 'The most dramatic summit in Australia.',
    environment: 'An isolated jagged spire above deep forested valleys and Hanging Lake; steep scrub, mud, exposed ridges and an airy final climb.',
    hazards: ['Severe scrub and mud', 'Exposed scrambling', 'Remote â€” rescue is slow', 'Serious weather'],
    duration: '120â€“240 min', difficulty: 7, prep: 'Everything, plus helmet and a hand line.',
    rewards: { xp: 1300, money: 1400 }, palette: 'tas-southwest',
    unlock: { prev: 'frenchmans', xp: 2900, milestone: { label: 'Own a helmet', test: p => p.owned['helmet'] } },
  },
  {
    id: 'arthurs', order: 8, name: 'Western Arthurs Traverse', elevation: 1181, state: 'TAS', region: 'Southwest National Park, Western Arthur Range',
    role: 'Final campaign expedition â€” multi-stage traverse', tagline: 'A chain of jagged peaks and glacial lakes.',
    environment: 'A long range of quartzite peaks and knife-edge ridges strung with glacial lakes; camps at the lakes, steep descents into gullies and climbs back to the crest.',
    hazards: ['Cumulative fatigue over days', 'Limited supplies for the whole journey', 'Exposed scrambles', 'Storms off the Southern Ocean'],
    duration: 'Several hours over multiple saved stages', difficulty: 8, prep: 'Full expedition kit for several days.',
    rewards: { xp: 2000, money: 2200 }, palette: 'tas-southwest', multiStage: true,
    unlock: { prev: 'federation', xp: 4000, milestone: { label: 'Reach Expedition Leader rank', test: (p, rank) => rank >= 4 } },
  },
];

export const byId = Object.fromEntries(CAMPAIGN.map(m => [m.id, m]));

const loaders = {
  kosciuszko: () => import('./mountains/kosciuszko.js'),
  feathertop: () => import('./mountains/feathertop.js'),
  bogong: () => import('./mountains/bogong.js'),
  cradle: () => import('./mountains/cradle.js'),
  ossa: () => import('./mountains/ossa.js'),
  frenchmans: () => import('./mountains/frenchmans.js'),
  federation: () => import('./mountains/federation.js'),
  arthurs: () => import('./mountains/arthurs.js'),
};
export async function loadContent(id) { return (await loaders[id]()).default; }
