import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
const source = fileURLToPath(new URL('../', import.meta.url));
const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'design-install-'));
const dest = path.join(scratch, 'design');
const output = path.resolve(process.env.DESIGN_ARTIFACTS || path.join(source, 'artifacts/isolated-install'));
try {
  await fs.cp(source, dest, { recursive: true, filter: file => !path.relative(source, file).split(path.sep)
    .some(segment => ['node_modules', 'artifacts', 'history', '.artifact-server.json', '.artifact-server.log'].includes(segment)) });
  const run = async (command, args, env = process.env) => {
    const result = await exec(command, args, { cwd: dest, timeout: 180000, maxBuffer: 4 * 1024 * 1024, env });
    console.log(result.stdout);
  };
  // Prove the runtime/check has no installed dependencies and no slides sibling.
  await run(process.execPath, ['scripts/artifact.mjs', 'check', 'examples/research-canvas']);
  await run('npm', ['ci', '--ignore-scripts']);
  await run('npm', ['test']);
  await run('npm', ['run', 'test:smoke'], { ...process.env, DESIGN_ARTIFACTS: output });
  console.log('ok - isolated install/check/editor/export with no slides or shared node_modules');
} finally {
  await fs.rm(scratch, { recursive: true, force: true });
}
