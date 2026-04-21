import { useState, useMemo } from 'react';
import { Switch } from '@/components/ui/switch';
import { COLORS } from '@/styles/tokens';
import type { Entity, PointProperties, CoordinateSystemProperties } from '@/editor/entities/types';
import {
  useEntityStore,
  useHistoryStore,
  useToolStore,
  CreateEntityCommand,
  DeleteEntityCascadeCommand,
} from '@/editor';

export function CoordSystemPanel() {
  const entitiesMap = useEntityStore((s) => s.entities);
  const activeToolId = useToolStore((s) => s.activeToolId);

  const coordEntity = useMemo(() => {
    for (const e of Object.values(entitiesMap)) {
      if (e.type === 'coordinateSystem') return e as Entity<'coordinateSystem'>;
    }
    return undefined;
  }, [entitiesMap]);

  const coordOriginLabel = useMemo(() => {
    if (!coordEntity) return null;
    const pt = entitiesMap[coordEntity.properties.originPointId];
    return pt?.type === 'point' ? (pt.properties as PointProperties).label : null;
  }, [coordEntity, entitiesMap]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 13, color: COLORS.text }}>
          启用坐标系
        </span>
        <Switch
          checked={!!coordEntity}
          onCheckedChange={(checked) => {
            if (checked) {
              useToolStore.getState().setActiveTool('coordSystem');
            } else if (coordEntity) {
              useHistoryStore.getState().execute(
                new DeleteEntityCascadeCommand(coordEntity.id),
              );
            }
          }}
        />
      </div>

      {coordEntity && (
        <div className="text-sm" style={{ color: COLORS.textMuted }}>
          <span>
            原点：
            <strong style={{ color: COLORS.text }}>{coordOriginLabel ?? '?'}</strong>
            <button
              onClick={() => useToolStore.getState().setActiveTool('coordSystem')}
              className="ml-2 underline"
              style={{ color: COLORS.textMuted }}
            >
              重选
            </button>
          </span>
        </div>
      )}

      {!coordEntity && activeToolId === 'coordSystem' && (
        <div className="text-sm" style={{ color: COLORS.textMuted }}>
          点击场景中的顶点选择原点
        </div>
      )}

      {coordEntity && (coordEntity.properties as CoordinateSystemProperties).axes && (
        <CoordPointInput coordEntity={coordEntity as Entity<'coordinateSystem'>} />
      )}
    </div>
  );
}

// ─── 坐标输入子组件 ───

const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉';
function subscript(n: number): string {
  return String(n).split('').map((d) => SUBSCRIPTS[Number(d)]).join('');
}

function getNextCoordLabel(existing: string[]): string {
  let i = 1;
  while (existing.includes(`P${subscript(i)}`)) i++;
  return `P${subscript(i)}`;
}

const coordInputStyle = {
  width: 52,
  padding: '2px 4px',
  borderRadius: 3,
  border: `1px solid ${COLORS.border}`,
  fontSize: 12,
  textAlign: 'center' as const,
  background: COLORS.bgMuted,
  color: COLORS.text,
};

function CoordPointInput({ coordEntity }: { coordEntity: Entity<'coordinateSystem'> }) {
  const [coordX, setCoordX] = useState('0');
  const [coordY, setCoordY] = useState('0');
  const [coordZ, setCoordZ] = useState('0');

  const csProps = coordEntity.properties as CoordinateSystemProperties;

  const handleAdd = () => {
    const x = parseFloat(coordX);
    const y = parseFloat(coordY);
    const z = parseFloat(coordZ);
    if (isNaN(x) || isNaN(y) || isNaN(z)) return;

    const store = useEntityStore.getState();
    const allLabels = Object.values(store.entities)
      .filter((e) => e.type === 'point')
      .map((e) => (e.properties as PointProperties).label);

    const cmd = new CreateEntityCommand('point', {
      builtIn: false,
      geometryId: csProps.geometryId,
      constraint: {
        type: 'coordinate' as const,
        coordSystemId: coordEntity.id,
        coords: [x, y, z] as [number, number, number],
      },
      label: getNextCoordLabel(allLabels),
    });
    useHistoryStore.getState().execute(cmd);

    setCoordX('0');
    setCoordY('0');
    setCoordZ('0');
  };

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ fontSize: 13, color: COLORS.text, marginBottom: 4 }}>
        添加坐标点
      </div>
      <div className="flex items-center gap-1" style={{ fontSize: 12 }}>
        <span style={{ color: COLORS.textMuted }}>(</span>
        <input type="number" value={coordX} onChange={(e) => setCoordX(e.target.value)} style={coordInputStyle} step="0.1" />
        <span style={{ color: COLORS.textMuted }}>,</span>
        <input type="number" value={coordY} onChange={(e) => setCoordY(e.target.value)} style={coordInputStyle} step="0.1" />
        <span style={{ color: COLORS.textMuted }}>,</span>
        <input type="number" value={coordZ} onChange={(e) => setCoordZ(e.target.value)} style={coordInputStyle} step="0.1" />
        <span style={{ color: COLORS.textMuted }}>)</span>
      </div>
      <button
        onClick={handleAdd}
        className="w-full mt-2 px-2 py-1 rounded text-sm"
        style={{ background: COLORS.primary, color: '#fff', border: 'none', cursor: 'pointer' }}
      >
        添加坐标点
      </button>
    </div>
  );
}
