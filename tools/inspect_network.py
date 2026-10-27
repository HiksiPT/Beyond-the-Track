"""List named tracks (with endpoint node ids, positions and elevations) and named POIs for one mountain.
Used when writing src/expedition/mountains/<id>.js.   python -I tools/inspect_network.py <id> [track filter]"""
import json
import os
import sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
mid = sys.argv[1]
flt = sys.argv[2].lower() if len(sys.argv) > 2 else ""
d = os.path.join(ROOT, "public", "data", mid)
net = json.load(open(os.path.join(d, "network.json")))
pois = json.load(open(os.path.join(d, "pois.json")))
N = net["nodes"]


def near_poi(x, n):
    best = None
    for p in pois:
        if not p["name"]:
            continue
        dd = ((p["x"] - x) ** 2 + (p["n"] - n) ** 2) ** 0.5
        if best is None or dd < best[0]:
            best = (dd, p["name"])
    return f"{best[1]} @{best[0]:.0f}m" if best else ""


by = defaultdict(list)
for e in net["edges"]:
    if e["name"] and (not flt or flt in e["name"].lower()):
        by[e["name"]].append(e)
for name, es in sorted(by.items(), key=lambda kv: -sum(e["len"] for e in kv[1]))[:25]:
    deg = defaultdict(int)
    for e in es:
        deg[e["a"]] += 1
        deg[e["b"]] += 1
    ends = [k for k, v in deg.items() if v == 1]
    print(ascii(name), e["kind"], round(sum(e["len"] for e in es)), "m")
    for k in ends:
        x, n, y = N[k]
        print("   end", k, round(x), round(n), round(y), "m |", ascii(near_poi(x, n)), "| deg", sum(1 for e in net["edges"] if k in (e["a"], e["b"])))
print("--- POIs")
for p in pois:
    if p["name"] and p["kind"] in ("hut", "camp", "water", "viewpoint", "saddle", "peak", "site", "locality", "village", "town"):
        print(" ", p["kind"], ascii(p["name"]), round(p["x"]), round(p["n"]), p.get("ele"))
