"""Render a hillshade of each mountain's DEM with OSM tracks, water, lakes and huts overlaid, to check
that the map data sits on the real ridges and valleys.   python -I tools/check_render.py [ids...]"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def render(mid):
    d = os.path.join(ROOT, "public", "data", mid)
    m = json.load(open(os.path.join(d, "meta.json")))
    W, H = m["near"]["w"], m["near"]["h"]
    a = np.fromfile(os.path.join(d, "near.bin"), dtype="<u2").reshape(H, W) / 10 - 50
    x0, n0, x1, n1 = m["near"]["xn"]
    cx, cn = (x1 - x0) / W, (n1 - n0) / H
    gy, gx = np.gradient(a)
    gx /= cx
    gy /= -cn
    sl = np.arctan(np.hypot(gx, gy))
    asp = np.arctan2(-gx, gy)
    hs = np.sin(np.radians(40)) * np.cos(sl) + np.cos(np.radians(40)) * np.sin(sl) * np.cos(np.radians(315) - asp)
    img = np.clip(hs * 200 + 40, 0, 255).astype(np.uint8)
    el = (a - a.min()) / max(1, a.max() - a.min())
    rgb = np.stack([img * (0.6 + 0.4 * el), img * (0.75 + 0.1 * el), img * (0.6 + 0.2 * (1 - el))], -1).clip(0, 255).astype(np.uint8)
    im = Image.fromarray(rgb)
    dr = ImageDraw.Draw(im)

    def px(x, n):
        return ((x - x0) / cx - 0.5, (n1 - n) / cn - 0.5)

    lakes = json.load(open(os.path.join(d, "lakes.json"))) if os.path.exists(os.path.join(d, "lakes.json")) else []
    for L in lakes:
        dr.polygon([px(*p) for p in L["pts"]], fill=(60, 110, 200))
    for w in json.load(open(os.path.join(d, "water.json"))):
        if w["kind"] == "river" or w["name"]:
            dr.line([px(p[0], p[1]) for p in w["pts"]], fill=(70, 140, 255), width=1)
    for e in json.load(open(os.path.join(d, "network.json")))["edges"]:
        dr.line([px(p[0], p[1]) for p in e["pts"]], fill=(255, 60, 40) if e["kind"] == "path" else (255, 200, 0), width=2 if e["kind"] == "path" else 1)
    for p in json.load(open(os.path.join(d, "pois.json"))):
        if p["kind"] in ("hut", "peak", "camp") and p["name"]:
            X, Y = px(p["x"], p["n"])
            dr.ellipse([X - 3, Y - 3, X + 3, Y + 3], fill=(255, 255, 255))
            dr.text((X + 4, Y - 6), p["name"].encode("ascii", "replace").decode(), fill=(255, 255, 255))
    os.makedirs(os.path.join(ROOT, "docs", "checks"), exist_ok=True)
    out = os.path.join(ROOT, "docs", "checks", f"{mid}.png")
    im.save(out)
    print(out, im.size)


if __name__ == "__main__":
    ids = sys.argv[1:] or sorted(os.listdir(os.path.join(ROOT, "public", "data")))
    for mid in ids:
        render(mid)
