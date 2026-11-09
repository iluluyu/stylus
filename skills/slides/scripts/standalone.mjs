import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export async function standalone(out) {
  const html = await readFile(new URL("../examples/research-deck/index.html", import.meta.url), "utf8");
  const stage = await readFile(new URL("../starter-components/deck-stage.js", import.meta.url), "utf8");
  const tag = '<script src="../../starter-components/deck-stage.js"></script>';
  if (!html.includes(tag)) throw new Error("Example runtime tag changed");
  // A literal script closing tag inside runtime strings must not end the HTML script.
  const bundled = html.replace(tag, () => "<script>\n" + stage.replace(/<\/script/gi, "<\\/script") + "\n</script>");
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, bundled);
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(await standalone(resolve(process.argv[2] || "artifacts/research-deck.html")));
}
