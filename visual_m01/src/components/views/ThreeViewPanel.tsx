import { useRef, useMemo, useCallback } from 'react';
import { useEntityStore } from '@/editor';
import { useUIStore } from '@/editor/store/uiStore';
import type { Entity } from '@/editor/entities/types';
import { project, THREE_VIEW_TYPES, type SingleView } from '@/engine/projection';
import { exportSvgAsPng } from '@/utils/exportImage';
import { COLORS, RADIUS } from '@/styles/tokens';

/** 视图间距与标注区域 */
const GAP = 55;
const DIM_OFFSET = 18;
const PADDING = 45;
const STROKE_COLOR = '#374151';
const HIDDEN_COLOR = '#9ca3af';
const LABEL_COLOR = '#1f2937';
const FONT_SIZE = 11;
const DIM_FONT_SIZE = 10;
const SCALE_BASE = 60; // 每单位几何尺寸对应的 SVG 像素

export function ThreeViewPanel() {
  // ─── EntityStore 数据源 ───
  const entities = useEntityStore((s) => s.entities);
  const activeGeometryId = useEntityStore((s) => s.activeGeometryId);

  const geometry = useMemo(() => {
    if (!activeGeometryId) return null;
    const e = entities[activeGeometryId];
    return e?.type === 'geometry' ? (e as Entity<'geometry'>) : null;
  }, [activeGeometryId, entities]);

  const currentType = geometry?.properties.geometryType;
  const currentParams = geometry?.properties.params;

  const svgRef = useRef<SVGSVGElement>(null);

  const supported = currentType ? THREE_VIEW_TYPES.includes(currentType) : false;

  const result = useMemo(() => {
    if (!supported || !currentType || !currentParams) return null;
    return project(currentType, currentParams as unknown as Record<string, number>);
  }, [supported, currentType, currentParams]);

  const handleExport = useCallback(() => {
    if (!svgRef.current || !currentType) return;
    const typeNameMap: Record<string, string> = {
      cube: '正方体', cuboid: '长方体', cone: '圆锥', pyramid: '棱锥', cylinder: '圆柱', sphere: '球',
    };
    const typeName = typeNameMap[currentType] ?? currentType;
    exportSvgAsPng(svgRef.current, `${typeName}-三视图`, 2);
  }, [currentType]);

  if (!supported || !result) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ backgroundColor: '#fafafa', color: COLORS.textPlaceholder, fontSize: 13 }}
      >
        当前几何体暂不支持三视图
      </div>
    );
  }

  const { front, side, top } = result;

  // 缩放各视图到 SVG 像素
  const fw = front.width * SCALE_BASE;
  const fh = front.height * SCALE_BASE;
  const sw = side.width * SCALE_BASE;
  const sh = side.height * SCALE_BASE;
  const tw = top.width * SCALE_BASE;
  const th = top.height * SCALE_BASE;

  // 布局：
  // 正视图 (左上)  | GAP | 侧视图 (右上)
  // GAP
  // 俯视图 (左下)
  const totalW = PADDING + fw + GAP + sw + PADDING;
  const totalH = PADDING + Math.max(fh, sh) + GAP + th + PADDING;

  // 各视图原点 (左下角为 y=0，SVG 需翻转 Y)
  const frontX = PADDING;
  const frontY = PADDING;
  const sideX = PADDING + fw + GAP;
  const sideY = PADDING;
  const topX = PADDING;
  const topY = PADDING + fh + GAP;

  return (
    <div
      className="flex flex-col h-full"
      style={{ backgroundColor: '#fafafa' }}
    >
      {/* 标题栏 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          borderBottom: `1px solid ${COLORS.border}`,
          flexShrink: 0,
          backgroundColor: COLORS.bg,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.text }}>
          三视图
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            onClick={handleExport}
            style={{
              padding: '2px 8px',
              fontSize: 11,
              color: '#fff',
              background: COLORS.primary,
              border: 'none',
              borderRadius: RADIUS.xs,
              cursor: 'pointer',
            }}
          >
            导出PNG
          </button>
          <button
            onClick={() => useUIStore.getState().setThreeViewEnabled(false)}
            style={{
              padding: '2px 6px',
              fontSize: 13,
              color: COLORS.textMuted,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              lineHeight: 1,
            }}
            title="关闭三视图"
          >
            ✕
          </button>
        </div>
      </div>

      {/* SVG 画布 */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`0 0 ${totalW} ${totalH}`}
          style={{ maxWidth: '100%', maxHeight: '100%' }}
        >
          {/* 正视图 */}
          <g transform={`translate(${frontX}, ${frontY})`}>
            <ViewLabel x={fw / 2} y={-8} text={front.label} />
            <RenderView view={front} scale={SCALE_BASE} />
          </g>

          {/* 侧视图 */}
          <g transform={`translate(${sideX}, ${sideY})`}>
            <ViewLabel x={sw / 2} y={-8} text={side.label} />
            <RenderView view={side} scale={SCALE_BASE} />
          </g>

          {/* 俯视图 */}
          <g transform={`translate(${topX}, ${topY})`}>
            <ViewLabel x={tw / 2} y={-8} text={top.label} />
            <RenderView view={top} scale={SCALE_BASE} />
          </g>
        </svg>
      </div>
    </div>
  );
}

/** 视图标题 */
function ViewLabel({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fill={LABEL_COLOR}
      fontSize={FONT_SIZE}
      fontWeight={600}
    >
      {text}
    </text>
  );
}

/** 渲染单个视图 */
function RenderView({ view, scale }: { view: SingleView; scale: number }) {
  const h = view.height * scale;

  return (
    <g>
      {/* 线段 */}
      {view.segments.map((seg, i) => (
        <line
          key={`s-${i}`}
          x1={seg.x1 * scale}
          y1={h - seg.y1 * scale}
          x2={seg.x2 * scale}
          y2={h - seg.y2 * scale}
          stroke={seg.visible ? STROKE_COLOR : HIDDEN_COLOR}
          strokeWidth={seg.visible ? 1.5 : 1}
          strokeDasharray={seg.visible ? undefined : '4 3'}
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {/* 圆 */}
      {view.circles.map((c, i) => (
        <circle
          key={`c-${i}`}
          cx={c.cx * scale}
          cy={h - c.cy * scale}
          r={c.r * scale}
          fill="none"
          stroke={c.visible ? STROKE_COLOR : HIDDEN_COLOR}
          strokeWidth={c.visible ? 1.5 : 1}
          strokeDasharray={c.visible ? undefined : '4 3'}
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {/* 点 */}
      {view.points.map((p, i) => (
        <circle
          key={`p-${i}`}
          cx={p.x * scale}
          cy={h - p.y * scale}
          r={2}
          fill={STROKE_COLOR}
        />
      ))}

      {/* 尺寸标注 */}
      {view.dimensions.map((dim, i) => (
        <DimensionLine key={`d-${i}`} dim={dim} scale={scale} viewHeight={h} />
      ))}
    </g>
  );
}

/** 尺寸标注线 */
function DimensionLine({
  dim,
  scale,
  viewHeight,
}: {
  dim: SingleView['dimensions'][number];
  scale: number;
  viewHeight: number;
}) {
  const x1 = dim.x1 * scale;
  const y1 = viewHeight - dim.y1 * scale;
  const x2 = dim.x2 * scale;
  const y2 = viewHeight - dim.y2 * scale;

  // 根据方向计算标注偏移
  let ox = 0, oy = 0;
  let anchor: 'middle' | 'start' | 'end' = 'middle';
  switch (dim.side) {
    case 'bottom': oy = DIM_OFFSET; break;
    case 'top': oy = -DIM_OFFSET; break;
    case 'left': ox = -DIM_OFFSET; anchor = 'end'; break;
    case 'right': ox = DIM_OFFSET; anchor = 'start'; break;
  }

  const mx = (x1 + x2) / 2 + ox;
  const my = (y1 + y2) / 2 + oy;

  // 标注线的延长线
  const isHorizontal = dim.side === 'bottom' || dim.side === 'top';

  return (
    <g>
      {/* 引出线 */}
      {isHorizontal ? (
        <>
          <line x1={x1} y1={y1} x2={x1} y2={y1 + oy * 0.8} stroke={HIDDEN_COLOR} strokeWidth={0.5} />
          <line x1={x2} y1={y2} x2={x2} y2={y2 + oy * 0.8} stroke={HIDDEN_COLOR} strokeWidth={0.5} />
          {/* 标注线 */}
          <line
            x1={x1} y1={y1 + oy * 0.6}
            x2={x2} y2={y2 + oy * 0.6}
            stroke={HIDDEN_COLOR} strokeWidth={0.5}
            markerStart="url(#arrowL)" markerEnd="url(#arrowR)"
          />
        </>
      ) : (
        <>
          <line x1={x1} y1={y1} x2={x1 + ox * 0.8} y2={y1} stroke={HIDDEN_COLOR} strokeWidth={0.5} />
          <line x1={x2} y1={y2} x2={x2 + ox * 0.8} y2={y2} stroke={HIDDEN_COLOR} strokeWidth={0.5} />
          <line
            x1={x1 + ox * 0.6} y1={y1}
            x2={x2 + ox * 0.6} y2={y2}
            stroke={HIDDEN_COLOR} strokeWidth={0.5}
            markerStart="url(#arrowU)" markerEnd="url(#arrowD)"
          />
        </>
      )}

      {/* 标注文字 */}
      <text
        x={mx}
        y={my}
        textAnchor={anchor}
        dominantBaseline="central"
        fill={LABEL_COLOR}
        fontSize={DIM_FONT_SIZE}
        fontWeight={500}
      >
        {dim.text}
      </text>
    </g>
  );
}
