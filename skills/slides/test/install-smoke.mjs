import assert from "node:assert/strict";
import { cp, mkdtemp, rm, access, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const temp = await mkdtemp(join(tmpdir(), "stylus-slides-install-"));
const isolated = join(temp, "slides");
const results = [];
try {
  await cp(root, isolated, { recursive: true,
    filter: path => !["node_modules", "dist", "artifacts"].includes(basename(path)) });
  await assert.rejects(access(join(isolated, "agents/gen-pptx/node_modules")));
  await assert.rejects(access(join(isolated, "agents/gen-pptx/dist")));
  await assert.rejects(access(join(temp, "design")));
  const install = ["ci", "--prefix", "agents/gen-pptx"];
  if (process.env.SLIDES_NPM_OFFLINE === "1") install.push("--offline");
  for (const args of [install, ["test"], ["run", "typecheck"], ["run", "build"], ["run", "test:smoke"]]) {
    console.log("isolated: npm " + args.join(" "));
    const result = await exec("npm", args, { cwd: isolated, timeout: 240000, maxBuffer: 8 * 1024 * 1024 });
    results.push({ command: "npm " + args.join(" "), exitCode: 0,
      stdout: result.stdout, stderr: result.stderr });
  }
  await mkdir(resolve(root, "artifacts"), { recursive: true });
  await writeFile(resolve(root, "artifacts/install-result.json"), JSON.stringify({
    ok: true, directory: isolated, removedAfterTest: true, noDesignDirectory: true,
    copiedNodeModules: false, copiedDist: false, results
  }, null, 2) + "\n");
  console.log("ok - clean copy installs, tests, builds and exports without design");
} finally {
  await rm(temp, { recursive: true, force: true });
}
