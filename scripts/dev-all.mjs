import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { detectPkgManager, runCmd } from "./utils.mjs";

const rootDir = process.cwd();
const manifestPath = path.join(rootDir, "apps.manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const filter = process.argv[2];
const selected = filter ? manifest.filter((app) => app.subject === filter || app.id === filter) : manifest;

if (selected.length === 0) {
  console.error(`未找到匹配的模板：${filter}`);
  process.exit(1);
}

const children = [];

function spawnCommand(command, cwd) {
  if (process.platform === "win32") {
    return spawn("cmd.exe", ["/c", command], {
      cwd,
      stdio: "inherit",
      shell: false,
    });
  }

  return spawn(command, {
    cwd,
    stdio: "inherit",
    shell: true,
  });
}

function runApp(app) {
  const cwd = path.join(rootDir, app.path);
  if (!existsSync(cwd)) {
    console.error(`[skip] ${app.id} -> 目录不存在: ${cwd}`);
    return;
  }

  const pm = detectPkgManager(cwd);
  const command = runCmd(pm, "dev", `--host 0.0.0.0 --port ${app.port}`);
  console.log(`[dev] ${app.id} (${pm}) -> ${cwd} (port ${app.port})`);
  const child = spawnCommand(command, cwd);
  child.on("error", (error) => {
    console.error(`[error] ${app.id} 启动失败: ${error.message}`);
  });
  children.push(child);
}

for (const app of selected) {
  runApp(app);
}

function shutdown() {
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGINT");
    }
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
