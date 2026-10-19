// Example: double-column method overview for an optimization paper.
// Run: node examples/fig_method.mjs [out_dir]
// Shows: relative placement, glyphs (matrix / plot / tensor), groups, feedback loop,
// emphasis on the novel component, zoom-in detail panel, brace, step badges, auto legend.
import { Diagram } from '../scripts/diagram/sfd.mjs';
import path from 'node:path';

const out = process.argv[2] || path.join(path.dirname(new URL(import.meta.url).pathname), 'out');
const d = new Diagram({ width: 'double', title: 'Curvature-aware optimizer: overview' });

// ---- row 1: the training loop (left -> right reading order) -----------------------
d.node('data', { label: 'Training data', sub: '$\\mathcal{D}_{\\mathrm{train}}$', shape: 'cylinder', tone: 'neutral', x: 0, y: 0 });
d.matrix('batch', { rows: 6, cols: 5, tone: 'neutral', label: 'mini-batch $B_t$', right: 'data', gap: 16, seed: 3 });
d.node('model', { label: 'Model $f_\\theta$', sub: 'any architecture', tone: 'primary', right: 'batch', gap: 18 });
d.node('loss', { label: 'Loss', sub: '$\\mathcal{L}(\\theta_t; B_t)$', tone: 'loss', right: 'model', gap: 24 });
d.matrix('hess', { rows: 6, cols: 6, pattern: 'lowrank', tone: 'accent', label: 'curvature $\\hat{H}_t$', right: 'loss', gap: 24, seed: 11 });
d.node('update', { label: 'Preconditioned step', sub: '$\\theta_{t+1} = \\theta_t - \\eta\\,\\hat{H}_t^{-1} g_t$', tone: 'accent', emphasis: true, right: 'hess', gap: 24 });
d.plot('curve', { series: ['noisy', 'decay'], tones: ['neutral', 'accent'], right: 'update', gap: 22, label: 'training loss' });
d.sameSize(['model', 'loss'], 'h');

d.edge('data', 'batch');
d.edge('batch', 'model');
d.edge('model', 'loss', { label: '$\\hat{y}$' });
d.edge('loss', 'hess', { label: '$g_t$' });
d.edge('hess', 'update');
d.edge('update', 'curve', { style: 'dashed', head: 'open' });
d.edge('update', 'model', { route: 'below', tone: 'accent', label: 'next iterate  $t \\leftarrow t+1$' });
d.group('inner', ['model', 'loss', 'hess', 'update'], { label: 'Inner loop · K steps', tone: 'primary' });
['model', 'loss', 'hess', 'update'].forEach((id, i) => d.badge(id, i + 1));

// ---- row 2: zoom into the novel block, placed directly under it ------------------
d.tensor('grads', { depth: 5, sw: 14, sh: 20, tone: 'accent', label: 'recent gradients\n$G = [g_{t-k},\\dots,g_t]$', below: 'loss', gap: 62 });
d.op('svd', { symbol: 'σ', right: 'grads', gap: 24, tone: 'neutral' });
d.matrix('U', { rows: 7, cols: 2, tone: 'accent', label: '$U_r$', right: 'svd', gap: 22, seed: 4 });
d.matrix('S', { rows: 2, cols: 2, pattern: 'diag', tone: 'accent', label: '$\\Sigma_r$', right: 'U', gap: 6, seed: 2 });
d.matrix('Ut', { rows: 2, cols: 7, tone: 'accent', label: '$U_r^{\\top}$', right: 'S', gap: 6, seed: 4 });
d.node('damp', { label: '$+\\,\\lambda I$', shape: 'pill', tone: 'neutral', right: 'Ut', gap: 20, minW: 26 });
d.edge('grads', 'svd'); d.edge('svd', 'U', { label: 'rank $r$' }); d.edge('Ut', 'damp');
d.brace(['U', 'S', 'Ut'], { side: 'bottom', label: '$\\hat{H}_t$ in $\\mathcal{O}(dr)$ memory', offset: 10 });
d.group('detail', ['grads', 'svd', 'U', 'S', 'Ut', 'damp'], { label: 'Low-rank curvature estimate (step 3)', tone: 'accent', pad: 9, fill: '#FFFFFF', dashed: true });
d.zoom('hess', 'detail');

// ---- legend under everything, then the panel label ---------------------------------
d.legend([
  { tone: 'neutral', label: 'data' },
  { tone: 'primary', label: 'standard component' },
  { tone: 'accent', label: 'proposed' },
  { tone: 'accent', kind: 'arrow', label: 'feedback (per step)' },
], { at: 'bottom' });
d.panel('a');

d.save(path.join(out, 'fig_method.svg'));
