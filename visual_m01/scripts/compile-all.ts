/**
 * 批量编译 instructions-v3.json → scene_data JSON
 *
 * 运行：npx tsx scripts/compile-all.ts
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { compileInstruction } from './dsl/compiler';
import type { SceneInstruction } from './dsl/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const INSTRUCTIONS_FILE = resolve(__dirname, 'data/instructions-v3.json');
const OUTPUT_DIR = resolve(__dirname, '../src/data/projects/math/m01/scenes');

// 清空 scenes 目录
mkdirSync(OUTPUT_DIR, { recursive: true });
const existing = readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.json'));
for (const f of existing) {
  unlinkSync(resolve(OUTPUT_DIR, f));
}
console.log(`清空 scenes 目录 (${existing.length} 个旧文件)`);

// 读取指令
const instructions: SceneInstruction[] = JSON.parse(
  readFileSync(INSTRUCTIONS_FILE, 'utf-8')
);

console.log(`\n=== 编译 ${instructions.length} 个指令 ===\n`);

let success = 0;
let failed = 0;

for (const instruction of instructions) {
  try {
    const { snapshot } = compileInstruction(instruction, { debug: false });

    const outFile = resolve(OUTPUT_DIR, `${instruction.id}.json`);
    writeFileSync(outFile, JSON.stringify(snapshot, null, 2), 'utf-8');

    success++;
  } catch (err) {
    console.error(`  ✗ ${instruction.id}: ${err instanceof Error ? err.message : String(err)}`);
    failed++;
  }
}

console.log(`\n=== 结果：${success} 成功，${failed} 失败 ===`);
if (failed > 0) process.exit(1);
