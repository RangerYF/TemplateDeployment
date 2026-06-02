# C09 合成路线视图 — 设计文档

- 日期：2026-06-01
- 模块：C09「有机化学反应路径图」（`c07_c09_chemistry_tool.html` 内）
- 状态：设计待评审

## 1. 目标

在 C09 内新增一个「合成路线」标签页，用**键线式结构图 + 反应条件箭头**展示中国高中基础有机的多步合成 / 转化路线，类比教材常见的"卤代烃↔烯烃↔二卤代物"等路线图。老师可从菜单选路线，逐步展开讲解。

现有 C09 是"官能团大类转化的轮盘网络图"（抽象、类级）。本功能是其**具体分子级**的补充视图，二者并存，互不影响。

## 2. 范围

### 做（In scope）
- 一个**可复用的键线式渲染器**（紧凑结构描述 → SVG），零外部依赖
- 一个**分子库**（核心 ~26 个，可扩展至 40-50）+ 一个**路线库**（~12 条）
- 新「合成路线」标签页：左侧路线菜单 + 主区横向流程图 + 逐步展开控件 + 点击详情
- 复用现有 EduMind bridge，新增路线相关 AI 操作 + 更新 `ai-capability-c09.json`
- 数据完整性校验 + 构建产物自包含校验

### 不做（Out of scope，YAGNI）
- **分支 / 收敛**合成路线 —— 只做线性步骤序列；图片里"原料直达 vs 多步"做成同目标的**两条并列独立路线**
- **SMILES 解析 / 自动布局** —— 不引入化学结构库（违背 <200KB 单文件原则）
- **老师自由拖拽搭建路线编辑器**
- 把 C09 重构成独立 Vite 包（改动过大，保持现有单体 HTML 模式）

## 3. 架构与组件

四个清晰边界的单元：

```
MOLECULES (数据)  ──┐
                    ├─►  renderRoute(routeId, revealedSteps)  ──►  SVG/HTML
ROUTES (数据)     ──┘            │
                                 └─ renderSkeleton(spec) ──► 单个分子 SVG
```

### 3.1 分子库 `MOLECULES: Record<string, Molecule>`

```ts
interface Molecule {
  id: string;            // "2-bromobutane"
  name: string;          // 中文名（常显）"2-溴丁烷"
  condensed: string;     // 结构简式（常显）"CH₃CHBrCH₂CH₃"
  formula: string;       // 分子式 "C₄H₉Br"
  category: string;      // 官能团类别 "haloalkane"（点击详情用，沿用现有 12 类 id）
  skeleton: SkeletonSpec;
}
```

### 3.2 键线式描述 `SkeletonSpec`

紧凑、声明式，**不含坐标**（坐标由渲染器算）：

```ts
type SkeletonSpec =
  | { type: 'chain'; atoms: number; bonds?: BondMod[]; subs?: Sub[] }
  | { type: 'ring';  size: number; aromatic?: boolean; bonds?: BondMod[]; subs?: Sub[] };

interface BondMod { a: number; b: number; order: 2 | 3; }     // 顶点 1-based，双/叁键
interface Sub { at: number; label: string; dir: 'up' | 'down' | 'auto'; }
```

示例：
- 2-溴丁烷：`{ type:'chain', atoms:4, subs:[{at:2,label:'Br',dir:'up'}] }`
- 2-丁烯：`{ type:'chain', atoms:4, bonds:[{a:2,b:3,order:2}] }`
- 2,3-二溴丁烷：`{ type:'chain', atoms:4, subs:[{at:2,label:'Br',dir:'up'},{at:3,label:'Br',dir:'down'}] }`
- 苯：`{ type:'ring', size:6, aromatic:true }`
- 环己烯：`{ type:'ring', size:6, bonds:[{a:1,b:2,order:2}] }`

### 3.3 键线式渲染器 `renderSkeleton(spec): string`（~150 行纯函数）

- **链坐标**：锯齿。键长 L，与水平成 30°；`dx=L·cos30`，`dy=L·sin30`；顶点 i 交替上下。
- **环坐标**：正多边形，size 个顶点按等角分布（六元环默认顶点朝上的标准画法）。
- **双键平行算法**（关键，已验证）：主键 A→B，方向 d=(dx,dy)；垂直单位向量取朝环内 / 链内侧；第二条线 = 主键两端各加同一垂直偏移量 k(≈5)，并沿键方向两端内缩 ≈4，保证**永远平行**。叁键画三条线。
- **取代基**：自顶点引出短键（dir 决定上/下/外），末端文字标注；卤素用红 `#B91C1C`，其余官能团用 `#1A202C`。
- **芳香环**：默认正六边形 + **内圈圆**（中国教材"苯环"标准符号）；保留 `aromatic:false + bonds` 走凯库勒交替双键的能力。
- 风格常量（键长、线宽、字号、颜色）集中在渲染器顶部，改一处全局生效。
- 纯函数：输入 spec，输出 SVG 字符串，无副作用 → 可单测。

### 3.4 路线库 `ROUTES: Record<string, Route>`

```ts
interface Route {
  id: string;
  title: string;          // "卤代烃↔烯烃互变"
  group: '必修主线' | '选修拓展';
  steps: Step[];          // 线性序列；step[i].to === step[i+1].from
}
interface Step {
  from: string;           // 分子 id
  to: string;             // 分子 id
  reactionType: string;   // "消去" / "加成" / "氧化" / "取代" / "酯化" / "水解" …
  conditions: string;     // "NaOH/醇, △"
  equation: string;       // 代表性方程式（结构简式文本，Unicode 下标）
  note?: string;          // 教学提示；缺省时由 reactionType 关键词生成（复用 getC09TeachingPrompt）
}
```

### 3.5 路线 / 分子清单（首批）

**必修主线**
1. 甲烷氯代：甲烷 →(取代, Cl₂/光照) 一氯甲烷
2. 乙烯水合制乙醇：乙烯 →(加成, H₂O/催化剂/加热) 乙醇
3. 乙醇消去制乙烯：乙醇 →(消去, 浓H₂SO₄/170℃) 乙烯
4. 乙烯卤代：乙烯 →(加成, Br₂) 1,2-二溴乙烷
5. 溴乙烷水解：溴乙烷 →(水解, NaOH(aq)/△) 乙醇
6. 乙醇氧化链：乙醇 →(氧化, CuO/△) 乙醛 →(氧化, O₂/催化剂) 乙酸 →(酯化, 乙醇/浓H₂SO₄/△) 乙酸乙酯
7. 卤代烃↔烯烃互变（图片）：2-溴丁烷 →(消去, NaOH/醇,△) 2-丁烯 →(加成, Br₂) 2,3-二溴丁烷
8. 苯溴代：苯 →(取代, Br₂/Fe) 溴苯

**选修拓展**
9. 苯硝化：苯 →(取代/硝化, 浓HNO₃/浓H₂SO₄/△) 硝基苯
10. 甲苯氧化：甲苯 →(氧化, KMnO₄/△) 苯甲酸
11. 环系互变（图片）：溴代环己烷 →(消去, NaOH/醇,△) 环己烯 →(加成, Br₂) 1,2-二溴环己烷
12. 1,3-丁二烯加成（图片）：1,3-丁二烯 →(加成, Br₂) 1,4-二溴-2-丁烯 →(加成, H₂/催化剂) 1,4-二溴丁烷

**核心分子（23，与上述路线精确对应，按需扩展至 40-50）**：甲烷、一氯甲烷、乙烯、乙醇、乙醛、乙酸、乙酸乙酯、溴乙烷、1,2-二溴乙烷、2-溴丁烷、2-丁烯、2,3-二溴丁烷、苯、溴苯、硝基苯、甲苯、苯甲酸、溴代环己烷、环己烯、1,2-二溴环己烷、1,3-丁二烯、1,4-二溴-2-丁烯、1,4-二溴丁烷。

> 扩展示例（实现时可加，需配套路线）：环己烷、1,3-环己二烯（环己烯→苯 芳构化路线）等。

> 注：所有结构式、反应条件、方程式在实现时需对照人教版教材逐条核对（教学产品，宁可慢不可错）。

## 4. 视图与交互

C09 顶部标签页新增「合成路线」，与现有「官能团转化轮盘」「同分异构查询」并列。

- **左侧菜单**：路线按 `group`（必修主线 / 选修拓展）分组，点击切换当前路线。
- **主区**：
  - 顶部：路线标题 + 学段 chip + 逐步控件（上一步 / 下一步 / 全部展开）+ 进度"第 n/N 步"
  - 流程：横向 `[分子节点] [箭头:反应类型+条件] [分子节点] …`，可横向滚动
  - 分子节点 = 键线式 SVG + 名称 + 结构简式（已定风格）
- **逐步展开**：状态 `revealedStepCount` 从 0（仅起始分子）递增；未揭示的步与分子**淡显**（`.ghost`）。复用现有 C09 逐步动画 / requestAnimationFrame 机制。
- **点击详情**：
  - 点分子 → 名称 / 结构简式 / 分子式 / 官能团类别
  - 点箭头 → 反应类型 / 条件 / 方程式 / 教学提示（复用 `getC09TeachingPrompt`）

## 5. 数据流

```
视图状态 { currentRouteId, revealedStepCount, selected:{kind,id}|null }
   │  用户操作（选路线 / 下一步 / 点节点）
   ▼
重新 renderRoute()  →  innerHTML 注入主区（沿用现有字符串模板渲染方式）
```

静态数据 MOLECULES / ROUTES 模块加载即定；视图仅持有上述状态。

## 6. AI 集成

沿用 `edumind.templateBridge` 与现有 C09 operation 模式：
- 新增操作：`loadSynthesisRoute(routeId)`、`revealRouteStep(count)`、`switchC09View('routes'|'wheel'|'isomer')`
- `getAiContext()` 增补：当前视图、当前路线 id、已展开步数、可用路线清单
- 更新 `ai-capability-c09.json`：在 operations / examples / planningRules 中加入合成路线相关条目；明确"只输出 C09 合成路线 payload"

## 7. 错误处理

- 路线引用了不存在的分子 id → 该节点渲染占位框 + `console.warn`，不崩溃
- `SkeletonSpec` 非法（如 subs.at 越界）→ 退回显示 `condensed` 结构简式文本
- 步骤不连续（step[i].to ≠ step[i+1].from）→ 校验脚本报错（见测试）

## 8. 测试策略

C09 是单体 HTML，无现成单测框架。采用三层：
1. **数据完整性校验脚本**（`scripts/` 下新增 .mjs，CI 可跑）：
   - 每条 route 的 from/to 分子 id 均存在于 MOLECULES
   - 每条 route 步骤连续（step[i].to === step[i+1].from）
   - 每个 MOLECULES 项调用 renderSkeleton 不抛错、返回非空 SVG
   - 每个 skeleton 的 subs.at / bonds 顶点索引在范围内
   - 为可被脚本 import，MOLECULES / ROUTES / renderSkeleton 在源 HTML 中以可提取的方式组织（或同源数据另存一份供校验）
2. **渲染冒烟**：生成一页"全部分子键线式"对照图，人工目检结构正确（双键平行、取代基位置、环）
3. **构建 + 自包含校验**：`scripts/build-c07-c09-pages.mjs` 重新拆分，`scripts/validate-output.ts` 确认 C-09 产物自包含

## 9. 集成与构建

- 新标签页内容、MOLECULES / ROUTES 数据、renderSkeleton 渲染器，全部写入 `c07_c09_chemistry_tool.html` 的 **C09 部分**（C07 不动）。
- 经 `scripts/build-c07-c09-pages.mjs` 拆分为 `dist/C-09-organic-pathways.html`。
- 数据 / 渲染器 / 视图作为清晰分节组织，避免与 C07 逻辑交叉。

## 10. 视觉风格决策（已确认）

- 分子：**键线式 + 中文名 + 结构简式**常显
- 双键：主键方向 + 垂直偏移的**平行**画法，两端内缩
- 卤素红 `#B91C1C`；流程主色沿用 C09 绿（`#15803D` / `#00A85A`）；学段 chip 黄（必修）
- 苯环默认正六边形 + 内圈圆
