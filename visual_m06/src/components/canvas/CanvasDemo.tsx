import { useRef, useState, useCallback, useEffect } from 'react';
import { useHistoryStore } from '@/editor';
import { useDemoEntityStore } from '@/editor/demo/demoEntityStore';
import { useDemoSelectionStore } from '@/editor/demo/demoSelectionStore';
import { useDemoToolStore } from '@/editor/demo/demoToolStore';
import {
  CreateVectorCmd, MovePointCmd, CreateVecOpCmd, DeleteVectorCmd, UpdateVecOpCmd,
} from '@/editor/demo/demoCommands';
import type { DemoPoint, DemoVector, DemoVecOp } from '@/editor/demo/demoTypes';
import { DEMO_COLORS } from '@/editor/demo/demoTypes';
import { COLORS, RADIUS, SHADOWS } from '@/styles/tokens';
import { add2D, sub2D, dot2D, scale2D, angle2D, toDeg } from '@/engine/vectorMath';
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

// ─── 约束辅助：获取端点的约束信息 ───

type DemoEntMap = Record<string, import('@/editor/demo/demoTypes').DemoEntity>;

/** 获取端点的约束信息（仅限约束向量的自由端） */
function getPointConstraint(ptId: string, ents: DemoEntMap): { anchorId: string; length: number } | null {
  for (const en of Object.values(ents)) {
    if (en.type !== 'demoVector') continue;
    const v = en as DemoVector;
    if (!v.constraint || v.constraint === 'free' || !v.constraintLength) continue;
    if (v.constraint === 'fixedStart' && v.endId === ptId)
      return { anchorId: v.startId, length: v.constraintLength };
    if (v.constraint === 'fixedEnd' && v.startId === ptId)
      return { anchorId: v.endId, length: v.constraintLength };
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
  const svgRef = useRef<SVGSVGElement>(null);
  const entities = useDemoEntityStore((s) => s.entities);
  const { selectedId, hoveredId, select, setHovered } = useDemoSelectionStore();
  const { activeTool, opKind, step, pendingStartPoint, pendingVec1Id,
    nextStep, resetTool, setPendingStart, setPendingVec1 } = useDemoToolStore();
  const { execute } = useHistoryStore();
  const nextEntityId = useDemoEntityStore((s) => s.nextEntityId);

  // ─── 视口状态（平移/缩放）───
  const [view, setView] = useState<ViewState>({ x: VB_X, y: VB_Y, w: VB_W, h: VB_H });
  const viewRef = useRef(view);
  viewRef.current = view;

  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  // 拖拽端点状态
  const draggingPointRef = useRef<{
    pointId: string;
    before: { x: number; y: number };
    current: { x: number; y: number };
    moved: boolean;
    group: { id: string; before: { x: number; y: number } }[];
  } | null>(null);

  // 拖拽运算起点状态
  const draggingOpOriginRef = useRef<{
    opId: string;
    before: { x: number; y: number };
    current: { x: number; y: number };
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

  // 实体分类
  const points = Object.values(entities).filter((e): e is DemoPoint => e.type === 'demoPoint');
  const vectors = Object.values(entities).filter((e): e is DemoVector => e.type === 'demoVector');
  const ops = Object.values(entities).filter((e): e is DemoVecOp => e.type === 'demoVecOp');
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
    for (const pt of points) {
      const [sx, sy] = m2s(pt.x, pt.y);
      if (Math.hypot(svgX - sx, svgY - sy) < ptThresh) return pt.id;
    }
    for (const vec of vectors) {
      const sp = entities[vec.startId] as DemoPoint | undefined;
      const ep = entities[vec.endId] as DemoPoint | undefined;
      if (!sp || !ep) continue;
      const [sx1, sy1] = m2s(sp.x, sp.y);
      const [sx2, sy2] = m2s(ep.x, ep.y);
      if (distToSegment(svgX, svgY, sx1, sy1, sx2, sy2) < lineThresh) return vec.id;
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
    return null;
  }, [entities, points, vectors, ops, view.w]);

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

  // ─── PointerMove（平移 / 拖拽端点 / 拖拽运算起点 / hover）───
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

      // 收集自身 + 所有绑定伙伴的约束圆
      const group = st.getBoundGroup(ptId);
      const allPtIds = [ptId, ...group];
      const circles: { cx: number; cy: number; r: number }[] = [];
      for (const pid of allPtIds) {
        const c = getPointConstraint(pid, ents);
        if (!c) continue;
        const anchor = ents[c.anchorId] as DemoPoint | undefined;
        if (anchor) circles.push({ cx: anchor.x, cy: anchor.y, r: c.length });
      }

      if (circles.length >= 2) {
        // 多圆约束：逐步求交点集合
        let candidates = circleIntersections(
          circles[0].cx, circles[0].cy, circles[0].r,
          circles[1].cx, circles[1].cy, circles[1].r,
        );
        for (let i = 2; i < circles.length && candidates.length > 0; i++) {
          const c = circles[i];
          candidates = candidates.filter(([px, py]) => {
            const d = Math.sqrt((px - c.cx) ** 2 + (py - c.cy) ** 2);
            return Math.abs(d - c.r) < 0.15; // 容差
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
      } else if (circles.length === 1) {
        // 单圆约束
        [mx, my] = projectOntoConstraint(mx, my, circles[0].cx, circles[0].cy, circles[0].r);
      }
      // circles.length === 0 → 无约束，自由移动

      const cur = draggingPointRef.current.current;
      if (mx !== cur.x || my !== cur.y) {
        draggingPointRef.current.current = { x: mx, y: my };
        draggingPointRef.current.moved = true;
        st.updateEntity(ptId, { x: mx, y: my });
        for (const pid of group) st.updateEntity(pid, { x: mx, y: my });
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
        useDemoEntityStore.getState().updateEntity(draggingOpOriginRef.current.opId, { originX: mx, originY: my });
      }
      return;
    }

    setHovered(hitTest(svgX, svgY));
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
        execute(new MovePointCmd(pointId, before, current));
        for (const g of group) {
          execute(new MovePointCmd(g.id, g.before, current));
        }
      }
    }
    if (draggingOpOriginRef.current) {
      const { opId, before, current, moved } = draggingOpOriginRef.current;
      draggingOpOriginRef.current = null;
      if (moved) execute(new UpdateVecOpCmd(opId, { originX: before.x, originY: before.y }, { originX: current.x, originY: current.y }));
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
    const [svgX, svgY] = clientToSVG(e.clientX, e.clientY, svgRef.current);
    const [mx, my] = svgToMath(svgX, svgY);
    const hitId = hitTest(svgX, svgY);

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
        resetTool();
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
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool, opKind, step, pendingStartPoint, pendingVec1Id, entities, execute,
      nextEntityId, select, nextStep, resetTool, setPendingStart, setPendingVec1, hitTest, vecCount]);

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
    // 约束向量的固定端不可拖拽
    for (const en of Object.values(entities)) {
      if (en.type !== 'demoVector') continue;
      const v = en as DemoVector;
      if (!v.constraint || v.constraint === 'free') continue;
      if ((v.constraint === 'fixedStart' && pointId === v.startId)
        || (v.constraint === 'fixedEnd' && pointId === v.endId)) return; // 锁定
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    const groupIds = useDemoEntityStore.getState().getBoundGroup(pointId);
    const group = groupIds.map((id) => {
      const gp = entities[id] as DemoPoint | undefined;
      return { id, before: gp ? { x: gp.x, y: gp.y } : { x: 0, y: 0 } };
    });
    draggingPointRef.current = {
      pointId, before: { x: pt.x, y: pt.y }, current: { x: pt.x, y: pt.y }, moved: false, group,
    };
  }, [activeTool, entities]);

  // ─── 运算起点拖拽开始 ───
  const handleOpOriginPointerDown = useCallback((e: React.PointerEvent<SVGElement>, opId: string, ox: number, oy: number) => {
    if (activeTool !== 'select') return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingOpOriginRef.current = { opId, before: { x: ox, y: oy }, current: { x: ox, y: oy }, moved: false };
  }, [activeTool]);

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
        const { activeTool: tool, step: curStep, pendingVec1Id: pv1 } = useDemoToolStore.getState();
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
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        const all = useDemoEntityStore.getState().entities;
        const entity = all[selectedId];
        if (entity?.type !== 'demoVector') return;
        const vec = entity as DemoVector;
        const sp = all[vec.startId] as DemoPoint;
        const ep = all[vec.endId] as DemoPoint;
        const orphanOps = Object.values(all).filter(
          (en): en is DemoVecOp => en.type === 'demoVecOp' && (en.vec1Id === selectedId || en.vec2Id === selectedId),
        );
        execute(new DeleteVectorCmd(vec, sp, ep, orphanOps));
        select(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, execute, select]);

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
    const dx = sx2 - sx1, dy = sy2 - sy1, len = Math.hypot(dx, dy);
    const lx = len > 0 ? sx2 - dy / len * 14 + dx / len * 4 : sx2;
    const ly = len > 0 ? sy2 + dx / len * 14 + dy / len * 4 : sy2;
    // 约束轨迹圆
    const hasConstraint = vec.constraint && vec.constraint !== 'free' && vec.constraintLength;
    const anchorSvg = hasConstraint
      ? (vec.constraint === 'fixedStart' ? [sx1, sy1] : [sx2, sy2])
      : null;
    const orbitR = hasConstraint ? vec.constraintLength! * SCALE : 0;

    return (
      <g key={vec.id}>
        {/* 约束轨迹虚线圆 */}
        {anchorSvg && orbitR > 0 && (
          <circle cx={anchorSvg[0]} cy={anchorSvg[1]} r={orbitR}
            fill="none" stroke={vec.color} strokeWidth={1} strokeDasharray="6 4" opacity={0.35} />
        )}
        {(isSelected || isHovered || isPending) && (
          <line x1={sx1} y1={sy1} x2={sx2} y2={sy2}
            stroke={isPending ? COLORS.primary : isSelected ? '#F97316' : '#60A5FA'}
            strokeWidth={isPending ? 10 : 8} opacity={isPending ? 0.35 : 0.3} strokeLinecap="round" />
        )}
        <ArrowLine x1={sx1} y1={sy1} x2={sx2} y2={sy2} color={vec.color} markerId={`demo-arrow-${cidx}`} />
        {vec.showLabel && len > 5 && (
          <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
            fontSize={14} fontWeight={700} fill={vec.color}
            fontFamily="Inter, 'PingFang SC', sans-serif" style={{ userSelect: 'none', pointerEvents: 'none' }}>
            {vec.label}
          </text>
        )}
        {/* 约束标记：固定端显示锚点 */}
        {hasConstraint && anchorSvg && (
          <circle cx={anchorSvg[0]} cy={anchorSvg[1]} r={4}
            fill={vec.color} stroke={COLORS.white} strokeWidth={1.5} />
        )}
      </g>
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
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    const lx = len > 0 ? x2 - dy / len * 14 + dx / len * 4 : x2;
    const ly = len > 0 ? y2 + dx / len * 14 + dy / len * 4 : y2;
    const label = resolveOpLabel(op.id, entities);

    const isSelected = selectedId === op.id;
    const isHovered = hoveredId === op.id;
    const isPending = pendingVec1Id === op.id;

    return (
      <g key={op.id}>
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
        {len > 5 && (
          <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
            fontSize={14} fontWeight={600} fill={color}
            fontFamily="Inter, sans-serif" style={{ userSelect: 'none', pointerEvents: 'none' }}>
            {label}
          </text>
        )}
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

  // ─── 运算结果 HUD（HTML overlay，左上角显示所有运算公式）───
  const opHuds = ops.map((op) => {
    const label = resolveOpLabel(op.id, entities);

    if (op.kind === 'dotProduct') {
      const v1 = resolveVec(op.vec1Id, entities);
      const v2 = op.vec2Id ? resolveVec(op.vec2Id, entities) : null;
      if (!v1 || !v2) return null;
      const dotVal = dot2D(v1, v2);
      const angleVal = toDeg(angle2D(v1, v2));
      return (
        <div key={op.id} style={opHudStyle}>
          {label} = {dotVal.toFixed(2)} &nbsp;(θ≈{angleVal.toFixed(1)}°)
        </div>
      );
    }

    const res = resolveVec(op.id, entities);
    if (!res) return null;
    return (
      <div key={op.id} style={opHudStyle}>
        {label} = ({res[0].toFixed(2)}, {res[1].toFixed(2)})
      </div>
    );
  });

  // 光标
  const cursor = isPanning ? 'grabbing'
    : activeTool === 'createVector' ? 'crosshair'
    : activeTool === 'vectorOp' ? 'cell'
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

        {vectors.map((v) => renderVector(v))}
        {ops.map((op) => renderOp(op))}
        {points.map((p) => renderEndPoint(p))}

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

        {activeTool === 'createVector' && step === 1 && pendingStartPoint && (() => {
          const [sx, sy] = m2s(pendingStartPoint.x, pendingStartPoint.y);
          return <circle cx={sx} cy={sy} r={5} fill={COLORS.primary} opacity={0.8} />;
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

      <StatusBar />
    </div>
  );
}

// ─── 工具栏（匹配 visual_template ToolBar 样式：column 布局、绿色边框）───

function DemoToolBar() {
  const { activeTool, opKind, setTool, setOpKind } = useDemoToolStore();
  const [opMenuOpen, setOpMenuOpen] = useState(false);

  const opKinds: { kind: 'add' | 'subtract' | 'dotProduct' | 'scale'; label: string; icon: string }[] = [
    { kind: 'add', label: '加法 a+b', icon: '+' },
    { kind: 'subtract', label: '减法 a−b', icon: '−' },
    { kind: 'dotProduct', label: '数量积 a·b', icon: '·' },
    { kind: 'scale', label: '数乘 k·a', icon: '×' },
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

      <ToolBtn icon="→" label="创建向量" active={activeTool === 'createVector'} onClick={() => setTool('createVector')} title="点击两次创建向量" />

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

      {/* 缩放提示 */}
      <div style={{ alignSelf: 'center', fontSize: 14, color: COLORS.textMuted, whiteSpace: 'nowrap', padding: '0 4px' }}>
        左键拖空白平移 · 滚轮缩放
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
