import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { useVectorStore, useHistoryStore } from '@/editor';
import { UpdateVec2DCommand } from '@/editor/commands/updateVector';
import type { Vec2D, OperationType } from '@/editor/entities/types';
import {
  add2D, sub2D, scale2D, dot2D, mag2D, angle2D, projectVec2D,
  decomposeVector, toDeg, cross2D,
} from '@/engine/vectorMath';
import { useFmt } from '@/hooks/useFmt';
import { COLORS, RADIUS } from '@/styles/tokens';

// ─── 坐标系常量 ───
// viewBox: "-400 -300 800 600" → 原点在中心, 1数学单位 = 50 SVG单位
const SCALE = 50;
const VB_W = 960;
const VB_H = 720;
const VB_X = -VB_W / 2;  // -400
const VB_Y = -VB_H / 2;  // -300

// 视口状态
interface ViewState { x: number; y: number; w: number; h: number }

// 客户端坐标 → SVG 坐标（精确变换，支持动态 viewBox）
function clientToSVG(clientX: number, clientY: number, svg: SVGSVGElement): [number, number] {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const inv = pt.matrixTransform(svg.getScreenCTM()!.inverse());
  return [inv.x, inv.y];
}

// 数学坐标 → SVG坐标（Y轴翻转）
function m2s(mx: number, my: number): [number, number] {
  return [mx * SCALE, -my * SCALE];
}

// ─── Arrow 组件（带箭头的向量线）───

interface ArrowProps {
  x1: number; y1: number;
  x2: number; y2: number;
  color: string;
  markerId: string;
  strokeWidth?: number;
  dashed?: boolean;
  opacity?: number;
}

function Arrow({ x1, y1, x2, y2, color, markerId, strokeWidth = 2.5, dashed = false, opacity = 1 }: ArrowProps) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 3) return null;

  // 缩短线段末端，给箭头留空间
  const headOffset = 8;
  const ratio = (len - headOffset) / len;
  const ex = x1 + dx * ratio;
  const ey = y1 + dy * ratio;

  return (
    <line
      x1={x1} y1={y1}
      x2={ex} y2={ey}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeDasharray={dashed ? '6 4' : undefined}
      markerEnd={`url(#${markerId})`}
      opacity={opacity}
      strokeLinecap="round"
    />
  );
}

// ─── 角度弧线（支持 deg/rad 切换）───

interface AngleArcProps {
  cx: number; cy: number;
  angleRad: number;  // 角度（弧度）
  vec1: Vec2D; vec2: Vec2D;  // 数学坐标方向
  radius?: number;
  color?: string;
}

function AngleArc({ cx, cy, vec1, vec2, angleRad, radius = 30, color = COLORS.textMuted }: AngleArcProps) {
  const angleUnit = useVectorStore((s) => s.angleUnit);
  const { f } = useFmt();
  const [sx1, sy1] = m2s(vec1[0], vec1[1]);
  const [sx2, sy2] = m2s(vec2[0], vec2[1]);

  const mag1 = Math.sqrt(sx1 * sx1 + sy1 * sy1);
  const mag2 = Math.sqrt(sx2 * sx2 + sy2 * sy2);
  if (mag1 < 1 || mag2 < 1) return null;

  const ux1 = sx1 / mag1 * radius;
  const uy1 = sy1 / mag1 * radius;
  const ux2 = sx2 / mag2 * radius;
  const uy2 = sy2 / mag2 * radius;

  // 判断方向（顺时针 or 逆时针）
  const crossVal = sx1 * sy2 - sy1 * sx2;
  const sweep = crossVal > 0 ? 0 : 1;

  const px1 = cx + ux1;
  const py1 = cy + uy1;
  const px2 = cx + ux2;
  const py2 = cy + uy2;

  // 角度标注文字位置
  const midX = cx + (ux1 + ux2) / 2 * 1.6;
  const midY = cy + (uy1 + uy2) / 2 * 1.6;

  const displayVal = angleUnit === 'deg' ? toDeg(angleRad) : angleRad;
  const unitStr = angleUnit === 'deg' ? '°' : ' rad';
  const decimals = angleUnit === 'deg' ? 1 : 3;

  return (
    <g>
      <path
        d={`M ${px1} ${py1} A ${radius} ${radius} 0 0 ${sweep} ${px2} ${py2}`}
        stroke={color}
        strokeWidth={1.5}
        fill="none"
        opacity={0.8}
      />
      <text
        x={midX} y={midY}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={18}
        fontWeight={600}
        fill={color}
        fontFamily="Inter, sans-serif"
      >
        {f(displayVal, decimals)}{unitStr}
      </text>
    </g>
  );
}

// ─── 向量标签 ───

interface VecLabelProps {
  sx: number; sy: number;  // SVG 终点
  ox: number; oy: number;  // SVG 起点
  label: string;
  color: string;
  subLabel?: string;
}

function VecLabel({ sx, sy, ox, oy, label, color, subLabel }: VecLabelProps) {
  const dx = sx - ox;
  const dy = sy - oy;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 5) return null;

  // 标签偏移：向垂直方向偏移
  const nx = -dy / len * 14;
  const ny = dx / len * 14;

  const tx = sx + nx + dx / len * 4;
  const ty = sy + ny + dy / len * 4;

  return (
    <text
      x={tx} y={ty}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={18}
      fontWeight={700}
      fill={color}
      fontFamily="Inter, 'PingFang SC', sans-serif"
      style={{ userSelect: 'none' }}
    >
      {label}
      {subLabel && <tspan fontSize={18} dy={4}>{subLabel}</tspan>}
    </text>
  );
}

// ─── 可拖拽圆点（向量终点）───

interface DragHandleProps {
  sx: number; sy: number;
  color: string;
  onDrag: (svgX: number, svgY: number) => void;
  title?: string;
}

function DragHandle({ sx, sy, color, onDrag, title }: DragHandleProps) {
  const [dragging, setDragging] = useState(false);

  return (
    <circle
      cx={sx} cy={sy}
      r={7}
      fill={dragging ? color : `${color}cc`}
      stroke={COLORS.white}
      strokeWidth={2}
      style={{ cursor: 'grab' }}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
      }}
      onPointerMove={(e) => {
        if (!dragging) return;
        const svg = e.currentTarget.closest('svg') as SVGSVGElement;
        const [svgX, svgY] = clientToSVG(e.clientX, e.clientY, svg);
        onDrag(svgX, svgY);
      }}
      onPointerUp={() => setDragging(false)}
      onPointerLeave={() => setDragging(false)}
    >
      {title && <title>{title}</title>}
    </circle>
  );
}

// ─── SVG Defs：箭头 Marker ───

function ArrowDefs() {
  const markers: { id: string; color: string }[] = [
    { id: 'arrow-a', color: COLORS.vecA },
    { id: 'arrow-b', color: COLORS.vecB },
    { id: 'arrow-result', color: COLORS.vecResult },
    { id: 'arrow-scalar', color: COLORS.vecScalar },
    { id: 'arrow-basis1', color: COLORS.basis1 },
    { id: 'arrow-basis2', color: COLORS.basis2 },
    { id: 'arrow-target', color: COLORS.decompTarget },
    { id: 'arrow-neg', color: COLORS.negVec },
  ];

  return (
    <defs>
      {markers.map(({ id, color }) => (
        <marker
          key={id}
          id={id}
          markerWidth={8}
          markerHeight={6}
          refX={5}
          refY={3}
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" fill={color} />
        </marker>
      ))}
    </defs>
  );
}

// ─── 坐标网格 ───

function CoordGrid({ show, view }: { show: boolean; view: ViewState }) {
  if (!show) return null;

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
          fontSize={18} fill={COLORS.textMuted} fontFamily="Inter, sans-serif">{x}</text>;
      })}
      {yNums.filter((y) => y !== 0).map((y) => {
        const [, sy] = m2s(0, y);
        return <text key={`ty${y}`} x={yLabelSvgX} y={sy} textAnchor="end" dominantBaseline="middle"
          fontSize={18} fill={COLORS.textMuted} fontFamily="Inter, sans-serif">{y}</text>;
      })}
      <text x={view.x + view.w - 14} y={xLabelSvgY} fontSize={19} fontWeight={600} fill={COLORS.axis} fontFamily="Inter, sans-serif">x</text>
      <text x={yLabelSvgX + 16} y={view.y + 14} fontSize={19} fontWeight={600} fill={COLORS.axis} fontFamily="Inter, sans-serif">y</text>
    </g>
  );
}

// ─── 各运算渲染层 ───

// 将 SVG 拖拽坐标 → 数学坐标（含吸附到0.5网格）
function svgToMath(svgX: number, svgY: number): Vec2D {
  const mx = svgX / SCALE;
  const my = -svgY / SCALE;
  return [Math.round(mx * 2) / 2, Math.round(my * 2) / 2];
}

// ─ 关系状态徽章（共线 / 垂直）─

interface RelationBadgeProps {
  sx: number; sy: number;
  kind: 'perp' | 'collinear';
}

function RelationBadge({ sx, sy, kind }: RelationBadgeProps) {
  const text = kind === 'perp' ? '⊥ 垂直' : '∥ 共线';
  const bg = kind === 'perp' ? COLORS.success : COLORS.warning;
  return (
    <g transform={`translate(${sx + 12}, ${sy - 22})`}>
      <rect x={0} y={-14} width={60} height={22} rx={5} fill={bg} opacity={0.93} />
      <text fontSize={18} fontWeight={700} fill="white" x={6} dominantBaseline="middle" fontFamily="Inter, sans-serif">{text}</text>
    </g>
  );
}

// ─ VEC-001 向量概念层 ─

function ConceptLayer() {
  const vecA = useVectorStore((s) => s.vecA);
  const activePresetId = useVectorStore((s) => s.activePresetId);
  const setVecA = useVectorStore((s) => s.setVecA);
  const unitCirclePlaying = useVectorStore((s) => s.unitCirclePlaying);
  const setUnitCircleAngle = useVectorStore((s) => s.setUnitCircleAngle);
  const { execute } = useHistoryStore();
  const { f } = useFmt();
  const prevA = useRef<Vec2D>(vecA);

  // 自由向量起点（可独立拖拽）
  const [freeOrigin, setFreeOrigin] = useState<Vec2D>([2, -2]);

  const [ax, ay] = m2s(vecA[0], vecA[1]);
  const magVal = mag2D(vecA);
  const dirDeg = toDeg(Math.atan2(vecA[1], vecA[0]));

  const isUnitMode = activePresetId === 'VEC-001-B';

  // 单位圆动画
  useEffect(() => {
    if (!unitCirclePlaying) return;
    const id = setInterval(() => {
      setUnitCircleAngle(useVectorStore.getState().unitCircleAngle + 0.02);
      const angle = useVectorStore.getState().unitCircleAngle;
      setVecA([
        parseFloat(Math.cos(angle).toFixed(4)),
        parseFloat(Math.sin(angle).toFixed(4)),
      ]);
    }, 30);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitCirclePlaying]);

  // 自由向量：从 freeOrigin 到 freeOrigin + vecA
  const [fox, foy] = m2s(freeOrigin[0], freeOrigin[1]);
  const [fex, fey] = m2s(freeOrigin[0] + vecA[0], freeOrigin[1] + vecA[1]);

  const handleDrag = useCallback(
    (svgX: number, svgY: number) => {
      if (isUnitMode) {
        // 单位向量：只改变方向，保持 |a| = 1
        const mx = svgX / SCALE;
        const my = -svgY / SCALE;
        const angle = Math.atan2(my, mx);
        setVecA([
          parseFloat(Math.cos(angle).toFixed(4)),
          parseFloat(Math.sin(angle).toFixed(4)),
        ]);
      } else {
        setVecA(svgToMath(svgX, svgY));
      }
    },
    [setVecA, isUnitMode],
  );

  // 拖拽自由向量起点
  const handleFreeDrag = useCallback(
    (svgX: number, svgY: number) => setFreeOrigin(svgToMath(svgX, svgY)),
    [],
  );

  const commit = useCallback(() => {
    if (prevA.current[0] !== vecA[0] || prevA.current[1] !== vecA[1]) {
      execute(new UpdateVec2DCommand('移动向量 a', prevA.current, vecA, setVecA));
      prevA.current = vecA;
    }
  }, [vecA, execute, setVecA]);

  return (
    <g>
      {/* 单位圆（单位向量模式时显示） */}
      {isUnitMode && (
        <>
          <circle cx={0} cy={0} r={SCALE} fill="none" stroke={COLORS.primary} strokeWidth={1.2}
            strokeDasharray="6 3" opacity={0.4} />
          <text x={SCALE + 6} y={-6} fontSize={18} fill={COLORS.primary} fontFamily="Inter, sans-serif" opacity={0.6}>
            r=1
          </text>
        </>
      )}

      {/* 自由向量（可拖拽平移） */}
      <Arrow x1={fox} y1={foy} x2={fex} y2={fey} color={COLORS.vecA} markerId="arrow-a" strokeWidth={2} opacity={0.55} dashed />
      <VecLabel sx={fex} sy={fey} ox={fox} oy={foy} label="自由向量" color={COLORS.vecA} />

      {/* 主向量 */}
      <Arrow x1={0} y1={0} x2={ax} y2={ay} color={COLORS.vecA} markerId="arrow-a" strokeWidth={3} />

      {/* 起点 O */}
      <circle cx={0} cy={0} r={5} fill={COLORS.vecA} />
      <text x={-16} y={-10} fontSize={19} fontWeight={700} fill={COLORS.vecA} fontFamily="Inter, sans-serif">O</text>

      {/* 终点 A */}
      <text x={ax + 8} y={ay - 8} fontSize={19} fontWeight={700} fill={COLORS.vecA} fontFamily="Inter, sans-serif">A</text>

      {/* 模长标注 */}
      <text x={(ax) / 2 + 12} y={(ay) / 2 - 10} fontSize={18} fontWeight={600} fill={COLORS.vecA} fontFamily="Inter, sans-serif">
        |a|={f(magVal)}
      </text>

      {/* 信息框 */}
      <rect x={VB_X + 8} y={VB_Y + 8} width={320} height={isUnitMode ? 100 : 68} rx={6}
        fill="rgba(255,255,255,0.93)" stroke={COLORS.border} strokeWidth={1} />
      <text x={VB_X + 18} y={VB_Y + 32} fontSize={18} fontWeight={700} fill={COLORS.text} fontFamily="Inter, sans-serif">
        向量 a = ({f(vecA[0])}, {f(vecA[1])})
      </text>
      <text x={VB_X + 18} y={VB_Y + 56} fontSize={18} fill={COLORS.textMuted} fontFamily="Inter, sans-serif">
        |a| = {f(magVal, 3)}，方向角 α ≈ {f(dirDeg, 1)}°
      </text>

      {/* 单位向量提示 */}
      {isUnitMode && (
        <text x={VB_X + 18} y={VB_Y + 82} fontSize={18} fill={COLORS.primary} fontFamily="Inter, sans-serif" fontWeight={600}>
          单位向量模式：|a|=1，仅改变方向
        </text>
      )}

      <DragHandle sx={ax} sy={ay} color={COLORS.vecA} onDrag={handleDrag} title={isUnitMode ? '拖拽改变方向（|a|=1）' : '拖拽改变向量 a'} />
      <DragHandle sx={fox} sy={foy} color={COLORS.vecA} onDrag={handleFreeDrag} title="拖拽移动自由向量" />
      <rect x={VB_X} y={VB_Y} width={VB_W} height={VB_H} fill="transparent"
        onPointerUp={commit} style={{ pointerEvents: 'none' }} />
    </g>
  );
}

// ─ VEC-002 坐标表示层 ─

function CoordinateLayer() {
  const vecA = useVectorStore((s) => s.vecA);
  const setVecA = useVectorStore((s) => s.setVecA);
  const { execute } = useHistoryStore();
  const { f } = useFmt();
  const prevA = useRef<Vec2D>(vecA);

  const [ax, ay] = m2s(vecA[0], vecA[1]);
  const [fx] = m2s(vecA[0], 0);  // foot of x-component

  const handleDrag = useCallback(
    (svgX: number, svgY: number) => setVecA(svgToMath(svgX, svgY)),
    [setVecA],
  );

  const commit = useCallback(() => {
    if (prevA.current[0] !== vecA[0] || prevA.current[1] !== vecA[1]) {
      execute(new UpdateVec2DCommand('移动向量', prevA.current, vecA, setVecA));
      prevA.current = vecA;
    }
  }, [vecA, execute, setVecA]);

  const showComponents = Math.abs(vecA[0]) > 0.3 && Math.abs(vecA[1]) > 0.3;

  return (
    <g>
      {/* x 分量（水平虚线） */}
      {showComponents && (
        <>
          <line x1={0} y1={0} x2={fx} y2={0}
            stroke={COLORS.basis1} strokeWidth={2} strokeDasharray="6 3" opacity={0.8} />
          <text x={fx / 2} y={14} textAnchor="middle" fontSize={18} fontWeight={600}
            fill={COLORS.basis1} fontFamily="Inter, sans-serif">
            x={f(vecA[0])}
          </text>

          {/* y 分量（垂直虚线） */}
          <line x1={fx} y1={0} x2={fx} y2={ay}
            stroke={COLORS.basis2} strokeWidth={2} strokeDasharray="6 3" opacity={0.8} />
          <text
            x={fx + (vecA[0] >= 0 ? 10 : -10)}
            y={ay / 2}
            textAnchor={vecA[0] >= 0 ? 'start' : 'end'}
            dominantBaseline="middle"
            fontSize={18} fontWeight={600}
            fill={COLORS.basis2} fontFamily="Inter, sans-serif"
          >
            y={f(vecA[1])}
          </text>

          {/* 直角标记 */}
          {Math.abs(fx) > 10 && Math.abs(ay) > 10 && (
            <rect
              x={vecA[0] >= 0 ? fx - 10 : fx}
              y={-10}
              width={10} height={10}
              fill="none"
              stroke={COLORS.border}
              strokeWidth={1.2}
            />
          )}
        </>
      )}

      {/* 主向量 */}
      <Arrow x1={0} y1={0} x2={ax} y2={ay} color={COLORS.vecA} markerId="arrow-a" strokeWidth={3} />
      <VecLabel sx={ax} sy={ay} ox={0} oy={0} label="a" color={COLORS.vecA} />

      {/* 信息框 */}
      <rect x={VB_X + 8} y={VB_Y + 8} width={340} height={68} rx={6}
        fill="rgba(255,255,255,0.93)" stroke={COLORS.border} strokeWidth={1} />
      <text x={VB_X + 18} y={VB_Y + 32} fontSize={18} fontWeight={700} fill={COLORS.text} fontFamily="Inter, sans-serif">
        a = ({f(vecA[0])}, {f(vecA[1])})
      </text>
      <text x={VB_X + 18} y={VB_Y + 56} fontSize={18} fill={COLORS.textMuted} fontFamily="Inter, sans-serif">
        |a| = √({f(vecA[0])}² + {f(vecA[1])}²) = {f(mag2D(vecA), 3)}
      </text>

      <DragHandle sx={ax} sy={ay} color={COLORS.vecA} onDrag={handleDrag} title="拖拽改变向量" />
      <rect x={VB_X} y={VB_Y} width={VB_W} height={VB_H} fill="transparent"
        onPointerUp={commit} style={{ pointerEvents: 'none' }} />
    </g>
  );
}

// ─ 平行四边形法则（含逐步动画） ─

function ParallelogramLayer() {
  const vecA = useVectorStore((s) => s.vecA);
  const vecB = useVectorStore((s) => s.vecB);
  const activePresetId = useVectorStore((s) => s.activePresetId);
  const setVecA = useVectorStore((s) => s.setVecA);
  const setVecB = useVectorStore((s) => s.setVecB);
  const animTick = useVectorStore((s) => s.parallelogramAnimTick);
  const { execute } = useHistoryStore();
  const prevA = useRef<Vec2D>(vecA);
  const prevB = useRef<Vec2D>(vecB);

  // 动画步骤: 0=空, 1=a, 2=a+b, 3=虚线边, 4=和向量
  const [animStep, setAnimStep] = useState(4);

  useEffect(() => {
    if (animTick === 0) return;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const timeoutId = setTimeout(() => {
      setAnimStep(0);
      let step = 0;
      intervalId = setInterval(() => {
        step += 1;
        setAnimStep(step);
        if (step >= 4 && intervalId) clearInterval(intervalId);
      }, 700);
    }, 0);
    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [animTick]);

  // 共线约束：VEC-011-D (相反向量) / VEC-011-E (同向向量)
  const isCollinearPreset = activePresetId === 'VEC-011-D' || activePresetId === 'VEC-011-E';

  const sum = add2D(vecA, vecB);
  const [ax, ay] = m2s(vecA[0], vecA[1]);
  const [bx, by] = m2s(vecB[0], vecB[1]);
  const [sx, sy] = m2s(sum[0], sum[1]);
  const pax = ax + bx;
  const pay = ay + by;

  // 将点投影到参考向量所在直线上（共线约束）
  const projectToLine = useCallback((svgX: number, svgY: number, refVec: Vec2D): Vec2D => {
    const [mx, my] = [svgX / SCALE, -svgY / SCALE];
    const refMag = mag2D(refVec);
    if (refMag < 0.01) return svgToMath(svgX, svgY);
    const ux = refVec[0] / refMag;
    const uy = refVec[1] / refMag;
    const proj = mx * ux + my * uy;
    const snapped = Math.round(proj * 2) / 2;
    return [snapped * ux, snapped * uy];
  }, []);

  const handleDragA = useCallback((svgX: number, svgY: number) => {
    if (isCollinearPreset) {
      setVecA(projectToLine(svgX, svgY, vecB));
    } else {
      setVecA(svgToMath(svgX, svgY));
    }
  }, [setVecA, isCollinearPreset, vecB, projectToLine]);

  const handleDragB = useCallback((svgX: number, svgY: number) => {
    if (isCollinearPreset) {
      setVecB(projectToLine(svgX, svgY, vecA));
    } else {
      setVecB(svgToMath(svgX, svgY));
    }
  }, [setVecB, isCollinearPreset, vecA, projectToLine]);

  const commitA = useCallback(() => {
    const before = prevA.current;
    const after = vecA;
    if (before[0] !== after[0] || before[1] !== after[1]) {
      execute(new UpdateVec2DCommand('移动向量 a', before, after, setVecA));
    }
    prevA.current = after;
  }, [vecA, execute, setVecA]);

  const commitB = useCallback(() => {
    const before = prevB.current;
    const after = vecB;
    if (before[0] !== after[0] || before[1] !== after[1]) {
      execute(new UpdateVec2DCommand('移动向量 b', before, after, setVecB));
    }
    prevB.current = after;
  }, [vecB, execute, setVecB]);

  const nonZeroSum = Math.abs(sum[0]) > 0.01 || Math.abs(sum[1]) > 0.01;

  return (
    <g>
      {/* 平行四边形虚线边（step 3+） */}
      {animStep >= 3 && (
        <>
          <line x1={ax} y1={ay} x2={pax} y2={pay}
            stroke={COLORS.vecResult} strokeWidth={1.2} strokeDasharray="5 4" opacity={0.6} />
          <line x1={bx} y1={by} x2={pax} y2={pay}
            stroke={COLORS.vecResult} strokeWidth={1.2} strokeDasharray="5 4" opacity={0.6} />
        </>
      )}

      {/* 向量 a（step 1+） */}
      {animStep >= 1 && (
        <>
          <Arrow x1={0} y1={0} x2={ax} y2={ay} color={COLORS.vecA} markerId="arrow-a" />
          <VecLabel sx={ax} sy={ay} ox={0} oy={0} label="a" color={COLORS.vecA} />
        </>
      )}

      {/* 向量 b（step 2+） */}
      {animStep >= 2 && (
        <>
          <Arrow x1={0} y1={0} x2={bx} y2={by} color={COLORS.vecB} markerId="arrow-b" />
          <VecLabel sx={bx} sy={by} ox={0} oy={0} label="b" color={COLORS.vecB} />
        </>
      )}

      {/* 和向量 a+b（step 4+） */}
      {animStep >= 4 && nonZeroSum && (
        <>
          <Arrow x1={0} y1={0} x2={sx} y2={sy} color={COLORS.vecResult} markerId="arrow-result" strokeWidth={3} />
          <VecLabel sx={sx} sy={sy} ox={0} oy={0} label="a+b" color={COLORS.vecResult} />
        </>
      )}

      {/* 拖拽控制点 */}
      <DragHandle sx={ax} sy={ay} color={COLORS.vecA}
        onDrag={handleDragA} title="拖拽改变向量 a" />
      <DragHandle sx={bx} sy={by} color={COLORS.vecB}
        onDrag={handleDragB} title="拖拽改变向量 b" />

      <rect x={VB_X} y={VB_Y} width={VB_W} height={VB_H} fill="transparent"
        onPointerUp={() => { commitA(); commitB(); }} style={{ pointerEvents: 'none' }} />
    </g>
  );
}

// ─ 三角形法则 ─

/** 链向量调色板（与 ParamPanel 一致） */
const CHAIN_COLORS = ['#E67E22', '#8E44AD', '#27AE60', '#2980B9', '#C0392B', '#16A085', '#D35400', '#7F8C8D'];
function chainColor(i: number) { return i === 0 ? COLORS.vecA : i === 1 ? COLORS.vecB : CHAIN_COLORS[(i - 2) % CHAIN_COLORS.length]; }
function chainLabel(i: number) { return i === 0 ? 'a' : i === 1 ? 'b' : `c${i - 1}`; }

function TriangleLayer() {
  const vecA = useVectorStore((s) => s.vecA);
  const vecB = useVectorStore((s) => s.vecB);
  const chainVecs = useVectorStore((s) => s.chainVecs);
  const setVecA = useVectorStore((s) => s.setVecA);
  const setVecB = useVectorStore((s) => s.setVecB);
  const setChainVec = useVectorStore((s) => s.setChainVec);
  const { execute } = useHistoryStore();
  const prevA = useRef<Vec2D>(vecA);
  const prevB = useRef<Vec2D>(vecB);

  // 全链
  const allVecs: Vec2D[] = [vecA, vecB, ...chainVecs];
  const n = allVecs.length;

  // 计算累积端点：endpoints[0]=原点, endpoints[i]=前 i 个向量之和
  const endpoints = useMemo(() => {
    const pts: Vec2D[] = [[0, 0]];
    for (let i = 0; i < n; i++) pts.push(add2D(pts[i], allVecs[i]));
    return pts;
  }, [vecA, vecB, chainVecs, n]); // eslint-disable-line react-hooks/exhaustive-deps

  const sum = endpoints[n];

  // a/b 拖拽
  const handleDragA = useCallback((svgX: number, svgY: number) => setVecA(svgToMath(svgX, svgY)), [setVecA]);
  const handleDragB = useCallback((svgX: number, svgY: number) => {
    const [mx, my] = svgToMath(svgX, svgY);
    setVecB([mx - vecA[0], my - vecA[1]]);
  }, [setVecB, vecA]);

  const commitA = useCallback(() => {
    if (prevA.current[0] !== vecA[0] || prevA.current[1] !== vecA[1])
      execute(new UpdateVec2DCommand('移动向量 a', prevA.current, vecA, setVecA));
    prevA.current = vecA;
  }, [vecA, execute, setVecA]);

  const commitB = useCallback(() => {
    if (prevB.current[0] !== vecB[0] || prevB.current[1] !== vecB[1])
      execute(new UpdateVec2DCommand('移动向量 b', prevB.current, vecB, setVecB));
    prevB.current = vecB;
  }, [vecB, execute, setVecB]);

  // 链向量拖拽：endpoint[i+1] 被拖到 (svgX, svgY) → 更新 allVecs[i]
  const handleDragChain = useCallback((idx: number, svgX: number, svgY: number) => {
    const [mx, my] = svgToMath(svgX, svgY);
    // 新向量 = 新端点 - 前一个端点
    const prev = endpoints[idx];
    setChainVec(idx - 2, [mx - prev[0], my - prev[1]]);
  }, [setChainVec, endpoints]);

  return (
    <g>
      {/* 渲染每条链向量（标签在中点，避免端点重合） */}
      {allVecs.map((_, i) => {
        const [ox, oy] = m2s(endpoints[i][0], endpoints[i][1]);
        const [ex, ey] = m2s(endpoints[i + 1][0], endpoints[i + 1][1]);
        const mx = (ox + ex) / 2, my = (oy + ey) / 2;
        const color = chainColor(i);
        const label = chainLabel(i);
        return (
          <g key={i}>
            <Arrow x1={ox} y1={oy} x2={ex} y2={ey} color={color} markerId={`arrow-chain-${i}`} />
            <VecLabel sx={mx} sy={my} ox={ox} oy={oy} label={label} color={color} />
          </g>
        );
      })}

      {/* 总和向量（标签在中点） */}
      {(Math.abs(sum[0]) > 0.01 || Math.abs(sum[1]) > 0.01) && (() => {
        const [sx, sy] = m2s(sum[0], sum[1]);
        const midX = sx / 2, midY = sy / 2;
        const sumLabel = n === 2 ? 'a+b' : '总和';
        return (
          <>
            <Arrow x1={0} y1={0} x2={sx} y2={sy} color={COLORS.vecResult} markerId="arrow-result" strokeWidth={3} />
            <VecLabel sx={midX} sy={midY} ox={0} oy={0} label={sumLabel} color={COLORS.vecResult} />
          </>
        );
      })()}

      {/* 拖拽控制点 */}
      {allVecs.map((_, i) => {
        const [ex, ey] = m2s(endpoints[i + 1][0], endpoints[i + 1][1]);
        const color = chainColor(i);
        const label = chainLabel(i);
        if (i === 0) return <DragHandle key={i} sx={ex} sy={ey} color={color} onDrag={handleDragA} title={`拖拽向量 ${label}`} />;
        if (i === 1) return <DragHandle key={i} sx={ex} sy={ey} color={color} onDrag={handleDragB} title={`拖拽向量 ${label}`} />;
        return <DragHandle key={i} sx={ex} sy={ey} color={color} onDrag={(x, y) => handleDragChain(i, x, y)} title={`拖拽向量 ${label}`} />;
      })}
      <rect x={VB_X} y={VB_Y} width={VB_W} height={VB_H} fill="transparent"
        onPointerUp={() => { commitA(); commitB(); }} style={{ pointerEvents: 'none' }} />
    </g>
  );
}

// ─ 向量减法 ─

function SubtractionLayer() {
  const vecA = useVectorStore((s) => s.vecA);
  const vecB = useVectorStore((s) => s.vecB);
  const setVecA = useVectorStore((s) => s.setVecA);
  const setVecB = useVectorStore((s) => s.setVecB);
  const { execute } = useHistoryStore();
  const prevA = useRef<Vec2D>(vecA);
  const prevB = useRef<Vec2D>(vecB);

  const negB: Vec2D = [-vecB[0], -vecB[1]];

  const [ax, ay] = m2s(vecA[0], vecA[1]);
  const [bx, by] = m2s(vecB[0], vecB[1]);
  const [nbx, nby] = m2s(negB[0], negB[1]);

  const isCollinear = Math.abs(cross2D(vecA, vecB)) < 0.01 && mag2D(vecA) > 0.1 && mag2D(vecB) > 0.1;
  const isPerp = Math.abs(dot2D(vecA, vecB)) < 0.01 && mag2D(vecA) > 0.1 && mag2D(vecB) > 0.1;

  const handleDragA = useCallback((svgX: number, svgY: number) => setVecA(svgToMath(svgX, svgY)), [setVecA]);
  const handleDragB = useCallback((svgX: number, svgY: number) => setVecB(svgToMath(svgX, svgY)), [setVecB]);

  const commit = () => {
    if (prevA.current[0] !== vecA[0] || prevA.current[1] !== vecA[1]) {
      execute(new UpdateVec2DCommand('移动向量 a', prevA.current, vecA, setVecA));
      prevA.current = vecA;
    }
    if (prevB.current[0] !== vecB[0] || prevB.current[1] !== vecB[1]) {
      execute(new UpdateVec2DCommand('移动向量 b', prevB.current, vecB, setVecB));
      prevB.current = vecB;
    }
  };

  return (
    <g>
      {/* 向量 a */}
      <Arrow x1={0} y1={0} x2={ax} y2={ay} color={COLORS.vecA} markerId="arrow-a" />
      <VecLabel sx={ax} sy={ay} ox={0} oy={0} label="a" color={COLORS.vecA} />

      {/* 向量 b */}
      <Arrow x1={0} y1={0} x2={bx} y2={by} color={COLORS.vecB} markerId="arrow-b" />
      <VecLabel sx={bx} sy={by} ox={0} oy={0} label="b" color={COLORS.vecB} />

      {/* -b（虚线提示） */}
      <Arrow x1={0} y1={0} x2={nbx} y2={nby} color={COLORS.negVec} markerId="arrow-neg" dashed opacity={0.6} />
      <text x={nbx + 4} y={nby - 4} fontSize={18} fill={COLORS.negVec} fontFamily="Inter, sans-serif" opacity={0.8}>-b</text>

      {/* 差向量：从 b 终点指向 a 终点 */}
      <Arrow x1={bx} y1={by} x2={ax} y2={ay} color={COLORS.vecResult} markerId="arrow-result" strokeWidth={3} />
      <VecLabel sx={ax} sy={ay} ox={bx} oy={by} label="a-b" color={COLORS.vecResult} />

      {/* 关系徽章 */}
      {isPerp && <RelationBadge sx={ax} sy={ay} kind="perp" />}
      {isCollinear && !isPerp && <RelationBadge sx={ax} sy={ay} kind="collinear" />}

      {/* 控制点 */}
      <DragHandle sx={ax} sy={ay} color={COLORS.vecA} onDrag={handleDragA} title="拖拽改变向量 a" />
      <DragHandle sx={bx} sy={by} color={COLORS.vecB} onDrag={handleDragB} title="拖拽改变向量 b" />
      <rect x={VB_X} y={VB_Y} width={VB_W} height={VB_H} fill="transparent"
        onPointerUp={commit} style={{ pointerEvents: 'none' }} />
    </g>
  );
}

// ─ 数乘向量 ─

function ScalarLayer() {
  const vecA = useVectorStore((s) => s.vecA);
  const scalarK = useVectorStore((s) => s.scalarK);
  const setVecA = useVectorStore((s) => s.setVecA);
  const { execute } = useHistoryStore();
  const { f } = useFmt();
  const prevA = useRef<Vec2D>(vecA);

  const scaled = scale2D(vecA, scalarK);
  const [ax, ay] = m2s(vecA[0], vecA[1]);
  const [kax, kay] = m2s(scaled[0], scaled[1]);

  const resultColor = scalarK >= 0 ? COLORS.vecResult : COLORS.vecScalar;

  const handleDragA = useCallback((svgX: number, svgY: number) => setVecA(svgToMath(svgX, svgY)), [setVecA]);
  const commit = useCallback(() => {
    if (prevA.current[0] !== vecA[0] || prevA.current[1] !== vecA[1]) {
      execute(new UpdateVec2DCommand('移动向量 a', prevA.current, vecA, setVecA));
      prevA.current = vecA;
    }
  }, [vecA, execute, setVecA]);

  return (
    <g>
      {/* 原始向量 a */}
      <Arrow x1={0} y1={0} x2={ax} y2={ay} color={COLORS.vecA} markerId="arrow-a" />
      <VecLabel sx={ax} sy={ay} ox={0} oy={0} label="a" color={COLORS.vecA} />

      {/* 数乘结果 k·a */}
      {(Math.abs(scaled[0]) > 0.01 || Math.abs(scaled[1]) > 0.01) && (
        <>
          <Arrow x1={0} y1={0} x2={kax} y2={kay} color={resultColor} markerId={scalarK >= 0 ? 'arrow-result' : 'arrow-scalar'} strokeWidth={3} />
          <VecLabel sx={kax} sy={kay} ox={0} oy={0} label={`${f(scalarK)}a`} color={resultColor} />
        </>
      )}
      {Math.abs(scalarK) < 0.01 && (
        <circle cx={0} cy={0} r={6} fill={COLORS.vecResult} opacity={0.8}>
          <title>零向量</title>
        </circle>
      )}

      {/* 控制点 */}
      <DragHandle sx={ax} sy={ay} color={COLORS.vecA} onDrag={handleDragA} title="拖拽改变向量 a" />
      <rect x={VB_X} y={VB_Y} width={VB_W} height={VB_H} fill="transparent"
        onPointerUp={commit} style={{ pointerEvents: 'none' }} />
    </g>
  );
}

// ─ 数量积（点积）─

function DotProductLayer() {
  const vecA = useVectorStore((s) => s.vecA);
  const vecB = useVectorStore((s) => s.vecB);
  const showAngleArc = useVectorStore((s) => s.showAngleArc);
  const showProjection = useVectorStore((s) => s.showProjection);
  const showPolarization = useVectorStore((s) => s.showPolarization);
  const setVecA = useVectorStore((s) => s.setVecA);
  const setVecB = useVectorStore((s) => s.setVecB);
  const { execute } = useHistoryStore();
  const { f } = useFmt();
  const prevA = useRef<Vec2D>(vecA);
  const prevB = useRef<Vec2D>(vecB);

  const dotVal = dot2D(vecA, vecB);
  const angleRad = angle2D(vecA, vecB);
  const projVec = projectVec2D(vecA, vecB);

  // 极化恒等式：a+b 和 a-b
  const sumVec = add2D(vecA, vecB);
  const diffVec = sub2D(vecA, vecB);

  const [ax, ay] = m2s(vecA[0], vecA[1]);
  const [bx, by] = m2s(vecB[0], vecB[1]);
  const [px, py] = m2s(projVec[0], projVec[1]);

  const isPerp = Math.abs(dotVal) < 0.01 && mag2D(vecA) > 0.1 && mag2D(vecB) > 0.1;
  const isCollinear = Math.abs(cross2D(vecA, vecB)) < 0.01 && mag2D(vecA) > 0.1 && mag2D(vecB) > 0.1;

  const handleDragA = useCallback((svgX: number, svgY: number) => setVecA(svgToMath(svgX, svgY)), [setVecA]);
  const handleDragB = useCallback((svgX: number, svgY: number) => setVecB(svgToMath(svgX, svgY)), [setVecB]);
  const commit = useCallback(() => {
    if (prevA.current[0] !== vecA[0] || prevA.current[1] !== vecA[1]) {
      execute(new UpdateVec2DCommand('移动向量 a', prevA.current, vecA, setVecA));
      prevA.current = vecA;
    }
    if (prevB.current[0] !== vecB[0] || prevB.current[1] !== vecB[1]) {
      execute(new UpdateVec2DCommand('移动向量 b', prevB.current, vecB, setVecB));
      prevB.current = vecB;
    }
  }, [vecA, vecB, execute, setVecA, setVecB]);

  return (
    <g>
      {/* 向量 a */}
      <Arrow x1={0} y1={0} x2={ax} y2={ay} color={COLORS.vecA} markerId="arrow-a" />
      <VecLabel sx={ax} sy={ay} ox={0} oy={0} label="a" color={COLORS.vecA} />

      {/* 向量 b */}
      <Arrow x1={0} y1={0} x2={bx} y2={by} color={COLORS.vecB} markerId="arrow-b" />
      <VecLabel sx={bx} sy={by} ox={0} oy={0} label="b" color={COLORS.vecB} />

      {/* 投影线段 */}
      {showProjection && mag2D(vecB) > 0.1 && (
        <>
          {/* 投影虚线（从 a 终点垂直落到 b 方向） */}
          <line x1={ax} y1={ay} x2={px} y2={py}
            stroke={COLORS.vecA} strokeWidth={1.5} strokeDasharray="5 3" opacity={0.7} />
          {/* 投影向量（粗实线，从原点到投影点） */}
          <line x1={0} y1={0} x2={px} y2={py}
            stroke={COLORS.basis1} strokeWidth={2.5} opacity={0.7} />
          {/* 投影点 */}
          <circle cx={px} cy={py} r={5} fill={COLORS.basis1} stroke="white" strokeWidth={1.5} />
          {/* 投影标签（带背景） */}
          <rect x={px + 6} y={py - 20} width={46} height={18} rx={4}
            fill="rgba(33,150,243,0.9)" />
          <text x={px + 10} y={py - 8} fontSize={18} fontWeight={700} fill="white" fontFamily="Inter, sans-serif">
            投影
          </text>
          {/* 直角标记 */}
          {!isPerp && Math.abs(px) > 5 && (
            <g>
              {(() => {
                const bLen = Math.sqrt(bx * bx + by * by);
                if (bLen < 1) return null;
                const ubx = bx / bLen * 10;
                const uby = by / bLen * 10;
                const perpX = -uby;
                const perpY = ubx;
                return (
                  <polyline
                    points={`${px + perpX},${py + perpY} ${px + perpX + ubx},${py + perpY + uby} ${px + ubx},${py + uby}`}
                    fill="none" stroke={COLORS.basis1} strokeWidth={1.2} opacity={0.7}
                  />
                );
              })()}
            </g>
          )}
        </>
      )}

      {/* 角度弧线 */}
      {showAngleArc && mag2D(vecA) > 0.1 && mag2D(vecB) > 0.1 && (
        <AngleArc cx={0} cy={0} vec1={vecA} vec2={vecB} angleRad={angleRad} />
      )}

      {/* 极化恒等式可视化 */}
      {showPolarization && mag2D(vecA) > 0.1 && mag2D(vecB) > 0.1 && (
        <>
          {/* a+b 向量（虚线） */}
          {(() => {
            const [spx, spy] = m2s(sumVec[0], sumVec[1]);
            const [dpx, dpy] = m2s(diffVec[0], diffVec[1]);
            return (
              <>
                <Arrow x1={0} y1={0} x2={spx} y2={spy}
                  color={COLORS.primary} markerId="arrow-target" strokeWidth={2} dashed opacity={0.6} />
                <text x={spx + 6} y={spy - 6} fontSize={18} fontWeight={600}
                  fill={COLORS.primary} fontFamily="Inter, sans-serif" opacity={0.8}>
                  a+b |{f(mag2D(sumVec))}|
                </text>

                <Arrow x1={0} y1={0} x2={dpx} y2={dpy}
                  color={COLORS.vecScalar} markerId="arrow-scalar" strokeWidth={2} dashed opacity={0.6} />
                <text x={dpx + 6} y={dpy - 6} fontSize={18} fontWeight={600}
                  fill={COLORS.vecScalar} fontFamily="Inter, sans-serif" opacity={0.8}>
                  a-b |{f(mag2D(diffVec))}|
                </text>

                {/* 极化恒等式公式框 */}
                <rect x={VB_X + VB_W - 320} y={VB_Y + 8} width={310} height={62} rx={6}
                  fill="rgba(255,255,255,0.93)" stroke={COLORS.border} strokeWidth={1} />
                <text x={VB_X + VB_W - 310} y={VB_Y + 32} fontSize={18} fontWeight={600}
                  fill={COLORS.text} fontFamily="Inter, sans-serif">
                  极化恒等式：a·b = (|a+b|²−|a−b|²)/4
                </text>
                <text x={VB_X + VB_W - 310} y={VB_Y + 56} fontSize={18}
                  fill={COLORS.textMuted} fontFamily="Inter, sans-serif">
                  = ({f(mag2D(sumVec) ** 2)} − {f(mag2D(diffVec) ** 2)}) / 4 = {f(dotVal)}
                </text>
              </>
            );
          })()}
        </>
      )}

      {/* 关系徽章 */}
      {isPerp && <RelationBadge sx={ax} sy={ay} kind="perp" />}
      {isCollinear && !isPerp && <RelationBadge sx={ax} sy={ay} kind="collinear" />}

      {/* 控制点 */}
      <DragHandle sx={ax} sy={ay} color={COLORS.vecA} onDrag={handleDragA} title="拖拽改变向量 a" />
      <DragHandle sx={bx} sy={by} color={COLORS.vecB} onDrag={handleDragB} title="拖拽改变向量 b" />
      <rect x={VB_X} y={VB_Y} width={VB_W} height={VB_H} fill="transparent"
        onPointerUp={commit} style={{ pointerEvents: 'none' }} />
    </g>
  );
}

// ─ 基底分解 ─

function DecompositionLayer() {
  const decompTarget = useVectorStore((s) => s.decompTarget);
  const basis1 = useVectorStore((s) => s.basis1);
  const basis2 = useVectorStore((s) => s.basis2);
  const showDecompParallel = useVectorStore((s) => s.showDecompParallel);
  const setDecompTarget = useVectorStore((s) => s.setDecompTarget);
  const setBasis1 = useVectorStore((s) => s.setBasis1);
  const setBasis2 = useVectorStore((s) => s.setBasis2);
  const { execute } = useHistoryStore();
  const prevTarget = useRef<Vec2D>(decompTarget);
  const prevB1 = useRef<Vec2D>(basis1);
  const prevB2 = useRef<Vec2D>(basis2);

  const coeffs = decomposeVector(decompTarget, basis1, basis2);

  const [tx, ty] = m2s(decompTarget[0], decompTarget[1]);
  const [e1x, e1y] = m2s(basis1[0], basis1[1]);
  const [e2x, e2y] = m2s(basis2[0], basis2[1]);

  let [c1e1x, c1e1y] = [0, 0];
  let [c2e2x, c2e2y] = [0, 0];
  if (coeffs) {
    const c1e1 = scale2D(basis1, coeffs[0]);
    const c2e2 = scale2D(basis2, coeffs[1]);
    [c1e1x, c1e1y] = m2s(c1e1[0], c1e1[1]);
    [c2e2x, c2e2y] = m2s(c2e2[0], c2e2[1]);
  }

  const crossVal = Math.abs(cross2D(basis1, basis2));
  const isCollinear = crossVal < 0.01;

  const handleDragTarget = useCallback((svgX: number, svgY: number) => setDecompTarget(svgToMath(svgX, svgY)), [setDecompTarget]);
  const handleDragB1 = useCallback((svgX: number, svgY: number) => setBasis1(svgToMath(svgX, svgY)), [setBasis1]);
  const handleDragB2 = useCallback((svgX: number, svgY: number) => setBasis2(svgToMath(svgX, svgY)), [setBasis2]);

  const commit = useCallback(() => {
    if (prevTarget.current[0] !== decompTarget[0] || prevTarget.current[1] !== decompTarget[1]) {
      execute(new UpdateVec2DCommand('移动目标向量', prevTarget.current, decompTarget, setDecompTarget));
      prevTarget.current = decompTarget;
    }
    if (prevB1.current[0] !== basis1[0] || prevB1.current[1] !== basis1[1]) {
      execute(new UpdateVec2DCommand('移动基底 e₁', prevB1.current, basis1, setBasis1));
      prevB1.current = basis1;
    }
    if (prevB2.current[0] !== basis2[0] || prevB2.current[1] !== basis2[1]) {
      execute(new UpdateVec2DCommand('移动基底 e₂', prevB2.current, basis2, setBasis2));
      prevB2.current = basis2;
    }
  }, [decompTarget, basis1, basis2, execute, setDecompTarget, setBasis1, setBasis2]);

  return (
    <g>
      {/* 基底向量 */}
      <Arrow x1={0} y1={0} x2={e1x} y2={e1y} color={COLORS.basis1} markerId="arrow-basis1" />
      <VecLabel sx={e1x} sy={e1y} ox={0} oy={0} label="e₁" color={COLORS.basis1} />

      <Arrow x1={0} y1={0} x2={e2x} y2={e2y} color={COLORS.basis2} markerId="arrow-basis2" />
      <VecLabel sx={e2x} sy={e2y} ox={0} oy={0} label="e₂" color={COLORS.basis2} />

      {/* 分解平行四边形 */}
      {coeffs && showDecompParallel && !isCollinear && (
        <>
          <line x1={c1e1x} y1={c1e1y} x2={tx} y2={ty}
            stroke={COLORS.basis2} strokeWidth={1.2} strokeDasharray="5 4" opacity={0.6} />
          <line x1={c2e2x} y1={c2e2y} x2={tx} y2={ty}
            stroke={COLORS.basis1} strokeWidth={1.2} strokeDasharray="5 4" opacity={0.6} />
          <Arrow x1={0} y1={0} x2={c1e1x} y2={c1e1y} color={COLORS.basis1} markerId="arrow-basis1" dashed />
          <Arrow x1={0} y1={0} x2={c2e2x} y2={c2e2y} color={COLORS.basis2} markerId="arrow-basis2" dashed />
        </>
      )}

      {/* 目标向量 */}
      <Arrow x1={0} y1={0} x2={tx} y2={ty} color={COLORS.decompTarget} markerId="arrow-target" strokeWidth={3} />
      <VecLabel sx={tx} sy={ty} ox={0} oy={0} label="p" color={COLORS.decompTarget} />

      {/* 控制点 */}
      <DragHandle sx={tx} sy={ty} color={COLORS.decompTarget} onDrag={handleDragTarget} title="拖拽改变目标向量 p" />
      <DragHandle sx={e1x} sy={e1y} color={COLORS.basis1} onDrag={handleDragB1} title="拖拽改变基底 e₁" />
      <DragHandle sx={e2x} sy={e2y} color={COLORS.basis2} onDrag={handleDragB2} title="拖拽改变基底 e₂" />
      <rect x={VB_X} y={VB_Y} width={VB_W} height={VB_H} fill="transparent"
        onPointerUp={commit} style={{ pointerEvents: 'none' }} />
    </g>
  );
}


// ─── 运算层路由 ───

function OperationLayer({ operation }: { operation: OperationType }) {
  switch (operation) {
    case 'concept': return <ConceptLayer />;
    case 'coordinate': return <CoordinateLayer />;
    case 'parallelogram': return <ParallelogramLayer />;
    case 'triangle': return <TriangleLayer />;
    case 'subtraction': return <SubtractionLayer />;
    case 'scalar': return <ScalarLayer />;
    case 'dotProduct': return <DotProductLayer />;
    case 'decomposition': return <DecompositionLayer />;
    default: return null;
  }
}

// ─── 主 Canvas2D 组件 ───

export function Canvas2D() {
  const operation = useVectorStore((s) => s.operation);
  const showGrid = useVectorStore((s) => s.showGrid);
  const angleUnit = useVectorStore((s) => s.angleUnit);
  const svgRef = useRef<SVGSVGElement>(null);
  const { f } = useFmt();

  const scalarK = useVectorStore((s) => s.scalarK);
  const vecA = useVectorStore((s) => s.vecA);
  const vecB = useVectorStore((s) => s.vecB);

  // ─── 视口状态（平移/缩放）───
  const [view, setView] = useState<ViewState>({ x: VB_X, y: VB_Y, w: VB_W, h: VB_H });
  const [isPanning, setIsPanning] = useState(false);
  const panRef = useRef<{
    startClientX: number; startClientY: number;
    startViewX: number; startViewY: number;
    scale: number; moved: boolean;
  } | null>(null);

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

  // ─── 左键拖拽平移 ───
  const handlePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const rect = svgRef.current!.getBoundingClientRect();
    const svgScale = Math.min(rect.width / view.w, rect.height / view.h);
    panRef.current = {
      startClientX: e.clientX, startClientY: e.clientY,
      startViewX: view.x, startViewY: view.y,
      scale: svgScale, moved: false,
    };
    svgRef.current!.setPointerCapture(e.pointerId);
    setIsPanning(true);
  }, [view]);

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!panRef.current) return;
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
  }, []);

  const handlePointerUp = useCallback((_e: React.PointerEvent) => {
    if (panRef.current) {
      panRef.current = null;
      setIsPanning(false);
    }
  }, []);

  // 切换运算时重置视口（通过 key 机制实现，见下方 Canvas2DWrapper）

  // 运算结果公式（左上角 HUD）
  const resultFormula = useMemo(() => {
    switch (operation) {
      case 'parallelogram':
      case 'triangle': {
        const sum = add2D(vecA, vecB);
        return `a+b = (${f(sum[0])}, ${f(sum[1])})`;
      }
      case 'subtraction': {
        const diff = sub2D(vecA, vecB);
        return `a−b = (${f(diff[0])}, ${f(diff[1])})`;
      }
      case 'scalar': {
        const scaled = scale2D(vecA, scalarK);
        return `${f(scalarK)}a = (${f(scaled[0])}, ${f(scaled[1])})  |${f(scalarK)}a| = ${f(mag2D(scaled))}`;
      }
      case 'dotProduct': {
        const d = dot2D(vecA, vecB);
        const rad = angle2D(vecA, vecB);
        const val = angleUnit === 'deg' ? toDeg(rad) : rad;
        const unit = angleUnit === 'deg' ? '°' : ' rad';
        return `a·b = ${f(d)}  θ ≈ ${f(val, angleUnit === 'deg' ? 1 : 3)}${unit}`;
      }
      case 'decomposition': {
        const decompTarget = useVectorStore.getState().decompTarget;
        const basis1 = useVectorStore.getState().basis1;
        const basis2 = useVectorStore.getState().basis2;
        const coeffs = decomposeVector(decompTarget, basis1, basis2);
        if (!coeffs) return '⚠ e₁ 与 e₂ 共线，无法分解';
        return `p = ${f(coeffs[0], 3)}·e₁ + ${f(coeffs[1], 3)}·e₂`;
      }
      default: return null;
    }
  }, [operation, vecA, vecB, scalarK, angleUnit, f]);

  const cursor = isPanning ? 'grabbing' : 'default';

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: COLORS.bg }}>
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        style={{ width: '100%', height: '100%', display: 'block', cursor }}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <ArrowDefs />
        <CoordGrid show={showGrid} view={view} />
        <OperationLayer operation={operation} />
      </svg>

      {/* 左上角运算结果公式 */}
      {resultFormula && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            background: 'rgba(255,255,255,0.93)',
            border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.sm,
            padding: '5px 12px',
            fontSize: 18,
            color: COLORS.text,
            fontWeight: 700,
            backdropFilter: 'blur(4px)',
            fontFamily: 'Inter, sans-serif',
            pointerEvents: 'none',
          }}
        >
          {resultFormula}
        </div>
      )}

      {/* 操作提示 */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          fontSize: 18,
          color: COLORS.textMuted,
          pointerEvents: 'none',
        }}
      >
        拖拽圆点改变向量 · 左键拖空白平移 · 滚轮缩放
      </div>
    </div>
  );
}
