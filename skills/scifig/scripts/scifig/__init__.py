"""scifig — publication-grade vector figures for algorithm & optimization papers (Python + Typst).

    import sys; sys.path.insert(0, "<skill>/scripts")
    import scifig as sf
    sf.use("nature")
    fig, ax = sf.subplots(width="single", height=55)
    colors = sf.method_colors(["Adam", "SGD", "Ours"], highlight="Ours")
    sf.convergence(ax, runs, colors=colors, highlight="Ours")
    sf.save(fig, "figures/fig2")          # -> fig2.svg / .pdf / .png + lint report

Schematics are Typst (scripts/scifig.typ); build them with sf.compile_typst("fig1.typ") or, for a
layout kept inside a Python script, sf.typst_figure(SOURCE, "figures/fig1", files={...}).
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
from .typstbuild import compile_typst, typst_figure, library_source
from .pdflint import lint_pdf

__version__ = "2.0.0"
