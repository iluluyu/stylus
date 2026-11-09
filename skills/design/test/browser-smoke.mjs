import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import { PDFDocument, PDFRawStream, PDFName, decodePDFRawStream } from 'pdf-lib';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const cli = path.join(root, 'scripts/artifact.mjs');
const artifacts = path.resolve(process.env.DESIGN_ARTIFACTS || path.join(root, 'artifacts'));
const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'design-native-smoke-'));
await fs.mkdir(artifacts, { recursive: true });
await fs.cp(path.join(root, 'examples/research-canvas/project'), path.join(scratch, 'project'), { recursive: true });
const call = async (...args) => JSON.parse((await exec(process.execPath, [cli, ...args], { timeout: 30000 })).stdout);
const evidence = { checks: [], exports: {}, scratch, runtime: 'unmodified upstream v2.12.1' };
const ok = message => { console.log('ok - ' + message); evidence.checks.push(message); };
let browser;
const errors = [];
try {
  assert.equal((await call('check', scratch)).problems, 0);
  const opened = await call('open', scratch, '--port', '0');
  evidence.editor = opened.url;
  browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  evidence.environment = { node: process.version, platform: process.platform, browser: await browser.version(),
    executable: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || 'Playwright-managed default' };
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', req => { if (!req.failure()?.errorText?.includes('ERR_ABORTED')) errors.push(req.url() + ': ' + req.failure()?.errorText); });
  page.on('response', response => { if (response.status() >= 400) errors.push(response.status() + ' ' + response.url()); });
  await page.goto(opened.url);
  const frame = page.frameLocator('iframe').first();
  const heading = frame.getByText('From reactants to bound complex', { exact: true });
  await heading.waitFor({ state: 'visible' });
  await page.screenshot({ path: path.join(artifacts, 'editor-before.png') });
  assert.equal(await frame.locator('svg').count(), 2);
  const geometry = await frame.locator('[data-dc-tpl]').evaluateAll(elements => {
    const host = document.querySelector('.sc-host > div');
    const bounds = host.getBoundingClientRect();
    return { width: bounds.width, height: bounds.height,
      labels: elements.filter(el => el.tagName === 'DIV' && el !== host).map(el => {
        const r = el.getBoundingClientRect();
        return { text: el.textContent, x: r.x - bounds.x, y: r.y - bounds.y, w: r.width, h: r.height,
          font: getComputedStyle(el).fontSize, overflow: el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight };
      }) };
  });
  assert.equal(geometry.width, 688); assert.equal(geometry.height, 360);
  for (const label of geometry.labels) {
    assert.ok(label.x >= 0 && label.y >= 0 && label.x + label.w <= 688.1 && label.y + label.h <= 360.1, label.text);
    assert.equal(label.overflow, false, label.text);
  }
  evidence.geometry = geometry;
  ok('native canvas loads separate HTML nodes/labels and two SVG connectors without clipping');

  // Real WYSIWYG interaction, not DOM source injection or the publish API.
  const box = await heading.boundingBox();
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  await frame.getByRole('textbox', { name: 'Edit text' }).waitFor();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText('Binding method — revised');
  await page.keyboard.press('Escape');
  await page.mouse.click(30, 200);
  const sourcePath = path.join(scratch, 'project/Main.dc.html');
  for (let i = 0; i < 60; i++) {
    if ((await fs.readFile(sourcePath, 'utf8')).includes('Binding method — revised')) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const edited = await fs.readFile(sourcePath, 'utf8');
  assert.match(edited, /Binding method — revised/);
  assert.doesNotMatch(edited, /From reactants to bound complex/);
  assert.match(edited, /Prepare reactants/);
  assert.match(edited, /dc-arrow-head-filled-2/);
  assert.equal((await call('check', scratch)).problems, 0);
  await page.reload();
  await frame.getByText('Binding method — revised', { exact: true }).waitFor();
  await page.screenshot({ path: path.join(artifacts, 'editor-after.png') });
  await frame.locator('.sc-host').screenshot({ path: path.join(artifacts, 'artboard.png') });
  await fs.copyFile(sourcePath, path.join(artifacts, 'edited.Main.dc.html'));
  await fs.copyFile(path.join(scratch, 'project/canvas.json'), path.join(artifacts, 'edited.canvas.json'));
  ok('WYSIWYG label edit persists to .dc.html, passes check and survives page reload');

  for (const [label, ext] of [['PDF', 'pdf'], ['PNG', 'png'], ['HTML', 'html']]) {
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const pending = page.waitForEvent('download', { timeout: 60000 });
    await page.getByRole('menuitem', { name: new RegExp('^' + label) }).click();
    const download = await pending;
    assert.equal(await download.failure(), null);
    const file = path.join(artifacts, 'research-canvas.' + ext);
    await download.saveAs(file);
    const bytes = await fs.readFile(file);
    assert.ok(bytes.length > 100);
    evidence.exports[ext] = { file, bytes: bytes.length, suggestedName: download.suggestedFilename() };
    ok('native Export ' + label + ' produces a real downloaded file');
  }

  const pdfBytes = await fs.readFile(evidence.exports.pdf.file);
  assert.equal(pdfBytes.subarray(0, 5).toString(), '%PDF-');
  const pdf = await PDFDocument.load(pdfBytes);
  assert.equal(pdf.getPageCount(), 1);
  const { width, height } = pdf.getPage(0).getSize();
  evidence.exports.pdf.pagePt = { width, height };
  evidence.exports.pdf.pageMm = { width: width * 25.4 / 72, height: height * 25.4 / 72 };
  // Native fixed-page contract is 96 CSS px/in; tolerate PDF decimal rounding.
  assert.ok(Math.abs(width - 688 * 0.75) < 0.1);
  assert.ok(Math.abs(height - 360 * 0.75) < 0.1);
  const streams = [], images = [];
  for (const [, object] of pdf.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFRawStream)) continue;
    if (object.dict.get(PDFName.of('Subtype'))?.toString() === '/Image') {
      images.push({ width: Number(object.dict.get(PDFName.of('Width'))?.toString()),
        height: Number(object.dict.get(PDFName.of('Height'))?.toString()) });
    } else {
      try { streams.push(Buffer.from(decodePDFRawStream(object).decode()).toString('latin1')); } catch { /* font streams may be binary */ }
    }
  }
  const paint = streams.find(stream => /\/Im0 Do/.test(stream));
  assert.ok(paint, 'PDF must paint its appearance');
  assert.match(paint, /3 Tr/, 'sample PDF uses invisible selectable text over a raster appearance');
  assert.equal(images.length, 1);
  const image = images[0];
  assert.ok(image.width >= 688 && image.height >= 360);
  assert.ok(Math.abs(image.width / image.height - 688 / 360) < 0.005);
  const fontSizesPt = [...new Set([...paint.matchAll(/\/F\d+ ([\d.]+) Tf/g)].map(match => Number(match[1])))];
  assert.deepEqual(fontSizesPt.sort((a, b) => a - b), [10.5, 12, 18]);
  evidence.exports.pdf.appearance = 'one full-frame raster image plus invisible selectable text (3 Tr), not vector artwork';
  evidence.exports.pdf.images = images;
  evidence.exports.pdf.dpiAtPageSize = image.width / (width / 72);
  evidence.exports.pdf.invisibleTextSizesPt = fontSizesPt;
  ok(`actual fixed PDF: 516×270pt (182.03×95.25mm), ${image.width}×${image.height} raster appearance (${evidence.exports.pdf.dpiAtPageSize} DPI) and invisible 10.5/12/18pt text`);

  const png = await fs.readFile(evidence.exports.png.file);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const pngWidth = png.readUInt32BE(16), pngHeight = png.readUInt32BE(20);
  assert.ok(pngWidth >= 688 && pngHeight >= 360);
  assert.ok(Math.abs(pngWidth / pngHeight - 688 / 360) < 0.005);
  evidence.exports.png.pixels = { width: pngWidth, height: pngHeight };
  evidence.exports.png.dpiAtPdfSize = pngWidth / (width / 72);
  ok(`native PNG measures ${pngWidth}×${pngHeight}px; effective DPI computed from actual PDF size`);

  const standalone = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  const requests = [], standaloneErrors = [];
  standalone.on('request', req => requests.push(req.url()));
  standalone.on('pageerror', error => standaloneErrors.push(error.message));
  await standalone.goto(new URL('file://' + evidence.exports.html.file).href);
  await standalone.getByText('Binding method — revised', { exact: true }).waitFor();
  await standalone.getByText('Schematic only — no measurements or thermodynamic values.', { exact: true }).waitFor();
  assert.equal(await standalone.locator('svg').count(), 2);
  await standalone.screenshot({ path: path.join(artifacts, 'standalone.png') });
  assert.deepEqual(standaloneErrors, []);
  evidence.exports.html.requests = requests;
  assert.ok(requests.every(url => url === new URL('file://' + evidence.exports.html.file).href || url.startsWith('blob:') || url.startsWith('data:')),
    'standalone must load without editor/server or external requests');
  ok('standalone HTML displays edited labels, scientific symbols and arrows from file:// with no external requests');
  assert.deepEqual(errors, []);
  ok('no editor page errors or failed resources');
  await fs.writeFile(path.join(artifacts, 'smoke-result.json'), JSON.stringify(evidence, null, 2) + '\n');
  await fs.rm(path.join(artifacts, 'smoke-failure.json'), { force: true });
  console.log('Evidence: ' + artifacts);
} catch (error) {
  evidence.failure = error.stack;
  await fs.writeFile(path.join(artifacts, 'smoke-failure.json'), JSON.stringify(evidence, null, 2) + '\n');
  throw error;
} finally {
  await browser?.close();
  await call('stop', scratch).catch(() => {});
  await fs.rm(scratch, { recursive: true, force: true });
}
