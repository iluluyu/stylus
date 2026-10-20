#!/usr/bin/env python3
"""Turn a figure script (.py or .typ) into ONE self-contained file for delivery / migration.

    python bundle.py figures/fig2.py                 # -> figures/standalone/fig2.py
    python bundle.py figures/fig1.typ -o out/fig1.typ

The scifig library is embedded (Python modules, and scifig.typ where needed), so the result runs
without this skill. See scifig/bundle.py for details.
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scifig.bundle import bundle  # noqa: E402


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("figure", nargs="+", help=".py or .typ figure source(s)")
    ap.add_argument("-o", "--out", help="output file (one input) or directory (several inputs)")
    a = ap.parse_args(argv)
    for f in a.figure:
        out = a.out
        if out and (len(a.figure) > 1 or os.path.isdir(out)):
            out = os.path.join(out, os.path.basename(f))
        path = bundle(f, out)
        print(f"standalone: {path}  ({os.path.getsize(path) / 1024:.0f} kB)")


if __name__ == "__main__":
    main()
