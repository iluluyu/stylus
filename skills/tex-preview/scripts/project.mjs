import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { link, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const buildFlags = { pdflatex: '-pdf', xelatex: '-xelatex', lualatex: '-lualatex' };
export const isId = (value) => typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value);
export const pathInside = (root, file) => {
  const rel = relative(root, file);
  return Boolean(rel) && rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel);
};

export async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

export async function writeJson(file, data, { exclusive = false } = {}) {
  const temporary = file + '.' + randomUUID() + '.tmp';
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  await writeFile(temporary, JSON.stringify(data) + '\n', { flag: 'wx', mode: 0o600 });
  if (!exclusive) return rename(temporary, file);
  try {
    await link(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function openProject(entry, options) {
  const main = await realpath(entry);
  const cwd = dirname(main);
  const root = options.root ? await realpath(options.root) : cwd;
  if (!pathInside(root, main) || extname(main) !== '.tex') {
    throw new Error('Pass a .tex main file inside the project root.');
  }
  const engine = options.engine || 'pdflatex';
  if (!Object.hasOwn(buildFlags, engine)) throw new Error('Choose pdflatex, xelatex, or lualatex.');
  const reviewRoot = reviewStateDirectory(root);
  const stateRoot = resolve(options.state || join(reviewRoot, 'tex'));
  const input = options.state ? main : relative(root, main);
  const scope = options.state ? root : relative(reviewRoot, root);
  const projectKey = createHash('sha256').update(input).update('\0').update(scope).digest('hex').slice(0, 24);
  const dir = join(stateRoot, projectKey);
  return { main, cwd, root, engine, dir, stateRoot, title: basename(main) };
}

function reviewStateDirectory(root) {
  for (let dir = root; ; dir = dirname(dir)) {
    if (basename(dir) === 'design' || existsSync(join(dir, 'project', 'canvas.json'))) return join(dir, 'review-state');
    if (existsSync(join(dir, '.git'))) return join(dir, 'design', 'review-state');
    if (dirname(dir) === dir) return join(root, 'design', 'review-state');
  }
}

function bundle(project, id) {
  return join(project.dir, 'builds', id);
}

export async function getBuild(project, id) {
  if (!isId(id)) return null;
  const folder = bundle(project, id);
  const data = await readJson(join(folder, 'sources.json'), null);
  return data && { ...data, id, pdf: join(folder, project.title.replace(/\.tex$/, '.pdf')) };
}

export async function latestBuild(project) {
  const latest = await readJson(join(project.dir, 'latest.json'), null);
  return latest ? getBuild(project, latest.id) : null;
}

async function inputSources(project, recorder) {
  const sources = {};
  let cwd = project.cwd;
  for (const record of recorder.split(/\r?\n/)) {
    if (record.startsWith('PWD ')) cwd = record.slice(4);
    if (!record.startsWith('INPUT ')) continue;
    const input = resolve(cwd, record.slice(6));
    if (extname(input) !== '.tex' || !pathInside(project.root, input)) continue;
    const actual = await realpath(input).catch(() => null);
    if (!actual || !pathInside(project.root, actual)) continue;
    const file = relative(project.root, input);
    if (!Object.hasOwn(sources, file)) {
      sources[file] = { path: input, lines: (await readFile(input, 'utf8')).split(/\r?\n/) };
    }
  }
  return sources;
}

export async function compile(project, isSuperseded = () => false) {
  const builds = join(project.dir, 'builds');
  await mkdir(builds, { recursive: true, mode: 0o700 });
  const work = await mkdtemp(join(builds, '.compile-'));
  const stem = basename(project.title, '.tex');
  const keep = new Set([stem + '.pdf', stem + '.synctex.gz']);
  try {
    await run('latexmk', [buildFlags[project.engine], '-synctex=1', '-recorder',
      '-interaction=nonstopmode', '-halt-on-error', '-file-line-error', '-outdir=' + work, './' + project.title],
    { cwd: project.cwd, timeout: 180000, maxBuffer: 4 * 1024 * 1024, env: { ...process.env, LC_ALL: 'C' } });
    const entries = await readdir(work);
    for (const file of keep) {
      if (!entries.includes(file)) throw new Error('Build did not produce ' + file);
    }
    const sources = await inputSources(project, await readFile(join(work, stem + '.fls'), 'utf8'));
    if (!Object.hasOwn(sources, relative(project.root, project.main))) {
      throw new Error('The LaTeX recorder did not list the main source.');
    }
    await Promise.all(entries.filter((entry) => !keep.has(entry)).map((entry) =>
      rm(join(work, entry), { recursive: true, force: true })));
    if (isSuperseded()) return null;
    const id = randomUUID();
    await writeJson(join(work, 'sources.json'), { sources, main: relative(project.root, project.main) });
    if (isSuperseded()) return null;
    await rename(work, bundle(project, id));
    await writeJson(join(project.dir, 'latest.json'), { id });
    return { id, sources, main: relative(project.root, project.main), pdf: join(bundle(project, id), stem + '.pdf') };
  } catch (error) {
    const log = (await readFile(join(work, stem + '.log'), 'utf8').catch(() => '')).trim();
    const output = error.stdout || '';
    const from = log.split('\n').findIndex((line) => /^!|\.tex:\d+:/.test(line));
    const detail = from < 0 ? log.slice(-2200) : log.split('\n').slice(from, from + 9).join('\n');
    throw new Error(detail || output.slice(-2200).trim() || error.stderr?.trim() || error.message);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

async function synchronization(project, direction, input, pdf) {
  const args = direction === 'view' ? ['view', '-i', input, '-o', pdf] : ['edit', '-o', input + ':' + pdf];
  const { stdout } = await run('synctex', args, { cwd: project.cwd, timeout: 5000 });
  return stdout.match(/SyncTeX result begin\r?\n([\s\S]*?)SyncTeX result end/)?.[1]
    .trim().split(/(?=^Output:)/m).filter(Boolean).map((result) =>
      Object.fromEntries(result.trim().split(/\r?\n/).filter((line) => line.includes(':'))
        .map((line) => [line.slice(0, line.indexOf(':')), line.slice(line.indexOf(':') + 1)]))) || [];
}

export async function inverse(project, build, page, x, y) {
  const results = await synchronization(project, 'edit', [page, x, y].join(':'), build.pdf);
  const buildMain = build.sources[build.main]?.path ?? project.main;
  const filesByPath = new Map(Object.entries(build.sources).map(([file, source]) => [source.path, file]));
  for (const result of results) {
    if (!result.Input) continue;
    const input = resolve(dirname(buildMain), result.Input);
    const file = filesByPath.get(input) ?? relative(project.root, input);
    const line = Number(result.Line);
    if (Object.hasOwn(build.sources, file) && build.sources[file].lines[line - 1] !== undefined) return { file, line };
  }
  return null;
}

export async function forward(project, build, file, line) {
  const source = Object.hasOwn(build.sources, file) && build.sources[file];
  if (!source || !Number.isSafeInteger(line) || source.lines[line - 1] === undefined) return null;
  const maps = await synchronization(project, 'view', line + ':0:' + source.path, build.pdf);
  const points = maps.map((result) => {
    const point = { page: Number(result.Page), x: Number(result.x), y: Number(result.y) };
    const [left, bottom, width, height] = [result.h, result.v, result.W, result.H].map(Number);
    const top = bottom - height;
    const right = left + width;
    // SyncTeX can also return a box enclosing a whole paragraph or page.
    if (width > 0 && height > 0 && height <= 24 && point.x >= left && point.x <= right &&
        point.y >= top && point.y <= bottom + 1) point.rect = [left, top, right, bottom];
    return point;
  })
    .filter((point) => Number.isSafeInteger(point.page) && point.page > 0 && Number.isFinite(point.x) && Number.isFinite(point.y));
  return points[0] || null;
}
