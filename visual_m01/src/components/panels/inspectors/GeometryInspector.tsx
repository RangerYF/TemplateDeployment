import { useMemo } from 'react';
import type { Entity } from '@/editor/entities/types';
import { useEntityStore } from '@/editor';
import { COLORS } from '@/styles/tokens';
import { registerInspector } from './registry';
import { InspectorHeader } from './InspectorCommon';

const TYPE_LABELS: Record<string, string> = {
  cube: '正方体',
  cuboid: '长方体',
  pyramid: '棱锥',
  cone: '圆锥',
  cylinder: '圆柱',
  sphere: '球',
  regularTetrahedron: '正四面体',
  cornerTetrahedron: '墙角四面体',
  prism: '正棱柱',
  truncatedCone: '圆台',
  frustum: '棱台',
  isoscelesTetrahedron: '等腰四面体',
  orthogonalTetrahedron: '正交四面体',
};

const PARAM_LABELS: Record<string, string> = {
  sideLength: '边长',
  length: '长',
  width: '宽',
  height: '高',
  radius: '半径',
  sides: '底面边数',
  edgeA: '直角边 a',
  edgeB: '直角边 b',
  edgeC: '直角边 c',
  topRadius: '上底半径',
  bottomRadius: '下底半径',
  bottomSideLength: '下底边长',
  topSideLength: '上底边长',
  edgeP: '对棱 p',
  edgeQ: '对棱 q',
  edgeR: '对棱 r',
  edgeAB: '对棱 AB',
  edgeCD: '对棱 CD',
  lateralEdgeLength: '侧棱长',
};

function GeometryInspector({ entity }: { entity: Entity }) {
  const geoEntity = entity as Entity<'geometry'>;
  const { geometryType, params } = geoEntity.properties;

  const entities = useEntityStore((s) => s.entities);
  const stats = useMemo(() => {
    const all = Object.values(entities);
    const related = all.filter((e) => {
      const p = e.properties as { geometryId?: string; builtIn?: boolean };
      return p.geometryId === geoEntity.id && p.builtIn === true;
    });
    return {
      points: related.filter((e) => e.type === 'point').length,
      segments: related.filter((e) => e.type === 'segment').length,
      faces: related.filter((e) => e.type === 'face').length,
    };
  }, [entities, geoEntity.id]);

  const paramEntries = Object.entries(params as unknown as Record<string, unknown>).filter(
    ([, val]) => typeof val === 'number'
  ) as [string, number][];

  const typeLabel = TYPE_LABELS[geometryType] ?? geometryType;

  return (
    <div className="space-y-2">
      <InspectorHeader
        entity={entity}
        typeName="几何体"
        displayName={typeLabel}
        canDelete={false}
        canRename={false}
      />

      {/* 参数值（只读） */}
      <div className="text-sm space-y-0.5" style={{ color: COLORS.textMuted }}>
        {paramEntries.map(([key, val]) => (
          <div key={key}>
            {PARAM_LABELS[key] ?? key}：<strong style={{ color: COLORS.text }}>{val}</strong>
          </div>
        ))}
      </div>

      {/* 子实体统计 */}
      <div className="text-sm" style={{ color: COLORS.textMuted }}>
        顶点 {stats.points} · 棱线 {stats.segments} · 面 {stats.faces}
      </div>
    </div>
  );
}

registerInspector('geometry', GeometryInspector);

export { GeometryInspector };
