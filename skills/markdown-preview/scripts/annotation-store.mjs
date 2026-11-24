import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const idPattern = /^[\da-f-]{36}$/;
const text = (value, max) => typeof value === "string" && value.trim() && value.length <= max;
const jsonFiles = async (dir, pattern) => {
  let files;
  try { files = await readdir(dir); } catch (err) { if (err.code === "ENOENT") return []; throw err; }
  const records = await Promise.all(files.filter((file) => pattern.test(file))
    .map(async (file) => JSON.parse(await readFile(join(dir, file), "utf8"))));
  return records.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
};

export function annotationDirectory(root, override) {
  if (override) return resolve(override);
  root = resolve(root);
  const state = reviewStateDirectory(root);
  return join(state, "markdown", hash(relative(state, root)).slice(0, 24));
}

function reviewStateDirectory(root) {
  for (let dir = root; ; dir = dirname(dir)) {
    if (basename(dir) === "design" || existsSync(join(dir, "project", "canvas.json"))) return join(dir, "review-state");
    if (existsSync(join(dir, ".git"))) return join(dir, "design", "review-state");
    if (dirname(dir) === dir) return join(root, "design", "review-state");
  }
}

// Never guess when an edited file has several identical candidate blocks.
export function locateBlock(page, revision, anchor) {
  if (revision === page.revision) {
    return page.blocks.find((b) => b.id === anchor.id && b.fingerprint === anchor.fingerprint) || null;
  }
  if (anchor.ambiguous !== false) return null;
  const matches = page.blocks.filter((b) => b.kind === anchor.kind && b.fingerprint === anchor.fingerprint);
  return matches.length === 1 && matches[0].section === anchor.section ? matches[0] : null;
}

export function createAnnotationStore(dir) {
  const docDir = (doc) => join(dir, hash(doc));
  async function save(folder, record) {
    await mkdir(folder, { recursive: true, mode: 0o700 });
    const tmp = join(folder, `${record.id}.tmp`);
    await writeFile(tmp, JSON.stringify(record) + "\n", { flag: "wx", mode: 0o600 });
    await rename(tmp, join(folder, `${record.id}.json`));
  }
  return {
    async list(doc) {
      const folder = docDir(doc);
      const notes = await jsonFiles(folder, /^[\da-f-]{36}\.json$/);
      return Promise.all(notes.filter((note) => note.doc === doc).map(async (note) => ({ ...note,
        replies: await jsonFiles(join(folder, note.id), /^[\da-f-]{36}\.json$/),
      })));
    },
    async add(page, input) {
      const block = page?.blocks.find((b) => b.id === input.block);
      const quote = input.kind === "quote";
      const validSelection = text(input.quote, 4000) && Number.isSafeInteger(input.start) &&
        input.start >= 0 && input.start <= 1000000 && input.end === input.start + input.quote.length;
      const caret = input.caret;
      const validCaret = caret && Number.isSafeInteger(caret.offset) && caret.offset >= 0 && caret.offset <= 1000000 &&
        typeof caret.before === "string" && caret.before.length === Math.min(32, caret.offset) &&
        typeof caret.after === "string" && caret.after.length <= 32 && (caret.before.length || caret.after.length);
      if (!text(input.body, 4000) || !["point", "quote"].includes(input.kind) ||
        (quote && !validSelection) || (!quote && caret !== undefined && !validCaret)) {
        throw Object.assign(new Error("批注内容或选区无效（最多 4000 字符）。"), { status: 400 });
      }
      if (!block || page.revision !== input.revision) {
        throw Object.assign(new Error("源文件已改变，请刷新后重新选取位置；草稿仍会保留。"), { status: 409 });
      }
      const ambiguous = page.blocks.some((b) => b.id !== block.id && b.kind === block.kind && b.fingerprint === block.fingerprint);
      const record = { id: randomUUID(), doc: page.doc, kind: input.kind, body: input.body.trim(),
        createdAt: new Date().toISOString(), revision: page.revision, anchor: { ...block, ambiguous },
        ...(quote && { quote: input.quote, start: input.start, end: input.end }),
        ...(!quote && validCaret && { caret: { offset: caret.offset, before: caret.before, after: caret.after } }) };
      await save(docDir(page.doc), record);
      return record;
    },
    async reply(doc, annotationId, body) {
      if (!idPattern.test(annotationId) || !text(body, 4000)) throw new Error("Invalid annotation ID or reply (max 4000 characters)");
      const folder = docDir(doc);
      const note = JSON.parse(await readFile(join(folder, `${annotationId}.json`), "utf8"));
      if (note.doc !== doc) throw new Error("Annotation belongs to a different document");
      const reply = { id: randomUUID(), body: body.trim(), createdAt: new Date().toISOString() };
      await save(join(folder, annotationId), reply);
      return reply;
    },
  };
}

export async function collectAnnotations(pages, store, since) {
  const result = [];
  for (const page of pages.filter((p) => p.doc)) {
    for (const note of await store.list(page.doc)) {
      if (since && note.createdAt <= since && !note.replies.some((reply) => reply.createdAt > since)) continue;
      const block = locateBlock(page, note.revision, note.anchor);
      result.push({ id: note.id, file: page.doc, kind: note.kind, createdAt: note.createdAt, body: note.body,
        ...(note.quote && { quote: note.quote }),
        ...(note.caret && { caret: { ...note.caret, offsetBasis: "rendered-block-utf16" } }),
        location: block ? { heading: block.heading, from: block.start, to: block.end,
          ...(note.kind === "point" && !note.caret && { insertAfterLine: block.end }) } : null,
        ...(!block && { original: { heading: note.anchor.heading, from: note.anchor.start, to: note.anchor.end } }),
        ...(note.replies.length && { replies: note.replies }),
      });
    }
  }
  return result.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
