import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const manifestPath = path.join(rootDir, "apps.manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const filter = process.argv[2];
const selected = filter ? manifest.filter((app) => app.subject === filter || app.id === filter) : manifest;

if (selected.length === 0) {
  console.error(`未找到匹配的模板：${filter}`);
  process.exit(1);
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".wasm": "application/wasm",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

function serveStatic(distDir) {
  return (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let filePath = path.join(distDir, decodeURIComponent(url.pathname));

    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    if (existsSync(filePath) && statSync(filePath).isFile()) {
      const content = readFileSync(filePath);
      res.writeHead(200, {
        "Content-Type": getMimeType(filePath),
        "Content-Length": content.length,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=31536000, immutable",
      });
      res.end(content);
      return;
    }

    // SPA fallback: return index.html for non-file routes
    const indexPath = path.join(distDir, "index.html");
    if (existsSync(indexPath)) {
      const content = readFileSync(indexPath);
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Length": content.length,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache",
      });
      res.end(content);
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  };
}

const servers = [];

for (const app of selected) {
  const distDir = path.join(rootDir, app.path, "dist");
  if (!existsSync(distDir)) {
    console.error(`[skip] ${app.id} -> dist 目录不存在: ${distDir}（请先运行 build）`);
    continue;
  }

  const server = createServer(serveStatic(distDir));
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`[fail] ${app.id} -> 端口 ${app.port} 已被占用，跳过`);
    } else {
      console.error(`[fail] ${app.id} -> ${err.message}`);
    }
  });
  server.listen(app.port, "0.0.0.0", () => {
    console.log(`[serve] ${app.id} (${app.title}) -> http://0.0.0.0:${app.port}`);
  });
  servers.push(server);
}

if (servers.length === 0) {
  console.error("没有可启动的模板，请先运行 npm run build:all");
  process.exit(1);
}

console.log(`\n共启动 ${servers.length} 个模板服务`);

function shutdown() {
  console.log("\n正在关闭所有服务...");
  for (const server of servers) {
    server.close();
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
