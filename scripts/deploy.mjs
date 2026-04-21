import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const manifestPath = path.join(rootDir, "apps.manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

function run(command, label) {
  return new Promise((resolve, reject) => {
    console.log(`\n${"=".repeat(50)}`);
    console.log(`  ${label}`);
    console.log(`${"=".repeat(50)}\n`);

    const child = process.platform === "win32"
      ? spawn("cmd.exe", ["/c", command], { cwd: rootDir, stdio: "inherit", shell: false })
      : spawn(command, { cwd: rootDir, stdio: "inherit", shell: true });

    child.on("error", (error) => reject(error));
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} failed with code ${code}`));
    });
  });
}

try {
  await run("node scripts/install-all.mjs", "步骤 1/3: 安装所有依赖");
  await run("node scripts/build-all.mjs", "步骤 2/3: 构建所有模板");

  console.log(`\n${"=".repeat(50)}`);
  console.log("  步骤 3/3: 启动所有服务");
  console.log(`${"=".repeat(50)}\n`);
  console.log("模板端口分配：");
  for (const app of manifest) {
    console.log(`  ${app.id.padEnd(16)} ${app.title.padEnd(16)} -> :${app.port}`);
  }
  console.log("");

  await run("node scripts/serve.mjs", "启动静态文件服务");
} catch (err) {
  console.error(`\n部署失败: ${err.message}`);
  process.exit(1);
}
