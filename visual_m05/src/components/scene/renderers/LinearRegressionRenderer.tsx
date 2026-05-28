import { useRef, useState, useCallback, useEffect } from 'react';
import { COLORS } from '@/styles/tokens';
import type { LinearRegressionResult } from '@/engine/simulations/linearRegression';
import { ChartAxes, ChartTitle, VW, VH, ML, MT, PW, PH } from '@/utils/svgChartUtils';

export interface PointEditEvent {
  type: 'add' | 'move' | 'delete';
  points: Array<{ x: number; y: number }>;  // 新的全部点
}

interface Props {
  result: LinearRegressionResult;
  xLabel: string;
  yLabel: string;
  showResiduals: boolean;
  /** 交互编辑回调，若提供则启用增/删/拖拽 (v0.4 反馈 #7) */
  onPointsChange?: (points: Array<{ x: number; y: number }>) => void;
}

interface ContextMenuState {
  index: number;
  /** SVG 内部坐标系下的菜单位置 */
  svgX: number;
  svgY: number;
}

const LONG_PRESS_MS = 200;

export function LinearRegressionRenderer({ result, xLabel, yLabel, showResiduals, onPointsChange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const pointerDownRef = useRef<{ index: number; x: number; y: number; isDrag: boolean } | null>(null);

  // 坐标范围（包含 padding）
  const xVals = result.points.map(p => p.x);
  const yVals = result.points.map(p => p.y);
  const xMin = xVals.length > 0 ? Math.min(...xVals) : 0;
  const xMax = xVals.length > 0 ? Math.max(...xVals) : 10;
  const yMin = yVals.length > 0 ? Math.min(...yVals) : 0;
  const yMax = yVals.length > 0 ? Math.max(...yVals) : 10;
  const xPad = (xMax - xMin) * 0.1 || 1;
  const yPad = (yMax - yMin) * 0.15 || 1;
  const xMinP = xMin - xPad, xMaxP = xMax + xPad;
  const yMinP = yMin - yPad, yMaxP = yMax + yPad;

  const spx = (v: number) => ML + ((v - xMinP) / (xMaxP - xMinP)) * PW;
  const spy = (v: number) => MT + PH - ((v - yMinP) / (yMaxP - yMinP)) * PH;

  /** 屏幕像素 → SVG viewBox 坐标（用 CTM 处理 preserveAspectRatio 留白） */
  const clientToSvg = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    return pt.matrixTransform(ctm.inverse());
  }, []);

  /** SVG 像素 → 数据坐标 */
  const toDataCoord = useCallback((clientX: number, clientY: number) => {
    const sp = clientToSvg(clientX, clientY);
    if (!sp) return null;
    if (sp.x < ML || sp.x > ML + PW || sp.y < MT || sp.y > MT + PH) return null;
    const dataX = xMinP + ((sp.x - ML) / PW) * (xMaxP - xMinP);
    const dataY = yMinP + (1 - (sp.y - MT) / PH) * (yMaxP - yMinP);
    return { x: dataX, y: dataY };
  }, [clientToSvg, xMinP, xMaxP, yMinP, yMaxP]);

  const title = result.equation
    ? `${result.equation}  (R²=${(result.r2 ?? 0).toFixed(4)})`
    : '数据点不足';
  const ticks = 5;

  // 关闭右键菜单
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [contextMenu]);

  // ─── 鼠标事件 ─────────────────────────────────────────

  const handleSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!onPointsChange || contextMenu) return;
    // 仅在没有点击到点上 + 没有拖拽时新增
    if (pointerDownRef.current?.isDrag) {
      pointerDownRef.current = null;
      return;
    }
    if (hoverIndex !== null) return;  // 鼠标在某点上时不增点
    const pos = toDataCoord(e.clientX, e.clientY);
    if (!pos) return;
    onPointsChange([...result.points, pos]);
  }, [onPointsChange, hoverIndex, toDataCoord, result.points, contextMenu]);

  const handlePointDown = useCallback((e: React.PointerEvent, index: number) => {
    if (!onPointsChange) return;
    e.stopPropagation();
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointerDownRef.current = { index, x: e.clientX, y: e.clientY, isDrag: false };

    longPressTimer.current = window.setTimeout(() => {
      // 进入拖拽态
      setDragIndex(index);
      setDragPos(result.points[index]);
      if (pointerDownRef.current) pointerDownRef.current.isDrag = true;
    }, LONG_PRESS_MS);
  }, [onPointsChange, result.points]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (dragIndex === null) return;
    const pos = toDataCoord(e.clientX, e.clientY);
    if (pos) setDragPos(pos);
  }, [dragIndex, toDataCoord]);

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (dragIndex !== null && dragPos && onPointsChange) {
      const next = result.points.slice();
      next[dragIndex] = dragPos;
      onPointsChange(next);
    }
    setDragIndex(null);
    setDragPos(null);
  }, [dragIndex, dragPos, onPointsChange, result.points]);

  const handlePointContextMenu = useCallback((e: React.MouseEvent, index: number) => {
    if (!onPointsChange) return;
    e.preventDefault();
    e.stopPropagation();
    const sp = clientToSvg(e.clientX, e.clientY);
    if (!sp) return;
    setContextMenu({ index, svgX: sp.x, svgY: sp.y });
  }, [onPointsChange, clientToSvg]);

  const handleDelete = useCallback((index: number) => {
    if (!onPointsChange) return;
    const next = result.points.slice();
    next.splice(index, 1);
    onPointsChange(next);
    setContextMenu(null);
  }, [onPointsChange, result.points]);

  // 当前显示的点（应用拖拽位置）
  const displayedPoints = result.points.map((pt, i) => (
    dragIndex === i && dragPos ? dragPos : pt
  ));

  return (
    <svg
      ref={svgRef}
      width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet"
      onClick={handleSvgClick}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ cursor: dragIndex !== null ? 'grabbing' : (onPointsChange ? 'crosshair' : 'default'), userSelect: 'none' }}
    >
      <rect width={VW} height={VH} fill={COLORS.bg} />
      <ChartTitle title={`线性回归: ${title}`} />
      <ChartAxes xLabel={xLabel} yLabel={yLabel} />

      {/* Grid */}
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const vy = yMinP + (yMaxP - yMinP) * i / ticks;
        const vx = xMinP + (xMaxP - xMinP) * i / ticks;
        const gy = spy(vy), gx = spx(vx);
        return (
          <g key={i}>
            <line x1={ML} y1={gy} x2={ML + PW} y2={gy} stroke={COLORS.border} strokeWidth={0.8} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            <text x={ML - 6} y={gy + 4} textAnchor="end" fontSize={11} fill={COLORS.textMuted}>{vy.toFixed(0)}</text>
            <line x1={gx} y1={MT} x2={gx} y2={MT + PH} stroke={COLORS.border} strokeWidth={0.8} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            <text x={gx} y={MT + PH + 16} textAnchor="middle" fontSize={11} fill={COLORS.textMuted}>{vx.toFixed(0)}</text>
          </g>
        );
      })}

      {/* 回归曲线：线性模型用直线，非线性模型用密集采样的 polyline */}
      {result.curvePoints && result.curvePoints.length >= 2 && (
        <polyline
          points={result.curvePoints
            .filter(pt => Number.isFinite(pt.y))
            .map(pt => `${spx(pt.x).toFixed(1)},${spy(pt.y).toFixed(1)}`)
            .join(' ')}
          fill="none" stroke={COLORS.primary} strokeWidth={2}
          vectorEffect="non-scaling-stroke" />
      )}

      {/* Data points (含交互) */}
      {displayedPoints.map((pt, i) => {
        const isHover = hoverIndex === i;
        const isDragging = dragIndex === i;
        const r = isHover || isDragging ? 8 : 5;
        return (
          <g key={i}>
            <circle
              cx={spx(pt.x)} cy={spy(pt.y)} r={r}
              fill={isDragging ? COLORS.warning : COLORS.info}
              stroke={COLORS.white} strokeWidth={1.5} vectorEffect="non-scaling-stroke"
              style={{ cursor: onPointsChange ? 'grab' : 'default' }}
              onPointerDown={(e) => handlePointDown(e, i)}
              onPointerEnter={() => setHoverIndex(i)}
              onPointerLeave={() => setHoverIndex(prev => prev === i ? null : prev)}
              onContextMenu={(e) => handlePointContextMenu(e, i)}
            />
            {isHover && (
              <g pointerEvents="none">
                <rect x={spx(pt.x) + 10} y={spy(pt.y) - 24} width={86} height={20} rx={4}
                  fill={COLORS.text} opacity={0.92} />
                <text x={spx(pt.x) + 14} y={spy(pt.y) - 10} fontSize={10} fill={COLORS.white}>
                  ({pt.x.toFixed(2)}, {pt.y.toFixed(2)})
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Mean point */}
      {result.points.length >= 2 && (
        <circle cx={spx(result.xMean)} cy={spy(result.yMean)} r={7}
          fill={COLORS.error} stroke={COLORS.white} strokeWidth={2}
          pointerEvents="none" vectorEffect="non-scaling-stroke" />
      )}

      {/* Residual lines — 渲染在数据点与均值点之上，避免被遮盖 */}
      {showResiduals && result.residuals.map((res, i) => (
        <line key={i}
          x1={spx(res.x)} y1={spy(res.actual)}
          x2={spx(res.x)} y2={spy(res.predicted)}
          stroke={COLORS.warning} strokeWidth={2.5} strokeDasharray="5 3" vectorEffect="non-scaling-stroke" />
      ))}

      {/* Stats */}
      <text x={ML + 10} y={MT + 14} fontSize={11} fill={COLORS.textMuted}>
        R²={(result.r2 ?? 0).toFixed(4)}{result.modelType === 'linear' && ` · r=${result.r.toFixed(4)}`}
      </text>

      {/* 交互提示 */}
      {onPointsChange && (
        <g>
          <rect x={ML + 10} y={MT + 24} width={272} height={20} rx={4}
            fill={COLORS.bgPage} opacity={0.92} stroke={COLORS.border} strokeWidth={0.8} />
          <text x={ML + 16} y={MT + 38} fontSize={10} fill={COLORS.textMuted}>
            点击空白增点 · 长按拖拽 · 右键删除（自动切换到教师输入）
          </text>
        </g>
      )}

      {/* Legend */}
      <line x1={ML + PW - 140} y1={MT + 10} x2={ML + PW - 124} y2={MT + 10} stroke={COLORS.primary} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      <text x={ML + PW - 120} y={MT + 14} fontSize={11} fill={COLORS.textSecondary}>回归直线</text>
      <circle cx={ML + PW - 136} cy={MT + 26} r={4} fill={COLORS.info} />
      <text x={ML + PW - 129} y={MT + 30} fontSize={11} fill={COLORS.textSecondary}>数据点</text>
      <circle cx={ML + PW - 136} cy={MT + 42} r={5} fill={COLORS.error} />
      <text x={ML + PW - 129} y={MT + 46} fontSize={11} fill={COLORS.textSecondary}>均值点(x̄,ȳ)</text>

      {/* 右键菜单（SVG 内坐标） */}
      {contextMenu && (
        <g>
          <rect x={contextMenu.svgX} y={contextMenu.svgY} width={90} height={28} rx={6}
            fill={COLORS.white} stroke={COLORS.border} strokeWidth={1}
            style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))' }} />
          <rect x={contextMenu.svgX} y={contextMenu.svgY} width={90} height={28} rx={6}
            fill={COLORS.errorLight} opacity={0.0}
            style={{ cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); handleDelete(contextMenu.index); }}
            onPointerEnter={(e) => { (e.target as SVGRectElement).style.opacity = '1'; }}
            onPointerLeave={(e) => { (e.target as SVGRectElement).style.opacity = '0'; }}
          />
          <text x={contextMenu.svgX + 45} y={contextMenu.svgY + 18} textAnchor="middle" fontSize={12} fill={COLORS.error} fontWeight={600}
            pointerEvents="none">
            删除此点
          </text>
        </g>
      )}
    </svg>
  );
}
