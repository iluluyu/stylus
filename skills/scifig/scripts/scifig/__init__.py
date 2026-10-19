"""scifig — publication-grade, editable-SVG figures for algorithm & optimization papers.

    import sys; sys.path.insert(0, "<skill>/scripts")
    import scifig as sf
    sf.use("nature")
    fig, ax = sf.subplots(width="single", height=55)
    colors = sf.method_colors(["Adam", "SGD", "Ours"], highlight="Ours")
    sf.convergence(ax, runs, colors=colors, highlight="Ours")
    sf.save(fig, "figures/fig2")          # -> fig2.svg / .pdf / .png + lint report
"""
from .style import (use, journal, JOURNALS, figsize, subplots, mosaic, panel_labels, MM, width_mm,
                    available_sans, export_mplstyle)
from .palette import (PALETTES, ACCENT, INK, NEUTRALS, palette, method_colors, cmap, tint, shade, mix,
                      readable, palette_report, text_color_for)
from .plots import (convergence, rate_guide, slope_triangle, performance_profile, pareto, landscape,
                    ablation, grouped_bars, heatmap, cd_diagram, critical_difference, average_ranks,
                    tradeoff, dist, direct_labels, better_arrow, inset_zoom, tidy_log)
from .export import save, assign_ids, unclip
from .lint import lint_figure, report

__version__ = "1.0.0"
