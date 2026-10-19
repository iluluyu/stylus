"""High-level chart builders for algorithm / optimization papers.

Every function draws into an existing Axes and returns the artists it created, so you can
keep composing (annotations, insets, extra series). All styling comes from scifig.use();
colors come from palette.method_colors so a method keeps its color across panels.

Catalog (see references/chart-catalog.md for when to use which):
    convergence          median + IQR/CI bands over seeds, log axes, direct labels
    rate_guide           reference O(1/t^k) line on log-log convergence plots
    slope_triangle       slope marker for log-log plots
    performance_profile  Dolan-More profile across many problems
    pareto               per-method Pareto fronts with dominated points faded
    landscape            2-D objective contours + optimizer trajectories
    ablation             dot plot with CIs and delta column vs the full model
    grouped_bars         benchmark bars across datasets (when a table is not enough)
    heatmap              vector (pcolormesh) heatmap with annotations / best-cell marker
    cd_diagram           critical-difference diagram (Friedman + Nemenyi)
    tradeoff             accuracy vs cost bubble scatter with labels
    dist                 box + jittered points for per-seed distributions
    direct_labels        collision-free labels at line ends (replaces legends)
    better_arrow         small "better" direction cue
    inset_zoom           zoomed inset with connectors
"""
from __future__ import annotations

from typing import Mapping, Sequence

import numpy as np
import matplotlib.pyplot as plt
import matplotlib.transforms as mtransforms
from matplotlib.patches import Rectangle, Polygon
from matplotlib.ticker import FixedLocator, FuncFormatter, LogLocator, NullFormatter

from .palette import method_colors, cmap as get_cmap, INK, NEUTRALS, readable, tint, text_color_for
from .color import rgb_to_hex
from .style import journal

LW = 1.0          # baseline line width (pt)
LW_HL = 1.6       # highlighted method
BAND_ALPHA = 0.16


# ------------------------------------------------------------------ helpers
def _colors(names, colors, highlight):
    if colors is None:
        return method_colors(names, highlight)
    missing = [n for n in names if n not in colors]
    if missing:
        raise KeyError(f"colors missing for {missing}; build one dict with method_colors() and reuse it")
    return colors


def _hl_set(highlight):
    if highlight is None:
        return set()
    return {highlight} if isinstance(highlight, str) else set(highlight)


def _order_highlight_last(names, hl):
    return [n for n in names if n not in hl] + [n for n in names if n in hl]


def _pt2px(fig, pt):
    return pt * fig.dpi / 72.0


def _frame(ax, on=True, lw=0.6):
    for s in ax.spines.values():
        s.set_visible(on)
        s.set_linewidth(lw)


# ------------------------------------------------------------------ direct labels
def direct_labels(ax, items, side="right", pad_pt=3.0, gap=1.15, fontsize=None,
                  leader_min_pt=2.5, weight_for=None, iters=2):
    """Place labels next to line ends and push them apart vertically.

    items: list of (text, x, y, color) in data coordinates (x, y = the line end).
    Labels are drawn in a darkened version of the line color when needed to reach
    4.5:1 contrast on white (Nature asks for readable, high-contrast text).
    """
    fig = ax.figure
    fs = fontsize or journal().small
    weight_for = weight_for or set()
    anns = []
    for text, x, y, c in items:
        a = ax.annotate(text, xy=(x, y), xytext=(pad_pt if side == "right" else -pad_pt, 0),
                        textcoords="offset points", va="center",
                        ha="left" if side == "right" else "right",
                        fontsize=fs, color=readable(c), annotation_clip=False,
                        fontweight="bold" if text in weight_for else "normal",
                        arrowprops=dict(arrowstyle="-", lw=0.4, color=c, shrinkA=0, shrinkB=0,
                                        alpha=0.0))
        a.set_gid(f"dlabel-{text}")
        anns.append(a)
    if not anns:
        return anns
    for _ in range(iters):
        fig.canvas.draw()
        trans = ax.transData
        ys = np.array([trans.transform((x, y))[1] for _, x, y, _ in items])  # px
        order = np.argsort(ys)
        need = _pt2px(fig, fs * gap)
        new = np.empty_like(ys)
        new[order] = _spread(ys[order], need)
        for a, y0, y1, (_, _, _, c) in zip(anns, ys, new, items):
            dy_pt = (y1 - y0) * 72.0 / fig.dpi
            a.xyann = (a.xyann[0], dy_pt)
            a.arrow_patch.set_alpha(1.0 if abs(dy_pt) > leader_min_pt else 0.0)
    return anns


def _spread(y_sorted, gap):
    """Least-squares placement with minimum spacing (pool-adjacent-violators).
    Returns positions p (same order) with p[i+1]-p[i] >= gap minimizing sum (p-y)^2."""
    blocks = []  # [start, n, pos_of_first]
    for i, y in enumerate(y_sorted):
        blocks.append([i, 1, float(y)])
        while len(blocks) > 1:
            s0, n0, p0 = blocks[-2]
            s1, n1, p1 = blocks[-1]
            if p0 + n0 * gap <= p1:
                break
            n = n0 + n1
            # first-position that best fits members y_j - k*gap
            idx = np.arange(s0, s0 + n)
            p = float(np.mean(y_sorted[idx] - (idx - s0) * gap))
            blocks[-2:] = [[s0, n, p]]
    out = np.empty(len(y_sorted))
    for s, n, p in blocks:
        out[s:s + n] = p + np.arange(n) * gap
    return out


def _tidy_cbar(cb, n=4):
    from matplotlib.ticker import MaxNLocator
    cb.locator = MaxNLocator(n)
    cb.formatter = FuncFormatter(lambda v, _: f"{v:g}")
    cb.update_ticks()


def tidy_log(ax):
    """Clean log-axis ticks: no minor tick labels (the '6x10^-1' clutter); when the range spans
    less than ~1.5 decades, label 1-2-5 steps in plain numbers so the axis is never unlabeled."""
    for axis, scale, lim in ((ax.xaxis, ax.get_xscale(), ax.get_xlim()), (ax.yaxis, ax.get_yscale(), ax.get_ylim())):
        if scale != "log":
            continue
        lo, hi = sorted(lim)
        axis.set_minor_formatter(NullFormatter())
        if lo > 0 and np.log10(hi / lo) < 1.5:
            axis.set_major_locator(LogLocator(base=10, subs=(1.0, 2.0, 5.0)))
            axis.set_major_formatter(FuncFormatter(lambda v, _: f"{v:g}"))


def _end_point(x, y):
    m = np.isfinite(y)
    if not m.any():
        return None
    i = np.where(m)[0][-1]
    return x[i], y[i]


# ------------------------------------------------------------------ convergence
def convergence(ax, data: Mapping[str, np.ndarray], x=None, *, colors=None, highlight=None,
                band: str | None = "iqr", center: str = "median", logy=True, logx=False,
                labels: str = "direct", xlabel="Iteration", ylabel=r"$f(x_t) - f^\star$",
                lw=LW, lw_highlight=LW_HL, band_alpha=BAND_ALPHA, linestyles=None):
    """Convergence curves over seeds.

    data: name -> array (n_runs, n_steps) or (n_steps,)
    x:    shared array (n_steps,), or dict name -> array (e.g. wall-clock time per method)
    band: 'iqr' (25-75%), 'ci95' (mean +- 1.96 SEM), 'std', 'minmax' or None
    labels: 'direct' (text at line ends), 'legend', or None
    """
    names = list(data)
    hl = _hl_set(highlight)
    colors = _colors(names, colors, highlight)
    linestyles = linestyles or {}
    out, label_items = {}, []
    for name in _order_highlight_last(names, hl):
        Y = np.atleast_2d(np.asarray(data[name], dtype=float))
        xs = (x[name] if isinstance(x, Mapping) else x)
        xs = np.arange(1, Y.shape[1] + 1) if xs is None else np.asarray(xs, dtype=float)
        if center == "median":
            mid = np.nanmedian(Y, axis=0)
        else:
            mid = np.nanmean(Y, axis=0)
        c = colors[name]
        z = 4 if name in hl else 3
        if Y.shape[0] > 1 and band:
            if band == "iqr":
                lo, hi = np.nanpercentile(Y, 25, axis=0), np.nanpercentile(Y, 75, axis=0)
            elif band == "ci95":
                m, se = np.nanmean(Y, 0), np.nanstd(Y, 0, ddof=1) / np.sqrt(Y.shape[0])
                lo, hi = m - 1.96 * se, m + 1.96 * se
            elif band == "std":
                m, s = np.nanmean(Y, 0), np.nanstd(Y, 0)
                lo, hi = m - s, m + s
            elif band == "minmax":
                lo, hi = np.nanmin(Y, 0), np.nanmax(Y, 0)
            else:
                raise ValueError(band)
            if logy:
                floor = np.nanmin(mid[mid > 0]) * 1e-3 if np.any(mid > 0) else 1e-12
                lo = np.maximum(lo, floor)
            b = ax.fill_between(xs, lo, hi, color=c, alpha=band_alpha, lw=0, zorder=z - 1,
                                label=f"_band {name}")
            b.set_gid(f"band-{name}")
        (ln,) = ax.plot(xs, mid, color=c, lw=lw_highlight if name in hl else lw, zorder=z,
                        ls=linestyles.get(name, "-"), label=name, solid_capstyle="round")
        out[name] = ln
        ep = _end_point(xs, mid)
        if ep is not None:
            label_items.append((name, ep[0], ep[1], c))
    if logy:
        ax.set_yscale("log")
    if logx:
        ax.set_xscale("log")
    tidy_log(ax)
    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)
    if labels == "direct":
        # keep label order as given; bold the highlighted method
        label_items.sort(key=lambda t: names.index(t[0]))
        direct_labels(ax, label_items, weight_for=hl)
    elif labels == "legend":
        ax.legend(handles=[out[n] for n in names], loc="best")
    return out


def rate_guide(ax, order: float = 1.0, x0=None, y0=None, x1=None, label=None, color=None,
               where="below", lw=0.6):
    """Dashed reference line y = y0 * (x/x0)^(-order) for log-log convergence plots,
    e.g. order=1 -> O(1/t), order=2 -> O(1/t^2), order=0.5 -> O(1/sqrt(t))."""
    color = color or NEUTRALS["500"]
    xmin, xmax = ax.get_xlim()
    x0 = x0 or xmin * 1.5
    x1 = x1 or xmax / 1.5
    if y0 is None:
        ymin, ymax = ax.get_ylim()
        y0 = np.sqrt(ymin * ymax)
    xs = np.geomspace(x0, x1, 50)
    ys = y0 * (xs / x0) ** (-order)
    (ln,) = ax.plot(xs, ys, ls=(0, (3, 2)), lw=lw, color=color, zorder=2, label=f"_rate {order}")
    ln.set_gid(f"rate-guide-{order:g}")
    if label is None:
        label = {1: r"$\mathcal{O}(1/t)$", 2: r"$\mathcal{O}(1/t^2)$", 0.5: r"$\mathcal{O}(1/\sqrt{t})$"}.get(
            order, rf"$\mathcal{{O}}(t^{{-{order:g}}})$")
    # label sits along the line (rotated to its on-screen slope), offset to one side
    ax.figure.canvas.draw()
    i0, i1 = int(len(xs) * 0.45), int(len(xs) * 0.55)
    p0, p1 = ax.transData.transform([(xs[i0], ys[i0]), (xs[i1], ys[i1])])
    ang = np.degrees(np.arctan2(p1[1] - p0[1], p1[0] - p0[0]))
    xm, ym = np.sqrt(xs[i0] * xs[i1]) if ax.get_xscale() == "log" else (xs[i0] + xs[i1]) / 2, None
    ym = y0 * (xm / x0) ** (-order)
    n = np.array([-np.sin(np.radians(ang)), np.cos(np.radians(ang))]) * (-3.0 if where == "below" else 3.0)
    t = ax.annotate(label, xy=(xm, ym), xytext=tuple(n), textcoords="offset points", rotation=ang,
                    rotation_mode="anchor", fontsize=journal().small, color=NEUTRALS["700"],
                    va="top" if where == "below" else "bottom", ha="center")
    t.set_gid(f"rate-label-{order:g}")
    return ln, t


def slope_triangle(ax, x0, y0, slope, width_dec=0.4, label=None, color=None, flip=False):
    """Slope triangle on log-log axes anchored at (x0, y0); width in decades of x."""
    color = color or NEUTRALS["600"]
    x1 = x0 * 10 ** width_dec
    y1 = y0 * (x1 / x0) ** slope
    pts = [(x0, y0), (x1, y0), (x1, y1)] if not flip else [(x0, y0), (x0, y1), (x1, y1)]
    tri = Polygon(pts, closed=True, fill=False, lw=0.5, ec=color, zorder=2)
    ax.add_patch(tri)
    label = label or f"{slope:g}"
    xm = np.sqrt(x0 * x1)
    ax.text(xm if flip else x1 * 1.08, y0 * 0.82 if not flip else np.sqrt(y0 * y1),
            label, fontsize=journal().small, color=NEUTRALS["700"],
            ha="left" if not flip else "right", va="top" if not flip else "center")
    return tri


# ------------------------------------------------------------------ performance profile
def performance_profile(ax, T, names: Sequence[str], *, tau_max=None, colors=None, highlight=None,
                        labels="direct", lw=LW, lw_highlight=LW_HL,
                        xlabel=r"Performance ratio $\tau$", ylabel="Fraction of problems solved"):
    """Dolan-More performance profile.

    T: (n_problems, n_solvers) cost (time, evaluations, iterations); np.inf/np.nan = failure.
    rho_s(tau) = fraction of problems where solver s is within factor tau of the best.
    """
    T = np.asarray(T, dtype=float)
    T = np.where(np.isfinite(T) & (T > 0), T, np.inf)
    best = T.min(axis=1, keepdims=True)
    with np.errstate(invalid="ignore", divide="ignore"):
        R = T / best
    R[~np.isfinite(best[:, 0])] = np.inf
    finite = R[np.isfinite(R)]
    if tau_max is None:
        tau_max = 2 ** np.ceil(np.log2(max(finite.max(), 2.0))) if finite.size else 2.0
    taus = np.unique(np.concatenate([[1.0], finite[finite <= tau_max], [tau_max]]))
    hl = _hl_set(highlight)
    colors = _colors(list(names), colors, highlight)
    out, items = {}, []
    for s in _order_highlight_last(list(names), hl):
        j = list(names).index(s)
        rho = np.array([(R[:, j] <= t).mean() for t in taus])
        (ln,) = ax.step(taus, rho, where="post", color=colors[s], lw=lw_highlight if s in hl else lw,
                        zorder=4 if s in hl else 3, label=s)
        out[s] = ln
        items.append((s, taus[-1], rho[-1], colors[s]))
    ax.set_xscale("log", base=2)
    ax.set_xlim(1, tau_max)
    ax.set_ylim(0, 1.02)
    pw = 2.0 ** np.arange(0, np.floor(np.log2(tau_max)) + 1)
    if len(pw) > 7:
        pw = pw[::2]
    ax.xaxis.set_major_locator(FixedLocator(pw))
    ax.xaxis.set_major_formatter(FuncFormatter(lambda v, _: f"{v:g}"))
    ax.xaxis.set_minor_formatter(NullFormatter())
    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)
    if labels == "direct":
        items.sort(key=lambda t: list(names).index(t[0]))
        direct_labels(ax, items, weight_for=hl)
    elif labels == "legend":
        ax.legend(handles=[out[n] for n in names], loc="lower right")
    return out


# ------------------------------------------------------------------ pareto
def _nondominated(P, minimize=(True, True)):
    Q = P * np.array([1 if m else -1 for m in minimize])
    idx = np.argsort(Q[:, 0], kind="stable")
    keep, best = [], np.inf
    for i in idx:
        if Q[i, 1] < best:
            keep.append(i)
            best = Q[i, 1]
    return np.array(keep, dtype=int)


def pareto(ax, points: Mapping[str, np.ndarray], *, minimize=(True, False), colors=None, highlight=None,
           fronts=True, show_dominated=True, labels="direct", xlabel=None, ylabel=None,
           better=True, marker_size=14):
    """Per-method Pareto fronts. points: name -> (N, 2) array of (objective_x, objective_y).
    minimize: tuple of booleans per objective, e.g. (True, False) = minimize cost, maximize accuracy."""
    names = list(points)
    hl = _hl_set(highlight)
    colors = _colors(names, colors, highlight)
    out, items = {}, []
    for name in _order_highlight_last(names, hl):
        P = np.atleast_2d(np.asarray(points[name], dtype=float))
        c = colors[name]
        nd = _nondominated(P, minimize)
        dom = np.setdiff1d(np.arange(len(P)), nd)
        z = 5 if name in hl else 4
        s = marker_size * (1.5 if name in hl else 1.0)
        if show_dominated and dom.size:
            ax.scatter(P[dom, 0], P[dom, 1], s=s * 0.6, color=tint(c, 0.55), lw=0, zorder=z - 2,
                       label=f"_dominated {name}")
        F = P[nd][np.argsort(P[nd, 0])]
        if fronts and len(F) > 1:
            where = "post" if minimize[0] != minimize[1] else "pre"
            ax.step(F[:, 0], F[:, 1], where=where, color=c, lw=LW_HL if name in hl else LW, zorder=z - 1,
                    label=f"_front {name}")
        sc = ax.scatter(F[:, 0], F[:, 1], s=s, color=c, lw=0.6, edgecolors="white", zorder=z, label=name)
        out[name] = sc
        end = F[-1] if not minimize[1] else F[0]
        items.append((name, end[0], end[1], c))
    if xlabel:
        ax.set_xlabel(xlabel)
    if ylabel:
        ax.set_ylabel(ylabel)
    if labels == "direct":
        items.sort(key=lambda t: names.index(t[0]))
        direct_labels(ax, items, weight_for=hl)
    elif labels == "legend":
        ax.legend(loc="best", scatterpoints=1)
    if better:
        corner = ("left" if minimize[0] else "right", "lower" if minimize[1] else "upper")
        better_arrow(ax, f"{corner[1]} {corner[0]}")
    return out


# ------------------------------------------------------------------ landscape
def landscape(ax, f, xlim, ylim, trajectories: Mapping[str, np.ndarray] | None = None, *, n=300,
              levels=14, log=True, cmap="landscape", lines=True, optimum=None, colors=None,
              highlight=None, markevery=None, arrows=2, legend="lower right", cbar=False,
              cbar_label=None, xlabel=r"$x_1$", ylabel=r"$x_2$", equal=True):
    """Filled contours of f(X, Y) with optimizer trajectories on top.

    f: vectorized callable f(X, Y) -> Z, or a tuple (X, Y, Z) of precomputed grids.
    trajectories: name -> (n_steps, 2) iterates.
    All output is vector (contourf polygons), no embedded raster.
    """
    if callable(f):
        xs, ys = np.linspace(*xlim, n), np.linspace(*ylim, n)
        X, Y = np.meshgrid(xs, ys)
        Z = f(X, Y)
    else:
        X, Y, Z = f
    Zp = np.log10(Z - np.nanmin(Z) + 1e-3 * (np.nanmax(Z) - np.nanmin(Z) + 1e-12)) if log else Z
    lv = np.linspace(np.nanmin(Zp), np.nanmax(Zp), levels + 1)
    cs = ax.contourf(X, Y, Zp, levels=lv, cmap=get_cmap(cmap), zorder=0, antialiased=True)
    cs.set_gid("landscape-fill")
    if lines:
        cl = ax.contour(X, Y, Zp, levels=lv[1:-1], colors="white", linewidths=0.35, alpha=0.9, zorder=1)
        cl.set_gid("landscape-lines")
    out = {"contour": cs}
    if trajectories:
        names = list(trajectories)
        hl = _hl_set(highlight)
        colors = _colors(names, colors, highlight)
        handles = []
        for name in _order_highlight_last(names, hl):
            P = np.asarray(trajectories[name], dtype=float)
            c = colors[name]
            z = 6 if name in hl else 5
            me = markevery or max(1, len(P) // 12)
            (ln,) = ax.plot(P[:, 0], P[:, 1], color=c, lw=LW_HL if name in hl else LW * 1.1, zorder=z,
                            marker="o", ms=1.8, markevery=me, mec="none", label=name)
            ax.plot([P[0, 0]], [P[0, 1]], marker="o", ms=3.6, mfc="white", mec=c, mew=0.9, zorder=z + 1,
                    label=f"_start {name}")
            ax.plot([P[-1, 0]], [P[-1, 1]], marker="o", ms=3.4, mfc=c, mec="white", mew=0.6, zorder=z + 1,
                    label=f"_end {name}")
            if arrows:
                seg = np.linalg.norm(np.diff(P, axis=0), axis=1)
                cum = np.concatenate([[0], np.cumsum(seg)])
                for frac in np.linspace(0, 1, arrows + 2)[1:-1]:
                    i = int(np.searchsorted(cum, frac * cum[-1]))
                    i = min(max(i, 1), len(P) - 1)
                    ax.annotate("", xy=P[i], xytext=P[i - 1], zorder=z,
                                arrowprops=dict(arrowstyle="-|>,head_length=0.45,head_width=0.22",
                                                color=c, lw=0, shrinkA=0, shrinkB=0, mutation_scale=7))
            out[name] = ln
            handles.append(ln)
        if legend:
            order = {n: i for i, n in enumerate(names)}
            handles.sort(key=lambda h: order[h.get_label()])
            if legend == "outside":
                lg = ax.legend(handles=handles, loc="upper left", bbox_to_anchor=(1.03, 1.0), borderaxespad=0,
                               handlelength=1.2)
            else:
                lg = ax.legend(handles=handles, loc=legend, frameon=True, framealpha=0.88, edgecolor="none",
                               facecolor="white", borderpad=0.35, handlelength=1.2)
            lg.set_gid("legend")
    if optimum is not None:
        ax.plot([optimum[0]], [optimum[1]], marker="*", ms=6.5, mfc=INK, mec="white", mew=0.5, zorder=9,
                label="_optimum")
    ax.set_xlim(*xlim)
    ax.set_ylim(*ylim)
    if equal:
        ax.set_aspect("equal", adjustable="box")
    _frame(ax, True)
    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)
    if cbar:
        cb = ax.figure.colorbar(cs, ax=ax, fraction=0.05, pad=0.03, aspect=22)
        cb.outline.set_visible(False)
        cb.ax.tick_params(width=0.5, length=2)
        _tidy_cbar(cb)
        if cbar_label:
            cb.set_label(cbar_label)
        out["cbar"] = cb
    return out


# ------------------------------------------------------------------ ablation
def ablation(ax, names: Sequence[str], values, err=None, *, ref: int = 0, higher_is_better=True,
             delta=True, fmt="{:+.1f}", xlabel="Score", color=None, ref_color=None, guide_rows=True):
    """Horizontal dot plot for ablations. names[ref] is the full model; deltas are vs. it.
    err: symmetric array (n,) or (2, n) for (lower, upper) distances."""
    v = np.asarray(values, dtype=float)
    n = len(names)
    y = np.arange(n)
    ref_color = ref_color or method_colors(["a"], "a")["a"]
    color = color or NEUTRALS["700"]
    cols = [ref_color if i == ref else color for i in range(n)]
    if err is not None:
        e = np.asarray(err, dtype=float)
        e = np.vstack([e, e]) if e.ndim == 1 else e
        for i in range(n):
            ax.plot([v[i] - e[0, i], v[i] + e[1, i]], [y[i], y[i]], color=cols[i], lw=0.9,
                    solid_capstyle="butt", zorder=3, label=f"_ci {names[i]}")
    ax.axvline(v[ref], color=tint(ref_color, 0.35), lw=0.6, ls=(0, (2, 2)), zorder=1)
    for i in range(n):
        ax.plot([v[i]], [y[i]], "o", ms=4.6 if i == ref else 3.8, mfc=cols[i], mec="white", mew=0.6,
                zorder=4, label=names[i])
    ax.set_yticks(y)
    ax.set_yticklabels(names)
    for i, t in enumerate(ax.get_yticklabels()):
        if i == ref:
            t.set_fontweight("bold")
    ax.set_ylim(n - 0.5, -0.5)
    ax.tick_params(axis="y", length=0)
    ax.spines["left"].set_visible(False)
    if guide_rows:
        for i in range(n):
            ax.axhline(i, color=NEUTRALS["100"], lw=0.5, zorder=0)
    ax.set_xlabel(xlabel)
    if delta:
        tr = mtransforms.blended_transform_factory(ax.transAxes, ax.transData)
        for i in range(n):
            s = "—" if i == ref else fmt.format(v[i] - v[ref]).replace("-", "−")
            ax.text(1.02, y[i], s, transform=tr, va="center", ha="left", fontsize=journal().small,
                    color=INK if i != ref else NEUTRALS["700"])
        ax.text(1.02, -0.5, "Δ", transform=tr, va="bottom", ha="left", fontsize=journal().small,
                color=NEUTRALS["700"])
    return ax


# ------------------------------------------------------------------ grouped bars
def grouped_bars(ax, categories: Sequence[str], values: Mapping[str, Sequence[float]], err=None, *,
                 colors=None, highlight=None, width=0.8, ylabel=None, value_labels=False, fmt="{:.1f}",
                 legend=True, ylim=None, baseline=0.0, allow_truncated=False, zero_line=True):
    """Benchmark bars: x = categories (datasets), one bar per method. values: method -> list."""
    methods = list(values)
    if baseline != 0 and not allow_truncated:
        raise ValueError("bars must start at 0 (bar length encodes the value). For small differences plot "
                         "the improvement over a baseline (values - baseline_method), or use ablation()/dist() "
                         "dot plots. Pass allow_truncated=True only if you really mean it.")
    colors = _colors(methods, colors, highlight)
    hl = _hl_set(highlight)
    k = len(methods)
    bw = width / k
    x = np.arange(len(categories))
    out = {}
    for i, m in enumerate(methods):
        v = np.asarray(values[m], dtype=float)
        xs = x - width / 2 + bw * (i + 0.5)
        bars = ax.bar(xs, v - baseline, bw * 0.92, bottom=baseline, color=colors[m], lw=0, label=m,
                      zorder=3)
        out[m] = bars
        if err is not None and m in err:
            ax.errorbar(xs, v, yerr=np.asarray(err[m]), fmt="none", ecolor=INK, elinewidth=0.5, zorder=4)
        if value_labels:
            e = np.asarray(err[m], dtype=float) if (err is not None and m in err) else np.zeros_like(v)
            e = e if e.ndim == 1 else e.max(axis=0)
            for xi, vi, ei in zip(xs, v, e):
                up = vi >= baseline
                s_ = fmt.format(vi).replace("-", "\u2212")
                if s_.lstrip("+\u2212").strip("0.") == "":       # avoid '-0.0'
                    s_ = fmt.format(0.0).replace("+", "")
                ax.annotate(s_, (xi, vi + ei if up else vi - ei), xytext=(0, 1.5 if up else -1.5),
                            textcoords="offset points", ha="center", va="bottom" if up else "top",
                            fontsize=max(journal().min_font, journal().small - 1), color=INK,
                            fontweight="bold" if m in hl else "normal")
    ax.set_xticks(x)
    ax.set_xticklabels(categories)
    ax.tick_params(axis="x", length=0)
    if zero_line and min(np.min(values[m]) for m in methods) < 0:
        ax.axhline(0, color=INK, lw=0.6, zorder=4)
        ax.spines["bottom"].set_visible(False)
    if ylabel:
        ax.set_ylabel(ylabel)
    if ylim:
        ax.set_ylim(*ylim)
    ax.yaxis.grid(True)
    if legend:
        lg = ax.legend(loc="lower left", bbox_to_anchor=(0, 1.0), ncol=min(k, 4), handlelength=0.9,
                       handleheight=0.9, columnspacing=1.0, borderaxespad=0.2)
        lg.set_gid("legend")
    return out


# ------------------------------------------------------------------ heatmap
def heatmap(ax, M, xlabels=None, ylabels=None, *, cmap="seq", center=None, vmin=None, vmax=None,
            annotate=True, fmt="{:.2f}", best: str | None = None, cbar=True, cbar_label=None,
            xlabel=None, ylabel=None, square=True, gridlines=True, fontsize=None):
    """Vector heatmap (pcolormesh with white cell borders).
    center: value for a diverging map (uses cmap='div' unless given).
    best: 'max' | 'min' outlines the best cell."""
    M = np.asarray(M, dtype=float)
    if center is not None and cmap == "seq":
        cmap = "div"
    cm = get_cmap(cmap) if isinstance(cmap, str) else cmap
    if center is not None:
        span = np.nanmax(np.abs(M - center))
        vmin, vmax = center - span, center + span
    mesh = ax.pcolormesh(np.arange(M.shape[1] + 1), np.arange(M.shape[0] + 1), M, cmap=cm, vmin=vmin,
                         vmax=vmax, edgecolors="white" if gridlines else "face",
                         linewidth=0.6 if gridlines else 0, shading="flat")
    mesh.set_gid("heatmap-cells")
    ax.set_xlim(0, M.shape[1])
    ax.set_ylim(M.shape[0], 0)
    if square:
        ax.set_aspect("equal")
    ax.set_xticks(np.arange(M.shape[1]) + 0.5)
    ax.set_yticks(np.arange(M.shape[0]) + 0.5)
    ax.set_xticklabels(xlabels if xlabels is not None else range(M.shape[1]))
    ax.set_yticklabels(ylabels if ylabels is not None else range(M.shape[0]))
    ax.tick_params(length=0)
    _frame(ax, False)
    if annotate:
        fs = fontsize or max(journal().min_font, journal().small - 0.5)
        norm = mesh.norm
        for i in range(M.shape[0]):
            for j in range(M.shape[1]):
                if np.isfinite(M[i, j]):
                    bg = rgb_to_hex(cm(norm(M[i, j]))[:3])
                    ax.text(j + 0.5, i + 0.5, fmt.format(M[i, j]), ha="center", va="center", fontsize=fs,
                            color=text_color_for(bg))
    if best:
        idx = np.nanargmax(M) if best == "max" else np.nanargmin(M)
        i, j = np.unravel_index(idx, M.shape)
        r = Rectangle((j + 0.04, i + 0.04), 0.92, 0.92, fill=False, lw=1.1, ec=INK, zorder=5)
        r.set_gid("best-cell")
        ax.add_patch(r)
    if xlabel:
        ax.set_xlabel(xlabel)
    if ylabel:
        ax.set_ylabel(ylabel)
    out = {"mesh": mesh}
    if cbar:
        cb = ax.figure.colorbar(mesh, ax=ax, fraction=0.046, pad=0.03, aspect=18)
        cb.outline.set_visible(False)
        cb.ax.tick_params(width=0.5, length=2)
        _tidy_cbar(cb)
        if cbar_label:
            cb.set_label(cbar_label)
        out["cbar"] = cb
    return out


# ------------------------------------------------------------------ critical difference
_Q05 = [1.960, 2.343, 2.569, 2.728, 2.850, 2.949, 3.031, 3.102, 3.164, 3.219, 3.268, 3.313, 3.354, 3.391,
        3.426, 3.458, 3.489, 3.517, 3.544]
_Q10 = [1.645, 2.052, 2.291, 2.459, 2.589, 2.693, 2.780, 2.855, 2.920, 2.978, 3.030, 3.077, 3.120, 3.159,
        3.196, 3.230, 3.261, 3.291, 3.319]


def critical_difference(k: int, n_datasets: int, alpha=0.05) -> float:
    q = (_Q05 if alpha == 0.05 else _Q10)[k - 2]
    return q * np.sqrt(k * (k + 1) / (6.0 * n_datasets))


def average_ranks(scores, higher_is_better=True):
    """scores: (n_datasets, n_methods) -> average rank per method (1 = best), ties averaged."""
    from scipy.stats import rankdata
    S = np.asarray(scores, dtype=float)
    R = np.vstack([rankdata(-row if higher_is_better else row) for row in S])
    return R.mean(axis=0)


def cd_diagram(ax, ranks: Mapping[str, float], n_datasets: int, *, alpha=0.05, highlight=None,
               colors=None, show_values=True, valign="top"):
    """Critical-difference diagram (Demsar 2006). ranks: name -> average rank (1 = best).

    Geometry is in points (x = rank in data units, y = pt offsets), so spacing stays
    typographically correct whatever size the axes ends up; the content is centered
    vertically in the axes (valign='center') or pinned to its top (valign='top').
    Needs roughly 14 + 3.5*ceil(k/2) mm of height."""
    items = sorted(ranks.items(), key=lambda t: t[1])
    names = [n for n, _ in items]
    r = np.array([v for _, v in items])
    k = len(r)
    cd = critical_difference(k, n_datasets, alpha)
    hl = _hl_set(highlight)
    lo, hi = 1, max(k, int(np.ceil(r.max())))
    fig = ax.figure
    fs = journal().small
    ax.set_axis_off()
    ax.set_xlim(lo, hi)
    ax.set_ylim(0, 1)

    # cliques: maximal runs whose rank span < CD
    cliques = []
    for i in range(k):
        j = i
        while j + 1 < k and r[j + 1] - r[i] < cd:
            j += 1
        if j > i:
            cliques.append((i, j))
    cliques = [c for c in cliques if not any(o != c and o[0] <= c[0] and c[1] <= o[1] for o in cliques)]

    # vertical layout in pt, measured downward from the content top (y <= 0)
    y_cdtext = 0.0
    y_cdbar = -(fs * 1.25 + 2.5)
    y_axis = y_cdbar - (fs * 1.25 + 7.0)
    y_cl0 = y_axis - 3.5
    cl_step = 2.6
    row_h = fs * 1.65
    y_row0 = y_cl0 - cl_step * max(len(cliques), 1) - 2.0
    nleft = int(np.ceil(k / 2))
    depth = max(nleft, k - nleft)
    H = -(y_row0 - (depth - 1) * row_h) + fs * 0.7    # total content height (pt)
    if valign == "center":
        anchor = mtransforms.ScaledTranslation(0, 0.5, ax.transAxes)
        shift = H / 2
    else:
        anchor = mtransforms.ScaledTranslation(0, 1.0, ax.transAxes)
        shift = 0.0
    ytr = mtransforms.Affine2D().translate(0, shift).scale(1, 1 / 72.0) + fig.dpi_scale_trans + anchor
    T = mtransforms.blended_transform_factory(ax.transData, ytr)

    def off(dx_pt):
        return T + mtransforms.ScaledTranslation(dx_pt / 72.0, 0, fig.dpi_scale_trans)

    kw = dict(transform=T, clip_on=False, solid_capstyle="butt")
    # axis + ticks
    ax.plot([lo, hi], [y_axis, y_axis], color=INK, lw=0.6, **kw)
    for t in range(lo, hi + 1):
        ax.plot([t, t], [y_axis, y_axis + 2.5], color=INK, lw=0.6, **kw)
        ax.text(t, y_axis + 3.5, str(t), ha="center", va="bottom", fontsize=fs, transform=T)
    for t in np.arange(lo + 0.5, hi, 1.0):
        ax.plot([t, t], [y_axis, y_axis + 1.4], color=INK, lw=0.4, **kw)
    # CD bar
    ax.plot([lo, lo + cd], [y_cdbar, y_cdbar], color=INK, lw=0.8, **kw)
    for xx in (lo, lo + cd):
        ax.plot([xx, xx], [y_cdbar - 1.8, y_cdbar + 1.8], color=INK, lw=0.6, **kw)
    ax.text(lo + cd / 2, y_cdbar + 2.5, f"CD = {cd:.2f}", ha="center", va="bottom", fontsize=fs, transform=T)

    def lab(n, v):
        return f"{n} ({v:.2f})" if show_values else n

    def col(n):
        if colors and n in colors:
            return colors[n]
        return method_colors([n], n)[n] if n in hl else INK

    for i in range(nleft):                       # best methods on the left, shallowest first
        y = y_row0 - i * row_h
        n = names[i]
        ax.plot([r[i], r[i], lo], [y_axis, y, y], color=col(n), lw=0.9 if n in hl else 0.6,
                solid_joinstyle="miter", label=f"_cd {n}", **{k_: v for k_, v in kw.items()})
        ax.text(lo, y, lab(n, r[i]), ha="right", va="center", fontsize=fs, transform=off(-3),
                fontweight="bold" if n in hl else "normal")
    for jj, i in enumerate(range(k - 1, nleft - 1, -1)):
        y = y_row0 - jj * row_h
        n = names[i]
        ax.plot([r[i], r[i], hi], [y_axis, y, y], color=col(n), lw=0.9 if n in hl else 0.6,
                solid_joinstyle="miter", label=f"_cd {n}", **kw)
        ax.text(hi, y, lab(n, r[i]), ha="left", va="center", fontsize=fs, transform=off(3),
                fontweight="bold" if n in hl else "normal")
    for ci, (i, j) in enumerate(cliques):
        y = y_cl0 - ci * cl_step
        ax.plot([r[i] - 0.03, r[j] + 0.03], [y, y], color=INK, lw=1.6, zorder=5,
                transform=T, clip_on=False, solid_capstyle="round", label="_clique")
    return {"cd": cd, "cliques": [[names[i] for i in range(a, b + 1)] for a, b in cliques],
            "height_pt": H}


# ------------------------------------------------------------------ tradeoff
def tradeoff(ax, items: Mapping[str, Sequence[float]], *, colors=None, highlight=None, logx=True,
             size_range=(12, 120), labels=True, better="upper left", xlabel=None, ylabel=None,
             label_offsets=None, size_key=None, size_key_loc="lower right"):
    """Accuracy-vs-cost bubble scatter. items: name -> (x, y) or (x, y, size)."""
    names = list(items)
    hl = _hl_set(highlight)
    colors = _colors(names, colors, highlight)
    sizes = np.array([items[n][2] if len(items[n]) > 2 else 1.0 for n in names], dtype=float)
    if np.ptp(sizes) > 0:
        s = size_range[0] + (sizes - sizes.min()) / np.ptp(sizes) * (size_range[1] - size_range[0])
    else:
        s = np.full(len(names), np.mean(size_range) * 0.5)
    label_offsets = label_offsets or {}
    out = {}
    for i, n in enumerate(names):
        x, y = items[n][0], items[n][1]
        sc = ax.scatter([x], [y], s=s[i], color=colors[n], alpha=0.9 if n in hl else 0.75,
                        edgecolors="white", lw=0.6, zorder=5 if n in hl else 4, label=n)
        out[n] = sc
        if labels:
            dx, dy = label_offsets.get(n, (np.sqrt(s[i]) / 2 + 2, 0))
            ax.annotate(n, (x, y), xytext=(dx, dy), textcoords="offset points", va="center",
                        ha="left" if dx >= 0 else "right", fontsize=journal().small,
                        color=readable(colors[n]), fontweight="bold" if n in hl else "normal")
    if size_key and np.ptp(sizes) > 0:
        # legend explaining bubble area, e.g. size_key="Memory (GB)"
        vals = np.unique(np.round(np.quantile(sizes, [0, 0.5, 1.0]), 2))
        hs = [ax.scatter([], [], s=size_range[0] + (v - sizes.min()) / np.ptp(sizes) * (size_range[1] - size_range[0]),
                         color=NEUTRALS["400"], lw=0) for v in vals]
        lg = ax.legend(hs, [f"{v:g}" for v in vals], title=size_key, loc=size_key_loc, ncol=len(vals),
                       handletextpad=0.9, columnspacing=1.4, handlelength=1.8, borderpad=0.4, labelspacing=0.8)
        lg.set_gid("size-key")
    if logx:
        ax.set_xscale("log")
    if xlabel:
        ax.set_xlabel(xlabel)
    if ylabel:
        ax.set_ylabel(ylabel)
    if better:
        better_arrow(ax, better)
    return out


# ------------------------------------------------------------------ distributions
def dist(ax, data: Mapping[str, Sequence[float]], *, colors=None, highlight=None, jitter=0.13,
         point_size=5.0, box=True, ylabel=None, seed=0, rotate=0):
    """Box (median, IQR, 1.5 IQR whiskers) + jittered raw points, e.g. final score per seed."""
    names = list(data)
    colors = _colors(names, colors, highlight)
    hl = _hl_set(highlight)
    rng = np.random.default_rng(seed)
    for i, n in enumerate(names):
        v = np.asarray(data[n], dtype=float)
        c = colors[n]
        if box:
            bp = ax.boxplot([v], positions=[i], widths=0.5, showfliers=False, patch_artist=True,
                            medianprops=dict(color=c, lw=1.4 if n in hl else 1.1),
                            boxprops=dict(facecolor=tint(c, 0.85), edgecolor=c, lw=0.6),
                            whiskerprops=dict(color=c, lw=0.6), capprops=dict(lw=0), zorder=2)
        xj = i + rng.uniform(-jitter, jitter, size=len(v))
        ax.scatter(xj, v, s=point_size, color=c, alpha=0.75, lw=0, zorder=3, label=n)
    ax.set_xticks(range(len(names)))
    ax.set_xticklabels(names, rotation=rotate, ha="right" if rotate else "center")
    for t, n in zip(ax.get_xticklabels(), names):
        if n in hl:
            t.set_fontweight("bold")
    ax.tick_params(axis="x", length=0)
    ax.set_xlim(-0.6, len(names) - 0.4)
    if ylabel:
        ax.set_ylabel(ylabel)
    return ax


# ------------------------------------------------------------------ cues & insets
def better_arrow(ax, direction="upper left", text="Better", size=None):
    """Small arrow + word in a corner pointing toward the better region."""
    v, h = direction.split()
    fs = size or journal().small
    x = 0.05 if h == "left" else 0.95
    y = 0.93 if v == "upper" else 0.07
    dx = -0.07 if h == "left" else 0.07
    dy = 0.07 if v == "upper" else -0.07
    x0, y0 = x - dx, y - dy
    ax.annotate("", xy=(x, y), xytext=(x0, y0), xycoords="axes fraction",
                arrowprops=dict(arrowstyle="-|>,head_length=0.35,head_width=0.18", color=NEUTRALS["600"],
                                lw=0.7, shrinkA=0, shrinkB=0, mutation_scale=8))
    t = ax.text(x0 + (0.012 if h == "left" else -0.012), y0, text, transform=ax.transAxes, fontsize=fs,
                color=NEUTRALS["700"], ha="left" if h == "left" else "right",
                va="top" if v == "upper" else "bottom", style="italic")
    t.set_gid("better-cue")
    return t


def inset_zoom(ax, xlim, ylim, bounds=(0.55, 0.5, 0.42, 0.42), connectors=True):
    """Create a zoom inset; re-plot into the returned axes. bounds in axes fraction (x, y, w, h)."""
    axins = ax.inset_axes(bounds)
    axins.set_xlim(*xlim)
    axins.set_ylim(*ylim)
    axins.tick_params(labelsize=journal().small, length=1.5, pad=1)  # smaller would push 10^x exponents < 5 pt
    _frame(axins, True, 0.5)
    for axis, scale in ((axins.xaxis, ax.get_xscale()), (axins.yaxis, ax.get_yscale())):
        if scale == "log":
            (axins.set_xscale if axis is axins.xaxis else axins.set_yscale)("log")
            axis.set_minor_formatter(NullFormatter())       # no '6x10^-1' clutter in a small inset
    axins.set_xlim(*xlim)
    axins.set_ylim(*ylim)
    axins.set_facecolor("white")
    axins.set_gid("inset")
    if connectors:
        r = ax.indicate_inset_zoom(axins, edgecolor=NEUTRALS["500"], lw=0.5, alpha=1.0)
    return axins
