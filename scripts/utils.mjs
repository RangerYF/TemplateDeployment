import { existsSync } from "node:fs";
import path from "node:path";

export function detectPkgManager(dir) {
  if (existsSync(path.join(dir, "pnpm-lock.yaml"))) return "pnpm";
  return "npm";
}

export function installCmd(pkgManager) {
  return `${pkgManager} install`;
}

export function runCmd(pkgManager, script, args = "") {
  if (pkgManager === "pnpm") {
    return args ? `pnpm run ${script} ${args}` : `pnpm run ${script}`;
  }
  return args ? `npm run ${script} -- ${args}` : `npm run ${script}`;
}
