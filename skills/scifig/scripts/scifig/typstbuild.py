"""Typst side of scifig: compile schematics / composed figures and audit them.

    sf.compile_typst("figures/fig1.typ")             # -> fig1.pdf / .svg / .png + lint report
    sf.typst_figure(SOURCE, "figures/fig1",           # Typst source kept inside a Python script
                    files={"panel_c.pdf": res["paths"]["pdf"]})

Needs the Typst compiler: the `typst` CLI (https://github.com/typst/typst/releases, `brew install typst`,
`winget install Typst.Typst`, `cargo install typst-cli`) or the Python wheel (`pip install typst`).
Packages such as @preview/fletcher are downloaded by Typst on first use and cached.

Lint = the diagram's own geometry report (overlaps, edges through boxes, group intrusion ... computed
inside scifig.typ from exact positions) + the PDF lint (sizes, fonts, text overlap, lines through text).
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import tempfile

_FILE = globals().get("__file__")      # absent when embedded in a standalone bundle
LIBRARY = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(_FILE))), "scifig.typ") if _FILE else None
EMBEDDED_TYP: str | None = None          # standalone bundles put the scifig.typ source here
FONT_PREFERENCE = ["Arial", "Helvetica", "Liberation Sans", "Arimo", "TeX Gyre Heros"]
_NOISE = re.compile(r"unknown font family")
_cache: dict = {}


def library_source() -> str:
    """Text of scifig.typ (embedded copy in a standalone bundle, else the file next to this package)."""
    if EMBEDDED_TYP is not None:
        return EMBEDDED_TYP
    if LIBRARY is None or not os.path.exists(LIBRARY):
        raise RuntimeError("scifig.typ not found: re-bundle the script with the skill's bundle.py")
    with open(LIBRARY, encoding="utf-8") as fh:
        return fh.read()


def find_typst():
    """('cli', path) or ('py', module); raises with install hints if neither exists."""
    if "typst" in _cache:
        return _cache["typst"]
    exe = os.environ.get("SCIFIG_TYPST") or shutil.which("typst")
    if exe:
        _cache["typst"] = ("cli", exe)
        return _cache["typst"]
    try:
        import typst as typst_py  # noqa: F401
        _cache["typst"] = ("py", typst_py)
        return _cache["typst"]
    except ImportError:
        pass
    raise RuntimeError("Typst compiler not found. Install one of: the CLI (macOS `brew install typst`, "
                       "Windows `winget install Typst.Typst`, Linux: release binary from "
                       "https://github.com/typst/typst/releases or `cargo install typst-cli`), "
                       "or the Python wheel `pip install typst`.")


def detect_font() -> str | None:
    """First installed Arial-metric font, passed to scifig.typ as --input sf-font=..."""
    if "font" in _cache:
        return _cache["font"]
    found = None
    kind, t = find_typst()
    if kind == "cli":
        try:
            out = subprocess.run([t, "fonts"], capture_output=True, text=True, timeout=60).stdout
            names = {ln.strip() for ln in out.splitlines()}
            found = next((f for f in FONT_PREFERENCE if f in names), None)
        except Exception:  # noqa: BLE001
            found = None
    if found is None:
        try:
            from matplotlib import font_manager
            names = {f.name for f in font_manager.fontManager.ttflist}
            found = next((f for f in FONT_PREFERENCE if f in names), None)
        except Exception:  # noqa: BLE001
            found = None
    _cache["font"] = found
    return found


def _guess_root(path: str) -> str:
    """Common ancestor of the file and every local file it imports / includes / reads."""
    here = os.path.dirname(os.path.abspath(path))
    dirs = [here]
    try:
        src = open(path, encoding="utf-8").read()
    except OSError:
        return here
    for m in re.finditer(r'(?:import|include|image|read|csv|json)\s*\(?\s*"([^"@][^"]*)"', src):
        target = os.path.normpath(os.path.join(here, m.group(1)))
        dirs.append(os.path.dirname(target))
    return os.path.commonpath(dirs)


def _run_cli(exe, args):
    r = subprocess.run([exe] + args, capture_output=True, text=True)
    msgs = [b for b in re.split(r"\n(?=(?:warning|error|help):)", (r.stderr or "").strip()) if b.strip()]
    msgs = [b for b in msgs if not _NOISE.search(b.splitlines()[0])]
    return r.returncode, r.stdout, msgs


def _compile_one(src, out, fmt, root, inputs, ppi):
    kind, t = find_typst()
    if kind == "cli":
        args = ["compile", "--root", root, "--format", fmt]
        for k, v in inputs.items():
            args += ["--input", f"{k}={v}"]
        if fmt == "png":
            args += ["--ppi", str(ppi)]
        code, _, msgs = _run_cli(t, args + [src, out])
        if code != 0:
            raise RuntimeError("typst compile failed:\n" + "\n".join(msgs))
        return msgs
    kw = {"root": root, "format": fmt, "sys_inputs": inputs}
    if fmt == "png":
        kw["ppi"] = float(ppi)
    t.compile(src, output=out, **kw)
    return []


def _geometry_lint(src, root, inputs):
    """Issues embedded by scifig.typ's diagram() as <sf-lint> metadata."""
    kind, t = find_typst()
    if kind != "cli":
        try:
            raw = t.query(src, "<sf-lint>", field="value", root=root, sys_inputs=inputs)
            return [tuple(i) for d in json.loads(raw) for i in d.get("issues", [])]
        except Exception:  # noqa: BLE001
            return []
    base = []
    for k, v in inputs.items():
        base += ["--input", f"{k}={v}"]
    code, out, _ = _run_cli(t, ["eval", "--root", root, *base, "--in", src,
                                "query(<sf-lint>).map(m => m.value)"])
    if code != 0:   # Typst < 0.15: `typst query`
        code, out, _ = _run_cli(t, ["query", "--root", root, *base, src, "<sf-lint>", "--field", "value"])
    try:
        data = json.loads(out) if code == 0 else []
    except json.JSONDecodeError:
        data = []
    return [tuple(i) for d in data for i in d.get("issues", [])]


def _flatten_png(png):
    """Typst pages are transparent; previews get a white background."""
    try:
        from PIL import Image
        im = Image.open(png)
        if im.mode in ("RGBA", "LA"):
            bg = Image.new("RGB", im.size, "white")
            bg.paste(im, mask=im.split()[-1])
            bg.save(png)
    except Exception:  # noqa: BLE001
        pass


def compile_typst(path, out=None, formats=("pdf", "svg", "png"), ppi=300, root=None, journal=None,
                  inputs=None, lint=True, quiet=False):
    """Compile a .typ figure to PDF (editable text) + SVG (text as outlines) + PNG preview, then lint.

    out: output base path (default: next to the .typ file). journal: profile for the PDF lint
    (default: the one the file passes to sf.setup, else nature). Returns {"paths", "issues", "size_mm"}.
    """
    from .pdflint import lint_pdf
    path = os.path.abspath(path)
    base = os.path.splitext(out)[0] if out else os.path.splitext(path)[0]
    os.makedirs(os.path.dirname(base) or ".", exist_ok=True)
    root = os.path.abspath(root or _guess_root(path))
    inputs = dict(inputs or {})
    font = detect_font()
    if font and "sf-font" not in inputs:
        inputs["sf-font"] = font
    written, msgs = {}, []
    for fmt in formats:
        target = f"{base}.{fmt}"
        try:
            msgs += _compile_one(path, target, fmt, root, inputs, ppi)
        except RuntimeError as e:
            if fmt in ("svg", "png") and "page number template" in str(e):
                target = f"{base}-{{p}}.{fmt}"
                msgs += _compile_one(path, target, fmt, root, inputs, ppi)
            else:
                raise
        if fmt == "png":
            if "{p}" in target:
                import glob
                for f in glob.glob(f"{glob.escape(base)}-*.png"):
                    _flatten_png(f)
            else:
                _flatten_png(target)
        written[fmt] = target
    if journal is None:
        m = re.search(r'journal:\s*"(\w+)"', open(path, encoding="utf-8").read())
        journal = m.group(1) if m else "nature"
    issues = []
    stats = {}
    if lint:
        issues += [(lvl, code, msg) for lvl, code, msg in _geometry_lint(path, root, inputs)]
        if "pdf" in written:
            pi, stats = lint_pdf(written["pdf"], journal=journal)
            issues += pi
    if not quiet:
        for m_ in dict.fromkeys(msgs):
            print(m_)
        size = stats.get("size_mm")
        print(f"saved {', '.join(written.values())}" + (f"  ({size[0]} x {size[1]} mm)" if size else ""))
        if lint:
            print(report(issues))
        if "png" in written:
            print(f"next: view {written['png']} and check it against references/critique-checklist.md")
    return {"paths": written, "issues": issues, "size_mm": stats.get("size_mm")}


def typst_figure(source, out, files=None, **kw):
    """Compile Typst *source text* (e.g. a layout kept inside a figure's Python script).

    The source can `#import "scifig.typ" as sf` and refer to every key of `files`
    ({name_in_typst: path_on_disk}), e.g. image("panel_c.pdf"). Everything is staged in a temporary
    directory, so the script works from any folder. Returns compile_typst's result dict.
    """
    with tempfile.TemporaryDirectory(prefix="scifig-") as tmp:
        with open(os.path.join(tmp, "scifig.typ"), "w", encoding="utf-8") as fh:
            fh.write(library_source())
        for name, src in (files or {}).items():
            dst = os.path.join(tmp, name)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copyfile(src, dst)
        main = os.path.join(tmp, "figure.typ")
        with open(main, "w", encoding="utf-8") as fh:
            fh.write(source)
        out = os.path.abspath(os.path.splitext(out)[0])
        return compile_typst(main, out=out, root=tmp, **kw)


def report(issues, header="lint") -> str:
    if not issues:
        return f"{header}: PASS (no issues)"
    order = {"ERROR": 0, "WARN": 1, "INFO": 2}
    n = lambda lvl: sum(1 for i in issues if i[0] == lvl)  # noqa: E731
    lines = [f"{header}: {n('ERROR')} error(s), {n('WARN')} warning(s), {n('INFO')} info"]
    lines += [f"  [{lvl}] {code}: {msg}" for lvl, code, msg in sorted(issues, key=lambda i: order.get(i[0], 3))]
    return "\n".join(lines)
