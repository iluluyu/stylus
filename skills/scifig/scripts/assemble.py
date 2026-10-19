#!/usr/bin/env python3
"""Compose several SVG panels (matplotlib plots, sfd diagrams, anything) into ONE editable SVG.

Panels are inlined as vector groups (not <image> links), ids are namespaced per panel,
and bold panel labels are added. Nothing is rasterized.

Rows layout (most common):
    python assemble.py fig1.svg --width double \
        --row schematic.svg --row flow.svg,curves.svg --gap 3
    -> row 1: schematic; row 2: flow + curves side by side

Exact placement (mm, top-left corners) from JSON:
    python assemble.py fig1.svg --width 183 --layout layout.json
    layout.json: [{"file": "a.svg", "x": 0, "y": 0}, {"file": "b.svg", "x": 92, "y": 0, "label": "b"}]

Sizing policy: panels are placed at their native (= print) size whenever they fit, because
scaling changes every font size. Use --fit to scale each row to the full width; the tool
reports the resulting font scale and refuses to go below the journal minimum unless --force.
"""
from __future__ import annotations

import argparse
import copy
import json
import os
import re
import sys
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scifig.svgtools import SVG_NS, XLINK_NS, svg_size_pt, q  # noqa: E402

PT_PER_MM = 72 / 25.4
WIDTHS = {"nature": {"single": 89, "onehalf": 120, "double": 183}, "science": {"single": 55, "onehalf": 120, "double": 175},
          "cell": {"single": 85, "onehalf": 114, "double": 174}, "ieee": {"single": 88.9, "double": 181},
          "neurips": {"single": 139.7}, "icml": {"single": 82.6, "double": 171.5}, "cvpr": {"single": 82.6, "double": 174.6}}
FONT = "Arial, Helvetica, 'Liberation Sans', Arimo, sans-serif"


class Panel:
    def __init__(self, path, label=None):
        self.path = path
        self.tree = ET.parse(path)
        self.root = self.tree.getroot()
        self.w, self.h, self.vb = svg_size_pt(self.root)   # pt
        self.label = label
        self.scale = 1.0
        self.x = self.y = 0.0
        self.min_font = _min_font_pt(self.root, self.w / self.vb[2] if self.vb[2] else 1.0)

    @property
    def W(self):
        return self.w * self.scale

    @property
    def H(self):
        return self.h * self.scale


def _min_font_pt(root, unit):
    sizes = []
    for el in root.iter():
        st = (el.get("style") or "") + ";" + (f"font-size:{el.get('font-size')}" if el.get("font-size") else "")
        m = re.search(r"font-size:\s*([\d.]+)", st)
        if m and el.tag in (q("text"), q("tspan")):
            sizes.append(float(m.group(1)) * unit)
    return min(sizes) if sizes else None


def _namespace_ids(root, prefix):
    ids = {}
    for el in root.iter():
        i = el.get("id")
        if i:
            ids[i] = f"{prefix}{i}"
            el.set("id", ids[i])
    if not ids:
        return
    pat = re.compile(r"url\(#([^)]+)\)")
    href = f"{{{XLINK_NS}}}href"
    for el in root.iter():
        for k, v in list(el.attrib.items()):
            if k in (href, "href") and v.startswith("#") and v[1:] in ids:
                el.set(k, "#" + ids[v[1:]])
            elif "url(#" in v:
                el.set(k, pat.sub(lambda m: f"url(#{ids.get(m.group(1), m.group(1))})", v))
        if el.tag == q("style") and el.text:
            el.text = pat.sub(lambda m: f"url(#{ids.get(m.group(1), m.group(1))})", el.text)


def _label_text(i, case):
    s = "abcdefghijklmnopqrstuvwxyz"[i]
    return s.upper() if case == "upper" else s


def layout_rows(rows, width_pt, gap_pt, vgap_pt, fit=False, justify="space"):
    y = 0.0
    for row in rows:
        natural = sum(p.w for p in row) + gap_pt * (len(row) - 1)
        if fit or natural > width_pt + 0.5:
            avail = width_pt - gap_pt * (len(row) - 1)
            # equal heights across the row, filling the width
            hs = sum(p.w / p.h for p in row)
            H = avail / hs
            for p in row:
                p.scale = H / p.h
        x = 0.0
        used = sum(p.W for p in row)
        g = gap_pt
        if not fit and len(row) > 1 and justify == "space":
            g = max(gap_pt, (width_pt - used) / (len(row) - 1))
        if len(row) == 1 and justify == "center":
            x = (width_pt - used) / 2
        rowH = max(p.H for p in row)
        for p in row:
            p.x, p.y = x, y + (rowH - p.H) / 2 if justify == "middle" else y
            x += p.W + g
        y += rowH + vgap_pt
    return y - vgap_pt


def assemble(out, rows=None, layout=None, width="double", journal="nature", gap_mm=3.0, vgap_mm=3.0,
             labels="auto", label_case="lower", label_size=8.0, label_dx=0.0, label_dy=0.0, fit=False,
             min_font=5.0, force=False, justify="space"):
    """Python API. rows: list of lists of SVG paths. layout: list of dicts (x, y in mm)."""
    width_mm = WIDTHS[journal].get(width, None) if isinstance(width, str) else float(width)
    if width_mm is None:
        raise SystemExit(f"unknown width '{width}' for {journal}: {WIDTHS[journal]}")
    W = width_mm * PT_PER_MM
    panels = []
    if layout:
        for k, item in enumerate(layout):
            p = Panel(item["file"], item.get("label"))
            p.x, p.y = item.get("x", 0) * PT_PER_MM, item.get("y", 0) * PT_PER_MM
            p.scale = item.get("scale", 1.0)
            panels.append(p)
        H = max(p.y + p.H for p in panels)
    else:
        prow = [[Panel(f) for f in row] for row in rows]
        H = layout_rows(prow, W, gap_mm * PT_PER_MM, vgap_mm * PT_PER_MM, fit=fit, justify=justify)
        panels = [p for row in prow for p in row]
    # font-scale guard
    problems = []
    for p in panels:
        if abs(p.scale - 1) > 0.01:
            eff = (p.min_font or 0) * p.scale
            msg = f"{os.path.basename(p.path)} scaled x{p.scale:.2f} -> smallest text {eff:.1f} pt"
            if p.min_font and eff < min_font - 0.05:
                problems.append(msg + f" (< {min_font} pt)")
            else:
                print("note: " + msg)
    if problems and not force:
        raise SystemExit("refusing to shrink text below the minimum:\n  " + "\n  ".join(problems) +
                         "\nRe-make those panels at their final size (preferred) or pass --force.")
    for m in problems:
        print("WARNING: " + m)

    ET.register_namespace("", SVG_NS)
    root = ET.Element(q("svg"), {"version": "1.1", "width": f"{width_mm:.2f}mm", "height": f"{H / PT_PER_MM:.2f}mm",
                                 "viewBox": f"0 0 {W:.2f} {H:.2f}"})
    ET.SubElement(root, q("title")).text = os.path.splitext(os.path.basename(out))[0]
    for i, p in enumerate(panels):
        lab = p.label if p.label is not None else (_label_text(i, label_case) if labels == "auto" else None)
        pid = f"panel-{lab}" if lab else f"panel-{i + 1}"
        r = copy.deepcopy(p.root)
        _namespace_ids(r, f"{lab or i + 1}-")
        sx = p.w / p.vb[2] if p.vb[2] else 1.0
        sy = p.h / p.vb[3] if p.vb[3] else 1.0
        tr = f"translate({p.x:.3f} {p.y:.3f})"
        if abs(p.scale - 1) > 1e-6:
            tr += f" scale({p.scale:.5f})"
        tr += f" scale({sx:.6f} {sy:.6f})"
        if p.vb[0] or p.vb[1]:
            tr += f" translate({-p.vb[0]:.3f} {-p.vb[1]:.3f})"
        g = ET.SubElement(root, q("g"), {"id": pid, "transform": tr})
        XS = "{http://www.w3.org/XML/1998/namespace}space"
        if r.get(XS):                       # keep whitespace semantics of the source panel
            g.set(XS, r.get(XS))
        for ch in list(r):
            if ch.tag in (q("title"), q("metadata")):
                continue
            g.append(ch)
        if lab and labels != "none":
            t = ET.SubElement(root, q("text"), {"id": f"label-{lab}", "x": f"{p.x + label_dx:.2f}",
                                                "y": f"{p.y + label_dy + label_size * 0.72:.2f}",
                                                "font-family": FONT, "font-size": f"{label_size:g}",
                                                "font-weight": "bold", "fill": "#1A1A1A"})
            t.text = lab
    ET.ElementTree(root).write(out, encoding="utf-8", xml_declaration=True)
    print(f"assembled {len(panels)} panels -> {out}  ({width_mm:.1f} x {H / PT_PER_MM:.1f} mm)")
    print(f"next: python {os.path.join(os.path.dirname(os.path.abspath(__file__)), 'check.py')} {out}")
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("out")
    ap.add_argument("--row", action="append", help="comma-separated SVGs for one row (repeatable)")
    ap.add_argument("--layout", help="JSON file with explicit placement in mm")
    ap.add_argument("--width", default="double", help="single|onehalf|double or mm")
    ap.add_argument("--journal", default="nature")
    ap.add_argument("--gap", type=float, default=3.0, help="horizontal gap, mm")
    ap.add_argument("--vgap", type=float, default=3.0, help="vertical gap between rows, mm")
    ap.add_argument("--labels", default="auto", choices=["auto", "none"],
                    help="'none' when panels already carry their own labels")
    ap.add_argument("--case", default="lower", choices=["lower", "upper"])
    ap.add_argument("--fit", action="store_true", help="scale rows to fill the width (changes font sizes)")
    ap.add_argument("--justify", default="space", choices=["space", "left", "center"])
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args(argv)
    width = a.width if not re.match(r"^[\d.]+$", a.width) else float(a.width)
    layout = json.load(open(a.layout)) if a.layout else None
    rows = [r.split(",") for r in (a.row or [])]
    if not rows and not layout:
        ap.error("give --row (repeatable) or --layout")
    assemble(a.out, rows=rows, layout=layout, width=width, journal=a.journal, gap_mm=a.gap, vgap_mm=a.vgap,
             labels=a.labels, label_case=a.case, fit=a.fit, force=a.force, justify=a.justify)


if __name__ == "__main__":
    main()
