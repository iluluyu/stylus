"""SVG post-processing shared by the Python and JS pipelines.

* normalize font stacks so files open with Arial/Helvetica on any machine
* merge per-glyph <tspan>s that matplotlib writes for mathtext (one editable string instead of 20)
* strip metadata noise, keep ids
* optional Inkscape layer attributes (off by default: Nature asks for *plain* SVG)
"""
from __future__ import annotations

import re
import xml.etree.ElementTree as ET

SVG_NS = "http://www.w3.org/2000/svg"
XLINK_NS = "http://www.w3.org/1999/xlink"
INK_NS = "http://www.inkscape.org/namespaces/inkscape"
NS = {"svg": SVG_NS, "xlink": XLINK_NS}
for p, u in [("", SVG_NS), ("xlink", XLINK_NS), ("inkscape", INK_NS),
             ("sodipodi", "http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"),
             ("dc", "http://purl.org/dc/elements/1.1/"), ("cc", "http://creativecommons.org/ns#"),
             ("rdf", "http://www.w3.org/1999/02/22-rdf-syntax-ns#")]:
    ET.register_namespace(p, u)

FONT_STACK = "'Arial', 'Helvetica', 'Liberation Sans', 'Arimo', sans-serif"
_ARIAL_COMPATIBLE = {"liberation sans", "arimo", "tex gyre heros", "nimbus sans", "nimbus sans l",
                     "helvetica neue", "arial", "helvetica"}


def q(tag: str) -> str:
    return f"{{{SVG_NS}}}{tag}"


def _fix_font_family(style: str) -> str:
    def repl(m):
        fams = [f.strip().strip("'\"") for f in m.group(1).split(",")]
        if fams and fams[0].lower() in _ARIAL_COMPATIBLE:
            return f"font-family: {FONT_STACK}"
        return m.group(0)
    return re.sub(r"font-family:\s*([^;\"]+)", repl, style)


def _parse_style(s: str) -> dict:
    out = {}
    for part in (s or "").split(";"):
        if ":" in part:
            k, v = part.split(":", 1)
            out[k.strip()] = v.strip()
    return out


def merge_tspans(text_el) -> int:
    """Merge consecutive <tspan> children with identical style and y. Returns merges done."""
    kids = [c for c in list(text_el) if c.tag == q("tspan")]
    if len(kids) < 2:
        return 0

    def fx(el):
        try:
            return float(el.get("x"))
        except (TypeError, ValueError):
            return None

    xs = [(fx(k), k) for k in kids]
    merged = 0
    prev, prev_x0 = None, None
    for t in kids:
        tx = fx(t)
        ok = (prev is not None and tx is not None and prev_x0 is not None and tx > prev_x0
              and t.get("style") == prev.get("style") and t.get("y") == prev.get("y")
              and len(t) == 0 and len(prev) == 0 and t.get("dy") is None)
        if ok:
            # matplotlib emits glyphs grouped by font, not in reading order: never merge across
            # a glyph of another run (e.g. a subscript) that sits between the two positions
            ok = not any(u is not t and u is not prev and ux is not None and prev_x0 < ux <= tx
                         for ux, u in xs)
        if ok:
            prev.text = (prev.text or "") + (t.text or "")
            text_el.remove(t)
            xs = [(x, k) for x, k in xs if k is not t]
            merged += 1
        else:
            prev, prev_x0 = t, tx
    # preserve spaces inside merged runs
    for t in text_el:
        if t.tag == q("tspan") and t.text and (" " in t.text):
            st = t.get("style", "")
            if "white-space" not in st:
                t.set("style", (st + "; white-space: pre").lstrip("; "))
    return merged


def tidy_svg(path: str, out: str | None = None, inkscape_layers: bool = False, merge_math=True) -> dict:
    tree = ET.parse(path)
    root = tree.getroot()
    stats = {"fonts_fixed": 0, "tspans_merged": 0, "metadata_removed": 0}
    # metadata
    for md in root.findall(q("metadata")):
        root.remove(md)
        stats["metadata_removed"] += 1
    for el in root.iter():
        st = el.get("style")
        if st and "font-family" in st:
            new = _fix_font_family(st)
            if new != st:
                el.set("style", new)
                stats["fonts_fixed"] += 1
        ff = el.get("font-family")
        if ff:
            fams = [f.strip().strip("'\"").lower() for f in ff.split(",")]
            if fams and fams[0] in _ARIAL_COMPATIBLE and len(fams) == 1:
                el.set("font-family", FONT_STACK.replace("'", ""))
                stats["fonts_fixed"] += 1
    if merge_math:
        for t in root.iter(q("text")):
            stats["tspans_merged"] += merge_tspans(t)
    if inkscape_layers:
        for g in root.iter(q("g")):
            gid = g.get("id", "")
            if gid.startswith(("panel-", "layer-")):
                g.set(f"{{{INK_NS}}}groupmode", "layer")
                g.set(f"{{{INK_NS}}}label", gid)
    tree.write(out or path, encoding="utf-8", xml_declaration=True)
    return stats


# ---------- geometry helpers used by check.py / assemble.py ----------
_UNIT_PT = {"pt": 1.0, "px": 0.75, "mm": 72 / 25.4, "cm": 720 / 25.4, "in": 72.0, "pc": 12.0, "": 0.75}


def length_pt(v: str | None) -> float | None:
    if v is None:
        return None
    m = re.match(r"^\s*([0-9.eE+-]+)\s*([a-z%]*)\s*$", v)
    if not m or m.group(2) == "%":
        return None
    return float(m.group(1)) * _UNIT_PT.get(m.group(2), 0.75)


def svg_size_pt(root) -> tuple[float, float, list[float]]:
    """(width_pt, height_pt, viewBox) of an SVG root."""
    vb = root.get("viewBox")
    vbv = [float(x) for x in re.split(r"[ ,]+", vb.strip())] if vb else None
    w, h = length_pt(root.get("width")), length_pt(root.get("height"))
    if vbv and (w is None or h is None):
        if w is None and h is None:
            w, h = vbv[2] * 0.75, vbv[3] * 0.75
        elif w is None:
            w = h * vbv[2] / vbv[3]
        else:
            h = w * vbv[3] / vbv[2]
    if vbv is None:
        vbv = [0, 0, (w or 0) / 0.75, (h or 0) / 0.75]
    return w, h, vbv


def parse_transform(s: str | None):
    """SVG transform attribute -> 3x3 affine matrix (numpy)."""
    import numpy as np
    M = np.eye(3)
    if not s:
        return M
    for name, args in re.findall(r"(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)", s):
        a = [float(x) for x in re.split(r"[ ,]+", args.strip()) if x]
        if name == "matrix":
            T = np.array([[a[0], a[2], a[4]], [a[1], a[3], a[5]], [0, 0, 1]])
        elif name == "translate":
            T = np.array([[1, 0, a[0]], [0, 1, a[1] if len(a) > 1 else 0], [0, 0, 1]])
        elif name == "scale":
            sx = a[0]
            sy = a[1] if len(a) > 1 else a[0]
            T = np.diag([sx, sy, 1.0])
        elif name == "rotate":
            th = np.radians(a[0])
            c, s_ = np.cos(th), np.sin(th)
            R = np.array([[c, -s_, 0], [s_, c, 0], [0, 0, 1]])
            if len(a) == 3:
                T = (np.array([[1, 0, a[1]], [0, 1, a[2]], [0, 0, 1]]) @ R
                     @ np.array([[1, 0, -a[1]], [0, 1, -a[2]], [0, 0, 1]]))
            else:
                T = R
        elif name == "skewX":
            T = np.array([[1, np.tan(np.radians(a[0])), 0], [0, 1, 0], [0, 0, 1]])
        else:
            T = np.array([[1, 0, 0], [np.tan(np.radians(a[0])), 1, 0], [0, 0, 1]])
        M = M @ T
    return M
