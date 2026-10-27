# The eight mountains — data notes

All eight are built from the GA 1-second DEM (`DEM_SRTM_1Second_2024`) with OSM tracks and places. Bounding boxes are in `tools/mountains.py`, and the alignment check images are in `docs/checks/`.

| # | Mountain | Walkable area | DEM summit before → after OSM spot height | Higher-resolution option for a future upgrade |
|---|---|---|---|---|
| 1 | Kosciuszko (2228 m) | 23.2 × 18.9 km | 2223 → 2228 m | NSW Spatial Services LiDAR via ELVIS |
| 2 | Feathertop (1922 m) | 25.8 × 30.0 km | 1905 → 1922 m | VicMap Elevation LiDAR (state) |
| 3 | Bogong (1986 m) | 26.8 × 24.4 km | 1983 → 1986 m | VicMap Elevation LiDAR (state) |
| 4 | Cradle Mountain (1545 m) | 18.3 × 20.0 km | 1538 → 1545 m | Tasmania 2 m DEM via ELVIS / LISTmap |
| 5 | Mount Ossa (1617 m) | 21.6 × 24.4 km | 1608 → 1617 m | Tasmania 2 m DEM |
| 6 | Frenchmans Cap (1446 m) | 19.9 × 16.7 km | 1417 → 1446 m | Tasmania 2 m DEM |
| 7 | Federation Peak (1225 m) | 24.3 × 17.8 km | 1102 → 1225 m (spire) | Tasmania 2 m DEM. The 30 m model blunts the spire most, so this one benefits most |
| 8 | Western Arthurs (traverse) | 28.4 × 26.7 km | West Portal 1155 → 1181 m | Tasmania 2 m DEM |

GA's national 5 m LiDAR (`DEM_LiDAR_5m_2025`) was checked at every summit on 25 Oct 2026 and has no coverage at any of them. State LiDAR has to be ordered through ELVIS (email delivery) and would need a GeoTIFF import step in `tools/build_mountain.py`.

## Adding or upgrading a mountain
1. Add or edit the entry in `tools/mountains.py`: OSM summit node as the origin, a walkable bbox covering every trailhead, and a far bbox about 100 km across.
2. Run `python -I tools/build_mountain.py <id>`, then `python -I tools/check_render.py <id>`, and confirm the tracks sit on the ridges.
3. Run `python -I tools/inspect_network.py <id> "<track name>"` to find trailhead and junction node ids.
4. Write `src/expedition/mountains/<id>.js`: ecology/palette, climate, trailheads, places, routes, landmarks, objectives, mentor lines and encounters. Then register it in `src/expedition/MountainData.js`.
5. In the dev build, run `await __autoplay('<id>', '<route>')` to play each route end to end.
