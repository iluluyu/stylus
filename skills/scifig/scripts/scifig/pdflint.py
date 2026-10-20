"""Lint a finished PDF figure (from Typst, matplotlib, or anything else) at print size.

Checks what a journal production editor checks, on the actual output:
page width vs. column widths, height, font sizes (sub/superscripts included), fonts, text running
off the page, text overlapping text, lines running through text, outlined text, rasters, contrast,
number of hue families. Needs `pdfplumber` (pure Python: `pip install pdfplumber`).
"""
from __future__ import annotations

import math
import unicodedata

from .color import contrast_ratio, hex_to_rgb, rgb_to_hex, rgb_to_lab
from .style import JOURNALS

PT_PER_MM = 72 / 25.4
# fonts that are fine besides Arial/Helvetica: math fonts used for symbols (∇, ←, ℝ, 𝒟) in Typst
_ARIAL_LIKE = ("arial", "helvetica", "liberationsans", "liberation sans", "arimo", "texgyreheros",
               "tex gyre heros", "nimbussans", "nimbus sans", "helveticaneue")
_MATH_FONTS = ("newcmmath", "newcomputermodernmath", "latinmodernmath", "lmmath", "dejavumath",
               "stixtwomath", "firamath", "notosansmath", "cmsy", "cmmi", "cmex", "dejavusans")


def _color_hex(c):
    """pdfplumber colors: None, gray float, (g,), (r,g,b) or (c,m,y,k) -> '#RRGGBB' or None."""
    if c is None:
        return None
    if isinstance(c, (int, float)):
        c = (c,)
    c = tuple(float(v) for v in c if isinstance(v, (int, float)))
    if len(c) == 1:
        c = (c[0],) * 3
    elif len(c) == 4:
        k = c[3]
        c = tuple((1 - v) * (1 - k) for v in c[:3])
    elif len(c) != 3:
        return None
    return rgb_to_hex(c)


def _family(fontname: str) -> str:
    name = fontname.split("+", 1)[-1]
    for suffix in ("-BoldItalic", "-BoldOblique", "-Bold", "-Italic", "-Oblique", "-Regular", "-Book", "MT",
                   ",Bold", ",Italic", ",BoldItalic"):
        name = name.replace(suffix, "")
    return name


def _is_math_font(fam: str) -> bool:
    f = fam.lower().replace(" ", "").replace("-", "")
    return any(m.replace(" ", "") in f for m in _MATH_FONTS)


def _is_arial_like(fam: str) -> bool:
    f = fam.lower().replace("-", "")
    return any(a in f or a.replace(" ", "") in f.replace(" ", "") for a in _ARIAL_LIKE)


def _segments(obj):
    """Polyline approximation (control polygon) of a pdfplumber line/curve/rect, in top-down coords."""
    if obj["object_type"] == "rect":
        x0, x1, t, b = obj["x0"], obj["x1"], obj["top"], obj["bottom"]
        pts = [(x0, t), (x1, t), (x1, b), (x0, b), (x0, t)]
    else:
        pts = [tuple(p) for p in obj.get("pts", [])]
    return list(zip(pts[:-1], pts[1:]))


def _seg_hits(p, q, r):
    x0, y0, x1, y1 = r
    dx, dy = q[0] - p[0], q[1] - p[1]
    t0, t1 = 0.0, 1.0
    for pp, qq in ((-dx, p[0] - x0), (dx, x1 - p[0]), (-dy, p[1] - y0), (dy, y1 - p[1])):
        if abs(pp) < 1e-12:
            if qq < 0:
                return False
        else:
            rr = qq / pp
            if pp < 0:
                t0 = max(t0, rr)
            else:
                t1 = min(t1, rr)
            if t0 > t1:
                return False
    return True


def _count_hues(hexes, tol_deg=22.0, min_chroma=14.0) -> int:
    hues = []
    for h in hexes:
        L, a, b = rgb_to_lab(hex_to_rgb(h))
        if math.hypot(a, b) >= min_chroma:
            hues.append(math.degrees(math.atan2(b, a)) % 360)
    fam = []
    for h in sorted(hues):
        if not any(min(abs(h - f), 360 - abs(h - f)) < tol_deg for f in fam):
            fam.append(h)
    return len(fam)


def lint_pdf(path: str, journal: str = "nature", page: int = 0):
    """Returns (issues, stats). issues: list of (level, code, message)."""
    try:
        import pdfplumber
    except ImportError:  # pragma: no cover
        return [("INFO", "pdf-lint", "install pdfplumber (`pip install pdfplumber`) to lint PDF output")], {}
    j = JOURNALS[journal]
    issues = []
    add = lambda lvl, code, msg: issues.append((lvl, code, msg))  # noqa: E731
    with pdfplumber.open(path) as pdf:
        if len(pdf.pages) > 1:
            add("INFO", "pages", f"{len(pdf.pages)} pages; checking page {page + 1} (one figure per page)")
        p = pdf.pages[page]
        W, H = float(p.width), float(p.height)
        chars = [c for c in p.chars if c["text"].strip()]
        drawn = list(p.lines) + list(p.curves) + list(p.rects)
        imgs = [(float(i["width"]), float(i["height"])) for i in p.images]
    strips = [wh for wh in imgs if max(wh) > 8 * max(min(wh), 1e-6)]     # colorbar gradients
    n_img = len(imgs) - len(strips)

    wmm, hmm = W / PT_PER_MM, H / PT_PER_MM
    widths = sorted(set(j.widths.values()))
    if not any(abs(wmm - w) <= 1.0 for w in widths):
        add("WARN", "width", f"{wmm:.1f} mm wide; {j.name} widths are {widths} mm")
    if hmm > j.max_height + 0.5:
        add("WARN", "height", f"{hmm:.1f} mm tall (> {j.max_height} mm)")
    if not chars and len(drawn) > 50:
        add("ERROR", "outlined-text", "no text in the PDF: text was converted to outlines and is not editable")
    if n_img:
        add("WARN", "raster", f"{n_img} embedded raster image(s); fine for photos, not for plots or diagrams")
    if strips:
        add("INFO", "raster", f"{len(strips)} thin raster strip(s) (colorbar gradient) — fine")

    # ---- fonts and sizes (reported per run of same size/font, not per glyph)
    fams, small, large, low_contrast = {}, {}, {}, {}
    marks = set()
    boxes = []
    clipped = []
    for c in chars:
        ch = c["text"]
        if all(unicodedata.category(x) in ("Mn", "Me", "Lm", "Sk") for x in ch):
            marks.add(id(c))
            continue
        fam = _family(c["fontname"])
        fams[fam] = fams.get(fam, 0) + 1
        m = c.get("matrix") or (1, 0, 0, 1, 0, 0)
        angle = math.degrees(math.atan2(m[1], m[0])) % 90
        if min(angle, 90 - angle) > 2:            # slanted text (labels along a guide line):
            continue                              # its axis-aligned box says nothing about size/overlap
        vertical = abs(m[1]) > abs(m[0])          # rotated 90 deg (e.g. a y-axis label)
        # pdfminer reports the advance as  for rotated glyphs; the em box is across the baseline
        size = float(c["x1"] - c["x0"]) if vertical else float(c["size"])
        c["_size"] = size
        bold = "bold" in c["fontname"].lower()
        if size < j.min_font - 0.05:
            small.setdefault(round(size, 1), []).append(ch)
        elif size > j.max_font + 0.05 and not (bold and size <= j.label + 0.05):
            large.setdefault(round(size, 1), []).append(ch)
        col = _color_hex(c.get("non_stroking_color"))
        if col and col.upper() not in ("#FFFFFF",):
            try:
                cr = contrast_ratio(col)
                if cr < 4.5:
                    low_contrast.setdefault(col, []).append(ch)
            except Exception:  # noqa: BLE001
                pass
        if c["x0"] < -0.5 or c["x1"] > W + 0.5 or c["top"] < -0.5 or c["bottom"] > H + 0.5:
            clipped.append(ch)
        # glyph box: central band of the em box, so stacked lines and scripts don't count as overlap
        h = c["bottom"] - c["top"]
        w = c["x1"] - c["x0"]
        if vertical:
            box = (c["x0"] + 0.2 * w, c["top"] + 0.25, c["x1"] - 0.2 * w, c["bottom"] - 0.25)
        else:
            box = (c["x0"] + 0.25, c["top"] + 0.18 * h, c["x1"] - 0.25, c["bottom"] - 0.22 * h)
        boxes.append(box + (ch, _color_hex(c.get("non_stroking_color"))))
    if clipped:
        add("ERROR", "clipped", f"{len(clipped)} glyph(s) run off the page, e.g. '{''.join(clipped[:16])}' — "
                                "content is wider/taller than the figure")
    for size, txt in sorted(small.items()):
        add("ERROR", "font-min", f"{len(txt)} glyph(s) at {size} pt (< {j.min_font} pt), e.g. '{''.join(txt[:12])}'")
    for size, txt in sorted(large.items()):
        add("WARN", "font-max", f"{len(txt)} glyph(s) at {size} pt (> {j.max_font} pt), e.g. '{''.join(txt[:12])}'")
    for col, txt in low_contrast.items():
        add("WARN", "contrast", f"text in {col} (contrast {contrast_ratio(col):.1f} < 4.5), e.g. '{''.join(txt[:12])}'")
    for fam, n in fams.items():
        if not _is_arial_like(fam) and not _is_math_font(fam):
            add("INFO" if n <= 3 else "WARN", "font", f"{n} glyph(s) in '{fam}' (journals expect Arial/Helvetica)")

    # ---- text on text
    hits = 0
    examples = []
    order = sorted(range(len(boxes)), key=lambda i: boxes[i][0])
    for a_i, a in enumerate(order):
        A = boxes[a]
        for b in order[a_i + 1:]:
            B = boxes[b]
            if B[0] >= A[2]:
                break
            ix = min(A[2], B[2]) - max(A[0], B[0])
            iy = min(A[3], B[3]) - max(A[1], B[1])
            if ix > 0 and iy > 0:
                area = min((A[2] - A[0]) * (A[3] - A[1]), (B[2] - B[0]) * (B[3] - B[1]))
                if area > 0 and ix * iy > 0.25 * area:
                    hits += 1
                    if len(examples) < 3:
                        examples.append(f"'{A[4]}'/'{B[4]}'")
    if hits:
        add("ERROR", "text-overlap", f"{hits} overlapping glyph pair(s), e.g. {', '.join(examples)}")

    # ---- lines through text (white strokes = cell separators, ignored)
    crossed = []
    for obj in drawn:
        if not obj.get("stroke", obj["object_type"] == "line"):
            continue
        sc = _color_hex(obj.get("stroking_color"))
        if sc is None or contrast_ratio(sc) < 1.5:   # white separators, faint grid lines
            continue
        for p0, p1 in _segments(obj):
            if math.dist(p0, p1) < 0.8:
                continue
            for bx in boxes:
                if bx[5] and bx[5].upper() == "#FFFFFF":     # white text sits on a filled badge by design
                    continue
                r = (bx[0] + 0.4, bx[1] + 0.3, bx[2] - 0.4, bx[3] - 0.3)
                if r[2] > r[0] and r[3] > r[1] and _seg_hits(p0, p1, r):
                    crossed.append(bx[4])
                    break
    if crossed:
        add("WARN", "line-through-text", f"{len(crossed)} line segment(s) cross text, e.g. "
                                         f"'{''.join(crossed[:12])}' — move the label or reroute the line")

    # ---- colors
    cols = set()
    for obj in drawn:
        for k in ("stroking_color", "non_stroking_color"):
            if obj.get("stroke" if k == "stroking_color" else "fill"):
                h = _color_hex(obj.get(k))
                if h:
                    cols.add(h)
    n_hues = _count_hues(cols)
    if n_hues > 7:
        add("WARN", "too-many-hues", f"{n_hues} hue families; aim for <= 6")
    sizes = [c["_size"] for c in chars if "_size" in c]
    stats = {"size_mm": (round(wmm, 1), round(hmm, 1)), "texts": len(chars),
             "font_pt": (round(min(sizes), 2), round(max(sizes), 2)) if sizes else None,
             "fonts": fams, "hue_families": n_hues, "shapes": len(drawn)}
    return issues, stats
