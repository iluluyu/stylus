"""Make a figure's source a single, self-contained file (for moving it into a paper repo / another machine).

    python <skill>/scripts/bundle.py figures/fig2.py            -> figures/standalone/fig2.py
    python <skill>/scripts/bundle.py figures/fig1.typ -o fig1.typ

* .py  — the scifig package (and scifig.typ, if the script builds a Typst layout) is embedded as
         source text and registered as the importable module `scifig`, so `import scifig as sf`
         works unchanged. Needs numpy + matplotlib (+ scipy for CD diagrams, + Typst for layouts).
* .typ — scifig.typ is inlined at the top; the figure code then calls `node(...)` instead of
         `sf.node(...)` (Typst has no inline modules). Only download: @preview/fletcher.

The library in the skill stays split into modules (easier to read and search); only the
deliverable is merged.
"""
from __future__ import annotations

import ast
import datetime as _dt
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.dirname(HERE)
_MODULES = ["__init__", "color", "palette", "style", "plots", "lint", "svgtools", "export", "pdflint",
            "typstbuild"]


def _lit(s: str) -> str:
    """Readable raw triple-quoted literal when safe, else repr()."""
    if "'''" not in s and not s.endswith("\\"):
        return "r'''" + s + "'''"
    return repr(s)


def _version() -> str:
    m = re.search(r'__version__\s*=\s*"([^"]+)"', open(os.path.join(HERE, "__init__.py"), encoding="utf-8").read())
    return m.group(1) if m else "?"


def bundle_python(src_path: str, out_path: str, with_typst: bool | None = None) -> str:
    code = open(src_path, encoding="utf-8").read()
    tree = ast.parse(code)
    lines = code.splitlines(keepends=True)
    doc_end = 0
    docstring = ""
    if tree.body and isinstance(tree.body[0], ast.Expr) and isinstance(getattr(tree.body[0], "value", None), ast.Constant) \
            and isinstance(tree.body[0].value.value, str):
        doc_end = tree.body[0].end_lineno
        docstring = "".join(lines[:doc_end])
    shebang = lines[0] if lines and lines[0].startswith("#!") and not docstring else ""
    body = lines[doc_end:] if docstring else lines[1 if shebang else 0:]
    futures, rest = [], []
    for ln in body:
        if ln.startswith("from __future__ import"):
            futures.append(ln)
        elif re.match(r"\s*sys\.path\.(insert|append)\(.*scripts", ln):
            rest.append(re.sub(r"^(\s*)", r"\1# (standalone: scifig is embedded above) ", ln, count=1))
        else:
            rest.append(ln)
    if with_typst is None:
        with_typst = bool(re.search(r"typst_figure|compile_typst", code))

    sources = {}
    for m in _MODULES:
        name = "scifig" if m == "__init__" else f"scifig.{m}"
        sources[name] = open(os.path.join(HERE, f"{m}.py"), encoding="utf-8").read()
    typ = open(os.path.join(SCRIPTS, "scifig.typ"), encoding="utf-8").read() if with_typst else None

    stamp = _dt.date.today().isoformat()
    out = []
    out.append("#!/usr/bin/env python3\n")
    if docstring:
        out.append(docstring if docstring.endswith("\n") else docstring + "\n")
    out.extend(futures)
    out.append(
        f"# ─── Standalone figure script (scifig {_version()} bundle, {stamp}) ───────────────────────────\n"
        "# Section 1 embeds the scifig library so this single file runs anywhere with numpy + matplotlib"
        + (" + the Typst compiler" if with_typst else "") + ".\n"
        "# Do not edit section 1; re-bundle from the skill to update it. Your figure code is section 2\n"
        "# (search for \"SECTION 2\").\n"
        "# ─── SECTION 1: embedded scifig ──────────────────────────────────────────────────────────────\n")
    out.append("import importlib.abc as _sf_abc, importlib.util as _sf_util, sys as _sf_sys\n\n")
    out.append("_SCIFIG_SOURCES = {\n")
    for name, src in sources.items():
        out.append(f"    {name!r}: {_lit(src)},\n")
    out.append("}\n")
    if typ is not None:
        out.append(f"_SCIFIG_TYP = {_lit(typ)}\n")
    out.append('''

class _ScifigEmbedded(_sf_abc.MetaPathFinder, _sf_abc.Loader):
    def find_spec(self, name, path=None, target=None):
        if name in _SCIFIG_SOURCES:
            return _sf_util.spec_from_loader(name, self, is_package=(name == "scifig"))
        return None

    def create_module(self, spec):
        return None

    def exec_module(self, module):
        exec(compile(_SCIFIG_SOURCES[module.__name__], f"<scifig:{module.__name__}>", "exec"), module.__dict__)


if not any(isinstance(f, _ScifigEmbedded) for f in _sf_sys.meta_path):
    _sf_sys.meta_path.insert(0, _ScifigEmbedded())
''')
    if typ is not None:
        out.append("import scifig.typstbuild as _sf_tb  # noqa: E402\n_sf_tb.EMBEDDED_TYP = _SCIFIG_TYP\n")
    out.append("# ─── SECTION 2: figure code ─────────────────────────────────────────────────────────────────\n")
    out.extend(rest)
    text = "".join(out)
    ast.parse(text)    # never write a broken file
    os.makedirs(os.path.dirname(os.path.abspath(out_path)) or ".", exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as fh:
        fh.write(text)
    return out_path


def bundle_typst(src_path: str, out_path: str) -> str:
    """Inline scifig.typ at the top of the figure and drop the `sf.` prefix from the figure code.

    Typst has no inline modules, and functions stored in a dictionary cannot be called as `d.f()`,
    so the library's definitions become top-level names of the standalone file instead.
    """
    code = open(src_path, encoding="utf-8").read()
    pat = re.compile(r'^#import\s+"([^"]*scifig\.typ)"\s+as\s+([A-Za-z][\w-]*)\s*$', re.M)
    m = pat.search(code)
    if not m:
        raise SystemExit('bundle: the figure must import the library as `#import ".../scifig.typ" as sf`')
    alias = m.group(2)
    lib = open(os.path.join(SCRIPTS, "scifig.typ"), encoding="utf-8").read()
    head, tail = code[:m.start()], code[m.end():]
    tail = re.sub(r"(?<![\w.-])" + re.escape(alias) + r"\.(?=[A-Za-z_])", "", tail)
    stamp = _dt.date.today().isoformat()
    text = (head.rstrip("\n") + ("\n" if head.strip() else "")
            + f"// ─── Standalone figure (scifig {_version()} bundle, {stamp}) ────────────────────────────────\n"
            + "// SECTION 1 inlines the scifig.typ library (do not edit; re-bundle to update). SECTION 2 is the\n"
            + f"// figure; it calls the library without the `{alias}.` prefix. Only download: @preview/fletcher.\n"
            + "// ─── SECTION 1: scifig.typ ──────────────────────────────────────────────────────────────────\n"
            + lib.rstrip("\n") + "\n"
            + "// ─── SECTION 2: figure ──────────────────────────────────────────────────────────────────────\n"
            + tail.lstrip("\n"))
    os.makedirs(os.path.dirname(os.path.abspath(out_path)) or ".", exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as fh:
        fh.write(text)
    return out_path


def bundle(src_path: str, out_path: str | None = None) -> str:
    ext = os.path.splitext(src_path)[1].lower()
    if out_path is None:
        out_path = os.path.join(os.path.dirname(os.path.abspath(src_path)), "standalone", os.path.basename(src_path))
    if ext == ".py":
        return bundle_python(src_path, out_path)
    if ext == ".typ":
        return bundle_typst(src_path, out_path)
    raise SystemExit(f"bundle: expected a .py or .typ figure, got {src_path}")
