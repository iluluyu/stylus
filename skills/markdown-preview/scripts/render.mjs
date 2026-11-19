import MarkdownIt from "markdown-it";
import katex from "katex";
import hljs from "highlight.js";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, extname } from "node:path";

const { unescapeAll } = new MarkdownIt().utils;
const digest = (text) => createHash("sha256").update(text).digest("hex");

const MATH_ENVS = new Set([
  "equation", "equation*",
  "align", "align*",
  "alignat", "alignat*",
  "gather", "gather*",
  "multline", "multline*",
  "flalign", "flalign*",
  "eqnarray", "eqnarray*",
  "cases", "dcases", "rcases",
  "split",
]);

function escapeHtml(str) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderKatex(tex, displayMode) {
  try {
    return katex.renderToString(tex.trim(), {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: true,
    });
  } catch (err) {
    return `<span class="math-error" title="${escapeHtml(err.message)}">${escapeHtml(tex)}</span>`;
  }
}

function isValidInlineMathOpen(src, pos) {
  const next = src.charCodeAt(pos + 1);
  if (Number.isNaN(next)) return false;
  // Disallow space/tab/newline immediately after opening $
  if (next === 0x20 || next === 0x09 || next === 0x0a || next === 0x0d) return false;
  return true;
}

function isValidInlineMathClose(src, pos) {
  const prev = src.charCodeAt(pos - 1);
  if (prev === 0x20 || prev === 0x09 || prev === 0x0a || prev === 0x0d) return false;
  // Avoid treating "$5 and $10" as math when closing $ is followed by a digit
  const next = src.charCodeAt(pos + 1);
  if (next >= 0x30 && next <= 0x39) return false;
  return true;
}

function mathPlugin(md) {
  // Inline rules: \( ... \), $$ ... $$, and $ ... $
  md.inline.ruler.before("escape", "math_inline", (state, silent) => {
    const src = state.src;
    const pos = state.pos;
    const ch = src.charCodeAt(pos);

    // \( ... \)
    if (ch === 0x5c && src.charCodeAt(pos + 1) === 0x28) {
      let end = pos + 2;
      while (end < state.posMax) {
        if (src.charCodeAt(end) === 0x5c && src.charCodeAt(end + 1) === 0x29) {
          if (!silent) {
            const token = state.push("math_inline", "math", 0);
            token.markup = "\\(";
            token.content = src.slice(pos + 2, end);
          }
          state.pos = end + 2;
          return true;
        }
        if (src.charCodeAt(end) === 0x5c) end += 2;
        else end += 1;
      }
      return false;
    }

    if (ch !== 0x24) return false;

    // Inline $$ ... $$ (e.g. inside table cells or paragraphs)
    if (src.charCodeAt(pos + 1) === 0x24) {
      let end = pos + 2;
      while (end < state.posMax - 1) {
        if (src.charCodeAt(end) === 0x5c) {
          end += 2;
          continue;
        }
        if (src.charCodeAt(end) === 0x24 && src.charCodeAt(end + 1) === 0x24) {
          if (!silent) {
            const token = state.push("math_inline", "math", 0);
            token.markup = "$$";
            token.content = src.slice(pos + 2, end);
          }
          state.pos = end + 2;
          return true;
        }
        end += 1;
      }
      return false;
    }

    // Single $ ... $
    if (!isValidInlineMathOpen(src, pos)) return false;

    let end = pos + 1;
    while (end < state.posMax) {
      const cur = src.charCodeAt(end);
      if (cur === 0x5c) {
        end += 2;
        continue;
      }
      if (cur === 0x0a) return false; // single-$ inline math stays on one line
      if (cur === 0x24) {
        if (isValidInlineMathClose(src, end)) {
          if (!silent) {
            const token = state.push("math_inline", "math", 0);
            token.markup = "$";
            token.content = src.slice(pos + 1, end);
          }
          state.pos = end + 1;
          return true;
        }
        return false;
      }
      end += 1;
    }
    return false;
  });

  // Block rules: $$ ... $$, \[ ... \], and \begin{env} ... \end{env}
  md.block.ruler.before("fence", "math_block", (state, startLine, endLine, silent) => {
    const startPos = state.bMarks[startLine] + state.tShift[startLine];
    const maxPos = state.eMarks[startLine];
    if (startPos + 2 > maxPos) return false;

    const firstLine = state.src.slice(startPos, maxPos);
    const trimmed = firstLine.trim();

    let closeDelim = null;
    let openContent = "";
    let envName = null;

    if (trimmed.startsWith("$$")) {
      closeDelim = "$$";
      openContent = trimmed.slice(2);
    } else if (trimmed.startsWith("\\[")) {
      closeDelim = "\\]";
      openContent = trimmed.slice(2);
    } else {
      const m = trimmed.match(/^\\begin\{([a-zA-Z*]+)\}/);
      if (m && MATH_ENVS.has(m[1])) {
        envName = m[1];
        closeDelim = `\\end{${envName}}`;
      }
    }

    if (!closeDelim) return false;
    if (silent) return true;

    // Single-line $$ ... $$ or \[ ... \] or \begin{env}...\end{env}
    if (!envName && openContent.trimEnd().endsWith(closeDelim) && openContent.trim().length >= closeDelim.length) {
      const inner = openContent.slice(0, openContent.lastIndexOf(closeDelim));
      const token = state.push("math_block", "math", 0);
      token.block = true;
      token.content = inner.trim();
      token.map = [startLine, startLine + 1];
      state.line = startLine + 1;
      return true;
    }
    if (envName && trimmed.includes(closeDelim) && trimmed.indexOf(closeDelim) > 0) {
      const token = state.push("math_block", "math", 0);
      token.block = true;
      token.content = trimmed;
      token.map = [startLine, startLine + 1];
      state.line = startLine + 1;
      return true;
    }

    // Multi-line block
    let nextLine = startLine;
    let found = false;
    const lines = [];
    if (envName) {
      lines.push(firstLine);
    } else if (openContent.trim()) {
      lines.push(openContent);
    }

    while (++nextLine < endLine) {
      const pos = state.bMarks[nextLine] + state.tShift[nextLine];
      const max = state.eMarks[nextLine];
      if (pos < max && state.sCount[nextLine] < state.blkIndent) break;
      const lineText = state.src.slice(pos, max);
      const lineTrim = lineText.trim();

      if (envName) {
        lines.push(lineText);
        if (lineTrim.includes(closeDelim)) {
          found = true;
          break;
        }
      } else if (lineTrim.endsWith(closeDelim)) {
        const beforeClose = lineTrim.slice(0, lineTrim.length - closeDelim.length);
        if (beforeClose.trim()) lines.push(beforeClose);
        found = true;
        break;
      } else {
        lines.push(lineText);
      }
    }

    if (!found) return false;

    state.line = nextLine + 1;
    const token = state.push("math_block", "math", 0);
    token.block = true;
    token.content = lines.join("\n").trim();
    token.map = [startLine, state.line];
    return true;
  }, { alt: ["paragraph", "reference", "blockquote", "list"] });

  md.renderer.rules.math_inline = (tokens, idx) => renderKatex(tokens[idx].content, false);
  md.renderer.rules.math_block = (tokens, idx) =>
    `<div class="math-display">${renderKatex(tokens[idx].content, true)}</div>\n`;
}

function slugify(text, seen) {
  const base = text
    .toLowerCase()
    .trim()
    .replace(/<[^>]+>/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "section";
  const count = seen.get(base) || 0;
  seen.set(base, count + 1);
  return count === 0 ? base : `${base}-${count}`;
}

export function extractFrontmatter(source) {
  const normalized = source.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { meta: {}, body: normalized, lineOffset: 0 };
  const meta = {};
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.+)$/);
    if (kv) {
      meta[kv[1].toLowerCase()] = kv[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  return { meta, body: normalized.slice(match[0].length), lineOffset: match[0].split("\n").length - 1 };
}

function parseChartConfig(raw) {
  const parsed = JSON.parse(raw);
  // Shorthand format: { type, labels, series: [{ name, data, color? }], title?, xLabel?, yLabel? }
  if (Array.isArray(parsed.series) && !parsed.data) {
    const palette = ["#2563eb", "#cf5b2a", "#0d9488", "#7c3aed", "#d97706", "#475569"];
    const type = parsed.type || "line";
    return {
      type,
      data: {
        labels: parsed.labels || [],
        datasets: parsed.series.map((s, i) => {
          const color = s.color || palette[i % palette.length];
          return {
            label: s.name || `Series ${i + 1}`,
            data: s.data,
            borderColor: color,
            backgroundColor: type === "bar" ? `${color}cc` : `${color}22`,
            borderWidth: 2,
            pointRadius: type === "line" ? 3 : undefined,
            tension: s.tension ?? 0.2,
            fill: s.fill ?? false,
          };
        }),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: parsed.title ? { display: true, text: parsed.title } : { display: false },
          legend: { position: "top" },
        },
        scales: {
          x: parsed.xLabel ? { title: { display: true, text: parsed.xLabel } } : {},
          y: parsed.yLabel ? { title: { display: true, text: parsed.yLabel } } : {},
        },
      },
    };
  }
  return parsed;
}

export function renderMarkdown(source, options = {}) {
  const { meta, body, lineOffset } = extractFrontmatter(source);
  const toc = [];
  const blocks = [];
  let excerpt = "";
  const anchorAttrs = (token) => token.meta?.previewBlock != null ? ` data-review-block="${token.meta.previewBlock}"` : "";
  const seenSlugs = new Map();
  let hasMermaid = false;
  let hasChart = false;

  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: false,
  });

  md.use(mathPlugin);
  md.inline.ruler.before("link", "wiki_link", (state, silent) => {
    if (state.linkLevel || !state.src.startsWith("[[", state.pos)) return false;
    const end = state.src.indexOf("]]", state.pos + 2);
    if (end < 0 || end + 2 > state.posMax) return false;
    const match = /^([^\[\]\n|]+)(?:\|([^\[\]\n]+))?$/.exec(state.src.slice(state.pos + 2, end));
    if (!match || !match[1].trim()) return false;
    const target = match[1].trim();
    if (!silent) {
      const token = state.push("wiki_link", "", 0);
      token.content = match[2]?.trim() || target;
      token.meta = { target };
    }
    state.pos = end + 2;
    return true;
  });
  md.renderer.rules.wiki_link = (tokens, idx) => {
    const token = tokens[idx];
    return `<a class="wiki-link" href="#" data-wiki-target="${escapeHtml(token.meta.target)}">${escapeHtml(token.content)}</a>`;
  };

  // Wrap tables so wide three-line tables scroll cleanly on narrow viewports
  const defaultTableOpen = md.renderer.rules.table_open || ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));
  const defaultTableClose = md.renderer.rules.table_close || ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));
  md.renderer.rules.table_open = (tokens, idx, opts, env, self) =>
    `<div class="table-wrap">\n${defaultTableOpen(tokens, idx, opts, env, self)}`;
  md.renderer.rules.table_close = (tokens, idx, opts, env, self) =>
    `${defaultTableClose(tokens, idx, opts, env, self)}</div>\n`;

  // Heading IDs, anchors, and TOC collection
  md.core.ruler.push("collect_toc", (state) => {
    const tokens = state.tokens;
    const sourceLines = body.split("\n");
    let heading = "";
    let section = "";
    const plain = (token) => (token?.children || [])
      .filter((t) => !["html_inline", "image"].includes(t.type))
      .map((t) => t.type.endsWith("break") ? " " : t.content).join("").trim();
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const inline = tokens[i + 1];
      if (token.type === "heading_open") {
        const level = Number(token.tag.slice(1));
        heading = plain(inline);
        section = slugify(heading, seenSlugs);
        token.attrSet("id", section);
        if (level <= 4) {
          // A TOC entry is itself a link; never render nested links into it.
          const children = (inline.children || []).filter((t) => !["link_open", "link_close", "html_inline"].includes(t.type));
          const htmlLabel = md.renderer.renderInline(children.map((t) => t.type === "wiki_link" ? { ...t, type: "text" } : t), md.options, state.env);
          toc.push({ level, id: section, text: heading, html: htmlLabel });
        }
      }
      if (!excerpt && token.type === "paragraph_open") excerpt = [...plain(inline).replace(/\s+/g, " ")].slice(0, 160).join("");
      if (!options.annotate || !token.map || token.hidden) continue;
      const standard = ["heading_open", "paragraph_open", "list_item_open", "table_open"].includes(token.type);
      if (!standard && !["fence", "code_block", "math_block", "html_block"].includes(token.type)) continue;
      const [start, end] = token.map;
      const id = blocks.length;
      blocks.push({ id, start: start + lineOffset + 1, end: end + lineOffset, heading, section, kind: token.type,
        fingerprint: digest(sourceLines.slice(start, end).join("\n")) });
      if (standard) token.attrSet("data-review-block", String(id));
      else token.meta = { ...token.meta, previewBlock: id };
    }
  });

  const defaultHeadingClose = md.renderer.rules.heading_close || ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));
  md.renderer.rules.heading_open = (tokens, idx, opts, _env, self) => {
    const id = tokens[idx].attrGet("id");
    const open = self.renderToken(tokens, idx, opts);
    return id ? `${open}<a class="heading-anchor" href="#${escapeHtml(id)}" aria-label="Anchor">#</a>` : open;
  };
  md.renderer.rules.heading_close = (tokens, idx, opts, env, self) =>
    defaultHeadingClose(tokens, idx, opts, env, self);

  for (const type of ["code_block", "math_block", "html_block"]) {
    const base = md.renderer.rules[type];
    md.renderer.rules[type] = (tokens, idx, ...args) => {
      const html = base(tokens, idx, ...args);
      const attrs = anchorAttrs(tokens[idx]);
      return attrs ? `<div${attrs}>${html}</div>\n` : html;
    };
  }

  // Code fences: mermaid, chart, and highlight.js
  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx];
    const info = (token.info || "").trim();
    const lang = info.split(/\s+/)[0].toLowerCase();
    const code = token.content;
    const attrs = anchorAttrs(token);

    if (lang === "mermaid") {
      hasMermaid = true;
      return `<div class="figure-block mermaid-wrap"${attrs}><pre class="mermaid">${escapeHtml(code)}</pre></div>\n`;
    }

    if (lang === "chart") {
      hasChart = true;
      try {
        const cfg = parseChartConfig(code);
        cfg.options = { animation: false, ...(cfg.options || {}) };
        const encoded = escapeHtml(JSON.stringify(cfg));
        const height = Number(cfg._height) || 240;
        return `<div class="figure-block chart-wrap"${attrs}><div class="chart-box" style="height:${height}px"><canvas class="md-chart" data-chart="${encoded}"></canvas></div></div>\n`;
      } catch (err) {
        return `<div class="figure-block chart-error"${attrs}><strong>Chart JSON error:</strong> ${escapeHtml(err.message)}<pre><code>${escapeHtml(code)}</code></pre></div>\n`;
      }
    }

    let highlighted;
    if (lang && hljs.getLanguage(lang)) {
      highlighted = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
    } else {
      highlighted = escapeHtml(code);
    }
    const langBadge = lang ? `<span class="code-lang">${escapeHtml(lang)}</span>` : "";
    return `<div class="code-block"${attrs}>${langBadge}<pre><code class="hljs${lang ? ` language-${escapeHtml(lang)}` : ""}">${highlighted}</code></pre></div>\n`;
  };

  const html = md.render(body);
  const title = meta.title || toc.find((h) => h.level === 1)?.text || options.fallbackTitle || "Markdown Preview";

  return {
    title,
    meta,
    html,
    toc,
    hasMermaid,
    hasChart,
    excerpt,
    blocks,
    ...(options.annotate && { revision: digest(source) }),
  };
}

export function rewritePageLinks(html, { file, pagesByPath, resolveWiki, hrefFor, addLink }) {
  const linkAttrs = (index, anchor) => {
    const fragment = anchor ? `#${encodeURIComponent(anchor)}` : "";
    return `href="${escapeHtml(hrefFor(index) + fragment)}" data-page-idx="${index}"`;
  };
  return html.replace(/<a\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi, (tag) => {
    const wiki = tag.match(/^<a class="wiki-link" href="#" data-wiki-target="([^"]*)">$/);
    if (wiki) {
      const [name, ...fragment] = unescapeAll(wiki[1]).split("#");
      const heading = fragment.join("#").trim();
      const target = resolveWiki(name.trim());
      if (!target) return `<a class="wiki-link unresolved" aria-disabled="true" title="未找到唯一的笔记：${escapeHtml(name)}">`;
      const anchor = target.page.toc.find((h) => h.text === heading)?.id || (heading ? slugify(heading, new Map()) : "");
      addLink(target.index);
      return `<a class="wiki-link" ${linkAttrs(target.index, anchor)}>`;
    }
    const href = tag.match(/\shref=(?:"([^"]*)"|'([^']*)')/i);
    if (!href || !file) return tag;
    const value = unescapeAll(href[1] ?? href[2]);
    if (/^(?:[a-z][a-z\d+.-]*:|\/|[#?])/i.test(value)) return tag;
    const [path, ...fragment] = value.split("#");
    let target, anchor;
    try {
      target = pagesByPath.get(resolve(file, "..", decodeURIComponent(path.split("?")[0])));
      anchor = decodeURIComponent(fragment.join("#"));
    } catch { return tag; }
    if (!target) return tag;
    addLink(target.index);
    return tag.replace(href[0], ` ${linkAttrs(target.index, anchor)}`);
  });
}

const IMAGE_MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

export function collectLocalImagePaths(html, baseDir) {
  const matches = [...html.matchAll(/<img\b[^>]*?\bsrc=["']([^"']+)["']/gi)];
  const paths = new Set();
  for (const m of matches) {
    const src = m[1];
    if (/^(?:https?:|data:|blob:|\/)/i.test(src)) continue;
    const cleanSrc = decodeURIComponent(src.split("#")[0].split("?")[0]);
    const filePath = resolve(baseDir, cleanSrc);
    if (IMAGE_MIME[extname(filePath).toLowerCase()]) {
      paths.add(filePath);
    }
  }
  return [...paths];
}

export async function inlineLocalImages(html, baseDir) {
  const matches = [...html.matchAll(/(<img\b[^>]*?\bsrc=["'])([^"']+)(["'][^>]*>)/gi)];
  if (!matches.length) return html;
  let out = html;
  const cache = new Map();

  for (const m of matches) {
    const [full, prefix, src, suffix] = m;
    if (/^(?:https?:|data:|blob:|\/)/i.test(src)) continue;
    const cleanSrc = decodeURIComponent(src.split("#")[0].split("?")[0]);
    const filePath = resolve(baseDir, cleanSrc);
    const mime = IMAGE_MIME[extname(filePath).toLowerCase()];
    if (!mime) continue;
    try {
      if (!cache.has(filePath)) {
        const bytes = await readFile(filePath);
        cache.set(filePath, `data:${mime};base64,${bytes.toString("base64")}`);
      }
      out = out.replace(full, () => `${prefix}${cache.get(filePath)}${suffix}`);
    } catch {
      // Leave missing image path untouched so the browser surfaces a clear broken-image cue
    }
  }
  return out;
}
