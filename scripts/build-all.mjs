import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { detectPkgManager, runCmd } from "./utils.mjs";

const rootDir = process.cwd();
const manifestPath = path.join(rootDir, "apps.manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const args = process.argv.slice(2);
const extraArgs = args.filter((a) => a.startsWith("--")).join(" ");
const filter = args.find((a) => !a.startsWith("--"));
const selected = filter ? manifest.filter((app) => app.subject === filter || app.id === filter) : manifest;
const selectedProjects = Array.from(
  new Map(selected.map((app) => [app.path, app])).values(),
);

if (selected.length === 0) {
  console.error(`未找到匹配的模板：${filter}`);
  process.exit(1);
}

function runBuildCommand(command, cwd) {
  return new Promise((resolve, reject) => {
    const child = process.platform === "win32"
      ? spawn("cmd.exe", ["/c", command], { cwd, stdio: "inherit", shell: false })
      : spawn(command, { cwd, stdio: "inherit", shell: true });

    child.on("error", (error) => reject(error));
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`build failed with code ${code}`));
    });
  });
}

async function runBuild(app) {
  const cwd = path.join(rootDir, app.path);
  if (!existsSync(cwd)) {
    throw new Error(`${app.id} 目录不存在: ${cwd}`);
  }
  const pm = detectPkgManager(cwd);
  const cmd = runCmd(pm, "build", extraArgs);
  console.log(`[build] ${app.id} (${pm}) -> ${cwd}`);
  await runBuildCommand(cmd, cwd);
}

for (const app of selectedProjects) {
  await runBuild(app);
}

console.log("全部模板构建完成");
