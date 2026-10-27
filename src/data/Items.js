// Equipment and supplies. Durable items are bought once at the hub and wear over expeditions;
// consumables (food, fuel, first-aid refills) are bought per expedition on the packing screen.
// fx keys are read by SurvivalSystem / PlayerController / DecisionEngine / PhotographySystem.

export const CATEGORIES = [
  ['backpack', 'Backpack'], ['clothing', 'Clothing & insulation'], ['waterproof', 'Waterproof layer'], ['footwear', 'Footwear'],
  ['food', 'Food'], ['water', 'Water capacity'], ['navigation', 'Navigation'], ['shelter', 'Shelter & sleep'],
  ['firstaid', 'First aid'], ['photography', 'Photography'], ['tools', 'Tools'],
];

export const ITEMS = {
  // ---- backpacks: one carried; sets the weight limit ----
  'pack-day': { cat: 'backpack', name: 'Daypack 28 L', price: 0, kg: 0.8, desc: 'Comfortable for day walks.', effect: 'Carry limit 11 kg.', fx: { capacityKg: 11, comfort: 1 }, slot: 'pack', starter: true },
  'pack-50': { cat: 'backpack', name: 'Overnight pack 50 L', price: 260, kg: 1.6, desc: 'Padded hip belt and frame sheet.', effect: 'Carry limit 17 kg; carrying feels lighter.', fx: { capacityKg: 17, comfort: 1.06 }, slot: 'pack' },
  'pack-70': { cat: 'backpack', name: 'Expedition pack 70 L', price: 520, kg: 2.2, desc: 'Load-lifters, alloy stays, waterproof liner.', effect: 'Carry limit 24 kg; best load carriage.', fx: { capacityKg: 24, comfort: 1.12, keepsDry: true }, slot: 'pack', rank: 2 },

  // ---- clothing ----
  'fleece': { cat: 'clothing', name: 'Fleece + thermals', price: 0, kg: 0.7, desc: 'Basic warm layers.', effect: '+6 °C felt warmth.', fx: { insulation: 6 }, slot: 'insulation', starter: true },
  'puffy': { cat: 'clothing', name: 'Synthetic insulated jacket', price: 190, kg: 0.55, desc: 'Warm even when damp.', effect: '+10 °C felt warmth at rest, +5 walking.', fx: { insulation: 10, insulationMove: 5, wetOk: true }, slot: 'insulation' },
  'down': { cat: 'clothing', name: 'Down expedition jacket', price: 420, kg: 0.6, desc: 'Very warm for its weight; poor when soaked.', effect: '+14 °C at rest, +5 walking; loses warmth if wet.', fx: { insulation: 14, insulationMove: 5 }, slot: 'insulation', rank: 2 },

  // ---- waterproof ----
  'poncho': { cat: 'waterproof', name: 'Plastic poncho', price: 0, kg: 0.3, desc: 'Better than nothing.', effect: 'Halves how fast rain soaks you; tears in wind.', fx: { waterproof: 0.5, windproof: 0.2 }, slot: 'shell', starter: true },
  'shell': { cat: 'waterproof', name: 'Waterproof shell jacket', price: 220, kg: 0.45, desc: 'Taped seams, adjustable hood.', effect: 'Keeps rain out; cuts wind chill by 60%.', fx: { waterproof: 0.9, windproof: 0.6 }, slot: 'shell' },
  'shell-pro': { cat: 'waterproof', name: 'Alpine hardshell + overpants', price: 480, kg: 0.85, desc: 'Built for Tasmanian weather.', effect: 'Near-total rain and wind protection; tougher fabric.', fx: { waterproof: 0.98, windproof: 0.85, tough: 1.6 }, slot: 'shell', rank: 3 },

  // ---- footwear ----
  'runners': { cat: 'footwear', name: 'Running shoes', price: 0, kg: 0.6, desc: 'Light, little grip or support.', effect: 'Fast on good track; slow, slippery and sore on rough ground.', fx: { rough: 0.75, grip: 0.7, wearRate: 1.6 }, slot: 'boots', starter: true },
  'boots-trail': { cat: 'footwear', name: 'Lightweight hiking boots', price: 180, kg: 1.0, desc: 'Ankle support and a lugged sole.', effect: 'Better on rock and mud.', fx: { rough: 0.9, grip: 0.85, wearRate: 1 }, slot: 'boots' },
  'boots-alpine': { cat: 'footwear', name: 'Leather mountain boots', price: 360, kg: 1.5, desc: 'Stiff, waterproof, long-lasting.', effect: 'Best on scree, scrambles and snow; wears slowly.', fx: { rough: 1.0, grip: 0.95, wearRate: 0.6, waterproofFeet: true }, slot: 'boots', rank: 2 },
  'gaiters': { cat: 'footwear', name: 'Gaiters', price: 45, kg: 0.25, desc: 'Keep mud, snow and scrub out.', effect: 'Less wear and wet feet off-track.', fx: { scrub: 0.6 } },

  // ---- water capacity (count) ----
  'bottle': { cat: 'water', name: '1 L bottle', price: 0, kg: 0.12, desc: 'Hard bottle.', effect: '+1 L capacity each.', fx: { waterL: 1 }, stack: 4, starter: 2 },
  'bladder': { cat: 'water', name: '3 L hydration bladder', price: 55, kg: 0.2, desc: 'Sip without stopping.', effect: '+3 L capacity; drinking costs no time.', fx: { waterL: 3, sipFree: true }, stack: 1 },
  'filter': { cat: 'water', name: 'Squeeze filter', price: 70, kg: 0.1, desc: 'Treat creek and lake water.', effect: 'Safe water from streams.', fx: { filter: true } },

  // ---- navigation ----
  'phone-map': { cat: 'navigation', name: 'Phone map app', price: 0, kg: 0, desc: 'Works until the battery dies or the screen fogs.', effect: 'Basic navigation; unreliable in cold and wet.', fx: { nav: 1 }, starter: true },
  'map-compass': { cat: 'navigation', name: 'Topographic map + compass', price: 40, kg: 0.2, desc: 'Never runs flat.', effect: 'Resolves junction and fog uncertainty more often.', fx: { nav: 2 } },
  'gps': { cat: 'navigation', name: 'Handheld GPS + spare batteries', price: 290, kg: 0.25, desc: 'Track log and waypoints.', effect: 'Best navigation; much less time lost in fog.', fx: { nav: 3 }, rank: 2 },
  'plb': { cat: 'navigation', name: 'Personal locator beacon', price: 330, kg: 0.15, desc: 'Emergency rescue beacon.', effect: 'Assistance costs far less if things go wrong.', fx: { beacon: true } },

  // ---- shelter ----
  'tent-1': { cat: 'shelter', name: 'Ultralight 1-person tent', price: 260, kg: 1.2, desc: 'Fine in sheltered spots.', effect: 'Camp anywhere camping is allowed; flattens in big wind.', fx: { tent: 1 }, slot: 'tent' },
  'tent-4s': { cat: 'shelter', name: '4-season tent', price: 560, kg: 2.4, desc: 'Geodesic poles, snow flaps.', effect: 'Stays up in storms; warmer nights.', fx: { tent: 2, tentWarm: 3 }, slot: 'tent', rank: 2 },
  'bag-summer': { cat: 'shelter', name: 'Summer sleeping bag (+5 °C)', price: 90, kg: 0.8, desc: 'Light, cold above the treeline.', effect: '+9 °C warmth while sleeping.', fx: { sleepWarm: 9 }, slot: 'bag' },
  'bag-alpine': { cat: 'shelter', name: 'Alpine sleeping bag (−7 °C)', price: 340, kg: 1.3, desc: 'Down fill, hood.', effect: '+17 °C warmth while sleeping.', fx: { sleepWarm: 17 }, slot: 'bag' },
  'mat': { cat: 'shelter', name: 'Insulated sleeping mat', price: 120, kg: 0.5, desc: 'Stops the ground stealing heat.', effect: '+5 °C warmth asleep; better recovery.', fx: { sleepWarm: 5, sleepRecover: 1.15 } },
  'stove': { cat: 'shelter', name: 'Canister stove + pot', price: 95, kg: 0.45, desc: 'Hot meals, hot drinks, snowmelt.', effect: 'Enables hot meals (warmth + energy) and melting snow.', fx: { stove: true } },

  // ---- first aid ----
  'firstaid': { cat: 'firstaid', name: 'First-aid kit', price: 35, kg: 0.35, desc: 'Tape, dressings, painkillers.', effect: 'Treat blisters and sprains (3 uses, refill at hub).', fx: { firstaid: 3 } },
  'emergency-bivvy': { cat: 'firstaid', name: 'Emergency bivvy bag', price: 30, kg: 0.15, desc: 'Foil-lined bag.', effect: 'Makes an emergency night survivable.', fx: { bivvy: true } },

  // ---- photography ----
  'phone-cam': { cat: 'photography', name: 'Phone camera', price: 0, kg: 0, desc: 'Always with you.', effect: 'Photo quality ×0.8.', fx: { camera: 0.8, zoom: 2 }, slot: 'camera', starter: true },
  'compact': { cat: 'photography', name: 'Rugged compact camera', price: 240, kg: 0.3, desc: 'Weather-sealed, 5× zoom.', effect: 'Photo quality ×1.0, zoom 5×.', fx: { camera: 1.0, zoom: 5 }, slot: 'camera' },
  'mirrorless': { cat: 'photography', name: 'Mirrorless kit + zoom lens', price: 980, kg: 1.1, desc: 'The real thing.', effect: 'Photo quality ×1.2, zoom 8×.', fx: { camera: 1.2, zoom: 8 }, slot: 'camera', rank: 2 },
  'tripod': { cat: 'photography', name: 'Travel tripod', price: 140, kg: 0.9, desc: 'Sharp shots at dawn, dusk and night.', effect: 'Removes the low-light penalty.', fx: { tripod: true } },

  // ---- tools ----
  'headtorch': { cat: 'tools', name: 'Head torch', price: 30, kg: 0.1, desc: '300 lumens, 12 h battery.', effect: 'Walk after dark at reduced pace.', fx: { torch: 12 } },
  'poles': { cat: 'tools', name: 'Trekking poles', price: 90, kg: 0.5, desc: 'Save your knees.', effect: 'Faster, steadier descents; less fatigue on steep ground.', fx: { poles: true } },
  'spikes': { cat: 'tools', name: 'Microspikes', price: 75, kg: 0.4, desc: 'Grip on firm snow and ice.', effect: 'Safe, quicker travel on snow patches.', fx: { spikes: true } },
  'axe': { cat: 'tools', name: 'Ice axe', price: 160, kg: 0.5, desc: 'For steep winter snow.', effect: 'Self-arrest and probing on corniced ridges (winter).', fx: { axe: true }, rank: 2 },
  'helmet': { cat: 'tools', name: 'Climbing helmet', price: 110, kg: 0.35, desc: 'Rockfall and scramble protection.', effect: 'Reduces injury in scrambles and rockfall.', fx: { helmet: true } },
  'rope': { cat: 'tools', name: '30 m hand line', price: 150, kg: 1.6, desc: 'For pack-hauling on exposed scrambles.', effect: 'Safer on the hardest scrambles (Federation Peak, Western Arthurs).', fx: { rope: true }, rank: 3 },
  'spare-laces': { cat: 'tools', name: 'Repair kit', price: 25, kg: 0.15, desc: 'Laces, tape, needle, seam grip.', effect: 'Patch damaged gear on the mountain (2 uses).', fx: { repair: 2 } },
};

// consumables bought per expedition (quantity chosen on the packing screen)
export const SUPPLIES = {
  'trail-mix': { cat: 'food', name: 'Trail mix (500 g)', price: 9, kg: 0.5, kcal: 2400, desc: 'Dense energy, no cooking.', effect: '2400 kcal; eat on the move.' },
  'bars': { cat: 'food', name: 'Energy bars ×6', price: 14, kg: 0.36, kcal: 1500, desc: 'Fast sugar.', effect: '1500 kcal; quick energy boost.', quick: true },
  'meal': { cat: 'food', name: 'Freeze-dried dinner', price: 13, kg: 0.15, kcal: 650, desc: 'Needs the stove and water.', effect: '650 kcal hot meal (+warmth, +morale). Needs stove.', hot: true },
  'lunch': { cat: 'food', name: 'Wraps, cheese & salami', price: 11, kg: 0.6, kcal: 1700, desc: 'Real food.', effect: '1700 kcal; satisfies hunger best.' },
  'fuel': { cat: 'shelter', name: 'Gas canister (230 g)', price: 9, kg: 0.37, desc: 'About 9 hot meals.', effect: 'Fuel for the stove (~25 g per meal).', fuelG: 230 },
};

export function itemName(id) { return ITEMS[id]?.name || SUPPLIES[id]?.name || id; }
