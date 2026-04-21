import { useSimulationStore } from '@/store';
import { simulator } from '@/core/engine/simulator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { EntityId, ParamSchema } from '@/core/types';
import type { FloatingComponentProps } from '@/core/registries';

/**
 * 实体浮动参数面板（力学域组件）
 * 选中实体时显示该实体关联的可调参数
 */
export function EntityPopover({ data }: FloatingComponentProps) {
  const { entityId } = data as { entityId: EntityId };

  const paramGroups = useSimulationStore(
    (s) => s.simulationState.scene.paramGroups,
  );
  const paramValues = useSimulationStore((s) => s.paramValues);
  const entities = useSimulationStore(
    (s) => s.simulationState.scene.entities,
  );

  const entity = entities.get(entityId);
  if (!entity) return null;

  // 找到关联该实体的所有参数
  const relatedParams: ParamSchema[] = [];
  for (const group of paramGroups) {
    for (const param of group.params) {
      if (param.targetEntityId === entityId) {
        relatedParams.push(param);
      }
    }
  }

  const handleChange = (key: string, value: number | boolean | string) => {
    simulator.updateParam(key, value);
    const result = simulator.getCurrentResult();
    const store = useSimulationStore.getState();
    store.updateParam(key, value);
    store.setCurrentResult(result);
  };

  return (
    <div
      style={{
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        padding: '10px 14px',
        minWidth: '180px',
        maxWidth: '240px',
        fontSize: '13px',
        lineHeight: '1.6',
        border: '1px solid #E2E8F0',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 标题行（拖拽手柄） */}
      <div
        data-drag-handle
        style={{
          fontWeight: 600,
          fontSize: '13px',
          color: '#1A202C',
          cursor: 'grab',
          userSelect: 'none',
          paddingBottom: '8px',
          marginBottom: '8px',
          borderBottom: '1px solid #E2E8F0',
        }}
      >
        {entity.label ?? entity.type}
      </div>

      {/* 参数列表 */}
      {relatedParams.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {relatedParams.map((schema) => (
            <CompactParamControl
              key={schema.key}
              schema={schema}
              value={paramValues[schema.key] ?? schema.default}
              onChange={(v) => handleChange(schema.key, v)}
            />
          ))}
        </div>
      ) : (
        <div style={{ color: '#94A3B8', fontSize: '12px' }}>
          无可调参数
        </div>
      )}
    </div>
  );
}

function CompactParamControl({
  schema,
  value,
  onChange,
}: {
  schema: ParamSchema;
  value: number | boolean | string;
  onChange: (value: number | boolean | string) => void;
}) {
  switch (schema.type) {
    case 'slider':
      return (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
            <Label className="text-xs">{schema.label}</Label>
            <span style={{ fontSize: '11px', color: '#94A3B8' }}>
              {typeof value === 'number' ? value.toFixed(schema.precision ?? 1) : value}
              {schema.unit}
            </span>
          </div>
          <Slider
            value={[typeof value === 'number' ? value : schema.default]}
            onValueChange={([v]) => { if (v !== undefined) onChange(v); }}
            min={schema.min}
            max={schema.max}
            step={schema.step}
          />
        </div>
      );
    case 'toggle':
      return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Label className="text-xs">{schema.label}</Label>
          <Switch
            checked={typeof value === 'boolean' ? value : schema.default}
            onCheckedChange={(v) => onChange(v)}
          />
        </div>
      );
    default:
      return null;
  }
}
