// Example: single-column algorithm flowchart with automatic layered layout.
// Run: node examples/fig_flowchart.mjs [out_dir]
import { Diagram } from '../scripts/diagram/sfd.mjs';
import path from 'node:path';

const out = process.argv[2] || path.join(path.dirname(new URL(import.meta.url).pathname), 'out');
const d = new Diagram({ width: 'single', title: 'Algorithm 1 flowchart' });

d.node('init', { label: 'Initialise $\\theta_0$, $\\hat{H}_0 = I$', shape: 'pill', tone: 'neutral' });
d.node('sample', { label: 'Sample mini-batch $B_t$', tone: 'primary' });
d.node('grad', { label: 'Gradient $g_t = \\nabla \\mathcal{L}(\\theta_t)$', tone: 'primary' });
d.node('curv', { label: 'Update curvature $\\hat{H}_t$', sub: 'rank-$r$ sketch', tone: 'accent', emphasis: true });
d.node('step', { label: 'Step $\\theta_{t+1} = \\theta_t - \\eta \\hat{H}_t^{-1} g_t$', tone: 'primary' });
d.node('conv', { label: 'Converged?', shape: 'diamond', tone: 'neutral' });
d.node('done', { label: 'Return $\\theta_T$', shape: 'pill', tone: 'neutral' });
d.sameSize(['sample', 'grad', 'curv', 'step'], 'w');

d.chain(['init', 'sample', 'grad', 'curv', 'step', 'conv']);
d.edge('conv', 'done', { label: 'yes' });
d.edge('conv', 'sample', { route: 'right', label: 'no', clearance: 12, feedback: true });
d.layout({ dir: 'TB', rankGap: 13 });
d.note('curv', 'only $\\mathcal{O}(dr)$ extra memory', { side: 'left', dist: 10 });
d.panel('b');

d.save(path.join(out, 'fig_flowchart.svg'));
