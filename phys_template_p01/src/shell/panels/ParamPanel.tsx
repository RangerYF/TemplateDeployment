import type { ParamSchema, ParamValues, ParamVisibilityRule } from '@/core/types';
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
}

/**
 * 左侧参数面板 — schema 驱动渲染
 * 根据 ParamSchema 的类型自动选择控件，并为磁场实验补充方向/电性提示。
 */
export function ParamPanel({ schemas, values, onValueChange, onBack }: ParamPanelProps) {
  const groups = groupSchemas(schemas, values);

  return (
    <aside
      className="flex h-full flex-col"
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

      <div className="flex-1 space-y-1 overflow-y-auto p-3">
        {groups.length === 0 && (
          <div className="px-2 py-8 text-center text-xs" style={{ color: COLORS.textMuted }}>
            暂无参数
          </div>
        )}

        {groups.map((group) => (
          <div key={group.label} className="mb-3">
            {group.label && (
              <div
                className="mb-2 px-1 text-xs font-medium"
                style={{ color: COLORS.textSecondary }}
              >
                {group.label}
              </div>
            )}
            <div className="space-y-3">
              {group.schemas.map((schema) => (
                <ParamControl
                  key={schema.key}
                  schema={schema}
                  value={values[schema.key] ?? schema.default}
                  onChange={(nextValue) => onValueChange(schema.key, nextValue)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

interface ParamControlProps {
  schema: ParamSchema;
  value: number | boolean | string;
  onChange: (value: number | boolean | string) => void;
}

function ParamControl({ schema, value, onChange }: ParamControlProps) {
  switch (schema.type) {
    case 'slider': {
      const numericValue = typeof value === 'number' ? value : schema.default;

      return (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs">{schema.label}</Label>
            <span className="text-xs" style={{ color: COLORS.textMuted }}>
              {formatSliderValue(numericValue, schema.precision ?? 1)}
              {schema.unit}
            </span>
          </div>
          <Slider
            value={[numericValue]}
            onValueChange={([nextValue]) => {
              if (nextValue !== undefined) onChange(nextValue);
            }}
            min={schema.min}
            max={schema.max}
            step={schema.step}
          />
          {schema.key === 'theta' && <AnglePreview angleDeg={numericValue} />}
          {schema.key === 'charge' && <ChargeHint charge={numericValue} />}
        </div>
      );
    }

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
            onCheckedChange={(checked) => onChange(checked)}
          />
        </div>
      );

    case 'select':
      return (
        <div className="space-y-1">
          <Label className="text-xs">{schema.label}</Label>
          <Select
            value={typeof value === 'string' ? value : String(value ?? schema.default)}
            onChange={(e) => {
              const raw = e.target.value;
              const numeric = Number(raw);
              onChange(Number.isNaN(numeric) ? raw : numeric);
            }}
            options={schema.options}
          />
        </div>
      );
  }
}

interface SchemaGroup {
  label: string;
  schemas: ParamSchema[];
}

function groupSchemas(schemas: ParamSchema[], values: ParamValues): SchemaGroup[] {
  const groups = new Map<string, ParamSchema[]>();

  for (const schema of schemas) {
    if (!isSchemaVisible(schema, schemas, values)) continue;

    const groupKey = schema.group ?? '';
    const existing = groups.get(groupKey);
    if (existing) {
      existing.push(schema);
    } else {
      groups.set(groupKey, [schema]);
    }
  }

  return Array.from(groups.entries()).map(([label, groupSchemas]) => ({
    label,
    schemas: groupSchemas,
  }));
}

function isSchemaVisible(
  schema: ParamSchema,
  schemas: ParamSchema[],
  values: ParamValues,
): boolean {
  const rules = schema.visibleWhen;
  if (!rules || rules.length === 0) return true;

  return rules.every((rule) => matchesVisibilityRule(rule, schemas, values));
}

function matchesVisibilityRule(
  rule: ParamVisibilityRule,
  schemas: ParamSchema[],
  values: ParamValues,
): boolean {
  const currentValue = resolveParamValue(rule.key, schemas, values);

  if (rule.equals !== undefined && currentValue !== rule.equals) {
    return false;
  }

  if (rule.notEquals !== undefined && currentValue === rule.notEquals) {
    return false;
  }

  return true;
}

function resolveParamValue(
  key: string,
  schemas: ParamSchema[],
  values: ParamValues,
): ParamValues[string] | undefined {
  if (key in values) {
    return values[key];
  }

  return schemas.find((schema) => schema.key === key)?.default;
}

function formatSliderValue(value: number, precision: number): string {
  if (Math.abs(value) >= 1e4 || (Math.abs(value) > 0 && Math.abs(value) < 1e-2)) {
    return value.toExponential(2);
  }
  return value.toFixed(precision);
}

function AnglePreview({ angleDeg }: { angleDeg: number }) {
  const radians = (angleDeg * Math.PI) / 180;
  const centerX = 24;
  const centerY = 24;
  const tipX = centerX + Math.cos(radians) * 14;
  const tipY = centerY - Math.sin(radians) * 14;

  const leftWingX = tipX - 4 * Math.cos(radians - Math.PI / 6);
  const leftWingY = tipY + 4 * Math.sin(radians - Math.PI / 6);
  const rightWingX = tipX - 4 * Math.cos(radians + Math.PI / 6);
  const rightWingY = tipY + 4 * Math.sin(radians + Math.PI / 6);

  return (
    <div
      className="mt-2 flex items-center gap-2 rounded-md px-2 py-1.5"
      style={{ backgroundColor: COLORS.bgMuted }}
    >
      <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx={centerX} cy={centerY} r="18" fill="none" stroke={COLORS.border} strokeWidth="1.5" />
        <path
          d={`M ${centerX} ${centerY} L ${tipX} ${tipY}`}
          stroke={COLORS.primary}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d={`M ${tipX} ${tipY} L ${leftWingX} ${leftWingY} L ${rightWingX} ${rightWingY} Z`}
          fill={COLORS.primary}
        />
      </svg>
      <div className="text-xs" style={{ color: COLORS.textSecondary }}>
        方向预览按数学角度定义：`0°` 向右，`90°` 向上。
      </div>
    </div>
  );
}

function ChargeHint({ charge }: { charge: number }) {
  let label = '当前为零电荷';
  let color: string = COLORS.textMuted;

  if (charge > 0) {
    label = '当前为正电荷';
    color = '#DC2626';
  } else if (charge < 0) {
    label = '当前为负电荷';
    color = '#2563EB';
  }

  return (
    <div className="mt-2 text-xs font-medium" style={{ color }}>
      {label}
    </div>
  );
}
