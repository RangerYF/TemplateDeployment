# 电路教学展示层补全计划

| 字段 | 值 |
|------|-----|
| 任务ID | 03-21-18-00-circuit-teaching-layer |
| 风险等级 | **L1（常规风险）** — 1-3 文件改动 + 2 个新求解器，不涉及公共代码结构变更 |
| 流程路径 | MODE 0 → MODE 3 → MODE 4 → MODE 5 → MODE 6 |

---

## 缺口清单（6 项）

| # | 缺口 | 当前状态 | 目标状态 |
|---|------|----------|----------|
| G1 | 功率计算（bulb/motor） | power 字段永远为 0 | 求解器实时写入 |
| G2 | 电流方向箭头（电路场景） | 仅 wire-frame 场景有 | 所有 dc-source 电路场景导线上画箭头 |
| G3 | 步骤引导 | 数据已写入 properties，无 UI | 画布右上角显示操作提示卡片 |
| G4 | 公式推导区 | 仅在代码注释中 | 画布底部显示当前场景的关键公式 |
| G5 | 误差原因文字 | 仅显示"偏大/偏小" | 追加一句话解释物理原因 |
| G6 | 接法选择建议 | 求解器已算出 threshold | viewport 渲染对比表 + 推荐接法 |

---

## 实现计划

### G1：功率计算（2 个新求解器）

#### G1a. 灯泡非线性电阻求解器 `em-bulb-circuit`

**文件**：`src/domains/em/solvers/bulb-circuit.ts`

**电路拓扑**：电源 → 开关 → 灯泡（串联简单回路）

**非线性模型**（简化温度效应）：
```
// 额定工况：R_hot = U_rated² / P_rated
// 冷态：R_cold（用户设定）
// 实际电阻随电流变化的简化模型：
//   R(I) = R_cold + (R_hot - R_cold) * (I / I_rated)²
//   其中 I_rated = P_rated / U_rated
//
// 迭代求解（牛顿法，3次收敛）：
//   I = ε / (R(I) + r)
```

**写入字段**：
- `bulb.properties.hotResistance` — 实际电阻
- `bulb.properties.voltage` — 两端电压
- `bulb.properties.current` — 电流
- `bulb.properties.power` — 实际功率 P=UI

**预设**：`src/domains/em/presets/bulb-circuit.json`
- ID：`P04-CIR-EXP008-bulb-circuit`
- qualifier：`{ circuit: 'bulb-circuit' }`

#### G1b. 电动机电路求解器 `em-motor-circuit`

**文件**：`src/domains/em/solvers/motor-circuit.ts`

**电路拓扑**：电源 → 开关 → 电动机（串联）

**计算公式**：
```
I = (ε - ε_反) / (R_coil + r)
U_motor = ε_反 + I * R_coil    // 电动机两端电压
P_电 = U_motor * I              // 电功率
P_热 = I² * R_coil              // 热功率
P_机 = P_电 - P_热 = ε_反 * I   // 机械功率
```

**写入字段**：
- `motor.properties.voltage`, `current`
- `motor.properties.electricPower`, `heatPower`, `mechanicalPower`

**预设**：`src/domains/em/presets/motor-circuit.json`
- ID：`P04-CIR-EXP009-motor-circuit`
- qualifier：`{ circuit: 'motor-circuit' }`

---

### G2：电流方向箭头（改动 `circuit-viewport.ts`）

**改动位置**：`renderCircuitExperiment()` 第 191-211 行（导线绘制区域）

**当前**：灰色虚线连接相邻元件，无箭头
**改为**：

```typescript
// 在导线中点绘制电流方向三角箭头
for (let i = 0; i < sortedComponents.length - 1; i++) {
  const from = sortedComponents[i]!;
  const to = sortedComponents[i + 1]!;

  // 1. 导线（改为实线，通电时变绿）
  const hasCurrent = totalCurrent !== undefined && Math.abs(totalCurrent) > 1e-6;
  c.strokeStyle = hasCurrent ? '#27AE60' : '#888';
  c.lineWidth = hasCurrent ? 2 : 1.5;
  // ... 画线 ...

  // 2. 中点箭头（电流从正极流出 → 沿 X 正方向）
  if (hasCurrent) {
    const midX = (fromX + toX) / 2;
    const midY = (fromY + toY) / 2;
    drawArrow(c,
      { x: midX - 8, y: midY },
      { x: midX + 8, y: midY },
      { color: '#27AE60', lineWidth: 2, arrowHeadSize: 7 }
    );
  }
}
```

**额外**：需要从 entities 中读取 `dc-source.properties.totalCurrent` 来判定是否通电。

---

### G3：步骤引导卡片（改动 `circuit-viewport.ts`）

**改动位置**：`renderCircuitExperiment()` 末尾追加

**设计**：画布右上角半透明卡片，根据 `source.properties.step` 显示不同提示。

```typescript
// 步骤引导渲染（仅半偏法等分步实验显示）
function renderStepGuide(
  c: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  source: Entity,
): void {
  const step = source.properties.step as string | undefined;
  if (!step || step === 'off') return;

  const dpr = window.devicePixelRatio || 1;
  const boxX = canvas.width / dpr - 220;
  const boxY = 16;
  const boxW = 200;

  // 半透明背景卡片
  c.save();
  c.fillStyle = 'rgba(255, 255, 255, 0.92)';
  c.strokeStyle = '#D1D5DB';
  roundRect(c, boxX, boxY, boxW, 0, 8); // 高度自适应

  let y = boxY + 16;
  c.fillStyle = '#1F2937';
  c.font = 'bold 12px Inter, sans-serif';
  c.textAlign = 'left';

  if (step === 'step1') {
    c.fillText('步骤一：调满偏', boxX + 12, y); y += 18;
    c.font = '11px Inter, sans-serif';
    c.fillStyle = '#6B7280';
    c.fillText('S闭合、S\'断开', boxX + 12, y); y += 15;
    c.fillText('调节R使电流计满偏', boxX + 12, y); y += 15;

    const Rf = source.properties.R_fullDeflection as number | undefined;
    const isFull = source.properties.isFullDeflection as boolean | undefined;
    if (Rf !== undefined) {
      c.fillStyle = isFull ? '#10B981' : '#F59E0B';
      c.fillText(`满偏需 R≈${Math.round(Rf)}Ω`, boxX + 12, y); y += 15;
      if (isFull) c.fillText('✓ 已满偏，可进入步骤二', boxX + 12, y);
    }
  } else if (step === 'step2') {
    c.fillText('步骤二：调半偏', boxX + 12, y); y += 18;
    c.font = '11px Inter, sans-serif';
    c.fillStyle = '#6B7280';
    c.fillText('闭合S\'', boxX + 12, y); y += 15;
    c.fillText('调节R\'使电流计半偏', boxX + 12, y); y += 15;

    const isHalf = source.properties.isHalfDeflection as boolean | undefined;
    const measuredRg = source.properties.measuredRg as number | undefined;
    const trueRg = source.properties.trueRg as number | undefined;
    if (isHalf && measuredRg !== undefined && trueRg !== undefined) {
      c.fillStyle = '#10B981';
      c.fillText(`✓ 已半偏`, boxX + 12, y); y += 15;
      c.fillText(`R'=${measuredRg}Ω ≈ Rg=${trueRg}Ω`, boxX + 12, y);
    }
  }
  // ... 类似逻辑适配 ohmmeter（调零/测量）和 wheatstone-bridge（平衡调节）
  c.restore();
}
```

**适配的实验**：
| 实验 | step 值 | 提示内容 |
|------|---------|----------|
| 半偏法 | `step1` / `step2` | 调满偏 → 调半偏 |
| 欧姆表 | `zeroing` / `measuring` | 调零 → 测量（需在 ohmmeter 求解器追加 step 字段） |
| 电桥法 | `balancing` | 调节 R4 使 G 归零（需在 wheatstone-bridge 求解器追加 step 字段） |

---

### G4：公式推导区（改动 `circuit-viewport.ts`）

**改动位置**：`renderCircuitExperiment()` 末尾追加

**设计**：画布左下角显示当前实验的关键公式（2-3 行）。

```typescript
function renderFormulaBox(
  c: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  solverQualifier: string,
  source: Entity,
): void {
  const dpr = window.devicePixelRatio || 1;
  const boxX = 16;
  const boxY = canvas.height / dpr - 90;

  c.save();
  c.fillStyle = 'rgba(255, 255, 255, 0.90)';
  c.strokeStyle = '#D1D5DB';
  // 绘制圆角矩形背景 ...

  c.fillStyle = '#374151';
  c.font = '12px "Courier New", monospace';
  c.textAlign = 'left';

  const formulas = getFormulasForCircuit(solverQualifier, source);
  let y = boxY + 18;
  for (const line of formulas) {
    c.fillText(line, boxX + 12, y);
    y += 16;
  }
  c.restore();
}

function getFormulasForCircuit(qualifier: string, source: Entity): string[] {
  switch (qualifier) {
    case 'voltammetry-internal':
      return [
        'R测 = U_V / I_A = Rx + rA',
        '误差：R测 > Rx（偏大）',
        '适用：Rx >> rA（大电阻）',
      ];
    case 'voltammetry-external':
      return [
        'R测 = U_V / I_A = Rx·rV/(Rx+rV)',
        '误差：R测 < Rx（偏小）',
        '适用：Rx << rV（小电阻）',
      ];
    case 'voltammetry-compare': {
      const method = source.properties.currentMethod as string;
      const threshold = source.properties.threshold as number | undefined;
      return method === 'internal'
        ? [`当前：内接法  R测 = Rx + rA（偏大）`,
           `判据：Rx ${threshold ? ('>? ' + threshold.toFixed(0) + 'Ω') : ''} → 选接法`,
           `临界值 √(rA·rV)`]
        : [`当前：外接法  R测 = Rx∥rV（偏小）`,
           `判据：Rx ${threshold ? ('<? ' + threshold.toFixed(0) + 'Ω') : ''} → 选接法`,
           `临界值 √(rA·rV)`];
    }
    case 'measure-emf-r':
      return [
        'U = ε - I·r',
        '斜率 = -r，截距 = ε',
        '调节R改变I，测多组(U,I)',
      ];
    case 'half-deflection':
      return [
        '满偏：Ig = ε / (R + Rg + r)',
        '半偏：R\' ≈ Rg（条件：R >> Rg）',
        '误差：R\' < Rg（偏小）',
      ];
    case 'ohmmeter':
      return [
        '中值电阻 R中 = ε / Ig',
        'θ = I/Ig，刻度 Rx = R中(1/θ - 1)',
        '左0右∞，非线性刻度',
      ];
    case 'wheatstone-bridge':
      return [
        '平衡条件：R1/R2 = R3/R4',
        'R3 = R1·R4/R2',
        'Ig = 0 → 电桥平衡',
      ];
    default:
      return [];
  }
}
```

**公式传递机制**：需要在 `renderCircuitExperiment` 中获取当前的 `solverQualifier`。方案：从 `circuit-viewport` 的 `ViewportData` 扩展或从 entities 推断（检测场景特征元件组合）。

**更简单的方案**：在各求解器的 `source.properties` 中写入 `circuitType` 标识（如 `'voltammetry-internal'`），viewport 直接读取。所有电路求解器已经写入了大量自定义 properties，追加一个字段代价极低。

---

### G5：误差原因文字（改动 `circuit-viewport.ts`）

**改动位置**：第 270-278 行，误差显示区域

**当前**：
```typescript
`误差=${errorPercent}%（${errorSign}）`
```

**改为**：
```typescript
// 误差百分比
`误差=${errorPercent}%（${errorSign}）`

// 追加原因解释（根据 circuitType 判断）
const circuitType = source.properties.circuitType as string | undefined;
if (circuitType === 'voltammetry-internal' ||
    (circuitType === 'voltammetry-compare' && source.properties.currentMethod === 'internal')) {
  yOffset -= 16;
  drawTextLabel(c,
    '原因：电流表分压，U_V 包含 rA 上电压',
    { x: topScreen.x, y: yOffset },
    { color: '#9CA3AF', fontSize: 10, align: 'center' },
  );
} else if (circuitType === 'voltammetry-external' ||
           (circuitType === 'voltammetry-compare' && source.properties.currentMethod === 'external')) {
  yOffset -= 16;
  drawTextLabel(c,
    '原因：电压表分流，I_A 包含流过 rV 的电流',
    { x: topScreen.x, y: yOffset },
    { color: '#9CA3AF', fontSize: 10, align: 'center' },
  );
}
```

**前置改动**：在 3 个伏安法求解器中追加 `source.properties.circuitType = 'voltammetry-internal'` 等标识（每个求解器加 1 行）。

---

### G6：接法对比表（改动 `circuit-viewport.ts`）

**改动位置**：`renderCircuitExperiment()` 中，仅当 `circuitType === 'voltammetry-compare'` 时渲染

**设计**：画布右下角对比表格

```
┌─────────────────────────────────────┐
│  接法对比                            │
│  ───────────────────────────────── │
│  内接法  R测=100.50Ω  误差+0.50%    │
│  外接法  R测= 96.77Ω  误差-3.23%    │
│  ───────────────────────────────── │
│  临界值 √(rA·rV) = 38.7Ω           │
│  Rx=100Ω > 38.7Ω → 推荐外接法 ✓    │
└─────────────────────────────────────┘
```

所有数据已由 `voltammetry-compare` 求解器写入 `source.properties`：
- `measuredR_internal`, `error_internal`
- `measuredR_external`, `error_external`
- `threshold`, `recommendedMethod`, `currentMethod`

仅需在 viewport 中读取并绘制。

---

## 文件变更清单

### 新增文件（4 个）
| # | 文件 | 说明 |
|---|------|------|
| 1 | `src/domains/em/solvers/bulb-circuit.ts` | 灯泡非线性电阻求解器 |
| 2 | `src/domains/em/presets/bulb-circuit.json` | 灯泡电路预设 |
| 3 | `src/domains/em/solvers/motor-circuit.ts` | 电动机功率分解求解器 |
| 4 | `src/domains/em/presets/motor-circuit.json` | 电动机电路预设 |

### 修改文件（5 个）
| # | 文件 | 改动内容 |
|---|------|----------|
| 5 | `src/domains/em/viewports/circuit-viewport.ts` | G2 箭头 + G3 步骤 + G4 公式 + G5 误差原因 + G6 对比表 |
| 6 | `src/domains/em/solvers/voltammetry-internal.ts` | 追加 `circuitType` 标识（1 行） |
| 7 | `src/domains/em/solvers/voltammetry-external.ts` | 追加 `circuitType` 标识（1 行） |
| 8 | `src/domains/em/solvers/voltammetry-compare.ts` | 追加 `circuitType` 标识（1 行） |
| 9 | `src/domains/em/index.ts` | 注册新求解器 + 预设 |

### 小改动（追加 step 字段，各 1 行）
| # | 文件 | 改动 |
|---|------|------|
| 10 | `src/domains/em/solvers/ohmmeter.ts` | 追加 `source.properties.step = isZeroed ? 'measuring' : 'zeroing'` |
| 11 | `src/domains/em/solvers/wheatstone-bridge.ts` | 追加 `source.properties.step = isBalanced ? 'balanced' : 'balancing'` |

---

## 执行批次

| 批次 | 缺口 | 内容 | 预计改动量 |
|------|------|------|-----------|
| **C1** | G1a | 灯泡求解器 + 预设 + 注册 | 2 新文件 |
| **C2** | G1b | 电动机求解器 + 预设 + 注册 | 2 新文件 |
| **C3** | G5 | 3 个伏安法求解器追加 circuitType（各 1 行）| 3 改 |
| **C4** | G2 | circuit-viewport 导线电流箭头 | 1 改 |
| **C5** | G5+G6 | circuit-viewport 误差原因 + 对比表 | 1 改（续 C4） |
| **C6** | G3 | circuit-viewport 步骤引导 + ohmmeter/wheatstone 追加 step | 3 改 |
| **C7** | G4 | circuit-viewport 公式推导区 | 1 改（续 C6） |
| **C8** | — | 回归验证 `pnpm lint && pnpm tsc --noEmit` | — |

---

## 公共代码影响

**无**。所有改动限于 `src/domains/em/` 目录，不涉及公共代码。
