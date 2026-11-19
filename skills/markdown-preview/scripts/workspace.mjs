import { readFile } from 'node:fs/promises';

export const workspaceCss = readFile(new URL('./workspace.css', import.meta.url), 'utf8');
export const reviewClient = new URL('./review-client.js', import.meta.url);
export const safeJson = (value) => JSON.stringify(value).replaceAll('<', '\\u003c');
export const escapeHtml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export function documentPicker(pages, index, hrefFor) {
  const titles = new Set();
  const duplicates = new Set();
  for (const { title } of pages) {
    if (titles.has(title)) duplicates.add(title);
    titles.add(title);
  }
  return `<div class="doc-picker" id="doc-picker">
    <button class="doc-picker-trigger" id="doc-picker-trigger" type="button" aria-label="切换文档：${escapeHtml(pages[index].title)}" aria-expanded="false" aria-controls="doc-picker-panel">
      <span class="topbar-title" id="topbar-title">${escapeHtml(pages[index].title)}</span>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="m3 4.5 3 3 3-3"/></svg>
    </button>
    <section class="doc-picker-panel" id="doc-picker-panel" aria-label="切换文档" hidden>
      <label class="doc-picker-search"><svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="6.75" cy="6.75" r="4.25"/><path d="m10 10 3 3"/></svg>
        <input id="doc-picker-query" type="search" aria-label="搜索文档标题或路径" placeholder="搜索文档" autocomplete="off">
      </label>
      <nav class="doc-picker-list" aria-label="所有文档">
        ${pages.map((page, i) => `<a href="${hrefFor(i)}" data-page-idx="${i}" data-picker-key="${escapeHtml([page.title, page.path || ''].join(' ').toLowerCase())}"${i === index ? ' aria-current="page"' : ''} title="${escapeHtml(page.path || page.title)}">
          <span>${escapeHtml(page.title)}${duplicates.has(page.title) && page.path ? `<small>${escapeHtml(page.path)}</small>` : ''}</span>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m3.5 8 3 3 6-6"/></svg>
        </a>`).join('')}
      </nav>
      <p class="rail-hint doc-picker-empty" role="status" hidden>未找到匹配文档。</p>
    </section>
  </div>`;
}

export function documentsContent(pages, index, hrefFor) {
  const out = new Set(pages[index].links);
  const renderRow = (page, i) => {
    const current = i === index;
    const outgoing = out.has(i);
    const incoming = page.links?.includes(index);
    const relation = outgoing && incoming ? ['双向', '两份文档互相链接'] : incoming ? ['反链', '这份文档链接到当前页'] : outgoing ? ['出链', '当前文档链接到这里'] : null;
    const outline = page.toc.filter((h) => h.level > 1 || h.text !== page.title);
    const min = Math.min(...outline.map((h) => h.level));
    const previewId = `doc-preview-${i}`;
    return `<li class="doc-row">
      <div class="doc-row-main">
        <a class="doc-title" href="${hrefFor(i)}" data-page-idx="${i}"${current ? ' aria-current="page"' : ''}${page.path ? ` title="${escapeHtml(page.path)}"` : ''}>${escapeHtml(page.title)}</a>
        ${relation ? `<span class="doc-relation" title="${relation[1]}">${relation[0]}</span>` : ''}
        ${current ? '' : `<button class="doc-expand" type="button" aria-expanded="false" aria-controls="${previewId}" aria-label="预览 ${escapeHtml(page.title)}" title="查看摘要与章节"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="m3 4.5 3 3 3-3"/></svg></button>`}
      </div>
      ${current ? '' : `<div class="doc-preview" id="${previewId}" hidden>
        ${page.path ? `<span class="doc-path">${escapeHtml(page.path)}</span>` : ''}
        ${page.excerpt ? `<p class="doc-excerpt">${escapeHtml(page.excerpt)}${[...page.excerpt].length >= 160 ? '…' : ''}</p>` : ''}
        ${outline.length ? `<nav class="doc-outline" aria-label="${escapeHtml(page.title)} · 章节">${outline.map((h) =>
          `<a style="--depth:${h.level - min}" href="${hrefFor(i)}#${encodeURIComponent(h.id)}" data-page-idx="${i}">${escapeHtml(h.text)}</a>`).join('')}</nav>` : ''}
      </div>`}
    </li>`;
  };
  return `<ul class="doc-list">${pages.map(renderRow).join('')}</ul>`;
}

export function buildReviewRail(current) {
  return `<aside class="workspace-rail" id="workspace-rail" aria-labelledby="review-title">
    <div class="rail-top">
      <h2 id="review-title">批注<span id="review-count"></span></h2>
      <button type="button" class="toc-close-btn" id="rail-close" aria-label="收起批注">✕</button>
    </div>
    <section id="review-panel" class="rail-content">
      <div class="review-actions">
        <button class="icon-btn" id="review-point" type="button" aria-pressed="false">添加插入点</button>
      </div>
      <p class="rail-hint review-status" id="review-status" aria-live="polite"></p>
      <form id="review-draft" class="review-draft" hidden>
        <p class="review-meta" id="review-draft-notice" hidden></p>
        <blockquote id="review-anchor-quote" hidden></blockquote>
        <textarea id="review-body" aria-label="批注内容" placeholder="写下你的想法…" maxlength="4000" required></textarea>
        <button class="icon-btn" type="submit" id="review-save">保存批注</button>
        <button class="icon-btn" type="button" id="review-cancel">取消</button>
      </form>
      <div class="review-list" id="review-list"><p class="rail-hint">正在读取批注…</p></div>
    </section>
  </aside><script type="application/json" id="review-data">${safeJson({ doc: current.doc, revision: current.revision, blocks: current.blocks })}</script>`;
}
