const defaultSplit = .42;
const rail = document.getElementById('divider');
const workspace = document.getElementById('workspace');
const storage = 'tex-preview-split';
const compact = matchMedia('(max-width: 760px)');
let share = Number(localStorage.getItem(storage)) || defaultSplit;
let sourceOpen = true;
let compactPane = 'pdf';
let drag;

function size() {
  const width = workspace.clientWidth;
  if (!width) return;
  const min = Math.min(278, .4 * width);
  const max = Math.max(min, width - 355);
  const source = Math.min(max, Math.max(min, Math.round(width * share)));
  workspace.style.setProperty('--source-width', source + 'px');
  rail.setAttribute('aria-valuemin', Math.round(100 * min / width));
  rail.setAttribute('aria-valuemax', Math.round(100 * max / width));
  rail.setAttribute('aria-valuenow', Math.round(100 * source / width));
}

new ResizeObserver(size).observe(workspace);

function save() {
  localStorage.setItem(storage, String(share));
}

rail.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  event.preventDefault();
  rail.focus();
  rail.setPointerCapture(event.pointerId);
  drag = { id: event.pointerId, x: event.clientX, before: rail.offsetLeft };
  workspace.classList.add('resizing');
});

rail.addEventListener('pointermove', (event) => {
  if (drag?.id !== event.pointerId) return;
  share = (drag.before + event.clientX - drag.x) / workspace.clientWidth;
  size();
});

rail.addEventListener('lostpointercapture', () => {
  if (!drag) return;
  drag = null;
  workspace.classList.remove('resizing');
  share = rail.offsetLeft / workspace.clientWidth;
  save();
});

rail.addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  if (event.key === 'Home') share = 0;
  else if (event.key === 'End') share = 1;
  else share = (rail.offsetLeft + (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 48 : 20)) / workspace.clientWidth;
  size();
  share = rail.offsetLeft / workspace.clientWidth;
  save();
});

rail.addEventListener('dblclick', () => {
  share = defaultSplit;
  size();
  save();
});

function update() {
  workspace.classList.toggle('source-closed', !sourceOpen);
  workspace.dataset.compactPane = compactPane;
  document.getElementById('toggle-source').setAttribute('aria-pressed', compact.matches ? compactPane === 'tex' : sourceOpen);
  document.getElementById('compact-pdf').setAttribute('aria-pressed', compactPane === 'pdf');
}

compact.addEventListener('change', update);
update();

export function sourceVisible() {
  return sourceOpen;
}

export function showSourcePane(open = true) {
  sourceOpen = open;
  compactPane = open ? 'tex' : 'pdf';
  update();
}

export function showPdfPane() {
  compactPane = 'pdf';
  update();
}

export function isCompact() {
  return compact.matches;
}

const EXPAND_ICON = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M9.5 2.75h3.75V6.5M6.5 13.25H2.75V9.5M13.25 2.75 9 7M2.75 13.25 7 9" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const RESTORE_ICON = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M9 7h3.75M9 7V3.25M9 7l4.25-4.25M7 9H3.25M7 9v3.75M7 9l-4.25 4.25" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function createReviewWindow() {
  const panel = document.getElementById('review');
  const header = document.getElementById('review-handle');
  const resize = document.getElementById('resize-review');
  const expand = document.getElementById('expand-review');
  const exitLabel = document.getElementById('review-exit-label');
  const padding = 12;
  const topClear = 58;
  let anchor = null;
  let manual = null;
  let customSize = null;
  let expanded = false;
  let pending = 0;

  const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
  const px = (value) => Math.round(value) + 'px';

  function position() {
    pending = 0;
    if (panel.hidden) return;
    const frame = workspace.getBoundingClientRect();
    const widthLimit = Math.max(240, frame.width - padding * 2);
    const heightLimit = Math.max(200, frame.height - padding * 2);
    const dockedHeightLimit = Math.max(200, frame.height - topClear - padding);
    const row = anchor?.isConnected && anchor.getBoundingClientRect();
    const near = Boolean(row && row.height && row.bottom >= frame.top && row.top <= frame.bottom);
    const defaultWidth = near ? 384 : 392;
    const width = Math.min(expanded ? widthLimit : (customSize?.width ?? manual?.width ?? defaultWidth), widthLimit);

    // Scoped line annotations anchor beside/below the source line;
    // global review sheet docks right below the top-right floating island.
    const desiredX = near
      ? row.left - frame.left + (compact.matches ? 10 : 62)
      : frame.width - width - padding;
    const below = near ? Math.max(topClear, row.bottom - frame.top + 8) : topClear;
    const lowerSpace = frame.height - below - padding;
    const upperSpace = near ? row.top - frame.top - 8 - topClear : 0;
    const above = near && lowerSpace < Math.min(300, upperSpace);
    const automaticHeight = near
      ? (Math.max(upperSpace, lowerSpace) >= 200 ? (above ? upperSpace : lowerSpace) : dockedHeightLimit)
      : dockedHeightLimit;
    const height = expanded ? heightLimit : customSize?.height ?? null;

    panel.style.width = px(width);
    panel.style.height = height === null ? '' : px(Math.min(height, heightLimit));
    const autoMax = near ? Math.min(automaticHeight, 500) : Math.min(dockedHeightLimit, 720);
    panel.style.maxHeight = px(expanded || customSize ? heightLimit : Math.min(manual?.height ?? autoMax, heightLimit));

    const desiredY = above ? row.top - frame.top - panel.offsetHeight - 8 : below;
    const x = expanded ? padding : (manual?.x ?? desiredX);
    const y = expanded ? padding : (manual?.y ?? desiredY);
    panel.style.left = px(clamp(x, padding, Math.max(padding, frame.width - padding - panel.offsetWidth)));
    panel.style.top = px(clamp(y, padding, Math.max(padding, frame.height - padding - panel.offsetHeight)));
  }

  function schedule() {
    if (!pending) pending = requestAnimationFrame(position);
  }

  function setExpanded(next) {
    expanded = next;
    const label = expanded ? '退出全屏' : '全屏显示批注';
    panel.classList.toggle('is-expanded', expanded);
    expand.querySelector('svg').outerHTML = expanded ? RESTORE_ICON : EXPAND_ICON;
    expand.setAttribute('aria-label', label);
    expand.title = expanded ? label + '（Esc）' : label;
    if (expanded) expand.setAttribute('aria-keyshortcuts', 'Escape');
    else expand.removeAttribute('aria-keyshortcuts');
    exitLabel.hidden = !expanded;
    resize.hidden = expanded;
    position();
  }

  function adjust(initial, dx, dy, sizing) {
    if (sizing) {
      manual = { x: initial.x, y: initial.y };
      const width = clamp(initial.width + dx, 280, workspace.clientWidth - initial.x - padding);
      const height = clamp(initial.height + dy, 180, workspace.clientHeight - initial.y - padding);
      customSize = { width, height };
    } else manual = { ...initial, x: initial.x + dx, y: initial.y + dy };
    position();
  }

  function measure() {
    return { x: panel.offsetLeft, y: panel.offsetTop, width: panel.offsetWidth, height: panel.offsetHeight };
  }

  function pointerControl(handle, sizing) {
    let gesture = null;
    handle.addEventListener('pointerdown', (event) => {
      if (expanded || event.button !== 0 || (!sizing && event.target.closest('button'))) return;
      event.preventDefault();
      handle.focus({ preventScroll: true });
      handle.setPointerCapture(event.pointerId);
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, initial: measure() };
    });
    handle.addEventListener('pointermove', (event) => {
      if (gesture?.id !== event.pointerId) return;
      adjust(gesture.initial, event.clientX - gesture.x, event.clientY - gesture.y, sizing);
    });
    handle.addEventListener('lostpointercapture', () => { gesture = null; });
    handle.addEventListener('keydown', (event) => {
      if (expanded || event.target !== handle) return;
      const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
      if (!direction) return;
      event.preventDefault();
      const distance = event.shiftKey ? 40 : 15;
      adjust(measure(), direction[0] * distance, direction[1] * distance, sizing);
    });
  }

  pointerControl(header, false);
  pointerControl(resize, true);
  expand.onclick = () => setExpanded(!expanded);
  new ResizeObserver(schedule).observe(workspace);
  document.getElementById('source-code').addEventListener('scroll', schedule);
  return {
    keepPosition() {
      if (panel.hidden || expanded) return;
      manual = measure();
      schedule();
    },
    exitFullscreen() {
      if (!expanded || panel.hidden) return false;
      setExpanded(false);
      return true;
    },
    dock(row, resetPosition = false) {
      anchor = row;
      if (resetPosition) manual = null;
      if (panel.hidden && expanded) setExpanded(false);
      schedule();
    },
  };
}
