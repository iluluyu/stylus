import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { anchorFor, createReview, relocate, withPdfSelection } from '../scripts/review.mjs';

const file = 'section.tex';
const build = (lines, id = 'before') => ({ id, sources: { [file]: { lines } } });
const selection = (from, to, startColumn, endColumn, quote) => ({ from, to, startColumn, endColumn, quote });

test('a source selector uses one-based UTF-16 columns inside an expanded environment', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'tex-preview-word-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const original = build(['\\begin{table}', '🙂 term', '\\end{table}']);
  const review = createReview({ dir });
  const note = await review.add(original, {
    build: original.id,
    body: 'Replace this term.',
    source: { file, from: 2, to: 2, startColumn: 4, endColumn: 8 },
    pdf: { page: 1, x: 0, y: 0, rects: [], quote: '' },
  });
  assert.deepEqual([note.source.from, note.source.to], [1, 3]);
  assert.deepEqual(note.source.selection, selection(2, 2, 4, 8, 'term'));
  assert.deepEqual((await review.get(original, note.id)).current.selection, note.source.selection);
  assert.equal(anchorFor(original, file, 2, 2, { startColumn: 2, endColumn: 8 }).selection, undefined);
  assert.equal(anchorFor(original, file, 2, 2, { startColumn: 4, endColumn: 9 }).selection, undefined);
  assert.equal(anchorFor(original, file, 2, 2, { startColumn: 4, endColumn: 4 }).selection, undefined);
  assert.deepEqual(anchorFor(original, file, 1, 2, { startColumn: 8, endColumn: 3 }).selection,
    selection(1, 2, 8, 3, 'table}\n🙂'));
});

test('PDF text maps to a unique raw spelling within actual SyncTeX line bounds', () => {
  const original = build(['\\begin{table}', '\\term{term} % term', 'term term', 'subterm', '\\end{table}']);
  const hit = anchorFor(original, file, 2);
  assert.deepEqual(withPdfSelection(original, hit, 'term').selection, selection(2, 2, 7, 11, 'term'));
  assert.equal(withPdfSelection(original, hit, 'term', 2, 3), hit);
  assert.equal(withPdfSelection(original, anchorFor(original, file, 4), 'term').selection, undefined);
  assert.equal(withPdfSelection(original, hit, '\\term{term}'), hit);
  const multi = build(['One term', 'continues.', 'The end.']);
  assert.deepEqual(withPdfSelection(multi, anchorFor(multi, file, 1, 2), 'term\ncontinues', 1, 2).selection,
    selection(1, 2, 5, 10, 'term\ncontinues'));
});

test('relocation keeps an exact spelling when identifiable and retains the range when it is lost', () => {
  const original = build(['\\begin{table}\\label{tab:example}', 'A term here.', '\\end{table}']);
  const anchor = anchorFor(original, file, 2, 2, { startColumn: 3, endColumn: 7 });
  const edit = (line) => build(['Earlier material.', original.sources[file].lines[0], line, '\\end{table}']);
  assert.deepEqual(relocate(edit('Another term here.'), anchor, false).selection, selection(3, 3, 9, 13, 'term'));
  for (const line of ['A term or term here.', 'A replacement here.', 'A terminal here.', 'Unrelated term elsewhere.']) {
    const current = relocate(edit(line), anchor, false);
    assert.deepEqual([current.from, current.to], [2, 4]);
    assert.equal(current.selection, undefined);
  }
  const duplicate = anchorFor(edit('term and term'), file, 3, 3, { startColumn: 10, endColumn: 14 });
  assert.deepEqual(relocate(edit('term and term'), duplicate, false).selection, duplicate.selection);
  assert.equal(relocate(edit('term and something else'), duplicate, false).selection, undefined);
  const legacy = anchorFor(original, file, 2);
  assert.equal(relocate(edit('Edited.'), legacy, false).selection, undefined);
});

test('an edited word at a file boundary can retain its line through the surrounding text', () => {
  const original = build(['An old result.']);
  const anchor = anchorFor(original, file, 1, 1, { startColumn: 4, endColumn: 7 });
  const moved = relocate(build(['A new line.', '  An new result.']), anchor, false);
  assert.deepEqual([moved.from, moved.to], [2, 2]);
  assert.equal(moved.selection, undefined);
  assert.equal(relocate(build(['An new result.', 'An second result.']), anchor, false), null);
});
