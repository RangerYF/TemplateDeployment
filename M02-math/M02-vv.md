
  文档结构概览：

  - 版本目标 + 约束锁定 — 独立仓库、主色、技术栈
  - 架构关键决策（6条） — Editor架构、Viewport Y轴翻转、断点算法、数学纠偏等
  - 完整目录结构 — src/ 下所有文件的位置
  - 阶段1–8 详细规范 — 每阶段含任务清单、接口定义、UI结构图、验收标准
  - 全局验收标准 — TypeScript/ESLint/60fps/断点/零点精度/b负数/隐私检查
  - 依赖清单 + 执行说明

  计划已完整，等待您的确认。如需调整任何部分，请指出；确认后可下达执行指令开始 Phase 1。

✻ Cogitated for 1m 2s

❯ 我只看到了概览
  ⎿  Interrupted · What should Claude do instead?

❯ 把完整的内容打印到我们的对话框里，我只看到了概览

● [MODE: MODE 1 - 研究模式]

  Sir (v0.2-m02)，以下是完整内容，直接输出到对话框：

  ---
  M-02 函数图形实验室 — 渐进式开发计划（v2）

  任务ID: v0.2-m02
  风险等级: L2（高风险：独立新仓库，涉及 Editor 架构 + 数学引擎 + Canvas 渲染）
  流程路径: MODE 0 → MODE 1 → MODE 3 → MODE 4 → MODE 5 → MODE 6
  状态: 计划 v2 已生成，待用户确认

  ---
  版本目标

  独立仓库 m02-function-lab，实现专业级 2D 函数图形实验室：
  - 自由函数表达式输入（math.js 解析）
  - 双层 Canvas 高性能绘图（StaticLayer + DynamicLayer）
  - 参数化变换（a·f(b(x-h))+k，b 支持负数）
  - 特征点自动标注（零点、极值、拐点，数学精度对齐人教版）
  - 导数图像 + 切线实时联动
  - 分段函数动态编辑
  - 全量 Undo/Redo（Editor Command 模式）

  约束锁定：
  - 主色：COLORS.primary = '#32D583'（严禁硬编码个人信息）
  - 绘图引擎：原生双层 Canvas 2D
  - 数学引擎：math.js
  - 状态管理：Zustand
  - 架构主体：src/editor/（Editor.ts 总控）

  ---
  架构关键决策（v2 修订）

  决策1：独立仓库策略

  M-02 为独立仓库，不再作为 M-01 的子模块。复用 M-01 的设计令牌思路（COLORS、PanelSection）但重新实现，无代码级依赖。

  决策2：Editor 架构主体（v2 新增）

  src/editor/ 为整个实验室的架构核心，三层分工：

  src/editor/
  ├── core/
  │   └── Editor.ts          ← 总控：持有 Viewport 实例、HistoryStack、激活 Tool
  ├── commands/
  │   ├── types.ts            ← Command 接口（execute/undo/redo）
  │   ├── UpdateFunctionParamCommand.ts
  │   ├── AddFunctionCommand.ts
  │   └── RemoveFunctionCommand.ts
  └── tools/
      ├── types.ts            ← Tool 接口（onActivate/onPointerDown/Move/Up）
      ├── PanZoomTool.ts      ← 画布平移 + 滚轮缩放
      └── TraceTool.ts        ← 沿曲线追踪切点

  决策3：Viewport Y 轴翻转

  数学坐标系 Y 轴向上，Canvas 像素坐标 Y 轴向下，必须在 Viewport.ts 中统一处理，公式：

  canvasX = (mathX - xMin) / (xMax - xMin) * width
  canvasY = height - (mathY - yMin) / (yMax - yMin) * height   ← Y 轴翻转

  决策4：不连续点过滤算法（v2 新增）

  sampler.ts 负责高频采样 + 断点检测，专门处理 y=1/x、tan(x) 等函数：
  - 策略：相邻点 |Δy| > viewport.yRange * 2 → 视为断点，moveTo 代替 lineTo
  - 附加：相邻点异号且任一 |y| > viewport.yRange → 异步断点（渐近线穿越）

  决策5：数学纠偏（v2 修订）

  - sin(x) 在 [-2π, 2π] 的零点为 5 个：-2π, -π, 0, π, 2π
  - 变换参数 b 范围：-5 ~ 5（排除 0），支持关于 Y 轴对称变换

  决策6：颜色令牌

  主色 #32D583，严禁在任何 .ts/.tsx、注释、package.json、文档中出现个人邮箱、姓名或隐私信息。

  ---
  完整目录结构

  src/
  ├── editor/
  │   ├── core/
  │   │   └── Editor.ts
  │   ├── commands/
  │   │   ├── types.ts
  │   │   ├── AddFunctionCommand.ts
  │   │   ├── RemoveFunctionCommand.ts
  │   │   └── UpdateFunctionParamCommand.ts
  │   ├── tools/
  │   │   ├── types.ts
  │   │   ├── PanZoomTool.ts
  │   │   └── TraceTool.ts
  │   └── store/
  │       ├── functionStore.ts
  │       └── historyStore.ts
  │
  ├── engine/
  │   ├── expressionEngine.ts
  │   ├── sampler.ts
  │   ├── featurePoints.ts
  │   └── piecewiseEvaluator.ts
  │
  ├── canvas/
  │   ├── Viewport.ts
  │   └── renderers/
  │       ├── axisRenderer.ts
  │       ├── curveRenderer.ts
  │       ├── tangentRenderer.ts
  │       └── featurePointRenderer.ts
  │
  ├── components/
  │   ├── FunctionCanvas.tsx
  │   ├── layout/
  │   │   └── M02Layout.tsx
  │   └── panels/
  │       ├── FunctionListPanel.tsx
  │       ├── FunctionInputPanel.tsx
  │       ├── ViewportPanel.tsx
  │       ├── TransformPanel.tsx
  │       ├── DerivativePanel.tsx
  │       └── PiecewisePanel.tsx
  │
  ├── styles/
  │   └── colors.ts
  │
  ├── types.ts
  ├── App.tsx
  └── main.tsx

  ---
  开发阶段拆分（串行执行）

  [x] 阶段1: 底座搭建（Editor骨架 + Viewport + 双层Canvas + 基础布局）✅ 2026-03-12
    → 阶段2: 数学核心与采样（math.js封装 + 断点算法 + 特征点扫描）
      → 阶段3: 基础渲染（坐标轴/网格 + 曲线渲染 + 视口交互）
        → 阶段4: 函数管理与变换（多函数列表 + a/b/h/k滑块 + Undo/Redo）
          → 阶段5: 特征点标注（零点/极值/拐点 + Canvas标注）
            → 阶段6: 导数与切线联动（f'曲线 + TraceTool + 实时切线）
              → 阶段7: 分段函数（数据结构 + 区间编辑器 + 端点渲染）
                → 阶段8: 动画系统（RAF插值 + 变换演示动画）

  ---
  各阶段详细规范

  ---
  阶段1：底座搭建

  目标：搭建完整工程骨架。完成后可通过 Tab 切换看到空白的双层 Canvas 区域和右侧面板框架；Editor.ts 实例可在控制台访问；Viewport 坐标变换数值正确。

  涉及文件（全部新建）：
  src/styles/colors.ts
  src/types.ts
  src/canvas/Viewport.ts
  src/editor/core/Editor.ts
  src/editor/commands/types.ts
  src/editor/tools/types.ts
  src/editor/store/historyStore.ts
  src/editor/store/functionStore.ts
  src/components/FunctionCanvas.tsx
  src/components/layout/M02Layout.tsx
  src/App.tsx
  src/main.tsx

  T1.1 设计令牌

  文件：src/styles/colors.ts
  export const COLORS = {
    primary:        '#32D583',
    primaryHover:   '#28B86D',
    dark:           '#1A1A1E',
    neutral:        '#6B6B70',
    border:         '#2A2A2E',
    surface:        '#141417',
    surfaceAlt:     '#1E1E22',
    white:          '#FFFFFF',
    textPrimary:    '#F0F0F0',
    textSecondary:  '#9CA3AF',
    error:          '#EF4444',
    warning:        '#F59E0B',
  } as const;

  export type ColorKey = keyof typeof COLORS;
  约束：文件内不得出现任何个人信息

  T1.2 核心类型定义

  文件：src/types.ts
  // 变换参数：a·f(b(x-h))+k
  export interface Transform {
    a: number;   // 纵向缩放（0.1 ~ 5）
    b: number;   // 横向缩放（-5 ~ 5，排除 0）
    h: number;   // 水平平移（-20 ~ 20）
    k: number;   // 垂直平移（-20 ~ 20）
  }

  export const DEFAULT_TRANSFORM: Transform = { a: 1, b: 1, h: 0, k: 0 };

  export interface ViewportState {
    xMin: number; xMax: number;
    yMin: number; yMax: number;
  }

  export const DEFAULT_VIEWPORT: ViewportState = {
    xMin: -10, xMax: 10, yMin: -6, yMax: 6,
  };

  export interface FunctionEntry {
    id: string;
    label: string;
    mode: 'standard' | 'piecewise';
    exprStr: string;
    segments: PiecewiseSegment[];
    color: string;
    visible: boolean;
    transform: Transform;
  }

  export interface PiecewiseSegment {
    id: string;
    exprStr: string;
    domain: {
      xMin: number | null;   // null = -∞
      xMax: number | null;   // null = +∞
      xMinInclusive: boolean;
      xMaxInclusive: boolean;
    };
  }

  export const FUNCTION_COLORS: readonly string[] = [
    '#32D583', '#60A5FA', '#F472B6',
    '#FBBF24', '#A78BFA', '#34D399',
  ];

  T1.3 Viewport 类（Y 轴翻转核心）

  文件：src/canvas/Viewport.ts
  export class Viewport {
    readonly xMin: number;
    readonly xMax: number;
    readonly yMin: number;
    readonly yMax: number;
    readonly width: number;
    readonly height: number;

    constructor(
      xMin: number, xMax: number,
      yMin: number, yMax: number,
      width: number, height: number,
    ) {
      this.xMin = xMin; this.xMax = xMax;
      this.yMin = yMin; this.yMax = yMax;
      this.width = width; this.height = height;
    }

    get xRange(): number { return this.xMax - this.xMin; }
    get yRange(): number { return this.yMax - this.yMin; }

    // 数学坐标 → Canvas 像素（Y 轴翻转）
    toCanvas(mathX: number, mathY: number): [number, number] {
      const cx = (mathX - this.xMin) / this.xRange * this.width;
      const cy = this.height - (mathY - this.yMin) / this.yRange * this.height;
      return [cx, cy];
    }

    // Canvas 像素 → 数学坐标（Y 轴翻转逆变换）
    toMath(canvasX: number, canvasY: number): [number, number] {
      const mx = canvasX / this.width * this.xRange + this.xMin;
      const my = (this.height - canvasY) / this.height * this.yRange + this.yMin;
      return [mx, my];
    }

    withSize(width: number, height: number): Viewport {
      return new Viewport(this.xMin, this.xMax, this.yMin, this.yMax, width, height);
    }

    withRange(xMin: number, xMax: number, yMin: number, yMax: number): Viewport {
      return new Viewport(xMin, xMax, yMin, yMax, this.width, this.height);
    }

    zoomAt(mathX: number, mathY: number, factor: number): Viewport {
      const newXRange = this.xRange * factor;
      const newYRange = this.yRange * factor;
      const xRatio = (mathX - this.xMin) / this.xRange;
      const yRatio = (mathY - this.yMin) / this.yRange;
      return new Viewport(
        mathX - xRatio * newXRange,
        mathX + (1 - xRatio) * newXRange,
        mathY - yRatio * newYRange,
        mathY + (1 - yRatio) * newYRange,
        this.width, this.height,
      );
    }

    pan(dMathX: number, dMathY: number): Viewport {
      return new Viewport(
        this.xMin - dMathX, this.xMax - dMathX,
        this.yMin - dMathY, this.yMax - dMathY,
        this.width, this.height,
      );
    }

    clone(): Viewport {
      return new Viewport(
        this.xMin, this.xMax, this.yMin, this.yMax,
        this.width, this.height,
      );
    }
  }

  T1.4 Command 接口

  文件：src/editor/commands/types.ts
  export interface Command {
    readonly type: string;
    readonly label: string;
    execute(): void;
    undo(): void;
  }

  T1.5 Tool 接口

  文件：src/editor/tools/types.ts
  import type { Viewport } from '@/canvas/Viewport';

  export interface ToolEvent {
    canvasX: number;
    canvasY: number;
    mathX: number;
    mathY: number;
    nativeEvent: MouseEvent | WheelEvent;
  }

  export interface Tool {
    readonly id: string;
    onActivate?(editor: Editor): void;
    onDeactivate?(): void;
    onPointerDown?(event: ToolEvent): void;
    onPointerMove?(event: ToolEvent): void;
    onPointerUp?(event: ToolEvent): void;
    onWheel?(event: ToolEvent & { deltaY: number }): void;
  }

  T1.6 HistoryStore

  文件：src/editor/store/historyStore.ts
  - 实现：Zustand store，持有 undoStack: Command[] 和 redoStack: Command[]
  - Actions：execute(cmd), undo(), redo()，最大栈深度 50
  - 发射 Signal 或直接更新 canUndo / canRedo 派生状态

  T1.7 FunctionStore

  文件：src/editor/store/functionStore.ts
  // 初始状态：
  {
    functions: [] as FunctionEntry[],
    activeFunctionId: null as string | null,
    viewport: DEFAULT_VIEWPORT,
    features: {
      showDerivative: false,
      showTangent: false,
      tangentX: 0,
      showFeaturePoints: false,
      showGrid: true,
    },
  }
  // Actions：addFunction, removeFunction, updateFunction,
  //          setViewport, setActiveFunctionId, setFeature

  T1.8 Editor 核心控制器

  文件：src/editor/core/Editor.ts
  export class Editor {
    private viewport: Viewport;
    private activeTool: Tool | null = null;

    constructor(initialViewport: Viewport) {
      this.viewport = initialViewport;
    }

    getViewport(): Viewport { return this.viewport; }

    setViewport(vp: Viewport): void {
      this.viewport = vp;
      useFunctionStore.getState().setViewport({
        xMin: vp.xMin, xMax: vp.xMax,
        yMin: vp.yMin, yMax: vp.yMax,
      });
    }

    activateTool(tool: Tool): void {
      this.activeTool?.onDeactivate?.();
      this.activeTool = tool;
      tool.onActivate?.(this);
    }

    dispatchPointerDown(event: ToolEvent): void { this.activeTool?.onPointerDown?.(event); }
    dispatchPointerMove(event: ToolEvent): void { this.activeTool?.onPointerMove?.(event); }
    dispatchPointerUp(event: ToolEvent): void   { this.activeTool?.onPointerUp?.(event); }
    dispatchWheel(event: ToolEvent & { deltaY: number }): void { this.activeTool?.onWheel?.(event); }

    execute(command: Command): void {
      command.execute();
      useHistoryStore.getState().execute(command);
    }
  }

  export let editorInstance: Editor | null = null;
  export function initEditor(vp: Viewport): Editor {
    editorInstance = new Editor(vp);
    return editorInstance;
  }

  T1.9 PanZoomTool 骨架

  文件：src/editor/tools/PanZoomTool.ts（本阶段只建骨架，逻辑阶段3补全）
  export class PanZoomTool implements Tool {
    readonly id = 'pan-zoom';
    private isDragging = false;
    private lastMathX = 0;
    private lastMathY = 0;
    private editor: Editor | null = null;

    onActivate(editor: Editor): void { this.editor = editor; }

    onPointerDown(e: ToolEvent): void {
      this.isDragging = true;
      this.lastMathX = e.mathX;
      this.lastMathY = e.mathY;
    }

    onPointerMove(e: ToolEvent): void {
      if (!this.isDragging || !this.editor) return;
      const dX = e.mathX - this.lastMathX;
      const dY = e.mathY - this.lastMathY;
      this.editor.setViewport(this.editor.getViewport().pan(dX, dY));
      // 阶段3补全 lastMath 更新
    }

    onPointerUp(_e: ToolEvent): void { this.isDragging = false; }

    onWheel(e: ToolEvent & { deltaY: number }): void {
      if (!this.editor) return;
      const factor = e.deltaY > 0 ? 1.1 : 1 / 1.1;
      this.editor.setViewport(
        this.editor.getViewport().zoomAt(e.mathX, e.mathY, factor)
      );
    }
  }

  T1.10 FunctionCanvas 双层容器（骨架）

  文件：src/components/FunctionCanvas.tsx
  export function FunctionCanvas() {
    const staticRef = useRef<HTMLCanvasElement>(null);
    const dynamicRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<Editor | null>(null);

    useEffect(() => {
      editorRef.current = initEditor(new Viewport(-10, 10, -6, 6, 800, 600));
      editorRef.current.activateTool(new PanZoomTool());
    }, []);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      const ro = new ResizeObserver(entries => {
        const { width, height } = entries[0].contentRect;
        [staticRef, dynamicRef].forEach(ref => {
          if (ref.current) {
            ref.current.width = width;
            ref.current.height = height;
          }
        });
        editorRef.current?.setViewport(
          editorRef.current.getViewport().withSize(width, height)
        );
      });
      ro.observe(container);
      return () => ro.disconnect();
    }, []);

    return (
      <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
        {/* 底层：坐标轴 + 曲线（低频重绘）*/}
        <canvas ref={staticRef} style={{ position: 'absolute', top: 0, left: 0 }} />
        {/* 顶层：切线 + 特征点高亮（高频重绘）*/}
        <canvas ref={dynamicRef} style={{ position: 'absolute', top: 0, left: 0 }} />
      </div>
    );
  }

  T1.11 M02Layout + App.tsx

  布局结构：
  ┌────────────────────────────────────────────┐
  │  TopBar（标题 "函数图形实验室" + Undo/Redo）│
  ├──────────────────────────┬─────────────────┤
  │                          │                 │
  │   FunctionCanvas         │   右侧面板      │
  │   (flex: 1, 主渲染区)    │   (280px)       │
  │                          │                 │
  └──────────────────────────┴─────────────────┘
  TopBar 中的 Undo/Redo 按钮直接订阅 useHistoryStore 的 canUndo / canRedo

  阶段1 验收标准：
  - pnpm tsc --noEmit 零错误
  - pnpm lint 零 error
  - 页面加载后显示双层 Canvas 区域和右侧面板框架
  - 浏览器 resize 时两层 Canvas 尺寸同步更新
  - 控制台可访问 editorInstance，返回正确初始范围
  - 手动验证 toCanvas(0, 0) 返回 Canvas 中心点（误差 < 1px）
  - 手动验证：toMath(toCanvas(3, -2)[0], toCanvas(3, -2)[1]) 还原为 [3, -2]（误差 < 1e-10）

  ---
  阶段2：数学核心与采样

  目标：完成 math.js 封装层 + 高频采样算法（含断点检测），能够在控制台正确输出 sin(x)、1/x、tan(x) 等函数的采样点集合，断点处无错误连线。

  涉及文件（全部新建）：
  src/engine/expressionEngine.ts
  src/engine/sampler.ts
  src/engine/featurePoints.ts
  src/engine/piecewiseEvaluator.ts

  T2.1 表达式引擎

  文件：src/engine/expressionEngine.ts
  import * as math from 'mathjs';

  export type CompiledExpression = {
    readonly exprStr: string;
    readonly node: math.MathNode;
    readonly compiled: ReturnType<math.MathNode['compile']>;
  };

  export type ParseError = { readonly error: string };

  export function isParseError(v: CompiledExpression | ParseError): v is ParseError {
    return 'error' in v;
  }

  // LRU 缓存（上限 50 条）
  const cache = new Map<string, CompiledExpression>();

  export function compileExpression(exprStr: string): CompiledExpression | ParseError {
    const trimmed = exprStr.trim();
    if (!trimmed) return { error: '表达式不能为空' };
    if (cache.has(trimmed)) return cache.get(trimmed)!;

    try {
      const node = math.parse(trimmed);
      const compiled = node.compile();
      const result: CompiledExpression = { exprStr: trimmed, node, compiled };
      if (cache.size >= 50) cache.delete(cache.keys().next().value);
      cache.set(trimmed, result);
      return result;
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  // 单点求值（返回 number | NaN）
  export function evaluateAt(expr: CompiledExpression, x: number): number {
    try {
      const y = expr.compiled.evaluate({ x }) as number;
      return typeof y === 'number' ? y : NaN;
    } catch {
      return NaN;
    }
  }

  // 符号导数字符串（用于面板展示）
  export function symbolicDerivativeStr(expr: CompiledExpression): string | null {
    try {
      const derived = math.derivative(expr.node, 'x');
      return derived.toString();
    } catch {
      return null;
    }
  }

  // 编译导函数
  export function compileDerivative(expr: CompiledExpression): CompiledExpression | ParseError {
    try {
      const derivedNode = math.derivative(expr.node, 'x');
      return compileExpression(derivedNode.toString());
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  // 数值导数（中心差分，h = 1e-7）
  export function numericalDerivative(expr: CompiledExpression, x: number): number {
    const h = 1e-7;
    const yPlus = evaluateAt(expr, x + h);
    const yMinus = evaluateAt(expr, x - h);
    if (!isFinite(yPlus) || !isFinite(yMinus)) return NaN;
    return (yPlus - yMinus) / (2 * h);
  }

  T2.2 采样器（核心：断点检测算法）

  文件：src/engine/sampler.ts
  export interface SamplePoint {
    x: number;
    y: number;
    isValid: boolean;    // false = NaN 或 Infinity 或超出绘制范围
    isBreak: boolean;    // true = 此点与前一点之间存在断点（绘制时 moveTo）
  }

  const BREAK_THRESHOLD = 2.5;
  const CLIP_FACTOR = 10;

  export function sample(
    expr: CompiledExpression,
    viewport: Viewport,
    steps: number = 800,
  ): SamplePoint[] {
    const { xMin, xMax, yMin, yMax, yRange } = viewport;
    const dx = (xMax - xMin) / steps;
    const clipMax = yMin - yRange * CLIP_FACTOR;
    const clipMin = yMax + yRange * CLIP_FACTOR;
    const breakThreshold = yRange * BREAK_THRESHOLD;

    const points: SamplePoint[] = [];
    let prevValidY: number | null = null;

    for (let i = 0; i <= steps; i++) {
      const x = xMin + i * dx;
      const rawY = evaluateAt(expr, x);
      const isValid = isFinite(rawY) && rawY > clipMax && rawY < clipMin;

      if (!isValid) {
        points.push({ x, y: rawY, isValid: false, isBreak: false });
        prevValidY = null;
        continue;
      }

      let isBreak = false;
      if (prevValidY !== null) {
        const deltaY = Math.abs(rawY - prevValidY);

        // 条件1：绝对跳跃超过阈值
        if (deltaY > breakThreshold) isBreak = true;

        // 条件2：符号相反且任一点绝对值很大（渐近线穿越特征）
        if (
          !isBreak &&
          Math.sign(rawY) !== Math.sign(prevValidY) &&
          (Math.abs(rawY) > yRange * 1.5 || Math.abs(prevValidY) > yRange * 1.5)
        ) {
          isBreak = true;
        }
      }

      points.push({ x, y: rawY, isValid: true, isBreak });
      prevValidY = isBreak ? null : rawY;
    }

    return points;
  }

  // 带变换的采样：a·f(b(x-h))+k
  export function sampleWithTransform(
    expr: CompiledExpression,
    viewport: Viewport,
    transform: { a: number; b: number; h: number; k: number },
    steps: number = 800,
  ): SamplePoint[] {
    const { a, b, h, k } = transform;
    const { xMin, xMax, yMin, yMax, yRange } = viewport;
    const dx = (xMax - xMin) / steps;
    const clipMax = yMin - yRange * CLIP_FACTOR;
    const clipMin = yMax + yRange * CLIP_FACTOR;
    const breakThreshold = yRange * BREAK_THRESHOLD;

    const points: SamplePoint[] = [];
    let prevValidY: number | null = null;

    for (let i = 0; i <= steps; i++) {
      const x = xMin + i * dx;
      const xPrime = b * (x - h);
      const rawFx = evaluateAt(expr, xPrime);
      const rawY = isFinite(rawFx) ? a * rawFx + k : rawFx;

      const isValid = isFinite(rawY) && rawY > clipMax && rawY < clipMin;

      if (!isValid) {
        points.push({ x, y: rawY, isValid: false, isBreak: false });
        prevValidY = null;
        continue;
      }

      let isBreak = false;
      if (prevValidY !== null) {
        const deltaY = Math.abs(rawY - prevValidY);
        if (deltaY > breakThreshold) isBreak = true;
        if (
          !isBreak &&
          Math.sign(rawY) !== Math.sign(prevValidY) &&
          (Math.abs(rawY) > yRange * 1.5 || Math.abs(prevValidY) > yRange * 1.5)
        ) {
          isBreak = true;
        }
      }

      points.push({ x, y: rawY, isValid: true, isBreak });
      prevValidY = isBreak ? null : rawY;
    }

    return points;
  }

  T2.3 特征点扫描器（人教版数学精度）

  文件：src/engine/featurePoints.ts
  export type FeaturePointType = 'zero' | 'localMax' | 'localMin' | 'inflection';

  export interface FeaturePoint {
    x: number;
    y: number;
    type: FeaturePointType;
  }

  const BISECTION_ITERATIONS = 20;   // 精度 ~1e-6
  const SCAN_STEPS = 1000;

  function bisect(f: (x: number) => number, a: number, b: number): number {
    let lo = a, hi = b;
    for (let i = 0; i < BISECTION_ITERATIONS; i++) {
      const mid = (lo + hi) / 2;
      if (f(lo) * f(mid) <= 0) hi = mid; else lo = mid;
    }
    return (lo + hi) / 2;
  }

  // 零点扫描
  // sin(x) 在 [-2π, 2π] → 5 个零点：-2π, -π, 0, π, 2π
  export function findZeros(expr, xMin, xMax, steps = SCAN_STEPS): FeaturePoint[] {
    const results: FeaturePoint[] = [];
    const dx = (xMax - xMin) / steps;
    const f = (x: number) => evaluateAt(expr, x);
    let prev = f(xMin);

    for (let i = 1; i <= steps; i++) {
      const x = xMin + i * dx;
      const curr = f(x);
      if (!isFinite(prev) || !isFinite(curr)) { prev = curr; continue; }

      if (prev * curr < 0) {
        const xZero = bisect(f, x - dx, x);
        const yZero = f(xZero);
        if (isFinite(yZero) && Math.abs(yZero) < 1e-6)
          results.push({ x: xZero, y: 0, type: 'zero' });
      }
      if (Math.abs(curr) < 1e-9 && Math.abs(prev) > 1e-9) {
        if (!results.some(p => Math.abs(p.x - x) < dx * 2))
          results.push({ x, y: 0, type: 'zero' });
      }
      prev = curr;
    }
    return results;
  }

  // 极值扫描：f'(x) 符号变化
  export function findExtrema(expr, xMin, xMax, steps = SCAN_STEPS): FeaturePoint[] {
    const results: FeaturePoint[] = [];
    const dx = (xMax - xMin) / steps;
    const df = (x: number) => numericalDerivative(expr, x);
    let prevD = df(xMin);

    for (let i = 1; i <= steps; i++) {
      const x = xMin + i * dx;
      const currD = df(x);
      if (!isFinite(prevD) || !isFinite(currD)) { prevD = currD; continue; }

      if (prevD * currD < 0) {
        const xExt = bisect(df, x - dx, x);
        const y = evaluateAt(expr, xExt);
        if (!isFinite(y)) { prevD = currD; continue; }
        const type: FeaturePointType = prevD > 0 ? 'localMax' : 'localMin';
        results.push({ x: xExt, y, type });
      }
      prevD = currD;
    }
    return results;
  }

  // 拐点扫描：f''(x) 符号变化
  export function findInflections(expr, xMin, xMax, steps = SCAN_STEPS): FeaturePoint[] {
    const results: FeaturePoint[] = [];
    const dx = (xMax - xMin) / steps;
    const h = 1e-5;
    const d2f = (x: number): number => {
      const yp = numericalDerivative(expr, x + h);
      const ym = numericalDerivative(expr, x - h);
      if (!isFinite(yp) || !isFinite(ym)) return NaN;
      return (yp - ym) / (2 * h);
    };
    let prevD2 = d2f(xMin);

    for (let i = 1; i <= steps; i++) {
      const x = xMin + i * dx;
      const currD2 = d2f(x);
      if (!isFinite(prevD2) || !isFinite(currD2)) { prevD2 = currD2; continue; }

      if (prevD2 * currD2 < 0) {
        const xInfl = bisect(d2f, x - dx, x);
        const y = evaluateAt(expr, xInfl);
        if (isFinite(y)) results.push({ x: xInfl, y, type: 'inflection' });
      }
      prevD2 = currD2;
    }
    return results;
  }

  // 统一入口
  export function scanFeaturePoints(expr, xMin, xMax): FeaturePoint[] {
    return [
      ...findZeros(expr, xMin, xMax),
      ...findExtrema(expr, xMin, xMax),
      ...findInflections(expr, xMin, xMax),
    ];
  }

  T2.4 分段函数求值器

  文件：src/engine/piecewiseEvaluator.ts
  function inDomain(seg: PiecewiseSegment, x: number): boolean {
    const { xMin, xMax, xMinInclusive, xMaxInclusive } = seg.domain;
    const leftOk  = xMin === null ? true : xMinInclusive ? x >= xMin : x > xMin;
    const rightOk = xMax === null ? true : xMaxInclusive ? x <= xMax : x < xMax;
    return leftOk && rightOk;
  }

  export function evaluatePiecewise(segments: PiecewiseSegment[], x: number): number | null {
    for (const seg of segments) {
      if (!inDomain(seg, x)) continue;
      const compiled = compileExpression(seg.exprStr);
      if (isParseError(compiled)) continue;
      const y = evaluateAt(compiled, x);
      return isFinite(y) ? y : null;
    }
    return null;
  }

  export function evaluatePiecewiseRange(
    segments: PiecewiseSegment[],
    viewport: Viewport,
    steps = 800,
  ): Array<{ segment: PiecewiseSegment; points: [number, number][] }> {
    const { xMin, xMax } = viewport;
    const dx = (xMax - xMin) / steps;

    return segments.map(seg => {
      const compiled = compileExpression(seg.exprStr);
      const points: [number, number][] = [];
      if (isParseError(compiled)) return { segment: seg, points };

      for (let i = 0; i <= steps; i++) {
        const x = xMin + i * dx;
        if (!inDomain(seg, x)) continue;
        const y = evaluateAt(compiled, x);
        if (isFinite(y)) points.push([x, y]);
      }
      return { segment: seg, points };
    });
  }

  阶段2 验收标准：
  - pnpm tsc --noEmit 零错误 / pnpm lint 零 error
  - compileExpression('sin(x)') 返回 CompiledExpression
  - compileExpression('((') 返回 ParseError
  - y=1/x：x 跨越 0 附近的点对应 isBreak: true，无垂直连接线
  - tan(x)：x ≈ ±π/2 处存在 isBreak: true
  - sin(x) 在 [-2π, 2π]：findZeros 输出恰好 5 个零点，误差 < 1e-5
  - sin(x) 极大值 2 个（y≈1），极小值 2 个（y≈-1）
  - x^3 - x 拐点 1 个（x≈0，y≈0）
  - b=-1 时 sampleWithTransform 输出与 sin(-x)=-sin(x) 吻合

  ---
  阶段3：基础渲染 + 自由输入函数

  目标：Canvas 上出现可交互的坐标系；用户可自由输入表达式并实时看到函数曲线；鼠标拖拽平移、滚轮缩放完整可用；tan(x)、1/x
  等函数在断点处无异常连接线。

  涉及文件：
  src/canvas/renderers/axisRenderer.ts        ← 新建
  src/canvas/renderers/curveRenderer.ts       ← 新建
  src/editor/tools/PanZoomTool.ts             ← 补全
  src/components/FunctionCanvas.tsx           ← 扩展
  src/components/panels/FunctionListPanel.tsx ← 新建
  src/components/panels/FunctionInputPanel.tsx ← 新建
  src/components/layout/M02Layout.tsx         ← 扩展

  T3.1 坐标轴 + 网格渲染器

  文件：src/canvas/renderers/axisRenderer.ts

  export function renderAxis(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    options?: { showGrid?: boolean }
  ): void

  网格间距自适应算法：
  候选步长序列：0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100 ...
  目标：Canvas 上每格像素数在 [40px, 120px] 之间
  选取第一个满足条件的步长

  绘制内容：
  - 背景填充：#141417（COLORS.surface）
  - 网格线：虚线 [1, 3]，颜色 #2A2A2E，仅 showGrid=true 时绘制
  - X/Y 轴：实线，颜色 #555，线宽 1.5px
  - 刻度标签：12px monospace，颜色 #6B6B70
  - 原点标记：小实心圆，半径 3px，颜色 #555
  - 坐标轴箭头：轴末端三角形箭头

  T3.2 曲线渲染器

  文件：src/canvas/renderers/curveRenderer.ts

  export function renderCurve(
    ctx: CanvasRenderingContext2D,
    points: SamplePoint[],
    viewport: Viewport,
    color: string,
    options?: {
      lineWidth?: number;    // 默认 2
      lineDash?: number[];   // 默认实线 []
      alpha?: number;        // 默认 1
    }
  ): void

  核心绘制逻辑：
  beginPath()
  遍历 points：
    - isValid=false → 跳过（不 moveTo）
    - isValid=true, isBreak=true → moveTo（断点，不连线）
    - isValid=true, isBreak=false, 首个有效点 → moveTo
    - isValid=true, isBreak=false, 非首个 → lineTo
  stroke()

  T3.3 PanZoomTool 补全

  平移精度修正：
  onPointerMove(e: ToolEvent): void {
    if (!this.isDragging || !this.editor) return;
    const vp = this.editor.getViewport();
    const dMathX = (e.canvasX - this.lastCanvasX) / vp.width * vp.xRange;
    const dMathY = -(e.canvasY - this.lastCanvasY) / vp.height * vp.yRange; // Y 轴翻转
    this.editor.setViewport(vp.pan(dMathX, dMathY));
    this.lastCanvasX = e.canvasX;  // 每帧更新
    this.lastCanvasY = e.canvasY;
  }

  双击重置（阶段8动画接入前先直接跳变）：
  onDblClick(_e: ToolEvent): void {
    this.editor?.setViewport(new Viewport(-10, 10, -6, 6, vp.width, vp.height));
  }

  T3.4 FunctionCanvas 渲染调度补全

  StaticCanvas 渲染调度：
  useEffect(() => {
    const ctx = staticRef.current?.getContext('2d');
    if (!ctx || !viewport) return;
    const vp = new Viewport(viewport.xMin, viewport.xMax, viewport.yMin, viewport.yMax,
      staticRef.current!.width, staticRef.current!.height);

    ctx.clearRect(0, 0, vp.width, vp.height);
    renderAxis(ctx, vp, { showGrid: features.showGrid });

    for (const fn of functions) {
      if (!fn.visible) continue;
      const compiled = compileExpression(fn.exprStr);
      if (isParseError(compiled)) continue;
      const points = sampleWithTransform(compiled, vp, fn.transform);
      renderCurve(ctx, points, vp, fn.color);
    }
  }, [functions, viewport, features.showGrid, canvasSize]);

  T3.5 FunctionListPanel — 函数列表管理

  UI 结构：
  ┌─────────────────────────────────┐
  │  函数列表                    [+] │
  ├─────────────────────────────────┤
  │ ● f(x) = sin(x)          👁 🗑  │
  │ ○ g(x) = x^2             👁 🗑  │
  └─────────────────────────────────┘

  交互规则：
  - 点击函数行 → 设为 activeFunctionId
  - 点击 👁 → 切换 visible（不计入 Undo 历史）
  - 点击 🗑 → 触发 RemoveFunctionCommand
  - 点击 [+] → 触发 AddFunctionCommand（默认表达式 x）
  - 函数数量上限：8 条

  T3.6 FunctionInputPanel — 自由表达式输入

  UI 结构：
  ┌─────────────────────────────────┐
  │  f(x) =                         │
  │  ┌─────────────────────────┐    │
  │  │ sin(x)              ✓/✗ │    │
  │  └─────────────────────────┘    │
  │  ⚠ 解析错误：Unexpected token   │
  │                                  │
  │  sin cos tan sqrt abs log pi e   │
  └─────────────────────────────────┘

  核心交互逻辑：
  1. onChange：实时调用 compileExpression，成功→绿色✓实时更新Store（不写Command），失败→红色✗Canvas不更新
  2. onBlur/Enter：成功则触发 UpdateFunctionParamCommand（写入Undo历史），失败则恢复上次成功表达式
  3. 快捷符号按钮：插入光标位置，e.preventDefault() 阻止失焦

  阶段3 验收标准：
  - pnpm tsc --noEmit 零错误 / pnpm lint 零 error
  - 输入 sin(x) 后曲线立即绘制，波形正确
  - 输入 1/x 曲线在 x=0 两侧分开，无垂直连接线
  - 输入 tan(x) 曲线在 x≈±π/2 处分开，无垂直连接线
  - 输入不合法表达式时输入框变红，Canvas 不崩溃
  - 鼠标拖拽平移、滚轮缩放正常
  - 双击重置视口回 {-10,10,-6,6}
  - 添加多条函数，颜色独立，可删除且可 Undo

  ---
  阶段4：函数管理与参数变换

  目标：支持对每条函数独立调节变换参数 a/b/h/k（b 支持负数），滑块实时驱动 Canvas 重绘；所有参数变更可 Undo/Redo；ViewportPanel
  支持手动精确输入视口范围。

  涉及文件：
  src/editor/commands/AddFunctionCommand.ts
  src/editor/commands/RemoveFunctionCommand.ts
  src/editor/commands/UpdateFunctionParamCommand.ts
  src/components/panels/TransformPanel.tsx
  src/components/panels/ViewportPanel.tsx
  src/components/layout/M02Layout.tsx  ← 扩展

  T4.1 AddFunctionCommand

  export class AddFunctionCommand implements Command {
    readonly type = 'add-function';
    readonly label: string;
    private entry: FunctionEntry;

    constructor(entry: FunctionEntry) {
      this.entry = entry;
      this.label = `添加函数 ${entry.label}`;
    }

    execute(): void { useFunctionStore.getState().addFunction(this.entry); }
    undo(): void    { useFunctionStore.getState().removeFunction(this.entry.id); }
  }

  T4.2 RemoveFunctionCommand

  export class RemoveFunctionCommand implements Command {
    readonly type = 'remove-function';
    readonly label: string;
    private entry: FunctionEntry;

    constructor(entry: FunctionEntry) {
      this.entry = { ...entry };  // 深拷贝快照
      this.label = `删除函数 ${entry.label}`;
    }

    execute(): void { useFunctionStore.getState().removeFunction(this.entry.id); }
    undo(): void    { useFunctionStore.getState().addFunction(this.entry); }
  }

  T4.3 UpdateFunctionParamCommand

  type FunctionPatch = Partial<Pick<FunctionEntry, 'exprStr' | 'transform' | 'color' | 'label'>>;

  export class UpdateFunctionParamCommand implements Command {
    readonly type = 'update-function-param';
    readonly label = '修改函数参数';
    private id: string;
    private before: FunctionPatch;
    private after: FunctionPatch;

    constructor(id: string, before: FunctionPatch, after: FunctionPatch) {
      this.id = id;
      this.before = { ...before };
      this.after = { ...after };
    }

    execute(): void { useFunctionStore.getState().updateFunction(this.id, this.after); }
    undo(): void    { useFunctionStore.getState().updateFunction(this.id, this.before); }
  }

  滑块拖拽 Command 粒度控制：
  - onDrag（拖拽中）→ 直接调用 updateFunction，不写 Command（实时预览）
  - onDragEnd（松开）→ 触发 UpdateFunctionParamCommand（before=拖拽开始值，after=最终值）

  T4.4 TransformPanel — a/b/h/k 参数滑块

  UI 结构：
  ┌─────────────────────────────────┐
  │  变换参数                        │
  │  f(x) = a · f(b(x-h)) + k      │
  │                                  │
  │  a  纵向缩放  [━━━●━━━━]  2.0   │
  │  b  横向缩放  [━●━━━━━━]  -1.0  │
  │  h  水平平移  [━━━━●━━━] +3.0   │
  │  k  垂直平移  [━━●━━━━━] -1.5   │
  │                                  │
  │       [重置变换]                  │
  └─────────────────────────────────┘

  各参数规格：

  ┌──────┬──────────┬──────────────────┬──────┬──────┐
  │ 参数 │   含义   │       范围       │ 步长 │ 默认 │
  ├──────┼──────────┼──────────────────┼──────┼──────┤
  │ a    │ 纵向缩放 │ -5 ~ 5（排除 0） │ 0.1  │ 1    │
  ├──────┼──────────┼──────────────────┼──────┼──────┤
  │ b    │ 横向缩放 │ -5 ~ 5（排除 0） │ 0.1  │ 1    │
  ├──────┼──────────┼──────────────────┼──────┼──────┤
  │ h    │ 水平平移 │ -20 ~ 20         │ 0.1  │ 0    │
  ├──────┼──────────┼──────────────────┼──────┼──────┤
  │ k    │ 垂直平移 │ -20 ~ 20         │ 0.1  │ 0    │
  └──────┴──────────┴──────────────────┴──────┴──────┘

  - b=-1：关于 Y 轴对称（f(-x)）
  - a、b 经过 0 时自动跳到 ±0.1
  - "重置变换"按钮触发 UpdateFunctionParamCommand，可 Undo

  T4.5 ViewportPanel — 视口精确控制

  UI 结构：
  ┌─────────────────────────────────┐
  │  视口范围                        │
  │  x: [ -10.0 ] ~ [  10.0 ]      │
  │  y: [  -6.0 ] ~ [   6.0 ]      │
  │                                  │
  │       [重置视口]                  │
  └─────────────────────────────────┘

  提交时校验 xMin < xMax，yMin < yMax，否则显示错误提示；视口变更不计入 Undo 历史。

  T4.6 M02Layout 右侧面板布局

  ┌──────────────────┐
  │  函数列表         │  ← 始终显示
  ├──────────────────┤
  │  表达式输入       │  ← activeFunctionId 不为 null 时显示
  ├──────────────────┤
  │  变换参数         │  ← activeFunctionId 不为 null 且 mode=standard
  ├──────────────────┤
  │  视口范围         │  ← 始终显示，默认折叠
  └──────────────────┘

  阶段4 验收标准：
  - pnpm tsc --noEmit 零错误 / pnpm lint 零 error
  - 拖动 h 滑块，sin(x) 曲线实时水平移动，松开后可 Undo
  - 设置 b=-1，sin(x) 变为 -sin(x)
  - 设置 b=2，sin(x) 横向压缩为 sin(2x)，周期变为 π
  - a、b 滑块经过 0 时自动跳过
  - "重置变换"可 Undo
  - 添加/删除函数全部可 Undo/Redo
  - ViewportPanel 输入非法范围时显示错误提示，视口不变

  ---
  阶段5：特征点自动标注

  目标：开关打开后，在函数曲线上自动识别并标注零点（○）、极大值（▲）、极小值（▽）、拐点（◆），坐标文本清晰不遮挡，人教版数学精度。

  涉及文件：
  src/canvas/renderers/featurePointRenderer.ts  ← 新建
  src/components/panels/DerivativePanel.tsx     ← 新建骨架
  src/components/FunctionCanvas.tsx             ← 扩展
  src/editor/store/functionStore.ts             ← 扩展（特征点缓存）

  T5.1 特征点渲染器

  export function renderFeaturePoints(
    ctx: CanvasRenderingContext2D,
    points: FeaturePoint[],
    viewport: Viewport,
    options?: { showCoords?: boolean }
  ): void

  各类型渲染规格：

  ┌────────────┬──────┬──────────────────┬────────────────────┬─────────────────┐
  │    类型    │ 符号 │       形状       │        尺寸        │      颜色       │
  ├────────────┼──────┼──────────────────┼────────────────────┼─────────────────┤
  │ zero       │ ○    │ 空心圆，白色填充 │ 半径 5px，描边 2px │ #32D583         │
  ├────────────┼──────┼──────────────────┼────────────────────┼─────────────────┤
  │ localMax   │ ▲    │ 实心上三角       │ 边长 10px          │ #60A5FA（蓝）   │
  ├────────────┼──────┼──────────────────┼────────────────────┼─────────────────┤
  │ localMin   │ ▽    │ 实心下三角       │ 边长 10px          │ #F472B6（粉）   │
  ├────────────┼──────┼──────────────────┼────────────────────┼─────────────────┤
  │ inflection │ ◆    │ 实心菱形         │ 对角线 10px        │ #FBBF24（琥珀） │
  └────────────┴──────┴──────────────────┴────────────────────┴─────────────────┘

  坐标文本偏移避让规则：
  - localMax：文本在符号上方 14px
  - localMin：文本在符号下方 14px
  - zero：文本在符号右侧 8px，超出右边界改左侧
  - inflection：文本在符号右上 8px

  T5.2 特征点结果缓存

  // functionStore 新增
  featureCache: Record<string, {
    exprStr: string;
    xMin: number;
    xMax: number;
    points: FeaturePoint[];
  }>

  缓存失效条件：函数 exprStr 变化 或 视口 xMin/xMax 变化时重新扫描。

  T5.3 FunctionCanvas 接入特征点渲染

  if (features.showFeaturePoints) {
    for (const fn of functions) {
      if (!fn.visible || fn.mode !== 'standard') continue;
      const cached = featureCache[fn.id];
      if (!cached) continue;
      renderFeaturePoints(ctx, cached.points, vp, { showCoords: true });
    }
  }

  T5.4 DerivativePanel（骨架）

  ┌─────────────────────────────────┐
  │  分析工具                        │
  │                                  │
  │  [○] 显示特征点                  │
  │                                  │
  │  零点 3 个   极值 4 个   拐点 1 个│
  │                                  │
  │  ── 导数与切线（阶段6 补全）──   │
  └─────────────────────────────────┘

  阶段5 验收标准：
  - pnpm tsc --noEmit 零错误 / pnpm lint 零 error
  - sin(x) 在 [-2π,2π] 视口：零点5个（绿圆）、极大值2个（蓝三角）、极小值2个（粉三角）
  - x^3-x 拐点1个（x≈0，琥珀菱形）
  - 坐标文本正确显示，不与符号重叠
  - 视口外特征点不渲染
  - 修改表达式或平移视口后自动更新

  ---
  阶段6：导数图像与切线联动

  目标：可显示导函数 f'(x) 曲线；鼠标移动时实时绘制切线并显示斜率；TraceTool 负责追踪交互。

  涉及文件：
  src/canvas/renderers/tangentRenderer.ts   ← 新建
  src/editor/tools/TraceTool.ts             ← 新建
  src/components/panels/DerivativePanel.tsx ← 补全
  src/components/FunctionCanvas.tsx         ← 扩展

  T6.1 导数曲线渲染

  复用 curveRenderer.ts，在 StaticCanvas 曲线之后追加：

  if (features.showDerivative) {
    for (const fn of functions) {
      if (!fn.visible || fn.mode !== 'standard') continue;
      const compiled = compileExpression(fn.exprStr);
      if (isParseError(compiled)) continue;

      const derivedCompiled = compileDerivative(compiled);
      if (isParseError(derivedCompiled)) continue;

      // 链式法则：y = a·f(b(x-h))+k → y' = a·b·f'(b(x-h))
      const derivTransform = {
        a: fn.transform.a * fn.transform.b,
        b: fn.transform.b,
        h: fn.transform.h,
        k: 0,
      };
      const derivPoints = sampleWithTransform(derivedCompiled, vp, derivTransform);
      renderCurve(ctx, derivPoints, vp, fn.color, { alpha: 0.5, lineDash: [5, 4], lineWidth: 1.5 });
    }
  }

  T6.2 切线渲染器

  export function renderTangent(
    ctx: CanvasRenderingContext2D,
    x0: number,
    y0: number,
    slope: number,
    viewport: Viewport,
    color: string,
  ): void

  绘制内容（均在 DynamicCanvas 上）：
  1. 切点圆：实心圆，半径 5px
  2. 切线：过切点延伸至左右边界，线宽 1.5px，透明度 0.8
  3. 斜率文本：k = 1.234，切点右上方 (10px, -14px)
  4. 切点坐标：(x₀, y₀)，切点正下方 (0, 18px)
  5. slope=NaN → 仅绘切点圆；slope=±Infinity → 绘竖直切线，显示 k = ∞

  T6.3 TraceTool

  export class TraceTool implements Tool {
    readonly id = 'trace';

    onPointerMove(e: ToolEvent): void {
      const activeFn = store.functions.find(f => f.id === store.activeFunctionId);
      const x0 = e.mathX;
      const y0 = evaluateAt(compiled, activeFn.transform.b * (x0 - activeFn.transform.h));
      const realY0 = activeFn.transform.a * y0 + activeFn.transform.k;

      // 链式法则斜率
      const rawSlope = numericalDerivative(compiled, activeFn.transform.b * (x0 - activeFn.transform.h));
      const slope = activeFn.transform.a * activeFn.transform.b * rawSlope;

      store.setFeature('tangentX', x0);
      store.setFeature('tangentY', realY0);
      store.setFeature('tangentSlope', slope);
    }

    onPointerLeave(): void {
      this.clearDynamic();
      store.setFeature('tangentX', null);
    }

    private clearDynamic(): void {
      window.dispatchEvent(new CustomEvent('m02:clear-dynamic'));
    }
  }

  TraceTool 与 PanZoomTool 互斥切换："显示切线"开关开→切换到 TraceTool，关→切换回 PanZoomTool。

  T6.4 FunctionCanvas DynamicCanvas 渲染

  useEffect(() => {
    const ctx = dynamicRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (!showTangent || tangentX === null) return;
    renderTangent(ctx, tangentX, tangentY, tangentSlope ?? NaN, vp, activeFn.color);
  }, [tangentX, tangentY, tangentSlope, showTangent, activeFunctionId]);

  T6.5 DerivativePanel 完整版

  ┌─────────────────────────────────────┐
  │  分析工具                            │
  │  [○] 显示特征点                      │
  │  零点 5 个   极值 4 个   拐点 1 个   │
  │  ─────────────────────────────────  │
  │  [○] 显示导数曲线 f'(x)              │
  │  f'(x) = cos(x)                      │
  │  [○] 显示切线                        │
  │  切点  x₀ = 1.57                     │
  │        y₀ = 1.00                     │
  │  斜率  k  = 0.001                    │
  └─────────────────────────────────────┘

  斜率接近 0（|k| < 0.01）时，绿色文字提示"极值点附近"。

  阶段6 验收标准：
  - pnpm tsc --noEmit 零错误 / pnpm lint 零 error
  - 打开"显示导数曲线"，sin(x) 导数曲线为 cos(x)（虚线，50%透明）
  - 面板显示 f'(x) = cos(x)（符号求导）
  - 打开"显示切线"，鼠标移动时切线实时跟随
  - 切线在极值点处水平（k≈0），面板提示"极值点附近"
  - b=-1 时切线斜率符号取反（链式法则正确）
  - 鼠标移出 Canvas，DynamicCanvas 清空

  ---
  阶段7：分段函数

  目标：用户可将某条函数切换为分段模式，动态添加/删除任意数量的分段区间，每段独立输入表达式和端点开闭条件；Canvas
  正确渲染，端点用●（包含）或○（不包含）区分。

  涉及文件：
  src/components/panels/PiecewisePanel.tsx
  src/canvas/renderers/featurePointRenderer.ts  ← 扩展端点渲染
  src/components/FunctionCanvas.tsx             ← 扩展分段渲染分支
  src/editor/commands/UpdateFunctionParamCommand.ts ← 覆盖 segments 变更
  src/editor/store/functionStore.ts             ← 扩展 addSegment/removeSegment/updateSegment

  T7.1 FunctionStore 分段 Actions

  addSegment(funcId: string, segment: PiecewiseSegment): void
  removeSegment(funcId: string, segId: string): void
  updateSegment(funcId: string, segId: string, patch: Partial<PiecewiseSegment>): void

  新增分段默认值：
  {
    id: nanoid(),
    exprStr: 'x',
    domain: { xMin: 0, xMax: 1, xMinInclusive: true, xMaxInclusive: false },
  }

  切换到 piecewise 时若 segments 为空自动插入默认分段；切换回 standard 时保留 segments（不清空）。

  T7.2 分段函数 Command 扩展

  segments 数组变更直接纳入 UpdateFunctionParamCommand，无需新建专用 Command。
  - 打字时：实时 updateSegment，不写 Command
  - onBlur/Enter：触发 UpdateFunctionParamCommand（before=上次快照，after=当前segments）
  - 添加/删除分段：立即触发 UpdateFunctionParamCommand

  T7.3 PiecewisePanel — 分段区间编辑器

  UI 结构：
  ┌──────────────────────────────────────┐
  │  分段函数编辑器                       │
  │                                       │
  │  第 1 段                         [×] │
  │  f(x) = [ x^2          ]             │
  │  定义域  [  0  ] ≤ x <  [  2  ]      │
  │          ☑ 包含左端点  □ 包含右端点  │
  │                                       │
  │  第 2 段                         [×] │
  │  f(x) = [ 2*x - 1      ]             │
  │  定义域  [  2  ] ≤ x ≤ [ +∞  ]      │
  │          ☑ 包含左端点  ☑ 包含右端点  │
  │                                       │
  │            [+ 添加分段]               │
  └──────────────────────────────────────┘

  - xMin/xMax 支持数字和 -∞/+∞（空字符串或 inf 视为无穷）
  - 区间重叠时对应行显示黄色左边框 + tooltip 提示（不阻止操作）

  T7.4 分段函数 Canvas 渲染

  } else if (fn.mode === 'piecewise') {
    const segmentResults = evaluatePiecewiseRange(fn.segments, vp);
    for (const { segment, points } of segmentResults) {
      if (points.length === 0) continue;
      renderCurve(ctx, toSamplePoints(points), vp, fn.color);
      renderSegmentEndpoints(ctx, segment, vp, fn.color);
    }
  }

  T7.5 分段端点渲染器扩展

  export function renderSegmentEndpoints(
    ctx: CanvasRenderingContext2D,
    segment: PiecewiseSegment,
    viewport: Viewport,
    color: string,
  ): void

  ┌─────────────────┬──────┬───────────────────────────────────────────────────────┐
  │      情况       │ 符号 │                         样式                          │
  ├─────────────────┼──────┼───────────────────────────────────────────────────────┤
  │ inclusive=true  │ ●    │ 实心圆，半径 4px，填充 color                          │
  ├─────────────────┼──────┼───────────────────────────────────────────────────────┤
  │ inclusive=false │ ○    │ 空心圆，半径 4px，描边 color，内部填充 COLORS.surface │
  └─────────────────┴──────┴───────────────────────────────────────────────────────┘

  阶段7 验收标准：
  - pnpm tsc --noEmit 零错误 / pnpm lint 零 error
  - 切换为分段模式，PiecewisePanel 出现，TransformPanel 隐藏
  - 构造 {x<0: -x, x≥0: x^2}：两段曲线正确，x=0 处左段○右段●
  - 动态添加第三段，Canvas 实时更新
  - 删除一段 → Undo → 该段恢复
  - xMax=+∞ 时段延伸至视口右边界
  - 两段重叠时显示黄色警告边框
  - 切换回 standard 模式，曲线变回普通函数

  ---
  阶段8：动画系统

  目标：TransformPanel 每个参数滑块旁提供"▶ 演示"按钮，点击触发 requestAnimationFrame 驱动的平滑插值动画；视口双击重置改为动画过渡；动画可随时中止。

  涉及文件：
  src/engine/animationEngine.ts
  src/components/panels/TransformPanel.tsx  ← 扩展
  src/editor/tools/PanZoomTool.ts           ← 扩展双击动画

  T8.1 动画引擎

  export interface AnimationConfig {
    from: number;
    to: number;
    duration: number;
    easing: EasingFn;
    onFrame: (value: number) => void;
    onComplete?: () => void;
  }

  export type EasingFn = (t: number) => number;

  export function startAnimation(config: AnimationConfig): () => void {
    const startTime = performance.now();
    let rafId: number;

    function tick(now: number) {
      const rawT = Math.min((now - startTime) / config.duration, 1);
      const easedT = config.easing(rawT);
      config.onFrame(config.from + (config.to - config.from) * easedT);
      if (rawT < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        config.onComplete?.();
      }
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }

  // 三次贝塞尔缓入缓出
  export const easeInOut: EasingFn =
    (t) => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;

  // 缓出（适合归位动画）
  export const easeOut: EasingFn =
    (t) => 1 - Math.pow(1 - t, 3);

  // 线性
  export const linear: EasingFn = (t) => t;

  // 多参数并行动画（视口四边界同步插值）
  export function startMultiAnimation(
    configs: Omit<AnimationConfig, 'easing'>[],
    easing: EasingFn,
    duration: number,
    onComplete?: () => void,
  ): () => void {
    const startTime = performance.now();
    let rafId: number;

    function tick(now: number) {
      const rawT = Math.min((now - startTime) / duration, 1);
      const easedT = easing(rawT);
      configs.forEach(c => c.onFrame(c.from + (c.to - c.from) * easedT));
      if (rawT < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        onComplete?.();
      }
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }

  T8.2 TransformPanel 演示按钮

  各参数演示动画规格：

  ┌──────┬──────────────┬────────┬────────┬───────┬───────────┬─────────────────┐
  │ 参数 │   动画内容   │ 起始值 │ 目标值 │ 时长  │   缓动    │    教学意义     │
  ├──────┼──────────────┼────────┼────────┼───────┼───────────┼─────────────────┤
  │ a    │ 纵向拉伸演示 │ 1.0    │ 2.0    │ 800ms │ easeInOut │ 振幅加倍        │
  ├──────┼──────────────┼────────┼────────┼───────┼───────────┼─────────────────┤
  │ b    │ 横向压缩演示 │ 1.0    │ 2.0    │ 800ms │ easeInOut │ 周期减半        │
  ├──────┼──────────────┼────────┼────────┼───────┼───────────┼─────────────────┤
  │ h    │ 右移演示     │ 0.0    │ 3.0    │ 800ms │ easeInOut │ 向右平移 3 单位 │
  ├──────┼──────────────┼────────┼────────┼───────┼───────────┼─────────────────┤
  │ k    │ 上移演示     │ 0.0    │ 2.0    │ 800ms │ easeInOut │ 向上平移 2 单位 │
  └──────┴──────────────┴────────┴────────┴───────┴───────────┴─────────────────┘

  h 参数下方显示说明文字：f(x-h)：h>0 右移，h<0 左移

  动画实现关键设计：
  - 动画进行中 → 直接更新 Store（不写 Command，中间帧不入历史）
  - 动画完成后 → 写入一条 UpdateFunctionParamCommand（from→to，结果可 Undo）
  - 按钮：播放时显示"▶"，动画中显示"■"（点击立即停止）

  const handleDemoH = () => {
    if (isAnimating) { cancelRef.current?.(); setIsAnimating(false); return; }
    setIsAnimating(true);
    const fromH = activeFn.transform.h;
    const toH = 3.0;

    cancelRef.current = startAnimation({
      from: fromH, to: toH, duration: 800, easing: easeInOut,
      onFrame: (value) => {
        useFunctionStore.getState().updateFunction(activeFn.id, {
          transform: { ...activeFn.transform, h: value },
        });
      },
      onComplete: () => {
        editorInstance?.execute(new UpdateFunctionParamCommand(
          activeFn.id,
          { transform: { ...activeFn.transform, h: fromH } },
          { transform: { ...activeFn.transform, h: toH } },
        ));
        setIsAnimating(false);
      },
    });
  };

  T8.3 视口重置平滑动画

  双击 Canvas 改为 400ms 平滑动画：

  onDblClick(_e: ToolEvent): void {
    const currentVp = this.editor.getViewport();
    const target = DEFAULT_VIEWPORT;

    startMultiAnimation([
      { from: currentVp.xMin, to: target.xMin, onFrame: (v) => { xMin = v; sync(); } },
      { from: currentVp.xMax, to: target.xMax, onFrame: (v) => { xMax = v; sync(); } },
      { from: currentVp.yMin, to: target.yMin, onFrame: (v) => { yMin = v; sync(); } },
      { from: currentVp.yMax, to: target.yMax, onFrame: (v) => { yMax = v; sync(); } },
    ], easeOut, 400);
    // sync()：合成新 Viewport 并调用 editor.setViewport()
  }

  视口变更不计入 Undo 历史。

  T8.4 动画与 Canvas 渲染协同

  动画帧通过 onFrame 修改 Store 值，FunctionCanvas 的 useEffect 监听变化触发 StaticCanvas 重绘。

  性能保证：
  // FunctionCanvas 中
  const isAnimating = useAnimationStore(s => s.isAnyAnimating);
  const steps = isAnimating ? 400 : 800;  // 动画期间降低采样密度

  useAnimationStore：轻量 Zustand store，仅记录是否有动画正在进行（布尔值）。

  阶段8 验收标准：
  - pnpm tsc --noEmit 零错误 / pnpm lint 零 error
  - 点击 h 参数"▶"按钮，sin(x) 在 800ms 内平滑右移 3 单位，无跳帧
  - 动画中按钮显示"■"，点击立即停止，曲线停在当前位置
  - 动画完成后 Ctrl+Z 可撤销（恢复到动画前位置）
  - 双击 Canvas 视口 400ms 内平滑归位，末端减速自然
  - 动画期间采样步数降为 400，帧率 ≥ 55fps（DevTools Performance 验证）
  - h 参数面板显示"f(x-h)：h>0 右移，h<0 左移"

  ---
  全局验收标准

  ┌───────────────────┬────────────────────────────────────────────────┐
  │      检查项       │                    验证方式                    │
  ├───────────────────┼────────────────────────────────────────────────┤
  │ TypeScript 无错误 │ pnpm tsc --noEmit                              │
  ├───────────────────┼────────────────────────────────────────────────┤
  │ ESLint 无 error   │ pnpm lint                                      │
  ├───────────────────┼────────────────────────────────────────────────┤
  │ 60fps 渲染        │ DevTools Performance，滑块拖拽期间帧率 ≥ 55fps │
  ├───────────────────┼────────────────────────────────────────────────┤
  │ 断点无连接线      │ 视觉验证 y=1/x、tan(x) 在断点处无异常连线      │
  ├───────────────────┼────────────────────────────────────────────────┤
  │ 零点精度          │ sin(x) 在 [-2π,2π] 恰好 5 个零点               │
  ├───────────────────┼────────────────────────────────────────────────┤
  │ b 负数支持        │ sin(x) 在 b=-1 时图像与 sin(-x) 完全重合       │
  ├───────────────────┼────────────────────────────────────────────────┤
  │ 无个人信息        │ grep -r "[YOUR_EMAIL]" src/ 零结果             │
  └───────────────────┴────────────────────────────────────────────────┘

  ---
  依赖清单

  ┌───────────────────────┬──────────────────────┐
  │          包           │         用途         │
  ├───────────────────────┼──────────────────────┤
  │ mathjs                │ 表达式解析、符号求导 │
  ├───────────────────────┼──────────────────────┤
  │ zustand               │ 状态管理             │
  ├───────────────────────┼──────────────────────┤
  │ lucide-react          │ 图标                 │
  ├───────────────────────┼──────────────────────┤
  │ clsx + tailwind-merge │ 样式工具             │
  ├───────────────────────┼──────────────────────┤
  │ tailwindcss           │ CSS 框架             │
  └───────────────────────┴──────────────────────┘

  ---
  执行说明

  - 每个阶段完成后执行：pnpm lint && pnpm tsc --noEmit
  - 每个阶段验收标准逐项手动验证后方可进入下一阶段
  - 遇到计划外改动需求，停止执行，补充本文档后继续
  - Git 提交使用 --author 参数指定，不修改全局 git config
  - 任何源代码文件、注释、文档中严禁出现个人邮箱或姓名

  ---
  执行日志

  [2026-03-12] 阶段1 完成
  - 手工脚手架（pnpm create vite 在非空目录不可用，改为手动创建配置文件）
  - 所有 T1.1–T1.11 任务完成；pnpm lint + pnpm tsc --noEmit 零错误
  - 修正：historyStore.execute() 移除重复 cmd.execute() 调用（防止双执行 bug）
  - 修正：PanZoomTool.onPointerMove 补全 lastMath 更新（原骨架为 TODO）
  - 新增：design_guid/ 排除出 ESLint 扫描范围（预存的无关 lint 错误）
  - 设计系统分析完成（见 .tasks/completed/v1.0/01-infrastructure.md）
  ---