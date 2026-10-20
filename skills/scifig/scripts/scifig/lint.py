"""Automatic critique of a matplotlib figure at print size.

Catches the mechanical failures that make AI-generated figures look amateur:
overlapping or clipped text, fonts outside the journal range, labels sitting on data,
default colors, raster heatmaps, wrong column width, low-contrast text.
Run automatically by scifig.save(); call lint_figure(fig) yourself any time.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from matplotlib.text import Text
from matplotlib.colors import to_hex

from .color import contrast_ratio
from .style import journal

_TAB10 = {"#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f",
          "#bcbd22", "#17becf"}


@dataclass
class Issue:
    level: str   # ERROR | WARN | INFO
    code: str
    msg: str

    def __str__(self):
        return f"[{self.level}] {self.code}: {self.msg}"


def _visible_ticklabels(axis):
    try:
        ticks = axis._update_ticks()
    except Exception:  # pragma: no cover
        ticks = axis.get_major_ticks()
    out = []
    for t in ticks:
        for lab in (t.label1, t.label2):
            if lab.get_visible() and lab.get_text().strip():
                out.append(lab)
    return out


def _collect_texts(fig):
    texts = []
    for ax in fig.axes:
        if not ax.get_visible():
            continue
        for loc in ("center", "left", "right"):
            t = {"center": ax.title, "left": ax._left_title, "right": ax._right_title}[loc]
            texts.append(t)
        texts += list(ax.texts)
        if ax.axison:
            texts += [ax.xaxis.label, ax.yaxis.label, ax.xaxis.offsetText, ax.yaxis.offsetText]
            texts += _visible_ticklabels(ax.xaxis) + _visible_ticklabels(ax.yaxis)
        lg = ax.get_legend()
        if lg is not None and lg.get_visible():
            texts += list(lg.get_texts())
            if lg.get_title().get_text():
                texts.append(lg.get_title())
    texts += list(fig.texts)
    seen, out = set(), []
    for t in texts:
        if id(t) in seen or not isinstance(t, Text):
            continue
        seen.add(id(t))
        if t.get_visible() and t.get_text().strip() and (t.get_alpha() is None or t.get_alpha() > 0):
            out.append(t)
    return out


def _seg_rect_hits(P, rect):
    """Any segment of polyline P (N,2 display px) intersecting rect (x0,y0,x1,y1)? Liang-Barsky."""
    if len(P) < 2:
        return False
    x0, y0, x1, y1 = rect
    A, B = P[:-1], P[1:]
    ok = np.all(np.isfinite(A), 1) & np.all(np.isfinite(B), 1)
    A, B = A[ok], B[ok]
    if not len(A):
        return False
    # quick reject by bbox
    mnx, mxx = np.minimum(A[:, 0], B[:, 0]), np.maximum(A[:, 0], B[:, 0])
    mny, mxy = np.minimum(A[:, 1], B[:, 1]), np.maximum(A[:, 1], B[:, 1])
    cand = (mxx >= x0) & (mnx <= x1) & (mxy >= y0) & (mny <= y1)
    for a, b in zip(A[cand], B[cand]):
        d = b - a
        t0, t1 = 0.0, 1.0
        hit = True
        for p, qv in ((-d[0], a[0] - x0), (d[0], x1 - a[0]), (-d[1], a[1] - y0), (d[1], y1 - a[1])):
            if abs(p) < 1e-12:
                if qv < 0:
                    hit = False
                    break
            else:
                r = qv / p
                if p < 0:
                    t0 = max(t0, r)
                else:
                    t1 = min(t1, r)
                if t0 > t1:
                    hit = False
                    break
        if hit:
            return True
    return False


def _short(t):
    s = t.get_text().replace("\n", " ")
    return s if len(s) < 28 else s[:25] + "…"


def lint_figure(fig, j=None, check_data_overlap=True) -> list[Issue]:
    j = j or journal()
    fig.canvas.draw()
    r = fig.canvas.get_renderer()
    issues: list[Issue] = []
    W, H = fig.get_size_inches() * 25.4
    widths = sorted(set(j.widths.values()))
    if not any(abs(W - w) <= 1.0 for w in widths):
        issues.append(Issue("WARN", "width", f"figure is {W:.1f} mm wide; {j.name} columns are {widths} mm"))
    if H > j.max_height + 0.5:
        issues.append(Issue("WARN", "height", f"figure is {H:.1f} mm tall; keep <= {j.max_height} mm"))

    texts = _collect_texts(fig)
    fb = fig.bbox
    boxes = []
    for t in texts:
        fs = t.get_fontsize()
        gid = t.get_gid() or ""
        is_label = gid.startswith("label-")
        txt = t.get_text()
        if "$" in txt and ("^" in txt or "_" in txt):   # mathtext scripts render smaller
            try:
                import matplotlib._mathtext as _mt
                fs_eff = fs * _mt.SHRINK_FACTOR
            except Exception:
                fs_eff = fs * 0.7
        else:
            fs_eff = fs
        if fs_eff < j.min_font - 0.05:
            what = "" if fs_eff == fs else " (its sub/superscript)"
            issues.append(Issue("ERROR", "font-min", f"'{_short(t)}'{what} is {fs_eff:.1f} pt (< {j.min_font} pt)"))
        elif fs > j.max_font + 1e-6 and not is_label:
            issues.append(Issue("WARN", "font-max", f"'{_short(t)}' is {fs:.1f} pt (> {j.max_font} pt)"))
        try:
            bb = t.get_window_extent(r)
        except Exception:
            continue
        if bb.width <= 0 or bb.height <= 0:
            continue
        if bb.x0 < fb.x0 - 0.5 or bb.y0 < fb.y0 - 0.5 or bb.x1 > fb.x1 + 0.5 or bb.y1 > fb.y1 + 0.5:
            issues.append(Issue("ERROR", "clipped", f"'{_short(t)}' extends beyond the figure edge"))
        col = to_hex(t.get_color()).lower()
        if col not in ("#ffffff",) and contrast_ratio(col) < 4.5:
            issues.append(Issue("WARN", "contrast",
                                f"'{_short(t)}' color {col} has contrast {contrast_ratio(col):.1f} < 4.5 on white"))
        boxes.append((t, bb))
    # text-text overlap
    sh = 0.8
    for i in range(len(boxes)):
        ti, bi = boxes[i]
        for k in range(i + 1, len(boxes)):
            tk, bk = boxes[k]
            if (bi.x0 + sh < bk.x1 - sh and bk.x0 + sh < bi.x1 - sh and
                    bi.y0 + sh < bk.y1 - sh and bk.y0 + sh < bi.y1 - sh):
                issues.append(Issue("ERROR", "overlap", f"'{_short(ti)}' overlaps '{_short(tk)}'"))

    # text sitting on data lines / legend covering data
    if check_data_overlap:
        for ax in fig.axes:
            lines = [ln for ln in ax.get_lines() if ln.get_visible() and ln.get_linewidth() > 0
                     and ln.get_linestyle() not in ("None", "", " ")]
            paths = []
            for ln in lines:
                try:
                    P = ln.get_transform().transform(np.column_stack(ln.get_data()).astype(float))
                except Exception:
                    continue
                paths.append((ln, P))
            # scatter markers as small squares (marker area s is in pt^2)
            from matplotlib.collections import PathCollection
            marks = []
            for c in ax.collections:
                if isinstance(c, PathCollection) and c.get_visible() and len(c.get_offsets()):
                    offs = c.get_offset_transform().transform(np.asarray(c.get_offsets(), dtype=float))
                    sz = np.broadcast_to(np.asarray(c.get_sizes() if len(c.get_sizes()) else [20.0]), (len(offs),))
                    rad = np.sqrt(sz) / 2 * fig.dpi / 72
                    marks.append((c, offs, rad))
            for t in ax.texts:
                if t.get_gid() and t.get_gid().startswith(("label-",)):
                    continue
                try:
                    # Text part only: an Annotation's own extent includes its (often invisible) leader
                    # line, which starts on the data point and would always "overlap" it
                    tb = Text.get_window_extent(t, r)
                except Exception:
                    tb = None
                if tb is not None and tb.width > 0:
                    for c, offs, rad in marks:
                        hit = ((offs[:, 0] + rad > tb.x0 + 1) & (offs[:, 0] - rad < tb.x1 - 1) &
                               (offs[:, 1] + rad > tb.y0 + 1) & (offs[:, 1] - rad < tb.y1 - 1))
                        if hit.any():
                            issues.append(Issue("WARN", "text-on-data",
                                                f"'{_short(t)}' sits on a marker of '{c.get_label()}'"))
                            break
                bb = tb
                if bb is None:
                    continue
                rect = (bb.x0 + 1, bb.y0 + 1, bb.x1 - 1, bb.y1 - 1)
                for ln, P in paths:
                    own = "rate-label" in (t.get_gid() or "") and ln.get_label().startswith("_rate")
                    if not own and _seg_rect_hits(P, rect):
                        issues.append(Issue("WARN", "text-on-data",
                                            f"'{_short(t)}' sits on line '{ln.get_label()}'"))
                        break
            lg = ax.get_legend()
            if lg is not None and lg.get_visible() and lg.get_frame_on() is False:
                bb = lg.get_window_extent(r)
                rect = (bb.x0 + 1, bb.y0 + 1, bb.x1 - 1, bb.y1 - 1)
                for ln, P in paths:
                    if _seg_rect_hits(P, rect):
                        issues.append(Issue("WARN", "legend-on-data",
                                            f"legend overlaps line '{ln.get_label()}' — move it or use direct labels"))
                        break

    # insets covering data of their parent, and text that strays onto another axes
    for ax in fig.axes:
        parent = getattr(ax, "_parent_axes", None) or getattr(ax, "axes", None)
        for child in ax.child_axes:
            cb = child.get_window_extent(r)
            rect = (cb.x0, cb.y0, cb.x1, cb.y1)
            for ln in ax.get_lines():
                if not ln.get_visible() or ln.get_linestyle() in ("None", "", " "):
                    continue
                try:
                    P = ln.get_transform().transform(np.column_stack(ln.get_data()).astype(float))
                except Exception:
                    continue
                if _seg_rect_hits(P, rect):
                    issues.append(Issue("WARN", "inset-on-data",
                                        f"inset hides part of '{ln.get_label()}' — move it to an empty region"))
        for t in ax.texts:
            try:
                bb = t.get_window_extent(r)
            except Exception:
                continue
            for other in fig.axes + [c for a in fig.axes for c in a.child_axes]:
                if other is ax or not other.get_visible() or not other.axison:
                    continue
                ob = other.get_window_extent(r)
                if bb.x0 < ob.x1 - 1 and ob.x0 < bb.x1 - 1 and bb.y0 < ob.y1 - 1 and ob.y0 < bb.y1 - 1:
                    issues.append(Issue("ERROR", "text-on-axes", f"'{_short(t)}' overlaps another axes/inset"))
                    break

    # colors, rasters, titles
    cols = set()
    for ax in fig.axes:
        for ln in ax.get_lines():
            cols.add(to_hex(ln.get_color()).lower())
        for c in ax.collections:
            try:
                fc = c.get_facecolor()
                if len(fc) == 1:
                    cols.add(to_hex(fc[0]).lower())
            except Exception:
                pass
        if ax.images:
            issues.append(Issue("WARN", "raster", "imshow embeds a raster image in the SVG; "
                                                  "use scifig.heatmap / pcolormesh for vector cells"))
        if ax.get_title(loc="center").strip():
            issues.append(Issue("INFO", "title", f"axes title '{ax.get_title()}' — journals put this in the caption"))
        n_x = len(_visible_ticklabels(ax.xaxis)) if ax.axison else 0
        n_y = len(_visible_ticklabels(ax.yaxis)) if ax.axison else 0
        if max(n_x, n_y) > 9:
            issues.append(Issue("INFO", "ticks", f"{max(n_x, n_y)} tick labels on one axis; 3-6 reads better"))
        lg = ax.get_legend()
        if lg is not None and lg.get_frame_on() and lg.get_frame().get_edgecolor()[3] > 0 and \
                lg.get_frame().get_linewidth() > 0:
            issues.append(Issue("INFO", "legend-frame", "legend has a visible frame; frameless is cleaner"))
    if cols & _TAB10:
        issues.append(Issue("WARN", "default-colors", "matplotlib default (tab10) colors in use; "
                                                      "use scifig.method_colors / palette"))
    n_hues = _count_hues(cols)
    if n_hues > 7:
        issues.append(Issue("WARN", "too-many-colors", f"{n_hues} distinct hues; aim for <= 6"))
    return issues


def _count_hues(hexes, tol_deg=22.0, min_chroma=14.0) -> int:
    """Number of hue families (tints/shades of one hue count once; greys ignored)."""
    from .color import hex_to_rgb, rgb_to_lab
    hues = []
    for h in hexes:
        L, a, b = rgb_to_lab(hex_to_rgb(h))
        if np.hypot(a, b) < min_chroma:
            continue
        hues.append(np.degrees(np.arctan2(b, a)) % 360)
    fam = []
    for h in sorted(hues):
        if not any(min(abs(h - f), 360 - abs(h - f)) < tol_deg for f in fam):
            fam.append(h)
    return len(fam)


def report(issues: list[Issue], header="lint") -> str:
    if not issues:
        return f"{header}: PASS (no issues)"
    order = {"ERROR": 0, "WARN": 1, "INFO": 2}
    lines = [f"{header}: {sum(i.level == 'ERROR' for i in issues)} error(s), "
             f"{sum(i.level == 'WARN' for i in issues)} warning(s), {sum(i.level == 'INFO' for i in issues)} info"]
    lines += ["  " + str(i) for i in sorted(issues, key=lambda i: order[i.level])]
    return "\n".join(lines)
