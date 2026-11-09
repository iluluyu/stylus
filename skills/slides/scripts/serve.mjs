import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";

export async function serve(root, port = 0) {
  root = resolve(root);
  const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
    ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml",
    ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2" };
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      let path = resolve(root, "." + pathname);
      if (path !== root && !path.startsWith(root + sep)) {
        res.writeHead(403).end("Forbidden"); return;
      }
      if ((await stat(path)).isDirectory()) path = resolve(path, "index.html");
      const data = await readFile(path);
      res.writeHead(200, { "Content-Type": mime[extname(path)] || "application/octet-stream" }).end(data);
    } catch { res.writeHead(404).end("Not found"); }
  });
  await new Promise((ok, fail) => { server.once("error", fail); server.listen(port, "127.0.0.1", ok); });
  return { url: "http://127.0.0.1:" + server.address().port,
    close: () => new Promise((ok, fail) => server.close(err => err ? fail(err) : ok())) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] || fileURLToPath(new URL("../", import.meta.url));
  const server = await serve(root, Number(process.argv[3] || 4311));
  console.log("Serving " + resolve(root) + " at " + server.url + " (Ctrl+C to stop)");
}
