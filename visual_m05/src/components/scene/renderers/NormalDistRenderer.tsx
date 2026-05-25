import { useRef, useState, useCallback, useEffect } from 'react';
import { COLORS } from '@/styles/tokens';
import type { NormalDistResult } from '@/engine/simulations/normalDist';
import { ChartAxes, ChartTitle, VW, VH, ML, MT, PW, PH } from '@/utils/svgChartUtils';

// 固定 x 轴默认范围：[-12, 12]（v0.4 反馈 #3）
const DEFAULT_X_MIN = -12;
const DEFAULT_X_MAX = 12;
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 8;

export function NormalDistRenderer({ result, showSigmaRegions }: { result: NormalDistResult; showSigmaRegions: boolean }) {
  // ─── X 轴范围（带平移 + 缩放交互）─────────────────────────────
  const [xCenter, setXCenter] = useState(0);      // 当前视图中心
  const [zoom, setZoom] = useState(1);            // 缩放倍数 (1 = 默认 24 单位宽度)
  const [isDragging, setIsDragging] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragState = useRef<{ startClientX: number; startCenter: number } | null>(null);

  // 当前 x 轴可视范围
  const halfWidth = (DEFAULT_X_MAX - DEFAULT_X_MIN) / 2 / zoom;
  const xMin = xCenter - halfWidth;
  const xMax = xCenter + halfWidth;

  // y 轴根据当前 σ 自适应
  const yMax = result.maxY * 1.2;

  // 自定义坐标映射（基于交互后的 xMin/xMax，而非默认值）
  const spx = (v: number) => ML + ((v - xMin) / (xMax - xMin)) * PW;
  const spy = (v: number) => MT + PH - ((v - 0) / (yMax - 0)) * PH;

  // ─── 交互：鼠标拖拽平移 ───────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragState.current = { startClientX: e.clientX, startCenter: xCenter };
    setIsDragging(true);
  }, [xCenter]);

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragState.current || !svgRef.current) return;
    // 用 CTM 把屏幕像素差精确换算到 viewBox 单位，避免 preserveAspectRatio 留白带来的偏移
    const svg = svgRef.current;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const inv = ctm.inverse();
    const p0 = svg.createSVGPoint(); p0.x = dragState.current.startClientX; p0.y = 0;
    const p1 = svg.createSVGPoint(); p1.x = e.clientX; p1.y = 0;
    const svg0 = p0.matrixTransform(inv);
    const svg1 = p1.matrixTransform(inv);
    const deltaSvg = svg1.x - svg0.x;       // viewBox 单位的偏移
    const deltaData = (deltaSvg / PW) * (xMax - xMin);
    setXCenter(dragState.current.startCenter - deltaData);
  }, [xMin, xMax]);

  const handlePointerUp = useCallback(() => {
    dragState.current = null;
    setIsDragging(false);
  }, []);

  // ─── 交互：滚轮缩放（以鼠标位置为锚点）─────────────────────
  const handleWheel = useCallback((e: WheelEvent) => {
    if (!svgRef.current) return;
    e.preventDefault();
    const svg = svgRef.current;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const svgPt = pt.matrixTransform(ctm.inverse());
    const svgX = svgPt.x;
    if (svgX < ML || svgX > ML + PW) return;
    const ratio = (svgX - ML) / PW;
    const mouseDataX = xMin + ratio * (xMax - xMin);

    // 缩放方向
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * factor));
    if (newZoom === zoom) return;

    // 重新计算 center，让鼠标位置的数据 x 保持不变
    const newHalfWidth = (DEFAULT_X_MAX - DEFAULT_X_MIN) / 2 / newZoom;
    const newXMin = mouseDataX - ratio * 2 * newHalfWidth;
    const newCenter = newXMin + newHalfWidth;
    setZoom(newZoom);
    setXCenter(newCenter);
  }, [xMin, xMax, zoom]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const resetView = () => { setXCenter(0); setZoom(1); };

  // ─── 钟形曲线 ──────────────────────────────────────────
  const curvePoints = result.pdfPoints
    .filter(pt => pt.x >= xMin - 1 && pt.x <= xMax + 1)
    .map(pt => `${spx(pt.x).toFixed(1)},${spy(pt.y).toFixed(1)}`)
    .join(' ');

  // 即时计算正态 PDF（在边界处显式补点，避免依赖采样点离散化）
  const pdfAt = (x: number) => {
    const z = (x - result.mu) / result.sigma;
    return Math.exp(-0.5 * z * z) / (result.sigma * Math.sqrt(2 * Math.PI));
  };

  // σ 区域填充 path
  // 修复 (v0.4 反馈 #4 二次修复)：
  // 之前的 path 直接 M(xL, 0) → L(第一个采样点) 导致左侧斜边，
  // 而采样点不一定恰在 σ 边界（浮点漂移让 8σ/200 间隔不对齐）。
  // 现显式补 (xL, 0)→(xL, pdf(xL))→…→(xR, pdf(xR))→(xR, 0)，强制竖直闭合。
  const buildSigmaPath = (xL: number, xR: number) => {
    const L = Math.max(xL, xMin);
    const R = Math.min(xR, xMax);
    if (L >= R) return '';
    const pts = result.pdfPoints.filter(pt => pt.x > L && pt.x < R);
    const parts = [
      `M ${spx(L).toFixed(1)},${spy(0).toFixed(1)}`,
      `L ${spx(L).toFixed(1)},${spy(pdfAt(L)).toFixed(1)}`,
      ...pts.map(pt => `L ${spx(pt.x).toFixed(1)},${spy(pt.y).toFixed(1)}`),
      `L ${spx(R).toFixed(1)},${spy(pdfAt(R)).toFixed(1)}`,
      `L ${spx(R).toFixed(1)},${spy(0).toFixed(1)}`,
      'Z',
    ];
    return parts.join(' ');
  };

  // Y 刻度
  const yTicks = Array.from({ length: 5 }, (_, i) => yMax * i / 4);

  // X 刻度（整数标记，避免亚像素抗锯齿，v0.4 反馈 #4）
  const xStep = Math.ceil((xMax - xMin) / 10);
  const xTickStart = Math.ceil(xMin / xStep) * xStep;
  const xTicks: number[] = [];
  for (let v = xTickStart; v <= xMax; v += xStep) xTicks.push(v);

  // σ 边界（v0.4 反馈 #4：用整数 x 坐标 + crispEdges 让竖线绝对垂直）
  const sigmaBoundaries = showSigmaRegions
    ? [...result.sigma1Range, ...result.sigma2Range, ...result.sigma3Range].filter(v => v >= xMin && v <= xMax)
    : [];

  const muX = spx(result.mu);

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ cursor: isDragging ? 'grabbing' : 'grab', userSelect: 'none', touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <rect width={VW} height={VH} fill={COLORS.bg} />
      <ChartTitle title={`正态分布 N(${result.mu}, ${result.sigma}²)  ·  视图: x∈[${xMin.toFixed(1)}, ${xMax.toFixed(1)}]  ·  缩放 ${zoom.toFixed(2)}x`} />
      <ChartAxes xLabel="x" yLabel="f(x)" />

      {/* Y 网格 */}
      {yTicks.map((v, i) => {
        const y = Math.round(spy(v));
        return (
          <g key={`yt-${i}`}>
            <line x1={ML} y1={y} x2={ML + PW} y2={y} stroke={COLORS.border} strokeWidth={0.8} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            <text x={ML - 6} y={y + 4} textAnchor="end" fontSize={11} fill={COLORS.textMuted}>{v.toFixed(3)}</text>
          </g>
        );
      })}

      {/* X 刻度（整数标记） */}
      {xTicks.map((v, i) => {
        const x = Math.round(spx(v));
        return (
          <g key={`xt-${i}`}>
            <line x1={x} y1={MT + PH} x2={x} y2={MT + PH + 4}
              stroke={COLORS.borderStrong} strokeWidth={1} shapeRendering="crispEdges" />
            <text x={x} y={MT + PH + 16} textAnchor="middle" fontSize={11} fill={COLORS.textMuted}>{v}</text>
          </g>
        );
      })}

      {/* σ 区域填充 */}
      {showSigmaRegions && (
        <>
          <path d={buildSigmaPath(result.sigma3Range[0], result.sigma3Range[1])} fill="rgba(24,144,255,0.10)" />
          <path d={buildSigmaPath(result.sigma2Range[0], result.sigma2Range[1])} fill="rgba(24,144,255,0.18)" />
          <path d={buildSigmaPath(result.sigma1Range[0], result.sigma1Range[1])} fill="rgba(0,192,107,0.22)" />

          {/* σ 边界竖线 — 用 <rect> 替代 <line> 避免 stroke 子像素抗锯齿
              （rect 用 fill 填充 1px 宽矩形，比 stroke 渲染更稳定） */}
          {sigmaBoundaries.map((v, i) => {
            const x = Math.round(spx(v));
            return (
              <rect key={i} x={x - 0.5} y={MT} width={1} height={PH}
                fill={COLORS.textTertiary} opacity={0.55} />
            );
          })}

          {/* 区间标签 */}
          {result.sigma1Range[1] >= xMin && result.sigma1Range[0] <= xMax && (
            <>
              <text x={spx((result.sigma1Range[0] + result.sigma1Range[1]) / 2)} y={MT + PH - 30} textAnchor="middle" fontSize={11} fontWeight="bold" fill={COLORS.primary}>68.27%</text>
              <text x={spx((result.sigma1Range[0] + result.sigma1Range[1]) / 2)} y={MT + PH - 16} textAnchor="middle" fontSize={10} fill={COLORS.textMuted}>±1σ</text>
            </>
          )}
          {result.sigma2Range[0] >= xMin && (
            <text x={spx((result.sigma2Range[0] + result.sigma1Range[0]) / 2)} y={MT + PH * 0.55} textAnchor="middle" fontSize={10} fill={COLORS.info}>95.45%</text>
          )}
          {result.sigma3Range[0] >= xMin && (
            <text x={spx((result.sigma3Range[0] + result.sigma2Range[0]) / 2)} y={MT + PH * 0.35} textAnchor="middle" fontSize={10} fill={COLORS.info}>99.73%</text>
          )}
        </>
      )}

      {/* 钟形曲线 */}
      <polyline points={curvePoints} fill="none" stroke={COLORS.primary} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />

      {/* 均值竖线 — 同样用 <rect> 渲染保证像素对齐 */}
      {result.mu >= xMin && result.mu <= xMax && (
        <rect x={Math.round(muX) - 0.75} y={MT} width={1.5} height={PH}
          fill={COLORS.error} opacity={0.85} />
      )}

      {/* 操作提示 + 重置按钮 */}
      <g transform={`translate(${ML + 8}, ${MT + 8})`}>
        <rect x={0} y={0} width={206} height={22} rx={6} fill={COLORS.bgPage} opacity={0.92} stroke={COLORS.border} strokeWidth={0.8} />
        <text x={8} y={15} fontSize={10} fill={COLORS.textMuted}>拖拽平移 · 滚轮缩放</text>
        <g
          style={{ cursor: 'pointer' }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); resetView(); }}
        >
          <rect x={140} y={3} width={60} height={16} rx={4} fill={COLORS.primaryLight} stroke={COLORS.primary} strokeWidth={0.8} />
          <text x={170} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={COLORS.primary}>重置视图</text>
        </g>
      </g>
    </svg>
  );
}
