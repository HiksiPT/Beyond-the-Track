# Data, licences and what is real

## Sources

| What | Source | Licence | Used for |
|---|---|---|---|
| Elevation | Geoscience Australia, *National Digital Elevation Model 1 Second* (DEM-S, derived from SRTM), WCS service `DEM_SRTM_1Second_2024`, https://pid.geoscience.gov.au/dataset/ga/72759 | CC BY 4.0. © Commonwealth of Australia (Geoscience Australia) 2024 | All terrain geometry for all eight mountains, horizons, drainage, route profiles and walking times |
| Tracks, huts, campsites, springs, peaks, streams, lakes | OpenStreetMap via Overpass, https://www.openstreetmap.org/copyright | ODbL 1.0. © OpenStreetMap contributors | Track network, junctions, places, surveyed summit heights, water |
| 3D engine | three.js 0.169.0 (npm) | MIT | Rendering |
| Build tool | Vite 5 | MIT | Development and production build |
| Fonts | Fraunces, IBM Plex Sans/Mono (Google Fonts) | SIL OFL 1.1 | UI |

`public/data/<id>/network.json`, `pois.json`, `water.json` and `lakes.json` are extracts of OpenStreetMap and stay under the ODbL. `near.bin` and `far.bin` are re-encoded GA elevation (CC BY 4.0).

There are no third-party models, textures, images or audio files. Character, huts, vegetation, textures (shader-generated), the mentor portrait (inline SVG) and all sound (Web Audio synthesis) are original to this project.

## What is real
- Terrain shape for every mountain: ridges, valleys, slopes, summits and surrounding peaks, at the DEM's native 1 arc-second resolution in the walkable area.
- Surveyed summit heights from OSM, applied as narrow local corrections where the smoothed DEM under-reads sharp peaks.
- Positions of tracks, junctions, huts, campsites, springs, lakes and streams.
- Sun position and day length for the real latitude, longitude and date.

## What is procedural or simulated
- Ground detail under the grid size (±1.5 m), vegetation, rocks, snow patches and surface textures, placed by ecological rules from the real elevation, slope, aspect and drainage.
- Weather, forecasts, encounters, hazards, survival, equipment wear, economy, sponsors and the Ridgeline social network.
- Off-track summit segments that are not mapped tracks (Federation Peak from Hanging Lake), labelled as such in game.
- Hut models are generic. Peg Arden is fictional. Landmark "field notes" are general context, not authoritative.

**Nothing in this game is real-world route or safety advice.**
