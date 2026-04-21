/**
 * 自动化生成预置作品缩略图
 *
 * 用法：
 *   先启动 dev server: pnpm dev
 *   然后运行: npx tsx scripts/generate-thumbs.ts [--limit N] [--id xxx]
 *
 * 环境变量：
 *   DEV_URL  dev server 地址（默认 http://localhost:5173）
 *
 * 参数：
 *   --limit N   只截前 N 个作品
 *   --id xxx    只截指定 ID 的作品
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DEV_URL = process.env.DEV_URL || 'http://localhost:5173';
const OUT_DIR = resolve(import.meta.dirname!, '../public/thumbs');
const VIEWPORT = { width: 1280, height: 800 };
const RENDER_WAIT_MS = 3000;

/** 在浏览器内执行：复用 captureThumb 逻辑，从 WebGL Canvas 直接读像素 */
function browserCaptureThumb(): string | null {
  const THUMB_WIDTH = 960;
  const THUMB_HEIGHT = 600;
  const BG_COLOR = '#f8f9fa';

  const source = document.querySelector('canvas');
  if (!source) return null;

  const sw = source.width;
  const sh = source.height;
  if (!sw || !sh) return null;

  const offscreen = document.createElement('canvas');
  offscreen.width = THUMB_WIDTH;
  offscreen.height = THUMB_HEIGHT;
  const ctx = offscreen.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, THUMB_WIDTH, THUMB_HEIGHT);

  const sourceRatio = sw / sh;
  const thumbRatio = THUMB_WIDTH / THUMB_HEIGHT;
  let dw: number, dh: number;

  if (sourceRatio > thumbRatio) {
    dw = THUMB_WIDTH;
    dh = THUMB_WIDTH / sourceRatio;
  } else {
    dh = THUMB_HEIGHT;
    dw = THUMB_HEIGHT * sourceRatio;
  }

  const dx = (THUMB_WIDTH - dw) / 2;
  const dy = (THUMB_HEIGHT - dh) / 2;

  ctx.drawImage(source, 0, 0, sw, sh, dx, dy, dw, dh);

  // 返回 base64 PNG（去掉 data:image/png;base64, 前缀）
  return offscreen.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
}

function getAllPresetIds(): string[] {
  const metaPath = resolve(import.meta.dirname!, '../src/data/projects/math/m01/meta.ts');
  const content = readFileSync(metaPath, 'utf-8');
  const ids: string[] = [];
  const re = /id:\s*"([^"]+)"/g;
  let match;
  while ((match = re.exec(content)) !== null) {
    ids.push(match[1]);
  }
  return ids;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let limit = Infinity;
  let targetId: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--id' && args[i + 1]) {
      targetId = args[i + 1];
      i++;
    }
  }

  return { limit, targetId };
}

async function main() {
  const { limit, targetId } = parseArgs();
  let ids = getAllPresetIds();

  if (targetId) {
    if (!ids.includes(targetId)) {
      console.error(`作品 ID "${targetId}" 不存在`);
      process.exit(1);
    }
    ids = [targetId];
  } else if (limit < ids.length) {
    ids = ids.slice(0, limit);
  }

  console.log(`准备截图 ${ids.length} 个作品，输出到 ${OUT_DIR}`);

  if (!existsSync(OUT_DIR)) {
    mkdirSync(OUT_DIR, { recursive: true });
  }

  const headed = process.argv.includes('--headed');
  const browser = await chromium.launch({
    headless: !headed,
    args: ['--use-gl=angle'],
  });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
  });

  // 注入 auth token 绕过 AuthGuard
  await context.addInitScript(() => {
    localStorage.setItem('auth_token', 'thumb-generator');
  });

  const page = await context.newPage();

  // 验证 dev server 是否运行
  try {
    await page.goto(DEV_URL, { timeout: 5000 });
  } catch {
    console.error(`无法连接 dev server (${DEV_URL})，请先运行: pnpm dev`);
    await browser.close();
    process.exit(1);
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const outPath = resolve(OUT_DIR, `${id}.png`);
    const progress = `[${i + 1}/${ids.length}]`;

    try {
      await page.goto(`${DEV_URL}/editor?preset=${encodeURIComponent(id)}`, {
        waitUntil: 'networkidle',
        timeout: 15000,
      });

      // 等待 canvas 出现并渲染稳定
      await page.waitForSelector('canvas', { timeout: 10000 });
      await page.waitForTimeout(RENDER_WAIT_MS);

      // 从 WebGL Canvas 直接读取像素（不受 UI 覆盖影响）
      const base64 = await page.evaluate(browserCaptureThumb);

      if (!base64) {
        throw new Error('captureThumb 返回 null');
      }

      writeFileSync(outPath, Buffer.from(base64, 'base64'));
      console.log(`${progress} ✅ ${id}`);
      success++;
    } catch (err) {
      console.error(`${progress} ❌ ${id}: ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }

  await browser.close();

  console.log(`\n完成：${success} 成功，${failed} 失败，共 ${ids.length} 个`);
}

main();
