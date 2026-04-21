import { useEffect } from 'react';
import { useEntityStore, useHistoryStore, CreateEntityCommand, BatchCommand } from '@/editor';
import type { PointProperties, SegmentProperties, FaceProperties, GeometryProperties } from '@/editor/entities/types';
import { COLORS, RADIUS, SHADOWS } from '@/styles/tokens';
import { useContextMenuStore } from './contextMenuStore';
import { computePointPosition } from './renderers/usePointPosition';
import { getBuilderResult } from '@/editor/builderCache';

/** 默认自定义点标签序列 */
const DEFAULT_LABELS = ['M', 'N', 'P', 'Q', 'R', 'S', 'T'];

function subscript(n: number): string {
  const subs = '₀₁₂₃₄₅₆₇₈₉';
  return String(n)
    .split('')
    .map((d) => subs[Number(d)])
    .join('');
}

function getNextLabel(existing: string[]): string {
  for (const l of DEFAULT_LABELS) {
    if (!existing.includes(l)) return l;
  }
  let i = 1;
  while (existing.includes(`M${subscript(i)}`)) i++;
  return `M${subscript(i)}`;
}

interface MenuItem {
  label: string;
  action: () => void;
}

function useFaceMenuItems(): MenuItem[] {
  const menu = useContextMenuStore((s) => s.menu);
  const closeMenu = useContextMenuStore((s) => s.closeMenu);

  if (!menu || menu.targetEntityType !== 'face' || !menu.hitPoint) return [];

  const store = useEntityStore.getState();
  const face = store.getEntity(menu.targetEntityId);
  if (!face || face.type !== 'face') return [];

  const faceProps = face.properties as FaceProperties;
  const geometryEntity = store.getEntity(faceProps.geometryId);
  if (!geometryEntity || geometryEntity.type !== 'geometry') return [];
  const geoProps = geometryEntity.properties as GeometryProperties;
  const result = getBuilderResult(faceProps.geometryId, geoProps.geometryType, geoProps.params);
  if (!result) return [];

  const hitPoint = menu.hitPoint;

  // 曲面面（surface 类型）：pointIds 为空，需要用 free 约束取点
  if (faceProps.source.type === 'surface') {
    const allPoints = store.getEntitiesByType('point');
    const existingLabels = allPoints.map((p) => p.properties.label);

    const items: MenuItem[] = [];
    items.push({
      label: '面上取点',
      action: () => {
        const labels = [...existingLabels];
        const label = getNextLabel(labels);
        const pointProps: PointProperties = {
          builtIn: false,
          geometryId: faceProps.geometryId,
          constraint: { type: 'free', position: hitPoint as [number, number, number] },
          label,
        };
        const cmd = new CreateEntityCommand('point', pointProps);
        useHistoryStore.getState().execute(cmd);
        closeMenu();
      },
    });
    return items;
  }

  // 多面体面（geometry/crossSection/custom 类型）：通过 pointIds 计算 (u, v)
  const facePointIds = faceProps.pointIds;
  if (facePointIds.length < 3) return [];

  const facePositions: [number, number, number][] = [];
  for (let i = 0; i < Math.min(3, facePointIds.length); i++) {
    const pe = store.getEntity(facePointIds[i]);
    if (!pe || pe.type !== 'point') return [];
    const pos = computePointPosition(pe.properties as PointProperties, result);
    if (!pos) return [];
    facePositions.push(pos as [number, number, number]);
  }

  const [p0, p1, p2] = facePositions;

  const dx = hitPoint[0] - p0[0], dy = hitPoint[1] - p0[1], dz = hitPoint[2] - p0[2];
  const e1x = p1[0] - p0[0], e1y = p1[1] - p0[1], e1z = p1[2] - p0[2];
  const e2x = p2[0] - p0[0], e2y = p2[1] - p0[1], e2z = p2[2] - p0[2];

  const dot11 = e1x * e1x + e1y * e1y + e1z * e1z;
  const dot12 = e1x * e2x + e1y * e2y + e1z * e2z;
  const dot22 = e2x * e2x + e2y * e2y + e2z * e2z;
  const dotd1 = dx * e1x + dy * e1y + dz * e1z;
  const dotd2 = dx * e2x + dy * e2y + dz * e2z;
  const denom = dot11 * dot22 - dot12 * dot12;
  if (Math.abs(denom) < 1e-12) return [];

  const u = (dot22 * dotd1 - dot12 * dotd2) / denom;
  const v = (dot11 * dotd2 - dot12 * dotd1) / denom;

  const allPoints = store.getEntitiesByType('point');
  const existingLabels = allPoints.map((p) => p.properties.label);

  const items: MenuItem[] = [];

  items.push({
    label: '面上取点',
    action: () => {
      const labels = [...existingLabels];
      const label = getNextLabel(labels);
      const pointProps: PointProperties = {
        builtIn: false,
        geometryId: faceProps.geometryId,
        constraint: { type: 'face', faceId: menu.targetEntityId, u, v },
        label,
      };
      const cmd = new CreateEntityCommand('point', pointProps);
      useHistoryStore.getState().execute(cmd);
      closeMenu();
    },
  });

  return items;
}

function useMenuItems(): MenuItem[] {
  const menu = useContextMenuStore((s) => s.menu);
  const closeMenu = useContextMenuStore((s) => s.closeMenu);

  if (!menu || menu.targetEntityType !== 'segment') return [];

  const store = useEntityStore.getState();
  const segment = store.getEntity(menu.targetEntityId);
  if (!segment || segment.type !== 'segment') return [];

  const segProps = segment.properties as SegmentProperties;

  // 曲线段：使用 curve 约束
  if (segProps.curvePoints && segProps.lineIndex !== undefined) {
    return buildCurveMenuItems(segProps, menu.hitT ?? 0.5, closeMenu);
  }

  // 直线段：使用 edge 约束
  const startPoint = store.getEntity(segProps.startPointId);
  const endPoint = store.getEntity(segProps.endPointId);
  if (!startPoint || !endPoint || startPoint.type !== 'point' || endPoint.type !== 'point') return [];

  const startConstraint = (startPoint.properties as PointProperties).constraint;
  const endConstraint = (endPoint.properties as PointProperties).constraint;

  if (startConstraint.type !== 'vertex' || endConstraint.type !== 'vertex') return [];

  const edgeStart = startConstraint.vertexIndex;
  const edgeEnd = endConstraint.vertexIndex;
  const geometryId = segProps.geometryId;
  const hitT = menu.hitT ?? 0.5;

  const allPoints = store.getEntitiesByType('point');
  const existingLabels = allPoints.map((p) => p.properties.label);

  const makePointProps = (t: number, labels: string[]): PointProperties => {
    const label = getNextLabel(labels);
    labels.push(label);
    return {
      builtIn: false,
      geometryId,
      constraint: { type: 'edge', edgeStart, edgeEnd, t },
      label,
    };
  };

  const items: MenuItem[] = [];

  items.push({
    label: '取中点',
    action: () => {
      const labels = [...existingLabels];
      const cmd = new CreateEntityCommand('point', makePointProps(0.5, labels));
      useHistoryStore.getState().execute(cmd);
      closeMenu();
    },
  });

  items.push({
    label: '在此处取点',
    action: () => {
      const labels = [...existingLabels];
      const cmd = new CreateEntityCommand('point', makePointProps(hitT, labels));
      useHistoryStore.getState().execute(cmd);
      closeMenu();
    },
  });

  items.push({
    label: '2 等分',
    action: () => {
      const labels = [...existingLabels];
      const cmd = new CreateEntityCommand('point', makePointProps(0.5, labels));
      useHistoryStore.getState().execute(cmd);
      closeMenu();
    },
  });

  items.push({
    label: '3 等分',
    action: () => {
      const labels = [...existingLabels];
      const cmds = [
        new CreateEntityCommand('point', makePointProps(1 / 3, labels)),
        new CreateEntityCommand('point', makePointProps(2 / 3, labels)),
      ];
      const batch = new BatchCommand('3 等分', cmds);
      useHistoryStore.getState().execute(batch);
      closeMenu();
    },
  });

  return items;
}

/** 构建曲线段的右键菜单项 */
function buildCurveMenuItems(
  segProps: SegmentProperties,
  hitT: number,
  closeMenu: () => void,
): MenuItem[] {
  const store = useEntityStore.getState();
  const allPoints = store.getEntitiesByType('point');
  const existingLabels = allPoints.map((p) => p.properties.label);
  const geometryId = segProps.geometryId;
  const lineIndex = segProps.lineIndex!;

  const makeCurvePointProps = (t: number, labels: string[]): PointProperties => {
    const label = getNextLabel(labels);
    labels.push(label);
    return {
      builtIn: false,
      geometryId,
      constraint: { type: 'curve', lineIndex, t },
      label,
    };
  };

  const items: MenuItem[] = [];

  items.push({
    label: '在此处取点',
    action: () => {
      const labels = [...existingLabels];
      const cmd = new CreateEntityCommand('point', makeCurvePointProps(hitT, labels));
      useHistoryStore.getState().execute(cmd);
      closeMenu();
    },
  });

  items.push({
    label: '取中点',
    action: () => {
      const labels = [...existingLabels];
      const cmd = new CreateEntityCommand('point', makeCurvePointProps(0.5, labels));
      useHistoryStore.getState().execute(cmd);
      closeMenu();
    },
  });

  items.push({
    label: '4 等分',
    action: () => {
      const labels = [...existingLabels];
      const cmds = [
        new CreateEntityCommand('point', makeCurvePointProps(0.25, labels)),
        new CreateEntityCommand('point', makeCurvePointProps(0.5, labels)),
        new CreateEntityCommand('point', makeCurvePointProps(0.75, labels)),
      ];
      const batch = new BatchCommand('4 等分', cmds);
      useHistoryStore.getState().execute(batch);
      closeMenu();
    },
  });

  return items;
}

export function ContextMenu3D() {
  const menu = useContextMenuStore((s) => s.menu);
  const closeMenu = useContextMenuStore((s) => s.closeMenu);
  const segmentItems = useMenuItems();
  const faceItems = useFaceMenuItems();
  const menuItems = segmentItems.length > 0 ? segmentItems : faceItems;
  const menuTitle = menu?.targetEntityType === 'face' ? '面'
    : (() => {
        const seg = menu?.targetEntityId ? useEntityStore.getState().getEntity(menu.targetEntityId) : undefined;
        return seg?.type === 'segment' && (seg.properties as SegmentProperties).curvePoints ? '曲线' : '棱线';
      })();

  // ESC 关闭
  useEffect(() => {
    if (!menu) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menu, closeMenu]);

  // 点击外部关闭
  useEffect(() => {
    if (!menu) return;
    const handleClickOutside = () => closeMenu();
    const timer = setTimeout(
      () => window.addEventListener('pointerdown', handleClickOutside),
      0,
    );
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [menu, closeMenu]);

  if (!menu || menuItems.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: menu.screenPosition.x,
        top: menu.screenPosition.y,
        zIndex: 1000,
        minWidth: 140,
        background: COLORS.bg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.sm,
        boxShadow: SHADOWS.lg,
        padding: '4px 0',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* 标题 */}
      <div
        style={{
          padding: '6px 12px 6px',
          fontSize: 12,
          fontWeight: 600,
          color: COLORS.textMuted,
          borderBottom: `1px solid ${COLORS.border}`,
          marginBottom: 2,
        }}
      >
        {menuTitle}
      </div>

      {/* 菜单项 */}
      {menuItems.map((item, i) => (
        <div
          key={i}
          onClick={item.action}
          style={{
            padding: '8px 12px',
            fontSize: 14,
            color: COLORS.text,
            cursor: 'pointer',
            transition: 'background 0.1s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.background = COLORS.bgHover;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.background = 'transparent';
          }}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
}
