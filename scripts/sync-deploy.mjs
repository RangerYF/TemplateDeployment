import { execSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const deployDir = path.join(path.dirname(rootDir), "TemplateDeployment");
const manifest = JSON.parse(readFileSync(path.join(rootDir, "apps.manifest.json"), "utf8"));

function run(cmd, opts = {}) {
  console.log(`> ${cmd}`);
  return execSync(cmd, { stdio: "inherit", ...opts });
}

function robocopyDir(src, dest) {
  try {
    run(`robocopy "${src}" "${dest}" /E /XD node_modules dist .git _site /PURGE /NFL /NDL /NJH /NJS /NC /NS`);
  } catch (e) {
    if (e.status >= 8) throw e;
  }
}

console.log("=== 同步文件到 TemplateDeployment ===\n");

const topFiles = ["apps.manifest.json", "package.json", ".gitignore"];
for (const f of topFiles) {
  const src = path.join(rootDir, f);
  if (!existsSync(src)) continue;
  console.log(`[copy] ${f}`);
  copyFileSync(src, path.join(deployDir, f));
}

console.log("[sync] scripts/");
robocopyDir(path.join(rootDir, "scripts"), path.join(deployDir, "scripts"));

console.log("[sync] docs/");
robocopyDir(path.join(rootDir, "docs"), path.join(deployDir, "docs"));

for (const app of manifest) {
  console.log(`[sync] ${app.id} (${app.path}/)`);
  robocopyDir(path.join(rootDir, app.path), path.join(deployDir, app.path));
}

console.log("\n=== 推送到 GitHub ===\n");

run("git add -A", { cwd: deployDir });

try {
  execSync("git diff --cached --quiet", { cwd: deployDir });
  console.log("没有变更，无需推送。");
} catch {
  const timestamp = new Date().toLocaleString("zh-CN");
  run(`git commit -m "sync: 同步模板更新 ${timestamp}"`, { cwd: deployDir });
  run("git push origin master", { cwd: deployDir });
  console.log("\n推送完成，GitHub Action 将自动部署到 Cloudflare Pages。");
}
