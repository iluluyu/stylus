// sfd.mjs — "science figure diagrams": zero-dependency Node library that writes
// clean, layered, editable SVG schematics (method overviews, algorithm pipelines,
// optimization loops) in a consistent journal design language.
//
//   import { Diagram } from '<skill>/scripts/diagram/sfd.mjs';
//   const d = new Diagram({ width: 'double' });           // 183 mm, height auto
//   d.node('x', { label: 'Data $\\mathcal{D}$', tone: 'neutral' });
//   d.node('f', { label: 'Model $f_\\theta$', tone: 'primary', right: 'x' });
//   d.edge('x', 'f', { label: 'mini-batch' });
//   d.save('fig1.svg');                                    // prints lint, optional PNG preview
//
// Units: every number you pass is in pt (1 mm = 2.835 pt) unless the option name says mm.
// Full API reference: ../../references/diagram-api.md

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const METRICS = JSON.parse(fs.readFileSync(path.join(HERE, 'arial-metrics.json'), 'utf8'));
export const MM = 72 / 25.4;

// ------------------------------------------------------------------ color
const hex2rgb = (h) => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); };
const rgb2hex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
export const mix = (a, b, t) => { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(A.map((v, i) => v * (1 - t) + B[i] * t)); };
export const tint = (c, t) => mix(c, '#FFFFFF', t);
export const shade = (c, t) => mix(c, '#000000', t);
const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const lum = (h) => { const [r, g, b] = hex2rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a, b = '#FFFFFF') => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// Same hues as the Python palette ("scifig", CVD-checked) so diagrams and plots match.
export const PALETTE = {
  blue: '#1A5FA0', orange: '#CF5B2A', green: '#118C6E', purple: '#C26FA3',
  amber: '#E1A02E', sky: '#5BADDF', grey: '#6E6E6E',
};
const TONE_ALIAS = { primary: 'blue', accent: 'orange', ours: 'orange', secondary: 'green', neutral: 'grey',
  data: 'grey', model: 'blue', loss: 'purple', objective: 'purple', highlight: 'orange', warm: 'amber', cool: 'sky' };

function toneOf(name, theme) {
  if (!name) name = 'neutral';
  if (typeof name === 'string' && name.startsWith('#')) return makeTone(name);
  const key = TONE_ALIAS[name] || name;
  if (!theme.palette[key]) throw new Error(`unknown tone '${name}'. Use one of: ${Object.keys(theme.palette).join(', ')}, ${Object.keys(TONE_ALIAS).join(', ')} or a #hex`);
  const t = makeTone(theme.palette[key]);
  t.name = key;
  if (key === 'grey') { t.fill = '#FFFFFF'; t.fillStrong = '#F2F2F2'; t.stroke = '#8C8C8C'; t.soft = '#F7F7F7'; }
  return t;
}
function makeTone(base) {
  return { base, fill: tint(base, 0.87), fillStrong: tint(base, 0.72), soft: tint(base, 0.94),
    stroke: shade(base, 0.05), dark: shade(base, 0.35), name: base };
}

// ------------------------------------------------------------------ theme
export const THEMES = {
  nature: {
    widths: { single: 89, onehalf: 120, double: 183 }, maxHeight: 170,
    font: "Arial, Helvetica, 'Liberation Sans', Arimo, sans-serif",
    size: 7, small: 6, label: 8, minSize: 5,
    ink: '#1A1A1A', muted: '#4D4D4D', faint: '#8C8C8C', guide: '#B3B3B3',
    stroke: 0.7, strokeStrong: 1.2, radius: 2.5, corner: 'g2', smoothing: 0.6, g2Scale: 1.3,
    padX: 6, padY: 4.5, minW: 30, minH: 17, gap: 16, lineHeight: 1.22,
    edge: { color: '#4D4D4D', width: 0.75, headLen: 4.4, headWidth: 3.4, corner: 3 },
    palette: PALETTE, labelCase: 'lower',
  },
};
THEMES.neurips = { ...THEMES.nature, widths: { single: 139.7, half: 67, double: 139.7 }, size: 8, small: 7, label: 9 };
THEMES.icml = { ...THEMES.nature, widths: { single: 82.6, double: 171.5 }, size: 8, small: 7, label: 9 };
THEMES.cvpr = { ...THEMES.nature, widths: { single: 82.6, double: 174.6 }, size: 8, small: 7, label: 9 };
THEMES.ieee = { ...THEMES.nature, widths: { single: 88.9, double: 181 }, size: 8, small: 7, label: 8 };
THEMES.science = { ...THEMES.nature, widths: { single: 55, onehalf: 120, double: 175 }, labelCase: 'upper' };
THEMES.cell = { ...THEMES.nature, widths: { single: 85, onehalf: 114, double: 174 }, labelCase: 'upper' };
THEMES.pnas = { ...THEMES.nature, widths: { single: 87, onehalf: 114, double: 178 }, labelCase: 'upper' };

// ------------------------------------------------------------------ text: mini-TeX
const GREEK = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ϵ', varepsilon: 'ε', zeta: 'ζ', eta: 'η',
  theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ',
  sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'ϕ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω', Gamma: 'Γ',
  Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω' };
const SYMBOLS = { nabla: '∇', partial: '∂', infty: '∞', sum: 'Σ', prod: 'Π', int: '∫', in: '∈', notin: '∉',
  leftarrow: '←', rightarrow: '→', to: '→', gets: '←', Rightarrow: '⇒', leftrightarrow: '↔', uparrow: '↑',
  downarrow: '↓', mapsto: '↦', le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', approx: '≈', sim: '∼',
  equiv: '≡', propto: '∝', times: '×', cdot: '·', pm: '±', mp: '∓', div: '÷', circ: '∘', star: '⋆', ast: '∗',
  oplus: '⊕', otimes: '⊗', odot: '⊙', top: '⊤', perp: '⊥', forall: '∀', exists: '∃', cup: '∪', cap: '∩',
  subset: '⊂', subseteq: '⊆', ell: 'ℓ', hbar: 'ℏ', ldots: '…', cdots: '⋯', dots: '…', prime: '′', '|': '‖',
  lVert: '‖', rVert: '‖', langle: '⟨', rangle: '⟩', lbrace: '{', rbrace: '}', '{': '{', '}': '}', '%': '%',
  '#': '#', '&': '&', _: '_', $: '$', ',': ' ', ';': ' ', ':': ' ', '!': '', quad: ' ',
  qquad: '  ', min: 'min', max: 'max', arg: 'arg', argmin: 'argmin', argmax: 'argmax', log: 'log',
  exp: 'exp', sin: 'sin', cos: 'cos', tanh: 'tanh', det: 'det', tr: 'tr', sup: 'sup', inf: 'inf', lim: 'lim',
  softmax: 'softmax', KL: 'KL', E: '𝔼', mathbb: null, left: '', right: '', big: '', Big: '' };
const UPRIGHT_FUNCS = new Set(['min', 'max', 'arg', 'argmin', 'argmax', 'log', 'exp', 'sin', 'cos', 'tanh', 'det',
  'tr', 'sup', 'inf', 'lim', 'softmax', 'KL']);
const ACCENTS = { hat: '̂', bar: '̄', tilde: '̃', dot: '̇', ddot: '̈', vec: '⃗' };
const CAL_EXC = { B: 'ℬ', E: 'ℰ', F: 'ℱ', H: 'ℋ', I: 'ℐ', L: 'ℒ', M: 'ℳ', R: 'ℛ' };
const BB = { R: 'ℝ', N: 'ℕ', Z: 'ℤ', Q: 'ℚ', C: 'ℂ', E: '𝔼', P: 'ℙ' };
const calOf = (ch) => (CAL_EXC[ch] || (/[A-Z]/.test(ch) ? String.fromCodePoint(0x1D49C + ch.charCodeAt(0) - 65) : ch));

function readGroup(s, i) { // s[i] === '{' -> [content, nextIndex]
  let depth = 0, j = i;
  for (; j < s.length; j++) {
    if (s[j] === '\\') { j++; continue; }
    if (s[j] === '{') depth++;
    else if (s[j] === '}') { depth--; if (depth === 0) return [s.slice(i + 1, j), j + 1]; }
  }
  return [s.slice(i + 1), s.length];
}
function readArg(s, i) {
  while (s[i] === ' ') i++;
  if (s[i] === '{') return readGroup(s, i);
  if (s[i] === '\\') { const m = /^\\([A-Za-z]+|.)/.exec(s.slice(i)); return [m[0], i + m[0].length]; }
  return [s[i] ?? '', i + 1];
}

// returns runs [{t, it, bf, lv}] for a math string; lv = script level (0 base, +1 sup, -1 sub)
function parseMath(s, st = { it: true, bf: false, lv: 0 }, runs = []) {
  const start = runs.length;   // the first token of a group cannot be a binary operator
  const push = (t, o = {}) => { if (!t) return; runs.push({ t, it: o.it ?? st.it, bf: o.bf ?? st.bf, lv: o.lv ?? st.lv }); };
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '\\') {
      const m = /^\\([A-Za-z]+|.)/.exec(s.slice(i)); const cmd = m[1]; i += m[0].length;
      if (GREEK[cmd]) { push(GREEK[cmd], { it: /[a-z]/.test(cmd[0]) && st.it }); continue; }
      if (cmd in ACCENTS) { const [a, n] = readArg(s, i); i = n; const sub = parseMath(a, st, []);
        if (sub.length) sub[sub.length - 1].t += ACCENTS[cmd]; runs.push(...sub); continue; }
      if (cmd === 'mathbf' || cmd === 'boldsymbol' || cmd === 'bm') { const [a, n] = readArg(s, i); i = n;
        parseMath(a, { ...st, bf: true, it: cmd !== 'mathbf' }, runs); continue; }
      if (cmd === 'mathrm' || cmd === 'text' || cmd === 'textrm' || cmd === 'operatorname') { const [a, n] = readArg(s, i); i = n;
        if (cmd === 'text') push(a, { it: false }); else parseMath(a, { ...st, it: false }, runs); continue; }
      if (cmd === 'textbf') { const [a, n] = readArg(s, i); i = n; push(a, { it: false, bf: true }); continue; }
      if (cmd === 'textit' || cmd === 'mathit') { const [a, n] = readArg(s, i); i = n; push(a, { it: true }); continue; }
      if (cmd === 'mathcal' || cmd === 'mathscr') { const [a, n] = readArg(s, i); i = n; push([...a].map(calOf).join(''), { it: false }); continue; }
      if (cmd === 'mathbb') { const [a, n] = readArg(s, i); i = n; push([...a].map((ch) => BB[ch] || ch).join(''), { it: false }); continue; }
      if (cmd === 'frac' || cmd === 'tfrac' || cmd === 'dfrac') { const [a, n1] = readArg(s, i); const [b, n2] = readArg(s, n1); i = n2;
        const wrap = (x) => (x.length > 1 && /[+\-\s]/.test(x) ? `(${x})` : x);
        parseMath(wrap(a), st, runs); push('/', { it: false }); parseMath(wrap(b), st, runs); continue; }
      if (cmd === 'sqrt') { const [a, n] = readArg(s, i); i = n; push('√', { it: false });
        if (a.length > 1) { push('(', { it: false }); parseMath(a, st, runs); push(')', { it: false }); } else parseMath(a, st, runs); continue; }
      if (cmd in SYMBOLS) { if (SYMBOLS[cmd] !== null) push(SYMBOLS[cmd], { it: false });
        if (UPRIGHT_FUNCS.has(cmd)) push(' ', { it: false }); continue; }
      push(cmd, { it: false }); continue;
    }
    if (c === '_' || c === '^') {
      const [a, n] = readArg(s, i + 1); i = n;
      parseMath(a, { ...st, lv: st.lv + (c === '^' ? 1 : -1) }, runs); continue;
    }
    if (c === '{') { const [a, n] = readGroup(s, i); i = n; parseMath(a, st, runs); continue; }
    if (c === '}') { i++; continue; }
    if (c === ' ') { i++; continue; }                         // TeX ignores spaces in math
    if (c === '-') { // binary minus gets thin spaces like TeX; unary minus does not
      const last = runs.length ? runs[runs.length - 1].t.slice(-1) : '';
      const binary = runs.length > start && /[\p{L}\p{N})\]}′|‖̀-ͯ]/u.test(last);
      push(binary ? ' − ' : '−', { it: false }); i++; continue; }
    if (c === "'") { push('′', { it: false }); i++; continue; }
    if (/[A-Za-z]/.test(c)) { push(c); i++; continue; }
    if (/[0-9.]/.test(c)) { let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++; push(s.slice(i, j), { it: false }); i = j; continue; }
    if (/[=<>+]/.test(c)) { push(` ${c} `, { it: false }); i++; continue; }
    push(c, { it: false }); i++;
  }
  return runs;
}

/** Parse "text with $math$" into runs. Supports \n line breaks (literal or "\\n"). */
export function parseRich(str, base = {}) {
  const lines = String(str).split(/\n|\\\\n|\\newline/);
  return lines.map((line) => {
    const runs = []; const parts = line.split(/(?<!\\)\$/);
    parts.forEach((p, k) => {
      if (k % 2 === 1) parseMath(p, { it: true, bf: !!base.bf, lv: 0 }, runs);
      else if (p) runs.push({ t: p.replace(/\\\$/g, '$'), it: !!base.it, bf: !!base.bf, lv: 0 });
    });
    // merge neighbours with identical style
    const out = [];
    for (const r of runs) { const l = out[out.length - 1]; if (l && l.it === r.it && l.bf === r.bf && l.lv === r.lv) l.t += r.t; else out.push({ ...r }); }
    return out;
  });
}

let MIN_FONT = 5;
// sub/superscripts shrink to 70 % in TeX; never let them fall below the journal minimum
const scriptSize = (size, lv) => (lv ? size * Math.min(0.9, Math.max(0.7, (MIN_FONT + 0.05) / size)) ** Math.abs(lv) : size);
function glyphW(ch, it, bf) {
  const key = bf ? (it ? 'bolditalic' : 'bold') : (it ? 'italic' : 'regular');
  const w = METRICS[key][ch];
  if (w !== undefined) return w;
  if (/[̀-ͯ⃐-⃿]/.test(ch)) return 0;      // combining accents
  if (ch.codePointAt(0) > 0xFFFF) return 700;                   // math alphanumerics (script letters)
  return METRICS._meta.default;
}
export function measureRuns(runs, size) {
  let w = 0;
  for (const r of runs) { const fs = scriptSize(size, r.lv); for (const ch of r.t) w += (glyphW(ch, r.it, r.bf) * fs) / 1000; }
  return w;
}
export function measure(str, size = 7, opts = {}) {
  return Math.max(0, ...parseRich(str, opts).map((l) => measureRuns(l, size)));
}

// ------------------------------------------------------------------ svg helpers
const f2 = (v) => (Math.abs(v) < 1e-9 ? '0' : (+v.toFixed(2)).toString());
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const attrs = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== false)
  .map(([k, v]) => `${k}="${typeof v === 'number' ? f2(v) : esc(v)}"`).join(' ');
const slug = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'x';

function textSVG(lines, { x, y, size, anchor = 'middle', color, font, weight, italic, id, lineGap = 1.22 }) {
  // y = baseline of first line
  const out = [];
  lines.forEach((runs, li) => {
    const by = y + li * size * lineGap;
    let cur = 0; const spans = [];
    for (const r of runs) {
      const fs = scriptSize(size, r.lv);
      const target = r.lv > 0 ? -0.36 * size * r.lv : r.lv < 0 ? 0.2 * size * -r.lv : 0;
      const dy = target - cur; cur = target;
      const a = { dy: Math.abs(dy) > 1e-6 ? f2(dy) : undefined, 'font-size': fs !== size ? f2(fs) : undefined,
        'font-style': r.it !== !!italic ? (r.it ? 'italic' : 'normal') : undefined,
        'font-weight': r.bf !== (weight === 'bold') ? (r.bf ? 'bold' : 'normal') : undefined };
      const plain = Object.values(a).every((v) => v === undefined);
      spans.push(plain ? esc(r.t) : `<tspan ${attrs(a)}>${esc(r.t)}</tspan>`);
    }
    out.push(`<text xml:space="preserve" ${attrs({ id: id ? (lines.length > 1 ? `${id}-l${li + 1}` : id) : undefined, x, y: by,
      'font-family': font, 'font-size': size, 'font-weight': weight === 'bold' ? 'bold' : undefined,
      'font-style': italic ? 'italic' : undefined, 'text-anchor': anchor, fill: color })}>${spans.join('')}</text>`);
  });
  return out.join('');
}

// Rounded rectangle path. corner 'g2' = curvature-continuous "smooth corners" (the iOS / Figma
// squircle construction): a circular arc of radius r in the middle of each corner, entered and left
// through cubic transitions whose curvature ramps up from 0 at the straight edge (G2 continuity).
// `smoothing` (0..1, iOS uses 0.6) sets how long the transitions are: the corner spans (1+s)*r.
// `r` is the *visual* radius, i.e. the circular radius it should look like. A G2 corner with the same
// arc radius reads tighter (full curvature only over the middle (1-s)*90 deg), so it is enlarged by
// `g2Scale` (default 1.3, chosen by side-by-side comparison) to match the circular look.
export function roundRectPath(x, y, w, h, r, corner = 'g2', smoothing = 0.6, g2Scale = 1.3) {
  const half = Math.min(w, h) / 2;
  if (corner === 'g2') r *= g2Scale;
  if (r <= 0) return `M${f2(x)},${f2(y)} H${f2(x + w)} V${f2(y + h)} H${f2(x)} Z`;
  if (corner !== 'g2') {
    r = Math.min(r, half);
    return `M${f2(x + r)},${f2(y)} H${f2(x + w - r)} A${f2(r)},${f2(r)} 0 0 1 ${f2(x + w)},${f2(y + r)} V${f2(y + h - r)}`
      + ` A${f2(r)},${f2(r)} 0 0 1 ${f2(x + w - r)},${f2(y + h)} H${f2(x + r)} A${f2(r)},${f2(r)} 0 0 1 ${f2(x)},${f2(y + h - r)}`
      + ` V${f2(y + r)} A${f2(r)},${f2(r)} 0 0 1 ${f2(x + r)},${f2(y)} Z`;
  }
  r = Math.min(r, half);
  let sm = Math.max(0, Math.min(smoothing, half / r - 1));      // keep the corner inside the box
  const P = (1 + sm) * r;
  const rad = (deg) => (deg * Math.PI) / 180;
  const arcMeasure = 90 * (1 - sm);
  const arcLen = Math.sin(rad(arcMeasure / 2)) * r * Math.SQRT2;
  const alpha = (90 - arcMeasure) / 2;
  const p34 = r * Math.tan(rad(alpha / 2));
  const beta = 45 * sm;
  const c = p34 * Math.cos(rad(beta));
  const d = c * Math.tan(rad(beta));
  const bb = (P - arcLen - c - d) / 3;
  const aa = 2 * bb;
  const A = `a${f2(r)},${f2(r)} 0 0 1`;
  return `M${f2(x + w - P)},${f2(y)}`
    + ` c${f2(aa)},0 ${f2(aa + bb)},0 ${f2(aa + bb + c)},${f2(d)} ${A} ${f2(arcLen)},${f2(arcLen)} c${f2(d)},${f2(c)} ${f2(d)},${f2(bb + c)} ${f2(d)},${f2(aa + bb + c)}`
    + ` L${f2(x + w)},${f2(y + h - P)}`
    + ` c0,${f2(aa)} 0,${f2(aa + bb)} ${f2(-d)},${f2(aa + bb + c)} ${A} ${f2(-arcLen)},${f2(arcLen)} c${f2(-c)},${f2(d)} ${f2(-(bb + c))},${f2(d)} ${f2(-(aa + bb + c))},${f2(d)}`
    + ` L${f2(x + P)},${f2(y + h)}`
    + ` c${f2(-aa)},0 ${f2(-(aa + bb))},0 ${f2(-(aa + bb + c))},${f2(-d)} ${A} ${f2(-arcLen)},${f2(-arcLen)} c${f2(-d)},${f2(-c)} ${f2(-d)},${f2(-(bb + c))} ${f2(-d)},${f2(-(aa + bb + c))}`
    + ` L${f2(x)},${f2(y + P)}`
    + ` c0,${f2(-aa)} 0,${f2(-(aa + bb))} ${f2(d)},${f2(-(aa + bb + c))} ${A} ${f2(arcLen)},${f2(-arcLen)} c${f2(c)},${f2(-d)} ${f2(bb + c)},${f2(-d)} ${f2(aa + bb + c)},${f2(-d)} Z`;
}

function roundedPolyline(pts, r) {
  if (pts.length < 2) return '';
  let d = `M${f2(pts[0][0])},${f2(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1], [cx, cy] = pts[i], [nx, ny] = pts[i + 1];
    const l1 = Math.hypot(cx - px, cy - py), l2 = Math.hypot(nx - cx, ny - cy);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    if (rr < 0.3) { d += ` L${f2(cx)},${f2(cy)}`; continue; }
    const ax = cx - ((cx - px) / l1) * rr, ay = cy - ((cy - py) / l1) * rr;
    const bx = cx + ((nx - cx) / l2) * rr, by = cy + ((ny - cy) / l2) * rr;
    d += ` L${f2(ax)},${f2(ay)} Q${f2(cx)},${f2(cy)} ${f2(bx)},${f2(by)}`;
  }
  const [lx, ly] = pts[pts.length - 1];
  return d + ` L${f2(lx)},${f2(ly)}`;
}

function arrowHead(tip, dir, len, width, color, kind = 'arrow') {
  const [ux, uy] = dir; const [px, py] = [-uy, ux];
  const [tx, ty] = tip;
  if (kind === 'dot') return `<circle ${attrs({ cx: tx - ux * 1.6, cy: ty - uy * 1.6, r: 1.6, fill: color })}/>`;
  if (kind === 'bar') return `<path ${attrs({ d: `M${f2(tx + px * 2.4)},${f2(ty + py * 2.4)} L${f2(tx - px * 2.4)},${f2(ty - py * 2.4)}`, stroke: color, 'stroke-width': 0.8, fill: 'none' })}/>`;
  if (kind === 'open') {
    const b1 = [tx - ux * len + (px * width) / 2, ty - uy * len + (py * width) / 2];
    const b2 = [tx - ux * len - (px * width) / 2, ty - uy * len - (py * width) / 2];
    return `<path ${attrs({ d: `M${f2(b1[0])},${f2(b1[1])} L${f2(tx)},${f2(ty)} L${f2(b2[0])},${f2(b2[1])}`, fill: 'none', stroke: color, 'stroke-width': 0.75, 'stroke-linejoin': 'miter' })}/>`;
  }
  const notch = len * 0.22;
  const b1 = [tx - ux * len + (px * width) / 2, ty - uy * len + (py * width) / 2];
  const b2 = [tx - ux * len - (px * width) / 2, ty - uy * len - (py * width) / 2];
  const n = [tx - ux * (len - notch), ty - uy * (len - notch)];
  return `<path ${attrs({ d: `M${f2(tx)},${f2(ty)} L${f2(b1[0])},${f2(b1[1])} L${f2(n[0])},${f2(n[1])} L${f2(b2[0])},${f2(b2[1])} Z`, fill: color })}/>`;
}

function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// pool-adjacent-violators: positions >= gap apart, least-squares to targets (sorted)
function spread(ys, gaps) {
  const blocks = [];
  ys.forEach((y, i) => {
    blocks.push({ s: i, n: 1, p: y });
    while (blocks.length > 1) {
      const b0 = blocks[blocks.length - 2], b1 = blocks[blocks.length - 1];
      const span0 = gaps.slice(b0.s, b0.s + b0.n).reduce((a, b) => a + b, 0);
      if (b0.p + span0 <= b1.p + 1e-9) break;
      const n = b0.n + b1.n; let acc = 0, off = 0;
      for (let k = 0; k < n; k++) { acc += ys[b0.s + k] - off; off += gaps[b0.s + k]; }
      blocks.splice(-2, 2, { s: b0.s, n, p: acc / n });
    }
  });
  const out = new Array(ys.length);
  for (const b of blocks) { let off = 0; for (let k = 0; k < b.n; k++) { out[b.s + k] = b.p + off; off += gaps[b.s + k]; } }
  return out;
}

// ------------------------------------------------------------------ geometry
const box = (n) => ({ x0: n.x - n.w / 2, y0: n.y - n.h / 2, x1: n.x + n.w / 2, y1: n.y + n.h / 2 });
const inter = (a, b, pad = 0) => a.x0 < b.x1 - pad && b.x0 < a.x1 - pad && a.y0 < b.y1 - pad && b.y0 < a.y1 - pad;
function segHitsBox(p, q, b) { // Liang-Barsky
  let t0 = 0, t1 = 1; const dx = q[0] - p[0], dy = q[1] - p[1];
  for (const [pp, qq] of [[-dx, p[0] - b.x0], [dx, b.x1 - p[0]], [-dy, p[1] - b.y0], [dy, b.y1 - p[1]]]) {
    if (Math.abs(pp) < 1e-12) { if (qq < 0) return false; } else { const r = qq / pp; if (pp < 0) t0 = Math.max(t0, r); else t1 = Math.min(t1, r); if (t0 > t1) return false; }
  }
  return true;
}
function segCross(a, b, c, d) {
  const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

// ================================================================== Diagram
export class Diagram {
  /**
   * @param {object} o
   *   width:  'single' | 'double' | 'onehalf' | number (mm)          default 'double'
   *   height: number (mm) | 'auto'                                    default 'auto'
   *   journal: 'nature' | 'science' | 'cell' | 'ieee' | 'neurips' | 'icml' | 'cvpr'
   *   margin: pt around content when height is auto (default 4)
   *   align: 'left' | 'center' — horizontal placement of content (default 'center')
   */
  constructor(o = {}) {
    this.theme = { ...THEMES[o.journal || 'nature'], ...(o.theme || {}) };
    MIN_FONT = this.theme.minSize;
    this.journal = o.journal || 'nature';
    if (o.palette) this.theme.palette = { ...this.theme.palette, ...o.palette };
    const w = o.width ?? 'double';
    this.widthMM = typeof w === 'string' ? this.theme.widths[w] : w;
    if (!this.widthMM) throw new Error(`unknown width '${w}' (${Object.keys(this.theme.widths).join(', ')})`);
    this.heightMM = o.height ?? 'auto';
    this.W = this.widthMM * MM;
    this.margin = o.margin ?? 4;
    this.align = o.align || 'center';
    this.title = o.title || 'diagram';
    this.items = new Map();   // id -> node-like
    this.order = [];
    this.edges = [];
    this.groups = [];
    this.extras = [];         // braces, notes, legends, zooms, labels, free shapes
    this.layouts = [];
    this.grids = {};
    this._seq = 0;
  }

  // ---------------------------------------------------------------- nodes
  _add(id, kind, o) {
    if (this.items.has(id)) throw new Error(`duplicate id '${id}'`);
    const n = { id, kind, ...o };
    this.items.set(id, n); this.order.push(id);
    return this;
  }

  /** Box node. label/sub accept $math$ and \n. shape: rect|pill|circle|ellipse|diamond|cylinder|doc|io|hexagon|plain */
  node(id, o = {}) {
    const th = this.theme, size = o.size ?? th.size, small = o.subSize ?? th.small;
    const label = parseRich(o.label ?? id, { bf: !!o.bold || !!o.emphasis });
    const sub = o.sub ? parseRich(o.sub) : [];
    const tw = Math.max(0, ...label.map((l) => measureRuns(l, size)), ...sub.map((l) => measureRuns(l, small)));
    const th_ = label.length * size * th.lineHeight + sub.length * small * th.lineHeight + (sub.length ? 1.5 : 0);
    const shape = o.shape || 'rect';
    let w = o.w ?? Math.max(o.minW ?? th.minW, tw + 2 * (o.padX ?? th.padX));
    let h = o.h ?? Math.max(o.minH ?? th.minH, th_ + 2 * (o.padY ?? th.padY) - size * 0.25);
    if (shape === 'circle') { const dmt = Math.max(w, h, o.d ?? 0); w = h = o.w ?? dmt; }
    if (shape === 'diamond' && o.w === undefined) { w *= 1.45; h *= 1.35; }
    if (shape === 'hexagon' && o.w === undefined) w += 8;
    if (shape === 'io' && o.w === undefined) w += 8;
    if (shape === 'cylinder' && o.h === undefined) h += 5;
    return this._add(id, 'node', { ...o, shape, label, sub, size, small, w: Math.ceil(w), h: Math.ceil(h), textW: tw });
  }

  /** Small operator circle: symbol '+', 'x', '.', or any short text ('σ', '‖'). */
  op(id, o = {}) {
    const d = o.d ?? 10;
    return this._add(id, 'op', { ...o, w: d, h: d, symbol: o.symbol ?? '+' });
  }

  /** Heat-map matrix glyph. pattern: random|lowrank|diag|sparse|causal|band; values: 2-D array in [0,1]. */
  matrix(id, o = {}) {
    const rows = o.rows ?? (o.values ? o.values.length : 5), cols = o.cols ?? (o.values ? o.values[0].length : 5);
    const cell = o.cell ?? 4.2;
    return this._add(id, 'matrix', { ...o, rows, cols, cell, w: cols * cell, h: rows * cell, labelBelow: o.label });
  }

  /** Column/row vector glyph (embeddings, parameters). */
  vector(id, o = {}) {
    const n = o.n ?? (o.values ? o.values.length : 6), cell = o.cell ?? 4.2, orient = o.orient ?? 'v';
    return this._add(id, 'vector', { ...o, n, cell, orient, w: orient === 'v' ? cell : n * cell, h: orient === 'v' ? n * cell : cell, labelBelow: o.label });
  }

  /** Stacked slabs (feature maps / batches / tensors). */
  tensor(id, o = {}) {
    const depth = o.depth ?? 4, sw = o.sw ?? 16, sh = o.sh ?? 22, dx = o.dx ?? 3.2, dy = o.dy ?? -3.2;
    return this._add(id, 'tensor', { ...o, depth, sw, sh, dx, dy, w: sw + dx * (depth - 1), h: sh + Math.abs(dy) * (depth - 1), labelBelow: o.label });
  }

  /** Mini line-chart glyph. series: arrays of numbers, or presets 'decay','noisy','rise','sine','bell','step'. */
  plot(id, o = {}) {
    return this._add(id, 'plot', { ...o, w: o.w ?? 38, h: o.h ?? 24, labelBelow: o.label });
  }

  /** Mini graph glyph. n nodes on a circle (or `points`), `edges` as [i,j] pairs (default: random sparse). */
  graph(id, o = {}) {
    return this._add(id, 'graph', { ...o, w: o.w ?? 34, h: o.h ?? 30, labelBelow: o.label });
  }

  /** Fully connected network glyph. layers: e.g. [3, 5, 5, 2]. */
  mlp(id, o = {}) {
    return this._add(id, 'mlp', { ...o, layers: o.layers ?? [3, 4, 4, 2], w: o.w ?? 40, h: o.h ?? 30, labelBelow: o.label });
  }

  /** Dashed placeholder box for a photo/plot to be pasted later (keeps the SVG editable). */
  placeholder(id, o = {}) {
    return this._add(id, 'placeholder', { ...o, w: o.w ?? 50, h: o.h ?? 36, text: o.text ?? 'image' });
  }

  /** Free text block (annotation, column header). anchor: start|middle|end; positioned like nodes. */
  text(id, o = {}) {
    const size = o.size ?? this.theme.small;
    const lines = parseRich(o.text ?? id, { bf: o.weight === 'bold', it: !!o.italic });
    const w = Math.max(...lines.map((l) => measureRuns(l, size)));
    const h = lines.length * size * this.theme.lineHeight;
    return this._add(id, 'text', { ...o, lines, size, w, h });
  }

  /** Make several nodes the same width and/or height (largest wins). */
  sameSize(ids, which = 'both') {
    const ns = ids.map((i) => this._get(i));
    const W = Math.max(...ns.map((n) => n.w)), H = Math.max(...ns.map((n) => n.h));
    for (const n of ns) { if (which !== 'h') n.w = W; if (which !== 'w') n.h = H; }
    return this;
  }

  /** Define a placement grid (centers, pt): d.grid({x0, y0, dx, dy}) then node(id, {at: [col, row]}). */
  grid(o = {}, name = 'default') { this.grids[name] = { x0: o.x0 ?? 40, y0: o.y0 ?? 30, dx: o.dx ?? 70, dy: o.dy ?? 40, cols: o.cols, rows: o.rows }; return this; }

  // ---------------------------------------------------------------- connectors & annotations
  /** Arrow between two items. See references/diagram-api.md for all options. */
  edge(from, to, o = {}) { this.edges.push({ from, to, ...o, idx: this.edges.length }); return this; }
  /** Chain: d.chain(['a','b','c'], opts) == edges a->b, b->c. */
  chain(ids, o = {}) { for (let i = 0; i + 1 < ids.length; i++) this.edge(ids[i], ids[i + 1], o); return this; }
  /** Container behind a set of items. */
  group(id, members, o = {}) { this.groups.push({ id, members, ...o }); return this; }
  /** Curly brace spanning items. side: top|bottom|left|right */
  brace(members, o = {}) { this.extras.push({ kind: 'brace', members, ...o }); return this; }
  /** Callout text with a leader line to an item. */
  note(target, text, o = {}) { this.extras.push({ kind: 'note', target, text, ...o }); return this; }
  /** Overview -> detail: dashed outline on `source` and connector lines to `detail` (item or group id). */
  zoom(source, detail, o = {}) { this.extras.push({ kind: 'zoom', source, detail, ...o }); return this; }
  /** Legend entries [{tone, label, kind: 'box'|'line'|'dashed'|'arrow'}]; placed at x,y (pt) or 'bottom'. */
  legend(items, o = {}) { this.extras.push({ kind: 'legend', items, ...o }); return this; }
  /** Panel label (a, b, ...) at x,y (pt, top-left of the panel). */
  panel(label, o = {}) { this.extras.push({ kind: 'panel', label, ...o }); return this; }
  /** Numbered step badge attached to an item corner. */
  badge(target, n, o = {}) { this.extras.push({ kind: 'badge', target, n, ...o }); return this; }
  /** Automatic layered layout (Sugiyama-lite) for all items without a position. dir: LR|TB */
  layout(o = {}) { this.layouts.push(o); return this; }

  _get(id) {
    const n = this.items.get(id);
    if (!n) throw new Error(`unknown item '${id}'. Known: ${[...this.items.keys()].join(', ')}`);
    return n;
  }

  // ---------------------------------------------------------------- placement
  _place() {
    const th = this.theme;
    const placed = new Set();
    const rel = (n) => ['right', 'left', 'above', 'below'].find((k) => n[k] !== undefined);
    for (const id of this.order) {
      const n = this.items.get(id);
      if (n.x !== undefined && n.y !== undefined) placed.add(id);
      else if (Array.isArray(n.at)) {
        const g = this.grids[n.grid || 'default'];
        if (!g) throw new Error(`item '${id}' uses at:[col,row] but no grid is defined (call d.grid({...}))`);
        n.x = g.x0 + n.at[0] * g.dx; n.y = g.y0 + n.at[1] * g.dy; placed.add(id);
      }
    }
    // auto layout for free items
    const free = this.order.filter((id) => !placed.has(id) && !rel(this.items.get(id)));
    if (free.length) {
      const L = this.layouts[0] || { dir: 'LR' };
      this._autoLayout(free, L);
      free.forEach((id) => placed.add(id));
    }
    // relative placement (recursive)
    const visiting = new Set();
    const resolve = (id) => {
      if (placed.has(id)) return;
      const n = this._get(id);
      const k = rel(n);
      if (!k) throw new Error(`item '${id}' has no position`);
      if (visiting.has(id)) throw new Error(`circular relative placement at '${id}'`);
      visiting.add(id);
      const refs = Array.isArray(n[k]) ? n[k] : [n[k]];
      refs.forEach(resolve);
      const rs = refs.map((r) => this._get(r));
      const gap = n.gap ?? th.gap;
      const bb = { x0: Math.min(...rs.map((r) => box(r).x0)), x1: Math.max(...rs.map((r) => box(r).x1)),
        y0: Math.min(...rs.map((r) => box(r).y0)), y1: Math.max(...rs.map((r) => box(r).y1)) };
      const cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2;
      const ex = this._extent(n);
      if (k === 'right' || k === 'left') {
        n.x = k === 'right' ? bb.x1 + gap + ex.l : bb.x0 - gap - ex.r;
        n.y = n.align === 'top' ? bb.y0 + n.h / 2 : n.align === 'bottom' ? bb.y1 - n.h / 2 : cy;
      } else {
        n.y = k === 'below' ? bb.y1 + gap + ex.t : bb.y0 - gap - ex.b;
        n.x = n.align === 'left' ? bb.x0 + n.w / 2 : n.align === 'right' ? bb.x1 - n.w / 2 : cx;
      }
      n.x += n.dx ?? 0; n.y += n.dy ?? 0;
      visiting.delete(id); placed.add(id);
    };
    for (const id of this.order) resolve(id);
  }

  // extents beyond the w/h box (labels under glyphs); relative placement keeps them clear
  _extent(n) {
    if (!n.labelBelow) return { l: n.w / 2, r: n.w / 2, t: n.h / 2, b: n.h / 2 };
    const lines = parseRich(n.labelBelow);
    const below = this.theme.small * 1.25 * lines.length + 3;
    const half = Math.max(n.w, ...lines.map((l) => measureRuns(l, this.theme.small))) / 2;
    return { l: half, r: half, t: n.h / 2, b: n.h / 2 + below };
  }

  _autoLayout(ids, o) {
    const th = this.theme, dir = o.dir || 'LR', rankGap = o.rankGap ?? th.gap + 6, nodeGap = o.nodeGap ?? 10;
    const set = new Set(ids);
    const E = this.edges.filter((e) => set.has(e.from) && set.has(e.to) && !e.feedback && !['above', 'below', 'left', 'right'].includes(e.route));
    const succ = new Map(ids.map((i) => [i, []])), pred = new Map(ids.map((i) => [i, []]));
    // break cycles with DFS
    const state = new Map(); const back = new Set();
    const dfs = (u) => { state.set(u, 1); for (const e of E.filter((e) => e.from === u)) { const s = state.get(e.to);
      if (s === 1) back.add(e); else if (!s) dfs(e.to); } state.set(u, 2); };
    ids.forEach((i) => { if (!state.get(i)) dfs(i); });
    for (const e of E) if (!back.has(e)) { succ.get(e.from).push(e.to); pred.get(e.to).push(e.from); }
    const rank = new Map();
    const rk = (u) => { if (rank.has(u)) return rank.get(u); const r = pred.get(u).length ? Math.max(...pred.get(u).map(rk)) + 1 : 0; rank.set(u, r); return r; };
    ids.forEach(rk);
    for (const i of ids) if (this.items.get(i).rank !== undefined) rank.set(i, this.items.get(i).rank);
    const R = Math.max(...rank.values()) + 1;
    const layers = Array.from({ length: R }, () => []);
    ids.forEach((i) => layers[rank.get(i)].push(i));
    const along = (n) => (dir === 'LR' ? n.w : n.h), across = (n) => (dir === 'LR' ? n.h : n.w);
    // order: barycenter sweeps
    const pos = new Map();
    const setPos = () => layers.forEach((L) => L.forEach((i, k) => pos.set(i, k)));
    setPos();
    for (let sweep = 0; sweep < 6; sweep++) {
      const down = sweep % 2 === 0;
      const rs = down ? [...Array(R).keys()].slice(1) : [...Array(R).keys()].reverse().slice(1);
      for (const r of rs) {
        const nb = down ? pred : succ;
        const bc = (i) => { const ns = nb.get(i); return ns.length ? ns.reduce((a, j) => a + pos.get(j), 0) / ns.length : pos.get(i); };
        layers[r].sort((a, b) => bc(a) - bc(b)); setPos();
      }
    }
    // coordinates
    const x0 = o.x0 ?? 20, y0 = o.y0 ?? 30;
    let acc = x0;
    const rankC = layers.map((L) => { const m = Math.max(...L.map((i) => along(this.items.get(i)))); const c = acc + m / 2; acc += m + rankGap; return c; });
    const cross = new Map();
    layers.forEach((L) => {
      let total = L.reduce((a, i) => a + across(this.items.get(i)), 0) + nodeGap * (L.length - 1);
      let c = -total / 2;
      for (const i of L) { const s = across(this.items.get(i)); cross.set(i, c + s / 2); c += s + nodeGap; }
    });
    // straighten: pull nodes toward neighbours, keep spacing (PAV)
    for (let it = 0; it < 8; it++) {
      layers.forEach((L, r) => {
        const tgt = L.map((i) => { const ns = [...pred.get(i), ...succ.get(i)]; return ns.length ? ns.reduce((a, j) => a + cross.get(j), 0) / ns.length : cross.get(i); });
        const gaps = L.map((i, k) => (k + 1 < L.length ? (across(this.items.get(i)) + across(this.items.get(L[k + 1]))) / 2 + nodeGap : 0));
        const res = spread(tgt, gaps); L.forEach((i, k) => cross.set(i, res[k]));
      });
    }
    const all = [...cross.values()]; const mid = (Math.min(...all) + Math.max(...all)) / 2;
    ids.forEach((i) => { const n = this.items.get(i); const a = rankC[rank.get(i)], c = cross.get(i) - mid;
      if (dir === 'LR') { n.x = a; n.y = y0 + c; } else { n.x = y0 + c; n.y = a; } });
  }

  // ---------------------------------------------------------------- ports & routing
  _anchorOf(ref) { // 'id' | 'id.right' | {x,y}
    if (typeof ref === 'object') return { pt: [ref.x, ref.y], node: null, side: ref.side };
    const [id, side] = ref.split('.');
    return { node: this._get(id), side };
  }
  _port(n, side, off = 0) {
    const b = box(n);
    if (n.kind === 'op' || n.shape === 'circle') {
      const r = n.w / 2, a = { right: 0, left: Math.PI, top: -Math.PI / 2, bottom: Math.PI / 2 }[side];
      return [n.x + r * Math.cos(a) + (side === 'top' || side === 'bottom' ? off : 0), n.y + r * Math.sin(a) + (side === 'left' || side === 'right' ? off : 0)];
    }
    if (n.shape === 'diamond') return { right: [b.x1, n.y], left: [b.x0, n.y], top: [n.x, b.y0], bottom: [n.x, b.y1] }[side];
    if (n.shape === 'io') return { right: [b.x1 - 2, n.y + off], left: [b.x0 + 2, n.y + off], top: [n.x + off, b.y0], bottom: [n.x + off, b.y1] }[side];
    return { right: [b.x1, n.y + off], left: [b.x0, n.y + off], top: [n.x + off, b.y0], bottom: [n.x + off, b.y1] }[side];
  }
  _autoSides(a, b) {
    const A = box(a), B = box(b);
    const gx = Math.max(B.x0 - A.x1, A.x0 - B.x1), gy = Math.max(B.y0 - A.y1, A.y0 - B.y1);
    if (gx >= gy) return b.x > a.x ? ['right', 'left'] : ['left', 'right'];
    return b.y > a.y ? ['bottom', 'top'] : ['top', 'bottom'];
  }
  _route(e) {
    const th = this.theme;
    const A = this._anchorOf(e.from), B = this._anchorOf(e.to);
    const na = A.node, nb = B.node;
    let sa = e.fromSide || A.side, sb = e.toSide || B.side;
    const route = e.route || 'auto';
    const detour = ['above', 'below', 'left', 'right'].includes(route) ? route : null;
    if (detour) {
      const s = { above: 'top', below: 'bottom', left: 'left', right: 'right' }[detour];
      sa = sa || s; sb = sb || s;
    }
    // free points behave like zero-size nodes for side selection
    const pa = na || { x: A.pt[0], y: A.pt[1], w: 0, h: 0 }, pb = nb || { x: B.pt[0], y: B.pt[1], w: 0, h: 0 };
    if (!sa || !sb) { const [x, y] = this._autoSides(pa, pb); sa = sa || x; sb = sb || y; }
    const p1 = na ? this._port(na, sa, e.fromOffset ?? 0) : A.pt;
    const p2 = nb ? this._port(nb, sb, e.toOffset ?? 0) : B.pt;
    const H = (s) => s === 'left' || s === 'right';
    let pts;
    if (route === 'straight') pts = [p1, p2];
    else if (route === 'curve') { e._curve = true; pts = [p1, p2]; }
    else if (detour) {
      // Detour just far enough to clear the items *near* the two endpoints: start one
      // clearance beyond the endpoints and push outward only while an item in the corridor
      // would be hit. Items further away (another row, a detail panel) are ignored.
      const cl = e.clearance ?? 9;
      const xs = [p1[0], p2[0]], ys = [p1[1], p2[1]];
      const full = [...this.items.values()].filter((n) => n.x !== undefined)
        .map((n) => ({ n, b: this._fullBox(n) }));
      if (detour === 'below' || detour === 'above') {
        const lo = Math.min(...xs) - 1, hi = Math.max(...xs) + 1;
        const inX = full.filter(({ b }) => b.x1 > lo && b.x0 < hi);
        const sgn = detour === 'below' ? 1 : -1;
        let yy = (sgn > 0 ? Math.max(...ys) : Math.min(...ys)) + sgn * cl;
        for (let it = 0; it < 20; it++) {
          // an item is in the way if it reaches into [yy - cl, yy + cl/2] (mirrored for 'above')
          const hit = inX.filter(({ b }) => (sgn > 0 ? b.y0 < yy + cl * 0.5 && b.y1 > yy - cl : b.y1 > yy - cl * 0.5 && b.y0 < yy + cl));
          if (!hit.length) break;
          const nyy = sgn > 0 ? Math.max(...hit.map(({ b }) => b.y1)) + cl : Math.min(...hit.map(({ b }) => b.y0)) - cl;
          if (Math.abs(nyy - yy) < 0.01) break;
          yy = sgn > 0 ? Math.max(yy, nyy) : Math.min(yy, nyy);
        }
        pts = [p1, [p1[0], yy], [p2[0], yy], p2];
      } else {
        const lo = Math.min(...ys) - 1, hi = Math.max(...ys) + 1;
        const inY = full.filter(({ b }) => b.y1 > lo && b.y0 < hi);
        const sgn = detour === 'right' ? 1 : -1;
        let xx = (sgn > 0 ? Math.max(...xs) : Math.min(...xs)) + sgn * cl;
        for (let it = 0; it < 20; it++) {
          const hit = inY.filter(({ b }) => (sgn > 0 ? b.x0 < xx + cl * 0.5 && b.x1 > xx - cl : b.x1 > xx - cl * 0.5 && b.x0 < xx + cl));
          if (!hit.length) break;
          const nxx = sgn > 0 ? Math.max(...hit.map(({ b }) => b.x1)) + cl : Math.min(...hit.map(({ b }) => b.x0)) - cl;
          if (Math.abs(nxx - xx) < 0.01) break;
          xx = sgn > 0 ? Math.max(xx, nxx) : Math.min(xx, nxx);
        }
        pts = [p1, [xx, p1[1]], [xx, p2[1]], p2];
      }
    } else {
      const aligned = H(sa) ? Math.abs(p1[1] - p2[1]) < 0.6 : Math.abs(p1[0] - p2[0]) < 0.6;
      if (aligned && H(sa) === H(sb)) pts = [p1, H(sa) ? [p2[0], p1[1]] : [p1[0], p2[1]]];
      else if (H(sa) && H(sb)) { const t = e.bend ?? 0.5; const mx = p1[0] + (p2[0] - p1[0]) * t; pts = [p1, [mx, p1[1]], [mx, p2[1]], p2]; }
      else if (!H(sa) && !H(sb)) { const t = e.bend ?? 0.5; const my = p1[1] + (p2[1] - p1[1]) * t; pts = [p1, [p1[0], my], [p2[0], my], p2]; }
      else if (H(sa)) pts = [p1, [p2[0], p1[1]], p2];
      else pts = [p1, [p1[0], p2[1]], p2];
    }
    e._pts = pts.map((p) => [p[0], p[1]]); e._sa = sa; e._sb = sb;
    return e;
  }

  // ---------------------------------------------------------------- render pieces
  _tone(n) { return toneOf(n.tone, this.theme); }

  _nodeSVG(n) {
    const th = this.theme, t = this._tone(n);
    const b = box(n), r = n.radius ?? th.radius;
    const fill = n.fill ?? (n.emphasis ? t.fillStrong : t.fill);
    const stroke = n.stroke ?? (n.emphasis ? t.stroke : (t.name === 'grey' ? t.stroke : mix(t.stroke, '#FFFFFF', 0.15)));
    const sw = n.strokeWidth ?? (n.emphasis ? th.strokeStrong : th.stroke);
    const dash = n.dashed ? '2.2 1.6' : undefined;
    const common = { fill, stroke, 'stroke-width': sw, 'stroke-dasharray': dash };
    let shape = '';
    const { x0, y0, x1, y1 } = b, w = n.w, h = n.h;
    switch (n.shape) {
      case 'plain': shape = ''; break;
      case 'pill': shape = `<rect ${attrs({ x: x0, y: y0, width: w, height: h, rx: h / 2, ...common })}/>`; break;
      case 'circle': shape = `<circle ${attrs({ cx: n.x, cy: n.y, r: w / 2, ...common })}/>`; break;
      case 'ellipse': shape = `<ellipse ${attrs({ cx: n.x, cy: n.y, rx: w / 2, ry: h / 2, ...common })}/>`; break;
      case 'diamond': shape = `<path ${attrs({ d: `M${f2(n.x)},${f2(y0)} L${f2(x1)},${f2(n.y)} L${f2(n.x)},${f2(y1)} L${f2(x0)},${f2(n.y)} Z`, ...common, 'stroke-linejoin': 'round' })}/>`; break;
      case 'hexagon': { const k = 5; shape = `<path ${attrs({ d: `M${f2(x0 + k)},${f2(y0)} L${f2(x1 - k)},${f2(y0)} L${f2(x1)},${f2(n.y)} L${f2(x1 - k)},${f2(y1)} L${f2(x0 + k)},${f2(y1)} L${f2(x0)},${f2(n.y)} Z`, ...common, 'stroke-linejoin': 'round' })}/>`; break; }
      case 'io': { const k = 4; shape = `<path ${attrs({ d: `M${f2(x0 + k)},${f2(y0)} L${f2(x1)},${f2(y0)} L${f2(x1 - k)},${f2(y1)} L${f2(x0)},${f2(y1)} Z`, ...common, 'stroke-linejoin': 'round' })}/>`; break; }
      case 'cylinder': { const ry = 2.6;
        shape = `<path ${attrs({ d: `M${f2(x0)},${f2(y0 + ry)} L${f2(x0)},${f2(y1 - ry)} A${f2(w / 2)},${f2(ry)} 0 0 0 ${f2(x1)},${f2(y1 - ry)} L${f2(x1)},${f2(y0 + ry)}`, ...common })}/>`
          + `<ellipse ${attrs({ cx: n.x, cy: y0 + ry, rx: w / 2, ry, ...common })}/>`; break; }
      case 'doc': { const k = 5;
        shape = `<path ${attrs({ d: `M${f2(x0)},${f2(y0)} L${f2(x1 - k)},${f2(y0)} L${f2(x1)},${f2(y0 + k)} L${f2(x1)},${f2(y1)} L${f2(x0)},${f2(y1)} Z`, ...common, 'stroke-linejoin': 'round' })}/>`
          + `<path ${attrs({ d: `M${f2(x1 - k)},${f2(y0)} L${f2(x1 - k)},${f2(y0 + k)} L${f2(x1)},${f2(y0 + k)}`, fill: 'none', stroke, 'stroke-width': sw * 0.8 })}/>`; break; }
      default: shape = `<path ${attrs({ d: roundRectPath(x0, y0, w, h, r, n.corner ?? th.corner, n.smoothing ?? th.smoothing, th.g2Scale), ...common })}/>`;
    }
    // text block, vertically centred on cap height
    const cap = METRICS._meta.capHeight / 1000;
    const L = n.label.length, S = n.sub.length;
    const lh = n.size * th.lineHeight, sh = n.small * th.lineHeight;
    const blockH = (L - 1) * lh + cap * n.size + (S ? 1.5 + S * sh : 0);
    const yShift = n.shape === 'cylinder' ? 2.6 : 0;
    const by = n.y + yShift - blockH / 2 + cap * n.size;
    let tx = n.x, anchor = 'middle';
    if (n.textAlign === 'left') { tx = x0 + (n.padX ?? th.padX); anchor = 'start'; }
    let txt = textSVG(n.label, { x: tx, y: by, size: n.size, anchor, color: th.ink, font: th.font,
      weight: n.emphasis || n.bold ? 'bold' : undefined, lineGap: th.lineHeight });
    if (S) txt += textSVG(n.sub, { x: tx, y: by + (L - 1) * lh + 1.5 + sh, size: n.small, anchor, color: th.muted, font: th.font, lineGap: th.lineHeight });
    return `<g id="${esc('node-' + slug(n.id))}">${shape}${txt}</g>`;
  }

  _opSVG(n) {
    const th = this.theme, t = this._tone(n), r = n.w / 2;
    const stroke = t.name === 'grey' ? th.muted : t.stroke;
    let s = `<circle ${attrs({ cx: n.x, cy: n.y, r, fill: n.fill ?? (t.name === 'grey' ? '#FFFFFF' : t.fill), stroke, 'stroke-width': th.stroke })}/>`;
    const k = r * 0.52, sw = 0.8;
    const sym = n.symbol;
    if (sym === '+' || sym === 'x' || sym === '×') {
      const rot = sym === '+' ? 0 : Math.PI / 4;
      for (const a of [rot, rot + Math.PI / 2]) {
        const dx = Math.cos(a) * k, dy = Math.sin(a) * k;
        s += `<path ${attrs({ d: `M${f2(n.x - dx)},${f2(n.y - dy)} L${f2(n.x + dx)},${f2(n.y + dy)}`, stroke: th.ink, 'stroke-width': sw, 'stroke-linecap': 'round' })}/>`;
      }
    } else if (sym === '.' || sym === '·') {
      s += `<circle ${attrs({ cx: n.x, cy: n.y, r: 1.1, fill: th.ink })}/>`;
    } else {
      const size = n.size ?? th.small; const runs = parseRich(sym);
      s += textSVG(runs, { x: n.x, y: n.y + (METRICS._meta.capHeight / 1000) * size / 2, size, color: th.ink, font: th.font });
    }
    return `<g id="${esc('op-' + slug(n.id))}">${s}</g>`;
  }

  _rampColor(t, v) { // sequential ramp light -> base -> dark
    v = Math.max(0, Math.min(1, v));
    return v < 0.6 ? mix(tint(t.base, 0.9), t.base, v / 0.6) : mix(t.base, shade(t.base, 0.45), (v - 0.6) / 0.4);
  }

  _matrixValues(n) {
    if (n.values) return n.values;
    const rnd = mulberry32(n.seed ?? (this._seq++ * 7919 + 17));
    const R = n.rows, C = n.cols, p = n.pattern || 'random';
    const u = Array.from({ length: R }, rnd), v = Array.from({ length: C }, rnd);
    return Array.from({ length: R }, (_, i) => Array.from({ length: C }, (_, j) => {
      switch (p) {
        case 'lowrank': return 0.15 + 0.85 * u[i] * v[j];
        case 'diag': return i === j ? 0.95 : 0.08 + 0.15 * rnd();
        case 'band': return Math.abs(i - j) <= 1 ? 0.85 - 0.3 * Math.abs(i - j) : 0.05 + 0.1 * rnd();
        case 'sparse': return rnd() < 0.22 ? 0.5 + 0.5 * rnd() : 0.04;
        case 'causal': return j <= i ? 0.2 + 0.8 * rnd() ** 1.5 : -1;
        case 'attention': { const r = j <= i ? Math.exp(-((i - j) ** 2) / 4) * (0.6 + 0.4 * rnd()) : -1; return r; }
        default: return rnd();
      }
    }));
  }

  _labelBelow(n) {
    if (!n.labelBelow) return '';
    const th = this.theme; const lines = parseRich(n.labelBelow);
    const cap = METRICS._meta.capHeight / 1000;
    return textSVG(lines, { x: n.x, y: n.y + n.h / 2 + 3 + cap * th.small, size: th.small, color: th.muted, font: th.font, lineGap: 1.25 });
  }

  _glyphSVG(n) {
    const th = this.theme, t = this._tone(n), b = box(n);
    let s = '';
    if (n.kind === 'matrix') {
      const V = this._matrixValues(n);
      for (let i = 0; i < n.rows; i++) for (let j = 0; j < n.cols; j++) {
        const v = V[i][j];
        s += `<rect ${attrs({ x: b.x0 + j * n.cell, y: b.y0 + i * n.cell, width: n.cell, height: n.cell,
          fill: v < 0 ? '#FFFFFF' : this._rampColor(t, v), stroke: '#FFFFFF', 'stroke-width': 0.35 })}/>`;
      }
      s += `<rect ${attrs({ x: b.x0, y: b.y0, width: n.w, height: n.h, fill: 'none', stroke: n.frame ?? th.muted, 'stroke-width': 0.5 })}/>`;
    } else if (n.kind === 'vector') {
      const rnd = mulberry32(n.seed ?? (this._seq++ * 104729 + 3));
      for (let i = 0; i < n.n; i++) {
        const v = n.values ? n.values[i] : rnd();
        const [x, y] = n.orient === 'v' ? [b.x0, b.y0 + i * n.cell] : [b.x0 + i * n.cell, b.y0];
        s += `<rect ${attrs({ x, y, width: n.cell, height: n.cell, fill: this._rampColor(t, v), stroke: '#FFFFFF', 'stroke-width': 0.35 })}/>`;
      }
      s += `<rect ${attrs({ x: b.x0, y: b.y0, width: n.w, height: n.h, fill: 'none', stroke: th.muted, 'stroke-width': 0.5 })}/>`;
    } else if (n.kind === 'tensor') {
      for (let k = n.depth - 1; k >= 0; k--) {
        const x = b.x0 + k * n.dx, y = b.y1 - n.sh + k * n.dy;
        const fill = k === 0 ? t.fillStrong : mix(t.fill, '#FFFFFF', 0.25 * (k / n.depth));
        s += `<rect ${attrs({ x, y, width: n.sw, height: n.sh, rx: 0.8, fill, stroke: t.name === 'grey' ? th.faint : t.stroke, 'stroke-width': 0.55 })}/>`;
      }
    } else if (n.kind === 'plot') {
      const pad = 2, X0 = b.x0 + pad, X1 = b.x1 - pad, Y0 = b.y0 + pad, Y1 = b.y1 - pad;
      if (n.frame !== false) s += `<path ${attrs({ d: `M${f2(X0)},${f2(Y0)} L${f2(X0)},${f2(Y1)} L${f2(X1)},${f2(Y1)}`, fill: 'none', stroke: th.muted, 'stroke-width': 0.5 })}/>`;
      const presets = {
        decay: (x) => Math.exp(-4 * x) * 0.9 + 0.05, noisy: (x, r) => Math.exp(-3.5 * x) * 0.85 + 0.08 + (r() - 0.5) * 0.12 * (1 - x * 0.5),
        rise: (x) => 0.9 - Math.exp(-4 * x) * 0.85, sine: (x) => 0.5 + 0.38 * Math.sin(x * 2 * Math.PI * 1.5),
        bell: (x) => 0.08 + 0.85 * Math.exp(-((x - 0.5) ** 2) / 0.02), step: (x) => (x < 0.35 ? 0.2 : x < 0.7 ? 0.55 : 0.85),
      };
      const series = n.series ?? ['decay'];
      const tones = n.tones ?? [n.tone ?? 'primary', 'neutral', 'secondary'];
      series.forEach((ser, k) => {
        const rnd = mulberry32(31 * (k + 1) + (n.seed ?? 1));
        const ys = Array.isArray(ser) ? ser : Array.from({ length: 40 }, (_, i) => presets[ser](i / 39, rnd));
        const mn = n.ymin ?? Math.min(0, ...ys), mx = n.ymax ?? Math.max(1, ...ys);
        const pts = ys.map((y, i) => [X0 + 1.5 + ((X1 - X0 - 2) * i) / (ys.length - 1), Y1 - 1.5 - ((Y1 - Y0 - 3) * (y - mn)) / (mx - mn)]);
        const tc = toneOf(tones[k % tones.length], th);
        s += `<path ${attrs({ d: 'M' + pts.map((p) => `${f2(p[0])},${f2(p[1])}`).join(' L'), fill: 'none', stroke: tc.name === 'grey' ? th.faint : tc.base, 'stroke-width': 0.9, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' })}/>`;
      });
    } else if (n.kind === 'graph') {
      const rnd = mulberry32(n.seed ?? 5);
      const N = n.points ? n.points.length : (n.n ?? 7);
      const P = n.points ? n.points.map(([u, v]) => [b.x0 + u * n.w, b.y0 + v * n.h])
        : Array.from({ length: N }, (_, i) => { const a = (2 * Math.PI * i) / N - Math.PI / 2; const j = 0.82 + 0.18 * rnd();
          return [n.x + Math.cos(a) * (n.w / 2 - 3) * j, n.y + Math.sin(a) * (n.h / 2 - 3) * j]; });
      const Ed = n.edges ?? (() => { const out = []; for (let i = 0; i < N; i++) { out.push([i, (i + 1) % N]); if (rnd() < 0.45) out.push([i, (i + 2 + Math.floor(rnd() * (N - 3))) % N]); } return out; })();
      for (const [i, j] of Ed) s += `<path ${attrs({ d: `M${f2(P[i][0])},${f2(P[i][1])} L${f2(P[j][0])},${f2(P[j][1])}`, stroke: th.faint, 'stroke-width': 0.5 })}/>`;
      const hl = new Set(n.highlight ?? []);
      P.forEach((p, i) => { s += `<circle ${attrs({ cx: p[0], cy: p[1], r: n.r ?? 2.1, fill: hl.has(i) ? toneOf('accent', th).base : t.fillStrong, stroke: hl.has(i) ? '#FFFFFF' : t.stroke, 'stroke-width': 0.5 })}/>`; });
    } else if (n.kind === 'mlp') {
      const Ls = n.layers, cols = Ls.length;
      const xs = Ls.map((_, i) => b.x0 + 3 + ((n.w - 6) * i) / Math.max(1, cols - 1));
      const pos = Ls.map((k, i) => Array.from({ length: k }, (_, j) => [xs[i], n.y + (j - (k - 1) / 2) * Math.min(6.5, (n.h - 6) / Math.max(...Ls))]));
      for (let i = 0; i + 1 < cols; i++) for (const p of pos[i]) for (const q of pos[i + 1])
        s += `<path ${attrs({ d: `M${f2(p[0])},${f2(p[1])} L${f2(q[0])},${f2(q[1])}`, stroke: th.guide, 'stroke-width': 0.35 })}/>`;
      pos.forEach((col) => col.forEach((p) => { s += `<circle ${attrs({ cx: p[0], cy: p[1], r: n.r ?? 2.0, fill: t.fill, stroke: t.name === 'grey' ? th.faint : t.stroke, 'stroke-width': 0.5 })}/>`; }));
    } else if (n.kind === 'placeholder') {
      s += `<rect ${attrs({ x: b.x0, y: b.y0, width: n.w, height: n.h, fill: '#FAFAFA', stroke: th.faint, 'stroke-width': 0.5, 'stroke-dasharray': '2 1.5' })}/>`;
      s += `<path ${attrs({ d: `M${f2(b.x0)},${f2(b.y0)} L${f2(b.x1)},${f2(b.y1)} M${f2(b.x1)},${f2(b.y0)} L${f2(b.x0)},${f2(b.y1)}`, stroke: '#E0E0E0', 'stroke-width': 0.4 })}/>`;
      s += textSVG(parseRich(n.text), { x: n.x, y: n.y + 2, size: th.small, color: th.muted, font: th.font });
    }
    s += this._labelBelow(n);
    return `<g id="${esc(n.kind + '-' + slug(n.id))}">${s}</g>`;
  }

  _textItemSVG(n) {
    const th = this.theme, cap = METRICS._meta.capHeight / 1000;
    const anchor = n.anchor || 'middle';
    const x = anchor === 'start' ? n.x - n.w / 2 : anchor === 'end' ? n.x + n.w / 2 : n.x;
    const by = n.y - n.h / 2 + cap * n.size + (n.size * (th.lineHeight - 1)) / 2;
    return `<g id="${esc('text-' + slug(n.id))}">${textSVG(n.lines, { x, y: by, size: n.size, anchor, color: n.color ?? th.ink, font: th.font, weight: n.weight, italic: n.italic, lineGap: th.lineHeight })}</g>`;
  }

  _edgeSVG(e) {
    const th = this.theme, E = th.edge;
    const tone = e.tone ? toneOf(e.tone, th) : null;
    const color = e.color ?? (tone ? (tone.name === 'grey' ? th.muted : tone.base) : E.color);
    const width = e.width ?? (e.emphasis ? 1.1 : E.width);
    const head = e.head ?? 'arrow', tail = e.tail ?? (head === 'both' ? 'arrow' : 'none');
    const headKind = head === 'both' ? 'arrow' : head;
    const hl = (e.headScale ?? 1) * E.headLen * (width > 0.9 ? 1.12 : 1), hw = (e.headScale ?? 1) * E.headWidth * (width > 0.9 ? 1.12 : 1);
    const pts = e._pts.map((p) => [...p]);
    const dir = (a, b) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
    let d, dEnd, dStart;
    const nrm = { right: [1, 0], left: [-1, 0], top: [0, -1], bottom: [0, 1] };
    if (e._curve) {
      const [p1, p2] = pts; const L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]); const k = (e.curvature ?? 0.45) * L;
      const n1 = nrm[e._sa] || dir(p1, p2), n2 = nrm[e._sb] || dir(p2, p1);
      const c1 = [p1[0] + n1[0] * k, p1[1] + n1[1] * k], c2 = [p2[0] + n2[0] * k, p2[1] + n2[1] * k];
      dEnd = dir(c2, p2); dStart = dir(c1, p1);
      const q2 = headKind === 'arrow' ? [p2[0] - dEnd[0] * hl * 0.75, p2[1] - dEnd[1] * hl * 0.75] : p2;
      const q1 = tail === 'arrow' ? [p1[0] - dStart[0] * hl * 0.75, p1[1] - dStart[1] * hl * 0.75] : p1;
      d = `M${f2(q1[0])},${f2(q1[1])} C${f2(c1[0])},${f2(c1[1])} ${f2(c2[0])},${f2(c2[1])} ${f2(q2[0])},${f2(q2[1])}`;
      e._samples = Array.from({ length: 21 }, (_, i) => { const t = i / 20, u = 1 - t;
        return [u ** 3 * p1[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t ** 3 * p2[0], u ** 3 * p1[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t ** 3 * p2[1]]; });
    } else {
      dEnd = dir(pts[pts.length - 2], pts[pts.length - 1]); dStart = dir(pts[1], pts[0]);
      if (headKind === 'arrow' || headKind === 'open') { const last = pts[pts.length - 1]; pts[pts.length - 1] = [last[0] - dEnd[0] * hl * 0.75, last[1] - dEnd[1] * hl * 0.75]; }
      if (tail === 'arrow') pts[0] = [pts[0][0] - dStart[0] * hl * 0.75, pts[0][1] - dStart[1] * hl * 0.75];
      d = roundedPolyline(pts, e.corner ?? E.corner);
      e._samples = e._pts;
    }
    const dash = e.style === 'dashed' ? '3 2' : e.style === 'dotted' ? '0.8 1.6' : undefined;
    let s = `<path ${attrs({ d, fill: 'none', stroke: color, 'stroke-width': width, 'stroke-dasharray': dash, 'stroke-linecap': e.style === 'dotted' ? 'round' : 'butt', 'stroke-linejoin': 'round' })}/>`;
    if (headKind !== 'none') s += arrowHead(e._pts[e._pts.length - 1], dEnd, hl, hw, color, headKind);
    if (tail === 'arrow') s += arrowHead(e._pts[0], dStart, hl, hw, color, 'arrow');
    // label
    if (e.label) {
      const size = e.labelSize ?? th.small; const lines = parseRich(e.label, { it: !!e.labelItalic });
      const tw = Math.max(...lines.map((l) => measureRuns(l, size))); const lh = size * 1.2;
      const [lx, ly, horiz] = this._labelAnchor(e);
      const cap = METRICS._meta.capHeight / 1000;
      const side = e.labelSide ?? (e.route === 'below' ? 'below' : e.route === 'above' ? 'above' : horiz ? 'above' : 'right');
      let x = lx, y, anchor = 'middle';
      const blockH = (lines.length - 1) * lh + cap * size;
      if (side === 'center') { y = ly - blockH / 2 + cap * size; }
      else if (side === 'above') { y = ly - 2.6 - (lines.length - 1) * lh; }
      else if (side === 'below') { y = ly + 2.6 + cap * size; }
      else if (side === 'right') { x = lx + 3; anchor = 'start'; y = ly - blockH / 2 + cap * size; }
      else { x = lx - 3; anchor = 'end'; y = ly - blockH / 2 + cap * size; }
      const bx0 = anchor === 'start' ? x : anchor === 'end' ? x - tw : x - tw / 2;
      e._labelBox = { x0: bx0, y0: y - cap * size, x1: bx0 + tw, y1: y + (lines.length - 1) * lh + 0.22 * size };
      if (side === 'center' || e.labelBg) s += `<rect ${attrs({ x: e._labelBox.x0 - 1.5, y: e._labelBox.y0 - 1.2, width: tw + 3, height: e._labelBox.y1 - e._labelBox.y0 + 2.4, fill: e.labelBg ?? '#FFFFFF' })}/>`;
      s += textSVG(lines, { x, y, size, anchor, color: th.muted, font: th.font, italic: !!e.labelItalic, lineGap: 1.2 });
    }
    let name = `edge-${slug(typeof e.from === 'string' ? e.from : 'p')}-${slug(typeof e.to === 'string' ? e.to : 'p')}`;
    this._usedIds = this._usedIds || new Map();
    const k = this._usedIds.get(name) || 0; this._usedIds.set(name, k + 1);
    if (k) name += `-${k + 1}`;
    return `<g id="${esc(name)}">${s}</g>`;
  }

  _labelAnchor(e) {
    const P = e._samples;
    if (e._curve) { const i = Math.round((e.labelPos ?? 0.5) * (P.length - 1)); const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
      return [P[i][0], P[i][1], Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1])]; }
    const segs = []; let tot = 0;
    for (let i = 0; i + 1 < P.length; i++) { const l = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]); segs.push([P[i], P[i + 1], l, tot]); tot += l; }
    if (e.labelPos !== undefined) {
      const target = e.labelPos * tot;
      for (const [a, b, l, s0] of segs) if (target <= s0 + l + 1e-9) { const t = l ? (target - s0) / l : 0;
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1])]; }
    }
    // default: middle of the longest segment (prefer horizontal for detours: the long run)
    const best = segs.reduce((m, s) => (s[2] > m[2] ? s : m), segs[0]);
    const [a, b] = best; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1])];
  }

  _groupBox(g) {
    const pad = g.pad ?? 7, th = this.theme;
    const ms = g.members.map((m) => {
      const gg = this.groups.find((x) => x.id === m);
      if (gg) { if (!gg._box) this._groupBox(gg); return gg._box; }
      return this._fullBox(this._get(m));
    });
    // edges that start and end inside the group (e.g. a feedback loop) belong inside it too
    const mem = new Set(this._groupMembers(g));
    for (const e of this.edges) {
      const ends = [e.from, e.to].map((v) => (typeof v === 'string' ? v.split('.')[0] : null));
      if (!e._pts || !ends.every((v) => v && mem.has(v))) continue;
      for (const p of (e._samples || e._pts)) ms.push({ x0: p[0], y0: p[1], x1: p[0], y1: p[1] });
      if (e._labelBox) ms.push(e._labelBox);
    }
    const top = g.label && (g.labelPos ?? 'top-left').startsWith('top') ? th.small * 1.25 + 3 : 0;
    const bot = g.label && (g.labelPos ?? '').startsWith('bottom') ? th.small * 1.25 + 3 : 0;
    g._box = { x0: Math.min(...ms.map((b) => b.x0)) - (g.padX ?? pad), y0: Math.min(...ms.map((b) => b.y0)) - pad - top,
      x1: Math.max(...ms.map((b) => b.x1)) + (g.padX ?? pad), y1: Math.max(...ms.map((b) => b.y1)) + pad + bot };
    if (g.minW) { const w = g._box.x1 - g._box.x0; if (w < g.minW) { g._box.x0 -= (g.minW - w) / 2; g._box.x1 += (g.minW - w) / 2; } }
    return g._box;
  }

  _groupSVG(g) {
    const th = this.theme, t = toneOf(g.tone ?? 'neutral', th), b = g._box;
    const fill = g.fill === false ? 'none' : (g.fill ?? (t.name === 'grey' ? '#F5F5F5' : t.soft));
    const stroke = g.stroke ?? (g.dashed ? (t.name === 'grey' ? th.faint : mix(t.stroke, '#FFFFFF', 0.2)) : 'none');
    let s = `<path ${attrs({ d: roundRectPath(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, g.radius ?? 4, g.corner ?? th.corner, g.smoothing ?? th.smoothing, th.g2Scale), fill, stroke, 'stroke-width': stroke === 'none' ? undefined : 0.6, 'stroke-dasharray': g.dashed ? '2.5 1.8' : undefined })}/>`;
    if (g.label) {
      const lp = g.labelPos ?? 'top-left', size = th.small, cap = METRICS._meta.capHeight / 1000;
      const runs = parseRich(g.label, { bf: g.labelBold !== false });
      const x = lp.endsWith('left') ? b.x0 + 5 : lp.endsWith('right') ? b.x1 - 5 : (b.x0 + b.x1) / 2;
      const anchor = lp.endsWith('left') ? 'start' : lp.endsWith('right') ? 'end' : 'middle';
      const y = lp.startsWith('top') ? b.y0 + 3 + cap * size : b.y1 - 3.2;
      let dot = '';
      if (g.labelDot !== false && t.name !== 'grey' && anchor === 'start') {
        dot = `<rect ${attrs({ x: x, y: y - cap * size, width: cap * size, height: cap * size, rx: 0.8, fill: t.base })}/>`;
      }
      const tx = dot ? x + cap * size + 2.2 : x;
      s += dot + textSVG(runs, { x: tx, y, size, anchor, color: th.ink, font: th.font, weight: g.labelBold === false ? undefined : 'bold' });
      const tw = measureRuns(runs[0], size) + (dot ? cap * size + 2.2 : 0);
      const lx0 = anchor === 'start' ? x : anchor === 'end' ? x - tw : x - tw / 2;
      g._labelBox = { x0: lx0, y0: y - cap * size, x1: lx0 + tw, y1: y + 0.22 * size };
    }
    return `<g id="${esc('group-' + slug(g.id))}">${s}</g>`;
  }

  _bboxOf(ref) {
    if (Array.isArray(ref)) { const bs = ref.map((r) => this._bboxOf(r)); return { x0: Math.min(...bs.map((b) => b.x0)), y0: Math.min(...bs.map((b) => b.y0)), x1: Math.max(...bs.map((b) => b.x1)), y1: Math.max(...bs.map((b) => b.y1)) }; }
    const g = this.groups.find((x) => x.id === ref); if (g) return g._box;
    return box(this._get(ref));
  }

  _extraSVG(x) {
    const th = this.theme, cap = METRICS._meta.capHeight / 1000;
    if (x.kind === 'brace') {
      const b = this._bboxOf(x.members), side = x.side ?? 'bottom', off = x.offset ?? 4, depth = x.depth ?? 4.5;
      let p, q, dirn; // brace from p to q, bulging in dirn
      if (side === 'bottom') { p = [b.x0, b.y1 + off]; q = [b.x1, b.y1 + off]; dirn = [0, 1]; }
      else if (side === 'top') { p = [b.x0, b.y0 - off]; q = [b.x1, b.y0 - off]; dirn = [0, -1]; }
      else if (side === 'left') { p = [b.x0 - off, b.y0]; q = [b.x0 - off, b.y1]; dirn = [-1, 0]; }
      else { p = [b.x1 + off, b.y0]; q = [b.x1 + off, b.y1]; dirn = [1, 0]; }
      const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], h = depth / 2;
      const P = (pt, k) => [pt[0] + dirn[0] * k, pt[1] + dirn[1] * k];
      const a1 = P(p, h), m1 = P(m, h), tip = P(m, depth), a2 = P(q, h);
      const d = `M${f2(p[0])},${f2(p[1])} Q${f2(P(p, h)[0])},${f2(P(p, h)[1])} ${f2((a1[0] * 3 + m1[0]) / 4)},${f2((a1[1] * 3 + m1[1]) / 4)}`
        + ` L${f2((a1[0] + m1[0] * 3) / 4)},${f2((a1[1] + m1[1] * 3) / 4)} Q${f2(m1[0])},${f2(m1[1])} ${f2(tip[0])},${f2(tip[1])}`
        + ` Q${f2(m1[0])},${f2(m1[1])} ${f2((a2[0] + m1[0] * 3) / 4)},${f2((a2[1] + m1[1] * 3) / 4)}`
        + ` L${f2((a2[0] * 3 + m1[0]) / 4)},${f2((a2[1] * 3 + m1[1]) / 4)} Q${f2(P(q, h)[0])},${f2(P(q, h)[1])} ${f2(q[0])},${f2(q[1])}`;
      let s = `<path ${attrs({ d, fill: 'none', stroke: th.muted, 'stroke-width': 0.6, 'stroke-linejoin': 'round' })}/>`;
      if (x.label) {
        const lines = parseRich(x.label), size = th.small;
        const lx = tip[0] + dirn[0] * 3, ly = tip[1] + dirn[1] * 3;
        const anchor = side === 'left' ? 'end' : side === 'right' ? 'start' : 'middle';
        const y = side === 'bottom' ? ly + cap * size : side === 'top' ? ly - (lines.length - 1) * size * 1.2 : ly + (cap * size) / 2 - ((lines.length - 1) * size * 1.2) / 2;
        s += textSVG(lines, { x: lx, y, size, anchor, color: th.muted, font: th.font, lineGap: 1.2 });
        const tw = Math.max(...lines.map((l) => measureRuns(l, size)));
        const bx0 = anchor === 'middle' ? lx - tw / 2 : anchor === 'end' ? lx - tw : lx;
        x._labelBox = { x0: bx0, y0: y - cap * size, x1: bx0 + tw, y1: y + (lines.length - 1) * size * 1.2 + 0.22 * size };
      }
      return `<g id="brace-${slug(x.label || 'x')}">${s}</g>`;
    }
    if (x.kind === 'note') {
      const b = this._bboxOf(x.target), side = x.side ?? 'top', dist = x.dist ?? 12;
      const lines = parseRich(x.text, { it: x.italic !== false }), size = x.size ?? th.small;
      const tw = Math.max(...lines.map((l) => measureRuns(l, size)));
      const cx = (b.x0 + b.x1) / 2 + (x.dx ?? 0), cy = (b.y0 + b.y1) / 2 + (x.dy ?? 0);
      let start, tp, anchor = 'middle', ty;
      if (side === 'top') { start = [cx, b.y0 - 1.5]; tp = [cx, b.y0 - dist]; ty = tp[1] - 2 - (lines.length - 1) * size * 1.2; }
      else if (side === 'bottom') { start = [cx, b.y1 + 1.5]; tp = [cx, b.y1 + dist]; ty = tp[1] + 2 + cap * size; }
      else if (side === 'right') { start = [b.x1 + 1.5, cy]; tp = [b.x1 + dist, cy]; anchor = 'start'; ty = cy + (cap * size) / 2 - ((lines.length - 1) * size * 1.2) / 2; }
      else { start = [b.x0 - 1.5, cy]; tp = [b.x0 - dist, cy]; anchor = 'end'; ty = cy + (cap * size) / 2 - ((lines.length - 1) * size * 1.2) / 2; }
      const txx = anchor === 'start' ? tp[0] + 2 : anchor === 'end' ? tp[0] - 2 : tp[0];
      let s = `<path ${attrs({ d: `M${f2(start[0])},${f2(start[1])} L${f2(tp[0])},${f2(tp[1])}`, stroke: th.faint, 'stroke-width': 0.5 })}/>`;
      s += `<circle ${attrs({ cx: start[0], cy: start[1], r: 0.9, fill: th.faint })}/>`;
      s += textSVG(lines, { x: txx, y: ty, size, anchor, color: th.muted, font: th.font, italic: x.italic !== false, lineGap: 1.2 });
      const bx0 = anchor === 'start' ? txx : anchor === 'end' ? txx - tw : txx - tw / 2;
      x._labelBox = { x0: bx0, y0: ty - cap * size, x1: bx0 + tw, y1: ty + (lines.length - 1) * size * 1.2 };
      return `<g id="note-${slug(x.text).slice(0, 24)}">${s}</g>`;
    }
    if (x.kind === 'zoom') {
      const a = this._bboxOf(x.source), b = this._bboxOf(x.detail), pad = x.pad ?? 2.5;
      const A = { x0: a.x0 - pad, y0: a.y0 - pad, x1: a.x1 + pad, y1: a.y1 + pad };
      let s = `<rect ${attrs({ x: A.x0, y: A.y0, width: A.x1 - A.x0, height: A.y1 - A.y0, rx: 2, fill: 'none', stroke: th.faint, 'stroke-width': 0.6, 'stroke-dasharray': '2 1.5' })}/>`;
      let pairs;
      if (b.y0 >= A.y1) pairs = [[[A.x0, A.y1], [b.x0, b.y0]], [[A.x1, A.y1], [b.x1, b.y0]]];
      else if (b.y1 <= A.y0) pairs = [[[A.x0, A.y0], [b.x0, b.y1]], [[A.x1, A.y0], [b.x1, b.y1]]];
      else if (b.x0 >= A.x1) pairs = [[[A.x1, A.y0], [b.x0, b.y0]], [[A.x1, A.y1], [b.x0, b.y1]]];
      else pairs = [[[A.x0, A.y0], [b.x1, b.y0]], [[A.x0, A.y1], [b.x1, b.y1]]];
      for (const [p, q] of pairs) s += `<path ${attrs({ d: `M${f2(p[0])},${f2(p[1])} L${f2(q[0])},${f2(q[1])}`, stroke: th.faint, 'stroke-width': 0.5, 'stroke-dasharray': '2 1.5' })}/>`;
      x._segs = pairs;
      return `<g id="zoom-${slug(x.source)}">${s}</g>`;
    }
    if (x.kind === 'legend') {
      const size = th.small, gap = x.gap ?? 10; let cx = x.x ?? 0; const y = x.y ?? 0; let s = '';
      for (const it of x.items) {
        const t = toneOf(it.tone ?? 'neutral', th); const kind = it.kind ?? 'box';
        if (kind === 'box') s += `<rect ${attrs({ x: cx, y: y - 3.2, width: 7, height: 5, rx: 1, fill: t.fill, stroke: t.name === 'grey' ? t.stroke : t.stroke, 'stroke-width': 0.6 })}/>`;
        else { const col = t.name === 'grey' ? th.muted : t.base;
          s += `<path ${attrs({ d: `M${f2(cx)},${f2(y - 0.7)} L${f2(cx + (kind === 'arrow' ? 6 : 9))},${f2(y - 0.7)}`, stroke: col, 'stroke-width': 0.9, 'stroke-dasharray': kind === 'dashed' ? '2.4 1.6' : undefined })}/>`;
          if (kind === 'arrow') s += arrowHead([cx + 10, y - 0.7], [1, 0], 4, 3.2, col); }
        const runs = parseRich(it.label); const tw = measureRuns(runs[0], size);
        s += textSVG(runs, { x: cx + 12, y: y + (cap * size) / 2 - 0.7, size, anchor: 'start', color: th.ink, font: th.font });
        cx += 12 + tw + gap;
      }
      x._labelBox = { x0: x.x ?? 0, y0: y - 4, x1: cx - gap, y1: y + 3 };
      return `<g id="legend">${s}</g>`;
    }
    if (x.kind === 'panel') {
      const size = th.label, lab = th.labelCase === 'upper' ? x.label.toUpperCase() : x.label;
      return `<g id="label-${slug(x.label)}">${textSVG([[{ t: lab, it: false, bf: true, lv: 0 }]], { x: x.x ?? 0, y: (x.y ?? 0) + cap * size, size, anchor: 'start', color: th.ink, font: th.font, weight: 'bold' })}</g>`;
    }
    if (x.kind === 'badge') {
      const b = this._bboxOf(x.target), r = x.r ?? 4.2, corner = x.corner ?? 'top-left';
      const cx = corner.endsWith('left') ? b.x0 : b.x1, cy = corner.startsWith('top') ? b.y0 : b.y1;
      const t = toneOf(x.tone ?? 'ink', { ...th, palette: { ...th.palette, ink: th.ink } });
      return `<g id="badge-${x.n}"><circle ${attrs({ cx, cy, r, fill: x.tone ? t.base : th.ink, stroke: '#FFFFFF', 'stroke-width': 0.8 })}/>`
        + textSVG([[{ t: String(x.n), it: false, bf: true, lv: 0 }]], { x: cx, y: cy + cap * 5.5 / 2, size: 5.5, color: '#FFFFFF', font: th.font, weight: 'bold' }) + '</g>';
    }
    return '';
  }

  // ---------------------------------------------------------------- lint
  // every text block and shape with its bounding box (after render)
  _registry() {
    const th = this.theme, cap = METRICS._meta.capHeight / 1000;
    const shapes = [], texts = [];
    for (const n of this.items.values()) {
      if (n.kind === 'text') { texts.push({ owner: n.id, what: `text '${n.id}'`, b: box(n) }); continue; }
      shapes.push({ id: n.id, b: box(n) });
      if (n.labelBelow) {
        const lines = parseRich(n.labelBelow); const w = Math.max(...lines.map((l) => measureRuns(l, th.small)));
        const y0 = n.y + n.h / 2 + 3;
        texts.push({ owner: n.id, what: `label of '${n.id}'`, b: { x0: n.x - w / 2, x1: n.x + w / 2, y0, y1: y0 + cap * th.small + (lines.length - 1) * th.small * 1.25 + 0.22 * th.small } });
      }
    }
    for (const e of this.edges) if (e._labelBox) texts.push({ owner: e, what: `edge label '${e.label}'`, b: e._labelBox });
    for (const g of this.groups) if (g._labelBox) texts.push({ owner: g.id, what: `group label '${g.label}'`, b: g._labelBox });
    for (const x of this.extras) if (x._labelBox) texts.push({ owner: x, what: `${x.kind} '${x.text || x.label || ''}'`, b: x._labelBox });
    return { shapes, texts };
  }

  lint() {
    const th = this.theme, issues = [];
    const add = (level, code, msg) => issues.push({ level, code, msg });
    const nodes = [...this.items.values()];
    const { shapes, texts } = this._registry();
    const shrink = (b, k) => ({ x0: b.x0 + k, y0: b.y0 + k, x1: b.x1 - k, y1: b.y1 - k });
    // 1. shapes overlapping shapes
    for (let i = 0; i < shapes.length; i++) for (let j = i + 1; j < shapes.length; j++)
      if (inter(shapes[i].b, shapes[j].b, 0.5)) add('ERROR', 'overlap', `'${shapes[i].id}' overlaps '${shapes[j].id}'`);
    // 2. text vs text, 3. text vs shapes it does not belong to
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++)
        if (texts[i].owner !== texts[j].owner && inter(texts[i].b, texts[j].b, 0.3)) add('ERROR', 'text-overlap', `${texts[i].what} overlaps ${texts[j].what}`);
      for (const sh of shapes) if (sh.id !== texts[i].owner && inter(texts[i].b, sh.b, 0.3)) add('ERROR', 'text-on-shape', `${texts[i].what} overlaps '${sh.id}'`);
    }
    // 4. text overflow in boxes
    for (const n of nodes) if (n.kind === 'node' && n.shape !== 'plain') {
      const avail = n.w - (n.shape === 'diamond' ? n.w * 0.45 : n.shape === 'circle' ? 4 : 2 * 2.5);
      if (n.textW > avail + 0.5) add('ERROR', 'text-overflow', `label of '${n.id}' (${n.textW.toFixed(1)} pt) does not fit width ${n.w} pt`);
    }
    // 5. canvas
    const H = this._H;
    for (const it of [...shapes.map((s) => [s.id, s.b]), ...texts.map((t) => [t.what, t.b])]) {
      const [name, b] = it;
      if (b.x0 < -0.5 || b.x1 > this.W + 0.5 || b.y0 < -0.5 || b.y1 > H + 0.5)
        add('ERROR', 'outside', `${name} extends beyond the ${this.widthMM} x ${(H / MM).toFixed(0)} mm canvas`);
    }
    // 6. edges through shapes / over text / through foreign groups
    const groupMem = new Map(this.groups.map((g) => [g.id, new Set(this._groupMembers(g))]));
    let crossings = 0;
    for (const e of this.edges) {
      const ends = new Set([typeof e.from === 'string' ? e.from.split('.')[0] : null, typeof e.to === 'string' ? e.to.split('.')[0] : null]);
      const P = e._samples, nm = `edge ${typeof e.from === 'string' ? e.from : 'point'}->${typeof e.to === 'string' ? e.to : 'point'}`;
      const hits = (b) => { for (let k = 0; k + 1 < P.length; k++) if (segHitsBox(P[k], P[k + 1], b)) return true; return false; };
      let len = 0; for (let k = 0; k + 1 < P.length; k++) len += Math.hypot(P[k + 1][0] - P[k][0], P[k + 1][1] - P[k][1]);
      if (len < 2.4 * th.edge.headLen + (e.label ? measure(e.label, th.small) * (e.labelSide === 'center' ? 1 : 0) : 0))
        add('WARN', 'edge-short', `${nm} is only ${len.toFixed(1)} pt long — increase the gap between the items`);
      for (const sh of shapes) if (!ends.has(sh.id) && hits(shrink(sh.b, 1))) add('WARN', 'edge-through', `${nm} passes through '${sh.id}' (reroute: route/fromSide/toSide/clearance, or move items)`);
      for (const t of texts) if (t.owner !== e && hits(shrink(t.b, 0.4))) add('WARN', 'edge-over-text', `${nm} crosses ${t.what}`);
      for (const g of this.groups) {
        const mem = groupMem.get(g.id);
        if ([...ends].some((x) => x && mem.has(x))) continue;
        if (hits(shrink(g._box, 1))) add('WARN', 'edge-through-group', `${nm} cuts through group '${g.id}'`);
      }
    }
    for (let i = 0; i < this.edges.length; i++) for (let j = i + 1; j < this.edges.length; j++) {
      const A = this.edges[i]._samples, B = this.edges[j]._samples;
      for (let a = 0; a + 1 < A.length; a++) for (let b = 0; b + 1 < B.length; b++) if (segCross(A[a], A[a + 1], B[b], B[b + 1])) crossings++;
    }
    for (const z of this.extras.filter((x) => x.kind === 'zoom' && x._segs)) for (const [p, q] of z._segs)
      for (const t of texts) if (segHitsBox(p, q, shrink(t.b, 0.4))) add('WARN', 'zoom-over-text', `zoom connector from '${z.source}' crosses ${t.what}`);
    if (crossings) add('INFO', 'crossings', `${crossings} edge crossing(s); rearrange or reroute if they confuse the reading order`);
    // 7. groups: intruders and overlaps
    for (const g of this.groups) {
      const mem = groupMem.get(g.id);
      for (const sh of shapes) if (!mem.has(sh.id) && inter(g._box, sh.b, 0.5)) add('WARN', 'group-intrusion', `'${sh.id}' intrudes into group '${g.id}'`);
      const subGroups = new Set();
      const collect = (gg) => gg.members.forEach((m) => { const x = this.groups.find((q) => q.id === m); if (x) { subGroups.add(x.id); collect(x); } });
      collect(g);
      const belongs = (o) => {
        if (o === g.id || mem.has(o) || subGroups.has(o)) return true;
        if (o && typeof o === 'object') {
          const ids = [o.from, o.to, o.target, ...(o.members || [])].filter((v) => typeof v === 'string').map((v) => v.split('.')[0]);
          return ids.length > 0 && ids.some((v) => mem.has(v));
        }
        return false;
      };
      for (const t of texts) if (!belongs(t.owner) && inter(g._box, t.b, 0.5))
        add('WARN', 'group-intrusion', `${t.what} intrudes into group '${g.id}'`);
    }
    for (let i = 0; i < this.groups.length; i++) for (let j = i + 1; j < this.groups.length; j++) {
      const a = this.groups[i], b = this.groups[j];
      const nested = groupMem.get(a.id).has(b.id) || a.members.includes(b.id) || b.members.includes(a.id)
        || [...groupMem.get(b.id)].every((m) => groupMem.get(a.id).has(m)) || [...groupMem.get(a.id)].every((m) => groupMem.get(b.id).has(m));
      if (!nested && inter(a._box, b._box, 0.5)) add('WARN', 'group-overlap', `groups '${a.id}' and '${b.id}' overlap`);
    }
    // 8. fonts, colors, size
    for (const n of nodes) { const s = n.size ?? th.size; if (s < th.minSize) add('ERROR', 'font-min', `'${n.id}' text ${s} pt < ${th.minSize} pt`); }
    const tones = new Set([...nodes.map((n) => n.tone), ...this.groups.map((g) => g.tone), ...this.edges.map((e) => e.tone)]
      .filter(Boolean).map((t) => TONE_ALIAS[t] || t).filter((t) => t !== 'grey'));
    if (tones.size > 4) add('WARN', 'too-many-tones', `${tones.size} hues (${[...tones].join(', ')}); use <= 3 + grey, each with one meaning`);
    if (H / MM > th.maxHeight) add('WARN', 'height', `diagram is ${(H / MM).toFixed(0)} mm tall (> ${th.maxHeight} mm)`);
    // de-duplicate
    const seen = new Set();
    return issues.filter((i) => { const k = i.level + i.msg; if (seen.has(k)) return false; seen.add(k); return true; });
  }
  _groupMembers(g) { return g.members.flatMap((m) => { const gg = this.groups.find((x) => x.id === m); return gg ? this._groupMembers(gg) : [m]; }); }
  _fullBox(n) { const ex = this._extent(n); return { x0: n.x - ex.l, x1: n.x + ex.r, y0: n.y - ex.t, y1: n.y + ex.b }; }

  // ---------------------------------------------------------------- output
  render() {
    this._place();
    // content bounds (before routing, to shift to canvas)
    for (const e of this.edges) this._route(e);
    this._usedIds = new Map();
    for (const e of this.edges) this._edgeSVG(e);          // fills samples + label boxes
    for (const g of this.groups) g._box = null;
    for (const g of [...this.groups]) if (!g._box) this._groupBox(g);
    const parts = { groups: [], edges: [], nodes: [], annotations: [], labels: [] };
    // render edges once to collect label boxes & samples, then bounds
    const edgeSVG = this.edges.map((e) => this._edgeSVG(e));
    const autoLegends = this.extras.filter((x) => x.kind === 'legend' && (x.at === 'bottom' || x.at === 'top' || (x.x === undefined && x.y === undefined)));
    const extraSVG = this.extras.filter((x) => !autoLegends.includes(x)).map((x) => this._extraSVG(x));
    const bb = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    const grow = (b) => { if (!b) return; bb.x0 = Math.min(bb.x0, b.x0); bb.y0 = Math.min(bb.y0, b.y0); bb.x1 = Math.max(bb.x1, b.x1); bb.y1 = Math.max(bb.y1, b.y1); };
    for (const n of this.items.values()) grow(this._fullBox(n));
    for (const g of this.groups) grow(g._box);
    for (const e of this.edges) { for (const p of e._samples) grow({ x0: p[0] - 2, y0: p[1] - 2, x1: p[0] + 2, y1: p[1] + 2 }); grow(e._labelBox); }
    for (const x of this.extras) { if (autoLegends.includes(x)) continue; grow(x._labelBox); if (x.kind === 'brace') { const b = this._bboxOf(x.members); grow({ x0: b.x0, y0: b.y0 - (x.side === 'top' ? 12 : 0), x1: b.x1, y1: b.y1 + (x.side === 'bottom' ? 12 : 0) }); } }
    // legends without coordinates go under (or above) everything, left-aligned with the content
    for (const x of autoLegends) {
      x.x = bb.x0 + (x.dx ?? 0);
      x.y = x.at === 'top' ? bb.y0 - 8 : bb.y1 + (x.gapAbove ?? 9);
      this._extraSVG(x);
      if (x.align === 'center') { const w = x._labelBox.x1 - x._labelBox.x0; x.x = (bb.x0 + bb.x1) / 2 - w / 2; this._extraSVG(x); }
      grow(x._labelBox);
    }
    // shift content so it sits inside the canvas with the margin
    const m = this.margin;
    const cw = bb.x1 - bb.x0;
    let sx = this.align === 'left' || cw + 2 * m > this.W ? m - bb.x0 : (this.W - cw) / 2 - bb.x0;
    const hasPanel = this.extras.some((x) => x.kind === 'panel' && x.relative !== true);
    const sy = m - bb.y0 + (hasPanel ? this.theme.label * 0.75 + 3 : 0);
    if (hasPanel && this.heightMM === 'auto') bb.y1 += this.theme.label * 0.75 + 3;
    if (this._noShift) { sx = 0; }
    this._shift(sx, this._noShift ? 0 : sy);
    this._H = this.heightMM === 'auto' ? bb.y1 - bb.y0 + 2 * m : this.heightMM * MM;
    // re-render everything at final coordinates
    for (const e of this.edges) this._route(e);
    this._usedIds = new Map();
    for (const e of this.edges) this._edgeSVG(e);
    for (const g of this.groups) g._box = null;
    for (const g of this.groups) if (!g._box) this._groupBox(g);
    const sortedGroups = [...this.groups].sort((a, b) => (b._box.x1 - b._box.x0) * (b._box.y1 - b._box.y0) - (a._box.x1 - a._box.x0) * (a._box.y1 - a._box.y0));
    parts.groups = sortedGroups.map((g) => this._groupSVG(g));
    this._usedIds = new Map();
    parts.edges = this.edges.map((e) => this._edgeSVG(e));
    for (const id of this.order) {
      const n = this.items.get(id);
      parts.nodes.push(n.kind === 'node' ? this._nodeSVG(n) : n.kind === 'op' ? this._opSVG(n) : n.kind === 'text' ? this._textItemSVG(n) : this._glyphSVG(n));
    }
    for (const x of this.extras) (x.kind === 'panel' ? parts.labels : parts.annotations).push(this._extraSVG(x));
    const H = this._H;
    const layer = (name, arr) => (arr.length ? `<g id="layer-${name}">\n${arr.join('\n')}\n</g>\n` : '');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" ${attrs({ width: `${f2(this.widthMM)}mm`, height: `${f2(H / MM)}mm`, viewBox: `0 0 ${f2(this.W)} ${f2(H)}` })} xml:space="preserve">\n`
      + `<title>${esc(this.title)}</title>\n`
      + layer('groups', parts.groups) + layer('edges', parts.edges) + layer('nodes', parts.nodes)
      + layer('annotations', parts.annotations) + layer('labels', parts.labels) + '</svg>\n';
  }

  _shift(dx, dy) {
    for (const n of this.items.values()) { n.x += dx; n.y += dy; }
    for (const x of this.extras) {
      if (x.kind === 'panel' && x.relative !== true) continue;          // panel labels live in canvas coords
      if (x.kind === 'panel' || x.kind === 'legend') { x.x = (x.x ?? 0) + dx; x.y = (x.y ?? 0) + dy; }
    }
    for (const e of this.edges) for (const k of ['from', 'to']) if (typeof e[k] === 'object') e[k] = { ...e[k], x: e[k].x + dx, y: e[k].y + dy };
  }

  /** Write SVG, print lint report. opts.preview=true also renders a PNG via ../check.py. */
  save(file, opts = {}) {
    const svg = this.render();
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    fs.writeFileSync(file, svg);
    const issues = this.lint();
    const W = this.widthMM.toFixed(1), H = (this._H / MM).toFixed(1);
    console.log(`saved ${file}  (${W} x ${H} mm)`);
    if (!issues.length) console.log('lint: PASS (no issues)');
    else {
      const c = (l) => issues.filter((i) => i.level === l).length;
      console.log(`lint: ${c('ERROR')} error(s), ${c('WARN')} warning(s), ${c('INFO')} info`);
      const ord = { ERROR: 0, WARN: 1, INFO: 2 };
      for (const i of issues.sort((a, b) => ord[a.level] - ord[b.level])) console.log(`  [${i.level}] ${i.code}: ${i.msg}`);
    }
    if (opts.preview !== false) {
      const checker = path.join(HERE, '..', 'check.py');
      const py = process.env.PYTHON || 'python3';
      const r = spawnSync(py, [checker, file, '--quiet', '--journal', this.journal], { encoding: 'utf8' });
      if (r.stdout) process.stdout.write(r.stdout);
      if (r.status !== 0 && r.status !== 1) console.log(`(preview skipped: ${(r.stderr || r.error || '').toString().trim().split('\n').pop()})`);
    }
    return issues;
  }
}

export default Diagram;
