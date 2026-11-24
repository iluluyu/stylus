function element(tag, text, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function action(text, callback, report, className) {
  const button = element('button', text, className);
  button.type = 'button';
  button.onclick = () => Promise.resolve().then(callback).catch(report);
  return button;
}

function location({ file, from, to, selection }) {
  const start = selection?.from ?? from;
  const end = selection?.to ?? to;
  return file + ':' + start + (end === start ? '' : '–' + end);
}

function diffPanel(diff, expanded) {
  const panel = element('details', undefined, 'diff');
  panel.open = Boolean(expanded);
  panel.append(element('summary', 'TeX 修改'));
  const pre = element('pre');
  for (const change of diff) {
    const prefix = change.added ? '+ ' : '− ';
    const text = change.value.trimEnd().split('\n').map((line) => prefix + line).join('\n') + '\n';
    pre.append(element('span', text, change.added ? 'added' : 'removed'));
  }
  panel.append(pre);
  return panel;
}

export function createReviewCard(note, { active, latest, expanded, open, submit, threadDrafts, report }) {
  const original = note.build !== latest;
  const resolved = note.status === 'resolved';
  const card = element('article', undefined, 'note ' + note.status);
  card.classList.toggle('active', Boolean(active));
  card.dataset.id = note.id;

  // 1. Quiet Meta Row: Location + inline jump links on left, subtle status on right
  const source = note.current || note.source;
  const place = source ? location(source) : note.pdf ? '第 ' + note.pdf.page + ' 页' : 'TeX 批注';
  const heading = element('div', undefined, 'note-header');
  const metaLeft = element('div', undefined, 'note-meta-left');
  metaLeft.append(element('span', place, 'note-location'));
  if (original && !note.current) metaLeft.append(element('span', '位置待确认', 'note-stale'));
  heading.append(metaLeft);

  const metaRight = element('div', undefined, 'note-meta-right');
  if (note.current || !original || note.pdf?.rects.length && !note.pdf.quote) {
    const pdf = action('PDF', () => open(note, 'current'), report, 'jump-link');
    pdf.title = '在 PDF 中定位';
    metaRight.append(pdf);
  }
  if (note.current) {
    const tex = action('TEX', () => open(note, 'source'), report, 'jump-link');
    tex.title = '在 TeX 中定位';
    metaRight.append(tex);
  }
  if (original) {
    const orig = action('原选区', () => open(note, 'original'), report, 'jump-link subtle');
    orig.title = '查看批注时的原选区';
    metaRight.append(orig);
  }
  if (resolved) metaRight.append(element('span', '已解决', 'note-resolved-tag'));
  heading.append(metaRight);
  card.append(heading);

  // 2. Primary Comment Body
  const mode = note.current && !note.pdf ? 'source' : original && !note.current ? 'original' : 'current';
  const body = action(note.body, () => open(note, mode), report, 'note-body');
  body.title = '定位批注';
  card.append(body);

  // 3. Minimal Hairline Quote (no heavy nested box)
  const sourceQuote = note.source?.selection?.quote;
  if (sourceQuote) card.append(element('blockquote', sourceQuote, 'note-quote source-excerpt'));
  else if (note.pdf?.quote) card.append(element('blockquote', note.pdf.quote, 'note-quote'));
  else if (note.source?.excerpt?.length) {
    card.append(element('pre', note.source.excerpt.join('\n'), 'note-quote source-excerpt'));
  }

  // 4. Optional Diff
  if (note.diff?.length) card.append(diffPanel(note.diff, expanded));

  // 5. Flat Left-Indented Replies (no nested boxes)
  if (note.replies.length) {
    const repliesWrap = element('div', undefined, 'note-replies');
    for (const reply of note.replies) {
      const agent = reply.author === 'agent';
      const item = element('div', undefined, 'reply ' + (agent ? 'is-agent' : 'is-user'));
      item.append(element('div', agent ? 'Agent' : '你', 'reply-meta' + (agent ? ' agent' : '')));
      item.append(element('p', reply.body));
      repliesWrap.append(item);
    }
    card.append(repliesWrap);
  }

  // 6. Quiet Action Row
  const actions = element('div', undefined, 'note-actions');
  const replyButton = action(note.replies.length ? '继续回复' : '回复', () => openReply().focus(), report, 'text-action reply-action');
  const statusButton = action(
    resolved ? '重新打开' : '解决',
    () => submit({ id: note.id, status: resolved ? 'open' : 'resolved' }),
    report,
    'text-action ' + (resolved ? 'reopen-action' : 'resolve-action'),
  );
  actions.append(replyButton, statusButton);
  card.append(actions);

  function openReply() {
    replyButton.hidden = true;
    const form = element('form', undefined, 'reply-form');
    const input = element('textarea');
    input.setAttribute('aria-label', '回复批注');
    input.placeholder = '输入回复…';
    input.value = threadDrafts.get(note.id) || '';
    input.required = true;
    input.maxLength = 6000;
    threadDrafts.set(note.id, input.value);
    input.oninput = () => threadDrafts.set(note.id, input.value);

    const actionsRow = element('div', undefined, 'reply-form-actions');
    const cancel = action('取消', () => {
      threadDrafts.delete(note.id);
      form.remove();
      replyButton.hidden = false;
    }, report, 'reply-cancel');
    const button = element('button', '发送', 'primary');
    button.type = 'submit';
    actionsRow.append(cancel, button);
    form.append(input, actionsRow);

    form.onsubmit = async (event) => {
      event.preventDefault();
      if (button.disabled) return;
      const body = input.value;
      button.disabled = true;
      cancel.disabled = true;
      input.readOnly = true;
      threadDrafts.delete(note.id);
      try {
        await submit({ id: note.id, body });
        form.remove();
        replyButton.hidden = false;
      } catch (error) {
        if (!threadDrafts.has(note.id)) threadDrafts.set(note.id, body);
        report(error);
      } finally {
        button.disabled = false;
        cancel.disabled = false;
        input.readOnly = false;
      }
    };
    card.append(form);
    return input;
  }

  if (threadDrafts.has(note.id)) openReply();
  return card;
}
