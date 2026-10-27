# Beyond the Track: Australian Expeditions

A browser-based 3D mountaineering adventure on **real Australian terrain**. Every mountain is reconstructed from Geoscience Australia elevation data, with tracks, huts, campsites and lakes taken from OpenStreetMap. You plan the route, pack the bag, read the weather, then walk every metre. The campaign runs from an introductory day on Kosciuszko to a multi-stage traverse of Tasmania's Western Arthurs.

> This is a simulation. Routes, hazards, weather and events are game mechanics, **not real-world route or safety advice**.

## Quick start

Requirements: Node.js 18 or newer (20 recommended) and a browser with WebGL 2.

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173. To make and check a production build:

```bash
npm run build
```

```bash
npm run preview
```

The production build is written to `dist/` and contains the game plus about 19 MB of packaged terrain data.

## Deploying to GitHub Pages

The project is ready for GitHub Pages:

- `vite.config.js` uses a **relative base** (`./`), so the built site works at any sub-path, such as `https://<user>.github.io/<repo>/`. Terrain data is fetched relative to `import.meta.env.BASE_URL`.
- `.github/workflows/deploy.yml` builds and publishes on every push to `main`.

Steps:

1. Create a GitHub repository and push this folder to its `main` branch.
2. In the repository, go to **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push (or run the "Deploy to GitHub Pages" workflow manually). The site appears at `https://<user>.github.io/<repo>/`.

Nothing needs a server, account, API key or paid service at runtime; all data is static.

## How to play

| Input | Action |
|---|---|
| **WASD** / arrows | walk (third person); off-track is slower and harder |
| Mouse drag / wheel | look / zoom (sensitivity and invert-Y in Settings) |
| **Shift** | hurry: faster, but costs energy |
| **F** | follow the planned route along the real tracks; it stops at junctions that matter |
| **E** | interact: refill water, read landmarks, finish at a trailhead |
| **R** | rest: short break, long rest, hot meal, camp, emergency bivouac |
| **I** | pack: eat, drink, check gear, repair, first aid |
| **M** | topographic map: detour or change the plan |
| **P** | camera: aim, zoom, click or Space to shoot |
| **J** | notes: objectives, landmarks, decisions, time breakdown |
| **V / L / H / Esc** | pace / world labels / controls help / pause |
| Touch | left stick to move, drag right side to look, on-screen buttons |
| **1–9** | pick a choice in any decision |

**Loop:** base camp → mentor Peg Arden → expedition briefing (real topo map, route comparison, forecast) → packing (weight limit, budget) → the climb → decisions and events → summit, retreat or rescue → debrief → publish photos on Ridgeline → shop, repairs, sponsors → next mountain.

## The campaign

| # | Expedition | Routes in the game (real tracks from OSM) |
|---|---|---|
| 1 | Mount Kosciuszko (NSW) | Kosciuszko Walk from Thredbo · Summit Walk from Charlotte Pass · Main Range loop |
| 2 | Mount Feathertop (VIC) | Bungalow Spur · Razorback traverse · Northwest Spur · **winter scenario with the corniced-ridge encounter** |
| 3 | Mount Bogong (VIC) | The Staircase · Staircase–Eskdale loop |
| 4 | Cradle Mountain (TAS) | Dove Lake – Marions Lookout – summit – Face Track · Overland Track start to Waterfall Valley |
| 5 | Mount Ossa (TAS) | Arm River – New Pelion – Ossa · Ossa + Pelion East with Kia Ora |
| 6 | Frenchmans Cap (TAS) | three-camp plan or fast two-camp plan on the single Frenchmans Cap track |
| 7 | Federation Peak (TAS) | Moss Ridge out-and-back · Eastern Arthurs traverse from Pass Creek |
| 8 | Western Arthurs (TAS) | full six-stage traverse · partial traverse to Lake Oberon |

Mountains unlock through completion of the previous one, XP and a preparation milestone (for example, owning a waterproof shell before Feathertop). Finishing the Western Arthurs full traverse unlocks Elite Mountaineer and free exploration.

Route length, climb, Tobler walking time, terrain difficulty, navigation complexity, exposure, water and food estimates are all **computed from the real terrain under the real tracks**, not assigned by hand.

## Time and pacing

- The simulation clock separates moving, resting, sleeping, decisions, map study and photography, and reports total expedition time, distance and ascent.
- Walking time follows Tobler's hiking function on the real slope, adjusted for pack weight, energy, hunger, hydration, warmth, injury, darkness, cloud, snow, wind, footwear and trekking poles.
- **Expedition length** (Settings) sets how many simulated minutes pass per real minute while walking: Short 14, Standard 8 (default), Long 5. The simulated time itself always reflects the terrain. Approximate play times at Standard: Kosciuszko 25–45 min, Feathertop 45–80 min, and multi-hour, multi-session play for the Tasmanian expeditions.
- Decisions and photography run the clock in real time. Breaks and camp fast-forward. Standing still counts as rest.

## Survival, economy, photography

- **Five indicators:** energy, hydration, hunger, warmth and equipment condition. Each changes pace and risk, warns before it becomes critical, and can end an expedition with an assisted rescue (which costs money and reputation).
- **Items:** every item has a price, weight, description, category and a concrete effect: carry limit, insulation, waterproofing, grip, navigation, sleep warmth, stove, camera quality and so on. Durable gear wears and can be repaired at the hub. Food and fuel are bought per trip.
- **Decisions:** encounters show a rendered view ahead, your resources and two to four choices. Outcomes depend on your state, gear, weather, visibility and earlier choices, and the result lists the factors.
- **Photography:** the actual 3D view is captured and scored for scenic quality (depth, skyline relief, landmarks, water, light, weather), composition (rule of thirds, horizon, framing) and rarity. Camera quality scales the score.
- **Ridgeline** is a fictional in-game platform: caption and publish photos for followers, money and reputation. Similar posts get diminishing returns. Followers and reputation bring sponsors (discounts, gifts, expedition funding, jacket colours). Nothing is posted anywhere real.
- **XP and ranks:** Beginner → Trail Explorer → Alpine Adventurer → Mountain Specialist → Expedition Leader → Elite Mountaineer, plus achievements and expedition history.

## Saving

- Everything is stored in your browser's **localStorage**: the career, any expedition in progress (position, route, checkpoints, supplies, gear condition, body state, decisions, weather seed) and settings. Photo images go in IndexedDB.
- There's an autosave at checkpoints and every minute during play, and when the tab is hidden or closed. There are also three manual slots and **export/import** of a career file.
- Saves are versioned with migration. A corrupted main save falls back to a rolling backup, and the damaged copy is kept.

## Real terrain: data and limitations

- **Elevation:** Geoscience Australia *National Digital Elevation Model 1 Second* (DEM-S, derived from SRTM), fetched from GA's WCS service. Each mountain gets a native-resolution walkable area (about 25–31 m cells over 17–30 km) plus a wider, coarser horizon grid. ELVIS higher-resolution LiDAR was checked: GA's national 5 m LiDAR covers none of the eight campaign areas (Mt Barney is the only covered peak that was checked). State LiDAR (for example Tasmania's 2 m DEM) has to be ordered through ELVIS and is not yet integrated. See `docs/mountains.md`.
- **Smoothing and spires:** the smoothed 30 m model under-reads sharp summits. Where OpenStreetMap records a surveyed height, a narrow local correction restores it. For example, Federation Peak goes from 1102 m to 1225 m and Feathertop from 1905 m to 1922 m. Ridges, valleys and slopes are otherwise untouched.
- **Map data:** tracks, huts, campsites, springs, peaks, streams and lakes come from OpenStreetMap. Where a summit climb is not a mapped track (Federation Peak from Hanging Lake), it is added as a clearly labelled off-track segment draped on the DEM.
- **Procedural supplements only:** sub-grid ground detail (±1.5 m), vegetation and rocks placed by ecological rules, snow patches, textures, weather and sound.
- **Collision:** the character stands on exactly the triangles that are rendered.

Rebuilding the terrain data (needs Python 3 with numpy and Pillow; downloads go to `data-raw/`):

```bash
python -I tools/build_mountain.py
```

`python -I tools/check_render.py` renders hillshade checks to `docs/checks/`, confirming that tracks sit on the ridges. `python -I tools/inspect_network.py <id>` lists track endpoints for writing content.

## Project layout

```
src/main.js                    entry: WebGL check, load save, title
src/game/                      Game (loop, rendering), GameState, Progression, SaveSystem
src/world/                     TerrainLoader (DEM, drainage, spot heights, lakes), TerrainGenerator (LOD tiles, shader),
                               Vegetation, Features (tracks, water, huts), Environment (sun, sky, fog), WorldManager
src/player/                    PlayerController (character + gait), CameraController
src/expedition/                MountainData, mountains/*.js (routes, places, encounters), RoutePlanner, ExpeditionManager, DecisionEngine
src/systems/                   Survival, Inventory, Economy, Photography, Social (Ridgeline), Weather, Audio (procedural)
src/ui/                        UI facade, HUD, Menus (all screens), Dialogue (mentor), MapInterface (topo), SocialUI
src/data/                      Items, Events (generic encounters)
src/dev/autoplay.js            dev-only test driver: await __autoplay('ossa','classic')
public/data/<id>/              packaged terrain: near.bin, far.bin, meta, network, pois, water, lakes
tools/                         data pipeline (Python)
```

## Testing that was done

- Every route on all eight mountains, plus Feathertop in winter, was played end to end by the dev autoplay driver. That covered junctions, encounters, camps, multi-stage progress, water refills, finish and debrief. Each route finished; one Frenchmans Cap run ended in an assisted rescue, after the driver walked through a stormy night instead of camping.
- Save and resume across reloads, the production build, and serving from a GitHub Pages-style sub-path (no 404s, no console errors).
- Not tested: touch controls on a real phone, other GPUs and browsers, and a live GitHub Pages deployment.

## Credits

See [ATTRIBUTION.md](ATTRIBUTION.md). Elevation © Commonwealth of Australia (Geoscience Australia), CC BY 4.0 · Map data © OpenStreetMap contributors, ODbL · three.js (MIT) · Fraunces and IBM Plex fonts (OFL). All models, textures, the mentor portrait and all audio are procedural or original.
