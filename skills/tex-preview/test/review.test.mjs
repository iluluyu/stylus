import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { test } from 'node:test';
import { compile, forward, inverse, latestBuild, openProject, readReviewIndex } from '../scripts/project.mjs';
import { anchorFor, createReview, relocate } from '../scripts/review.mjs';

test('a saved equation review survives edits, repagination and a failed build', async (t) => {
  const scratch = await mkdtemp(join(tmpdir(), 'tex-preview-test-'));
  t.after(() => rm(scratch, { recursive: true, force: true }));
  const paper = join(scratch, 'paper');
  await cp(new URL('../examples/paper/', import.meta.url), paper, { recursive: true });
  const state = join(scratch, 'state');
  const project = await openProject(join(paper, 'main.tex'), { state });
  const review = createReview(project);
  const file = 'sections/results.tex';
  const path = join(paper, file);
  const original = await readFile(path, 'utf8');

  const before = await compile(project);
  const point = await forward(project, before, file, 5);
  assert.equal(point.page, 1);
  const submission = {
    build: before.id, pdf: { ...point, rects: [] }, body: 'Check the fourth-order correction.',
    submissionId: randomUUID(),
  };
  const [note, retry] = await Promise.all([review.add(before, submission), review.add(before, submission)]);
  assert.deepEqual(retry, note);
  assert.equal((await review.list(before)).length, 1);
  await assert.rejects(review.add(before, { ...submission, body: 'A different draft.' }), { status: 409 });
  assert.equal(note.source.label, 'eq:scaling');
  assert.deepEqual([note.source.from, note.source.to], [4, 7]);

  await writeFile(path, '\\clearpage\n' + original.replace('a}{L^2}', 'a}{L^2} + \\frac{b}{L^4}'));
  const after = await compile(project);
  await review.event(note.id, { body: 'Checked the fourth-order term.' }, 'agent');
  const [mapped] = await review.list(after);
  assert.equal(mapped.pdf.page, 1);
  assert.equal(mapped.current.file, file);
  assert.deepEqual([mapped.current.from, mapped.current.to], [5, 8]);
  assert.equal((await forward(project, after, file, mapped.current.line)).page, 2);
  assert.match(mapped.diff.find((line) => line.added).value, /L\^4/);
  assert.equal(mapped.replies[0].author, 'agent');

  await writeFile(path, original + '\n\\unknownReviewTestCommand\n');
  await assert.rejects(compile(project), /Undefined control sequence/);
  assert.equal((await latestBuild(project)).id, after.id);
  await review.event(note.id, { status: 'resolved' }, 'user');
  assert.equal((await review.list(after))[0].status, 'resolved');
});

test('a comment with two possible new source locations needs confirmation', () => {
  const file = 'section.tex';
  const build = (lines) => ({ sources: { [file]: { lines } } });
  const paragraph = 'The estimate converges under this assumption.';
  const anchor = anchorFor(build([paragraph]), file, 1);
  assert.equal(relocate(build(['First case', paragraph, 'Second case', paragraph]), anchor, false), null);
});

test('a moved project retains designs/rev/tex state, SyncTeX, auto-gitignore, and prunes old builds', async (t) => {
  const scratch = await mkdtemp(join(tmpdir(), 'tex-project-review-'));
  t.after(() => rm(scratch, { recursive: true, force: true }));
  const original = join(scratch, 'original');
  await mkdir(join(original, '.git'), { recursive: true });
  const sub = join(original, 'paper-a');
  await mkdir(join(sub, 'designs'), { recursive: true });
  await cp(new URL('../examples/paper/', import.meta.url), sub, { recursive: true });
  const initial = await openProject(join(sub, 'main.tex'), {});
  assert.ok(initial.dir.startsWith(join(sub, 'designs', 'rev', 'tex') + '/'));
  assert.match(basename(initial.dir), /^main-[a-f0-9]{8}$/);
  const build1 = await compile(initial);
  assert.match(build1.id, /^[a-f0-9]{10}$/);
  assert.match(await readFile(join(sub, 'designs', 'rev', '.gitignore'), 'utf8'), /^\*$/m);
  const build2 = await compile(initial);
  const build3 = await compile(initial);
  const kept = new Set(await readdir(join(initial.dir, 'builds')));
  assert.equal(kept.has(build1.id), false);
  assert.equal(kept.has(build2.id), true);
  assert.equal(kept.has(build3.id), true);

  const file = 'sections/results.tex';
  const target = await forward(initial, build3, file, 5);
  const relocated = join(scratch, 'relocated');
  await rename(original, relocated);
  const project = await openProject(join(relocated, 'paper-a', 'main.tex'), {});
  assert.equal(project.dir, initial.dir.replace(original, relocated));
  const archived = await latestBuild(project);
  assert.equal(archived.id, build3.id);
  assert.deepEqual(await forward(project, archived, file, 5), target);
  assert.equal((await inverse(project, archived, target.page, target.x, target.y)).file, file);

  const review = createReview(project);
  const note = await review.add(archived, { build: archived.id, source: { file, from: 5, to: 5 }, body: 'Async note.' });
  const indexed = await readReviewIndex(join(relocated, 'paper-a'));
  assert.equal(indexed.entries.length, 1);
  assert.equal(indexed.entries[0].kind, 'tex');
  assert.equal(indexed.entries[0].openCount, 1);
  await review.event(note.id, { status: 'resolved' }, 'user');
  const afterResolve = await readReviewIndex(join(relocated, 'paper-a'));
  assert.equal(afterResolve.entries[0].openCount, 0);
});
