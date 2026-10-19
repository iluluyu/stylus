"""Color science helpers: conversions, contrast, CIEDE2000, color-vision-deficiency (CVD) simulation.

Pure numpy, no extra dependencies. Used by palette.py, lint.py and ../check.py.
"""
from __future__ import annotations

import numpy as np

# Machado, Oliveira & Fernandes (2009), severity 1.0, applied in linear sRGB.
CVD_MATRICES = {
    "protan": np.array([[0.152286, 1.052583, -0.204868],
                        [0.114503, 0.786281, 0.099216],
                        [-0.003882, -0.048116, 1.051998]]),
    "deutan": np.array([[0.367322, 0.860646, -0.227968],
                        [0.280085, 0.672501, 0.047413],
                        [-0.011820, 0.042940, 0.968881]]),
    "tritan": np.array([[1.255528, -0.076749, -0.178779],
                        [-0.078411, 0.930809, 0.147602],
                        [0.004733, 0.691367, 0.303900]]),
}


def hex_to_rgb(c) -> np.ndarray:
    """'#RRGGBB' | '#RGB' | (r,g,b) in 0..1 | (r,g,b) in 0..255 -> float array 0..1."""
    if isinstance(c, str):
        s = c.strip().lstrip("#")
        if len(s) == 3:
            s = "".join(ch * 2 for ch in s)
        if len(s) == 8:  # drop alpha
            s = s[:6]
        return np.array([int(s[i:i + 2], 16) for i in (0, 2, 4)], dtype=float) / 255.0
    a = np.asarray(c, dtype=float)[:3]
    return a / 255.0 if a.max() > 1.0 else a


def rgb_to_hex(rgb) -> str:
    r = np.clip(np.asarray(rgb, dtype=float), 0, 1)
    return "#{:02X}{:02X}{:02X}".format(*(int(round(v * 255)) for v in r))


def srgb_to_linear(c):
    c = np.asarray(c, dtype=float)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(c):
    c = np.clip(np.asarray(c, dtype=float), 0, 1)
    return np.where(c <= 0.0031308, 12.92 * c, 1.055 * c ** (1 / 2.4) - 0.055)


def relative_luminance(c) -> float:
    lin = srgb_to_linear(hex_to_rgb(c))
    return float(0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2])


def contrast_ratio(c1, c2="#FFFFFF") -> float:
    """WCAG contrast ratio. Nature asks for > 4.5 for text."""
    l1, l2 = relative_luminance(c1), relative_luminance(c2)
    hi, lo = max(l1, l2), min(l1, l2)
    return (hi + 0.05) / (lo + 0.05)


def mix(c1, c2, t: float) -> str:
    """Linear mix in sRGB: t=0 -> c1, t=1 -> c2."""
    return rgb_to_hex((1 - t) * hex_to_rgb(c1) + t * hex_to_rgb(c2))


def tint(c, amount: float) -> str:
    """Mix toward white. amount=0.85 gives a very light tint (good for fills)."""
    return mix(c, "#FFFFFF", amount)


def shade(c, amount: float) -> str:
    """Mix toward black."""
    return mix(c, "#000000", amount)


def readable(c, bg="#FFFFFF", min_ratio=4.5) -> str:
    """Darken a color until it reaches the contrast ratio needed for text on bg."""
    out = rgb_to_hex(hex_to_rgb(c))
    for k in range(40):
        if contrast_ratio(out, bg) >= min_ratio:
            return out
        out = shade(c, 0.025 * (k + 1))
    return out


# ---------- CIELAB / CIEDE2000 ----------

def rgb_to_lab(rgb) -> np.ndarray:
    lin = srgb_to_linear(np.asarray(rgb, dtype=float))
    M = np.array([[0.4124564, 0.3575761, 0.1804375],
                  [0.2126729, 0.7151522, 0.0721750],
                  [0.0193339, 0.1191920, 0.9503041]])
    xyz = lin @ M.T
    xyz = xyz / np.array([0.95047, 1.0, 1.08883])
    eps, kap = 216 / 24389, 24389 / 27
    f = np.where(xyz > eps, np.cbrt(xyz), (kap * xyz + 16) / 116)
    L = 116 * f[..., 1] - 16
    a = 500 * (f[..., 0] - f[..., 1])
    b = 200 * (f[..., 1] - f[..., 2])
    return np.stack([L, a, b], axis=-1)


def delta_e2000(lab1, lab2) -> float:
    L1, a1, b1 = lab1
    L2, a2, b2 = lab2
    C1, C2 = np.hypot(a1, b1), np.hypot(a2, b2)
    Cb = (C1 + C2) / 2
    G = 0.5 * (1 - np.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)))
    a1p, a2p = (1 + G) * a1, (1 + G) * a2
    C1p, C2p = np.hypot(a1p, b1), np.hypot(a2p, b2)
    h1p = np.degrees(np.arctan2(b1, a1p)) % 360
    h2p = np.degrees(np.arctan2(b2, a2p)) % 360
    dLp, dCp = L2 - L1, C2p - C1p
    dh = h2p - h1p
    if C1p * C2p == 0:
        dh = 0
    elif dh > 180:
        dh -= 360
    elif dh < -180:
        dh += 360
    dHp = 2 * np.sqrt(C1p * C2p) * np.sin(np.radians(dh / 2))
    Lbp, Cbp = (L1 + L2) / 2, (C1p + C2p) / 2
    if C1p * C2p == 0:
        hbp = h1p + h2p
    elif abs(h1p - h2p) > 180:
        hbp = (h1p + h2p + 360) / 2 if (h1p + h2p) < 360 else (h1p + h2p - 360) / 2
    else:
        hbp = (h1p + h2p) / 2
    T = (1 - 0.17 * np.cos(np.radians(hbp - 30)) + 0.24 * np.cos(np.radians(2 * hbp))
         + 0.32 * np.cos(np.radians(3 * hbp + 6)) - 0.20 * np.cos(np.radians(4 * hbp - 63)))
    dtheta = 30 * np.exp(-(((hbp - 275) / 25) ** 2))
    Rc = 2 * np.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7))
    Sl = 1 + (0.015 * (Lbp - 50) ** 2) / np.sqrt(20 + (Lbp - 50) ** 2)
    Sc = 1 + 0.045 * Cbp
    Sh = 1 + 0.015 * Cbp * T
    Rt = -np.sin(np.radians(2 * dtheta)) * Rc
    return float(np.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2
                         + Rt * (dCp / Sc) * (dHp / Sh)))


def simulate_cvd(rgb, kind: str):
    """Simulate CVD on colors or images (..., 3) in sRGB 0..1. kind: protan|deutan|tritan|gray."""
    rgb = np.asarray(rgb, dtype=float)
    if kind == "gray":
        lin = srgb_to_linear(rgb)
        y = lin[..., 0] * 0.2126 + lin[..., 1] * 0.7152 + lin[..., 2] * 0.0722
        g = linear_to_srgb(y)
        return np.stack([g, g, g], axis=-1)
    M = CVD_MATRICES[kind]
    return linear_to_srgb(srgb_to_linear(rgb) @ M.T)


def palette_report(colors, bg="#FFFFFF") -> dict:
    """Minimum pairwise CIEDE2000 under normal vision, each CVD type and grayscale,
    plus contrast of each color against the background.
    Rule of thumb: min dE >= 10 is comfortably distinct for lines; >= 6 for large areas."""
    rgbs = np.array([hex_to_rgb(c) for c in colors])
    out = {}
    for kind in ["normal", "deutan", "protan", "tritan", "gray"]:
        sim = rgbs if kind == "normal" else simulate_cvd(rgbs, kind)
        labs = rgb_to_lab(sim)
        best = (np.inf, None)
        for i in range(len(colors)):
            for j in range(i + 1, len(colors)):
                d = delta_e2000(labs[i], labs[j])
                if d < best[0]:
                    best = (d, (colors[i], colors[j]))
        out[kind] = {"min_dE": round(best[0], 1), "closest_pair": best[1]}
    out["contrast_vs_bg"] = {c: round(contrast_ratio(c, bg), 2) for c in colors}
    return out
