# P-04 电路搭建器功能补全

| 字段 | 值 |
|------|-----|
| 任务ID | 03-21-15-30-p04-circuit-full-completion |
| 风险等级 | **L2（高风险）** — 跨多文件、新增实体/求解器/渲染器/预设，涉及公共代码追加 |
| 流程路径 | MODE 0 → MODE 1 → MODE 3 → MODE 4 → MODE 5 → MODE 6 |

---

## 用户原始需求

补全 P-04 电路搭建器的全部缺失功能，包括：
1. 新增实验模板：半偏法（EXP-003）、欧姆表（EXP-005）、电桥法（EXP-006）
2. 新增功能：故障模拟（断路/短路）、内/外接法一键切换、电路图↔实物图切换
3. 新增元件：电容器、灯泡（非线性电阻）、电阻箱、电动机（含反电动势）

---

## 风险评估

- **跨模块联动**：新增实体类型需在 core/types.ts 追加（只追加不修改）
- **新增文件数量**：预计 20+ 个新文件（4 实体 + 3 求解器 + 4 渲染器 + 3 预设 + 功能增强）
- **公共代码变更**：需追加 EntityType、可能追加 ForceType
- **测试覆盖**：所有求解器需手算验证

---

## 实现计划

### 阶段一：新增元件实体（4 个）

#### 1.1 电容器 `capacitor`
- **文件**：`src/domains/em/entities/capacitor.ts`
- **properties**：
  - `capacitance: number` (μF，默认 10，范围 0.1~1000)
  - `voltage: number` (运行时写入，两端电压)
  - `charge: number` (运行时写入，存储电荷 Q=CV)
  - `width: 0.6, height: 0.4`
- **category**：`'object'`
- **用途**：P-13 含电容场景（#20 #23）

#### 1.2 灯泡（非线性电阻）`bulb`
- **文件**：`src/domains/em/entities/bulb.ts`
- **properties**：
  - `ratedVoltage: number` (额定电压 V，默认 3.8)
  - `ratedPower: number` (额定功率 W，默认 0.3)
  - `coldResistance: number` (冷态电阻 Ω，默认 2)
  - `hotResistance: number` (热态电阻 Ω，运行时计算)
  - `voltage: number, current: number` (运行时)
  - `radius: 0.3`
- **非线性模型**：采用简化温度-电阻模型，R = R_cold + k·I²（k 由额定参数推导）
- **category**：`'object'`

#### 1.3 电阻箱 `resistance-box`
- **文件**：`src/domains/em/entities/resistance-box.ts`
- **properties**：
  - `resistance: number` (Ω，默认 0，范围 0~9999，step 1)
  - `digits: [number, number, number, number]` (千/百/十/个位，运行时计算)
  - `width: 1.0, height: 0.5`
- **category**：`'object'`
- **用途**：电桥法（#38）、半偏法（#35）

#### 1.4 电动机（含反电动势）`motor`
- **文件**：`src/domains/em/entities/motor.ts`
- **properties**：
  - `backEmf: number` (反电动势 V，默认 2)
  - `coilResistance: number` (线圈电阻 Ω，默认 1)
  - `voltage: number, current: number` (运行时)
  - `electricPower: number` (电功率 P_电=UI)
  - `heatPower: number` (热功率 P_热=I²R)
  - `mechanicalPower: number` (机械功率 P_机=P_电-P_热)
  - `width: 0.8, height: 0.5`
- **category**：`'object'`

### 阶段二：新增渲染器（4 个）

#### 2.1 电容器渲染器
- **文件**：`src/domains/em/renderers/capacitor-renderer.ts`
- **绘制**：两条平行竖线（电容符号），中间间隔，标注 C=xμF
- **层级**：`'object'`

#### 2.2 灯泡渲染器
- **文件**：`src/domains/em/renderers/bulb-renderer.ts`
- **绘制**：圆形外框 + 内部交叉线（灯泡符号），运行时标注 U/I/P
- **层级**：`'object'`

#### 2.3 电阻箱渲染器
- **文件**：`src/domains/em/renderers/resistance-box-renderer.ts`
- **绘制**：矩形框 + 四个旋钮位（千/百/十/个），显示当前数字组合
- **层级**：`'object'`

#### 2.4 电动机渲染器
- **文件**：`src/domains/em/renderers/motor-renderer.ts`
- **绘制**：圆形 + "M" 字（电动机符号），运行时标注 P_电/P_热/P_机
- **层级**：`'object'`

### 阶段三：新增实验模板求解器 + 预设（3 个）

#### 3.1 半偏法测电流计内阻 `em-half-deflection`（EXP-003，P0）

**电路拓扑**：
```
电源(ε,r) → 开关S → 电阻箱(R) → 电流计(Ig,Rg)
                                    ↕ 并联开关S'
                                    ↕ 电阻箱R'
```

**操作步骤求解器**（状态机模式）：
- **step 1**：S 闭合、S' 断开，调 R 使电流计满偏 → R_满 = (ε - Ig·Rg) / Ig - r
- **step 2**：S' 闭合，调 R' 使电流计半偏 → R' ≈ Rg（近似条件：R >> Rg）
- **求解器需要**：
  - 两个电阻箱实体
  - 两个开关实体
  - 一个电流计（复用 ammeter，量程设为 μA 级）
  - 输出：R'（测量值）、Rg（真实值）、误差分析（R' < Rg，偏小）

**文件**：
- 求解器：`src/domains/em/solvers/half-deflection.ts`
- 预设：`src/domains/em/presets/half-deflection.json`
- 预设 ID：`P04-CIR-EXP003-half-deflection`
- solverQualifier：`{ circuit: 'half-deflection' }`

**参数面板**：
- 电源 EMF (1~12V)、内阻 (0~5Ω)
- 电流计内阻 Rg (真实值，50~500Ω)
- 电流计满偏电流 Ig (50~500μA)
- 电阻箱 R (slider，0~9999Ω)
- 电阻箱 R' (slider，0~9999Ω)
- 开关 S' (toggle)

#### 3.2 欧姆表原理 `em-ohmmeter`（EXP-005，P1）

**电路拓扑**：
```
内置电池(ε) → 调零电阻(R_adj) → 电流计(Ig,Rg) → 待测电阻(Rx)
```

**求解逻辑**：
- 调零：Rx=0 时调 R_adj 使满偏，此时 R_adj + Rg = ε/Ig（中值电阻 = ε/Ig）
- 测量：I = ε / (R_adj + Rg + Rx)，偏转比 = I/Ig
- 非线性刻度：刻度值 = ε/I - (R_adj + Rg)

**渲染增强**：
- 欧姆表表盘：弧形非线性刻度，左 0 右 ∞，中间为中值电阻
- 复用 ammeter 渲染器但增加欧姆表模式标识

**文件**：
- 求解器：`src/domains/em/solvers/ohmmeter.ts`
- 预设：`src/domains/em/presets/ohmmeter.json`
- 预设 ID：`P04-CIR-EXP005-ohmmeter`
- solverQualifier：`{ circuit: 'ohmmeter' }`

**参数面板**：
- 内置电池 EMF (1.5V 固定)
- 电流计满偏 Ig (100μA)
- 电流计内阻 Rg (1000Ω)
- 调零电阻 R_adj (slider)
- 待测电阻 Rx (slider 0~100kΩ)

#### 3.3 电桥法测电阻 `em-wheatstone-bridge`（EXP-006，P1）

**电路拓扑**：
```
        R1          R2
A ────┤├──── B ────┤├──── C
      │              │
      │     Ig=0?    │
      D ──[G表]── E
      │              │
      │              │
F ────┤├──── G ────┤├──── H
        R3          R4(电阻箱)

电源连接 A-F 和 C-H 之间
```

**求解逻辑**：
- 平衡条件：R1/R2 = R3/R4 → Ig=0
- 不平衡时：计算桥路电流 Ig（戴维宁等效）
- 灵敏度：dIg/dR4 在平衡点附近

**文件**：
- 求解器：`src/domains/em/solvers/wheatstone-bridge.ts`
- 预设：`src/domains/em/presets/wheatstone-bridge.json`
- 预设 ID：`P04-CIR-EXP006-wheatstone-bridge`
- solverQualifier：`{ circuit: 'wheatstone-bridge' }`

**新增实体需求**：灵敏电流计 `galvanometer`
- properties：`sensitivity`, `reading` (μA)，`radius`
- 渲染：圆形表盘 + "G" 字，指针可左右偏转（零点在中间）
- **文件**：`src/domains/em/entities/galvanometer.ts` + `renderers/galvanometer-renderer.ts`

### 阶段四：功能增强

#### 4.1 故障模拟（P04-F5，P1）

**设计方案**：
- 在所有电路实体（电阻、开关、灯泡等）的 properties 中追加可选字段：
  - `faultType?: 'none' | 'open' | 'short'`（正常/断路/短路）
- 求解器中：
  - `'open'`（断路）→ 该元件等效为 R=∞，支路电流=0
  - `'short'`（短路）→ 该元件等效为 R=0
- 渲染器中：
  - 断路：元件上叠加红色 "✕" + 虚线表示断开
  - 短路：元件上叠加红色导线桥接 + "短路" 标注
- 电路视角：异常支路高亮红色

**实现范围**：
- 修改 `fixed-resistor`、`slide-rheostat`、`bulb` 实体定义，追加 `faultType`
- 修改现有 3 个求解器 + 新增求解器，添加故障判断逻辑
- 修改渲染器，添加故障叠加绘制
- 在 paramGroups 中追加 "故障模拟" select 控件

**影响文件**：
- `entities/fixed-resistor.ts` — 追加 faultType 默认值
- `entities/slide-rheostat.ts` — 追加 faultType 默认值
- `entities/bulb.ts`（新增时直接包含）
- 各渲染器追加故障绘制逻辑
- 各求解器追加故障短路逻辑
- `logic/circuit-solver-utils.ts` — 新增 `getEffectiveResistance(entity)` 工具函数

#### 4.2 内/外接法一键切换（P04-F6，P1）

**设计方案**：
- 新增统一求解器 `em-voltammetry-compare`，合并内/外接法逻辑
- 通过 `paramGroup` 中的 `select` 控件切换接法：
  ```json
  { "key": "method", "type": "select", "options": ["internal", "external"], "label": "接法" }
  ```
- 求解器内部根据 `paramValues.method` 分支计算
- 电路视角增强：同时显示两种接法的误差对比表格

**文件**：
- 求解器：`src/domains/em/solvers/voltammetry-compare.ts`
- 预设：`src/domains/em/presets/voltammetry-compare.json`
- 预设 ID：`P04-CIR-EXP007-voltammetry-compare`
- solverQualifier：`{ circuit: 'voltammetry-compare' }`

**电路视角增强**（`circuit-viewport.ts`）：
- 当 solverQualifier 为 `voltammetry-compare` 时，右上角显示误差对比表：
  ```
  ┌──────────────────────────────────┐
  │  当前接法：内接法                 │
  │  R测(内接) = xx.xxΩ  误差+x.xx%  │
  │  R测(外接) = xx.xxΩ  误差-x.xx%  │
  │  推荐接法：外接法（Rx >> √(rA·rV)）│
  └──────────────────────────────────┘
  ```

#### 4.3 电路图↔实物图切换（P04-F7，**Phase 2 推迟**）

**理由**：
- 实物图渲染需要完全不同的绘制系统（逼真器件图、接线柱、导线弯折）
- 工作量大，与 Phase 1 的核心目标（预设驱动、参数微调）不符
- 建议 Phase 2 实现，当前阶段标记为 ⏭️ 跳过

### 阶段五：注册与集成

#### 5.1 公共类型追加（`src/core/types.ts`）
- 追加 EntityType 联合类型：`'capacitor' | 'bulb' | 'resistance-box' | 'motor' | 'galvanometer'`
- **只追加不修改**已有定义

#### 5.2 em/index.ts 更新
- 按标准顺序注册所有新增实体、求解器、渲染器、预设
- 总计追加约 15 条 register 调用 + 对应 import

#### 5.3 circuit-solver-utils.ts 增强
- `getEffectiveResistance(entity)` — 考虑故障状态的等效电阻
- `findAllComponentsByTypes(entities, types[])` — 批量查找多种类型

### 阶段六：回归验证

- `pnpm lint && pnpm tsc --noEmit` — 类型检查与代码规范
- 每个求解器手算验证（附录中列出验证用例）
- 预设加载测试（确保 JSON schema 正确）

---

## 执行优先级排序

| 批次 | 内容 | 优先级 | 预计文件数 |
|------|------|--------|-----------|
| **Batch 1** | 电阻箱实体+渲染器（半偏法和电桥法的前置依赖） | P0 前置 | 2 |
| **Batch 2** | 半偏法 EXP-003（求解器+预设） | P0 | 2 |
| **Batch 3** | 灵敏电流计实体+渲染器 → 电桥法 EXP-006（求解器+预设） | P1 | 4 |
| **Batch 4** | 欧姆表 EXP-005（求解器+预设） | P1 | 2 |
| **Batch 5** | 故障模拟（修改现有实体+求解器+渲染器） | P1 | ~8 文件修改 |
| **Batch 6** | 内/外接法一键切换（新求解器+预设+视角增强） | P1 | 3 |
| **Batch 7** | 电容器实体+渲染器 | P1 | 2 |
| **Batch 8** | 灯泡实体+渲染器 | P2 | 2 |
| **Batch 9** | 电动机实体+渲染器 | P2 | 2 |
| **Batch 10** | 注册集成 + 回归验证 | — | 2 修改 |

---

## 新增文件总清单

### 实体（5 个新文件）
1. `src/domains/em/entities/capacitor.ts`
2. `src/domains/em/entities/bulb.ts`
3. `src/domains/em/entities/resistance-box.ts`
4. `src/domains/em/entities/motor.ts`
5. `src/domains/em/entities/galvanometer.ts`

### 渲染器（5 个新文件）
6. `src/domains/em/renderers/capacitor-renderer.ts`
7. `src/domains/em/renderers/bulb-renderer.ts`
8. `src/domains/em/renderers/resistance-box-renderer.ts`
9. `src/domains/em/renderers/motor-renderer.ts`
10. `src/domains/em/renderers/galvanometer-renderer.ts`

### 求解器（4 个新文件）
11. `src/domains/em/solvers/half-deflection.ts`
12. `src/domains/em/solvers/ohmmeter.ts`
13. `src/domains/em/solvers/wheatstone-bridge.ts`
14. `src/domains/em/solvers/voltammetry-compare.ts`

### 预设（4 个新文件）
15. `src/domains/em/presets/half-deflection.json`
16. `src/domains/em/presets/ohmmeter.json`
17. `src/domains/em/presets/wheatstone-bridge.json`
18. `src/domains/em/presets/voltammetry-compare.json`

### 修改文件
19. `src/core/types.ts` — 追加 5 个 EntityType
20. `src/domains/em/index.ts` — 追加注册调用
21. `src/domains/em/logic/circuit-solver-utils.ts` — 追加工具函数
22. `src/domains/em/entities/fixed-resistor.ts` — 追加 faultType
23. `src/domains/em/entities/slide-rheostat.ts` — 追加 faultType
24. `src/domains/em/renderers/fixed-resistor-renderer.ts` — 故障绘制
25. `src/domains/em/renderers/slide-rheostat-renderer.ts` — 故障绘制
26. `src/domains/em/viewports/circuit-viewport.ts` — 误差对比表 + 故障高亮
27. 现有 3 个求解器 — 追加故障逻辑

---

## 手算验证用例（阶段六使用）

### 半偏法验证
- ε=6V, r=0, Rg=200Ω, Ig=200μA
- 满偏时 R=(6/0.0002)-200=29800Ω
- 并联 R'=200Ω，半偏时 I_并=Ig/2=100μA → 总 I=200μA（不变需 R>>Rg）
- 实际 R' 略小于 Rg（因总电阻减小导致总电流增大）

### 电桥法验证
- R1=100Ω, R2=1000Ω, R3=500Ω, 平衡时 R4=R3·R2/R1=5000Ω
- 不平衡时 R4=4000Ω → 用戴维宁定理计算 Ig

### 欧姆表验证
- ε=1.5V, Ig=100μA, Rg=1000Ω → 中值电阻=15000-1000=14000Ω
- Rx=14000Ω 时 I=Ig/2，指针半偏
