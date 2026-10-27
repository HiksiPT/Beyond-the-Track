// Generic decision encounters that can happen on any mountain. Mountain-specific encounters live in
// expedition/mountains/<id>.js. All of these are fictional game situations, not real-world guidance.
import { odds } from '../expedition/odds.js';

const pct = (p) => `${Math.round(p * 100)}%`;

export const GENERIC_ENCOUNTERS = [
  {
    id: 'weather-turn', kind: 'Weather', title: 'Cloud building over the range', cooldown: 6, perHour: 2.5,
    when: c => c.soon.worsening && (c.exposed || c.remaining.alpineAhead) && c.moving,
    text: c => `The western sky has gone the colour of slate. ${c.soon.text} Ahead, the route ${c.remaining.alpineAhead ? 'climbs onto open, exposed ground' : 'stays exposed'} for ${(c.remaining.km).toFixed(1)} km to ${c.remaining.name}.`,
    choices: [
      { label: 'Carry on as planned', sub: 'Keep momentum and hope it holds',
        resolve: (c) => {
          const o = odds(0.55, [[c.fx.windproof >= 0.6, 0.15, 'a proper shell against wind'], [c.body.warmth > 60, 0.1, 'still warm'], [c.fx.nav >= 2, 0.1, 'map and compass for low visibility'],
            [c.soon.severity > 0.7, -0.25, 'a strong front'], [c.body.energy < 35, -0.12, 'tired legs'], [c.remaining.km > 4, -0.1, 'a long way still exposed']]);
          if (c.rand() < o.p) return { headline: 'You beat the worst of it', good: true, text: 'The squall slides past to the north. You get a soaking edge of it and push on.', why: o.why, effects: { wet: 0.2, warmth: -5, xp: 10 } };
          return { headline: 'Caught in the open', good: false, text: 'Wind-driven rain hits side-on. Hands go numb, the track blurs, and every step costs more than it should.', why: o.why, extraMin: 20, effects: { wet: 0.6, warmth: -22, energy: -10 } };
        } },
      { label: 'Wait in shelter for it to pass', sub: 'Find the lee of rocks or trees', cost: 50,
        resolve: (c) => ({ headline: 'Sitting it out', good: c.soon.severity < 0.8, text: c.soon.severity < 0.8 ? 'Huddled behind a boulder, you watch the worst of it pour over the ridge. It clears enough to move.' : 'The front settles in. You have lost time and the weather is still poor.', why: [c.soon.severity < 0.8 ? '+ a short-lived squall' : '− a long front'], effects: { warmth: -6, restful: true, energy: 8 } }) },
      { label: 'Change plan: head for the nearest shelter', sub: 'Divert to a hut or campsite',
        resolve: () => ({ headline: 'Diverting', good: true, text: 'You turn towards shelter. The plan can wait.', why: ['+ flexible plan'], effects: { action: 'shelter' } }) },
      { label: 'Turn back now', sub: 'Retreat to the nearest trailhead',
        resolve: (c) => ({ headline: 'Retreat', good: true, text: 'It is not a summit day. You turn around with plenty left in reserve.', why: ['+ conservative decision in deteriorating weather'], effects: { action: 'retreat', flags: { badWeatherRetreat: true }, xp: 15 } }) },
    ],
  },
  {
    id: 'fatigue', kind: 'Body', title: 'Running on empty', cooldown: 3, perHour: 4,
    when: c => c.body.energy < 22 && c.moving,
    text: c => `Your legs feel like wet sand. Energy ${Math.round(c.body.energy)}, hunger ${Math.round(c.body.hunger)}. ${c.remaining.name} is still about ${(c.remaining.km).toFixed(1)} km away.`,
    choices: [
      { label: 'Keep going at the same pace', sub: 'Grit your teeth',
        resolve: (c) => {
          const o = odds(0.5, [[c.body.hunger < 50, 0.15, 'well fed'], [c.fx.poles, 0.1, 'trekking poles'], [c.zone.rock > 0.4 || !c.onTrail, -0.2, 'rough ground'], [c.body.hydration < 40, -0.1, 'dehydrated']]);
          if (c.rand() < o.p) return { headline: 'You dig deep', good: true, text: 'It is ugly, but you keep moving.', why: o.why, effects: { energy: -4 } };
          return { headline: 'A clumsy stumble', good: false, text: 'Tired feet catch a root and you go down hard on one knee.', why: o.why, effects: { injury: 0.25, energy: -6 } };
        } },
      { label: 'Slow down and eat on the move', sub: 'Relaxed pace from here',
        resolve: (c, g) => { g.exp.pace = 'relaxed'; const ate = g.eatBest(); return { headline: 'Easing off', good: true, text: ate ? `You eat ${ate} and settle into a slower rhythm.` : 'You slow down — but there is nothing left to eat.', why: [ate ? '+ food' : '− no food left'], effects: {} }; } },
      { label: 'Stop for a proper rest (30 min)', sub: 'Food, water, sit down', cost: 30,
        resolve: (c, g) => { const ate = g.eatBest(); return { headline: 'Recovered a little', good: true, text: 'Thirty minutes off your feet makes a difference.', why: ['+ rest', ate ? '+ food' : '− nothing to eat'], effects: { energy: 18, restful: true } }; } },
      { label: 'Turn back', sub: 'Save what you have left for getting down',
        resolve: () => ({ headline: 'Retreat', good: true, text: 'Knowing when you are spent is part of the craft.', why: ['+ honest self-assessment'], effects: { action: 'retreat' } }) },
    ],
  },
  {
    id: 'gear-damage', kind: 'Equipment', title: 'Something gives', cooldown: 8, perHour: 0.6,
    when: c => c.moving && (!c.onTrail || c.zone.rock > 0.4 || c.virtual) && c.exp.minCondition < 70,
    text: c => `${c.exp.weakestName} finally gives way — ${c.exp.weakestSlot === 'boots' ? 'the sole is peeling off at the toe' : c.exp.weakestSlot === 'pack' ? 'a hip-belt buckle snaps' : c.exp.weakestSlot === 'shell' ? 'a long tear opens along the sleeve' : 'a pole section cracks'}.`,
    choices: [
      { label: 'Repair it with the repair kit', sub: 'Tape, cord and patience', cost: 20, need: c => c.exp.supplies.repair > 0, needText: 'no repair kit uses left',
        resolve: (c, g) => { g.exp.supplies.repair--; g.repairWeakest(25); return { headline: 'Patched', good: true, text: 'Not pretty, but it will hold for now.', why: ['+ repair kit'], effects: {} }; } },
      { label: 'Bodge it with first-aid tape', sub: 'Uses a first-aid kit use', cost: 15, need: c => c.exp.supplies.firstaid > 0, needText: 'no first-aid uses left',
        resolve: (c, g) => { g.exp.supplies.firstaid--; g.repairWeakest(12); return { headline: 'Taped up', good: true, text: 'Strapping tape is the universal fix.', why: ['+ improvisation'], effects: {} }; } },
      { label: 'Carry on with the damage', sub: 'Accept the penalty',
        resolve: (c) => ({ headline: 'Making do', good: null, text: 'You carry on, slower and more careful.', why: ['− damaged equipment'], effects: { equip: { [c.exp.weakestSlot]: 15 } } }) },
      { label: 'Change plans and head out', sub: 'Retreat while it still works',
        resolve: () => ({ headline: 'Retreat', good: true, text: 'Better to walk out on failing gear than to be stuck with none.', why: ['+ conservative'], effects: { action: 'retreat' } }) },
    ],
  },
  {
    id: 'nav', kind: 'Navigation', title: "The junction doesn't match", cooldown: 3, perHour: 1.2,
    when: c => c.moving && c.onTrail && (c.fog || (c.fx.nav < 2 && c.zone.alpine > 0.5)) && c.remaining.junctionNear,
    text: c => `${c.fog ? 'In the cloud' : 'Here'} the pads split three ways and none of them looks like the one on your ${c.fx.nav >= 2 ? 'map' : 'phone'}. Visibility ${c.fog ? 'is a few dozen metres' : 'is fine, but the ground is confusing'}.`,
    choices: [
      { label: 'Stop and work it out with the map', sub: 'Take a bearing, check contours', cost: 10,
        resolve: (c) => {
          const o = odds(0.45, [[c.fx.nav >= 2, 0.25, 'map and compass'], [c.fx.nav >= 3, 0.15, 'GPS track'], [c.fog, -0.15, 'no landmarks visible'], [c.body.warmth < 40, -0.1, 'cold hands, foggy head']]);
          if (c.rand() < o.p) return { headline: 'Sorted', good: true, text: 'The spur bends exactly where the contours say it should. You are on the right line.', why: o.why, effects: { xp: 10 } };
          return { headline: 'Still unsure', good: false, text: 'You pick the most likely line, but spend a while backtracking before you are sure.', why: o.why, extraMin: 25, effects: { energy: -6 } };
        } },
      { label: 'Trust your instinct', sub: 'Pick the most worn pad',
        resolve: (c) => {
          const o = odds(0.55, [[!c.fog, 0.15, 'you can see the terrain'], [c.flags.knowsArea, 0.15, 'you have been here before'], [c.fog, -0.2, 'cloud hides the way']]);
          if (c.rand() < o.p) return { headline: 'Right first time', good: true, text: 'The pad firms up into the track. Lucky — or good.', why: o.why, effects: {} };
          return { headline: 'Wrong way', good: false, text: 'Half a kilometre later the pad fades into scrub. You have to climb back.', why: o.why, extraMin: 35, effects: { energy: -12, hydration: -4 } };
        } },
      { label: 'Wait for the cloud to lift', sub: 'Up to an hour', cost: 40,
        resolve: (c) => ({ headline: c.soon.clearing ? 'It clears' : 'Still murky', good: c.soon.clearing, text: c.soon.clearing ? 'The cloud tears open and the way is obvious.' : 'An hour later it is no better, and you are colder.', why: [c.soon.clearing ? '+ clearing weather' : '− cloud set in'], effects: { warmth: -8, restful: true } }) },
    ],
  },
  {
    id: 'water-low', kind: 'Supplies', title: 'Bottles nearly empty', cooldown: 4, perHour: 3,
    when: c => c.exp.supplies.water < 0.4 && c.remaining.hours > 1.2 && c.moving,
    text: c => `You have ${c.exp.supplies.water.toFixed(1)} L left and roughly ${c.remaining.hours.toFixed(1)} hours to ${c.remaining.name}. ${c.remaining.water ? `The nearest water you know of is ${c.remaining.water}.` : 'You know of no water on the way.'}`,
    choices: [
      { label: 'Ration it and push on', sub: 'Small sips only',
        resolve: (c) => ({ headline: 'Rationing', good: null, text: 'Dry mouth, slower recovery — but you keep moving.', why: ['− less water means slower recovery'], effects: { flags: { rationing: true } } }) },
      { label: 'Detour to water', sub: 'Costs distance, refills everything',
        resolve: () => ({ headline: 'Detour', good: true, text: 'You change course for the nearest water.', why: ['+ water'], effects: { action: 'water' } }) },
      { label: 'Turn back', sub: 'Head out while you still can', resolve: () => ({ headline: 'Retreat', good: true, text: 'Water decides this one.', why: ['+ sensible'], effects: { action: 'retreat' } }) },
    ],
  },
  {
    id: 'food-low', kind: 'Supplies', title: 'The food bag is empty', cooldown: 6, perHour: 3,
    when: c => c.exp.foodKcal < 300 && c.remaining.hours > 2.5,
    text: c => `Nothing left but crumbs, and roughly ${c.remaining.hours.toFixed(1)} hours to ${c.remaining.name}. Hunger ${Math.round(c.body.hunger)}.`,
    choices: [
      { label: 'Carry on hungry', sub: 'Energy will fade faster', resolve: () => ({ headline: 'Hungry miles', good: null, text: 'You tighten the hip belt and keep walking.', why: ['− no food'], effects: {} }) },
      { label: 'Turn back to the nearest exit', resolve: () => ({ headline: 'Retreat', good: true, text: 'An empty food bag is a clear signal.', why: ['+ sensible'], effects: { action: 'retreat' } }) },
    ],
  },
  {
    id: 'photo-op', kind: 'Opportunity', title: 'The light is going gold', cooldown: 10, perHour: 1.5, fiction: false,
    when: c => c.env.sun.alt > -0.05 && c.env.sun.alt < 0.15 && !c.fog && (c.zone.alpine > 0.4 || c.zone.rock > 0.4) && c.exp.fx.camera,
    text: 'Low sun is raking across the ridges, every gully filled with shadow. A minute or two could get something special — and the light will not wait.',
    choices: [
      { label: 'Stop and take photographs', sub: 'Opens the camera', resolve: () => ({ effects: { action: 'photo' } }) },
      { label: 'Keep moving', sub: 'Daylight matters more', resolve: () => ({ headline: 'On you go', good: null, text: 'You glance back once and keep walking.', effects: {} }) },
    ],
  },
  {
    id: 'late', kind: 'Decision', title: 'Daylight is running out', cooldown: 20, perHour: 6,
    when: c => c.sunsetIn < 1.5 && c.sunsetIn > 0 && c.remaining.hours > c.sunsetIn + 0.5 && !c.exp.camp && c.moving,
    text: c => `Sunset is in about ${Math.max(0.1, c.sunsetIn).toFixed(1)} h, and ${c.remaining.name} is roughly ${c.remaining.hours.toFixed(1)} h away at this pace. ${c.fx.torch ? 'You have a head torch.' : 'You did not pack a head torch.'}`,
    choices: [
      { label: 'Push on into the dark', sub: 'Slower, riskier walking',
        resolve: (c) => {
          const o = odds(0.6, [[c.fx.torch && c.exp.supplies.torch > 1, 0.25, 'a charged head torch'], [c.onTrail, 0.1, 'a formed track'], [!c.fx.torch, -0.4, 'no torch'], [c.zone.rock > 0.4, -0.15, 'rocky ground']]);
          return c.rand() < o.p ? { headline: 'Night walking', good: true, text: 'A small circle of light, the crunch of the track, stars overhead.', why: o.why, effects: {} } : { headline: 'Benighted', good: false, text: 'You miss a step in the dark and turn an ankle.', why: o.why, effects: { injury: 0.3 } };
        } },
      { label: 'Find somewhere to camp or bivouac', sub: 'Opens the rest menu', resolve: () => ({ effects: { action: 'camp' } }) },
      { label: 'Turn back towards the nearest exit', resolve: () => ({ headline: 'Retreat', good: true, text: 'You head down while there is light.', effects: { action: 'retreat' } }) },
    ],
  },
  {
    id: 'ankle', kind: 'Terrain', title: 'Loose rock underfoot', cooldown: 5, perHour: 0.5,
    when: c => c.moving && c.zone.rock > 0.35 && (c.weather.precip > 0.05 || c.body.energy < 40 || c.fx.grip < 0.8),
    text: 'A rock rolls under your boot on a steep, broken section.',
    view: false,
    choices: [
      { label: 'React!', sub: '',
        resolve: (c) => {
          const o = odds(0.65, [[c.fx.grip >= 0.85, 0.15, 'grippy boots'], [c.fx.poles, 0.12, 'poles for balance'], [c.weather.precip > 0.05, -0.15, 'wet rock'], [c.body.energy < 30, -0.15, 'fatigue']]);
          return c.rand() < o.p ? { headline: 'Caught it', good: true, text: 'You catch your balance and the rock clatters away below.', why: o.why, effects: {} } : { headline: 'Twisted ankle', good: false, text: 'Your ankle rolls. Painful, but you can walk — slowly.', why: o.why, effects: { injury: 0.3 } };
        } },
    ],
  },
  {
    id: 'blister', kind: 'Body', title: 'Hot spot on your heel', cooldown: 6, perHour: 0.8,
    when: c => c.body.blister > 0.35 && c.moving,
    text: 'Something has been rubbing for an hour and now it is a blister.',
    choices: [
      { label: 'Stop and tape it', sub: 'Uses a first-aid use', cost: 10, need: c => c.exp.supplies.firstaid > 0, needText: 'no first-aid uses left',
        resolve: (c, g) => { g.exp.supplies.firstaid--; g.exp.body.blister = 0.05; return { headline: 'Taped', good: true, text: 'Much better.', why: ['+ first aid'], effects: {} }; } },
      { label: 'Ignore it', resolve: (c, g) => { g.exp.body.blister = 0.2; return { headline: 'Limping a little', good: false, text: 'It gets worse.', why: ['− untreated blister'], effects: { injury: 0.1 } }; } },
    ],
  },
  {
    id: 'collapse', kind: 'Critical', title: 'You cannot go on', once: false, cooldown: 1, perHour: 99, fiction: false,
    when: c => (c.body.warmth < 6 || (c.body.energy < 3 && c.body.hydration < 10) || c.body.injury > 0.95),
    text: c => c.body.warmth < 6 ? 'Uncontrollable shivering, stumbling, words slurring. This is hypothermia in the simulation.' : c.body.injury > 0.95 ? 'You cannot put weight on your leg at all.' : 'Exhausted and badly dehydrated, you sit down and cannot get up.',
    choices: [
      { label: 'Call for assistance', sub: 'Ends the expedition; costs money and reputation', resolve: () => ({ effects: { action: 'collapse' } }) },
      { label: 'Emergency bivouac and hope', sub: 'Risky — only with shelter gear', need: c => c.fx.bivvy || c.fx.tent, needText: 'needs a tent or emergency bivvy',
        resolve: (c) => ({ headline: 'A long night', good: true, text: 'Wrapped in everything you have, you wait it out.', why: ['+ shelter gear'], effects: { action: 'camp', warmth: 15 } }) },
    ],
  },
];
