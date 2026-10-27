"""Per-mountain build configuration (real-world areas the game reconstructs).

  origin - (lat, lon) of the local coordinate origin: the OSM summit node (or a central peak for the traverse)
  near   - bbox (lon_min, lat_min, lon_max, lat_max) fetched at native 1 arc-second; the player walks inside this
  far    - wider bbox fetched coarse, used only as the distant horizon
Summit coordinates were taken from OpenStreetMap peak nodes (Oct 2026).
"""

SRTM = "DEM_SRTM_1Second_2024"

MOUNTAINS = {
    "kosciuszko": {
        "name": "Mount Kosciuszko", "state": "NSW",
        "origin": (-36.4558, 148.2635),
        "near": (148.16, -36.53, 148.42, -36.36),
        "far": (147.75, -36.95, 148.85, -35.95),
    },
    "feathertop": {
        "name": "Mount Feathertop", "state": "VIC",
        "origin": (-36.8941627, 147.1381339),
        "near": (146.98, -37.06, 147.27, -36.79),
        "far": (146.55, -37.45, 147.75, -36.35),
    },
    "bogong": {
        "name": "Mount Bogong", "state": "VIC",
        "origin": (-36.7324, 147.3058),
        "near": (147.15, -36.85, 147.45, -36.63),
        "far": (146.7, -37.25, 147.9, -36.2),
    },
    "cradle": {
        "name": "Cradle Mountain", "state": "TAS",
        "origin": (-41.6846, 145.9513),
        "near": (145.84, -41.78, 146.06, -41.60),
        "far": (145.45, -42.1, 146.45, -41.3),
    },
    "ossa": {
        "name": "Mount Ossa", "state": "TAS",
        "origin": (-41.8707, 146.0330),
        "near": (145.93, -41.97, 146.19, -41.75),
        "far": (145.5, -42.3, 146.6, -41.45),
    },
    "frenchmans": {
        "name": "Frenchmans Cap", "state": "TAS",
        "origin": (-42.2692, 145.8303),
        "near": (145.75, -42.32, 145.99, -42.17),
        "far": (145.35, -42.65, 146.35, -41.85),
    },
    "federation": {
        "name": "Federation Peak", "state": "TAS",
        "origin": (-43.2714, 146.4758),
        "near": (146.38, -43.34, 146.68, -43.18),
        "far": (145.95, -43.65, 147.05, -42.85),
    },
    "arthurs": {
        "name": "Western Arthur Range", "state": "TAS",
        "origin": (-43.1405, 146.2671),           # Mount Orion, mid-range
        "near": (146.10, -43.24, 146.45, -43.00),
        "far": (145.7, -43.6, 146.85, -42.7),
    },
}
for m in MOUNTAINS.values():
    m.setdefault("near_res_deg", 1 / 3600)
    m.setdefault("far_res_deg", 0.002)
    m.setdefault("dem_service", SRTM)
