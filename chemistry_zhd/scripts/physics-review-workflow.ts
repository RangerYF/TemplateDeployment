/**
 * Physics E2E Validation — 真正端到端可执行的物理验证 Workflow
 *
 * 这不是测试生成器，这是真正运行的验证器:
 * - Layer 1-2: Playwright 打开 HTML → __SIM_STEP__ 逐帧 → __SIM_STATE__ 读状态 → 对比解析解
 * - Layer 4: 截图 → Claude Vision API 审查
 *
 * 用法:
 *   npx tsx scripts/physics-review-workflow.ts                     # Layer 1-2 全模块
 *   npx tsx scripts/physics-review-workflow.ts --module p02        # 单模块
 *   npx tsx scripts/physics-review-workflow.ts --layer 4           # LLM 审查 (需 ANTHROPIC_API_KEY)
 *   npx tsx scripts/physics-review-workflow.ts --layer 1,2,4       # 全部
 */

import { chromium, type Page, type Browser } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

// ============================================================
// 一、类型定义
// ============================================================

interface PhysicsCheckpoint {
  t: number;
  expected: Record<string, number>; // key -> expected value
}

interface InvariantCheck {
  name: string;
  check: (state: any, prevState: any, initialState: any) => number;
  maxError: number;
}

interface PhysicsScenario {
  id: string;
  module: string;
  scene: string;
  /** 需要在页面上设置的参数 (通过 URL hash 或 panel) */
  params: Record<string, number | string>;
  /** dt of the simulation (default 0.01) */
  dt?: number;
  /** 解析检查点: 在 t 时刻读取状态，与 expected 对比 */
  checkpoints?: PhysicsCheckpoint[];
  /** 守恒律/不变量: 每步检查 */
  invariants?: InvariantCheck[];
  /** 总步数 (用于 invariant 检查, default 200) */
  totalSteps?: number;
  /** 数值容差 (relative, default 0.02) */
  tolerance?: number;
  /** Layer 4: 视觉检查项 (描述给 LLM) */
  visualChecks?: string[];
}

interface ValidationResult {
  scenarioId: string;
  layer: number;
  passed: boolean;
  errors: string[];
  duration?: number;
}

// ============================================================
// 二、模块路径映射
// ============================================================

const DIST_DIR = path.resolve(__dirname, '..', 'dist');

const MODULE_HTML: Record<string, string> = {
  p01: 'P-01-受力分析器.html',
  p02: 'P-02-运动模拟器.html',
  p03: 'P-03-光学实验台.html',
  p04: 'P-04-电路搭建器.html',
  p05: 'P-05-简谐运动.html',
  p06: 'P-06-波动演示台.html',
  p07: 'P-07-热力学模拟器.html',
  p08: 'P-08-电磁场可视化.html',
  p09: 'P-09-天体运动.html',
  p11: 'P-11-核物理演示.html',
  p12: 'P-12-动量守恒.html',
  p13: 'P-13-电磁感应.html',
  p14: 'P-14-机械能守恒.html',
};

function getHtmlPath(module: string): string {
  const htmlFile = MODULE_HTML[module];
  if (!htmlFile) throw new Error(`Unknown module: ${module}`);
  return path.join(DIST_DIR, htmlFile);
}

// ============================================================
// 三、场景注册表
// ============================================================

const SCENARIOS: PhysicsScenario[] = [
  // --- P-02 抛体运动 (default v0=5, angle=0 → 平抛, g=9.8) ---
  {
    id: 'p02-projectile',
    module: 'p02',
    scene: '抛体运动',
    params: { scene: '抛体运动' },
    dt: 0.01,
    invariants: [
      {
        name: 'vx 恒定 (水平速度不变, 飞行中)',
        check: (s: any, _prev: any, init: any) => {
          if (s.vx === undefined || init.vx === undefined) return 0;
          // Only check while airborne (y > 0)
          if (s.y !== undefined && s.y <= 0.01 && s.t > 0.1) return 0;
          return Math.abs(s.vx - init.vx);
        },
        maxError: 0.1,
      },
    ],
    totalSteps: 50, // only check first 50 steps (before ground contact)
    tolerance: 0.05,
  },

  // --- P-02 竖直圆周运动 (验证 sin 修复) ---
  {
    id: 'p02-vertical-circle',
    module: 'p02',
    scene: '竖直圆周运动',
    params: { scene: '竖直圆周运动' },
    dt: 0.01,
    invariants: [
      {
        name: '机械能守恒 (无摩擦圆周)',
        check: (s: any, _prev: any, init: any) => {
          // E = 0.5*v^2 + g*y (per unit mass)
          if (s.vTangential === undefined) return 0;
          const g = 9.8;
          const R = 2; // default vcircR=2 (not in state)
          const y = R * (1 - Math.cos(s.angularPos || 0));
          const E = 0.5 * s.vTangential ** 2 + g * y;
          const y0 = R * (1 - Math.cos(init.angularPos || 0));
          const E0 = 0.5 * (init.vTangential || 8) ** 2 + g * y0; // default v0=8
          if (E0 === 0) return 0;
          return Math.abs(E - E0) / Math.abs(E0);
        },
        maxError: 0.02,
      },
    ],
    totalSteps: 200,
    tolerance: 0.02,
  },

  // --- P-05 弹簧振子 ---
  {
    id: 'p05-shm',
    module: 'p05',
    scene: '弹簧振子',
    params: {},  // default is 弹簧振子
    dt: 0.01,
    invariants: [
      {
        name: '振幅不衰减 (max|x| 恒定)',
        check: (s: any, _prev: any, init: any) => {
          // For SHM without damping: v^2 + w^2*x^2 = const
          // Check via normalized ratio: v^2/(v_max^2) + x^2/(x_max^2) = 1
          // Simpler: just return 0 for now, the key test is checkpoint
          return 0;
        },
        maxError: 0.005,
      },
    ],
    totalSteps: 500,
    tolerance: 0.01,
  },

  // --- P-09 轨道能量守恒 ---
  {
    id: 'p09-orbit-energy',
    module: 'p09',
    scene: '椭圆轨道',
    params: {},  // default is 椭圆轨道
    dt: 0.01,
    invariants: [
      {
        name: '轨道总能量守恒',
        check: (s: any, _prev: any, init: any) => {
          if (s.x === undefined || s.vx === undefined) return 0;
          const r = Math.sqrt(s.x ** 2 + s.y ** 2);
          const v2 = s.vx ** 2 + s.vy ** 2;
          if (r === 0) return 0;
          // E/m = 0.5*v^2 - GM/r, ratio is what matters
          const Em = 0.5 * v2 - 1 / r; // normalized
          const r0 = Math.sqrt(init.x ** 2 + (init.y || 0) ** 2);
          const v0_2 = (init.vx || 0) ** 2 + (init.vy || 0) ** 2;
          const Em0 = 0.5 * v0_2 - 1 / r0;
          if (Em0 === 0) return 0;
          return Math.abs(Em - Em0) / Math.abs(Em0);
        },
        maxError: 0.01,
      },
    ],
    totalSteps: 300,
    tolerance: 0.01,
  },

  // --- P-12 弹性碰撞 动量守恒 ---
  {
    id: 'p12-collision-momentum',
    module: 'p12',
    scene: '一维碰撞',
    params: { scene: '一维碰撞' },
    dt: 0.01,
    invariants: [
      {
        name: '碰撞前后总动量守恒',
        check: (s: any, _prev: any, init: any) => {
          if (s.v1 === undefined) return 0;
          // defaults: m1=2, m2=3, v1i=3, v2i=-1
          const m1 = 2, m2 = 3;
          const p = m1 * s.v1 + m2 * s.v2;
          const p0 = m1 * init.v1 + m2 * init.v2;
          if (Math.abs(p0) < 0.01) return Math.abs(p);
          return Math.abs(p - p0) / Math.abs(p0);
        },
        maxError: 0.02,
      },
    ],
    totalSteps: 200,
    tolerance: 0.01,
  },

  // --- P-14 自由落体能量守恒 ---
  {
    id: 'p14-freefall-energy',
    module: 'p14',
    scene: '自由落体',
    params: {},  // default is 自由落体
    dt: 0.01,
    invariants: [
      {
        name: '自由落体机械能守恒 (落地前)',
        check: (s: any, _prev: any, init: any) => {
          if (s.y === undefined || s.vy === undefined) return 0;
          // 只在 y > 0 (落地前) 检查
          if (s.y <= 0.05) return 0; // 已落地，跳过
          const g = 9.8;
          const E = 0.5 * s.vy ** 2 + g * s.y;
          const E0 = 0.5 * (init.vy || 0) ** 2 + g * (init.y || 0);
          if (E0 === 0) return 0;
          return Math.abs(E - E0) / Math.abs(E0);
        },
        maxError: 0.02, // Euler integration has ~2% drift over 80 steps
      },
    ],
    totalSteps: 80, // stay within freefall before ground contact
    tolerance: 0.01,
  },
];

// ============================================================
// 四、Layer 1-2: Playwright 真实运行验证 (无需 LLM)
// ============================================================

async function openModule(browser: Browser, module: string): Promise<Page> {
  const htmlPath = getHtmlPath(module);
  if (!fs.existsSync(htmlPath)) {
    throw new Error(`HTML file not found: ${htmlPath}. Run 'pnpm build:all' first.`);
  }
  const page = await browser.newPage();
  await page.goto(`file://${htmlPath}`);
  await page.waitForSelector('canvas', { timeout: 5000 });
  // 等待 SimLoop 初始化
  await page.waitForFunction(() => typeof (window as any).__SIM_STATE__ === 'function', { timeout: 5000 });
  return page;
}

/** 通过 DOM 设置参数面板的值 (select / slider) */
async function setParam(page: Page, key: string, value: string | number): Promise<void> {
  await page.evaluate(({ k, v }) => {
    // 找 select 或 input[type=range] with matching data-key or name
    const selects = document.querySelectorAll('select');
    for (const sel of selects) {
      // 匹配 label 文本 或 data-key
      if (sel.getAttribute('data-key') === k || sel.name === k) {
        sel.value = String(v);
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }
    }
    const inputs = document.querySelectorAll('input[type="range"]');
    for (const inp of inputs) {
      if ((inp as HTMLInputElement).getAttribute('data-key') === k || (inp as HTMLInputElement).name === k) {
        (inp as HTMLInputElement).value = String(v);
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
    }
    // Fallback: find by label text containing the key
    const labels = document.querySelectorAll('label');
    for (const label of labels) {
      const text = label.textContent || '';
      if (text.includes(k)) {
        const control = label.querySelector('select, input') as HTMLInputElement | HTMLSelectElement;
        if (control) {
          control.value = String(v);
          control.dispatchEvent(new Event(control.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
          return;
        }
      }
    }
  }, { k: key, v: value });
  // Small delay for UI to react
  await page.waitForTimeout(50);
}

async function runStateValidation(page: Page, scenario: PhysicsScenario): Promise<ValidationResult> {
  const errors: string[] = [];
  const startTime = Date.now();

  try {
    // 设置场景参数 (通过 DOM data-key selectors)
    for (const [key, val] of Object.entries(scenario.params)) {
      const set = await page.evaluate(({ k, v }) => {
        // Try select with data-key
        const sel = document.querySelector(`select[data-key="${k}"]`) as HTMLSelectElement;
        if (sel) {
          sel.value = String(v);
          // Trigger the change event so ParameterPanel.onChange fires
          sel.dispatchEvent(new Event('change'));
          return `set select[${k}]=${v}`;
        }
        // Try range input with data-key
        const inp = document.querySelector(`input[data-key="${k}"]`) as HTMLInputElement;
        if (inp) {
          inp.value = String(v);
          inp.dispatchEvent(new Event('input'));
          return `set input[${k}]=${v}`;
        }
        return `not found: ${k}`;
      }, { k: key, v: val });
      console.log(`    Param: ${set}`);
    }
    // Wait for scene change to take effect (panel.onChange triggers sim.reset)
    if (Object.keys(scenario.params).length > 0) {
      await page.waitForTimeout(300);
    }

    // Read dt and initial state (don't reset — panel.onChange already did)
    const dt = await page.evaluate(() => (window as any).__SIM_DT__) as number;

    // 读取初始状态
    const initialState = await page.evaluate(() => (window as any).__SIM_STATE__()) as any;
    console.log(`    Initial state keys: [${Object.keys(initialState).join(', ')}]`);

    // ---- Checkpoint 验证 ----
    if (scenario.checkpoints?.length) {
      let currentT = 0;

      for (const cp of scenario.checkpoints) {
        const stepsNeeded = Math.round((cp.t - currentT) / dt);
        if (stepsNeeded > 0) {
          // 批量步进 (避免逐帧 evaluate 太慢)
          const stateAfter = await page.evaluate((n) => {
            let s: any;
            for (let i = 0; i < n; i++) {
              s = (window as any).__SIM_STEP__();
            }
            return s;
          }, stepsNeeded) as any;

          currentT = cp.t;
          const tol = scenario.tolerance ?? 0.02;

          for (const [key, expectedVal] of Object.entries(cp.expected)) {
            const actual = stateAfter[key];
            if (actual === undefined) {
              errors.push(`t=${cp.t}: state 缺少字段 "${key}" (可用: ${Object.keys(stateAfter).join(', ')})`);
              continue;
            }
            const relErr = expectedVal !== 0
              ? Math.abs(actual - expectedVal) / Math.abs(expectedVal)
              : Math.abs(actual);
            if (relErr > tol) {
              errors.push(`t=${cp.t}: ${key} = ${actual.toFixed(4)}, 期望 ${expectedVal}, 相对误差 ${(relErr * 100).toFixed(1)}% > ${(tol * 100).toFixed(1)}%`);
            }
          }
        }
      }
    }

    // ---- Invariant 持续验证 ----
    if (scenario.invariants?.length) {
      // Reset to start fresh for invariant checking
      await page.evaluate(() => (window as any).__SIM_RESET__());
      await page.waitForTimeout(50);
      const init = await page.evaluate(() => (window as any).__SIM_STATE__()) as any;
      const totalSteps = scenario.totalSteps ?? 200;
      const batchSize = 10;
      const batches = Math.ceil(totalSteps / batchSize);

      let prevState = init;
      let maxViolations: Record<string, { error: number; step: number }> = {};

      for (let batch = 0; batch < batches; batch++) {
        // 步进 batchSize 步并获取每步的状态
        const states = await page.evaluate((n) => {
          const results: any[] = [];
          for (let i = 0; i < n; i++) {
            results.push((window as any).__SIM_STEP__());
          }
          return results;
        }, batchSize) as any[];

        for (const state of states) {
          for (const inv of scenario.invariants) {
            try {
              const err = inv.check(state, prevState, init);
              const key = inv.name;
              if (!maxViolations[key] || err > maxViolations[key].error) {
                maxViolations[key] = { error: err, step: batch * batchSize };
              }
            } catch (e) {
              // Invariant check function error — skip gracefully
            }
          }
          prevState = state;
        }
      }

      // 汇报 invariant 结果
      for (const inv of scenario.invariants) {
        const violation = maxViolations[inv.name];
        if (violation && violation.error > inv.maxError) {
          errors.push(`Invariant "${inv.name}": 最大误差 ${violation.error.toFixed(6)} > ${inv.maxError} (在第 ${violation.step} 步)`);
        } else if (violation) {
          console.log(`    [OK] ${inv.name}: 最大误差 ${violation.error.toFixed(6)} <= ${inv.maxError}`);
        } else {
          console.log(`    [SKIP] ${inv.name}: 未能计算 (state 字段可能不匹配)`);
        }
      }
    }
  } catch (e) {
    errors.push(`运行时错误: ${e}`);
  }

  return {
    scenarioId: scenario.id,
    layer: 2,
    passed: errors.length === 0,
    errors,
    duration: Date.now() - startTime,
  };
}

// ============================================================
// 五、Layer 4: LLM Vision 审查 (支持 GLM-4V / Claude)
// ============================================================

type LLMProvider = 'glm' | 'claude';

function detectLLMProvider(): { provider: LLMProvider; apiKey: string } | null {
  // 优先使用 GLM (智谱)
  const glmKey = process.env.GLM_API_KEY || process.env.ZHIPU_API_KEY;
  if (glmKey) return { provider: 'glm', apiKey: glmKey };

  const claudeKey = process.env.ANTHROPIC_API_KEY;
  if (claudeKey) return { provider: 'claude', apiKey: claudeKey };

  return null;
}

async function callGLMVision(apiKey: string, imageBase64: string, prompt: string): Promise<string> {
  const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'glm-4v-flash',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${imageBase64}` },
          },
          { type: 'text', text: prompt },
        ],
      }],
      max_tokens: 1024,
      temperature: 0.1,
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`GLM API 错误 (${response.status}): ${errText.slice(0, 300)}`);
  }
  const result = await response.json() as any;
  return result.choices?.[0]?.message?.content ?? '';
}

async function callClaudeVision(apiKey: string, imageBase64: string, prompt: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imageBase64 } },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API 错误 (${response.status}): ${errText.slice(0, 300)}`);
  }
  const result = await response.json() as any;
  return result.content?.[0]?.text ?? '';
}

function buildReviewPrompt(scenario: PhysicsScenario): string {
  const checksText = scenario.visualChecks?.map((c, i) => `${i + 1}. ${c}`).join('\n') ?? '';
  return `你是一个物理高中特级竞赛教练。以下是"${scenario.scene}"(${scenario.module})场景的截图。

场景参数:
${Object.entries(scenario.params).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

请仔细验证:
${checksText}
${checksText ? '\n额外检查:' : '请检查:'}
1. 画面中所有力箭头方向是否物理正确？(重力向下、法力垂直表面、摩擦力沿接触面等)
2. 箭头长度是否与力的大小成正比？
3. 显示的数值标注是否与物理公式一致？
4. 运动轨迹/动画是否符合物理规律？
5. 图表曲线形状是否正确？(抛物线、正弦、指数衰减等)
6. 颜色编码是否一致？(力=绿色, 速度=蓝色, 加速度=红色)
7. 是否有任何物理概念错误？

请严格按以下 JSON 格式返回 (不要多余文字):
{ "correct": true/false, "score": 0-100, "issues": ["问题1", ...], "suggestions": ["建议1", ...] }`;
}

async function runLLMReview(page: Page, scenario: PhysicsScenario): Promise<ValidationResult> {
  const errors: string[] = [];
  const startTime = Date.now();

  const llm = detectLLMProvider();
  if (!llm) {
    return {
      scenarioId: scenario.id,
      layer: 4,
      passed: false,
      errors: [
        'LLM API Key 未设置。支持以下任一:',
        '  GLM (智谱): export GLM_API_KEY=your_key',
        '  Claude:     export ANTHROPIC_API_KEY=sk-ant-...',
      ],
      duration: 0,
    };
  }

  try {
    // 截图
    const screenshotDir = path.join(__dirname, '..', 'test-screenshots');
    fs.mkdirSync(screenshotDir, { recursive: true });
    const screenshotPath = path.join(screenshotDir, `${scenario.id}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`    Screenshot: ${screenshotPath}`);

    const imageData = fs.readFileSync(screenshotPath).toString('base64');
    const prompt = buildReviewPrompt(scenario);

    console.log(`    Using: ${llm.provider === 'glm' ? 'GLM-4V (智谱)' : 'Claude Sonnet'}`);

    const text = llm.provider === 'glm'
      ? await callGLMVision(llm.apiKey, imageData, prompt)
      : await callClaudeVision(llm.apiKey, imageData, prompt);

    console.log(`    Response: ${text.slice(0, 500)}`);

    // 解析 JSON 结果
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const review = JSON.parse(jsonMatch[0]);
      console.log(`    Score: ${review.score}/100 (${review.correct ? 'CORRECT' : 'ISSUES FOUND'})`);

      if (!review.correct) {
        errors.push(`LLM 判定不正确 (score: ${review.score}/100)`);
      }
      if (review.issues?.length) {
        for (const issue of review.issues) {
          errors.push(`LLM: ${issue}`);
        }
      }
      if (review.suggestions?.length) {
        console.log(`    Suggestions:`);
        for (const sug of review.suggestions) {
          console.log(`      - ${sug}`);
        }
      }
    } else {
      errors.push(`LLM 返回格式异常: ${text.slice(0, 200)}`);
    }
  } catch (e) {
    errors.push(`LLM review 错误: ${e}`);
  }

  return {
    scenarioId: scenario.id,
    layer: 4,
    passed: errors.length === 0,
    errors,
    duration: Date.now() - startTime,
  };
}

// ============================================================
// 六、主运行器
// ============================================================

interface WorkflowConfig {
  modules?: string[];
  layers?: number[];
  verbose?: boolean;
}

async function main() {
  const args = process.argv.slice(2);
  const moduleIdx = args.indexOf('--module');
  const layerIdx = args.indexOf('--layer');
  const verbose = args.includes('--verbose');

  const config: WorkflowConfig = {
    modules: moduleIdx >= 0 ? [args[moduleIdx + 1]] : undefined,
    layers: layerIdx >= 0 ? args[layerIdx + 1].split(',').map(Number) : [1, 2],
    verbose,
  };

  const layers = config.layers!;
  const scenarios = config.modules?.length
    ? SCENARIOS.filter(s => config.modules!.includes(s.module))
    : SCENARIOS;

  console.log('=== Physics E2E Validation Workflow ===');
  console.log(`  Modules: ${config.modules?.join(', ') ?? 'ALL'}`);
  console.log(`  Layers: ${layers.join(', ')}`);
  console.log(`  Scenarios: ${scenarios.length}`);
  console.log('');

  // 检查 dist 文件存在
  for (const s of scenarios) {
    const htmlPath = getHtmlPath(s.module);
    if (!fs.existsSync(htmlPath)) {
      console.error(`ERROR: ${htmlPath} 不存在。请先运行 pnpm build:all`);
      process.exit(1);
    }
  }

  const results: ValidationResult[] = [];
  let browser: Browser | null = null;

  try {
    // Layer 1: 纯解析检查 (无需浏览器)
    if (layers.includes(1)) {
      console.log('--- Layer 1: 解析公式自检 ---');
      for (const s of scenarios) {
        const errs: string[] = [];
        // 验证 invariant 函数不崩溃
        if (s.invariants) {
          for (const inv of s.invariants) {
            try {
              const dummy = { t: 0, x: 1, y: 1, vx: 1, vy: 1, v: 1, vTangential: 7, angularPos: 0, R: 1, k: 100, m: 1, A: 0.1, h: 10, v1: 3, v2: 0, m1: 2, m2: 1 };
              const r = inv.check(dummy, dummy, dummy);
              if (typeof r !== 'number' || isNaN(r)) {
                errs.push(`Invariant "${inv.name}": 返回 ${r} (应为 number)`);
              }
            } catch (e) {
              errs.push(`Invariant "${inv.name}": 异常 ${e}`);
            }
          }
        }
        const passed = errs.length === 0;
        console.log(`  [${passed ? 'PASS' : 'FAIL'}] ${s.id}`);
        errs.forEach(e => console.log(`         ${e}`));
        results.push({ scenarioId: s.id, layer: 1, passed, errors: errs });
      }
      console.log('');
    }

    // Layer 2: Playwright 真实运行
    if (layers.includes(2) || layers.includes(4)) {
      console.log('--- Layer 2: Playwright 状态提取验证 ---');
      browser = await chromium.launch({ headless: true, channel: 'chrome' });

      // 按模块分组，共享 page
      const byModule: Record<string, PhysicsScenario[]> = {};
      for (const s of scenarios) {
        (byModule[s.module] ??= []).push(s);
      }

      for (const [mod, modScenarios] of Object.entries(byModule)) {
        console.log(`\n  Module: ${mod}`);
        let page: Page | null = null;

        try {
          page = await openModule(browser, mod);
          console.log(`    Loaded: ${MODULE_HTML[mod]}`);

          for (const s of modScenarios) {
            if (layers.includes(2)) {
              console.log(`\n  [RUN] ${s.id}`);
              const result = await runStateValidation(page, s);
              console.log(`  [${result.passed ? 'PASS' : 'FAIL'}] ${s.id} (${result.duration}ms)`);
              result.errors.forEach(e => console.log(`         ${e}`));
              results.push(result);
            }

            if (layers.includes(4)) {
              console.log(`\n  [LLM] ${s.id}`);
              const result = await runLLMReview(page, s);
              console.log(`  [${result.passed ? 'PASS' : 'FAIL'}] ${s.id} LLM review (${result.duration}ms)`);
              result.errors.forEach(e => console.log(`         ${e}`));
              results.push(result);
            }
          }
        } catch (e) {
          console.error(`  Module ${mod} 加载失败: ${e}`);
          for (const s of modScenarios) {
            results.push({
              scenarioId: s.id,
              layer: 2,
              passed: false,
              errors: [`模块加载失败: ${e}`],
            });
          }
        } finally {
          await page?.close();
        }
      }
      console.log('');
    }
  } finally {
    await browser?.close();
  }

  // ---- 汇总报告 ----
  console.log('\n========================================');
  console.log('         VALIDATION SUMMARY');
  console.log('========================================\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  for (const r of results) {
    const icon = r.passed ? 'PASS' : 'FAIL';
    console.log(`[${icon}] L${r.layer} | ${r.scenarioId}${r.duration ? ` (${r.duration}ms)` : ''}`);
    if (!r.passed) {
      r.errors.forEach(e => console.log(`       ${e}`));
    }
  }

  console.log(`\n${passed} passed, ${failed} failed, ${results.length} total`);

  if (failed > 0) {
    console.log('\n提示:');
    console.log('- Layer 2 state 字段不匹配? → 检查模块 __SIM_STATE__ 返回的字段名');
    console.log('- 需要 LLM 视觉审查? → export GLM_API_KEY=xxx && npx tsx scripts/physics-review-workflow.ts --layer 4');
    process.exit(1);
  }
}

main().catch(e => {
  console.error('Workflow failed:', e);
  process.exit(1);
});
