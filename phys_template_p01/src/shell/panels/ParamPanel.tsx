import type { ParamSchema, ParamValues } from '@/core/types';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { COLORS } from '@/styles/tokens';

export interface ParamPanelProps {
  schemas: ParamSchema[];
  values: ParamValues;
  onValueChange: (key: string, value: number | boolean | string) => void;
  onBack?: () => void;
  groupPresets?: Array<{ id: string; name: string }>;
  activePresetId?: string;
  onSwitchPreset?: (presetId: string) => void;
}

/**
 * 左侧参数面板 — schema 驱动渲染
 * 根据 ParamSchema 的 discriminated union 类型自动选择渲染控件
 */
export function ParamPanel({ schemas, values, onValueChange, onBack, groupPresets, activePresetId, onSwitchPreset }: ParamPanelProps) {
  const groups = groupSchemas(schemas);

  return (
    <aside
      className="flex h-full flex-col overflow-y-auto"
      style={{
        width: 260,
        minWidth: 240,
        maxWidth: 280,
        borderRight: `1px solid ${COLORS.border}`,
        backgroundColor: COLORS.bg,
      }}
    >
      <div
        className="flex items-center gap-2 px-4 py-3 text-sm font-semibold"
        style={{ color: COLORS.text, borderBottom: `1px solid ${COLORS.border}` }}
      >
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center text-xs font-normal transition-colors hover:opacity-70"
            style={{ color: COLORS.textSecondary }}
          >
            ← 返回
          </button>
        )}
        <span className="flex-1">参数设置</span>
      </div>

      {groupPresets && groupPresets.length > 1 && (
        <div className="flex gap-1.5 px-3 py-2" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
          {groupPresets.map((p) => (
            <button
              key={p.id}
              onClick={() => onSwitchPreset?.(p.id)}
              className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
              style={{
                backgroundColor: p.id === activePresetId ? COLORS.primary : COLORS.bgMuted,
                color: p.id === activePresetId ? '#fff' : COLORS.textSecondary,
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 space-y-1 p-3">
        {groups.length === 0 && (
          <div className="px-2 py-8 text-center text-xs" style={{ color: COLORS.textMuted }}>
            暂无参数
          </div>
        )}

        {groups.map((group) => {
          const visibleSchemas = group.schemas.filter((schema) => {
            if (!schema.visibleWhen) return true;
            return Object.entries(schema.visibleWhen).every(
              ([k, v]) => values[k] === v,
            );
          });
          if (visibleSchemas.length === 0 && !group.label) return null;
          return (
            <div
              key={group.label}
              className="mb-4"
              style={group.label ? {
                borderLeft: `3px solid ${COLORS.primary}`,
                paddingLeft: 10,
              } : undefined}
            >
              {group.label && (
                <div className="mb-2.5">
                  <span
                    className="text-sm font-semibold"
                    style={{ color: COLORS.text }}
                  >
                    {group.label}
                  </span>
                </div>
              )}
              <div className="space-y-3">
                {visibleSchemas.map((schema) => (
                  <ParamControl
                    key={schema.key}
                    schema={schema}
                    value={values[schema.key] ?? schema.default}
                    onChange={(v) => onValueChange(schema.key, v)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

// ─── Schema 驱动控件 ───

interface ParamControlProps {
  schema: ParamSchema;
  value: number | boolean | string;
  onChange: (value: number | boolean | string) => void;
}

function ParamControl({ schema, value, onChange }: ParamControlProps) {
  switch (schema.type) {
    case 'slider':
      return (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs">{schema.label}</Label>
            <span className="text-xs" style={{ color: COLORS.textMuted }}>
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

    case 'input':
      return (
        <div className="space-y-1">
          <Label className="text-xs">{schema.label}</Label>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              value={typeof value === 'number' ? value : schema.default}
              onChange={(e) => onChange(Number(e.target.value))}
              min={schema.min}
              max={schema.max}
              className="h-8 text-xs"
            />
            <span className="text-xs" style={{ color: COLORS.textMuted }}>
              {schema.unit}
            </span>
          </div>
        </div>
      );

    case 'toggle':
      return (
        <div className="flex items-center justify-between">
          <Label className="text-xs">{schema.label}</Label>
          <Switch
            checked={typeof value === 'boolean' ? value : schema.default}
            onCheckedChange={(v) => onChange(v)}
          />
        </div>
      );

    case 'select':
      return (
        <div className="space-y-1">
          <Label className="text-xs">{schema.label}</Label>
          <Select
            value={typeof value === 'string' ? value : schema.default}
            onChange={(e) => onChange(e.target.value)}
            options={schema.options}
          />
        </div>
      );
  }
}

// ─── 辅助函数 ───

interface SchemaGroup {
  label: string;
  schemas: ParamSchema[];
}

function groupSchemas(schemas: ParamSchema[]): SchemaGroup[] {
  const map = new Map<string, ParamSchema[]>();

  for (const s of schemas) {
    const groupKey = s.group ?? '';
    const arr = map.get(groupKey);
    if (arr) {
      arr.push(s);
    } else {
      map.set(groupKey, [s]);
    }
  }

  return Array.from(map.entries()).map(([label, schemas]) => ({
    label,
    schemas,
  }));
}
