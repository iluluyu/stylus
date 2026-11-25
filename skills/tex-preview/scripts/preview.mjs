import { fork } from 'node:child_process';
import { createReadStream, watch } from 'node:fs';
import { access, readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { basename, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, forward, getBuild, inverse, latestBuild, openProject, pathInside, readReviewIndex } from './project.mjs';
import { anchorFor, createReview, withPdfSelection } from './review.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const web = resolve(here, '../web');
const pdfjs = resolve(here, '../node_modules/pdfjs-dist');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.pdf': 'application/pdf', '.wasm': 'application/wasm' };
const assets = new Map([
  ['/', join(web, 'index.html')],
  ['/app.js', join(web, 'app.js')],
  ['/layout.js', join(web, 'layout.js')],
  ['/review-cards.js', join(web, 'review-cards.js')],
  ['/style.css', join(web, 'style.css')],
  ['/vendor/pdf.mjs', join(pdfjs, 'legacy/build/pdf.mjs')],
  ['/vendor/pdf.worker.mjs', join(pdfjs, 'legacy/build/pdf.worker.mjs')],
  ['/vendor/pdf_viewer.mjs', join(pdfjs, 'legacy/web/pdf_viewer.mjs')],
  ['/vendor/pdf_viewer.css', join(pdfjs, 'legacy/web/pdf_viewer.css')],
]);

function projectAsset(pathname) {
  if (assets.has(pathname)) return assets.get(pathname);
  const asset = pathname.match(/^\/vendor\/(cmaps|standard_fonts|wasm|iccs|images)\/([\w.-]+)$/);
  if (!asset || asset[2] === '..' || asset[2] === '.') return null;
  return join(pdfjs, asset[1] === 'images' ? 'legacy/web/images' : asset[1], asset[2]);
}

function responseError(message, status) {
  return Object.assign(new Error(message), { status });
}

async function body(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) {
    throw responseError('Expected JSON.', 415);
  }
  let size = 0;
  const buffer = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 150000) throw responseError('Request is too large.', 413);
    buffer.push(chunk);
  }
  try {
    const result = JSON.parse(Buffer.concat(buffer).toString('utf8'));
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error();
    return result;
  } catch {
    throw responseError('Invalid JSON.', 400);
  }
}

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function sendFile(res, file) {
  const metadata = await stat(file).catch((error) => {
    if (error.code === 'ENOENT') throw responseError('File not found.', 404);
    throw error;
  });
  res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Content-Length': metadata.size });
  createReadStream(file).on('error', () => res.destroy()).pipe(res);
}

const watched = /\.(tex|bib|bbl|sty|cls|bst|def|clo|cfg|png|jpe?g|pdf|eps|svg|pgf|tikz|dat|csv|tsv|ttf|otf)$/i;

async function serve(project, port) {
  await access(assets.get('/vendor/pdf.mjs')).catch(() => {
    throw new Error('PDF.js is missing. Run npm ci in the tex-preview skill directory.');
  });

  const review = createReview(project);
  await review.syncIndex();
  let latest = await latestBuild(project);
  let buildError = '';
  let building = false;
  let requested = 0;
  let timer;
  function schedule() {
    requested++;
    clearTimeout(timer);
    timer = building ? null : setTimeout(rebuild, 220);
  }

  async function rebuild() {
    timer = null;
    const epoch = requested;
    building = true;
    buildError = '';
    try {
      const next = await compile(project, () => requested !== epoch);
      if (next) latest = next;
    } catch (error) {
      if (requested === epoch) buildError = error.message;
    } finally {
      building = false;
      if (requested !== epoch) timer = setTimeout(rebuild, 220);
    }
  }

  const watcher = watch(project.root, { recursive: true }, (_event, file) => {
    if (!file) return;
    const parts = file.split(sep);
    if (parts.some((piece) => piece.startsWith('.') && piece !== '.latexmkrc')) return;
    const path = resolve(project.root, file);
    const inDesignsRev = parts.some((piece, i) => piece === 'designs' && parts[i + 1] === 'rev');
    if (inDesignsRev || path === project.revDir || pathInside(project.revDir, path) ||
        path === project.dir || pathInside(project.dir, path) ||
        (pathInside(project.root, project.stateRoot) && (path === project.stateRoot || pathInside(project.stateRoot, path)))) return;
    if (watched.test(file) || basename(file) === '.latexmkrc') schedule();
  });
  watcher.on('error', (error) => {
    console.error('File watcher:', error.message);
  });

  let origin;
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      if (req.headers.host !== new URL(origin).host) throw responseError('Invalid host.', 403);
      const { pathname, searchParams: q } = new URL(req.url, origin);
      if (req.method === 'POST') {
        if (req.headers.origin !== origin) throw responseError('Invalid origin.', 403);
        const input = await body(req);
        if (pathname === '/api/build') {
          schedule();
          return json(res, { queued: true });
        }
        if (pathname === '/api/review') {
          const build = input.build === latest?.id ? latest : await getBuild(project, input.build);
          return json(res, await review.add(build, input), 201);
        }
        if (pathname === '/api/thread') return json(res, await review.event(input.id, input, 'user'), 201);
        throw responseError('Route not found.', 404);
      }
      if (req.method !== 'GET') throw responseError('Method not allowed.', 405);
      if (pathname === '/api/state') {
        return json(res, { id: latest?.id ?? null, title: project.title, building: building || Boolean(timer), error: buildError });
      }
      if (pathname === '/api/review') return json(res, await review.list(latest));
      if (pathname.startsWith('/api/')) {
        const id = q.get('id');
        const build = id === latest?.id ? latest : await getBuild(project, id);
        if (!build) throw responseError('找不到这个编译版本。', 404);
        if (pathname === '/api/pdf') return await sendFile(res, build.pdf);
        if (pathname === '/api/files') return json(res, { files: Object.keys(build.sources).sort(), main: build.main });
        if (pathname === '/api/source') {
          const file = q.get('file');
          if (!Object.hasOwn(build.sources, file)) throw responseError('找不到此源文件。', 404);
          return json(res, build.sources[file].lines);
        }
        if (pathname === '/api/inverse') {
          const page = Number(q.get('page'));
          const x = Number(q.get('x'));
          const y = Number(q.get('y'));
          if (!Number.isSafeInteger(page) || page < 1 || ![x, y].every(Number.isFinite)) {
            throw responseError('PDF 坐标无效。', 400);
          }
          const hit = await inverse(project, build, page, x, y);
          const target = hit && anchorFor(build, hit.file, hit.line);
          return json(res, withPdfSelection(build, target, q.get('quote')));
        }
        if (pathname === '/api/forward') return json(res, await forward(project, build, q.get('file'), Number(q.get('line'))));
      }
      const asset = projectAsset(pathname);
      if (!asset) throw responseError('Route not found.', 404);
      await sendFile(res, asset);
    } catch (error) {
      if (res.headersSent) return res.destroy();
      json(res, { error: error.message }, error.status || 500);
    }
  });
  server.once('close', () => {
    watcher.close();
    clearTimeout(timer);
  });
  try {
    await new Promise((done, fail) => server.once('error', fail).listen(port, '127.0.0.1', done));
  } catch (error) {
    watcher.close();
    throw error;
  }
  origin = 'http://127.0.0.1:' + server.address().port;
  schedule();
  return { url: origin, pid: process.pid, main: project.main, stateDir: project.dir };
}

function parse(args) {
  const options = { port: 0, positionals: [], limit: 10, offset: 0, context: 2 };
  const supplied = new Set();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    supplied.add(arg);
    const take = () => {
      if (!args[i + 1]) throw new Error('Missing value for ' + arg);
      return args[++i];
    };
    if (arg === '--detach') options.detach = true;
    else if (arg === '--list') options.list = true;
    else if (arg === '--annotations') options.annotations = true;
    else if (arg === '--brief') options.brief = true;
    else if (arg === '--annotation') options.annotation = take();
    else if (arg === '--full') options.full = true;
    else if (arg === '--context') options.context = Number(take());
    else if (arg === '--file') options.file = take();
    else if (arg === '--status') options.status = take();
    else if (arg === '--limit') options.limit = Number(take());
    else if (arg === '--offset') options.offset = Number(take());
    else if (arg === '--source') options.source = take();
    else if (arg === '--lines') options.lines = take();
    else if (arg === '--reply') options.reply = [take(), take()];
    else if (arg === '--engine') options.engine = take();
    else if (arg === '--root') options.root = take();
    else if (arg === '--state-dir') options.state = take();
    else if (arg === '--port') options.port = Number(take());
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg.startsWith('-')) throw new Error('Unknown argument ' + arg);
    else options.positionals.push(arg);
  }
  if (!Number.isSafeInteger(options.port) || options.port < 0 || options.port > 65535) throw new Error('Invalid port.');
  if (options.list && options.positionals.length > 1) throw new Error('Pass at most one directory with --list.');
  if (!options.help && !options.list && options.positionals.length !== 1) throw new Error('Pass exactly one main .tex file.');
  if ([options.annotations, options.annotation, options.source, options.reply].filter(Boolean).length > 1) {
    throw new Error('Choose a single read or reply command.');
  }
  if (options.status && !['open', 'resolved'].includes(options.status)) throw new Error('Choose open or resolved.');
  for (const [name, value, min, max] of [['limit', options.limit, 1, 100], ['offset', options.offset, 0, Number.MAX_SAFE_INTEGER],
    ['context', options.context, 0, 40]]) {
    if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error('Invalid --' + name + '.');
  }
  if (['--brief', '--file', '--status', '--limit', '--offset'].some((flag) => supplied.has(flag)) &&
      !(options.annotations && options.brief)) throw new Error('Use summary options with --annotations --brief.');
  if (Boolean(options.source) !== Boolean(options.lines)) throw new Error('Use --source FILE --lines START:END together.');
  if ((supplied.has('--context') || options.full) && !options.annotation) throw new Error('Use --context and --full with --annotation.');
  return options;
}

function sourceExcerpt(build, file, from, to) {
  const lines = build && Object.hasOwn(build.sources, file) && build.sources[file].lines;
  if (!lines) throw new Error('Source is unavailable in the selected build: ' + file);
  if (from > lines.length) throw new Error('The first requested line is beyond the end of ' + file + '.');
  return { build: build.id, file, from, to: Math.min(to, lines.length),
    lines: lines.slice(from - 1, to).map((text, index) => ({ line: from + index, text })) };
}

function compactThread(note) {
  const target = (source) => {
    if (!source) return null;
    const { file, from, to, selection } = source;
    return { file, from, to, ...(selection && {
      selection: selection.quote.length <= 220 ? selection :
        { ...selection, quote: selection.quote.slice(0, 219) + '…', clipped: true },
    }) };
  };
  const { id, body, status, current, source, pdf } = note;
  const replies = note.replies.slice(-2).map(({ author, body }) => ({
    author, body: body.length > 320 ? body.slice(0, 319) + '…' : body,
    ...(body.length > 320 && { clipped: true }),
  }));
  return {
    id, body, status, current: target(current),
    ...((!current || current.file !== source.file || current.from !== source.from || current.to !== source.to) &&
      source && { source: target(source) }),
    ...(!current && pdf && { pdf: { page: pdf.page, quote: pdf.quote } }),
    ...(replies.length && { replies }),
    ...(note.replies.length > replies.length && { omittedReplies: note.replies.length - replies.length }),
  };
}

function threadContext(build, source, options) {
  if (!build) return null;
  const target = !options.full && source.selection ? source.selection : source;
  const from = Math.max(1, target.from - options.context);
  const to = target.to + options.context;
  const end = options.full ? to : Math.min(target.to, target.from + 19) + options.context;
  const context = sourceExcerpt(build, source.file, from, end);
  if (options.full) return context;
  const lines = context.lines.map((row) => {
    if (row.text.length <= 420) return row;
    const column = row.line === source.selection?.from ? source.selection.startColumn : 1;
    const start = Math.max(0, column - 90);
    return { line: row.line, text: row.text.slice(start, start + 420), startColumn: start + 1, lineLength: row.text.length };
  });
  return { ...context, lines, ...(context.to < Math.min(to, build.sources[source.file].lines.length) && { truncated: true }) };
}

async function main(args) {
  const options = parse(args);
  if (options.help) {
    console.log('node scripts/preview.mjs main.tex [--detach] [--root DIR] [--engine pdflatex|xelatex|lualatex] [--port N] [--state-dir DIR]\n'
      + 'Discover active reviews: --list [DIR]\n'
      + 'Review queue: --annotations --brief [--status open|resolved] [--file PATH] [--limit N] [--offset N]\n'
      + 'One thread: --annotation ID [--context N] [--full]\n'
      + 'Compiled source: --source PATH --lines START:END\n'
      + 'Full thread listing: --annotations\n'
      + 'Reply: --reply ID TEXT');
    return;
  }
  if (options.list) {
    console.log(JSON.stringify(await readReviewIndex(options.positionals[0] || process.cwd()), null, 2));
    return;
  }
  const project = await openProject(options.positionals[0], options);
  const review = createReview(project);
  const compact = options.brief || options.source || (options.annotation && !options.full);
  let result;
  if (options.annotations) {
    result = options.brief ? await review.summary(options) :
      { main: project.main, root: project.root, annotations: await review.list(await latestBuild(project)) };
  } else if (options.annotation) {
    const latest = await latestBuild(project);
    const annotation = await review.get(latest, options.annotation);
    const source = annotation.current || annotation.source;
    const revision = annotation.current ? latest : source && await getBuild(project, annotation.build);
    const context = threadContext(revision, source, options);
    result = options.full ? { main: project.main, root: project.root, annotation, context } :
      { annotation: compactThread(annotation), context };
  } else if (options.source) {
    const bounds = options.lines.match(/^(\d+):(\d+)$/);
    const [from, to] = bounds ? bounds.slice(1).map(Number) : [];
    if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 1 || from > to || to - from >= 120) {
      throw new Error('Pass an ordered line range of up to 120 lines.');
    }
    result = sourceExcerpt(await latestBuild(project), options.source, from, to);
  } else if (options.reply) result = await review.event(options.reply[0], { body: options.reply[1] }, 'agent');
  else if (options.detach) {
    result = await new Promise((done, fail) => {
      const child = fork(fileURLToPath(import.meta.url), args.filter((value) => value !== '--detach'),
        { detached: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
      child.once('error', fail);
      child.once('exit', (code) => fail(new Error('Server exited (' + code + ').')));
      child.once('message', (message) => {
        child.disconnect();
        child.unref();
        if (message.error) fail(new Error(message.error));
        else done(message);
      });
    });
  } else result = await serve(project, options.port);
  if (process.send) process.send(result);
  else console.log(JSON.stringify(result, null, compact ? 0 : 2));
}

main(process.argv.slice(2)).catch((error) => {
  if (process.send) process.send({ error: error.message });
  else console.error('tex-preview:', error.message);
  process.exitCode = 1;
});
