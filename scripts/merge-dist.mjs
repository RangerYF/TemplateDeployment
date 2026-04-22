import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const manifest = JSON.parse(readFileSync(path.join(rootDir, "apps.manifest.json"), "utf8"));
const outDir = path.join(rootDir, "_site");

if (existsSync(outDir)) rmSync(outDir, { recursive: true });
mkdirSync(outDir);

const entries = [];

for (const app of manifest) {
  const distDir = path.join(rootDir, app.path, "dist");
  if (!existsSync(distDir)) {
    console.warn(`[skip] ${app.id} -> dist 不存在`);
    continue;
  }
  const dest = path.join(outDir, app.id);
  cpSync(distDir, dest, { recursive: true });
  console.log(`[merge] ${app.id} -> _site/${app.id}/`);
  entries.push(app);
}

const subjectNames = { chemistry: "化学", math: "数学", physics: "物理" };
const grouped = {};
for (const app of entries) {
  const key = app.subject;
  if (!grouped[key]) grouped[key] = [];
  grouped[key].push(app);
}

const sections = Object.entries(grouped)
  .map(([subject, apps]) => {
    const items = apps
      .map((a) => `      <li><a href="./${a.id}/">${a.title}</a></li>`)
      .join("\n");
    return `    <h2>${subjectNames[subject] || subject}</h2>\n    <ul>\n${items}\n    </ul>`;
  })
  .join("\n");

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>EduMind 教学模板中心</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; }
    h1 { border-bottom: 2px solid #333; padding-bottom: .5rem; }
    h2 { color: #555; margin-top: 1.5rem; }
    ul { list-style: none; padding: 0; }
    li { margin: .4rem 0; }
    a { color: #0066cc; text-decoration: none; font-size: 1.1rem; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>EduMind 教学模板中心</h1>
${sections}
</body>
</html>`;

writeFileSync(path.join(outDir, "index.html"), html);
console.log(`\n合并完成：${entries.length} 个模板 -> _site/`);
