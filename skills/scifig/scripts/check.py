#!/usr/bin/env python3
"""Render and audit any SVG figure (from scifig, sfd.mjs, or hand-made).

    python check.py fig.svg                 # -> fig.png preview + lint report
    python check.py fig.svg --pdf           # also fig.pdf (vector, fonts embedded)
    python check.py fig.svg --cvd           # also fig.cvd.png: normal | deutan | protan | grayscale
    python check.py fig.svg --journal neurips --dpi 400

Rendering backends, first that works: rsvg-convert CLI, cairosvg, librsvg via ctypes,
inkscape CLI, playwright/chromium, ImageMagick. Install hints are printed if none works.
Exit code 1 if lint finds ERRORs (useful in a loop: fix until exit 0).
"""
from __future__ import annotations

import argparse
import ctypes
import ctypes.util
import math
import os
import re
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scifig.svgtools import SVG_NS, svg_size_pt, parse_transform, length_pt  # noqa: E402
from scifig.color import contrast_ratio, hex_to_rgb, rgb_to_lab, simulate_cvd  # noqa: E402

JOURNAL_WIDTHS = {
    "nature": ([89, 120, 136, 183], 170, 5, 7), "science": ([55, 120, 175], 220, 5, 8),
    "cell": ([85, 114, 174], 225, 5, 8), "pnas": ([87, 114, 178], 225, 5, 8),
    "ieee": ([88.9, 181], 230, 6, 9), "neurips": ([139.7, 67], 200, 6, 9),
    "icml": ([82.6, 171.5], 220, 6, 9), "cvpr": ([82.6, 174.6], 220, 6, 9),
}
ARIAL_LIKE = {"arial", "helvetica", "liberation sans", "arimo", "helvetica neue", "tex gyre heros",
              "nimbus sans", "sans-serif"}


# ------------------------------------------------------------------ rendering
def _lib(*names):
    for n in names:
        if not n:
            continue
        try:
            return ctypes.CDLL(n)
        except OSError:
            continue
    return None


def _render_librsvg(svg, png=None, pdf=None, dpi=300):
    rsvg = _lib("librsvg-2.so.2", "librsvg-2.2.dylib", "/opt/homebrew/lib/librsvg-2.2.dylib",
                "/usr/local/lib/librsvg-2.2.dylib", "librsvg-2-2.dll", ctypes.util.find_library("rsvg-2"))
    cairo = _lib("libcairo.so.2", "libcairo.2.dylib", "/opt/homebrew/lib/libcairo.2.dylib",
                 "/usr/local/lib/libcairo.2.dylib", "libcairo-2.dll", ctypes.util.find_library("cairo"))
    if not rsvg or not cairo:
        raise RuntimeError("librsvg/cairo shared libraries not found")

    class GError(ctypes.Structure):
        _fields_ = [("domain", ctypes.c_uint32), ("code", ctypes.c_int), ("message", ctypes.c_char_p)]

    class Rect(ctypes.Structure):
        _fields_ = [("x", ctypes.c_double), ("y", ctypes.c_double), ("width", ctypes.c_double),
                    ("height", ctypes.c_double)]

    vp_, d_ = ctypes.c_void_p, ctypes.c_double
    rsvg.rsvg_handle_new_from_file.restype = vp_
    rsvg.rsvg_handle_new_from_file.argtypes = [ctypes.c_char_p, ctypes.POINTER(ctypes.POINTER(GError))]
    rsvg.rsvg_handle_set_dpi.argtypes = [vp_, d_]
    rsvg.rsvg_handle_get_intrinsic_size_in_pixels.argtypes = [vp_, ctypes.POINTER(d_), ctypes.POINTER(d_)]
    rsvg.rsvg_handle_get_intrinsic_size_in_pixels.restype = ctypes.c_int
    rsvg.rsvg_handle_render_document.argtypes = [vp_, vp_, ctypes.POINTER(Rect), ctypes.POINTER(ctypes.POINTER(GError))]
    rsvg.rsvg_handle_render_document.restype = ctypes.c_int
    for fn, res, args in [("cairo_image_surface_create", vp_, [ctypes.c_int, ctypes.c_int, ctypes.c_int]),
                          ("cairo_pdf_surface_create", vp_, [ctypes.c_char_p, d_, d_]),
                          ("cairo_create", vp_, [vp_]), ("cairo_set_source_rgb", None, [vp_, d_, d_, d_]),
                          ("cairo_paint", None, [vp_]), ("cairo_surface_write_to_png", ctypes.c_int, [vp_, ctypes.c_char_p]),
                          ("cairo_destroy", None, [vp_]), ("cairo_surface_finish", None, [vp_]),
                          ("cairo_surface_destroy", None, [vp_])]:
        f = getattr(cairo, fn)
        f.restype, f.argtypes = res, args
    err = ctypes.POINTER(GError)()
    h = rsvg.rsvg_handle_new_from_file(os.path.abspath(svg).encode(), ctypes.byref(err))
    if not h:
        raise RuntimeError(f"librsvg could not parse: {err.contents.message.decode() if err else '?'}")
    rsvg.rsvg_handle_set_dpi(h, 72.0)
    w, hh = d_(), d_()
    if not rsvg.rsvg_handle_get_intrinsic_size_in_pixels(h, ctypes.byref(w), ctypes.byref(hh)):
        raise RuntimeError("SVG has no intrinsic size (set width/height)")
    if png:
        s = dpi / 72.0
        W, H = int(math.ceil(w.value * s)), int(math.ceil(hh.value * s))
        surf = cairo.cairo_image_surface_create(0, W, H)
        cr = cairo.cairo_create(surf)
        cairo.cairo_set_source_rgb(cr, 1.0, 1.0, 1.0)
        cairo.cairo_paint(cr)
        rect = Rect(0, 0, W, H)
        rsvg.rsvg_handle_render_document(h, cr, ctypes.byref(rect), ctypes.byref(err))
        cairo.cairo_surface_write_to_png(surf, os.path.abspath(png).encode())
        cairo.cairo_destroy(cr)
        cairo.cairo_surface_destroy(surf)
    if pdf:
        surf = cairo.cairo_pdf_surface_create(os.path.abspath(pdf).encode(), w.value, hh.value)
        cr = cairo.cairo_create(surf)
        rect = Rect(0, 0, w.value, hh.value)
        rsvg.rsvg_handle_render_document(h, cr, ctypes.byref(rect), ctypes.byref(err))
        cairo.cairo_destroy(cr)
        cairo.cairo_surface_finish(surf)
        cairo.cairo_surface_destroy(surf)
    return "librsvg(ctypes)"


def _render_cli_rsvg(svg, png=None, pdf=None, dpi=300):
    exe = shutil.which("rsvg-convert")
    if not exe:
        raise RuntimeError("rsvg-convert not installed")
    if png:
        subprocess.run([exe, "-d", str(dpi), "-p", str(dpi), "-b", "white", "-o", png, svg], check=True,
                       capture_output=True)
    if pdf:
        subprocess.run([exe, "-f", "pdf", "-o", pdf, svg], check=True, capture_output=True)
    return "rsvg-convert"


def _render_cairosvg(svg, png=None, pdf=None, dpi=300):
    import cairosvg  # noqa
    if png:
        cairosvg.svg2png(url=svg, write_to=png, dpi=dpi, scale=dpi / 96.0, background_color="white")
    if pdf:
        cairosvg.svg2pdf(url=svg, write_to=pdf)
    return "cairosvg"


def _render_inkscape(svg, png=None, pdf=None, dpi=300):
    exe = shutil.which("inkscape") or ("/Applications/Inkscape.app/Contents/MacOS/inkscape"
                                       if os.path.exists("/Applications/Inkscape.app") else None)
    if not exe:
        raise RuntimeError("inkscape not installed")
    if png:
        subprocess.run([exe, svg, "--export-type=png", f"--export-dpi={dpi}", "--export-background=white",
                        "--export-background-opacity=1", f"--export-filename={png}"], check=True, capture_output=True)
    if pdf:
        subprocess.run([exe, svg, "--export-type=pdf", f"--export-filename={pdf}"], check=True, capture_output=True)
    return "inkscape"


def _render_playwright(svg, png=None, pdf=None, dpi=300):
    from playwright.sync_api import sync_playwright  # noqa
    root = ET.parse(svg).getroot()
    wpt, hpt, _ = svg_size_pt(root)
    wpx, hpx = wpt / 0.75, hpt / 0.75
    html = (f"<html><body style='margin:0;background:white'><img src='file://{os.path.abspath(svg)}' "
            f"style='width:{wpx}px;height:{hpx}px;display:block'></body></html>")
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": int(math.ceil(wpx)), "height": int(math.ceil(hpx))},
                        device_scale_factor=dpi / 96.0)
        pg.set_content(html)
        pg.wait_for_timeout(200)
        if png:
            pg.screenshot(path=png, full_page=True)
        if pdf:
            pg.pdf(path=pdf, width=f"{wpx}px", height=f"{hpx}px", print_background=True)
        b.close()
    return "playwright"


def _render_magick(svg, png=None, pdf=None, dpi=300):
    exe = shutil.which("magick") or shutil.which("convert")
    if not exe or not png:
        raise RuntimeError("ImageMagick not installed")
    subprocess.run([exe, "-density", str(dpi), "-background", "white", svg, "-flatten", png], check=True,
                   capture_output=True)
    return "imagemagick"


BACKENDS = [_render_cli_rsvg, _render_cairosvg, _render_librsvg, _render_inkscape, _render_playwright, _render_magick]


def render(svg, png=None, pdf=None, dpi=300):
    errors = []
    for fn in BACKENDS:
        if pdf and fn is _render_magick:
            continue
        try:
            return fn(svg, png, pdf, dpi)
        except Exception as e:  # noqa: BLE001
            errors.append(f"{fn.__name__[8:]}: {str(e).splitlines()[0] if str(e) else type(e).__name__}")
    raise RuntimeError("no SVG renderer available. Install one of: `brew install librsvg` / "
                       "`apt install librsvg2-bin` (rsvg-convert), `pip install cairosvg`, Inkscape, "
                       "or `pip install playwright && playwright install chromium`.\n  " + "\n  ".join(errors))


# ------------------------------------------------------------------ SVG lint
def _style(el):
    out = {}
    for part in (el.get("style") or "").split(";"):
        if ":" in part:
            k, v = part.split(":", 1)
            out[k.strip()] = v.strip()
    for k in ("font-size", "font-family", "fill", "stroke", "font-weight"):
        if el.get(k) is not None and k not in out:
            out[k] = el.get(k)
    m = re.search(r"font:\s*([\d.]+)px\s+(.+)", el.get("style") or "")
    if m:
        out.setdefault("font-size", m.group(1) + "px")
        out.setdefault("font-family", m.group(2))
    return out


def _scale_of(M):
    return math.sqrt(abs(M[0, 0] * M[1, 1] - M[0, 1] * M[1, 0]))


def lint_svg(path, journal="nature"):
    import numpy as np
    issues = []
    add = lambda lvl, code, msg: issues.append((lvl, code, msg))  # noqa: E731
    tree = ET.parse(path)
    root = tree.getroot()
    wpt, hpt, vb = svg_size_pt(root)
    unit = wpt / vb[2] if vb and vb[2] else 1.0     # pt per user unit
    wmm, hmm = wpt * 25.4 / 72, hpt * 25.4 / 72
    widths, max_h, fmin, fmax = JOURNAL_WIDTHS.get(journal, JOURNAL_WIDTHS["nature"])
    if not any(abs(wmm - w) <= 1.0 for w in widths):
        add("WARN", "width", f"{wmm:.1f} mm wide; {journal} widths are {widths} mm")
    if hmm > max_h + 0.5:
        add("WARN", "height", f"{hmm:.1f} mm tall (> {max_h} mm)")
    raw = open(path, encoding="utf-8").read()
    if "inkscape:" in raw or "sodipodi:" in raw:
        add("INFO", "inkscape-svg", "file contains Inkscape namespaces; Nature asks for plain SVG "
                                    "(Inkscape: Save As > Plain SVG)")
    sizes, fams, colors, n_text, n_path, n_img = [], {}, set(), 0, 0, 0

    def walk(el, M, inh):
        nonlocal n_text, n_path, n_img
        tag = el.tag.split("}")[-1]
        if tag in ("defs", "clipPath", "mask", "symbol", "metadata", "title", "desc", "style"):
            return
        M = M @ parse_transform(el.get("transform"))
        st = _style(el)
        cur = dict(inh)
        for k in ("font-size", "font-family", "fill", "font-weight"):
            if k in st:
                cur[k] = st[k]
        if tag in ("path", "rect", "circle", "ellipse", "line", "polyline", "polygon"):
            n_path += 1
            for k in ("fill", "stroke"):
                v = st.get(k)
                if v and v.startswith("#") and len(v) in (4, 7):
                    colors.add(v.lower())
        if tag == "image":
            n_img += 1
        if tag in ("text", "tspan"):
            txt = (el.text or "").strip()
            if tag == "text":
                n_text += 1
            if txt:
                fs = length_pt(str(cur.get("font-size", "16")).replace("px", "")) or 16
                fs_user = float(re.match(r"[\d.]+", str(cur.get("font-size", "16"))).group(0))
                eff = fs_user * _scale_of(M) * unit
                weight = str(cur.get("font-weight", "normal"))
                sizes.append((eff, txt, weight))
                fam = str(cur.get("font-family", "?")).split(",")[0].strip().strip("'\"")
                fams[fam] = fams.get(fam, 0) + 1
                fill = str(cur.get("fill", "#000000"))
                if fill.startswith("#") and fill.lower() not in ("#ffffff", "#fff"):
                    try:
                        if contrast_ratio(fill) < 4.5:
                            add("WARN", "contrast", f"text '{txt[:24]}' fill {fill} contrast "
                                                    f"{contrast_ratio(fill):.1f} < 4.5")
                    except Exception:
                        pass
        for ch in el:
            walk(ch, M, cur)

    # the root viewBox maps user units -> pt; transforms inside are in user units
    walk(root, np.eye(3), {"font-size": "16", "fill": "#000000"})
    if n_img:
        add("WARN", "raster", f"{n_img} embedded raster <image>(s); fine for photos, not for plots/diagrams")
    if n_text == 0 and n_path > 50:
        add("ERROR", "outlined-text", "no <text> elements: text was converted to paths and is not editable")
    for eff, txt, weight in sizes:
        is_label = weight in ("bold", "bolder", "600", "700", "800", "900") and len(txt) <= 2
        if eff < fmin - 0.05:
            add("ERROR", "font-min", f"'{txt[:24]}' renders at {eff:.1f} pt (< {fmin} pt)")
        elif eff > fmax + 0.05 and not (is_label and eff <= fmax + 2.1):
            add("WARN", "font-max", f"'{txt[:24]}' renders at {eff:.1f} pt (> {fmax} pt)")
    for f, n in fams.items():
        if f.lower() not in ARIAL_LIKE:
            lvl = "INFO" if n <= 3 else "WARN"
            add(lvl, "font", f"{n} text run(s) in '{f}' (journals expect Arial/Helvetica)")
    # hue families
    hues = []
    for c in colors:
        L, a, b = rgb_to_lab(hex_to_rgb(c))
        if math.hypot(a, b) > 14:
            hues.append(math.degrees(math.atan2(b, a)) % 360)
    fam = []
    for h in sorted(hues):
        if not any(min(abs(h - x), 360 - abs(h - x)) < 22 for x in fam):
            fam.append(h)
    if len(fam) > 7:
        add("WARN", "too-many-hues", f"{len(fam)} hue families; aim for <= 6")
    stats = {"size_mm": (round(wmm, 1), round(hmm, 1)), "texts": n_text, "shapes": n_path,
             "font_pt": (round(min(s[0] for s in sizes), 2), round(max(s[0] for s in sizes), 2)) if sizes else None,
             "fonts": fams, "hue_families": len(fam)}
    return issues, stats


# ------------------------------------------------------------------ CVD montage
def cvd_montage(png, out):
    import numpy as np
    from PIL import Image, ImageDraw
    im = Image.open(png).convert("RGB")
    maxw = 1100
    if im.width > maxw:
        im = im.resize((maxw, int(im.height * maxw / im.width)), Image.LANCZOS)
    a = np.asarray(im).astype(float) / 255.0
    tiles = [("normal", a)] + [(k, simulate_cvd(a, k)) for k in ("deutan", "protan", "gray")]
    pad = 24
    W = im.width * 2 + 3 * 10
    H = (im.height + pad) * 2 + 10
    canvas = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(canvas)
    for i, (name, arr) in enumerate(tiles):
        x = 10 + (i % 2) * (im.width + 10)
        y = (i // 2) * (im.height + pad)
        canvas.paste(Image.fromarray((np.clip(arr, 0, 1) * 255).astype("uint8")), (x, y + pad))
        d.text((x, y + 6), {"normal": "normal vision", "deutan": "deuteranopia", "protan": "protanopia",
                            "gray": "grayscale print"}[name], fill=(60, 60, 60))
    canvas.save(out)
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("svg")
    ap.add_argument("--png", help="output PNG path (default: next to the SVG)")
    ap.add_argument("--dpi", type=int, default=300)
    ap.add_argument("--pdf", action="store_true", help="also write a PDF next to the SVG")
    ap.add_argument("--cvd", action="store_true", help="also write <name>.cvd.png (color-vision simulation)")
    ap.add_argument("--journal", default="nature")
    ap.add_argument("--no-render", action="store_true")
    ap.add_argument("--quiet", action="store_true", help="only print problems and output paths")
    a = ap.parse_args(argv)
    base = os.path.splitext(a.svg)[0]
    png = a.png or base + ".png"
    issues, stats = lint_svg(a.svg, a.journal)
    backend = None
    if not a.no_render:
        try:
            backend = render(a.svg, png=png, pdf=(base + ".pdf") if a.pdf else None, dpi=a.dpi)
        except Exception as e:  # noqa: BLE001
            print(f"[render] {e}")
            png = None
    if a.cvd and png:
        cvd_montage(png, base + ".cvd.png")
    if not a.quiet:
        print(f"svg: {a.svg}  {stats['size_mm'][0]} x {stats['size_mm'][1]} mm, {stats['texts']} text elements, "
              f"font {stats['font_pt'][0] if stats['font_pt'] else '-'}-{stats['font_pt'][1] if stats['font_pt'] else '-'} pt, "
              f"fonts {dict(stats['fonts'])}, {stats['hue_families']} hue families")
    if issues:
        order = {"ERROR": 0, "WARN": 1, "INFO": 2}
        n = lambda l: sum(1 for i in issues if i[0] == l)  # noqa: E731
        print(f"svg-lint: {n('ERROR')} error(s), {n('WARN')} warning(s), {n('INFO')} info")
        for lvl, code, msg in sorted(issues, key=lambda i: order[i[0]]):
            print(f"  [{lvl}] {code}: {msg}")
    else:
        print("svg-lint: PASS")
    if png:
        print(f"preview: {png}" + (f"  (rendered with {backend})" if not a.quiet else ""))
    if a.pdf and backend:
        print(f"pdf: {base}.pdf")
    if a.cvd and png:
        print(f"cvd: {base}.cvd.png")
    return 1 if any(i[0] == "ERROR" for i in issues) else 0


if __name__ == "__main__":
    sys.exit(main())
