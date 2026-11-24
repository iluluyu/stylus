import * as pdfjs from '/vendor/pdf.mjs';
import { EventBus, PDFLinkService, PDFViewer } from '/vendor/pdf_viewer.mjs';
import { createReviewWindow, isCompact, showPdfPane, showSourcePane, sourceVisible } from '/layout.js';
import { createReviewCard } from '/review-cards.js';

const $ = (id) => document.getElementById(id);
const workspace = $('workspace');
const container = $('pdf-scroll');
const reviewWindow = createReviewWindow();
const draftKey = 'tex-preview-draft';
const eventBus = new EventBus();
const linkService = new PDFLinkService({ eventBus });
const viewer = new PDFViewer({ container, eventBus, linkService, removePageBorders: true, imageResourcesPath: '/vendor/images/' });
linkService.setViewer(viewer);
pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdf.worker.mjs';

let latest = null;
let shown = null;
let buildQueue = Promise.resolve();
let historicalPinned = false;
let pdfTask;
let scale = 'page-width';
let beforePdfFullscreen = null;
let notes = [];
let notesFingerprint = '';
let activeNote = null;
let mark = null;
let draft = null;
let savingDraft = null;
let textTarget = null;
let sourceSelection = null;
let sourceFocus = null;
let sourceFile = null;
let sourceFiles = [];
let sourceLines = [];
let sourceRequest = 0;
let selectionRange = null;
let reviewAnchor = null;
let reviewFilter = 'all';
let drag = null;
let noticeTimer;
const threadDrafts = new Map();

let viewerWidth = 0;
let viewerHeight = 0;
new ResizeObserver(() => {
  const width = container.clientWidth;
  const height = container.clientHeight;
  if (viewerWidth !== width && scale === 'page-width' ||
      (viewerWidth !== width || viewerHeight !== height) && scale === 'page-fit') applyPdfZoom();
  viewerWidth = width;
  viewerHeight = height;
}).observe(container);

function applyPdfZoom() {
  const page = viewer.getPageView(viewer.currentPageNumber - 1);
  if (!page || !container.clientWidth) return;
  if (scale === 'page-width' || scale === 'page-fit') {
    const gutter = parseFloat(getComputedStyle(container).getPropertyValue('--pdf-gutter'));
    const available = Math.max(1, container.clientWidth - 2 * gutter);
    const width = !isCompact() && sourceVisible() ? available : Math.min(880, available);
    const widthScale = (width / page.width) * page.scale;
    const outset = parseFloat(getComputedStyle($('viewer')).paddingTop);
    const heightScale = Math.max(1, container.clientHeight - outset - 12) / page.height * page.scale;
    viewer.currentScaleValue = scale === 'page-fit' ? Math.min(widthScale, heightScale) : widthScale;
  } else viewer.currentScaleValue = scale === 'page-actual' ? 1 : scale;
}

function updateZoomControl() {
  const percentage = Math.round(viewer.currentScale * 100) + '%';
  $('custom-zoom').textContent = percentage;
  $('fit').value = typeof scale === 'number' ? 'custom' : scale;
  $('fit').title = '当前缩放 ' + percentage;
}

async function api(path, payload) {
  const response = await fetch('/api/' + path, payload ? {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  } : undefined);
  if (!response.ok) throw new Error((await response.json()).error || response.statusText);
  return response.json();
}

function route(name, params, id = shown) {
  return name + '?' + new URLSearchParams({ id, ...params });
}

function notify(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { $('toast').hidden = true; }, 7000);
}

function report(error) {
  notify(error.message);
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function action(text, callback) {
  const button = element('button', text);
  button.type = 'button';
  button.onclick = () => Promise.resolve().then(callback).catch(report);
  return button;
}

function location(source) {
  return source.file + ':' + source.from + (source.to === source.from ? '' : '–' + source.to);
}

function excerpt(text, isSource = false) {
  return element(isSource ? 'pre' : 'blockquote', text, 'note-quote' + (isSource ? ' source-excerpt' : ''));
}

function updateSelectionButtons() {
  const reviewing = Boolean(shown && shown === latest);
  $('source-note').hidden = !reviewing || !sourceFocus;
  $('selection-jump').textContent = sourceSelection ? 'PDF' : 'TEX';
  $('selection-jump').title = sourceSelection ? '在 PDF 中查看' : '在 TeX 中查看';
  if (!reviewing || !(textTarget || sourceSelection)) $('selection-tools').hidden = true;
}

function placeSelectionTools(at) {
  const tools = $('selection-tools');
  if (!at || !shown || shown !== latest || !(textTarget || sourceSelection)) return;
  if (at.bottom < 0 || at.top > innerHeight) {
    tools.hidden = true;
    return;
  }
  tools.hidden = false;
  const width = tools.offsetWidth;
  const height = tools.offsetHeight;
  tools.style.left = Math.max(8, Math.min(innerWidth - width - 8, (at.left + at.right - width) / 2)) + 'px';
  tools.style.top = Math.max(8, Math.min(innerHeight - height - 8, at.top > height + 12 ? at.top - height - 8 : at.bottom + 8)) + 'px';
}

function showBuild(id) {
  const next = buildQueue.then(() => switchBuild(id));
  buildQueue = next.catch(() => {});
  return next;
}

async function switchBuild(id) {
  if (!id || id === shown) return;
  const page = viewer.currentPageNumber || 1;
  const oldTask = pdfTask;
  const next = pdfjs.getDocument({
    url: '/api/pdf?' + new URLSearchParams({ id }),
    cMapUrl: '/vendor/cmaps/', standardFontDataUrl: '/vendor/standard_fonts/',
    wasmUrl: '/vendor/wasm/', iccUrl: '/vendor/iccs/',
    disableRange: true,
  });
  try {
    const pdf = await next.promise;
    shown = id;
    mark = null;
    textTarget = null;
    sourceSelection = null;
    sourceFocus = null;
    updateSelectionButtons();
    $('empty-pdf').hidden = true;
    const ready = new Promise((resolve) => eventBus.on('pagesinit', resolve, { once: true }));
    viewer.setDocument(pdf);
    linkService.setDocument(pdf);
    await ready;
    pdfTask = next;
    void oldTask?.destroy().catch(() => {});
    const targetPage = Math.min(page, pdf.numPages);
    if (targetPage > 1) viewer.currentPageNumber = targetPage;
    applyPdfZoom();
    updateZoomControl();
    if (targetPage === 1) container.scrollTop = 0;
    $('page').value = targetPage;
    $('page').max = pdf.numPages;
    $('pages').textContent = '/ ' + pdf.numPages;
    updateHistory();
    if (sourceVisible()) await showSource(undefined, sourceFile, false);
  } catch (error) {
    if (pdfTask !== next) void next.destroy().catch(() => {});
    throw error;
  }
}

function updateHistory() {
  const historical = Boolean(shown && shown !== latest);
  $('history').hidden = !historical;
  $('box-note').disabled = historical || !shown;
  if (historical) setBox(false);
  updateSelectionButtons();
}

function pageFor(child) {
  return child?.closest?.('.pdfViewer .page');
}

function geometry(page) {
  const view = viewer.getPageView(Number(page.dataset.pageNumber) - 1);
  return { frame: page.getBoundingClientRect(), viewport: view.viewport,
    native: view.pdfPage.getViewport({ scale: 1, rotation: 0 }) };
}

function offsetToPoint(page, x, y) {
  const { frame, viewport, native } = geometry(page);
  return native.convertToViewportPoint(...viewport.convertToPdfPoint(x - frame.left, y - frame.top));
}

function rectToPage(page, rect) {
  const { frame } = geometry(page);
  return [
    ...offsetToPoint(page, Math.max(frame.left, rect.left), Math.max(frame.top, rect.top)),
    ...offsetToPoint(page, Math.min(frame.right, rect.right), Math.min(frame.bottom, rect.bottom)),
  ];
}

function selectionPoint(page, rects, quote = '') {
  const [x1, y1, x2, y2] = rects[0];
  return { page: Number(page.dataset.pageNumber), x: (x1 + x2) / 2, y: (y1 + y2) / 2, rects, quote };
}

function nativeToViewport(page, x, y) {
  const { viewport, native } = geometry(page);
  return viewport.convertToViewportPoint(...native.convertToPdfPoint(x, y));
}

function findPdfWord(page, point) {
  const layer = page.querySelector('.textLayer');
  const quote = point.matchWord;
  if (!quote || !layer || !point.rects?.length) return null;
  const wordChar = /[\p{L}\p{M}\p{N}_]/u;
  const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT);
  let found = null;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    for (let start = node.data.indexOf(quote); start !== -1; start = node.data.indexOf(quote, start + 1)) {
      const end = start + quote.length;
      if ((wordChar.test(quote[0]) && wordChar.test(node.data[start - 1] || '')) ||
          (wordChar.test(quote.at(-1)) && wordChar.test(node.data[end] || ''))) continue;
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, end);
      const bounds = range.getBoundingClientRect();
      if (!bounds.width || !bounds.height) continue;
      const [x, y] = offsetToPoint(page, (bounds.left + bounds.right) / 2, (bounds.top + bounds.bottom) / 2);
      if (!point.rects.some(([left, top, right, bottom]) => x >= left && x <= right && y >= top - 2 && y <= bottom + 2)) continue;
      if (found) return null;
      found = rectToPage(page, bounds);
    }
  }
  return found;
}

function drawMarks(pageNumber) {
  const view = viewer.getPageView(pageNumber - 1);
  if (!view?.pdfPage) return;
  const page = view.div;
  page.querySelector('.review-marks')?.remove();
  const overlay = element('div', undefined, 'review-marks');
  overlay.setAttribute('aria-hidden', 'true');
  const points = notes.filter((note) => note.build === shown && note.pdf?.page === pageNumber && note.status === 'open' &&
    !(note.id === activeNote && mark?.page === pageNumber)).map((note) => ({ point: note.pdf, current: note.id === activeNote }));
  if (mark?.page === pageNumber) points.push({ point: mark, current: true });
  if (draft?.build === shown && draft.pdf?.page === pageNumber) points.push({ point: draft.pdf, current: true });
  for (const { point, current } of points) {
    const exact = findPdfWord(page, point);
    const rects = exact ? [exact] : point.rects?.length ? point.rects : [[point.x - 5, point.y - 11, point.x + 30, point.y + 5]];
    for (const [x1, y1, x2, y2] of rects) {
      const [a, b] = nativeToViewport(page, x1, y1);
      const [c, d] = nativeToViewport(page, x2, y2);
      const kind = exact ? 'text' : point.kind || (point.quote ? 'text' : point.rects?.length ? 'region' : 'sync');
      const indicator = element('div', undefined, 'review-mark ' + kind + (current ? ' current' : ''));
      Object.assign(indicator.style, { left: Math.min(a, c) + 'px', top: Math.min(b, d) + 'px',
        width: Math.abs(a - c) + 'px', height: Math.abs(b - d) + 'px' });
      overlay.append(indicator);
    }
  }
  if (overlay.childElementCount) page.append(overlay);
}

function redrawMarks() {
  for (const page of $('viewer').querySelectorAll('.page[data-loaded]')) drawMarks(Number(page.dataset.pageNumber));
}

async function jumpPdf(point) {
  if (!point) {
    notify('此处未找到对应的 PDF 位置。');
    return;
  }
  showPdfPane();
  if (isCompact() && reviewAnchor) setReview(false);
  const view = viewer.getPageView(point.page - 1);
  if (!view) return;
  const pdfPage = view.pdfPage || await viewer.pdfDocument.getPage(point.page);
  const native = pdfPage.getViewport({ scale: 1, rotation: 0 });
  const [x, y] = native.convertToPdfPoint(point.x, point.y);
  mark = point;
  viewer.scrollPageIntoView({
    pageNumber: point.page, destArray: [null, { name: 'XYZ' }, x, y, null],
    ignoreDestinationZoom: true, center: 'both',
  });
  redrawMarks();
}

function hasBox(note) {
  return note.pdf?.rects.length && !note.pdf.quote;
}

async function relocatedBox(note) {
  const { build, pdf, source, current } = note;
  if (!source || !current || note.diff?.length) return null;
  const revision = shown;
  const [before, after] = await Promise.all([
    api(route('forward', { file: source.file, line: source.line }, build)),
    api(route('forward', { file: current.file, line: current.line }, revision)),
  ]);
  if (shown !== revision || before?.page !== pdf.page || !after) return null;
  const top = Math.min(...pdf.rects.flatMap(([, a, , b]) => [a, b]));
  const bottom = Math.max(...pdf.rects.flatMap(([, a, , b]) => [a, b]));
  if (before.y < top - 24 || before.y > bottom + 24) return null;
  const dx = after.x - before.x;
  const dy = after.y - before.y;
  const rects = pdf.rects.map(([x1, y1, x2, y2]) => [x1 + dx, y1 + dy, x2 + dx, y2 + dy]);
  const page = await viewer.pdfDocument.getPage(after.page);
  const viewport = page.getViewport({ scale: 1, rotation: 0 });
  if (rects.some(([x1, y1, x2, y2]) => Math.min(x1, x2, y1, y2) < 0 ||
      Math.max(x1, x2) > viewport.width || Math.max(y1, y2) > viewport.height)) return null;
  return { ...pdf, page: after.page, x: pdf.x + dx, y: pdf.y + dy, rects };
}

async function jumpSource(source, fallback = null) {
  const id = shown;
  const { file, line, from, to, kind } = source;
  const startLine = source.selection?.from ?? (kind ? line : from);
  const matchWord = (source.selection?.quote || source.quote || '').trim();
  const [start, end] = await Promise.all([
    api(route('forward', { file, line: startLine }, id)),
    !kind && to !== from ? api(route('forward', { file, line: to }, id)) : null,
  ]);
  if (shown !== id) return;
  const first = start || end || fallback;
  if (!first) return jumpPdf(null);
  const rects = [first, end].filter((point, index) =>
    point?.page === first.page && point.rect && (index === 0 || point !== first)).map((point) => point.rect);
  if (rects.length === 2) {
    const [a, b] = rects;
    if (Math.abs(a[0] - b[0]) < 3 && Math.abs(a[2] - b[2]) < 3 && b[1] >= a[1] && b[3] - a[1] < 100) {
      rects.splice(0, 2, [a[0], a[1], a[2], b[3]]);
    }
  }
  return jumpPdf({ ...first, rects, kind: 'sync', matchWord: matchWord.length <= 80 && !/[\n\\{}$]/.test(matchWord) ? matchWord : '' });
}

function sourceLine(number) {
  return $('source-code').querySelector('.source-line[data-line="' + number + '"]');
}

function noteSource(note) {
  return shown === latest ? note.current : shown === note.build ? note.source : null;
}

function sameScope(target, anchor) {
  return target && anchor && target.file === anchor.file && target.from <= anchor.to && anchor.from <= target.to;
}

function visibleNotes() {
  if (reviewAnchor) return notes.filter((note) => sameScope(noteSource(note), reviewAnchor));
  if (reviewFilter === 'open') return notes.filter((note) => note.status === 'open');
  if (reviewFilter === 'resolved') return notes.filter((note) => note.status === 'resolved');
  return notes;
}

function dockReview(resetPosition = false) {
  const anchor = reviewAnchor && reviewAnchor.file === sourceFile && sourceVisible() ? sourceLine(reviewAnchor.to) : null;
  reviewWindow.dock(anchor, resetPosition);
}

function setReview(open, anchor = null) {
  const resetPosition = $('review').hidden || Boolean(anchor || reviewAnchor) && !sameScope(anchor, reviewAnchor);
  reviewAnchor = anchor;
  open = open && (!reviewAnchor || Boolean(draft || visibleNotes().length));
  if (!open) reviewAnchor = null;
  $('review').hidden = !open;
  $('toggle-review').setAttribute('aria-expanded', open);
  dockReview(resetPosition);
  renderNotes();
}

function updateGutters() {
  const counts = new Map();
  for (const note of notes) {
    const anchor = noteSource(note);
    if (anchor?.file !== sourceFile) continue;
    const entry = counts.get(anchor.from) || { total: 0, open: 0 };
    entry.total++;
    if (note.status === 'open') entry.open++;
    counts.set(anchor.from, entry);
  }
  const markers = new Set([...$('source-code').querySelectorAll('.note-count')]);
  for (const [line, { total, open }] of counts) {
    const row = sourceLine(line);
    if (!row) continue;
    let button = row.querySelector('.note-count');
    if (!button) {
      button = action(String(total), () => {
        const related = notes.map(noteSource).filter((anchor) => anchor?.file === sourceFile && anchor.from === line);
        if (!related.length) return;
        const anchor = { file: sourceFile, from: line, to: Math.max(...related.map((item) => item.to)) };
        const isOpen = !$('review').hidden && sameScope(reviewAnchor, anchor);
        setReview(!isOpen, isOpen ? null : anchor);
      });
      button.className = 'note-count';
      row.querySelector('.line-gutter').prepend(button);
    }
    button.textContent = total;
    button.classList.toggle('has-open', open > 0);
    button.classList.toggle('all-resolved', open === 0);
    button.title = line + ' 行 · ' + total + ' 条批注' + (open ? '（' + open + ' 待处理）' : '（均已解决）');
    button.setAttribute('aria-label', '查看第 ' + line + ' 行的 ' + total + ' 条批注');
    button.setAttribute('aria-expanded', !$('review').hidden && reviewAnchor?.file === sourceFile && reviewAnchor.from === line);
    markers.delete(button);
  }
  for (const button of markers) button.remove();
}

function selectionAtLine(selection, number, length) {
  if (!selection || number < selection.from || number > selection.to) return null;
  return [number === selection.from ? selection.startColumn - 1 : 0,
    number === selection.to ? selection.endColumn - 1 : length];
}

function texCode(line, word) {
  const code = element('code');
  const syntax = /(?<!\\)%.*|\\(?:[\p{L}@]+|.)/gu;
  const tokens = [...line.matchAll(syntax)];
  const stops = new Set([0, line.length]);
  for (const token of tokens) {
    stops.add(token.index);
    stops.add(token.index + token[0].length);
  }
  for (const boundary of word || []) stops.add(boundary);
  const ordered = [...stops].sort((a, b) => a - b);
  let tokenIndex = 0;
  for (let index = 1; index < ordered.length; index++) {
    const a = ordered[index - 1];
    const b = ordered[index];
    const content = line.slice(a, b);
    while (tokens[tokenIndex] && tokens[tokenIndex].index + tokens[tokenIndex][0].length <= a) tokenIndex++;
    const token = tokens[tokenIndex];
    const klass = token && token.index <= a ? (token[0].startsWith('%') ? 'tex-comment' : 'tex-command') : undefined;
    const selected = word && a >= word[0] && b <= word[1];
    code.append(selected || klass ? element(selected ? 'mark' : 'span', content, klass) : document.createTextNode(content));
  }
  return code;
}

const CHECK_ICON = '<svg class="file-check" width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 8.5 6.5 11.5 12.5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function setFileMenu(open) {
  const menu = $('file-menu');
  const trigger = $('file-trigger');
  const next = Boolean(open && sourceFiles.length);
  menu.hidden = !next;
  trigger.setAttribute('aria-expanded', String(next));
}

function renderFileMenu(files) {
  sourceFiles = files;
  $('file-label').textContent = sourceFile || '';
  $('file-trigger').title = sourceFile ? '当前文件：' + sourceFile + '（点击切换）' : '切换 TeX 源文件';
  const menu = $('file-menu');
  menu.replaceChildren(...files.map((file) => {
    const slash = file.lastIndexOf('/');
    const name = slash === -1 ? file : file.slice(slash + 1);
    const dir = slash === -1 ? '' : file.slice(0, slash + 1);
    const item = element('button', undefined, 'file-option');
    item.type = 'button';
    item.role = 'option';
    item.dataset.file = file;
    const selected = file === sourceFile;
    item.setAttribute('aria-selected', String(selected));
    const textWrap = element('span', undefined, 'file-option-text');
    textWrap.append(element('span', name, 'file-option-name'));
    if (dir) textWrap.append(element('span', dir, 'file-option-dir'));
    const check = document.createElement('span');
    check.className = 'file-option-check';
    if (selected) check.innerHTML = CHECK_ICON;
    item.append(textWrap, check);
    item.onclick = () => {
      setFileMenu(false);
      if (file === sourceFile) return;
      if (!draft && reviewAnchor?.file !== file && reviewAnchor) setReview(false);
      showSource(null, file).then(renderNotes).catch(report);
    };
    return item;
  }));
}

async function showSource(target, requestedFile = target?.file || sourceFile, reveal = true) {
  if (!shown) return;
  const id = shown;
  const request = ++sourceRequest;
  const { files, main } = await api(route('files', {}, id));
  if (shown !== id || request !== sourceRequest) return;
  const file = files.includes(requestedFile) ? requestedFile : main;
  const lines = await api(route('source', { file }, id));
  if (shown !== id || request !== sourceRequest) return;
  sourceFile = file;
  sourceLines = lines;
  sourceSelection = null;
  sourceFocus = target?.file === file ? target : null;
  renderFileMenu(files);
  updateSelectionButtons();
  const content = document.createDocumentFragment();
  for (const [index, line] of lines.entries()) {
    const number = index + 1;
    const selected = Boolean(target && number >= target.from && number <= target.to);
    const row = element('div', undefined, 'source-line' + (selected ? ' selected' : ''));
    row.dataset.line = number;
    const button = action(String(number), async () => jumpPdf(await api(route('forward', { file, line: number }, id))));
    button.className = 'line-link';
    button.setAttribute('aria-label', '在 PDF 中查看第 ' + number + ' 行');
    const gutter = element('div', undefined, 'line-gutter');
    gutter.append(button);
    const word = selectionAtLine(sourceFocus?.selection, number, line.length);
    if (word) row.classList.add('word-selected');
    row.append(gutter, texCode(line, word));
    content.append(row);
  }
  $('source-code').replaceChildren(content);
  if (reveal) showSourcePane();
  dockReview();
  updateGutters();
  if (target) sourceLine(target.selection?.from ?? target.from)?.scrollIntoView({ block: 'center' });
}

function beginNote(target, body = '') {
  if (!target.build && shown !== latest) return;
  if (draft) {
    notify('请先保存或取消当前批注。');
    $('note-body').focus();
    return;
  }
  const submissionId = Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => b.toString(16).padStart(2, '0')).join('');
  draft = { build: shown, submissionId, ...target };
  $('target').textContent = target.source ? location(target.source) : '第 ' + target.pdf.page + ' 页' +
    (target.pdf.quote ? '' : ' · 框选区域');
  if (target.source) {
    const lines = sourceLines.slice(target.source.from - 1, target.source.to);
    $('target').append(excerpt(target.source.quote || lines.join('\n'), true));
  } else if (target.pdf.quote) $('target').append(excerpt(target.pdf.quote));
  $('note-body').value = body;
  $('draft-tex').hidden = draft.build !== shown || !hasBox(draft);
  $('draft-status').textContent = body ? '草稿已保存' : '';
  $('note-form').hidden = false;
  $('selection-tools').hidden = true;
  setReview(true, draft.build === shown ? target.source || null : null);
  window.getSelection().removeAllRanges();
  $('review-content').scrollTop = 0;
  $('note-body').focus({ preventScroll: true });
}

function discardDraft() {
  draft = null;
  $('note-form').reset();
  $('note-form').hidden = true;
  localStorage.removeItem(draftKey);
  redrawMarks();
}

function rememberDraft() {
  const body = $('note-body').value;
  if (body.trim()) localStorage.setItem(draftKey, JSON.stringify({ target: draft, body }));
  else localStorage.removeItem(draftKey);
  $('draft-status').textContent = body.trim() ? '草稿已保存' : '';
}

async function restoreDraft() {
  const stored = localStorage.getItem(draftKey);
  if (!stored) return;
  const { target, body } = JSON.parse(stored);
  if (notes.some((note) => note.id === target.submissionId)) {
    localStorage.removeItem(draftKey);
    return;
  }
  if (target.build !== shown) {
    try { await api(route('files', {}, target.build)); } catch { return; }
  } else if (target.source?.file && sourceFile !== target.source.file) await showSource(target.source);
  beginNote(target, body);
}

async function finishDraft() {
  if (!draft) return true;
  if (savingDraft) return savingDraft;
  const input = $('note-body');
  const body = input.value.trim();
  if (!body) {
    discardDraft();
    setReview(false);
    return true;
  }
  input.readOnly = true;
  $('finish-note').disabled = true;
  $('cancel-note').disabled = true;
  $('draft-status').textContent = '正在保存…';
  savingDraft = (async () => {
    try {
      const saved = await api('review', { ...draft, body });
      activeNote = saved.id;
      reviewWindow.keepPosition();
      discardDraft();
      await loadNotes();
      const card = $('threads').querySelector('.note.active');
      if (card?.dataset.id === saved.id && !$('review').hidden) {
        const content = $('review-content');
        const bounds = content.getBoundingClientRect();
        const target = card.getBoundingClientRect();
        if (target.top < bounds.top || target.bottom > bounds.bottom) content.scrollTop += target.top - bounds.top;
      }
      return true;
    } catch (error) {
      if (draft) $('draft-status').textContent = '保存失败，可重试';
      report(error);
      return !draft;
    } finally {
      input.readOnly = false;
      $('finish-note').disabled = false;
      $('cancel-note').disabled = false;
      savingDraft = null;
    }
  })();
  return savingDraft;
}

async function closeReview() {
  if (await finishDraft()) setReview(false);
}

function setBox(active) {
  if (active && draft) {
    notify('请先保存或取消当前批注。');
    $('note-body').focus();
    return;
  }
  $('box-note').setAttribute('aria-pressed', active);
  container.classList.toggle('boxing', active);
  $('box-hint').hidden = !active;
  if (active) {
    window.getSelection().removeAllRanges();
    $('selection-tools').hidden = true;
  } else {
    drag = null;
    $('box-draft').hidden = true;
  }
}

function rectangle(x, y, otherX, otherY) {
  return { left: Math.min(x, otherX), top: Math.min(y, otherY),
    right: Math.max(x, otherX), bottom: Math.max(y, otherY) };
}

function clampToPage(frame, x, y) {
  return [
    Math.max(frame.left, Math.min(frame.right, x)),
    Math.max(frame.top, Math.min(frame.bottom, y)),
  ];
}

container.addEventListener('pointerdown', (event) => {
  const page = pageFor(event.target);
  if (!page || !viewer.getPageView(Number(page.dataset.pageNumber) - 1)?.pdfPage ||
      !container.classList.contains('boxing') || event.button !== 0) return;
  event.preventDefault();
  window.getSelection().removeAllRanges();
  const frame = page.getBoundingClientRect();
  const [x, y] = clampToPage(frame, event.clientX, event.clientY);
  container.setPointerCapture(event.pointerId);
  drag = { id: event.pointerId, page, x, y };
});

container.addEventListener('pointermove', (event) => {
  if (!drag || drag.id !== event.pointerId) return;
  const frame = drag.page.getBoundingClientRect();
  const [cx, cy] = clampToPage(frame, event.clientX, event.clientY);
  const rect = rectangle(drag.x, drag.y, cx, cy);
  Object.assign($('box-draft').style, { left: rect.left + 'px', top: rect.top + 'px',
    width: rect.right - rect.left + 'px', height: rect.bottom - rect.top + 'px' });
  $('box-draft').hidden = false;
});

container.addEventListener('pointerup', (event) => {
  if (!drag || drag.id !== event.pointerId) return;
  const { page, x, y } = drag;
  if (container.hasPointerCapture(event.pointerId)) container.releasePointerCapture(event.pointerId);
  const frame = page.getBoundingClientRect();
  const [cx, cy] = clampToPage(frame, event.clientX, event.clientY);
  const rect = rectangle(x, y, cx, cy);
  if (rect.right - rect.left < 4 || rect.bottom - rect.top < 4) {
    drag = null;
    $('box-draft').hidden = true;
    return;
  }
  setBox(false);
  beginNote({ pdf: selectionPoint(page, [rectToPage(page, rect)]) });
});

container.addEventListener('pointercancel', () => setBox(false));
container.addEventListener('lostpointercapture', () => {
  if (!drag) return;
  drag = null;
  $('box-draft').hidden = true;
});

async function jumpToTeX(event) {
  const page = pageFor(event.target);
  if (!page || !shown || container.classList.contains('boxing') ||
      !viewer.getPageView(Number(page.dataset.pageNumber) - 1)?.pdfPage) return;
  const modifier = event.ctrlKey || event.metaKey;
  if (event.type === 'click' ? !modifier || event.detail > 1 : modifier || event.target.closest('.annotationLayer')) return;
  event.preventDefault();
  event.stopPropagation();
  const quote = event.type === 'dblclick' ? window.getSelection().toString().trim() : '';
  window.getSelection().removeAllRanges();
  const [x, y] = offsetToPoint(page, event.clientX, event.clientY);
  await showSourceAtPdf({ page: page.dataset.pageNumber, x, y, quote }).catch(report);
}

async function showSourceAtPdf({ page, x, y, quote }) {
  const id = shown;
  const request = ++sourceRequest;
  const hit = await api(route('inverse', { page, x, y, quote: (quote || '').slice(0, 600) }, id));
  if (shown !== id || request !== sourceRequest) return;
  if (!hit) return notify('此处未找到对应的 TeX 源码。');
  if (!draft && reviewAnchor && !sameScope(reviewAnchor, hit)) setReview(false);
  await showSource(hit);
}
container.addEventListener('click', jumpToTeX, true);
container.addEventListener('dblclick', jumpToTeX, true);

function parent(node) {
  return node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
}

function sourceBoundary(node, offset) {
  const code = parent(node)?.closest('.source-line code');
  if (!code) return null;
  const range = document.createRange();
  range.setStart(code, 0);
  range.setEnd(node, offset);
  return { line: Number(code.closest('.source-line').dataset.line), column: range.toString().length + 1 };
}

document.addEventListener('selectionchange', () => {
  const selection = window.getSelection();
  textTarget = null;
  sourceSelection = null;
  selectionRange = null;
  updateSelectionButtons();
  if (!selection.rangeCount || selection.isCollapsed || !shown || shown !== latest) return;
  const range = selection.getRangeAt(0);
  const start = parent(range.startContainer);
  const end = parent(range.endContainer);
  const firstPage = pageFor(start);
  const lastPage = pageFor(end);
  if (firstPage && lastPage) {
    if (firstPage !== lastPage || !viewer.getPageView(Number(firstPage.dataset.pageNumber) - 1)?.pdfPage) return;
    const rects = [...range.getClientRects()].filter((rect) => rect.width > 1 && rect.height > 1)
      .slice(0, 150).map((rect) => rectToPage(firstPage, rect));
    const quote = selection.toString().trim();
    if (!rects.length || !quote) return;
    textTarget = selectionPoint(firstPage, rects, quote);
  } else {
    const first = sourceBoundary(range.startContainer, range.startOffset);
    const last = sourceBoundary(range.endContainer, range.endOffset);
    if (!first || !last || !selection.toString().trim()) return;
    sourceSelection = { file: sourceFile, from: first.line, to: last.line, startColumn: first.column,
      endColumn: last.column, quote: selection.toString() };
  }
  selectionRange = range.cloneRange();
  updateSelectionButtons();
  placeSelectionTools(range.getBoundingClientRect());
});

document.addEventListener('contextmenu', (event) => {
  if (!selectionRange || ![container, $('source-code')].some((pane) => pane.contains(event.target))) return;
  const hit = [...selectionRange.getClientRects()].some((rect) => rect.left <= event.clientX &&
    event.clientX <= rect.right && rect.top <= event.clientY && event.clientY <= rect.bottom);
  if (!hit) return;
  event.preventDefault();
  placeSelectionTools({ left: event.clientX, right: event.clientX, top: event.clientY, bottom: event.clientY });
});

document.addEventListener('scroll', () => {
  if (selectionRange) placeSelectionTools(selectionRange.getBoundingClientRect());
}, true);

async function openNote(note, mode) {
  const locateSource = mode === 'source' && note.current;
  if (locateSource) reviewWindow.keepPosition();
  activeNote = note.id;
  mark = null;
  renderNotes();
  if (mode === 'original') {
    historicalPinned = true;
    await showBuild(note.build);
    if (note.pdf?.rects.length || !note.source) return jumpPdf(note.pdf);
    if (!note.pdf) return showSource(note.source);
    return jumpSource(note.source, note.pdf);
  } else {
    historicalPinned = false;
    await showBuild(latest);
    if (locateSource) return showSource(locateSource);
    const original = shown === note.build ? note.pdf : null;
    if (original?.rects.length) return jumpPdf(original);
    if (hasBox(note)) {
      const revision = shown;
      const moved = await relocatedBox(note);
      if (shown !== revision || activeNote !== note.id) return;
      if (moved) return jumpPdf(moved);
      historicalPinned = true;
      await showBuild(note.build);
      return jumpPdf(note.pdf);
    }
    if (note.current) return jumpSource(note.current, original);
    if (original) return jumpPdf(original);
    notify('新版位置待确认，可查看原选区。');
  }
}

function renderNotes() {
  const panel = $('threads');
  const expanded = new Set([...panel.querySelectorAll('.note:has(details[open])')].map((card) => card.dataset.id));
  const relevant = visibleNotes();
  const open = notes.filter((note) => note.status === 'open').length;
  $('review-badge').hidden = !open;
  $('review-badge').textContent = open;
  $('review-title').textContent = reviewAnchor ? '此处批注' : '批注';
  $('all-notes').hidden = !reviewAnchor;
  $('count').hidden = !reviewAnchor;
  $('count').textContent = reviewAnchor ? location(reviewAnchor) : '';

  const filters = $('review-filters');
  filters.hidden = Boolean(reviewAnchor) || !notes.length;
  const countsByFilter = { all: notes.length, open };
  for (const tab of filters.querySelectorAll('.filter-pill')) {
    const key = tab.dataset.filter;
    tab.setAttribute('aria-selected', String(key === reviewFilter));
    tab.querySelector('.tab-count').textContent = countsByFilter[key];
  }

  panel.replaceChildren(...relevant.map((note) => createReviewCard(note, {
    active: note.id === activeNote, latest, expanded: expanded.has(note.id), open: openNote, threadDrafts, report,
    submit: async (payload) => { await api('thread', payload); await loadNotes(); },
  })));

  const empty = $('review-empty');
  const showEmpty = !draft && !relevant.length;
  empty.hidden = !showEmpty;
  if (showEmpty) {
    empty.textContent = !notes.length
      ? '选中 PDF 或 TeX 文本，或使用「框选」即可添加批注。'
      : '当前没有待处理的批注。';
  }

  updateGutters();
  dockReview();
  redrawMarks();
}

async function loadNotes() {
  const result = await api('review');
  const fingerprint = JSON.stringify([latest, result]);
  if (fingerprint === notesFingerprint) return;
  notesFingerprint = fingerprint;
  notes = result;
  renderNotes();
}

async function refresh() {
  const state = await api('state');
  latest = state.id;
  if (state.title) document.title = state.title + ' · TeX Preview';

  const statusSummary = state.building
    ? '正在编译…'
    : state.error
      ? (latest ? '编译失败（显示上一版）' : '编译失败')
      : latest
        ? '排版已更新'
        : '等待编译';
  $('status').setAttribute('aria-label', statusSummary);
  $('status').classList.toggle('failed', Boolean(state.error));
  $('status').classList.toggle('building', Boolean(state.building));
  $('status').classList.toggle('ready', Boolean(latest && !state.building && !state.error));
  $('status-text').hidden = !state.error;
  $('status-text').textContent = state.error ? '编译失败' : '';
  $('build').title = statusSummary + ' · 点击重新编译';
  $('build').classList.toggle('is-building', Boolean(state.building));
  $('build').classList.toggle('is-failed', Boolean(state.error));
  $('build-error').hidden = !state.error;
  $('build-log').textContent = state.error;
  if (!shown) $('empty-pdf').textContent = state.error ? '打开上方编译错误查看详情' : '正在生成 PDF…';
  if (!historicalPinned) await showBuild(latest);
  updateHistory();
  await loadNotes();
}

$('build').onclick = () => api('build', {}).then(refresh).catch(report);
$('back-current').onclick = () => {
  historicalPinned = false;
  showBuild(latest).catch(report);
};
$('prev').onclick = () => { if (viewer.currentPageNumber > 1) viewer.currentPageNumber--; };
$('next').onclick = () => { if (viewer.currentPageNumber < viewer.pagesCount) viewer.currentPageNumber++; };
$('page').onchange = () => {
  if (viewer.pagesCount) viewer.currentPageNumber = Math.max(1, Math.min(viewer.pagesCount, Number($('page').value) || 1));
};
function adjustZoom(increase) {
  if (!shown) return;
  if (increase) viewer.increaseScale();
  else viewer.decreaseScale();
  scale = viewer.currentScale;
  updateZoomControl();
}

$('zoom-in').onclick = () => adjustZoom(true);
$('zoom-out').onclick = () => adjustZoom(false);
$('fit').onchange = () => {
  scale = $('fit').value;
  applyPdfZoom();
  updateZoomControl();
};
$('pdf-fullscreen').disabled = !document.fullscreenEnabled;
$('pdf-fullscreen').onclick = async () => {
  try {
    if (document.fullscreenElement === workspace) await document.exitFullscreen();
    else {
      beforePdfFullscreen = { source: sourceVisible(), pane: workspace.dataset.compactPane };
      await workspace.requestFullscreen();
    }
  } catch (error) {
    if (document.fullscreenElement !== workspace) beforePdfFullscreen = null;
    report(error);
  }
};
document.addEventListener('fullscreenchange', () => {
  const fullscreen = document.fullscreenElement === workspace;
  if (fullscreen) showSourcePane(false);
  else if (beforePdfFullscreen) {
    showSourcePane(beforePdfFullscreen.source);
    if (beforePdfFullscreen.pane === 'pdf') showPdfPane();
    beforePdfFullscreen = null;
  }
  $('pdf-fullscreen').textContent = fullscreen ? '退出全屏' : '全屏';
  $('pdf-fullscreen').setAttribute('aria-pressed', fullscreen);
  $('pdf-fullscreen').title = fullscreen ? '退出 PDF 全屏' : 'PDF 全屏';
  dockReview();
});
$('toggle-source').onclick = () => {
  if (isCompact() || !sourceVisible()) showSource(sourceFocus).catch(report);
  else {
    showSourcePane(false);
    dockReview();
  }
};
$('compact-pdf').onclick = () => {
  showPdfPane();
  if (reviewAnchor && !draft) setReview(false);
};
$('toggle-review').onclick = () => {
  if ($('review').hidden || reviewAnchor && !draft) setReview(true);
  else closeReview();
};
$('close-review').onclick = closeReview;
$('all-notes').onclick = () => setReview(true);
for (const tab of $('review-filters').querySelectorAll('.filter-pill')) {
  tab.onclick = () => {
    reviewFilter = tab.dataset.filter;
    renderNotes();
  };
}
$('file-trigger').onclick = () => {
  const opening = $('file-menu').hidden;
  setFileMenu(opening);
  if (opening) {
    const active = $('file-menu').querySelector('[aria-selected="true"]') || $('file-menu').firstElementChild;
    active?.focus();
  }
};
$('file-menu').addEventListener('keydown', (event) => {
  const items = [...$('file-menu').querySelectorAll('.file-option')];
  const index = items.indexOf(document.activeElement);
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    items[(index + 1) % items.length]?.focus();
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    items[(index - 1 + items.length) % items.length]?.focus();
  } else if (event.key === 'Home') {
    event.preventDefault();
    items[0]?.focus();
  } else if (event.key === 'End') {
    event.preventDefault();
    items.at(-1)?.focus();
  }
});
document.addEventListener('pointerdown', (event) => {
  if (!$('file-menu').hidden && !$('file-picker-wrap').contains(event.target)) setFileMenu(false);
}, true);
for (const id of ['text-note', 'selection-jump', 'source-note']) {
  $(id).onmousedown = (event) => { if (event.button === 0) event.preventDefault(); };
}
$('text-note').onclick = () => {
  if (sourceSelection) beginNote({ source: sourceSelection });
  else if (textTarget) beginNote({ pdf: textTarget });
};
$('selection-jump').onclick = () => {
  const source = sourceSelection;
  const pdf = textTarget;
  window.getSelection().removeAllRanges();
  if (source) jumpSource(source).catch(report);
  else if (pdf) showSourceAtPdf(pdf).catch(report);
};
$('source-note').onclick = () => {
  if (!sourceFocus) return;
  const source = sourceFocus.selection ? { file: sourceFocus.file, ...sourceFocus.selection } : sourceFocus;
  beginNote({ source });
};
$('box-note').onclick = () => setBox(!container.classList.contains('boxing'));
$('draft-tex').onclick = () => {
  if (draft?.build !== shown || !hasBox(draft)) return;
  reviewWindow.keepPosition();
  showSourceAtPdf(draft.pdf).catch(report);
};
$('note-body').oninput = rememberDraft;
$('cancel-note').onclick = () => {
  discardDraft();
  setReview(false);
};
$('note-form').onsubmit = (event) => {
  event.preventDefault();
  finishDraft();
};
document.addEventListener('pointerdown', (event) => {
  if (!draft || !event.isPrimary || event.button !== 0 || $('review').contains(event.target)) return;
  if (!event.target.closest('#selection-tools, #source-note, #toggle-review')) finishDraft();
}, true);
$('review').addEventListener('focusout', (event) => {
  if (draft && event.relatedTarget && !$('review').contains(event.relatedTarget)) finishDraft();
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (reviewWindow.exitFullscreen()) {
    event.preventDefault();
    return;
  }
  if (!$('file-menu').hidden) {
    setFileMenu(false);
    $('file-trigger').focus();
    return;
  }
  setBox(false);
  if (!$('selection-tools').hidden) window.getSelection().removeAllRanges();
  else if (!$('review').hidden && (draft || $('review').contains(event.target))) closeReview();
});
eventBus.on('pagerendered', ({ pageNumber }) => drawMarks(pageNumber));
eventBus.on('textlayerrendered', ({ pageNumber }) => drawMarks(pageNumber));
eventBus.on('pagechanging', ({ pageNumber }) => { $('page').value = pageNumber; });
eventBus.on('scalechanging', () => {
  updateZoomControl();
  requestAnimationFrame(redrawMarks);
});

await refresh().catch(report);
await restoreDraft().catch(report);
if (!draft && new URLSearchParams(window.location.search).has('review')) setReview(true);
let polling = false;
setInterval(async () => {
  if (document.hidden || polling) return;
  polling = true;
  try { await refresh(); } catch (error) { report(error); }
  finally { polling = false; }
}, 1500);
