import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { compile, openProject } from '../scripts/project.mjs';
import { createReview } from '../scripts/review.mjs';

const run = promisify(execFile);
const preview = fileURLToPath(new URL('../scripts/preview.mjs', import.meta.url));

test('the brief queue, thread detail and compiled source slice support a review round', async (t) => {
  const scratch = await mkdtemp(join(tmpdir(), 'tex-preview-context-'));
  t.after(() => rm(scratch, { recursive: true, force: true }));
  const paper = join(scratch, 'paper');
  const main = join(paper, 'main.tex');
  const state = join(scratch, 'state');
  const file = 'sections/results.tex';
  await cp(new URL('../examples/paper/', import.meta.url), paper, { recursive: true });
  const project = await openProject(main, { state });
  const review = createReview(project);
  const before = await compile(project);

  const note = await review.add(before, {
    build: before.id, source: { file, from: 5, to: 5 }, body: 'Check this equation.',
  });
  const resolved = await review.add(before, {
    build: before.id, source: { file, from: 5, to: 5 }, body: 'Check the same equation again.',
  });
  await review.event(resolved.id, { status: 'resolved' }, 'user');

  async function cli(...args) {
    const { stdout } = await run(process.execPath, [preview, main, '--state-dir', state, ...args]);
    return JSON.parse(stdout);
  }

  await cli('--reply', note.id, 'Checking the compiled equation.');
  const queueArgs = ['--annotations', '--brief', '--file', file, '--status', 'open', '--limit', '1'];
  const queue = await cli(...queueArgs);
  assert.equal(queue.total, 1);
  assert.deepEqual(queue.annotations, [{
    id: note.id, preview: note.body, status: 'open', replyCount: 1,
    original: { file, from: 4, to: 7 },
  }]);
  assert.deepEqual((await cli(...queueArgs, '--offset', '1')).annotations, []);

  const path = join(paper, file);
  const original = await readFile(path, 'utf8');
  await writeFile(path, '\n' + original);
  const after = await compile(project);
  const detail = await cli('--annotation', note.id, '--context', '1');
  assert.equal(detail.annotation.replies[0].body, 'Checking the compiled equation.');
  assert.equal(detail.annotation.source.from, 4);
  assert.equal(detail.annotation.current.from, 5);
  assert.equal(detail.context.build, after.id);
  assert.deepEqual(detail.context.lines.map(({ line }) => line), [4, 5, 6, 7, 8, 9]);
  assert.deepEqual(await cli('--source', file, '--lines', '4:9'), detail.context);
  await assert.rejects(cli('--source', file, '--lines', '1:121'), /up to 120 lines/);

  await review.event(note.id, { body: 'First follow-up.' }, 'user');
  const longReply = 'x'.repeat(600);
  await review.event(note.id, { body: longReply }, 'agent');
  const briefThread = await cli('--annotation', note.id);
  assert.equal(briefThread.annotation.current.excerpt, undefined);
  assert.equal(briefThread.annotation.omittedReplies, 1);
  assert.ok(briefThread.annotation.replies.find((reply) => reply.clipped));
  const fullThread = await cli('--annotation', note.id, '--full');
  assert.equal(fullThread.annotation.replies.length, 3);
  assert.ok(fullThread.annotation.replies.some((reply) => reply.body === longReply));
});
