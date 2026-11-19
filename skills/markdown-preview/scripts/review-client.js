(() => {
  const meta = JSON.parse(document.getElementById('review-data').textContent);
  const $ = (id) => document.getElementById(id);
  const paper = document.querySelector('.paper');
  const rail = $('workspace-rail');
  const form = $('review-draft');
  const input = $('review-body');
  const point = $('review-point');
  const railToggle = $('rail-toggle');
  const shortcut = $('quote-shortcut');
  const topbar = document.querySelector('.topbar');
  const touch = matchMedia('(pointer: coarse)');
  const status = $('review-status');
  const list = $('review-list');
  const api = '/_annotations?doc=' + encodeURIComponent(meta.doc);
  const draftKey = 'preview-draft:' + meta.doc;
  const blockSelector = '[data-review-block]';
  const blockEl = (id) => paper.querySelector(`${blockSelector}[data-review-block="${id}"]`);
  const parent = (node) => node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  const small = matchMedia('(max-width: 1240px)');
  let selected = null;
  let dragging = false;
  let draft = null;
  let picking = false;
  let submitting = false;
  let snapshot = '';
  let refreshVersion = 0;
  let lastFocus;
  let focusedCaret;
  let markerFrame = 0;
  const marker = document.createElement('span');
  marker.className = 'review-caret';
  marker.setAttribute('aria-hidden', 'true');
  marker.hidden = true;
  document.body.append(marker);

  function make(tag, value, cls) {
    const node = document.createElement(tag);
    if (value != null) node.textContent = value;
    if (cls) node.className = cls;
    return node;
  }
  function persist() {
    if (draft) sessionStorage.setItem(draftKey, JSON.stringify({ ...draft, body: input.value }));
    else sessionStorage.removeItem(draftKey);
    document.body.classList.toggle('review-has-draft', Boolean(draft));
  }
  function pick(on) {
    picking = on;
    if (on) {
      selected = null;
      shortcut.hidden = true;
    }
    point.setAttribute('aria-pressed', String(on));
    railToggle.textContent = on ? '取消定位' : '批注';
    document.body.classList.toggle('review-picking', on);
    if (small.matches && on) rail.dispatchEvent(new Event('review:close'));
    status.textContent = on ? '在正文中点击光标位置。' : '';
    scheduleCarets();
  }
  function capture() {
    selected = null;
    const selection = window.getSelection();
    if (picking || submitting || !selection.rangeCount || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    const start = parent(range.startContainer).closest(blockSelector);
    const end = parent(range.endContainer).closest(blockSelector);
    if (!start || !end || !paper.contains(start) || !paper.contains(end)) return;
    const block = start === end ? start : parent(range.commonAncestorContainer).closest(blockSelector);
    const text = range.toString();
    if (!block || !text.trim() || text.length > 4000) return;
    const previous = document.createRange();
    previous.selectNodeContents(block);
    previous.setEnd(range.startContainer, range.startOffset);
    const offset = previous.toString().length;
    selected = { anchor: { kind: 'quote', block: Number(block.dataset.reviewBlock), quote: text, start: offset, end: offset + text.length },
      range: range.cloneRange() };
  }
  function placeShortcut() {
    if (!selected || dragging) {
      shortcut.hidden = true;
      return;
    }
    const topEdge = topbar.getBoundingClientRect().bottom + 6;
    const bottomEdge = document.documentElement.clientHeight - 8;
    const rects = [...selected.range.getClientRects()].filter((r) => r.width > 0 && r.bottom > topEdge && r.top < bottomEdge);
    if (!rects.length) {
      shortcut.hidden = true;
      return;
    }
    shortcut.hidden = false;
    const first = rects[0];
    const last = rects.at(-1);
    const above = first.top - shortcut.offsetHeight - 7;
    const below = last.bottom + 7;
    const useAbove = above >= topEdge && (!touch.matches || below + shortcut.offsetHeight > bottomEdge);
    const maxLeft = document.documentElement.clientWidth - shortcut.offsetWidth - 8;
    const left = (useAbove ? first : last).left;
    shortcut.style.left = Math.max(8, Math.min(left, maxLeft)) + 'px';
    shortcut.style.top = Math.max(topEdge, Math.min(useAbove ? above : below, bottomEdge - shortcut.offsetHeight)) + 'px';
  }
  function updateSelection() {
    capture();
    placeShortcut();
  }
  document.addEventListener('selectionchange', updateSelection);
  paper.addEventListener('contextmenu', (event) => {
    capture();
    if (!selected || !blockEl(selected.anchor.block).contains(event.target)) return;
    const inSelection = [...selected.range.getClientRects()].some((r) =>
      event.clientX >= r.left - 2 && event.clientX <= r.right + 2 &&
      event.clientY >= r.top - 2 && event.clientY <= r.bottom + 2);
    if (!inSelection) return;
    // The annotation action owns this selection; leave native menus elsewhere alone.
    event.preventDefault();
    placeShortcut();
  });
  paper.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button === 0) {
      dragging = true;
      shortcut.hidden = true;
    }
  });
  function finishDrag() {
    if (!dragging) return;
    dragging = false;
    updateSelection();
  }
  window.addEventListener('pointerup', finishDrag);
  window.addEventListener('pointercancel', finishDrag);
  window.addEventListener('scroll', placeShortcut, { passive: true });
  window.addEventListener('resize', placeShortcut);

  function caretAt(event) {
    const node = event.target.closest(blockSelector);
    if (!node) return null;
    const pos = document.caretPositionFromPoint?.(event.clientX, event.clientY);
    const fallback = pos ? null : document.caretRangeFromPoint?.(event.clientX, event.clientY);
    const text = pos?.offsetNode ?? fallback?.startContainer;
    const index = pos?.offset ?? fallback?.startOffset;
    if (!text || text.nodeType !== Node.TEXT_NODE || !node.contains(text)) return null;
    if (text.parentElement.closest('.heading-anchor, .katex, .mermaid, svg')) return null;
    const at = document.createRange();
    at.setStart(text, index);
    at.collapse(true);
    const rect = at.getBoundingClientRect();
    if (!rect.height || event.clientY < rect.top - 4 || event.clientY > rect.bottom + 4 || Math.abs(rect.left - event.clientX) > 18) return null;
    const prefix = document.createRange();
    prefix.selectNodeContents(node);
    prefix.setEnd(text, index);
    const offset = prefix.toString().length;
    const value = node.textContent;
    return { kind: 'point', block: Number(node.dataset.reviewBlock), caret: {
      offset, before: value.slice(Math.max(0, offset - 32), offset), after: value.slice(offset, offset + 32),
    } };
  }

  function caretRange(node, caret) {
    if (!node || !caret) return null;
    const { offset, before, after } = caret;
    const value = node.textContent;
    if (value.slice(Math.max(0, offset - 32), offset) !== before || value.slice(offset, offset + 32) !== after) return null;
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let remaining = offset;
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      if (remaining <= text.length && text.parentElement.closest('.heading-anchor, .katex, .mermaid, svg') === null) {
        const at = document.createRange();
        at.setStart(text, remaining);
        at.collapse(true);
        return at;
      }
      remaining -= text.length;
      if (remaining < 0) return null;
    }
    return null;
  }

  function drawCarets() {
    markerFrame = 0;
    marker.hidden = true;
    const entry = focusedCaret ?? (draft?.caret ? draft : undefined);
    if (!entry || picking) return;
    const node = blockEl(entry.block);
    const at = caretRange(node, entry.caret);
    if (!at) return;
    const rect = at.getBoundingClientRect();
    const top = Math.max(rect.top, topbar.getBoundingClientRect().bottom);
    const bottom = Math.min(rect.bottom, window.innerHeight);
    if (bottom <= top) return;
    const scroller = node.closest('.table-wrap, pre');
    if (scroller) {
      const bounds = scroller.getBoundingClientRect();
      if (rect.left < bounds.left || rect.left > bounds.right) return;
    }
    marker.style.left = Math.round(rect.left) + 'px';
    marker.style.top = Math.ceil(top) + 'px';
    marker.style.height = Math.max(1, Math.floor(bottom - top)) + 'px';
    marker.hidden = false;
  }
  function scheduleCarets() {
    if (!markerFrame) markerFrame = requestAnimationFrame(drawCarets);
  }
  window.addEventListener('scroll', scheduleCarets, { passive: true, capture: true });
  window.addEventListener('resize', scheduleCarets);
  document.fonts.ready.then(scheduleCarets);
  new ResizeObserver(scheduleCarets).observe(paper);

  function caretContext(caret) {
    const snippet = make('span', null, 'review-caret-context');
    const divider = make('span', '|', 'review-context-tick');
    divider.setAttribute('aria-hidden', 'true');
    snippet.append(document.createTextNode(caret.before.slice(-12)), divider,
      document.createTextNode(caret.after.slice(0, 12)));
    snippet.setAttribute('aria-label', `${caret.before.slice(-12)}，插入点，${caret.after.slice(0, 12)}`);
    return snippet;
  }

  function rangeFor(node, { quote, start, end }) {
    if (!node || !quote || node.textContent.slice(start, end) !== quote) return null;
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let offset = 0;
    let began = false;
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      const next = offset + text.length;
      if (!began && start < next) {
        range.setStart(text, start - offset);
        began = true;
      }
      if (began && end <= next) {
        range.setEnd(text, end - offset);
        return range;
      }
      offset = next;
    }
    return null;
  }
  function highlight(name, ranges) {
    if (typeof Highlight === 'function') CSS.highlights.set(name, new Highlight(...ranges));
  }
  function openDraft(anchor, body = input.value) {
    draft = { ...anchor, revision: meta.revision };
    focusedCaret = undefined;
    $('review-save').disabled = false;
    input.value = body;
    $('review-draft-notice').hidden = true;
    highlight('preview-active-note', []);
    const context = $('review-anchor-quote');
    context.replaceChildren(anchor.caret ? caretContext(anchor.caret) : (anchor.quote || ''));
    context.hidden = !anchor.quote && !anchor.caret;
    form.hidden = false;
    status.textContent = '';
    rail.dispatchEvent(new Event('review:open'));
    const node = blockEl(anchor.block);
    lastFocus?.classList.remove('review-focus');
    if (anchor.kind === 'point' && !anchor.caret && node) {
      node.classList.add('review-focus');
      lastFocus = node;
    }
    const range = rangeFor(node, anchor);
    highlight('preview-draft', range ? [range] : []);
    selected = null;
    window.getSelection().removeAllRanges();
    shortcut.hidden = true;
    persist();
    scheduleCarets();
    input.focus({ preventScroll: true });
    if (matchMedia('(max-width: 640px)').matches && node) {
      const position = anchor.caret ? caretRange(node, anchor.caret) : range;
      const rect = (position || node).getBoundingClientRect();
      const room = rail.getBoundingClientRect().top - 16;
      if (rect.bottom > room) window.scrollBy(0, rect.bottom - room);
    }
  }
  // Keep the selection alive while clicking the floating action.
  shortcut.addEventListener('mousedown', (event) => event.preventDefault());
  shortcut.addEventListener('click', () => {
    if (!selected || submitting) return;
    const { anchor } = selected;
    pick(false);
    openDraft(anchor);
  });
  point.addEventListener('click', () => { if (!submitting) pick(!picking); });
  function cancelPicking() {
    pick(false);
    rail.dispatchEvent(new Event('review:open'));
    point.focus({ preventScroll: true });
  }
  railToggle.addEventListener('click', (event) => {
    if (!picking) return;
    event.stopImmediatePropagation();
    cancelPicking();
  }, { capture: true });
  paper.addEventListener('pointerdown', (event) => {
    if (picking && event.button === 0 && event.pointerType === 'mouse') event.preventDefault();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (picking) {
      cancelPicking();
    } else if (!shortcut.hidden) {
      selected = null;
      shortcut.hidden = true;
    }
  });
  paper.addEventListener('click', (event) => {
    if (!picking) return;
    event.preventDefault();
    const anchor = caretAt(event);
    if (!anchor) return;
    pick(false);
    openDraft(anchor);
  });
  input.addEventListener('input', persist);
  function clearDraft() {
    draft = null;
    input.value = '';
    form.hidden = true;
    lastFocus?.classList.remove('review-focus');
    highlight('preview-draft', []);
    persist();
    scheduleCarets();
  }
  $('review-cancel').addEventListener('click', () => { if (!submitting) clearDraft(); });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting || !draft || !input.value.trim()) return;
    submitting = true;
    $('review-save').disabled = true;
    try {
      const response = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, body: input.value }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      clearDraft();
      status.textContent = '';
      await refresh();
    } catch (err) {
      status.textContent = '保存失败：' + err.message;
    } finally {
      submitting = false;
      $('review-save').disabled = false;
    }
  });

  function currentBlock(note) {
    const same = note.revision === meta.revision;
    if (same) return meta.blocks.find((b) => b.id === note.anchor.id && b.fingerprint === note.anchor.fingerprint);
    if (note.anchor.ambiguous !== false) return null;
    const matches = meta.blocks.filter((b) => b.kind === note.anchor.kind && b.fingerprint === note.anchor.fingerprint);
    return matches.length === 1 && matches[0].section === note.anchor.section ? matches[0] : null;
  }
  function noteCard(note, block) {
    const card = make('article', null, 'review-card');
    card.dataset.annotationId = note.id;
    const target = block && blockEl(block.id);
    const at = note.caret ? caretRange(target, note.caret) : rangeFor(target, note);
    const canJump = target && (!note.caret || at);
    if (canJump) {
      card.classList.add('review-card-jump');
      const jump = make('button', note.body, 'review-note-body review-jump');
      jump.type = 'button';
      jump.title = '在正文中查看';
      jump.setAttribute('aria-label', '定位批注：' + note.body);
      card.append(jump);
      card.addEventListener('click', (event) => {
        // Keep text copy available when the user drags across an excerpt or reply.
        const selection = window.getSelection();
        if (event.detail && !selection.isCollapsed && card.contains(selection.anchorNode)) return;
        lastFocus?.classList.remove('review-focus');
        focusedCaret = note.caret ? { block: block.id, caret: note.caret } : undefined;
        highlight('preview-active-note', at && note.quote ? [at] : []);
        if (small.matches) rail.dispatchEvent(new Event('review:close'));
        if (at) {
          window.scrollBy({ top: at.getBoundingClientRect().top - window.innerHeight / 2, behavior: 'smooth' });
        } else {
          target.classList.add('review-focus');
          target.scrollIntoView({ block: 'center', behavior: 'smooth' });
          lastFocus = target;
        }
        scheduleCarets();
      });
    } else {
      card.append(make('p', note.body, 'review-note-body'), make('span', '原文已改动，位置待确认', 'review-meta'));
    }
    if (note.quote) card.append(make('blockquote', note.quote));
    if (note.caret) card.append(caretContext(note.caret));
    for (const reply of note.replies) {
      const thread = make('div', null, 'review-reply');
      thread.append(make('span', 'Agent 回复', 'review-meta'), make('p', reply.body));
      card.append(thread);
    }
    return card;
  }
  async function refresh() {
    const version = ++refreshVersion;
    try {
      const response = await fetch(api);
      if (!response.ok) throw new Error();
      const raw = await response.text();
      if (version !== refreshVersion || raw === snapshot) return;
      const notes = JSON.parse(raw).filter((note) => note.doc === meta.doc);
      snapshot = raw;
      const ranges = [];
      paper.querySelectorAll('.review-point').forEach((node) => node.classList.remove('review-point'));
      const cards = notes.map((note) => {
        const block = currentBlock(note);
        const node = block && blockEl(block.id);
        if (note.kind === 'point' && !note.caret && node) node.classList.add('review-point');
        const range = rangeFor(node, note);
        if (range) ranges.push(range);
        return noteCard(note, block);
      });
      list.replaceChildren(...(cards.length ? cards : [make('p', '本篇还没有批注。', 'rail-hint')]));
      highlight('preview-notes', ranges);
      scheduleCarets();
      $('review-count').textContent = notes.length ? ` ${notes.length}` : '';
    } catch {
      if (version === refreshVersion && !snapshot) list.replaceChildren(make('p', '批注暂时无法读取，稍后会重试。', 'rail-hint'));
    }
  }
  const saved = JSON.parse(sessionStorage.getItem(draftKey) || 'null');
  if (saved) {
    if (saved.revision === meta.revision && meta.blocks[saved.block]) openDraft(saved, saved.body);
    else {
      draft = saved;
      input.value = saved.body;
      form.hidden = false;
      const notice = $('review-draft-notice');
      notice.textContent = '草稿已保留，请重新选取位置。';
      notice.hidden = false;
      $('review-save').disabled = true;
      if (!small.matches) rail.dispatchEvent(new Event('review:open'));
      $('review-anchor-quote').hidden = true;
      persist();
    }
  }
  window.addEventListener('focus', refresh);
  window.addEventListener('pageshow', (event) => { if (event.persisted) refresh(); });
  setInterval(() => { if (!document.hidden) refresh(); }, 3000);
  refresh();
})();
