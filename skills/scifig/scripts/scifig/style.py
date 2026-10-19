"""Journal profiles, rcParams, sizing and panel labels.

Everything is in physical units: widths in mm, fonts and lines in pt, so the file you save
is already at print size (journals reduce figures they receive; designing at final size is
the only way font sizes stay within 5-7 pt).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field

import numpy as np
import matplotlib as mpl
import matplotlib.pyplot as plt
from matplotlib import font_manager

from .palette import PALETTES, INK

MM = 1 / 25.4  # inches per mm


@dataclass
class Journal:
    name: str
    widths: dict            # mm
    max_height: float       # mm
    font: float             # base text size, pt
    small: float            # tick labels / annotations, pt
    min_font: float         # hard floor, pt
    max_font: float         # ceiling for non-label text, pt
    label: float            # panel label size, pt
    label_case: str = "lower"   # 'lower' -> a, b, c ; 'upper' -> A, B, C
    note: str = ""
    extra: dict = field(default_factory=dict)


# Verified against Nature's final-artwork guide (2026): 89/183 mm, 1.5 col 120 or 136 mm,
# text 5-7 pt, panel labels 8 pt bold lowercase, page depth 247 mm (170 mm leaves room for legend).
# Other entries are common values: confirm with the journal's current author guide before submission.
JOURNALS: dict[str, Journal] = {
    "nature": Journal("Nature", {"single": 89, "onehalf": 120, "onehalf_wide": 136, "double": 183},
                      170, 7, 6, 5, 7, 8, "lower", "Nature Portfolio (Nature, Nat. Mach. Intell., Nat. Comput. Sci., ...)"),
    "science": Journal("Science", {"single": 55, "onehalf": 120, "double": 175}, 220, 7, 6, 5, 8, 8, "upper",
                       "Science/Science Advances: uppercase bold panel labels"),
    "cell": Journal("Cell Press", {"single": 85, "onehalf": 114, "double": 174}, 225, 7, 6, 5, 8, 9, "upper"),
    "pnas": Journal("PNAS", {"single": 87, "onehalf": 114, "double": 178}, 225, 7, 6, 5, 8, 8, "upper"),
    "ieee": Journal("IEEE", {"single": 88.9, "double": 181}, 230, 8, 7, 6, 9, 8, "lower",
                    "IEEE Trans.: 3.5 in / 7.16 in"),
    # ML/CS conferences: text is larger in print (body 10 pt), so figures use 7-9 pt.
    "neurips": Journal("NeurIPS/ICLR", {"single": 139.7, "half": 67, "double": 139.7}, 200, 8, 7, 6, 9, 9, "lower",
                       "single-column layout, \\textwidth = 5.5 in"),
    "icml": Journal("ICML", {"single": 82.6, "double": 171.5}, 220, 8, 7, 6, 9, 9, "lower",
                    "\\columnwidth = 3.25 in, \\textwidth = 6.75 in"),
    "cvpr": Journal("CVPR/ICCV", {"single": 82.6, "double": 174.6}, 220, 8, 7, 6, 9, 9, "lower",
                    "\\columnwidth = 3.25 in, \\textwidth = 6.875 in"),
}

_ACTIVE: dict = {"journal": JOURNALS["nature"], "font": None}

_FONT_PREFERENCE = ["Arial", "Helvetica", "Helvetica Neue", "Liberation Sans", "TeX Gyre Heros",
                    "Nimbus Sans", "Arimo", "DejaVu Sans"]


def available_sans() -> str:
    """First installed font from an Arial-compatible preference list.
    Liberation Sans / Arimo are metric-identical to Arial, so layouts transfer exactly."""
    names = {f.name for f in font_manager.fontManager.ttflist}
    for f in _FONT_PREFERENCE:
        if f in names:
            return f
    return "DejaVu Sans"


def journal() -> Journal:
    return _ACTIVE["journal"]


def rc_params(j: Journal, font: str) -> dict:
    lw = 0.6
    return {
        # text
        "font.family": "sans-serif",
        "font.sans-serif": [font] + [f for f in _FONT_PREFERENCE if f != font],
        "font.size": j.font,
        "axes.labelsize": j.font,
        "axes.titlesize": j.font,
        "axes.titleweight": "normal",
        "xtick.labelsize": j.small,
        "ytick.labelsize": j.small,
        "legend.fontsize": j.small,
        "legend.title_fontsize": j.small,
        "figure.titlesize": j.font,
        "text.color": INK,
        "axes.labelcolor": INK,
        "xtick.color": INK,
        "ytick.color": INK,
        "axes.edgecolor": INK,
        # math in the same sans font, upright digits
        "mathtext.fontset": "custom",
        "mathtext.rm": font,
        "mathtext.it": f"{font}:italic",
        "mathtext.bf": f"{font}:bold",
        "mathtext.sf": font,
        "mathtext.cal": f"{font}:italic",
        "mathtext.default": "it",
        # axes
        "axes.linewidth": lw,
        "axes.spines.top": False,
        "axes.spines.right": False,
        "axes.facecolor": "none",
        "axes.grid": False,
        "axes.axisbelow": True,
        "axes.labelpad": 2.5,
        "axes.titlepad": 3.0,
        "axes.xmargin": 0.02,
        "axes.ymargin": 0.04,
        "axes.prop_cycle": mpl.cycler(color=PALETTES["scifig"]),
        "grid.color": "#E3E3E3",
        "grid.linewidth": 0.4,
        "grid.linestyle": "-",
        # ticks
        "xtick.direction": "out",
        "ytick.direction": "out",
        "xtick.major.size": 2.5,
        "ytick.major.size": 2.5,
        "xtick.minor.size": 1.5,
        "ytick.minor.size": 1.5,
        "xtick.major.width": lw,
        "ytick.major.width": lw,
        "xtick.minor.width": 0.4,
        "ytick.minor.width": 0.4,
        "xtick.major.pad": 2.0,
        "ytick.major.pad": 2.0,
        # lines & markers
        "lines.linewidth": 1.0,
        "lines.markersize": 3.0,
        "lines.markeredgewidth": 0.6,
        "lines.solid_capstyle": "round",
        "patch.linewidth": 0.6,
        "hatch.linewidth": 0.5,
        "errorbar.capsize": 0,
        "scatter.edgecolors": "none",
        # legend: frameless, compact
        "legend.frameon": False,
        "legend.borderpad": 0.2,
        "legend.borderaxespad": 0.3,
        "legend.handlelength": 1.4,
        "legend.handletextpad": 0.4,
        "legend.labelspacing": 0.3,
        "legend.columnspacing": 1.0,
        # figure / export
        "figure.dpi": 150,
        "figure.facecolor": "white",
        "figure.constrained_layout.use": False,
        "figure.constrained_layout.h_pad": 2 / 72,
        "figure.constrained_layout.w_pad": 2 / 72,
        "figure.constrained_layout.hspace": 0.04,
        "figure.constrained_layout.wspace": 0.04,
        "savefig.dpi": 600,
        "savefig.bbox": "standard",    # keep the exact physical size you designed (never 'tight')
        "savefig.transparent": False,
        "svg.fonttype": "none",        # text stays <text>: editable in Illustrator/Inkscape/Figma
        "svg.hashsalt": "scifig",      # deterministic ids -> clean diffs
        "pdf.fonttype": 42,            # TrueType embedding (journals reject Type 3)
        "ps.fonttype": 42,
        "image.cmap": "viridis",
        "image.interpolation": "nearest",
    }


def use(journal_name: str = "nature", font: str | None = None, **overrides) -> Journal:
    """Activate a journal profile. Call once at the top of every figure script."""
    logging.getLogger("matplotlib.font_manager").setLevel(logging.ERROR)
    j = JOURNALS[journal_name.lower()]
    f = font or available_sans()
    mpl.rcParams.update(mpl.rcParamsDefault)
    mpl.rcParams.update(rc_params(j, f))
    mpl.rcParams.update(overrides)
    # sub/superscripts (10^-3 tick labels, x_t) shrink to 70 % by default, which drops 6 pt
    # tick labels to 4.2 pt -- below every journal's minimum. Shrink only as far as allowed.
    try:
        import matplotlib._mathtext as _mt
        _mt.SHRINK_FACTOR = min(0.9, max(0.7, (j.min_font + 0.05) / min(j.small, j.font)))
    except Exception:  # pragma: no cover
        pass
    _ACTIVE.update(journal=j, font=f)
    return j


def width_mm(width) -> float:
    j = journal()
    if isinstance(width, str):
        if width not in j.widths:
            raise ValueError(f"width '{width}' not in {j.name} widths {j.widths}")
        return float(j.widths[width])
    return float(width)


def figsize(width="single", height: float | None = None, aspect: float | None = None) -> tuple[float, float]:
    """(w, h) in inches. width: journal key ('single','double','onehalf') or mm. height in mm,
    or aspect = height/width (default 0.68 for single, 0.42 for double)."""
    w = width_mm(width)
    if height is None:
        aspect = aspect if aspect is not None else (0.68 if w < 100 else 0.42)
        height = w * aspect
    return (w * MM, height * MM)


def subplots(nrows=1, ncols=1, width="single", height=None, aspect=None, layout="constrained", **kw):
    """plt.subplots at physical size with constrained layout tuned for small figures."""
    fig, axes = plt.subplots(nrows, ncols, figsize=figsize(width, height, aspect), layout=layout, **kw)
    return fig, axes


def mosaic(spec, width="double", height=None, aspect=None, layout="constrained", **kw):
    """plt.subplot_mosaic at physical size. spec like "aab;cde" or nested lists."""
    if isinstance(spec, str) and ";" in spec:
        spec = [list(row) for row in spec.split(";")]
    fig, axd = plt.subplot_mosaic(spec, figsize=figsize(width, height, aspect), layout=layout, **kw)
    return fig, axd


def _label_text(i_or_s, j: Journal) -> str:
    s = i_or_s if isinstance(i_or_s, str) else "abcdefghijklmnopqrstuvwxyz"[i_or_s]
    return s.upper() if j.label_case == "upper" else s


def panel_labels(fig, axes, labels=None, pad_pt: float = 1.0, iters: int = 3):
    """Add bold panel labels aligned to each panel's top-left (outside tick labels),
    with labels in the same grid column sharing one x and the same row sharing one y.

    Implementation: the label is the axes' left title, shifted left to the panel's tight
    bounding box, so constrained layout reserves room for it. Layout is frozen afterwards
    so later draws cannot move panels out from under the labels.
    """
    j = journal()
    if isinstance(axes, dict):
        keys = list(axes.keys())
        axes = list(axes.values())
        if labels is None and all(isinstance(k, str) and len(k) == 1 for k in keys):
            labels = keys
    else:
        axes = list(getattr(axes, "flat", axes))
    labels = labels or [_label_text(i, j) for i in range(len(axes))]
    labels = [_label_text(l, j) if isinstance(l, (str, int)) else l for l in labels]
    pad_px = pad_pt * fig.dpi / 72.0
    texts = []
    for ax, lab in zip(axes, labels):
        t = ax.set_title(lab, loc="left", fontsize=j.label, fontweight="bold", y=1.0, pad=0)
        t.set_gid(f"label-{lab}")
        t.set_verticalalignment("bottom")
        texts.append(t)

    def grid_pos(ax, bb):
        ss = ax.get_subplotspec() if hasattr(ax, "get_subplotspec") else None
        if ss is not None:
            return ss.rowspan.start, ss.colspan.start
        return round(bb.y1), round(bb.x0)

    for _ in range(iters):
        fig.canvas.draw()
        r = fig.canvas.get_renderer()
        info = []
        for ax, t in zip(axes, texts):
            t.set_visible(False)
            tb = ax.get_tightbbox(r)
            t.set_visible(True)
            bb = ax.get_window_extent(r)
            row, col = grid_pos(ax, bb)
            info.append((ax, t, tb, bb, row, col))
        col_x: dict = {}
        row_top: dict = {}
        for ax, t, tb, bb, row, col in info:
            col_x[col] = min(col_x.get(col, np.inf), tb.x0)
            row_top[row] = max(row_top.get(row, -np.inf), tb.y1, bb.y1)
        for ax, t, tb, bb, row, col in info:
            x_axes = (col_x[col] - bb.x0) / bb.width
            y_axes = (row_top[row] + pad_px - bb.y0) / bb.height
            ax.set_title(t.get_text(), loc="left", fontsize=j.label, fontweight="bold", y=y_axes, pad=0)
            t.set_x(x_axes)
            t.set_horizontalalignment("left")
            t.set_verticalalignment("bottom")
    fig.canvas.draw()
    if fig.get_layout_engine() is not None:
        fig.set_layout_engine("none")
    return texts


def export_mplstyle(path: str, journal_name: str = "nature"):
    """Write the profile as a .mplstyle file for use outside scifig."""
    j = JOURNALS[journal_name]
    params = rc_params(j, "Arial")
    lines = [f"# scifig style for {j.name}. Generated by scifig.style.export_mplstyle", ""]
    for k, v in params.items():
        if k == "axes.prop_cycle":
            cols = ", ".join("'" + c.lstrip("#") + "'" for c in PALETTES["scifig"])
            lines.append(f"axes.prop_cycle: cycler('color', [{cols}])")
            continue
        if isinstance(v, list):
            v = ", ".join(v)
        if isinstance(v, str) and v.startswith("#"):
            v = v.lstrip("#")
        lines.append(f"{k}: {v}")
    with open(path, "w") as fh:
        fh.write("\n".join(lines) + "\n")
