"""Fetch real elevation + map data for one mountain and convert it into game data.

    python -I tools/build_mountain.py feathertop

Downloads are cached under data-raw/<id>/ (delete to refetch). Output goes to public/data/<id>/:
  near.bin / far.bin   uint16 little-endian heights, value = (metres + 50) * 10, row 0 = north
  meta.json            grid sizes, bboxes, origin, projection constants, sources
  network.json         walkable OSM ways split at junctions, draped on the DEM
  pois.json            huts, peaks, springs, viewpoints, saddles, camps (OSM)
  water.json           mapped rivers and streams (OSM)

Sources: Geoscience Australia national 1-second DEM (CC BY 4.0) via WCS;
OpenStreetMap via Overpass (ODbL). See ATTRIBUTION.md.
"""
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mountains import MOUNTAINS  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "data")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
WCS = "https://services.ga.gov.au/gis/services/{svc}/MapServer/WCSServer"
OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://lz4.overpass-api.de/api/interpreter"]

WALKABLE = {"path", "footway", "track", "steps", "bridleway"}
POI_TAGS = {
    "tourism": {"alpine_hut", "wilderness_hut", "camp_site", "viewpoint"},
    "amenity": {"shelter", "drinking_water"},
    "natural": {"peak", "saddle", "spring", "cliff", "rock", "waterfall"},
    "waterway": {"waterfall"},
    "historic": None,
    "place": {"town", "village", "hamlet", "locality"},
}


def fetch(url, path, data=None, ua=UA):
    if os.path.exists(path) and os.path.getsize(path) > 1000:
        return
    urls = url if isinstance(url, list) else [url]
    last = None
    for attempt in range(6):   # public endpoints are flaky (502/504); rotate mirrors and back off
        try:
            req = urllib.request.Request(urls[attempt % len(urls)], data=data, headers={"User-Agent": ua})
            with urllib.request.urlopen(req, timeout=300) as r, open(path + ".part", "wb") as f:
                f.write(r.read())
            os.replace(path + ".part", path)
            return
        except Exception as e:  # noqa: BLE001
            last = e
            print("  retry", attempt + 1, e)
            time.sleep(5 * (attempt + 1))
    raise last


def fetch_dem(svc, bbox, res, path):
    w = round((bbox[2] - bbox[0]) / res)
    h = round((bbox[3] - bbox[1]) / res)
    q = dict(service="WCS", version="1.0.0", request="GetCoverage", coverage="1", crs="EPSG:4326",
             bbox=",".join(f"{v:.6f}" for v in bbox), width=w, height=h, format="GeoTIFF",
             interpolation="bilinear")
    fetch(WCS.format(svc=svc) + "?" + urllib.parse.urlencode(q), path)
    a = np.array(Image.open(path), dtype=np.float32)
    # nodata (sea) and corrupt cells: Australia's highest point is 2228 m, so anything above 2300 is invalid
    bad = (a < -100) | (a > 2300) | ~np.isfinite(a)
    if bad.any():
        a[bad] = np.nan
        for _ in range(8):   # fill from valid neighbours, then sea level for whatever is left
            m = np.isnan(a)
            if not m.any():
                break
            pad = np.pad(a, 1, mode="edge")
            nb = np.stack([pad[:-2, 1:-1], pad[2:, 1:-1], pad[1:-1, :-2], pad[1:-1, 2:]])
            fill = np.nanmean(np.where(np.isnan(nb), np.nan, nb), axis=0) if (~np.isnan(nb)).any() else np.zeros_like(a)
            a[m] = fill[m]
        a[np.isnan(a)] = 0.0
    return a


class Proj:
    """Local equirectangular projection around the origin: x = metres east, n = metres north."""

    def __init__(self, lat0, lon0):
        p = math.radians(lat0)
        self.lat0, self.lon0 = lat0, lon0
        self.m_lat = 111132.92 - 559.82 * math.cos(2 * p) + 1.175 * math.cos(4 * p)
        self.m_lon = 111412.84 * math.cos(p) - 93.5 * math.cos(3 * p)

    def __call__(self, lat, lon):
        return (lon - self.lon0) * self.m_lon, (lat - self.lat0) * self.m_lat


class Grid:
    def __init__(self, a, bbox):
        self.a, self.bbox = a, bbox
        self.h, self.w = a.shape

    def sample(self, lat, lon):
        x0, y0, x1, y1 = self.bbox
        # WCS bbox is cell-edge based: cell i is centred at x0 + (i + 0.5) * cell
        fx = (lon - x0) / (x1 - x0) * self.w - 0.5
        fy = (y1 - lat) / (y1 - y0) * self.h - 0.5
        if not (0 <= fx <= self.w - 1 and 0 <= fy <= self.h - 1):
            return None
        i, j = min(int(fx), self.w - 2), min(int(fy), self.h - 2)
        tx, ty = fx - i, fy - j
        a = self.a
        return float(a[j, i] * (1 - tx) * (1 - ty) + a[j, i + 1] * tx * (1 - ty)
                     + a[j + 1, i] * (1 - tx) * ty + a[j + 1, i + 1] * tx * ty)


def write_heights(a, path):
    v = np.clip(np.round((a + 50.0) * 10.0), 0, 65535).astype("<u2")
    v.tofile(path)


def overpass(bbox, path):
    s, w, n, e = bbox[1], bbox[0], bbox[3], bbox[2]
    b = f"({s},{w},{n},{e})"
    q = f"""[out:json][timeout:120];(
way["highway"]{b};
node["tourism"]{b}; way["tourism"~"alpine_hut|wilderness_hut"]{b};
node["amenity"~"shelter|drinking_water"]{b}; way["amenity"="shelter"]{b};
node["natural"]{b}; node["historic"]{b}; node["place"]{b}; node["name"~"Site$"]{b};
way["waterway"~"river|stream|waterfall"]{b}; node["waterway"="waterfall"]{b};
);out body geom;"""
    fetch(OVERPASS, path, data=urllib.parse.urlencode({"data": q}).encode(), ua="peaks-expedition-build/0.1")
    return json.load(open(path, encoding="utf-8"))["elements"]


def build_lakes(cfg, raw, proj):
    """OSM natural=water polygons (outer rings) larger than ~0.2 ha, in local metres."""
    bb = cfg["near"]
    b = f"({bb[1]},{bb[0]},{bb[3]},{bb[2]})"
    q = f'[out:json][timeout:120];(way["natural"="water"]{b};relation["natural"="water"]{b};way["water"="lake"]{b};);out body geom;'
    path = os.path.join(raw, "osm_lakes.json")
    fetch(OVERPASS, path, data=urllib.parse.urlencode({"data": q}).encode(), ua="peaks-expedition-build/0.1")
    els = json.load(open(path, encoding="utf-8"))["elements"]
    rings = []
    for e in els:
        name = e.get("tags", {}).get("name", "")
        if e["type"] == "way" and "geometry" in e:
            rings.append((name, e["geometry"]))
        elif e["type"] == "relation":
            for mem in e.get("members", []):
                if mem.get("role") == "outer" and "geometry" in mem:
                    rings.append((name, mem["geometry"]))
    out, seen = [], set()
    for name, g in rings:
        if len(g) < 4:
            continue
        pts = [proj(p["lat"], p["lon"]) for p in g]
        area = abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(pts, pts[1:] + pts[:1]))) / 2
        key = (round(pts[0][0]), round(pts[0][1]))
        if area < 2000 or key in seen:
            continue
        seen.add(key)
        step = max(1, len(pts) // 400)
        out.append({"name": name, "area": round(area), "pts": [[round(x, 1), round(n, 1)] for x, n in pts[::step]]})
    return out


def poi_kind(t):
    for k, allowed in POI_TAGS.items():
        v = t.get(k)
        if v and (allowed is None or v in allowed):
            if k == "historic" or (k == "place" and v in ("locality",)) or t.get("name", "").endswith(" Site"):
                return "site" if k != "place" else "locality"
            return {"alpine_hut": "hut", "wilderness_hut": "hut", "shelter": "hut", "camp_site": "camp",
                    "drinking_water": "water", "spring": "water"}.get(v, v)
    if t.get("name", "").endswith(" Site"):
        return "site"
    return None


def main(mid):
    cfg = MOUNTAINS[mid]
    raw = os.path.join(ROOT, "data-raw", mid)
    out = os.path.join(OUT, mid)
    os.makedirs(raw, exist_ok=True)
    os.makedirs(out, exist_ok=True)
    proj = Proj(*cfg["origin"])

    near = fetch_dem(cfg["dem_service"], cfg["near"], cfg["near_res_deg"], os.path.join(raw, "near.tif"))
    far = fetch_dem(cfg["dem_service"], cfg["far"], cfg["far_res_deg"], os.path.join(raw, "far.tif"))
    write_heights(near, os.path.join(out, "near.bin"))
    write_heights(far, os.path.join(out, "far.bin"))
    g = Grid(near, cfg["near"])
    print("near", near.shape, near.min(), near.max(), " far", far.shape, far.min(), far.max())

    def corners(bb):
        x0, n0 = proj(bb[1], bb[0])
        x1, n1 = proj(bb[3], bb[2])
        return [round(x0, 2), round(n0, 2), round(x1, 2), round(n1, 2)]

    els = overpass(cfg["near"], os.path.join(raw, "osm.json"))

    # --- walkable network, split at shared nodes ---
    ways = [e for e in els if e["type"] == "way" and e.get("tags", {}).get("highway") in WALKABLE and "geometry" in e]
    use = {}
    for w in ways:
        for nid in w["nodes"]:
            use[nid] = use.get(nid, 0) + 1
    inset = 0.002
    bb = cfg["near"]

    def inside(p):
        return bb[0] + inset < p["lon"] < bb[2] - inset and bb[1] + inset < p["lat"] < bb[3] - inset

    nodes, edges = {}, []

    def node_xy(nid, p):
        if nid not in nodes:
            x, n = proj(p["lat"], p["lon"])
            nodes[nid] = [round(x, 1), round(n, 1), round(g.sample(p["lat"], p["lon"]), 1)]
        return str(nid)

    for w in ways:
        t = w["tags"]
        run = []
        for nid, p in zip(w["nodes"], w["geometry"]):
            if not inside(p):
                if len(run) >= 2:
                    edges.append((t, run))
                run = []
                continue
            run.append((nid, p))
            if len(run) >= 2 and (use[nid] > 1):
                edges.append((t, run))
                run = [(nid, p)]
        if len(run) >= 2:
            edges.append((t, run))

    edge_out = []
    for t, run in edges:
        pts, length = [], 0.0
        for k, (nid, p) in enumerate(run):
            x, n = proj(p["lat"], p["lon"])
            y = g.sample(p["lat"], p["lon"])
            if pts:
                length += math.hypot(x - pts[-1][0], n - pts[-1][1])
            pts.append([round(x, 1), round(n, 1), round(y, 1)])
        a = node_xy(run[0][0], run[0][1])
        b = node_xy(run[-1][0], run[-1][1])
        edge_out.append({"a": a, "b": b, "name": t.get("name", ""), "kind": t["highway"],
                         "sac": t.get("sac_scale", ""), "len": round(length, 1), "pts": pts})
    nodes = {str(k): v for k, v in nodes.items()}

    # --- points of interest ---
    pois, seen = [], set()
    for e in els:
        t = e.get("tags", {})
        kind = poi_kind(t)
        if not kind:
            continue
        if e["type"] == "way":
            if "geometry" not in e:
                continue
            lat = sum(p["lat"] for p in e["geometry"]) / len(e["geometry"])
            lon = sum(p["lon"] for p in e["geometry"]) / len(e["geometry"])
        else:
            lat, lon = e["lat"], e["lon"]
        if not (bb[0] < lon < bb[2] and bb[1] < lat < bb[3]):
            continue
        name = t.get("name", "")
        key = (name or f"{kind}@{lat:.3f},{lon:.3f}", kind if kind != "camp" else "hut")
        if key in seen:
            continue
        seen.add(key)
        x, n = proj(lat, lon)
        pois.append({"name": name, "kind": kind, "x": round(x, 1), "n": round(n, 1),
                     "y": round(g.sample(lat, lon), 1), "ele": t.get("ele"), "lat": round(lat, 6),
                     "lon": round(lon, 6), "osm": f"{e['type']}/{e['id']}"})

    # --- mapped water ---
    water = []
    for e in els:
        t = e.get("tags", {})
        if e["type"] != "way" or t.get("waterway") not in ("river", "stream") or "geometry" not in e:
            continue
        pts = []
        for p in e["geometry"]:
            if inside(p):
                x, n = proj(p["lat"], p["lon"])
                pts.append([round(x, 1), round(n, 1), round(g.sample(p["lat"], p["lon"]), 1)])
            elif len(pts) >= 2:
                water.append({"name": t.get("name", ""), "kind": t["waterway"], "pts": pts})
                pts = []
            else:
                pts = []
        if len(pts) >= 2:
            water.append({"name": t.get("name", ""), "kind": t["waterway"], "pts": pts})

    # keep rivers and named streams; unnamed streams only if longer than 400 m (file size)
    def wlen(w):
        return sum(math.hypot(q[0] - p[0], q[1] - p[1]) for p, q in zip(w["pts"], w["pts"][1:]))
    water = [w for w in water if w["kind"] == "river" or w["name"] or wlen(w) > 400]

    meta = {
        "id": mid, "name": cfg["name"], "state": cfg["state"],
        "origin": {"lat": cfg["origin"][0], "lon": cfg["origin"][1]},
        "m_per_deg": {"lat": proj.m_lat, "lon": proj.m_lon},
        "encoding": "uint16 LE, metres = v / 10 - 50, row 0 = north, cell centres at edge + (i + 0.5) * cell",
        "near": {"w": near.shape[1], "h": near.shape[0], "bbox": cfg["near"], "xn": corners(cfg["near"]),
                 "min": float(near.min()), "max": float(near.max())},
        "far": {"w": far.shape[1], "h": far.shape[0], "bbox": cfg["far"], "xn": corners(cfg["far"]),
                "min": float(far.min()), "max": float(far.max())},
        "sources": [
            {"what": "Elevation", "name": "National Digital Elevation Model 1 Second (DEM-S, derived from SRTM)",
             "by": "Geoscience Australia", "service": cfg["dem_service"],
             "url": "https://pid.geoscience.gov.au/dataset/ga/72759", "licence": "CC BY 4.0"},
            {"what": "Tracks, huts, peaks, water", "name": "OpenStreetMap", "by": "OpenStreetMap contributors",
             "url": "https://www.openstreetmap.org/copyright", "licence": "ODbL 1.0"},
        ],
    }
    json.dump(meta, open(os.path.join(out, "meta.json"), "w"), indent=1)
    json.dump({"nodes": nodes, "edges": edge_out}, open(os.path.join(out, "network.json"), "w"), separators=(",", ":"))
    json.dump(pois, open(os.path.join(out, "pois.json"), "w"), indent=0)
    json.dump(water, open(os.path.join(out, "water.json"), "w"), separators=(",", ":"))
    lakes = build_lakes(cfg, raw, proj)
    json.dump(lakes, open(os.path.join(out, "lakes.json"), "w"), separators=(",", ":"))
    print(f"network: {len(nodes)} nodes, {len(edge_out)} edges; pois {len(pois)}; water {len(water)}; lakes {len(lakes)}")


if __name__ == "__main__":
    for mid in (sys.argv[1:] or list(MOUNTAINS)):
        print("==", mid)
        main(mid)
