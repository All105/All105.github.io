// Local static server for _site that sends the same security headers as production (cloudflare/headers.json).
// Optional: QUOTE_MOCK=1 answers POST /api/quote locally so the form can be tested without the Worker.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = path.resolve("_site");
const headers = JSON.parse(fs.readFileSync("cloudflare/headers.json", "utf8"));
const strip = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith("_")));
const site = strip(headers.site);
const admin = strip(headers.admin);
// Local only: let the panel talk to `npx decap-server` (port 8081) for offline editing.
admin["Content-Security-Policy"] = admin["Content-Security-Policy"].replace("connect-src 'self'", "connect-src 'self' http://localhost:8081");
const types = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".png": "image/png", ".xml": "application/xml", ".txt": "text/plain; charset=utf-8",
  ".yml": "text/yaml; charset=utf-8", ".ico": "image/x-icon",
};
const port = Number(process.env.PORT || 8080);
const log = [];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const h = url.pathname.startsWith("/admin/") ? admin : site;
  if (req.method === "POST" && url.pathname === "/api/quote" && process.env.QUOTE_MOCK) {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      log.push(body);
      res.writeHead(200, { ...h, "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }
  if (url.pathname === "/__mock_log") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(log));
  }
  let file = path.join(root, decodeURIComponent(url.pathname));
  if (!file.startsWith(root)) { res.writeHead(400); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) {
    res.writeHead(404, { ...h, "Content-Type": types[".html"] });
    return res.end(fs.readFileSync(path.join(root, "404.html")));
  }
  // Mimic production: Cloudflare compresses text (Brotli/gzip); long cache for versioned assets,
  // GitHub Pages' 10 minutes for HTML.
  const type = types[path.extname(file)] || "application/octet-stream";
  const cache = url.pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "public, max-age=600";
  const compressible = /text|javascript|json|xml|svg|yaml/.test(type);
  const accept = req.headers["accept-encoding"] || "";
  if (compressible && /\bbr\b/.test(accept)) {
    res.writeHead(200, { ...h, "Content-Type": type, "Cache-Control": cache, "Content-Encoding": "br", Vary: "Accept-Encoding" });
    return fs.createReadStream(file).pipe(zlib.createBrotliCompress()).pipe(res);
  }
  if (compressible && /\bgzip\b/.test(accept)) {
    res.writeHead(200, { ...h, "Content-Type": type, "Cache-Control": cache, "Content-Encoding": "gzip", Vary: "Accept-Encoding" });
    return fs.createReadStream(file).pipe(zlib.createGzip()).pipe(res);
  }
  res.writeHead(200, { ...h, "Content-Type": type, "Cache-Control": cache });
  fs.createReadStream(file).pipe(res);
});
server.listen(port, () => console.log(`Serving _site on http://localhost:${port}`));
