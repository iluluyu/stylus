"""save(): one call that produces an editable SVG (+ PDF + PNG preview) and a lint report.

What makes the SVG pleasant to edit in Illustrator / Inkscape / Figma:
* text stays <text> (svg.fonttype = none) with an Arial-first font stack
* every artist group gets a readable id: panel-a, a-line-ours, a-band-ours, a-xaxis, a-legend ...
* artists fully inside the axes are not wrapped in clip paths (no clip groups to fight with)
* mathtext glyph runs are merged into single tspans
"""
from __future__ import annotations

import os
import re

import numpy as np
from matplotlib.collections import PolyCollection, PathCollection, QuadMesh, LineCollection

from .lint import lint_figure, report
from .svgtools import tidy_svg


def _slug(s: str) -> str:
    s = re.sub(r"[$\\{}^_]", "", str(s))
    s = re.sub(r"[^\w]+", "-", s.strip().lower(), flags=re.UNICODE).strip("-")
    return s or "x"


class _Ids:
    def __init__(self):
        self.used = set()

    def __call__(self, s):
        base = _slug(s)
        if base[0].isdigit():
            base = "g-" + base
        out, i = base, 2
        while out in self.used:
            out = f"{base}-{i}"
            i += 1
        self.used.add(out)
        return out


def _coll_kind(c):
    from matplotlib.contour import ContourSet
    if isinstance(c, ContourSet):
        return "contour"
    if isinstance(c, QuadMesh):
        return "cells"
    if isinstance(c, PolyCollection):
        return "band"
    if isinstance(c, PathCollection):
        return "points"
    if isinstance(c, LineCollection):
        return "segments"
    return "collection"


def assign_ids(fig):
    """Readable, unique ids for every meaningful artist group."""
    ids = _Ids()
    for i, ax in enumerate(fig.axes):
        lab = ax.get_title(loc="left").strip() or str(i + 1)
        if ax.get_label() == "<colorbar>":
            p = f"{lab}-cbar"
        else:
            p = lab
        if ax.get_gid() is None:
            ax.set_gid(ids(f"panel-{p}"))
        for ln in ax.get_lines():
            if ln.get_gid() is None:
                name = ln.get_label()
                name = "line" if name.startswith("_child") else name.lstrip("_")
                ln.set_gid(ids(f"{p}-{name}" if name.startswith(("band", "start", "end", "ci", "front",
                                                                   "rate", "dominated")) else f"{p}-line-{name}"))
        for c in ax.collections:
            if c.get_gid() is None:
                name = c.get_label() or ""
                name = "" if name.startswith("_child") or name.startswith("_collection") else name.lstrip("_")
                c.set_gid(ids(f"{p}-{name}" if name else f"{p}-{_coll_kind(c)}"))
            else:
                c.set_gid(ids(f"{p}-{c.get_gid()}"))
        for k, pa in enumerate(ax.patches):
            if pa.get_gid() is None:
                pa.set_gid(ids(f"{p}-patch"))
        for t in ax.texts:
            if t.get_gid() is None:
                t.set_gid(ids(f"{p}-text-{t.get_text()[:24]}"))
            elif not t.get_gid().startswith(p + "-"):
                t.set_gid(ids(f"{p}-{t.get_gid()}"))
        ax.xaxis.set_gid(ids(f"{p}-xaxis"))
        ax.yaxis.set_gid(ids(f"{p}-yaxis"))
        lg = ax.get_legend()
        if lg is not None:
            lg.set_gid(ids(f"{p}-legend"))
        lt = ax._left_title
        if lt.get_text().strip():
            lt.set_gid(ids(f"label-{lt.get_text().strip()}"))
    for t in fig.texts:
        if t.get_gid() is None:
            t.set_gid(ids(f"figtext-{t.get_text()[:20]}"))


def _inside(ax, xmin, xmax, ymin, ymax, tol=1e-9):
    x0, x1 = sorted(ax.get_xlim())
    y0, y1 = sorted(ax.get_ylim())
    sx = (x1 - x0) * 1e-6 + tol
    sy = (y1 - y0) * 1e-6 + tol
    return xmin >= x0 - sx and xmax <= x1 + sx and ymin >= y0 - sy and ymax <= y1 + sy


def unclip(fig):
    """Drop clip paths from artists that already lie inside their axes."""
    n = 0
    for ax in fig.axes:
        for ln in ax.get_lines():
            x, y = (np.asarray(v, dtype=float) for v in ln.get_data())
            m = np.isfinite(x) & np.isfinite(y)
            if m.any() and _inside(ax, x[m].min(), x[m].max(), y[m].min(), y[m].max()):
                if ln.get_marker() in (None, "None", "", " "):
                    ln.set_clip_on(False)
                    n += 1
        for c in ax.collections:
            try:
                bb = c.get_datalim(ax.transData)
            except Exception:
                continue
            if np.all(np.isfinite([bb.x0, bb.x1, bb.y0, bb.y1])) and _inside(ax, bb.x0, bb.x1, bb.y0, bb.y1):
                if not isinstance(c, PathCollection):  # keep markers at the edge clipped
                    c.set_clip_on(False)
                    n += 1
    return n


def save(fig, path: str, formats=("svg", "pdf", "png"), png_dpi: int = 300, lint: bool = True,
         tidy: bool = True, name_ids: bool = True, drop_clips: bool = True, inkscape_layers: bool = False,
         quiet: bool = False):
    """Save a figure as editable vector files plus a PNG preview, and print a lint report.

    path: 'figures/fig2' or 'figures/fig2.svg' (extension ignored; `formats` decides).
    Returns dict with written paths and the list of lint issues.
    """
    base, ext = os.path.splitext(path)
    if ext.lower() not in ("", ".svg", ".pdf", ".png"):
        base = path
    os.makedirs(os.path.dirname(os.path.abspath(base)) or ".", exist_ok=True)
    if name_ids:
        assign_ids(fig)
    if drop_clips:
        unclip(fig)
    issues = lint_figure(fig) if lint else []
    written = {}
    for fmt in formats:
        out = f"{base}.{fmt}"
        if fmt == "svg":
            # transparent: no full-page white rectangle to fight with when editing / assembling
            fig.savefig(out, format="svg", transparent=True, metadata={"Date": None, "Creator": "scifig/matplotlib"})
            if tidy:
                tidy_svg(out, inkscape_layers=inkscape_layers)
        elif fmt == "pdf":
            fig.savefig(out, format="pdf", transparent=True, metadata={"CreationDate": None, "Creator": "scifig/matplotlib"})
        elif fmt == "png":
            fig.savefig(out, format="png", dpi=png_dpi, facecolor="white")
        else:
            fig.savefig(out, format=fmt)
        written[fmt] = out
    w, h = fig.get_size_inches() * 25.4
    if not quiet:
        print(f"saved {', '.join(written.values())}  ({w:.1f} x {h:.1f} mm)")
        if lint:
            print(report(issues, header="lint"))
        if "png" in written:
            print(f"next: view {written['png']} and check it against references/critique-checklist.md")
    return {"paths": written, "issues": issues, "size_mm": (round(w, 1), round(h, 1))}
