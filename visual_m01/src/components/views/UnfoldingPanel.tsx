import { useRef, useState, useCallback, useMemo } from 'react';
import { useEntityStore } from '@/editor';
import { useUIStore } from '@/editor/store/uiStore';
import type { Entity, PointProperties } from '@/editor/entities/types';
import { unfold, UNFOLDABLE_TYPES, type CuboidUnfoldResult, type ConeUnfoldResult, type CylinderUnfoldResult, type TruncatedConeUnfoldResult } from '@/engine/unfolding';
import { exportSvgAsPng } from '@/utils/exportImage';
import { COLORS, RADIUS } from '@/styles/tokens';

/** 面的填充色：透明（无填充） */
const FACE_FILL = 'none';

const STROKE_COLOR = '#374151';
const LABEL_COLOR = '#1f2937';

/** 根据展开图尺寸计算所有相对大小 */
function getSizing(w: number, h: number) {
  const unit = Math.min(w, h);
  return {
    padding: unit * 0.15,
    labelFontSize: unit * 0.045,
    faceNameFontSize: unit * 0.05,
    strokeWidth: 2,  // 屏幕像素，配合 vectorEffect="non-scaling-stroke"
    labelOffset: unit * 0.03,
  };
}

/** 从 EntityStore 中提取 builtIn 顶点的标签映射 */
function getVertexLabelMap(entities: Record<string, Entity>): Record<number, string> {
  const map: Record<number, string> = {};
  for (const entity of Object.values(entities)) {
    if (entity.type !== 'point') continue;
    const p = entity.properties as PointProperties;
    if (p.builtIn && p.constraint.type === 'vertex') {
      map[p.constraint.vertexIndex] = p.label;
    }
  }
  return map;
}

export function UnfoldingPanel() {
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

  const labelOverrides = useMemo(() => getVertexLabelMap(entities), [entities]);

  const svgRef = useRef<SVGSVGElement>(null);

  // 平移缩放状态
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const supported = currentType ? UNFOLDABLE_TYPES.includes(currentType) : false;

  const result = useMemo(() => {
    if (!supported || !currentType || !currentParams) return null;
    return unfold(currentType, currentParams as unknown as Record<string, number>);
  }, [supported, currentType, currentParams]);

  // 滚轮缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.max(0.2, Math.min(5, z * factor)));
  }, []);

  // 拖拽平移
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }, [dragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  // 导出
  const handleExport = useCallback(() => {
    if (!svgRef.current || !currentType) return;
    const typeNameMap: Record<string, string> = {
      cube: '正方体', cuboid: '长方体', cone: '圆锥', pyramid: '棱锥', cylinder: '圆柱',
    };
    const typeName = typeNameMap[currentType] ?? currentType;
    exportSvgAsPng(svgRef.current, `${typeName}-展开图`, 2);
  }, [currentType]);

  // 重置视图
  const handleReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // 替换顶点标签（用户自定义标签覆盖）
  const applyLabelOverrides = (label: string): string => {
    // 长方体/正方体标签
    const CUBOID_LABEL_MAP: Record<string, number> = {
      'A': 0, 'B': 1, 'C': 2, 'D': 3,
      'A₁': 4, 'B₁': 5, 'C₁': 6, 'D₁': 7,
    };
    // 棱锥标签: P 是顶点(index=n), A-H 是底面(index 0..n-1)
    const PYRAMID_LABELS = 'ABCDEFGH';
    if (currentType === 'pyramid') {
      const n = (currentParams as unknown as Record<string, number>)?.sides ?? 4;
      if (label === 'P') {
        const idx = n; // P 在 builder 中的索引
        if (labelOverrides[idx]) return labelOverrides[idx];
      } else {
        const pi = PYRAMID_LABELS.indexOf(label);
        if (pi >= 0 && pi < n && labelOverrides[pi]) return labelOverrides[pi];
      }
      return label;
    }
    const idx = CUBOID_LABEL_MAP[label];
    if (idx !== undefined && labelOverrides[idx]) {
      return labelOverrides[idx];
    }
    return label;
  };

  // 不支持展开图的几何体
  if (!supported || !result) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ backgroundColor: '#fafafa', color: COLORS.textPlaceholder, fontSize: 13 }}
      >
        当前几何体暂不支持展开图
      </div>
    );
  }

  const sizing = getSizing(result.width, result.height);

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
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: COLORS.text,
          }}
        >
          展开图
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            onClick={handleReset}
            style={{
              padding: '2px 8px',
              fontSize: 11,
              color: COLORS.textMuted,
              background: COLORS.bgMuted,
              border: `1px solid ${COLORS.border}`,
              borderRadius: RADIUS.xs,
              cursor: 'pointer',
            }}
          >
            重置
          </button>
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
            onClick={() => useUIStore.getState().setUnfoldingEnabled(false)}
            style={{
              padding: '2px 6px',
              fontSize: 13,
              color: COLORS.textMuted,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              lineHeight: 1,
            }}
            title="关闭展开图"
          >
            ✕
          </button>
        </div>
      </div>

      {/* SVG 画布区域 */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          cursor: dragging ? 'grabbing' : 'grab',
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`0 0 ${result.width + sizing.padding * 2} ${result.height + sizing.padding * 2}`}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
          }}
        >
          <g transform={`translate(${sizing.padding}, ${sizing.padding})`}>
            {result.kind === 'polygon'
              ? renderPolygonUnfold(result, applyLabelOverrides, sizing)
              : result.kind === 'cylinder'
                ? renderCylinderUnfold(result, applyLabelOverrides, sizing)
                : result.kind === 'truncatedCone'
                  ? renderTruncatedConeUnfold(result, applyLabelOverrides, sizing)
                  : renderConeUnfold(result, applyLabelOverrides, sizing)}
          </g>
        </svg>
      </div>
    </div>
  );
}

/** sizing 参数类型 */
type Sizing = ReturnType<typeof getSizing>;

/** 渲染多边形展开图（长方体/正方体） */
function renderPolygonUnfold(
  result: CuboidUnfoldResult,
  applyLabel: (label: string) => string,
  sizing: Sizing,
) {
  const labelMap = new Map<string, { x: number; y: number; text: string }>();

  return (
    <>
      {result.faces.map((face, faceIdx) => {
        const points = face.vertices.map((v) => `${v[0]},${v[1]}`).join(' ');

        const cx = face.vertices.reduce((s, v) => s + v[0], 0) / face.vertices.length;
        const cy = face.vertices.reduce((s, v) => s + v[1], 0) / face.vertices.length;

        face.vertices.forEach((v, vi) => {
          const key = `${v[0].toFixed(1)}_${v[1].toFixed(1)}`;
          if (!labelMap.has(key)) {
            labelMap.set(key, { x: v[0], y: v[1], text: applyLabel(face.labels[vi]) });
          }
        });

        return (
          <g key={faceIdx}>
            <polygon
              points={points}
              fill={FACE_FILL}
              stroke={STROKE_COLOR}
              strokeWidth={sizing.strokeWidth}
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="central"
              fill={COLORS.textMuted}
              fontSize={sizing.faceNameFontSize}
              fontWeight={500}
            >
              {face.name}
            </text>
          </g>
        );
      })}

      {Array.from(labelMap.values()).map((lbl, i) => {
        // 从整体图形中心向外偏移，避免标签与边线重合
        const figCx = result.width / 2;
        const figCy = result.height / 2;
        let dx = lbl.x - figCx;
        let dy = lbl.y - figCy;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        dx = (dx / len) * sizing.labelOffset;
        dy = (dy / len) * sizing.labelOffset;

        // 根据偏移方向设置文本锚点
        const anchor = dx < -0.01 ? 'end' : dx > 0.01 ? 'start' : 'middle';
        const baseline = dy < -0.01 ? 'auto' : dy > 0.01 ? 'hanging' : 'central';

        return (
          <text
            key={i}
            x={lbl.x + dx}
            y={lbl.y + dy}
            textAnchor={anchor}
            dominantBaseline={baseline}
            fill={LABEL_COLOR}
            fontSize={sizing.labelFontSize}
            fontWeight={600}
          >
            {lbl.text}
          </text>
        );
      })}
    </>
  );
}

/** 渲染圆锥展开图 */
function renderConeUnfold(
  result: ConeUnfoldResult,
  applyLabel: (label: string) => string,
  sizing: Sizing,
) {
  const { sector, baseCircle } = result;
  const { center, radius: sectorRadius, startAngle, sweepAngle } = sector;

  const x1 = center[0] + sectorRadius * Math.cos(startAngle);
  const y1 = center[1] + sectorRadius * Math.sin(startAngle);
  const x2 = center[0] + sectorRadius * Math.cos(startAngle + sweepAngle);
  const y2 = center[1] + sectorRadius * Math.sin(startAngle + sweepAngle);

  const largeArcFlag = sweepAngle > Math.PI ? 1 : 0;

  const sectorPath = [
    `M ${center[0]} ${center[1]}`,
    `L ${x1} ${y1}`,
    `A ${sectorRadius} ${sectorRadius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
    `Z`,
  ].join(' ');

  return (
    <>
      <path
        d={sectorPath}
        fill="none"
        stroke={STROKE_COLOR}
        strokeWidth={sizing.strokeWidth}
        vectorEffect="non-scaling-stroke"
      />

      <circle
        cx={baseCircle.center[0]}
        cy={baseCircle.center[1]}
        r={baseCircle.radius}
        fill="none"
        stroke={STROKE_COLOR}
        strokeWidth={sizing.strokeWidth}
        vectorEffect="non-scaling-stroke"
      />

      {sector.labels.map((lbl, i) => (
        <text
          key={`s-${i}`}
          x={lbl.position[0]}
          y={lbl.position[1]}
          dx={-sizing.labelOffset}
          dy={i === 2 ? -sizing.labelOffset * 1.5 : -sizing.labelOffset}
          fill={LABEL_COLOR}
          fontSize={sizing.labelFontSize}
          fontWeight={600}
        >
          {applyLabel(lbl.text)}
        </text>
      ))}

      <text
        x={baseCircle.label.position[0]}
        y={baseCircle.label.position[1]}
        dx={sizing.labelOffset * 1.5}
        dy={sizing.labelOffset * 0.8}
        fill={LABEL_COLOR}
        fontSize={sizing.labelFontSize}
        fontWeight={600}
      >
        {applyLabel(baseCircle.label.text)}
      </text>

      <text
        x={center[0]}
        y={center[1] + sectorRadius * 0.55}
        textAnchor="middle"
        fill={COLORS.textMuted}
        fontSize={sizing.faceNameFontSize}
        fontWeight={500}
      >
        侧面
      </text>
      <text
        x={baseCircle.center[0]}
        y={baseCircle.center[1] + baseCircle.radius * 0.3}
        textAnchor="middle"
        fill={COLORS.textMuted}
        fontSize={sizing.faceNameFontSize}
        fontWeight={500}
      >
        底面
      </text>
    </>
  );
}

/** 渲染圆柱展开图 */
function renderCylinderUnfold(
  result: CylinderUnfoldResult,
  applyLabel: (label: string) => string,
  sizing: Sizing,
) {
  const { rect, topCircle, bottomCircle } = result;

  return (
    <>
      {/* 侧面矩形 */}
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        fill="none"
        stroke={STROKE_COLOR}
        strokeWidth={sizing.strokeWidth}
        vectorEffect="non-scaling-stroke"
      />

      {/* 顶面圆 */}
      <circle
        cx={topCircle.center[0]}
        cy={topCircle.center[1]}
        r={topCircle.radius}
        fill="none"
        stroke={STROKE_COLOR}
        strokeWidth={sizing.strokeWidth}
        vectorEffect="non-scaling-stroke"
      />

      {/* 底面圆 */}
      <circle
        cx={bottomCircle.center[0]}
        cy={bottomCircle.center[1]}
        r={bottomCircle.radius}
        fill="none"
        stroke={STROKE_COLOR}
        strokeWidth={sizing.strokeWidth}
        vectorEffect="non-scaling-stroke"
      />

      {/* 侧面标注 */}
      <text
        x={rect.x + rect.width / 2}
        y={rect.y + rect.height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill={COLORS.textMuted}
        fontSize={sizing.faceNameFontSize}
        fontWeight={500}
      >
        侧面
      </text>

      {/* 顶面标注 */}
      <text
        x={topCircle.center[0]}
        y={topCircle.center[1] + topCircle.radius * 0.3}
        textAnchor="middle"
        fill={COLORS.textMuted}
        fontSize={sizing.faceNameFontSize}
        fontWeight={500}
      >
        顶面
      </text>

      {/* 底面标注 */}
      <text
        x={bottomCircle.center[0]}
        y={bottomCircle.center[1] + bottomCircle.radius * 0.3}
        textAnchor="middle"
        fill={COLORS.textMuted}
        fontSize={sizing.faceNameFontSize}
        fontWeight={500}
      >
        底面
      </text>

      {/* 顶面圆心标签 O₁ */}
      <text
        x={topCircle.label.position[0]}
        y={topCircle.label.position[1]}
        dx={sizing.labelOffset * 1.5}
        dy={sizing.labelOffset * 0.8}
        fill={LABEL_COLOR}
        fontSize={sizing.labelFontSize}
        fontWeight={600}
      >
        {applyLabel(topCircle.label.text)}
      </text>

      {/* 底面圆心标签 O */}
      <text
        x={bottomCircle.label.position[0]}
        y={bottomCircle.label.position[1]}
        dx={sizing.labelOffset * 1.5}
        dy={sizing.labelOffset * 0.8}
        fill={LABEL_COLOR}
        fontSize={sizing.labelFontSize}
        fontWeight={600}
      >
        {applyLabel(bottomCircle.label.text)}
      </text>
    </>
  );
}

/** 渲染圆台展开图（扇环 + 两个圆） */
function renderTruncatedConeUnfold(
  result: TruncatedConeUnfoldResult,
  applyLabel: (label: string) => string,
  sizing: Sizing,
) {
  const { annularSector, bottomCircle, topCircle } = result;
  const { center, outerRadius, innerRadius, startAngle, sweepAngle } = annularSector;

  // 外弧端点
  const ox1 = center[0] + outerRadius * Math.cos(startAngle);
  const oy1 = center[1] + outerRadius * Math.sin(startAngle);
  const ox2 = center[0] + outerRadius * Math.cos(startAngle + sweepAngle);
  const oy2 = center[1] + outerRadius * Math.sin(startAngle + sweepAngle);

  // 内弧端点
  const ix1 = center[0] + innerRadius * Math.cos(startAngle);
  const iy1 = center[1] + innerRadius * Math.sin(startAngle);
  const ix2 = center[0] + innerRadius * Math.cos(startAngle + sweepAngle);
  const iy2 = center[1] + innerRadius * Math.sin(startAngle + sweepAngle);

  const largeArcFlag = sweepAngle > Math.PI ? 1 : 0;

  // 扇环路径：外弧 → 右直线 → 内弧（反向） → 左直线
  const sectorPath = [
    `M ${ix1} ${iy1}`,
    `L ${ox1} ${oy1}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${ox2} ${oy2}`,
    `L ${ix2} ${iy2}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${ix1} ${iy1}`,
    `Z`,
  ].join(' ');

  return (
    <>
      <path
        d={sectorPath}
        fill="none"
        stroke={STROKE_COLOR}
        strokeWidth={sizing.strokeWidth}
        vectorEffect="non-scaling-stroke"
      />

      <circle
        cx={bottomCircle.center[0]}
        cy={bottomCircle.center[1]}
        r={bottomCircle.radius}
        fill="none"
        stroke={STROKE_COLOR}
        strokeWidth={sizing.strokeWidth}
        vectorEffect="non-scaling-stroke"
      />

      <circle
        cx={topCircle.center[0]}
        cy={topCircle.center[1]}
        r={topCircle.radius}
        fill="none"
        stroke={STROKE_COLOR}
        strokeWidth={sizing.strokeWidth}
        vectorEffect="non-scaling-stroke"
      />

      {/* 侧面标注 */}
      <text
        x={center[0]}
        y={center[1] + (outerRadius + innerRadius) / 2 * 0.7}
        textAnchor="middle"
        fill={COLORS.textMuted}
        fontSize={sizing.faceNameFontSize}
        fontWeight={500}
      >
        侧面
      </text>

      {/* 底面标注 */}
      <text
        x={bottomCircle.center[0]}
        y={bottomCircle.center[1] + bottomCircle.radius * 0.3}
        textAnchor="middle"
        fill={COLORS.textMuted}
        fontSize={sizing.faceNameFontSize}
        fontWeight={500}
      >
        底面
      </text>

      {/* 顶面标注 */}
      <text
        x={topCircle.center[0]}
        y={topCircle.center[1] + topCircle.radius * 0.3}
        textAnchor="middle"
        fill={COLORS.textMuted}
        fontSize={sizing.faceNameFontSize}
        fontWeight={500}
      >
        顶面
      </text>

      {/* 圆心标签 */}
      <text
        x={bottomCircle.label.position[0]}
        y={bottomCircle.label.position[1]}
        dx={sizing.labelOffset * 1.5}
        dy={sizing.labelOffset * 0.8}
        fill={LABEL_COLOR}
        fontSize={sizing.labelFontSize}
        fontWeight={600}
      >
        {applyLabel(bottomCircle.label.text)}
      </text>
      <text
        x={topCircle.label.position[0]}
        y={topCircle.label.position[1]}
        dx={sizing.labelOffset * 1.5}
        dy={sizing.labelOffset * 0.8}
        fill={LABEL_COLOR}
        fontSize={sizing.labelFontSize}
        fontWeight={600}
      >
        {applyLabel(topCircle.label.text)}
      </text>
    </>
  );
}
