import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useHistoryStore } from '@/editor';
import { useDemoEntityStore } from '@/editor/demo/demoEntityStore';
import { useDemoSelectionStore } from '@/editor/demo/demoSelectionStore';
import { useDemoToolStore } from '@/editor/demo/demoToolStore';
import {
  CreateVectorCmd, MovePointCmd, CreateVecOpCmd, DeleteVectorCmd, UpdateVecOpCmd,
  CreateMarkerCmd, DeleteMarkerCmd, UpdateMarkerCmd,
  CreateSegmentCmd, CreateCircleCmd,
  CreateTextCmd, UpdateTextCmd,
  CreateAngleMarkCmd, CreateDistanceMarkCmd,
  DeleteGenericCmd, UpdateGenericCmd, CreateConstructionCmd,
  TransformEntitiesCmd,
} from '@/editor/demo/demoCommands';
import type {
  DemoPoint, DemoVector, DemoVecOp,
  DemoMarker, DemoSegment, DemoCircle, DemoText, DemoAngleMark, DemoDistanceMark,
  DemoLine, DemoRay, DemoPolygon, DemoSlider,
} from '@/editor/demo/demoTypes';
import { DEMO_COLORS } from '@/editor/demo/demoTypes';
import type { DemoOpKind } from '@/editor/demo/demoTypes';
import { COLORS, RADIUS, SHADOWS } from '@/styles/tokens';
import {
  add2D, sub2D, dot2D, scale2D, angle2D, toDeg,
  segSegIntersection, segCircleIntersections, circleCircleIntersections,
  footOfPerpendicular, footOnSegment, angleBisectorDir,
  slopeOf, tangentPoints, rotatePoint, reflectPoint, dilatePoint, polygonArea,
  fmtSmart, commonExternalTangents, commonInternalTangents,
  pointToLineDistance, clampToRegion,
} from '@/engine/vectorMath';
import { LatexRenderer } from './LatexRenderer';
import { toVecLatex } from '@/lib/vecLatex';
import { InlineLatex } from '@/components/shared/InlineLatex';
import { useMotionEngine } from '@/hooks/useMotionEngine';
import { useSliderBinding } from '@/hooks/useSliderBinding';
import { useAnimationStore } from '@/editor/demo/animationStore';
import { useTraceStore } from '@/editor/demo/traceStore';
import { useConstraintStore } from '@/editor/demo/constraintStore';
import type { ConstraintContext } from '@/engine/constraintParser';
import type { Vec2D } from '@/editor/entities/types';

// ─── 坐标系常量 ───
const SCALE = 50;
const VB_W = 800;
const VB_H = 600;
const VB_X = -VB_W / 2;
const VB_Y = -VB_H / 2;

// 数学坐标 → SVG 坐标（Y 轴翻转）
function m2s(mx: number, my: number): [number, number] {
  return [mx * SCALE, -my * SCALE];
}

// SVG 坐标 → 数学坐标（吸附到 0.5 网格，无边界限制）
function svgToMath(svgX: number, svgY: number): [number, number] {
  return [
    Math.round(svgX / SCALE * 2) / 2,
    Math.round(-svgY / SCALE * 2) / 2,
  ];
}

// 客户端坐标 → SVG 坐标（使用 getScreenCTM 精确变换，支持 preserveAspectRatio）
function clientToSVG(clientX: number, clientY: number, svg: SVGSVGElement): [number, number] {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const inv = pt.matrixTransform(svg.getScreenCTM()!.inverse());
  return [inv.x, inv.y];
}

// 点到线段距离
function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 0.001) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// 点到圆距离（到圆周的最近距离）
function distToCircle(px: number, py: number, cx: number, cy: number, r: number): number {
  return Math.abs(Math.hypot(px - cx, py - cy) - r);
}

// ─── 吸附逻辑：自动吸附到已有 marker 或几何交点 ───
const SNAP_THRESHOLD = 0.4; // 数学坐标距离阈值

function computeSnapPoint(
  mx: number, my: number,
  ents: DemoEntMap,
): { x: number; y: number; snapped: boolean; snapLabel?: string } {
  type Pt2 = [number, number];
  let bestDist = SNAP_THRESHOLD;
  let bestPt: Pt2 = [mx, my];
  let snapped = false;
  let snapLabel: string | undefined;

  // 1. 吸附到已有 marker
  for (const e of Object.values(ents)) {
    if (e.type !== 'demoMarker') continue;
    const mk = e as DemoMarker;
    const d = Math.hypot(mx - mk.x, my - mk.y);
    if (d < bestDist) {
      bestDist = d;
      bestPt = [mk.x, mk.y];
      snapped = true;
      snapLabel = mk.label;
    }
  }

  // 收集线段和圆
  const segs: { p1: Pt2; p2: Pt2 }[] = [];
  const circles: { cx: number; cy: number; r: number }[] = [];
  for (const e of Object.values(ents)) {
    if (e.type === 'demoSegment') {
      const seg = e as DemoSegment;
      const s = ents[seg.startId] as DemoMarker | undefined;
      const ed = ents[seg.endId] as DemoMarker | undefined;
      if (s && ed) segs.push({ p1: [s.x, s.y], p2: [ed.x, ed.y] });
    }
    if (e.type === 'demoCircle') {
      const cir = e as DemoCircle;
      const ct = ents[cir.centerId] as DemoMarker | undefined;
      const rp = ents[cir.radiusPointId] as DemoMarker | undefined;
      if (ct && rp) {
        const r = Math.hypot(rp.x - ct.x, rp.y - ct.y);
        if (r > 0.01) circles.push({ cx: ct.x, cy: ct.y, r });
      }
    }
  }

  // 2. 线段-线段交点
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const pt = segSegIntersection(segs[i].p1, segs[i].p2, segs[j].p1, segs[j].p2);
      if (pt) {
        const d = Math.hypot(mx - pt[0], my - pt[1]);
        if (d < bestDist) { bestDist = d; bestPt = pt; snapped = true; snapLabel = '交点'; }
      }
    }
  }

  // 3. 线段-圆交点
  for (const seg of segs) {
    for (const cir of circles) {
      const pts = segCircleIntersections(seg.p1, seg.p2, [cir.cx, cir.cy], cir.r);
      for (const pt of pts) {
        const d = Math.hypot(mx - pt[0], my - pt[1]);
        if (d < bestDist) { bestDist = d; bestPt = pt; snapped = true; snapLabel = '交点'; }
      }
    }
  }

  // 4. 圆-圆交点
  for (let i = 0; i < circles.length; i++) {
    for (let j = i + 1; j < circles.length; j++) {
      const pts = circleCircleIntersections(
        circles[i].cx, circles[i].cy, circles[i].r,
        circles[j].cx, circles[j].cy, circles[j].r,
      );
      for (const pt of pts) {
        const d = Math.hypot(mx - pt[0], my - pt[1]);
        if (d < bestDist) { bestDist = d; bestPt = pt; snapped = true; snapLabel = '交点'; }
      }
    }
  }

  return { x: bestPt[0], y: bestPt[1], snapped, snapLabel };
}

// ─── 约束辅助：获取端点的约束信息 ───

type DemoEntMap = Record<string, import('@/editor/demo/demoTypes').DemoEntity>;

type PointConstraintInfo =
  | { kind: 'circle'; anchorId: string; length: number }
  | { kind: 'line'; p1: { x: number; y: number }; p2: { x: number; y: number } }
  | { kind: 'region'; min: { x: number; y: number }; max: { x: number; y: number } };

function getPointConstraint(ptId: string, ents: DemoEntMap): PointConstraintInfo | null {
  for (const en of Object.values(ents)) {
    if (en.type !== 'demoVector') continue;
    const v = en as DemoVector;
    if (!v.constraint || v.constraint === 'free') continue;

    const isConstrained =
      ((v.constraint === 'fixedStart' || v.constraint === 'fixedEnd') &&
        ((v.constraint === 'fixedStart' && v.endId === ptId) || (v.constraint === 'fixedEnd' && v.startId === ptId))) ||
      ((v.constraint === 'lineStart' || v.constraint === 'regionStart') && v.startId === ptId) ||
      ((v.constraint === 'lineEnd' || v.constraint === 'regionEnd') && v.endId === ptId);
    if (!isConstrained) continue;

    if ((v.constraint === 'fixedStart' || v.constraint === 'fixedEnd') && v.constraintLength) {
      const anchorId = v.constraint === 'fixedStart' ? v.startId : v.endId;
      return { kind: 'circle', anchorId, length: v.constraintLength };
    }
    if ((v.constraint === 'lineStart' || v.constraint === 'lineEnd') && v.constraintLineP1 && v.constraintLineP2) {
      return { kind: 'line', p1: v.constraintLineP1, p2: v.constraintLineP2 };
    }
    if ((v.constraint === 'regionStart' || v.constraint === 'regionEnd') && v.constraintRegionMin && v.constraintRegionMax) {
      return { kind: 'region', min: v.constraintRegionMin, max: v.constraintRegionMax };
    }
  }
  return null;
}

/** 将点投影到约束圆上 */
function projectOntoConstraint(
  mx: number, my: number, anchorX: number, anchorY: number, radius: number,
): [number, number] {
  const dx = mx - anchorX, dy = my - anchorY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > 0.001) return [anchorX + dx / dist * radius, anchorY + dy / dist * radius];
  return [anchorX + radius, anchorY]; // 默认向右
}

/**
 * 求两圆交点。返回 0~2 个交点。
 * 圆1: 圆心(cx1,cy1) 半径r1；圆2: 圆心(cx2,cy2) 半径r2
 */
function circleIntersections(
  cx1: number, cy1: number, r1: number,
  cx2: number, cy2: number, r2: number,
): [number, number][] {
  const dx = cx2 - cx1, dy = cy2 - cy1;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1e-10) return []; // 同心
  if (d > r1 + r2 + 1e-6) return []; // 太远
  if (d + 1e-6 < Math.abs(r1 - r2)) return []; // 包含
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const hSq = r1 * r1 - a * a;
  const h = hSq > 0 ? Math.sqrt(hSq) : 0;
  const px = cx1 + a * dx / d, py = cy1 + a * dy / d;
  if (h < 1e-8) return [[px, py]]; // 相切
  const ox = h * dy / d, oy = h * dx / d;
  return [[px + ox, py - oy], [px - ox, py + oy]];
}

// ─── 递归解析实体为向量（支持 DemoVector 和 DemoVecOp）───
function resolveVec(entityId: string, ents: Record<string, DemoPoint | DemoVector | DemoVecOp | import('@/editor/demo/demoTypes').DemoEntity>, depth = 0): Vec2D | null {
  if (depth > 10) return null; // 防止循环
  const entity = ents[entityId];
  if (!entity) return null;
  if (entity.type === 'demoVector') {
    const v = entity as DemoVector;
    const sp = ents[v.startId] as DemoPoint | undefined;
    const ep = ents[v.endId] as DemoPoint | undefined;
    if (!sp || !ep) return null;
    return [ep.x - sp.x, ep.y - sp.y];
  }
  if (entity.type === 'demoVecOp') {
    const op = entity as DemoVecOp;
    const v1 = resolveVec(op.vec1Id, ents, depth + 1);
    if (!v1) return null;
    if (op.kind === 'scale') return scale2D(v1, op.scalarK ?? 2);
    if (op.kind === 'dotProduct') return null; // 标量，非向量
    if (!op.vec2Id) return null;
    const v2 = resolveVec(op.vec2Id, ents, depth + 1);
    if (!v2) return null;
    if (op.kind === 'add') return add2D(v1, v2);
    if (op.kind === 'subtract') return sub2D(v1, v2);
    if (op.kind === 'projection') {
      const d = dot2D(v1, v2);
      const m2 = dot2D(v2, v2);
      if (m2 < 1e-12) return [0, 0];
      return scale2D(v2, d / m2);
    }
  }
  return null;
}

/** 解析运算结果的起点（数学坐标） */
function resolveOpOrigin(op: DemoVecOp, ents: Record<string, import('@/editor/demo/demoTypes').DemoEntity>, depth = 0): { x: number; y: number } {
  if (op.originX != null && op.originY != null) return { x: op.originX, y: op.originY };
  const src = ents[op.vec1Id];
  if (!src) return { x: 0, y: 0 };
  if (src.type === 'demoVector') {
    const sp = ents[(src as DemoVector).startId] as DemoPoint | undefined;
    return sp ? { x: sp.x, y: sp.y } : { x: 0, y: 0 };
  }
  if (src.type === 'demoVecOp' && depth < 10) {
    return resolveOpOrigin(src as DemoVecOp, ents, depth + 1);
  }
  return { x: 0, y: 0 };
}

/** 获取运算结果的标签文本 */
function resolveOpLabel(entityId: string, ents: Record<string, import('@/editor/demo/demoTypes').DemoEntity>, depth = 0): string {
  if (depth > 10) return '?';
  const entity = ents[entityId];
  if (!entity) return '?';
  if (entity.type === 'demoVector') return (entity as DemoVector).label;
  if (entity.type === 'demoVecOp') {
    const op = entity as DemoVecOp;
    const l1 = resolveOpLabel(op.vec1Id, ents, depth + 1);
    if (op.kind === 'scale') {
      const kStr = Number.isInteger(op.scalarK ?? 2) ? String(op.scalarK ?? 2) : (op.scalarK ?? 2).toFixed(2);
      return `${kStr}${l1}`;
    }
    if (!op.vec2Id) return l1;
    const l2 = resolveOpLabel(op.vec2Id, ents, depth + 1);
    if (op.kind === 'projection') return `proj(${l1},${l2})`;
    const sym = op.kind === 'add' ? '+' : op.kind === 'subtract' ? '−' : '·';
    return `${l1}${sym}${l2}`;
  }
  return '?';
}

/** 检查是否存在循环依赖 */
function hasCycle(startId: string, targetId: string, ents: Record<string, import('@/editor/demo/demoTypes').DemoEntity>, depth = 0): boolean {
  if (depth > 20) return true;
  if (startId === targetId) return true;
  const entity = ents[startId];
  if (!entity || entity.type !== 'demoVecOp') return false;
  const op = entity as DemoVecOp;
  if (hasCycle(op.vec1Id, targetId, ents, depth + 1)) return true;
  if (op.vec2Id && hasCycle(op.vec2Id, targetId, ents, depth + 1)) return true;
  return false;
}

// ─── 标记点自动标签：A, B, C, ..., Z, A₁, B₁, ... ───
const SUBSCRIPT_DIGITS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];
function nextMarkerLabel(entities: Record<string, import('@/editor/demo/demoTypes').DemoEntity>): string {
  const existingLabels = new Set(
    Object.values(entities)
      .filter((e) => e.type === 'demoMarker')
      .map((e) => (e as DemoMarker).label),
  );
  // A..Z
  for (let i = 0; i < 26; i++) {
    const lbl = String.fromCharCode(65 + i);
    if (!existingLabels.has(lbl)) return lbl;
  }
  // A₁..Z₁, A₂..Z₂, ...
  for (let n = 1; n <= 99; n++) {
    const sub = String(n).split('').map((d) => SUBSCRIPT_DIGITS[+d]).join('');
    for (let i = 0; i < 26; i++) {
      const lbl = String.fromCharCode(65 + i) + sub;
      if (!existingLabels.has(lbl)) return lbl;
    }
  }
  return 'P';
}

// ─── 计算两点间角度（数学坐标，弧度），用于角度标注 ───
function angleBetweenPoints(
  vx: number, vy: number,
  ax: number, ay: number,
): number {
  return Math.atan2(ay - vy, ax - vx);
}

// ─── ArrowDefs ───
function DemoArrowDefs({ colors }: { colors: string[] }) {
  return (
    <defs>
      {colors.map((color, i) => (
        <marker key={i} id={`demo-arrow-${i}`} markerWidth={8} markerHeight={6} refX={5} refY={3} orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill={color} />
        </marker>
      ))}
    </defs>
  );
}

function colorIndex(color: string): number {
  const idx = DEMO_COLORS.indexOf(color as typeof DEMO_COLORS[number]);
  return idx >= 0 ? idx : 0;
}

// ─── 动态坐标网格（随 viewBox 变化）───
interface ViewState { x: number; y: number; w: number; h: number }

function CoordGrid({ view }: { view: ViewState }) {
  const mathXmin = view.x / SCALE;
  const mathXmax = (view.x + view.w) / SCALE;
  const mathYmin = -(view.y + view.h) / SCALE;
  const mathYmax = -view.y / SCALE;

  const visRange = Math.max(mathXmax - mathXmin, mathYmax - mathYmin);
  let step = 1;
  if (visRange > 40) step = 2;
  if (visRange > 80) step = 5;
  if (visRange > 200) step = 10;
  if (visRange > 400) step = 20;

  const xNums: number[] = [];
  for (let x = Math.ceil(mathXmin / step) * step; x <= mathXmax; x += step) xNums.push(x);
  const yNums: number[] = [];
  for (let y = Math.ceil(mathYmin / step) * step; y <= mathYmax; y += step) yNums.push(y);

  const xLabelSvgY = Math.max(view.y + 12, Math.min(view.y + view.h - 4, 12));
  const yLabelSvgX = Math.max(view.x + 4, Math.min(view.x + view.w - 20, -14));

  return (
    <g opacity={0.35}>
      {xNums.map((x) => {
        const [sx] = m2s(x, 0);
        return <line key={`gx${x}`} x1={sx} y1={view.y} x2={sx} y2={view.y + view.h}
          stroke={x === 0 ? COLORS.axis : COLORS.border} strokeWidth={x === 0 ? 1.5 : 0.8} />;
      })}
      {yNums.map((y) => {
        const [, sy] = m2s(0, y);
        return <line key={`gy${y}`} x1={view.x} y1={sy} x2={view.x + view.w} y2={sy}
          stroke={y === 0 ? COLORS.axis : COLORS.border} strokeWidth={y === 0 ? 1.5 : 0.8} />;
      })}
      {xNums.filter((x) => x !== 0).map((x) => {
        const [sx] = m2s(x, 0);
        return <text key={`tx${x}`} x={sx} y={xLabelSvgY} textAnchor="middle"
          fontSize={14} fill={COLORS.textMuted} fontFamily="Inter, sans-serif">{x}</text>;
      })}
      {yNums.filter((y) => y !== 0).map((y) => {
        const [, sy] = m2s(0, y);
        return <text key={`ty${y}`} x={yLabelSvgX} y={sy} textAnchor="end" dominantBaseline="middle"
          fontSize={14} fill={COLORS.textMuted} fontFamily="Inter, sans-serif">{y}</text>;
      })}
      {/* X 轴箭头 */}
      <polygon
        points={`${view.x + view.w - 2},0 ${view.x + view.w - 12},-5 ${view.x + view.w - 12},5`}
        fill={COLORS.axis}
      />
      {/* Y 轴箭头（向上） */}
      <polygon
        points={`0,${view.y + 2} -5,${view.y + 12} 5,${view.y + 12}`}
        fill={COLORS.axis}
      />
      <text x={view.x + view.w - 14} y={xLabelSvgY} fontSize={15} fontWeight={600} fill={COLORS.text} fontFamily="Inter, sans-serif">x</text>
      <text x={yLabelSvgX + 16} y={view.y + 14} fontSize={15} fontWeight={600} fill={COLORS.text} fontFamily="Inter, sans-serif">y</text>
    </g>
  );
}

// ─── 带箭头的向量线 ───
function ArrowLine({ x1, y1, x2, y2, color, markerId, strokeWidth = 2.5, dashed = false, opacity = 1 }: {
  x1: number; y1: number; x2: number; y2: number;
  color: string; markerId: string;
  strokeWidth?: number; dashed?: boolean; opacity?: number;
}) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 3) return null;
  return (
    <line x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={color} strokeWidth={strokeWidth}
      strokeDasharray={dashed ? '6 4' : undefined}
      markerEnd={`url(#${markerId})`}
      opacity={opacity} strokeLinecap="round"
    />
  );
}

// ─── 运算结果 HUD 样式 ───
const opHudStyle: React.CSSProperties = {
  padding: '4px 12px', borderRadius: RADIUS.sm,
  border: `1px solid ${COLORS.border}`, background: 'rgba(255,255,255,0.93)',
  fontSize: 14, fontWeight: 700, color: COLORS.text,
  fontFamily: 'Inter, sans-serif',
};

// ─── 主画布组件 ───
export function CanvasDemo() {
  useMotionEngine();
  useSliderBinding();
  const svgRef = useRef<SVGSVGElement>(null);
  const entities = useDemoEntityStore((s) => s.entities);

  // 约束轨迹：当实体位置变化时重新求解
  const constraintCount = useConstraintStore((s) => Object.keys(s.constraints).length);
  useEffect(() => {
    if (constraintCount === 0) return;
    const ctx: ConstraintContext = { points: {} };
    for (const e of Object.values(entities)) {
      if ((e.type === 'demoMarker' || e.type === 'demoPoint') && 'label' in e && e.label) {
        ctx.points[e.label] = { x: (e as { x: number }).x, y: (e as { y: number }).y };
      }
    }
    useConstraintStore.getState().solveAll(ctx);
  }, [entities, constraintCount]);
  const { selectedId, hoveredId, select, setHovered } = useDemoSelectionStore();
  const { activeTool, opKind, step, pendingStartPoint, pendingVec1Id, pendingMarkerIds,
    nextStep, resetTool, setPendingStart, setPendingVec1, pushPendingMarker, popPendingMarker,
    showAllCoords, setTool } = useDemoToolStore();
  const { execute } = useHistoryStore();
  const nextEntityId = useDemoEntityStore((s) => s.nextEntityId);

  // ─── 视口状态（平移/缩放）───
  const [view, setView] = useState<ViewState>({ x: VB_X, y: VB_Y, w: VB_W, h: VB_H });
  const viewRef = useRef(view);
  viewRef.current = view;

  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [snapIndicator, setSnapIndicator] = useState<{ x: number; y: number; snapped: boolean; snapLabel?: string } | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  type PosExpr = { x: number; y: number; xExpr?: string; yExpr?: string };

  // 拖拽端点状态
  const draggingPointRef = useRef<{
    pointId: string;
    before: PosExpr;
    current: { x: number; y: number };
    moved: boolean;
    group: { id: string; before: PosExpr }[];
  } | null>(null);

  // 拖拽运算起点状态
  const draggingOpOriginRef = useRef<{
    opId: string;
    before: { x: number; y: number; originXExpr?: string; originYExpr?: string };
    current: { x: number; y: number };
    moved: boolean;
  } | null>(null);

  // 拖拽标记点状态
  const draggingMarkerRef = useRef<{
    markerId: string;
    before: PosExpr;
    current: { x: number; y: number };
    moved: boolean;
  } | null>(null);

  // 拖拽文字状态
  const draggingTextRef = useRef<{
    textId: string;
    before: PosExpr;
    current: { x: number; y: number };
    moved: boolean;
  } | null>(null);

  // 拖拽整体向量（箭杆拖拽，同时移动起点和终点）
  const draggingVecBodyRef = useRef<{
    vecId: string;
    startId: string;
    endId: string;
    startBefore: PosExpr;
    endBefore: PosExpr;
    grabMath: { x: number; y: number };
    moved: boolean;
  } | null>(null);

  // 拖拽滑动条滑块状态
  const draggingSliderRef = useRef<{
    sliderId: string;
    before: number;
    moved: boolean;
  } | null>(null);

  // 平移状态
  const panRef = useRef<{
    startClientX: number; startClientY: number;
    startViewX: number; startViewY: number;
    scale: number; moved: boolean;
  } | null>(null);
  const panWasMovedRef = useRef(false);

  // 绑定
  const bindings = useDemoEntityStore((s) => s.bindings);

  // 实体分类（过滤 visible === false 的实体）
  const points = Object.values(entities).filter((e): e is DemoPoint => e.type === 'demoPoint' && e.visible !== false);
  const vectors = Object.values(entities).filter((e): e is DemoVector => e.type === 'demoVector' && e.visible !== false);
  const ops = Object.values(entities).filter((e): e is DemoVecOp => e.type === 'demoVecOp' && e.visible !== false);
  const markers = Object.values(entities).filter((e): e is DemoMarker => e.type === 'demoMarker' && e.visible !== false);
  const segments = Object.values(entities).filter((e): e is DemoSegment => e.type === 'demoSegment' && e.visible !== false);
  const circles = Object.values(entities).filter((e): e is DemoCircle => e.type === 'demoCircle' && e.visible !== false);
  const texts = Object.values(entities).filter((e): e is DemoText => e.type === 'demoText' && e.visible !== false);
  const angleMarks = Object.values(entities).filter((e): e is DemoAngleMark => e.type === 'demoAngleMark' && e.visible !== false);
  const distanceMarks = Object.values(entities).filter((e): e is DemoDistanceMark => e.type === 'demoDistanceMark' && e.visible !== false);
  const lines = Object.values(entities).filter((e): e is DemoLine => e.type === 'demoLine' && e.visible !== false);
  const rays = Object.values(entities).filter((e): e is DemoRay => e.type === 'demoRay' && e.visible !== false);
  const polygons = Object.values(entities).filter((e): e is DemoPolygon => e.type === 'demoPolygon' && e.visible !== false);
  const sliders = Object.values(entities).filter((e): e is DemoSlider => e.type === 'demoSlider' && e.visible !== false);
  const vecCount = vectors.length;

  // ─── 滚轮缩放（passive: false 阻止页面滚动）───
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const [svgX, svgY] = clientToSVG(e.clientX, e.clientY, el);
      const factor = e.deltaY < 0 ? 1 / 1.15 : 1.15;
      setView((v) => {
        const newW = Math.max(100, Math.min(8000, v.w * factor));
        const ratio = newW / v.w;
        return {
          x: svgX - (svgX - v.x) * ratio,
          y: svgY - (svgY - v.y) * ratio,
          w: newW,
          h: v.h * ratio,
        };
      });
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  // ─── 命中检测（命中半径随缩放自适应）───
  const hitTest = useCallback((svgX: number, svgY: number): string | null => {
    const ptThresh = 10 * (view.w / VB_W);
    const lineThresh = 8 * (view.w / VB_W);
    const circleThresh = 8 * (view.w / VB_W);

    // 标记点命中（优先级最高，因为是最小实体）
    for (const mk of markers) {
      const [sx, sy] = m2s(mk.x, mk.y);
      if (Math.hypot(svgX - sx, svgY - sy) < ptThresh) return mk.id;
    }

    // 文字命中
    for (const txt of texts) {
      const [sx, sy] = m2s(txt.x, txt.y);
      // 估算文字范围（粗略矩形命中）
      const estW = txt.text.length * txt.fontSize * 0.6;
      const estH = txt.fontSize * 1.2;
      if (Math.abs(svgX - sx) < estW / 2 + 6 && Math.abs(svgY - sy) < estH / 2 + 6) return txt.id;
    }

    // 向量端点命中
    for (const pt of points) {
      const [sx, sy] = m2s(pt.x, pt.y);
      if (Math.hypot(svgX - sx, svgY - sy) < ptThresh) return pt.id;
    }

    // 线段命中
    for (const seg of segments) {
      const sp = entities[seg.startId] as DemoMarker | undefined;
      const ep = entities[seg.endId] as DemoMarker | undefined;
      if (!sp || !ep) continue;
      const [sx1, sy1] = m2s(sp.x, sp.y);
      const [sx2, sy2] = m2s(ep.x, ep.y);
      if (distToSegment(svgX, svgY, sx1, sy1, sx2, sy2) < lineThresh) return seg.id;
    }

    // 圆命中
    for (const cir of circles) {
      const center = entities[cir.centerId] as DemoMarker | undefined;
      const rPt = entities[cir.radiusPointId] as DemoMarker | undefined;
      if (!center || !rPt) continue;
      const [cx, cy] = m2s(center.x, center.y);
      const r = Math.hypot((rPt.x - center.x) * SCALE, (rPt.y - center.y) * SCALE);
      if (distToCircle(svgX, svgY, cx, cy, r) < circleThresh) return cir.id;
    }

    // 向量线段命中
    for (const vec of vectors) {
      const sp = entities[vec.startId] as DemoPoint | undefined;
      const ep = entities[vec.endId] as DemoPoint | undefined;
      if (!sp || !ep) continue;
      const [sx1, sy1] = m2s(sp.x, sp.y);
      const [sx2, sy2] = m2s(ep.x, ep.y);
      if (distToSegment(svgX, svgY, sx1, sy1, sx2, sy2) < lineThresh) return vec.id;
    }

    // 直线命中（使用 pointToLineDistance 计算 SVG 坐标系下的距离）
    for (const ln of lines) {
      const p1 = entities[ln.point1Id] as DemoMarker | undefined;
      const p2 = entities[ln.point2Id] as DemoMarker | undefined;
      if (!p1 || !p2) continue;
      const [sx1, sy1] = m2s(p1.x, p1.y);
      const [sx2, sy2] = m2s(p2.x, p2.y);
      const dist = pointToLineDistance(svgX, svgY, sx1, sy1, sx2, sy2);
      if (dist < lineThresh) return ln.id;
    }

    // 射线命中
    for (const ray of rays) {
      const origin = entities[ray.originId] as DemoMarker | undefined;
      const through = entities[ray.throughId] as DemoMarker | undefined;
      if (!origin || !through) continue;
      const [sx1, sy1] = m2s(origin.x, origin.y);
      const [sx2, sy2] = m2s(through.x, through.y);
      const rdx = sx2 - sx1, rdy = sy2 - sy1;
      const rlen = Math.hypot(rdx, rdy);
      if (rlen < 0.01) continue;
      // 射线参数 t >= 0
      const t = ((svgX - sx1) * rdx + (svgY - sy1) * rdy) / (rlen * rlen);
      if (t < -0.1) continue; // 在射线反方向
      const px = sx1 + t * rdx, py = sy1 + t * rdy;
      if (Math.hypot(svgX - px, svgY - py) < lineThresh) return ray.id;
    }

    // 多边形命中（边和填充区域）
    for (const poly of polygons) {
      const verts = poly.vertexIds.map((vid) => entities[vid] as DemoMarker | undefined).filter(Boolean) as DemoMarker[];
      if (verts.length < 3) continue;
      // 检查边
      for (let i = 0; i < verts.length; i++) {
        const j = (i + 1) % verts.length;
        const [sx1, sy1] = m2s(verts[i].x, verts[i].y);
        const [sx2, sy2] = m2s(verts[j].x, verts[j].y);
        if (distToSegment(svgX, svgY, sx1, sy1, sx2, sy2) < lineThresh) return poly.id;
      }
    }

    // 运算结果线段命中（允许点击选中运算结果用于后续运算）
    for (const op of ops) {
      if (op.kind === 'dotProduct') continue;
      const res = resolveVec(op.id, entities);
      if (!res) continue;
      const origin = resolveOpOrigin(op, entities);
      const [sx1, sy1] = m2s(origin.x, origin.y);
      const [sx2, sy2] = m2s(origin.x + res[0], origin.y + res[1]);
      if (distToSegment(svgX, svgY, sx1, sy1, sx2, sy2) < lineThresh) return op.id;
    }

    // 滑动条命中
    for (const sl of sliders) {
      const [sx, sy] = m2s(sl.x, sl.y);
      const trackW = sl.width * SCALE;
      if (svgX >= sx - 4 && svgX <= sx + trackW + 4 && Math.abs(svgY - sy) < 14) return sl.id;
    }

    return null;
  }, [entities, points, vectors, ops, markers, segments, circles, texts, lines, rays, polygons, sliders, view.w]);

  // ─── PointerDown（左键/中键平移）───
  const handleSVGPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button === 0 || e.button === 1) {
      e.preventDefault();
      const rect = svgRef.current!.getBoundingClientRect();
      const svgScale = Math.min(rect.width / view.w, rect.height / view.h);
      panRef.current = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        startViewX: view.x,
        startViewY: view.y,
        scale: svgScale,
        moved: false,
      };
      svgRef.current!.setPointerCapture(e.pointerId);
      setIsPanning(true);
    }
  }, [view]);

  // ─── PointerMove（平移 / 拖拽端点 / 拖拽运算起点 / 拖拽标记点 / 拖拽文字 / hover）───
  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;

    // 平移
    if (panRef.current) {
      const { startClientX, startClientY, startViewX, startViewY, scale } = panRef.current;
      const dx = e.clientX - startClientX;
      const dy = e.clientY - startClientY;
      if (!panRef.current.moved && Math.hypot(dx, dy) > 3) {
        panRef.current.moved = true;
      }
      if (panRef.current.moved) {
        setView((v) => ({
          ...v,
          x: startViewX - dx / scale,
          y: startViewY - dy / scale,
        }));
      }
      return;
    }

    const [svgX, svgY] = clientToSVG(e.clientX, e.clientY, svgRef.current);
    setMousePos({ x: svgX, y: svgY });

    // 拖拽端点（含约束模式 + 绑定伙伴约束处理）
    if (draggingPointRef.current) {
      let [mx, my] = svgToMath(svgX, svgY);
      const ptId = draggingPointRef.current.pointId;
      const st = useDemoEntityStore.getState();
      const ents = st.entities;

      // 收集自身 + 所有绑定伙伴的约束
      const group = st.getBoundGroup(ptId);
      const allPtIds = [ptId, ...group];
      const constraintCircles: { cx: number; cy: number; r: number }[] = [];
      let lineConstraint: PointConstraintInfo & { kind: 'line' } | null = null;
      let regionConstraint: PointConstraintInfo & { kind: 'region' } | null = null;
      for (const pid of allPtIds) {
        const c = getPointConstraint(pid, ents);
        if (!c) continue;
        if (c.kind === 'circle') {
          const anchor = ents[c.anchorId] as DemoPoint | undefined;
          if (anchor) constraintCircles.push({ cx: anchor.x, cy: anchor.y, r: c.length });
        } else if (c.kind === 'line') {
          lineConstraint = c;
        } else if (c.kind === 'region') {
          regionConstraint = c;
        }
      }

      if (lineConstraint) {
        const { p1, p2 } = lineConstraint;
        const abx = p2.x - p1.x, aby = p2.y - p1.y;
        const lenSq = abx * abx + aby * aby;
        if (lenSq > 1e-10) {
          const t = ((mx - p1.x) * abx + (my - p1.y) * aby) / lenSq;
          mx = p1.x + t * abx;
          my = p1.y + t * aby;
        }
      } else if (regionConstraint) {
        const { min, max } = regionConstraint;
        [mx, my] = clampToRegion(mx, my, min.x, min.y, max.x, max.y);
      } else if (constraintCircles.length >= 2) {
        let candidates = circleIntersections(
          constraintCircles[0].cx, constraintCircles[0].cy, constraintCircles[0].r,
          constraintCircles[1].cx, constraintCircles[1].cy, constraintCircles[1].r,
        );
        for (let i = 2; i < constraintCircles.length && candidates.length > 0; i++) {
          const c = constraintCircles[i];
          candidates = candidates.filter(([px, py]) => {
            const d = Math.sqrt((px - c.cx) ** 2 + (py - c.cy) ** 2);
            return Math.abs(d - c.r) < 0.15;
          });
        }
        if (candidates.length > 0) {
          let best = candidates[0];
          let bestDist = (mx - best[0]) ** 2 + (my - best[1]) ** 2;
          for (let i = 1; i < candidates.length; i++) {
            const d = (mx - candidates[i][0]) ** 2 + (my - candidates[i][1]) ** 2;
            if (d < bestDist) { best = candidates[i]; bestDist = d; }
          }
          mx = best[0]; my = best[1];
        }
      } else if (constraintCircles.length === 1) {
        [mx, my] = projectOntoConstraint(mx, my, constraintCircles[0].cx, constraintCircles[0].cy, constraintCircles[0].r);
      }

      const cur = draggingPointRef.current.current;
      if (mx !== cur.x || my !== cur.y) {
        draggingPointRef.current.current = { x: mx, y: my };
        draggingPointRef.current.moved = true;
        st.updateEntity(ptId, { x: mx, y: my, xExpr: undefined, yExpr: undefined });
        for (const pid of group) st.updateEntity(pid, { x: mx, y: my, xExpr: undefined, yExpr: undefined });
      }
      return;
    }

    // 拖拽运算起点
    if (draggingOpOriginRef.current) {
      const [mx, my] = svgToMath(svgX, svgY);
      const cur = draggingOpOriginRef.current.current;
      if (mx !== cur.x || my !== cur.y) {
        draggingOpOriginRef.current.current = { x: mx, y: my };
        draggingOpOriginRef.current.moved = true;
        useDemoEntityStore.getState().updateEntity(draggingOpOriginRef.current.opId, { originX: mx, originY: my, originXExpr: undefined, originYExpr: undefined });
      }
      return;
    }

    // 拖拽标记点
    if (draggingMarkerRef.current) {
      const [mx, my] = svgToMath(svgX, svgY);
      const cur = draggingMarkerRef.current.current;
      if (mx !== cur.x || my !== cur.y) {
        draggingMarkerRef.current.current = { x: mx, y: my };
        draggingMarkerRef.current.moved = true;
        useDemoEntityStore.getState().updateEntity(draggingMarkerRef.current.markerId, { x: mx, y: my, xExpr: undefined, yExpr: undefined });
      }
      return;
    }

    // 拖拽文字
    if (draggingTextRef.current) {
      const [mx, my] = svgToMath(svgX, svgY);
      const cur = draggingTextRef.current.current;
      if (mx !== cur.x || my !== cur.y) {
        draggingTextRef.current.current = { x: mx, y: my };
        draggingTextRef.current.moved = true;
        useDemoEntityStore.getState().updateEntity(draggingTextRef.current.textId, { x: mx, y: my, xExpr: undefined, yExpr: undefined });
      }
      return;
    }

    // 拖拽滑动条滑块
    if (draggingSliderRef.current) {
      const sliderId = draggingSliderRef.current.sliderId;
      const slider = useDemoEntityStore.getState().entities[sliderId] as DemoSlider | undefined;
      if (slider) {
        const [sx] = m2s(slider.x, slider.y);
        const trackW = slider.width * SCALE;
        const ratio = Math.max(0, Math.min(1, (svgX - sx) / trackW));
        const rawVal = slider.min + ratio * (slider.max - slider.min);
        const snapped = Math.round(rawVal / slider.step) * slider.step;
        const clamped = Math.max(slider.min, Math.min(slider.max, snapped));
        draggingSliderRef.current.moved = true;
        useDemoEntityStore.getState().updateEntity(sliderId, { value: clamped });
      }
      return;
    }

    // 拖拽整体向量（箭杆）
    if (draggingVecBodyRef.current) {
      const [mx, my] = svgToMath(svgX, svgY);
      const { startId, endId, startBefore, endBefore, grabMath } = draggingVecBodyRef.current;
      const dx = mx - grabMath.x, dy = my - grabMath.y;
      if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
        draggingVecBodyRef.current.moved = true;
        const st = useDemoEntityStore.getState();
        st.updateEntity(startId, { x: startBefore.x + dx, y: startBefore.y + dy, xExpr: undefined, yExpr: undefined });
        st.updateEntity(endId, { x: endBefore.x + dx, y: endBefore.y + dy, xExpr: undefined, yExpr: undefined });
      }
      return;
    }

    setHovered(hitTest(svgX, svgY));

    // 实时吸附指示（工具模式）
    const snapTools: import('@/editor/demo/demoTypes').DemoTool[] = ['markerPoint', 'segment', 'circle', 'line', 'ray', 'polygon'];
    if (snapTools.includes(useDemoToolStore.getState().activeTool)) {
      const [mmx, mmy] = svgToMath(svgX, svgY);
      const snap = computeSnapPoint(mmx, mmy, useDemoEntityStore.getState().entities);
      setSnapIndicator(snap.snapped ? snap : null);
    } else {
      setSnapIndicator(null);
    }
  }, [hitTest, setHovered]);

  // ─── PointerUp（结束平移 / 结束拖拽）───
  const handlePointerUp = useCallback((_e: React.PointerEvent) => {
    if (panRef.current) {
      panWasMovedRef.current = panRef.current.moved;
      panRef.current = null;
      setIsPanning(false);
      return;
    }
    if (draggingPointRef.current) {
      const { pointId, before, current, moved, group } = draggingPointRef.current;
      draggingPointRef.current = null;
      if (moved) {
        execute(new MovePointCmd(pointId, before, { ...current, xExpr: undefined, yExpr: undefined }));
        for (const g of group) {
          execute(new MovePointCmd(g.id, g.before, { ...current, xExpr: undefined, yExpr: undefined }));
        }
      }
    }
    if (draggingOpOriginRef.current) {
      const { opId, before, current, moved } = draggingOpOriginRef.current;
      draggingOpOriginRef.current = null;
      if (moved) execute(new UpdateVecOpCmd(opId,
        { originX: before.x, originY: before.y, originXExpr: before.originXExpr, originYExpr: before.originYExpr },
        { originX: current.x, originY: current.y, originXExpr: undefined, originYExpr: undefined }));
    }
    if (draggingMarkerRef.current) {
      const { markerId, before, current, moved } = draggingMarkerRef.current;
      draggingMarkerRef.current = null;
      if (moved) execute(new UpdateMarkerCmd(markerId, before, { x: current.x, y: current.y, xExpr: undefined, yExpr: undefined }));
    }
    if (draggingTextRef.current) {
      const { textId, before, current, moved } = draggingTextRef.current;
      draggingTextRef.current = null;
      if (moved) execute(new UpdateTextCmd(textId, before, { x: current.x, y: current.y, xExpr: undefined, yExpr: undefined }));
    }
    if (draggingSliderRef.current) {
      const { sliderId, before, moved } = draggingSliderRef.current;
      draggingSliderRef.current = null;
      if (moved) {
        const slider = useDemoEntityStore.getState().entities[sliderId] as DemoSlider | undefined;
        if (slider) execute(new UpdateGenericCmd(sliderId, { value: before }, { value: slider.value }));
      }
    }
    if (draggingVecBodyRef.current) {
      const { startId, endId, startBefore, endBefore, moved } = draggingVecBodyRef.current;
      draggingVecBodyRef.current = null;
      if (moved) {
        const st = useDemoEntityStore.getState();
        const sp = st.entities[startId] as DemoPoint | undefined;
        const ep = st.entities[endId] as DemoPoint | undefined;
        if (sp && ep) {
          execute(new MovePointCmd(startId, startBefore, { x: sp.x, y: sp.y, xExpr: undefined, yExpr: undefined }));
          execute(new MovePointCmd(endId, endBefore, { x: ep.x, y: ep.y, xExpr: undefined, yExpr: undefined }));
        }
      }
    }
  }, [execute]);

  const handleMouseLeave = useCallback(() => {
    setMousePos(null);
    setHovered(null);
  }, [setHovered]);

  // ─── 点击处理（工具逻辑）───
  const handleCanvasClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    if (panRef.current) return;
    if (panWasMovedRef.current) { panWasMovedRef.current = false; return; }
    if (draggingPointRef.current?.moved) return;
    if (draggingOpOriginRef.current?.moved) return;
    if (draggingMarkerRef.current?.moved) return;
    if (draggingTextRef.current?.moved) return;
    const [svgX, svgY] = clientToSVG(e.clientX, e.clientY, svgRef.current);
    let [mx, my] = svgToMath(svgX, svgY);
    const hitId = hitTest(svgX, svgY);

    // 吸附逻辑：markerPoint/segment/circle 工具生效
    const snapTools: import('@/editor/demo/demoTypes').DemoTool[] = ['markerPoint', 'segment', 'circle', 'line', 'ray', 'polygon'];
    if (snapTools.includes(activeTool)) {
      const snap = computeSnapPoint(mx, my, entities);
      if (snap.snapped) {
        mx = snap.x;
        my = snap.y;
        setSnapIndicator(snap);
      } else {
        setSnapIndicator(null);
      }
    }

    if (activeTool === 'select') {
      select(hitId);
      return;
    }

    if (activeTool === 'createVector') {
      if (step === 0) {
        setPendingStart({ x: mx, y: my });
        nextStep();
      } else if (step === 1 && pendingStartPoint) {
        const label = nextVecLabel();
        const color = DEMO_COLORS[vecCount % DEMO_COLORS.length];
        const startId = nextEntityId();
        const endId = nextEntityId();
        const vecId = nextEntityId();
        execute(new CreateVectorCmd(
          { id: startId, type: 'demoPoint', x: pendingStartPoint.x, y: pendingStartPoint.y, label: '' },
          { id: endId, type: 'demoPoint', x: mx, y: my, label: '' },
          { id: vecId, type: 'demoVector', startId, endId, color, label, showLabel: true },
        ));
        select(vecId);
        setTool('select');
      }
      return;
    }

    if (activeTool === 'vectorOp' && opKind) {
      // 可选目标：demoVector 或产生向量结果的 demoVecOp（排除 dotProduct）
      const isVecLike = (id: string) => {
        const en = entities[id];
        if (!en) return false;
        if (en.type === 'demoVector') return true;
        if (en.type === 'demoVecOp' && (en as DemoVecOp).kind !== 'dotProduct') return true;
        return false;
      };
      if (opKind === 'scale') {
        if (hitId && isVecLike(hitId)) {
          const opId = nextEntityId();
          execute(new CreateVecOpCmd({ id: opId, type: 'demoVecOp', kind: 'scale', vec1Id: hitId, scalarK: 2 }));
          resetTool();
          useDemoToolStore.getState().setTool('select');
        }
        return;
      }
      if (step === 0) {
        if (hitId && isVecLike(hitId)) {
          setPendingVec1(hitId);
          nextStep();
        }
      } else if (step === 1 && pendingVec1Id) {
        if (hitId && isVecLike(hitId) && hitId !== pendingVec1Id && !hasCycle(hitId, pendingVec1Id, entities)) {
          const opId = nextEntityId();
          execute(new CreateVecOpCmd({ id: opId, type: 'demoVecOp', kind: opKind, vec1Id: pendingVec1Id, vec2Id: hitId }));
          resetTool();
          useDemoToolStore.getState().setTool('select');
        }
      }
      return;
    }

    // ─── markerPoint 工具：单击放置标记点 ───
    if (activeTool === 'markerPoint') {
      const label = nextMarkerLabel(entities);
      const color = DEMO_COLORS[markers.length % DEMO_COLORS.length];
      const mkId = nextEntityId();
      execute(new CreateMarkerCmd({
        id: mkId, type: 'demoMarker', x: mx, y: my, label, color, showCoord: false,
      }));
      select(mkId);
      return;
    }

    // ─── segment 工具：2次点击（命中 marker 复用，否则新建 marker）───
    if (activeTool === 'segment') {
      const resolveOrCreateMarker = (): string => {
        if (hitId) {
          const hitEnt = entities[hitId];
          if (hitEnt && hitEnt.type === 'demoMarker') return hitId;
        }
        // 自动创建新标记点
        const label = nextMarkerLabel(entities);
        const color = DEMO_COLORS[(markers.length) % DEMO_COLORS.length];
        const mkId = nextEntityId();
        execute(new CreateMarkerCmd({
          id: mkId, type: 'demoMarker', x: mx, y: my, label, color, showCoord: false,
        }));
        return mkId;
      };

      if (step === 0) {
        const startMkId = resolveOrCreateMarker();
        pushPendingMarker(startMkId);
        nextStep();
      } else if (step === 1 && pendingMarkerIds.length >= 1) {
        const endMkId = resolveOrCreateMarker();
        if (endMkId === pendingMarkerIds[0]) return; // 不允许自环
        const segId = nextEntityId();
        // 收集此次新建的 marker（CreateSegmentCmd 中不再额外创建，已通过 resolveOrCreateMarker 创建）
        execute(new CreateSegmentCmd(
          { id: segId, type: 'demoSegment', startId: pendingMarkerIds[0], endId: endMkId, color: '#8C8C8C', style: 'solid', showLength: true },
          [],
        ));
        select(segId);
        resetTool();
      }
      return;
    }

    // ─── circle 工具：2次点击（圆心 marker + 半径点 marker）───
    if (activeTool === 'circle') {
      const resolveOrCreateMarker = (): string => {
        if (hitId) {
          const hitEnt = entities[hitId];
          if (hitEnt && hitEnt.type === 'demoMarker') return hitId;
        }
        const label = nextMarkerLabel(entities);
        const color = DEMO_COLORS[(markers.length) % DEMO_COLORS.length];
        const mkId = nextEntityId();
        execute(new CreateMarkerCmd({
          id: mkId, type: 'demoMarker', x: mx, y: my, label, color, showCoord: false,
        }));
        return mkId;
      };

      if (step === 0) {
        const centerId = resolveOrCreateMarker();
        pushPendingMarker(centerId);
        nextStep();
      } else if (step === 1 && pendingMarkerIds.length >= 1) {
        const radiusPtId = resolveOrCreateMarker();
        if (radiusPtId === pendingMarkerIds[0]) return;
        const cirId = nextEntityId();
        execute(new CreateCircleCmd(
          { id: cirId, type: 'demoCircle', centerId: pendingMarkerIds[0], radiusPointId: radiusPtId, color: '#2196F3', style: 'solid', fill: false },
          [],
        ));
        select(cirId);
        resetTool();
      }
      return;
    }

    // ─── textLabel 工具：单击放置文字 ───
    if (activeTool === 'textLabel') {
      const content = window.prompt('输入文字标签内容：', '标签');
      if (!content) return;
      const txtId = nextEntityId();
      execute(new CreateTextCmd({
        id: txtId, type: 'demoText', x: mx, y: my, text: content, fontSize: 16, color: COLORS.text,
      }));
      select(txtId);
      resetTool();
      useDemoToolStore.getState().setTool('select');
      return;
    }

    // ─── angleMark 工具：3次点击选择3个已有 marker（A, V顶点, C）───
    if (activeTool === 'angleMark') {
      if (!hitId) return;
      const hitEnt = entities[hitId];
      if (!hitEnt || hitEnt.type !== 'demoMarker') return;
      // 不允许重复选择同一个点
      if (pendingMarkerIds.includes(hitId)) return;

      if (step === 0) {
        pushPendingMarker(hitId);
        nextStep();
      } else if (step === 1 && pendingMarkerIds.length >= 1) {
        pushPendingMarker(hitId);
        nextStep();
      } else if (step === 2 && pendingMarkerIds.length >= 2) {
        const amId = nextEntityId();
        execute(new CreateAngleMarkCmd({
          id: amId, type: 'demoAngleMark',
          pointAId: pendingMarkerIds[0], vertexId: pendingMarkerIds[1], pointCId: hitId,
          color: '#FF9800', showValue: true,
        }));
        select(amId);
        resetTool();
        useDemoToolStore.getState().setTool('select');
      }
      return;
    }

    // ─── distanceMark 工具：2次点击选择2个已有 marker ───
    if (activeTool === 'distanceMark') {
      if (!hitId) return;
      const hitEnt = entities[hitId];
      if (!hitEnt || hitEnt.type !== 'demoMarker') return;
      if (pendingMarkerIds.includes(hitId)) return;

      if (step === 0) {
        pushPendingMarker(hitId);
        nextStep();
      } else if (step === 1 && pendingMarkerIds.length >= 1) {
        const dmId = nextEntityId();
        execute(new CreateDistanceMarkCmd({
          id: dmId, type: 'demoDistanceMark',
          pointAId: pendingMarkerIds[0], pointBId: hitId,
          color: '#9C27B0', offset: 0.4,
        }));
        select(dmId);
        resetTool();
        useDemoToolStore.getState().setTool('select');
      }
      return;
    }

    // ─── 构造工具：垂线（2步：选点P → 选线段AB）───
    if (activeTool === 'perpendicular') {
      if (step === 0) {
        if (!hitId) return;
        const hitEnt = entities[hitId];
        if (!hitEnt || hitEnt.type !== 'demoMarker') return;
        pushPendingMarker(hitId);
        nextStep();
      } else if (step === 1 && pendingMarkerIds.length >= 1) {
        if (!hitId) return;
        const hitEnt = entities[hitId];
        if (!hitEnt || hitEnt.type !== 'demoSegment') return;
        const seg = hitEnt as DemoSegment;
        const pMk = entities[pendingMarkerIds[0]] as DemoMarker;
        const aMk = entities[seg.startId] as DemoMarker;
        const bMk = entities[seg.endId] as DemoMarker;
        if (!pMk || !aMk || !bMk) return;

        const [fx, fy] = footOnSegment(pMk.x, pMk.y, aMk.x, aMk.y, bMk.x, bMk.y);
        const footId = nextEntityId();
        const footMk: DemoMarker = { id: footId, type: 'demoMarker', x: fx, y: fy, label: nextMarkerLabel(entities), color: '#8C8C8C', showCoord: false };
        const perpSegId = nextEntityId();
        const perpSeg: DemoSegment = { id: perpSegId, type: 'demoSegment', startId: pendingMarkerIds[0], endId: footId, color: '#4ECDC4', style: 'dashed', showLength: true };
        const amId = nextEntityId();
        const rightAngle: DemoAngleMark = { id: amId, type: 'demoAngleMark', pointAId: pendingMarkerIds[0], vertexId: footId, pointCId: seg.startId, color: '#FF9800', showValue: true };

        execute(new CreateConstructionCmd('构造垂线', [footMk, perpSeg, rightAngle]));
        select(perpSegId);
        resetTool();
        useDemoToolStore.getState().setTool('select');
      }
      return;
    }

    // ─── 构造工具：平行线（2步：选点P → 选线段AB）───
    if (activeTool === 'parallelLine') {
      if (step === 0) {
        if (!hitId) return;
        const hitEnt = entities[hitId];
        if (!hitEnt || hitEnt.type !== 'demoMarker') return;
        pushPendingMarker(hitId);
        nextStep();
      } else if (step === 1 && pendingMarkerIds.length >= 1) {
        if (!hitId) return;
        const hitEnt = entities[hitId];
        if (!hitEnt || hitEnt.type !== 'demoSegment') return;
        const seg = hitEnt as DemoSegment;
        const pMk = entities[pendingMarkerIds[0]] as DemoMarker;
        const aMk = entities[seg.startId] as DemoMarker;
        const bMk = entities[seg.endId] as DemoMarker;
        if (!pMk || !aMk || !bMk) return;

        const dx = bMk.x - aMk.x, dy = bMk.y - aMk.y;
        const startId = nextEntityId();
        const startMk: DemoMarker = { id: startId, type: 'demoMarker', x: pMk.x - dx / 2, y: pMk.y - dy / 2, label: nextMarkerLabel(entities), color: '#8C8C8C', showCoord: false };
        const endId = nextEntityId();
        const endMk: DemoMarker = { id: endId, type: 'demoMarker', x: pMk.x + dx / 2, y: pMk.y + dy / 2, label: nextMarkerLabel({ ...entities, [startId]: startMk }), color: '#8C8C8C', showCoord: false };
        const parSegId = nextEntityId();
        const parSeg: DemoSegment = { id: parSegId, type: 'demoSegment', startId, endId, color: '#2196F3', style: 'solid', showLength: true };

        execute(new CreateConstructionCmd('构造平行线', [startMk, endMk, parSeg]));
        select(parSegId);
        resetTool();
        useDemoToolStore.getState().setTool('select');
      }
      return;
    }

    // ─── 构造工具：中点（1步：点击线段）───
    if (activeTool === 'midpoint') {
      if (!hitId) return;
      const hitEnt = entities[hitId];
      if (!hitEnt || hitEnt.type !== 'demoSegment') return;
      const seg = hitEnt as DemoSegment;
      const aMk = entities[seg.startId] as DemoMarker;
      const bMk = entities[seg.endId] as DemoMarker;
      if (!aMk || !bMk) return;
      const midId = nextEntityId();
      const midMk: DemoMarker = { id: midId, type: 'demoMarker', x: (aMk.x + bMk.x) / 2, y: (aMk.y + bMk.y) / 2, label: nextMarkerLabel(entities), color: '#FF6B6B', showCoord: false };
      execute(new CreateConstructionCmd('构造中点', [midMk]));
      select(midId);
      resetTool();
      useDemoToolStore.getState().setTool('select');
      return;
    }

    // ─── 构造工具：垂直平分线（1步：点击线段）───
    if (activeTool === 'perpBisector') {
      if (!hitId) return;
      const hitEnt = entities[hitId];
      if (!hitEnt || hitEnt.type !== 'demoSegment') return;
      const seg = hitEnt as DemoSegment;
      const aMk = entities[seg.startId] as DemoMarker;
      const bMk = entities[seg.endId] as DemoMarker;
      if (!aMk || !bMk) return;

      const mx = (aMk.x + bMk.x) / 2, my = (aMk.y + bMk.y) / 2;
      const sdx = bMk.x - aMk.x, sdy = bMk.y - aMk.y;
      const sLen = Math.hypot(sdx, sdy);
      const halfExt = Math.max(sLen / 2, 1);
      const nx = sLen > 1e-10 ? -sdy / sLen * halfExt : 0;
      const ny = sLen > 1e-10 ? sdx / sLen * halfExt : halfExt;

      const midId = nextEntityId();
      const midMk: DemoMarker = { id: midId, type: 'demoMarker', x: mx, y: my, label: nextMarkerLabel(entities), color: '#FF6B6B', showCoord: false };
      const s1Id = nextEntityId();
      const s1Mk: DemoMarker = { id: s1Id, type: 'demoMarker', x: mx + nx, y: my + ny, label: nextMarkerLabel({ ...entities, [midId]: midMk }), color: '#8C8C8C', showCoord: false };
      const s2Id = nextEntityId();
      const s2Mk: DemoMarker = { id: s2Id, type: 'demoMarker', x: mx - nx, y: my - ny, label: nextMarkerLabel({ ...entities, [midId]: midMk, [s1Id]: s1Mk }), color: '#8C8C8C', showCoord: false };
      const bisSegId = nextEntityId();
      const bisSeg: DemoSegment = { id: bisSegId, type: 'demoSegment', startId: s1Id, endId: s2Id, color: '#9C27B0', style: 'dashed', showLength: false };

      execute(new CreateConstructionCmd('构造垂直平分线', [midMk, s1Mk, s2Mk, bisSeg]));
      select(midId);
      resetTool();
      useDemoToolStore.getState().setTool('select');
      return;
    }

    // ─── 构造工具：角平分线（3步：选点A → 选顶点V → 选点C）───
    if (activeTool === 'angleBisector') {
      if (!hitId) return;
      const hitEnt = entities[hitId];
      if (!hitEnt || hitEnt.type !== 'demoMarker') return;
      if (pendingMarkerIds.includes(hitId)) return;

      if (step === 0) {
        pushPendingMarker(hitId);
        nextStep();
      } else if (step === 1 && pendingMarkerIds.length >= 1) {
        pushPendingMarker(hitId);
        nextStep();
      } else if (step === 2 && pendingMarkerIds.length >= 2) {
        const mkA = entities[pendingMarkerIds[0]] as DemoMarker;
        const mkV = entities[pendingMarkerIds[1]] as DemoMarker;
        const mkC = entities[hitId] as DemoMarker;
        if (!mkA || !mkV || !mkC) return;

        const [bx, by] = angleBisectorDir(mkA.x, mkA.y, mkV.x, mkV.y, mkC.x, mkC.y);
        const lenVA = Math.hypot(mkA.x - mkV.x, mkA.y - mkV.y);
        const lenVC = Math.hypot(mkC.x - mkV.x, mkC.y - mkV.y);
        const bisectLen = Math.max((lenVA + lenVC) / 2, 1);

        const endId = nextEntityId();
        const endMk: DemoMarker = { id: endId, type: 'demoMarker', x: mkV.x + bx * bisectLen, y: mkV.y + by * bisectLen, label: nextMarkerLabel(entities), color: '#FFD700', showCoord: false };
        const bisSegId = nextEntityId();
        const bisSeg: DemoSegment = { id: bisSegId, type: 'demoSegment', startId: pendingMarkerIds[1], endId, color: '#FFD700', style: 'dashed', showLength: false };

        execute(new CreateConstructionCmd('构造角平分线', [endMk, bisSeg]));
        select(bisSegId);
        resetTool();
        useDemoToolStore.getState().setTool('select');
      }
      return;
    }

    // ─── 构造工具：点到直线距离（2步：选点P → 选线段AB）───
    if (activeTool === 'pointLineDist') {
      if (step === 0) {
        if (!hitId) return;
        const hitEnt = entities[hitId];
        if (!hitEnt || hitEnt.type !== 'demoMarker') return;
        pushPendingMarker(hitId);
        nextStep();
      } else if (step === 1 && pendingMarkerIds.length >= 1) {
        if (!hitId) return;
        const hitEnt = entities[hitId];
        if (!hitEnt || hitEnt.type !== 'demoSegment') return;
        const seg = hitEnt as DemoSegment;
        const pMk = entities[pendingMarkerIds[0]] as DemoMarker;
        const aMk = entities[seg.startId] as DemoMarker;
        const bMk = entities[seg.endId] as DemoMarker;
        if (!pMk || !aMk || !bMk) return;

        const [fx, fy] = footOfPerpendicular(pMk.x, pMk.y, aMk.x, aMk.y, bMk.x, bMk.y);
        const footId = nextEntityId();
        const footMk: DemoMarker = { id: footId, type: 'demoMarker', x: fx, y: fy, label: nextMarkerLabel(entities), color: '#8C8C8C', showCoord: false };
        const perpSegId = nextEntityId();
        const perpSeg: DemoSegment = { id: perpSegId, type: 'demoSegment', startId: pendingMarkerIds[0], endId: footId, color: '#4ECDC4', style: 'dashed', showLength: false };
        const distId = nextEntityId();
        const distMk: DemoDistanceMark = { id: distId, type: 'demoDistanceMark', pointAId: pendingMarkerIds[0], pointBId: footId, color: '#9C27B0', offset: 0.4 };

        execute(new CreateConstructionCmd('点到直线距离', [footMk, perpSeg, distMk]));
        select(distId);
        resetTool();
        useDemoToolStore.getState().setTool('select');
      }
      return;
    }

    // ─── line 工具：2次点击确定直线 ───
    if (activeTool === 'line') {
      const resolveOrCreateMarker = (): string => {
        if (hitId) {
          const hitEnt = entities[hitId];
          if (hitEnt && hitEnt.type === 'demoMarker') return hitId;
        }
        const label = nextMarkerLabel(entities);
        const color = DEMO_COLORS[(markers.length) % DEMO_COLORS.length];
        const mkId = nextEntityId();
        execute(new CreateMarkerCmd({ id: mkId, type: 'demoMarker', x: mx, y: my, label, color, showCoord: false }));
        return mkId;
      };
      if (step === 0) {
        const pt1Id = resolveOrCreateMarker();
        pushPendingMarker(pt1Id);
        nextStep();
      } else if (step === 1 && pendingMarkerIds.length >= 1) {
        const pt2Id = resolveOrCreateMarker();
        if (pt2Id === pendingMarkerIds[0]) return;
        const lineId = nextEntityId();
        const lineEnt: DemoLine = { id: lineId, type: 'demoLine', point1Id: pendingMarkerIds[0], point2Id: pt2Id, color: '#8C8C8C', style: 'solid', showSlope: false };
        execute(new CreateConstructionCmd('创建直线', [lineEnt]));
        select(lineId);
        resetTool();
      }
      return;
    }

    // ─── ray 工具：2次点击确定射线 ───
    if (activeTool === 'ray') {
      const resolveOrCreateMarker = (): string => {
        if (hitId) {
          const hitEnt = entities[hitId];
          if (hitEnt && hitEnt.type === 'demoMarker') return hitId;
        }
        const label = nextMarkerLabel(entities);
        const color = DEMO_COLORS[(markers.length) % DEMO_COLORS.length];
        const mkId = nextEntityId();
        execute(new CreateMarkerCmd({ id: mkId, type: 'demoMarker', x: mx, y: my, label, color, showCoord: false }));
        return mkId;
      };
      if (step === 0) {
        const originId = resolveOrCreateMarker();
        pushPendingMarker(originId);
        nextStep();
      } else if (step === 1 && pendingMarkerIds.length >= 1) {
        const throughId = resolveOrCreateMarker();
        if (throughId === pendingMarkerIds[0]) return;
        const rayId = nextEntityId();
        const rayEnt: DemoRay = { id: rayId, type: 'demoRay', originId: pendingMarkerIds[0], throughId, color: '#8C8C8C', style: 'solid' };
        execute(new CreateConstructionCmd('创建射线', [rayEnt]));
        select(rayId);
        resetTool();
      }
      return;
    }

    // ─── polygon 工具：多次点击选 marker，双击完成闭合 ───
    if (activeTool === 'polygon') {
      const resolveOrCreateMarker = (): string => {
        if (hitId) {
          const hitEnt = entities[hitId];
          if (hitEnt && hitEnt.type === 'demoMarker') return hitId;
        }
        const label = nextMarkerLabel(entities);
        const color = DEMO_COLORS[(markers.length) % DEMO_COLORS.length];
        const mkId = nextEntityId();
        execute(new CreateMarkerCmd({ id: mkId, type: 'demoMarker', x: mx, y: my, label, color, showCoord: false }));
        return mkId;
      };
      const mkId = resolveOrCreateMarker();
      // 如果点击了第一个 marker 且已有 >= 3 个顶点，闭合多边形
      if (pendingMarkerIds.length >= 3 && mkId === pendingMarkerIds[0]) {
        const polyId = nextEntityId();
        const polyEnt: DemoPolygon = { id: polyId, type: 'demoPolygon', vertexIds: [...pendingMarkerIds], color: '#4ECDC4', fill: true, showArea: true };
        execute(new CreateConstructionCmd('创建多边形', [polyEnt]));
        select(polyId);
        resetTool();
      } else {
        if (!pendingMarkerIds.includes(mkId)) {
          pushPendingMarker(mkId);
          nextStep();
        }
      }
      return;
    }

    // ─── slider 工具：单击放置 ───
    if (activeTool === 'slider') {
      const sliderId = nextEntityId();
      const sliderEnt: DemoSlider = {
        id: sliderId, type: 'demoSlider', x: mx, y: my,
        label: 't', min: 0, max: 10, step: 0.1, value: 5, width: 3, color: COLORS.primary,
      };
      execute(new CreateConstructionCmd('创建滑动条', [sliderEnt]));
      select(sliderId);
      resetTool();
      useDemoToolStore.getState().setTool('select');
      return;
    }

    // ─── translate 工具：2步 — 先选实体（marker），再选向量/两个点定方向 ───
    if (activeTool === 'translate') {
      if (step === 0) {
        // 选择要平移的实体（marker）
        if (!hitId) return;
        const hitEnt = entities[hitId];
        if (!hitEnt || hitEnt.type !== 'demoMarker') return;
        pushPendingMarker(hitId);
        nextStep();
      } else if (step === 1 && pendingMarkerIds.length >= 1) {
        // 选择向量（点击一个向量，或输入平移量）
        if (!hitId) return;
        const hitEnt = entities[hitId];
        if (hitEnt && hitEnt.type === 'demoVector') {
          const vec = hitEnt as DemoVector;
          const sp = entities[vec.startId] as DemoPoint | undefined;
          const ep = entities[vec.endId] as DemoPoint | undefined;
          if (!sp || !ep) return;
          const dx = ep.x - sp.x, dy = ep.y - sp.y;
          // 对所有 pending marker 执行平移
          const produced: import('@/editor/demo/demoTypes').DemoEntity[] = [];
          for (const pmId of pendingMarkerIds) {
            const pm = entities[pmId] as DemoMarker;
            if (!pm) continue;
            const newId = nextEntityId();
            produced.push({ ...pm, id: newId, x: pm.x + dx, y: pm.y + dy, label: nextMarkerLabel({ ...entities, ...Object.fromEntries(produced.map((p) => [p.id, p])) }) } as DemoMarker);
          }
          execute(new TransformEntitiesCmd('平移', produced));
          resetTool();
          useDemoToolStore.getState().setTool('select');
        }
      }
      return;
    }

    // ─── rotate 工具：3步 — 选实体 → 选旋转中心 → 输入角度 ───
    if (activeTool === 'rotate') {
      if (step === 0) {
        if (!hitId) return;
        const hitEnt = entities[hitId];
        if (!hitEnt || hitEnt.type !== 'demoMarker') return;
        pushPendingMarker(hitId);
        nextStep();
      } else if (step === 1 && pendingMarkerIds.length >= 1) {
        if (!hitId) return;
        const hitEnt = entities[hitId];
        if (!hitEnt || hitEnt.type !== 'demoMarker') return;
        if (pendingMarkerIds.includes(hitId)) return;
        pushPendingMarker(hitId);
        nextStep();
      } else if (step === 2 && pendingMarkerIds.length >= 2) {
        const angleStr = window.prompt('输入旋转角度（度）：', '90');
        if (!angleStr) return;
        const angleDeg = parseFloat(angleStr);
        if (isNaN(angleDeg)) return;
        const angleRad = (angleDeg * Math.PI) / 180;
        const center = entities[pendingMarkerIds[1]] as DemoMarker;
        const srcIds = pendingMarkerIds.slice(0, -1); // 不包括中心点
        const produced: import('@/editor/demo/demoTypes').DemoEntity[] = [];
        const allEnts = { ...entities };
        for (const pmId of srcIds) {
          const pm = entities[pmId] as DemoMarker;
          if (!pm) continue;
          const [nx, ny] = rotatePoint(pm.x, pm.y, center.x, center.y, angleRad);
          const newId = nextEntityId();
          const newMk: DemoMarker = { ...pm, id: newId, x: nx, y: ny, label: nextMarkerLabel(allEnts) };
          produced.push(newMk);
          allEnts[newId] = newMk;
        }
        execute(new TransformEntitiesCmd(`旋转 ${angleDeg}°`, produced));
        resetTool();
        useDemoToolStore.getState().setTool('select');
      }
      return;
    }

    // ─── reflect 工具：2步 — 选实体 → 选对称轴（线段）───
    if (activeTool === 'reflect') {
      if (step === 0) {
        if (!hitId) return;
        const hitEnt = entities[hitId];
        if (!hitEnt || hitEnt.type !== 'demoMarker') return;
        pushPendingMarker(hitId);
        nextStep();
      } else if (step === 1 && pendingMarkerIds.length >= 1) {
        if (!hitId) return;
        const hitEnt = entities[hitId];
        if (!hitEnt || hitEnt.type !== 'demoSegment') return;
        const seg = hitEnt as DemoSegment;
        const aMk = entities[seg.startId] as DemoMarker;
        const bMk = entities[seg.endId] as DemoMarker;
        if (!aMk || !bMk) return;
        const produced: import('@/editor/demo/demoTypes').DemoEntity[] = [];
        const allEnts = { ...entities };
        for (const pmId of pendingMarkerIds) {
          const pm = entities[pmId] as DemoMarker;
          if (!pm) continue;
          const [nx, ny] = reflectPoint(pm.x, pm.y, aMk.x, aMk.y, bMk.x, bMk.y);
          const newId = nextEntityId();
          const newMk: DemoMarker = { ...pm, id: newId, x: nx, y: ny, label: nextMarkerLabel(allEnts) };
          produced.push(newMk);
          allEnts[newId] = newMk;
        }
        execute(new TransformEntitiesCmd('轴对称', produced));
        resetTool();
        useDemoToolStore.getState().setTool('select');
      }
      return;
    }

    // ─── dilate 工具：3步 — 选实体 → 选中心 → 输入比例 ───
    if (activeTool === 'dilate') {
      if (step === 0) {
        if (!hitId) return;
        const hitEnt = entities[hitId];
        if (!hitEnt || hitEnt.type !== 'demoMarker') return;
        pushPendingMarker(hitId);
        nextStep();
      } else if (step === 1 && pendingMarkerIds.length >= 1) {
        if (!hitId) return;
        const hitEnt = entities[hitId];
        if (!hitEnt || hitEnt.type !== 'demoMarker') return;
        if (pendingMarkerIds.includes(hitId)) return;
        pushPendingMarker(hitId);
        nextStep();
      } else if (step === 2 && pendingMarkerIds.length >= 2) {
        const ratioStr = window.prompt('输入位似比例：', '2');
        if (!ratioStr) return;
        const ratio = parseFloat(ratioStr);
        if (isNaN(ratio)) return;
        const center = entities[pendingMarkerIds[1]] as DemoMarker;
        const srcIds = pendingMarkerIds.slice(0, -1);
        const produced: import('@/editor/demo/demoTypes').DemoEntity[] = [];
        const allEnts = { ...entities };
        for (const pmId of srcIds) {
          const pm = entities[pmId] as DemoMarker;
          if (!pm) continue;
          const [nx, ny] = dilatePoint(pm.x, pm.y, center.x, center.y, ratio);
          const newId = nextEntityId();
          const newMk: DemoMarker = { ...pm, id: newId, x: nx, y: ny, label: nextMarkerLabel(allEnts) };
          produced.push(newMk);
          allEnts[newId] = newMk;
        }
        execute(new TransformEntitiesCmd(`位似 k=${ratio}`, produced));
        resetTool();
        useDemoToolStore.getState().setTool('select');
      }
      return;
    }

    // ─── centralSymmetry 工具：2步 — 选实体 → 选中心 ───
    if (activeTool === 'centralSymmetry') {
      if (step === 0) {
        if (!hitId) return;
        const hitEnt = entities[hitId];
        if (!hitEnt || hitEnt.type !== 'demoMarker') return;
        pushPendingMarker(hitId);
        nextStep();
      } else if (step === 1 && pendingMarkerIds.length >= 1) {
        if (!hitId) return;
        const hitEnt = entities[hitId];
        if (!hitEnt || hitEnt.type !== 'demoMarker') return;
        if (pendingMarkerIds.includes(hitId)) return;
        const center = hitEnt as DemoMarker;
        const produced: import('@/editor/demo/demoTypes').DemoEntity[] = [];
        const allEnts = { ...entities };
        for (const pmId of pendingMarkerIds) {
          const pm = entities[pmId] as DemoMarker;
          if (!pm) continue;
          const nx = 2 * center.x - pm.x;
          const ny = 2 * center.y - pm.y;
          const newId = nextEntityId();
          const newMk: DemoMarker = { ...pm, id: newId, x: nx, y: ny, label: nextMarkerLabel(allEnts) };
          produced.push(newMk);
          allEnts[newId] = newMk;
        }
        execute(new TransformEntitiesCmd('中心对称', produced));
        resetTool();
        useDemoToolStore.getState().setTool('select');
      }
      return;
    }

    // ─── tangent 工具：2步 — 选外部点 → 选圆 ───
    if (activeTool === 'tangent') {
      if (step === 0) {
        if (!hitId) return;
        const hitEnt = entities[hitId];
        if (!hitEnt || hitEnt.type !== 'demoMarker') return;
        pushPendingMarker(hitId);
        nextStep();
      } else if (step === 1 && pendingMarkerIds.length >= 1) {
        if (!hitId) return;
        const hitEnt = entities[hitId];
        if (!hitEnt || hitEnt.type !== 'demoCircle') return;
        const cir = hitEnt as DemoCircle;
        const pMk = entities[pendingMarkerIds[0]] as DemoMarker;
        const centerMk = entities[cir.centerId] as DemoMarker;
        const rPt = entities[cir.radiusPointId] as DemoMarker;
        if (!pMk || !centerMk || !rPt) return;
        const r = Math.hypot(rPt.x - centerMk.x, rPt.y - centerMk.y);
        const tps = tangentPoints(pMk.x, pMk.y, centerMk.x, centerMk.y, r);
        if (!tps) return; // 点在圆内
        const produced: import('@/editor/demo/demoTypes').DemoEntity[] = [];
        const allEnts = { ...entities };
        for (const tp of tps) {
          const tpId = nextEntityId();
          const tpMk: DemoMarker = { id: tpId, type: 'demoMarker', x: tp[0], y: tp[1], label: nextMarkerLabel(allEnts), color: '#FFD700', showCoord: false };
          produced.push(tpMk);
          allEnts[tpId] = tpMk;
          const segId = nextEntityId();
          produced.push({ id: segId, type: 'demoSegment', startId: pendingMarkerIds[0], endId: tpId, color: '#FFD700', style: 'dashed', showLength: false } as DemoSegment);
        }
        execute(new CreateConstructionCmd('构造切线', produced));
        resetTool();
        useDemoToolStore.getState().setTool('select');
      }
      return;
    }

    // ─── commonTangent 工具：2步 — 选圆1 → 选圆2 ───
    if (activeTool === 'commonTangent') {
      if (step === 0) {
        if (!hitId) return;
        const hitEnt = entities[hitId];
        if (!hitEnt || hitEnt.type !== 'demoCircle') return;
        pushPendingMarker(hitId); // 暂存圆的 id
        nextStep();
      } else if (step === 1 && pendingMarkerIds.length >= 1) {
        if (!hitId) return;
        const hitEnt = entities[hitId];
        if (!hitEnt || hitEnt.type !== 'demoCircle') return;
        if (hitId === pendingMarkerIds[0]) return;
        const cir1 = entities[pendingMarkerIds[0]] as DemoCircle;
        const cir2 = hitEnt as DemoCircle;
        const c1 = entities[cir1.centerId] as DemoMarker;
        const r1p = entities[cir1.radiusPointId] as DemoMarker;
        const c2 = entities[cir2.centerId] as DemoMarker;
        const r2p = entities[cir2.radiusPointId] as DemoMarker;
        if (!c1 || !r1p || !c2 || !r2p) return;
        const r1 = Math.hypot(r1p.x - c1.x, r1p.y - c1.y);
        const r2 = Math.hypot(r2p.x - c2.x, r2p.y - c2.y);
        const extTangents = commonExternalTangents(c1.x, c1.y, r1, c2.x, c2.y, r2);
        const intTangents = commonInternalTangents(c1.x, c1.y, r1, c2.x, c2.y, r2);
        const allTangents = [...extTangents, ...intTangents];
        if (allTangents.length === 0) return;
        const produced: import('@/editor/demo/demoTypes').DemoEntity[] = [];
        const allEnts = { ...entities };
        for (const [tp1, tp2] of allTangents) {
          const id1 = nextEntityId();
          const mk1: DemoMarker = { id: id1, type: 'demoMarker', x: tp1[0], y: tp1[1], label: nextMarkerLabel(allEnts), color: '#FF9800', showCoord: false };
          produced.push(mk1);
          allEnts[id1] = mk1;
          const id2 = nextEntityId();
          const mk2: DemoMarker = { id: id2, type: 'demoMarker', x: tp2[0], y: tp2[1], label: nextMarkerLabel(allEnts), color: '#FF9800', showCoord: false };
          produced.push(mk2);
          allEnts[id2] = mk2;
          const segId = nextEntityId();
          produced.push({ id: segId, type: 'demoSegment', startId: id1, endId: id2, color: '#FF9800', style: 'dashed', showLength: false } as DemoSegment);
        }
        execute(new CreateConstructionCmd('构造公切线', produced));
        resetTool();
        useDemoToolStore.getState().setTool('select');
      }
      return;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool, opKind, step, pendingStartPoint, pendingVec1Id, pendingMarkerIds, entities, execute,
      nextEntityId, select, nextStep, resetTool, setPendingStart, setPendingVec1,
      pushPendingMarker, popPendingMarker, hitTest, vecCount, markers.length]);

  // 向量自动标签（a, b, c, ...）
  function nextVecLabel(): string {
    const existing = new Set(vectors.map((v) => v.label));
    for (let i = 0; i < 26; i++) {
      const lbl = String.fromCharCode(97 + i);
      if (!existing.has(lbl)) return lbl;
    }
    return `v${vecCount + 1}`;
  }

  // ─── 端点拖拽开始 ───
  const handlePointPointerDown = useCallback((e: React.PointerEvent<SVGCircleElement>, pointId: string) => {
    if (activeTool !== 'select') return;
    e.stopPropagation();
    const pt = entities[pointId] as DemoPoint | undefined;
    if (!pt) return;
    if (pt.motion && useAnimationStore.getState().status === 'playing') return;
    // 约束向量的固定端不可拖拽
    for (const en of Object.values(entities)) {
      if (en.type !== 'demoVector') continue;
      const v = en as DemoVector;
      if (!v.constraint || v.constraint === 'free') continue;
      const locksStart = v.constraint === 'fixedStart' || v.constraint === 'lineEnd' || v.constraint === 'regionEnd';
      const locksEnd = v.constraint === 'fixedEnd' || v.constraint === 'lineStart' || v.constraint === 'regionStart';
      if ((locksStart && pointId === v.startId) || (locksEnd && pointId === v.endId)) return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    const groupIds = useDemoEntityStore.getState().getBoundGroup(pointId);
    const group = groupIds.map((id) => {
      const gp = entities[id] as DemoPoint | undefined;
      return { id, before: gp ? { x: gp.x, y: gp.y, xExpr: gp.xExpr, yExpr: gp.yExpr } : { x: 0, y: 0 } };
    });
    draggingPointRef.current = {
      pointId, before: { x: pt.x, y: pt.y, xExpr: pt.xExpr, yExpr: pt.yExpr }, current: { x: pt.x, y: pt.y }, moved: false, group,
    };
  }, [activeTool, entities]);

  // ─── 运算起点拖拽开始 ───
  const handleOpOriginPointerDown = useCallback((e: React.PointerEvent<SVGElement>, opId: string, ox: number, oy: number) => {
    if (activeTool !== 'select') return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const opEnt = entities[opId] as import('@/editor/demo/demoTypes').DemoVecOp | undefined;
    draggingOpOriginRef.current = { opId, before: { x: ox, y: oy, originXExpr: opEnt?.originXExpr, originYExpr: opEnt?.originYExpr }, current: { x: ox, y: oy }, moved: false };
  }, [activeTool]);

  // ─── 标记点拖拽开始 ───
  const handleMarkerPointerDown = useCallback((e: React.PointerEvent<SVGElement>, markerId: string) => {
    if (activeTool !== 'select') return;
    e.stopPropagation();
    const mk = entities[markerId] as DemoMarker | undefined;
    if (!mk) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingMarkerRef.current = { markerId, before: { x: mk.x, y: mk.y, xExpr: mk.xExpr, yExpr: mk.yExpr }, current: { x: mk.x, y: mk.y }, moved: false };
  }, [activeTool, entities]);

  // ─── 整体向量拖拽开始（箭杆区域） ───
  const handleVecBodyPointerDown = useCallback((e: React.PointerEvent<SVGElement>, vecId: string) => {
    if (activeTool !== 'select') return;
    e.stopPropagation();
    const vec = entities[vecId] as DemoVector | undefined;
    if (!vec) return;
    // 约束向量不允许整体拖拽
    if (vec.constraint && vec.constraint !== 'free') return;
    const sp = entities[vec.startId] as DemoPoint | undefined;
    const ep = entities[vec.endId] as DemoPoint | undefined;
    if (!sp || !ep) return;
    if (!svgRef.current) return;
    const [svgX, svgY] = clientToSVG(e.clientX, e.clientY, svgRef.current);
    const [mx, my] = svgToMath(svgX, svgY);
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingVecBodyRef.current = {
      vecId, startId: vec.startId, endId: vec.endId,
      startBefore: { x: sp.x, y: sp.y, xExpr: sp.xExpr, yExpr: sp.yExpr },
      endBefore: { x: ep.x, y: ep.y, xExpr: ep.xExpr, yExpr: ep.yExpr },
      grabMath: { x: mx, y: my },
      moved: false,
    };
  }, [activeTool, entities]);

  // ─── 文字拖拽开始 ───
  const handleTextPointerDown = useCallback((e: React.PointerEvent<SVGElement>, textId: string) => {
    if (activeTool !== 'select') return;
    e.stopPropagation();
    const txt = entities[textId] as DemoText | undefined;
    if (!txt) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingTextRef.current = { textId, before: { x: txt.x, y: txt.y, xExpr: txt.xExpr, yExpr: txt.yExpr }, current: { x: txt.x, y: txt.y }, moved: false };
  }, [activeTool, entities]);

  // ─── 键盘 Delete / Escape / Backspace ───
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Escape: 取消当前工具，回到选择
      if (e.key === 'Escape') {
        const { activeTool: tool } = useDemoToolStore.getState();
        if (tool !== 'select') {
          resetTool();
          useDemoToolStore.getState().setTool('select');
          return;
        }
      }

      // Backspace 在工具模式下：回退一步
      if (e.key === 'Backspace') {
        const { activeTool: tool, step: curStep, pendingVec1Id: pv1, pendingMarkerIds: pmIds } = useDemoToolStore.getState();
        if (tool === 'vectorOp' && curStep === 1 && pv1) {
          useDemoToolStore.getState().setPendingVec1(null);
          useDemoToolStore.setState({ step: 0 });
          return;
        }
        if (tool === 'createVector' && curStep === 1) {
          useDemoToolStore.getState().setPendingStart(null);
          useDemoToolStore.setState({ step: 0 });
          return;
        }
        // 多步标记工具回退
        if ((tool === 'segment' || tool === 'circle' || tool === 'angleMark' || tool === 'distanceMark'
          || tool === 'perpendicular' || tool === 'parallelLine' || tool === 'angleBisector' || tool === 'pointLineDist'
          || tool === 'line' || tool === 'ray' || tool === 'polygon'
          || tool === 'translate' || tool === 'rotate' || tool === 'reflect' || tool === 'dilate' || tool === 'centralSymmetry'
          || tool === 'tangent' || tool === 'commonTangent') && curStep > 0 && pmIds.length > 0) {
          useDemoToolStore.getState().popPendingMarker();
          useDemoToolStore.setState({ step: curStep - 1 });
          return;
        }
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        const all = useDemoEntityStore.getState().entities;
        const entity = all[selectedId];
        if (!entity) return;

        // 删除向量（原有逻辑）
        if (entity.type === 'demoVector') {
          const vec = entity as DemoVector;
          const sp = all[vec.startId] as DemoPoint;
          const ep = all[vec.endId] as DemoPoint;
          const orphanOps = Object.values(all).filter(
            (en): en is DemoVecOp => en.type === 'demoVecOp' && (en.vec1Id === selectedId || en.vec2Id === selectedId),
          );
          execute(new DeleteVectorCmd(vec, sp, ep, orphanOps));
          select(null);
          return;
        }

        // 删除标记点（级联删除引用它的线段/圆/角/距）
        if (entity.type === 'demoMarker') {
          execute(new DeleteMarkerCmd(entity as DemoMarker));
          select(null);
          return;
        }

        // 删除线段/圆/文字/角度标注/距离标注/直线/射线/多边形/滑动条
        if (entity.type === 'demoSegment' || entity.type === 'demoCircle'
          || entity.type === 'demoText' || entity.type === 'demoAngleMark'
          || entity.type === 'demoDistanceMark'
          || entity.type === 'demoLine' || entity.type === 'demoRay'
          || entity.type === 'demoPolygon' || entity.type === 'demoSlider') {
          execute(new DeleteGenericCmd(entity));
          select(null);
          return;
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, execute, select, resetTool]);

  // ─── 渲染向量 ───
  function renderVector(vec: DemoVector) {
    const sp = entities[vec.startId] as DemoPoint | undefined;
    const ep = entities[vec.endId] as DemoPoint | undefined;
    if (!sp || !ep) return null;
    const [sx1, sy1] = m2s(sp.x, sp.y);
    const [sx2, sy2] = m2s(ep.x, ep.y);
    const isSelected = selectedId === vec.id;
    const isHovered = hoveredId === vec.id;
    const isPending = pendingVec1Id === vec.id;
    const cidx = colorIndex(vec.color);
    // 约束轨迹可视化
    const hasCircleConstraint = (vec.constraint === 'fixedStart' || vec.constraint === 'fixedEnd') && vec.constraintLength;
    const anchorSvg = hasCircleConstraint
      ? (vec.constraint === 'fixedStart' ? [sx1, sy1] : [sx2, sy2])
      : null;
    const orbitR = hasCircleConstraint ? vec.constraintLength! * SCALE : 0;
    const hasLineConstraint = (vec.constraint === 'lineStart' || vec.constraint === 'lineEnd') && vec.constraintLineP1 && vec.constraintLineP2;
    const hasRegionConstraint = (vec.constraint === 'regionStart' || vec.constraint === 'regionEnd') && vec.constraintRegionMin && vec.constraintRegionMax;
    const hasConstraint = hasCircleConstraint || hasLineConstraint || hasRegionConstraint;

    return (
      <g key={vec.id} opacity={vec.opacity ?? 1}>
        {/* 约束轨迹虚线圆 */}
        {anchorSvg && orbitR > 0 && (
          <circle cx={anchorSvg[0]} cy={anchorSvg[1]} r={orbitR}
            fill="none" stroke={vec.color} strokeWidth={1} strokeDasharray="6 4" opacity={0.35} />
        )}
        {/* 直线约束虚线 */}
        {hasLineConstraint && (() => {
          const lp1 = vec.constraintLineP1!, lp2 = vec.constraintLineP2!;
          const [lsx1, lsy1] = m2s(lp1.x, lp1.y);
          const [lsx2, lsy2] = m2s(lp2.x, lp2.y);
          return <line x1={lsx1} y1={lsy1} x2={lsx2} y2={lsy2}
            fill="none" stroke={vec.color} strokeWidth={1} strokeDasharray="6 4" opacity={0.35} />;
        })()}
        {/* 区域约束虚线矩形 */}
        {hasRegionConstraint && (() => {
          const rmin = vec.constraintRegionMin!, rmax = vec.constraintRegionMax!;
          const [rx1, ry1] = m2s(rmin.x, rmax.y);
          const [rx2, ry2] = m2s(rmax.x, rmin.y);
          return <rect x={rx1} y={ry1} width={rx2 - rx1} height={ry2 - ry1}
            fill="none" stroke={vec.color} strokeWidth={1} strokeDasharray="6 4" opacity={0.25} />;
        })()}
        {(isSelected || isHovered || isPending) && (
          <line x1={sx1} y1={sy1} x2={sx2} y2={sy2}
            stroke={isPending ? COLORS.primary : isSelected ? '#F97316' : '#60A5FA'}
            strokeWidth={isPending ? 10 : 8} opacity={isPending ? 0.35 : 0.3} strokeLinecap="round" />
        )}
        {/* 透明宽线用于箭杆拖拽命中 */}
        <line x1={sx1} y1={sy1} x2={sx2} y2={sy2}
          stroke="transparent" strokeWidth={14}
          style={{ cursor: activeTool === 'select' ? 'grab' : 'default' }}
          onPointerDown={(e) => handleVecBodyPointerDown(e, vec.id)}
          onPointerUp={handlePointerUp}
        />
        <ArrowLine x1={sx1} y1={sy1} x2={sx2} y2={sy2} color={vec.color} markerId={`demo-arrow-${cidx}`} />
        {/* 约束标记：固定端显示锚点 */}
        {hasConstraint && anchorSvg && (
          <circle cx={anchorSvg[0]} cy={anchorSvg[1]} r={4}
            fill={vec.color} stroke={COLORS.white} strokeWidth={1.5} />
        )}
      </g>
    );
  }

  // ─── 渲染向量标签（独立层，显示在所有箭头之上） ───
  function renderVecLabel(vec: DemoVector) {
    const sp = entities[vec.startId] as DemoPoint | undefined;
    const ep = entities[vec.endId] as DemoPoint | undefined;
    if (!sp || !ep || !vec.showLabel) return null;
    const [sx1, sy1] = m2s(sp.x, sp.y);
    const [sx2, sy2] = m2s(ep.x, ep.y);
    const dx = sx2 - sx1, dy = sy2 - sy1, len = Math.hypot(dx, dy);
    if (len <= 5) return null;
    const lx = len > 0 ? sx2 - dy / len * 20 + dx / len * 6 : sx2;
    const ly = len > 0 ? sy2 + dx / len * 20 + dy / len * 6 : sy2;
    return (
      <LatexRenderer key={`label-${vec.id}`}
        latex={`\\vec{${vec.label}}`}
        x={lx - 18} y={ly - 14}
        fontSize={16} color={vec.color} opacity={1}
        stroke="#fff"
      />
    );
  }

  // ─── 渲染端点 ───
  function renderEndPoint(pt: DemoPoint) {
    const [sx, sy] = m2s(pt.x, pt.y);
    const isSelected = selectedId === pt.id;
    const isHovered = hoveredId === pt.id;
    const parentVec = vectors.find((v) => v.endId === pt.id || v.startId === pt.id);
    if (!parentVec) return null;
    return (
      <circle key={pt.id} cx={sx} cy={sy} r={6}
        fill={isSelected ? '#F97316' : isHovered ? '#60A5FA' : parentVec.color}
        stroke={COLORS.white} strokeWidth={2}
        opacity={pt.opacity ?? 1}
        style={{ cursor: activeTool === 'select' ? 'grab' : 'default' }}
        onPointerDown={(e) => handlePointPointerDown(e, pt.id)}
        onPointerUp={handlePointerUp}
      />
    );
  }

  // ─── 渲染运算结果（递归解析，支持 op 嵌套）───
  function renderOp(op: DemoVecOp) {
    if (op.kind === 'dotProduct') return null;

    const res = resolveVec(op.id, entities);
    if (!res) return null;
    const origin = resolveOpOrigin(op, entities);
    const ox = origin.x, oy = origin.y;
    const [x1, y1] = m2s(ox, oy);
    const [x2, y2] = m2s(ox + res[0], oy + res[1]);

    // 颜色：基于 op 索引
    const opIdx = ops.indexOf(op);
    const cidx = (opIdx + 3) % DEMO_COLORS.length;
    const color = DEMO_COLORS[cidx];
    const isSelected = selectedId === op.id;
    const isHovered = hoveredId === op.id;
    const isPending = pendingVec1Id === op.id;

    return (
      <g key={op.id} opacity={op.opacity ?? 1}>
        {/* 选中/hover/pending 高亮 */}
        {(isSelected || isHovered || isPending) && (
          <line x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={isPending ? COLORS.primary : isSelected ? '#F97316' : '#60A5FA'}
            strokeWidth={isPending ? 10 : 8} opacity={isPending ? 0.35 : 0.3} strokeLinecap="round" />
        )}
        {/* 透明宽线用于拖拽/点击命中 */}
        <line x1={x1} y1={y1} x2={x2} y2={y2}
          stroke="transparent" strokeWidth={14}
          style={{ cursor: activeTool === 'select' ? 'grab' : activeTool === 'vectorOp' ? 'cell' : 'default' }}
          onPointerDown={(e) => handleOpOriginPointerDown(e, op.id, ox, oy)}
          onPointerUp={handlePointerUp}
        />
        <ArrowLine x1={x1} y1={y1} x2={x2} y2={y2} color={color} markerId={`demo-arrow-${cidx}`}
          strokeWidth={op.kind === 'scale' ? 2.5 : 3} dashed />
      </g>
    );
  }

  // ─── 渲染运算标签（独立层） ───
  function renderOpLabel(op: DemoVecOp) {
    if (op.kind === 'dotProduct') return null;
    const res = resolveVec(op.id, entities);
    if (!res) return null;
    const origin = resolveOpOrigin(op, entities);
    const [x1, y1] = m2s(origin.x, origin.y);
    const [x2, y2] = m2s(origin.x + res[0], origin.y + res[1]);
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    if (len <= 5) return null;
    const lx = len > 0 ? x2 - dy / len * 14 + dx / len * 4 : x2;
    const ly = len > 0 ? y2 + dx / len * 14 + dy / len * 4 : y2;
    const opIdx = ops.indexOf(op);
    const cidx = (opIdx + 3) % DEMO_COLORS.length;
    const color = DEMO_COLORS[cidx];

    if (op.kind === 'projection' && op.vec2Id) {
      const v1 = resolveVec(op.vec1Id, entities);
      const v2 = resolveVec(op.vec2Id, entities);
      const l1 = resolveOpLabel(op.vec1Id, entities);
      const l2 = resolveOpLabel(op.vec2Id, entities);
      if (v1 && v2) {
        const m2 = dot2D(v2, v2);
        const k = m2 > 1e-12 ? dot2D(v1, v2) / m2 : 0;
        const kStr = Number.isInteger(k) ? String(k) : k.toFixed(2);
        const l1Latex = toVecLatex(l1) ?? l1;
        const l2Latex = toVecLatex(l2) ?? l2;
        const projLatex = `\\text{proj}(${l1Latex},${l2Latex})=${kStr}\\cdot ${l2Latex}`;
        return <LatexRenderer key={`label-${op.id}`} latex={projLatex} x={lx - 18} y={ly - 14} fontSize={14} color={color} stroke="#fff" width={220} />;
      }
    }

    const label = resolveOpLabel(op.id, entities);
    const latex = toVecLatex(label);
    if (latex) {
      return <LatexRenderer key={`label-${op.id}`} latex={latex} x={lx - 18} y={ly - 14} fontSize={14} color={color} stroke="#fff" />;
    }
    return (
      <text key={`label-${op.id}`} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
        fontSize={14} fontWeight={600} fill={color}
        stroke="#fff" strokeWidth={3} paintOrder="stroke"
        fontFamily="Inter, sans-serif" style={{ userSelect: 'none', pointerEvents: 'none' }}>
        {label}
      </text>
    );
  }

  // ─── 渲染标记点 ───
  function renderMarker(mk: DemoMarker) {
    const [sx, sy] = m2s(mk.x, mk.y);
    const isSelected = selectedId === mk.id;
    const isHovered = hoveredId === mk.id;
    const isPendingTarget = pendingMarkerIds.includes(mk.id);
    const shouldShowCoord = mk.showCoord || showAllCoords;

    return (
      <g key={mk.id} opacity={mk.opacity ?? 1}>
        {/* 选中/hover/pending 高亮环 */}
        {(isSelected || isHovered || isPendingTarget) && (
          <circle cx={sx} cy={sy} r={12}
            fill="none"
            stroke={isPendingTarget ? COLORS.primary : isSelected ? '#F97316' : '#60A5FA'}
            strokeWidth={2}
            opacity={0.5}
          />
        )}
        {/* 实心圆 */}
        <circle cx={sx} cy={sy} r={5}
          fill={isSelected ? '#F97316' : isHovered ? '#60A5FA' : mk.color}
          stroke={COLORS.white} strokeWidth={1.5}
          style={{ cursor: activeTool === 'select' ? 'grab' : 'default' }}
          onPointerDown={(e) => handleMarkerPointerDown(e, mk.id)}
          onPointerUp={handlePointerUp}
        />
        {/* 标签（上方） */}
        <text x={sx} y={sy - 12} textAnchor="middle" dominantBaseline="auto"
          fontSize={14} fontWeight={700} fill={mk.color}
          fontFamily="Inter, 'PingFang SC', sans-serif"
          style={{ userSelect: 'none', pointerEvents: 'none' }}>
          {mk.label}
        </text>
        {/* 坐标（下方） */}
        {shouldShowCoord && (
          <text x={sx} y={sy + 18} textAnchor="middle" dominantBaseline="hanging"
            fontSize={11} fill={COLORS.textMuted}
            fontFamily="Inter, sans-serif"
            style={{ userSelect: 'none', pointerEvents: 'none' }}>
            ({mk.xExpr ?? fmtSmart(mk.x)}, {mk.yExpr ?? fmtSmart(mk.y)})
          </text>
        )}
      </g>
    );
  }

  // ─── 渲染线段 ───
  function renderSegment(seg: DemoSegment) {
    const sp = entities[seg.startId] as DemoMarker | undefined;
    const ep = entities[seg.endId] as DemoMarker | undefined;
    if (!sp || !ep) return null;
    const [sx1, sy1] = m2s(sp.x, sp.y);
    const [sx2, sy2] = m2s(ep.x, ep.y);
    const isSelected = selectedId === seg.id;
    const isHovered = hoveredId === seg.id;

    // 中点（标签位置）
    const midX = (sx1 + sx2) / 2;
    const midY = (sy1 + sy2) / 2;
    const segLen = Math.hypot(ep.x - sp.x, ep.y - sp.y);

    // 偏移标签：垂直于线段方向偏移
    const dx = sx2 - sx1, dy = sy2 - sy1;
    const svgLen = Math.hypot(dx, dy);
    const offX = svgLen > 0 ? -dy / svgLen * 14 : 0;
    const offY = svgLen > 0 ? dx / svgLen * 14 : -14;

    return (
      <g key={seg.id} opacity={seg.opacity ?? 1}>
        {/* 选中/hover 高亮 */}
        {(isSelected || isHovered) && (
          <line x1={sx1} y1={sy1} x2={sx2} y2={sy2}
            stroke={isSelected ? '#F97316' : '#60A5FA'}
            strokeWidth={8} opacity={0.3} strokeLinecap="round" />
        )}
        <line x1={sx1} y1={sy1} x2={sx2} y2={sy2}
          stroke={seg.color} strokeWidth={2}
          strokeDasharray={seg.style === 'dashed' ? '6 4' : undefined}
          strokeLinecap="round"
        />
        {/* 长度标签 */}
        {seg.showLength && svgLen > 10 && (
          <text x={midX + offX} y={midY + offY} textAnchor="middle" dominantBaseline="middle"
            fontSize={12} fill={COLORS.textSecondary}
            fontFamily="Inter, sans-serif"
            style={{ userSelect: 'none', pointerEvents: 'none' }}>
            {segLen.toFixed(2)}
          </text>
        )}
        {/* 斜率标签 */}
        {seg.showSlope && svgLen > 10 && (() => {
          const k = slopeOf(sp.x, sp.y, ep.x, ep.y);
          return (
            <text x={midX - offX} y={midY - offY} textAnchor="middle" dominantBaseline="middle"
              fontSize={12} fill={seg.color}
              fontFamily="Inter, sans-serif"
              style={{ userSelect: 'none', pointerEvents: 'none' }}>
              k={k !== null ? fmtSmart(k) : '∞'}
            </text>
          );
        })()}
      </g>
    );
  }

  // ─── 渲染圆 ───
  function renderCircle(cir: DemoCircle) {
    const center = entities[cir.centerId] as DemoMarker | undefined;
    const rPt = entities[cir.radiusPointId] as DemoMarker | undefined;
    if (!center || !rPt) return null;
    const [cx, cy] = m2s(center.x, center.y);
    const r = Math.hypot((rPt.x - center.x) * SCALE, (rPt.y - center.y) * SCALE);
    const isSelected = selectedId === cir.id;
    const isHovered = hoveredId === cir.id;

    return (
      <g key={cir.id} opacity={cir.opacity ?? 1}>
        {/* 选中/hover 高亮 */}
        {(isSelected || isHovered) && (
          <circle cx={cx} cy={cy} r={r}
            fill="none"
            stroke={isSelected ? '#F97316' : '#60A5FA'}
            strokeWidth={6} opacity={0.25}
          />
        )}
        <circle cx={cx} cy={cy} r={r}
          fill={cir.fill ? `${cir.color}18` : 'none'}
          stroke={cir.color} strokeWidth={2}
          strokeDasharray={cir.style === 'dashed' ? '6 4' : undefined}
        />
      </g>
    );
  }

  // ─── 渲染文字 ───
  function renderText(txt: DemoText) {
    const [sx, sy] = m2s(txt.x, txt.y);
    const isSelected = selectedId === txt.id;
    const isHovered = hoveredId === txt.id;

    return (
      <g key={txt.id} opacity={txt.opacity ?? 1}>
        {/* 选中/hover 背景高亮 */}
        {(isSelected || isHovered) && (
          <rect
            x={sx - txt.text.length * txt.fontSize * 0.3 - 4}
            y={sy - txt.fontSize * 0.6 - 2}
            width={txt.text.length * txt.fontSize * 0.6 + 8}
            height={txt.fontSize * 1.2 + 4}
            rx={3}
            fill={isSelected ? 'rgba(249,115,22,0.12)' : 'rgba(96,165,250,0.12)'}
            stroke={isSelected ? '#F97316' : '#60A5FA'}
            strokeWidth={1}
          />
        )}
        {txt.latex ? (
          <g
            style={{ cursor: activeTool === 'select' ? 'grab' : 'default' }}
            onPointerDown={(e) => handleTextPointerDown(e, txt.id)}
            onPointerUp={handlePointerUp}
          >
            <LatexRenderer latex={txt.text} x={sx - 100} y={sy - 20} fontSize={txt.fontSize} color={txt.color} opacity={1} />
          </g>
        ) : (
          <text x={sx} y={sy} textAnchor="middle" dominantBaseline="middle"
            fontSize={txt.fontSize} fill={txt.color}
            fontFamily="Inter, 'PingFang SC', sans-serif"
            fontWeight={500}
            style={{ cursor: activeTool === 'select' ? 'grab' : 'default' }}
            onPointerDown={(e) => handleTextPointerDown(e, txt.id)}
            onPointerUp={handlePointerUp}
          >
            {txt.text}
          </text>
        )}
      </g>
    );
  }

  // ─── 渲染角度标注 ───
  function renderAngleMark(am: DemoAngleMark) {
    const pA = entities[am.pointAId] as DemoMarker | undefined;
    const pV = entities[am.vertexId] as DemoMarker | undefined;
    const pC = entities[am.pointCId] as DemoMarker | undefined;
    if (!pA || !pV || !pC) return null;

    const [vx, vy] = m2s(pV.x, pV.y);

    // 计算角度（数学坐标系）
    const angA = angleBetweenPoints(pV.x, pV.y, pA.x, pA.y);
    const angC = angleBetweenPoints(pV.x, pV.y, pC.x, pC.y);

    // SVG 中 Y 轴翻转，角度取反
    const svgAngA = -angA;
    const svgAngC = -angC;

    // 计算从 A 到 C 的角度差（逆时针为正，SVG 中顺时针绘制）
    const startAng = svgAngA;
    const endAng = svgAngC;

    // 确保使用较小的角度
    let sweep = endAng - startAng;
    // 归一化到 [-PI, PI]
    while (sweep > Math.PI) sweep -= 2 * Math.PI;
    while (sweep < -Math.PI) sweep += 2 * Math.PI;

    // 计算角度值（度）
    const angleDeg = Math.abs(sweep) * 180 / Math.PI;

    // 弧线半径（SVG 像素）
    const arcR = 25;

    // 确定 sweep 方向
    const sweepFlag = sweep > 0 ? 1 : 0;

    // 弧的起点和终点
    const ax1 = vx + arcR * Math.cos(startAng);
    const ay1 = vy + arcR * Math.sin(startAng);
    const ax2 = vx + arcR * Math.cos(startAng + sweep);
    const ay2 = vy + arcR * Math.sin(startAng + sweep);

    // 大弧标志
    const largeArc = Math.abs(sweep) > Math.PI ? 1 : 0;

    // 标签位置（弧的中点方向）
    const midAng = startAng + sweep / 2;
    const labelR = arcR + 14;
    const labelX = vx + labelR * Math.cos(midAng);
    const labelY = vy + labelR * Math.sin(midAng);

    const isSelected = selectedId === am.id;
    const isHovered = hoveredId === am.id;

    return (
      <g key={am.id} opacity={am.opacity ?? 1}>
        <path
          d={`M ${ax1} ${ay1} A ${arcR} ${arcR} 0 ${largeArc} ${sweepFlag} ${ax2} ${ay2}`}
          fill="none"
          stroke={isSelected ? '#F97316' : isHovered ? '#60A5FA' : am.color}
          strokeWidth={2}
          opacity={0.8}
        />
        {am.showValue && (
          <text x={labelX} y={labelY} textAnchor="middle" dominantBaseline="middle"
            fontSize={12} fontWeight={600}
            fill={isSelected ? '#F97316' : am.color}
            fontFamily="Inter, sans-serif"
            style={{ userSelect: 'none', pointerEvents: 'none' }}>
            {angleDeg.toFixed(1)}&deg;
          </text>
        )}
      </g>
    );
  }

  // ─── 渲染距离标注 ───
  function renderDistanceMark(dm: DemoDistanceMark) {
    const pA = entities[dm.pointAId] as DemoMarker | undefined;
    const pB = entities[dm.pointBId] as DemoMarker | undefined;
    if (!pA || !pB) return null;

    const [sx1, sy1] = m2s(pA.x, pA.y);
    const [sx2, sy2] = m2s(pB.x, pB.y);

    const dist = Math.hypot(pB.x - pA.x, pB.y - pA.y);
    const midX = (sx1 + sx2) / 2;
    const midY = (sy1 + sy2) / 2;

    // 偏移方向（垂直于连线）
    const dx = sx2 - sx1, dy = sy2 - sy1;
    const len = Math.hypot(dx, dy);
    const offX = len > 0 ? -dy / len * dm.offset * SCALE : 0;
    const offY = len > 0 ? dx / len * dm.offset * SCALE : -dm.offset * SCALE;

    const isSelected = selectedId === dm.id;
    const isHovered = hoveredId === dm.id;

    return (
      <g key={dm.id} opacity={dm.opacity ?? 1}>
        {/* 偏移线 */}
        <line x1={sx1 + offX} y1={sy1 + offY} x2={sx2 + offX} y2={sy2 + offY}
          stroke={isSelected ? '#F97316' : isHovered ? '#60A5FA' : dm.color}
          strokeWidth={1} strokeDasharray="4 3" opacity={0.6}
        />
        {/* 端部短线 */}
        <line x1={sx1} y1={sy1} x2={sx1 + offX} y2={sy1 + offY}
          stroke={dm.color} strokeWidth={0.8} opacity={0.4} />
        <line x1={sx2} y1={sy2} x2={sx2 + offX} y2={sy2 + offY}
          stroke={dm.color} strokeWidth={0.8} opacity={0.4} />
        {/* 距离标签 */}
        <text x={midX + offX} y={midY + offY - 6} textAnchor="middle" dominantBaseline="auto"
          fontSize={12} fontWeight={600}
          fill={isSelected ? '#F97316' : dm.color}
          fontFamily="Inter, sans-serif"
          style={{ userSelect: 'none', pointerEvents: 'none' }}>
          {dist.toFixed(2)}
        </text>
      </g>
    );
  }

  // ─── 渲染直线 ───
  function renderLine(line: DemoLine) {
    const p1 = entities[line.point1Id] as DemoMarker | undefined;
    const p2 = entities[line.point2Id] as DemoMarker | undefined;
    if (!p1 || !p2) return null;
    const [sx1, sy1] = m2s(p1.x, p1.y);
    const [sx2, sy2] = m2s(p2.x, p2.y);
    // 延伸到 viewBox 边界
    const dx = sx2 - sx1, dy = sy2 - sy1;
    const len = Math.hypot(dx, dy);
    if (len < 0.01) return null;
    const ux = dx / len, uy = dy / len;
    const ext = 2000; // 远超 viewBox
    const ex1 = sx1 - ux * ext, ey1 = sy1 - uy * ext;
    const ex2 = sx1 + ux * ext, ey2 = sy1 + uy * ext;
    const isSelected = selectedId === line.id;
    const isHovered = hoveredId === line.id;
    return (
      <g key={line.id} opacity={line.opacity ?? 1}>
        {/* 选中高亮 */}
        {(isSelected || isHovered) && <line x1={ex1} y1={ey1} x2={ex2} y2={ey2} stroke={isSelected ? '#F97316' : '#60A5FA'} strokeWidth={8} opacity={0.3} />}
        <line
          x1={ex1} y1={ey1} x2={ex2} y2={ey2}
          stroke={line.color} strokeWidth={2}
          strokeDasharray={line.style === 'dashed' ? '8 4' : undefined}
        />
        {/* 斜率标签 */}
        {line.showSlope && (() => {
          const k = slopeOf(p1.x, p1.y, p2.x, p2.y);
          const mid = m2s((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
          return <text x={mid[0] + 8} y={mid[1] - 8} fontSize={12} fill={line.color}
            fontFamily="Inter, sans-serif" style={{ userSelect: 'none', pointerEvents: 'none' }}>
            k={k !== null ? fmtSmart(k) : '∞'}</text>;
        })()}
      </g>
    );
  }

  // ─── 渲染射线 ───
  function renderRay(ray: DemoRay) {
    const origin = entities[ray.originId] as DemoMarker | undefined;
    const through = entities[ray.throughId] as DemoMarker | undefined;
    if (!origin || !through) return null;
    const [sx1, sy1] = m2s(origin.x, origin.y);
    const [sx2, sy2] = m2s(through.x, through.y);
    const dx = sx2 - sx1, dy = sy2 - sy1;
    const len = Math.hypot(dx, dy);
    if (len < 0.01) return null;
    const ux = dx / len, uy = dy / len;
    const ext = 2000;
    const ex2 = sx1 + ux * ext, ey2 = sy1 + uy * ext;
    const isSelected = selectedId === ray.id;
    const isHovered = hoveredId === ray.id;
    return (
      <g key={ray.id} opacity={ray.opacity ?? 1}>
        {(isSelected || isHovered) && <line x1={sx1} y1={sy1} x2={ex2} y2={ey2} stroke={isSelected ? '#F97316' : '#60A5FA'} strokeWidth={8} opacity={0.3} />}
        <line
          x1={sx1} y1={sy1} x2={ex2} y2={ey2}
          stroke={ray.color} strokeWidth={2}
          strokeDasharray={ray.style === 'dashed' ? '8 4' : undefined}
        />
        {/* 原点标记 */}
        <circle cx={sx1} cy={sy1} r={3} fill={ray.color} />
      </g>
    );
  }

  // ─── 渲染多边形 ───
  function renderPolygon(poly: DemoPolygon) {
    const verts = poly.vertexIds.map((vid) => entities[vid] as DemoMarker | undefined).filter(Boolean) as DemoMarker[];
    if (verts.length < 3) return null;
    const svgPoints = verts.map((v) => { const [sx, sy] = m2s(v.x, v.y); return `${sx},${sy}`; }).join(' ');
    const isSelected = selectedId === poly.id;
    const isHovered = hoveredId === poly.id;

    // 面积计算
    const mathVerts: [number, number][] = verts.map((v) => [v.x, v.y]);
    const area = Math.abs(polygonArea(mathVerts));

    return (
      <g key={poly.id} opacity={poly.opacity ?? 1}>
        {(isSelected || isHovered) && (
          <polygon points={svgPoints}
            fill="none"
            stroke={isSelected ? '#F97316' : '#60A5FA'}
            strokeWidth={6} opacity={0.25}
          />
        )}
        <polygon points={svgPoints}
          fill={poly.fill ? `${poly.color}22` : 'none'}
          stroke={poly.color} strokeWidth={2}
        />
        {/* 面积标签 */}
        {poly.showArea && (() => {
          const cx = verts.reduce((s, v) => s + v.x, 0) / verts.length;
          const cy = verts.reduce((s, v) => s + v.y, 0) / verts.length;
          const [sx, sy] = m2s(cx, cy);
          return <text x={sx} y={sy} textAnchor="middle" dominantBaseline="middle"
            fontSize={12} fill={poly.color} fontFamily="Inter, sans-serif"
            style={{ userSelect: 'none', pointerEvents: 'none' }}>
            S={fmtSmart(area)}
          </text>;
        })()}
      </g>
    );
  }

  // ─── 渲染滑动条 ───
  function renderSlider(slider: DemoSlider) {
    const [sx, sy] = m2s(slider.x, slider.y);
    const trackW = slider.width * SCALE;
    const trackH = 6;
    const ratio = (slider.value - slider.min) / (slider.max - slider.min);
    const thumbX = sx + ratio * trackW;
    const isSelected = selectedId === slider.id;
    return (
      <g key={slider.id} opacity={slider.opacity ?? 1}>
        {/* 轨道 */}
        <rect x={sx} y={sy - trackH / 2} width={trackW} height={trackH} rx={3}
          fill={COLORS.border} />
        {/* 已填充轨道 */}
        <rect x={sx} y={sy - trackH / 2} width={ratio * trackW} height={trackH} rx={3}
          fill={slider.color} opacity={0.5} />
        {/* 滑块 */}
        <circle cx={thumbX} cy={sy} r={8}
          fill={isSelected ? '#F97316' : slider.color}
          stroke={COLORS.white} strokeWidth={2}
          style={{ cursor: 'grab' }}
          onPointerDown={(e) => {
            if (activeTool !== 'select') return;
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            draggingSliderRef.current = { sliderId: slider.id, before: slider.value, moved: false };
          }}
          onPointerUp={handlePointerUp}
        />
        {/* 标签 */}
        <text x={sx + trackW / 2} y={sy - 14} textAnchor="middle" dominantBaseline="auto"
          fontSize={12} fill={COLORS.text} fontFamily="Inter, sans-serif"
          style={{ userSelect: 'none', pointerEvents: 'none' }}>
          {slider.label}: {fmtSmart(slider.value)}
        </text>
      </g>
    );
  }

  // ─── 临时虚线（createVector step1）───
  function renderTempLine() {
    if (activeTool !== 'createVector' || step !== 1 || !pendingStartPoint || !mousePos) return null;
    const [sx1, sy1] = m2s(pendingStartPoint.x, pendingStartPoint.y);
    return (
      <line x1={sx1} y1={sy1} x2={mousePos.x} y2={mousePos.y}
        stroke={COLORS.primary} strokeWidth={1.8} strokeDasharray="6 4" opacity={0.7} />
    );
  }

  // ─── 临时虚线（segment step1）───
  function renderTempSegmentLine() {
    if (activeTool !== 'segment' || step !== 1 || pendingMarkerIds.length < 1 || !mousePos) return null;
    const startMk = entities[pendingMarkerIds[0]] as DemoMarker | undefined;
    if (!startMk) return null;
    const [sx1, sy1] = m2s(startMk.x, startMk.y);
    return (
      <line x1={sx1} y1={sy1} x2={mousePos.x} y2={mousePos.y}
        stroke="#8C8C8C" strokeWidth={1.5} strokeDasharray="6 4" opacity={0.5} />
    );
  }

  // ─── 临时虚线圆（circle step1）───
  function renderTempCircle() {
    if (activeTool !== 'circle' || step !== 1 || pendingMarkerIds.length < 1 || !mousePos) return null;
    const centerMk = entities[pendingMarkerIds[0]] as DemoMarker | undefined;
    if (!centerMk) return null;
    const [cx, cy] = m2s(centerMk.x, centerMk.y);
    const r = Math.hypot(mousePos.x - cx, mousePos.y - cy);
    return (
      <circle cx={cx} cy={cy} r={r}
        fill="none" stroke="#2196F3" strokeWidth={1.5} strokeDasharray="6 4" opacity={0.5} />
    );
  }

  // ─── 运算结果 HUD（HTML overlay，左上角显示所有运算公式）───
  const opHuds = ops.map((op) => {
    const label = resolveOpLabel(op.id, entities);
    const labelLatex = toVecLatex(label);
    const labelNode = labelLatex ? <InlineLatex latex={labelLatex} /> : label;

    if (op.kind === 'dotProduct') {
      const v1 = resolveVec(op.vec1Id, entities);
      const v2 = op.vec2Id ? resolveVec(op.vec2Id, entities) : null;
      if (!v1 || !v2) return null;
      const dotVal = dot2D(v1, v2);
      const angleVal = toDeg(angle2D(v1, v2));
      return (
        <div key={op.id} style={opHudStyle}>
          {labelNode} = {dotVal.toFixed(2)} &nbsp;(&theta;&asymp;{angleVal.toFixed(1)}&deg;)
        </div>
      );
    }

    const res = resolveVec(op.id, entities);
    if (!res) return null;

    if (op.kind === 'projection') return null;

    return (
      <div key={op.id} style={opHudStyle}>
        {labelNode} = ({res[0].toFixed(2)}, {res[1].toFixed(2)})
      </div>
    );
  });

  // 光标
  const cursor = isPanning ? 'grabbing'
    : activeTool === 'createVector' ? 'crosshair'
    : activeTool === 'vectorOp' ? 'cell'
    : activeTool === 'markerPoint' ? 'crosshair'
    : activeTool === 'segment' ? 'crosshair'
    : activeTool === 'circle' ? 'crosshair'
    : activeTool === 'line' ? 'crosshair'
    : activeTool === 'ray' ? 'crosshair'
    : activeTool === 'polygon' ? 'crosshair'
    : activeTool === 'slider' ? 'crosshair'
    : activeTool === 'textLabel' ? 'text'
    : activeTool === 'angleMark' ? 'cell'
    : activeTool === 'distanceMark' ? 'cell'
    : activeTool === 'perpendicular' ? 'cell'
    : activeTool === 'parallelLine' ? 'cell'
    : activeTool === 'midpoint' ? 'cell'
    : activeTool === 'perpBisector' ? 'cell'
    : activeTool === 'angleBisector' ? 'cell'
    : activeTool === 'pointLineDist' ? 'cell'
    : activeTool === 'translate' ? 'cell'
    : activeTool === 'rotate' ? 'cell'
    : activeTool === 'reflect' ? 'cell'
    : activeTool === 'dilate' ? 'cell'
    : activeTool === 'centralSymmetry' ? 'cell'
    : activeTool === 'tangent' ? 'cell'
    : activeTool === 'commonTangent' ? 'cell'
    : 'default';

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: COLORS.bg }}>
      <DemoToolBar />
      <DemoStepIndicator />

      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        style={{ width: '100%', height: '100%', display: 'block', cursor }}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={handleSVGPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onMouseLeave={handleMouseLeave}
        onClick={handleCanvasClick}
      >
        <DemoArrowDefs colors={[...DEMO_COLORS]} />
        <CoordGrid view={view} />
        <LocusConstraintLayer />
        <LocusLayer points={points} />
        <TraceLayer entities={entities} />

        {/* 渲染顺序：grid > polygons > lines > rays > segments > circles > vectors > ops > angle marks > distance marks > markers > vector endpoints > texts > sliders > bindings > temp */}
        {polygons.map((p) => renderPolygon(p))}
        {lines.map((l) => renderLine(l))}
        {rays.map((r) => renderRay(r))}
        {segments.map((s) => renderSegment(s))}
        {circles.map((c) => renderCircle(c))}

        {vectors.map((v) => renderVector(v))}
        {ops.map((op) => renderOp(op))}

        {angleMarks.map((am) => renderAngleMark(am))}
        {distanceMarks.map((dm) => renderDistanceMark(dm))}

        {markers.map((mk) => renderMarker(mk))}
        {points.map((p) => renderEndPoint(p))}

        {/* 标签层（在端点圆之上，避免被遮挡） */}
        {vectors.map((v) => renderVecLabel(v))}
        {ops.map((op) => renderOpLabel(op))}

        {texts.map((t) => renderText(t))}
        {sliders.map((s) => renderSlider(s))}

        {/* 绑定标记：双环 */}
        {bindings.map((b) => {
          const pA = entities[b.pointA] as DemoPoint | undefined;
          if (!pA) return null;
          const [sx, sy] = m2s(pA.x, pA.y);
          return (
            <g key={b.id}>
              <circle cx={sx} cy={sy} r={10} fill="none" stroke={COLORS.primary} strokeWidth={1.5} strokeDasharray="3 2" opacity={0.6} />
            </g>
          );
        })}

        {renderTempLine()}
        {renderTempSegmentLine()}
        {renderTempCircle()}

        {/* 临时虚线（line step1） */}
        {activeTool === 'line' && step === 1 && pendingMarkerIds.length >= 1 && mousePos && (() => {
          const mk = entities[pendingMarkerIds[0]] as DemoMarker | undefined;
          if (!mk) return null;
          const [sx1, sy1] = m2s(mk.x, mk.y);
          return <line x1={sx1} y1={sy1} x2={mousePos.x} y2={mousePos.y}
            stroke="#8C8C8C" strokeWidth={1.5} strokeDasharray="6 4" opacity={0.5} />;
        })()}

        {/* 临时虚线（ray step1） */}
        {activeTool === 'ray' && step === 1 && pendingMarkerIds.length >= 1 && mousePos && (() => {
          const mk = entities[pendingMarkerIds[0]] as DemoMarker | undefined;
          if (!mk) return null;
          const [sx1, sy1] = m2s(mk.x, mk.y);
          return <line x1={sx1} y1={sy1} x2={mousePos.x} y2={mousePos.y}
            stroke="#8C8C8C" strokeWidth={1.5} strokeDasharray="6 4" opacity={0.5} />;
        })()}

        {/* 临时多边形轮廓（polygon step >= 1） */}
        {activeTool === 'polygon' && pendingMarkerIds.length >= 1 && mousePos && (() => {
          const pts = pendingMarkerIds.map((id) => entities[id] as DemoMarker | undefined).filter(Boolean) as DemoMarker[];
          if (pts.length === 0) return null;
          const svgPts = pts.map((p) => { const [sx, sy] = m2s(p.x, p.y); return { x: sx, y: sy }; });
          return (
            <g>
              {svgPts.map((pt, i) => {
                if (i === 0) return null;
                return <line key={i} x1={svgPts[i - 1].x} y1={svgPts[i - 1].y} x2={pt.x} y2={pt.y}
                  stroke="#4ECDC4" strokeWidth={1.5} strokeDasharray="6 4" opacity={0.5} />;
              })}
              <line x1={svgPts[svgPts.length - 1].x} y1={svgPts[svgPts.length - 1].y}
                x2={mousePos.x} y2={mousePos.y}
                stroke="#4ECDC4" strokeWidth={1.5} strokeDasharray="6 4" opacity={0.5} />
            </g>
          );
        })()}

        {activeTool === 'createVector' && step === 1 && pendingStartPoint && (() => {
          const [sx, sy] = m2s(pendingStartPoint.x, pendingStartPoint.y);
          return <circle cx={sx} cy={sy} r={5} fill={COLORS.primary} opacity={0.8} />;
        })()}

        {/* 吸附指示器 */}
        {snapIndicator && snapIndicator.snapped && (() => {
          const [sx, sy] = m2s(snapIndicator.x, snapIndicator.y);
          return (
            <g>
              <circle cx={sx} cy={sy} r={8} fill="none" stroke={COLORS.primary} strokeWidth={2} opacity={0.8} />
              <circle cx={sx} cy={sy} r={3} fill={COLORS.primary} opacity={0.8} />
              {snapIndicator.snapLabel && (
                <text x={sx + 12} y={sy - 10} fontSize={12} fill={COLORS.primary} fontWeight={600}
                  fontFamily="Inter, sans-serif" style={{ pointerEvents: 'none' }}>
                  {snapIndicator.snapLabel}
                </text>
              )}
            </g>
          );
        })()}
      </svg>

      {/* 运算结果 HUD */}
      {opHuds.some(Boolean) && (
        <div style={{
          position: 'absolute', top: 54, left: 10,
          display: 'flex', flexDirection: 'column', gap: 4,
          pointerEvents: 'none',
        }}>
          {opHuds}
        </div>
      )}

      <GeoRelationHUD />
      <AnimationControlBar entities={entities} />
      <StatusBar />
    </div>
  );
}

// ─── 几何关系检测 HUD ───

function GeoRelationHUD() {
  const entities = useDemoEntityStore((s) => s.entities);
  const { selectedId } = useDemoSelectionStore();

  const relations = useMemo(() => {
    const result: string[] = [];
    const allMarkers = Object.values(entities).filter((e): e is DemoMarker => e.type === 'demoMarker');
    const allSegments = Object.values(entities).filter((e): e is DemoSegment => e.type === 'demoSegment');

    if (allSegments.length < 2 && allMarkers.length < 3) return result;

    const selEnt = selectedId ? entities[selectedId] : null;

    // 选中线段时：检测与其他线段的平行/垂直关系
    if (selEnt?.type === 'demoSegment') {
      const seg = selEnt as DemoSegment;
      const sA = entities[seg.startId] as DemoMarker | undefined;
      const sB = entities[seg.endId] as DemoMarker | undefined;
      if (!sA || !sB) return result;
      const dx1 = sB.x - sA.x, dy1 = sB.y - sA.y;
      const len1 = Math.hypot(dx1, dy1);
      if (len1 < 1e-9) return result;

      for (const other of allSegments) {
        if (other.id === seg.id) continue;
        const oA = entities[other.startId] as DemoMarker | undefined;
        const oB = entities[other.endId] as DemoMarker | undefined;
        if (!oA || !oB) continue;
        const dx2 = oB.x - oA.x, dy2 = oB.y - oA.y;
        const len2 = Math.hypot(dx2, dy2);
        if (len2 < 1e-9) continue;

        const cross = dx1 * dy2 - dy1 * dx2;
        const dotVal = dx1 * dx2 + dy1 * dy2;

        if (Math.abs(cross) / (len1 * len2) < 0.02) {
          const segLabel = `${sA.label}${sB.label}`;
          const otherLabel = `${oA.label}${oB.label}`;
          result.push(`${segLabel} ∥ ${otherLabel}（平行）`);
        } else if (Math.abs(dotVal) / (len1 * len2) < 0.02) {
          const segLabel = `${sA.label}${sB.label}`;
          const otherLabel = `${oA.label}${oB.label}`;
          result.push(`${segLabel} ⊥ ${otherLabel}（垂直）`);
        }
      }
    }

    // 选中标记点时：检测与其他点的共线关系
    if (selEnt?.type === 'demoMarker') {
      const mk = selEnt as DemoMarker;
      for (let i = 0; i < allMarkers.length; i++) {
        if (allMarkers[i].id === mk.id) continue;
        for (let j = i + 1; j < allMarkers.length; j++) {
          if (allMarkers[j].id === mk.id) continue;
          const a = allMarkers[i], b = allMarkers[j];
          const area2 = Math.abs(
            (a.x - mk.x) * (b.y - mk.y) - (b.x - mk.x) * (a.y - mk.y),
          );
          const maxLen = Math.max(
            Math.hypot(a.x - mk.x, a.y - mk.y),
            Math.hypot(b.x - mk.x, b.y - mk.y),
            Math.hypot(a.x - b.x, a.y - b.y),
          );
          if (maxLen > 0.1 && area2 / maxLen < 0.05) {
            result.push(`${mk.label}, ${a.label}, ${b.label} 共线`);
          }
        }
      }
    }

    return result;
  }, [entities, selectedId]);

  if (relations.length === 0) return null;

  return (
    <div style={{
      position: 'absolute', bottom: 38, right: 10,
      display: 'flex', flexDirection: 'column', gap: 3,
      pointerEvents: 'none', zIndex: 10,
    }}>
      {relations.map((r, i) => (
        <div key={i} style={{
          background: 'rgba(255,255,255,0.92)',
          border: `1px solid ${COLORS.primary}`,
          borderRadius: RADIUS.sm,
          padding: '3px 10px',
          fontSize: 13,
          fontWeight: 600,
          color: COLORS.primary,
          backdropFilter: 'blur(4px)',
        }}>
          {r}
        </div>
      ))}
    </div>
  );
}

// ─── 工具栏（匹配 visual_template ToolBar 样式：column 布局、绿色边框）───

function DemoToolBar() {
  const { activeTool, opKind, setTool, setOpKind, toggleShowAllCoords, showAllCoords } = useDemoToolStore();
  const [opMenuOpen, setOpMenuOpen] = useState(false);

  const opKinds: { kind: DemoOpKind; label: string; icon: string }[] = [
    { kind: 'add', label: '加法 a+b', icon: '+' },
    { kind: 'subtract', label: '减法 a-b', icon: '-' },
    { kind: 'dotProduct', label: '数量积 a·b', icon: '·' },
    { kind: 'scale', label: '数乘 k·a', icon: '×' },
    { kind: 'projection', label: '投影 proj(a,b)', icon: '⊥' },
  ];

  return (
    <div style={{
      position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
      zIndex: 10, display: 'flex', gap: 2,
      background: 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(8px)',
      border: `1px solid ${COLORS.border}`,
      borderRadius: RADIUS.sm, padding: '4px 6px',
      boxShadow: SHADOWS.sm,
      alignItems: 'stretch',
    }}>
      <ToolBtn icon="↖" label="选择" active={activeTool === 'select'} onClick={() => setTool('select')} title="选择工具" />

      {/* 分隔线 */}
      <div style={{ width: 1, background: COLORS.border, margin: '2px 4px', alignSelf: 'stretch' }} />

      <ToolBtn icon="→" label="向量" active={activeTool === 'createVector'} onClick={() => setTool('createVector')} title="点击两次创建向量" />

      {/* 分隔线 */}
      <div style={{ width: 1, background: COLORS.border, margin: '2px 4px', alignSelf: 'stretch' }} />

      <div style={{ position: 'relative' }}>
        <ToolBtn
          icon="⊕"
          label={`运算${opKind && activeTool === 'vectorOp' ? ` ${opLabelShort(opKind)}` : ''}`}
          active={activeTool === 'vectorOp'}
          onClick={() => setOpMenuOpen((v) => !v)}
          title="选择向量运算"
        />
        {opMenuOpen && (
          <div style={{
            position: 'absolute', top: '110%', left: 0,
            background: COLORS.bg, border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.md, boxShadow: SHADOWS.lg,
            minWidth: 130, zIndex: 20,
          }}>
            {opKinds.map(({ kind, label }) => (
              <button key={kind}
                onClick={() => { setOpKind(kind); setTool('vectorOp'); setOpMenuOpen(false); }}
                style={{
                  display: 'block', width: '100%', padding: '7px 14px',
                  textAlign: 'left', fontSize: 14, border: 'none', cursor: 'pointer',
                  color: opKind === kind && activeTool === 'vectorOp' ? COLORS.primary : COLORS.text,
                  fontWeight: opKind === kind && activeTool === 'vectorOp' ? 700 : 400,
                  background: 'transparent',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = COLORS.bgMuted; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 分隔线 */}
      <div style={{ width: 1, background: COLORS.border, margin: '2px 4px', alignSelf: 'stretch' }} />

      {/* 几何工具组 */}
      <ToolBtn icon="●" label="标记点" active={activeTool === 'markerPoint'} onClick={() => setTool('markerPoint')} title="点击放置标记点" />
      <ToolBtn icon="—" label="线段" active={activeTool === 'segment'} onClick={() => setTool('segment')} title="两次点击创建线段" />
      <ToolBtn icon="○" label="圆" active={activeTool === 'circle'} onClick={() => setTool('circle')} title="圆心+半径点创建圆" />
      <ToolBtn icon="/" label="直线" active={activeTool === 'line'} onClick={() => setTool('line')} title="两点确定一条直线" />
      <ToolBtn icon="→•" label="射线" active={activeTool === 'ray'} onClick={() => setTool('ray')} title="端点+方向点确定射线" />
      <ToolBtn icon="⬠" label="多边形" active={activeTool === 'polygon'} onClick={() => setTool('polygon')} title="多次点击选点，双击闭合" />
      <ToolBtn icon="T" label="文字" active={activeTool === 'textLabel'} onClick={() => setTool('textLabel')} title="点击放置文字标签" />

      {/* 分隔线 */}
      <div style={{ width: 1, background: COLORS.border, margin: '2px 4px', alignSelf: 'stretch' }} />

      {/* 标注工具组 */}
      <ToolBtn icon="∠" label="角度" active={activeTool === 'angleMark'} onClick={() => setTool('angleMark')} title="选3个标记点标注角度" />
      <ToolBtn icon="⇔" label="距离" active={activeTool === 'distanceMark'} onClick={() => setTool('distanceMark')} title="选2个标记点标注距离" />

      {/* 分隔线 */}
      <div style={{ width: 1, background: COLORS.border, margin: '2px 4px', alignSelf: 'stretch' }} />

      {/* 构造工具组（下拉菜单） */}
      <ConstructMenu activeTool={activeTool} setTool={setTool} />

      {/* 分隔线 */}
      <div style={{ width: 1, background: COLORS.border, margin: '2px 4px', alignSelf: 'stretch' }} />

      {/* 变换工具组（下拉菜单） */}
      <TransformMenu activeTool={activeTool} setTool={setTool} />

      {/* 分隔线 */}
      <div style={{ width: 1, background: COLORS.border, margin: '2px 4px', alignSelf: 'stretch' }} />

      {/* 滑动条 */}
      <ToolBtn icon="⎯●" label="滑动条" active={activeTool === 'slider'} onClick={() => setTool('slider')} title="点击放置滑动条" />

      {/* 分隔线 */}
      <div style={{ width: 1, background: COLORS.border, margin: '2px 4px', alignSelf: 'stretch' }} />

      {/* 坐标显示开关 */}
      <ToolBtn
        icon="(x,y)"
        label={showAllCoords ? '隐藏坐标' : '坐标'}
        active={showAllCoords}
        onClick={toggleShowAllCoords}
        title="显示/隐藏所有标记点坐标"
      />

      {/* 分隔线 */}
      <div style={{ width: 1, background: COLORS.border, margin: '2px 4px', alignSelf: 'stretch' }} />

      {/* 缩放提示 */}
      <div style={{ alignSelf: 'center', fontSize: 14, color: COLORS.textMuted, whiteSpace: 'nowrap', padding: '0 4px' }}>
        平移 · 滚轮缩放
      </div>
    </div>
  );
}

function opLabelShort(kind: string): string {
  switch (kind) {
    case 'add': return 'a+b';
    case 'subtract': return 'a−b';
    case 'dotProduct': return 'a·b';
    case 'scale': return 'k·a';
    default: return kind;
  }
}

function ToolBtn({ icon, label, active, onClick, title }: {
  icon: string; label: string; active: boolean; onClick: () => void; title?: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        minWidth: 48, padding: '6px 8px', borderRadius: RADIUS.sm,
        border: active ? `1.5px solid ${COLORS.primary}` : '1.5px solid transparent',
        background: active ? COLORS.primaryFocusRing : hovered ? 'rgba(243,244,246,0.95)' : 'transparent',
        cursor: 'pointer', transition: 'all 0.15s',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
      }}
    >
      <span style={{ fontSize: 16, lineHeight: 1, color: active ? COLORS.primary : COLORS.text }}>{icon}</span>
      <span style={{ fontSize: 14, lineHeight: 1, color: active ? COLORS.primary : COLORS.textMuted, whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  );
}

// ─── 构造工具下拉菜单 ───

const CONSTRUCTION_TOOLS: import('@/editor/demo/demoTypes').DemoTool[] = [
  'perpendicular', 'parallelLine', 'midpoint', 'perpBisector', 'angleBisector', 'pointLineDist',
  'tangent', 'commonTangent',
];

const CONSTRUCTION_ITEMS: { tool: import('@/editor/demo/demoTypes').DemoTool; label: string }[] = [
  { tool: 'perpendicular', label: '⊥ 垂线' },
  { tool: 'parallelLine', label: '∥ 平行线' },
  { tool: 'midpoint', label: '• 中点' },
  { tool: 'perpBisector', label: '⊥ 垂直平分线' },
  { tool: 'angleBisector', label: '∠ 角平分线' },
  { tool: 'pointLineDist', label: '↕ 点到直线距离' },
  { tool: 'tangent', label: '⌒ 切线' },
  { tool: 'commonTangent', label: '⌒⌒ 公切线' },
];

function ConstructMenu({ activeTool, setTool }: {
  activeTool: import('@/editor/demo/demoTypes').DemoTool;
  setTool: (t: import('@/editor/demo/demoTypes').DemoTool) => void;
}) {
  const [open, setOpen] = useState(false);
  const isActive = CONSTRUCTION_TOOLS.includes(activeTool);

  return (
    <div style={{ position: 'relative' }}>
      <ToolBtn
        icon="△"
        label={isActive ? constructLabel(activeTool) : '构造'}
        active={isActive}
        onClick={() => setOpen((v) => !v)}
        title="几何构造工具"
      />
      {open && (
        <div style={{
          position: 'absolute', top: '110%', left: 0,
          background: COLORS.bg, border: `1px solid ${COLORS.border}`,
          borderRadius: RADIUS.md, boxShadow: SHADOWS.lg,
          minWidth: 150, zIndex: 20,
        }}>
          {CONSTRUCTION_ITEMS.map(({ tool, label }) => (
            <button key={tool}
              onClick={() => { setTool(tool); setOpen(false); }}
              style={{
                display: 'block', width: '100%', padding: '7px 14px',
                textAlign: 'left', fontSize: 14, border: 'none', cursor: 'pointer',
                color: activeTool === tool ? COLORS.primary : COLORS.text,
                fontWeight: activeTool === tool ? 700 : 400,
                background: 'transparent',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = COLORS.bgMuted; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function constructLabel(tool: string): string {
  switch (tool) {
    case 'perpendicular': return '垂线';
    case 'parallelLine': return '平行';
    case 'midpoint': return '中点';
    case 'perpBisector': return '垂分';
    case 'angleBisector': return '角分';
    case 'pointLineDist': return '点线距';
    case 'tangent': return '切线';
    case 'commonTangent': return '公切线';
    default: return '构造';
  }
}

// ─── 变换工具下拉菜单 ───

const TRANSFORM_TOOLS: import('@/editor/demo/demoTypes').DemoTool[] = [
  'translate', 'rotate', 'reflect', 'dilate', 'centralSymmetry',
];

const TRANSFORM_ITEMS: { tool: import('@/editor/demo/demoTypes').DemoTool; label: string }[] = [
  { tool: 'translate', label: '↗ 平移' },
  { tool: 'rotate', label: '↻ 旋转' },
  { tool: 'reflect', label: '⇅ 轴对称' },
  { tool: 'dilate', label: '◇ 位似' },
  { tool: 'centralSymmetry', label: '⊙ 中心对称' },
];

function TransformMenu({ activeTool, setTool }: {
  activeTool: import('@/editor/demo/demoTypes').DemoTool;
  setTool: (t: import('@/editor/demo/demoTypes').DemoTool) => void;
}) {
  const [open, setOpen] = useState(false);
  const isActive = TRANSFORM_TOOLS.includes(activeTool);

  return (
    <div style={{ position: 'relative' }}>
      <ToolBtn
        icon="⟳"
        label={isActive ? transformLabel(activeTool) : '变换'}
        active={isActive}
        onClick={() => setOpen((v) => !v)}
        title="几何变换工具"
      />
      {open && (
        <div style={{
          position: 'absolute', top: '110%', left: 0,
          background: COLORS.bg, border: `1px solid ${COLORS.border}`,
          borderRadius: RADIUS.md, boxShadow: SHADOWS.lg,
          minWidth: 130, zIndex: 20,
        }}>
          {TRANSFORM_ITEMS.map(({ tool, label }) => (
            <button key={tool}
              onClick={() => { setTool(tool); setOpen(false); }}
              style={{
                display: 'block', width: '100%', padding: '7px 14px',
                textAlign: 'left', fontSize: 14, border: 'none', cursor: 'pointer',
                color: activeTool === tool ? COLORS.primary : COLORS.text,
                fontWeight: activeTool === tool ? 700 : 400,
                background: 'transparent',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = COLORS.bgMuted; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function transformLabel(tool: string): string {
  switch (tool) {
    case 'translate': return '平移';
    case 'rotate': return '旋转';
    case 'reflect': return '轴对称';
    case 'dilate': return '位似';
    case 'centralSymmetry': return '中心对称';
    default: return '变换';
  }
}

// ─── 步骤指示器（匹配 visual_template ModeIndicator）───

interface ToolStepDef { label: string; status: 'pending' | 'active' | 'done' }

function DemoStepIndicator() {
  const { activeTool, opKind, step } = useDemoToolStore();

  // 根据当前工具/步骤生成步骤列表
  let steps: ToolStepDef[] | null = null;

  if (activeTool === 'createVector') {
    steps = [
      { label: '点击确定起点', status: step === 0 ? 'active' : 'done' },
      { label: '点击确定终点', status: step === 0 ? 'pending' : 'active' },
    ];
  } else if (activeTool === 'vectorOp' && opKind) {
    if (opKind === 'scale') {
      steps = [
        { label: '点击一个向量', status: 'active' },
      ];
    } else {
      steps = [
        { label: '选择第一个向量', status: step === 0 ? 'active' : 'done' },
        { label: '选择第二个向量', status: step === 0 ? 'pending' : 'active' },
      ];
    }
  } else if (activeTool === 'segment') {
    steps = [
      { label: '点击确定起点', status: step === 0 ? 'active' : 'done' },
      { label: '点击确定终点', status: step === 0 ? 'pending' : 'active' },
    ];
  } else if (activeTool === 'circle') {
    steps = [
      { label: '点击确定圆心', status: step === 0 ? 'active' : 'done' },
      { label: '点击确定半径点', status: step === 0 ? 'pending' : 'active' },
    ];
  } else if (activeTool === 'angleMark') {
    steps = [
      { label: '选择点A', status: step === 0 ? 'active' : 'done' },
      { label: '选择顶点V', status: step <= 0 ? 'pending' : step === 1 ? 'active' : 'done' },
      { label: '选择点C', status: step <= 1 ? 'pending' : 'active' },
    ];
  } else if (activeTool === 'distanceMark') {
    steps = [
      { label: '选择第一个点', status: step === 0 ? 'active' : 'done' },
      { label: '选择第二个点', status: step === 0 ? 'pending' : 'active' },
    ];
  } else if (activeTool === 'perpendicular' || activeTool === 'pointLineDist') {
    steps = [
      { label: '选择点P', status: step === 0 ? 'active' : 'done' },
      { label: '选择线段AB', status: step === 0 ? 'pending' : 'active' },
    ];
  } else if (activeTool === 'parallelLine') {
    steps = [
      { label: '选择点P', status: step === 0 ? 'active' : 'done' },
      { label: '选择线段AB', status: step === 0 ? 'pending' : 'active' },
    ];
  } else if (activeTool === 'midpoint') {
    steps = [{ label: '点击线段', status: 'active' }];
  } else if (activeTool === 'perpBisector') {
    steps = [{ label: '点击线段', status: 'active' }];
  } else if (activeTool === 'angleBisector') {
    steps = [
      { label: '选择点A', status: step === 0 ? 'active' : 'done' },
      { label: '选择顶点V', status: step <= 0 ? 'pending' : step === 1 ? 'active' : 'done' },
      { label: '选择点C', status: step <= 1 ? 'pending' : 'active' },
    ];
  } else if (activeTool === 'line') {
    steps = [
      { label: '点击确定第一个点', status: step === 0 ? 'active' : 'done' },
      { label: '点击确定第二个点', status: step === 0 ? 'pending' : 'active' },
    ];
  } else if (activeTool === 'ray') {
    steps = [
      { label: '点击确定端点', status: step === 0 ? 'active' : 'done' },
      { label: '点击确定方向点', status: step === 0 ? 'pending' : 'active' },
    ];
  } else if (activeTool === 'polygon') {
    steps = [
      { label: `选择顶点（已选${step}个）`, status: step < 3 ? 'active' : 'done' },
      { label: '点击首点闭合', status: step < 3 ? 'pending' : 'active' },
    ];
  } else if (activeTool === 'translate') {
    steps = [
      { label: '选择要平移的点', status: step === 0 ? 'active' : 'done' },
      { label: '点击一个向量', status: step === 0 ? 'pending' : 'active' },
    ];
  } else if (activeTool === 'rotate') {
    steps = [
      { label: '选择要旋转的点', status: step === 0 ? 'active' : 'done' },
      { label: '选择旋转中心', status: step <= 0 ? 'pending' : step === 1 ? 'active' : 'done' },
      { label: '输入角度', status: step <= 1 ? 'pending' : 'active' },
    ];
  } else if (activeTool === 'reflect') {
    steps = [
      { label: '选择要对称的点', status: step === 0 ? 'active' : 'done' },
      { label: '选择对称轴（线段）', status: step === 0 ? 'pending' : 'active' },
    ];
  } else if (activeTool === 'dilate') {
    steps = [
      { label: '选择要变换的点', status: step === 0 ? 'active' : 'done' },
      { label: '选择位似中心', status: step <= 0 ? 'pending' : step === 1 ? 'active' : 'done' },
      { label: '输入比例', status: step <= 1 ? 'pending' : 'active' },
    ];
  } else if (activeTool === 'centralSymmetry') {
    steps = [
      { label: '选择要对称的点', status: step === 0 ? 'active' : 'done' },
      { label: '选择对称中心', status: step === 0 ? 'pending' : 'active' },
    ];
  } else if (activeTool === 'tangent') {
    steps = [
      { label: '选择外部点', status: step === 0 ? 'active' : 'done' },
      { label: '选择圆', status: step === 0 ? 'pending' : 'active' },
    ];
  } else if (activeTool === 'commonTangent') {
    steps = [
      { label: '选择第一个圆', status: step === 0 ? 'active' : 'done' },
      { label: '选择第二个圆', status: step === 0 ? 'pending' : 'active' },
    ];
  } else if (activeTool === 'slider') {
    steps = [{ label: '点击放置滑动条', status: 'active' }];
  }

  if (!steps) return null;

  return (
    <div style={{
      position: 'absolute',
      top: 56,
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(255,255,255,0.95)',
      color: COLORS.text,
      border: `1px solid ${COLORS.border}`,
      padding: '5px 16px',
      borderRadius: RADIUS.sm,
      fontSize: 14,
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
      zIndex: 15,
      fontWeight: 500,
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {i > 0 && (
              <div style={{
                width: 16,
                height: 1,
                background: s.status === 'done' ? COLORS.success : COLORS.border,
              }} />
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <DemoStepBadge index={i + 1} status={s.status} />
              <span style={{
                fontSize: 14,
                color: s.status === 'done' ? COLORS.success
                  : s.status === 'active' ? COLORS.text
                  : COLORS.textMuted,
                fontWeight: s.status === 'active' ? 600 : 400,
              }}>
                {s.label}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DemoStepBadge({ index, status }: { index: number; status: ToolStepDef['status'] }) {
  const isDone = status === 'done';
  const isActive = status === 'active';
  return (
    <div style={{
      width: 24,
      height: 24,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 12,
      fontWeight: 700,
      flexShrink: 0,
      background: isDone ? COLORS.success : 'transparent',
      color: isDone ? COLORS.white : isActive ? COLORS.text : COLORS.textMuted,
      border: isDone ? 'none' : `1.5px solid ${isActive ? COLORS.text : COLORS.border}`,
    }}>
      {isDone ? '✓' : index}
    </div>
  );
}

// ─── 状态栏 ───
function StatusBar() {
  const { activeTool, opKind, step } = useDemoToolStore();
  const { selectedId } = useDemoSelectionStore();

  const msg = activeTool === 'createVector'
    ? (step === 0 ? '第一步：点击确定起点' : '第二步：点击确定终点')
    : activeTool === 'vectorOp'
      ? (!opKind ? '请从工具栏选择运算类型'
        : opKind === 'scale' ? '点击一个向量执行数乘'
        : step === 0 ? '第一步：点击第一个向量' : '第二步：点击第二个向量')
      : activeTool === 'markerPoint'
        ? '点击画布放置标记点（A, B, C...）'
        : activeTool === 'segment'
          ? (step === 0 ? '第一步：点击起点（命中标记点复用，空白处新建）' : '第二步：点击终点')
          : activeTool === 'circle'
            ? (step === 0 ? '第一步：点击确定圆心' : '第二步：点击确定半径点')
            : activeTool === 'textLabel'
              ? '点击画布放置文字标签'
              : activeTool === 'angleMark'
                ? (step === 0 ? '第一步：选择点A' : step === 1 ? '第二步：选择顶点V' : '第三步：选择点C')
                : activeTool === 'distanceMark'
                  ? (step === 0 ? '第一步：选择第一个标记点' : '第二步：选择第二个标记点')
                  : activeTool === 'perpendicular'
                    ? (step === 0 ? '第一步：选择点P' : '第二步：点击线段AB')
                    : activeTool === 'parallelLine'
                      ? (step === 0 ? '第一步：选择点P' : '第二步：点击线段AB')
                      : activeTool === 'midpoint'
                        ? '点击一条线段，创建其中点'
                        : activeTool === 'perpBisector'
                          ? '点击一条线段，创建垂直平分线'
                          : activeTool === 'angleBisector'
                            ? (step === 0 ? '第一步：选择点A' : step === 1 ? '第二步：选择顶点V' : '第三步：选择点C')
                            : activeTool === 'pointLineDist'
                              ? (step === 0 ? '第一步：选择点P' : '第二步：点击线段AB')
                              : activeTool === 'line'
                                ? (step === 0 ? '第一步：点击第一个点' : '第二步：点击第二个点')
                                : activeTool === 'ray'
                                  ? (step === 0 ? '第一步：点击端点' : '第二步：点击方向点')
                                  : activeTool === 'polygon'
                                    ? `点击选择顶点（已选${step}个），点击首点闭合`
                                    : activeTool === 'slider'
                                      ? '点击画布放置滑动条'
                                      : activeTool === 'translate'
                                        ? (step === 0 ? '第一步：选择要平移的点' : '第二步：点击一个向量')
                                        : activeTool === 'rotate'
                                          ? (step === 0 ? '第一步：选择要旋转的点' : step === 1 ? '第二步：选择旋转中心' : '第三步：输入角度')
                                          : activeTool === 'reflect'
                                            ? (step === 0 ? '第一步：选择要对称的点' : '第二步：选择对称轴（线段）')
                                            : activeTool === 'dilate'
                                              ? (step === 0 ? '第一步：选择要变换的点' : step === 1 ? '第二步：选择位似中心' : '第三步：输入比例')
                                              : activeTool === 'centralSymmetry'
                                                ? (step === 0 ? '第一步：选择要对称的点' : '第二步：选择对称中心')
                                                : activeTool === 'tangent'
                                                  ? (step === 0 ? '第一步：选择外部点' : '第二步：选择圆')
                                                  : activeTool === 'commonTangent'
                                                    ? (step === 0 ? '第一步：选择第一个圆' : '第二步：选择第二个圆')
                                                    : selectedId
                                                      ? '已选中 — Delete 删除 · 拖拽端点移动'
                                                      : '拖拽端点移动 · Ctrl+Z 撤销 · 左键拖空白平移 · 滚轮缩放';

  return (
    <div style={{
      position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
      fontSize: 14, color: COLORS.textMuted,
      background: 'rgba(255,255,255,0.85)', padding: '4px 12px',
      borderRadius: RADIUS.sm, border: `1px solid ${COLORS.border}`,
      pointerEvents: 'none', whiteSpace: 'nowrap',
    }}>
      {msg}
    </div>
  );
}

function LocusConstraintLayer() {
  const constraints = useConstraintStore((s) => s.constraints);
  const objectiveExtrema = useConstraintStore((s) => s.objectiveExtrema);
  const items = useMemo(() =>
    Object.values(constraints).filter((c) => c.visible && c.segments.length > 0),
    [constraints],
  );
  if (items.length === 0) return null;
  return (
    <g className="constraint-locus-layer">
      {items.map((c) => {
        const d = c.segments.map(([x1, y1, x2, y2]) => {
          const [sx1, sy1] = m2s(x1, y1);
          const [sx2, sy2] = m2s(x2, y2);
          return `M${sx1},${sy1}L${sx2},${sy2}`;
        }).join(' ');
        return <path key={c.id} d={d} fill="none" stroke={c.color} strokeWidth={2} opacity={0.7} />;
      })}
      {objectiveExtrema?.min && (() => {
        const [sx, sy] = m2s(objectiveExtrema.min!.x, objectiveExtrema.min!.y);
        return (
          <g key="obj-min">
            <circle cx={sx} cy={sy} r={5} fill="#2563eb" stroke="#fff" strokeWidth={1.5} />
            <text x={sx + 8} y={sy - 6} fontSize={11} fill="#2563eb" fontWeight={600}
              style={{ textShadow: '0 0 3px #fff, 0 0 3px #fff' }}>
              min={objectiveExtrema.min!.value.toFixed(2)}
            </text>
          </g>
        );
      })()}
      {objectiveExtrema?.max && (() => {
        const [sx, sy] = m2s(objectiveExtrema.max!.x, objectiveExtrema.max!.y);
        return (
          <g key="obj-max">
            <circle cx={sx} cy={sy} r={5} fill="#dc2626" stroke="#fff" strokeWidth={1.5} />
            <text x={sx + 8} y={sy - 6} fontSize={11} fill="#dc2626" fontWeight={600}
              style={{ textShadow: '0 0 3px #fff, 0 0 3px #fff' }}>
              max={objectiveExtrema.max!.value.toFixed(2)}
            </text>
          </g>
        );
      })()}
    </g>
  );
}

function LocusLayer({ points }: { points: DemoPoint[] }) {
  const items = useMemo(
    () => points.filter((p) => p.showLocus && p.motion),
    [points],
  );
  if (items.length === 0) return null;
  return (
    <g className="locus-layer">
      {items.map((pt) => {
        const m = pt.motion!;
        if (m.kind === 'circular') {
          const [cx, cy] = m2s(m.cx, m.cy);
          const r = m.radius * SCALE;
          return <circle key={`locus-${pt.id}`} cx={cx} cy={cy} r={r}
            fill="none" stroke="#bbb" strokeWidth={1} strokeDasharray="4 3" />;
        }
        if (m.kind === 'linear') {
          const [x1, y1] = m2s(m.x1, m.y1);
          const [x2, y2] = m2s(m.x2, m.y2);
          return <line key={`locus-${pt.id}`} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="#bbb" strokeWidth={1} strokeDasharray="4 3" />;
        }
        return null;
      })}
    </g>
  );
}

function TraceLayer({ entities }: { entities: Record<string, import('@/editor/demo/demoTypes').DemoEntity> }) {
  const traces = useTraceStore((s) => s.traces);
  const traceEnabled = useTraceStore((s) => s.traceEnabled);

  const items = useMemo(() => {
    const result: { id: string; points: { x: number; y: number }[]; color: string }[] = [];
    for (const [id, pts] of Object.entries(traces)) {
      if (!traceEnabled[id] || pts.length < 2) continue;
      const ent = entities[id];
      let color = '#999';
      if (ent) {
        if (ent.type === 'demoMarker') color = (ent as DemoMarker).color;
        else if (ent.type === 'demoPoint') {
          const vecs = Object.values(entities).filter(
            (e) => e.type === 'demoVector' && ((e as DemoVector).startId === id || (e as DemoVector).endId === id),
          ) as DemoVector[];
          if (vecs.length > 0) color = vecs[0].color;
        }
      }
      result.push({ id, points: pts, color });
    }
    return result;
  }, [traces, traceEnabled, entities]);

  if (items.length === 0) return null;

  return (
    <g className="trace-layer">
      {items.map(({ id, points, color }) => {
        const d = points.map((p, i) => {
          const [sx, sy] = m2s(p.x, p.y);
          return `${i === 0 ? 'M' : 'L'}${sx},${sy}`;
        }).join(' ');
        return <path key={id} d={d} fill="none" stroke={color} strokeWidth={1.5} opacity={0.4} />;
      })}
    </g>
  );
}

function AnimationControlBar({ entities }: { entities: Record<string, import('@/editor/demo/demoTypes').DemoEntity> }) {
  const { status, speed, play, pause, stop, setSpeed } = useAnimationStore();
  const hasMotion = useMemo(() =>
    Object.values(entities).some((e) => e.type === 'demoPoint' && (e as DemoPoint).motion),
    [entities],
  );
  if (!hasMotion) return null;

  const speedOptions = [0.5, 1, 2, 4];
  const btnBase: React.CSSProperties = {
    padding: '4px 10px', fontSize: 13, cursor: 'pointer',
    borderRadius: RADIUS.sm, border: `1px solid ${COLORS.border}`,
    background: 'transparent', color: COLORS.text,
  };

  return (
    <div style={{
      position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
      zIndex: 20, display: 'flex', alignItems: 'center', gap: 6,
      background: 'rgba(255,255,255,0.95)', padding: '8px 16px',
      borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}`,
      boxShadow: SHADOWS.md,
    }}>
      {status === 'playing' ? (
        <button style={btnBase} onClick={pause} title="暂停">⏸</button>
      ) : (
        <button style={{ ...btnBase, color: COLORS.primary, borderColor: COLORS.primary }} onClick={play} title="播放">▶</button>
      )}
      <button style={btnBase} onClick={stop} title="停止">⏹</button>
      <span style={{ width: 1, height: 18, background: COLORS.border }} />
      {speedOptions.map((s) => (
        <button key={s} style={{
          ...btnBase,
          fontWeight: speed === s ? 700 : 400,
          color: speed === s ? COLORS.primary : COLORS.textMuted,
          borderColor: speed === s ? COLORS.primary : COLORS.border,
        }} onClick={() => setSpeed(s)}>
          {s}x
        </button>
      ))}
    </div>
  );
}
