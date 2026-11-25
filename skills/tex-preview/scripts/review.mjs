import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { diffLines } from 'diff';
import { ensureGitignore, forward, inverse, isId, newId, readJson, updateReviewIndex, writeJson } from './project.mjs';

const numberedEnvironment = /\\(begin|end)\{(equation|align|alignat|gather|multline|flalign|displaymath|figure|table)\*?\}/g;
const uncomment = (line) => line.replace(/(?<!\\)(?:\\\\)*%.*$/, '');
const trimmedLines = (lines) => lines.map((line) => line.trim());
const matches = (haystack, needle) => {
  const positions = [];
  for (let i = 0; i + needle.length <= haystack.length; i++) {
    if (needle.every((line, j) => line === haystack[i + j])) positions.push(i);
  }
  return positions;
};

function environmentAt(lines, line) {
  const stack = [];
  for (const [index, source] of lines.entries()) {
    for (const [, edge, kind] of uncomment(source).matchAll(numberedEnvironment)) {
      if (edge === 'begin') stack.push({ from: index + 1, kind });
      else if (stack.at(-1)?.kind === kind) {
        const { from } = stack.pop();
        if (from <= line && line <= index + 1) return { from, to: index + 1, kind };
      }
    }
  }
  return null;
}

function selectionFor(lines, { from, to, startColumn, endColumn }) {
  if (!Number.isSafeInteger(startColumn) || !Number.isSafeInteger(endColumn) ||
      startColumn < 1 || endColumn < 1 || startColumn > lines[from - 1].length + 1 ||
      endColumn > lines[to - 1].length + 1 || (from === to && startColumn >= endColumn)) return null;
  const rows = lines.slice(from - 1, to);
  // Column offsets count UTF-16 code units, but a selector must contain complete characters.
  if (/^[\uDC00-\uDFFF]/.test(rows[0].slice(startColumn - 1)) ||
      /^[\uDC00-\uDFFF]/.test(rows.at(-1).slice(endColumn - 1))) return null;
  rows[rows.length - 1] = rows.at(-1).slice(0, endColumn - 1);
  rows[0] = rows[0].slice(startColumn - 1);
  const quote = rows.join('\n');
  return quote.trim() ? { from, to, startColumn, endColumn, quote } : null;
}

function quoteMatches(haystack, quote, accepts) {
  const positions = [];
  for (let start = haystack.indexOf(quote); start !== -1; start = haystack.indexOf(quote, start + 1)) {
    if (accepts(start, start + quote.length)) positions.push(start);
  }
  return positions;
}

function selectionAtOffset(rows, from, start, quote) {
  const excerpt = rows.join('\n');
  const position = (offset) => {
    const prefix = excerpt.slice(0, offset).split('\n');
    return { line: from + prefix.length - 1, column: prefix.at(-1).length + 1 };
  };
  const first = position(start);
  const last = position(start + quote.length);
  return { from: first.line, to: last.line, startColumn: first.column, endColumn: last.column, quote };
}

const wordStart = /^[\p{L}\p{M}\p{N}_]/u;
const wordEnd = /[\p{L}\p{M}\p{N}_]$/u;
const neighbors = (text, start, end) => [wordEnd.test(text.slice(Math.max(0, start - 2), start)),
  wordStart.test(text.slice(end, end + 2))];

export function withPdfSelection(build, anchor, quote, from = anchor?.line, to = from) {
  if (!anchor || typeof quote !== 'string') return anchor;
  quote = quote.trim();
  if (!quote || quote.length > 2000 || /[\\{}%$&#_^~\u0000]/.test(quote)) return anchor;
  const lines = build.sources[anchor.file].lines;
  const rows = lines.slice(from - 1, to);
  const searchable = rows.map((line) => {
    const content = uncomment(line);
    return content.replace(/\\(?:[\p{L}@]+|.)/gu, (token) => '\0'.repeat(token.length)) +
      '\0'.repeat(line.length - content.length);
  }).join('\n');
  const positions = quoteMatches(searchable, quote, (start, end) => {
    const [left, right] = neighbors(searchable, start, end);
    return !(left && wordStart.test(quote)) && !(right && wordEnd.test(quote));
  });
  if (positions.length !== 1) return anchor;
  const selection = selectionAtOffset(rows, from, positions[0], quote);
  return { ...anchor, line: selection.from, selection };
}

export function anchorFor(build, file, from, to = from, columns) {
  const lines = Object.hasOwn(build.sources, file) && build.sources[file].lines;
  if (!lines || !Number.isSafeInteger(from) || !Number.isSafeInteger(to) ||
      from < 1 || to < from || to > lines.length || to - from > 200) return null;
  const environment = environmentAt(lines, from);
  const target = { file, line: from, from, to, ...(environment && to <= environment.to && environment) };
  const excerpt = lines.slice(target.from - 1, target.to);
  const labels = [...excerpt.map(uncomment).join('\n').matchAll(/\\label\{([^{}]+)\}/g)];
  const selection = columns && selectionFor(lines, { ...columns, from, to });
  return {
    ...target, excerpt, ...(selection && { selection }), ...(labels.length === 1 && { label: labels[0][1] }),
    exactUnique: matches(trimmedLines(lines), trimmedLines(excerpt)).length === 1,
    before: lines.slice(Math.max(0, target.from - 4), target.from - 1),
    after: lines.slice(target.to, target.to + 3),
  };
}

function relocateSelection(anchor, mapped) {
  const { selection } = anchor;
  if (!selection) return mapped;
  const oldText = anchor.excerpt.join('\n');
  const newText = mapped.excerpt.join('\n');
  const relativeLine = selection.from - anchor.from;
  const prefix = anchor.excerpt.slice(0, relativeLine).join('\n');
  const offset = prefix.length + (relativeLine ? 1 : 0) + selection.startColumn - 1;
  const { quote } = selection;
  if (!quote || oldText.slice(offset, offset + quote.length) !== quote) return mapped;
  if (oldText === newText) {
    mapped.selection = selectionAtOffset(mapped.excerpt, mapped.from, offset, quote);
  } else {
    const boundary = neighbors(oldText, offset, offset + quote.length);
    const withBoundary = (text) => (start, end) => neighbors(text, start, end)
      .every((word, index) => word === boundary[index]);
    const positions = quoteMatches(newText, quote, withBoundary(newText));
    const previous = quoteMatches(oldText, quote, withBoundary(oldText));
    const linePrefix = (text, start) => start ? text.slice(text.lastIndexOf('\n', start - 1) + 1, start).trimStart() : '';
    const lineSuffix = (text, end) => {
      const newline = text.indexOf('\n', end);
      return text.slice(end, newline === -1 ? text.length : newline).trimEnd();
    };
    const prefix = linePrefix(oldText, offset);
    const suffix = lineSuffix(oldText, offset + quote.length);
    const unique = previous.length === 1 && positions.length === 1;
    const contextual = positions.filter((start) => {
      const leftMatches = linePrefix(newText, start) === prefix;
      const rightMatches = lineSuffix(newText, start + quote.length) === suffix;
      return (leftMatches && rightMatches) || (unique && ((prefix && leftMatches) || (suffix && rightMatches)));
    });
    if (contextual.length === 1) mapped.selection = selectionAtOffset(mapped.excerpt, mapped.from, contextual[0], quote);
  }
  if (mapped.selection) mapped.line = mapped.selection.from;
  return mapped;
}

function relocateRangeBySelection(build, anchor) {
  const { selection, excerpt, file } = anchor;
  if (!selection || selection.from !== selection.to) return null;
  const selectedRow = selection.from - anchor.from;
  const row = excerpt[selectedRow];
  const prefix = row.slice(0, selection.startColumn - 1).trimStart();
  const suffix = row.slice(selection.endColumn - 1).trimEnd();
  if (!prefix || !suffix) return null;
  const lines = build.sources[file].lines;
  const ranges = [];
  for (let index = selectedRow; index + excerpt.length - selectedRow <= lines.length; index++) {
    const line = lines[index];
    const left = line.trimStart();
    const right = line.trimEnd();
    if (!left.startsWith(prefix) || !right.endsWith(suffix)) continue;
    const startColumn = line.length - left.length + prefix.length + 1;
    const endColumn = right.length - suffix.length + 1;
    if (startColumn > endColumn) continue;
    const from = index - selectedRow + 1;
    if (!excerpt.every((old, offset) => offset === selectedRow || old.trim() === lines[from + offset - 1].trim())) continue;
    ranges.push({ from, to: from + excerpt.length - 1, line: index + 1, startColumn, endColumn });
  }
  if (ranges.length !== 1) return null;
  const { from, to, line, startColumn, endColumn } = ranges[0];
  const mapped = anchorFor(build, file, from, to);
  if (!mapped || mapped.kind !== anchor.kind || mapped.from !== from || mapped.to !== to) return null;
  mapped.line = line;
  if (lines[line - 1].slice(startColumn - 1, endColumn - 1) === selection.quote) {
    mapped.selection = { ...selection, from: line, to: line, startColumn, endColumn };
  }
  return mapped;
}

export function relocate(build, anchor, sameBuild) {
  if (!anchor || !Object.hasOwn(build.sources, anchor.file)) return null;
  if (sameBuild) return anchor;
  const { file, label, kind, excerpt, before, after } = anchor;
  const lines = build.sources[file].lines;
  if (label) {
    const positions = lines.flatMap((line, index) =>
      [...uncomment(line).matchAll(/\\label\{([^{}]+)\}/g)].filter((match) => match[1] === label).map(() => index + 1));
    if (positions.length === 1) {
      const mapped = anchorFor(build, file, positions[0]);
      if (mapped?.kind === kind) {
        mapped.line = Math.min(mapped.to, mapped.from + anchor.line - anchor.from);
        return relocateSelection(anchor, mapped);
      }
    }
    return null;
  }
  const normalized = trimmedLines(lines);
  const exact = matches(normalized, trimmedLines(excerpt));
  if (anchor.exactUnique && exact.length === 1) {
    const start = exact[0] + 1;
    const mapped = anchorFor(build, file, start, start + excerpt.length - 1);
    if (mapped?.kind === kind) {
      mapped.line = start + anchor.line - anchor.from;
      return relocateSelection(anchor, mapped);
    }
  }
  const locateBySelection = () => relocateRangeBySelection(build, anchor);
  if (!before.some((line) => line.trim()) || !after.some((line) => line.trim())) return locateBySelection();
  const starts = matches(normalized, trimmedLines(before));
  const ends = matches(normalized, trimmedLines(after));
  if (starts.length !== 1 || ends.length !== 1) return locateBySelection();
  const from = starts[0] + before.length + 1;
  const to = ends[0];
  if (from > to || to - from > excerpt.length + 12) return locateBySelection();
  const mapped = anchorFor(build, file, from, to);
  if (!mapped || mapped.kind !== kind || mapped.from !== from || mapped.to !== to) return locateBySelection();
  mapped.line = Math.min(to, from + anchor.line - anchor.from);
  return relocateSelection(anchor, mapped);
}

function annotateError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function readBody(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 6000) {
    throw annotateError('请输入批注或回复，最多 6000 字。');
  }
  return value.trim();
}

function pdfSelection(input) {
  const { page, x, y, rects } = input;
  if (!Number.isSafeInteger(page) || page < 1 || ![x, y].every(Number.isFinite) ||
      !Array.isArray(rects) || rects.length > 150 || !rects.every((rect) =>
        Array.isArray(rect) && rect.length === 4 && rect.every(Number.isFinite))) {
    throw annotateError('PDF 选区无效。');
  }
  return { page, x, y, rects, quote: typeof input.quote === 'string' ? input.quote.slice(0, 2000) : '' };
}

export function createReview(project) {
  const notes = join(project.dir, 'notes');
  const folder = (id) => join(notes, id);
  async function get(id) {
    return isId(id) ? readJson(join(folder(id), 'note.json'), null) : null;
  }
  async function entries(path) {
    return readdir(path).catch((error) => {
      if (error.code === 'ENOENT') return [];
      throw error;
    });
  }
  async function thread(note) {
    const events = (await Promise.all((await entries(folder(note.id)))
      .filter((name) => name.endsWith('.json') && isId(name.slice(0, -5)))
      .map((name) => readJson(join(folder(note.id), name), null)))).filter(Boolean)
      .sort((a, b) => a.created.localeCompare(b.created) || a.id.localeCompare(b.id));
    return { ...note, status: events.findLast((event) => event.status)?.status || 'open',
      replies: events.filter((event) => event.body) };
  }
  async function threads(file) {
    const ids = (await entries(notes)).filter(isId);
    const records = (await Promise.all(ids.map(get))).filter((note) => note && (!file || note.source?.file === file));
    records.sort((a, b) => a.created.localeCompare(b.created) || a.id.localeCompare(b.id));
    return Promise.all(records.map(thread));
  }
  function detail(note, build) {
    const current = build && relocate(build, note.source, build.id === note.build);
    return { ...note, current, diff: current && diffLines(note.source.excerpt.join('\n') + '\n', current.excerpt.join('\n') + '\n')
      .filter(({ added, removed }) => added || removed) };
  }
  async function syncIndex() {
    if (!project.gitignoreRoot) return;
    const all = await threads();
    const openCount = all.filter((note) => note.status === 'open').length;
    await updateReviewIndex(project.revDir, 'tex:' + project.projectKey, {
      kind: 'tex',
      key: project.projectKey,
      entry: project.input,
      root: project.scope || '.',
      engine: project.engine,
      stateDir: 'tex/' + project.projectKey,
      openCount,
      totalCount: all.length,
    });
  }
  return {
    syncIndex,
    async add(build, input) {
      const body = readBody(input.body);
      if (!build || build.id !== input.build) throw annotateError('找不到选区对应的编译版本。', 409);
      const id = input.submissionId ?? newId();
      if (!isId(id)) throw annotateError('批注标识无效。');
      const previous = input.submissionId && await get(id);
      const alreadySaved = (note) => {
        if (note?.build === build.id && note.body === body) return note;
        throw annotateError('此草稿已保存。请检查对应批注。', 409);
      };
      if (previous) return alreadySaved(previous);
      let source = input.source && anchorFor(build, input.source.file, input.source.from, input.source.to, input.source);
      let pdf = input.pdf ? pdfSelection(input.pdf) : null;
      if (!source && pdf) {
        const hit = await inverse(project, build, pdf.page, pdf.x, pdf.y);
        if (hit) {
          let last = hit.line;
          let quote = pdf.quote;
          if (pdf.quote && pdf.rects.length > 1) {
            const [x1, y1, x2, y2] = pdf.rects.at(-1);
            const end = await inverse(project, build, pdf.page, (x1 + x2) / 2, (y1 + y2) / 2);
            if (end?.file === hit.file && Math.abs(end.line - last) <= 40) last = end.line;
            else quote = '';
          }
          const from = Math.min(hit.line, last);
          const to = Math.max(hit.line, last);
          source = withPdfSelection(build, anchorFor(build, hit.file, from, to), quote, from, to);
        }
      }
      if (!pdf && source) {
        const hit = await forward(project, build, source.file, source.line);
        if (hit) pdf = { page: hit.page, x: hit.x, y: hit.y, rects: [], quote: '' };
      }
      if (!source && !pdf) throw annotateError('请选择一段 TeX 源码或一个 PDF 位置。');
      const note = { id, body, build: build.id, created: new Date().toISOString(), source: source || null, pdf };
      try {
        await ensureGitignore(project.gitignoreRoot);
        await writeJson(join(folder(id), 'note.json'), note, { exclusive: true });
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        return alreadySaved(await get(id));
      }
      await syncIndex();
      return note;
    },
    async list(build) {
      return (await threads()).map((note) => detail(note, build));
    },
    async summary({ file, status, limit, offset }) {
      const matching = (await threads(file)).filter((note) => !status || note.status === status);
      const items = matching.slice(offset, offset + limit).map(({ id, body, source, pdf, status, replies }) => ({
        id, preview: body.length > 120 ? body.slice(0, 119) + '…' : body, status, replyCount: replies.length,
        original: source ? { file: source.file, from: source.from, to: source.to } : { page: pdf?.page ?? null },
      }));
      return { total: matching.length, offset, annotations: items };
    },
    async get(build, id) {
      const note = await get(id);
      if (!note) throw annotateError('找不到这条批注。', 404);
      return detail(await thread(note), build);
    },
    async event(noteId, input, author) {
      if (!await get(noteId)) throw annotateError('找不到这条批注。', 404);
      const id = newId();
      const created = new Date().toISOString();
      const event = input.status ? { id, created, status: input.status } : { id, created, body: readBody(input.body), author };
      if (event.status && !['open', 'resolved'].includes(event.status)) throw annotateError('批注状态无效。');
      await ensureGitignore(project.gitignoreRoot);
      await writeJson(join(folder(noteId), id + '.json'), event);
      await syncIndex();
      return event;
    },
  };
}
