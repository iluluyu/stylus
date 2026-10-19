"""Palettes, method->color assignment and colormaps.

Design rules encoded here (see references/color.md for the why):
* One method keeps one color across every panel of the paper -> use `method_colors` once, reuse the dict.
* "Ours" gets the single strongest accent; baselines get calmer colors.
* Never rely on hue alone: the default palette is checked under deutan/protan/tritan simulation.
"""
from __future__ import annotations

from typing import Iterable, Sequence

import numpy as np
from matplotlib.colors import LinearSegmentedColormap, ListedColormap
import matplotlib as mpl

from .color import palette_report, readable, tint, shade, mix  # re-export helpers

# --- categorical palettes -------------------------------------------------
# "scifig": Okabe-Ito hues, slightly deepened/desaturated for a calmer print look.
# Verified: min CIEDE2000 = 25 (normal), 13.5 (deutan), 14.1 (protan), 12.6 (tritan).
PALETTES: dict[str, list[str]] = {
    "scifig": ["#1A5FA0", "#CF5B2A", "#118C6E", "#C26FA3", "#E1A02E", "#5BADDF"],
    # Nature's own recommended colour-blind-safe palette (Okabe & Ito); black moved last.
    "okabe_ito": ["#0072B2", "#D55E00", "#009E73", "#CC79A7", "#E69F00", "#56B4E9", "#F0E442", "#000000"],
    # Paul Tol's qualitative schemes (https://personal.sron.nl/~pault/)
    "tol_bright": ["#4477AA", "#EE6677", "#228833", "#CCBB44", "#66CCEE", "#AA3377", "#BBBBBB"],
    "tol_vibrant": ["#0077BB", "#EE7733", "#009988", "#CC3311", "#33BBEE", "#EE3377", "#BBBBBB"],
    "tol_muted": ["#332288", "#88CCEE", "#44AA99", "#117733", "#999933", "#DDCC77", "#CC6677", "#882255", "#AA4499"],
}

ACCENT = "#CF5B2A"        # default color for the proposed method ("ours")
INK = "#1A1A1A"           # text / axes
NEUTRALS = {               # grey ramp for baselines, guides, annotations
    "900": "#222222", "700": "#4D4D4D", "600": "#666666", "500": "#808080",
    "400": "#A3A3A3", "300": "#C2C2C2", "200": "#DEDEDE", "100": "#EFEFEF",
}


def palette(name: str = "scifig", n: int | None = None) -> list[str]:
    p = PALETTES[name]
    if n is None:
        return list(p)
    if n > len(p):
        raise ValueError(f"palette '{name}' has {len(p)} colors; {n} requested. "
                         "More than ~6 categories is hard to read: group, facet or label directly instead.")
    return list(p[:n])


def method_colors(names: Sequence[str], highlight: str | Iterable[str] | None = None,
                  scheme: str = "accent", base: str = "scifig", accent: str = ACCENT) -> dict[str, str]:
    """Assign a stable color to each method.

    scheme:
      "accent"      highlight -> accent; others -> palette colors (accent hue removed)
      "gray"        highlight -> accent; others -> graded greys (use with direct labels, <=4 baselines)
      "categorical" everything from the palette in order (no special treatment)
    """
    names = list(names)
    hl = set([highlight] if isinstance(highlight, str) else (highlight or []))
    out: dict[str, str] = {}
    if scheme == "categorical" or not hl:
        cols = palette(base)
        if len(names) > len(cols):
            raise ValueError("Too many methods for one palette; facet the figure or group baselines.")
        return dict(zip(names, cols))
    others = [n for n in names if n not in hl]
    if scheme == "gray":
        greys = ["#3F3F3F", "#7A7A7A", "#A6A6A6", "#C6C6C6", "#5C5C5C", "#909090"]
        cols = greys[: len(others)]
    else:
        cols = [c for c in palette(base) if c.upper() != accent.upper()]
        if base == "okabe_ito":
            cols = [c for c in cols if c.upper() not in ("#E69F00", "#F0E442")]  # too close to vermillion/white
    if len(others) > len(cols):
        raise ValueError(f"{len(others)} baselines but only {len(cols)} colors in scheme '{scheme}'.")
    hl_cols = [accent, shade(accent, 0.35), tint(accent, 0.35)]
    for i, n in enumerate([n for n in names if n in hl]):
        out[n] = hl_cols[i % len(hl_cols)]
    out.update(dict(zip(others, cols)))
    return {n: out[n] for n in names}


# --- colormaps --------------------------------------------------------------
_CMAPS = {
    # single-hue sequential (heatmaps of a metric, "more is more")
    "seq": ["#F3F7FB", "#DCE8F4", "#A9C8E6", "#6699CC", "#1A5FA0", "#0B2E55"],
    "seq_warm": ["#FDF5F0", "#FBE3D5", "#F2B48F", "#E07F4F", "#CF5B2A", "#7A2E10"],
    # diverging around a meaningful center (difference to baseline, correlation, sign)
    "div": ["#0B2E55", "#1A5FA0", "#7FAFD9", "#F5F5F5", "#E9A07D", "#CF5B2A", "#6E2A0D"],
    # light background for loss landscapes so trajectories stay readable on top
    "landscape": ["#FCFDFE", "#EDF2F8", "#D9E3EF", "#C1D1E4", "#A6BCD6", "#8AA5C6"],
    "landscape_warm": ["#FFFDF8", "#FBF0DE", "#F3DDBB", "#E5BF8E", "#D19B63", "#B07443"],
}


def cmap(name: str = "seq", n: int | None = None, reverse: bool = False):
    """scifig colormaps ('seq','seq_warm','div','landscape','landscape_warm') or any matplotlib name.
    Perceptually uniform built-ins worth using: 'viridis', 'cividis', 'magma'. Never 'jet'/'rainbow'."""
    if name in _CMAPS:
        cols = _CMAPS[name][::-1] if reverse else _CMAPS[name]
        cm = LinearSegmentedColormap.from_list(f"scifig_{name}", cols, N=256)
    else:
        if name in ("jet", "rainbow", "hsv", "gist_rainbow", "nipy_spectral"):
            raise ValueError(f"'{name}' is not perceptually uniform and is rejected by journals; "
                             "use 'viridis', 'cividis' or scifig 'seq'/'div'.")
        cm = mpl.colormaps[name + ("_r" if reverse else "")]
    if n:
        return ListedColormap(cm(np.linspace(0, 1, n)), name=f"{cm.name}_{n}")
    return cm


def text_color_for(bg_hex: str) -> str:
    """Black or white text, whichever reads better on bg (for annotated heatmap cells)."""
    from .color import contrast_ratio
    return INK if contrast_ratio(INK, bg_hex) >= contrast_ratio("#FFFFFF", bg_hex) else "#FFFFFF"


__all__ = ["PALETTES", "ACCENT", "INK", "NEUTRALS", "palette", "method_colors", "cmap",
           "text_color_for", "palette_report", "readable", "tint", "shade", "mix"]
