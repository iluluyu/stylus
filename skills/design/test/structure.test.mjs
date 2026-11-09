import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const example = path.join(root, 'examples/research-canvas');
const cli = path.join(root, 'scripts/artifact.mjs');
function check(dir, ok = true) {
  const result = spawnSync(process.execPath, [cli, 'check', dir], { encoding: 'utf8' });
  assert.equal(result.status, ok ? 0 : 1, result.stdout + result.stderr);
  const body = JSON.parse(result.stdout);
  assert.equal(body.problems === 0, ok, result.stdout);
  return body;
}

test('all retained upstream code, references and notices match the adopted pin', async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'upstream-manifest.json'), 'utf8'));
  assert.equal(manifest.commit, '7db9784ac4f4974d78ab166c7db1c706c0481c3d');
  assert.ok(Object.keys(manifest.files).length > 25);
  for (const [file, hash] of Object.entries(manifest.files)) {
    assert.equal(createHash('sha256').update(await fs.readFile(path.join(root, file))).digest('hex'), hash, file);
  }
});

test('entry remains concise and no alternate runtime/old prompt suite remains', async () => {
  const skill = await fs.readFile(path.join(root, 'SKILL.md'), 'utf8');
  assert.match(skill, /^---\nname: design\n/);
  assert.ok(skill.trimEnd().split('\n').length >= 150);
  assert.ok(skill.trimEnd().split('\n').length <= 190);
  for (const name of ['agents', 'starter-components', 'project-types.json', 'system-prompt.md', 'references/upstream-sync']) {
    await assert.rejects(fs.access(path.join(root, name)), { code: 'ENOENT' });
  }
  const compatibility = await fs.readFile(path.join(root, 'built-in-skills/academic-figures.md'), 'utf8');
  assert.ok(compatibility.split('\n').length < 10);
  assert.doesNotMatch(compatibility, /^---/);
  for (const match of skill.matchAll(/`((?:artifact-type\/reference|references)\/[a-z-]+\.md)`/g)) {
    await fs.access(path.join(root, match[1]));
  }
});

test('scientific example is a valid indexed native canvas, independently editable nodes/arrows', async () => {
  const report = check(example);
  assert.equal(report.boardCount, 1);
  const index = JSON.parse(await fs.readFile(path.join(example, 'project/canvas.json'), 'utf8'));
  assert.equal(index.v, 3);
  assert.deepEqual(index.order, Object.keys(index.boards));
  const html = await fs.readFile(path.join(example, 'project/Main.dc.html'), 'utf8');
  assert.equal((html.match(/<svg /g) || []).length, 2);
  assert.equal((html.match(/box-sizing: border-box/g) || []).length, 3);
  assert.match(html, /Schematic only — no measurements/);
  assert.match(html, /not measured kinetics/);
  assert.match(html, /k<\/i>₁ · Δ/);
  assert.doesNotMatch(html, /data:|<iframe|innerHTML|sc-for/);
});

test('upstream check rejects broken support, preview, expressions, paths and missing assets', async () => {
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'design-format-'));
  const source = await fs.readFile(path.join(example, 'project/Main.dc.html'), 'utf8');
  const index = JSON.parse(await fs.readFile(path.join(example, 'project/canvas.json'), 'utf8'));
  try {
    await fs.mkdir(path.join(scratch, 'project'));
    const write = async (html, meta = index) => {
      await fs.writeFile(path.join(scratch, 'project/Main.dc.html'), html);
      await fs.writeFile(path.join(scratch, 'project/canvas.json'), JSON.stringify(meta));
    };
    await write(source); check(scratch);
    for (const [bad, message] of [
      [source.replace('<script src="./support.js"></script>', ''), /support\.js/],
      [source.replace('"width":688', '"width":600'), /preview/],
      [source.replace('Prepare reactants', '{{ a + b }}'), /expression/],
      [source.replace('Prepare reactants', '<img src="/_blob/00000000000000000000000000000000">'), /not in assets/]
    ]) {
      await write(bad);
      assert.match(JSON.stringify(check(scratch, false).issues), message);
    }
    await write(source, { ...index, order: ['Missing.dc.html'] });
    check(scratch, false);
    await write(source, { ...index, boards: { '../Outside.dc.html': { x: 0, y: 0, w: 688, h: 360 } } });
    check(scratch, false);
  } finally {
    await fs.rm(scratch, { recursive: true, force: true });
  }
});
